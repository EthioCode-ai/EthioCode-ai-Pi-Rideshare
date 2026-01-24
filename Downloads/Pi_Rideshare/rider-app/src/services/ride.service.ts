import { apiUrl } from '../config/api.config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageKeys } from '../constants';
import { RideEstimate, Ride, Location } from '../types';

class RideService {
  private async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem(StorageKeys.AUTH_TOKEN);
  }

  private async authHeaders(): Promise<HeadersInit> {
    const token = await this.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  async getEstimate(
    pickup: Location,
    destination: Location,
    vehicleType?: string
  ): Promise<{ success: boolean; estimates?: RideEstimate[]; error?: string }> {
    try {
      const response = await fetch(apiUrl('api/rides/estimate'), {
        method: 'POST',
        headers: await this.authHeaders(),
        body: JSON.stringify({
          pickup_lat: pickup.latitude,
          pickup_lng: pickup.longitude,
          destination_lat: destination.latitude,
          destination_lng: destination.longitude,
          vehicle_type: vehicleType,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        return { success: true, estimates: data.estimates };
      }
      return { success: false, error: data.error };
    } catch (error) {
      console.error('Get estimate error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  async requestRide(
    pickup: Location,
    destination: Location,
    vehicleType: string,
    paymentMethod: string,
    preferences: string[] = []
  ): Promise<{ success: boolean; ride?: Ride; error?: string }> {
    try {
      const response = await fetch(apiUrl('api/rides/request'), {
        method: 'POST',
        headers: await this.authHeaders(),
        body: JSON.stringify({
  pickup: {
    coordinates: { lat: pickup.latitude, lng: pickup.longitude },
    address: pickup.address,
    // Airport fields (only included if present)
    isAirport: pickup.isAirport,
    airportCode: pickup.airportCode,
    airportName: pickup.airportName,
    zoneCode: pickup.zoneCode,
    zoneName: pickup.zoneName,
    doorLocation: pickup.doorLocation,
  },
  destination: {
    coordinates: { lat: destination.latitude, lng: destination.longitude },
    address: destination.address,
    // Airport fields (only included if present)
    isAirport: destination.isAirport,
    airportCode: destination.airportCode,
    airportName: destination.airportName,
    zoneCode: destination.zoneCode,
    zoneName: destination.zoneName,
    doorLocation: destination.doorLocation,
  },
  rideType: vehicleType,
  paymentMethodId: paymentMethod,
  riderPreferences: preferences,
}),
      });

      const data = await response.json();
      if (response.ok) {
        return { success: true, ride: data.ride };
      }
      return { success: false, error: data.error };
    } catch (error) {
      console.error('Request ride error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  async cancelRide(rideId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(apiUrl(`api/rides/${rideId}/cancel`), {
        method: 'POST',
        headers: await this.authHeaders(),
        body: JSON.stringify({ reason }),
      });

      const data = await response.json();
      if (response.ok) {
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (error) {
      console.error('Cancel ride error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  async getRideHistory(): Promise<{ success: boolean; rides?: Ride[]; error?: string }> {
    try {
      const response = await fetch(apiUrl('api/rides/history'), {
        headers: await this.authHeaders(),
      });

      const data = await response.json();
      if (response.ok) {
        return { success: true, rides: data.rides };
      }
      return { success: false, error: data.error };
    } catch (error) {
      console.error('Get ride history error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  async getCurrentRide(): Promise<{ success: boolean; ride?: Ride | null; error?: string }> {
    try {
      const response = await fetch(apiUrl('api/rides/current'), {
        headers: await this.authHeaders(),
      });

      const data = await response.json();
      if (response.ok) {
        return { success: true, ride: data.ride };
      }
      return { success: false, error: data.error };
    } catch (error) {
      console.error('Get current ride error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  async rateRide(rideId: string, rating: number, feedback?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(apiUrl(`api/rides/${rideId}/rate`), {
        method: 'POST',
        headers: await this.authHeaders(),
        body: JSON.stringify({ rating, feedback }),
      });

      const data = await response.json();
      if (response.ok) {
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (error) {
      console.error('Rate ride error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  async addTip(rideId: string, amount: number): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(apiUrl(`api/rides/${rideId}/tip`), {
        method: 'POST',
        headers: await this.authHeaders(),
        body: JSON.stringify({ amount }),
      });

      const data = await response.json();
      if (response.ok) {
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (error) {
      console.error('Add tip error:', error);
      return { success: false, error: 'Network error' };
    }
  }
}

export const rideService = new RideService();
export default rideService;