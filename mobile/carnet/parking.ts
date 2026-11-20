import type { ParkingSpot } from './types';

export interface ParkingDeps {
    /** Phone storage in the app, a variable in tests. */
    read(): Promise<ParkingSpot | null>;
    write(spot: ParkingSpot | null): Promise<void>;
    /** Current position, or null when the permission is refused or no position is available. */
    locate(): Promise<{ latitude: number; longitude: number } | null>;
    now?: () => Date;
}

export type ParkHereResult = { ok: true; spot: ParkingSpot } | { ok: false; reason: 'no_position' };

export interface Parking {
    /** Remembers where the car is. Replaces the previous spot: there is only one. */
    parkHere(): Promise<ParkHereResult>;
    current(): Promise<ParkingSpot | null>;
    clear(): Promise<void>;
}

export function createParking({ read, write, locate, now = () => new Date() }: ParkingDeps): Parking {
    return {
        async parkHere() {
            const position = await locate();
            if (!position) return { ok: false, reason: 'no_position' };
            const spot: ParkingSpot = { ...position, savedAt: now().toISOString() };
            await write(spot);
            return { ok: true, spot };
        },
        current: read,
        clear: () => write(null),
    };
}

/** Walking directions to the spot, in the maps app of the phone (works on iOS and Android). */
export function directionsUrl(spot: ParkingSpot): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${spot.latitude},${spot.longitude}&travelmode=walking`;
}
