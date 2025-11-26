/**
 * ActiveRideScreen - Trip Lifecycle Management
 * Phase 2.6 Implementation
 * 
 * Features:
 * - AUTO-ARRIVAL: 100m geofence triggers arrival automatically
 * - Wait time tracking with 2-min grace period
 * - $0.35/min charges after grace period
 * - Navigate to Google Maps / Call rider
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
  StatusBar,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
  Vibration,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MainStackParamList } from '../navigation/RootNavigator';
import socketService from '../services/socket.service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ActiveRide,
  TripStatus,
  getTripStatusDisplay,
  getPrimaryActionText,
  isTripActive,
  formatDistance,
  formatDuration,
} from '../types/ride.types';

// ============================================
// TYPES
// ============================================

type ActiveRideScreenNavigationProp = StackNavigationProp<MainStackParamList, 'ActiveRide'>;
type ActiveRideScreenRouteProp = RouteProp<MainStackParamList, 'ActiveRide'>;

interface DriverLocation {
  latitude: number;
  longitude: number;
  heading?: number;
}

// ============================================
// CONSTANTS
// ============================================

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.02;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

const LOCATION_UPDATE_INTERVAL = 3000; // 3 seconds during active ride
const ARRIVAL_RADIUS_METERS = 100; // 100m radius for auto-arrival
const GRACE_PERIOD_SECONDS = 120; // 2 minutes free
const WAIT_RATE_PER_MINUTE = 0.35; // $0.35 per minute after grace

const STATUS_COLORS: Record<TripStatus, string> = {
  'en_route_to_pickup': '#3B82F6',
  'at_pickup': '#F59E0B',
  'in_trip': '#10B981',
  'completed': '#6B7280',
  'cancelled': '#EF4444',
};

// ============================================
// HAVERSINE DISTANCE CALCULATION
// ============================================

const calculateHaversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// ============================================
// COMPONENT
// ============================================

const ActiveRideScreen: React.FC = () => {
  const navigation = useNavigation<ActiveRideScreenNavigationProp>();
  const route = useRoute<ActiveRideScreenRouteProp>();
  const { ride: initialRide } = route.params;

  // State
  const [ride, setRide] = useState<ActiveRide>(initialRide);
  const [tripStatus, setTripStatus] = useState<TripStatus>(initialRide.status);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string>('');
  
  // Wait time state
  const [waitTimeSeconds, setWaitTimeSeconds] = useState<number>(0);
  const [arrivedAt, setArrivedAt] = useState<Date | null>(null);
  const [hasAutoArrived, setHasAutoArrived] = useState(false);

  // Refs
  const mapRef = useRef<MapView>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const waitTimeInterval = useRef<NodeJS.Timeout | null>(null);

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const chargeableSeconds = Math.max(0, waitTimeSeconds - GRACE_PERIOD_SECONDS);
  const chargeableMinutes = chargeableSeconds / 60;
  const waitCharges = chargeableMinutes * WAIT_RATE_PER_MINUTE;
  const isCharging = waitTimeSeconds > GRACE_PERIOD_SECONDS;

  const formatWaitTime = (): string => {
    if (tripStatus !== 'at_pickup') return '';
    
    if (waitTimeSeconds <= GRACE_PERIOD_SECONDS) {
      const remaining = GRACE_PERIOD_SECONDS - waitTimeSeconds;
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    } else {
      const overtime = waitTimeSeconds - GRACE_PERIOD_SECONDS;
      const mins = Math.floor(overtime / 60);
      const secs = overtime % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
  };

  // ============================================
  // LIFECYCLE
  // ============================================

  useEffect(() => {
    initializeScreen();
    
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
      if (waitTimeInterval.current) {
        clearInterval(waitTimeInterval.current);
      }
    };
  }, []);

  useEffect(() => {
    setupSocketListeners();
  }, []);

  useEffect(() => {
    if (tripStatus === 'at_pickup' && !waitTimeInterval.current) {
      waitTimeInterval.current = setInterval(() => {
        setWaitTimeSeconds(prev => prev + 1);
      }, 1000);
    } else if (tripStatus !== 'at_pickup' && waitTimeInterval.current) {
      clearInterval(waitTimeInterval.current);
      waitTimeInterval.current = null;
    }

    return () => {
      if (waitTimeInterval.current) {
        clearInterval(waitTimeInterval.current);
      }
    };
  }, [tripStatus]);

  // ============================================
  // INITIALIZATION
  // ============================================

  const initializeScreen = async () => {
    console.log('🚗 ActiveRideScreen initialized');
    console.log('📍 Ride:', ride.rideId);
    
    const userJson = await AsyncStorage.getItem('user');
    if (userJson) {
      const user = JSON.parse(userJson);
      setUserId(user.id);
    }

    startLocationTracking();
    setTimeout(() => fitMapToMarkers(), 500);
  };

  const startLocationTracking = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for navigation.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const initialLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        heading: location.coords.heading || 0,
      };
      setDriverLocation(initialLocation);
      checkArrivalGeofence(initialLocation);

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: LOCATION_UPDATE_INTERVAL,
          distanceInterval: 10,
        },
        (location) => {
          const newLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            heading: location.coords.heading || 0,
          };
          setDriverLocation(newLocation);
          checkArrivalGeofence(newLocation);
          
          if (userId && isTripActive(tripStatus)) {
            socketService.sendLocationUpdate({
              driverId: userId,
              latitude: newLocation.latitude,
              longitude: newLocation.longitude,
              heading: newLocation.heading,
              speed: location.coords.speed || 0,
            });
          }
        }
      );

      console.log('📍 Location tracking started (3-second intervals)');
    } catch (error) {
      console.error('❌ Location tracking error:', error);
    }
  };

  // ============================================
  // GEOFENCE / AUTO-ARRIVAL
  // ============================================

  const checkArrivalGeofence = (location: DriverLocation) => {
    if (tripStatus !== 'en_route_to_pickup' || hasAutoArrived) {
      return;
    }

    const distanceToPickup = calculateHaversineDistance(
      location.latitude,
      location.longitude,
      ride.pickup.lat,
      ride.pickup.lng
    );

    console.log(`📍 Distance to pickup: ${distanceToPickup.toFixed(0)}m`);

    if (distanceToPickup <= ARRIVAL_RADIUS_METERS) {
      console.log('🎯 Entered arrival geofence! Auto-triggering arrival...');
      triggerAutoArrival();
    }
  };

  const triggerAutoArrival = () => {
    if (hasAutoArrived) return;
    
    setHasAutoArrived(true);
    const timestamp = new Date();
    setArrivedAt(timestamp);

    Vibration.vibrate([0, 300, 100, 300]);

    setTripStatus('at_pickup');
    setRide(prev => ({ ...prev, status: 'at_pickup', arrivedAt: timestamp.toISOString() }));

    socketService.updateTripStatus(ride.rideId, 'pickup');

    console.log('✅ Auto-arrival triggered, rider notified');
    
    Alert.alert(
      'Arrived at Pickup',
      'Rider has been notified. Wait time tracking started.\n\nGrace period: 2 minutes',
      [{ text: 'OK' }],
      { cancelable: true }
    );
  };

  const setupSocketListeners = () => {
  // TODO: Add ride cancellation listener when backend supports it
  console.log('Socket listeners setup');
};
        
     // ============================================
  // MAP HELPERS
  // ============================================

  const fitMapToMarkers = () => {
    if (mapRef.current) {
      const coordinates = [
        { latitude: ride.pickup.lat, longitude: ride.pickup.lng },
        { latitude: ride.destination.lat, longitude: ride.destination.lng },
      ];
      
      if (driverLocation) {
        coordinates.unshift({
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
        });
      }

      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 100, right: 50, bottom: 350, left: 50 },
        animated: true,
      });
    }
  };

  const getCurrentTarget = () => {
    if (tripStatus === 'en_route_to_pickup' || tripStatus === 'at_pickup') {
      return ride.pickup;
    }
    return ride.destination;
  };

  const getCurrentDistance = () => {
    if (tripStatus === 'en_route_to_pickup' || tripStatus === 'at_pickup') {
      return ride.distance.toPickup;
    }
    return ride.distance.toDestination;
  };

  // ============================================
  // ACTIONS
  // ============================================

  const handleNavigate = () => {
    const target = getCurrentTarget();
    const { lat, lng } = target;
    
    const googleMapsUrl = Platform.select({
      ios: `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`,
      android: `google.navigation:q=${lat},${lng}&mode=d`,
    });

    const appleMapsUrl = `maps://?daddr=${lat},${lng}&dirflg=d`;
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

    Linking.canOpenURL(googleMapsUrl!).then((supported) => {
      if (supported) {
        Linking.openURL(googleMapsUrl!);
      } else if (Platform.OS === 'ios') {
        Linking.openURL(appleMapsUrl);
      } else {
        Linking.openURL(webUrl);
      }
    }).catch(() => {
      Linking.openURL(webUrl);
    });

    console.log('🗺️ Opening navigation to:', target.address);
  };

  const handleCallRider = () => {
    const phone = ride.rider.phone;
    if (!phone) {
      Alert.alert('No Phone Number', 'Rider phone number is not available.');
      return;
    }

    const phoneUrl = `tel:${phone.replace(/\D/g, '')}`;
    Linking.canOpenURL(phoneUrl).then((supported) => {
      if (supported) {
        Linking.openURL(phoneUrl);
      } else {
        Alert.alert('Cannot Make Call', 'Phone calls are not supported on this device.');
      }
    });

    console.log('📞 Calling rider:', phone);
  };

  const handlePrimaryAction = async () => {
    setIsLoading(true);

    try {
      const timestamp = new Date().toISOString();

      switch (tripStatus) {
        case 'en_route_to_pickup':
          console.log('📍 Manual arrival at pickup');
          setArrivedAt(new Date());
          socketService.updateTripStatus(ride.rideId, 'pickup');
          setTripStatus('at_pickup');
          setRide({ ...ride, status: 'at_pickup', arrivedAt: timestamp });
          break;

        case 'at_pickup':
          console.log('🚗 Starting trip');
          console.log(`⏱️ Total wait time: ${waitTimeSeconds}s, Charges: $${waitCharges.toFixed(2)}`);
          
          if (waitTimeInterval.current) {
            clearInterval(waitTimeInterval.current);
            waitTimeInterval.current = null;
          }
          
          socketService.updateTripStatus(ride.rideId, 'enroute');
          setTripStatus('in_trip');
          setRide({ ...ride, status: 'in_trip', startedAt: timestamp });
          setTimeout(() => fitMapToMarkers(), 300);
          break;

        case 'in_trip':
          console.log('✅ Completing trip');
          socketService.updateTripStatus(ride.rideId, 'completed');
          setTripStatus('completed');
          setRide({ ...ride, status: 'completed', completedAt: timestamp });
          showCompletionSummary();
          break;

        case 'completed':
          navigation.goBack();
          break;

        default:
          break;
      }
    } catch (error) {
      console.error('❌ Action error:', error);
      Alert.alert('Error', 'Failed to update trip status. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelTrip = () => {
    Alert.alert(
      'Cancel Trip',
      'Are you sure you want to cancel this trip? This may affect your rating.',
      [
        { text: 'No, Keep Trip', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => {
            console.log('❌ Driver cancelling trip');
            
            if (waitTimeInterval.current) {
              clearInterval(waitTimeInterval.current);
            }
            
            console.log('Trip cancelled by driver');
            navigation.goBack();
          },
        },
      ]
    );
  };

  const showCompletionSummary = () => {
    const baseFare = ride.fare.final || ride.fare.estimated;
    const totalFare = baseFare + waitCharges;
    
    let summary = `Base Fare: $${baseFare.toFixed(2)}`;
    if (waitCharges > 0) {
      summary += `\nWait Time Charge: $${waitCharges.toFixed(2)}`;
      summary += `\n─────────────`;
      summary += `\nTotal Fare: $${totalFare.toFixed(2)}`;
    }
    summary += `\n\nDistance: ${formatDistance(ride.distance.toDestination.miles)}`;
    summary += `\nDuration: ${formatDuration(ride.distance.toDestination.minutes)}`;
    
    Alert.alert(
      '🎉 Trip Completed!',
      summary,
      [{ text: 'Done', onPress: () => navigation.goBack() }]
    );
  };

  // ============================================
  // RENDER HELPERS
  // ============================================

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: STATUS_COLORS[tripStatus] }]}>
      <SafeAreaView style={styles.headerContent}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => {
            if (isTripActive(tripStatus)) {
              Alert.alert(
                'Leave Screen?',
                'You have an active trip. The trip will continue in the background.',
                [
                  { text: 'Stay', style: 'cancel' },
                  { text: 'Leave', onPress: () => navigation.goBack() },
                ]
              );
            } else {
              navigation.goBack();
            }
          }}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{getTripStatusDisplay(tripStatus)}</Text>
          {tripStatus === 'at_pickup' && (
            <Text style={styles.headerSubtitle}>
              {isCharging ? 'Wait time charging' : 'Grace period'}
            </Text>
          )}
        </View>
        <View style={styles.headerSpacer} />
      </SafeAreaView>
    </View>
  );

  const renderWaitTimeDisplay = () => {
    if (tripStatus !== 'at_pickup') return null;

    return (
      <View style={styles.waitTimeContainer}>
        <Text style={styles.waitTimeLabel}>
          {isCharging ? '⏱️ WAIT TIME' : '⏱️ GRACE PERIOD'}
        </Text>
        <View style={styles.waitTimeRow}>
          <Text style={[
            styles.waitTimeValue,
            isCharging ? styles.waitTimeCharging : styles.waitTimeGrace
          ]}>
            {formatWaitTime()}
          </Text>
          {isCharging && (
            <Text style={styles.waitTimeCharges}>
              (+${waitCharges.toFixed(2)})
            </Text>
          )}
        </View>
        {!isCharging && (
          <Text style={styles.waitTimeHint}>
            Free wait time remaining
          </Text>
        )}
      </View>
    );
  };

  const renderMap = () => (
    <View style={styles.mapContainer}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: ride.pickup.lat,
          longitude: ride.pickup.lng,
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {tripStatus === 'en_route_to_pickup' && (
          <Circle
            center={{
              latitude: ride.pickup.lat,
              longitude: ride.pickup.lng,
            }}
            radius={ARRIVAL_RADIUS_METERS}
            fillColor="rgba(16, 185, 129, 0.1)"
            strokeColor="rgba(16, 185, 129, 0.5)"
            strokeWidth={2}
          />
        )}

        {driverLocation && (
          <Marker
            coordinate={{
              latitude: driverLocation.latitude,
              longitude: driverLocation.longitude,
            }}
            title="You"
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={driverLocation.heading || 0}
          >
            <View style={styles.driverMarker}>
              <Text style={styles.driverMarkerText}>🚗</Text>
            </View>
          </Marker>
        )}

        <Marker
          coordinate={{
            latitude: ride.pickup.lat,
            longitude: ride.pickup.lng,
          }}
          title="Pickup"
          description={ride.pickup.address}
        >
          <View style={styles.pickupMarker}>
            <Text style={styles.markerText}>P</Text>
          </View>
        </Marker>

        <Marker
          coordinate={{
            latitude: ride.destination.lat,
            longitude: ride.destination.lng,
          }}
          title="Destination"
          description={ride.destination.address}
        >
          <View style={styles.destinationMarker}>
            <Text style={styles.markerText}>D</Text>
          </View>
        </Marker>

        <Polyline
          coordinates={[
            { latitude: ride.pickup.lat, longitude: ride.pickup.lng },
            { latitude: ride.destination.lat, longitude: ride.destination.lng },
          ]}
          strokeColor="#10B981"
          strokeWidth={3}
          lineDashPattern={[5, 5]}
        />
      </MapView>
    </View>
  );

  const renderRiderCard = () => (
    <View style={styles.riderCard}>
      <View style={styles.riderAvatar}>
        <Text style={styles.riderInitial}>
          {ride.rider.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.riderInfo}>
        <Text style={styles.riderName}>{ride.rider.name}</Text>
        <Text style={styles.riderRating}>⭐ {ride.rider.rating.toFixed(1)}</Text>
      </View>
      {ride.rider.phone && (
        <TouchableOpacity style={styles.phoneButton} onPress={handleCallRider}>
          <Text style={styles.phoneIcon}>📞</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderLocationInfo = () => {
    const target = getCurrentTarget();
    const distance = getCurrentDistance();
    const isPickup = tripStatus === 'en_route_to_pickup' || tripStatus === 'at_pickup';

    return (
      <View style={styles.locationCard}>
        <View style={styles.locationHeader}>
          <View style={[styles.locationDot, isPickup ? styles.pickupDot : styles.destinationDot]} />
          <Text style={styles.locationLabel}>
            {isPickup ? 'PICKUP' : 'DESTINATION'}
          </Text>
        </View>
        <Text style={styles.locationAddress} numberOfLines={2}>
          {target.address}
        </Text>
        {tripStatus === 'en_route_to_pickup' && (
          <Text style={styles.locationDistance}>
            {formatDistance(distance.miles)} • {formatDuration(distance.minutes)}
          </Text>
        )}
      </View>
    );
  };

  const renderActionButtons = () => (
    <View style={styles.actionButtons}>
      <TouchableOpacity style={styles.navigateButton} onPress={handleNavigate}>
        <Text style={styles.navigateIcon}>🗺️</Text>
        <Text style={styles.navigateText}>Navigate</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.callButton} onPress={handleCallRider}>
        <Text style={styles.callIcon}>📞</Text>
        <Text style={styles.callText}>Call Rider</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPrimaryAction = () => {
    let buttonText = getPrimaryActionText(tripStatus);
    
    if (tripStatus === 'en_route_to_pickup') {
      buttonText = "I've Arrived";
    }

    return (
      <View style={styles.primaryActionContainer}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            { backgroundColor: STATUS_COLORS[tripStatus] },
            isLoading && styles.primaryButtonDisabled,
          ]}
          onPress={handlePrimaryAction}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>{buttonText}</Text>
          )}
        </TouchableOpacity>

        {isTripActive(tripStatus) && tripStatus !== 'in_trip' && (
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancelTrip}>
            <Text style={styles.cancelButtonText}>Cancel Trip</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {renderHeader()}
      {renderMap()}
      
      <View style={styles.bottomSheet}>
        {renderWaitTimeDisplay()}
        {renderRiderCard()}
        {renderLocationInfo()}
        {renderActionButtons()}
        {renderPrimaryAction()}
      </View>
    </View>
  );
};

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  
  header: {
    paddingTop: Platform.OS === 'ios' ? 0 : StatusBar.currentHeight,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  headerSpacer: {
    width: 40,
  },
  
  waitTimeContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  waitTimeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  waitTimeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  waitTimeValue: {
    fontSize: 36,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  waitTimeGrace: {
    color: '#111827',
  },
  waitTimeCharging: {
    color: '#10B981',
  },
  waitTimeCharges: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10B981',
  },
  waitTimeHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  driverMarker: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverMarkerText: {
    fontSize: 28,
  },
  pickupMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  destinationMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  markerText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  
  riderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 16,
  },
  riderAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  riderInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  riderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  riderName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  riderRating: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  phoneButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  phoneIcon: {
    fontSize: 20,
  },
  
  locationCard: {
    marginBottom: 16,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  pickupDot: {
    backgroundColor: '#10B981',
  },
  destinationDot: {
    backgroundColor: '#EF4444',
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.5,
  },
  locationAddress: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
    marginLeft: 18,
  },
  locationDistance: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
    marginLeft: 18,
  },
  
  actionButtons: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  navigateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  navigateIcon: {
    fontSize: 18,
  },
  navigateText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3B82F6',
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  callIcon: {
    fontSize: 18,
  },
  callText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#10B981',
  },
  
  primaryActionContainer: {
    gap: 12,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500',
  },
});

export default ActiveRideScreen;