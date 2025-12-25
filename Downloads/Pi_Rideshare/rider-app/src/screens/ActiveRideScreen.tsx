import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { socketService } from '../services/socket.service';
import { directionsService, RouteInfo } from '../services/directions.service';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ActiveRide'>;
type RouteProps = RouteProp<RootStackParamList, 'ActiveRide'>;

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3d3d5c' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a3d2e' }] },
];

interface DriverInfo {
  id: string;
  name: string;
  photo: string;
  rating: number;
  vehicle: {
    make: string;
    model: string;
    color: string;
    licensePlate: string;
  };
  location: {
    latitude: number;
    longitude: number;
    heading: number;
  };
}

const ActiveRideScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { colors, isDark } = useTheme();
  const mapRef = useRef<MapView>(null);

  const { rideId, driver: routeDriver, pickup: routePickup, destination: routeDestination, eta: routeEta } = route.params;

  const [rideStatus, setRideStatus] = useState<'searching' | 'driver_assigned' | 'arriving' | 'arrived' | 'in_progress' | 'completed'>('driver_assigned');
  const [driver, setDriver] = useState<DriverInfo>(() => {
    if (routeDriver) {
      return {
        id: routeDriver.id || routeDriver.driverId || 'unknown',
        name: routeDriver.name || 'Your Driver',
        photo: '👤',
        rating: routeDriver.rating || 5.0,
        vehicle: {
          make: routeDriver.vehicle?.make || '',
          model: routeDriver.vehicle?.model || 'Vehicle',
          color: routeDriver.vehicle?.color || '',
          licensePlate: routeDriver.vehicle?.licensePlate || '',
        },
        location: {
          latitude: routePickup?.latitude || 36.1540,
          longitude: routePickup?.longitude || -94.1861,
          heading: 0,
        },
      };
    }
    // Fallback for direct navigation without driver data
    return {
      id: 'pending',
      name: 'Finding Driver...',
      photo: '👤',
      rating: 5.0,
      vehicle: {
        make: '',
        model: 'Pending',
        color: '',
        licensePlate: '',
      },
      location: {
        latitude: 36.1540,
        longitude: -94.1861,
        heading: 0,
      },
    };
  });

  const [pickup] = useState({
    latitude: routePickup!.latitude,
    longitude: routePickup!.longitude,
    address: routePickup?.address || '',
  });
  const [destination] = useState({
    latitude: routeDestination!.latitude,
    longitude: routeDestination!.longitude,
    address: routeDestination?.address || '',
  });

  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [eta, setEta] = useState(25);
  const [distanceTraveled, setDistanceTraveled] = useState(1.5);
  const [distanceLeft, setDistanceLeft] = useState(3.0);
  const [fare, setFare] = useState(24.00);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    fetchRoute();
    setupSocketListeners();

    // Cleanup socket listeners on unmount
    return () => {
      socketService.removeListener('driver-location-update');
      socketService.removeListener('driver_arrived');
      socketService.removeListener('trip-status-update');
      socketService.removeListener('ride-cancelled');
    };
  }, []);

  const fetchRoute = async () => {
    setLoading(true);
    try {
      const routeData = await directionsService.getRoute(pickup, destination);
      
      if (routeData) {
        setRouteInfo(routeData);
        setRouteCoordinates(routeData.polylinePoints);
        setEta(Math.round(routeData.duration.value / 60));
        
        setTimeout(() => {
          if (mapRef.current && routeData.polylinePoints.length > 0) {
            mapRef.current.fitToCoordinates(routeData.polylinePoints, {
              edgePadding: { top: 100, right: 50, bottom: 250, left: 50 },
              animated: true,
            });
          }
        }, 500);
      } else {
        setRouteCoordinates([pickup, destination]);
      }
    } catch (error) {
      console.error('Error fetching route:', error);
      setRouteCoordinates([pickup, destination]);
    } finally {
      setLoading(false);
    }
  };

  const setupSocketListeners = () => {
    // Listen for real-time driver location updates
    socketService.onDriverLocationUpdate((data) => {
      console.log('📍 Driver location update:', data);
      setDriver((prev) => ({
        ...prev,
        location: {
          latitude: data.latitude,
          longitude: data.longitude,
          heading: data.heading || prev.location.heading,
        },
      }));
    });

    // Listen for driver arrived at pickup
    socketService.onDriverArrived((data) => {
      console.log('🚗 Driver arrived:', data);
      setRideStatus('arrived');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });

    // Listen for trip status updates
    socketService.onTripStatusUpdate((data) => {
      console.log('🔄 Trip status update:', data);
      if (data.status === 'in_progress') {
        setRideStatus('in_progress');
      } else if (data.status === 'completed') {
        setRideStatus('completed');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => {
          navigation.replace('RideComplete', { rideId, fare });
        }, 1500);
      }
    });

    // Listen for ride cancellation
    socketService.onRideCancelled((data) => {
      console.log('❌ Ride cancelled:', data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    });
  };

  const handleCall = () => {
    Linking.openURL('tel:+15551234567');
  };

  const handleChat = () => {
    console.log('Open chat');
  };

  const handleShare = () => {
    console.log('Share ride');
  };

  const handleCancelRide = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Alert.alert(
      'Cancel Ride',
      'Are you sure you want to cancel this ride? A cancellation fee may apply.',
      [
        {
          text: 'Keep Ride',
          style: 'cancel',
        },
        {
          text: 'Cancel Ride',
          style: 'destructive',
          onPress: confirmCancelRide,
        },
      ]
    );
  };

  const confirmCancelRide = async () => {
    setCancelling(true);
    
    try {
      // TODO: Call API to cancel ride
      // await rideService.cancelRide(rideId);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert(
        'Ride Cancelled',
        'Your ride has been cancelled.',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'MainTabs' }],
              });
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error cancelling ride:', error);
      Alert.alert('Error', 'Failed to cancel ride. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  const getStatusText = () => {
    switch (rideStatus) {
      case 'searching':
        return 'Finding your driver...';
      case 'driver_assigned':
        return 'Driver is on the way';
      case 'arriving':
        return 'Driver is arriving';
      case 'arrived':
        return 'Driver has arrived';
      case 'in_progress':
        return 'Heading to destination';
      case 'completed':
        return 'Ride completed!';
      default:
        return '';
    }
  };

  const canCancel = rideStatus !== 'in_progress' && rideStatus !== 'completed';
  const progress = ((distanceTraveled / (distanceTraveled + distanceLeft)) * 100);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    map: {
      flex: 1,
    },
    header: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 50 : 40,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      zIndex: 10,
    },
    menuButton: {
      width: 44,
      height: 44,
      backgroundColor: colors.card,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    menuIcon: {
      fontSize: 18,
      color: colors.text,
    },
    logo: {
      fontSize: 20,
      fontWeight: '700',
    },
    logoGold: {
      color: colors.primary,
    },
    logoWhite: {
      color: colors.text,
    },
    profileButton: {
      width: 44,
      height: 44,
      backgroundColor: colors.card,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    profileIcon: {
      fontSize: 18,
    },
    driverCard: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 110 : 100,
      left: 15,
      right: 15,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      zIndex: 10,
    },
    statusText: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: 12,
    },
    driverInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    driverPhoto: {
      width: 50,
      height: 50,
      backgroundColor: colors.primary,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    driverPhotoText: {
      fontSize: 24,
    },
    driverDetails: {
      flex: 1,
    },
    driverName: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    vehicleInfo: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    ratingStar: {
      color: colors.primary,
      fontSize: 14,
    },
    ratingText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    etaContainer: {
      alignItems: 'flex-end',
    },
    etaNumber: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.primary,
    },
    etaLabel: {
      fontSize: 12,
      color: colors.textMuted,
    },
    actionButtons: {
      flexDirection: 'row',
      marginTop: 16,
      gap: 10,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 10,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      gap: 6,
    },
    actionButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    bottomSheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: Platform.OS === 'ios' ? 40 : 24,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderBottomWidth: 0,
    },
    progressContainer: {
      marginBottom: 16,
    },
    progressBar: {
      height: 4,
      backgroundColor: colors.inputBackground,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 2,
    },
    progressLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    progressLabel: {
      fontSize: 12,
      color: colors.textMuted,
    },
    progressEta: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
    },
    tripInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 16,
    },
    tripDestination: {
      flex: 1,
    },
    tripLabel: {
      fontSize: 11,
      color: colors.textMuted,
      marginBottom: 4,
      textTransform: 'uppercase',
    },
    tripAddress: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    tripFare: {
      alignItems: 'flex-end',
    },
    fareLabel: {
      fontSize: 11,
      color: colors.textMuted,
      marginBottom: 4,
      textTransform: 'uppercase',
    },
    fareAmount: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.primary,
    },
    cancelButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ef444420',
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#ef4444',
      gap: 8,
    },
    cancelButtonDisabled: {
      opacity: 0.5,
    },
    cancelButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#ef4444',
    },
    driverMarker: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    driverMarkerIcon: {
      fontSize: 30,
    },
    pickupMarker: {
      alignItems: 'center',
    },
    pickupDot: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.primary,
      borderWidth: 3,
      borderColor: '#ffffff',
    },
    destMarker: {
      alignItems: 'center',
    },
    destDot: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.secondary,
      borderWidth: 3,
      borderColor: '#ffffff',
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        customMapStyle={isDark ? darkMapStyle : []}
        initialRegion={{
          latitude: pickup.latitude,
          longitude: pickup.longitude,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        }}
      >
        {/* Driver Marker */}
        <Marker coordinate={driver.location}>
          <View style={styles.driverMarker}>
            <Text style={styles.driverMarkerIcon}>🚗</Text>
          </View>
        </Marker>

        {/* Pickup Marker */}
        <Marker coordinate={pickup}>
          <View style={styles.pickupMarker}>
            <View style={styles.pickupDot} />
          </View>
        </Marker>

        {/* Destination Marker */}
        <Marker coordinate={destination}>
          <View style={styles.destMarker}>
            <View style={styles.destDot} />
          </View>
        </Marker>

        {/* Route Polyline */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={colors.primary}
            strokeWidth={4}
          />
        )}
      </MapView>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.logo}>
          <Text style={styles.logoGold}>π</Text>
          <Text style={styles.logoWhite}>VIP</Text>
        </Text>
        <TouchableOpacity style={styles.profileButton}>
          <Text style={styles.profileIcon}>🛡️</Text>
        </TouchableOpacity>
      </View>

      {/* Driver Card */}
      <View style={styles.driverCard}>
        <Text style={styles.statusText}>{getStatusText()}</Text>
        <View style={styles.driverInfo}>
          <View style={styles.driverPhoto}>
            <Text style={styles.driverPhotoText}>👤</Text>
          </View>
          <View style={styles.driverDetails}>
            <Text style={styles.driverName}>{driver.name}</Text>
            <Text style={styles.vehicleInfo}>
              {driver.vehicle.color} {driver.vehicle.make} {driver.vehicle.model} • {driver.vehicle.licensePlate}
            </Text>
            <View style={styles.ratingRow}>
              <Text style={styles.ratingStar}>★</Text>
              <Text style={styles.ratingText}>{driver.rating.toFixed(2)}</Text>
            </View>
          </View>
          <View style={styles.etaContainer}>
            <Text style={styles.etaNumber}>{Math.round(eta)}</Text>
            <Text style={styles.etaLabel}>min away</Text>
          </View>
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
            <Text>📞</Text>
            <Text style={styles.actionButtonText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleChat}>
            <Text>💬</Text>
            <Text style={styles.actionButtonText}>Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <Text>📍</Text>
            <Text style={styles.actionButtonText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>{distanceTraveled.toFixed(1)} mi traveled</Text>
            <Text style={styles.progressEta}>ETA: {Math.round(eta)} min</Text>
            <Text style={styles.progressLabel}>{distanceLeft.toFixed(1)} mi left</Text>
          </View>
        </View>

        <View style={styles.tripInfo}>
          <View style={styles.tripDestination}>
            <Text style={styles.tripLabel}>Destination</Text>
            <Text style={styles.tripAddress}>{destination.address}</Text>
          </View>
          <View style={styles.tripFare}>
            <Text style={styles.fareLabel}>Fare</Text>
            <Text style={styles.fareAmount}>${fare.toFixed(2)}</Text>
          </View>
        </View>

        {/* Cancel Button - Only show before ride is in progress */}
        {canCancel && (
          <TouchableOpacity
            style={[styles.cancelButton, cancelling && styles.cancelButtonDisabled]}
            onPress={handleCancelRide}
            disabled={cancelling}
          >
            {cancelling ? (
              <ActivityIndicator size="small" color="#ef4444" />
            ) : (
              <>
                <Text>✕</Text>
                <Text style={styles.cancelButtonText}>Cancel Ride</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
    </View>
  );
};

export default ActiveRideScreen;