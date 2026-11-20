import { addMonths, daysUntil, parseDate } from './dates';
import { KIND_LABELS } from './types';
import type { CarnetStore, Deadline, DeadlineKind, DeadlineStatus, DeadlineView, ReminderScheduler } from './types';

/** Reminders go out this many days before the due date, and on the day, at 9:00. */
export const REMINDER_DAYS_BEFORE = [30, 7, 0];
export const REMINDER_HOUR = 9;
export const SOON_WITHIN_DAYS = 30;

/** Months between two occurrences of each kind, used to propose the next date after "Done". */
const REPEAT_MONTHS: Record<DeadlineKind, number | null> = {
    inspection: 24,
    insurance: 12,
    service: 12,
    other: null,
};

export function proposedNextDate(kind: DeadlineKind, dueDate: string): string | null {
    const months = REPEAT_MONTHS[kind];
    return months === null ? null : addMonths(dueDate, months);
}

/**
 * Next technical inspection under the French rule: the first one at the 4th anniversary of the first
 * registration, then every 2 years from the last one. Unknown when the car is older than 4 years and
 * the last inspection is not given. The user can always correct the result.
 */
export function inspectionDue(input: { firstRegistration?: string | null; lastInspection?: string | null }, now: Date): string | null {
    if (input.lastInspection) return parseDate(input.lastInspection) ? addMonths(input.lastInspection, 24) : null;
    if (!input.firstRegistration || !parseDate(input.firstRegistration)) return null;
    const first = addMonths(input.firstRegistration, 48);
    return daysUntil(first, now) >= 0 ? first : null;
}

export interface NewDeadline {
    plate: string;
    kind: DeadlineKind;
    label?: string | null;
    dueDate: string;
}

export type AddResult =
    | { ok: true; deadline: DeadlineView; remindersOn: boolean }
    | { ok: false; reason: 'invalid_date' | 'label_required' };

export interface Carnet {
    add(input: NewDeadline): Promise<AddResult>;
    /** Deadlines of all vehicles, nearest first. */
    list(): Promise<DeadlineView[]>;
    /** Marks it done and moves it to `nextDueDate`. Without one, uses the proposed date; when there is none, removes it. */
    markDone(id: string, nextDueDate?: string): Promise<DeadlineView | null>;
    update(id: string, changes: { dueDate?: string; label?: string | null }): Promise<AddResult | null>;
    remove(id: string): Promise<void>;
}

export interface CarnetDeps {
    store: CarnetStore;
    scheduler: ReminderScheduler;
    now?: () => Date;
    newId?: () => string;
}

export function createCarnet({ store, scheduler, now = () => new Date(), newId = () => Math.random().toString(36).slice(2) + Date.now().toString(36) }: CarnetDeps): Carnet {
    const titleOf = (d: Pick<Deadline, 'kind' | 'label'>) => (d.kind === 'other' && d.label ? d.label : KIND_LABELS[d.kind]);

    const view = (d: Deadline): DeadlineView => {
        const daysLeft = daysUntil(d.dueDate, now());
        const status: DeadlineStatus = daysLeft < 0 ? 'overdue' : daysLeft <= SOON_WITHIN_DAYS ? 'soon' : 'ok';
        return { ...d, title: titleOf(d), daysLeft, status };
    };

    const reminderBody = (d: Deadline, daysBefore: number) =>
        daysBefore === 0
            ? `${titleOf(d)} : c'est aujourd'hui (${d.plate}).`
            : `${titleOf(d)} dans ${daysBefore} jours (${d.plate}).`;

    /** Schedules the reminders still in the future. Returns their ids. */
    async function scheduleReminders(d: Deadline): Promise<{ ids: string[]; allowed: boolean }> {
        const due = parseDate(d.dueDate)!;
        const times = REMINDER_DAYS_BEFORE.map(daysBefore => ({
            daysBefore,
            at: new Date(due.getFullYear(), due.getMonth(), due.getDate() - daysBefore, REMINDER_HOUR),
        })).filter(t => t.at > now());
        if (!times.length) return { ids: [], allowed: true };
        if (!(await scheduler.ensurePermission())) return { ids: [], allowed: false };
        const ids: string[] = [];
        for (const t of times) ids.push(await scheduler.schedule(t.at, 'Plaq\'Up : rappel', reminderBody(d, t.daysBefore)));
        return { ids, allowed: true };
    }

    const validate = (dueDate: string, kind: DeadlineKind, label: string | null): 'invalid_date' | 'label_required' | null => {
        if (!parseDate(dueDate)) return 'invalid_date';
        if (kind === 'other' && !label?.trim()) return 'label_required';
        return null;
    };

    return {
        async add({ plate, kind, label = null, dueDate }) {
            const cleanLabel = kind === 'other' ? label?.trim() || null : null;
            const problem = validate(dueDate, kind, cleanLabel);
            if (problem) return { ok: false, reason: problem };

            const deadline: Deadline = { id: newId(), plate, kind, label: cleanLabel, dueDate, reminderIds: [], doneAt: null };
            const { ids, allowed } = await scheduleReminders(deadline);
            deadline.reminderIds = ids;
            await store.save([...(await store.load()), deadline]);
            return { ok: true, deadline: view(deadline), remindersOn: allowed };
        },

        async list() {
            return (await store.load()).map(view).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        },

        async markDone(id, nextDueDate) {
            const all = await store.load();
            const current = all.find(d => d.id === id);
            if (!current) return null;
            await scheduler.cancel(current.reminderIds);

            const next = nextDueDate ?? proposedNextDate(current.kind, current.dueDate);
            if (!next || !parseDate(next)) {
                await store.save(all.filter(d => d.id !== id));
                return null;
            }
            const updated: Deadline = { ...current, dueDate: next, doneAt: now().toISOString(), reminderIds: [] };
            updated.reminderIds = (await scheduleReminders(updated)).ids;
            await store.save(all.map(d => (d.id === id ? updated : d)));
            return view(updated);
        },

        async update(id, changes) {
            const all = await store.load();
            const current = all.find(d => d.id === id);
            if (!current) return null;
            const dueDate = changes.dueDate ?? current.dueDate;
            const label = current.kind === 'other' ? (changes.label !== undefined ? changes.label?.trim() || null : current.label) : null;
            const problem = validate(dueDate, current.kind, label);
            if (problem) return { ok: false, reason: problem };

            await scheduler.cancel(current.reminderIds);
            const updated: Deadline = { ...current, dueDate, label, reminderIds: [] };
            const { ids, allowed } = await scheduleReminders(updated);
            updated.reminderIds = ids;
            await store.save(all.map(d => (d.id === id ? updated : d)));
            return { ok: true, deadline: view(updated), remindersOn: allowed };
        },

        async remove(id) {
            const all = await store.load();
            const current = all.find(d => d.id === id);
            if (!current) return;
            await scheduler.cancel(current.reminderIds);
            await store.save(all.filter(d => d.id !== id));
        },
    };
}
