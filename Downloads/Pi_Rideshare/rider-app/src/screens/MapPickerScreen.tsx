import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../context/ThemeContext';
import { placesService } from '../services/places.service';
import { locationService } from '../services/location.service';

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3d3d5c' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a3d2e' }] },
];

// ~1 mile radius view
const ZOOM_DELTA = 0.015;

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
}

const MapPickerScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<RouteProp<any, any>>();
  const { colors, isDark } = useTheme();
  const mapRef = useRef<MapView>(null);

  const field = route.params?.field || 'destination';
  const initialLocation = route.params?.currentLocation;

  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [region, setRegion] = useState<Region | null>(null);

  useEffect(() => {
    initializeLocation();
  }, []);

  const initializeLocation = async () => {
    setLoading(true);
    try {
      // First, try to get the user's current location
      const currentLocation = await locationService.getCurrentLocation();
      
      if (currentLocation) {
        const newRegion: Region = {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: ZOOM_DELTA,
          longitudeDelta: ZOOM_DELTA,
        };
        
        setRegion(newRegion);
        
        // Animate map to location once ready
        if (mapReady && mapRef.current) {
          mapRef.current.animateToRegion(newRegion, 500);
        }
        
        // Get address for current location
        await reverseGeocode(currentLocation.latitude, currentLocation.longitude);
      } else if (initialLocation) {
        // Fallback to initial location if provided
        const newRegion: Region = {
          latitude: initialLocation.latitude,
          longitude: initialLocation.longitude,
          latitudeDelta: ZOOM_DELTA,
          longitudeDelta: ZOOM_DELTA,
        };
        setRegion(newRegion);
        setAddress(initialLocation.address || '');
        setSelectedLocation(initialLocation);
      } else {
        // Default fallback (Bentonville, AR)
        const defaultRegion: Region = {
          latitude: 36.3729,
          longitude: -94.2088,
          latitudeDelta: ZOOM_DELTA,
          longitudeDelta: ZOOM_DELTA,
        };
        setRegion(defaultRegion);
        await reverseGeocode(defaultRegion.latitude, defaultRegion.longitude);
      }
    } catch (error) {
      console.error('Error initializing location:', error);
    } finally {
      setLoading(false);
    }
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const addr = await placesService.reverseGeocode(lat, lng);
      setAddress(addr);
      setSelectedLocation({
        latitude: lat,
        longitude: lng,
        address: addr,
      });
    } catch (error) {
      console.error('Reverse geocode error:', error);
      setAddress('Unknown location');
      setSelectedLocation({
        latitude: lat,
        longitude: lng,
        address: 'Unknown location',
      });
    }
  };

  const handleMapReady = () => {
    setMapReady(true);
    if (region && mapRef.current) {
      mapRef.current.animateToRegion(region, 500);
    }
  };

  const handleRegionChangeComplete = async (newRegion: Region) => {
    setRegion(newRegion);
    setLoading(true);
    await reverseGeocode(newRegion.latitude, newRegion.longitude);
    setLoading(false);
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      navigation.navigate('DestinationSearch', {
        selectedLocation,
        field,
      });
    }
  };

  const handleRecenter = async () => {
    setLoading(true);
    try {
      const location = await locationService.getCurrentLocation();
      if (location && mapRef.current) {
        const newRegion: Region = {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: ZOOM_DELTA,
          longitudeDelta: ZOOM_DELTA,
        };
        mapRef.current.animateToRegion(newRegion, 500);
        await reverseGeocode(location.latitude, location.longitude);
      }
    } catch (error) {
      console.error('Error recentering:', error);
    } finally {
      setLoading(false);
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
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 100,
    },
    header: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 50 : 40,
      left: 15,
      right: 15,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      zIndex: 10,
    },
    backButton: {
      width: 50,
      height: 50,
      backgroundColor: colors.card,
      borderRadius: 25,
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
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.primary,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      backgroundColor: colors.card,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      overflow: 'hidden',
    },
    placeholder: {
      width: 50,
    },
    pinContainer: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      marginLeft: -24,
      marginTop: -48,
      zIndex: 10,
      alignItems: 'center',
    },
    pinIcon: {
      fontSize: 48,
    },
    pinShadow: {
      width: 12,
      height: 6,
      backgroundColor: 'rgba(0,0,0,0.3)',
      borderRadius: 6,
      marginTop: -8,
    },
    recenterButton: {
      position: 'absolute',
      right: 15,
      bottom: 220,
      width: 50,
      height: 50,
      backgroundColor: colors.card,
      borderRadius: 25,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.cardBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 3,
    },
    recenterIcon: {
      fontSize: 24,
    },
    zoomHint: {
      position: 'absolute',
      bottom: 280,
      left: 15,
      right: 15,
      backgroundColor: `${colors.card}ee`,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    zoomHintText: {
      fontSize: 12,
      color: colors.textMuted,
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
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.textMuted,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 16,
    },
    addressLabel: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 8,
      textTransform: 'uppercase',
      fontWeight: '600',
    },
    addressContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
      backgroundColor: colors.inputBackground,
      padding: 14,
      borderRadius: 12,
    },
    addressIcon: {
      fontSize: 24,
      marginRight: 12,
    },
    addressText: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
    },
    loadingIndicator: {
      marginLeft: 10,
    },
    confirmButton: {
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    confirmButtonDisabled: {
      opacity: 0.6,
    },
    confirmButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? '#0d0d1a' : '#ffffff',
    },
  });

  // Show loading screen until we have a region
  if (!region) {
    return (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.text, marginTop: 10 }}>Getting your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        customMapStyle={isDark ? darkMapStyle : []}
        initialRegion={region}
        onMapReady={handleMapReady}
        onRegionChangeComplete={handleRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton={false}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {field === 'pickup' ? 'Set Pickup' : 'Set Destination'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      {/* Center Pin */}
      <View style={styles.pinContainer}>
        <Text style={styles.pinIcon}>{field === 'pickup' ? '📍' : '🏁'}</Text>
        <View style={styles.pinShadow} />
      </View>

      {/* Zoom Hint */}
      <View style={styles.zoomHint}>
        <Text style={styles.zoomHintText}>Drag map to position pin • Pinch to zoom</Text>
      </View>

      {/* Recenter Button */}
      <TouchableOpacity style={styles.recenterButton} onPress={handleRecenter}>
        <Text style={styles.recenterIcon}>📍</Text>
      </TouchableOpacity>

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        <View style={styles.handle} />
        <Text style={styles.addressLabel}>
          {field === 'pickup' ? 'Pickup Location' : 'Destination'}
        </Text>
        <View style={styles.addressContainer}>
          <Text style={styles.addressIcon}>{field === 'pickup' ? '🟠' : '🟢'}</Text>
          <Text style={styles.addressText} numberOfLines={2}>
            {loading ? 'Finding address...' : address || 'Move map to select location'}
          </Text>
          {loading && (
            <ActivityIndicator size="small" color={colors.primary} style={styles.loadingIndicator} />
          )}
        </View>
        <TouchableOpacity
          style={[styles.confirmButton, (!selectedLocation || loading) && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          disabled={!selectedLocation || loading}
        >
          <Text style={styles.confirmButtonText}>Confirm Location</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default MapPickerScreen;