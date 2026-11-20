export type DeadlineKind = 'inspection' | 'insurance' | 'service' | 'other';

export const KIND_LABELS: Record<DeadlineKind, string> = {
    inspection: 'Contrôle technique',
    insurance: 'Assurance',
    service: 'Entretien / révision',
    other: 'Autre',
};

export interface Deadline {
    id: string;
    plate: string;
    kind: DeadlineKind;
    /** Name shown for the `other` kind. */
    label: string | null;
    /** `YYYY-MM-DD` */
    dueDate: string;
    /** Ids of the scheduled reminders, so they can be cancelled. */
    reminderIds: string[];
    doneAt: string | null;
}

export type DeadlineStatus = 'overdue' | 'soon' | 'ok';

export interface DeadlineView extends Deadline {
    title: string;
    daysLeft: number;
    status: DeadlineStatus;
}

/** Where deadlines live: the phone's storage in the app, memory in tests. */
export interface CarnetStore {
    load(): Promise<Deadline[]>;
    save(deadlines: Deadline[]): Promise<void>;
}

/** Local notifications: expo-notifications in the app, a fake in tests. */
export interface ReminderScheduler {
    /** Asks for the permission when needed. Returns whether reminders can be shown. */
    ensurePermission(): Promise<boolean>;
    schedule(at: Date, title: string, body: string): Promise<string>;
    cancel(ids: string[]): Promise<void>;
}

export interface ParkingSpot {
    latitude: number;
    longitude: number;
    savedAt: string;
}
