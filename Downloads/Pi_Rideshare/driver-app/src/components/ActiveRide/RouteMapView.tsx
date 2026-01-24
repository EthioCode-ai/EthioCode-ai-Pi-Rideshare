/**
 * RouteMapView Component
 * Displays map with route polyline, driver marker, and destination markers
 * 
 * Uses same map patterns as HomeScreen.tsx
 */

import React, { useRef, useEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import { StyleSheet, View, Image, Text } from 'react-native';
import MapView, { Marker, Polyline, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { TripStatus, LocationWithAddress } from '../../types/ride.types';
import { Coordinate } from '../../utils/polylineDecoder';

// Rotation offset for car marker (same as HomeScreen)
const CAR_ROTATION_OFFSET = 90;

// Pi VIP brand colors
const COLORS = {
  route: '#6B46C1',
  routeOutline: '#44337A',
  pickup: '#10B981',
  destination: '#EF4444',
};

// Helper: Calculate distance from point to line segment
const distanceToSegment = (
  point: { latitude: number; longitude: number },
  segStart: { latitude: number; longitude: number },
  segEnd: { latitude: number; longitude: number }
): { distance: number; closestPoint: { latitude: number; longitude: number } } => {
  const dx = segEnd.longitude - segStart.longitude;
  const dy = segEnd.latitude - segStart.latitude;
  
  if (dx === 0 && dy === 0) {
    // Segment is a point
    return {
      distance: Math.sqrt(
        Math.pow(point.latitude - segStart.latitude, 2) +
        Math.pow(point.longitude - segStart.longitude, 2)
      ),
      closestPoint: segStart
    };
  }
  
  // Calculate projection of point onto line segment
  const t = Math.max(0, Math.min(1, 
    ((point.longitude - segStart.longitude) * dx + (point.latitude - segStart.latitude) * dy) / 
    (dx * dx + dy * dy)
  ));
  
  const closestPoint = {
    latitude: segStart.latitude + t * dy,
    longitude: segStart.longitude + t * dx
  };
  
  const distance = Math.sqrt(
    Math.pow(point.latitude - closestPoint.latitude, 2) +
    Math.pow(point.longitude - closestPoint.longitude, 2)
  );
  
  return { distance, closestPoint };
};

// Helper: Snap a point to the nearest position on a polyline
const snapToPolyline = (
  point: { latitude: number; longitude: number },
  polyline: Coordinate[]
): { latitude: number; longitude: number } => {
  if (polyline.length === 0) return point;
  if (polyline.length === 1) return polyline[0];
  
  let minDistance = Infinity;
  let snappedPoint = point;
  
  for (let i = 0; i < polyline.length - 1; i++) {
    const { distance, closestPoint } = distanceToSegment(point, polyline[i], polyline[i + 1]);
    if (distance < minDistance) {
      minDistance = distance;
      snappedPoint = closestPoint;
    }
  }
  
  return snappedPoint;
};


// Map style (same as HomeScreen)
const MAP_STYLE = [
  { "elementType": "geometry", "stylers": [{ "color": "#ebebeb" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#c9d6df" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#d4d4d4" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#6b6b6b" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] }
];

interface RouteMapViewProps {
  driverLocation: { latitude: number; longitude: number } | null;
  heading: number;
  pickup: LocationWithAddress;
  destination: LocationWithAddress;
  routeCoordinates: Coordinate[];
  tripStatus: TripStatus;
  riderName?: string;
}

export interface RouteMapViewRef {
  fitToRoute: () => void;
  centerOnDriver: () => void;
}

const RouteMapView = forwardRef<RouteMapViewRef, RouteMapViewProps>(({
  driverLocation,
  heading,
  pickup,
  destination,
  routeCoordinates,
  tripStatus,
  riderName,
}, ref) => {
  const mapRef = useRef<MapView>(null);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    fitToRoute: () => {
      if (!mapRef.current || !driverLocation) return;
      
      const points: Array<{ latitude: number; longitude: number }> = [
        { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
      ];

      // Add pickup if en route to pickup
      if (tripStatus === 'en_route_to_pickup' || tripStatus === 'at_pickup') {
        points.push({ latitude: pickup.lat, longitude: pickup.lng });
      }

      // Add destination if in trip
      if (tripStatus === 'in_trip') {
        points.push({ latitude: destination.lat, longitude: destination.lng });
      }

      if (points.length > 1) {
        mapRef.current.fitToCoordinates(points, {
          edgePadding: { top: 150, right: 50, bottom: 350, left: 50 },
          animated: true,
        });
      }
    },
    centerOnDriver: () => {
      if (!mapRef.current || !driverLocation) return;
      
      mapRef.current.animateCamera({
        center: {
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
        },
        heading: heading,
        pitch: 60,
        zoom: 19,
      }, { duration: 400 });
    },
  }));

  // Update camera when driver moves (navigation mode)
  useEffect(() => {
    console.log('🧭 Heading update:', heading);
    if (!mapRef.current || !driverLocation) return;

    // Only auto-follow in navigation mode
    if (tripStatus === 'en_route_to_pickup' || tripStatus === 'in_trip') {
      mapRef.current.animateCamera({
        center: {
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
        },
        heading: heading,
        pitch: 60,
        zoom: 19,
      }, { duration: 400 });
    }
  }, [driverLocation?.latitude, driverLocation?.longitude, heading, tripStatus]);

  // Determine which markers to show
  const showPickupMarker = tripStatus === 'en_route_to_pickup' || tripStatus === 'at_pickup';
  const showDestinationMarker = tripStatus === 'in_trip' || tripStatus === 'completed';
  console.log('📍 RouteMapView - tripStatus:', tripStatus);
  console.log('📍 RouteMapView - pickup:', pickup.lat, pickup.lng);
  console.log('📍 RouteMapView - destination:', destination.lat, destination.lng);
  console.log('📍 Destination marker - tripStatus:', tripStatus, 'show:', showDestinationMarker);

  /// Calculate trimmed route starting from driver's current position
  const trimmedRouteCoordinates = useMemo(() => {
    if (!driverLocation || routeCoordinates.length === 0) {
      return routeCoordinates;
    }

    // Find the closest point on the route to the driver
    let closestIndex = 0;
    let closestDistance = Infinity;

    routeCoordinates.forEach((coord, index) => {
      const distance = Math.sqrt(
        Math.pow(coord.latitude - driverLocation.latitude, 2) +
        Math.pow(coord.longitude - driverLocation.longitude, 2)
      );
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    // Only prepend driver location if close to route (within ~100 meters)
    // Otherwise show full route to avoid trimming when driver is off-route
    const CLOSE_THRESHOLD = 0.001; // roughly 100 meters in lat/lng
    
    if (closestDistance < CLOSE_THRESHOLD) {
      // Driver is on/near route - trim and show from driver position
      return [
        { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
        ...routeCoordinates.slice(closestIndex)
      ];
    } else {
      // Driver is far from route - show full route
      return routeCoordinates;
    }
  }, [driverLocation?.latitude, driverLocation?.longitude, routeCoordinates]);

  // Calculate snapped car position (for display only)
  const snappedCarPosition = useMemo(() => {
    if (!driverLocation || routeCoordinates.length < 2) {
      return driverLocation;
    }
    return snapToPolyline(driverLocation, routeCoordinates);
  }, [driverLocation?.latitude, driverLocation?.longitude, routeCoordinates]);

  // Get initial region
  const getInitialRegion = () => {
    if (driverLocation) {
      return {
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    return {
      latitude: pickup.lat,
      longitude: pickup.lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        customMapStyle={MAP_STYLE}
        initialRegion={getInitialRegion()}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={true}
        showsTraffic={false}
        rotateEnabled={true}
        pitchEnabled={true}
        toolbarEnabled={false}
      >
        {/* Route polyline - outline */}
        {trimmedRouteCoordinates.length > 0 && (
          <Polyline
            coordinates={trimmedRouteCoordinates}
            strokeColor={COLORS.routeOutline}
            strokeWidth={7}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* Route polyline - main line */}
        {trimmedRouteCoordinates.length > 0 && (
          <Polyline
            coordinates={trimmedRouteCoordinates}
            strokeColor={COLORS.route}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* Driver marker */}
        {driverLocation && (
          <Marker
            coordinate={
              routeCoordinates.length >= 2
                ? snapToPolyline(driverLocation, routeCoordinates)
                : { latitude: driverLocation.latitude, longitude: driverLocation.longitude }
            }
            anchor={{ x: 0.5, y: 0.5 }}
            flat={false}
            rotation={CAR_ROTATION_OFFSET}
          >
            <Image
              source={require('../../assets/TopDownCar_7NoBckg.png.png')}
              style={styles.carMarker}
              resizeMode="contain"
            />
          </Marker>
        )}

       {/* Pickup marker - Rider avatar */}
        {showPickupMarker && (
          <Marker
            coordinate={{ latitude: pickup.lat, longitude: pickup.lng }}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.riderMarkerContainer}>
              <View style={styles.riderAvatar}>
                <View style={styles.riderHead} />
                <View style={styles.riderBody} />
              </View>
              {riderName && (
                <View style={styles.riderNameBadge}>
                  <Text style={styles.riderNameText}>{riderName.split(' ')[0]}</Text>
                </View>
              )}
            </View>
          </Marker>
        )}

        {/* Destination marker with radius */}
        {showDestinationMarker && (
          <>
            <Circle
              center={{ latitude: destination.lat, longitude: destination.lng }}
              radius={35}
              fillColor="rgba(239, 68, 68, 0.2)"
              strokeColor="rgba(239, 68, 68, 0.5)"
              strokeWidth={2}
            />
            <Marker
              coordinate={{ latitude: destination.lat, longitude: destination.lng }}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={styles.destinationMarker}>
                <View style={[styles.markerDot, { backgroundColor: COLORS.destination }]} />
                <View style={[styles.markerStem, { backgroundColor: COLORS.destination }]} />
              </View>
            </Marker>
          </>
        )}
      </MapView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  carMarker: {
    width: 40,
    height: 45,
  },
  riderMarkerContainer: {
    alignItems: 'center',
  },
  riderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E3A5F',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  riderHead: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    marginBottom: 2,
  },
  riderBody: {
    width: 18,
    height: 10,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    backgroundColor: '#FFFFFF',
  },
  riderNameBadge: {
    backgroundColor: '#1E3A5F',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
  },
  riderNameText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  destinationMarker: {
    alignItems: 'center',
  },
  markerDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.pickup,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  markerStem: {
    width: 3,
    height: 12,
    marginTop: -2,
  },
});
RouteMapView.displayName = 'RouteMapView';

export default RouteMapView;