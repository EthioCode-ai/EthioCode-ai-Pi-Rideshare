/**
 * Storage Keys for Pi VIP Rideshare Driver App
 * Centralized constants for AsyncStorage keys
 */

export const StorageKeys = {
  AUTH_TOKEN: '@PiVIPRideshare:authToken',
  USER_DATA: '@PiVIPRideshare:userData',
  REMEMBERED_EMAIL: '@PiVIPRideshare:rememberedEmail',
} as const;

export type StorageKey = typeof StorageKeys[keyof typeof StorageKeys];