import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { rideService } from '../services/ride.service';
import { directionsService } from '../services/directions.service';
import { socketService } from '../services/socket.service';
import { useAuth } from '../context/AuthContext';
import { VehicleInfo } from '../constants';
import { RideEstimate } from '../types';
import SchedulePicker from '../components/SchedulePicker';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'RideConfirm'>;
type RouteProps = RouteProp<RootStackParamList, 'RideConfirm'>;

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3d3d5c' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a3d2e' }] },
];

const RideConfirmScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { colors, isDark } = useTheme();
  const mapRef = useRef<MapView>(null);

  const { pickup, destination } = route.params;
 const { user } = useAuth();

  // State
  const [selectedVehicle, setSelectedVehicle] = useState('economy');
  const [estimates, setEstimates] = useState<RideEstimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [rideMode, setRideMode] = useState<'now' | 'schedule'>('now');
  const [scheduledTime, setScheduledTime] = useState<Date | null>(null);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [aiRecommendation, setAiRecommendation] = useState<{
    suggestion: string;
    savings: number;
    reason: string;
  } | null>(null);

   // Ride request states
  const [searchingForDriver, setSearchingForDriver] = useState(false);
  const [searchStatus, setSearchStatus] = useState<string>('');
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [currentFare, setCurrentFare] = useState<number>(0);  // ✅ ADDED
  const [searchError, setSearchError] = useState<string | null>(null);
  const currentRideIdRef = useRef<string | null>(null);  // ADD THIS
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchEstimates();
    fetchRoute();
  }, []);
  // Handle voice-initiated scheduled rides
   useEffect(() => {
     if (route.params?.scheduledTime) {
      const scheduledDate = new Date(route.params.scheduledTime);
      setScheduledTime(scheduledDate);
      setRideMode('schedule');
   }
 }, [route.params?.scheduledTime]);

 // Cleanup socket listeners on unmount
  useEffect(() => {
    return () => {
      // Clear search timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      // Remove socket listeners
      socketService.removeListener('finding-driver');
      socketService.removeListener('ride-accepted');
      socketService.removeListener('no-drivers-available');
    };
  }, []);

  const fetchEstimates = async () => {
    setLoading(true);
    try {
      console.log('📊 Fetching estimates for:', JSON.stringify({ pickup, destination }));
      const result = await rideService.getEstimate(pickup, destination);
      console.log('📊 Estimate API result:', JSON.stringify(result, null, 2));
      if (result.success && result.estimates) {
        console.log('✅ Setting estimates:', result.estimates.length, 'vehicle types');
        result.estimates.forEach((e: any) => console.log(`   - ${e.vehicleType}: $${e.totalFare}`));
        setEstimates(result.estimates);

        const currentSurge = result.estimates[0]?.surgeMultiplier || 1;
        if (currentSurge > 1.2) {
          setAiRecommendation({
            suggestion: 'Wait 10 min',
            savings: Math.round((currentSurge - 1) * (result.estimates[0]?.baseFare || 10)),
            reason: `Surge drops to 1.0x in ~10 min. Save $${Math.round((currentSurge - 1) * (result.estimates[0]?.baseFare || 10))}.`,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching estimates:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoute = async () => {
    try {
      const routeData = await directionsService.getRoute(pickup, destination);
      if (routeData) {
        setRouteCoordinates(routeData.polylinePoints);

        setTimeout(() => {
          if (mapRef.current && routeData.polylinePoints.length > 0) {
            mapRef.current.fitToCoordinates(routeData.polylinePoints, {
              edgePadding: { top: 120, right: 50, bottom: 50, left: 50 },
              animated: true,
            });
          }
        }, 500);
      } else {
        setRouteCoordinates([pickup, destination]);
        fitMapToRoute();
      }
    } catch (error) {
      console.error('Error fetching route:', error);
      setRouteCoordinates([pickup, destination]);
      fitMapToRoute();
    }
  };

  const fitMapToRoute = () => {
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        [
          { latitude: pickup.latitude, longitude: pickup.longitude },
          { latitude: destination.latitude, longitude: destination.longitude },
        ],
        {
          edgePadding: { top: 120, right: 50, bottom: 50, left: 50 },
          animated: true,
        }
      );
    }, 500);
  };

  const handleSchedulePress = () => {
    setShowSchedulePicker(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleScheduleConfirm = (date: Date) => {
    setScheduledTime(date);
    setRideMode('schedule');
    setShowSchedulePicker(false);
  };

  const formatScheduledTime = (date: Date): string => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let dayStr = '';
    if (date.toDateString() === now.toDateString()) {
      dayStr = 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      dayStr = 'Tomorrow';
    } else {
      dayStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${dayStr} at ${timeStr}`;
  };

  const handleBookRide = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setBooking(true);
    setSearchError(null);

    try {
      // Handle scheduled rides (keep existing logic)
      if (rideMode === 'schedule' && scheduledTime) {
        const existingData = await AsyncStorage.getItem('scheduledRides');
        const existingRides = existingData ? JSON.parse(existingData) : [];
        const newRide = {
          id: `scheduled-${Date.now()}`,
          pickupAddress: pickup.address,
          destinationAddress: destination.address,
          scheduledTime: scheduledTime.toISOString(),
          vehicleType: selectedVehicle,
          fare: selectedEstimate?.totalFare || 12 * VehicleInfo[selectedVehicle as keyof typeof VehicleInfo]?.baseMultiplier,
          driver: null,
        };
        existingRides.push(newRide);
        await AsyncStorage.setItem('scheduledRides', JSON.stringify(existingRides));
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
        return;
      }

      // === REAL-TIME RIDE REQUEST FLOW ===
      
      // Ensure socket is connected
      if (user) {
        socketService.connect(user, pickup);
      }

      // Set up socket listeners BEFORE making API call
      setupSocketListeners();

      // Show searching UI
      setSearchingForDriver(true);
      setSearchStatus('Requesting ride...');

      // Make API request
      console.log('🚗 Requesting ride...');
      const result = await rideService.requestRide(
        pickup,
        destination,
        selectedVehicle,
        'card',
        []
      );

      if (result.success && result.ride) {
        setCurrentRideId(result.ride.id);
        currentRideIdRef.current = result.ride.id;  // ADD THIS
        setCurrentFare((result.ride as any).estimated_fare || (result.ride as any).estimatedFare || 0);  // ✅ ADDED
        setSearchStatus('Finding the best π driver for you...');
        console.log('✅ Ride created:', result.ride.id, 'Fare:', currentFare);

        // Set timeout for driver search (60 seconds)
        searchTimeoutRef.current = setTimeout(() => {
          handleSearchTimeout();
        }, 60000);

      } else {
        // API call failed
        console.error('❌ Ride request failed:', result.error);
        setSearchingForDriver(false);
        setBooking(false);
        setSearchError(result.error || 'Failed to request ride. Please try again.');
      }

    } catch (error) {
      console.error('Error booking ride:', error);
      setSearchingForDriver(false);
      setBooking(false);
      setSearchError('Network error. Please check your connection.');
    }
  };

  const setupSocketListeners = () => {
     console.log('🔌 Setting up socket listeners, connected:', socketService.isConnected());
    // Listen for "finding driver" status updates
    socketService.onFindingDriver((data) => {
      console.log('🔍 Finding driver:', data);
      setSearchStatus(data.message || 'Searching for nearby drivers...');
    });

    // Listen for ride acceptance
    socketService.onRideAccepted((data) => {
      console.log('🎉 Ride accepted:', data);
      
      // Clear timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      // Haptic feedback for success
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Navigate to ActiveRide with driver data
       navigation.replace('ActiveRide', {
        rideId: data.rideId || currentRideIdRef.current!,
        driver: data.driver,
        pickup: pickup,
        destination: destination,
        eta: data.eta,
        fare: currentFare,  // ✅ ADDED
      });
    });

    // Listen for no drivers available
    socketService.onNoDriversAvailable((data) => {
      console.log('😔 No drivers available:', data);
      
      // Clear timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      setSearchingForDriver(false);
      setBooking(false);
      setSearchError(data.message || 'No drivers available in your area. Please try again in a few minutes.');
      
      // Haptic feedback for error
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    });
  };

  const handleSearchTimeout = () => {
    console.log('⏱️ Search timeout');
    setSearchingForDriver(false);
    setBooking(false);
    setSearchError('Taking longer than usual. No drivers responded. Please try again.');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  const cancelSearch = async () => {
    // Clear timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Cancel ride on server if we have a rideId
    if (currentRideId) {
      try {
        await rideService.cancelRide(currentRideId, 'Rider cancelled during search');
      } catch (error) {
        console.error('Error cancelling ride:', error);
      }
    }

    // Reset states
    setSearchingForDriver(false);
    setBooking(false);
    setCurrentRideId(null);
    setSearchStatus('');
    
    // Remove listeners
    socketService.removeListener('finding-driver');
    socketService.removeListener('ride-accepted');
    socketService.removeListener('no-drivers-available');
  };

  const getEstimateForVehicle = (vehicleType: string): RideEstimate | undefined => {
    return estimates.find((e) => e.vehicleType === vehicleType);
  };

  const selectedEstimate = getEstimateForVehicle(selectedVehicle);

  const vehicleOptions = Object.entries(VehicleInfo).map(([key, info]) => ({
    id: key,
    ...info,
    estimate: getEstimateForVehicle(key),
  }));

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    mapContainer: {
      height: SCREEN_HEIGHT * 0.38,
      position: 'relative',
    },
    map: {
      flex: 1,
    },
    header: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 50 : 35,
      left: 15,
      zIndex: 10,
    },
    backButton: {
      width: 46,
      height: 46,
      backgroundColor: colors.card,
      borderRadius: 23,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.primary,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    },
    backIcon: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.primary,
    },
    routeCard: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 50 : 35,
      left: 70,
      right: 15,
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      zIndex: 10,
    },
    routeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    routeDots: {
      alignItems: 'center',
      gap: 2,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    dotPickup: {
      backgroundColor: colors.primary,
    },
    dotDest: {
      backgroundColor: colors.secondary,
    },
    routeLine: {
      width: 2,
      height: 14,
      backgroundColor: colors.cardBorder,
    },
    routeTexts: {
      flex: 1,
      gap: 8,
    },
    routeText: {
      fontSize: 12,
      color: colors.text,
    },
    bottomSheet: {
      flex: 1,
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 10,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderBottomWidth: 0,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.textMuted,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 10,
    },
    timingContainer: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginBottom: 12,
      backgroundColor: colors.inputBackground,
      borderRadius: 10,
      padding: 3,
    },
    timingButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 8,
      gap: 6,
    },
    timingButtonActive: {
      backgroundColor: colors.primary,
    },
    timingButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    timingButtonTextActive: {
      color: isDark ? '#0d0d1a' : '#ffffff',
    },
    timingIcon: {
      fontSize: 14,
    },
    contentScroll: {
      flex: 1,
    },
    aiInsight: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginBottom: 10,
      padding: 10,
      backgroundColor: `${colors.primary}15`,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: `${colors.primary}30`,
    },
    aiIcon: {
      fontSize: 18,
      marginRight: 8,
    },
    aiText: {
      flex: 1,
      fontSize: 11,
      color: colors.primary,
    },
    aiAction: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
      textDecorationLine: 'underline',
    },
    surgeInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginBottom: 8,
      gap: 8,
    },
    surgeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: `${colors.primary}15`,
      borderRadius: 6,
      gap: 4,
    },
    surgeText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginHorizontal: 16,
      marginBottom: 10,
    },
    vehicleScrollContainer: {
      marginBottom: 6,
    },
    vehicleScroll: {
      paddingHorizontal: 12,
    },
    vehicleScrollContent: {
      paddingHorizontal: 4,
      paddingRight: 30,
    },
    scrollIndicator: {
      alignItems: 'flex-end',
      paddingRight: 16,
      marginTop: 2,
    },
    scrollIndicatorText: {
      fontSize: 10,
      color: colors.textMuted,
      fontStyle: 'italic',
    },
    vehicleCard: {
      width: 85,
      padding: 10,
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      alignItems: 'center',
      marginHorizontal: 4,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    vehicleCardSelected: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}10`,
    },
    vehicleCardAI: {
      position: 'absolute',
      top: -6,
      paddingHorizontal: 6,
      paddingVertical: 2,
      backgroundColor: colors.primary,
      borderRadius: 4,
    },
    vehicleCardAIText: {
      fontSize: 8,
      fontWeight: '700',
      color: isDark ? '#0d0d1a' : '#ffffff',
    },
    vehicleIcon: {
      fontSize: 24,
      marginBottom: 4,
    },
    vehicleName: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
    vehicleEta: {
      fontSize: 9,
      color: colors.textMuted,
      marginTop: 1,
    },
    vehiclePrice: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
      marginTop: 3,
    },
    preferencesRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      gap: 6,
      marginTop: 6,
      marginBottom: 8,
    },
    preferenceChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: `${colors.primary}10`,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: `${colors.primary}30`,
      gap: 4,
    },
    preferenceText: {
      fontSize: 10,
      color: colors.primary,
    },
    footer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      paddingBottom: Platform.OS === 'ios' ? 28 : 16,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
      backgroundColor: colors.card,
    },
    bookButton: {
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    bookButtonDisabled: {
      opacity: 0.6,
    },
    bookButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: isDark ? '#0d0d1a' : '#ffffff',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    pickupMarker: {
      alignItems: 'center',
    },
    pickupPin: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.primary,
      borderWidth: 3,
      borderColor: '#ffffff',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 5,
    },
    destMarker: {
      alignItems: 'center',
    },
    destPin: {
      backgroundColor: colors.secondary,
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: '#ffffff',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 3,
      elevation: 5,
    },
    destPinText: {
      fontSize: 10,
      color: '#ffffff',
      fontWeight: '700',
    },
    destPinArrow: {
      width: 0,
      height: 0,
      borderLeftWidth: 6,
      borderRightWidth: 6,
      borderTopWidth: 8,
      borderLeftColor: 'transparent',
      borderRightColor: 'transparent',
      borderTopColor: colors.secondary,
      marginTop: -2,
    },
    searchOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    searchModal: {
      width: '85%',
      padding: 30,
      borderRadius: 20,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 10,
    },
    searchTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      marginTop: 20,
      marginBottom: 10,
    },
    searchStatus: {
      fontSize: 16,
      textAlign: 'center',
      marginBottom: 20,
    },
    searchAnimation: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 20,
    },
    searchEmoji: {
      fontSize: 30,
    },
    searchDots: {
      fontSize: 24,
      marginHorizontal: 15,
      color: '#888',
    },
    cancelSearchButton: {
      paddingVertical: 12,
      paddingHorizontal: 30,
      borderRadius: 25,
      borderWidth: 1,
      marginTop: 10,
    },
    cancelSearchText: {
      fontSize: 16,
      fontWeight: '600',
    },
    errorEmoji: {
      fontSize: 50,
    },
    retryButton: {
      paddingVertical: 14,
      paddingHorizontal: 40,
      borderRadius: 25,
      marginTop: 10,
    },
    retryButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '700',
    },
  });

  return (
    <View style={styles.container}>
      {/* Map Section */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          customMapStyle={isDark ? darkMapStyle : []}
          initialRegion={{
            latitude: (pickup.latitude + destination.latitude) / 2,
            longitude: (pickup.longitude + destination.longitude) / 2,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          <Marker coordinate={pickup}>
            <View style={styles.pickupMarker}>
              <View style={styles.pickupPin} />
            </View>
          </Marker>

          <Marker coordinate={destination}>
            <View style={styles.destMarker}>
              <View style={styles.destPin}>
                <Text style={styles.destPinText}>📍</Text>
              </View>
              <View style={styles.destPinArrow} />
            </View>
          </Marker>

          {routeCoordinates.length > 0 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor={colors.primary}
              strokeWidth={4}
            />
          )}
        </MapView>

        {/* Header with Back Button and Route Card */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={styles.routeDots}>
              <View style={[styles.dot, styles.dotPickup]} />
              <View style={styles.routeLine} />
              <View style={[styles.dot, styles.dotDest]} />
            </View>
            <View style={styles.routeTexts}>
              <Text style={styles.routeText} numberOfLines={1}>{pickup.address}</Text>
              <Text style={styles.routeText} numberOfLines={1}>{destination.address}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        <View style={styles.handle} />

        {/* Now / Schedule Toggle */}
        <View style={styles.timingContainer}>
          <TouchableOpacity
            style={[styles.timingButton, rideMode === 'now' && styles.timingButtonActive]}
            onPress={() => {
              setRideMode('now');
              setScheduledTime(null);
            }}
          >
            <Text style={styles.timingIcon}>🚗</Text>
            <Text style={[styles.timingButtonText, rideMode === 'now' && styles.timingButtonTextActive]}>Now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.timingButton, rideMode === 'schedule' && styles.timingButtonActive]}
            onPress={handleSchedulePress}
          >
            <Text style={styles.timingIcon}>📅</Text>
            <Text style={[styles.timingButtonText, rideMode === 'schedule' && styles.timingButtonTextActive]}>
              {scheduledTime ? formatScheduledTime(scheduledTime) : 'Schedule'}
            </Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
            {aiRecommendation && (
              <View style={styles.aiInsight}>
                <Text style={styles.aiIcon}>🧠</Text>
                <Text style={styles.aiText}>{aiRecommendation.reason}</Text>
                <Text style={styles.aiAction}>{aiRecommendation.suggestion}</Text>
              </View>
            )}

            {selectedEstimate && selectedEstimate.surgeMultiplier > 1 && (
              <View style={styles.surgeInfo}>
                <View style={styles.surgeBadge}>
                  <Text>⚡</Text>
                  <Text style={styles.surgeText}>{selectedEstimate.surgeMultiplier}x surge</Text>
                </View>
              </View>
            )}

            <Text style={styles.sectionTitle}>Choose ride</Text>
            <View style={styles.vehicleScrollContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.vehicleScroll}
                contentContainerStyle={styles.vehicleScrollContent}
              >
                {vehicleOptions.map((vehicle, index) => (
                  <TouchableOpacity
                    key={vehicle.id}
                    style={[
                      styles.vehicleCard,
                      selectedVehicle === vehicle.id && styles.vehicleCardSelected,
                    ]}
                    onPress={() => setSelectedVehicle(vehicle.id)}
                  >
                    {index === 0 && (
                      <View style={styles.vehicleCardAI}>
                        <Text style={styles.vehicleCardAIText}>⚡ BEST</Text>
                      </View>
                    )}
                    <Text style={styles.vehicleIcon}>{vehicle.icon}</Text>
                    <Text style={styles.vehicleName}>{vehicle.name}</Text>
                    <Text style={styles.vehicleEta}>{vehicle.estimate?.eta || 3} min</Text>
                    <Text style={styles.vehiclePrice}>
                      ${vehicle.estimate?.totalFare?.toFixed(2) || (12 * vehicle.baseMultiplier).toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.scrollIndicator}>
                <Text style={styles.scrollIndicatorText}>Swipe for more →</Text>
              </View>
            </View>

            <View style={styles.preferencesRow}>
              <View style={styles.preferenceChip}>
                <Text>🌡️</Text>
                <Text style={styles.preferenceText}>AC On</Text>
              </View>
              <View style={styles.preferenceChip}>
                <Text>🔇</Text>
                <Text style={styles.preferenceText}>Quiet Ride</Text>
              </View>
              <View style={styles.preferenceChip}>
                <Text>🚪</Text>
                <Text style={styles.preferenceText}>Curbside</Text>
              </View>
            </View>
          </ScrollView>
        )}

        {/* Footer with Book Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.bookButton, booking && styles.bookButtonDisabled]}
            onPress={handleBookRide}
            disabled={booking || loading}
          >
            {booking ? (
              <ActivityIndicator color={isDark ? '#0d0d1a' : '#ffffff'} />
            ) : (
              <>
                <Text style={styles.bookButtonText}>🚗</Text>
                <Text style={styles.bookButtonText}>
                  {rideMode === 'schedule' ? 'Schedule' : 'Confirm'} {VehicleInfo[selectedVehicle as keyof typeof VehicleInfo]?.name} • $
                  {selectedEstimate?.totalFare?.toFixed(2) || (12 * VehicleInfo[selectedVehicle as keyof typeof VehicleInfo]?.baseMultiplier).toFixed(2)}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

     {/* Schedule Picker Modal */}
      <SchedulePicker
        visible={showSchedulePicker}
        onClose={() => setShowSchedulePicker(false)}
        onConfirm={handleScheduleConfirm}
      />

      {/* Searching for Driver Overlay */}
      {searchingForDriver && (
        <View style={styles.searchOverlay}>
          <View style={[styles.searchModal, { backgroundColor: colors.card }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.searchTitle, { color: colors.text }]}>
              Finding Your Driver
            </Text>
            <Text style={[styles.searchStatus, { color: colors.textSecondary }]}>
              {searchStatus}
            </Text>
            <View style={styles.searchAnimation}>
              <Text style={styles.searchEmoji}>🚗</Text>
              <Text style={styles.searchDots}>• • •</Text>
              <Text style={styles.searchEmoji}>📍</Text>
            </View>
            <TouchableOpacity
              style={[styles.cancelSearchButton, { borderColor: colors.cardBorder }]}
              onPress={cancelSearch}
            >
              <Text style={[styles.cancelSearchText, { color: colors.error }]}>
                Cancel Request
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Error Modal */}
      {searchError && !searchingForDriver && (
        <View style={styles.searchOverlay}>
          <View style={[styles.searchModal, { backgroundColor: colors.card }]}>
            <Text style={styles.errorEmoji}>😔</Text>
            <Text style={[styles.searchTitle, { color: colors.text }]}>
              Couldn't Find a Driver
            </Text>
            <Text style={[styles.searchStatus, { color: colors.textSecondary }]}>
              {searchError}
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                setSearchError(null);
                handleBookRide();
              }}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelSearchButton, { borderColor: colors.cardBorder }]}
              onPress={() => setSearchError(null)}
            >
              <Text style={[styles.cancelSearchText, { color: colors.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

export default RideConfirmScreen;