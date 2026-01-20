import { Capacitor } from '@capacitor/core';

// Global Constants
export const ZOINTS_RATE_NAIRA = 10;

// IMPORTANT: Replace this with your actual live website URL
// Check your Netlify dashboard to confirm your site name (e.g., https://zilcycler.netlify.app)
const LIVE_URL = 'https://zilcycler.netlify.app';

// Determine API URL based on platform
// Native App (APK) -> Points to Live Netlify Functions
// Web App -> Uses relative path '/api' which Netlify redirects handle
export const API_BASE_URL = Capacitor.isNativePlatform()
  ? `${LIVE_URL}/.netlify/functions/api` 
  : '/api';
