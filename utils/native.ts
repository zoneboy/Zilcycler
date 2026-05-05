import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Network } from '@capacitor/network';

// ============================================================
// NATIVE INTEGRATION HELPERS
// All functions are safe to call on web (no-op on web platform)
// ============================================================

export const isNative = (): boolean => Capacitor.isNativePlatform();
export const isAndroid = (): boolean => Capacitor.getPlatform() === 'android';
export const isWeb = (): boolean => Capacitor.getPlatform() === 'web';

/**
 * Initialize status bar styling
 * Called once at app startup
 */
export const initStatusBar = async (): Promise<void> => {
    if (!isNative()) return;
    
    try {
        // Dark style = white text/icons on green background
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#15803d' });
        await StatusBar.setOverlaysWebView({ overlay: false });
    } catch (e) {
        console.error('StatusBar init failed:', e);
    }
};

/**
 * Hide splash screen with fade
 * Called after initial data load is complete
 */
export const hideSplashScreen = async (): Promise<void> => {
    if (!isNative()) return;
    
    try {
        await SplashScreen.hide({ fadeOutDuration: 300 });
    } catch (e) {
        console.error('SplashScreen hide failed:', e);
    }
};

/**
 * Set up Android hardware back button handler
 * Returns cleanup function
 */
export const setupBackButtonHandler = (
    onBack: () => boolean // Return true if handled, false to use default (exit app)
): (() => void) => {
    if (!isNative()) return () => {};
    
    let listenerHandle: any;
    
    const setup = async () => {
        listenerHandle = await CapApp.addListener('backButton', () => {
            const handled = onBack();
            if (!handled) {
                CapApp.exitApp();
            }
        });
    };
    
    setup();
    
    return () => {
        if (listenerHandle && typeof listenerHandle.remove === 'function') {
            listenerHandle.remove();
        }
    };
};

/**
 * Get current network status
 */
export const getNetworkStatus = async (): Promise<{ connected: boolean; type: string }> => {
    try {
        const status = await Network.getStatus();
        return { connected: status.connected, type: status.connectionType };
    } catch (e) {
        // Web fallback
        return { 
            connected: typeof navigator !== 'undefined' ? navigator.onLine : true, 
            type: 'unknown' 
        };
    }
};

/**
 * Listen for network status changes
 * Returns cleanup function
 */
export const onNetworkChange = (
    callback: (connected: boolean) => void
): (() => void) => {
    let listenerHandle: any;
    
    const setup = async () => {
        try {
            listenerHandle = await Network.addListener('networkStatusChange', (status) => {
                callback(status.connected);
            });
        } catch (e) {
            console.error('Network listener failed:', e);
        }
    };
    
    setup();
    
    // Web fallback for offline/online events
    if (!isNative() && typeof window !== 'undefined') {
        const handleOnline = () => callback(true);
        const handleOffline = () => callback(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (listenerHandle && typeof listenerHandle.remove === 'function') {
                listenerHandle.remove();
            }
        };
    }
    
    return () => {
        if (listenerHandle && typeof listenerHandle.remove === 'function') {
            listenerHandle.remove();
        }
    };
};