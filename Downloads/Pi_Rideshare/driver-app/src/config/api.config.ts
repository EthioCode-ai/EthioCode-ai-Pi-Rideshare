/**
 * 🚀 Pi VIP Rideshare - Unified API Configuration
 * 
 * Supports:
 * - Driver Mobile App (55 features)
 * - Rider Mobile App (66 features) 
 * - Admin Dashboard (64 features)
 * - Backend Integration (79 features)
 * 
 * Total: 264 features across the ecosystem
 * 
 * 👤 Configured for: Avi
 * 📍 Local IP: 192.168.0.180
 * ☁️ Production: Railway
 */

// ============================================
// 1. ENVIRONMENT CONFIGURATION
// ============================================

const LOCAL_IP = '192.168.0.180'; // ✅ Your IP from ipconfig
const LOCAL_PORT = 3001;

type Environment = 'local' | 'production';
type AppRole = 'driver' | 'rider' | 'admin';

// 👇 CHANGE THESE TO SWITCH ENVIRONMENTS/APPS
const CURRENT_ENV: Environment = 'local'; // Switch to 'local' for local testing
const APP_ROLE: AppRole = 'driver'; // Change to 'rider' or 'admin' for other apps

const API_URLS = {
  local: `http://${LOCAL_IP}:${LOCAL_PORT}`,
  production: 'https://ethiocode-ai-pi-rideshare-production.up.railway.app',
};

export const API_BASE_URL = API_URLS[CURRENT_ENV];

// ============================================
// 2. SHARED ENDPOINTS (All Apps)
// ============================================

export const SHARED_ENDPOINTS = {
  // Authentication
  LOGIN: '/api/auth/login',
  REGISTER: '/api/auth/register',
  LOGOUT: '/api/auth/logout',
  VERIFY_TOKEN: '/api/auth/verify',
  RESET_PASSWORD: '/api/auth/reset-password',
  VERIFY_EMAIL: '/api/auth/verify-email',
  
  // User Profile
  PROFILE: '/api/users/profile',
  UPDATE_PROFILE: '/api/users/profile',
  TRIP_HISTORY: '/api/users/trips',
  
  // Pi Assistant (OpenAI GPT-4)
  CHAT: '/api/chat',
  CHAT_HISTORY: '/api/chat/history',
  
  // Notifications
  NOTIFICATIONS: '/api/notifications',
  
  // Configuration
  CONFIG: '/api/config',
  VEHICLE_TYPES: '/api/settings/vehicle-types',
};

// ============================================
// 3. DRIVER-SPECIFIC ENDPOINTS (55 Features)
// ============================================

export const DRIVER_ENDPOINTS = {
  // Ride Management
  RIDE_REQUESTS: '/api/driver/ride-requests',
  ACCEPT_RIDE: (rideId: string) => `/api/rides/${rideId}/accept`,
  TRIP_STATUS: '/api/driver/trip-status',
  UPDATE_TRIP_STATUS: (rideId: string) => `/api/rides/${rideId}/status`,
  
  // Performance & Earnings
  PERFORMANCE_TODAY: (driverId: string) => `/api/driver/performance/today/${driverId}`,
  STATS: '/api/driver/stats',
  EARNINGS: (driverId: string) => `/api/driver/earnings/${driverId}`,
  TAX_DOCUMENTS: '/api/driver/tax-documents',
  
  // Status & Location
  UPDATE_STATUS: '/api/driver/status',
  UPDATE_LOCATION: '/api/drivers/location',
  
  // Onboarding & Verification
  ENROLL: '/api/driver/enroll',
  UPLOAD_DOCUMENT: '/api/driver/documents',
  VERIFICATION_STATUS: '/api/driver/verification-status',
  
  // Corporate Discounts
  RIDER_CORPORATE_INFO: '/api/driver/rider-corporate-info',
  CONFIRM_DISCOUNT: '/api/driver/confirm-discount-verification',
  
  // Airport Features
  AIRPORT_ZONES: '/api/airports',
  JOIN_QUEUE: '/api/airports/join-queue',
  QUEUE_STATUS: '/api/airports/queue-status',
};

// ============================================
// 4. RIDER-SPECIFIC ENDPOINTS (66 Features)
// ============================================

export const RIDER_ENDPOINTS = {
  // Ride Booking
  REQUEST_RIDE: '/api/rides',
  ESTIMATE_FARE: '/api/rides/estimate',
  CANCEL_RIDE: (rideId: string) => `/api/rides/${rideId}/cancel`,
  ADD_TIP: (rideId: string) => `/api/rides/${rideId}/tip`,
  ACTIVE_RIDES: '/api/rides/active',
  RIDE_DETAILS: (rideId: string) => `/api/rides/${rideId}`,
  
  // Payments
  CREATE_PAYMENT_INTENT: '/api/create-payment-intent',
  SETUP_INTENT: '/api/payments/setup-intent',
  ADD_PAYMENT_METHOD: '/api/payments/add-method',
  APPLE_PAY: '/api/payments/apple-pay',
  GOOGLE_PAY: '/api/payments/google-pay',
  PAYMENT_METHODS: (userId: string) => `/api/users/${userId}/payment-methods`,
  
  // Saved Places
  SAVED_PLACES: '/api/rider/saved-places',
  
  // Corporate Discounts
  APPLY_CORPORATE: '/api/corporate-applications',
  UPLOAD_BADGE: '/api/corporate/upload-badge',
  CORPORATIONS: '/api/corporations',
  
  // Location Services
  WEATHER: '/api/weather',
  TRAFFIC: '/api/traffic',
};

// ============================================
// 5. ADMIN-SPECIFIC ENDPOINTS (64 Features)
// ============================================

export const ADMIN_ENDPOINTS = {
  // Analytics
  ANALYTICS: '/api/admin/analytics',
  ML_ANALYTICS: '/api/admin/ml-analytics',
  
  // Driver Management
  ALL_DRIVERS: '/api/admin/drivers',
  UPDATE_DRIVER: (driverId: string) => `/api/admin/drivers/${driverId}`,
  DRIVER_TRIPS: (driverId: string) => `/api/admin/drivers/${driverId}/trips`,
  
  // Rider Management
  ALL_RIDERS: '/api/admin/riders',
  
  // Ride Management
  ALL_RIDES: '/api/admin/rides',
  
  // Surge Pricing
  CONFIGURE_SURGE: '/api/admin/surge',
  
  // Corporate Program
  CORPORATE_APPLICATIONS: '/api/admin/corporate-applications',
};

// ============================================
// 6. SOCKET.IO CONFIGURATION
// ============================================

/**
 * Socket.IO Events by Namespace
 */
export const SOCKET_EVENTS = {
  driver: {
    // Listen (incoming from server)
    NEW_RIDE_REQUEST: 'new-ride-request',
    RIDE_ACCEPTED: 'ride-accepted',
    RIDE_STATUS_CHANGED: 'ride-status-changed',
    CORPORATE_VERIFICATION: 'corporate-badge-verification',
    
    // Emit (outgoing to server)
    UPDATE_LOCATION: 'driver-location-update',
    UPDATE_AVAILABILITY: 'driver-availability-update',
    ACCEPT_RIDE: 'accept-ride',
    UPDATE_TRIP_STATUS: 'update-trip-status',
  },
  rider: {
    // Listen (incoming from server)
    FINDING_DRIVER: 'finding-driver',
    DRIVER_ASSIGNED: 'driver-assigned',
    DRIVER_LOCATION: 'driver-location-update',
    DRIVER_ETA: 'driver-eta-update',
    RIDE_STATUS_CHANGED: 'ride-status-changed',
    
    // Emit (outgoing to server)
    REQUEST_RIDE: 'request-ride',
    CANCEL_RIDE: 'cancel-ride',
    UPDATE_LOCATION: 'rider-location-update',
  },
  admin: {
    // Listen (incoming from server)
    LIVE_ACTIVITY: 'live-activity-update',
    PENDING_REQUESTS: 'pending-requests-update',
    SURGE_UPDATE: 'surge-zone-update',
    
    // Emit (outgoing to server)
    CONFIGURE_SURGE: 'configure-surge',
  },
};

export const SOCKET_CONFIG = {
  url: API_BASE_URL,
  namespace: `/${APP_ROLE}`, // '/driver', '/rider', or '/admin'
  events: SOCKET_EVENTS[APP_ROLE],
  options: {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
  },
};

// ============================================
// 7. EXTERNAL SERVICES CONFIGURATION
// ============================================

export const EXTERNAL_SERVICES = {
  // Google Maps (fetched from backend for security)
  GOOGLE_MAPS_API_KEY: 'Fetched from /api/config',
  
  // Stripe (public key - safe for frontend)
  // Get your key from: https://dashboard.stripe.com/test/apikeys
  STRIPE_PUBLISHABLE_KEY: 'pk_test_YOUR_STRIPE_KEY_HERE', // 👈 Add your Stripe key
  
  // OpenAI (backend-only, documented here for reference)
  OPENAI_MODEL: 'gpt-4',
  
  // Feature flags (enable/disable features easily)
  FEATURES: {
    VOICE_COMMANDS: true,          // Voice-activated Pi Assistant
    PI_ASSISTANT: true,            // GPT-4 chatbot
    CORPORATE_DISCOUNTS: true,     // Workplace discount verification
    AIRPORT_QUEUE: true,           // FIFO airport pickup queue
    SURGE_PRICING: true,           // Dynamic demand pricing
    ML_ANALYTICS: true,            // Weather + traffic forecasting
    CASCADING_ALERTS: true,        // 7-second ride request countdown
    TURN_BY_TURN: true,            // Navigation with voice guidance
  },
};

// ============================================
// 8. APP-SPECIFIC CONFIGURATION
// ============================================

/**
 * Current App Endpoints (auto-selected based on role)
 */
export const APP_ENDPOINTS = {
  driver: DRIVER_ENDPOINTS,
  rider: RIDER_ENDPOINTS,
  admin: ADMIN_ENDPOINTS,
}[APP_ROLE];

/**
 * Request Configuration
 */
export const REQUEST_TIMEOUT = 15000; // 15 seconds
export const UPLOAD_TIMEOUT = 60000; // 60 seconds for document uploads

/**
 * Ride Request Configuration (Driver App)
 */
export const RIDE_REQUEST_CONFIG = {
  COUNTDOWN_DURATION: 7000, // 7 seconds for cascading alerts
  AUTO_DECLINE_AFTER: 7000, // Auto-decline if no response
  CHIME_SOUND: true,        // Play audio alert
  VIBRATE: true,            // Vibrate phone
};

/**
 * Location Tracking Configuration
 */
export const LOCATION_CONFIG = {
  UPDATE_INTERVAL: 2000,    // Send location every 2 seconds
  ACCURACY: 'high',         // High GPS accuracy
  DISTANCE_FILTER: 10,      // Update if moved 10+ meters
};

/**
 * Map Configuration
 */
export const MAP_CONFIG = {
  DEFAULT_ZOOM: 15,
  DRIVING_ZOOM: 17,
  DRIVING_PITCH: 60,        // 3D tilt when driving
  ROTATION_ENABLED: true,   // Rotate map with heading
};

/**
 * Debug Mode (automatically enabled in development)
 */
export const DEBUG_MODE = __DEV__;

// ============================================
// 9. LOGGING
// ============================================

if (DEBUG_MODE) {
  console.log('🚀 Pi VIP Rideshare Configuration');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   👤 Configured for: Avi');
  console.log('   📱 App Role:', APP_ROLE.toUpperCase());
  console.log('   🌍 Environment:', CURRENT_ENV.toUpperCase());
  console.log('   🔗 Base URL:', API_BASE_URL);
  console.log('   🔌 Socket Namespace:', SOCKET_CONFIG.namespace);
  console.log('   ⚡ Features:', Object.keys(EXTERNAL_SERVICES.FEATURES).filter(k => EXTERNAL_SERVICES.FEATURES[k as keyof typeof EXTERNAL_SERVICES.FEATURES]).join(', '));
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

// ============================================
// 10. EXPORTS
// ============================================

export default {
  API_BASE_URL,
  SHARED_ENDPOINTS,
  APP_ENDPOINTS,
  DRIVER_ENDPOINTS,
  RIDER_ENDPOINTS,
  ADMIN_ENDPOINTS,
  SOCKET_CONFIG,
  SOCKET_EVENTS,
  EXTERNAL_SERVICES,
  REQUEST_TIMEOUT,
  UPLOAD_TIMEOUT,
  RIDE_REQUEST_CONFIG,
  LOCATION_CONFIG,
  MAP_CONFIG,
  DEBUG_MODE,
  APP_ROLE,
  CURRENT_ENV,
};