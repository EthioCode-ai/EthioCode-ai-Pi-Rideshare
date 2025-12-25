import * as Location from 'expo-location';

class LocationService {
  private watchSubscription: Location.LocationSubscription | null = null;

  async requestPermissions(): Promise<boolean> {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  async getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return null;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  async getAddressFromCoordinates(latitude: number, longitude: number): Promise<string> {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results && results.length > 0) {
        const addr = results[0];
        const parts = [
          addr.streetNumber,
          addr.street,
          addr.city,
          addr.region,
        ].filter(Boolean);
        return parts.join(', ') || 'Unknown location';
      }
      return 'Unknown location';
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      return 'Unknown location';
    }
  }

  async getCoordinatesFromAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const results = await Location.geocodeAsync(address);
      if (results && results.length > 0) {
        return {
          latitude: results[0].latitude,
          longitude: results[0].longitude,
        };
      }
      return null;
    } catch (error) {
      console.error('Error geocoding:', error);
      return null;
    }
  }

  startWatching(
    callback: (location: { latitude: number; longitude: number; heading: number | null }) => void,
    options?: { distanceInterval?: number; timeInterval?: number }
  ) {
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: options?.distanceInterval || 10,
        timeInterval: options?.timeInterval || 5000,
      },
      (location) => {
        callback({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          heading: location.coords.heading,
        });
      }
    ).then((subscription) => {
      this.watchSubscription = subscription;
    });
  }

  stopWatching() {
    if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
    }
  }
}

export const locationService = new LocationService();
export default locationService;