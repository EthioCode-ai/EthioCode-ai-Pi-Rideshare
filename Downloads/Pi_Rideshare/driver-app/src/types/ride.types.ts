/**
 * Ride Type Definitions
 * Phase 2.6 - ActiveRideScreen
 */

export type TripStatus = 
  | 'en_route_to_pickup'
  | 'at_pickup'
  | 'in_trip'
  | 'completed'
  | 'cancelled';

export interface RiderInfo {
  id: string;
  name: string;
  rating: number;
  phone?: string;
  photoUrl?: string;
}

export interface LocationCoordinates {
  lat: number;
  lng: number;
}

export interface LocationWithAddress {
  address: string;
  lat: number;
  lng: number;
}

export interface RouteSegment {
  miles: number;
  minutes: number;
  polyline?: string;
}

export interface RideDistances {
  toPickup: RouteSegment;
  toDestination: RouteSegment;
  total?: RouteSegment;
}

export interface FareInfo {
  estimated: number;
  final?: number;
  currency: string;
  surgeMultiplier?: number;
}

export interface ActiveRide {
  rideId: string;
  status: TripStatus;
  rider: RiderInfo;
  pickup: LocationWithAddress;
  destination: LocationWithAddress;
  fare: FareInfo;
  distance: RideDistances;
  requestedAt?: string;
  acceptedAt: string;
  arrivedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancellation?: {
    reason: string;
    cancelledBy: 'rider' | 'driver' | 'system';
  };
}

export interface ActiveRideScreenParams {
  ride: ActiveRide;
}

export const getTripStatusDisplay = (status: TripStatus): string => {
  const statusMap: Record<TripStatus, string> = {
    'en_route_to_pickup': 'EN ROUTE',
    'at_pickup': 'AT PICKUP',
    'in_trip': 'IN TRIP',
    'completed': 'COMPLETED',
    'cancelled': 'CANCELLED',
  };
  return statusMap[status] || status.toUpperCase();
};

export const getPrimaryActionText = (status: TripStatus): string => {
  const actionMap: Record<TripStatus, string> = {
    'en_route_to_pickup': "I've Arrived",
    'at_pickup': 'Start Trip',
    'in_trip': 'Complete Trip',
    'completed': 'Done',
    'cancelled': 'Return Home',
  };
  return actionMap[status] || 'Continue';
};

export const getNextStatus = (currentStatus: TripStatus): TripStatus | null => {
  const transitionMap: Record<TripStatus, TripStatus | null> = {
    'en_route_to_pickup': 'at_pickup',
    'at_pickup': 'in_trip',
    'in_trip': 'completed',
    'completed': null,
    'cancelled': null,
  };
  return transitionMap[currentStatus];
};

export const isTripActive = (status: TripStatus): boolean => {
  return !['completed', 'cancelled'].includes(status);
};

export const formatDistance = (miles: number): string => {
  if (miles < 0.1) return 'Nearby';
  return `${miles.toFixed(1)} mi`;
};

export const formatDuration = (minutes: number): string => {
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};