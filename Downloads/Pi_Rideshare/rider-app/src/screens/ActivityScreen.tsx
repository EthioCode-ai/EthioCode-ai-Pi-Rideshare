import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import API_BASE_URL from '../config/api.config';

interface Trip {
  id: string;
  date: string;
  from: string;
  to: string;
  fare: string;
  rideType: string;
  status: string;
}

const ActivityScreen = () => {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTrips = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/users/trips?limit=50`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setTrips(data.trips || []);
      }
    } catch (error) {
      console.log('Could not fetch trips:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTrips();
  }, []);

  const getRideTypeIcon = (rideType: string) => {
    switch (rideType?.toLowerCase()) {
      case 'premium':
      case 'vip':
        return '🌟';
      case 'xl':
        return '🚐';
      case 'economy':
        return '💰';
      default:
        return '🚗';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#10B981';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#F59E0B';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  const handleTripPress = (trip: Trip) => {
    // Could navigate to trip details screen in the future
    console.log('Trip pressed:', trip.id);
  };

  const renderTripItem = ({ item }: { item: Trip }) => (
    <TouchableOpacity 
      style={styles.tripCard} 
      onPress={() => handleTripPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.tripHeader}>
        <View style={styles.tripDateContainer}>
          <Text style={styles.tripIcon}>{getRideTypeIcon(item.rideType)}</Text>
          <Text style={styles.tripDate}>{item.date}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusText(item.status)}
          </Text>
        </View>
      </View>
      
      <View style={styles.tripRoute}>
        <View style={styles.routePoint}>
          <View style={[styles.routeDot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.routeAddress} numberOfLines={1}>{item.from}</Text>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.routePoint}>
          <View style={[styles.routeDot, { backgroundColor: '#EF4444' }]} />
          <Text style={styles.routeAddress} numberOfLines={1}>{item.to}</Text>
        </View>
      </View>
      
      <View style={styles.tripFooter}>
        <Text style={styles.rideType}>{item.rideType || 'Standard'}</Text>
        <Text style={styles.tripFare}>{item.fare}</Text>
      </View>
    </TouchableOpacity>
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      padding: 20,
      paddingTop: 20,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: isDark ? '#FFFFFF' : '#1a1a2e',
    },
    subtitle: {
      fontSize: 14,
      color: isDark ? '#888888' : '#666666',
      marginTop: 4,
    },
    listContent: {
      padding: 16,
      paddingBottom: 100,
    },
    tripCard: {
      backgroundColor: isDark ? '#1a1a2e' : '#FFFFFF',
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 3,
    },
    tripHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    tripDateContainer: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    tripIcon: {
      fontSize: 18,
      marginRight: 8,
    },
    tripDate: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#B0B0B0' : '#666666',
    },
    statusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '700',
    },
    tripRoute: {
      marginBottom: 14,
    },
    routePoint: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    routeDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 12,
    },
    routeLine: {
      width: 2,
      height: 20,
      backgroundColor: isDark ? '#333333' : '#E5E7EB',
      marginLeft: 4,
      marginVertical: 4,
    },
    routeAddress: {
      fontSize: 15,
      fontWeight: '500',
      color: isDark ? '#FFFFFF' : '#1a1a2e',
      flex: 1,
    },
    tripFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    rideType: {
      fontSize: 13,
      fontWeight: '600',
      color: '#E67E22',
      textTransform: 'uppercase',
    },
    tripFare: {
      fontSize: 18,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#1a1a2e',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    emptyIcon: {
      fontSize: 64,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#1a1a2e',
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 15,
      color: isDark ? '#888888' : '#666666',
      textAlign: 'center',
      lineHeight: 22,
    },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Activity</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E67E22" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
        {trips.length > 0 && (
          <Text style={styles.subtitle}>{trips.length} ride{trips.length !== 1 ? 's' : ''}</Text>
        )}
      </View>
      
      {trips.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🚗</Text>
          <Text style={styles.emptyTitle}>No rides yet</Text>
          <Text style={styles.emptyText}>
            Your ride history will appear here once you complete your first trip.
          </Text>
        </View>
      ) : (
        <FlatList
          data={trips}
          renderItem={renderTripItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#E67E22"
              colors={['#E67E22']}
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

export default ActivityScreen;