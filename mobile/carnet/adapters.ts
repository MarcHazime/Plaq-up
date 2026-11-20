import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { createCarnet } from './carnet';
import { createParking } from './parking';
import type { CarnetStore, Deadline, ParkingSpot, ReminderScheduler } from './types';

const DEADLINES_KEY = 'carnet.deadlines.v1';
const PARKING_KEY = 'carnet.parking.v1';

const asyncStorageCarnetStore: CarnetStore = {
    async load() {
        try {
            const raw = await AsyncStorage.getItem(DEADLINES_KEY);
            return raw ? (JSON.parse(raw) as Deadline[]) : [];
        } catch {
            return [];
        }
    },
    async save(deadlines) {
        await AsyncStorage.setItem(DEADLINES_KEY, JSON.stringify(deadlines));
    },
};

// Loaded lazily: expo-notifications is unavailable in Expo Go, and reminders must not crash the app there.
function notifications(): typeof import('expo-notifications') | null {
    try {
        return require('expo-notifications');
    } catch {
        return null;
    }
}

const expoScheduler: ReminderScheduler = {
    async ensurePermission() {
        const N = notifications();
        if (!N) return false;
        try {
            const current = await N.getPermissionsAsync();
            if (current.granted) return true;
            if (!current.canAskAgain) return false;
            return (await N.requestPermissionsAsync()).granted;
        } catch {
            return false;
        }
    },
    async schedule(at, title, body) {
        const N = notifications()!;
        return N.scheduleNotificationAsync({
            content: { title, body },
            trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: at },
        });
    },
    async cancel(ids) {
        const N = notifications();
        if (!N) return;
        await Promise.all(ids.map(id => N.cancelScheduledNotificationAsync(id).catch(() => undefined)));
    },
};

export const carnet = createCarnet({ store: asyncStorageCarnetStore, scheduler: expoScheduler });

export const parking = createParking({
    async read() {
        try {
            const raw = await AsyncStorage.getItem(PARKING_KEY);
            return raw ? (JSON.parse(raw) as ParkingSpot) : null;
        } catch {
            return null;
        }
    },
    async write(spot) {
        if (spot) await AsyncStorage.setItem(PARKING_KEY, JSON.stringify(spot));
        else await AsyncStorage.removeItem(PARKING_KEY);
    },
    async locate() {
        try {
            const permission = await Location.requestForegroundPermissionsAsync();
            if (!permission.granted) return null;
            const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            return { latitude: position.coords.latitude, longitude: position.coords.longitude };
        } catch {
            return null;
        }
    },
});
