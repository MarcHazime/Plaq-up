/** The seam between the app and whatever actually delivers email. */
export interface Mailer {
    /** Resolves once the provider accepted the message. Throws when it did not. */
    send(to: string, subject: string, text: string): Promise<void>;
}
