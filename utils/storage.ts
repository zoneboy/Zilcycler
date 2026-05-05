import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// ============================================================
// STORAGE ABSTRACTION
// Uses Capacitor Preferences (encrypted on Android) on native,
// localStorage on web. All methods are async for consistency.
// ============================================================

const TOKEN_KEY = 'zilcycler_token';
const isNative = Capacitor.isNativePlatform();

/**
 * Get a value from secure storage
 */
export const storageGet = async (key: string): Promise<string | null> => {
    try {
        if (isNative) {
            const result = await Preferences.get({ key });
            return result.value;
        } else {
            return localStorage.getItem(key);
        }
    } catch (e) {
        console.error('Storage get error:', e);
        return null;
    }
};

/**
 * Set a value in secure storage
 */
export const storageSet = async (key: string, value: string): Promise<void> => {
    try {
        if (isNative) {
            await Preferences.set({ key, value });
        } else {
            localStorage.setItem(key, value);
        }
    } catch (e) {
        console.error('Storage set error:', e);
    }
};

/**
 * Remove a value from secure storage
 */
export const storageRemove = async (key: string): Promise<void> => {
    try {
        if (isNative) {
            await Preferences.remove({ key });
        } else {
            localStorage.removeItem(key);
        }
    } catch (e) {
        console.error('Storage remove error:', e);
    }
};

// ============================================================
// TOKEN-SPECIFIC HELPERS
// Convenience functions for the auth token
// ============================================================

export const getToken = (): Promise<string | null> => storageGet(TOKEN_KEY);
export const setToken = (token: string): Promise<void> => storageSet(TOKEN_KEY, token);
export const removeToken = (): Promise<void> => storageRemove(TOKEN_KEY);