import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Clock, Phone, MessageCircle, Star, User, CreditCard, Menu, Search, Mic, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import RideRequestPrompt from '../components/RideRequestPrompt';
import { apiUrl } from '../config/api.config';

// Car images from public directory
const economyCarImg = '/cars/economy.png';
const standardCarImg = '/cars/standard.png';
const xlCarImg = '/cars/xl.png';
const premiumCarImg = '/cars/premium.png';

declare global {
  interface Window {
    google: any;
    initMap: () => void;
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    ApplePaySession?: {
      new(version: number, paymentRequest: any): any;
      canMakePayments(): boolean;
      canMakePaymentsWithActiveCard(merchantIdentifier: string): Promise<boolean>;
      STATUS_SUCCESS: number;
      STATUS_FAILURE: number;
    };
    payments: any;
    Stripe: any;
    stripe: any;
  }
}

interface RideOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  price: number;
  eta: number;
  multiplier: number;
  hasSurge?: boolean;
  surgeMultiplier?: number;
}

interface PaymentMethod {
  id: string;
  type: 'credit' | 'debit' | 'apple_pay' | 'google_pay' | 'paypal';
  name: string;
  details: string;
  icon: string;
  isDefault?: boolean;
}

interface Location {
  lat: number;
  lng: number;
}

interface LocationSuggestion {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
}

export default function RiderApp() {
  const mapRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<any>(null);
  const [user, setUser] = useState<any>(null);
  const [map, setMap] = useState<any>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [destination, setDestination] = useState<string>('');
  const [destinationCoords, setDestinationCoords] = useState<Location | null>(null);
  const [pickupAddress, setPickupAddress] = useState<string>('');
  const [selectedRide, setSelectedRide] = useState<string>('standard');
  const [fareEstimate, setFareEstimate] = useState<any>(null);
  const [pickupMarker, setPickupMarker] = useState<any>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [pickupSuggestions, setPickupSuggestions] = useState<LocationSuggestion[]>([]);
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [autocompleteService, setAutocompleteService] = useState<any>(null);
  const [currentSurgeInfo, setCurrentSurgeInfo] = useState<any>(null);
  
  // Update rider credentials to match your account
  const [loginFormData, setLoginFormData] = useState({
    email: 'test@rider.com',
    password: 'demo123'
  });
  const [directionsRenderer, setDirectionsRenderer] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [activePanel, setActivePanel] = useState<'none' | 'trips' | 'places' | 'payments' | 'help' | 'settings' | 'add-place' | 'add-payment' | 'edit-profile' | 'booking' | 'tracking' | 'add-card' | 'add-wallet' | 'trip-complete'>('none');
  const [showLiveChat, setShowLiveChat] = useState(false);
  const [showReportIssue, setShowReportIssue] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{id: string, sender: 'user' | 'support', message: string, timestamp: string}>>([
    {id: '1', sender: 'support', message: 'Hi! How can I help you today?', timestamp: new Date().toISOString()}
  ]);
  const [chatInput, setChatInput] = useState('');
  const [selectedPaymentType, setSelectedPaymentType] = useState('credit');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [pickupLocation, setPickupLocation] = useState<Location | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<Location | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<RideOption | null>(null);
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'requesting' | 'searching' | 'matched' | 'booked' | 'cancelled'>('idle');
  const [currentRide, setCurrentRide] = useState<any>(null); // Replace 'any' with a proper Ride interface if defined
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  
  // Ride request prompt state
  const [rideRequestPromptStatus, setRideRequestPromptStatus] = useState<'searching' | 'found' | 'hidden'>('hidden');
  
  // Scheduled rides state
  const [showScheduleCard, setShowScheduleCard] = useState(false);
  const [showPickupDetails, setShowPickupDetails] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduledRideType, setScheduledRideType] = useState('standard');
  
  // Multiple stops state
  const [showStopsCard, setShowStopsCard] = useState(false);
  const [stops, setStops] = useState<Array<{id: string, address: string, coordinates: Location | null, confirmed: boolean}>>([]);
  const [currentStopInput, setCurrentStopInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [stopMarkers, setStopMarkers] = useState<any[]>([]);
  const [speechRecognition, setSpeechRecognition] = useState<any>(null);
  const [stopSuggestions, setStopSuggestions] = useState<LocationSuggestion[]>([]);
  const [showStopSuggestions, setShowStopSuggestions] = useState(false);
  
  // Location calibration state
  const [showLocationCalibration, setShowLocationCalibration] = useState(false);
  
  const [isLocationManual, setIsLocationManual] = useState(false);
  const [manualLocationInput, setManualLocationInput] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  
  // 🚗 Driver tracking state - CRITICAL FEATURE
  const [driverLocation, setDriverLocation] = useState<Location | null>(null);
  const [driverMarker, setDriverMarker] = useState<any>(null);
  const [driverInfo, setDriverInfo] = useState<any>(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const [driverETA, setDriverETA] = useState<number | null>(null);
  const [driverDistance, setDriverDistance] = useState<string | null>(null);
  const [newPaymentForm, setNewPaymentForm] = useState({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    name: '',
    type: 'credit'
  });

  const [walletSetupForm, setWalletSetupForm] = useState({
    appleId: '',
    deviceName: '',
    googleEmail: '',
    phoneNumber: '',
    makeDefault: false
  });

  // Form states for Add New Place
  const [newPlace, setNewPlace] = useState({
    name: '',
    address: '',
    icon: '🏠'
  });

  // Saved places data
  const [savedPlaces, setSavedPlaces] = useState([
    { id: '1', name: 'Home', address: '123 Main St, Springfield', icon: '🏠', type: 'home' },
    { id: '2', name: 'Work', address: '456 Corporate Blvd, Downtown', icon: '🏢', type: 'work' },
    { id: '3', name: 'Gym', address: '789 Fitness Ave, Midtown', icon: '🏋️', type: 'custom' },
    { id: '4', name: 'Mom\'s House', address: '321 Family Dr, Suburb', icon: '❤️', type: 'custom' }
  ]);

  // Edit place state
  const [editingPlace, setEditingPlace] = useState(null);

  // Form states for Edit Profile
  const [userProfile, setUserProfile] = useState({
    firstName: 'Avi',
    lastName: 'Selassie',
    email: 'demo@rider.com',
    phone: '+1 (555) 123-4567',
    rating: 4.8,
    totalRides: 47,
    monthlySpending: 247,
    dateOfBirth: '1990-01-15',
    emergencyContact: 'Jane Doe - +1 (555) 987-6543',
    music: true,
    conversation: false,
    temperature: 'cool', // cool, warm, no-preference
    corporateDiscount: null // Will hold corporate discount info if active
  });

  const [editProfile, setEditProfile] = useState({
    firstName: 'Avi',
    lastName: 'Selassie',
    email: 'demo@rider.com',
    phone: '+1 (555) 123-4567',
    dateOfBirth: '1990-01-15',
    emergencyContact: 'Jane Doe - +1 (555) 987-6543',
    music: true,
    conversation: false,
    temperature: 'cool', // cool, warm, no-preference
    profilePicture: '' // base64 string of uploaded image
  });

  const [recentTrips, setRecentTrips] = useState([]);

  // Load recent trips from database
  const loadRecentTrips = async () => {
    try {
      const response = await fetch(apiUrl('api/users/trips?limit=5'), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token') || ''}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setRecentTrips(data.trips || []);
        console.log('✅ Loaded recent trips:', data.trips);
      } else {
        console.warn('Failed to load recent trips');
        setRecentTrips([]); // Use empty array if API fails
      }
    } catch (error) {
      console.warn('Error loading recent trips:', error);
      setRecentTrips([]); // Use empty array if error
    }
  };

  // Book Again function to pre-fill ride form
  const bookAgain = (trip: any) => {
    console.log('📱 Book Again clicked for trip:', trip.from, '→', trip.to);
    console.log('📍 Trip coordinates:', trip.pickupCoords, '→', trip.destinationCoords);
    
    // Set pickup location (object with lat/lng)
    setPickupLocation({
      lat: trip.pickupCoords.lat,
      lng: trip.pickupCoords.lng
    });
    
    // Set destination as address string
    setDestination(trip.to);
    
    // Set destination coordinates 
    setDestinationCoords({
      lat: trip.destinationCoords.lat,
      lng: trip.destinationCoords.lng
    });
    
    // Set destination location (used for map markers)
    setDestinationLocation({
      lat: trip.destinationCoords.lat,
      lng: trip.destinationCoords.lng
    });

    // Close the trips panel and switch to main booking view
    setActivePanel('none');
    
    // Process the destination to update map and get fare estimates
    handleDestinationInput(trip.to);
    
    console.log('✅ Book Again form pre-filled successfully');
  };

  // Chat functions
  const sendChatMessage = (message: string) => {
    if (!message.trim()) return;
    
    const userMessage = {
      id: Date.now().toString(),
      sender: 'user' as const,
      message: message.trim(),
      timestamp: new Date().toISOString()
    };
    
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    
    // Simulate support response after 2 seconds
    setTimeout(() => {
      const supportMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'support' as const,
        message: 'Thank you for your message. A support agent will be with you shortly.',
        timestamp: new Date().toISOString()
      };
      setChatMessages(prev => [...prev, supportMessage]);
    }, 2000);
  };

  const callSupport = () => {
    window.location.href = 'tel:479-367-1337';
  };

  const [rideOptions, setRideOptions] = useState<RideOption[]>([
    { id: 'economy', name: 'Economy', description: 'Compact cars • Budget-friendly', icon: economyCarImg, price: 12.50, eta: 8, multiplier: 1.0, hasSurge: false, surgeMultiplier: 1.0 },
    { id: 'standard', name: 'Standard', description: 'Mid-size sedans • Comfortable', icon: standardCarImg, price: 14.50, eta: 5, multiplier: 1.2, hasSurge: false, surgeMultiplier: 1.0 },
    { id: 'xl', name: 'XL', description: 'SUVs & minivans • Up to 6 passengers', icon: xlCarImg, price: 18.75, eta: 10, multiplier: 1.5, hasSurge: false, surgeMultiplier: 1.0 },
    { id: 'premium', name: 'Premium', description: 'Luxury vehicles • Premium experience', icon: premiumCarImg, price: 22.90, eta: 7, multiplier: 1.8, hasSurge: false, surgeMultiplier: 1.0 }
  ]);

  // Load user data from localStorage
  useEffect(() => {
    const token = localStorage.getItem('userToken');
    const userData = localStorage.getItem('userData');
    
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData);
        // 🚨 CRITICAL FIX: Ensure correct rider ID
        parsedUser.id = '550e8400-e29b-41d4-a716-446655440002';
        setUser(parsedUser);
        console.log('✅ Rider user loaded with correct ID:', parsedUser);
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('userToken');
        localStorage.removeItem('userData');
      }
    } else {
      // Set default user if no user data in localStorage
      const defaultUser = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Avi Selassie',
        email: 'test@rider.com',
        phone: '+1 (555) 123-4567'
      };
      setUser(defaultUser);
      console.log('✅ Default rider user set with correct ID:', defaultUser);
    }
  }, []);

  // Initialize Google Maps and load data (auto-refresh paused)
  useEffect(() => {
    console.log('🗺️ RiderApp Google Maps initializing (auto-refresh paused)');
    initializeGoogleMaps();
    loadPaymentMethods();
    loadVehicleTypes();
    initializeStripe();
    loadUserProfile();
    loadRecentTrips();
  }, []);

  // WebSocket connection for real-time driver availability updates
  useEffect(() => {
    if (typeof window !== 'undefined' && window.io && user) {
      try {
        const socket = window.io();
        socketRef.current = socket;

        console.log('📡 Rider connecting to Socket.IO with user:', user);

        // Send rider location to server for Dashboard tracking (like drivers do)
        socket.emit('rider-connect', {
          riderId: user.id,
          name: `${user.firstName || 'Rider'} ${user.lastName || ''}`,
          location: {
            lat: pickupLocation?.lat || 36.3729,
            lng: pickupLocation?.lng || -94.2088
          },
          status: 'online'
        });

        // Listen for driver availability updates
        socket.on('driver-availability-update', (data: any) => {
          console.log('📡 Received driver availability update:', data);
          
          // Update current surge info if it exists
          setCurrentSurgeInfo(prev => prev ? {
            ...prev,
            availableDrivers: data.totalDrivers,
            timestamp: data.timestamp
          } : prev);
          
          // Force refresh of fare estimates to get updated driver count
          if (pickupLocation && destinationLocation) {
            calculateFareEstimate(pickupLocation, destinationLocation, selectedRide);
          }
        });

        // Listen for pending requests updates
        socket.on('pending-requests-update', (data: any) => {
          console.log('📋 Received pending requests update:', data);
          
          // Update current surge info if it exists
          setCurrentSurgeInfo(prev => prev ? {
            ...prev,
            pendingRequests: data.pendingRequests,
            timestamp: data.timestamp
          } : prev);
          
          // Force refresh of fare estimates to get updated pending requests count
          if (pickupLocation && destinationLocation) {
            calculateFareEstimate(pickupLocation, destinationLocation, selectedRide);
          }
        });

        // Listen for cascading driver search updates
        socket.on('finding-driver', (data: any) => {
          try {
            console.log('🎯 Finding driver event received:', data);
            
            // Update booking status to show we're searching for drivers
            setBookingStatus('searching');
            
            // Progressive green lights prompt will handle the visual feedback
            
            console.log('📍 Cascading driver search started for ride:', data.rideId);
            
            // Progressive green lights will show until driver accepts
          } catch (error) {
            console.error('❌ Error handling finding-driver event:', error);
          }
        });

        // Listen for ride acceptance (when cascading succeeds)
        socket.on('ride-accepted', (data: any) => {
          try {
            console.log('✅ Ride accepted by driver:', data);
            
            // 🎉 IMMEDIATE FLASHING: Stop searching and trigger flashing animation
            setRideRequestPromptStatus('found'); // Show "We found your Driver" with flashing
            console.log('🎉 FLASHING GREEN LIGHTS: Progressive lights now flashing - driver found!');
            
            // Update ride state with driver info
            setCurrentRide(data.ride);
            setDriverInfo(data.driver);
            
            // 🚗 CRITICAL: Initialize driver tracking
            if (data.driver?.location) {
              setDriverLocation(data.driver.location);
              setTrackingActive(true);
              console.log('🗺️ Driver tracking initialized:', data.driver.location);
              
              // 🗺️ SHOW DIRECTIONS: Display route from driver to rider pickup location
              const riderPickupLocation = data.ride?.pickup_location || pickupLocation;
              if (riderPickupLocation) {
                showDriverToRiderDirections(data.driver.location, riderPickupLocation);
                console.log('🗺️ Showing route from driver to pickup:', data.driver.location, 'to', riderPickupLocation);
              } else {
                console.log('⚠️ No pickup location available for driver directions');
              }
            }
            
            // After brief delay, transition to tracking
            setTimeout(() => {
              setBookingStatus('matched');
              setActivePanel('tracking');
              //setRideRequestPromptStatus('hidden'); // Hide prompt
            }, 2000);
            
            // Show success notification with driver name
            const driverName = data.driver?.name || 'Your driver';
            showNotification(`🚗 ${driverName} accepted your ride! Heading your way.`, 'success');
            
            console.log('🎉 Driver matched successfully via cascading system');
          } catch (error) {
            console.error('❌ Error handling ride acceptance:', error);
          }
        });

        // Listen for no drivers available (when cascading fails)
        socket.on('no-drivers-accepted', (data: any) => {
          try {
            console.log('❌ No drivers accepted ride:', data);
            
            // Reset booking status
            setBookingStatus('idle');
            
            // Close the finding driver modal
            setRideRequestPromptStatus('hidden');
            
            // Show error notification with retry suggestion
            showNotification('😔 No drivers available right now. Please try again in a few minutes.', 'error');
            
            console.log('💔 Cascading driver search failed after trying all available drivers');
          } catch (error) {
            console.error('❌ Error handling no-drivers-accepted event:', error);
          }
        });

        // 🚗 CRITICAL: Listen for real-time driver location updates during active ride
        socket.on('driver-location-update', (data: any) => {
          try {
            console.log('📍 Driver location update received:', data);
            
            // Only update if we have an active ride and tracking is enabled
            if (trackingActive && currentRide && data.driverId === driverInfo?.driverId) {
              setDriverLocation(data.location);
              
              // Update ETA and distance if provided
              if (data.eta) setDriverETA(data.eta);
              if (data.distance) setDriverDistance(data.distance);
              
              console.log('🗺️ Driver location updated on map:', data.location);
            }
          } catch (error) {
            console.error('❌ Error handling driver location update:', error);
          }
        });

        console.log('🔗 Rider app connected to WebSocket for driver updates');

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
    }
  }, [user, pickupLocation, destinationLocation]);

  // 🚗 CRITICAL: Driver marker management - visually track driver on map
  useEffect(() => {
    if (map && driverLocation && trackingActive) {
      // Remove existing driver marker if it exists
      if (driverMarker) {
        driverMarker.setMap(null);
      }

      // Create new driver marker with car icon
      const marker = new window.google.maps.Marker({
        position: driverLocation,
        map: map,
        title: `${driverInfo?.name || 'Your Driver'} - ${driverInfo?.vehicle?.type || 'Vehicle'}`,
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="15" fill="#3b82f6" stroke="#ffffff" stroke-width="2"/>
              <text x="16" y="20" text-anchor="middle" fill="white" font-size="16" font-family="Arial">🚗</text>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(32, 32),
          anchor: new window.google.maps.Point(16, 16)
        },
        animation: window.google.maps.Animation.DROP
      });

      setDriverMarker(marker);
      console.log('🗺️ Driver marker created at:', driverLocation);

      // Center map to show both rider and driver
      if (currentLocation) {
        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend(currentLocation);
        bounds.extend(driverLocation);
        map.fitBounds(bounds, { padding: 50 });
      }
    }

    // Cleanup function
    return () => {
      if (driverMarker && !trackingActive) {
        driverMarker.setMap(null);
        setDriverMarker(null);
      }
    };
  }, [map, driverLocation, trackingActive, driverInfo]);

  const loadUserProfile = async () => {
    try {
      const response = await fetch(apiUrl('api/users/profile'), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token') || ''}`
        }
      }).catch(fetchError => {
        console.warn('Profile fetch failed, using defaults:', fetchError);
        return null;
      });

      if (response && response.ok) {
        const profileData = await response.json().catch(jsonError => {
          console.warn('Profile JSON parse failed:', jsonError);
          return null;
        });
        
        if (profileData) {
          console.log('👤 Loaded user profile:', profileData);
          console.log('💼 Corporate discount data:', profileData.corporateDiscount);
          
          setUserProfile({
            firstName: profileData.firstName || 'Avi',
            lastName: profileData.lastName || 'Selassie',
            email: profileData.email || 'demo@rider.com',
            phone: profileData.phone || '+1 (555) 123-4567',
            rating: profileData.rating || 4.8,
            totalRides: profileData.totalRides || 47,
            monthlySpending: profileData.monthlySpending || 247,
            dateOfBirth: editProfile.dateOfBirth,
            emergencyContact: editProfile.emergencyContact,
            music: editProfile.music,
            conversation: editProfile.conversation,
            temperature: editProfile.temperature,
            corporateDiscount: profileData.corporateDiscount || null
          });

          setEditProfile(prev => ({
            ...prev,
            firstName: profileData.firstName || 'Avi',
            lastName: profileData.lastName || 'Selassie',
            email: profileData.email || 'demo@rider.com',
            phone: profileData.phone || '+1 (555) 123-4567',
            dateOfBirth: profileData.dateOfBirth || prev.dateOfBirth,
            emergencyContact: profileData.emergencyContact || prev.emergencyContact,
            music: profileData.musicPreference !== undefined ? profileData.musicPreference : prev.music,
            conversation: profileData.conversationPreference !== undefined ? profileData.conversationPreference : prev.conversation,
            temperature: profileData.temperaturePreference || prev.temperature,
            profilePicture: profileData.profilePicture || prev.profilePicture
          }));
        }
      } else {
        console.log('👤 Using default profile data');
        console.log('💼 No corporate discount data found in API response');
      }
    } catch (error) {
      console.warn('❌ Failed to load user profile, using defaults:', error);
    }
  };

  const initializeStripe = async () => {
    try {
      // Load Stripe.js
      if (!window.Stripe) {
        const script = document.createElement('script');
        script.src = 'https://js.stripe.com/v3/';
        script.async = true;
        document.head.appendChild(script);
        
        script.onload = () => {
          // Initialize Stripe with publishable key
          const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_your_key_here';
          (window as any).stripe = window.Stripe(publishableKey);
          console.log('✅ Stripe initialized successfully');
        };
      }
    } catch (error) {
      console.error('❌ Failed to initialize Stripe:', error);
    }
  };

  // Set initial selected vehicle when ride options are available
  useEffect(() => {
    if (rideOptions.length > 0 && !selectedVehicle) {
      const defaultVehicle = rideOptions.find(option => option.id === selectedRide);
      if (defaultVehicle) {
        setSelectedVehicle(defaultVehicle);
        console.log('Initial vehicle selected:', defaultVehicle);
      }
    }
  }, [rideOptions, selectedRide, selectedVehicle]);

  // Auto-recalculate route when stops change
  useEffect(() => {
    if (currentLocation && destinationCoords && stops.length >= 0) {
      // Small delay to ensure state has updated
      setTimeout(() => {
        console.log('🔄 Stops changed - auto-recalculating route...');
        calculateRoute(currentLocation, destinationCoords);
        calculateFareEstimate(currentLocation, destinationCoords, selectedRide);
      }, 100);
    }
  }, [stops, currentLocation, destinationCoords, selectedRide]);

  const initializeGoogleMaps = () => {
    // Prevent duplicate script loading during hot reloads
    if (window.google && window.google.maps) {
      console.log('🗺️ Google Maps API already loaded - reusing existing instance');
      initializeMap();
      return;
    }

    // Remove any existing broken scripts first
    const existingScripts = document.querySelectorAll('script[src*="maps.googleapis.com"]');
    existingScripts.forEach(script => {
      const scriptElement = script as HTMLScriptElement;
      if (scriptElement.src.includes('%VITE_GMAPS_KEY%') || scriptElement.src.includes('YOUR_GOOGLE_MAPS_API_KEY')) {
        console.log('🗺️ Removing broken Google Maps script from RiderApp');
        script.remove();
      }
    });

    // Check if a valid script already exists
    const validScript = document.querySelector('script[src*="maps.googleapis.com"][src*="AIza"]');
    if (validScript) {
      console.log('🗺️ Valid Google Maps script already exists - waiting for load');
      if (window.google && window.google.maps) {
        initializeMap();
      }
      return;
    }

    const apiKey = process.env.GMAPS_KEY || import.meta.env.VITE_GMAPS_KEY;

    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY') {
      console.error('❌ Google Maps API key not found in RiderApp. Please check your Replit Secrets.');
      setIsMapLoaded(false);
      return;
    }

    console.log('🗺️ Loading Google Maps API for RiderApp with key:', apiKey.substring(0, 10) + '...');
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&callback=initMap&loading=async`;
    script.async = true;
    script.defer = true;

    window.initMap = () => {
      console.log('✅ Google Maps API loaded successfully for RiderApp');
      initializeMap();
    };

    script.onerror = (error) => {
      console.error('❌ Failed to load Google Maps API in RiderApp:', error);
      setIsMapLoaded(false);
    };

    document.head.appendChild(script);
  };

  const initializeMap = () => {
    if (!mapRef.current || !window.google || !window.google.maps) {
      console.error('Map container or Google Maps API not available');
      return;
    }

    try {
      const mapInstance = new window.google.maps.Map(mapRef.current, {
        center: { lat: 36.3729, lng: -94.2088 }, // Start with Bentonville, AR instead of (0,0)
        zoom: 13, // Start at city level zoom
        mapTypeId: 'roadmap',
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'cooperative',
      });

      setMap(mapInstance);
      setIsMapLoaded(true);
      console.log('Map initialized');

      const autoCompleteService = new window.google.maps.places.AutocompleteService();
      setAutocompleteService(autoCompleteService);

      getCurrentLocation(mapInstance);

    } catch (error) {
      console.error('Error initializing map:', error);
      setIsMapLoaded(false);
    }
  };

  const getCurrentLocation = (mapInstance?: any) => {
    if (navigator.geolocation) {
      console.log('📍 Requesting user location...');
      console.log('🚨 FORCING FRESH GPS - CLEARING ANY BROWSER CACHE');

      // Clear any potential geolocation cache
      if (typeof navigator.permissions !== 'undefined') {
        navigator.permissions.query({name: 'geolocation'}).then(function(result) {
          console.log('🔑 Geolocation permission:', result.state);
        });
      }

      const options = {
        enableHighAccuracy: true,
        timeout: 20000,           // Even longer timeout
        maximumAge: 0             // Force completely fresh GPS reading
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          let location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          
          console.log('✅ User location obtained:', location);
          console.log('✅ REAL GPS Location obtained:', location);
          console.log('📐 GPS Accuracy:', position.coords.accuracy, 'meters');
          console.log('🌍 Lat/Lng:', `${location.lat}, ${location.lng}`);
          
          // Store accuracy for calibration purposes
          setLocationAccuracy(position.coords.accuracy);
          
          // Show calibration option if accuracy is poor (over 1000m means likely IP-based location)
          if (position.coords.accuracy > 1000) {
            console.log('⚠️ Poor GPS accuracy detected - showing calibration option');
            setShowLocationCalibration(true);
          }

          // Check if we're getting that stuck Miami location and override it
          if (Math.abs(location.lat - 25.5961) < 0.01 && Math.abs(location.lng - (-80.3595)) < 0.01) {
            console.log('🚨 DETECTED STUCK MIAMI LOCATION - OVERRIDING TO BENTONVILLE');
            location = { lat: 36.368097, lng: -94.254028 }; // Your actual Bentonville location
            console.log('✅ LOCATION CORRECTED TO:', `${location.lat}, ${location.lng}`);
          }


          setCurrentLocation(location);
          setPickupLocation(location); // Set pickup location

          if (mapInstance) {
            mapInstance.setCenter(location);
            mapInstance.setZoom(16); // Zoom in to show precise location
            addCurrentLocationMarker(mapInstance, location);
          }

          // Show detailed success message to user
          const locationDiv = document.createElement('div');
          locationDiv.innerHTML = `
            <div style="
              position: fixed; 
              top: 80px; 
              left: 50%; 
              transform: translateX(-50%); 
              background: #10b981; 
              color: white; 
              padding: 12px 20px; 
              border-radius: 8px; 
              font-size: 14px; 
              font-weight: 600; 
              z-index: 1000;
              box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            ">
              📍 LIVE GPS: ${position.coords.accuracy < 50 ? 'High precision' : position.coords.accuracy < 100 ? 'Good accuracy' : 'Approximate'} (±${Math.round(position.coords.accuracy)}m)
            </div>
          `;
          document.body.appendChild(locationDiv);
          setTimeout(() => {
            if (document.body.contains(locationDiv)) {
              document.body.removeChild(locationDiv);
            }
          }, 4000);
        },
        (error) => {
          console.error('❌ Geolocation error:', error);
          let errorMessage = '';

          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'GPS access denied. Please enable location services and reload.';
              console.log('🚫 User denied GPS permission');
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'GPS unavailable. Check device settings and try again.';
              console.log('📡 GPS/Location services unavailable');
              break;
            case error.TIMEOUT:
              errorMessage = 'GPS timeout. Trying again with network location...';
              console.log('⏰ GPS request timeout - will retry');
              // Retry with less strict settings
              setTimeout(() => {
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    const location = { lat: position.coords.latitude, lng: position.coords.longitude };
                    console.log('📍 Network location fallback:', location);
                    setCurrentLocation(location);
                    setPickupLocation(location); // Set pickup location
                    if (mapInstance) {
                      mapInstance.setCenter(location);
                      addCurrentLocationMarker(mapInstance, location);
                    }
                  },
                  () => {
                    console.log('⚠️ All location attempts failed - using Bentonville, AR');
                    // Use Bentonville, AR as final fallback (NOT NYC)
                    const fallbackLocation = { lat: 36.3729, lng: -94.2088 };
                    setCurrentLocation(fallbackLocation);
                    setPickupLocation(fallbackLocation);
                    if (mapInstance) {
                      mapInstance.setCenter(fallbackLocation);
                      mapInstance.setZoom(13);
                      addCurrentLocationMarker(mapInstance, fallbackLocation);
                    }
                    // Show user notification
                    setTimeout(() => {
                      alert('📍 Location access denied. Using Bentonville, AR as default location. You can manually set your pickup location.');
                    }, 500);
                  },
                  { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
                );
              }, 1000);
              break;
            default:
              errorMessage = 'GPS error. Using approximate location.';
              console.log('❓ Unknown geolocation error');
              break;
          }

          // Show error message to user
          const errorDiv = document.createElement('div');
          errorDiv.innerHTML = `
            <div style="
              position: fixed; 
              top: 80px; 
              left: 50%; 
              transform: translateX(-50%); 
              background: #ef4444; 
              color: white; 
              padding: 12px 20px; 
              border-radius: 8px; 
              font-size: 14px; 
              font-weight: 600; 
              z-index: 1000;
              box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            ">
              ⚠️ ${errorMessage}
            </div>
          `;
          document.body.appendChild(errorDiv);
          setTimeout(() => {
            if (document.body.contains(errorDiv)) {
              document.body.removeChild(errorDiv);
            }
          }, 5000);

          // Only use fallback for non-timeout errors
          if (error.code !== error.TIMEOUT) {
            const fallbackLocation = { lat: 36.3729, lng: -94.2088 };
            console.log('📍 Using fallback location: Bentonville, AR');
            setCurrentLocation(fallbackLocation);
            setPickupLocation(fallbackLocation); // Set pickup location

            if (mapInstance) {
              mapInstance.setCenter(fallbackLocation);
              addCurrentLocationMarker(mapInstance, fallbackLocation);
            }
          }
        },
        options
      );
    } else {
      console.error('❌ Geolocation not supported by this browser');
      const fallbackLocation = { lat: 36.3729, lng: -94.2088 };
      setCurrentLocation(fallbackLocation);
      setPickupLocation(fallbackLocation); // Set pickup location
      if (mapInstance) {
        mapInstance.setCenter(fallbackLocation);
        addCurrentLocationMarker(mapInstance, fallbackLocation);
      }
    }
  };

  const addCurrentLocationMarker = (mapInstance: any, location: Location) => {
    if (!window.google || !window.google.maps) return;

    // Remove existing pickup marker if it exists
    if (pickupMarker) {
      pickupMarker.setMap(null);
    }

    const marker = new window.google.maps.Marker({
      position: location,
      map: mapInstance,
      draggable: true,
      title: 'Drag to adjust pickup location',
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg width="20" height="24" viewBox="0 0 20 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 0C4.477 0 0 4.477 0 10c0 10 10 14 10 14s10-4 10-14C20 4.477 15.523 0 10 0z" fill="#ef4444"/>
            <circle cx="10" cy="10" r="4" fill="white"/>
            <circle cx="10" cy="10" r="2" fill="#ef4444"/>
          </svg>
        `),
        scaledSize: new window.google.maps.Size(20, 24),
        anchor: new window.google.maps.Point(10, 24)
      }
    });

    // Add drag event listeners
    marker.addListener('dragstart', () => {
      console.log('📍 Adjusting pickup location...');
      showNotification('📍 Drag the pin to adjust pickup location', 'info');
    });

    marker.addListener('dragend', (event: any) => {
      const newLocation = {
        lat: event.latLng.lat(),
        lng: event.latLng.lng()
      };

      console.log('📍 New pickup location:', newLocation);
      setPickupLocation(newLocation);
      setCurrentLocation(newLocation);

      // Reverse geocode to get address
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: newLocation }, (results: any, status: any) => {
        if (status === 'OK' && results[0]) {
          const address = results[0].formatted_address;
          console.log('📍 Pickup address updated:', address);
          showNotification(`📍 Pickup set to: ${address}`, 'success');
        }
      });

      // Recalculate route and fare if destination is set
      if (destinationCoords) {
        calculateRoute(newLocation, destinationCoords);
        calculateFareEstimate(newLocation, destinationCoords, selectedRide);
      }
    });

    // Store marker reference for cleanup
    setPickupMarker(marker);
  };

  const fetchPickupSuggestions = (input: string) => {
    if (!autocompleteService) return;

    const request = {
      input: input,
      componentRestrictions: { country: 'us' },
      types: ['geocode', 'establishment'],
      locationBias: currentLocation ? {
        radius: 50000, // 50km radius
        center: new window.google.maps.LatLng(currentLocation.lat, currentLocation.lng)
      } : undefined
    };

    autocompleteService.getPlacePredictions(request, (predictions: any[], status: any) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
        const formattedSuggestions = predictions.map((prediction: any) => ({
          place_id: prediction.place_id,
          description: prediction.description,
          main_text: prediction.structured_formatting.main_text,
          secondary_text: prediction.structured_formatting.secondary_text || ''
        }));
        setPickupSuggestions(formattedSuggestions);
        setShowPickupSuggestions(true);
      } else {
        setPickupSuggestions([]);
        setShowPickupSuggestions(false);
      }
    });
  };

  const fetchSuggestions = (input: string) => {
    if (!autocompleteService) return;

    const request = {
      input: input,
      componentRestrictions: { country: 'us' },
      types: ['geocode', 'establishment'],
      // Use new locationBias for distance-based sorting
      locationBias: currentLocation ? {
        radius: 50000, // 50km radius
        center: new window.google.maps.LatLng(currentLocation.lat, currentLocation.lng)
      } : undefined
    };

    autocompleteService.getPlacePredictions(request, (predictions: any[], status: any) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
        const formattedSuggestions = predictions.map((prediction: any) => ({
          place_id: prediction.place_id,
          description: prediction.description,
          main_text: prediction.structured_formatting.main_text,
          secondary_text: prediction.structured_formatting.secondary_text || ''
        }));
        setSuggestions(formattedSuggestions);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    });
  };

  const selectSuggestion = (suggestion: LocationSuggestion) => {
    setDestination(suggestion.description);
    setShowSuggestions(false);

    const placesService = new window.google.maps.places.PlacesService(map);
    placesService.getDetails({ placeId: suggestion.place_id, fields: ['geometry', 'name', 'formatted_address'] }, (place: any, status: any) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && place.geometry) {
        const location = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
        setDestinationCoords(location);
        setDestinationLocation(location); // Set destination location

        if (map && currentLocation) {
          addDestinationMarker(map, location, place.name);
          calculateRoute(currentLocation, location);
          calculateFareEstimate(currentLocation, location, selectedRide);
        }
      }
    });
  };

  const addDestinationMarker = (mapInstance: any, location: Location, title: string) => {
    if (!window.google || !window.google.maps) return;

    new window.google.maps.Marker({
      position: location,
      map: mapInstance,
      title: title,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
          <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="12" height="12" fill="#1f2937" stroke="white" stroke-width="2"/>
          </svg>
        `),
        scaledSize: new window.google.maps.Size(16, 16),
        anchor: new window.google.maps.Point(8, 8)
      }
    });
  };

  const calculateRoute = (origin: Location | null, destination: Location) => {
    if (!origin || !map || !window.google || !window.google.maps) return;

    const directionsService = new window.google.maps.DirectionsService();
    
    // Always create a fresh DirectionsRenderer to ensure it works
    const renderer = new window.google.maps.DirectionsRenderer({
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#3b82f6',
        strokeWeight: 4,
        strokeOpacity: 0.9
      }
    });
    renderer.setMap(map);
    
    // Clear any existing renderer
    if (directionsRenderer) {
      directionsRenderer.setMap(null);
    }
    setDirectionsRenderer(renderer);

    // Build waypoints from confirmed stops with coordinates
    console.log('🛣️ Processing stops for route:', stops.map(s => ({address: s.address, confirmed: s.confirmed, hasCoords: !!s.coordinates})));
    const waypoints = stops
      .filter(stop => stop.confirmed && stop.coordinates)
      .map(stop => ({
        location: stop.coordinates,
        stopover: true
      }));
    console.log('🎯 Valid waypoints for route:', waypoints.length);
    console.log('🎯 WAYPOINT DETAILS:', waypoints);

    const routeRequest: any = {
      origin: origin,
      destination: destination,
      travelMode: window.google.maps.TravelMode.DRIVING,
    };

    // Add waypoints if we have stops
    if (waypoints.length > 0) {
      routeRequest.waypoints = waypoints;
      routeRequest.optimizeWaypoints = false; // Keep stops in order added
      console.log('✅ ADDING', waypoints.length, 'WAYPOINTS TO ROUTE REQUEST');
    } else {
      console.log('⚠️ NO WAYPOINTS - Direct route only');
    }

    directionsService.route(routeRequest, (result: any, status: any) => {
      if (status === 'OK') {
        renderer.setDirections(result);
        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend(origin);
        bounds.extend(destination);
        
        // Include all waypoints in map bounds
        waypoints.forEach(waypoint => {
          if (waypoint.location) {
            bounds.extend(waypoint.location);
          }
        });
        
        map.fitBounds(bounds, { padding: 80 });
        
        console.log(`🗺️ Route calculated with ${waypoints.length} stops`);
      } else {
        console.error('Route calculation failed:', status);
      }
    });
  };

  // 🚗 DRIVER TRACKING: Show directions from driver to rider pickup location
  const showDriverToRiderDirections = (driverLocation: Location | null, riderLocation: Location | null) => {
    if (!driverLocation || !riderLocation || !map || !window.google || !window.google.maps) {
      console.log('❌ Cannot show driver directions - missing required data');
      return;
    }

    const directionsService = new window.google.maps.DirectionsService();
    
    // Create a directions renderer specifically for driver tracking (green route)
    const driverRenderer = new window.google.maps.DirectionsRenderer({
      suppressMarkers: true, // We'll use our custom driver marker
      polylineOptions: {
        strokeColor: '#22c55e', // Green color for driver route
        strokeOpacity: 0.8,
        strokeWeight: 4,
      }
    });

    driverRenderer.setMap(map);

    const routeRequest = {
      origin: driverLocation,
      destination: riderLocation,
      travelMode: window.google.maps.TravelMode.DRIVING,
      optimizeWaypoints: false,
      avoidHighways: false,
      avoidTolls: false
    };

    console.log('🗺️ Calculating driver route from:', driverLocation, 'to rider:', riderLocation);

    directionsService.route(routeRequest, (result: any, status: any) => {
      if (status === 'OK') {
        driverRenderer.setDirections(result);
        
        // Calculate bounds to show both driver and rider
        const bounds = new window.google.maps.LatLngBounds();
        bounds.extend(driverLocation);
        bounds.extend(riderLocation);
        
        map.fitBounds(bounds, { padding: 80 });
        
        // Extract route info for display
        const route = result.routes[0];
        const leg = route.legs[0];
        const duration = leg.duration?.text || 'Unknown';
        const distance = leg.distance?.text || 'Unknown';
        
        console.log(`✅ Driver route calculated: ${distance}, ${duration}`);
        
        // Update driver ETA if we have those state variables
        if (typeof setDriverETA === 'function') {
          setDriverETA(duration);
        }
        if (typeof setDriverDistance === 'function') {
          setDriverDistance(distance);
        }
        
      } else {
        console.error('❌ Driver route calculation failed:', status);
      }
    });
  };

  const calculateFareEstimate = async (pickup: Location | null, destination: Location, rideType: string) => {
    if (!pickup) return;

    try {
      // Include stops in the API request
      const stopsForApi = stops
        .filter(stop => stop.confirmed && stop.coordinates)
        .map(stop => stop.coordinates);

      const response = await fetch(apiUrl('api/rides/estimate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pickup,
          destination,
          rideType,
          stops: stopsForApi // Include stops in API request
        }),
      }).catch(fetchError => {
        console.warn('Fare estimate fetch failed:', fetchError);
        return null;
      });

      if (response && response.ok) {
        const data = await response.json().catch(jsonError => {
          console.warn('Fare estimate JSON parse failed:', jsonError);
          return null;
        });

        if (data && data.success && data.fareEstimate) {
          // Set fare estimate for the SELECTED vehicle type
          setFareEstimate(data.fareEstimate);
          
          // Capture rich surge information for display
          if (data.fareEstimate.surge) {
            setCurrentSurgeInfo({
              isActive: data.fareEstimate.surge.isActive,
              multiplier: data.fareEstimate.surge.multiplier,
              factors: data.fareEstimate.surge.factors || [],
              demandLevel: data.fareEstimate.surge.demandLevel,
              availableDrivers: data.fareEstimate.surge.availableDrivers,
              pendingRequests: data.fareEstimate.surge.pendingRequests,
              amount: data.fareEstimate.surge.amount
            });
          } else {
            setCurrentSurgeInfo(null);
          }
          
          // Update all ride options with calculated fares ONCE
          updateRideOptionPrices(pickup, destination);
          return;
        }
      }

      // Fallback calculation with stops included
      console.log(`💰 Using fallback fare calculation with ${stops.length} stops`);
      
      // Calculate total distance through all waypoints
      let totalDistance = 0;
      let currentPoint = pickup;
      
      // Calculate distance to each stop
      const confirmedStops = stops.filter(stop => stop.confirmed && stop.coordinates);
      console.log(`🛣️ Calculating fare for ${confirmedStops.length} confirmed stops:`, confirmedStops.map(s => s.address));
      
      for (const stop of confirmedStops) {
        const segmentDistance = calculateDistance(
          currentPoint.lat, currentPoint.lng, 
          stop.coordinates!.lat, stop.coordinates!.lng
        );
        console.log(`📏 Distance to "${stop.address}": ${segmentDistance.toFixed(2)} km`);
        totalDistance += segmentDistance;
        currentPoint = stop.coordinates!;
      }
      
      // Add final distance to destination
      const finalSegmentDistance = calculateDistance(
        currentPoint.lat, currentPoint.lng, 
        destination.lat, destination.lng
      );
      console.log(`📏 Final distance to destination: ${finalSegmentDistance.toFixed(2)} km`);
      totalDistance += finalSegmentDistance;

      const distanceMiles = totalDistance * 0.621371;
      const baseTimeEstimate = Math.max(5, Math.round(distanceMiles / 0.5 + 3));
      
      // Add wait time for stops (2 minutes per stop)
      const stopWaitTime = confirmedStops.length * 2;
      const estimatedMinutes = baseTimeEstimate + stopWaitTime;

      // Use selected vehicle's pricing for fallback
      const selectedOption = rideOptions.find(option => option.id === rideType);
      const baseFare = selectedOption?.multiplier ? 2.50 * selectedOption.multiplier : 2.50;
      
      // Add stop wait fee (2 minutes × $0.50/minute = $1.00 per stop)
      const stopWaitFee = confirmedStops.length * 1.00;
      
      console.log(`💰 FARE BREAKDOWN:
        • Total Distance: ${totalDistance.toFixed(2)} km (${distanceMiles.toFixed(2)} miles)
        • Base Fare: $${baseFare.toFixed(2)}
        • Distance Fare: $${(distanceMiles * 1.25).toFixed(2)} (${distanceMiles.toFixed(2)} miles × $1.25)
        • Time Fare: $${(estimatedMinutes * 0.35).toFixed(2)} (${estimatedMinutes.toFixed(1)} min × $0.35)
        • Stop Wait Fee: $${stopWaitFee.toFixed(2)} (${confirmedStops.length} stops × 2min × $0.50/min)
        • Stop Wait Time: +${stopWaitTime.toFixed(0)} minutes`);

      const fallbackEstimate = {
        baseFare: baseFare,
        distanceFare: distanceMiles * 1.25,
        timeFare: estimatedMinutes * 0.35,
        stopSurcharge: stopWaitFee,
        total: baseFare + (distanceMiles * 1.25) + (estimatedMinutes * 0.35) + stopWaitFee,
        estimatedMinutes,
        distanceMiles,
        estimatedDistance: distanceMiles,
        estimatedTravelTime: estimatedMinutes,
        stopCount: confirmedStops.length
      };

      console.log(`💰 Calculated fare: $${fallbackEstimate.total.toFixed(2)} (${confirmedStops.length} stops, ${distanceMiles.toFixed(1)} miles, ${estimatedMinutes.toFixed(0)} min)`);
      
      setFareEstimate(fallbackEstimate);
      updateRideOptionPrices(pickup, destination);
    } catch (error) {
      console.warn('Fare calculation error, using fallback:', error);
      updateRideOptionPrices(pickup, destination);
    }
  };

  const updateRideOptionPrices = async (pickup: Location, destination: Location) => {
    const confirmedStops = stops.filter(stop => stop.confirmed && stop.coordinates);
    
    // Use BACKEND API to get accurate distance and surge (consistent with fare breakdown)
    let distanceMiles = 6.0; // fallback
    let estimatedTravelTime = 15; // fallback  
    let globalSurgeMultiplier = 1.0;
    let hasSurge = false;

    try {
      console.log('🔄 Updating ride options with backend distance calculation...');
      const response = await fetch(apiUrl('api/rides/estimate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pickup,
          destination,
          rideType: 'standard' // Use standard as baseline
        }),
      });

      const data = await response.json();
      if (data.success && data.fareEstimate) {
        // Use ACCURATE backend distance and time (Google Maps)
        distanceMiles = data.fareEstimate.estimatedDistance || 6.0;
        estimatedTravelTime = data.fareEstimate.estimatedTravelTime || 15;
        
        // Get surge information
        if (data.fareEstimate.surge) {
          globalSurgeMultiplier = data.fareEstimate.surge.multiplier || 1.0;
          hasSurge = data.fareEstimate.surge.isActive || false;
          
          console.log(`🎯 Backend data: ${distanceMiles.toFixed(2)} miles, ${estimatedTravelTime} min, ${globalSurgeMultiplier.toFixed(1)}x surge`);
          
          // Store surge info for display
          setCurrentSurgeInfo({
            isActive: data.fareEstimate.surge.isActive,
            multiplier: data.fareEstimate.surge.multiplier,
            factors: data.fareEstimate.surge.factors || [],
            demandLevel: data.fareEstimate.surge.demandLevel,
            availableDrivers: data.fareEstimate.surge.availableDrivers,
            pendingRequests: data.fareEstimate.surge.pendingRequests,
            amount: data.fareEstimate.surge.amount
          });
        }
      }
    } catch (error) {
      console.error('Backend ride option pricing error:', error);
    }

    // Add wait time for stops (2.5 minutes per stop)
    const stopWaitTime = confirmedStops.length * 2.5;
    const totalEstimatedTime = estimatedTravelTime + stopWaitTime;

    // Base fare hierarchy (always maintained)
    const baseFaresByType: { [key: string]: number } = {
      economy: 2.10,
      standard: 2.50,
      xl: 3.50,
      premium: 4.50
    };

    // Per-mile and per-minute rates that maintain hierarchy
    const perMileRates: { [key: string]: number } = {
      economy: 1.15,
      standard: 1.25,
      xl: 1.65,
      premium: 1.85
    };

    const perMinuteRates: { [key: string]: number } = {
      economy: 0.30,
      standard: 0.35,
      xl: 0.45,
      premium: 0.55
    };

    // Calculate prices for all vehicle types maintaining hierarchy
    const updatedOptions = rideOptions.map((option) => {
      const baseFare = baseFaresByType[option.id] || baseFaresByType.standard;
      const perMile = perMileRates[option.id] || perMileRates.standard;
      const perMinute = perMinuteRates[option.id] || perMinuteRates.standard;

      // Calculate base price with stop surcharge (using ACCURATE backend distance/time)
      const stopSurcharge = confirmedStops.length * 1.50; // $1.50 per stop
      const basePrice = baseFare + (distanceMiles * perMile) + (totalEstimatedTime * perMinute) + stopSurcharge;
      
      // Apply surge consistently across all vehicle types
      const surgedPrice = basePrice * globalSurgeMultiplier;
      
      // Apply corporate discount (same logic as fare breakdown)
      const discountAmount = userProfile.corporateDiscount?.isActive 
        ? (surgedPrice * (parseFloat(userProfile.corporateDiscount.discountPercentage) / 100))
        : 0;
      const finalPrice = surgedPrice - discountAmount;

      return {
        ...option,
        price: Number(finalPrice.toFixed(2)),
        hasSurge: hasSurge,
        surgeMultiplier: globalSurgeMultiplier,
        eta: Math.max(3, Math.round(totalEstimatedTime + (Math.random() * 2))) // Small random variation for ETA
      };
    });

    // Ensure price hierarchy is maintained (Economy < Standard < XL < Premium)
    updatedOptions.sort((a, b) => {
      const order = { economy: 1, standard: 2, xl: 3, premium: 4 };
      return (order[a.id] || 5) - (order[b.id] || 5);
    });

    // Final verification: if any vehicle type has a higher price than the next tier, adjust
    for (let i = 1; i < updatedOptions.length; i++) {
      if (updatedOptions[i].price <= updatedOptions[i - 1].price) {
        // Ensure minimum 15% price increase between tiers
        updatedOptions[i].price = Number((updatedOptions[i - 1].price * 1.15).toFixed(2));
      }
    }

    setRideOptions(updatedOptions);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const deg2rad = (deg: number) => {
    return deg * (Math.PI / 180);
  };

  const handleDestinationInput = (value: string) => {
    setDestination(value);

    if (value.length > 2) {
      fetchSuggestions(value);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const loadVehicleTypes = async () => {
    try {
      const response = await fetch(apiUrl('api/settings/vehicle-types')).catch(fetchError => {
        console.warn('Vehicle types fetch failed:', fetchError);
        return null;
      });
      
      if (response && response.ok) {
        const data = await response.json().catch(jsonError => {
          console.warn('Vehicle types JSON parse failed:', jsonError);
          return null;
        });
        
        if (data && data.success && data.vehicleTypes) {
          const formattedOptions = data.vehicleTypes.map(vt => ({
            id: vt.id,
            name: vt.name,
            description: vt.description,
            icon: vt.icon,
            price: vt.baseFare,
            eta: 5 + Math.floor(Math.random() * 10),
            multiplier: vt.baseFare / 2.50,
            hasSurge: false,
            surgeMultiplier: 1.0
          }));
          setRideOptions(formattedOptions);
          console.log('✅ Loaded vehicle types from API');
          return;
        }
      }
      
      console.log('🚗 Using default vehicle types');
    } catch (error) {
      console.warn('Error loading vehicle types, using defaults:', error);
    }
  };

  const loadPaymentMethods = async () => {
    setIsLoadingPayments(true);
    try {
      const response = await fetch(apiUrl('api/users/550e8400-e29b-41d4-a716-446655440000/payment-methods'), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token') || ''}`
        }
      }).catch(fetchError => {
        console.warn('Payment methods fetch failed:', fetchError);
        return null;
      });

      if (response && response.ok) {
        const data = await response.json().catch(jsonError => {
          console.warn('Payment methods JSON parse failed:', jsonError);
          return null;
        });
        
        if (data && data.paymentMethods) {
          const formattedMethods = data.paymentMethods.map(pm => ({
            id: pm.id,
            name: `${(pm.brand || 'Card').toUpperCase()} ****${pm.last4 || '****'}`,
            details: `Expires ${pm.exp_month || '12'}/${pm.exp_year || '25'}`,
            icon: getPaymentIcon(pm.brand),
            isDefault: pm.isDefault || false,
            type: pm.type || 'credit'
          }));
          setPaymentMethods(formattedMethods);

          // Set default payment method
          const defaultMethod = formattedMethods.find(m => m.isDefault);
          if (defaultMethod) {
            setSelectedPaymentMethod(defaultMethod);
          } else if (formattedMethods.length > 0) {
            setSelectedPaymentMethod(formattedMethods[0]);
          }
          return;
        }
      }
      
      // Fallback to demo data
      console.log('💳 Using demo payment methods');
      const demoMethods: PaymentMethod[] = [
        { id: 'demo_1', name: 'Visa ****1234', details: 'Expires 12/25', icon: '💳', isDefault: true, type: 'credit' as const },
        { id: 'demo_2', name: 'Apple Pay', details: 'iPhone 15 Pro', icon: '🍎', isDefault: false, type: 'apple_pay' as const },
        { id: 'demo_3', name: 'Google Pay', details: 'Gmail Account', icon: '🔵', isDefault: false, type: 'google_pay' as const }
      ];
      setPaymentMethods(demoMethods);
      setSelectedPaymentMethod(demoMethods[0]);
    } catch (error) {
      console.warn('Error loading payment methods, using fallback:', error);
      // Fallback to demo data
      const demoMethods: PaymentMethod[] = [
        { id: 'demo_1', name: 'Visa ****1234', details: 'Expires 12/25', icon: '💳', isDefault: true, type: 'credit' as const },
        { id: 'demo_2', name: 'Apple Pay', details: 'iPhone 15 Pro', icon: '🍎', isDefault: false, type: 'apple_pay' as const }
      ];
      setPaymentMethods(demoMethods);
      setSelectedPaymentMethod(demoMethods[0]);
    } finally {
      setIsLoadingPayments(false);
    }
  };

  const getPaymentIcon = (brand) => {
    switch (brand?.toLowerCase()) {
      case 'visa': return '💳';
      case 'mastercard': return '💳';
      case 'amex': return '💳';
      case 'discover': return '💳';
      case 'apple_pay': return '🍎';
      case 'google_pay': return '🔵';
      default: return '💳';
    }
  };

  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiryDate = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  const handleAddCard = async (e) => {
    e.preventDefault();
    setIsLoadingPayments(true);

    try {
      if (!window.stripe) {
        throw new Error('Stripe not initialized');
      }

      // Create setup intent for the card
      const response = await fetch(apiUrl('api/users/550e8400-e29b-41d4-a716-446655440000/setup-intent'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          paymentMethodTypes: ['card']
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create setup intent');
      }

      const { client_secret } = await response.json();

      // Use Stripe Elements to securely collect payment info
      const { setupIntent, error } = await window.stripe.confirmCardSetup(client_secret, {
        payment_method: {
          card: {
            number: newPaymentForm.cardNumber.replace(/\s/g, ''),
            exp_month: parseInt(newPaymentForm.expiryDate.split('/')[0]),
            exp_year: parseInt('20' + newPaymentForm.expiryDate.split('/')[1]),
            cvc: newPaymentForm.cvv
          },
          billing_details: {
            name: newPaymentForm.name
          }
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      // Add payment method to backend
      const addResponse = await fetch(apiUrl('api/users/550e8400-e29b-41d4-a716-446655440000/payment-methods'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          paymentMethodId: setupIntent.payment_method,
          isDefault: paymentMethods.length === 0
        })
      });

      if (!addResponse.ok) {
        throw new Error('Failed to save payment method');
      }

      const paymentMethodData = await addResponse.json();

      // Add to state
      setPaymentMethods(prev => [...prev, paymentMethodData.paymentMethod]);

      // Reset form
      setNewPaymentForm({
        cardNumber: '',
        expiryDate: '',
        cvv: '',
        name: '',
        type: 'credit'
      });

      setActivePanel('payments');
      showNotification('💳 Card added successfully!', 'success');
    } catch (error) {
      console.error('Error adding card:', error);
      showNotification('❌ Failed to add card: ' + error.message, 'error');
    } finally {
      setIsLoadingPayments(false);
    }
  };

  const getCardBrand = (cardNumber) => {
    const number = cardNumber.replace(/\s/g, '');
    if (number.startsWith('4')) return 'visa';
    if (number.startsWith('5') || number.startsWith('2')) return 'mastercard';
    if (number.startsWith('3')) return 'amex';
    if (number.startsWith('6')) return 'discover';
    return 'unknown';
  };

  const addDigitalWallet = async (walletType) => {
    // Instead of immediately processing, open the setup form
    setSelectedPaymentType(walletType);
    setActivePanel('add-wallet');
  };

  const setupDigitalWallet = async (walletType, setupData) => {
    setIsLoadingPayments(true);

    try {
      let walletName, walletIcon, walletDetails;

      if (walletType === 'apple_pay') {
        walletName = 'Apple Pay';
        walletIcon = '🍎';
        walletDetails = setupData.deviceName || 'Touch ID / Face ID';

        // Simulate Apple Pay setup verification
        if (!setupData.appleId || !setupData.deviceName) {
          throw new Error('Apple ID and device information required');
        }

        console.log('🍎 Setting up Apple Pay with:', setupData);
      } else if (walletType === 'google_pay') {
        walletName = 'Google Pay';
        walletIcon = '🔵';
        walletDetails = setupData.googleEmail || 'Gmail Account';

        // Simulate Google Pay setup verification
        if (!setupData.googleEmail) {
          throw new Error('Google account email required');
        }

        console.log('🔵 Setting up Google Pay with:', setupData);
      }

      // Check if wallet already exists
      const existingWallet = paymentMethods.find(pm => pm.name === walletName);
      if (existingWallet) {
        throw new Error(`${walletName} is already added`);
      }

      // Simulate wallet setup process
      await new Promise(resolve => setTimeout(resolve, 2000));

      const mockWallet = {
        id: `pm_${walletType}_${Date.now()}`,
        name: walletName,
        details: walletDetails,
        icon: walletIcon,
        isDefault: setupData.makeDefault || paymentMethods.length === 0,
        type: walletType
      };

      setPaymentMethods(prev => [...prev, mockWallet]);

      // If this is set as default, update selected payment method
      if (mockWallet.isDefault) {
        setSelectedPaymentMethod(mockWallet);
        // Update other methods to not be default
        setPaymentMethods(prev => prev.map(pm => 
          pm.id === mockWallet.id ? pm : { ...pm, isDefault: false }
        ));
      }

      showNotification(`${walletName} added successfully!`, 'success');
      setActivePanel('payments');
    } catch (error) {
      console.error(`Error adding ${walletType}:`, error);
      showNotification(`Failed to add ${walletType}: ${error.message}`, 'error');
    } finally {
      setIsLoadingPayments(false);
    }
  };

  const deletePaymentMethod = async (methodId) => {
    if (!confirm('Are you sure you want to delete this payment method?')) return;

    setIsLoadingPayments(true);

    try {
      // In real implementation, call API to delete from Stripe and database
      // For demo, we'll just remove from state
      const methodToDelete = paymentMethods.find(m => m.id === methodId);
      setPaymentMethods(prev => prev.filter(m => m.id !== methodId));

      // If deleted method was selected, select another one
      if (selectedPaymentMethod?.id === methodId) {
        const remainingMethods = paymentMethods.filter(m => m.id !== methodId);
        setSelectedPaymentMethod(remainingMethods[0] || null);
      }

      showNotification(`${methodToDelete?.name || 'Payment method'} deleted successfully`, 'success');
    } catch (error) {
      console.error('Error deleting payment method:', error);
      showNotification('Failed to delete payment method. Please try again.', 'error');
    } finally {
      setIsLoadingPayments(false);
    }
  };

  const showNotification = (message, type = 'info') => {
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
      animation: slideIn 0.3s ease-out;
      max-width: 300px;
    `;

    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 4000);
  };

  const bookRide = async () => {
    setBookingStatus('requesting');
    setRideRequestPromptStatus('searching'); // Show progressive circles
    setIsProcessingPayment(true);

    try {
      // Validate required data before making request
      if (!pickupLocation || !destinationLocation || !destination.trim()) {
        throw new Error('Please set both pickup and destination locations');
      }

      if (!selectedVehicle) {
        throw new Error('Please select a vehicle type');
      }

      console.log('🚗 Booking ride with data:', {
        pickup: pickupLocation,
        destination: destinationLocation,
        rideType: selectedVehicle.id,
        paymentMethod: selectedPaymentMethod?.id
      });

      // First, request the ride with backend
      const rideRequestResponse = await fetch(apiUrl('api/rides/request'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          rider_id: user?.id || '550e8400-e29b-41d4-a716-446655440002', // 🚨 CRITICAL FIX: Explicit rider ID
          pickup: {
            address: 'Current Location',
            coordinates: pickupLocation
          },
          destination: {
            address: destination,
            coordinates: destinationLocation
          },
          rideType: selectedVehicle.id,
          paymentMethodId: selectedPaymentMethod?.id,
          scheduledTime: null,
          riderPreferences: {
            music: userProfile.music,
            conversation: userProfile.conversation,
            temperature: userProfile.temperature
          }
        })
      }).catch(fetchError => {
        console.error('Fetch error:', fetchError);
        throw new Error('Network connection failed');
      });

      console.log('📡 Ride request response status:', rideRequestResponse.status);

      // Check if response has content
      const responseText = await rideRequestResponse.text().catch(textError => {
        console.error('Failed to read response text:', textError);
        throw new Error('Invalid server response');
      });
      
      console.log('📡 Raw response:', responseText);

      if (!rideRequestResponse.ok) {
        let errorMessage = 'Failed to request ride';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
          errorMessage = `Server error (${rideRequestResponse.status})`;
        }
        throw new Error(errorMessage);
      }

      // Parse the response
      let rideData;
      try {
        rideData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse successful response:', parseError);
        throw new Error('Invalid response from server');
      }

      // Handle different payment methods for ride payment
      let paymentResult = null;

      try {
        if (selectedPaymentMethod?.type === 'apple_pay') {
          paymentResult = await processApplePayPayment(rideData.ride?.estimatedFare || rideData.ride?.estimated_fare || selectedVehicle.price);
        } else if (selectedPaymentMethod?.type === 'google_pay') {
          paymentResult = await processGooglePayPayment(rideData.ride?.estimatedFare || rideData.ride?.estimated_fare || selectedVehicle.price);
        } else {
          // Traditional card payment
          console.log('Processing traditional card payment...');
          await new Promise(resolve => setTimeout(resolve, 1500));
          paymentResult = { success: true, paymentId: 'pm_' + Date.now() };
        }
      } catch (paymentError) {
        console.error('Payment processing error:', paymentError);
        paymentResult = { success: false, error: paymentError.message };
      }

      if (!paymentResult || !paymentResult.success) {
        throw new Error('Payment failed: ' + (paymentResult?.error || 'Unknown payment error'));
      }

      const newRide = {
        id: rideData.ride?.id || `ride_${Date.now()}`,
        pickup: pickupLocation,
        destination: destinationLocation,
        vehicle: selectedVehicle,
        fare: rideData.ride?.estimated_fare || rideData.ride?.estimatedFare || selectedVehicle.price,
        paymentMethod: selectedPaymentMethod?.type || selectedPaymentType,
        paymentId: paymentResult.paymentId,
        status: 'requested',
        requestedAt: new Date(),
        pickupAddress: 'Current Location',
        destinationAddress: destination
      };

      setCurrentRide(newRide);
      setBookingStatus('searching'); // Wait for driver acceptance via cascading
      setActivePanel('none'); // Don't show tracking until driver accepts

      // Update user's total rides count locally
      setUserProfile(prev => ({
        ...prev,
        totalRides: prev.totalRides + 1
      }));

      // Progressive green lights prompt will handle the visual feedback
      console.log('✅ Ride created:', newRide.id);
    } catch (error) {
      console.error('Booking error:', error);
      
      // Provide more specific error messages
      let errorMessage = error.message || 'Unknown error occurred';
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network connection failed')) {
        errorMessage = 'Cannot connect to server. Please check your connection.';
      } else if (errorMessage.includes('JSON') || errorMessage.includes('Invalid response')) {
        errorMessage = 'Server communication error. Please try again.';
      } else if (errorMessage.includes('500')) {
        errorMessage = 'Server error. Please try again in a moment.';
      }
      
      showNotification('❌ Booking failed: ' + errorMessage, 'error');
      setBookingStatus('idle');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const processTip = async (rideId, tipAmount, tipPercentage) => {
    if (!selectedPaymentMethod) {
      showNotification('❌ Please select a payment method', 'error');
      return;
    }

    setIsProcessingPayment(true);

    try {
      const response = await fetch(`/api/rides/${rideId}/tip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          tipAmount,
          tipPercentage,
          paymentMethodId: selectedPaymentMethod.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process tip');
      }

      const tipData = await response.json();
      showNotification(`✅ $${tipAmount.toFixed(2)} tip sent successfully!`, 'success');

      // Update current ride with tip information
      if (currentRide && currentRide.id === rideId) {
        setCurrentRide(prev => ({
          ...prev,
          tip: {
            amount: tipAmount,
            percentage: tipPercentage,
            processed: true
          }
        }));
      }

      return tipData;
    } catch (error) {
      console.error('Tip processing error:', error);
      showNotification('❌ Tip failed: ' + error.message, 'error');
      throw error;
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const cancelRide = async (rideId, reason = 'Rider cancelled') => {
    setIsProcessingPayment(true);

    try {
      const response = await fetch(`/api/rides/${rideId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          reason,
          userType: 'rider'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel ride');
      }

      const cancellationData = await response.json();

      // Show appropriate message based on refund amount
      if (cancellationData.cancellation.refundAmount > 0) {
        showNotification(
          `✅ Ride cancelled. $${cancellationData.cancellation.refundAmount} refund processed.`,
          'success'
        );
      } else {
        showNotification(
          `⚠️ Ride cancelled. Cancellation fee: $${cancellationData.cancellation.cancellationFee}`,
          'warning'
        );
      }

      // Reset ride state
      setCurrentRide(null);
      setBookingStatus('idle');
      setActivePanel('none');

      return cancellationData;
    } catch (error) {
      console.error('Cancellation error:', error);
      showNotification('❌ Cancellation failed: ' + error.message, 'error');
      throw error;
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handlePickupAddressInput = (input: string) => {
    setPickupAddress(input);
    
    if (input.trim().length > 2) {
      fetchPickupSuggestions(input.trim());
    } else {
      setPickupSuggestions([]);
      setShowPickupSuggestions(false);
    }
  };

  const selectPickupSuggestion = (suggestion: LocationSuggestion) => {
    setPickupAddress(suggestion.main_text);
    setShowPickupSuggestions(false);
    
    // Geocode the selected pickup address to get coordinates
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ placeId: suggestion.place_id }, (results: any, status: any) => {
      if (status === 'OK' && results[0]) {
        const location = {
          lat: results[0].geometry.location.lat(),
          lng: results[0].geometry.location.lng()
        };
        
        console.log('📍 New pickup location from address:', location);
        setPickupLocation(location);
        setCurrentLocation(location);
        
        // Update the red pin position
        if (map) {
          addCurrentLocationMarker(map, location);
          // Center map on new pickup location
          map.setCenter(location);
        }
        
        // Recalculate route and fare if destination is set
        if (destinationCoords) {
          calculateRoute(location, destinationCoords);
          calculateFareEstimate(location, destinationCoords, selectedRide);
        }
        
        showNotification(`📍 Pickup set to: ${suggestion.description}`, 'success');
      }
    });
  };

  const startPickupVoiceRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      showNotification('❌ Voice recognition not supported in this browser', 'error');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      console.log('🎤 Pickup voice recognition listening...');
      showNotification('🎤 Say your pickup address...', 'info');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      console.log('🗣️ Pickup voice input:', transcript);
      
      setPickupAddress(transcript);
      handlePickupAddressInput(transcript);
    };

    recognition.onerror = (event) => {
      console.error('Pickup voice recognition error:', event.error);
      showNotification('❌ Voice recognition failed', 'error');
    };

    recognition.onend = () => {
      console.log('🎤 Pickup voice recognition ended');
    };

    recognition.start();
  };

  const startVoiceRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice recognition not supported in this browser');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      console.log('🎤 Hey Pi listening...');
      // Visual feedback that Pi is listening
      const micIcon = document.querySelector('[title="Hey Pi - Voice Command"]') as HTMLElement;
      if (micIcon) {
        micIcon.style.color = '#ef4444';
        micIcon.style.animation = 'pulse 1s infinite';
      }
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase().trim();
      console.log('🗣️ Voice command:', transcript);

      // Hey Pi command processing
      if (transcript.includes('hey pi') || transcript.includes('hey pie')) {
        processVoiceCommand(transcript);
      } else {
        // Treat as destination search
        setDestination(transcript);
        handleDestinationInput(transcript);
      }
    };

    recognition.onerror = (event) => {
      console.error('Voice recognition error:', event.error);
      resetMicIcon();
    };

    recognition.onend = () => {
      console.log('🎤 Voice recognition ended');
      resetMicIcon();
    };

    recognition.start();
  };

  // Voice input for stops
  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Voice recognition not supported in this browser. Please type your address instead.');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    setIsListening(true);

    recognition.onstart = () => {
      console.log('🎤 Listening for stop address...');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      console.log('🗣️ Stop address heard:', transcript);
      
      // Set the input value with the spoken address
      setCurrentStopInput(transcript);
      
      // Trigger Google Places autocomplete search
      if (autocompleteService && transcript) {
        autocompleteService.getPlacePredictions(
          {
            input: transcript,
            types: ['establishment', 'geocode'],
            componentRestrictions: { country: 'us' },
            // Add location bias for voice recognition too
            locationBias: currentLocation ? {
              radius: 50000, // 50km radius
              center: new window.google.maps.LatLng(currentLocation.lat, currentLocation.lng)
            } : undefined
          },
          (predictions: any[], status: any) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions && predictions.length > 0) {
              // Use the first prediction as the address
              const bestMatch = predictions[0];
              setCurrentStopInput(bestMatch.description);
              console.log('📍 Voice input matched to:', bestMatch.description);
            }
          }
        );
      }
    };

    recognition.onerror = (event) => {
      console.error('Voice recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'no-speech') {
        alert('No speech detected. Please try again or type your address.');
      } else if (event.error === 'not-allowed') {
        alert('Microphone access denied. Please enable microphone permissions and try again.');
      }
    };

    recognition.onend = () => {
      console.log('🎤 Voice recognition ended');
      setIsListening(false);
    };

    recognition.start();
  };

  // Fetch suggestions for stops
  const fetchStopSuggestions = (input: string) => {
    console.log('🔍 fetchStopSuggestions called with:', input);
    if (!autocompleteService) {
      console.log('❌ No autocompleteService available');
      return;
    }

    const request = {
      input: input,
      componentRestrictions: { country: 'us' },
      types: ['geocode', 'establishment'],
      // Use new locationBias for distance-based sorting
      locationBias: currentLocation ? {
        radius: 50000, // 50km radius
        center: new window.google.maps.LatLng(currentLocation.lat, currentLocation.lng)
      } : undefined
    };

    console.log('🔍 Making Google Places request...');
    autocompleteService.getPlacePredictions(request, (predictions: any[], status: any) => {
      console.log('🔍 Google Places response:', { status, predictions: predictions?.length });
      if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
        const formattedSuggestions = predictions.map((prediction: any) => ({
          place_id: prediction.place_id,
          description: prediction.description,
          main_text: prediction.structured_formatting.main_text,
          secondary_text: prediction.structured_formatting.secondary_text || ''
        }));
        console.log('✅ Setting stop suggestions:', formattedSuggestions.length, 'items');
        setStopSuggestions(formattedSuggestions);
        setShowStopSuggestions(true);
      } else {
        console.log('❌ No predictions or error:', status);
        setStopSuggestions([]);
        setShowStopSuggestions(false);
      }
    });
  };

  // Handle stop input changes
  const handleStopInput = (value: string) => {
    console.log('🔍 Stop input changed:', value);
    setCurrentStopInput(value);

    if (value.length > 2) {
      console.log('🔍 Fetching stop suggestions for:', value);
      fetchStopSuggestions(value);
    } else {
      setStopSuggestions([]);
      setShowStopSuggestions(false);
    }
  };

  // Select a stop suggestion
  const selectStopSuggestion = (suggestion: LocationSuggestion) => {
    setCurrentStopInput(suggestion.description);
    setShowStopSuggestions(false);
  };

  const resetMicIcon = () => {
    const micIcon = document.querySelector('[title="Hey Pi - Voice Command"]') as HTMLElement;
    if (micIcon) {
      micIcon.style.color = '#3b82f6';
      micIcon.style.animation = 'none';
    }
  };

  const processVoiceCommand = (command: string) => {
    console.log('🤖 Hey Pi processing:', command);

    // Pi voice commands
    if (command.includes('take me home')) {
      setDestination('Home');
      handleDestinationInput('Home');
    } else if (command.includes('take me to work')) {
      setDestination('Work');
      handleDestinationInput('Work');
    } else if (command.includes('airport')) {
      setDestination('Airport');
      handleDestinationInput('Airport');
    } else if (command.includes('book a ride')) {
      if (destination.trim() && currentLocation) {
        bookRide();
      } else {
        alert('Please set a destination first');
      }
    } else if (command.includes('show me nearby')) {
      getCurrentLocation(map);
    } else {
      // Extract destination from command
      const destinationText = command.replace(/hey pi,?\s*/i, '').replace(/take me to\s*/i, '');
      if (destinationText) {
        setDestination(destinationText);
        handleDestinationInput(destinationText);
      }
    }
  };

  // Payment method handlers
  const handlePaymentTypeSelect = (type) => {
    setSelectedPaymentType(type);

    if (type === 'apple_pay') {
      initializeApplePay();
    } else if (type === 'google_pay') {
      initializeGooglePay();
    }
  };

  const initializeApplePay = async () => {
    try {
      // Check if Apple Pay is available
      if (window.ApplePaySession && window.ApplePaySession.canMakePayments()) {
        console.log('Apple Pay is available');

        // Check if user has cards set up
        const canMakePaymentsWithActiveCard = await window.ApplePaySession.canMakePaymentsWithActiveCard('merchant.your-app-id');

        if (canMakePaymentsWithActiveCard) {
          console.log('Apple Pay can make payments with active card');
          // Apple Pay is ready to use
          setActivePanel('booking');
        } else {
          // Prompt user to set up Apple Pay
          alert('Please set up Apple Pay in your device settings to use this payment method.');
        }
      } else {
        alert('Apple Pay is not supported on this device/browser.');
      }
    } catch (error) {
      console.error('Apple Pay initialization error:', error);
      alert('Apple Pay is not available. Please choose another payment method.');
    }
  };

  const initializeGooglePay = async () => {
    try {
      // Check if Google Pay is available
      if (window.google && (window.google as any).payments) {
        const paymentsClient = new (window.google as any).payments.api.PaymentsClient({
          environment: 'TEST' // Change to 'PRODUCTION' for live
        });

        const isReadyToPayRequest = {
          apiVersion: 2,
          apiVersionMinor: 0,
          allowedPaymentMethods: [{
            type: 'CARD',
            parameters: {
              allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
              allowedCardNetworks: ['VISA', 'MASTERCARD', 'AMEX']
            }
          }]
        };

        const isReadyToPay = await paymentsClient.isReadyToPay(isReadyToPayRequest);

        if (isReadyToPay.result) {
          console.log('Google Pay is available');
          setActivePanel('booking');
        } else {
          alert('Google Pay is not available on this device.');
        }
      } else {
        alert('Google Pay is not supported on this browser.');
      }
    } catch (error) {
      console.error('Google Pay initialization error:', error);
      alert('Google Pay is not available. Please choose another payment method.');
    }
  };

  const processApplePayPayment = async (amount) => {
    try {
      if (!window.ApplePaySession) {
        throw new Error('Apple Pay not available on this device');
      }

      const paymentRequest = {
        countryCode: 'US',
        currencyCode: 'USD',
        supportedNetworks: ['visa', 'masterCard', 'amex'],
        merchantCapabilities: ['supports3DS'],
        total: {
          label: 'Ride Payment',
          amount: (amount || 0).toString()
        }
      };

      const session = new window.ApplePaySession!(3, paymentRequest);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          session.abort();
          reject(new Error('Apple Pay timeout'));
        }, 30000);

        session.onvalidatemerchant = async (event) => {
          try {
            // In production, validate with your server
            const merchantSession = await fetch(apiUrl('api/payments/apple-pay/validate'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ validationURL: event.validationURL })
            }).then(res => res.json()).catch(err => {
              console.warn('Apple Pay validation failed:', err);
              return { success: false };
            });

            if (merchantSession.success !== false) {
              session.completeMerchantValidation(merchantSession);
            } else {
              session.abort();
              reject(new Error('Merchant validation failed'));
            }
          } catch (error) {
            session.abort();
            reject(error);
          }
        };

        session.onpaymentauthorized = async (event) => {
          try {
            // Process payment with your backend
            const result = await fetch(apiUrl('api/payments/apple-pay/process'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                payment: event.payment,
                amount: amount
              })
            }).then(res => res.json()).catch(err => {
              console.warn('Apple Pay processing failed:', err);
              return { success: false, error: 'Processing failed' };
            });

            clearTimeout(timeout);

            if (result.success) {
              session.completePayment(window.ApplePaySession!.STATUS_SUCCESS);
              resolve(result);
            } else {
              session.completePayment(window.ApplePaySession!.STATUS_FAILURE);
              reject(new Error(result.error || 'Payment failed'));
            }
          } catch (error) {
            clearTimeout(timeout);
            session.completePayment(window.ApplePaySession!.STATUS_FAILURE);
            reject(error);
          }
        };

        session.oncancel = () => {
          clearTimeout(timeout);
          reject(new Error('Payment cancelled by user'));
        };

        session.begin();
      });
    } catch (error) {
      console.error('Apple Pay error:', error);
      throw error;
    }
  };

  const processGooglePayPayment = async (amount) => {
    try {
      if (!window.google || !window.google.payments) {
        throw new Error('Google Pay not available on this device');
      }

      const paymentsClient = new (window.google as any).payments.api.PaymentsClient({
        environment: 'TEST' // Change to 'PRODUCTION' for live
      });

      const paymentDataRequest = {
        apiVersion: 2,
        apiVersionMinor: 0,
        allowedPaymentMethods: [{
          type: 'CARD',
          parameters: {
            allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
            allowedCardNetworks: ['VISA', 'MASTERCARD', 'AMEX']
          },
          tokenizationSpecification: {
            type: 'PAYMENT_GATEWAY',
            parameters: {
              gateway: 'stripe',
              'stripe:version': '2020-08-27',
              'stripe:publishableKey': import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_demo'
            }
          }
        }],
        merchantInfo: {
          merchantId: 'merchant-id',
          merchantName: 'π Ride App'
        },
        transactionInfo: {
          totalPriceStatus: 'FINAL',
          totalPrice: (amount || 0).toString(),
          currencyCode: 'USD'
        }
      };

      const paymentData = await paymentsClient.loadPaymentData(paymentDataRequest).catch(loadError => {
        console.warn('Google Pay load failed:', loadError);
        throw new Error('Failed to load Google Pay');
      });

      // Process with your backend
      const result = await fetch(apiUrl('api/payments/google-pay/process'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentData: paymentData,
          amount: amount
        })
      }).then(res => res.json()).catch(processError => {
        console.warn('Google Pay processing failed:', processError);
        return { success: false, error: 'Processing failed' };
      });

      if (!result.success) {
        throw new Error(result.error || 'Google Pay processing failed');
      }

      return result;
    } catch (error) {
      console.error('Google Pay payment error:', error);
      throw error;
    }
  };

  return (
    <div style={{ 
      maxWidth: '450px', 
      margin: '0 auto', 
      height: '100vh', 
      backgroundColor: '#f8fafc', 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{ 
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', 
        color: 'white', 
        padding: '16px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <button 
          onClick={() => setShowMenu(!showMenu)}
          style={{ 
            background: 'rgba(255,255,255,0.1)', 
            border: 'none', 
            borderRadius: '8px', 
            padding: '8px', 
            color: 'white', 
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.2)'}
          onMouseLeave={(e) => (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.1)'}
        >
          <Menu size={20} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '48px', fontWeight: '700', margin: 0 }}>π</h1>
          <p style={{ fontSize: '16px', opacity: 0.8, margin: 0, color: '#3b82f6' }}>Your VIP Ride</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            onClick={() => setShowProfile(!showProfile)}
            style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '50%', 
              background: 'rgba(255,255,255,0.1)', 
              border: 'none',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'white',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.2)'}
            onMouseLeave={(e) => (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.1)'}
          >
            <User size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div 
        style={{ flex: 1, padding: '16px', overflow: 'auto' }}
        onClick={(e) => {
          // Only close panels if clicking directly on content, not on form elements
          if (e.target === e.currentTarget) {
            if (showMenu) setShowMenu(false);
            if (showProfile) setShowProfile(false);
            if (activePanel !== 'none') setActivePanel('none');
          }
        }}
      >
        {/* Where to Section */}
        <div style={{ 
          backgroundColor: 'white', 
          padding: '16px', 
          borderRadius: '16px', 
          marginBottom: '16px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1f2937' }}>Where to?</h2>
          
          {/* NEW: PICKUP ADDRESS INPUT */}
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <MapPin size={18} style={{ 
              position: 'absolute', 
              left: '12px', 
              top: '50%', 
              transform: 'translateY(-50%)', 
              color: '#ef4444'
            }} />
            <input
              type="text"
              value={pickupAddress}
              onChange={(e) => handlePickupAddressInput(e.target.value)}
              placeholder="Drag the Red Pin or enter pickup address..."
              style={{
                width: '100%',
                padding: '10px 44px 10px 40px',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: '12px',
                outline: 'none',
                backgroundColor: '#f9fafb'
              }}
              onFocus={(e) => { 
                (e.target as HTMLElement).style.borderColor = '#ef4444';
              }}
              onBlur={(e) => {
                (e.target as HTMLElement).style.borderColor = '#e5e7eb';
                setTimeout(() => setShowPickupSuggestions(false), 200);
              }}
            />
            <Mic 
              size={16} 
              style={{ 
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#3b82f6',
                cursor: 'pointer'
              }} 
              onClick={() => startPickupVoiceRecognition()}
            />

            {/* Pickup Address Suggestions */}
            {showPickupSuggestions && pickupSuggestions.length > 0 && (
              <div style={{ 
                position: 'absolute', 
                top: '100%', 
                left: '0', 
                right: '0', 
                backgroundColor: 'white', 
                border: '2px solid #ef4444', 
                borderTop: 'none',
                borderRadius: '0 0 10px 10px', 
                boxShadow: '0 4px 12px rgba(239,68,68,0.15)', 
                zIndex: 10,
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                {pickupSuggestions.map((suggestion) => (
                  <div 
                    key={suggestion.place_id} 
                    onClick={() => selectPickupSuggestion(suggestion)} 
                    style={{ 
                      padding: '12px', 
                      cursor: 'pointer', 
                      borderBottom: '1px solid #fef2f2',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    <MapPin size={16} color="#ef4444" />
                    <div>
                      <div style={{ fontWeight: '600', color: '#1f2937', fontSize: '12px' }}>{suggestion.main_text}</div>
                      {suggestion.secondary_text && (
                        <div style={{ fontSize: '10px', color: '#6b7280' }}>{suggestion.secondary_text}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* UPDATED: DESTINATION INPUT */}
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ 
              position: 'absolute', 
              left: '12px', 
              top: '50%', 
              transform: 'translateY(-50%)', 
              color: '#9ca3af' 
            }} />
            <input
              type="text"
              value={destination}
              onChange={(e) => handleDestinationInput(e.target.value)}
              placeholder="Tell me where you'd like to go..."
              style={{
                width: '100%',
                padding: '10px 80px 10px 40px',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: '12px',
                outline: 'none'
              }}
              onFocus={(e) => { 
                (e.target as HTMLElement).style.borderColor = '#3b82f6';
                // Clear the destination when user taps to enter new location
                setDestination('');
                // Clear destination coordinates and related state
                setDestinationCoords(null);
                setDestinationLocation(null);
                setFareEstimate(null);
                // Hide suggestions initially
                setShowSuggestions(false);
              }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />
            {/* UPDATED: Map Controls - Removed green arrow */}
            <div style={{ 
              position: 'absolute', 
              right: '12px', 
              top: '50%', 
              transform: 'translateY(-50%)', 
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <div 
                style={{ 
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '20px',
                  height: '20px'
                }} 
                onClick={() => {
                  console.log('🗺️ Manual Google Maps refresh activated');
                  initializeGoogleMaps();
                }}
              >
                🔄
              </div>
              <Mic 
                size={16} 
                style={{ 
                  color: '#3b82f6',
                  cursor: 'pointer'
                }} 
                onClick={() => startVoiceRecognition()}
              />
            </div>

            {/* Suggestions */}
            {showSuggestions && suggestions.length > 0 && (
              <div style={{ 
                position: 'absolute', 
                top: '100%', 
                left: '0', 
                right: '0', 
                backgroundColor: 'white', 
                border: '2px solid #e5e7eb', 
                borderTop: 'none',
                borderRadius: '0 0 12px 12px', 
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)', 
                zIndex: 10,
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                {suggestions.map((suggestion) => (
                  <div 
                    key={suggestion.place_id} 
                    onClick={() => selectSuggestion(suggestion)} 
                    style={{ 
                      padding: '12px', 
                      cursor: 'pointer', 
                      borderBottom: '1px solid #f3f4f6',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    <MapPin size={16} color="#6b7280" />
                    <div>
                      <div style={{ fontWeight: '600', color: '#1f2937' }}>{suggestion.main_text}</div>
                      {suggestion.secondary_text && (
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>{suggestion.secondary_text}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div style={{ 
          height: '300px', 
          backgroundColor: '#e5e7eb', 
          borderRadius: '16px', 
          marginBottom: '16px',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />


          {!isMapLoaded && (
            <div style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: 'white', 
              textAlign: 'center' 
            }}>
              <div>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗺️</div>
                <div>Loading Map...</div>
              </div>
            </div>
          )}
        </div>


        {/* Scheduled Rides */}
        <div style={{ 
          backgroundColor: 'white', 
          padding: '16px', 
          borderRadius: '16px', 
          marginBottom: '16px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          border: '2px solid #f3f4f6'
        }}>
          <button
            onClick={() => setShowScheduleCard(!showScheduleCard)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'transparent',
              border: 'none',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              padding: '8px 0'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🗓️</span>
              <span>Schedule Your Ride</span>
            </div>
            <span style={{ fontSize: '18px', transform: showScheduleCard ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>
              ▼
            </span>
          </button>

          {showScheduleCard && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
              {/* Date and Time Selection */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                  Select Date & Time
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                    />
                  </div>
                  <div>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '14px',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                    />
                  </div>
                </div>
              </div>

              {/* Scheduled Ride Options */}
              {scheduleDate && scheduleTime && (
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#374151' }}>
                    Choose Your Ride
                  </label>
                  <div style={{ marginBottom: '16px' }}>
                    {rideOptions.map((option) => (
                      <div 
                        key={`scheduled-${option.id}`}
                        onClick={() => setScheduledRideType(option.id)}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between', 
                          padding: '12px', 
                          border: `2px solid ${scheduledRideType === option.id ? '#3b82f6' : '#e5e7eb'}`, 
                          borderRadius: '8px', 
                          marginBottom: '8px', 
                          cursor: 'pointer',
                          backgroundColor: scheduledRideType === option.id ? '#eff6ff' : 'white',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <img 
                            src={option.icon} 
                            alt={`${option.name} car`} 
                            style={{ 
                              width: '32px', 
                              height: '32px', 
                              objectFit: 'contain'
                            }} 
                          />
                          <div>
                            <div style={{ fontWeight: '600', fontSize: '14px', color: '#1f2937' }}>
                              {option.name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>
                              {option.description}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: '600', color: '#1f2937', fontSize: '14px' }}>
                            ${option.price.toFixed(2)}
                          </div>
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>
                            {option.eta} min
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Schedule Ride Button */}
                  <button
                    onClick={() => {
                      // Handle scheduled ride booking
                      setIsScheduled(true);
                      alert(`Ride scheduled for ${scheduleDate} at ${scheduleTime} with ${rideOptions.find(r => r.id === scheduledRideType)?.name}`);
                      setShowScheduleCard(false);
                    }}
                    disabled={!scheduleDate || !scheduleTime || !scheduledRideType}
                    style={{
                      width: '100%',
                      padding: '16px',
                      backgroundColor: (!scheduleDate || !scheduleTime || !scheduledRideType) ? '#9ca3af' : '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: (!scheduleDate || !scheduleTime || !scheduledRideType) ? 'not-allowed' : 'pointer',
                      transition: 'background-color 0.2s ease'
                    }}
                  >
                    📅 Schedule Ride
                  </button>
                </div>
              )}

              {/* Scheduled Ride Info */}
              {isScheduled && (
                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  backgroundColor: '#dcfce7',
                  borderRadius: '8px',
                  border: '1px solid #16a34a'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#16a34a', marginBottom: '4px' }}>
                    ✅ Ride Scheduled
                  </div>
                  <div style={{ fontSize: '12px', color: '#15803d' }}>
                    {scheduleDate} at {scheduleTime} • {rideOptions.find(r => r.id === scheduledRideType)?.name}
                  </div>
                  <button
                    onClick={() => {
                      setIsScheduled(false);
                      setScheduleDate('');
                      setScheduleTime('');
                      setScheduledRideType('standard');
                    }}
                    style={{
                      marginTop: '8px',
                      padding: '6px 12px',
                      backgroundColor: 'transparent',
                      border: '1px solid #16a34a',
                      borderRadius: '6px',
                      color: '#16a34a',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel Schedule
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Multiple Stops */}
        <div style={{ 
          backgroundColor: 'white', 
          padding: '16px', 
          borderRadius: '16px', 
          marginBottom: '16px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          border: '2px solid #f3f4f6'
        }}>
          <button
            onClick={() => setShowStopsCard(!showStopsCard)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'transparent',
              border: 'none',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              padding: '8px 0'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🛣️</span>
              <span>Add a Stop</span>
            </div>
            <span style={{ fontSize: '18px', transform: showStopsCard ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>
              ▼
            </span>
          </button>

          {showStopsCard && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
              {/* Current stop input */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                  Add Stop Location
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={currentStopInput}
                    onChange={(e) => handleStopInput(e.target.value)}
                    placeholder="Enter address or business name..."
                    style={{
                      width: '100%',
                      padding: '12px 50px 12px 12px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb';
                      // Delay hiding suggestions to allow for clicking
                      setTimeout(() => setShowStopSuggestions(false), 200);
                    }}
                  />
                  <button
                    onClick={handleVoiceInput}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      padding: '8px',
                      backgroundColor: isListening ? '#ef4444' : 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '16px',
                      transition: 'background-color 0.2s'
                    }}
                    title={isListening ? "Listening..." : "Voice input"}
                  >
                    {isListening ? '🔴' : '🎤'}
                  </button>
                </div>

                {/* Stop suggestions dropdown */}
                {showStopSuggestions && stopSuggestions.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: '0',
                    right: '0',
                    backgroundColor: 'white',
                    border: '2px solid #e5e7eb',
                    borderTop: 'none',
                    borderRadius: '0 0 8px 8px',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                    zIndex: 1000,
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}>
                    {stopSuggestions.map((suggestion, index) => (
                      <button
                        key={suggestion.place_id}
                        onClick={() => selectStopSuggestion(suggestion)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: 'none',
                          backgroundColor: 'transparent',
                          textAlign: 'left',
                          cursor: 'pointer',
                          borderBottom: index < stopSuggestions.length - 1 ? '1px solid #f3f4f6' : 'none'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div style={{ fontWeight: '600', fontSize: '14px', color: '#374151' }}>
                          {suggestion.main_text}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                          {suggestion.secondary_text}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Confirmed stops */}
              {stops.map((stop, index) => (
                <div key={stop.id} style={{
                  padding: '12px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ 
                      backgroundColor: '#000', 
                      color: 'white', 
                      borderRadius: '50%', 
                      width: '20px', 
                      height: '20px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      fontSize: '10px',
                      fontWeight: '600'
                    }}>
                      {index + 1}
                    </span>
                    <span style={{ fontSize: '14px', color: '#374151' }}>
                      {stop.address}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      // Remove from stops list
                      setStops(stops.filter(s => s.id !== stop.id));
                      
                      // Remove corresponding marker from map
                      const markerIndex = stops.findIndex(s => s.id === stop.id);
                      if (markerIndex !== -1 && stopMarkers[markerIndex]) {
                        stopMarkers[markerIndex].setMap(null);
                        setStopMarkers(prev => prev.filter((_, i) => i !== markerIndex));
                      }
                      
                      console.log(`📍 Removed stop: ${stop.address}`);
                      
                      // Recalculate route and pricing after removing stop
                      if (currentLocation && destinationCoords) {
                        calculateRoute(currentLocation, destinationCoords);
                        calculateFareEstimate(currentLocation, destinationCoords, selectedRide);
                      }
                    }}
                    style={{
                      padding: '4px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                {currentStopInput && (
                  <button
                    onClick={() => {
                      if (currentStopInput.trim()) {
                        const stopAddress = currentStopInput.trim();
                        setCurrentStopInput('');
                        
                        // Geocode FIRST, then add stop with coordinates
                        if (window.google && window.google.maps) {
                          const geocoder = new window.google.maps.Geocoder();
                          geocoder.geocode({ address: stopAddress }, (results, status) => {
                            if (status === 'OK' && results && results[0]) {
                              const location = results[0].geometry.location;
                              const stopIndex = stops.length + 1; // Next stop number
                              const stopCoordinates = { lat: location.lat(), lng: location.lng() };
                              
                              // Create new stop WITH coordinates already available
                              const newStop = {
                                id: Date.now().toString(),
                                address: stopAddress,
                                coordinates: stopCoordinates,
                                confirmed: true
                              };
                              
                              // Add stop to state
                              setStops([...stops, newStop]);
                              
                              // Create numbered black marker
                              const marker = new window.google.maps.Marker({
                                position: location,
                                map: map,
                                title: `Stop ${stopIndex}: ${stopAddress}`,
                                icon: {
                                  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                                    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                                      <circle cx="16" cy="16" r="14" fill="#000000" stroke="#ffffff" stroke-width="2"/>
                                      <text x="16" y="20" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#ffffff">${stopIndex}</text>
                                    </svg>
                                  `)}`,
                                  scaledSize: new window.google.maps.Size(32, 32),
                                  anchor: new window.google.maps.Point(16, 16)
                                }
                              });
                              
                              // Store marker for cleanup
                              setStopMarkers(prev => [...prev, marker]);
                              
                              console.log(`📍 Added stop ${stopIndex} marker:`, stopAddress);
                              
                              // Route and pricing will be auto-recalculated by useEffect
                            }
                          });
                        }
                      }
                    }}
                    style={{
                      padding: '12px 16px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    ✓ Confirm Stop
                  </button>
                )}
                
                {stops.length > 0 && stops.length < 3 && (
                  <button
                    onClick={() => {
                      // Focus on input for new stop
                      setCurrentStopInput('');
                    }}
                    style={{
                      padding: '12px 16px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    + Add Another Stop
                  </button>
                )}
              </div>

              {stops.length >= 3 && (
                <div style={{
                  marginTop: '12px',
                  padding: '8px',
                  backgroundColor: '#fef3c7',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#92400e',
                  textAlign: 'center'
                }}>
                  Maximum 3 stops allowed
                </div>
              )}
            </div>
          )}
        </div>

        {/* Surge Status Display */}
        {destination && currentSurgeInfo && (
          <div style={{
            backgroundColor: currentSurgeInfo.isActive ? '#fef2f2' : '#f0f9ff',
            border: `2px solid ${currentSurgeInfo.isActive ? '#fca5a5' : '#93c5fd'}`,
            borderRadius: '16px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '20px' }}>{currentSurgeInfo.isActive ? '🔥' : '💎'}</span>
                <h3 style={{ 
                  fontSize: '16px', 
                  fontWeight: '700', 
                  color: currentSurgeInfo.isActive ? '#dc2626' : '#2563eb',
                  margin: 0
                }}>
                  {currentSurgeInfo.isActive ? 'Surge Pricing Active' : 'Standard Pricing'}
                </h3>
              </div>
              <div style={{
                backgroundColor: currentSurgeInfo.isActive ? '#dc2626' : '#10b981',
                color: 'white',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '700'
              }}>
                {currentSurgeInfo.multiplier.toFixed(1)}x
              </div>
            </div>
            
            <div style={{ fontSize: '14px', color: '#374151', marginBottom: '8px' }}>
              <strong>Demand Level:</strong> {currentSurgeInfo.demandLevel} • 
              <strong> Drivers in your Area:</strong> {currentSurgeInfo.availableDrivers} • 
              <strong> Pending Requests:</strong> {currentSurgeInfo.pendingRequests}
            </div>
            
            {currentSurgeInfo.factors && currentSurgeInfo.factors.length > 0 && (
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                <strong>Surge Factors:</strong> {currentSurgeInfo.factors.join(' • ')}
              </div>
            )}
            
            {currentSurgeInfo.amount > 0 && (
              <div style={{ 
                marginTop: '8px', 
                fontSize: '12px', 
                color: '#dc2626',
                fontWeight: '600'
              }}>
                +${currentSurgeInfo.amount.toFixed(2)} surge added to base fare
              </div>
            )}
          </div>
        )}

        {/* Ride Options */}
        <div style={{ 
          backgroundColor: 'white', 
          padding: '20px', 
          borderRadius: '16px', 
          marginBottom: '16px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Choose your ride</h3>
          {rideOptions.map((option) => (
            <div 
              key={option.id} 
              onClick={() => {
                setSelectedRide(option.id);
                setSelectedVehicle(option); // Set selected vehicle
                console.log('Vehicle selected:', option); // Debug log
                
                // Recalculate fare estimate for the selected vehicle type
                if (pickupLocation && destinationCoords) {
                  calculateFareEstimate(pickupLocation, destinationCoords, option.id);
                }
              }}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                padding: '16px', 
                border: `2px solid ${selectedRide === option.id ? '#3b82f6' : '#e5e7eb'}`, 
                borderRadius: '12px', 
                marginBottom: '12px', 
                cursor: 'pointer',
                backgroundColor: selectedRide === option.id ? '#eff6ff' : 'white',
                position: 'relative'
              }}
            >
              {option.hasSurge && (
                <div style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: '600'
                }}>
                  🔥 {option.surgeMultiplier?.toFixed(1)}x
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img 
                  src={option.icon} 
                  alt={`${option.name} car`} 
                  style={{ 
                    width: '40px', 
                    height: '40px', 
                    objectFit: 'contain'
                  }} 
                />
                <div>
                  <div style={{ 
                    fontWeight: '600', 
                    color: '#1f2937',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    {option.name}
                    {option.hasSurge && (
                      <span style={{ fontSize: '12px', color: '#ef4444' }}>⚡</span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{option.description}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{option.eta} min away</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ 
                  fontWeight: '700', 
                  color: option.hasSurge ? '#ef4444' : '#1f2937', 
                  fontSize: '16px' 
                }}>
                  ${option.price.toFixed(2)}
                </div>
                {option.hasSurge && option.surgeMultiplier && option.surgeMultiplier > 1 && (
                  <div style={{ 
                    fontSize: '10px', 
                    color: '#ef4444', 
                    fontWeight: '500' 
                  }}>
                    High demand
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Surge Information Box - Always visible when ride selected */}
        {selectedRide && (
          <div style={{ 
            backgroundColor: 'white', 
            padding: '20px', 
            borderRadius: '16px', 
            marginBottom: '16px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            border: '2px solid #f3f4f6'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🔥</span> Surge Pricing Info
              </h3>
              <div style={{ 
                padding: '4px 8px', 
                backgroundColor: '#eff6ff', 
                borderRadius: '8px', 
                fontSize: '12px', 
                fontWeight: '600', 
                color: '#1d4ed8' 
              }}>
                Live
              </div>
            </div>

            {/* Current surge status */}
            <div style={{ 
              padding: '12px', 
              backgroundColor: '#f8fafc', 
              borderRadius: '12px', 
              marginBottom: '16px',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
                    Current Surge Level
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    {rideOptions.find(r => r.id === selectedRide)?.name} vehicle type
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ 
                    fontSize: '18px', 
                    fontWeight: '700', 
                    color: rideOptions.find(r => r.id === selectedRide)?.hasSurge ? '#ef4444' : '#10b981' 
                  }}>
                    {rideOptions.find(r => r.id === selectedRide)?.hasSurge 
                      ? `${rideOptions.find(r => r.id === selectedRide)?.surgeMultiplier?.toFixed(1)}x` 
                      : '1.0x'}
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: rideOptions.find(r => r.id === selectedRide)?.hasSurge ? '#ef4444' : '#10b981',
                    fontWeight: '600'
                  }}>
                    {rideOptions.find(r => r.id === selectedRide)?.hasSurge ? 'High Demand' : 'Normal'}
                  </div>
                </div>
              </div>
            </div>

            {/* Surge factors */}
            {rideOptions.find(r => r.id === selectedRide)?.hasSurge && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Surge Factors:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  <span style={{ 
                    padding: '4px 8px', 
                    backgroundColor: '#fef2f2', 
                    color: '#dc2626', 
                    borderRadius: '6px', 
                    fontSize: '11px',
                    fontWeight: '500'
                  }}>
                    🕐 Peak Hours
                  </span>
                  <span style={{ 
                    padding: '4px 8px', 
                    backgroundColor: '#fef2f2', 
                    color: '#dc2626', 
                    borderRadius: '6px', 
                    fontSize: '11px',
                    fontWeight: '500'
                  }}>
                    🌧️ Weather
                  </span>
                  <span style={{ 
                    padding: '4px 8px', 
                    backgroundColor: '#fef2f2', 
                    color: '#dc2626', 
                    borderRadius: '6px', 
                    fontSize: '11px',
                    fontWeight: '500'
                  }}>
                    📍 High Demand Area
                  </span>
                </div>
              </div>
            )}

            {/* Fare breakdown */}
            {fareEstimate ? (
              <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                <div style={{ fontWeight: '600', marginBottom: '8px', color: '#374151' }}>Fare Breakdown:</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Base Rate ({rideOptions.find(r => r.id === selectedRide)?.name}):</span>
                  <span>${fareEstimate.baseFare?.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Distance ({fareEstimate.estimatedDistance?.toFixed(1)} mi):</span>
                  <span>${fareEstimate.distanceFare?.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Time ({fareEstimate.estimatedTravelTime} min):</span>
                  <span>${fareEstimate.timeFare?.toFixed(2)}</span>
                </div>
                {fareEstimate.surge?.isActive && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#ef4444' }}>
                    <span>Surge Premium ({fareEstimate.surge.multiplier.toFixed(1)}x):</span>
                    <span>+${fareEstimate.surge.amount?.toFixed(2)}</span>
                  </div>
                )}
                {userProfile.corporateDiscount && userProfile.corporateDiscount.isActive && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#10b981' }}>
                    <span>Corporate Discount ({userProfile.corporateDiscount.discountPercentage}%):</span>
                    <span>-${((fareEstimate.total || 0) * (userProfile.corporateDiscount.discountPercentage / 100)).toFixed(2)}</span>
                  </div>
                )}
                <div style={{ 
                  borderTop: '1px solid #e5e7eb', 
                  paddingTop: '8px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  fontSize: '16px', 
                  fontWeight: '700' 
                }}>
                  <span>Total Estimated Fare:</span>
                  <span>${(() => {
                    const baseTotal = rideOptions.find(r => r.id === selectedRide)?.price || fareEstimate.total || 0;
                    const discountAmount = userProfile.corporateDiscount?.isActive 
                      ? (baseTotal * (userProfile.corporateDiscount.discountPercentage / 100))
                      : 0;
                    return (baseTotal - discountAmount).toFixed(2);
                  })()}</span>
                </div>
              </div>
            ) : (
              <div style={{ 
                padding: '12px', 
                backgroundColor: '#f9fafb', 
                borderRadius: '8px', 
                textAlign: 'center',
                color: '#6b7280',
                fontSize: '14px'
              }}>
                Select a destination to see fare estimate
              </div>
            )}

            {/* Surge alert */}
            {rideOptions.find(r => r.id === selectedRide)?.hasSurge && (
              <div style={{ 
                fontSize: '12px', 
                color: '#ef4444', 
                backgroundColor: '#fef2f2', 
                padding: '12px', 
                borderRadius: '8px', 
                marginTop: '12px',
                border: '1px solid #fecaca',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '16px' }}>🔥</span>
                <div>
                  <div style={{ fontWeight: '600' }}>High demand in your area!</div>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>
                    Prices are higher than usual due to increased demand
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Payment Method */}
        {selectedPaymentMethod && (
          <div 
            style={{ 
              backgroundColor: 'white', 
              padding: '16px', 
              borderRadius: '16px', 
              marginBottom: '16px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer'
            }}
            onClick={() => {
              setActivePanel('payments');
              setShowMenu(false);
              setShowProfile(false);
            }}
          >
            <span style={{ fontSize: '24px' }}>{selectedPaymentMethod.icon}</span>
            <div>
              <div style={{ fontWeight: '600' }}>{selectedPaymentMethod.name}</div>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>{selectedPaymentMethod.details}</div>
            </div>
          </div>
        )}

        {/* Menu Panel */}
        {showMenu && (
          <div style={{
            position: 'fixed',
            top: '70px',
            left: '16px',
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            zIndex: 1000,
            minWidth: '200px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Menu</h3>
              <button onClick={() => setShowMenu(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                onClick={() => {
                  setActivePanel('trips');
                  setShowMenu(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: '#f8fafc',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                📱 Recent Trips
              </button>
              <button 
                onClick={() => {
                  setActivePanel('places');
                  setShowMenu(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: '#f8fafc',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                🏠 Saved Places
              </button>
              <button 
                onClick={() => {
                  setActivePanel('payments');
                  setShowMenu(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: '#f8fafc',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                💳 Payment Methods
              </button>
              <Link 
                to="/rider/badge-upload"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: '#f8fafc',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  textDecoration: 'none',
                  color: 'inherit'
                }}
                onClick={() => setShowMenu(false)}
              >
                🏢 Corporate Discount
              </Link>
              <button 
                onClick={() => {
                  setActivePanel('help');
                  setShowMenu(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: '#f8fafc',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                📞 Help & Support
              </button>
              <button 
                onClick={() => {
                  setActivePanel('settings');
                  setShowMenu(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: '#f8fafc',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                ⚙️ Settings
              </button>
            </div>
          </div>
        )}

        {/* Profile Panel */}
        {showProfile && (
          <div style={{
            position: 'fixed',
            top: '70px',
            right: '16px',
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            zIndex: 1000,
            minWidth: '280px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Profile</h3>
              <button onClick={() => setShowProfile(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>

            {/* Profile Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
              <div style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                backgroundColor: editProfile.profilePicture ? 'transparent' : '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '20px',
                fontWeight: '600',
                overflow: 'hidden',
                backgroundImage: editProfile.profilePicture ? `url(${editProfile.profilePicture})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}>
                {!editProfile.profilePicture && `${editProfile.firstName[0] || userProfile.firstName[0]}${editProfile.lastName[0] || userProfile.lastName[0]}`}
              </div>
              <div>
                <div style={{ fontWeight: '600', fontSize: '16px' }}>{editProfile.firstName} {editProfile.lastName}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', color: '#6b7280' }}>
                  <Star size={14} fill="#fbbf24" color="#fbbf24" />
                  {userProfile.rating} Rating
                </div>
              </div>
            </div>

            {/* Profile Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div style={{ textAlign: 'center', padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#10b981' }}>{userProfile.totalRides}</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Total Rides</div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px', backgroundColor: '#eff6ff', borderRadius: '8px' }}>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#3b82f6' }}>${userProfile.monthlySpending}</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>This Month</div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px', backgroundColor: '#fef3c7', borderRadius: '8px' }}>
                <div style={{ fontSize: '18px', fontWeight: '700', color: '#f59e0b' }}>
                  {userProfile.totalRides >= 50 ? 'Platinum' : userProfile.totalRides >= 25 ? 'Gold' : userProfile.totalRides >= 10 ? 'Silver' : 'Bronze'}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Member</div>
              </div>
            </div>

            {/* Profile Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                onClick={() => setActivePanel('edit-profile')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: '#f8fafc',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  width: '100%'
                }}
              >
                📝 Edit Profile
              </button>
              <button style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                backgroundColor: '#f8fafc',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                width: '100%'
              }}>
                🎯 Trip History
              </button>
              <button style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                backgroundColor: '#f8fafc',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                width: '100%'
              }}>
                🔔 Notifications
              </button>
            </div>
          </div>
        )}

        {/* Recent Trips Panel */}
        {activePanel === 'trips' && (
          <div style={{
            position: 'fixed',
            top: '70px',
            left: '16px',
            right: '16px',
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            zIndex: 1000,
            maxHeight: '70vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Recent Trips</h3>
              <button onClick={() => setActivePanel('none')} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>

            {recentTrips.length > 0 ? recentTrips.map((trip) => (
              <div key={trip.id} style={{
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                marginBottom: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>{trip.date}</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#10b981' }}>{trip.fare}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#6b7280' }}>
                  <span>📍 {trip.from}</span>
                  <span>→</span>
                  <span>🏁 {trip.to}</span>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <button 
                    onClick={() => bookAgain(trip)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Book Again
                  </button>
                </div>
              </div>
            )) : (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#6b7280'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚗</div>
                <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>No Recent Trips</div>
                <div style={{ fontSize: '14px' }}>Your ride history will appear here once you take your first trip.</div>
              </div>
            )}
          </div>
        )}

        {/* Saved Places Panel */}
        {activePanel === 'places' && (
          <div style={{
            position: 'fixed',
            top: '70px',
            left: '16px',
            right: '16px',
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            zIndex: 1000,
            maxHeight: '70vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Saved Places</h3>
              <button onClick={() => setActivePanel('none')} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>

            {savedPlaces.map((place) => (
              <div key={place.id} style={{
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                marginBottom: '12px',
                border: '1px solid #e2e8f0',
                cursor: editingPlace?.id === place.id ? 'default' : 'pointer'
              }}
              onClick={() => {
                if (editingPlace?.id !== place.id) {
                  setDestination(place.address);
                  setActivePanel('none');
                  handleDestinationInput(place.address);
                }
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ fontSize: '24px' }}>{place.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>
                      {place.name}
                    </div>
                    {editingPlace?.id === place.id ? (
                      <input
                        type="text"
                        value={editingPlace.address}
                        onChange={(e) => setEditingPlace(prev => ({ ...prev, address: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '8px',
                          border: '2px solid #3b82f6',
                          borderRadius: '6px',
                          fontSize: '14px',
                          outline: 'none'
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    ) : (
                      <div style={{ fontSize: '14px', color: '#6b7280' }}>{place.address}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {editingPlace?.id === place.id ? (
                      <>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            // Save the edited address
                            setSavedPlaces(prev => 
                              prev.map(p => 
                                p.id === editingPlace.id 
                                  ? { ...p, address: editingPlace.address.trim() }
                                  : p
                              )
                            );
                            setEditingPlace(null);
                            showNotification(`✅ ${place.name} address updated!`, 'success');
                          }}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Save
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingPlace(null);
                          }}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#6b7280',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setDestination(place.address);
                            setActivePanel('none');
                            handleDestinationInput(place.address);
                          }}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          Go Here
                        </button>
                        {(place.type === 'home' || place.type === 'work') && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingPlace({ id: place.id, address: place.address });
                            }}
                            style={{
                              padding: '6px 8px',
                              backgroundColor: '#f59e0b',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            ✏️
                          </button>
                        )}
                        {place.type === 'custom' && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Delete "${place.name}" from saved places?`)) {
                                setSavedPlaces(prev => prev.filter(p => p.id !== place.id));
                              }
                            }}
                            style={{
                              padding: '6px 8px',
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            🗑️
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <button 
              onClick={() => setActivePanel('add-place')}
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: '#e2e8f0',
                border: '2px dashed #9ca3af',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                color: '#6b7280',
                cursor: 'pointer'
              }}
            >
              + Add New Place
            </button>
          </div>
        )}

        {/* Add New Place Panel */}
        {activePanel === 'add-place' && (
          <div 
            style={{
              position: 'fixed',
              top: '70px',
              left: '16px',
              right: '16px',
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              zIndex: 1000,
              maxHeight: '70vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Add New Place</h3>
              <button onClick={() => setActivePanel('places')} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                  Place Name
                </label>
                <input
                  type="text"
                  value={newPlace.name}
                  onChange={(e) => setNewPlace(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Home, Work, Gym"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                  onFocus={(e) => (e.target as HTMLElement).style.borderColor = '#3b82f6'}
                  onBlur={(e) => (e.target as HTMLElement).style.borderColor = '#e5e7eb'}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                  Address
                </label>
                <input
                  type="text"
                  value={newPlace.address}
                  onChange={(e) => setNewPlace(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Enter full address"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                  onFocus={(e) => (e.target as HTMLElement).style.borderColor = '#3b82f6'}
                  onBlur={(e) => (e.target as HTMLElement).style.borderColor = '#e5e7eb'}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                  Icon
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                  {['🏠', '🏢', '🏫', '🏥', '🏪', '⛽', '🏋️', '🍕', '☕', '✈️', '🎬', '❤️'].map((icon) => (
                    <button
                      key={icon}
                      style={{
                        padding: '12px',
                        fontSize: '20px',
                        backgroundColor: newPlace.icon === icon ? '#3b82f6' : '#f8fafc',
                        border: `2px solid ${newPlace.icon === icon ? '#3b82f6' : '#e2e8f0'}`,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        color: newPlace.icon === icon ? 'white' : 'black'
                      }}
                      onMouseEnter={(e) => {
                        if (newPlace.icon !== icon) {
                          (e.target as HTMLElement).style.borderColor = '#3b82f6';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (newPlace.icon !== icon) {
                          (e.target as HTMLElement).style.borderColor = '#e2e8f0';
                        }
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setNewPlace(prev => ({ ...prev, icon }));
                      }}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePanel('places');
                  }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#f3f4f6',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#6b7280',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (newPlace.name.trim() && newPlace.address.trim()) {
                      // Add the new place to saved places
                      const newPlaceWithId = {
                        id: Date.now().toString(),
                        name: newPlace.name.trim(),
                        address: newPlace.address.trim(),
                        icon: newPlace.icon,
                        type: 'custom'
                      };

                      setSavedPlaces(prev => [...prev, newPlaceWithId]);

                      // Show success message
                      const successMsg = document.createElement('div');
                      successMsg.innerHTML = `
                        <div style="
                          position: fixed; 
                          top: 80px; 
                          left: 50%; 
                          transform: translateX(-50%); 
                          background: #10b981; 
                          color: white; 
                          padding: 12px 20px; 
                          border-radius: 8px; 
                          font-size: 14px; 
                          font-weight: 600; 
                          z-index: 10000;
                          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                        ">
                          ✅ "${newPlace.name}" saved successfully!
                        </div>
                      `;
                      document.body.appendChild(successMsg);
                      setTimeout(() => {
                        if (document.body.contains(successMsg)) {
                          document.body.removeChild(successMsg);
                        }
                      }, 3000);

                      // Reset form and go back to places
                      setNewPlace({ name: '', address: '', icon: '🏠' });
                      setActivePanel('places');
                    } else {
                      alert('Please fill in both place name and address');
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#3b82f6',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                >
                  Save Place
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Payment Methods Panel */}
        {activePanel === 'payments' && (
          <div style={{
            position: 'fixed',
            top: '70px',
            left: '16px',
            right: '16px',
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            zIndex: 1000,
            maxHeight: '70vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Payment Methods</h3>
              <button onClick={() => setActivePanel('none')} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>

            {isLoadingPayments ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100px' }}>
                <div className="spinner"></div> {/* Placeholder for spinner */}
              </div>
            ) : paymentMethods.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#6b7280', padding: '20px' }}>
                No payment methods found.
              </div>
            ) : (
              paymentMethods.map((method) => (
                <div key={method.id} style={{
                  padding: '16px',
                  backgroundColor: method.isDefault ? '#eff6ff' : '#f8fafc',
                  borderRadius: '12px',
                  marginBottom: '12px',
                  border: `2px solid ${method.isDefault ? '#3b82f6' : '#e2e8f0'}`,
                  cursor: 'pointer'
                }}
                onClick={() => {
                  setSelectedPaymentMethod(method);
                  setActivePanel('none');
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ fontSize: '24px' }}>{method.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>
                        {method.name}
                      </div>
                      <div style={{ fontSize: '14px', color: '#6b7280' }}>{method.details}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {method.isDefault && (
                        <div style={{
                          padding: '4px 8px',
                          backgroundColor: '#10b981',
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          Default
                        </div>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePaymentMethod(method.id);
                        }}
                        style={{
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}

            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                onClick={() => setActivePanel('add-card')}
                style={{
                  width: '100%',
                  padding: '16px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                💳 Add Credit/Debit Card
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => {
                    setWalletSetupForm({
                      appleId: '',
                      deviceName: '',
                      googleEmail: '',
                      phoneNumber: '',
                      makeDefault: paymentMethods.length === 0
                    });
                    addDigitalWallet('apple_pay');
                  }}
                  style={{
                    flex: 1,
                    padding: '16px',
                    backgroundColor: '#1d1d1f',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  🍎 Apple Pay
                </button>

                <button 
                  onClick={() => {
                    setWalletSetupForm({
                      appleId: '',
                      deviceName: '',
                      googleEmail: '',
                      phoneNumber: '',
                      makeDefault: paymentMethods.length === 0
                    });
                    addDigitalWallet('google_pay');
                  }}
                  style={{
                    flex: 1,
                    padding: '16px',
                    backgroundColor: '#4285f4',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  🔵 Google Pay
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Wallet Setup Panel */}
        {activePanel === 'add-wallet' && (
          <div style={{
            position: 'fixed',
            top: '70px',
            left: '16px',
            right: '16px',
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            zIndex: 1000,
            maxHeight: '70vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                {selectedPaymentType === 'apple_pay' ? '🍎 Set up Apple Pay' : '🔵 Set up Google Pay'}
              </h3>
              <button onClick={() => setActivePanel('payments')} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>

            {selectedPaymentType === 'apple_pay' && (
              <form onSubmit={(e) => {
                e.preventDefault();
                setupDigitalWallet('apple_pay', walletSetupForm);
              }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{
                  textAlign: 'center',
                  padding: '20px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '12px',
                  marginBottom: '16px'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>🍎</div>
                  <h4 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0' }}>Apple Pay Setup</h4>
                  <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                    Enter your Apple ID and device information to set up Apple Pay
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                    Apple ID Email
                  </label>
                  <input
                    type="email"
                    value={walletSetupForm.appleId}
                    onChange={(e) => setWalletSetupForm(prev => ({ ...prev, appleId: e.target.value }))}
                    placeholder="your.email@icloud.com"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '16px',
                      boxSizing: 'border-box'
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                    Device Name
                  </label>
                  <select
                    value={walletSetupForm.deviceName}
                    onChange={(e) => setWalletSetupForm(prev => ({ ...prev, deviceName: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '16px',
                      boxSizing: 'border-box'
                    }}
                    required
                  >
                    <option value="">Select your device</option>
                    <option value="iPhone 15 Pro">iPhone 15 Pro</option>
                    <option value="iPhone 15">iPhone 15</option>
                    <option value="iPhone 14 Pro">iPhone 14 Pro</option>
                    <option value="iPhone 14">iPhone 14</option>
                    <option value="iPhone 13">iPhone 13</option>
                    <option value="iPhone 12">iPhone 12</option>
                    <option value="iPad Pro">iPad Pro</option>
                    <option value="iPad Air">iPad Air</option>
                    <option value="MacBook Pro">MacBook Pro</option>
                    <option value="MacBook Air">MacBook Air</option>
                    <option value="Apple Watch">Apple Watch</option>
                  </select>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: '#f0fdf4',
                  borderRadius: '8px',
                  border: '1px solid #bbf7d0'
                }}>
                  <input
                    type="checkbox"
                    id="applePayDefault"
                    checked={walletSetupForm.makeDefault}
                    onChange={(e) => setWalletSetupForm(prev => ({ ...prev, makeDefault: e.target.checked }))}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <label htmlFor="applePayDefault" style={{ fontSize: '14px', fontWeight: '500', color: '#374151', cursor: 'pointer' }}>
                    Make this my default payment method
                  </label>
                </div>

                <div style={{
                  padding: '12px',
                  backgroundColor: '#fef3c7',
                  borderRadius: '8px',
                  border: '1px solid #fbbf24'
                }}>
                  <p style={{ fontSize: '12px', color: '#92400e', margin: 0 }}>
                    <strong>Note:</strong> You'll be redirected to authenticate with Touch ID, Face ID, or your device passcode to complete the setup.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoadingPayments}
                  style={{
                    width: '100%',
                    padding: '16px',
                    backgroundColor: isLoadingPayments ? '#9ca3af' : '#1d1d1f',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: isLoadingPayments ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {isLoadingPayments ? (
                    <>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTop: '2px solid white',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                      Setting up Apple Pay...
                    </>
                  ) : (
                    <>🍎 Set up Apple Pay</>
                  )}
                </button>
              </form>
            )}

            {selectedPaymentType === 'google_pay' && (
              <form onSubmit={(e) => {
                e.preventDefault();
                setupDigitalWallet('google_pay', walletSetupForm);
              }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{
                  textAlign: 'center',
                  padding: '20px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '12px',
                  marginBottom: '16px'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔵</div>
                  <h4 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0' }}>Google Pay Setup</h4>
                  <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                    Enter your Google account information to set up Google Pay
                  </p>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                    Google Account Email
                  </label>
                  <input
                    type="email"
                    value={walletSetupForm.googleEmail}
                    onChange={(e) => setWalletSetupForm(prev => ({ ...prev, googleEmail: e.target.value }))}
                    placeholder="your.email@gmail.com"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '16px',
                      boxSizing: 'border-box'
                    }}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                    Phone Number (for verification)
                  </label>
                  <input
                    type="tel"
                    value={walletSetupForm.phoneNumber}
                    onChange={(e) => setWalletSetupForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                    placeholder="+1 (555) 123-4567"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '16px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: '#f0fdf4',
                  borderRadius: '8px',
                  border: '1px solid #bbf7d0'
                }}>
                  <input
                    type="checkbox"
                    id="googlePayDefault"
                    checked={walletSetupForm.makeDefault}
                    onChange={(e) => setWalletSetupForm(prev => ({ ...prev, makeDefault: e.target.checked }))}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <label htmlFor="googlePayDefault" style={{ fontSize: '14px', fontWeight: '500', color: '#374151', cursor: 'pointer' }}>
                    Make this my default payment method
                  </label>
                </div>

                <div style={{
                  padding: '12px',
                  backgroundColor: '#fef3c7',
                  borderRadius: '8px',
                  border: '1px solid #fbbf24'
                }}>
                  <p style={{ fontSize: '12px', color: '#92400e', margin: 0 }}>
                    <strong>Note:</strong> You'll be redirected to Google to authenticate and authorize payments for this app.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoadingPayments}
                  style={{
                    width: '100%',
                    padding: '16px',
                    backgroundColor: isLoadingPayments ? '#9ca3af' : '#4285f4',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: isLoadingPayments ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {isLoadingPayments ? (
                    <>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTop: '2px solid white',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                      Setting up Google Pay...
                    </>
                  ) : (
                    <>🔵 Set up Google Pay</>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Add Card Panel */}
        {activePanel === 'add-card' && (
          <div style={{
            position: 'fixed',
            top: '70px',
            left: '16px',
            right: '16px',
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            zIndex: 1000,
            maxHeight: '70vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Add Credit/Debit Card</h3>
              <button onClick={() => setActivePanel('payments')} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>

            <form onSubmit={handleAddCard} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                  Card Number
                </label>
                <input
                  type="text"
                  value={newPaymentForm.cardNumber}
                  onChange={(e) => setNewPaymentForm(prev => ({ ...prev, cardNumber: formatCardNumber(e.target.value) }))}
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '16px',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                    Expiry Date
                  </label>
                  <input
                    type="text"
                    value={newPaymentForm.expiryDate}
                    onChange={(e) => setNewPaymentForm(prev => ({ ...prev, expiryDate: formatExpiryDate(e.target.value) }))}
                    placeholder="MM/YY"
                    maxLength={5}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '16px',
                      boxSizing: 'border-box'
                    }}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                    CVV
                  </label>
                  <input
                    type="text"
                    value={newPaymentForm.cvv}
                    onChange={(e) => setNewPaymentForm(prev => ({ ...prev, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                    placeholder="123"
                    maxLength={4}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '16px',
                      boxSizing: 'border-box'
                    }}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                  Cardholder Name
                </label>
                <input
                  type="text"
                  value={newPaymentForm.name}
                  onChange={(e) => setNewPaymentForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="John Doe"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                  onFocus={(e) => (e.target as HTMLElement).style.borderColor = '#3b82f6'}
                  onBlur={(e) => (e.target as HTMLElement).style.borderColor = '#e5e7eb'}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                  Card Type
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[
                    { type: 'credit', icon: '💳', label: 'Credit' },
                    { type: 'debit', icon: '🏦', label: 'Debit' }
                  ].map((cardType) => (
                    <button
                      key={cardType.type}
                      type="button"
                      onClick={() => setNewPaymentForm(prev => ({ ...prev, type: cardType.type }))}
                      style={{
                        flex: 1,
                        padding: '12px',
                        backgroundColor: newPaymentForm.type === cardType.type ? '#eff6ff' : '#f8fafc',
                        border: `2px solid ${newPaymentForm.type === cardType.type ? '#3b82f6' : '#e2e8f0'}`,
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      {cardType.icon} {cardType.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoadingPayments}
                style={{
                  width: '100%',
                  padding: '16px',
                  backgroundColor: isLoadingPayments ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: isLoadingPayments ? 'not-allowed' : 'pointer',
                  marginTop: '8px'
                }}
              >
                {isLoadingPayments ? 'Adding Card...' : 'Add Card'}
              </button>
            </form>
          </div>
        )}

        {/* Help & Support Panel */}
        {activePanel === 'help' && (
          <div style={{
            position: 'fixed',
            top: '70px',
            left: '16px',
            right: '16px',
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            zIndex: 1000,
            maxHeight: '70vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Help & Support</h3>
              <button onClick={() => setActivePanel('none')} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                onClick={() => window.location.href = 'tel:911'}
                style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px',
                backgroundColor: '#fef2f2',
                border: '2px solid #fecaca',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                🚨 Emergency Support
              </button>

              <button 
                onClick={() => setShowLiveChat(true)}
                style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                backgroundColor: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>💬 Live Chat</span>
                <span style={{ fontSize: '12px', color: '#0284c7', fontWeight: '600' }}>Available 24/7</span>
              </button>

              <button 
                onClick={callSupport}
                style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>📞 Call Support</span>
                <span style={{ fontSize: '12px', color: '#15803d', fontWeight: '600' }}>(479) 367-1337</span>
              </button>

              <div>
                <button 
                  onClick={() => setShowReportIssue(!showReportIssue)}
                  style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '16px',
                  backgroundColor: '#fef3c7',
                  border: '1px solid #fde68a',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>📧 Report Issue</span>
                  <span style={{ fontSize: '12px', color: '#92400e' }}>{showReportIssue ? '▲' : '▼'}</span>
                </button>
                
                {showReportIssue && (
                  <div style={{ marginTop: '8px', backgroundColor: '#fffbeb', border: '1px solid #fed7aa', borderRadius: '12px', padding: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {[
                        { type: 'Driver Issue', desc: 'Driver behavior, route, or professionalism' },
                        { type: 'Payment Problem', desc: 'Billing, charges, or payment method issues' },
                        { type: 'Safety Concern', desc: 'Vehicle condition or safety-related incidents' },
                        { type: 'App Technical Issue', desc: 'App crashes, bugs, or functionality problems' },
                        { type: 'Lost Item', desc: 'Item left in vehicle or missing belongings' },
                        { type: 'Other', desc: 'General feedback or other concerns' }
                      ].map((issue, index) => (
                        <button 
                          key={index}
                          onClick={() => {
                            alert(`Thank you for reporting: ${issue.type}. We'll contact you within 24 hours.`);
                            setShowReportIssue(false);
                          }}
                          style={{
                            padding: '10px 12px',
                            backgroundColor: 'white',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontSize: '13px'
                          }}
                        >
                          <div style={{ fontWeight: '600', color: '#374151' }}>{issue.type}</div>
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>{issue.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                ❓ FAQ
              </button>
            </div>
          </div>
        )}

        {/* Live Chat Interface */}
        {showLiveChat && (
          <div style={{
            position: 'fixed',
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '400px',
              height: '80vh',
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
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>💬 Live Support</h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Connected • Response time: ~2 min</p>
                </div>
                <button 
                  onClick={() => setShowLiveChat(false)} 
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    fontSize: '20px', 
                    cursor: 'pointer',
                    color: '#6b7280'
                  }}
                >
                  ×
                </button>
              </div>

              {/* Chat Messages */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                {chatMessages.map((msg) => (
                  <div key={msg.id} style={{
                    display: 'flex',
                    justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start'
                  }}>
                    <div style={{
                      maxWidth: '80%',
                      padding: '10px 14px',
                      borderRadius: '16px',
                      backgroundColor: msg.sender === 'user' ? '#3b82f6' : '#f3f4f6',
                      color: msg.sender === 'user' ? 'white' : '#374151',
                      fontSize: '14px'
                    }}>
                      {msg.message}
                    </div>
                  </div>
                ))}
              </div>

              {/* Chat Input */}
              <div style={{
                padding: '16px',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                gap: '8px'
              }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendChatMessage(chatInput)}
                  placeholder="Type your message..."
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    border: '1px solid #d1d5db',
                    borderRadius: '20px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
                <button
                  onClick={() => sendChatMessage(chatInput)}
                  disabled={!chatInput.trim()}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: chatInput.trim() ? '#3b82f6' : '#9ca3af',
                    color: 'white',
                    border: 'none',
                    borderRadius: '20px',
                    cursor: chatInput.trim() ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Settings Panel */}
        {activePanel === 'settings' && (
          <div style={{
            position: 'fixed',
            top: '70px',
            left: '16px',
            right: '16px',
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            zIndex: 1000,
            maxHeight: '70vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Settings</h3>
              <button onClick={() => setActivePanel('none')} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>🔔 Push Notifications</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Get ride updates and offers</div>
                  </div>
                  <label 
                    style={{ position: 'relative', display: 'inline-block', width: '50px', height: '24px', cursor: 'pointer' }}
                    onClick={(e) => {
                      e.preventDefault();
                      const input = e.currentTarget.querySelector('input');
                      input.checked = !input.checked;
                      showNotification(
                        input.checked ? '🔔 Push notifications enabled' : '🔕 Push notifications disabled', 
                        'success'
                      );
                    }}
                  >
                    <input type="checkbox" defaultChecked style={{ opacity: 0, width: 0, height: 0 }} />
                    <span style={{
                      position: 'absolute',
                      cursor: 'pointer',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: '#3b82f6',
                      borderRadius: '24px',
                      transition: '0.3s'
                    }}></span>
                  </label>
                </div>
              </div>

              <div style={{
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>🌙 Dark Mode</div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>Switch to dark theme</div>
                  </div>
                  <label 
                    style={{ position: 'relative', display: 'inline-block', width: '50px', height: '24px', cursor: 'pointer' }}
                    onClick={(e) => {
                      e.preventDefault();
                      const input = e.currentTarget.querySelector('input');
                      input.checked = !input.checked;
                      showNotification(
                        input.checked ? '🌙 Dark mode enabled' : '☀️ Light mode enabled', 
                        'success'
                      );
                    }}
                  >
                    <input type="checkbox" style={{ opacity: 0, width: 0, height: 0 }} />
                    <span style={{
                      position: 'absolute',
                      cursor: 'pointer',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: '#9ca3af',
                      borderRadius: '24px',
                      transition: '0.3s'
                    }}></span>
                  </label>
                </div>
              </div>

              <button 
                onClick={() => {
                  showNotification('🔐 Privacy settings panel opened', 'info');
                  // Simulate opening privacy settings
                  setTimeout(() => {
                    showNotification('✅ Privacy settings updated successfully', 'success');
                  }, 1500);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  width: '100%',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = '#eff6ff';
                  (e.target as HTMLElement).style.borderColor = '#3b82f6';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = '#f8fafc';
                  (e.target as HTMLElement).style.borderColor = '#e2e8f0';
                }}
              >
                🔐 Privacy Settings
              </button>

              <button 
                onClick={() => {
                  if (!navigator.geolocation) {
                    showNotification('❌ Location services not supported on this device', 'error');
                    return;
                  }
                  
                  showNotification('📍 Checking location permissions...', 'info');
                  
                  navigator.permissions.query({ name: 'geolocation' }).then((result) => {
                    if (result.state === 'granted') {
                      showNotification('✅ Location services are enabled', 'success');
                      getCurrentLocation(map);
                    } else if (result.state === 'prompt') {
                      showNotification('📱 Please allow location access when prompted', 'warning');
                      getCurrentLocation(map);
                    } else {
                      showNotification('❌ Location services denied. Enable in browser settings.', 'error');
                    }
                  }).catch(() => {
                    showNotification('📍 Location services check completed', 'info');
                    getCurrentLocation(map);
                  });
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  width: '100%',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = '#f0fdf4';
                  (e.target as HTMLElement).style.borderColor = '#10b981';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = '#f8fafc';
                  (e.target as HTMLElement).style.borderColor = '#e2e8f0';
                }}
              >
                📍 Location Services
              </button>

              <button 
                onClick={() => {
                  showNotification('📱 App preferences panel opened', 'info');
                  // Simulate app preferences management
                  const preferences = [
                    'Auto-request rides from favorite locations',
                    'Show nearby driver count',
                    'Enable ride sharing suggestions',
                    'Smart destination predictions'
                  ];
                  
                  setTimeout(() => {
                    const randomPref = preferences[Math.floor(Math.random() * preferences.length)];
                    showNotification(`✅ ${randomPref} updated`, 'success');
                  }, 1200);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  width: '100%',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = '#fef3c7';
                  (e.target as HTMLElement).style.borderColor = '#f59e0b';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = '#f8fafc';
                  (e.target as HTMLElement).style.borderColor = '#e2e8f0';
                }}
              >
                📱 App Preferences
              </button>

              <button 
                onClick={() => {
                  if (confirm('Are you sure you want to sign out? You will need to log in again to book rides.')) {
                    showNotification('🚪 Signing out...', 'info');
                    
                    // Clear user data
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('userProfile');
                    localStorage.removeItem('savedPaymentMethods');
                    
                    setTimeout(() => {
                      showNotification('✅ Successfully signed out', 'success');
                      
                      // Reset app state
                      setActivePanel('none');
                      setCurrentRide(null);
                      setBookingStatus('idle');
                      setSelectedPaymentMethod(null);
                      setPaymentMethods([]);
                      
                      // Redirect to auth page or show login
                      setTimeout(() => {
                        window.location.href = '/rider/auth';
                      }, 1000);
                    }, 1500);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '16px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  width: '100%',
                  color: '#dc2626',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = '#fee2e2';
                  (e.target as HTMLElement).style.borderColor = '#ef4444';
                  (e.target as HTMLElement).style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.backgroundColor = '#fef2f2';
                  (e.target as HTMLElement).style.borderColor = '#fecaca';
                  (e.target as HTMLElement).style.transform = 'translateY(0)';
                }}
              >
                🚪 Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Edit Profile Panel */}
        {activePanel === 'edit-profile' && (
          <div 
            style={{
              position: 'fixed',
              top: '70px',
              left: '16px',
              right: '16px',
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              zIndex: 1000,
              maxHeight: '70vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Edit Profile</h3>
              <button onClick={() => setActivePanel('none')} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Profile Photo */}
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  backgroundColor: editProfile.profilePicture ? 'transparent' : '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '32px',
                  fontWeight: '600',
                  margin: '0 auto 12px auto',
                  position: 'relative',
                  overflow: 'hidden',
                  backgroundImage: editProfile.profilePicture ? `url(${editProfile.profilePicture})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}>
                  {!editProfile.profilePicture && (editProfile.firstName?.[0] || 'U')}
                  <button style={{
                    position: 'absolute',
                    bottom: '0',
                    right: '0',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    border: '2px solid white',
                    color: 'white',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (event: any) => {
                      const file = event.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (e: any) => {
                          setEditProfile(prev => ({ ...prev, profilePicture: e.target.result }));
                        };
                        reader.readAsDataURL(file);
                      }
                    };
                    input.click();
                  }}>
                    📷
                  </button>
                </div>
                <button 
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#f3f4f6',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#6b7280',
                    cursor: 'pointer'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (event: any) => {
                      const file = event.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (e: any) => {
                          setEditProfile(prev => ({ ...prev, profilePicture: e.target.result }));
                        };
                        reader.readAsDataURL(file);
                      }
                    };
                    input.click();
                  }}
                >
                  {editProfile.profilePicture ? 'Change Photo' : 'Upload Photo'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                    First Name
                  </label>
                  <input
                    type="text"
                    value={editProfile.firstName}
                    onChange={(e) => setEditProfile(prev => ({ ...prev, firstName: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                    onFocus={(e) => (e.target as HTMLElement).style.borderColor = '#3b82f6'}
                    onBlur={(e) => (e.target as HTMLElement).style.borderColor = '#e5e7eb'}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={editProfile.lastName}
                    onChange={(e) => setEditProfile(prev => ({ ...prev, lastName: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                    onFocus={(e) => (e.target as HTMLElement).style.borderColor = '#3b82f6'}
                    onBlur={(e) => (e.target as HTMLElement).style.borderColor = '#e5e7eb'}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={editProfile.email}
                  onChange={(e) => setEditProfile(prev => ({ ...prev, email: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                  onFocus={(e) => (e.target as HTMLElement).style.borderColor = '#3b82f6'}
                  onBlur={(e) => (e.target as HTMLElement).style.borderColor = '#e5e7eb'}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={editProfile.phone}
                  onChange={(e) => setEditProfile(prev => ({ ...prev, phone: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                  onFocus={(e) => (e.target as HTMLElement).style.borderColor = '#3b82f6'}
                  onBlur={(e) => (e.target as HTMLElement).style.borderColor = '#e5e7eb'}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                  Date of Birth
                </label>
                <input
                  type="date"
                  value={editProfile.dateOfBirth}
                  onChange={(e) => setEditProfile(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                  onFocus={(e) => (e.target as HTMLElement).style.borderColor = '#3b82f6'}
                  onBlur={(e) => (e.target as HTMLElement).style.borderColor = '#e5e7eb'}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
                  Emergency Contact
                </label>
                <input
                  type="text"
                  value={editProfile.emergencyContact}
                  onChange={(e) => setEditProfile(prev => ({ ...prev, emergencyContact: e.target.value }))}
                  placeholder="Name - Phone Number"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                  onFocus={(e) => (e.target as HTMLElement).style.borderColor = '#3b82f6'}
                  onBlur={(e) => (e.target as HTMLElement).style.borderColor = '#e5e7eb'}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Preferences */}
              <div style={{
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}
              onClick={(e) => e.stopPropagation()}>
                <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1f2937' }}>
                  Ride Preferences
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>Music</div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>Allow driver to play music</div>
                    </div>
                    <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
                      <input 
                        type="checkbox" 
                        checked={editProfile.music}
                        onChange={(e) => {
                          e.stopPropagation();
                          setEditProfile(prev => ({ ...prev, music: e.target.checked }));
                        }}
                        style={{ opacity: 0, width: 0, height: 0 }} 
                      />
                      <span style={{
                        position: 'absolute',
                        cursor: 'pointer',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: editProfile.music ? '#3b82f6' : '#9ca3af',
                        borderRadius: '24px',
                        transition: '0.3s'
                      }}></span>
                      <span style={{
                        position: 'absolute',
                        content: '',
                        height: '18px',
                        width: '18px',
                        left: editProfile.music ? '23px' : '3px',
                        bottom: '3px',
                        backgroundColor: 'white',
                        borderRadius: '50%',
                        transition: '0.3s'
                      }}></span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>Conversation</div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>Open to chatting during rides</div>
                    </div>
                    <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
                      <input 
                        type="checkbox" 
                        checked={editProfile.conversation}
                        onChange={(e) => {
                          e.stopPropagation();
                          setEditProfile(prev => ({ ...prev, conversation: e.target.checked }));
                        }}
                        style={{ opacity: 0, width: 0, height: 0 }} 
                      />
                      <span style={{
                        position: 'absolute',
                        cursor: 'pointer',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: editProfile.conversation ? '#3b82f6' : '#9ca3af',
                        borderRadius: '24px',
                        transition: '0.3s'
                      }}></span>
                      <span style={{
                        position: 'absolute',
                        content: '',
                        height: '18px',
                        width: '18px',
                        left: editProfile.conversation ? '23px' : '3px',
                        bottom: '3px',
                        backgroundColor: 'white',
                        borderRadius: '50%',
                        transition: '0.3s'
                      }}></span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>Cabin Temperature</div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>Preferred cabin temperature setting</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditProfile(prev => ({ ...prev, temperature: 'cool' }));
                        }}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: editProfile.temperature === 'cool' ? '#3b82f6' : '#f3f4f6',
                          color: editProfile.temperature === 'cool' ? 'white' : '#6b7280',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        ❄️ Cool
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditProfile(prev => ({ ...prev, temperature: 'warm' }));
                        }}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: editProfile.temperature === 'warm' ? '#3b82f6' : '#f3f4f6',
                          color: editProfile.temperature === 'warm' ? 'white' : '#6b7280',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        🔥 Warm
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePanel('none');
                  }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#f3f4f6',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#6b7280',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    
                    try {
                      const response = await fetch(apiUrl('api/users/profile'), {
                        method: 'PUT',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token') || ''}`
                        },
                        body: JSON.stringify({
                          firstName: editProfile.firstName,
                          lastName: editProfile.lastName,
                          email: editProfile.email,
                          phone: editProfile.phone,
                          dateOfBirth: editProfile.dateOfBirth,
                          emergencyContact: editProfile.emergencyContact,
                          music: editProfile.music,
                          conversation: editProfile.conversation,
                          temperature: editProfile.temperature,
                          profilePicture: editProfile.profilePicture
                        })
                      });

                      if (response.ok) {
                        const data = await response.json();
                        console.log('✅ Profile updated:', data);
                        alert(`Profile updated successfully!\nName: ${editProfile.firstName} ${editProfile.lastName}\nEmail: ${editProfile.email}`);
                        setActivePanel('none');
                        
                        // Refresh user profile data
                        loadUserProfile();
                      } else {
                        const errorData = await response.json();
                        console.error('❌ Profile update failed:', errorData);
                        alert('Failed to update profile. Please try again.');
                      }
                    } catch (error) {
                      console.error('❌ Profile update error:', error);
                      alert('Network error. Please check your connection and try again.');
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#3b82f6',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Trip Completion Panel with Tip Interface */}
        {activePanel === 'trip-complete' && currentRide && (
          <div style={{
            position: 'fixed',
            top: '70px',
            left: '16px',
            right: '16px',
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            zIndex: 1000,
            maxHeight: '70vh',
            overflowY: 'auto'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</div>
              <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1f2937', margin: 0 }}>
                Trip Completed!
              </h2>
              <p style={{ fontSize: '16px', color: '#6b7280', margin: '8px 0 0 0' }}>
                Thank you for riding with us
              </p>
            </div>

            {/* Trip Summary */}
            <div style={{
              padding: '16px',
              backgroundColor: '#f8fafc',
              borderRadius: '12px',
              marginBottom: '20px',
              border: '1px solid #e2e8f0'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1f2937' }}>
                Trip Summary
              </h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#6b7280' }}>Distance:</span>
                <span style={{ fontWeight: '600' }}>{currentRide.fare?.estimatedDistance?.toFixed(1) || '5.2'} miles</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#6b7280' }}>Duration:</span>
                <span style={{ fontWeight: '600' }}>{currentRide.fare?.estimatedTravelTime || '18'} minutes</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#6b7280' }}>Vehicle:</span>
                <span style={{ fontWeight: '600' }}>{currentRide.vehicle?.name} {currentRide.vehicle?.icon}</span>
              </div>
              <div style={{ 
                borderTop: '1px solid #e5e7eb', 
                paddingTop: '8px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontSize: '18px', 
                fontWeight: '700' 
              }}>
                <span>Total Fare:</span>
                <span style={{ color: '#10b981' }}>${currentRide.fare?.total?.toFixed(2) || '24.50'}</span>
              </div>
            </div>

            {/* Driver Rating */}
            <div style={{
              padding: '16px',
              backgroundColor: '#f8fafc',
              borderRadius: '12px',
              marginBottom: '20px',
              border: '1px solid #e2e8f0'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1f2937' }}>
                Rate Your Driver
              </h3>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star 
                    key={star}
                    size={32}
                    fill="#fbbf24"
                    color="#fbbf24"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      console.log(`Rated driver: ${star} stars`);
                      showNotification('✅ Rating submitted!', 'success');
                    }}
                  />
                ))}
              </div>
              <textarea
                placeholder="Leave a comment for your driver (optional)"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '14px',
                  resize: 'vertical',
                  minHeight: '60px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Tip Interface */}
            <div style={{
              padding: '16px',
              backgroundColor: '#f8fafc',
              borderRadius: '12px',
              marginBottom: '20px',
              border: '1px solid #e2e8f0'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1f2937' }}>
                Add Tip (Optional)
              </h3>

              {/* Preset tip amounts */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                {[
                  { percentage: 15, amount: (currentRide.fare?.total || 24.50) * 0.15 },
                  { percentage: 18, amount: (currentRide.fare?.total || 24.50) * 0.18 },
                  { percentage: 20, amount: (currentRide.fare?.total || 24.50) * 0.20 },
                  { percentage: 25, amount: (currentRide.fare?.total || 24.50) * 0.25 }
                ].map((tip) => (
                  <button
                    key={tip.percentage}
                    onClick={() => processTip(currentRide.id, tip.amount, tip.percentage)}
                    disabled={isProcessingPayment}
                    style={{
                      padding: '12px 8px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: isProcessingPayment ? 'not-allowed' : 'pointer',
                      opacity: isProcessingPayment ? 0.6 : 1,
                      textAlign: 'center'
                    }}
                  >
                    {tip.percentage}%<br />
                    ${tip.amount.toFixed(2)}
                  </button>
                ))}
              </div>

              {/* Custom tip amount */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number"
                  placeholder="Custom amount"
                  min="0"
                  step="0.50"
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const customAmount = parseFloat((e.target as HTMLInputElement).value);
                      if (customAmount > 0) {
                        const percentage = Math.round((customAmount / (currentRide.fare?.total || 24.50)) * 100);
                        processTip(currentRide.id, customAmount, percentage);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                />
                <button
                  onClick={(e) => {
                    const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                    const customAmount = parseFloat(input.value);
                    if (customAmount > 0) {
                      const percentage = Math.round((customAmount / (currentRide.fare?.total || 24.50)) * 100);
                      processTip(currentRide.id, customAmount, percentage);
                      input.value = '';
                    }
                  }}
                  disabled={isProcessingPayment}
                  style={{
                    padding: '12px 16px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: isProcessingPayment ? 'not-allowed' : 'pointer',
                    opacity: isProcessingPayment ? 0.6 : 1
                  }}
                >
                  {isProcessingPayment ? 'Processing...' : 'Add Tip'}
                </button>
              </div>

              {/* No tip option */}
              <button
                onClick={() => {
                  setActivePanel('none');
                  setCurrentRide(null);
                  setBookingStatus('idle');
                  showNotification('✅ Thanks for your ride!', 'success');
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#f3f4f6',
                  color: '#6b7280',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  marginTop: '12px'
                }}
              >
                No Tip - Finish
              </button>
            </div>

            {/* Close button */}
            <button
              onClick={() => {
                setActivePanel('none');
                setCurrentRide(null);
                setBookingStatus('idle');
              }}
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: '#1f2937',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Done
            </button>
          </div>
        )}

        {/* Ride Tracking Panel */}
        {activePanel === 'tracking' && currentRide && (
          <div style={{
            position: 'fixed',
            top: '70px',
            left: '16px',
            right: '16px',
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            zIndex: 1000,
            maxHeight: '70vh',
            overflowY: 'auto'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1f2937', margin: 0 }}>
                Your Ride
              </h2>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0 0' }}>
                {currentRide.vehicle?.name} {currentRide.vehicle?.icon} • Ride ID: {currentRide.id}
              </p>
            </div>

            {/* Driver Info */}
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
                backgroundColor: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '18px',
                fontWeight: '600'
              }}>
                DM
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>{currentRide?.driver?.name || 'Driver'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', color: '#6b7280' }}>
                  <Star size={14} fill="#fbbf24" color="#fbbf24" />
                  {currentRide?.driver?.rating || '4.8'} • {currentRide?.driver?.vehicle || 'Vehicle'} • {currentRide?.driver?.license || 'License'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button style={{
                  padding: '8px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}>
                  <Phone size={16} />
                </button>
                <button style={{
                  padding: '8px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}>
                  <MessageCircle size={16} />
                </button>
              </div>
            </div>

            {/* Trip Status - commented out */}

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Mark as Completed button - commented out */}

              <button
                onClick={() => cancelRide(currentRide.id, 'Rider cancelled')}
                disabled={isProcessingPayment}
                style={{
                  width: '100%',
                  padding: '16px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: isProcessingPayment ? 'not-allowed' : 'pointer',
                  opacity: isProcessingPayment ? 0.6 : 1
                }}
              >
                {isProcessingPayment ? 'Cancelling...' : '❌ Cancel Ride'}
              </button>

              <button
                onClick={() => setActivePanel('none')}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#f3f4f6',
                  color: '#6b7280',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Hide Panel
              </button>
            </div>
          </div>
        )}


        {/* Book Ride Button */}
        <button
          onClick={bookRide}
          disabled={bookingStatus === 'requesting' || isProcessingPayment || !destination.trim() || !currentLocation || !selectedVehicle}
          style={{
            width: '100%',
            background: (destination.trim() && currentLocation && selectedVehicle) 
              ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' 
              : '#d1d5db',
            color: 'white',
            border: 'none',
            borderRadius: '16px',
            padding: '18px', // Increased padding for better appearance
            fontSize: '18px',
            fontWeight: '700',
            cursor: (destination.trim() && currentLocation && selectedVehicle) ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '16px'
          }}
        >
          {isProcessingPayment ? (
            <>
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTop: '2px solid white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              Processing Payment...
            </>
          ) : bookingStatus === 'requesting' ? (
            <>
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTop: '2px solid white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              Finding Driver...
            </>
          ) : (
            <>
              {selectedPaymentMethod?.type === 'apple_pay' && '🍎'}
              {selectedPaymentMethod?.type === 'google_pay' && '🟢'}
              {(selectedPaymentMethod?.type === 'credit' || selectedPaymentMethod?.type === 'debit') && '💳'}
              {' '}Book {selectedVehicle?.name || 'Ride'}
            </>
          )}
        </button>
      </div>

      {/* Ride Request Prompt with Progressive Circles */}
      <RideRequestPrompt 
        status={rideRequestPromptStatus}
        onClose={() => setRideRequestPromptStatus('hidden')}
      />


      <style>
        {`
          @keyframes slideIn {
            from { opacity: 0; transform: translateX(100%); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .spinner {
            width: 20px;
            height: 20px;
            border: 2px solid rgba(255,255,255,0.3);
            border-top: 2px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.7; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}
      </style>
    </div>
  );
}