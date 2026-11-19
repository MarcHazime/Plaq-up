export interface AccountUser {
    id: string;
    email: string | null;
    passwordHash: string;
    isVerified: boolean;
    verificationToken: string | null;
    verificationExpires: Date | null;
    resetToken: string | null;
    resetTokenExpires: Date | null;
    pseudo: string | null;
    acceptNewContacts: boolean;
    suspended: boolean;
}

export type UserPatch = Partial<Omit<AccountUser, 'id' | 'suspended'>>;

export interface NewAccount {
    email: string;
    passwordHash: string;
    plate: string;
    verificationToken: string;
    verificationExpires: Date;
}

/** The seam between the Account module and its storage. */
export interface AccountStore {
    findById(id: string): Promise<AccountUser | null>;
    findByEmail(email: string): Promise<AccountUser | null>;
    /** The owner of a Vehicle registered under this Plate. */
    findByPlate(plate: string): Promise<AccountUser | null>;
    createWithVehicle(account: NewAccount): Promise<AccountUser>;
    update(id: string, patch: UserPatch): Promise<void>;
    /** Removes the User and everything about them: Vehicles, Messages (sent and received), Blocks, Conversations. */
    delete(id: string): Promise<void>;
}

export interface Hasher {
    hash(password: string): Promise<string>;
    compare(password: string, hash: string): Promise<boolean>;
}

export type RegisterResult =
    | { ok: true; userId: string; email: string; primaryPlate: string }
    | { ok: false; reason: 'invalid_plate' | 'weak_password' | 'invalid_email' | 'plate_taken' | 'email_taken' | 'email_failed'; detail?: string };

export type VerifyResult =
    | { ok: true; userId: string; email: string | null }
    | { ok: false; reason: 'missing' | 'not_found' | 'already_verified' | 'invalid_code' };

export type ResendResult =
    | { ok: true }
    | { ok: false; reason: 'not_found' | 'already_verified' | 'no_email' | 'email_failed' };

export type LoginResult =
    | { ok: true; userId: string; email: string | null; primaryPlate: string }
    | { ok: false; reason: 'invalid' }
    | { ok: false; reason: 'suspended' }
    | { ok: false; reason: 'unverified'; userId: string; email: string | null };

export type ResetResult =
    | { ok: true }
    | { ok: false; reason: 'weak_password' | 'invalid_code' | 'email_failed' };

export type ChangePasswordResult =
    | { ok: true }
    | { ok: false; reason: 'not_found' | 'wrong_password' | 'weak_password' };

export type SettingsResult =
    | { ok: true; pseudo: string | null; acceptNewContacts: boolean }
    | { ok: false; reason: 'not_found' | 'length' | 'characters' | 'looks_like_plate' | 'reserved' };
