import { describe, expect, it } from 'vitest';
import { createCarnet, inspectionDue, proposedNextDate } from './carnet';
import { addMonths, daysUntil, fromFrench, maskFrench, toFrench } from './dates';
import { FakeScheduler, MemoryCarnetStore } from './memory';
import { createParking, directionsUrl } from './parking';
import type { ParkingSpot } from './types';

const NOW = new Date(2026, 0, 10, 8, 0); // 10 Jan 2026, 08:00 local

function setup(now = NOW) {
    const scheduler = new FakeScheduler();
    let n = 0;
    const carnet = createCarnet({ store: new MemoryCarnetStore(), scheduler, now: () => now, newId: () => `d${++n}` });
    return { carnet, scheduler };
}

describe('dates', () => {
    it('clamps to the end of the month', () => {
        expect(addMonths('2024-02-29', 12)).toBe('2025-02-28');
        expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
        expect(addMonths('2026-11-15', 24)).toBe('2028-11-15');
    });
    it('counts calendar days whatever the time of day', () => {
        expect(daysUntil('2026-01-11', new Date(2026, 0, 10, 23, 59))).toBe(1);
        expect(daysUntil('2026-01-10', new Date(2026, 0, 10, 0, 1))).toBe(0);
        expect(daysUntil('2026-01-09', NOW)).toBe(-1);
    });
});

describe('french dates', () => {
    it('reads what the user types and rejects impossible dates', () => {
        expect(fromFrench('15/03/2027')).toBe('2027-03-15');
        expect(fromFrench('5.3.2027')).toBe('2027-03-05');
        expect(fromFrench('31/02/2027')).toBeNull();
        expect(fromFrench('15/03/27')).toBeNull();
        expect(toFrench('2027-03-05')).toBe('05/03/2027');
    });
    it('adds slashes while typing', () => {
        expect(maskFrench('1')).toBe('1');
        expect(maskFrench('150')).toBe('15/0');
        expect(maskFrench('15032027')).toBe('15/03/2027');
        expect(maskFrench('15/03/2027999')).toBe('15/03/2027');
    });
});

describe('next dates', () => {
    it('proposes +2 years for the inspection, +1 for insurance and service, nothing for other', () => {
        expect(proposedNextDate('inspection', '2026-03-01')).toBe('2028-03-01');
        expect(proposedNextDate('insurance', '2026-03-01')).toBe('2027-03-01');
        expect(proposedNextDate('service', '2026-03-01')).toBe('2027-03-01');
        expect(proposedNextDate('other', '2026-03-01')).toBeNull();
    });

    it('computes the first inspection at 4 years, then 2 years after the last one', () => {
        expect(inspectionDue({ firstRegistration: '2023-05-20' }, NOW)).toBe('2027-05-20');
        expect(inspectionDue({ firstRegistration: '2015-05-20' }, NOW)).toBeNull(); // too old, last one unknown
        expect(inspectionDue({ firstRegistration: '2015-05-20', lastInspection: '2025-11-02' }, NOW)).toBe('2027-11-02');
        expect(inspectionDue({}, NOW)).toBeNull();
        expect(inspectionDue({ lastInspection: 'garbage' }, NOW)).toBeNull();
    });
});

describe('carnet', () => {
    it('schedules reminders at 30 days, 7 days and on the day, at 9:00', async () => {
        const { carnet, scheduler } = setup();
        const r = await carnet.add({ plate: 'AB-123-CD', kind: 'insurance', dueDate: '2026-03-15' });
        expect(r).toMatchObject({ ok: true, remindersOn: true });
        const times = [...scheduler.scheduled.values()].map(s => s.at).sort((a, b) => a.getTime() - b.getTime());
        expect(times).toEqual([new Date(2026, 1, 13, 9), new Date(2026, 2, 8, 9), new Date(2026, 2, 15, 9)]);
        expect([...scheduler.scheduled.values()][0].body).toContain('AB-123-CD');
    });

    it('skips reminders already in the past', async () => {
        const { carnet, scheduler } = setup();
        await carnet.add({ plate: 'AB-123-CD', kind: 'service', dueDate: '2026-01-20' }); // 10 days away
        expect([...scheduler.scheduled.values()].map(s => s.at)).toEqual([new Date(2026, 0, 13, 9), new Date(2026, 0, 20, 9)]);
    });

    it('does not ask for the notification permission when nothing is scheduled', async () => {
        const { carnet, scheduler } = setup();
        await carnet.add({ plate: 'AB-123-CD', kind: 'service', dueDate: '2025-12-01' });
        expect(scheduler.permissionAsked).toBe(0);
    });

    it('keeps the deadline but reports reminders off when the permission is refused', async () => {
        const { carnet, scheduler } = setup();
        scheduler.permission = false;
        const r = await carnet.add({ plate: 'AB-123-CD', kind: 'inspection', dueDate: '2026-06-01' });
        expect(r).toMatchObject({ ok: true, remindersOn: false });
        expect(scheduler.scheduled.size).toBe(0);
        expect(await carnet.list()).toHaveLength(1);
    });

    it('validates the date and the name of an "other" deadline', async () => {
        const { carnet } = setup();
        expect(await carnet.add({ plate: 'A', kind: 'insurance', dueDate: '2026-02-30' })).toEqual({ ok: false, reason: 'invalid_date' });
        expect(await carnet.add({ plate: 'A', kind: 'insurance', dueDate: 'demain' })).toEqual({ ok: false, reason: 'invalid_date' });
        expect(await carnet.add({ plate: 'A', kind: 'other', label: '  ', dueDate: '2026-05-01' })).toEqual({ ok: false, reason: 'label_required' });
        expect(await carnet.list()).toEqual([]);
    });

    it('lists nearest first with a status and a title', async () => {
        const { carnet } = setup();
        await carnet.add({ plate: 'A', kind: 'insurance', dueDate: '2026-09-01' });
        await carnet.add({ plate: 'A', kind: 'other', label: 'Pneus hiver', dueDate: '2026-01-25' });
        await carnet.add({ plate: 'A', kind: 'inspection', dueDate: '2026-01-02' });
        const list = await carnet.list();
        expect(list.map(d => [d.title, d.status])).toEqual([
            ['Contrôle technique', 'overdue'],
            ['Pneus hiver', 'soon'],
            ['Assurance', 'ok'],
        ]);
    });

    it('"Done" moves to the proposed date, replaces the reminders and records when', async () => {
        const { carnet, scheduler } = setup();
        const added = await carnet.add({ plate: 'A', kind: 'insurance', dueDate: '2026-01-20' });
        if (!added.ok) throw new Error();
        const before = scheduler.scheduled.size;
        const done = await carnet.markDone(added.deadline.id);
        expect(done).toMatchObject({ dueDate: '2027-01-20', doneAt: NOW.toISOString() });
        expect(scheduler.scheduled.size).toBe(3); // the old two are gone, three new ones exist
        expect(before).toBe(2);
        expect((await carnet.list())).toHaveLength(1);
    });

    it('"Done" accepts a corrected date, and removes a deadline that has no next one', async () => {
        const { carnet } = setup();
        const a = await carnet.add({ plate: 'A', kind: 'service', dueDate: '2026-02-01' });
        const o = await carnet.add({ plate: 'A', kind: 'other', label: 'Vignette', dueDate: '2026-02-01' });
        if (!a.ok || !o.ok) throw new Error();
        expect(await carnet.markDone(a.deadline.id, '2026-08-01')).toMatchObject({ dueDate: '2026-08-01' });
        expect(await carnet.markDone(o.deadline.id)).toBeNull();
        expect((await carnet.list()).map(d => d.kind)).toEqual(['service']);
    });

    it('update reschedules, remove cancels', async () => {
        const { carnet, scheduler } = setup();
        const added = await carnet.add({ plate: 'A', kind: 'insurance', dueDate: '2026-03-15' });
        if (!added.ok) throw new Error();
        await carnet.update(added.deadline.id, { dueDate: '2026-04-15' });
        expect([...scheduler.scheduled.values()].map(s => s.at).sort((a, b) => a.getTime() - b.getTime()).pop()).toEqual(new Date(2026, 3, 15, 9));
        expect(scheduler.scheduled.size).toBe(3);
        expect(await carnet.update(added.deadline.id, { dueDate: 'nope' })).toEqual({ ok: false, reason: 'invalid_date' });
        await carnet.remove(added.deadline.id);
        expect(scheduler.scheduled.size).toBe(0);
        expect(await carnet.list()).toEqual([]);
    });
});

describe('parking', () => {
    function parkingSetup(position: { latitude: number; longitude: number } | null) {
        let stored: ParkingSpot | null = null;
        const parking = createParking({
            read: async () => stored,
            write: async s => { stored = s; },
            locate: async () => position,
            now: () => NOW,
        });
        return parking;
    }

    it('remembers one spot, the latest', async () => {
        const parking = parkingSetup({ latitude: 48.85, longitude: 2.35 });
        expect(await parking.current()).toBeNull();
        const r = await parking.parkHere();
        expect(r).toMatchObject({ ok: true, spot: { latitude: 48.85, longitude: 2.35, savedAt: NOW.toISOString() } });
        expect(await parking.current()).toMatchObject({ latitude: 48.85 });
        await parking.clear();
        expect(await parking.current()).toBeNull();
    });

    it('keeps the previous spot when no position is available', async () => {
        const good = parkingSetup({ latitude: 1, longitude: 2 });
        await good.parkHere();
        const denied = createParking({ read: good.current, write: async () => { throw new Error('should not write'); }, locate: async () => null });
        expect(await denied.parkHere()).toEqual({ ok: false, reason: 'no_position' });
        expect(await denied.current()).toMatchObject({ latitude: 1 });
    });

    it('builds a walking directions link', () => {
        expect(directionsUrl({ latitude: 48.85, longitude: 2.35, savedAt: '' })).toBe(
            'https://www.google.com/maps/dir/?api=1&destination=48.85,2.35&travelmode=walking'
        );
    });
});
