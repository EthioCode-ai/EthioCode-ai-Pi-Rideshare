import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Navigation,
  Phone,
  MessageCircle,
  Star,
  DollarSign,
  Clock,
  User,
  Menu,
  Power,
  CheckCircle,
  XCircle,
  AlertCircle,
  BarChart3,
  Settings,
  Bell,
  CarFront,
  Route,
  Fuel,
  Battery,
  Shield,
  ChevronUp,
  ChevronDown,
  FileText
} from 'lucide-react';
import { Link } from 'react-router-dom';
import TopDownCar from '../components/TopDownCar';
import DriverVerificationModal from '../components/DriverVerificationModal';
import DriverDocumentUpload from '../components/DriverDocumentUpload';
import ChatBot from '../components/ChatBot';
import SurgeHeatmapOverlay from '../components/SurgeHeatmapOverlay';

// A simple ToggleSwitch component for settings
const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) => (
  <button
    onClick={() => onChange(!checked)}
    style={{
      width: '60px',
      height: '32px',
      borderRadius: '16px',
      border: 'none',
      backgroundColor: checked ? '#10b981' : '#d1d5db',
      position: 'relative',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      flexShrink: 0
    }}
  >
    <div style={{
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      backgroundColor: 'white',
      position: 'absolute',
      top: '4px',
      left: checked ? '32px' : '4px',
      transition: 'all 0.3s ease',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
    }} />
  </button>
);

declare global {
  interface Window {
    google: any;
    initDriverMap: () => void;
    io: any;
  }
  // interface Navigator {
  //   wakeLock?: {
  //     request: (type: 'screen') => Promise<any>;
  //   };
  // }
  interface DeviceOrientationEvent {
    webkitCompassHeading?: number;
  }
}

interface RideRequest {
  id: string;
  rider: {
    id?: string;
    name: string;
    rating: number;
    photo?: string;
    phone: string;
  };
  pickup: {
    address: string;
    coordinates: { lat: number; lng: number };
  };
  destination: {
    address: string;
    coordinates: { lat: number; lng: number };
  };
  fare: number;
  distance: string;
  duration: string;
  surgeMultiplier?: number;
  estimatedFare?: string;
  estimatedTime?: string;
  rideType?: string;
  surgeFare?: string | null;
  riderPreferences?: {
    temperature?: string;
    music?: string;
    conversation?: string;
    stops?: boolean;
  };
}

interface Trip {
  id: string;
  rider: {
    name: string;
    rating: number;
    photo?: string;
    phone: string;
  };
  pickup: string;
  destination: string;
  fare: number;
  duration?: string;
  status: 'accepted' | 'pickup' | 'enroute' | 'completed';
  startTime: string;
}

interface EarningsData {
  today: number;
  week: number;
  month: number;
  trips: number;
  hours: number;
  rating: number;
  lastRide: number;
  miles: number;
}

const DriverApp: React.FC = () => {
  console.log('🚗 DriverApp component is loading...');
  console.log('🔄 Driver route matched!');

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [loginFormData, setLoginFormData] = useState({
    email: 'jahselassiei@gmail.com',
    password: 'myDriver1!'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Push notification state
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [messages, setMessages] = useState<any[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [isPiAssistantMinimized, setIsPiAssistantMinimized] = useState(true);

  // Check for existing authentication on component mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        if (parsedUser.userType === 'driver') {
          setIsAuthenticated(true);
          setUser(parsedUser);
          console.log('🚗 Driver authenticated from localStorage');
        }
      } catch (error) {
        console.error('❌ Error parsing user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, []);

  // Request notification permission after authentication
  useEffect(() => {
    if ('Notification' in window && isAuthenticated) {
      setNotificationPermission(Notification.permission);

      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          setNotificationPermission(permission);
          if (permission === 'granted') {
            console.log('🔔 Push notifications enabled');
            showNotification('✅ Notifications Enabled', 'You\'ll receive ride requests and updates', 'success');
          }
        }).catch(error => {
          console.error('❌ Notification permission error:', error);
          setNotificationPermission('denied');
        });
      }
    }
  }, [isAuthenticated]);

  // Send push notification helper
  const sendPushNotification = (title: string, body: string, options: any = {}) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body,
        icon: '/pi-driver-logo.png',
        badge: '/pi-driver-logo.png',
        tag: options.tag || 'driver-update',
        requireInteraction: options.requireInteraction || false,
        vibrate: options.vibrate || [200, 100, 200],
        ...options
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        if (options.onClick) options.onClick();
      };

      // Auto close after 5 seconds unless requireInteraction is true
      if (!options.requireInteraction) {
        setTimeout(() => notification.close(), 5000);
      }

      return notification;
    }
  };

  const showNotification = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const colors = {
      success: '#10b981',
      error: '#ef4444', 
      warning: '#f59e0b',
      info: '#3b82f6'
    };

    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type]};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 300px;
      animation: slideIn 0.3s ease-out;
    `;

    notification.innerHTML = `
      <div style="font-weight: 700; margin-bottom: 4px;">${title}</div>
      <div style="font-size: 12px; opacity: 0.9;">${message}</div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      if (document.body.contains(notification)) {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
          if (document.body.contains(notification)) {
            document.body.removeChild(notification);
          }
        }, 300);
      }
    }, 4000);
  };

  // Authentication functions
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(loginFormData)
      });

      const data = await response.json();

      if (response.ok) {
        if (data.user.userType !== 'driver') {
          setAuthError('This login is for drivers only. Please use correct driver credentials.');
          return;
        }

        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        setIsAuthenticated(true);
        setUser(data.user);
        setAuthError('');
        
        console.log('🚗 Driver logged in successfully');
        showNotification('✅ Welcome Driver!', `Hello ${data.user.firstName}`, 'success');
        
        // Trigger immediate heatmap fetch if heatmap is visible and map is ready
        if (showHeatmap && map && driverStatus === 'online') {
          console.log('🗺️ DriverApp: Post-login heatmap fetch');
          setTimeout(() => fetchHeatmapData(true), 1000); // Small delay to ensure auth state is set
        }
      } else {
        setAuthError(data.error || 'Login failed');
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      setAuthError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
    setDriverStatus('offline');
    
    console.log('🚗 Driver logged out');
    showNotification('👋 Logged Out', 'See you later!', 'info');
  };

  // Enhanced message handling
  const sendMessage = (message: string, rideId?: string) => {
    if (!message.trim()) return;

    const messageData = {
      id: `msg_${Date.now()}`,
      rideId: rideId || currentTrip?.id,
      senderId: user?.id || 'anonymous-driver',
      senderType: 'driver',
      message: message.trim(),
      timestamp: new Date().toISOString(),
      delivered: false
    };

    // Send via WebSocket if available
    if (socketRef.current) {
      socketRef.current.emit('send-message', messageData);
    }

    // Add to local messages
    setMessages(prev => [...prev, { ...messageData, delivered: true }]);
    setNewMessage('');

    console.log('💬 Message sent:', messageData);
  };

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null); // For rotation access
  const [map, setMap] = useState<any>(null);
  const [driverStatus, setDriverStatus] = useState<'offline' | 'online' | 'busy'>('offline');
  const [currentLocation, setCurrentLocation] = useState<{lat: number; lng: number} | null>(null);
  const [driverHeading, setDriverHeading] = useState<number>(0);
  
  // Corporate discount verification modal state
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationRiderInfo, setVerificationRiderInfo] = useState<any>(null);
  const [pendingRideId, setPendingRideId] = useState<string | null>(null);

  // Document upload modal state
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);

  // Handle ESC key to close document upload modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showDocumentUpload) {
        setShowDocumentUpload(false);
      }
    };

    if (showDocumentUpload) {
      document.addEventListener('keydown', handleKeyDown);
      // Lock background scroll
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore background scroll
      document.body.style.overflow = 'unset';
    };
  }, [showDocumentUpload]);

  // Cascading ride request system state (7-second timeout with audio)
  const [cascadingRequest, setCascadingRequest] = useState<any>(null);
  const [cascadingTimeout, setCascadingTimeout] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [rideRequest, setRideRequest] = useState<RideRequest | null>(null);
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [showEarnings, setShowEarnings] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [requestTimeout, setRequestTimeout] = useState<number>(0);
  const [batteryLevel, setBatteryLevel] = useState(85);
  const [fuelLevel, setFuelLevel] = useState(75);
  const [showStatsOverlay, setShowStatsOverlay] = useState(true);

  // Surge Heatmap State
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [heatmapZones, setHeatmapZones] = useState<any[]>([]);
  const [heatmapStats, setHeatmapStats] = useState<any>({});

  // Enhanced Navigation State
  const [driverMarker, setDriverMarker] = useState<any>(null);
  const [directionsService, setDirectionsService] = useState<any>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<any>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [routeDistance, setRouteDistance] = useState<string>('');
  const [routeDuration, setRouteDuration] = useState<string>('');
  const [nextTurn, setNextTurn] = useState<string>('');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [routeSteps, setRouteSteps] = useState<any[]>([]);
  const [distanceToNextTurn, setDistanceToNextTurn] = useState<string>('');
  const [turnIcon, setTurnIcon] = useState<string>('');
  const [routeProgressInterval, setRouteProgressInterval] = useState<NodeJS.Timeout | null>(null);
  const [currentInstruction, setCurrentInstruction] = useState<string>('');
  const [upcomingTurn, setUpcomingTurn] = useState<string>('');
  const [upcomingDistance, setUpcomingDistance] = useState<string>('');
  const [totalSteps, setTotalSteps] = useState<number>(0);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [lastAnnouncedStep, setLastAnnouncedStep] = useState<number>(-1);

  // 🛣️ ENHANCED NAVIGATION: Custom Route Guidance State
  const [routePolylines, setRoutePolylines] = useState<any[]>([]);
  const [completedSegments, setCompletedSegments] = useState<Set<number>>(new Set());
  const [currentRoutePoint, setCurrentRoutePoint] = useState<number>(0);
  const [isOffRoute, setIsOffRoute] = useState<boolean>(false);
  const [upcomingStreetName, setUpcomingStreetName] = useState<string>('');
  const [lastKnownPosition, setLastKnownPosition] = useState<{lat: number; lng: number} | null>(null);
  const [routeCheckInterval, setRouteCheckInterval] = useState<NodeJS.Timeout | null>(null);

  // Enhanced gyroscope and device orientation state
  const [gyroscopeHeading, setGyroscopeHeading] = useState<number | null>(null);
  const [deviceOrientation, setDeviceOrientation] = useState<number | null>(null);
  const [routeBearing, setRouteBearing] = useState<number | null>(null);
  
  // Refs for idle listener to avoid stale closure capture
  const isNavigatingRef = useRef(isNavigating);
  const routeBearingRef = useRef(routeBearing);
  const driverHeadingRef = useRef(driverHeading);
  
  // Keep refs updated with current state values
  useEffect(() => {
    isNavigatingRef.current = isNavigating;
  }, [isNavigating]);
  
  useEffect(() => {
    routeBearingRef.current = routeBearing;
  }, [routeBearing]);
  
  useEffect(() => {
    driverHeadingRef.current = driverHeading;
  }, [driverHeading]);

  // Floating Pi overlay for minimized app navigation
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isHidden = document.hidden || document.visibilityState === 'hidden';
      setIsAppMinimized(isHidden && (driverStatus === 'busy' || isNavigating));
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', () => setIsAppMinimized(false));
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', () => setIsAppMinimized(false));
    };
  }, [driverStatus, isNavigating]);

  // Road highlighting for upcoming turns
  useEffect(() => {
    if (routeSteps.length > 0 && currentStepIndex < routeSteps.length) {
      const nextStep = routeSteps[currentStepIndex + 1];
      
      if (nextStep && distanceToNextTurn) {
        const distance = parseFloat(distanceToNextTurn.replace(/[^\d.]/g, ''));
        
        if (distance <= 500) {
          const instruction = nextStep.instructions || '';
          const roadMatch = instruction.match(/(?:onto|on|toward)\s+([\w\s]+?)(?:\s|$|,|\.|\/)/i);
          
          if (roadMatch) {
            const roadName = roadMatch[1].trim();
            setUpcomingTurnRoad(roadName);
            console.log(`🛣️ Highlighting turn road: ${roadName} (${distanceToNextTurn})`);
          }
        } else {
          setUpcomingTurnRoad(null);
        }
      }
    }
  }, [routeSteps, currentStepIndex, distanceToNextTurn]);

  // Screen Wake Lock functionality to prevent screen sleep
  useEffect(() => {
    // Check if Wake Lock API is supported
    const isSupported = 'wakeLock' in navigator;
    setIsWakeLockSupported(isSupported);
    console.log(isSupported ? '📱 Screen Wake Lock API supported' : '📱 Screen Wake Lock API not supported');

    return () => {
      // Release wake lock on component unmount
      if (wakeLock) {
        wakeLock.release();
      }
    };
  }, []);

  // Request wake lock when driver is active
  const requestWakeLock = async () => {
    if (!isWakeLockSupported || wakeLock) return;

    try {
      const lock = await navigator.wakeLock?.request('screen');
      setWakeLock(lock);
      console.log('📱 Screen wake lock activated - screen will not sleep');

      lock?.addEventListener('release', () => {
        console.log('📱 Screen wake lock released');
        setWakeLock(null);
      });
    } catch (err) {
      console.error('📱 Failed to activate wake lock:', err);
    }
  };

  // Release wake lock when driver is inactive
  const releaseWakeLock = async () => {
    if (wakeLock) {
      try {
        await wakeLock.release();
        setWakeLock(null);
        console.log('📱 Screen wake lock manually released');
      } catch (err) {
        console.error('📱 Failed to release wake lock:', err);
      }
    }
  };

  // Manage wake lock based on driver status
  useEffect(() => {
    if (driverStatus === 'online' || driverStatus === 'busy' || isNavigating) {
      requestWakeLock();
    } else if (driverStatus === 'offline') {
      releaseWakeLock();
    }
  }, [driverStatus, isNavigating]);

  // Collapsible passenger info container state
  const [isPassengerInfoCollapsed, setIsPassengerInfoCollapsed] = useState<boolean>(false);
  const [distanceToPickup, setDistanceToPickup] = useState<number>(Infinity);
  const [manuallyExpanded, setManuallyExpanded] = useState<boolean>(false);

  // Floating Pi overlay state
  const [isAppMinimized, setIsAppMinimized] = useState<boolean>(false);
  const [piOverlayPosition, setPiOverlayPosition] = useState<{ x: number; y: number }>({ x: 50, y: 100 });
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Turn-by-turn navigation state for road highlighting
  const [highlightedRoads, setHighlightedRoads] = useState<Set<string>>(new Set());
  const [upcomingTurnRoad, setUpcomingTurnRoad] = useState<string | null>(null);

  // Screen Wake Lock state to prevent screen sleep during navigation
  const [wakeLock, setWakeLock] = useState<any>(null);
  const [isWakeLockSupported, setIsWakeLockSupported] = useState<boolean>(false);

  // Socket reference for messaging
  const socketRef = useRef<any>(null);

  // Driver Preferences (renamed from driverPreferences to driverSettings for clarity in modal)
  const [driverSettings, setDriverSettings] = useState({
    isOnline: false,
    acceptPool: true,
    voiceGuidance: true,
    autoAccept: false,
    acceptPets: false, // Added
    acceptTeens: false, // Added
    minimumFare: 5.00,
    maxDistance: 15,
    preferredAreas: [] as string[],
    vehicleColor: '#3b82f6', // Default blue color
    vehicleType: 'sedan' as 'compact' | 'sedan' | 'suv' | 'luxury',
    acceptCash: false, // Added for settings
    acceptLongTrips: true, // Added for settings
    acceptPoolRides: true, // Added for settings
    notifications: true // Added for settings
  });

  // Online time tracking
  const [onlineStartTime, setOnlineStartTime] = useState<Date | null>(null);
  const [totalOnlineTime, setTotalOnlineTime] = useState<number>(8.5); // Start with existing hours

  // Initialize with loading placeholders - will be replaced by API data
  const [earnings, setEarnings] = useState<EarningsData>({
    today: 0,
    week: 0,
    month: 0,
    trips: 0,
    hours: 0,
    rating: 0,
    lastRide: 0,
    miles: 0
  });
  
  // Loading state to show when data is being fetched
  const [earningsLoading, setEarningsLoading] = useState(true);

  // Load driver earnings data on component mount and when status changes
  useEffect(() => {
    // Clean startup
    
    const loadDriverEarnings = async () => {
      setEarningsLoading(true);
      try {
        const driverId = user?.id;
        if (!driverId) {
          console.log('No driver ID available for earnings');
          return;
        }
        const response = await fetch(`${window.location.origin}/api/driver/earnings/${driverId}`, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setEarnings(data);
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        // Keep current state if API fails
        console.error('API Error loading earnings:', error);
      } finally {
        setEarningsLoading(false);
      }
    };

    loadDriverEarnings();
  }, [driverStatus]); // Reload when driver status changes

  // Sample ride request data
  const sampleRideRequest: RideRequest = {
    id: 'RIDE_123',
    rider: {
      name: 'Sarah Johnson',
      rating: 4.8,
      phone: '+1 (555) 123-4567'
    },
    pickup: {
      address: 'Downtown Bentonville Square',
      coordinates: { lat: 36.3729, lng: -94.2088 }
    },
    destination: {
      address: 'Crystal Bridges Museum',
      coordinates: { lat: 36.3818, lng: -94.2087 }
    },
    fare: 12.50,
    distance: '2.3 miles',
    duration: '8 minutes',
    estimatedFare: '$12.50',
    estimatedTime: '8 min',
    rideType: 'standard'
  };

  // Initialize Google Maps with enhanced styling (ALWAYS initialize, regardless of auth)
  useEffect(() => {
    console.log('🗺️ DriverApp Google Maps initializing immediately (auth-independent)');

    const initializeMap = () => {
      if (mapRef.current && window.google && window.google.maps && !map) {
        console.log('🗺️ Initializing Google Maps in DriverApp...');
        
        try {
          // 🗺️ VECTOR MAP: Required for map rotation (setHeading)
          const mapInstance = new window.google.maps.Map(mapRef.current, {
            mapId: 'DEMO_MAP_ID', // Vector map enables rotation
            zoom: 16,
            center: { lat: 36.3729, lng: -94.2088 }, // Bentonville, AR
            tilt: 0, // Flat view for driving navigation
            heading: 0, // Initial heading (will be updated)
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            zoomControl: true,
            gestureHandling: 'greedy'
          });

        const dirService = new window.google.maps.DirectionsService();
        const dirRenderer = new window.google.maps.DirectionsRenderer({
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: '#1f2937',
            strokeWeight: 6,
            strokeOpacity: 1.0,
            strokeLineJoin: 'round',
            strokeLineCap: 'round',
            zIndex: 1000
          }
        });

        dirRenderer.setMap(mapInstance);

        // Store in both state and ref for rotation access
        mapInstanceRef.current = mapInstance;
        setMap(mapInstance);
        setDirectionsService(dirService);
        setDirectionsRenderer(dirRenderer);
        
        // Map initialized - heatmap will load when conditions are met (auth + visibility)
        
        // 🗺️ Map rotation: Reapply heading after camera changes (use route bearing during navigation)
        mapInstance.addListener('idle', () => {
          if (mapInstanceRef.current) {
            // Read from refs to avoid stale closure capture
            const currentIsNavigating = isNavigatingRef.current;
            const currentRouteBearing = routeBearingRef.current;
            const currentDriverHeading = driverHeadingRef.current;
            
            // Use same heading logic as rotation effect: route bearing during navigation, compass heading otherwise
            const headingToUse = currentIsNavigating && currentRouteBearing !== null ? currentRouteBearing : currentDriverHeading;
            
            if (headingToUse !== null && headingToUse !== undefined) {
              const normalizedHeading = ((headingToUse % 360) + 360) % 360;
              const headingType = currentIsNavigating && currentRouteBearing !== null ? 'route' : 'compass';
              console.log(`🗺️ Reapplying heading after camera idle: ${normalizedHeading.toFixed(1)}° (${headingType})`);
              mapInstanceRef.current.setHeading(-normalizedHeading);
            }
          }
        });

        console.log('✅ Google Maps initialized successfully in DriverApp');
        } catch (error) {
          console.error('❌ Error initializing Google Maps in DriverApp:', error);
        }
      } else {
        console.log('⏳ Waiting for Google Maps API or map reference...', {
          mapRef: !!mapRef.current,
          google: !!window.google,
          maps: !!(window.google && window.google.maps),
          existingMap: !!map
        });
      }
    };

    // Google Maps is loaded via HTML head, so just wait for it to be available
    const checkGoogleMaps = () => {
      if (window.google && window.google.maps) {
        console.log('🗺️ Google Maps API detected in DriverApp - initializing...');
        setTimeout(initializeMap, 500); // Small delay to ensure DOM is ready
      } else {
        console.log('⏳ Waiting for Google Maps API to load in DriverApp...');
        setTimeout(checkGoogleMaps, 1000);
      }
    };

    checkGoogleMaps();
  }, [map]);

  // 🗺️ NAVIGATION MODE: Map rotation effect (car always faces top)
  useEffect(() => {
    if (!mapInstanceRef.current) {
      return;
    }

    try {
      // During navigation, use route bearing; otherwise use compass heading
      const headingToUse = isNavigating && routeBearing !== null ? routeBearing : driverHeading;
      
      if (headingToUse === null || headingToUse === undefined) {
        return;
      }

      const normalizedHeading = ((headingToUse % 360) + 360) % 360;
      const mapBearing = -normalizedHeading; // Negative to keep car pointing up
      
      const headingType = isNavigating && routeBearing !== null ? 'route' : 'compass';
      console.log(`🗺️ Setting map heading: ${mapBearing.toFixed(1)}° (${headingType}: ${normalizedHeading.toFixed(1)}°)`);
      mapInstanceRef.current.setHeading(mapBearing);
      
    } catch (error) {
      console.error('❌ Error setting map heading:', error);
      // Fallback: If vector map fails, at least log the attempt
      console.warn('⚠️ Vector map rotation not available - using DEMO_MAP_ID. Consider setting up real Map ID in Google Cloud Console.');
    }
  }, [driverHeading, routeBearing, isNavigating]);

  // Immediate heatmap fetch when driver goes online or heatmap is toggled on
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !map) return; // Need authentication and map to be ready
    
    if (showHeatmap && driverStatus === 'online') {
      console.log('🗺️ DriverApp: Immediate heatmap fetch (driver online + heatmap visible)');
      fetchHeatmapData(true); // Show notifications for immediate fetches
    }
  }, [showHeatmap, driverStatus, map]);

  // Periodic heatmap refresh while visible and driver is online
  useEffect(() => {
    if (!showHeatmap || driverStatus !== 'online') return;

    console.log('🗺️ DriverApp: Starting periodic heatmap refresh (90s interval)');
    const heatmapInterval = setInterval(() => {
      console.log('🗺️ DriverApp: Periodic heatmap refresh triggered');
      fetchHeatmapData(false); // No notifications for periodic refreshes
    }, 90000); // Refresh every 90 seconds

    return () => {
      console.log('🗺️ DriverApp: Stopping periodic heatmap refresh');
      clearInterval(heatmapInterval);
    };
  }, [showHeatmap, driverStatus]);

  // Enhanced Navigation Functions
  const navigateToDestination = (destination: { lat: number; lng: number }, address: string) => {
    try {
      if (!directionsService || !directionsRenderer || !currentLocation) {
        console.error('Navigation services not ready or location not available');
        return;
      }

      console.log('🧭 Starting navigation to:', address);
      setIsNavigating(true);

      const request = {
        origin: currentLocation,
        destination: destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
        optimizeWaypoints: true
      };

      directionsService.route(request, (result: any, status: any) => {
        try {
          if (status === 'OK' && result) {
            // 🛣️ ENHANCED NAVIGATION: Custom Route Guidance System
            const route = result.routes[0];
            const leg = route.legs[0];

            setRouteDistance(leg.distance.text);
            setRouteDuration(leg.duration.text);

            const steps = leg.steps;
            setRouteSteps(steps);
            setCurrentStepIndex(0);
            setTotalSteps(steps.length);

            // 🛣️ CREATE CUSTOM BLACK ROUTE POLYLINES (instead of default renderer)
            createCustomRoutePolylines(route, map);
            
            // 🗺️ EXTRACT STREET NAMES for upcoming turn highlighting
            extractStreetNamesFromRoute(steps);

            addCustomMarkers(currentLocation, destination, map);
            startEnhancedRouteTracking(steps);
            map.fitBounds(result.routes[0].bounds);

            console.log('✅ Enhanced navigation route created with custom polylines');
          } else {
            console.error('Directions request failed:', status);
            setIsNavigating(false);
          }
        } catch (error) {
          console.error('❌ Error processing navigation result:', error);
          setIsNavigating(false);
        }
      });
    } catch (error) {
      console.error('❌ Error starting navigation:', error);
      setIsNavigating(false);
    }
  };

  // State for rider location marker
  const [riderMarker, setRiderMarker] = useState<any>(null);

  const addCustomMarkers = (origin: any, destination: any, mapInstance: any) => {
    // Pickup marker (green circle)
    new window.google.maps.Marker({
      position: origin,
      map: mapInstance,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <circle cx="10" cy="10" r="8" fill="#10b981" stroke="white" stroke-width="2"/>
          </svg>
        `),
        scaledSize: new window.google.maps.Size(20, 20),
        anchor: new window.google.maps.Point(10, 10)
      },
      title: 'Pickup Location'
    });

    // Destination marker (black square)
    new window.google.maps.Marker({
      position: destination,
      map: mapInstance,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="12" height="12" fill="#1f2937" stroke="white" stroke-width="2"/>
          </svg>
        `),
        scaledSize: new window.google.maps.Size(16, 16),
        anchor: new window.google.maps.Point(8, 8)
      },
      title: 'Destination'
    });

    // Add rider marker at current device location (where the driver is)
    if (currentTrip && currentLocation) {
      const marker = new window.google.maps.Marker({
        position: currentLocation,
        map: mapInstance,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="80" height="40" viewBox="0 0 80 40" xmlns="http://www.w3.org/2000/svg">
              <!-- Background bubble -->
              <rect x="5" y="5" width="70" height="25" rx="12" fill="#3b82f6" stroke="white" stroke-width="2"/>
              
              <!-- Person icon -->
              <circle cx="18" cy="17" r="6" fill="white"/>
              <circle cx="18" cy="15" r="2.5" fill="#3b82f6"/>
              <path d="M 12 22 Q 12 19 15 19 L 21 19 Q 24 19 24 22" fill="#3b82f6"/>
              
              <!-- Rider name text -->
              <text x="30" y="19" fill="white" font-family="Arial, sans-serif" font-size="9" font-weight="600" text-anchor="start">
                ${currentTrip.rider.name.split(' ')[0]}
              </text>
              
              <!-- Pointer -->
              <polygon points="40,30 35,35 45,35" fill="#3b82f6" stroke="white" stroke-width="1"/>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(80, 40),
          anchor: new window.google.maps.Point(40, 35)
        },
        title: `Rider: ${currentTrip.rider.name}`,
        zIndex: 2000
      });
      setRiderMarker(marker);
    }
  };

  // 🛣️ ENHANCED NAVIGATION: Custom Route Polylines System
  const createCustomRoutePolylines = (route: any, mapInstance: any) => {
    try {
      // Clear existing polylines
      routePolylines.forEach(polyline => polyline.setMap(null));
      setRoutePolylines([]);
      setCompletedSegments(new Set());
      setCurrentRoutePoint(0);

      console.log('🛣️ Creating custom black route polylines...');

      const path = route.overview_path;
      const segmentSize = Math.max(1, Math.floor(path.length / 20)); // Create ~20 segments
      const newPolylines = [];

      for (let i = 0; i < path.length - 1; i += segmentSize) {
        const segmentPath = path.slice(i, Math.min(i + segmentSize + 1, path.length));
        
        // 🖤 BLACK POLYLINES for upcoming route segments
        const polyline = new window.google.maps.Polyline({
          path: segmentPath,
          geodesic: true,
          strokeColor: '#000000', // Black for upcoming segments
          strokeOpacity: 1.0,
          strokeWeight: 6,
          zIndex: 100
        });

        polyline.setMap(mapInstance);
        newPolylines.push(polyline);
      }

      setRoutePolylines(newPolylines);
      console.log(`✅ Created ${newPolylines.length} custom route segments`);
    } catch (error) {
      console.error('❌ Error creating custom polylines:', error);
    }
  };

  // 🗺️ ENHANCED NAVIGATION: Extract Street Names from Route
  const extractStreetNamesFromRoute = (steps: any[]) => {
    try {
      console.log('🗺️ Extracting street names for enhanced turn highlighting...');
      
      steps.forEach((step, index) => {
        const instruction = step.instructions || '';
        // Extract street/road names from turn instructions
        const streetMatches = instruction.match(/(?:onto|on|toward|turn\s+(?:left|right)\s+onto)\s+([\w\s]+?)(?:\s|$|,|\.|\/)/gi);
        
        if (streetMatches) {
          streetMatches.forEach(match => {
            const cleanStreet = match.replace(/(?:onto|on|toward|turn\s+(?:left|right)\s+onto)\s+/gi, '').trim();
            console.log(`🛣️ Step ${index}: Street "${cleanStreet}" identified`);
          });
        }
      });
    } catch (error) {
      console.error('❌ Error extracting street names:', error);
    }
  };

  // 🧭 ENHANCED NAVIGATION: Enhanced Route Tracking with Off-Route Detection
  const startEnhancedRouteTracking = (steps: any[]) => {
    try {
      console.log('🧭 Starting enhanced route tracking with off-route detection...');
      
      // Clear existing intervals
      if (routeProgressInterval) {
        clearInterval(routeProgressInterval);
      }
      if (routeCheckInterval) {
        clearInterval(routeCheckInterval);
      }

      setTotalSteps(steps.length);
      setLastAnnouncedStep(-1);

      if (steps.length > 0) {
        const currentStep = steps[0];
        const cleanInstruction = currentStep.instructions.replace(/<[^>]*>/g, '');
        setCurrentInstruction(cleanInstruction);
        setTurnIcon(getTurnIcon(cleanInstruction));

        // Initial voice announcement
        if (voiceEnabled) {
          setTimeout(() => {
            try {
              announceInstruction('Starting enhanced navigation. ' + cleanInstruction, currentStep.distance ? currentStep.distance.text : '');
              setLastAnnouncedStep(0);
            } catch (error) {
              console.error('❌ Error in initial voice announcement:', error);
            }
          }, 1000);
        }
      }

      // 📍 ROUTE PROGRESS TRACKING (every 2 seconds)
      const progressInterval = setInterval(() => {
        try {
          if (currentLocation && routeSteps.length > 0) {
            updateEnhancedRouteProgress();
          }
        } catch (error) {
          console.error('❌ Error in enhanced route progress tracking:', error);
        }
      }, 2000);

      // 🚨 OFF-ROUTE DETECTION (every 5 seconds)  
      const routeCheckIntervalId = setInterval(() => {
        try {
          if (currentLocation && routeSteps.length > 0) {
            checkOffRouteStatus();
          }
        } catch (error) {
          console.error('❌ Error in off-route detection:', error);
        }
      }, 5000);

      setRouteProgressInterval(progressInterval);
      setRouteCheckInterval(routeCheckIntervalId);
    } catch (error) {
      console.error('❌ Error starting enhanced route tracking:', error);
    }
  };

  // 📍 ENHANCED NAVIGATION: Update Route Progress with Segment Coloring
  const updateEnhancedRouteProgress = () => {
    if (!currentLocation || !window.google || routeSteps.length === 0) return;

    let closestStepIndex = currentStepIndex;
    let minDistance = Infinity;

    // Find closest step
    for (let i = currentStepIndex; i < Math.min(routeSteps.length, currentStepIndex + 3); i++) {
      const step = routeSteps[i];
      if (step.start_location) {
        const stepLat = step.start_location.lat();
        const stepLng = step.start_location.lng();
        const distance = calculateDistance(currentLocation.lat, currentLocation.lng, stepLat, stepLng);

        if (distance < minDistance) {
          minDistance = distance;
          closestStepIndex = i;
        }
      }
    }

    // 🔄 UPDATE ROUTE SEGMENT COLORS (black → light gray for passed segments)
    if (closestStepIndex !== currentStepIndex) {
      updateRouteSegmentColors(closestStepIndex);
      setCurrentStepIndex(closestStepIndex);

      // Extract and highlight upcoming street name
      if (closestStepIndex < routeSteps.length) {
        const currentStep = routeSteps[closestStepIndex];
        const cleanInstruction = currentStep.instructions.replace(/<[^>]*>/g, '');
        setCurrentInstruction(cleanInstruction);
        setNextTurn(cleanInstruction);
        
        const stepDistance = currentStep.distance ? currentStep.distance.text : '';
        setDistanceToNextTurn(stepDistance);
        setTurnIcon(getTurnIcon(cleanInstruction));

        // 🛣️ HIGHLIGHT UPCOMING STREET NAME
        const streetMatch = cleanInstruction.match(/(?:onto|on|toward)\s+([\w\s]+?)(?:\s|$|,|\.|\/)/i);
        if (streetMatch) {
          const streetName = streetMatch[1].trim();
          setUpcomingStreetName(streetName);
          console.log(`🛣️ HIGHLIGHTING STREET: ${streetName}`);
        } else {
          setUpcomingStreetName('');
        }

        // Voice announcement
        if (closestStepIndex !== lastAnnouncedStep && voiceEnabled) {
          try {
            announceInstruction(cleanInstruction, stepDistance);
            setLastAnnouncedStep(closestStepIndex);
          } catch (error) {
            console.error('❌ Error in voice announcement:', error);
          }
        }

        // Check if at destination
        if (closestStepIndex === routeSteps.length - 1 && lastAnnouncedStep !== -999) {
          try {
            announceInstruction('Destination ahead', '');
            setLastAnnouncedStep(-999);
          } catch (error) {
            console.error('❌ Error announcing destination:', error);
          }
        }
      }
    }

    // 🧭 CALCULATE ROUTE BEARING: From current position to next route point for map rotation
    if (isNavigating && currentStepIndex < routeSteps.length) {
      try {
        const nextStep = routeSteps[currentStepIndex];
        if (nextStep.end_location) {
          const nextLat = nextStep.end_location.lat();
          const nextLng = nextStep.end_location.lng();
          
          const bearing = calculateBearing(
            currentLocation.lat, 
            currentLocation.lng, 
            nextLat, 
            nextLng
          );
          
          setRouteBearing(bearing);
          console.log(`🧭 Route bearing updated: ${bearing.toFixed(1)}° (step ${currentStepIndex})`);
        }
      } catch (error) {
        console.error('❌ Error calculating route bearing:', error);
      }
    }

    // Update last known position for off-route detection
    setLastKnownPosition(currentLocation);
  };

  // 🎨 ENHANCED NAVIGATION: Update Route Segment Colors (Black → Light Gray)
  const updateRouteSegmentColors = (currentStep: number) => {
    try {
      const segmentsPerStep = Math.max(1, Math.floor(routePolylines.length / routeSteps.length));
      const completedSegmentIndex = currentStep * segmentsPerStep;

      // Mark segments as completed and turn them light gray
      const newCompletedSegments = new Set(completedSegments);
      for (let i = 0; i < completedSegmentIndex && i < routePolylines.length; i++) {
        if (!newCompletedSegments.has(i)) {
          // 🩶 TURN COMPLETED SEGMENTS LIGHT GRAY
          routePolylines[i].setOptions({
            strokeColor: '#d1d5db', // Light gray for passed segments
            strokeOpacity: 0.7,
            strokeWeight: 4
          });
          newCompletedSegments.add(i);
          console.log(`🩶 Segment ${i} marked as completed (turned gray)`);
        }
      }

      setCompletedSegments(newCompletedSegments);
      setCurrentRoutePoint(completedSegmentIndex);
    } catch (error) {
      console.error('❌ Error updating route segment colors:', error);
    }
  };

  // 🚨 ENHANCED NAVIGATION: Off-Route Detection and Re-routing
  const checkOffRouteStatus = () => {
    try {
      if (!currentLocation || routeSteps.length === 0 || currentStepIndex >= routeSteps.length) return;

      const currentStep = routeSteps[currentStepIndex];
      if (!currentStep.start_location) return;

      const stepLat = currentStep.start_location.lat();
      const stepLng = currentStep.start_location.lng();
      const distanceFromRoute = calculateDistance(currentLocation.lat, currentLocation.lng, stepLat, stepLng);

      // 🚨 OFF-ROUTE THRESHOLD: 100 meters
      const OFF_ROUTE_THRESHOLD = 0.1; // 100 meters in kilometers

      if (distanceFromRoute > OFF_ROUTE_THRESHOLD && !isOffRoute) {
        console.log('🚨 DRIVER OFF-ROUTE DETECTED! Re-routing...');
        setIsOffRoute(true);
        
        // 🔄 TRIGGER RE-ROUTING
        triggerReRouting();
        
        // Voice announcement
        if (voiceEnabled) {
          announceInstruction('Re-calculating route', '');
        }
      } else if (distanceFromRoute <= OFF_ROUTE_THRESHOLD && isOffRoute) {
        console.log('✅ Driver back on route');
        setIsOffRoute(false);
      }
    } catch (error) {
      console.error('❌ Error in off-route detection:', error);
    }
  };

  // 🔄 ENHANCED NAVIGATION: Trigger Re-routing
  const triggerReRouting = () => {
    try {
      if (!currentTrip || !currentLocation) return;

      console.log('🔄 Re-routing from current position...');
      
      // Get current destination based on trip status
      let destination;
      if (currentTrip.status === 'pickup') {
        // If heading to pickup, parse pickup coordinates
        const pickup = currentTrip.pickup;
        if (pickup.includes(',')) {
          const [lat, lng] = pickup.split(',').map(coord => parseFloat(coord.trim()));
          destination = { lat, lng };
        }
      } else {
        // If heading to destination, parse destination coordinates
        const dest = currentTrip.destination;
        if (dest.includes(',')) {
          const [lat, lng] = dest.split(',').map(coord => parseFloat(coord.trim()));
          destination = { lat, lng };
        }
      }

      if (destination) {
        // Re-calculate route from current position
        navigateToDestination(destination, currentTrip.status === 'pickup' ? 'Pickup Location' : 'Destination');
        console.log('✅ Re-routing initiated successfully');
      } else {
        console.log('❌ Could not parse destination coordinates for re-routing');
      }
    } catch (error) {
      console.error('❌ Error triggering re-routing:', error);
    }
  };

  const getTurnIcon = (instruction: string): string => {
    const lowerInstruction = instruction.toLowerCase();
    if (lowerInstruction.includes('turn left')) return '↰';
    if (lowerInstruction.includes('turn right')) return '↱';
    if (lowerInstruction.includes('slight left')) return '↖';
    if (lowerInstruction.includes('slight right')) return '↗';
    if (lowerInstruction.includes('sharp left')) return '⤺';
    if (lowerInstruction.includes('sharp right')) return '⤻';
    if (lowerInstruction.includes('straight') || lowerInstruction.includes('continue')) return '↑';
    if (lowerInstruction.includes('u-turn')) return '↺';
    if (lowerInstruction.includes('merge')) return '⤴';
    if (lowerInstruction.includes('exit') || lowerInstruction.includes('ramp')) return '↗';
    if (lowerInstruction.includes('keep left')) return '↖';
    if (lowerInstruction.includes('keep right')) return '↗';
    return '→';
  };

  const startRouteProgressTracking = (steps: any[]) => {
    setTotalSteps(steps.length);
    setLastAnnouncedStep(-1); // Reset voice announcements for new route

    if (routeProgressInterval) {
      clearInterval(routeProgressInterval);
    }

    if (steps.length > 0) {
      const currentStep = steps[0];
      const cleanInstruction = currentStep.instructions.replace(/<[^>]*>/g, '');
      setCurrentInstruction(cleanInstruction);
      setTurnIcon(getTurnIcon(cleanInstruction));

      // Initial voice announcement for the route
      if (voiceEnabled) {
        setTimeout(() => {
          try {
            announceInstruction('Starting navigation. ' + cleanInstruction, currentStep.distance ? currentStep.distance.text : '');
            setLastAnnouncedStep(0);
          } catch (error) {
            console.error('❌ Error in initial voice announcement:', error);
          }
        }, 1000);
      }
    }

    const interval = setInterval(() => {
      try {
        if (currentLocation && routeSteps.length > 0) {
          updateRouteProgress();
        }
      } catch (error) {
        console.error('❌ Error in route progress tracking:', error);
      }
    }, 2000);

    setRouteProgressInterval(interval);
  };

  const updateRouteProgress = () => {
    if (!currentLocation || !window.google || routeSteps.length === 0) return;

    let closestStepIndex = currentStepIndex;
    let minDistance = Infinity;

    for (let i = currentStepIndex; i < Math.min(routeSteps.length, currentStepIndex + 3); i++) {
      const step = routeSteps[i];
      if (step.start_location) {
        const stepLat = step.start_location.lat();
        const stepLng = step.start_location.lng();
        const distance = calculateDistance(currentLocation.lat, currentLocation.lng, stepLat, stepLng);

        if (distance < minDistance) {
          minDistance = distance;
          closestStepIndex = i;
        }
      }
    }

    if (closestStepIndex !== currentStepIndex && closestStepIndex < routeSteps.length) {
      setCurrentStepIndex(closestStepIndex);

      const currentStep = routeSteps[closestStepIndex];
      const cleanInstruction = currentStep.instructions.replace(/<[^>]*>/g, '');
      setCurrentInstruction(cleanInstruction);
      setNextTurn(cleanInstruction);
      const stepDistance = currentStep.distance ? currentStep.distance.text : '';
      setDistanceToNextTurn(stepDistance);
      setTurnIcon(getTurnIcon(cleanInstruction));

      // Voice announcement for new step (only announce each step once)
      if (closestStepIndex !== lastAnnouncedStep && voiceEnabled) {
        try {
          announceInstruction(cleanInstruction, stepDistance);
          setLastAnnouncedStep(closestStepIndex);
        } catch (error) {
          console.error('❌ Error in voice announcement:', error);
        }
      }

      if (closestStepIndex + 1 < routeSteps.length) {
        const nextStep = routeSteps[closestStepIndex + 1];
        const nextInstruction = nextStep.instructions.replace(/<[^>]*>/g, '');
        setUpcomingTurn(nextInstruction);
        setUpcomingDistance(nextStep.distance ? nextStep.distance.text : '');
      } else {
        setUpcomingTurn('Destination ahead');
        setUpcomingDistance('');

        // Announce destination approach
        if (closestStepIndex === routeSteps.length - 1 && lastAnnouncedStep !== -999) {
          try {
            announceInstruction('Destination ahead', '');
            setLastAnnouncedStep(-999);
          } catch (error) {
            console.error('❌ Error announcing destination:', error);
          }
        }
      }
    }
  };

  const clearNavigation = () => {
    if (directionsRenderer) {
      directionsRenderer.setDirections({ routes: [] });
    }

    if (routeProgressInterval) {
      clearInterval(routeProgressInterval);
      setRouteProgressInterval(null);
    }

    // Stop any ongoing speech
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setIsNavigating(false);
    setRouteDistance('');
    setRouteDuration('');
    setNextTurn('');
    setCurrentStepIndex(0);
    setRouteSteps([]);
    setDistanceToNextTurn('');
    setTurnIcon('');
    setRouteBearing(null); // 🧭 Reset route bearing - map will return to compass heading
    setCurrentInstruction('');
    setUpcomingTurn('');
    setUpcomingDistance('');
    setTotalSteps(0);
    setLastAnnouncedStep(-1);

    if (currentLocation && map) {
      map.setCenter(currentLocation);
      map.setZoom(16);
    }
  };

  const updateDriverMarkerHeading = (heading: number) => {
    // 🚗 NAVIGATION MODE: Car always faces TOP of device, map rotates instead
    if (driverMarker) {
      const icon = driverMarker.getIcon();
      if (icon && typeof icon === 'object') {
        const newIcon = {
          ...icon,
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
              <g transform="rotate(0 30 30)">
                <!-- Car Body (ALWAYS pointing UP) -->
                <rect x="20" y="10" width="20" height="40" fill="${driverSettings.vehicleColor}" rx="8" stroke="white" stroke-width="2"/>

                <!-- Windshield -->
                <rect x="23" y="15" width="14" height="12" fill="rgba(135, 206, 235, 0.8)" rx="3" stroke="rgba(0,0,0,0.3)" stroke-width="0.5"/>

                <!-- Rear Window -->
                <rect x="23" y="33" width="14" height="10" fill="rgba(135, 206, 235, 0.8)" rx="2" stroke="rgba(0,0,0,0.3)" stroke-width="0.5"/>

                <!-- Side Windows -->
                <rect x="22" y="20" width="16" height="20" fill="rgba(135, 206, 235, 0.6)" rx="2"/>

                <!-- Headlights -->
                <circle cx="25" cy="14" r="2" fill="white" stroke="#ccc" stroke-width="0.5"/>
                <circle cx="35" cy="14" r="2" fill="white" stroke="#ccc" stroke-width="0.5"/>

                <!-- Taillights -->
                <circle cx="25" cy="46" r="2" fill="#ff4444" stroke="#cc0000" stroke-width="0.5"/>
                <circle cx="35" cy="46" r="2" fill="#ff4444" stroke="#cc0000" stroke-width="0.5"/>

                <!-- Direction Indicator (GREEN arrow pointing UP) -->
                <polygon points="30,8 35,15 25,15" fill="#10b981" stroke="white" stroke-width="1"/>
              </g>
            </svg>
          `)
        };
        driverMarker.setIcon(newIcon);
      }
    }
    
    // 🗺️ NAVIGATION MODE: Set driver heading for map rotation effect
    if (heading !== null && heading !== undefined) {
      const normalizedHeading = ((heading % 360) + 360) % 360;
      setDriverHeading(normalizedHeading);
      console.log(`🗺️ Driver heading updated: ${normalizedHeading.toFixed(1)}°`);
    }
  };

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Fetch surge heatmap data for drivers to see high-demand zones
  const fetchHeatmapData = async (showSuccessNotification = false) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('🗺️ DriverApp: No auth token found, heatmap unavailable');
        // Only show auth notification if user is actively trying to use heatmap
        if (showHeatmap) {
          showNotification('⚠️ Authentication Required', 'Please sign in to view demand zones', 'warning');
        }
        return;
      }

      console.log('🗺️ DriverApp: Fetching surge heatmap data...');
      const response = await fetch('/api/driver/surge/heatmap', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const newZoneCount = data.surgeZones?.length || 0;
          const oldZoneCount = heatmapZones.length;
          
          setHeatmapZones(data.surgeZones || []);
          setHeatmapStats(data.marketStats || {});
          console.log(`🗺️ DriverApp: Loaded ${newZoneCount} surge zones for driver heatmap`);
          
          // Only show success notification on first load or when zone count changes significantly
          if (showSuccessNotification && (newZoneCount > 0 && (oldZoneCount === 0 || Math.abs(newZoneCount - oldZoneCount) > 2))) {
            showNotification('🎯 Demand Zones Updated', `Found ${newZoneCount} high-demand areas`, 'success');
          }
        } else if (showSuccessNotification) {
          showNotification('⚠️ No Surge Data', 'No demand zones currently available', 'info');
        }
      } else if (response.status === 401 || response.status === 403) {
        console.warn('🗺️ DriverApp: Access denied to heatmap data');
        if (showSuccessNotification) {
          showNotification('🔒 Access Restricted', 'Heatmap unavailable for your account', 'warning');
        }
        setHeatmapZones([]);
        setHeatmapStats({});
      } else {
        console.error('🗺️ DriverApp: Heatmap fetch failed:', response.status);
        if (showSuccessNotification) {
          showNotification('❌ Data Loading Failed', 'Unable to load demand zones. Try again later.', 'error');
        }
        setHeatmapZones([]);
        setHeatmapStats({});
      }
    } catch (error) {
      console.error('❌ DriverApp: Error fetching heatmap data:', error);
      if (showSuccessNotification) {
        showNotification('❌ Connection Error', 'Check your internet connection and try again', 'error');
      }
      setHeatmapZones([]);
      setHeatmapStats({});
    }
  };

  // 🧭 Calculate bearing between two points for route-based map rotation
  const calculateBearing = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
    
    const bearing = Math.atan2(y, x);
    return (bearing * 180 / Math.PI + 360) % 360; // Convert to degrees and normalize
  };

  const updateDriverPreference = (key: string, value: boolean) => {
    setDriverSettings(prev => ({ ...prev, [key]: value }));
    console.log(`🔧 Driver preference updated: ${key} = ${value}`);
  };

  const announceInstruction = (instruction: string, distance: string) => {
    if (!voiceEnabled || !window.speechSynthesis) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    let announcement = '';

    if (distance && distance !== '') {
      announcement = `In ${distance}, ${instruction}`;
    } else {
      announcement = instruction;
    }

    // Clean up the announcement text
    announcement = announcement
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\b(US|I-|Route|SR|Highway|Hwy)\s*/gi, '') // Simplify road names
      .replace(/\s+/g, ' ') // Clean up extra spaces
      .trim();

    const utterance = new SpeechSynthesisUtterance(announcement);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;

    // Use a clear, neutral voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => 
      voice.lang.startsWith('en') && 
      (voice.name.includes('Google') || voice.name.includes('Microsoft'))
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    console.log('🔊 Voice announcement:', announcement);
    window.speechSynthesis.speak(utterance);
  };

  const announceSafetyReminder = () => {
    console.log('🔊 Attempting to play safety reminder...');

    if (!window.speechSynthesis) {
      console.warn('🔇 Speech synthesis not supported - safety reminder cannot be announced');
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const safetyMessage = "Reminder for our valued passengers, please fasten your seat belts";

    const utterance = new SpeechSynthesisUtterance(safetyMessage);
    utterance.rate = 0.8;
    utterance.pitch = 1.0;
    utterance.volume = 1.0; // Maximum volume for safety message

    // Add event listeners for debugging
    utterance.onstart = () => {
      console.log('🔊 Safety reminder started playing');
    };

    utterance.onend = () => {
      console.log('🔊 Safety reminder finished playing');
    };

    utterance.onerror = (event) => {
      console.error('🔊 Safety reminder error:', event);
    };

    // Wait for voices to be loaded
    const speakMessage = () => {
      const voices = window.speechSynthesis.getVoices();
      console.log('🔊 Available voices:', voices.length);

      const preferredVoice = voices.find(voice => 
        voice.lang.startsWith('en') && 
        (voice.name.includes('Google') || voice.name.includes('Microsoft') || voice.name.includes('English'))
      );

      if (preferredVoice) {
        utterance.voice = preferredVoice;
        console.log('🔊 Using preferred voice:', preferredVoice.name);
      } else {
        console.log('🔊 Using default voice');
      }

      console.log('🔊 Playing safety reminder:', safetyMessage);

      // Force immediate playback
      setTimeout(() => {
        try {
          window.speechSynthesis.speak(utterance);
        } catch (error) {
          console.error('❌ Error in speech synthesis:', error);
        }
      }, 100);
    };

    // Check if voices are already loaded
    if (window.speechSynthesis.getVoices().length > 0) {
      speakMessage();
    } else {
      console.log('🔊 Waiting for voices to load...');
      // Wait for voices to load with timeout
      let voicesLoaded = false;
      const loadTimeout = setTimeout(() => {
        if (!voicesLoaded) {
          console.log('🔊 Voice loading timeout - using default voice');
          window.speechSynthesis.speak(utterance);
        }
      }, 2000);

      window.speechSynthesis.onvoiceschanged = () => {
        if (!voicesLoaded) {
          voicesLoaded = true;
          clearTimeout(loadTimeout);
          speakMessage();
          window.speechSynthesis.onvoiceschanged = null;
        }
      };
    }
  };

  // Cascading ride request audio chime (7-second continuous ringer)
  const startCascadingAudio = () => {
    if (!audioRef.current) {
      // Create audio element for ride request chime
      audioRef.current = new Audio();
      audioRef.current.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAcBkLT3u/LeCsFJnjI8N2QQAoUXrTp66hVFAlGn+DyvmEcBz+a2/LDcyUGLIHO8tiJOQcZZ7zs6J1NEQxQp+PwtmQcBjiO2PLNeSsFJHbH8N2QQAoUXrTp66hVFApGn+DyvmAcBkLT3u/LeSsFJnjI8N2QQAoUXrTp66hVFAlGn+DyvmEcBz+a2/LDcyUGLIHO8tiJOQcZZ7zs6J1NEQ==';
      audioRef.current.loop = true;
      audioRef.current.volume = 0.8;
    }

    try {
      setIsAudioPlaying(true);
      audioRef.current.play();
      console.log('🔔 Cascading ride request audio chime started');
    } catch (error) {
      console.error('❌ Error starting cascading audio:', error);
    }
  };

  const stopCascadingAudio = () => {
    if (audioRef.current && isAudioPlaying) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsAudioPlaying(false);
        console.log('🔇 Cascading ride request audio chime stopped');
      } catch (error) {
        console.error('❌ Error stopping cascading audio:', error);
      }
    }
  };

  // Update online hours in real-time
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (driverStatus === 'online' && onlineStartTime) {
      interval = setInterval(() => {
        try {
          const sessionTime = (new Date().getTime() - onlineStartTime.getTime()) / (1000 * 60 * 60);
          const currentTotalHours = totalOnlineTime + sessionTime;

          // DISABLED: Don't override API data with fake hours calculation
          // setEarnings(prevEarnings => ({
          //   ...prevEarnings,
          //   hours: parseFloat(currentTotalHours.toFixed(2))
          // }));
          console.log('⏱️ Online hours calculated:', parseFloat(currentTotalHours.toFixed(2)), '(not overriding API data)');
        } catch (error) {
          console.error('❌ Error updating online hours:', error);
        }
      }, 30000); // Update every 30 seconds
    }

    return () => {
      if (interval) {
        try {
          clearInterval(interval);
        } catch (error) {
          console.error('❌ Error clearing interval:', error);
        }
      }
    };
  }, [driverStatus, onlineStartTime, totalOnlineTime]);

  // Enhanced device orientation (gyroscope) integration for accurate heading
  useEffect(() => {
    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
      try {
        if (event.webkitCompassHeading !== undefined) {
          // iOS: webkitCompassHeading gives true north heading (0° = North)
          // Device should face direction of travel, so car points in travel direction
          const heading = event.webkitCompassHeading;
          setDeviceOrientation(heading);
          setGyroscopeHeading(heading);
          console.log(`🧭 iOS Compass heading: ${heading.toFixed(1)}° (gyroscope)`);
        } else if (event.alpha !== null) {
          // Android: alpha gives magnetic north heading (0° = North)  
          // Device should face direction of travel, so car points in travel direction
          const heading = event.alpha;
          setDeviceOrientation(heading);
          setGyroscopeHeading(heading);
          console.log(`🧭 Android heading: ${heading.toFixed(1)}° (gyroscope)`);
        }
      } catch (error) {
        console.error('❌ Error processing device orientation:', error);
      }
    };

    const requestOrientationPermission = async () => {
      try {
        if (typeof (DeviceOrientationEvent as any)?.requestPermission === 'function') {
          // iOS 13+ requires permission
          const permission = await (DeviceOrientationEvent as any).requestPermission();
          if (permission === 'granted') {
            window.addEventListener('deviceorientation', handleDeviceOrientation);
            console.log('✨ Device orientation permission granted - gyroscope active');
          } else {
            console.log('⚠️ Device orientation permission denied');
          }
        } else {
          // Android or older iOS
          window.addEventListener('deviceorientation', handleDeviceOrientation);
          console.log('✨ Device orientation listener added - gyroscope active');
        }
      } catch (error) {
        console.error('❌ Error requesting device orientation permission:', error);
      }
    };

    // Only request orientation when driver is online and navigating
    if (driverStatus === 'online' || isNavigating) {
      requestOrientationPermission();
    }

    return () => {
      window.removeEventListener('deviceorientation', handleDeviceOrientation);
    };
  }, [driverStatus, isNavigating]);

  // Get and track current location
  useEffect(() => {
    if (navigator.geolocation) {
      const options = {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
        // Request heading data for car rotation
        enableCompass: true
      };

      const updateLocation = (position: GeolocationPosition) => {
        try {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          
          console.log('📍 Driver GPS location:', `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);

          // Enhanced heading detection with priority: device orientation > geolocation > movement calculation
          let heading = driverHeading;
          
          // First priority: Use device orientation (gyroscope/compass) if available
          if (deviceOrientation !== null) {
            heading = deviceOrientation;
            setDriverHeading(heading);
          }
          // Second priority: Use geolocation heading if available
          else if (position.coords.heading !== null && position.coords.heading !== undefined) {
            heading = position.coords.heading;
            setDriverHeading(heading);
          }
          // Third priority: Calculate heading based on movement direction
          else if (currentLocation) {
            const deltaLat = location.lat - currentLocation.lat;
            const deltaLng = location.lng - currentLocation.lng;

            if (Math.abs(deltaLat) > 0.0001 || Math.abs(deltaLng) > 0.0001) {
              // Calculate bearing from north using proper geographic formula
              // atan2(deltaLng, deltaLat) gives bearing where 0° = North (up on map)
              const radianLat = location.lat * Math.PI / 180;
              const calculatedHeading = Math.atan2(
                deltaLng * Math.cos(radianLat), 
                deltaLat
              ) * (180 / Math.PI);
              // Normalize to 0-360 degrees where 0° = North (pointing up)
              const normalizedHeading = (calculatedHeading + 360) % 360;
              setDriverHeading(normalizedHeading);
              heading = normalizedHeading;
              console.log(`🧭 Movement heading: ${normalizedHeading.toFixed(1)}° (calculated from travel)`);
            }
          }

          // Calculate distance to pickup if in a trip
          if (currentTrip && rideRequest) {
            const pickupLat = typeof rideRequest.pickup === 'object' ? rideRequest.pickup.coordinates.lat : 0;
            const pickupLng = typeof rideRequest.pickup === 'object' ? rideRequest.pickup.coordinates.lng : 0;
            
            if (pickupLat && pickupLng) {
              const distance = calculateDistance(location.lat, location.lng, pickupLat, pickupLng);
              setDistanceToPickup(distance * 5280); // Convert miles to feet
              
              // Auto-expand passenger info when within 20ft of pickup
              if (distance * 5280 <= 20 && isPassengerInfoCollapsed && !manuallyExpanded) {
                setIsPassengerInfoCollapsed(false);
              }
            }
          }

          setCurrentLocation(location);

          if (map) {
            if (driverMarker) {
              try {
                driverMarker.setPosition(location);

                // Update map rotation (car stays pointing up)
                updateDriverMarkerHeading(heading);

                // Update rider marker position to follow driver's actual location
                if (riderMarker && currentTrip) {
                  riderMarker.setPosition(location);
                }
              } catch (markerError) {
                console.error('❌ Error updating driver marker:', markerError);
              }
            } else {
              try {
                const marker = new window.google.maps.Marker({
                  position: location,
                  map: map,
                  icon: {
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                      <svg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg">
                        <g transform="rotate(0 30 30)">
                          <!-- Car Body (ALWAYS pointing UP) -->
                          <rect x="20" y="10" width="20" height="40" fill="${driverSettings.vehicleColor}" rx="8" stroke="white" stroke-width="2"/>

                          <!-- Windshield -->
                          <rect x="23" y="15" width="14" height="12" fill="rgba(135, 206, 235, 0.8)" rx="3" stroke="rgba(0,0,0,0.3)" stroke-width="0.5"/>

                          <!-- Rear Window -->
                          <rect x="23" y="33" width="14" height="10" fill="rgba(135, 206, 235, 0.8)" rx="2" stroke="rgba(0,0,0,0.3)" stroke-width="0.5"/>

                          <!-- Side Windows -->
                          <rect x="22" y="20" width="16" height="20" fill="rgba(135, 206, 235, 0.6)" rx="2"/>

                          <!-- Headlights -->
                          <circle cx="25" cy="14" r="2" fill="white" stroke="#ccc" stroke-width="0.5"/>
                          <circle cx="35" cy="14" r="2" fill="white" stroke="#ccc" stroke-width="0.5"/>

                          <!-- Taillights -->
                          <circle cx="25" cy="46" r="2" fill="#ff4444" stroke="#cc0000" stroke-width="0.5"/>
                          <circle cx="35" cy="46" r="2" fill="#ff4444" stroke="#cc0000" stroke-width="0.5"/>

                          <!-- Direction Indicator (GREEN arrow pointing UP) -->
                          <polygon points="30,8 35,15 25,15" fill="#10b981" stroke="white" stroke-width="1"/>
                        </g>
                      </svg>
                    `),
                    scaledSize: new window.google.maps.Size(60, 60),
                    anchor: new window.google.maps.Point(30, 30)
                  },
                  title: 'Your Location'
                });
                setDriverMarker(marker);
              } catch (markerCreateError) {
                console.error('❌ Error creating driver marker:', markerCreateError);
              }
            }

            try {
              if (!isNavigating) {
                map.setCenter(location);
                map.setZoom(16);
              } else if (currentTrip) {
                map.setCenter(location);
                map.setZoom(18);
              }
            } catch (mapError) {
              console.error('❌ Error updating map center/zoom:', mapError);
            }
          }
        } catch (error) {
          console.error('❌ Error in updateLocation:', error);
        }
      };

      navigator.geolocation.getCurrentPosition(
        updateLocation,
        (error) => {
          console.error('❌ Error getting driver location:', error);
          console.log('🔄 Using Bentonville, AR as driver location fallback');
          
          // Set fallback location to Bentonville, AR (NOT NYC)
          const fallbackLocation = { lat: 36.3729, lng: -94.2088 };
          setCurrentLocation(fallbackLocation);
          
          if (map && driverMarker) {
            try {
              driverMarker.setPosition(fallbackLocation);
              map.setCenter(fallbackLocation);
              console.log('✅ Driver marker set to Bentonville fallback');
            } catch (mapError) {
              console.error('❌ Error setting fallback location on map:', mapError);
            }
          }
        },
        options
      );

      let watchId: number;
      if (driverStatus === 'online' || driverStatus === 'busy') {
        watchId = navigator.geolocation.watchPosition(
          updateLocation,
          (error) => {
            console.error('❌ Error watching driver location:', error);
            // Don't spam fallbacks during watching - only on initial failure
            if (!currentLocation) {
              console.log('🔄 Setting initial fallback to Bentonville, AR');
              const fallbackLocation = { lat: 36.3729, lng: -94.2088 };
              setCurrentLocation(fallbackLocation);
            }
          },
          options
        );
      }

      return () => {
        if (watchId) navigator.geolocation.clearWatch(watchId);
      };
    }
  }, [map, driverMarker, driverStatus, isNavigating]);

  // 🔧 FIXED: Stable WebSocket connection (SINGLE connection for entire session)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.io && !socketRef.current) {
      try {
        console.log('🔗 Creating SINGLE stable socket connection...');
        
        // Get the current domain and use it for Socket.IO connection
        const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
        const host = window.location.host;
        const socketUrl = `${protocol}//${host}`;
        
        console.log('🌐 Connecting to Socket.IO server at:', socketUrl);
        
        const socket = window.io(socketUrl, {
          transports: ['websocket', 'polling'],
          timeout: 20000,
          forceNew: false,
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: 5,
          maxReconnectionAttempts: 5
        });
        
        socketRef.current = socket;

        // Set up socket event listeners once
        socket.on('connect', () => {
          console.log('🟢 Socket connected successfully');
        });

        socket.on('disconnect', () => {
          console.log('🔴 Socket disconnected');
        });

        socket.on('connect_error', (error: any) => {
          console.error('❌ Socket connection error:', error);
          console.log('🔄 Will retry connection automatically...');
        });
        
        socket.on('reconnect', (attemptNumber: number) => {
          console.log(`🟢 Socket reconnected after ${attemptNumber} attempts`);
        });
        
        socket.on('reconnect_error', (error: any) => {
          console.error('❌ Socket reconnection error:', error);
        });
        
        socket.on('reconnect_failed', () => {
          console.error('❌ Socket failed to reconnect after all attempts');
        });

        // Listen for ride requests with error handling
        socket.on('new-ride-request', (rideData: any) => {
          try {
            console.log('🚗 New ride request received:', rideData);
            setRideRequest({
              id: rideData.id,
              rider: rideData.rider || { name: 'Demo Rider', rating: 4.8, phone: '+1234567890' },
              pickup: rideData.pickup || sampleRideRequest.pickup,
              destination: rideData.destination || sampleRideRequest.destination,
              fare: rideData.estimatedFare || 12.50,
              distance: rideData.distance || '2.3 miles',
              duration: rideData.duration || '8 minutes',
              estimatedFare: rideData.estimatedFare?.toString() || '$12.50',
              estimatedTime: '8 min',
              rideType: rideData.rideType || 'standard',
              riderPreferences: rideData.riderPreferences || {
                music: false,
                conversation: false,
                temperature: 'no-preference'
              }
            });
            setRequestTimeout(30);
          } catch (error) {
            console.error('❌ Error processing ride request:', error);
          }
        });

        // Listen for cascading ride requests (7-second timeout with audio)
        socket.on('cascading-ride-request', (rideData: any) => {
          try {
            console.log('🎯 Cascading ride request received:', rideData);
            
            setCascadingRequest({
              id: rideData.rideId,
              rider: { name: 'Rider', rating: 4.8, phone: '+1234567890' },
              pickup: {
                address: rideData.pickupAddress,
                coordinates: rideData.pickup
              },
              destination: {
                address: rideData.destinationAddress,
                coordinates: rideData.destination
              },
              fare: rideData.estimatedFare || 12.50,
              distance: rideData.driverInfo?.distance ? `${rideData.driverInfo.distance} mi` : '2.3 miles',
              duration: rideData.estimatedArrival ? `${rideData.estimatedArrival} min` : '8 minutes',
              estimatedFare: rideData.estimatedFare?.toString() || '$12.50',
              estimatedTime: rideData.estimatedArrival ? `${rideData.estimatedArrival} min` : '8 min',
              rideType: rideData.rideType || 'standard',
              riderPreferences: rideData.riderPreferences || {
                music: false,
                conversation: false,
                temperature: 'no-preference'
              },
              cascadeInfo: rideData.cascadeInfo || {
                attempt: 1,
                totalDrivers: 1,
                timeRemaining: 7
              }
            });
            
            // Start 7-second countdown
            setCascadingTimeout(7);
            
            // Start audio chime
            startCascadingAudio();
            
            console.log('🔔 Cascading request set up with 7-second countdown and audio');
          } catch (error) {
            console.error('❌ Error handling cascading ride request:', error);
          }
        });

        // Listen for ride acceptance confirmations
        socket.on('ride-assignment-confirmed', (data: any) => {
          try {
            console.log('✅ Ride assignment confirmed:', data);
          } catch (error) {
            console.error('❌ Error processing ride confirmation:', error);
          }
        });

        // Listen for ride cancellation
        socket.on('ride-cancelled', (data: any) => {
          try {
            console.log('📡 CANCELLATION DEBUG: DriverApp received ride-cancelled event');
            console.log('📡 CANCELLATION DEBUG: Event data:', data);
            console.log('📡 CANCELLATION DEBUG: Current trip:', currentTrip);
            console.log('📡 CANCELLATION DEBUG: RideId match check:', data.rideId, '===', currentTrip?.id, '?', data.rideId === currentTrip?.id);
            
            // Helper function to normalize UUID-like IDs (handle casing and dash variations only)
            const normalizeUuidId = (id: any) => {
              const str = (id ?? '').toString().trim();
              // Only normalize if it looks like a UUID (8-4-4-4-12 pattern)
              if (/^[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}$/i.test(str.replace(/-/g, ''))) {
                return str.toLowerCase().replace(/-/g, '');
              }
              return str; // Return untouched for non-UUID IDs (preserve original casing)
            };
            
            const cancelRideId = normalizeUuidId(data.rideId);
            const currentTripId = normalizeUuidId(currentTrip?.id || '');
            
            console.log('🔄 CANCELLATION DEBUG: ID comparison - raw cancelRideId:', data.rideId, 'raw currentTripId:', currentTrip?.id);
            console.log('🔄 CANCELLATION DEBUG: Normalized - cancelRideId:', cancelRideId, 'currentTripId:', currentTripId);
            
            // Check for exact match first
            const isExactMatch = currentTrip && cancelRideId === currentTripId;
            const hasCurrentTrip = !!currentTrip;
            let isRecoveryCase = false;
            
            if (!isExactMatch) {
              console.log('🔄 CANCELLATION DEBUG: ID mismatch detected');
              console.log('🔄 CANCELLATION DEBUG: hasCurrentTrip?', hasCurrentTrip, 'cancelRideId:', cancelRideId, 'currentTripId:', currentTripId);
              
              // Before proceeding with any cleanup, verify this cancellation is actually for this driver
              const isForThisDriver = data.driverId && user?.id && String(data.driverId) === String(user.id);
              console.log('🔄 CANCELLATION DEBUG: Driver verification - data.driverId:', data.driverId, 'user.id:', user?.id, 'match:', isForThisDriver);
              
              if (!hasCurrentTrip) {
                // No current trip, ignore unrelated cancellation
                console.log('🔄 CANCELLATION DEBUG: No current trip - ignoring unrelated cancellation');
                return;
              } else if (!isForThisDriver) {
                // Cancellation not for this driver, ignore it
                console.log('🔄 CANCELLATION DEBUG: Cancellation not for this driver - ignoring');
                return;
              } else if (cancelRideId.length > 0) {
                // ID mismatch but cancellation is for this driver - proceed with careful recovery
                console.log('🔧 CANCELLATION RECOVERY: Driver-verified cleanup despite ID mismatch - likely formatting issue');
                isRecoveryCase = true;
              } else {
                // Current trip exists, for this driver, but cancel ID is empty/invalid
                console.warn('⚠️ CANCELLATION DEBUG: Invalid cancellation data but for this driver - showing notification only');
                showNotification('Ride Cancelled', 'A ride was cancelled', 'warning');
                return;
              }
            } else {
              console.log('✅ CANCELLATION DEBUG: Exact ID match - proceeding with normal cleanup');
            }
            
            // Show appropriate notification based on case
            if (isRecoveryCase) {
              // Recovery case - show specific message
              showNotification('Ride Cancelled', 'Ride cancelled (recovered from sync issue)', 'warning');
            } else {
              // Normal case - show compensation info
              const notificationMessage = data.driverCompensation > 0 
                ? `Ride Cancelled - You received $${data.driverCompensation} compensation`
                : data.message;
              showNotification('Ride Cancelled', notificationMessage, 'warning');
            }

            // Comprehensive route cleanup
            try {
              // Clear map overlays
              if (map && (window as any).directionsRenderer) {
                (window as any).directionsRenderer.setMap(null);
              }
              
              // Clear navigation data
              setCurrentTrip(null);
              setRouteSteps([]);
              setCurrentStepIndex(0);
              setDistanceToNextTurn(null);
              setIsNavigating(false);
              
              // Reset driver status to online/available
              setDriverStatus('online');
              
              console.log('🔄 Complete route cleanup completed after cancellation');
              
              // Send acknowledgment back to server
              if (socketRef.current) {
                socketRef.current.emit('ride-cancelled-ack', { 
                  rideId: data.rideId, 
                  driverId: user?.id,
                  timestamp: new Date().toISOString() 
                });
              }
              
            } catch (cleanupError) {
              console.error('❌ Error during route cleanup:', cleanupError);
            }
            
          } catch (error) {
            console.error('❌ Error handling ride cancellation:', error);
          }
        });

        // Add error event listener
        socket.on('error', (error: any) => {
          console.error('❌ WebSocket error:', error);
        });

        socket.on('connect_error', (error: any) => {
          console.error('❌ WebSocket connection error:', error);
        });

        return () => {
          try {
            socket.disconnect();
          } catch (error) {
            console.error('❌ Error disconnecting socket:', error);
          }
        };
      } catch (error) {
        console.error('❌ Error initializing WebSocket:', error);
      }
    } else {
      // Fallback to simulation when WebSocket not available
      let interval: NodeJS.Timeout;
      if (driverStatus === 'online' && !rideRequest && !currentTrip) {
        interval = setInterval(() => {
          try {
            if (Math.random() > 0.8) {
              setRideRequest(sampleRideRequest);
              setRequestTimeout(30);
            }
          } catch (error) {
            console.error('❌ Error in ride simulation:', error);
          }
        }, 15000);
      }
      return () => {
        try {
          clearInterval(interval);
        } catch (error) {
          console.error('❌ Error clearing simulation interval:', error);
        }
      };
    }
  }, []); // 🔧 CRITICAL: Empty dependency array - only create socket ONCE

  // 🔧 SEPARATE useEffect for driver status management (without recreating socket)
  useEffect(() => {
    if (socketRef.current && driverStatus === 'online' && isAuthenticated && user) {
      console.log('🔄 Driver status changed to online - updating socket connection...');
      
      // Join driver room
      socketRef.current.emit('join-room', {
        userId: user.id,
        userType: 'driver'
      });

      // Emit driver-connect with current status
      socketRef.current.emit('driver-connect', {
        driverId: user.id,
        status: 'online',
        location: {
          lat: currentLocation?.lat || 36.3729,
          lng: currentLocation?.lng || -94.2088,
          heading: 0,
          speed: 0
        },
        vehicle: {
          type: driverSettings.vehicleType || 'sedan',
          license: 'ABC-123',
          color: driverSettings.vehicleColor || '#3b82f6'
        },
        preferences: driverSettings,
        isAvailable: true
      });

      console.log('✅ Driver status updated via existing socket connection');
    }
  }, [driverStatus, isAuthenticated, user, currentLocation, driverSettings]);

  // 🚨 BULLETPROOF CANCELLATION CHECK: Polls server every 3 seconds when driver has active trip
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    
    // Only poll when driver has an active trip
    if (currentTrip && user && isAuthenticated) {
      console.log('🔍 CANCELLATION POLLING: Starting trip status polling for trip', currentTrip.id);
      
      pollInterval = setInterval(async () => {
        try {
          const response = await fetch(`/api/driver/trip-status?tripId=${currentTrip.id}&driverId=${user.id}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            
            // Trip was cancelled - immediately clear driver state
            if (data.status === 'cancelled') {
              console.log('🚨 CANCELLATION DETECTED: Trip was cancelled - clearing driver state');
              
              // Show notification
              showNotification('Trip Cancelled', 
                data.driverCompensation > 0 
                  ? `Trip cancelled - You received $${data.driverCompensation} compensation` 
                  : 'Trip was cancelled by rider', 
                'warning'
              );
              
              // Clear all driver state immediately
              setCurrentTrip(null);
              setDriverStatus('online');
              
              // 🗺️ FIXED: Use proper clearNavigation function to clean up route/directions
              clearNavigation();
              
              console.log('✅ CANCELLATION RECOVERY: Driver state cleared successfully');
            }
          }
        } catch (error) {
          console.warn('⚠️ CANCELLATION POLLING: Error checking trip status:', error);
          // Don't block - continue polling
        }
      }, 3000); // Check every 3 seconds
    }
    
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        console.log('🛑 CANCELLATION POLLING: Stopped trip status polling');
      }
    };
  }, [currentTrip?.id, user?.id, isAuthenticated]);

  // Request timeout countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (requestTimeout > 0) {
      interval = setInterval(() => {
        try {
          setRequestTimeout(prev => {
            if (prev <= 1) {
              setRideRequest(null);
              return 0;
            }
            return prev - 1;
          });
        } catch (error) {
          console.error('❌ Error updating request timeout:', error);
        }
      }, 1000);
    }
    return () => {
      try {
        clearInterval(interval);
      } catch (error) {
        console.error('❌ Error clearing timeout interval:', error);
      }
    };
  }, [requestTimeout]);

  // Cascading timeout countdown (7-second countdown)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (cascadingTimeout > 0) {
      interval = setInterval(() => {
        try {
          setCascadingTimeout(prev => {
            if (prev <= 1) {
              // Time's up - stop audio and clear request
              stopCascadingAudio();
              setCascadingRequest(null);
              console.log('⏰ Cascading timeout reached - moving to next driver');
              return 0;
            }
            return prev - 1;
          });
        } catch (error) {
          console.error('❌ Error updating cascading timeout:', error);
        }
      }, 1000);
    }
    return () => {
      try {
        clearInterval(interval);
      } catch (error) {
        console.error('❌ Error clearing cascading timeout interval:', error);
      }
    };
  }, [cascadingTimeout]);

  const toggleDriverStatus = () => {
    const newStatus = driverStatus === 'offline' ? 'online' : 'offline';
    setDriverStatus(newStatus);

    if (newStatus === 'online') {
      // Start tracking online time
      setOnlineStartTime(new Date());
      setDriverSettings(prev => ({ ...prev, isOnline: true }));

      // Driver online notification
      showNotification('🚗 Driver Online', 'You are now available for ride requests!', 'success');
      sendPushNotification(
        '🚗 Driver Status: Online', 
        'You are now available for ride requests. Pi VIP drivers earn more!',
        { tag: 'driver-status', requireInteraction: false }
      );
    } else if (newStatus === 'offline') {
      // Calculate and add online time when going offline
      if (onlineStartTime) {
        const sessionTime = (new Date().getTime() - onlineStartTime.getTime()) / (1000 * 60 * 60); // Convert to hours
        const newTotalTime = totalOnlineTime + sessionTime;
        setTotalOnlineTime(newTotalTime);
        // DISABLED: Don't override API data with fake hours calculation
        // setEarnings(prevEarnings => ({
        //   ...prevEarnings,
        //   hours: parseFloat(newTotalTime.toFixed(2))
        // }));
        console.log('📴 Offline hours calculated:', parseFloat(newTotalTime.toFixed(2)), '(not overriding API data)');
        setOnlineStartTime(null);
      }

      setRideRequest(null);
      setCurrentTrip(null);
      setRequestTimeout(0);
      clearNavigation();
      setDriverSettings(prev => ({ ...prev, isOnline: false }));

      // Clear rider marker when going offline
      if (riderMarker) {
        riderMarker.setMap(null);
        setRiderMarker(null);
      }
    }
  };

  const checkExpiredDiscount = async (riderId: string): Promise<boolean> => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('❌ No authentication token - cannot verify discount');
        return false;
      }
      const response = await fetch(`/api/driver/check-expired-discount/${riderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.hasExpiredDiscount) {
          setVerificationRiderInfo(data.riderInfo);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error checking expired discount:', error);
      return false;
    }
  };

  const acceptRide = async () => {
    if (rideRequest) {
      // First check if rider has expired corporate discount
      const hasExpiredDiscount = await checkExpiredDiscount(rideRequest.rider.id);
      
      if (hasExpiredDiscount) {
        // Show verification modal instead of accepting immediately
        setPendingRideId(rideRequest.id);
        setShowVerificationModal(true);
        return;
      }
      
      // No expired discount - proceed with normal acceptance
      proceedWithRideAcceptance();
    }
  };

  const proceedWithRideAcceptance = () => {
    if (rideRequest) {
      // 🔧 FIXED: Use existing socket connection instead of creating new one
      if (socketRef.current) {
        socketRef.current.emit('accept-ride', { rideId: rideRequest.id });
        console.log('✅ Ride acceptance sent via existing socket:', rideRequest.id);
      } else {
        console.log('⚠️ No socket connection available for ride acceptance');
      }

      setCurrentTrip({
        id: rideRequest.id,
        rider: rideRequest.rider,
        pickup: rideRequest.pickup.address,
        destination: rideRequest.destination.address,
        fare: rideRequest.fare,
        duration: rideRequest.duration,
        status: 'accepted',
        startTime: new Date().toISOString()
      });
      setRideRequest(null);
      setRequestTimeout(0);
      setDriverStatus('busy');
      setShowStatsOverlay(false);

      // Collapse passenger info container after trip acceptance
      setIsPassengerInfoCollapsed(true);
      setManuallyExpanded(false);
      console.log('📦 Passenger info collapsed after trip acceptance');

      setTimeout(() => {
        if (rideRequest) {
          navigateToDestination(rideRequest.pickup.coordinates, rideRequest.pickup.address);
        }
      }, 1000);
    }
  };

  const handleVerificationConfirm = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('❌ No authentication token - cannot verify discount');
        return false;
      }
      const response = await fetch('/api/driver/confirm-discount-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          riderId: rideRequest?.rider.id,
          applicationId: verificationRiderInfo?.applicationId,
          rideId: pendingRideId
        })
      });

      if (response.ok) {
        console.log('✅ Corporate discount extended successfully');
        showNotification('✅ Discount Extended', 'Corporate discount extended for 90 days', 'success');
      }
    } catch (error) {
      console.error('Error confirming verification:', error);
    }

    // Close modal and proceed with ride acceptance
    setShowVerificationModal(false);
    setVerificationRiderInfo(null);
    setPendingRideId(null);
    proceedWithRideAcceptance();
  };

  const handleVerificationCancel = () => {
    // Close modal and decline the ride
    setShowVerificationModal(false);
    setVerificationRiderInfo(null);
    setPendingRideId(null);
    declineRide();
  };

  const declineRide = () => {
    setRideRequest(null);
    setRequestTimeout(0);
  };

  // Cascading ride request accept/reject functions
  const acceptCascadingRide = () => {
    if (cascadingRequest && socketRef.current) {
      try {
        // Stop audio immediately
        stopCascadingAudio();
        
        // Send acceptance to server
        socketRef.current.emit('accept-cascading-ride', {
          rideId: cascadingRequest.id,
          driverId: user?.id
        });

        // Clear cascading request and timeout
        setCascadingRequest(null);
        setCascadingTimeout(0);
        
        console.log('✅ Cascading ride accepted, notifying server');
        
        // Show acceptance feedback
        showNotification('🎉 Ride accepted! Starting navigation to pickup...', 'success');
        
        // 🗺️ START GOOGLE MAPS NAVIGATION TO PICKUP LOCATION
        try {
          if (cascadingRequest.pickup?.coordinates) {
            // Clear any existing navigation first
            clearNavigation();
            
            // Start navigation to pickup location after brief delay
            setTimeout(() => {
              navigateToDestination(
                cascadingRequest.pickup.coordinates,
                cascadingRequest.pickup.address || 'Pickup Location'
              );
              console.log('🧭 Navigation started to pickup:', cascadingRequest.pickup.address);
            }, 1000);
            
            // Set current trip status for tracking
            setCurrentTrip({
              id: cascadingRequest.id,
              pickup: cascadingRequest.pickup,
              destination: cascadingRequest.destination,
              fare: cascadingRequest.fare,
              status: 'accepted',
              rider: cascadingRequest.rider,
              startTime: new Date().toISOString()
            });
            
          } else {
            console.warn('⚠️ No pickup coordinates available for navigation');
          }
        } catch (navError) {
          console.error('❌ Error starting navigation:', navError);
          showNotification('⚠️ Navigation unavailable, proceed manually to pickup', 'warning');
        }
        
      } catch (error) {
        console.error('❌ Error accepting cascading ride:', error);
      }
    }
  };

  const rejectCascadingRide = () => {
    if (cascadingRequest && socketRef.current) {
      try {
        // Stop audio immediately
        stopCascadingAudio();
        
        // Send rejection to server
        socketRef.current.emit('reject-cascading-ride', {
          rideId: cascadingRequest.id,
          driverId: user?.id
        });

        // Clear cascading request and timeout
        setCascadingRequest(null);
        setCascadingTimeout(0);
        
        console.log('❌ Cascading ride rejected, notifying server');
        
      } catch (error) {
        console.error('❌ Error rejecting cascading ride:', error);
      }
    }
  };

  const updateTripStatus = (status: Trip['status']) => {
    if (currentTrip) {
      setCurrentTrip({ ...currentTrip, status });

      if (status === 'pickup') {
        if (rideRequest) {
          clearNavigation();
          setTimeout(() => {
            navigateToDestination(rideRequest.pickup.coordinates, rideRequest.pickup.address);
          }, 500);
        }
      } else if (status === 'enroute') {
        if (rideRequest) {
          clearNavigation();

          // Play safety reminder announcement when trip begins
          setTimeout(() => {
            announceSafetyReminder();
          }, 1000);

          setTimeout(() => {
            navigateToDestination(rideRequest.destination.coordinates, rideRequest.destination.address);
          }, 3000); // Increased delay to allow safety message to complete
        }
      } else if (status === 'completed') {
        clearNavigation();

        // Update earnings when trip is completed
        if (currentTrip) {
          const tripMiles = parseFloat(rideRequest?.distance?.replace(' miles', '') || '0');

          // Calculate current online time
          let currentOnlineHours = totalOnlineTime;
          if (onlineStartTime) {
            const sessionTime = (new Date().getTime() - onlineStartTime.getTime()) / (1000 * 60 * 60);
            currentOnlineHours = totalOnlineTime + sessionTime;
          }

          // DISABLED: Don't override API data with fake trip calculations
          // setEarnings(prevEarnings => ({
          //   ...prevEarnings,
          //   today: prevEarnings.today + currentTrip.fare,
          //   week: prevEarnings.week + currentTrip.fare,
          //   month: prevEarnings.month + currentTrip.fare,
          //   trips: prevEarnings.trips + 1,
          //   lastRide: currentTrip.fare,
          //   miles: prevEarnings.miles + tripMiles,
          //   hours: parseFloat(currentOnlineHours.toFixed(2))
          // }));
          console.log('🎯 Trip completed with fare:', currentTrip.fare, '(not overriding API data)');
        }

        // Clear rider marker when trip completes
        if (riderMarker) {
          riderMarker.setMap(null);
          setRiderMarker(null);
        }

        setTimeout(() => {
          setCurrentTrip(null);
          setDriverStatus('online');
          setShowStatsOverlay(true);
        }, 3000);
      }
    }
  };

  const getStatusColor = () => {
    switch (driverStatus) {
      case 'online': return '#10b981';
      case 'busy': return '#f59e0b';
      case 'offline': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getStatusText = () => {
    switch (driverStatus) {
      case 'online': return 'Online';
      case 'busy': return 'Busy';
      case 'offline': return 'Offline';
      default: return 'Offline';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const handleSettingChange = (key: string, value: boolean) => {
    setDriverSettings(prev => ({ ...prev, [key]: value }));
    if (key === 'voiceGuidance') {
      setVoiceEnabled(value); // Ensure state is consistent
    }
    console.log(`⚙️ Setting updated: ${key} = ${value}`);
  };

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '40px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: '400px'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h1 style={{
              fontSize: '28px',
              fontWeight: '800',
              color: '#1e293b',
              marginBottom: '8px'
            }}>
              🚗 Driver Login
            </h1>
            <p style={{
              color: '#64748b',
              fontSize: '16px'
            }}>
              Sign in to your driver account
            </p>
          </div>

          <form onSubmit={handleLogin}>
            {authError && (
              <div style={{
                backgroundColor: '#FEE2E2',
                border: '1px solid #FECACA',
                color: '#DC2626',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '14px',
                marginBottom: '20px'
              }}>
                {authError}
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Email Address
              </label>
              <input
                type="email"
                value={loginFormData.email}
                onChange={(e) => setLoginFormData(prev => ({ ...prev, email: e.target.value }))}
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #D1D5DB',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
                placeholder="driver@example.com"
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginFormData.password}
                  onChange={(e) => setLoginFormData(prev => ({ ...prev, password: e.target.value }))}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    paddingRight: '40px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  👁️
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                backgroundColor: isLoading ? '#9CA3AF' : '#4F46E5',
                color: 'white',
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              {isLoading ? '🔄 Signing in...' : '🚗 Sign in as Driver'}
            </button>

          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '450px',
      margin: '0 auto',
      height: '100vh',
      backgroundColor: '#f8fafc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Floating Pi Overlay - Appears when app is minimized */}
      {isAppMinimized && (
        <div
          style={{
            position: 'fixed',
            left: `${piOverlayPosition.x}px`,
            top: `${piOverlayPosition.y}px`,
            width: '60px',
            height: '60px',
            backgroundColor: '#1f2937',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            cursor: isDragging ? 'grabbing' : 'grab',
            zIndex: 9999,
            border: '3px solid #3b82f6',
            color: 'white',
            fontSize: '20px',
            fontWeight: 'bold',
            fontFamily: 'serif',
            userSelect: 'none',
            transition: isDragging ? 'none' : 'all 0.3s ease'
          }}
          onMouseDown={(e) => {
            setIsDragging(true);
            const startX = e.clientX - piOverlayPosition.x;
            const startY = e.clientY - piOverlayPosition.y;

            const handleMouseMove = (e: MouseEvent) => {
              setPiOverlayPosition({
                x: Math.max(0, Math.min(window.innerWidth - 60, e.clientX - startX)),
                y: Math.max(0, Math.min(window.innerHeight - 60, e.clientY - startY))
              });
            };

            const handleMouseUp = () => {
              setIsDragging(false);
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
          onTouchStart={(e) => {
            setIsDragging(true);
            const touch = e.touches[0];
            const startX = touch.clientX - piOverlayPosition.x;
            const startY = touch.clientY - piOverlayPosition.y;

            const handleTouchMove = (e: TouchEvent) => {
              const touch = e.touches[0];
              setPiOverlayPosition({
                x: Math.max(0, Math.min(window.innerWidth - 60, touch.clientX - startX)),
                y: Math.max(0, Math.min(window.innerHeight - 60, touch.clientY - startY))
              });
            };

            const handleTouchEnd = () => {
              setIsDragging(false);
              document.removeEventListener('touchmove', handleTouchMove);
              document.removeEventListener('touchend', handleTouchEnd);
            };

            document.addEventListener('touchmove', handleTouchMove);
            document.addEventListener('touchend', handleTouchEnd);
          }}
          onClick={() => {
            if (!isDragging) {
              setIsAppMinimized(false);
              window.focus();
              console.log('📱 Pi overlay clicked - returning to navigation');
            }
          }}
        >
          π
        </div>
      )}

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        color: 'white',
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: '56px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: getStatusColor()
          }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              fontSize: '18px',
              fontWeight: '800',
              color: 'white',
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ fontSize: '48px' }}>π</span>
              <span style={{ color: '#60a5fa' }}>Driver</span>
            </div>
            <div style={{ fontSize: '11px', opacity: 0.8 }}>{getStatusText()}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setShowDocumentUpload(true)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '6px',
              padding: '6px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              textDecoration: 'none'
            }}
          >
            <FileText size={18} />
          </button>
          <button
            onClick={() => setShowEarnings(true)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '6px',
              padding: '6px',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            <BarChart3 size={18} />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '6px',
              padding: '6px',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            <Settings size={18} />
          </button>
          
          <button
            onClick={handleLogout}
            style={{
              background: 'rgba(220, 38, 38, 0.2)',
              border: 'none',
              borderRadius: '6px',
              padding: '6px',
              color: '#fca5a5',
              cursor: 'pointer'
            }}
            title="Logout"
          >
            <Power size={18} />
          </button>
        </div>
      </div>

      {/* Enhanced Turn-by-Turn Navigation Banner */}
      {currentTrip && isNavigating && (
        <div style={{
          background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)',
          color: 'white',
          padding: '18px 16px',
          zIndex: 1000,
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.2)',
          borderBottom: '3px solid #1d4ed8'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
            <div style={{
              fontSize: '32px',
              width: '50px',
              height: '50px',
              background: 'rgba(255, 255, 255, 0.25)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              border: '2px solid rgba(255, 255, 255, 0.3)'
            }}>
              {turnIcon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '4px', fontWeight: '500' }}>
                {distanceToNextTurn ? `In ${distanceToNextTurn}` : 'Now'}
              </div>
              <div style={{ fontSize: '18px', fontWeight: '700', lineHeight: '1.3', marginBottom: '2px' }}>
                {currentInstruction || nextTurn || 'Continue straight'}
              </div>
              {upcomingTurnRoad && (
                <div style={{
                  display: 'inline-block',
                  backgroundColor: '#000000',
                  color: '#ffffff',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  marginTop: '4px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                }}>
                  📍 Turn onto {upcomingTurnRoad}
                </div>
              )}
              {upcomingTurn && upcomingDistance && (
                <div style={{ fontSize: '12px', opacity: 0.8, fontStyle: 'italic' }}>
                  Then in {upcomingDistance}: {upcomingTurn.substring(0, 40)}...
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '22px', fontWeight: '800', marginBottom: '2px' }}>
                {routeDuration}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>
                {routeDistance}
              </div>
            </div>
          </div>

          <div style={{
            width: '100%',
            height: '6px',
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
            borderRadius: '3px',
            overflow: 'hidden',
            marginBottom: '10px'
          }}>
            <div style={{
              width: `${Math.min(100, ((currentStepIndex + 1) / Math.max(1, totalSteps)) * 100)}%`,
              height: '100%',
              backgroundColor: '#10b981',
              borderRadius: '3px',
              transition: 'width 0.5s ease',
              boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)'
            }} />
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '13px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                padding: '4px 8px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: '600'
              }}>
                {currentTrip.status === 'accepted' ? '📍 TO PICKUP' :
                 currentTrip.status === 'pickup' ? '🚗 PICKUP RIDER' :
                 '🎯 TO DESTINATION'}
              </div>
              <div style={{ opacity: 0.9 }}>
                Step {currentStepIndex + 1} of {totalSteps}
              </div>
              <button
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                style={{
                  background: voiceEnabled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.2)',
                  border: voiceEnabled ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '6px',
                  padding: '4px 6px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px'
                }}
              >
                {voiceEnabled ? '🔊' : '🔇'}
              </button>
            </div>
            <div style={{
              fontWeight: '700',
              fontSize: '16px',
              color: '#fbbf24'
            }}>
              {formatCurrency(currentTrip.fare)}
            </div>
          </div>
        </div>
      )}

      {/* Map Container */}
      <div style={{
        flex: 1,
        position: 'relative',
        minHeight: 0
      }}>
        <div
          ref={mapRef}
          style={{
            width: '100%',
            height: '100%',
            minHeight: '400px',
            backgroundColor: '#f3f4f6'
          }}
        />

        {/* Surge Heatmap Overlay for Drivers */}
        {showHeatmap && map && (
          <SurgeHeatmapOverlay
            map={map}
            surgeZones={heatmapZones}
            showLabels={true}
            onZoneClick={(zone) => {
              console.log('🗺️ Driver clicked surge zone:', zone);
              showNotification(
                `🎯 High-Demand Zone: ${zone.surgeMultiplier}x surge pricing`,
                `Drive to this area for more ride requests!`,
                'info'
              );
            }}
          />
        )}

        {/* Stats Overlay */}
        {showStatsOverlay && !currentTrip && (
          <div style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            right: '16px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 1000
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 16px',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                Today's Performance
              </div>
              <button
                onClick={() => setShowStatsOverlay(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <ChevronUp size={16} color="#6b7280" />
              </button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
              gap: '8px',
              padding: '12px 16px',
              textAlign: 'center'
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#10b981' }} data-testid="today-earnings">
                  {earningsLoading ? 'Loading...' : formatCurrency(earnings.today || 0)}
                </div>
                <div style={{ fontSize: '9px', color: '#6b7280' }}>Today</div>
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#3b82f6' }}>
                  {earnings.trips}
                </div>
                <div style={{ fontSize: '9px', color: '#6b7280' }}>Trips</div>
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#f59e0b' }}>
                  {earnings.hours}h
                </div>
                <div style={{ fontSize: '9px', color: '#6b7280' }}>Online</div>
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#ef4444' }}>
                  {earnings.miles}
                </div>
                <div style={{ fontSize: '9px', color: '#6b7280' }}>Miles</div>
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#8b5cf6' }}>
                  {formatCurrency(earnings.lastRide)}
                </div>
                <div style={{ fontSize: '9px', color: '#6b7280' }}>Last Ride</div>
              </div>
            </div>
          </div>
        )}

        {/* Show Stats Button when collapsed */}
        {!showStatsOverlay && !currentTrip && (
          <div style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            right: '16px',
            zIndex: 1000
          }}>
            <button
              onClick={() => setShowStatsOverlay(true)}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 16px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                {earningsLoading ? 'Loading...' : `${formatCurrency(earnings.today || 0)} • ${earnings.trips || 0} trips • ${earnings.miles || 0} mi`}
              </span>
              <ChevronDown size={16} color="#6b7280" />
            </button>
          </div>
        )}

        {/* Location Controls */}
        <div style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 1000
        }}>
          {/* Surge Heatmap Toggle */}
          <button
            onClick={() => {
              setShowHeatmap(!showHeatmap);
              if (!showHeatmap) {
                fetchHeatmapData(); // Refresh data when enabling
              }
            }}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: showHeatmap ? '#ef4444' : 'white',
              border: `2px solid ${showHeatmap ? '#ef4444' : '#e5e7eb'}`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              transition: 'all 0.2s ease'
            }}
            title={showHeatmap ? 'Hide Surge Zones' : 'Show High-Demand Zones'}
          >
            {showHeatmap ? '🎯' : '📊'}
          </button>

          <button
            onClick={() => {
              if (currentLocation && map) {
                map.setCenter(currentLocation);
                map.setZoom(currentTrip ? 18 : 16);
              }
            }}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'white',
              border: '2px solid #e5e7eb',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
            }}
          >
            <Navigation size={18} color="#3b82f6" />
          </button>

          <button
            onClick={() => {
              const userInput = prompt(
                '🚗 GPS not accurate for driving?\n\nEnter your current city and state:\n(e.g., "Seattle, WA" or "Dallas, TX")'
              );
              
              if (userInput) {
                // Use Google Places to find the location
                const service = new window.google.maps.places.PlacesService(map);
                const request = {
                  query: userInput,
                  fields: ['geometry', 'formatted_address']
                };
                
                service.textSearch(request, (results: any[], status: any) => {
                  if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                    const place = results[0];
                    const newLocation = {
                      lat: place.geometry.location.lat(),
                      lng: place.geometry.location.lng()
                    };
                    
                    console.log('🚗 Driver location manually calibrated to:', newLocation);
                    setCurrentLocation(newLocation);
                    
                    // Update map
                    if (map) {
                      map.setCenter(newLocation);
                      map.setZoom(13);
                    }
                    
                    // Show success notification
                    showNotification(`✅ Driver location updated: ${place.formatted_address}`, 'success');
                  } else {
                    showNotification('❌ Could not find that location. Please try again.', 'error');
                  }
                });
              }
            }}
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: '#10b981',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              color: 'white'
            }}
            title="Fix GPS Location"
          >
            📍
          </button>

          {currentTrip && (
            <button
              onClick={() => {
                if (currentTrip.status === 'accepted' && rideRequest) {
                  navigateToDestination(rideRequest.pickup.coordinates, rideRequest.pickup.address);
                } else if (currentTrip.status === 'pickup' && rideRequest) {
                  navigateToDestination(rideRequest.destination.coordinates, rideRequest.destination.address);
                }
              }}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: '#3b82f6',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                color: 'white'
              }}
            >
              <Route size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Bottom Status Panel */}
      <div style={{
        background: 'white',
        padding: '16px',
        borderTop: '1px solid #e5e7eb',
        boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}>
        <button
          onClick={toggleDriverStatus}
          disabled={driverStatus === 'busy'}
          style={{
            width: '100%',
            height: '60px',
            borderRadius: '12px',
            border: 'none',
            background: driverStatus === 'offline'
              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
              : driverStatus === 'online'
              ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
              : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: 'white',
            fontSize: '18px',
            fontWeight: '700',
            cursor: driverStatus === 'busy' ? 'not-allowed' : 'pointer',
            opacity: driverStatus === 'busy' ? 0.7 : 1,
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '12px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}
        >
          <Power size={24} />
          <span>
            {driverStatus === 'offline' ? '🟢 GO ONLINE' :
             driverStatus === 'online' ? '🔴 GO OFFLINE' :
             '🟡 ON TRIP'}
          </span>
        </button>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            backgroundColor: '#f8fafc',
            borderRadius: '8px'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: getStatusColor()
            }} />
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
              {getStatusText()}
            </span>
            {driverStatus === 'online' && (
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                • Ready for rides
              </span>
            )}
            {driverStatus === 'busy' && (
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                • In progress
              </span>
            )}
          </div>

          <div style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              backgroundColor: batteryLevel > 20 ? '#f0fdf4' : '#fef2f2',
              borderRadius: '6px'
            }}>
              <Battery size={16} color={batteryLevel > 20 ? '#10b981' : '#ef4444'} />
              <span style={{
                fontSize: '12px',
                fontWeight: '600',
                color: batteryLevel > 20 ? '#10b981' : '#ef4444'
              }}>
                {batteryLevel}%
              </span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              backgroundColor: fuelLevel > 25 ? '#f0fdf4' : '#fefbf2',
              borderRadius: '6px'
            }}>
              <Fuel size={16} color={fuelLevel > 25 ? '#10b981' : '#f59e0b'} />
              <span style={{
                fontSize: '12px',
                fontWeight: '600',
                color: fuelLevel > 25 ? '#10b981' : '#f59e0b'
              }}>
                {fuelLevel}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Ride Request Modal - DISABLED FOR CASCADING TESTING */}
      {false && rideRequest && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            padding: '24px',
            width: '100%',
            maxWidth: '400px'
          }}>
            <div style={{
              width: '100%',
              height: '4px',
              backgroundColor: '#e5e7eb',
              borderRadius: '2px',
              marginBottom: '20px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${(requestTimeout / 30) * 100}%`,
                height: '100%',
                backgroundColor: requestTimeout <= 10 ? '#ef4444' : '#f59e0b',
                transition: 'width 1s linear'
              }} />
            </div>

            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#1f2937' }}>
                New Ride Request
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>
                {requestTimeout} seconds to accept
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px',
              backgroundColor: '#f8fafc',
              borderRadius: '12px',
              marginBottom: '16px'
            }}>
              <div style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                backgroundColor: '#e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px'
              }}>
                👤
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', color: '#1f2937' }}>
                  {rideRequest.rider.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Star size={14} fill="#fbbf24" color="#fbbf24" />
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>
                    {rideRequest.rider.rating}
                  </span>
                </div>
              </div>
              <button style={{
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '8px',
                cursor: 'pointer'
              }}>
                <Phone size={16} />
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                marginBottom: '12px'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  marginTop: '6px'
                }} />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                    Pickup
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    {rideRequest.pickup.address}
                  </div>
                </div>
              </div>
              <div style={{
                width: '2px',
                height: '20px',
                backgroundColor: '#e5e7eb',
                marginLeft: '3px',
                marginBottom: '12px'
              }} />
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#ef4444',
                  marginTop: '6px'
                }} />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                    Destination
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    {rideRequest.destination.address}
                  </div>
                </div>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '12px',
              marginBottom: '20px',
              padding: '16px',
              backgroundColor: '#f8fafc',
              borderRadius: '12px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#10b981' }}>
                  {formatCurrency(rideRequest.fare)}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Fare</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#3b82f6' }}>
                  {rideRequest.distance}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Distance</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#f59e0b' }}>
                  {rideRequest.duration}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Duration</div>
              </div>
            </div>

            {/* Rider Preferences */}
            {rideRequest.riderPreferences && (
              <div style={{
                marginBottom: '20px',
                padding: '16px',
                backgroundColor: '#f0f9ff',
                borderRadius: '12px',
                border: '2px solid #e0f2fe'
              }}>
                <h4 style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: '#0c4a6e',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  👤 Rider Preferences
                </h4>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '12px'
                }}>
                  {/* Music Preference */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', marginBottom: '4px' }}>
                      {rideRequest.riderPreferences.music ? '🎵' : '🔇'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#0c4a6e', fontWeight: '600' }}>
                      Music {rideRequest.riderPreferences.music ? 'OK' : 'No Music'}
                    </div>
                  </div>
                  
                  {/* Conversation Preference */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', marginBottom: '4px' }}>
                      {rideRequest.riderPreferences.conversation ? '💬' : '🤫'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#0c4a6e', fontWeight: '600' }}>
                      {rideRequest.riderPreferences.conversation ? 'Chatty' : 'Quiet'}
                    </div>
                  </div>
                  
                  {/* Temperature Preference */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', marginBottom: '4px' }}>
                      {rideRequest.riderPreferences.temperature === 'cool' ? '❄️' : 
                       rideRequest.riderPreferences.temperature === 'warm' ? '🔥' : '🌡️'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#0c4a6e', fontWeight: '600' }}>
                      {rideRequest.riderPreferences.temperature === 'cool' ? 'Keep Cool' :
                       rideRequest.riderPreferences.temperature === 'warm' ? 'Keep Warm' : 'Any Temp'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={declineRide}
                style={{
                  flex: 1,
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Decline
              </button>
              <button
                onClick={acceptRide}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cascading Ride Request Popup (7-second countdown with audio) */}
      {cascadingRequest && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(139, 69, 19, 0.8)', // Warm brown overlay to distinguish from regular popup
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 1100 // Higher than regular popup
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            borderRadius: '24px',
            padding: '28px',
            width: '100%',
            maxWidth: '420px',
            border: '3px solid #f59e0b',
            boxShadow: '0 25px 50px rgba(0,0,0,0.3)'
          }}>
            {/* Cascading Progress Bar (7-second countdown) */}
            <div style={{
              width: '100%',
              height: '6px',
              backgroundColor: '#fef3c7',
              borderRadius: '3px',
              marginBottom: '24px',
              overflow: 'hidden',
              border: '1px solid #f59e0b'
            }}>
              <div style={{
                width: `${(cascadingTimeout / 7) * 100}%`,
                height: '100%',
                backgroundColor: cascadingTimeout <= 3 ? '#ef4444' : '#f59e0b',
                transition: 'width 1s linear, background-color 0.3s ease',
                boxShadow: '0 0 8px rgba(245, 158, 11, 0.6)'
              }} />
            </div>

            {/* Header with cascading indicator */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ 
                fontSize: '26px', 
                fontWeight: '800', 
                color: '#92400e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}>
                🎯 Priority Ride Request
              </div>
              <div style={{ 
                fontSize: '15px', 
                color: '#f59e0b', 
                fontWeight: '600',
                marginTop: '4px'
              }}>
                {cascadingTimeout} seconds to respond • {isAudioPlaying ? '🔔 Chiming' : '🔇'}
              </div>
              <div style={{ 
                fontSize: '12px', 
                color: '#6b7280', 
                marginTop: '4px',
                fontStyle: 'italic'
              }}>
                Attempt #{cascadingRequest.cascadeInfo?.attempt || 1} of {cascadingRequest.cascadeInfo?.totalDrivers || 1}
              </div>
            </div>

            {/* Ride Details */}
            <div style={{
              padding: '20px',
              backgroundColor: '#fffbeb',
              borderRadius: '16px',
              marginBottom: '20px',
              border: '2px solid #fbbf24'
            }}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ 
                  fontSize: '14px', 
                  color: '#92400e', 
                  fontWeight: '700',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  📍 Pickup
                </div>
                <div style={{ 
                  fontSize: '16px', 
                  color: '#1f2937', 
                  fontWeight: '600',
                  lineHeight: '1.4'
                }}>
                  {cascadingRequest.pickup?.address || 'Pickup location'}
                </div>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <div style={{ 
                  fontSize: '14px', 
                  color: '#92400e', 
                  fontWeight: '700',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  🎯 Destination
                </div>
                <div style={{ 
                  fontSize: '16px', 
                  color: '#1f2937', 
                  fontWeight: '600',
                  lineHeight: '1.4'
                }}>
                  {cascadingRequest.destination?.address || 'Destination'}
                </div>
              </div>

              {/* Trip Stats */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '16px',
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid #f59e0b'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#059669' }}>
                    ${typeof cascadingRequest.fare === 'number' ? cascadingRequest.fare.toFixed(2) : (cascadingRequest.fare || '12.50')}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Fare</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#3b82f6' }}>
                    {cascadingRequest.distance || '2.3 mi'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Distance</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#f59e0b' }}>
                    {cascadingRequest.duration || '8 min'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Duration</div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '16px' }}>
              <button
                onClick={rejectCascadingRide}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                  color: '#374151',
                  border: '2px solid #d1d5db',
                  borderRadius: '16px',
                  padding: '18px',
                  fontSize: '17px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                ❌ Reject
              </button>
              <button
                onClick={acceptCascadingRide}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: 'white',
                  border: '2px solid #f59e0b',
                  borderRadius: '16px',
                  padding: '18px',
                  fontSize: '17px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 8px 20px rgba(245, 158, 11, 0.3)',
                  transition: 'all 0.2s ease'
                }}
              >
                ✅ Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Interface */}
      {showChat && currentTrip && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: 'white',
            flex: 1,
            margin: '20px',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Chat Header */}
            <div style={{
              padding: '16px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: '600'
                }}>
                  {currentTrip.rider.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '16px' }}>
                    {currentTrip.rider.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    💬 Live Chat
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowChat(false)}
                style={{
                  background: '#f3f4f6',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                ×
              </button>
            </div>

            {/* Chat Messages */}
            <div style={{
              flex: 1,
              padding: '16px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {messages.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  color: '#6b7280',
                  padding: '20px',
                  fontStyle: 'italic'
                }}>
                  💬 Start a conversation with your rider
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: msg.senderType === 'driver' ? 'flex-end' : 'flex-start',
                      maxWidth: '80%'
                    }}
                  >
                    <div style={{
                      padding: '12px 16px',
                      borderRadius: '18px',
                      backgroundColor: msg.senderType === 'driver' ? '#3b82f6' : '#f3f4f6',
                      color: msg.senderType === 'driver' ? 'white' : '#1f2937',
                      fontSize: '14px',
                      lineHeight: '1.4'
                    }}>
                      {msg.message}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: '#9ca3af',
                      margin: '4px 8px',
                      textAlign: msg.senderType === 'driver' ? 'right' : 'left'
                    }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {msg.senderType === 'driver' && (
                        <span style={{ marginLeft: '4px' }}>
                          {msg.delivered ? '✓' : '⏰'}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Chat Input */}
            <div style={{
              padding: '16px',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              gap: '12px',
              alignItems: 'center'
            }}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '24px',
                  fontSize: '14px',
                  outline: 'none'
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    sendMessage(newMessage);
                  }
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
              <button
                onClick={() => sendMessage(newMessage)}
                disabled={!newMessage.trim()}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: newMessage.trim() ? '#3b82f6' : '#e5e7eb',
                  color: 'white',
                  cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px'
                }}
              >
                ➤
              </button>
            </div>

            {/* Quick Responses */}
            <div style={{
              padding: '12px 16px',
              borderTop: '1px solid #f3f4f6',
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap'
            }}>
              {[
                "I'm on my way!",
                "I'll be there in 5 minutes",
                "I'm here",
                "Running a bit late",
                "Safe travels!"
              ].map((quickMsg) => (
                <button
                  key={quickMsg}
                  onClick={() => sendMessage(quickMsg)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#f3f4f6',
                    border: '1px solid #e5e7eb',
                    borderRadius: '16px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    color: '#374151'
                  }}
                >
                  {quickMsg}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Current Trip Modal - DISABLED FOR CASCADING TESTING */}
      {false && currentTrip && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'white',
          borderRadius: '20px 20px 0 0',
          padding: '20px',
          boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
          maxHeight: '40vh',
          overflow: 'auto'
        }}>
          <div style={{
            width: '40px',
            height: '4px',
            backgroundColor: '#e5e7eb',
            borderRadius: '2px',
            margin: '0 auto 16px'
          }} />

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '16px',
              backgroundColor: currentTrip.status === 'accepted' ? '#dbeafe' : '#f3f4f6',
              color: currentTrip.status === 'accepted' ? '#1d4ed8' : '#6b7280'
            }}>
              <CheckCircle size={14} />
              <span style={{ fontSize: '12px', fontWeight: '600' }}>Accepted</span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '16px',
              backgroundColor: currentTrip.status === 'pickup' ? '#dbeafe' : '#f3f4f6',
              color: currentTrip.status === 'pickup' ? '#1d4ed8' : '#6b7280'
            }}>
              <Navigation size={14} />
              <span style={{ fontSize: '12px', fontWeight: '600' }}>Pickup</span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '16px',
              backgroundColor: currentTrip.status === 'enroute' ? '#dbeafe' : '#f3f4f6',
              color: currentTrip.status === 'enroute' ? '#1d4ed8' : '#6b7280'
            }}>
              <Route size={14} />
              <span style={{ fontSize: '12px', fontWeight: '600' }}>En Route</span>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px'
              }}>
                👤
              </div>
              <div>
                <div style={{ fontWeight: '600', color: '#1f2937', fontSize: '14px' }}>
                  {currentTrip.rider.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Star size={12} fill="#fbbf24" color="#fbbf24" />
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                    {currentTrip.rider.rating}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => {
                  if (currentTrip?.rider?.phone) {
                    window.open(`tel:${currentTrip.rider.phone}`, '_self');
                  }
                }}
                style={{
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px',
                  cursor: 'pointer',
                  position: 'relative'
                }}
                title="Call Rider"
              >
                <Phone size={16} />
              </button>
              <button 
                onClick={() => setShowChat(true)}
                style={{
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px',
                  cursor: 'pointer',
                  position: 'relative'
                }}
                title="Chat with Rider"
              >
                <MessageCircle size={16} />
                {messages.filter(m => m.senderType === 'rider' && !m.read).length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    width: '12px',
                    height: '12px',
                    backgroundColor: '#ef4444',
                    borderRadius: '50%',
                    fontSize: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: '600'
                  }}>
                    !
                  </div>
                )}
              </button>
              <button 
                onClick={() => {
                  if (confirm('🚨 Are you sure you want to send an emergency alert?')) {
                    // Send emergency alert
                    if (socketRef.current) {
                      socketRef.current.emit('emergency-alert', {
                        userId: user?.id || 'emergency-user',
                        userType: 'driver',
                        location: currentLocation,
                        message: 'Emergency assistance needed',
                        rideId: currentTrip?.id
                      });
                    }

                    sendPushNotification(
                      '🚨 Emergency Alert Sent',
                      'Emergency services and nearby drivers have been notified',
                      { 
                        requireInteraction: true,
                        tag: 'emergency'
                      }
                    );
                  }
                }}
                style={{
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px',
                  cursor: 'pointer'
                }}
                title="Emergency Alert"
              >
                🚨
              </button>
            </div>
          </div>

          {currentTrip.status === 'accepted' && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => updateTripStatus('pickup')}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Navigation size={16} />
                Navigate to Pickup
              </button>
            </div>
          )}

          {currentTrip.status === 'pickup' && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  if (rideRequest) {
                    navigateToDestination(rideRequest.pickup.coordinates, rideRequest.pickup.address);
                  }
                }}
                style={{
                  flex: '0 0 auto',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Route size={14} />
                Navigate
              </button>
              <button
                onClick={() => updateTripStatus('enroute')}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Picked Up - Start Trip
              </button>
            </div>
          )}

          {currentTrip.status === 'enroute' && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  if (rideRequest) {
                    navigateToDestination(rideRequest.destination.coordinates, rideRequest.destination.address);
                  }
                }}
                style={{
                  flex: '0 0 auto',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Route size={14} />
                Navigate
              </button>
              <button
                onClick={() => updateTripStatus('completed')}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Complete Trip - {formatCurrency(currentTrip.fare)}
              </button>
            </div>
          )}

          {currentTrip.status === 'completed' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <CheckCircle size={48} color="#10b981" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#1f2937' }}>
                Trip Completed!
              </div>
              <div style={{ fontSize: '16px', color: '#10b981', fontWeight: '600' }}>
                {formatCurrency(currentTrip.fare)} earned
              </div>
            </div>
          )}
        </div>
      )}

      {/* Earnings Modal */}
      {showEarnings && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            padding: '24px',
            width: '100%',
            maxWidth: '400px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#1f2937', margin: 0 }}>
                Earnings Summary
              </h3>
              <button
                onClick={() => setShowEarnings(false)}
                style={{
                  background: '#f3f4f6',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  fontSize: '18px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#6b7280'
                }}
              >
                ×
              </button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '16px'
            }}>
              <div style={{
                padding: '20px',
                backgroundColor: '#f0f9ff',
                borderRadius: '12px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '32px', fontWeight: '700', color: '#0284c7' }} data-testid="stats-overlay-today">
                  {earningsLoading ? 'Loading...' : formatCurrency(earnings.today || 0)}
                </div>
                <div style={{ color: '#6b7280' }}>Today's Earnings</div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px'
              }}>
                <div style={{
                  padding: '16px',
                  backgroundColor: '#f0fdf4',
                  borderRadius: '12px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#16a34a' }}>
                    {formatCurrency(earnings.week)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>This Week</div>
                </div>
                <div style={{
                  padding: '16px',
                  backgroundColor: '#fef3c7',
                  borderRadius: '12px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#d97706' }}>
                    {formatCurrency(earnings.month)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>This Month</div>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 1fr',
                gap: '12px'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#1f2937' }}>
                    {earnings.trips}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>Trips</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#1f2937' }}>
                    {earnings.hours}h
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>Online</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#1f2937' }}>
                    {earnings.rating}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>Rating</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#1f2937' }}>
                    {formatCurrency(earnings.lastRide)}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>Last Ride</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            padding: '24px',
            width: '100%',
            maxWidth: '400px',
            maxHeight: '85vh',
            overflow: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#1f2937', margin: 0 }}>
                Settings
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Voice Guidance Settings */}
              <div style={{
                padding: '20px',
                backgroundColor: '#f0f9ff',
                borderRadius: '12px',
                border: '2px solid #e0f2fe'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '12px' 
                }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: '#1f2937', marginBottom: '4px' }}>
                      🔊 Voice Guidance
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      Turn-by-turn navigation announcements
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={driverSettings.voiceGuidance}
                    onChange={(checked) => handleSettingChange('voiceGuidance', checked)}
                  />
                </div>
                <div style={{ 
                  fontSize: '14px', 
                  color: driverSettings.voiceGuidance ? '#059669' : '#6b7280',
                  fontWeight: '600'
                }}>
                  {driverSettings.voiceGuidance ? '✅ Voice guidance is ON' : '❌ Voice guidance is OFF'}
                </div>
              </div>

              {/* Accept Cash Payments */}
              <div style={{
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center' 
                }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>
                      💵 Accept Cash
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      Accept cash payments from riders
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={driverSettings.acceptCash}
                    onChange={(checked) => handleSettingChange('acceptCash', checked)}
                  />
                </div>
              </div>

              {/* Accept Long Trips */}
              <div style={{
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center' 
                }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>
                      🛣️ Long Trips
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      Accept rides over 45 minutes
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={driverSettings.acceptLongTrips}
                    onChange={(checked) => handleSettingChange('acceptLongTrips', checked)}
                  />
                </div>
              </div>

              {/* Accept Pool Rides */}
              <div style={{
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center' 
                }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>
                      👥 Pool Rides
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      Accept shared rides with multiple passengers
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={driverSettings.acceptPoolRides}
                    onChange={(checked) => handleSettingChange('acceptPoolRides', checked)}
                  />
                </div>
              </div>

              {/* Auto Accept Rides */}
              <div style={{
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center' 
                }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>
                      ⚡ Auto Accept
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      Automatically accept ride requests
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={driverSettings.autoAccept}
                    onChange={(checked) => handleSettingChange('autoAccept', checked)}
                  />
                </div>
              </div>

              {/* Accept Pets */}
              <div style={{
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center' 
                }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>
                      🐕 Accept Pets
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      Allow riders to bring pets on rides
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={driverSettings.acceptPets}
                    onChange={(checked) => handleSettingChange('acceptPets', checked)}
                  />
                </div>
              </div>

              {/* Accept Teens */}
              <div style={{
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center' 
                }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>
                      👦 Accept Teens
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      Allow unaccompanied minors (13-17) to book rides
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={driverSettings.acceptTeens}
                    onChange={(checked) => handleSettingChange('acceptTeens', checked)}
                  />
                </div>
              </div>

              {/* Vehicle Customization */}
              <div style={{
                padding: '20px',
                backgroundColor: '#f0f9ff',
                borderRadius: '12px',
                border: '2px solid #e0f2fe'
              }}>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#1f2937', marginBottom: '16px' }}>
                  🚗 Vehicle Appearance
                </div>

                {/* Vehicle Color */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
                    Vehicle Color
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {[
                      { color: '#3b82f6', name: 'Blue' },
                      { color: '#ef4444', name: 'Red' },
                      { color: '#10b981', name: 'Green' },
                      { color: '#f59e0b', name: 'Yellow' },
                      { color: '#6b7280', name: 'Gray' },
                      { color: '#8b5cf6', name: 'Purple' },
                      { color: '#000000', name: 'Black' },
                      { color: '#ffffff', name: 'White' }
                    ].map((colorOption) => (
                      <button
                        key={colorOption.color}
                        onClick={() => setDriverSettings(prev => ({ ...prev, vehicleColor: colorOption.color }))}
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '8px',
                          backgroundColor: colorOption.color,
                          border: driverSettings.vehicleColor === colorOption.color 
                            ? '3px solid #1d4ed8' 
                            : colorOption.color === '#ffffff' 
                              ? '2px solid #e5e7eb' 
                              : '2px solid transparent',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'all 0.2s'
                        }}
                        title={colorOption.name}
                      >
                        {driverSettings.vehicleColor === colorOption.color && (
                          <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            color: colorOption.color === '#ffffff' || colorOption.color === '#f59e0b' ? '#000' : '#fff',
                            fontSize: '16px',
                            fontWeight: 'bold'
                          }}>
                            ✓
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Vehicle Type */}
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', marginBottom: '8px' }}>
                    Vehicle Type
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {[
                      { type: 'compact', name: 'Compact' },
                      { type: 'sedan', name: 'Sedan' },
                      { type: 'suv', name: 'SUV' },
                      { type: 'luxury', name: 'Luxury' }
                    ].map((vehicleOption) => (
                      <button
                        key={vehicleOption.type}
                        onClick={() => setDriverSettings(prev => ({ ...prev, vehicleType: vehicleOption.type as any }))}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '20px',
                          border: '2px solid',
                          borderColor: driverSettings.vehicleType === vehicleOption.type ? '#1d4ed8' : '#e5e7eb',
                          backgroundColor: driverSettings.vehicleType === vehicleOption.type ? '#dbeafe' : 'white',
                          color: driverSettings.vehicleType === vehicleOption.type ? '#1d4ed8' : '#6b7280',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {vehicleOption.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div style={{ 
                  marginTop: '16px', 
                  padding: '12px', 
                  backgroundColor: 'white', 
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                    Map Preview
                  </div>
                  <TopDownCar 
                    color={driverSettings.vehicleColor} 
                    type={driverSettings.vehicleType}
                    size={50} 
                    isDriver={true}
                  />
                </div>
              </div>

              {/* Notifications */}
              <div style={{
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center' 
                }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>
                      🔔 Notifications
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      Push notifications and alerts
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={driverSettings.notifications}
                    onChange={(checked) => handleSettingChange('notifications', checked)}
                  />
                </div>
              </div>

              {/* Additional Settings */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <span style={{ fontWeight: '600', color: '#1f2937' }}>🚗 Vehicle Info</span>
                <CarFront size={20} color="#6b7280" />
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <span style={{ fontWeight: '600', color: '#1f2937' }}>🛡️ Insurance</span>
                <Shield size={20} color="#6b7280" />
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Corporate Discount Verification Modal */}
      <DriverVerificationModal
        isOpen={showVerificationModal}
        riderInfo={verificationRiderInfo}
        onConfirm={handleVerificationConfirm}
        onCancel={handleVerificationCancel}
      />

      {/* Document Upload Modal */}
      {showDocumentUpload && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1200,
            overflow: 'hidden' // Prevent background scrolling
          }}
          onClick={(e) => {
            // Close modal when clicking overlay
            if (e.target === e.currentTarget) {
              setShowDocumentUpload(false);
            }
          }}
        >
          <div style={{
            position: 'relative',
            backgroundColor: 'white',
            borderRadius: '16px',
            width: '90vw',
            maxWidth: '600px',
            maxHeight: '85vh',
            overflowY: 'auto',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            transform: 'scale(1)',
            transition: 'transform 0.2s ease'
          }}>
            {/* Close Button */}
            <button
              onClick={() => setShowDocumentUpload(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(0,0,0,0.1)',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '20px',
                color: '#666',
                zIndex: 1,
                transition: 'background 0.2s ease'
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.background = 'rgba(0,0,0,0.2)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.background = 'rgba(0,0,0,0.1)';
              }}
            >
              ×
            </button>
            
            {/* Document Upload Component */}
            <div style={{ padding: '10px' }}>
              <DriverDocumentUpload />
            </div>
          </div>
        </div>
      )}
      
      {/* AI Customer Support Chatbot for Drivers */}
      <ChatBot 
        userType="driver" 
        userId={user?.id?.toString()} 
        className="driver-chatbot"
        isMinimized={isPiAssistantMinimized}
        onToggleMinimize={() => setIsPiAssistantMinimized(!isPiAssistantMinimized)}
      />
    </div>
  );
};

export default DriverApp;