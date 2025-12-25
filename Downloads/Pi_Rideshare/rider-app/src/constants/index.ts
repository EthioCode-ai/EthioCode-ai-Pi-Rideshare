export const StorageKeys = {
  AUTH_TOKEN: 'authToken',
  USER_DATA: 'userData',
  THEME: 'theme',
  SAVED_PLACES: 'savedPlaces',
  RIDE_PREFERENCES: 'ridePreferences',
  PAYMENT_METHOD: 'defaultPaymentMethod',
  VOICE_ENABLED: 'voiceEnabled',
  CALENDAR_SYNC: 'calendarSync',
};

export const VehicleTypes = {
  EVERYDAY: 'everyday',
  RELAX: 'relax',
  PREMIUM: 'premium',
  BUSINESS: 'business',
  FAMILY: 'family',
};

export const VehicleInfo = {
  everyday: {
    name: 'Everyday',
    icon: '🚗',
    description: 'Affordable rides for daily trips',
    capacity: 4,
    baseMultiplier: 1.0,
  },
  relax: {
    name: 'Relax',
    icon: '🚙',
    description: 'Extra legroom & comfort',
    capacity: 4,
    baseMultiplier: 1.3,
  },
  premium: {
    name: 'Premium',
    icon: '✨',
    description: 'Luxury vehicles & top service',
    capacity: 4,
    baseMultiplier: 2.0,
  },
  business: {
    name: 'Business',
    icon: '🎩',
    description: 'Professional drivers & executive cars',
    capacity: 4,
    baseMultiplier: 2.5,
  },
  family: {
    name: 'Family',
    icon: '🚐',
    description: 'SUVs & minivans for groups',
    capacity: 6,
    baseMultiplier: 1.8,
  },
};

export const RidePreferences = {
  AC_ON: 'ac_on',
  QUIET_RIDE: 'quiet_ride',
  CURBSIDE_PICKUP: 'curbside',
  MUSIC_ON: 'music_on',
  PET_FRIENDLY: 'pet_friendly',
  WHEELCHAIR_ACCESSIBLE: 'wheelchair',
};

export const RideStatus = {
  SEARCHING: 'searching',
  DRIVER_ASSIGNED: 'driver_assigned',
  DRIVER_EN_ROUTE: 'driver_en_route',
  DRIVER_ARRIVED: 'driver_arrived',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

export const PaymentMethods = {
  CARD: 'card',
  APPLE_PAY: 'apple_pay',
  GOOGLE_PAY: 'google_pay',
  CORPORATE: 'corporate',
  CASH: 'cash',
};