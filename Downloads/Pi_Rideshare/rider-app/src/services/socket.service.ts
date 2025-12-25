import { io, Socket } from 'socket.io-client';
import { getSocketUrl } from '../config/api.config';
import { Driver, Vehicle, SurgeZone } from '../types';

/**
 * Rider Socket Service
 * 
 * Event names match server/index.js exactly (dash-style, not colon-style)
 * 
 * Server listens for:
 *   - rider-connect (line 7443)
 *   - join-room (line 7264)
 *   - message (line 7472)
 *   - trip-status (line 7908)
 *   - disconnect (line 8009)
 * 
 * Server emits to riders:
 *   - ride-accepted (line 7603, 7721)
 *   - ride-cancelled (line 3281)
 *   - driver-location-update (line 6597)
 *   - driver_arrived (line 6764)
 *   - driver-availability-update (line 6666)
 *   - no-drivers-available (line 1865)
 *   - finding-driver (line 1809)
 */

class SocketService {
  private socket: Socket | null = null;
  private userId: string | null = null;
  private nearbyDriversMap: Map<string, Driver> = new Map();
  private riderName: string = '';
  private riderFirstName: string = '';
  private riderLocation: { lat: number; lng: number } | null = null;
  private locationInterval: ReturnType<typeof setInterval> | null = null;

  connect(user: { id: string; firstName?: string; lastName?: string; email?: string }, location?: { latitude: number; longitude: number }) {
    if (this.socket?.connected && this.userId === user.id) {
      console.log('🔌 Rider socket already connected');
      return;
    }

    this.userId = user.id;
    // Use firstName if available, otherwise extract from email, otherwise use 'Rider'
    this.riderFirstName = user.firstName || user.email?.split('@')[0] || 'Rider';
    this.riderName = user.firstName 
      ? `${user.firstName} ${user.lastName || ''}`.trim()
      : this.riderFirstName;
    this.riderLocation = location ? { lat: location.latitude, lng: location.longitude } : null;
    
    console.log('🔍 Rider name set to:', this.riderFirstName);

    this.socket = io(getSocketUrl(), {
      transports: ['websocket'],
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      console.log('🔌 Rider socket connected');
      
      // Join user-specific room for targeted messages
      // Server expects: { userId, userType }
      this.socket?.emit('join-room', { 
        userId: this.userId,
        userType: 'rider'
      });
      
      // Notify server rider is online with full data for Dashboard tracking
      this.socket?.emit('rider-connect', { 
        riderId: this.userId,
        name: this.riderName,
        firstName: this.riderFirstName,
        location: this.riderLocation,
        status: 'online'
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Rider socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
    });
  }

  disconnect() {
    if (this.locationInterval) {
      clearInterval(this.locationInterval);
      this.locationInterval = null;
    }
    if (this.socket) {
      // Notify server to remove rider from tracking
      this.socket.emit('rider-disconnect', { 
        riderId: this.userId 
      });
      this.socket.disconnect();
      this.socket = null;
      this.userId = null;
      this.nearbyDriversMap.clear();
      console.log('🔌 Rider socket disconnected manually');
    }
  }

  // ============================================
  // EVENTS SERVER SENDS TO RIDER
  // ============================================

  /**
   * Driver location updates during active ride
   * Server emits: driver-location-update (line 6597)
   */
  onDriverLocationUpdate(callback: (data: { 
    driverId: string; 
    latitude: number; 
    longitude: number; 
    heading?: number;
    speed?: number;
  }) => void) {
    this.socket?.on('driver-location-update', callback);
  }

  /**
   * Ride was accepted by a driver
   * Server emits: ride-accepted (lines 7603, 7721)
   */
  onRideAccepted(callback: (data: { 
    rideId: string;
    driver: {
      id: string;
      name: string;
      phone: string;
      rating: number;
      vehicle: {
        make: string;
        model: string;
        color: string;
        licensePlate: string;
      };
    };
    eta: number;
    pickup: { lat: number; lng: number };
    destination: { lat: number; lng: number };
  }) => void) {
    this.socket?.on('ride-accepted', callback);
  }

  /**
   * Driver arrived at pickup location
   * Server emits: driver_arrived (line 6764)
   */
  onDriverArrived(callback: (data: { 
    rideId: string;
    driverId: string;
    message?: string;
  }) => void) {
    this.socket?.on('driver_arrived', callback);
  }

  /**
   * Ride was cancelled (by driver or system)
   * Server emits: ride-cancelled (line 3281)
   */
  onRideCancelled(callback: (data: { 
    rideId: string;
    reason: string;
    cancelledBy: 'driver' | 'system' | 'rider';
    refundAmount?: number;
  }) => void) {
    this.socket?.on('ride-cancelled', callback);
  }

  /**
   * No drivers available for ride request
   * Server emits: no-drivers-available (line 1865)
   */
  onNoDriversAvailable(callback: (data: { 
    rideId: string;
    message: string;
  }) => void) {
    this.socket?.on('no-drivers-available', callback);
  }

  /**
   * Server is searching for drivers
   * Server emits: finding-driver (line 1809)
   */
  onFindingDriver(callback: (data: { 
    rideId: string;
    message: string;
  }) => void) {
    this.socket?.on('finding-driver', callback);
  }

  /**
   * Trip status changed (started, completed, etc.)
   * Server emits: trip-status-update or ride-status-update
   */
  onTripStatusUpdate(callback: (data: { 
    rideId: string;
    status: 'started' | 'in_progress' | 'completed';
    fare?: number;
    duration?: number;
    distance?: number;
  }) => void) {
    // Listen for both possible event names
    this.socket?.on('trip-status-update', callback);
    this.socket?.on('ride-status-update', callback);
  }

  /**
   * Surge pricing update
   * Server emits: surge-updated (line from surge control)
   */
  onSurgeUpdate(callback: (data: { 
    zones: SurgeZone[];
    activeZones: number;
  }) => void) {
    this.socket?.on('surge-updated', callback);
  }

  /**
   * Nearby drivers for map display
   * Server emits individual driver-availability-update events
   * We accumulate them and pass as array to match expected interface
   */
  onNearbyDriversUpdate(callback: (drivers: Driver[]) => void) {
    this.socket?.on('driver-availability-update', (data: {
      driverId: string;
      isAvailable: boolean;
      lat: number;
      lng: number;
      heading?: number;
      driverInfo?: {
        firstName?: string;
        lastName?: string;
        phone?: string;
        profileImage?: string;
        rating?: number;
        totalRides?: number;
        vehicle?: {
          make?: string;
          model?: string;
          year?: number;
          color?: string;
          licensePlate?: string;
          type?: 'economy' | 'standard' | 'xl' | 'premium';
        };
      };
    }) => {
      if (data.isAvailable) {
        // Add or update driver
        const driver: Driver = {
          id: data.driverId,
          firstName: data.driverInfo?.firstName || 'Driver',
          lastName: data.driverInfo?.lastName || '',
          phone: data.driverInfo?.phone || '',
          profileImage: data.driverInfo?.profileImage,
          rating: data.driverInfo?.rating || 5.0,
          totalRides: data.driverInfo?.totalRides || 0,
          vehicle: {
            make: data.driverInfo?.vehicle?.make || 'Unknown',
            model: data.driverInfo?.vehicle?.model || 'Vehicle',
            year: data.driverInfo?.vehicle?.year || 2020,
            color: data.driverInfo?.vehicle?.color || 'Black',
            licensePlate: data.driverInfo?.vehicle?.licensePlate || '',
            type: data.driverInfo?.vehicle?.type || 'standard',
          },
          location: {
            latitude: data.lat,
            longitude: data.lng,
          },
          heading: data.heading,
        };
        this.nearbyDriversMap.set(data.driverId, driver);
      } else {
        // Remove driver who went offline
        this.nearbyDriversMap.delete(data.driverId);
      }
      
      // Emit full array to callback
      callback(Array.from(this.nearbyDriversMap.values()));
    });
  }

  /**
   * Request nearby drivers for map display
   * Note: Server may not have this implemented - falls back to driver-availability-update events
   */
  requestNearbyDrivers(location: { latitude: number; longitude: number }) {
    this.socket?.emit('nearby:request', { location });
  }

  // ============================================
  // EVENTS RIDER SENDS TO SERVER
  // ============================================

  /**
   * Update rider's current location
   * Note: Ride requests go via REST API (POST /api/rides)
   */
  updateLocation(location: { latitude: number; longitude: number }) {
    if (this.userId) {
      this.socket?.emit('rider-location-update', { 
        riderId: this.userId, 
        location,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Start broadcasting location every 5 seconds (matches driver frequency)
   */
  startLocationBroadcast(getLocation: () => { latitude: number; longitude: number } | null) {
    if (this.locationInterval) {
      clearInterval(this.locationInterval);
    }
    
    // Send immediately first
    const location = getLocation();
    if (location && this.userId) {
      this.socket?.emit('rider-connect', { 
        riderId: this.userId,
        name: this.riderName,
        firstName: this.riderFirstName,
        location: { lat: location.latitude, lng: location.longitude },
        status: 'online'
      });
      console.log('📍 Rider location broadcast (initial)');
    }
    
    // Then every 5 seconds
    this.locationInterval = setInterval(() => {
      const location = getLocation();
      if (location && this.userId) {
        this.socket?.emit('rider-connect', { 
          riderId: this.userId,
          name: this.riderName,
          firstName: this.riderFirstName,
          location: { lat: location.latitude, lng: location.longitude },
          status: 'online'
        });
        console.log('📍 Rider location broadcast');
      }
    }, 5000);
  }

  /**
   * Stop location broadcasting
   */
  stopLocationBroadcast() {
    if (this.locationInterval) {
      clearInterval(this.locationInterval);
      this.locationInterval = null;
    }
  }

  /**
   * Send chat message to driver
   * Server listens: message (line 7472)
   */
  sendMessage(data: { 
    recipientId: string; 
    message: string;
    rideId?: string;
  }) {
    this.socket?.emit('message', {
      senderId: this.userId,
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Acknowledge ride cancellation
   * Server listens: ride-cancelled-ack (line 7501)
   */
  acknowledgeCancellation(rideId: string) {
    this.socket?.emit('ride-cancelled-ack', { 
      rideId: rideId,
      riderId: this.userId
    });
  }

  /**
   * Request current ride state (reconnection)
   * Server listens: request-current-state (line 7291)
   */
  requestCurrentState() {
    this.socket?.emit('request-current-state');
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Get current user ID
   */
  getUserId(): string | null {
    return this.userId;
  }

  /**
   * Remove specific listener
   */
  removeListener(event: string) {
    this.socket?.off(event);
  }

  /**
   * Remove all listeners
   */
  removeAllListeners() {
    this.socket?.removeAllListeners();
  }
}

export const socketService = new SocketService();
export default socketService;
