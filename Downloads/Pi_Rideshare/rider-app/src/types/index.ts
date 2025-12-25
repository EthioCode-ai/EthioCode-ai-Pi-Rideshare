export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  profileImage?: string;
  userType: 'rider';
  createdAt: string;
}

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
  name?: string;
}

export interface SavedPlace {
  id: string;
  name: string;
  label: 'home' | 'work' | 'other';
  location: Location;
  icon: string;
}

export interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  profileImage?: string;
  rating: number;
  totalRides: number;
  vehicle: Vehicle;
  location?: Location;
  heading?: number;
}

export interface Vehicle {
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate: string;
  type: 'economy' | 'standard' | 'xl' | 'premium';
}

export interface RideEstimate {
  vehicleType: string;
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  surgeFare: number;
  surgeMultiplier: number;
  totalFare: number;
  estimatedDuration: number;
  estimatedDistance: number;
  eta: number;
}

export interface Ride {
  id: string;
  riderId: string;
  driverId?: string;
  driver?: Driver;
  status: string;
  pickup: Location;
  destination: Location;
  stops?: Location[];
  vehicleType: string;
  fare: number;
  surgeMultiplier: number;
  paymentMethod: string;
  preferences: string[];
  requestedAt: string;
  acceptedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  rating?: number;
  tip?: number;
}

export interface SurgeZone {
  id: string;
  center: { lat: number; lng: number };
  multiplier: number;
  surgeAmount: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  suggestedDeparture?: Date;
  aiTip?: string;
}

export interface AIRecommendation {
  suggestedDeparture: Date;
  currentSurge: number;
  predictedSurge: number;
  predictedSurgeTime: Date;
  potentialSavings: number;
  recommendedVehicle: string;
  reason: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'ride' | 'promo' | 'alert' | 'general';
  isRead: boolean;
  createdAt: string;
  data?: any;
}