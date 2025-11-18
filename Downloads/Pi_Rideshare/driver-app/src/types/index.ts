// Core Type Definitions for Driver App

// User & Authentication Types
export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: 'driver' | 'rider' | 'admin';
  profilePicture?: string;
  createdAt: string;
}

export interface Driver extends User {
  licenseNumber: string;
  vehicleInfo: VehicleInfo;
  rating: number;
  totalRides: number;
  earnings: {
    today: number;
    week: number;
    month: number;
    total: number;
  };
  status: 'online' | 'offline' | 'on_ride' | 'pending_verification';
  documents: DriverDocuments;
  location?: Location;
}

export interface VehicleInfo {
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate: string;
  vehicleType: 'sedan' | 'suv' | 'luxury' | 'xl';
}

export interface DriverDocuments {
  license: DocumentStatus;
  insurance: DocumentStatus;
  registration: DocumentStatus;
  profilePhoto: DocumentStatus;
}

export interface DocumentStatus {
  uploaded: boolean;
  verified: boolean;
  url?: string;
  uploadedAt?: string;
  verifiedAt?: string;
}

// Location Types
export interface Location {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  timestamp?: number;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  formatted: string;
  location: Location;
}

// Ride Types
export interface Ride {
  id: string;
  riderId: string;
  driverId?: string;
  rider: {
    name: string;
    phone: string;
    profilePicture?: string;
    rating: number;
  };
  pickup: Address;
  dropoff: Address;
  status: RideStatus;
  vehicleType: 'sedan' | 'suv' | 'luxury' | 'xl';
  estimatedFare: number;
  actualFare?: number;
  distance: number;
  duration: number;
  requestedAt: string;
  acceptedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  paymentMethod: 'card' | 'cash' | 'wallet';
  specialRequests?: string;
}

export type RideStatus = 
  | 'requested' 
  | 'accepted' 
  | 'arrived' 
  | 'started' 
  | 'completed' 
  | 'cancelled';

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface AuthResponse {
  token: string;
  user: Driver;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: 'driver';
  licenseNumber: string;
  vehicleInfo: VehicleInfo;
}

// Socket.IO Event Types
export interface SocketEvents {
  // Incoming events (from server)
  'ride:request': (ride: Ride) => void;
  'ride:cancelled': (rideId: string) => void;
  'ride:updated': (ride: Ride) => void;
  'driver:statusUpdate': (status: string) => void;
  
  // Outgoing events (to server)
  'driver:connect': (driverId: string) => void;
  'driver:disconnect': () => void;
  'driver:locationUpdate': (location: Location) => void;
  'ride:accept': (rideId: string) => void;
  'ride:decline': (rideId: string) => void;
}

// Navigation Types
export type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
};

export type MainStackParamList = {
  Home: undefined;
  ActiveRide: { rideId: string };
  Earnings: undefined;
  Documents: undefined;
  Profile: undefined;
  Chat: { rideId: string; riderId: string };
};
