import * as ExpoLocation from 'expo-location';
import type { Location } from '../types';

class LocationService {
  private watchSubscription: ExpoLocation.LocationSubscription | null = null;
  private currentLocation: Location | null = null;

  // Request location permissions
  async requestPermissions(): Promise<boolean> {
    try {
      const { status: foregroundStatus } = await ExpoLocation.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        console.error('Foreground location permission denied');
        return false;
      }

      // Request background permission for active rides
      const { status: backgroundStatus } = await ExpoLocation.requestBackgroundPermissionsAsync();
      
      if (backgroundStatus !== 'granted') {
        console.warn('Background location permission denied - will only work in foreground');
      }

      return true;
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  // Check if location permissions are granted
  async hasPermissions(): Promise<boolean> {
    try {
      const { status } = await ExpoLocation.getForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error checking location permissions:', error);
      return false;
    }
  }

  // Get current location (one-time)
  async getCurrentLocation(): Promise<Location | null> {
    try {
      const hasPermission = await this.hasPermissions();
      if (!hasPermission) {
        console.error('Location permission not granted');
        return null;
      }

      const location = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.High,
      });

      const formattedLocation: Location = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        heading: location.coords.heading || undefined,
        speed: location.coords.speed || undefined,
        accuracy: location.coords.accuracy || undefined,
        timestamp: location.timestamp,
      };

      this.currentLocation = formattedLocation;
      return formattedLocation;
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  // Start watching location (continuous updates)
  async startWatchingLocation(
    callback: (location: Location) => void,
    options?: {
      accuracy?: ExpoLocation.Accuracy;
      distanceInterval?: number;
      timeInterval?: number;
    }
  ): Promise<boolean> {
    try {
      const hasPermission = await this.hasPermissions();
      if (!hasPermission) {
        console.error('Location permission not granted');
        return false;
      }

      // Stop any existing subscription
      await this.stopWatchingLocation();

      this.watchSubscription = await ExpoLocation.watchPositionAsync(
        {
          accuracy: options?.accuracy || ExpoLocation.Accuracy.High,
          distanceInterval: options?.distanceInterval || 10, // Update every 10 meters
          timeInterval: options?.timeInterval || 5000, // Update every 5 seconds
        },
        (location) => {
          const formattedLocation: Location = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            heading: location.coords.heading || undefined,
            speed: location.coords.speed || undefined,
            accuracy: location.coords.accuracy || undefined,
            timestamp: location.timestamp,
          };

          this.currentLocation = formattedLocation;
          callback(formattedLocation);
        }
      );

      console.log('Started watching location');
      return true;
    } catch (error) {
      console.error('Error watching location:', error);
      return false;
    }
  }

  // Stop watching location
  async stopWatchingLocation(): Promise<void> {
    if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
      console.log('Stopped watching location');
    }
  }

  // Get last known location
  getLastKnownLocation(): Location | null {
    return this.currentLocation;
  }

  // Calculate distance between two locations (in meters)
  calculateDistance(location1: Location, location2: Location): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (location1.latitude * Math.PI) / 180;
    const φ2 = (location2.latitude * Math.PI) / 180;
    const Δφ = ((location2.latitude - location1.latitude) * Math.PI) / 180;
    const Δλ = ((location2.longitude - location1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  // Format distance for display
  formatDistance(distanceInMeters: number): string {
    if (distanceInMeters < 1000) {
      return `${Math.round(distanceInMeters)}m`;
    }
    return `${(distanceInMeters / 1000).toFixed(1)}km`;
  }
}

export default new LocationService();
