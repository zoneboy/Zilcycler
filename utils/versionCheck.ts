import { Capacitor } from '@capacitor/core';
import { API_BASE_URL, APP_VERSION } from '../constants';

// ============================================================
// VERSION CHECK
// Calls /api/health/version on app launch to determine if
// user needs to update.
// ============================================================

export interface VersionCheckResult {
    upToDate: boolean;
    forceUpdate: boolean;
    currentVersion?: string;
    minimumVersion?: string;
    updateMessage?: string;
    updateUrl?: string;
}

const getPlatform = (): 'web' | 'android' | 'ios' => {
    try {
        const p = Capacitor.getPlatform();
        if (p === 'android' || p === 'ios') return p;
    } catch {
        // fall through
    }
    return 'web';
};

/**
 * Check if the current app version is supported
 * Returns null if check fails (don't block app startup on network issues)
 */
export const checkAppVersion = async (): Promise<VersionCheckResult | null> => {
    try {
        const response = await fetch(`${API_BASE_URL}/health/version`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                platform: getPlatform(),
                currentVersion: APP_VERSION,
            }),
            // Time out fast - don't block app startup
            signal: AbortSignal.timeout(5000),
        });
        
        if (!response.ok) return null;
        return await response.json();
    } catch {
        // Network error, timeout, etc - silently allow app to continue
        return null;
    }
};