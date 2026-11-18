let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const getAuthToken = () => token;
export const setAuthToken = (value: string | null) => { token = value; };

/** Called when the server rejects the current token (expired or invalid). */
export const setUnauthorizedHandler = (handler: (() => void) | null) => { onUnauthorized = handler; };
export const notifyUnauthorized = () => { if (token) onUnauthorized?.(); };
