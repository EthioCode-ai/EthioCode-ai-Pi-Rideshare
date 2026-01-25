import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Calendar from 'expo-calendar';
import * as Location from 'expo-location';

import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { placesService } from '../services/places.service';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CalendarEvents'>;

interface CalendarEvent {
  id: string;
  title: string;
  location: string;
  startDate: Date;
  endDate: Date;
  calendarName: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

const CalendarEventsScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const { colors, isDark } = useTheme();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState<string | null>(null);

  useEffect(() => {
    loadCalendarEvents();
  }, []);

  const loadCalendarEvents = async () => {
    try {
      setLoading(true);
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow calendar access to see your events.');
        navigation.goBack();
        return;
      }

      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const now = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7); // Next 7 days

      const allEvents: CalendarEvent[] = [];

      for (const calendar of calendars) {
        const calEvents = await Calendar.getEventsAsync([calendar.id], now, endDate);
        
        for (const event of calEvents) {
          if (event.location && event.location.trim() !== '') {
            allEvents.push({
              id: event.id,
              title: event.title,
              location: event.location,
              startDate: new Date(event.startDate),
              endDate: new Date(event.endDate),
              calendarName: calendar.title,
            });
          }
        }
      }

      // Sort by start date
      allEvents.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
      setEvents(allEvents);
    } catch (error) {
      console.error('Error loading calendar events:', error);
      Alert.alert('Error', 'Failed to load calendar events.');
    } finally {
      setLoading(false);
    }
  };

  const geocodeLocation = async (address: string): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      // Try using places service first
      const predictions = await placesService.autocomplete(address);
      if (predictions && predictions.length > 0) {
        const details = await placesService.getPlaceDetails(predictions[0].placeId);
        if (details) {
          return { latitude: details.latitude, longitude: details.longitude };
        }
      }
      
      // Fallback to expo-location geocoding
      const results = await Location.geocodeAsync(address);
      if (results && results.length > 0) {
        return { latitude: results[0].latitude, longitude: results[0].longitude };
      }
      
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  };

  const handleEventPress = async (event: CalendarEvent) => {
    setGeocoding(event.id);
    
    try {
      const coords = await geocodeLocation(event.location);
      
      if (coords) {
        // Get current location for pickup
        const { status } = await Location.requestForegroundPermissionsAsync();
        let pickup = { latitude: 36.3729, longitude: -94.2088, address: 'Current Location' };
        
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          const address = await Location.reverseGeocodeAsync({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
          
          pickup = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            address: address[0] ? `${address[0].street || ''} ${address[0].city || ''}`.trim() : 'Current Location',
          };
        }

        // Calculate suggested departure time (arrive 15 min early)
        const arriveBy = new Date(event.startDate.getTime() - 15 * 60 * 1000);
        
        navigation.navigate('RideConfirm', {
          pickup,
          destination: {
            latitude: coords.latitude,
            longitude: coords.longitude,
            address: event.location,
          },
          scheduledTime: arriveBy.toISOString(),
        });
      } else {
        Alert.alert(
          'Location Not Found',
          `Could not find coordinates for "${event.location}". Would you like to search manually?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Search', 
              onPress: () => navigation.navigate('DestinationSearch', {})
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error processing event:', error);
      Alert.alert('Error', 'Failed to process event location.');
    } finally {
      setGeocoding(null);
    }
  };

  const formatEventTime = (date: Date): string => {
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

  const getTimeUntil = (date: Date): string => {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours < 0) return 'Started';
    if (diffHours === 0) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h ${diffMins}m`;
    const days = Math.floor(diffHours / 24);
    return `${days}d`;
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
    },
    backButton: {
      padding: 8,
      marginRight: 12,
    },
    backText: {
      fontSize: 36,
      color: isDark ? '#FFFFFF' : '#1a1a2e',
      fontWeight: '300',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#1a1a2e',
    },
    headerSubtitle: {
      fontSize: 13,
      color: isDark ? '#888888' : '#666666',
      marginTop: 2,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    listContent: {
      padding: 16,
    },
    eventCard: {
      backgroundColor: isDark ? '#1a1a2e' : '#FFFFFF',
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
    },
    eventHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 10,
    },
    eventTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#1a1a2e',
      flex: 1,
      marginRight: 10,
    },
    timeBadge: {
      backgroundColor: isDark ? '#E67E22' : '#2563eb',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    timeBadgeText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    eventTime: {
      fontSize: 14,
      color: isDark ? '#E67E22' : '#2563eb',
      fontWeight: '600',
      marginBottom: 8,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    locationIcon: {
      fontSize: 16,
      marginRight: 8,
      marginTop: 2,
    },
    eventLocation: {
      fontSize: 14,
      color: isDark ? '#B0B0B0' : '#666666',
      flex: 1,
    },
    calendarName: {
      fontSize: 12,
      color: isDark ? '#666666' : '#999999',
      marginTop: 10,
    },
    bookButton: {
      backgroundColor: isDark ? '#E67E22' : '#2563eb',
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 12,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    bookButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    emptyIcon: {
      fontSize: 64,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#1a1a2e',
      textAlign: 'center',
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 14,
      color: isDark ? '#888888' : '#666666',
      textAlign: 'center',
      lineHeight: 20,
    },
    infoBox: {
      backgroundColor: isDark ? 'rgba(230, 126, 34, 0.15)' : 'rgba(37, 99, 235, 0.1)',
      borderRadius: 12,
      padding: 16,
      margin: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(230, 126, 34, 0.3)' : 'rgba(37, 99, 235, 0.2)',
    },
    infoText: {
      fontSize: 13,
      color: isDark ? '#E67E22' : '#2563eb',
      lineHeight: 18,
    },
  });

  const renderEvent = ({ item }: { item: CalendarEvent }) => (
    <View style={styles.eventCard}>
      <View style={styles.eventHeader}>
        <Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>
        <View style={styles.timeBadge}>
          <Text style={styles.timeBadgeText}>{getTimeUntil(item.startDate)}</Text>
        </View>
      </View>
      
      <Text style={styles.eventTime}>{formatEventTime(item.startDate)}</Text>
      
      <View style={styles.locationRow}>
        <Text style={styles.locationIcon}>📍</Text>
        <Text style={styles.eventLocation} numberOfLines={2}>{item.location}</Text>
      </View>
      
      <Text style={styles.calendarName}>📅 {item.calendarName}</Text>
      
      <TouchableOpacity 
        style={styles.bookButton} 
        onPress={() => handleEventPress(item)}
        disabled={geocoding === item.id}
      >
        {geocoding === item.id ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <Text style={styles.bookButtonText}>🚗</Text>
            <Text style={styles.bookButtonText}>Book Ride to Event</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Calendar Events</Text>
          <Text style={styles.headerSubtitle}>Events with locations (next 7 days)</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDark ? '#E67E22' : '#2563eb'} />
        </View>
      ) : events.length > 0 ? (
        <>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              💡 Tap "Book Ride" to schedule a ride arriving 15 minutes before your event starts.
            </Text>
          </View>
          <FlatList
            data={events}
            keyExtractor={(item) => item.id}
            renderItem={renderEvent}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        </>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={styles.emptyTitle}>No Events with Locations</Text>
          <Text style={styles.emptyText}>
            Add locations to your calendar events and they'll appear here for easy ride booking.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

export default CalendarEventsScreen;