/** Pure rules for the list of messages shown in a conversation. */

export interface ThreadMessage {
    id?: string;
    /** Set on a message sent from this phone, until the server's saved copy replaces it. */
    tempId?: string;
    [key: string]: unknown;
}

/** A message arriving from the socket: ignored if already shown (by id, or as our own pending copy). */
export function mergeIncoming<T extends ThreadMessage>(messages: T[], incoming: T): T[] {
    const known = messages.some(m => (m.id !== undefined && m.id === incoming.id) || (m.tempId !== undefined && m.tempId === incoming.tempId));
    return known ? messages : [...messages, incoming];
}

/** The server refused a message sent from this phone: take the pending copy back. */
export function dropPending<T extends ThreadMessage>(messages: T[], tempId: string): T[] {
    return messages.filter(m => m.tempId !== tempId);
}
