import { Capacitor } from '@capacitor/core';

// ============================================================
// GLOBAL CONSTANTS
// ============================================================
export const ZOINTS_RATE_NAIRA = 10;

// ============================================================
// API CONFIGURATION
// Native App (APK) -> Points to Live Netlify Functions directly
// Web App -> Uses relative path '/api' which Netlify redirects handle
// ============================================================
const LIVE_URL = 'https://zilcycler.netlify.app';

export const API_BASE_URL = Capacitor.isNativePlatform()
  ? `${LIVE_URL}/.netlify/functions/api` 
  : '/api';

// ============================================================
// APP VERSION
// Bump these when releasing new versions.
// MIN_SUPPORTED_VERSION matches the lowest version still allowed.
// Below that, force-update modal triggers.
// ============================================================
export const APP_VERSION = '1.0.0';
export const MIN_SUPPORTED_VERSION = '1.0.0';

// ============================================================
// LOCAL ASSETS
// ============================================================
export const PLACEHOLDER_BLOG_IMAGE = '/placeholder-blog.svg';