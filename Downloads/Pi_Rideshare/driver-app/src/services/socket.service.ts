/**
 * Socket Service
 * 
 * Handles real-time communication with backend via Socket.IO
 * 
 * Features:
 * - Real-time ride requests (7-second countdown)
 * - Driver location broadcasting
 * - Trip status updates
 * - Connection management
 * 
 * Uses Socket.IO client for WebSocket communication
 */

import { io, Socket } from 'socket.io-client';
import { SOCKET_CONFIG, DEBUG_MODE } from '../config/api.config';
import apiService from './api.service';

/**
 * Ride Request Interface
 */
export interface RideRequest {
  rideId: string;
  riderId: string;
  riderName: string;
  pickup: {
    address: string;
    lat: number;
    lng: number;
  };
  destination: {
    address: string;
    lat: number;
    lng: number;
  };
  estimatedFare: number;
  estimatedDistance: number;
  estimatedDuration: number;
  timestamp: string;
}

/**
 * Socket Service Class
 */
class SocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private listeners: Map<string, Function[]> = new Map();
  
  // Store for reconnection
  private lastDriverId: string | null = null;
  private lastLocation: { lat: number; lng: number } | null = null;
  private wasOnline: boolean = false;

  /**
   * Initialize Socket Connection
   * 
   * Connects to backend Socket.IO server
   * 
   * @param driverId - Driver's user ID
   * @returns Promise<void>
   */
  async connect(driverId: string): Promise<void> {
    try {
      // Don't reconnect if already connected
      if (this.socket && this.isConnected) {
        console.log('🔌 Socket already connected');
        return;
      }

      // Get auth token
      const token = await apiService.getToken();

      if (!token) {
        throw new Error('No auth token available');
      }

      console.log('🔌 Connecting to Socket.IO...');
      console.log('   URL:', SOCKET_CONFIG.url);
      console.log('   Namespace:', SOCKET_CONFIG.namespace);

      // Create socket connection
      this.socket = io(SOCKET_CONFIG.url + SOCKET_CONFIG.namespace, {
        ...SOCKET_CONFIG.options,
        auth: {
          token,
          driverId,
        },
      });

      // Setup event listeners
      this.setupEventListeners();

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        this.socket?.once('connect', () => {
          clearTimeout(timeout);
          resolve();
        });

        this.socket?.once('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      this.isConnected = true;
      this.reconnectAttempts = 0;

      console.log('✅ Socket connected successfully');
    } catch (error) {
      console.error('❌ Socket connection failed:', error);
      throw error;
    }
  }

  /**
   * Disconnect Socket
   */
  disconnect(): void {
    if (this.socket) {
      console.log('🔌 Disconnecting socket...');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.listeners.clear();
    }
  }

  /**
   * Setup Socket Event Listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
        console.log('✅ Socket connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;

        // Re-register if driver was online before disconnect
        if (this.wasOnline && this.lastDriverId && this.lastLocation) {
          console.log('🔄 Re-registering driver after reconnect');
          this.socket?.emit(SOCKET_CONFIG.events.DRIVER_CONNECT, {
            driverId: this.lastDriverId,
            status: 'online',
            isAvailable: true,
            location: this.lastLocation,
            timestamp: new Date().toISOString(),
          });
        }
      });

    this.socket.on('disconnect', (reason) => {
      console.warn('⚠️ Socket disconnected:', reason);
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      this.reconnectAttempts++;
    });

    // Debug logging
    if (DEBUG_MODE) {
      this.socket.onAny((event, ...args) => {
        console.log('📡 Socket event received:', event, args);
      });
    }
  }

  /**
   * Listen for New Ride Requests
   * 
   * @param callback - Function to call when new ride request arrives
   */
  onNewRideRequest(callback: (request: RideRequest) => void): void {
    if (!this.socket) {
      console.error('❌ Socket not connected');
      return;
    }

    const event = SOCKET_CONFIG.events.NEW_RIDE_REQUEST;
    
    this.socket.on(event, (data: RideRequest) => {
      console.log('🚗 New ride request received:', data.rideId);
      callback(data);
    });

    // Store listener for cleanup
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  /**
   * Listen for Ride Status Changes
   * 
   * @param callback - Function to call when ride status changes
   */
  onRideStatusChanged(callback: (data: any) => void): void {
    if (!this.socket) {
      console.error('❌ Socket not connected');
      return;
    }

    const event = SOCKET_CONFIG.events.RIDE_STATUS_CHANGED;
    
    this.socket.on(event, (data: any) => {
      console.log('🔄 Ride status changed:', data);
      callback(data);
    });

    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

/**
   * Listen for Ride Cancellation (by rider)
   *
   * @param callback - Function to call when ride is cancelled
   */
  onRideCancelled(callback: (data: any) => void): void {
    if (!this.socket) {
      console.error('❌ Socket not connected');
      return;
    }
    const event = SOCKET_CONFIG.events.RIDE_CANCELLED;
    this.socket.on(event, (data: any) => {
      console.log('❌ Ride cancelled:', data);
      callback(data);
    });
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  /**
   * Listen for Corporate Verification Requests
   * 
   * @param callback - Function to call when verification needed
   */
  onCorporateVerification(callback: (data: any) => void): void {
    if (!this.socket) {
      console.error('❌ Socket not connected');
      return;
    }

    const event = SOCKET_CONFIG.events.CORPORATE_VERIFICATION;
    
    this.socket.on(event, (data: any) => {
      console.log('📋 Corporate verification requested:', data);
      callback(data);
    });

    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  /**
   * Send Driver Location Update
   * 
   * Broadcasts driver's current GPS location
   * 
   * @param location - GPS coordinates and heading
   */
sendLocationUpdate(location: {
  driverId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
}): void {
  if (!this.socket || !this.isConnected) {
    return; // Silent fail for location updates
  }

  this.socket.emit(SOCKET_CONFIG.events.UPDATE_LOCATION, {
    driverId: location.driverId,
    location: {
      lat: location.latitude,
      lng: location.longitude,
    },
    heading: location.heading || 0,
    speed: location.speed || 0,
    timestamp: new Date().toISOString(),
  });
}

 
    // Don't log every location update (too noisy)
    // if (DEBUG_MODE) {
    //   console.log('📍 Location sent:', location);
    // }
  

/**
 * Driver Goes Online
 * 
 * Emits driver-connect with full payload required by backend
 * 
 * @param data - Driver ID, location, and optional vehicle info
 */
driverConnect(data: {
    driverId: string;
    location: { lat: number; lng: number };
    vehicle?: any;
  }): void {
    // Store for reconnection
    this.lastDriverId = data.driverId;
    this.lastLocation = data.location;
    this.wasOnline = true;

    if (!this.socket || !this.isConnected) {
      console.warn('⚠️ Cannot go online: socket not connected');
      return;
    }

    console.log('🟢 Driver going ONLINE');

    this.socket.emit(SOCKET_CONFIG.events.DRIVER_CONNECT, {
    driverId: data.driverId,
    status: 'online',
    isAvailable: true,
    location: data.location,
    vehicle: data.vehicle || null,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Driver Goes Offline
 * 
 * @param driverId - Driver's user ID
 */
driverDisconnect(driverId: string): void {
    // Clear reconnect state - driver intentionally going offline
    this.wasOnline = false;
    this.lastLocation = null;

    if (!this.socket || !this.isConnected) {
      console.warn('⚠️ Cannot go offline: socket not connected');
      return;
    }

    console.log('🔴 Driver going OFFLINE');

  this.socket.emit(SOCKET_CONFIG.events.DRIVER_CONNECT, {
    driverId,
    status: 'offline',
    isAvailable: false,
    location: null,
    timestamp: new Date().toISOString(),
  });
}

  /**
   * Accept Ride Request
   * 
   * Notifies backend that driver accepted the ride
   * 
   * @param rideId - Ride request ID
   */
  acceptRide(driverId: string, rideId: string): void {
    if (!this.socket || !this.isConnected) {
      console.warn('⚠️ Cannot accept ride: socket not connected');
      return;
    }

    console.log('✅ Accepting ride via socket:', rideId);

    this.socket.emit(SOCKET_CONFIG.events.ACCEPT_RIDE, {
      driverId,
      rideId,
      timestamp: new Date().toISOString(),
    });
  }
/**
 * Reject/Decline Ride Request
 * 
 * @param driverId - Driver's user ID
 * @param rideId - Ride request ID
 */
rejectRide(driverId: string, rideId: string): void {
  if (!this.socket || !this.isConnected) {
    console.warn('⚠️ Cannot reject ride: socket not connected');
    return;
  }

  

  console.log('❌ Rejecting ride:', rideId);

  this.socket.emit(SOCKET_CONFIG.events.REJECT_RIDE, {
    driverId,
    rideId,
    timestamp: new Date().toISOString(),
  });
}
/**
   * Cancel Active Ride
   *
   * @param driverId - Driver's user ID
   * @param rideId - Ride ID to cancel
   * @param reason - Optional cancellation reason
   */
  cancelRide(driverId: string, rideId: string, reason?: string): void {
    if (!this.socket || !this.isConnected) {
      console.warn('⚠️ Cannot cancel ride: socket not connected');
      return;
    }

    console.log('❌ Cancelling ride:', rideId);

    this.socket.emit('driver-cancel-ride', {
      driverId,
      rideId,
      reason: reason || 'Driver cancelled',
      timestamp: new Date().toISOString(),
    });
  }
  /**
   * Update Trip Status
   * 
   * Broadcasts trip status change to riders
   * 
   * @param rideId - Ride ID
   * @param status - New status
   */
  updateTripStatus(
    rideId: string,
    status: 'accepted' | 'pickup' | 'enroute' | 'completed'
  ): void {
    if (!this.socket || !this.isConnected) {
      console.warn('⚠️ Cannot update trip status: socket not connected');
      return;
    }

    console.log(`🔄 Updating trip status via socket: ${status}`);

    this.socket.emit(SOCKET_CONFIG.events.UPDATE_TRIP_STATUS, {
      rideId,
      status,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Remove Event Listener
   * 
   * @param event - Event name
   * @param callback - Function to remove (optional, removes all if not provided)
   */
  off(event: string, callback?: Function): void {
    if (!this.socket) return;

    if (callback) {
      this.socket.off(event, callback as any);
      
      // Remove from stored listeners
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        const index = eventListeners.indexOf(callback);
        if (index > -1) {
          eventListeners.splice(index, 1);
        }
      }
    } else {
      // Remove all listeners for this event
      this.socket.off(event);
      this.listeners.delete(event);
    }
  }

/**
 * Listen for surge zone updates
 */
onSurgeUpdate(callback: (data: any) => void): void {
  if (!this.socket) {
    console.error('❌ Socket not connected');
    return;
  }
  this.socket.on('surge-update', callback);
}

/**
 * Send chat message to rider
 */
sendChatMessage(data: {
  rideId: string;
  riderId: string;
  driverId: string;
  message: string;
  sender: 'driver' | 'rider';
}): void {
  if (!this.socket) {
    console.error('❌ Socket not connected');
    return;
  }
  this.socket.emit('chat-message', data);
  console.log('💬 Chat message sent:', data.message);
}

/**
 * Listen for incoming chat messages
 */
onChatMessage(callback: (data: any) => void): void {
  if (!this.socket) {
    console.error('❌ Socket not connected');
    return;
  }
  this.socket.on('chat-message', (data: any) => {
    console.log('💬 Chat message received:', data);
    callback(data);
  });
}


/**
 * Stop listening for surge updates
 */
offSurgeUpdate(): void {
  if (this.socket) {
    this.socket.off('surge-update');
  }
}

  /**
   * Check if socket is connected
   */
  get connected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  /**
   * Get socket instance (for advanced use)
   */
  getSocket(): Socket | null {
    return this.socket;
  }
}

// Export singleton instance
const socketService = new SocketService();

export default socketService;
export { SocketService };