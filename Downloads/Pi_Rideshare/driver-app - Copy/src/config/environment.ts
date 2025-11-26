// Environment Configuration
// Switch between development and production

export const ENV = {
  // Change this to 'production' when deploying
  MODE: 'development' as 'development' | 'production',
  
  // API URLs
  API_URL: {
    development: 'http://localhost:3001',
    production: 'https://c3ae5066-b07d-4ca3-8a63-d0ea5329a006-00-3c9c4iku143gi.sisko.replit.dev'
  },
  
  // Socket.IO URLs (same as API for this project)
  SOCKET_URL: {
    development: 'http://localhost:3001',
    production: 'https://c3ae5066-b07d-4ca3-8a63-d0ea5329a006-00-3c9c4iku143gi.sisko.replit.dev'
  },
  
  // Google Maps API Key
  GOOGLE_MAPS_API_KEY: 'YOUR_GOOGLE_MAPS_API_KEY_HERE',
  
  // App Configuration
  APP_NAME: 'Pi VIP Driver',
  VERSION: '1.0.0',
};

// Helper to get current API URL
export const getApiUrl = () => {
  return ENV.API_URL[ENV.MODE];
};

// Helper to get current Socket URL
export const getSocketUrl = () => {
  return ENV.SOCKET_URL[ENV.MODE];
};

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  REGISTER: '/api/auth/register',
  LOGIN: '/api/auth/login',
  RESET_PASSWORD: '/api/auth/reset-password',
  RESET_PASSWORD_CONFIRM: '/api/auth/reset-password-confirm',
  SEND_VERIFICATION: '/api/auth/send-verification',
  VERIFY_EMAIL: '/api/auth/verify-email',
  
  // Driver (add as we build)
  DRIVER_PROFILE: '/api/driver/profile',
  DRIVER_LOCATION: '/api/driver/location',
  DRIVER_STATUS: '/api/driver/status',
  
  // Rides (add as we build)
  RIDE_ACCEPT: '/api/rides/accept',
  RIDE_START: '/api/rides/start',
  RIDE_COMPLETE: '/api/rides/complete',
  RIDE_CANCEL: '/api/rides/cancel',
};
