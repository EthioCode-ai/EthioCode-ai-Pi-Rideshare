import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import driverService from '../services/driver.service';
import socketService from '../services/socket.service';
import RideRequestModal, { RideRequestData } from '../components/RideRequestModal';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack';
import { MainStackParamList } from '../navigation/RootNavigator';
import { ActiveRide, TripStatus } from '../types/ride.types';
import { API_BASE_URL } from '../config/api.config';
import SurgeOverlay from '../components/SurgeOverlay';
import { StorageKeys } from '../constants/StorageKeys';

// Performance data interface
interface PerformanceData {
  todayEarnings: number;
  trips: number;
  onlineHours: number;
  miles: number;
  lastRide: number;
}

// Ride state types
type RideState = 'waiting' | 'pickingUp' | 'droppingOff';
// ← INSERT HERE (line 28-32)
/**
 * Map Styles: Dynamic based on driver state
 */
const IDLE_MAP_STYLE = [
  { "elementType": "geometry", "stylers": [{ "color": "#ebebeb" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#c9d6df" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#d4d4d4" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#6b6b6b" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] }
];

const ACTIVE_MAP_STYLE = undefined;
// ROTATION OFFSET: Adjust this if car appears sideways
// 0 = no offset (car front points up in image = 0°/North)
// -90 = rotate 90° counterclockwise
// 90 = rotate 90° clockwise
const CAR_ROTATION_OFFSET = 90;

const HomeScreen: React.FC = () => {
  const [location, setLocation] = useState<any>(null);
  const locationRef = useRef<any>(null);
  const headingRef = useRef<number>(0);
  const [isOnline, setIsOnline] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [rideRequest, setRideRequest] = useState<RideRequestData | null>(null);
  const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [heading, setHeading] = useState<number>(0);
  const [performanceExpanded, setPerformanceExpanded] = useState(false);
  const [headerExpanded, setHeaderExpanded] = useState(false);
  const [rideState, setRideState] = useState<RideState>('waiting');
  const [riderName, setRiderName] = useState<string | null>(null);
  const [surgeZones, setSurgeZones] = useState<any[]>([]);
  const [bannerTextIndex, setBannerTextIndex] = useState(0);
  const navigation = useNavigation<StackNavigationProp<MainStackParamList>>();
  const route = useRoute<RouteProp<MainStackParamList, 'Home'>>();
  const [completedTripModal, setCompletedTripModal] = useState<{
  visible: boolean;
  fare: number;
  riderName: string;
  distance: number;
} | null>(null);
    const [performanceData, setPerformanceData] = useState<PerformanceData>({
  todayEarnings: 0,
    trips: 0,
    onlineHours: 0,
    miles: 0,
    lastRide: 0,
  });
  const mapRef = useRef<MapView>(null);
  const headerHeight = useRef(new Animated.Value(-70)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;

  // Alternating texts for waiting state
  const waitingTexts = ["Looking for riders...", "You're online..."];

  useEffect(() => {
    console.log('HomeScreen mounted! Initializing location...');
    
    initializeLocation();
    fetchPerformanceData();
    fetchSurgeZones();  // ADD THIS LINE
  }, []);

  // Handle completed trip from ActiveRideScreen
useEffect(() => {
   if (route.params?.completedTrip) {
    const trip = route.params.completedTrip;
    
    // Keep driver online
    if (route.params?.stayOnline) {
      setIsOnline(true);
    }
    
    // Show modal
    setCompletedTripModal({
      visible: true,
      fare: trip.fare,
      riderName: trip.riderName,
      distance: trip.distance,
    });
    
    // Update performance data
    setPerformanceData(prev => ({
      ...prev,
      todayEarnings: prev.todayEarnings + trip.fare,
      trips: prev.trips + 1,
      miles: prev.miles + trip.distance,
      lastRide: trip.fare,
    }));
    
    // Auto-dismiss modal after 3 seconds
    setTimeout(() => {
      setCompletedTripModal(null);
    }, 3000);
  }
}, [route.params?.completedTrip]);

  useEffect(() => {
    // Animate header expansion/collapse
    Animated.timing(headerHeight, {
      toValue: headerExpanded ? 0 : -70,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [headerExpanded]);

  
    // Load user data from storage
  useEffect(() => {
  const loadUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('@pi_rideshare:user_data');
      if (userData) {
        setUser(JSON.parse(userData));
        console.log('👤 User loaded:', JSON.parse(userData));
      }
    } catch (error) {
      console.error('❌ Failed to load user:', error);
    }
  };
  loadUser();
}, []); 
  useEffect(() => {
    // Alternating text animation when online and waiting
    if (isOnline && rideState === 'waiting') {
      const interval = setInterval(() => {
        // Fade out
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => {
          // Change text
          setBannerTextIndex((prev) => (prev + 1) % waitingTexts.length);
          // Fade in
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }).start();
        });
      }, 3000); // Switch every 3 seconds

      return () => clearInterval(interval);
    } else {
      // Reset opacity when not in waiting state
      textOpacity.setValue(1);
    }
  }, [isOnline, rideState]);

// Socket ride request listener
useEffect(() => {
  if (socketConnected && user?.id) {
    console.log('🎧 Setting up ride request listener...');
    
    socketService.onNewRideRequest((request) => {
      console.log('🚗 Ride request received!', request);
      // Show the modal instead of Alert
      setRideRequest({
        rideId: request.rideId,
        riderId: request.riderId,
        riderName: request.riderName || 'Rider',
        riderRating: 4.8,
        pickup: {
          address: request.pickup?.address || 'Pickup location',
          lat: request.pickup?.latitude,
          lng: request.pickup?.longitude,
        },
        destination: {
          address: request.destination?.address || 'Destination',
          lat: request.destination?.latitude,
          lng: request.destination?.longitude,
        },
        estimatedFare: request.estimatedFare || 0,
        estimatedDistance: request.estimatedDistance,
        estimatedDuration: request.estimatedDuration,
      });
    });
  }
  


  // Cleanup on unmount
  return () => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  };
}, [socketConnected, user?.id]);

// Fetch surge zones for heatmap overlay
const fetchSurgeZones = async () => {
  try {
    const token = await AsyncStorage.getItem(StorageKeys.AUTH_TOKEN);
    const response = await fetch(`${API_BASE_URL}/api/admin/surge/active-zones`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        setSurgeZones(data.zones || []);
        console.log(`🔥 Loaded ${data.zones?.length || 0} surge zones`);
      }
    }
  } catch (error) {
    console.error('Error fetching surge zones:', error);
  }
};
// Listen to Socket.IO surge updates for real-time sync
useEffect(() => {
  if (socketConnected) {
    socketService.onSurgeUpdate(() => {
      console.log('🔥 Surge update received, refreshing...');
      fetchSurgeZones();
    });
  }
  return () => {
    socketService.offSurgeUpdate();
  };
}, [socketConnected]);

  // Fetch performance data from backend
  const fetchPerformanceData = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/driver/performance/today', {
        headers: {
          'Authorization': 'Bearer YOUR_TOKEN_HERE',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setPerformanceData({
          todayEarnings: data.todayEarnings || 0,
          trips: data.trips || 0,
          onlineHours: data.onlineHours || 0,
          miles: data.miles || 0,
          lastRide: data.lastRide || 0,
        });
      }
    } catch (error) {
      console.log('Could not fetch performance data:', error);
    }
  };

  const initializeLocation = async () => {
    try {
      console.log('Requesting location permissions...');
     
      const { status } = await Location.requestForegroundPermissionsAsync();
     
      console.log('Permission status:', status);
     
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location permission is needed');
        setLoading(false);
        return;
      }

      console.log('Getting current location...');
     
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      console.log('Location received:', currentLocation.coords);

      const loc = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        heading: currentLocation.coords.heading || 0,
      };

      setLocation(loc);
     
      if (currentLocation.coords.heading) {
        setHeading(currentLocation.coords.heading);
      }

      console.log('Starting location watch...');

      Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 10,
        },
        (newLocation) => {
          const newLoc = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
            heading: newLocation.coords.heading || 0,
          };
         
          setLocation(newLoc);
          locationRef.current = newLoc;
         
          // Update heading regardless of online status (for navigation)
          if (newLocation.coords.heading !== null) {
            setHeading(newLocation.coords.heading);
            console.log('Heading updated:', newLocation.coords.heading);
          }
           
          // Rotate map camera when online and moving
          if (isOnline && newLocation.coords.heading !== null && mapRef.current) {
            mapRef.current.animateCamera({
              center: {
                latitude: newLoc.latitude,
                longitude: newLoc.longitude,
              },
              heading: newLocation.coords.heading,
              pitch: 60,
              zoom: 19,
            }, { duration: 500 });
          }
        }
      );

      setLoading(false);
      console.log('Location initialized successfully!');
     
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Error', 'Failed to get location: ' + (error instanceof Error ? error.message : String(error)));
      setLoading(false);
    }
  };

const toggleOnlineStatus = async () => {
  if (!isOnline) {
    // GOING ONLINE
    try {
      // 1. Connect socket if not connected
      if (!socketService.connected) {
        console.log('🔌 Connecting socket...');
        await socketService.connect(user?.id || '');
        setSocketConnected(true);
      }
      
      // 2. Emit driver-connect
      socketService.driverConnect({
        driverId: user?.id || '',
        location: {
          lat: location.latitude,
          lng: location.longitude,
        },
      });
      
      // 3. Start location broadcast interval (every 5 seconds)
      locationIntervalRef.current = setInterval(() => {
      console.log('📡 Interval tick - locationRef:', locationRef.current?.latitude, locationRef.current?.longitude);
      if (locationRef.current) {
       socketService.sendLocationUpdate({
      driverId: user?.id || '',
      latitude: locationRef.current.latitude,
      longitude: locationRef.current.longitude,
      heading: headingRef.current,
      speed: 0,
      });
      }
      }, 5000);
      
      // 4. Update UI
      setIsOnline(true);
      setHeaderExpanded(false);
      setRideState('waiting');
      
       // 5. Fetch surge zones
      fetchSurgeZones();

      // 6. Animate camera
      if (mapRef.current && location) {
        mapRef.current.animateCamera({
          center: {
            latitude: location.latitude,
            longitude: location.longitude,
          },
          heading: heading,
          pitch: 60,
          zoom: 19,
        }, { duration: 1000 });
      }
      
      Alert.alert('Online', 'You are now online and ready to accept rides!');
      
    } catch (error) {
      console.error('❌ Failed to go online:', error);
      Alert.alert('Error', 'Failed to go online. Please try again.');
    }
    
  } else {
    // GOING OFFLINE
    
    // 1. Stop location broadcasts
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
    
    // 2. Emit offline status
    if (socketService.connected) {
      socketService.driverDisconnect(user?.id || '');
    }
    
    // 3. Update UI
    setIsOnline(false);
    setRideState('waiting');
    setRiderName(null);
    
    // 4. Reset camera
    if (mapRef.current && location) {
      mapRef.current.animateCamera({
        center: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        heading: 0,
        pitch: 0,
        zoom: 15,
      }, { duration: 1000 });
    }
    
    Alert.alert('Offline', 'You are now offline');
  }
};

  // Handle ride request accept
  const handleAcceptRide = (rideId: string, routeData: any) => {
    console.log('✅ Accepting ride:', rideId);
    
    if (!rideRequest) {
      console.error('No ride request data available');
      return;
    }
    
      
    // Transform RideRequestData → ActiveRide
    const activeRide: ActiveRide = {
      rideId: rideRequest.rideId,
      status: 'en_route_to_pickup' as TripStatus,
      rider: {
        id: rideRequest.riderId,
        name: rideRequest.riderName || 'Rider',
        rating: rideRequest.riderRating || 4.5,
        phone: undefined,
        photoUrl: undefined,
      },
      pickup: {
        address: rideRequest.pickup.address,
        lat: rideRequest.pickup.lat || 0,
        lng: rideRequest.pickup.lng || 0,
      },
      destination: {
        address: rideRequest.destination.address,
        lat: rideRequest.destination.lat || 0,
        lng: rideRequest.destination.lng || 0,
      },
      fare: {
      estimated: rideRequest.estimatedFare,
      currency: 'USD',
      surgeMultiplier: rideRequest.surgeMultiplier,
    },
    distance: {
      toPickup: {
        miles: 0,
        minutes: 0,
      },
      toDestination: {
        miles: rideRequest.estimatedDistance || 0,
        minutes: rideRequest.estimatedDuration || 0,
      },
    },
    acceptedAt: new Date().toISOString(),
  };
  
  // Clear the modal
  setRideRequest(null);
  
// Navigate to ActiveRideScreen
navigation.navigate('ActiveRide', { ride: activeRide, routeData });

 // Emit acceptance via socket AFTER navigation
socketService.acceptRide(user?.id || '', rideId);
 };  



// Handle ride request decline
const handleDeclineRide = (rideId: string) => {
  console.log('❌ Declining ride:', rideId);
  socketService.rejectRide(user?.id || '', rideId);
  setRideRequest(null);
};

  const centerOnUserLocation = async () => {
    try {
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
     
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Could not get location');
    }
  };

  const handleHeaderAction = (action: string) => {
    setHeaderExpanded(false);
    
    switch(action) {
      case 'documents':
        Alert.alert('Upload Documents', 'Document upload feature coming soon!');
        break;
      case 'performance':
        Alert.alert('Performance Summary', 'Detailed performance view coming soon!');
        break;
      case 'settings':
        Alert.alert('Settings', 'Settings screen coming soon!');
        break;
      case 'power':
        toggleOnlineStatus();
        break;
    }
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  // Helper function to get banner text
  const getBannerText = () => {
    if (rideState === 'pickingUp' && riderName) {
      return `Picking up ${riderName}`;
    } else if (rideState === 'droppingOff' && riderName) {
      return `Dropping off ${riderName}`;
    } else {
      return waitingTexts[bannerTextIndex];
    }
  };

  // Check if we should show directions card (when navigating)
  const showDirections = rideState === 'pickingUp' || rideState === 'droppingOff';

  console.log('HomeScreen render - Loading:', loading, 'Location:', location ? 'Yes' : 'No');

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.loadingText}>Initializing GPS...</Text>
        <Text style={styles.loadingSubtext}>This may take a moment</Text>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Unable to get location</Text>
        <TouchableOpacity style={styles.retryButton} onPress={initializeLocation}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (<>
    <TouchableWithoutFeedback onPress={() => headerExpanded && setHeaderExpanded(false)}>
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          customMapStyle={[
              { "elementType": "geometry", "stylers": [{ "color": "#ebebeb" }] },
              { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#c9d6df" }] },
              { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
              { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#d4d4d4" }] },
              { "elementType": "labels.text.fill", "stylers": [{ "color": "#6b6b6b" }] },
              { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] },
              { "featureType": "poi", "stylers": [{ "visibility": "on" }] },
              { "featureType": "transit", "stylers": [{ "visibility": "off" }] }
           ]}
          initialRegion={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={true}
          showsTraffic={false}
          zoomEnabled={true}           // ← ADD THIS
          scrollEnabled={true}          // ← ADD THIS
          zoomControlEnabled={true}     // ← ADD THIS (Android only)
          rotateEnabled={true}
          pitchEnabled={true}
          toolbarEnabled={false}
        >
          {/* CRITICAL: Car marker rotates to match heading (direction of travel) */}
          {/* Map ALSO rotates by same amount, so car appears to point UP on screen */}
          {/* Car image front points UP = 0°, adjust CAR_ROTATION_OFFSET if needed */}
          <SurgeOverlay zones={surgeZones} />
         <Marker
  coordinate={{
    latitude: location.latitude,
    longitude: location.longitude,
  }}
  anchor={{ x: 0.5, y: 0.5 }}
  flat={false}  // 👈 Changed to false!
  rotation={heading + CAR_ROTATION_OFFSET}
>
  <Image
    source={require('../assets/TopDownCar_7NoBckg.png.png')}
    style={{
      width: 40,  // 👈 Back to normal size
      height: 45,
    }}
    resizeMode="contain"
  />
          </Marker>
        </MapView>

        {/* Expandable Header Bar */}
        <Animated.View style={[styles.header, { top: headerHeight }]}>
          <View style={styles.headerIcons}>
            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => handleHeaderAction('documents')}
            >
              <Text style={styles.headerIcon}>📄</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => handleHeaderAction('performance')}
            >
              <Text style={styles.headerIcon}>📊</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.headerButton}
              onPress={() => handleHeaderAction('settings')}
            >
              <Text style={styles.headerIcon}>⚙️</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.headerButton,
                isOnline && styles.headerButtonRed
              ]}
              onPress={() => handleHeaderAction('power')}
            >
              <View style={styles.powerButtonCircle} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Floating Pi Logo Button */}
        <TouchableOpacity 
          style={styles.piLogoButton}
          onPress={() => setHeaderExpanded(!headerExpanded)}
          activeOpacity={0.8}
        >
          <View style={styles.piLogoContainer}>
            <Text style={styles.piLogo}>π</Text>
            <View style={[styles.statusDot, isOnline && styles.statusDotOnline]} />
          </View>
        </TouchableOpacity>

        
        {/* Route Directions Card (shows when navigating, covers performance panel) */}
        {showDirections ? (
          <View style={styles.directionsCard}>
            <View style={styles.directionsHeader}>
              <Text style={styles.directionsDistance}>1.2 mi</Text>
              <Text style={styles.directionsTime}>5 min</Text>
            </View>
            <View style={styles.directionsInstruction}>
              <Text style={styles.directionArrow}>➡️</Text>
              <View style={styles.directionText}>
                <Text style={styles.directionMain}>Turn right on Main St</Text>
                <Text style={styles.directionSub}>in 0.3 miles</Text>
              </View>
            </View>
            <View style={styles.directionsFooter}>
              <Text style={styles.directionsDestination}>
                {rideState === 'pickingUp' ? `📍 Picking up ${riderName}` : `🏁 Dropping off ${riderName}`}
              </Text>
            </View>
          </View>
        ) : (
          // Today's Performance Panel (only visible when NOT navigating)
          <View style={styles.performancePanel}>
            <TouchableOpacity 
              style={styles.performanceHeader}
              onPress={() => setPerformanceExpanded(!performanceExpanded)}
              activeOpacity={0.7}
            >
              <Text style={styles.performanceTitle}>
               {performanceExpanded ? "Today's Performance" : `${formatCurrency(performanceData.todayEarnings)} • ${performanceData.trips} trips • ${performanceData.miles.toFixed(1)} mi`}
              </Text>
              <Text style={styles.performanceToggle}>
                {performanceExpanded ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>

            {performanceExpanded && (
              <View style={styles.performanceContent}>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{formatCurrency(performanceData.todayEarnings)}</Text>
                    <Text style={styles.statLabel}>Today</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{performanceData.trips}</Text>
                    <Text style={styles.statLabel}>Trips</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{performanceData.onlineHours}h</Text>
                    <Text style={styles.statLabel}>Online</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{performanceData.miles.toFixed(1)}</Text>
                    <Text style={styles.statLabel}>Miles</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{formatCurrency(performanceData.lastRide)}</Text>
                    <Text style={styles.statLabel}>Last Ride</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Floating Action Buttons */}
        <View style={styles.floatingButtons}>
          <TouchableOpacity style={styles.floatingButton}>
            <Text style={styles.floatingButtonText}>📊</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.floatingButton} onPress={centerOnUserLocation}>
            <Text style={styles.floatingButtonText}>🧭</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.floatingButton, styles.floatingButtonPrimary]}>
            <Text style={styles.floatingButtonText}>💬</Text>
          </TouchableOpacity>
        {/* TEST BUTTON - Remove before production */}
  {isOnline && (
    <TouchableOpacity 
      style={[styles.floatingButton, { backgroundColor: '#F59E0B' }]}
      onPress={() => {
        setRideRequest({
          rideId: 'test-' + Date.now(),
          riderId: 'test-rider',
          riderName: 'Tolbert Dunkin',
          riderRating: 4.8,
         pickup: {
          address: 'Onyx Coffee Shop, SE 2nd St, Bentonville, AR',
          lat: 36.3731,
          lng: -94.2093,
       },
         destination: {
          address: '21C Museum Hotel, Bentonville, AR',
          lat: 36.3741,
          lng: -94.2081,
       },
          estimatedFare: 8.50,
          estimatedDistance: 0.3,
          estimatedDuration: 2,
          surgeMultiplier: 1.0,
  });
      }}
    >
      <Text style={styles.floatingButtonText}>🧪</Text>
    </TouchableOpacity>
  )}  
        </View>

        {/* Bottom Banner - Dynamic based on driver status */}
        <View style={styles.bottomControls}>
          {isOnline ? (
            // Online - show status banner with alternating/scrolling text
            <View style={styles.statusBanner}>
              <View style={styles.pulseIndicator} />
              <Animated.Text 
                style={[
                  styles.statusText,
                  { opacity: textOpacity }
                ]}
              >
                {getBannerText()}
              </Animated.Text>
            </View>
          ) : (
            // Offline - show GO ONLINE button
            <TouchableOpacity 
              style={styles.goOnlineButton}
              onPress={toggleOnlineStatus}
              activeOpacity={0.8}
            >
              <Text style={styles.goOnlineIcon}>⏻</Text>
              <View style={styles.statusIndicator} />
              <Text style={styles.goOnlineText}>GO ONLINE</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      
   </TouchableWithoutFeedback>

    {/* Ride Request Modal */}
  <RideRequestModal
    visible={rideRequest !== null}
    request={rideRequest}
    driverLocation={location}
    onAccept={handleAcceptRide}
    onDecline={handleDeclineRide}
  />
  
  {/* Trip Completed Modal */}
  {completedTripModal && (
    <View style={styles.tripCompletedOverlay}>
      <View style={styles.tripCompletedModal}>
        <Text style={styles.tripCompletedEmoji}>✅</Text>
        <Text style={styles.tripCompletedTitle}>Trip Completed!</Text>
        <Text style={styles.tripCompletedFare}>
          ${completedTripModal.fare.toFixed(2)}
        </Text>
        <Text style={styles.tripCompletedRider}>
          {completedTripModal.riderName} • {completedTripModal.distance.toFixed(1)} mi
        </Text>
      </View>
    </View>
  )}
</>
);
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
 
// Trip Completed Modal
  tripCompletedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripCompletedModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    marginHorizontal: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  tripCompletedEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  tripCompletedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  tripCompletedFare: {
    fontSize: 36,
    fontWeight: '800',
    color: '#10B981',
    marginBottom: 8,
  },
  tripCompletedRider: {
    fontSize: 16,
    color: '#6B7280',
  },

  // Expandable Header Bar
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: '#2C3E50',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 999,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonRed: {
    backgroundColor: '#EF4444',
  },
  headerIcon: {
    fontSize: 22,
  },
  powerButtonCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  // Floating Pi Logo Button
  piLogoButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 1000,
  },
  piLogoContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  piLogo: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6B7280',
    borderWidth: 2,
    borderColor: '#1F2937',
  },
  statusDotOnline: {
    backgroundColor: '#10B981',
  },

  // Route Directions Card (covers performance panel)
  directionsCard: {
    position: 'absolute',
    top: 90,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 900,
  },
  directionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  directionsDistance: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  directionsTime: {
    fontSize: 28,
    fontWeight: '700',
    color: '#10B981',
  },
  directionsInstruction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  directionArrow: {
    fontSize: 40,
    marginRight: 16,
  },
  directionText: {
    flex: 1,
  },
  directionMain: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  directionSub: {
    fontSize: 14,
    color: '#6B7280',
  },
  directionsFooter: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  directionsDestination: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  // Today's Performance Panel
  performancePanel: {
    position: 'absolute',
    top: 70,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
    zIndex: 900,
  },
  performanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  performanceTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  performanceToggle: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  performanceContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
  },
  // Floating Action Buttons
  floatingButtons: {
    position: 'absolute',
    right: 16,
    bottom: 180,
    gap: 12,
  },
  floatingButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  floatingButtonPrimary: {
    backgroundColor: '#10B981',
  },
  floatingButtonText: {
    fontSize: 24,
  },
  // Bottom Banners
  bottomControls: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
  },
  // Status Banner (Online - waiting/picking up/dropping off)
  statusBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  pulseIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    marginRight: 12,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  // GO ONLINE Button
  goOnlineButton: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  goOnlineIcon: {
    fontSize: 24,
    marginRight: 8,
    color: '#FFFFFF',
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
    marginRight: 10,
  },
  goOnlineText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});

export default HomeScreen;