import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';

interface ScheduledRide {
  id: string;
  pickupAddress: string;
  destinationAddress: string;
  scheduledTime: string;
  vehicleType: string;
  fare: number;
  driver?: {
    name: string;
    rating: number;
    vehicle: string;
    licensePlate: string;
  } | null;
}

interface ScheduledRidesProps {
  onRidePress: (ride: ScheduledRide) => void;
  refreshTrigger?: number;
}

const ScheduledRides: React.FC<ScheduledRidesProps> = ({ onRidePress, refreshTrigger }) => {
  const { colors, isDark } = useTheme();
  const [scheduledRides, setScheduledRides] = useState<ScheduledRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    loadScheduledRides();
  }, [refreshTrigger]);

  const loadScheduledRides = async () => {
    setLoading(true);
    try {
      const data = await AsyncStorage.getItem('scheduledRides');
      if (data) {
        const rides: ScheduledRide[] = JSON.parse(data);
        // Filter out past rides
        const upcoming = rides.filter((ride) => 
          new Date(ride.scheduledTime) > new Date()
        );
        // Save filtered list back
        if (upcoming.length !== rides.length) {
          await AsyncStorage.setItem('scheduledRides', JSON.stringify(upcoming));
        }
        setScheduledRides(upcoming);
      } else {
        setScheduledRides([]);
      }
    } catch (error) {
      console.error('Error loading scheduled rides:', error);
      setScheduledRides([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRide = (ride: ScheduledRide) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Alert.alert(
      'Cancel Scheduled Ride',
      `Are you sure you want to cancel your ride scheduled for ${formatDateTime(ride.scheduledTime)}?`,
      [
        {
          text: 'Keep Ride',
          style: 'cancel',
        },
        {
          text: 'Cancel Ride',
          style: 'destructive',
          onPress: () => confirmCancelRide(ride.id),
        },
      ]
    );
  };

  const confirmCancelRide = async (rideId: string) => {
    setCancellingId(rideId);
    try {
      const data = await AsyncStorage.getItem('scheduledRides');
      if (data) {
        const rides: ScheduledRide[] = JSON.parse(data);
        const updatedRides = rides.filter((r) => r.id !== rideId);
        await AsyncStorage.setItem('scheduledRides', JSON.stringify(updatedRides));
        setScheduledRides(updatedRides);
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Ride Cancelled', 'Your scheduled ride has been cancelled.');
      }
    } catch (error) {
      console.error('Error cancelling ride:', error);
      Alert.alert('Error', 'Failed to cancel ride. Please try again.');
    } finally {
      setCancellingId(null);
    }
  };

  const formatDateTime = (dateStr: string): string => {
    const date = new Date(dateStr);
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

  if (loading) {
    return null;
  }

  if (scheduledRides.length === 0) {
    return null;
  }

  const styles = StyleSheet.create({
    container: {
      position: 'absolute',
      top: 110,
      left: 15,
      right: 15,
      zIndex: 10,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 2,
      borderColor: colors.primary,
      marginBottom: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 8,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: `${colors.primary}20`,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    dateTime: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
    },
    routeContainer: {
      marginBottom: 12,
    },
    routeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    routeDot: {
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
      height: 16,
      backgroundColor: colors.cardBorder,
      marginLeft: 4,
      marginVertical: 2,
    },
    routeText: {
      flex: 1,
      fontSize: 13,
      color: colors.text,
    },
    driverSection: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
    },
    driverAvatar: {
      width: 40,
      height: 40,
      backgroundColor: colors.inputBackground,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 10,
    },
    driverAvatarText: {
      fontSize: 20,
    },
    driverInfo: {
      flex: 1,
    },
    driverName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    driverVehicle: {
      fontSize: 12,
      color: colors.textMuted,
    },
    fareContainer: {
      alignItems: 'flex-end',
    },
    fareLabel: {
      fontSize: 10,
      color: colors.textMuted,
    },
    fareAmount: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.primary,
    },
    pendingDriver: {
      flex: 1,
    },
    pendingDriverRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    pendingDriverText: {
      fontSize: 13,
      color: colors.textMuted,
    },
    actionsContainer: {
      flexDirection: 'row',
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.cardBorder,
      gap: 10,
    },
    detailsButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.inputBackground,
      paddingVertical: 12,
      borderRadius: 10,
      gap: 6,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    detailsButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    cancelButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#ef444420',
      paddingVertical: 12,
      borderRadius: 10,
      gap: 6,
      borderWidth: 1,
      borderColor: '#ef4444',
    },
    cancelButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#ef4444',
    },
  });

  return (
    <View style={styles.container}>
      {scheduledRides.map((ride) => (
        <View key={ride.id} style={styles.card}>
          <View style={styles.header}>
            <View style={styles.badge}>
              <Text>📅</Text>
              <Text style={styles.badgeText}>Scheduled</Text>
            </View>
            <Text style={styles.dateTime}>{formatDateTime(ride.scheduledTime)}</Text>
          </View>

          <View style={styles.routeContainer}>
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, styles.dotPickup]} />
              <Text style={styles.routeText} numberOfLines={1}>{ride.pickupAddress}</Text>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, styles.dotDest]} />
              <Text style={styles.routeText} numberOfLines={1}>{ride.destinationAddress}</Text>
            </View>
          </View>

          <View style={styles.driverSection}>
            {ride.driver ? (
              <>
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverAvatarText}>👤</Text>
                </View>
                <View style={styles.driverInfo}>
                  <Text style={styles.driverName}>{ride.driver.name}</Text>
                  <Text style={styles.driverVehicle}>
                    {ride.driver.vehicle} • {ride.driver.licensePlate}
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.pendingDriver}>
                <View style={styles.pendingDriverRow}>
                  <Text>🔍</Text>
                  <Text style={styles.pendingDriverText}>Finding driver...</Text>
                </View>
              </View>
            )}
            <View style={styles.fareContainer}>
              <Text style={styles.fareLabel}>{ride.driver ? 'FARE' : 'EST. FARE'}</Text>
              <Text style={styles.fareAmount}>${ride.fare.toFixed(2)}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.detailsButton}
              onPress={() => onRidePress(ride)}
            >
              <Text>📋</Text>
              <Text style={styles.detailsButtonText}>Details</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => handleCancelRide(ride)}
              disabled={cancellingId === ride.id}
            >
              {cancellingId === ride.id ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <>
                  <Text>✕</Text>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
};

export default ScheduledRides;