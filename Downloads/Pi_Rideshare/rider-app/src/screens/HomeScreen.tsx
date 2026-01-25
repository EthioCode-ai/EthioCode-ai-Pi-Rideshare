import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { VoiceCommandResult } from '../services/voice-ai.service';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { locationService } from '../services/location.service';
import { socketService } from '../services/socket.service';
import { voiceService, VoiceCommand } from '../services/voice.service';
import { Driver, SurgeZone } from '../types';
import ScheduledRides from '../components/ScheduledRides';

import VoiceModal from '../components/VoiceModal';
import BottomSheet from '../components/BottomSheet';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

const { width, height } = Dimensions.get('window');

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a1a2e' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3d3d5c' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#232340' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a3d2e' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] },
];

const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const mapRef = useRef<MapView>(null);

  // Location state
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [currentAddress, setCurrentAddress] = useState<string>('Locating...');

  // Nearby drivers
  const [nearbyDrivers, setNearbyDrivers] = useState<Driver[]>([]);

  // Surge zones
  const [surgeZones, setSurgeZones] = useState<SurgeZone[]>([]);

  // Voice modal
  const [voiceModalVisible, setVoiceModalVisible] = useState(false);

  

  

  // Initialize socket AFTER location is available
  useEffect(() => {
    if (user?.id && currentLocation) {
      socketService.connect(user, currentLocation);
      socketService.startLocationBroadcast(() => currentLocation);
    }
  }, [user, currentLocation]);

  const initializeLocation = async () => {
    const location = await locationService.getCurrentLocation();
    if (location) {
      setCurrentLocation(location);
      const address = await locationService.getAddressFromCoordinates(location.latitude, location.longitude);
      setCurrentAddress(address);

      // Center map
      mapRef.current?.animateToRegion({
        ...location,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }, 1000);

      // Request nearby drivers
      socketService.requestNearbyDrivers(location);
    }
  };

  const initializeSocket = () => {
     console.log('🔍 DEBUG user:', JSON.stringify(user));  // ADD THIS LINE
    if (user?.id) {
      // Use currentLocation from state (or undefined) which matches { latitude, longitude }
      socketService.connect(user, currentLocation ?? undefined);
      socketService.startLocationBroadcast(() => currentLocation);

      socketService.onNearbyDriversUpdate((drivers) => {
        setNearbyDrivers(drivers);
      });

      socketService.onSurgeUpdate((data) => {
        setSurgeZones(data.zones);
      });
    }
  };



  const handleVoicePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setVoiceModalVisible(true);
  };

  const handleVoiceCommand = (result: VoiceCommandResult) => {
  setVoiceModalVisible(false);

  if (result.action === 'navigate_confirm' && result.destination) {
  if (!currentLocation) {
    Alert.alert('Location Required', 'Please enable location services to book a ride.');
    return;
  }
  navigation.navigate('RideConfirm', {
    pickup: {
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      address: currentAddress || 'Current Location',
    },
    destination: {
      latitude: result.destination.latitude,
      longitude: result.destination.longitude,
      address: result.destination.address,
    },
      scheduledTime: result.scheduledTime?.toISOString(),
    });
  } else if (result.action === 'navigate_search') {
    navigation.navigate('DestinationSearch', {
      pickup: currentLocation ? {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        address: currentAddress,
      } : undefined,
    });
  } else if (result.action === 'navigate_active') {
    console.log('Check for active ride');
  }
};

  const handleSearchPress = () => {
    navigation.navigate('DestinationSearch', {
      pickup: currentLocation ? {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        address: currentAddress,
      } : undefined,
    });
  };

  const handleRecenter = () => {
    if (currentLocation) {
      mapRef.current?.animateToRegion({
        ...currentLocation,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }, 500);
    }
  };

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
      top: 0,
      left: 0,
      right: 0,
      paddingTop: Platform.OS === 'ios' ? 50 : 40,
      paddingHorizontal: 20,
      paddingBottom: 15,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.overlay,
    },
    menuButton: {
      width: 44,
      height: 44,
      backgroundColor: isDark ? '#1a1a2e' : '#FFFFFF',
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    menuIcon: {
      fontSize: 20,
      color: isDark ? '#FFFFFF' : '#1a1a2e',
    },
    logo: {
      fontSize: 26,
      fontWeight: '800',
      color: isDark ? '#FFFFFF' : '#1a1a2e',
      letterSpacing: 1,
    },
    logoAccent: {
      color: '#E67E22',
      fontWeight: '800',
    },
    avatar: {
      width: 44,
      height: 44,
      backgroundColor: '#E67E22',
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#E67E22',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    avatarText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    mapControls: {
      position: 'absolute',
      right: 15,
      top: '45%',
      gap: 8,
    },
    mapButton: {
      width: 44,
      height: 44,
      backgroundColor: isDark ? '#1a1a2e' : '#FFFFFF',
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    mapButtonText: {
      fontSize: 18,
      color: isDark ? '#FFFFFF' : '#1a1a2e',
    },
    recenterButton: {
      position: 'absolute',
      right: 15,
      bottom: 320,
      width: 44,
      height: 44,
      backgroundColor: isDark ? '#1a1a2e' : '#FFFFFF',
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
       riderMarker: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    riderMarkerInner: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: '#1e3a5f',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: '#FFFFFF',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    },
    riderMarkerIcon: {
      fontSize: 14,
    },
    riderMarkerPulse: {
      position: 'absolute',
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(30, 58, 95, 0.2)',
      zIndex: -1,
    },
    driverMarker: {
      backgroundColor: isDark ? '#1a1a2e' : '#FFFFFF',
      borderWidth: 2,
      borderColor: '#E67E22',
      borderRadius: 8,
      padding: 4,
    },
    driverMarkerText: {
      fontSize: 16,
    },
    etaBadge: {
      position: 'absolute',
      top: -8,
      left: '50%',
      transform: [{ translateX: -15 }],
      backgroundColor: '#E67E22',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    etaBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    surgeLabel: {
      backgroundColor: 'rgba(245, 158, 11, 0.95)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
    },
    surgeLabelText: {
      fontSize: 11,
      fontWeight: '800',
      color: '#FFFFFF',
    },
  });

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        customMapStyle={isDark ? darkMapStyle : []}
       region={currentLocation ? {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
     } : undefined}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
           {/* Rider location marker */}
        {currentLocation && (
          <Marker coordinate={currentLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.riderMarker}>
              <View style={styles.riderMarkerInner}>
                <Text style={styles.riderMarkerIcon}>👤</Text>
              </View>
              <View style={styles.riderMarkerPulse} />
            </View>
          </Marker>
        )}

        {/* Surge zones */}
        {surgeZones.map((zone) => (
          <React.Fragment key={zone.id}>
            <Circle
              center={{ latitude: zone.center.lat, longitude: zone.center.lng }}
              radius={500}
              fillColor="rgba(245, 158, 11, 0.15)"
              strokeColor="rgba(245, 158, 11, 0.3)"
              strokeWidth={1}
            />
            <Marker
              coordinate={{ latitude: zone.center.lat, longitude: zone.center.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.surgeLabel}>
                <Text style={styles.surgeLabelText}>+{zone.surgeAmount}</Text>
              </View>
            </Marker>
          </React.Fragment>
        ))}

        {/* Nearby drivers */}
        {nearbyDrivers.map((driver) => (
          <Marker
            key={driver.id}
            coordinate={{
              latitude: driver.location?.latitude || 0,
              longitude: driver.location?.longitude || 0,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={driver.heading || 0}
          >
            <View>
              <View style={styles.driverMarker}>
                <Text style={styles.driverMarkerText}>🚗</Text>
              </View>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton}>
          <Text style={styles.menuIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.logo}>π <Text style={styles.logoAccent}>VIP</Text></Text>
        <TouchableOpacity style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Map Controls */}
      <View style={styles.mapControls}>
        <TouchableOpacity style={styles.mapButton}>
          <Text style={styles.mapButtonText}>➕</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.mapButton}>
          <Text style={styles.mapButtonText}>➖</Text>
        </TouchableOpacity>
      </View>

      {/* Recenter Button */}
      <TouchableOpacity style={styles.recenterButton} onPress={handleRecenter}>
        <Text style={styles.mapButtonText}>📍</Text>
      </TouchableOpacity>

      
{/* Scheduled Rides */}
<ScheduledRides
  onRidePress={(ride) => {
    console.log('Scheduled ride pressed:', ride);
    // TODO: Navigate to ride details or tracking
  }}
/>

      {/* Bottom Sheet */}
      <BottomSheet
        currentAddress={currentAddress}
        currentLocation={currentLocation}
        onSearchPress={handleSearchPress}
        onVoicePress={handleVoicePress}
        onQuickDestination={(dest) => {
          navigation.navigate('RideConfirm', {
            pickup: {
              latitude: currentLocation?.latitude || 0,
              longitude: currentLocation?.longitude || 0,
              address: currentAddress,
            },
            destination: {
              latitude: dest.latitude,
              longitude: dest.longitude,
              address: dest.address,
            },
          });
        }}
        onCalendarPress={() => {
          navigation.navigate('CalendarEvents');
        }}
        onSetHomeWork={(type) => {
          navigation.navigate('SaveLocation', { type });
        }}
      />

      {/* Voice Modal */}
      <VoiceModal
     visible={voiceModalVisible}
     onClose={() => setVoiceModalVisible(false)}
     onCommandProcessed={handleVoiceCommand}
     />
    </View>
  );
};

export default HomeScreen;