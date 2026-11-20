/** Calendar dates as `YYYY-MM-DD` strings, computed in local time so no timezone can shift a day. */

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDate(iso: string): Date | null {
    const m = ISO.exec(iso);
    if (!m) return null;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const date = new Date(y, mo - 1, d);
    return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null;
}

export function formatDate(date: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** Adds months, clamping to the end of the month (29 Feb + 1 year = 28 Feb). */
export function addMonths(iso: string, months: number): string {
    const date = parseDate(iso);
    if (!date) throw new Error(`Invalid date: ${iso}`);
    const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(date.getDate(), lastDay));
    return formatDate(target);
}

export function addDays(iso: string, days: number): string {
    const date = parseDate(iso);
    if (!date) throw new Error(`Invalid date: ${iso}`);
    date.setDate(date.getDate() + days);
    return formatDate(date);
}

/** Whole days from `now`'s calendar day to `iso` (negative when past). */
export function daysUntil(iso: string, now: Date): number {
    const date = parseDate(iso);
    if (!date) throw new Error(`Invalid date: ${iso}`);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((date.getTime() - today.getTime()) / 86_400_000);
}

/** `JJ/MM/AAAA` as typed by the user to `YYYY-MM-DD`, or null when it is not a real date. */
export function fromFrench(text: string): string | null {
    const m = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/.exec(text.trim());
    if (!m) return null;
    const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return parseDate(iso) ? iso : null;
}

export function toFrench(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

/** Adds the slashes while the user types digits: `1503` becomes `15/03`. */
export function maskFrench(text: string): string {
    const digits = text.replace(/\D/g, '').slice(0, 8);
    return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/');
}
