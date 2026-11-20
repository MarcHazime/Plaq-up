import type { CarnetStore, Deadline, ReminderScheduler } from './types';

/** In-memory CarnetStore: the second adapter that makes the seam real, and the one tests use. */
export class MemoryCarnetStore implements CarnetStore {
    private data: Deadline[] = [];
    async load() {
        return this.data.map(d => ({ ...d, reminderIds: [...d.reminderIds] }));
    }
    async save(deadlines: Deadline[]) {
        this.data = deadlines.map(d => ({ ...d, reminderIds: [...d.reminderIds] }));
    }
}

/** Records scheduled reminders instead of showing them. */
export class FakeScheduler implements ReminderScheduler {
    scheduled = new Map<string, { at: Date; title: string; body: string }>();
    permission = true;
    permissionAsked = 0;
    private next = 1;

    async ensurePermission() {
        this.permissionAsked++;
        return this.permission;
    }
    async schedule(at: Date, title: string, body: string) {
        const id = `n${this.next++}`;
        this.scheduled.set(id, { at, title, body });
        return id;
    }
    async cancel(ids: string[]) {
        for (const id of ids) this.scheduled.delete(id);
    }
}
