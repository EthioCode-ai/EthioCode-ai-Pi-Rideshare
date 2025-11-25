/**
 * Driver Service
 * 
 * Handles all driver-specific operations:
 * - Today's performance data
 * - Earnings (today, week, month)
 * - Online/offline status updates
 * - Location updates
 * - Trip management
 * 
 * Uses api.service for HTTP requests
 */

import apiService from './api.service';
import { DRIVER_ENDPOINTS } from '../config/api.config';

/**
 * Performance Data Interface
 */
export interface PerformanceData {
  today: number;      // Today's earnings
  trips: number;      // Number of trips completed
  hours: number;      // Hours online
  miles: number;      // Miles driven
  lastRide: number;   // Last ride earnings
}

/**
 * Earnings Data Interface (for detailed view)
 */
export interface EarningsData {
  today: number;
  week: number;
  month: number;
  trips: number;
  hours: number;
  rating: number;
  lastRide: number;
  miles: number;
}

/**
 * Online Status Update Request
 */
export interface StatusUpdate {
  driverId: string;
  isOnline: boolean;
  location?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Location Update Request
 */
export interface LocationUpdate {
  driverId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
}

/**
 * Driver Service Methods
 */
const driverService = {
  /**
   * Get Today's Performance Data
   * 
   * Fetches current day's earnings, trips, hours, miles
   * Used by: HomeScreen performance panel
   * 
   * @param driverId - Driver's user ID
   * @returns Promise<PerformanceData>
   */
  getPerformanceToday: async (driverId: string): Promise<PerformanceData> => {
    try {
      console.log('📊 Fetching today\'s performance for driver:', driverId);

      const data = await apiService.get<PerformanceData>(
        DRIVER_ENDPOINTS.PERFORMANCE_TODAY(driverId)
      );

      console.log('✅ Performance data loaded:', data);

      return data;
    } catch (error: any) {
      console.error('❌ Failed to fetch performance data:', error);
      
      // Return zeros if API fails (graceful degradation)
      return {
        today: 0,
        trips: 0,
        hours: 0,
        miles: 0,
        lastRide: 0,
      };
    }
  },

  /**
   * Get Detailed Earnings
   * 
   * Fetches comprehensive earnings data (today, week, month)
   * Used by: EarningsModal
   * 
   * @param driverId - Driver's user ID
   * @returns Promise<EarningsData>
   */
  getEarnings: async (driverId: string): Promise<EarningsData> => {
    try {
      console.log('💰 Fetching earnings for driver:', driverId);

      const data = await apiService.get<EarningsData>(
        DRIVER_ENDPOINTS.EARNINGS(driverId)
      );

      console.log('✅ Earnings data loaded:', data);

      return data;
    } catch (error: any) {
      console.error('❌ Failed to fetch earnings:', error);
      
      // Return zeros if API fails
      return {
        today: 0,
        week: 0,
        month: 0,
        trips: 0,
        hours: 0,
        rating: 0,
        lastRide: 0,
        miles: 0,
      };
    }
  },

  /**
   * Update Online Status
   * 
   * Toggles driver between online/offline
   * Used by: GO ONLINE button, power button
   * 
   * @param statusUpdate - Driver ID, online status, and optional location
   * @returns Promise<{ success: boolean; status: string }>
   */
  updateOnlineStatus: async (
    driverId: string,
    isOnline: boolean,
    location?: { latitude: number; longitude: number }
  ): Promise<{ success: boolean; status: string; timestamp: string }> => {
    try {
      console.log(`🔄 Updating driver status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

      const statusUpdate: StatusUpdate = {
        driverId,
        isOnline,
        location,
      };

      const response = await apiService.post<{
        success: boolean;
        status: string;
        timestamp: string;
      }>(DRIVER_ENDPOINTS.UPDATE_STATUS, statusUpdate);

      console.log(`✅ Status updated: ${response.status}`);

      return response;
    } catch (error: any) {
      console.error('❌ Failed to update status:', error);
      throw {
        success: false,
        message: error.message || 'Failed to update online status',
      };
    }
  },

  /**
   * Send Location Update
   * 
   * Sends driver's current GPS location to backend
   * Called every 2 seconds when driver is online
   * 
   * @param locationUpdate - Driver ID and GPS coordinates
   * @returns Promise<void>
   */
  updateLocation: async (locationUpdate: LocationUpdate): Promise<void> => {
    try {
      // Send location update (no need to wait for response)
      await apiService.post(DRIVER_ENDPOINTS.UPDATE_LOCATION, locationUpdate);

      // Don't log every location update (too noisy)
      // console.log('📍 Location updated');
    } catch (error) {
      // Silently fail for location updates (retry on next interval)
      console.warn('⚠️ Location update failed (will retry)');
    }
  },

  /**
   * Get Driver Stats
   * 
   * Fetches comprehensive driver statistics
   * 
   * @returns Promise<any>
   */
  getStats: async (): Promise<any> => {
    try {
      const data = await apiService.get(DRIVER_ENDPOINTS.STATS);
      return data;
    } catch (error: any) {
      console.error('❌ Failed to fetch driver stats:', error);
      throw error;
    }
  },

  /**
   * Get Current Trip Status
   * 
   * Gets information about active trip
   * 
   * @returns Promise<any>
   */
  getTripStatus: async (): Promise<any> => {
    try {
      const data = await apiService.get(DRIVER_ENDPOINTS.TRIP_STATUS);
      return data;
    } catch (error: any) {
      console.error('❌ Failed to fetch trip status:', error);
      return null;
    }
  },

  /**
   * Accept Ride Request
   * 
   * Driver accepts an incoming ride request
   * 
   * @param rideId - Ride request ID
   * @returns Promise<any>
   */
  acceptRide: async (rideId: string): Promise<any> => {
    try {
      console.log('✅ Accepting ride:', rideId);
      
      const response = await apiService.post(
        DRIVER_ENDPOINTS.ACCEPT_RIDE(rideId)
      );

      return response;
    } catch (error: any) {
      console.error('❌ Failed to accept ride:', error);
      throw error;
    }
  },

  /**
   * Update Trip Status
   * 
   * Updates current trip status (accepted → pickup → enroute → completed)
   * 
   * @param rideId - Ride ID
   * @param status - New status
   * @returns Promise<any>
   */
  updateTripStatus: async (
    rideId: string,
    status: 'accepted' | 'pickup' | 'enroute' | 'completed' | 'cancelled'
  ): Promise<any> => {
    try {
      console.log(`🔄 Updating trip ${rideId} to status: ${status}`);
      
      const response = await apiService.post(
        DRIVER_ENDPOINTS.UPDATE_TRIP_STATUS(rideId),
        { status }
      );

      return response;
    } catch (error: any) {
      console.error('❌ Failed to update trip status:', error);
      throw error;
    }
  },

  /**
   * Get Available Ride Requests
   * 
   * Fetches pending ride requests available to this driver
   * 
   * @returns Promise<any[]>
   */
  getRideRequests: async (): Promise<any[]> => {
    try {
      const data = await apiService.get(DRIVER_ENDPOINTS.RIDE_REQUESTS);
      return data;
    } catch (error: any) {
      console.error('❌ Failed to fetch ride requests:', error);
      return [];
    }
  },

  /**
   * Upload Driver Document
   * 
   * Uploads license, insurance, or vehicle registration
   * 
   * @param documentType - Type of document
   * @param fileUri - Local file URI
   * @returns Promise<any>
   */
  uploadDocument: async (
    documentType: 'license' | 'insurance' | 'registration',
    fileUri: string
  ): Promise<any> => {
    try {
      console.log(`📄 Uploading ${documentType} document`);

      // Create form data
      const formData = new FormData();
      formData.append('documentType', documentType);
      formData.append('file', {
        uri: fileUri,
        type: 'image/jpeg',
        name: `${documentType}.jpg`,
      } as any);

      const response = await apiService.upload(
        DRIVER_ENDPOINTS.UPLOAD_DOCUMENT,
        formData
      );

      console.log('✅ Document uploaded successfully');

      return response;
    } catch (error: any) {
      console.error('❌ Failed to upload document:', error);
      throw error;
    }
  },

  /**
   * Get Verification Status
   * 
   * Checks background check and document verification status
   * 
   * @returns Promise<any>
   */
  getVerificationStatus: async (): Promise<any> => {
    try {
      const data = await apiService.get(DRIVER_ENDPOINTS.VERIFICATION_STATUS);
      return data;
    } catch (error: any) {
      console.error('❌ Failed to fetch verification status:', error);
      return null;
    }
  },
};

export default driverService;
export type { PerformanceData, EarningsData, StatusUpdate, LocationUpdate };