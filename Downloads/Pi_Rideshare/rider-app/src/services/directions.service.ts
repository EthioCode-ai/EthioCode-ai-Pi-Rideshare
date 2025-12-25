import { apiUrl } from '../config/api.config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageKeys } from '../constants';
import { decodePolyline } from '../utils/polyline';

export interface RouteInfo {
  distance: {
    text: string;
    value: number;
  };
  duration: {
    text: string;
    value: number;
  };
  polylinePoints: Array<{ latitude: number; longitude: number }>;
  steps: Array<{
    instruction: string;
    distance: { text: string; value: number };
    duration: { text: string; value: number };
  }>;
}

class DirectionsService {
  private async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem(StorageKeys.AUTH_TOKEN);
  }

  async getRoute(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number }
  ): Promise<RouteInfo | null> {
    try {
      const token = await this.getToken();
      const params = new URLSearchParams({
        originLat: origin.latitude.toString(),
        originLng: origin.longitude.toString(),
        destLat: destination.latitude.toString(),
        destLng: destination.longitude.toString(),
      });

      const response = await fetch(apiUrl(`api/places/directions?${params}`), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok && data.success && data.route) {
        return {
          distance: data.route.distance,
          duration: data.route.duration,
          polylinePoints: decodePolyline(data.route.polyline),
          steps: data.route.steps || [],
        };
      }

      return null;
    } catch (error) {
      console.error('Directions error:', error);
      return null;
    }
  }
}

export const directionsService = new DirectionsService();
export default directionsService;