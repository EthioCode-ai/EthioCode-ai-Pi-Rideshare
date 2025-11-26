import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';


const HomeScreen: React.FC = () => {
  const [location, setLocation] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [heading, setHeading] = useState<number>(0);
  const mapRef = useRef<MapView>(null);


  useEffect(() => {
    console.log('HomeScreen mounted! Initializing location...');
    initializeLocation();
  }, []);


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
         
          if (newLocation.coords.heading !== null && isOnline) {
            setHeading(newLocation.coords.heading);
           
            if (mapRef.current) {
              mapRef.current.animateCamera({
                center: {
                  latitude: newLoc.latitude,
                  longitude: newLoc.longitude,
                },
                heading: newLocation.coords.heading,
                pitch: 60,
                zoom: 17,
              }, { duration: 500 });
            }
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


  const toggleOnlineStatus = () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);


    if (newStatus) {
      Alert.alert('Online', 'Navigation mode activated! Map will rotate with your heading.');
     
      if (mapRef.current && location) {
        mapRef.current.animateCamera({
          center: {
            latitude: location.latitude,
            longitude: location.longitude,
          },
          heading: heading,
          pitch: 60,
          zoom: 17,
        }, { duration: 1000 });
      }
    } else {
      Alert.alert('Offline', 'Navigation mode deactivated');
     
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
    }
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


  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={true}
        showsTraffic={true}
        rotateEnabled={true}
        pitchEnabled={true}
        toolbarEnabled={false}
      >
        <Marker
          coordinate={{
            latitude: location.latitude,
            longitude: location.longitude,
          }}
          anchor={{ x: 0.5, y: 0.5 }}
          flat={true}
          rotation={0}
        >
          <View style={styles.carMarker}>
            <Text style={styles.carIcon}>🚗</Text>
          </View>
        </Marker>
      </MapView>


      <View style={styles.topControls}>
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Driver Status</Text>
          <View style={styles.statusToggle}>
            <Text style={[styles.statusText, isOnline && styles.statusTextOnline]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
            <Switch
              value={isOnline}
              onValueChange={toggleOnlineStatus}
              trackColor={{ false: '#D1D5DB', true: '#4ADE80' }}
              thumbColor="#FFFFFF"
            />
          </View>
          <Text style={styles.headingText}>
            Heading: {Math.round(heading)}°
          </Text>
        </View>
      </View>


      <View style={styles.bottomControls}>
        <TouchableOpacity style={styles.locationButton} onPress={centerOnUserLocation}>
          <Text style={styles.locationButtonText}>📍</Text>
        </TouchableOpacity>


        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>
            {isOnline ? '🎯 Navigation Mode Active' : '⏸️ Go online to start'}
          </Text>
          <Text style={styles.infoSubtitle}>
            {isOnline
              ? 'Map rotates with your heading • 3D mode enabled'
              : 'Toggle switch above to activate navigation'}
          </Text>
        </View>
      </View>
    </View>
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
  carMarker: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carIcon: {
    fontSize: 32,
  },
  topControls: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  statusTextOnline: {
    color: '#10B981',
  },
  headingText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
  },
  locationButton: {
    position: 'absolute',
    bottom: 140,
    right: 0,
    backgroundColor: '#FFFFFF',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  locationButtonText: {
    fontSize: 28,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  infoTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  infoSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
});


export default HomeScreen;