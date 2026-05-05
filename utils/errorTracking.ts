import { Capacitor } from '@capacitor/core';
import { API_BASE_URL, APP_VERSION } from '../constants';

// ============================================================
// ERROR TRACKING - Self-hosted via /api/log/error
// All errors silently dropped on failure (never break the app)
// ============================================================

interface ErrorPayload {
    errorType: string;
    errorMessage: string;
    errorStack?: string;
    userAgent?: string;
    appVersion?: string;
    platform?: 'web' | 'android' | 'ios' | 'unknown';
    url?: string;
    metadata?: Record<string, any>;
}

const getPlatform = (): 'web' | 'android' | 'ios' | 'unknown' => {
    try {
        const p = Capacitor.getPlatform();
        if (p === 'web' || p === 'android' || p === 'ios') return p;
        return 'unknown';
    } catch {
        return 'web';
    }
};

// Throttle: don't send the same error type more than once per minute
const recentErrors = new Map<string, number>();
const THROTTLE_MS = 60_000;

const shouldThrottle = (key: string): boolean => {
    const now = Date.now();
    const last = recentErrors.get(key);
    if (last && now - last < THROTTLE_MS) return true;
    recentErrors.set(key, now);
    
    // Cleanup old entries
    if (recentErrors.size > 50) {
        const cutoff = now - THROTTLE_MS;
        for (const [k, v] of recentErrors) {
            if (v < cutoff) recentErrors.delete(k);
        }
    }
    
    return false;
};

/**
 * Log an error to the backend
 * Fails silently - errors during error logging are dropped
 */
export const logError = async (
    errorType: string,
    error: Error | string,
    metadata?: Record<string, any>
): Promise<void> => {
    try {
        const errorMessage = typeof error === 'string' ? error : error.message;
        const errorStack = typeof error === 'string' ? undefined : error.stack;
        
        // Throttle by errorType + first 50 chars of message
        const throttleKey = `${errorType}:${errorMessage.slice(0, 50)}`;
        if (shouldThrottle(throttleKey)) return;
        
        const payload: ErrorPayload = {
            errorType: errorType.slice(0, 100),
            errorMessage: errorMessage.slice(0, 2000),
            errorStack: errorStack ? errorStack.slice(0, 10000) : undefined,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : undefined,
            appVersion: APP_VERSION,
            platform: getPlatform(),
            url: typeof window !== 'undefined' ? window.location.href.slice(0, 2000) : undefined,
            metadata,
        };
        
        await fetch(`${API_BASE_URL}/log/error`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }).catch(() => {
            // Silent fail - never let error logging break the app
        });
    } catch {
        // Final catch - error logging must never throw
    }
};

/**
 * Initialize global error handlers
 * Call once at app startup
 */
export const initErrorTracking = (): void => {
    if (typeof window === 'undefined') return;
    
    // Catch uncaught JS errors
    window.addEventListener('error', (event) => {
        if (event.error) {
            logError('uncaught_error', event.error, {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
            });
        } else {
            logError('uncaught_error', event.message || 'Unknown error');
        }
    });
    
    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        if (reason instanceof Error) {
            logError('unhandled_promise_rejection', reason);
        } else {
            logError('unhandled_promise_rejection', String(reason));
        }
    });
    
    // Log version on init
    if (typeof console !== 'undefined') {
        console.log(`[Zilcycler] v${APP_VERSION} on ${getPlatform()} - error tracking active`);
    }
};