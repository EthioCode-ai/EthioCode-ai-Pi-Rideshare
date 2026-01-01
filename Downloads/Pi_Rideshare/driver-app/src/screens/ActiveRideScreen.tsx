/**
 * ActiveRideScreen
 * Main screen for managing an active ride from acceptance to completion
 * 
 * Phase 2.6 - Updated:
 * - Fixed route polyline rendering
 * - Geofence-based "I've Arrived" visibility
 * - Auto-trigger status changes when entering geofence
 * - Proper turn-by-turn display
 * - Grace period from market settings (now 2 min)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Platform,
  StatusBar,
  Linking,
  BackHandler,
  TouchableOpacity,
  Text,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

// Existing services
import locationService from '../services/location.service';
import socketService from '../services/socket.service';
import apiService from '../services/api.service';
import StatusRow from '../components/ActiveRide/StatusRow';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { StorageKeys } from '../constants/StorageKeys';

// Types
import {
  ActiveRide,
  TripStatus,
  isTripActive,
  formatDistance,
  formatDuration,
} from '../types/ride.types';
import type { Location } from '../types';

// Components
import RouteMapView, { RouteMapViewRef } from '../components/ActiveRide/RouteMapView';
import NavigationBar, { NavigationStep } from '../components/ActiveRide/NavigationBar';
import RiderCard from '../components/ActiveRide/RiderCard';
import WaitTimer from '../components/ActiveRide/WaitTimer';
import TripActionButton from '../components/ActiveRide/TripActionButton';

// Utils
import { decodePolyline, Coordinate, haversineDistance } from '../utils/polylineDecoder';

// Navigation types
import { MainStackParamList } from '../navigation/RootNavigator';

type ActiveRideScreenRouteProp = RouteProp<MainStackParamList, 'ActiveRide'>;
type ActiveRideScreenNavigationProp = StackNavigationProp<MainStackParamList, 'ActiveRide'>;

// API base URL
const API_BASE_URL = 'https://ethiocode-ai-pi-rideshare.onrender.com';

// Default market settings (will be fetched from API)
const DEFAULT_MARKET_SETTINGS = {
  gracePeriodSeconds: 120, // 2 minutes (updated)
  waitRatePerMinute: 0.35,
  arrivalRadiusMeters: 35,
};

const ActiveRideScreen: React.FC = () => {
  const navigation = useNavigation<ActiveRideScreenNavigationProp>();
  const route = useRoute<ActiveRideScreenRouteProp>();
  const mapRef = useRef<RouteMapViewRef>(null);

  // Get ride data from navigation params
  const { ride: initialRide , routeData } = route.params;

  // Core state
  const [ride, setRide] = useState<ActiveRide>(initialRide);
  const rideRef = useRef(ride);
  const [user, setUser] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<Location | null>(null);
  const [heading, setHeading] = useState(0);
  
  // Route state
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinate[]>([]);
  const [navigationSteps, setNavigationSteps] = useState<NavigationStep[]>([]);
  const navigationStepsRef = useRef<NavigationStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const currentStepIndexRef = useRef(0);
  const [eta, setEta] = useState('');
  const [totalDistance, setTotalDistance] = useState('');
  const [voiceGuidanceEnabled, setVoiceGuidanceEnabled] = useState(true);
  const lastSpokenStepRef = useRef<number>(-1);
  // Next action (turn-by-turn) - separate from total
  const [nextActionEta, setNextActionEta] = useState('');
  const [nextActionDistance, setNextActionDistance] = useState('');
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(true);
  const [bottomCardExpanded, setBottomCardExpanded] = useState(false);

  // Rerouting state
  const lastRerouteTimeRef = useRef<number>(0);
  const lastRouteRefreshRef = useRef<number>(0);
  const isReroutingRef = useRef<boolean>(false);
  
  // Geofence state
  const [isWithinGeofence, setIsWithinGeofence] = useState(false);
  const [distanceToTargetMeters, setDistanceToTargetMeters] = useState<number | null>(null);
  
  // Wait timer state
  const [waitStartTime, setWaitStartTime] = useState<Date | null>(null);
  
  // Market settings
  const [marketSettings, setMarketSettings] = useState(DEFAULT_MARKET_SETTINGS);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);

  // Track if we've already auto-triggered arrival (prevent double triggers)
  const hasAutoTriggeredArrival = useRef(false);

  // ==================== INITIALIZATION ====================

  // Load user data
useEffect(() => {
  const loadUser = async () => {
    const userData = await AsyncStorage.getItem('@pi_rideshare:user_data');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  };
  loadUser();
}, []);

  // Keep rideRef in sync with ride state
  useEffect(() => {
    rideRef.current = ride;
  }, [ride]);

  useEffect(() => {
    console.log('🚗 ActiveRideScreen mounted');
    initializeScreen();

   
    
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackPress();
      return true;
    });

    // Listen for rider cancellation
    socketService.onRideCancelled((data) => {
      console.log('❌ Rider cancelled the ride:', data);
      Alert.alert(
        'Ride Cancelled',
        'The rider has cancelled this ride.',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Home', params: { stayOnline: true } }],
              });
            },
          },
        ]
      );
    });

    return () => {
      backHandler.remove();
      locationService.stopWatchingLocation();
      socketService.off('ride-cancelled');
    };
  }, []);


   // Load voice guidance setting
useEffect(() => {
  const loadVoiceSetting = async () => {
    try {
      const localSettings = await AsyncStorage.getItem('@driver_settings');
      if (localSettings) {
        const settings = JSON.parse(localSettings);
        setVoiceGuidanceEnabled(settings.voiceGuidance ?? true);
      }
    } catch (error) {
      console.log('Error loading voice setting:', error);
    }
  };
  loadVoiceSetting();
}, []);

  const initializeScreen = async () => {
  console.log('📦 routeData received:', JSON.stringify(routeData, null, 2));
  
  // Start location tracking
  await startLocationTracking();

  // Get initial location
  const location = await locationService.getCurrentLocation();
  if (location) {
    setDriverLocation(location);
    if (location.heading) setHeading(location.heading);
  }

  // Use route data passed from HomeScreen
  if (routeData?.toPickup) {
    const pickupRoute = routeData.toPickup;
    
    // Decode polyline
    if (pickupRoute.polyline) {
      const coords = decodePolyline(pickupRoute.polyline);
      setRouteCoordinates(coords);
      console.log('📍 Polyline decoded:', coords.length, 'points');
    }
    
    // Set navigation steps
    if (pickupRoute.steps) {
      const steps = pickupRoute.steps.map((step: any) => ({
      instruction: step.instruction || '',
      distance: step.distance?.text || `${step.distance?.miles?.toFixed(1)} mi`,
      duration: step.duration?.text || `${step.duration?.minutes} min`,
      maneuver: step.maneuver || '',
      endLocation: step.end_location ? {
      lat: step.end_location.lat,
      lng: step.end_location.lng,
      } : undefined,
    }));
      setNavigationSteps(steps);
      navigationStepsRef.current = steps;
      console.log('📍 Navigation steps:', steps.length);
      
      // Speak first instruction
      console.log('🔊 Voice check - steps:', steps.length, 'instruction:', steps[0]?.instruction?.substring(0, 50));
      if (steps.length > 0 && steps[0].instruction) {
        console.log('🔊 Will speak in 1 second...');
        setTimeout(() => {
          console.log('🔊 Speaking now:', steps[0].instruction.substring(0, 50));
          speakInstruction(steps[0].instruction);
          lastSpokenStepRef.current = 0;
        }, 1000);
      } else {
        console.log('🔊 No steps or no instruction to speak');
      }
    }
    
    // Set ETA and distance
    const miles = pickupRoute.distance?.miles || 0;
    const minutes = pickupRoute.duration?.adjusted_minutes || 0;
    setEta(`${Math.round(minutes)} min`);
    setTotalDistance(`${miles.toFixed(1)} mi`);
    console.log('📍 ETA:', minutes, 'min, Distance:', miles, 'mi');
    
    setIsCalculatingRoute(false);
  }

  // Fetch market settings
  fetchMarketSettings();
};

  // ==================== LOCATION TRACKING ====================

  const startLocationTracking = async () => {
    const hasPermission = await locationService.requestPermissions();
    if (!hasPermission) {
      Alert.alert('Error', 'Location permission is required for navigation');
      return;
    }

    await locationService.startWatchingLocation(
      (location) => {
        setDriverLocation(location);
        if (location.heading) {
          setHeading(location.heading);
        }

        // Broadcast location to rider via socket
        if (socketService.connected) {
          socketService.sendLocationUpdate({
          driverId: user?.id || '',
          latitude: location.latitude,
          longitude: location.longitude,
          heading: location.heading,
          speed: location.speed,
          });
        }

       // Refresh route from Google every 3 seconds (real-time navigation)
        const now = Date.now();
        if (now - lastRouteRefreshRef.current > 3000) {
          lastRouteRefreshRef.current = now;
          refreshRouteFromGoogle(location);
        }


        // Check geofence for arrival
        checkGeofence(location);
        
        // Check step progression for navigation updates
        checkStepProgression(location);
      },
      {
        distanceInterval: 5,
        timeInterval: 500,
      }
    );
  };

  // ==================== ROUTE CALCULATION ====================

  const calculateRoute = async (currentLocation: Location) => {
    setIsCalculatingRoute(true);
    
    try {
      const token = await apiService.getToken();
      console.log('🔑 Token retrieved:', token ? token.substring(0, 20) + '...' : 'NULL');
      if (!token) {
  console.error('No auth token');
  return;
      }

      console.log('📍 Calculating route from:', currentLocation);
      console.log('📍 Pickup:', ride.pickup);
      console.log('📍 Destination:', ride.destination);

      const response = await fetch(`${API_BASE_URL}/api/routes/calculate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          driverLocation: {
            lat: currentLocation.latitude,
            lng: currentLocation.longitude,
            heading: currentLocation.heading,
          },
          pickup: {
            lat: ride.pickup.lat,
            lng: ride.pickup.lng,
          },
          destination: {
            lat: ride.destination.lat,
            lng: ride.destination.lng,
          },
        }),
      });

      const data = await response.json();
      console.log('📍 Route API response:', data.success);

      if (data.success) {
        // Select appropriate route based on status
        const routeData = (ride.status === 'en_route_to_pickup' || ride.status === 'at_pickup')
          ? data.toPickup
          : data.toDestination;

        if (routeData) {
          // Decode polyline
          const polyline = routeData.polyline || '';
          console.log('📍 Polyline length:', polyline.length);
          
          const coords = decodePolyline(polyline);
          console.log('📍 Decoded coordinates:', coords.length);
          
          setRouteCoordinates(coords);

          // Parse navigation steps from Google Directions API format
          const steps: NavigationStep[] = (routeData.steps || []).map((step: any) => ({
            instruction: step.html_instructions || step.instruction || '',
            distance: step.distance?.text || `${(step.distance?.value / 1609.34).toFixed(1)} mi` || '',
            duration: step.duration?.text || `${Math.round(step.duration?.value / 60)} min` || '',
            maneuver: step.maneuver || '',
          }));
          
          console.log('📍 Navigation steps:', steps.length);
          setNavigationSteps(steps);
          navigationStepsRef.current = steps;
          setCurrentStepIndex(0);

          // Set ETA and distance - extract from nested objects
          const distanceMiles = routeData.distance?.miles || 0;
          const durationMinutes = routeData.duration?.adjusted_minutes || routeData.duration?.base_minutes || 0;
          
          setEta(`${Math.round(durationMinutes)} min`);
          setTotalDistance(`${distanceMiles.toFixed(1)} mi`);
          
          console.log('📍 ETA:', `${Math.round(durationMinutes)} min`, 'Distance:', `${distanceMiles.toFixed(1)} mi`);

          // Update geofence radius if provided
          if (data.geofence?.radius_meters) {
            setMarketSettings(prev => ({
              ...prev,
              arrivalRadiusMeters: data.geofence.radius_meters,
            }));
          }
        }
      } else {
        console.error('Route calculation failed:', data.message || data.error);
      }
    } catch (error) {
      console.error('Route calculation error:', error);
    } finally {
      setIsCalculatingRoute(false);
    }
  };


    // Voice guidance
  const speakInstruction = (instruction: string) => {
  console.log('🔊 speakInstruction called, voiceEnabled:', voiceGuidanceEnabled);
  if (!voiceGuidanceEnabled) {
    console.log('🔊 Voice guidance disabled, skipping');
    return;
  }
    try {
      const cleanText = instruction
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim();
      
      if (cleanText) {
        Speech.stop();
        Speech.speak(cleanText, {
          language: 'en-US',
          rate: 0.9,
          pitch: 1.0,
        });
      }
    } catch (error) {
      console.log('Speech error:', error);
    }
  };

  
  // ==================== STEP PROGRESSION ====================

  const checkStepProgression = (location: Location) => {
  const steps = navigationStepsRef.current;
  console.log(`📍 checkStepProgression called - steps: ${steps.length}, currentIndex: ${currentStepIndex}`);
  
  if (steps.length === 0) return;

  // ========== STEP ADVANCEMENT (with catch-up) ==========
  // Find the correct current step based on position
  let newStepIndex = currentStepIndexRef.current;

  for (let i = currentStepIndex; i < steps.length - 1; i++) {
    const thisStep = steps[i];
    const nextStep = steps[i + 1];
    
    if (!thisStep?.endLocation || !nextStep?.endLocation) continue;
    
    const distanceToThisEnd = haversineDistance(
      location.latitude,
      location.longitude,
      thisStep.endLocation.lat,
      thisStep.endLocation.lng
    );
    
    const distanceToNextEnd = haversineDistance(
      location.latitude,
      location.longitude,
      nextStep.endLocation.lat,
      nextStep.endLocation.lng
    );
    
    // If within 50m of this step's end, OR closer to next step's end, advance
    if (distanceToThisEnd < 50 || distanceToNextEnd < distanceToThisEnd) {
      newStepIndex = i + 1;
      console.log(`📍 Should be on step ${newStepIndex + 1}/${steps.length}`);
    } else {
      break;
    }
  }

  if (newStepIndex !== currentStepIndexRef.current) {
    console.log(`📍 Advancing from step ${currentStepIndexRef.current + 1} to ${newStepIndex + 1}`);
    currentStepIndexRef.current = newStepIndex;
    setCurrentStepIndex(newStepIndex);
    
    // Speak the new instruction
    const newStep = steps[newStepIndex];
    if (newStep?.instruction && newStepIndex !== lastSpokenStepRef.current) {
      lastSpokenStepRef.current = newStepIndex;
      // speakInstruction(newStep.instruction);  // Temporarily disabled
    }
}

  // ========== Use the correct step for calculations ==========
  const activeStepIndex = newStepIndex;
  const currentStep = steps[activeStepIndex];
  
  console.log(`📍 Active step endLocation:`, currentStep?.endLocation);

  if (!currentStep?.endLocation) {
    console.log(`📍 No endLocation for step ${activeStepIndex}, using target fallback`);
    // Fallback: calculate directly to target
    const target = rideRef.current.status === 'en_route_to_pickup' 
      ? rideRef.current.pickup 
      : rideRef.current.destination;
    
    const directDistance = haversineDistance(
      location.latitude,
      location.longitude,
      target.lat,
      target.lng
    );
    
    // Update total distance
    const totalMiles = directDistance / 1609.34;
    setTotalDistance(totalMiles > 0.1 ? `${totalMiles.toFixed(1)} mi` : `${Math.round(directDistance * 3.28084)} ft`);
    
    // Update ETA (assuming 25 mph average)
    const etaMinutes = Math.round((totalMiles / 25) * 60);
    setEta(etaMinutes > 0 ? `${etaMinutes} min` : '< 1 min');
    
    return;
  }

  // ========== NEXT ACTION (distance to current step end) ==========
  const distanceToStepEnd = haversineDistance(
    location.latitude,
    location.longitude,
    currentStep.endLocation.lat,
    currentStep.endLocation.lng
  );
  console.log(`📍 Distance to step end: ${distanceToStepEnd.toFixed(0)}m`);

  // Format next action distance
  const nextDistanceFeet = Math.round(distanceToStepEnd * 3.28084);
  const nextDistanceText = nextDistanceFeet > 500
    ? `${(distanceToStepEnd / 1609.34).toFixed(1)} mi`
    : `${nextDistanceFeet} ft`;
  setNextActionDistance(nextDistanceText);

  // Estimate next action time (assuming 25 mph average)
  const nextEstimatedSeconds = Math.round((distanceToStepEnd / 1609.34) / 25 * 3600);
  if (nextEstimatedSeconds < 60) {
    setNextActionEta(`${nextEstimatedSeconds} sec`);
  } else {
    setNextActionEta(`${Math.round(nextEstimatedSeconds / 60)} min`);
  }

  // ========== TOTAL REMAINING (all steps from current position) ==========
  let totalRemainingMeters = distanceToStepEnd;
  let totalRemainingSeconds = nextEstimatedSeconds;

  const remainingSteps = steps.slice(activeStepIndex + 1);
  remainingSteps.forEach(step => {
    const distMatch = step.distance?.match(/([\d.]+)\s*(mi|ft)/);
    if (distMatch) {
      const val = parseFloat(distMatch[1]);
      const meters = distMatch[2] === 'mi' ? val * 1609.34 : val * 0.3048;
      totalRemainingMeters += meters;
    }
    const durMatch = step.duration?.match(/([\d.]+)\s*(min|sec)/);
    if (durMatch) {
      const val = parseFloat(durMatch[1]);
      totalRemainingSeconds += durMatch[2] === 'min' ? val * 60 : val;
    }
  });

  // Format total distance
  const totalFeet = Math.round(totalRemainingMeters * 3.28084);
  const totalDistanceText = totalFeet > 500
    ? `${(totalRemainingMeters / 1609.34).toFixed(1)} mi`
    : `${totalFeet} ft`;
  setTotalDistance(totalDistanceText);

  // Format total ETA
  if (totalRemainingSeconds < 60) {
    setEta(`${Math.round(totalRemainingSeconds)} sec`);
  } else {
    setEta(`${Math.round(totalRemainingSeconds / 60)} min`);
  }
};

// Helper: Calculate perpendicular distance from point to line segment
const distanceToSegment = (
  point: { latitude: number; longitude: number },
  segStart: { latitude: number; longitude: number },
  segEnd: { latitude: number; longitude: number }
): number => {
  const dx = segEnd.longitude - segStart.longitude;
  const dy = segEnd.latitude - segStart.latitude;
  
  if (dx === 0 && dy === 0) {
    return haversineDistance(point.latitude, point.longitude, segStart.latitude, segStart.longitude);
  }
  
  const t = Math.max(0, Math.min(1, 
    ((point.longitude - segStart.longitude) * dx + (point.latitude - segStart.latitude) * dy) / 
    (dx * dx + dy * dy)
  ));
  
  const closestLat = segStart.latitude + t * dy;
  const closestLng = segStart.longitude + t * dx;
  
  return haversineDistance(point.latitude, point.longitude, closestLat, closestLng);
};

// ==================== POLYLINE DISTANCE HELPERS ====================
// Calculate total distance along polyline from current location to end
const distanceAlongPolylineToEnd = (
  currentLocation: { latitude: number; longitude: number },
  polyline: Coordinate[]
): number => {
  if (polyline.length < 2) return 0;

  let closestIndex = 0;
  let closestDistance = Infinity;
  let closestT = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const segStart = polyline[i];
    const segEnd = polyline[i + 1];
    
    const dx = segEnd.longitude - segStart.longitude;
    const dy = segEnd.latitude - segStart.latitude;
    
    let t = 0;
    if (dx !== 0 || dy !== 0) {
      t = Math.max(0, Math.min(1,
        ((currentLocation.longitude - segStart.longitude) * dx + 
         (currentLocation.latitude - segStart.latitude) * dy) /
        (dx * dx + dy * dy)
      ));
    }
    
    const projLat = segStart.latitude + t * dy;
    const projLng = segStart.longitude + t * dx;
    
    const dist = haversineDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      projLat,
      projLng
    );
    
    if (dist < closestDistance) {
      closestDistance = dist;
      closestIndex = i;
      closestT = t;
    }
  }

  let totalDistance = 0;

  // Distance from projected point to end of current segment
  const segStart = polyline[closestIndex];
  const segEnd = polyline[closestIndex + 1];
  const projectedLat = segStart.latitude + closestT * (segEnd.latitude - segStart.latitude);
  const projectedLng = segStart.longitude + closestT * (segEnd.longitude - segStart.longitude);
  
  totalDistance += haversineDistance(projectedLat, projectedLng, segEnd.latitude, segEnd.longitude);

  // Sum remaining segments to end
  for (let i = closestIndex + 1; i < polyline.length - 1; i++) {
    totalDistance += haversineDistance(
      polyline[i].latitude,
      polyline[i].longitude,
      polyline[i + 1].latitude,
      polyline[i + 1].longitude
    );
  }

  return totalDistance;
};

// Calculate distance along polyline from current location to a target point
const distanceAlongPolylineToTarget = (
  currentLocation: { latitude: number; longitude: number },
  targetLocation: { lat: number; lng: number },
  polyline: Coordinate[]
): number => {
  if (polyline.length < 2) return 0;

  // Find driver's position on polyline
  let driverIndex = 0;
  let driverDistance = Infinity;
  let driverT = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const segStart = polyline[i];
    const segEnd = polyline[i + 1];
    
    const dx = segEnd.longitude - segStart.longitude;
    const dy = segEnd.latitude - segStart.latitude;
    
    let t = 0;
    if (dx !== 0 || dy !== 0) {
      t = Math.max(0, Math.min(1,
        ((currentLocation.longitude - segStart.longitude) * dx + 
         (currentLocation.latitude - segStart.latitude) * dy) /
        (dx * dx + dy * dy)
      ));
    }
    
    const projLat = segStart.latitude + t * dy;
    const projLng = segStart.longitude + t * dx;
    
    const dist = haversineDistance(currentLocation.latitude, currentLocation.longitude, projLat, projLng);
    
    if (dist < driverDistance) {
      driverDistance = dist;
      driverIndex = i;
      driverT = t;
    }
  }

  // Find target's closest point on polyline
  let targetIndex = 0;
  let targetDistance = Infinity;
  let targetT = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const segStart = polyline[i];
    const segEnd = polyline[i + 1];
    
    const dx = segEnd.longitude - segStart.longitude;
    const dy = segEnd.latitude - segStart.latitude;
    
    let t = 0;
    if (dx !== 0 || dy !== 0) {
      t = Math.max(0, Math.min(1,
        ((targetLocation.lng - segStart.longitude) * dx + 
         (targetLocation.lat - segStart.latitude) * dy) /
        (dx * dx + dy * dy)
      ));
    }
    
    const projLat = segStart.latitude + t * dy;
    const projLng = segStart.longitude + t * dx;
    
    const dist = haversineDistance(targetLocation.lat, targetLocation.lng, projLat, projLng);
    
    if (dist < targetDistance) {
      targetDistance = dist;
      targetIndex = i;
      targetT = t;
    }
  }

  // If target is behind driver, return 0
  if (targetIndex < driverIndex || (targetIndex === driverIndex && targetT <= driverT)) {
    return 0;
  }

  let totalDistance = 0;

  if (driverIndex === targetIndex) {
    // Same segment - calculate partial distance
    const segStart = polyline[driverIndex];
    const segEnd = polyline[driverIndex + 1];
    const segLength = haversineDistance(segStart.latitude, segStart.longitude, segEnd.latitude, segEnd.longitude);
    totalDistance = segLength * (targetT - driverT);
  } else {
    // Driver's remaining distance in current segment
    const driverSegStart = polyline[driverIndex];
    const driverSegEnd = polyline[driverIndex + 1];
    const driverSegLength = haversineDistance(
      driverSegStart.latitude, driverSegStart.longitude,
      driverSegEnd.latitude, driverSegEnd.longitude
    );
    totalDistance += driverSegLength * (1 - driverT);

    // Full segments between
    for (let i = driverIndex + 1; i < targetIndex; i++) {
      totalDistance += haversineDistance(
        polyline[i].latitude, polyline[i].longitude,
        polyline[i + 1].latitude, polyline[i + 1].longitude
      );
    }

    // Target's portion of its segment
    const targetSegStart = polyline[targetIndex];
    const targetSegEnd = polyline[targetIndex + 1];
    const targetSegLength = haversineDistance(
      targetSegStart.latitude, targetSegStart.longitude,
      targetSegEnd.latitude, targetSegEnd.longitude
    );
    totalDistance += targetSegLength * targetT;
  }

  return totalDistance;
};

// ==================== REROUTING LOGIC ====================
const checkOffRoute = (location: Location): boolean => {
  // Don't check if no route coordinates
  if (routeCoordinates.length < 2) return false;

  // Find minimum distance to any point on route
  let minDistance = Infinity;
  for (const coord of routeCoordinates) {
    const dist = haversineDistance(
      location.latitude,
      location.longitude,
      coord.latitude,
      coord.longitude
    );
    if (dist < minDistance) minDistance = dist;
  }

  // If more than 100 meters off route, trigger reroute
  const isOffRoute = minDistance > 30;
  if (isOffRoute) {
    console.log(`⚠️ Driver is ${minDistance.toFixed(0)}m off route`);
  }
  return isOffRoute;
};

// ==================== REAL-TIME ROUTE REFRESH ====================
const refreshRouteFromGoogle = async (location: Location) => {
  // Don't refresh if not in active navigation
  if (ride.status !== 'en_route_to_pickup' && ride.status !== 'in_trip') return;
  
  try {
    const token = await apiService.getToken();
    if (!token) return;

    // Determine target based on ride status
    const target = ride.status === 'en_route_to_pickup'
      ? { lat: ride.pickup.lat, lng: ride.pickup.lng }
      : { lat: ride.destination.lat, lng: ride.destination.lng };

    const response = await fetch(`${API_BASE_URL}/api/routes/calculate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        driverLocation: {
          lat: location.latitude,
          lng: location.longitude,
        },
        pickup: { lat: ride.pickup.lat, lng: ride.pickup.lng },
        destination: { lat: ride.destination.lat, lng: ride.destination.lng },
        refreshRoute: true,
        rideStatus: ride.status,
      }),
    });

    const data = await response.json();

    if (data.success) {
      const routeData = ride.status === 'en_route_to_pickup'
        ? data.toPickup
        : data.toDestination;

      // Update polyline
      if (routeData?.polyline) {
        const coords = decodePolyline(routeData.polyline);
        setRouteCoordinates(coords);
      }

      // Update navigation steps
      if (routeData?.steps && routeData.steps.length > 0) {
        const steps = routeData.steps.map((step: any) => ({
          instruction: step.instruction || '',
          distance: step.distance?.text || '',
          duration: step.duration?.text || '',
          maneuver: step.maneuver || '',
          endLocation: step.end_location ? {
            lat: step.end_location.lat,
            lng: step.end_location.lng,
          } : undefined,
        }));
        setNavigationSteps(steps);
        navigationStepsRef.current = steps;
        
        // Update ETA and distance from Google's response
        if (routeData.duration?.text) {
          setEta(routeData.duration.text);
        }
        if (routeData.distance?.text) {
          setTotalDistance(routeData.distance.text);
        }
      }
    }
  } catch (error) {
    console.error('Route refresh failed:', error);
  }
};




const triggerReroute = async (location: Location) => {
  // Prevent multiple reroutes within 2 seconds
  const now = Date.now();
  if (now - lastRerouteTimeRef.current < 2000) return;
  if (isReroutingRef.current) return;
  
  console.log('🔄 Rerouting from current position...');
  isReroutingRef.current = true;
  lastRerouteTimeRef.current = now;
  
  try {
    // Determine target based on ride status
    const target = ride.status === 'en_route_to_pickup' 
      ? { lat: ride.pickup.lat, lng: ride.pickup.lng }
      : { lat: ride.destination.lat, lng: ride.destination.lng };
    
    const token = await apiService.getToken();
    if (!token) {
      console.error('No auth token for reroute');
      return;
    }
    
    const response = await fetch(`${API_BASE_URL}/api/routes/calculate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        driverLocation: {
          lat: location.latitude,
          lng: location.longitude,
           heading: location.heading,
        },
        pickup: target,
        destination: ride.status === 'en_route_to_pickup' 
          ? { lat: ride.destination.lat, lng: ride.destination.lng }
          : target,
        refreshRoute: true,
      }),
    });
    
    const data = await response.json();
    
    if (data.toPickup?.polyline || data.toDestination?.polyline) {
      const routeData = ride.status === 'en_route_to_pickup' 
        ? data.toPickup 
        : data.toDestination;
      
      if (routeData?.polyline) {
        const coords = decodePolyline(routeData.polyline);
        setRouteCoordinates(coords);
      }
      
      if (routeData?.steps) {
        const steps = routeData.steps.map((step: any) => ({
          instruction: step.instruction || '',
          distance: step.distance?.text || '',
          duration: step.duration?.text || '',
          maneuver: step.maneuver || '',
          endLocation: step.end_location ? {
            lat: step.end_location.lat,
            lng: step.end_location.lng,
          } : undefined,
        }));
        setNavigationSteps(steps);
        navigationStepsRef.current = steps;
        currentStepIndexRef.current = 0;
        setCurrentStepIndex(0);
      }
      
      console.log('✅ Reroute complete');
    }
  } catch (error) {
    console.error('❌ Reroute failed:', error);
  } finally {
    isReroutingRef.current = false;
  }
};

  // ==================== GEOFENCE DETECTION ====================

  const checkGeofence = (location: Location) => {
    // Use ref to get current ride state (avoids stale closure)
    const currentRide = rideRef.current;
    
    console.log(`📍 checkGeofence - status: ${currentRide.status}, target: ${currentRide.status === 'in_trip' ? 'destination' : 'pickup'}`);

    const target = currentRide.status === 'en_route_to_pickup'
      ? currentRide.pickup
      : currentRide.status === 'in_trip'
        ? currentRide.destination
        : null;

    if (!target) {
      setIsWithinGeofence(false);
      return;
    }

    const distanceMeters = haversineDistance(
      location.latitude,
      location.longitude,
      target.lat,
      target.lng
    );

    console.log(`📍 Geofence distance: ${distanceMeters.toFixed(0)}m (threshold: ${marketSettings.arrivalRadiusMeters}m)`);

    setDistanceToTargetMeters(distanceMeters);

    const withinGeofence = distanceMeters <= marketSettings.arrivalRadiusMeters;
    setIsWithinGeofence(withinGeofence);

    // Auto-trigger arrival if within geofence
    if (withinGeofence && !hasAutoTriggeredArrival.current) {
      hasAutoTriggeredArrival.current = true;

      if (currentRide.status === 'en_route_to_pickup') {
        console.log('🎯 Auto-triggering arrival at pickup');
        handleArrivedAtPickup();
      } else if (currentRide.status === 'in_trip') {
        console.log('🎯 Auto-triggering arrival at destination');
        handleArrivedAtDestination();
      }
    }

    // Reset auto-trigger if we leave geofence
    if (!withinGeofence && hasAutoTriggeredArrival.current) {
      hasAutoTriggeredArrival.current = false;
    }
  };

  // ==================== MARKET SETTINGS ====================

  const fetchMarketSettings = async () => {
    try {
      const token = await apiService.getToken();
      if (!token) return;

      const response = await fetch(
        `${API_BASE_URL}/api/settings/for-location?lat=${ride.pickup.lat}&lng=${ride.pickup.lng}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      const data = await response.json();
      if (data.gracePeriodSeconds) {
        console.log('📍 Market settings loaded:', data);
        setMarketSettings({
          gracePeriodSeconds: data.gracePeriodSeconds,
          waitRatePerMinute: data.waitRatePerMinute || 0.50,
          arrivalRadiusMeters: data.arrivalRadiusMeters || 100,
        });
      }
    } catch (error) {
      console.log('Using default market settings');
    }
  };

  // ==================== STATUS TRANSITIONS ====================

  const handleArrivedAtPickup = async () => {
    if (ride.status !== 'en_route_to_pickup') return;

    console.log('📍 Arrived at pickup');

    setRide(prev => ({
      ...prev,
      status: 'at_pickup',
      arrivedAt: new Date().toISOString(),
    }));

    setWaitStartTime(new Date());

    // Notify via socket
    socketService.updateTripStatus(ride.rideId, 'pickup');
  };

  const handleStartTrip = async () => {
    if (ride.status !== 'at_pickup') return;

    console.log('▶️ Starting trip');
    setIsLoading(true);

    try {
      // Reset geofence tracking for destination
      hasAutoTriggeredArrival.current = false;
      setIsWithinGeofence(false);

      setRide(prev => ({
        ...prev,
        status: 'in_trip',
        startedAt: new Date().toISOString(),
      }));

      console.log('▶️ Starting trip');
       setWaitStartTime(null);  // Kill wait timer immediately
       setIsLoading(true);

      // Notify via socket
      socketService.updateTripStatus(ride.rideId, 'enroute');

      // Use stored route data for destination (avoid API call)
if (routeData?.toDestination) {
  try {
    const destRoute = routeData.toDestination;
    
    if (destRoute.polyline) {
      const decoded = decodePolyline(destRoute.polyline);
      setRouteCoordinates(decoded);
    }
    
    if (destRoute.steps) {
      const steps = destRoute.steps.map((step: any) => ({
      instruction: step.instruction || '',
      distance: step.distance?.text || '',
      duration: step.duration?.text || '',
      maneuver: step.maneuver || 'straight',
      endLocation: step.end_location ? {
       lat: step.end_location.lat,
       lng: step.end_location.lng,
       } : undefined,
       }));
      setNavigationSteps(steps);
      setCurrentStepIndex(0);
    }
    
    const mins = destRoute.duration?.adjusted_minutes || 0;
    const miles = destRoute.distance?.miles || 0;
    setEta(`${mins} min`);
    setTotalDistance(`${miles.toFixed(1)} mi`);
  } catch (err) {
    console.log('⚠️ Error using stored route data:', err);
  }
}
}
     finally {
      setIsLoading(false);
    }
  };

  const handleArrivedAtDestination = async () => {
  if (ride.status !== 'in_trip') return;

  console.log('🏁 Arrived at destination');

  // Notify via socket
  socketService.updateTripStatus(ride.rideId, 'completed');

  // Navigate to Home with trip summary data
  navigation.reset({
    index: 0,
    routes: [{
      name: 'Home',
      params: {
        completedTrip: {
          rideId: ride.rideId,
          fare: ride.fare.estimated,
          distance: ride.distance.toDestination?.miles || 0,
          riderName: ride.rider.name,
          completedAt: new Date().toISOString(),
        },
      stayOnline: true,
},
    }],
  });
};


  const handleCompleteTrip = async () => {
    console.log('✅ Trip completed, returning home');

    navigation.reset({
    index: 0,
    routes: [{ name: 'Home', params: { stayOnline: true } }],
  });
   };

  // ==================== ACTION HANDLERS ====================

  const handlePrimaryAction = () => {
    switch (ride.status) {
      case 'en_route_to_pickup':
        if (isWithinGeofence) {
          handleArrivedAtPickup();
        }
        break;
      case 'at_pickup':
        handleStartTrip();
        break;
      case 'in_trip':
        handleArrivedAtDestination();
        break;
      case 'completed':
        handleCompleteTrip();
        break;
    }
  };

  const handleCallRider = () => {
    if (ride.rider.phone) {
      Linking.openURL(`tel:${ride.rider.phone}`);
    } else {
      Alert.alert('Unable to Call', 'Rider phone number not available');
    }
  };

  const handleMessageRider = () => {
    Alert.alert('Message', 'In-app chat coming soon!');
  };

  const handleCancelRide = () => {
    Alert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel? This may affect your rating.',
      [
        { text: 'Keep Ride', style: 'cancel' },
        {
          text: 'Cancel Ride',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await apiService.getToken();
              await fetch(`${API_BASE_URL}/api/rides/${ride.rideId}/cancel`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  cancelledBy: 'driver',
                  reason: 'Driver cancelled',
                }),
              });

              navigation.reset({
                index: 0,
                routes: [{ name: 'Home', params: { stayOnline: true } }],
              });
            } catch (error) {
              console.error('Cancel error:', error);
              Alert.alert('Error', 'Failed to cancel ride');
            }
          },
        },
      ]
    );
  };

  const handleBackPress = () => {
    if (isTripActive(ride.status)) {
      Alert.alert(
        'Active Ride',
        'You have an active ride. Do you want to cancel it?',
        [
          { text: 'Continue Ride', style: 'cancel' },
          { text: 'Cancel Ride', style: 'destructive', onPress: handleCancelRide },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  // ==================== COMPUTED VALUES ====================

  const distanceToTargetMiles = distanceToTargetMeters 
    ? distanceToTargetMeters / 1609.34 
    : undefined;

  const etaMinutes = eta 
    ? parseInt(eta.replace(/\D/g, '')) || undefined 
    : undefined;

  const showNavigationBar = ride.status === 'en_route_to_pickup' || ride.status === 'in_trip';
  const showWaitTimer = ride.status === 'at_pickup' && waitStartTime !== null;
  const showCancelButton = ride.status === 'en_route_to_pickup' || ride.status === 'at_pickup';

  // ==================== RENDER ====================

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Map with route */}
      <RouteMapView
        ref={mapRef}
        driverLocation={driverLocation}
        heading={heading}
        pickup={ride.pickup}
        destination={ride.destination}
        routeCoordinates={routeCoordinates}
        tripStatus={ride.status}
        riderName={ride.rider.name}
      />

      {/* Navigation bar (turn-by-turn) */}
      {showNavigationBar && (
      <NavigationBar
     currentStep={navigationSteps[currentStepIndex + 1] || { 
     instruction: 'Arrive at destination', 
     maneuver: 'arrive',
     distance: nextActionDistance,
     duration: nextActionEta
     }}
     nextStep={navigationSteps[currentStepIndex + 2] || null}
     eta={nextActionEta}
     totalDistance={nextActionDistance}
     isCalculating={isCalculatingRoute}
/>
      )}

      {/* Bottom panel */}
<View style={styles.bottomPanel}>
  {/* Status row - show during en_route_to_pickup */}
    {ride.status === 'en_route_to_pickup' && (
    <>
      <TouchableOpacity onPress={() => setBottomCardExpanded(!bottomCardExpanded)}>
        <StatusRow
          riderName={ride.rider.name}
          address={ride.pickup.address}
          tripStatus={ride.status}
          distance={totalDistance}
          eta={eta}
        />
      </TouchableOpacity>
      {bottomCardExpanded && (
        <>
          <View style={styles.riderInfoRow}>
            <View style={styles.riderAvatar}>
              <Text style={styles.riderInitials}>
                {ride.rider.name.split(' ').map(n => n[0]).join('')}
              </Text>
            </View>
            <View style={styles.riderDetails}>
              <Text style={styles.riderName}>{ride.rider.name}</Text>
              <Text style={styles.riderRating}>{'★'.repeat(Math.round(ride.rider.rating || 4.5))} {ride.rider.rating || 4.5}</Text>
            </View>
            <TouchableOpacity style={styles.actionButton} onPress={handleMessageRider}>
              <Text style={styles.actionButtonIcon}>💬</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleCallRider}>
              <Text style={styles.actionButtonIcon}>📞</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelRide}
          >
            <Text style={styles.cancelButtonText}>Cancel Ride</Text>
          </TouchableOpacity>
        </>
      )}
    </>
  )}

  {/* Full UI - only at pickup */}
  {ride.status === 'at_pickup' && (
    <>
      <RiderCard
        rider={ride.rider}
        pickup={ride.pickup}
        destination={ride.destination}
        tripStatus={ride.status}
        distanceToTarget={distanceToTargetMiles}
        etaToTarget={etaMinutes}
        onCall={handleCallRider}
        onMessage={handleMessageRider}
        onCancel={handleCancelRide}
        showCancelButton={false}
      />

      {showWaitTimer && (
        <WaitTimer
          startTime={waitStartTime}
          gracePeriodSeconds={marketSettings.gracePeriodSeconds}
          waitRatePerMinute={marketSettings.waitRatePerMinute}
        />
      )}

      <TripActionButton
        tripStatus={ride.status}
        isWithinGeofence={isWithinGeofence}
        onPress={handlePrimaryAction}
        loading={isLoading}
        eta={eta}
        distanceToTarget={totalDistance}
      />
    </>
  )}

    {/* Minimal bar during trip */}
  {ride.status === 'in_trip' && (
    <>
      <TouchableOpacity onPress={() => setBottomCardExpanded(!bottomCardExpanded)}>
        <View style={styles.minimalTripBar}>
          <Text style={styles.minimalTripTime}>{eta}</Text>
          <Text style={styles.minimalTripText}>Dropping off {ride.rider.name}</Text>
          <Text style={styles.minimalTripDistance}>{totalDistance}</Text>
        </View>
      </TouchableOpacity>
      {(bottomCardExpanded || isWithinGeofence) && (
        <View style={styles.completeTripContainer}>
          <TouchableOpacity
            style={styles.completeTripButton}
            onPress={handlePrimaryAction}
            disabled={isLoading}
          >
            <Text style={styles.completeTripButtonText}>
              {isLoading ? 'Completing...' : 'Complete Trip'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  )}
</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  completeTripButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  completeTripButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  completeTripContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  cancelButton: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  cancelButtonText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
  },
  minimalTripBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  minimalTripTime: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  minimalTripText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
  },
  minimalTripDistance: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  riderInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  riderAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  riderInitials: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  riderDetails: {
    flex: 1,
    marginLeft: 12,
  },
  riderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  riderRating: {
    fontSize: 14,
    color: '#6B7280',
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  actionButtonIcon: {
    fontSize: 20,
  },

});

export default ActiveRideScreen;