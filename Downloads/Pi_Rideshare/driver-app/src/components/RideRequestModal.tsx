/**
 * RideRequestModal Component
 * 
 * Full-screen modal for incoming ride requests
 * Features:
 * - 7-second countdown timer
 * - Auto-decline on timeout
 * - Real-time route calculation via Google Directions API
 * - Distance to pickup + ETA from driver's location
 * - Trip distance/duration from pickup to dropoff
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Vibration,
} from 'react-native';
import { API_BASE_URL } from '../config/api.config';

export interface RideRequestData {
  rideId: string;
  riderId: string;
  riderName?: string;
  riderRating?: number;
  pickup: {
    address: string;
    lat?: number;
    lng?: number;
  };
  destination: {
    address: string;
    lat?: number;
    lng?: number;
  };
  estimatedFare: number;
  estimatedDistance?: number;
  estimatedDuration?: number;
  surgeMultiplier?: number;
}

interface RideRequestModalProps {
  visible: boolean;
  request: RideRequestData | null;
  driverLocation?: { latitude: number; longitude: number } | null;
  onAccept: (rideId: string) => void;
  onDecline: (rideId: string) => void;
  countdownDuration?: number;
}

const RideRequestModal: React.FC<RideRequestModalProps> = ({
  visible,
  request,
  driverLocation,
  onAccept,
  onDecline,
  countdownDuration = 15000,
}) => {
  const [countdown, setCountdown] = useState(countdownDuration / 1000);
 const [routeData, setRouteData] = useState<{
  toPickup: { distance: { miles: number }; duration: { minutes: number }; source: string };
  toDestination: { distance: { miles: number }; duration: { minutes: number }; source: string };
  totalTrip: { distance: { miles: number }; duration: { minutes: number } };
} | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const progressAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  // Fetch route from driver to pickup
  useEffect(() => {
  if (visible && request && driverLocation && request.pickup.lat && request.pickup.lng && request.destination.lat && request.destination.lng) {
    console.log('🔍 Calculating routes...');
    setLoadingRoute(true);
    
    fetch(`${API_BASE_URL}/api/rides/routes/calculate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        driverLocation: {
          lat: driverLocation.latitude,
          lng: driverLocation.longitude,
        },
        pickup: {
          lat: request.pickup.lat,
          lng: request.pickup.lng,
        },
        destination: {
          lat: request.destination.lat,
          lng: request.destination.lng,
        },
      }),
    })
      .then(res => res.json())
      .then(data => {
        console.log('✅ Routes calculated:', data);
        setRouteData(data);
        setLoadingRoute(false);
      })
      .catch(error => {
        console.error('❌ Failed to calculate routes:', error);
        setLoadingRoute(false);
      });
  }
}, [visible, request, driverLocation]);

  useEffect(() => {
    if (visible && request) {
      // Reset countdown
      setCountdown(countdownDuration / 1000);
      progressAnim.setValue(1);

      // Vibrate on new request
      Vibration.vibrate([0, 500, 200, 500]);

      // Start countdown timer
      timerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

       // Start progress bar animation
      animationRef.current = Animated.timing(progressAnim, {
        toValue: 0,
        duration: countdownDuration,
        useNativeDriver: false,
      });
      animationRef.current.start();

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (animationRef.current) animationRef.current.stop();
        setRouteData(null);
      };
    }
  }, [visible, request]);

// Auto-decline when countdown reaches 0
  useEffect(() => {
         if (countdown === 0 && visible && request) {
        onDecline(request.rideId);
       }
       }, [countdown, visible, request, onDecline]);
      

  const handleAccept = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationRef.current) animationRef.current.stop();
    if (request) onAccept(request.rideId);
  };

  const handleDecline = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationRef.current) animationRef.current.stop();
    if (request) onDecline(request.rideId);
  };

  if (!request) return null;

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleDecline}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Countdown Progress Bar */}
          <View style={styles.progressContainer}>
            <Animated.View
              style={[
                styles.progressBar,
                { width: progressWidth },
                countdown <= 3 && styles.progressBarUrgent,
              ]}
            />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>New Ride Request</Text>
            <View style={styles.countdownBadge}>
              <Text
                style={[
                  styles.countdownText,
                  countdown <= 3 && styles.countdownTextUrgent,
                ]}
              >
                {countdown}s
              </Text>
            </View>
          </View>

          {/* Rider Info */}
          {request.riderName && (
            <View style={styles.riderInfo}>
              <View style={styles.riderAvatar}>
                <Text style={styles.riderInitial}>
                  {request.riderName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={styles.riderName}>{request.riderName}</Text>
                {request.riderRating && (
                  <Text style={styles.riderRating}>
                    ⭐ {request.riderRating.toFixed(1)}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Ride Details */}
          <View style={styles.routeContainer}>
            {/* Pickup */}
            <View style={styles.locationRow}>
              <View style={[styles.locationDot, styles.pickupDot]} />
              <View style={styles.locationInfo}>
                <Text style={styles.locationLabel}>PICKUP</Text>
                <Text style={styles.locationAddress} numberOfLines={2}>
                  {request.pickup.address}
                </Text>
                {loadingRoute ? (
                  <Text style={styles.distanceText}>Calculating...</Text>
                ) : routeData ? (
                 <Text style={styles.distanceText}>
                 {routeData.toPickup.distance.miles.toFixed(1)} mi away ({routeData.toPickup.duration.minutes} min)
                 </Text>
                 ) : null}
              </View>
            </View>

            {/* Line connector */}
            <View style={styles.connector} />

            {/* Destination */}
            <View style={styles.locationRow}>
              <View style={[styles.locationDot, styles.destinationDot]} />
              <View style={styles.locationInfo}>
                <Text style={styles.locationLabel}>DROPOFF</Text>
                <Text style={styles.locationAddress} numberOfLines={2}>
                  {request.destination.address}
                </Text>
               {routeData?.toDestination && (
               <Text style={styles.tripDistanceText}>
               {routeData.toDestination.distance.miles.toFixed(1)} mi ({routeData.toDestination.duration.minutes} min)
                </Text>
               )}
              </View>
            </View>
          </View>

          {/* Fare & Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                ${request.estimatedFare.toFixed(2)}
              </Text>
              <Text style={styles.statLabel}>Fare</Text>
            </View>
            {request.estimatedDistance && (
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {request.estimatedDistance.toFixed(1)} mi
                </Text>
                <Text style={styles.statLabel}>Trip Distance</Text>
              </View>
            )}
            {request.estimatedDuration && (
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {request.estimatedDuration} min
                </Text>
                <Text style={styles.statLabel}>Duration</Text>
              </View>
            )}
            {request.surgeMultiplier && request.surgeMultiplier > 1 && (
              <View style={styles.statItem}>
                <Text style={[styles.statValue, styles.surgeValue]}>
                  {request.surgeMultiplier.toFixed(1)}x
                </Text>
                <Text style={styles.statLabel}>Surge</Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.declineButton}
              onPress={handleDecline}
              activeOpacity={0.7}
            >
              <Text style={styles.declineButtonText}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.acceptButton}
              onPress={handleAccept}
              activeOpacity={0.7}
            >
              <Text style={styles.acceptButtonText}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
        </View>  
        </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
  progressBarUrgent: {
    backgroundColor: '#EF4444',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  countdownBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  countdownText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
  },
  countdownTextUrgent: {
    color: '#EF4444',
  },
  riderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  riderAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  riderInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
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
  routeContainer: {
    marginBottom: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 12,
  },
  pickupDot: {
    backgroundColor: '#10B981',
  },
  destinationDot: {
    backgroundColor: '#EF4444',
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
    lineHeight: 20,
  },
  distanceText: {
    fontSize: 13,
    color: '#10B981',
    marginTop: 4,
    fontWeight: '600',
  },
  tripDistanceText: {
    fontSize: 13,
    color: '#EF4444',
    marginTop: 4,
    fontWeight: '600',
  },
  connector: {
    width: 2,
    height: 24,
    backgroundColor: '#D1D5DB',
    marginLeft: 5,
    marginVertical: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  surgeValue: {
    color: '#F59E0B',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  declineButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  acceptButton: {
    flex: 2,
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default RideRequestModal;