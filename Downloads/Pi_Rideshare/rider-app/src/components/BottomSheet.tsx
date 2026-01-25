import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Calendar from 'expo-calendar';

import { useTheme } from '../context/ThemeContext';
import { apiUrl } from '../config/api.config';
import { StorageKeys } from '../constants';
import { SavedPlace } from '../types';
import { aiService, AISuggestion } from '../services/ai.service';
import { placesService } from '../services/places.service';

interface RecentPlace {
  id: string;
  icon: string;
  name: string;
  address: string;
  eta?: string;
  latitude: number;
  longitude: number;
}

interface BottomSheetProps {
  currentAddress: string;
  currentLocation: { latitude: number; longitude: number } | null;
  onSearchPress: () => void;
  onVoicePress: () => void;
  onQuickDestination: (destination: { latitude: number; longitude: number; address: string; name: string }) => void;
  onCalendarPress: () => void;
  onSetHomeWork?: (type: 'home' | 'work') => void;
}

const BottomSheet: React.FC<BottomSheetProps> = ({
  currentAddress,
  currentLocation,
  onSearchPress,
  onVoicePress,
  onQuickDestination,
  onCalendarPress,
  onSetHomeWork,
}) => {
  const { colors, isDark } = useTheme();

  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [recentPlaces, setRecentPlaces] = useState<RecentPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarEvents, setCalendarEvents] = useState<number>(0);
  const [calendarSynced, setCalendarSynced] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => {
    loadPlaces();
    checkCalendarSync();
  }, []);

  useEffect(() => {
    if (currentLocation) {
      loadAISuggestions();
    }
  }, [currentLocation]);

  const loadPlaces = async () => {
    try {
      setLoading(true);

      // Load saved places from AsyncStorage
      const savedData = await AsyncStorage.getItem(StorageKeys.SAVED_PLACES);
      if (savedData) {
        setSavedPlaces(JSON.parse(savedData));
      }

      // Fetch recent rides from backend
      const token = await AsyncStorage.getItem(StorageKeys.AUTH_TOKEN);
      if (token) {
        const response = await fetch(apiUrl('api/rides/history?limit=5'), {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          const places: RecentPlace[] = (data.rides || []).map((ride: any) => ({
            id: ride.id,
            icon: '📍',
            name: ride.destination_address?.split(',')[0] || 'Recent Destination',
            address: ride.destination_address || '',
            latitude: ride.destination_lat,
            longitude: ride.destination_lng,
          }));

          // Remove duplicates by address
          const uniquePlaces = places.filter(
            (place, index, self) =>
              index === self.findIndex((p) => p.address === place.address)
          );

          setRecentPlaces(uniquePlaces.slice(0, 3));
        }
      }
    } catch (error) {
      console.error('Error loading places:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkCalendarSync = async () => {
    try {
      const synced = await AsyncStorage.getItem(StorageKeys.CALENDAR_SYNC);
      if (synced === 'true') {
        setCalendarSynced(true);
        loadCalendarEvents();
      }
    } catch (error) {
      console.error('Error checking calendar sync:', error);
    }
  };

  const loadCalendarEvents = async () => {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status === 'granted') {
        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const now = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 1); // Next 24 hours

        let totalEvents = 0;
        for (const calendar of calendars) {
          const events = await Calendar.getEventsAsync(
            [calendar.id],
            now,
            endDate
          );
          totalEvents += events.filter(e => e.location).length;
        }
        setCalendarEvents(totalEvents);
      }
    } catch (error) {
      console.error('Error loading calendar events:', error);
    }
  };

  const loadAISuggestions = async () => {
    if (!currentLocation) return;
    
    try {
      setLoadingAI(true);
      
      // Get popular nearby places using Google Places API
      const categories = ['restaurant', 'coffee', 'shopping mall'];
      const allSuggestions: AISuggestion[] = [];
      
      for (const category of categories) {
        try {
          const results = await placesService.autocomplete(category, {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          });
          
          if (results && results.length > 0) {
            const topResult = results[0];
            const details = await placesService.getPlaceDetails(topResult.placeId);
            
            if (details) {
              allSuggestions.push({
                name: topResult.mainText,
                address: details.address,
                latitude: details.latitude,
                longitude: details.longitude,
                reason: getCategoryReason(category),
                confidence: 'high' as const,
              });
            }
          }
        } catch (err) {
          console.log(`Could not fetch ${category}:`, err);
        }
      }
      
      setAiSuggestions(allSuggestions.slice(0, 3));
    } catch (error) {
      console.error('Error loading suggestions:', error);
    } finally {
      setLoadingAI(false);
    }
  };

  const getCategoryReason = (category: string): string => {
    const hour = new Date().getHours();
    switch (category) {
      case 'restaurant':
        if (hour >= 11 && hour <= 14) return 'Lunchtime nearby';
        if (hour >= 17 && hour <= 21) return 'Dinner spot nearby';
        return 'Popular restaurant nearby';
      case 'coffee':
        if (hour >= 6 && hour <= 11) return 'Morning coffee run';
        return 'Nearby café';
      case 'shopping mall':
        return 'Shopping nearby';
      default:
        return 'Popular nearby';
    }
  };

  const handleCalendarSync = async () => {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      
      if (status === 'granted') {
        await AsyncStorage.setItem(StorageKeys.CALENDAR_SYNC, 'true');
        setCalendarSynced(true);
        await loadCalendarEvents();
        Alert.alert('Calendar Synced', 'Your calendar is now connected. We\'ll suggest rides based on your upcoming events.');
      } else {
        Alert.alert('Permission Required', 'Please allow calendar access to enable smart ride suggestions.');
      }
    } catch (error) {
      console.error('Calendar sync error:', error);
      Alert.alert('Error', 'Failed to sync calendar. Please try again.');
    }
  };

  const handleSetHomeWork = async (type: 'home' | 'work') => {
    if (onSetHomeWork) {
      onSetHomeWork(type);
    } else {
      Alert.alert(
        `Set ${type === 'home' ? 'Home' : 'Work'} Location`,
        'Search for your address to save it.',
        [{ text: 'OK' }]
      );
    }
  };

  // Calculate ETA
  const calculateETA = (destLat: number, destLng: number): string => {
    if (!currentLocation) return '';

    const R = 6371;
    const dLat = (destLat - currentLocation.latitude) * Math.PI / 180;
    const dLon = (destLng - currentLocation.longitude) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(currentLocation.latitude * Math.PI / 180) *
      Math.cos(destLat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    const timeMinutes = Math.round((distance / 30) * 60);
    return timeMinutes > 0 ? `${timeMinutes} min` : '< 1 min';
  };

  const getHomePlace = () => savedPlaces.find(p => p.label === 'home');
  const getWorkPlace = () => savedPlaces.find(p => p.label === 'work');

  const handleQuickDestPress = (place: SavedPlace | RecentPlace | null | undefined, type?: string) => {
    if (type === 'calendar') {
      if (calendarSynced) {
        onCalendarPress();
      } else {
        handleCalendarSync();
      }
      return;
    }

    if (type === 'home' && !getHomePlace()) {
      handleSetHomeWork('home');
      return;
    }

    if (type === 'work' && !getWorkPlace()) {
      handleSetHomeWork('work');
      return;
    }

    if (!place) return;

    if ('latitude' in place && 'longitude' in place) {
      const recentPlace = place as RecentPlace;
      onQuickDestination({
        latitude: recentPlace.latitude,
        longitude: recentPlace.longitude,
        address: recentPlace.address,
        name: recentPlace.name,
      });
    } else if ('location' in place) {
      const savedPlace = place as SavedPlace;
      onQuickDestination({
        latitude: savedPlace.location.latitude,
        longitude: savedPlace.location.longitude,
        address: savedPlace.location.address || '',
        name: savedPlace.name,
      });
    }
  };

  const homePlace = getHomePlace();
  const workPlace = getWorkPlace();

  const quickDestinations = [
    {
      id: 'home',
      icon: '🏠',
      label: 'Home',
      time: homePlace && currentLocation
        ? calculateETA(homePlace.location.latitude, homePlace.location.longitude)
        : 'Set location',
      place: homePlace,
      isSet: !!homePlace,
    },
    {
      id: 'work',
      icon: '💼',
      label: 'Work',
      time: workPlace && currentLocation
        ? calculateETA(workPlace.location.latitude, workPlace.location.longitude)
        : 'Set location',
      place: workPlace,
      isSet: !!workPlace,
    },
    {
      id: 'calendar',
      icon: '📅',
      label: 'Calendar',
      time: calendarSynced 
        ? (calendarEvents > 0 ? `${calendarEvents} events` : 'No events')
        : 'Sync',
      place: null,
      isSet: calendarSynced,
    },
  ];

  const styles = StyleSheet.create({
    container: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.bottomSheet,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 30,
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
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      gap: 10,
    },
    searchCard: {
      flex: 1,
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    searchText: {
      flex: 1,
      fontSize: 15,
      color: isDark ? '#ffffff' : '#1e293b',
      fontWeight: '500',
    },
    voiceSearchButton: {
      width: 36,
      height: 36,
      backgroundColor: colors.primary,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    voiceSearchIcon: {
      fontSize: 16,
    },
    quickDestinations: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 20,
    },
    quickDest: {
      flex: 1,
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.inputBorder,
    },
    quickDestNotSet: {
      borderStyle: 'dashed',
    },
    quickDestIcon: {
      fontSize: 24,
      marginBottom: 4,
    },
    quickDestLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    quickDestTime: {
      fontSize: 11,
      color: colors.primary,
      fontWeight: '600',
    },
    quickDestTimeNotSet: {
      color: colors.textMuted,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginLeft: 8,
    },
    recentItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    recentIcon: {
      width: 40,
      height: 40,
      backgroundColor: colors.inputBackground,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    recentIconText: {
      fontSize: 16,
    },
    recentInfo: {
      flex: 1,
    },
    recentName: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 2,
    },
    recentAddress: {
      fontSize: 12,
      color: colors.textMuted,
    },
    recentEta: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.primary,
    },
    emptyState: {
      paddingVertical: 20,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 13,
      color: colors.textMuted,
    },
    loadingContainer: {
      paddingVertical: 20,
      alignItems: 'center',
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.handle} />

      {/* Search Bar */}
      <View style={styles.searchRow}>
        <TouchableOpacity style={styles.searchCard} onPress={onSearchPress}>
          <Text style={styles.searchText}>Where to?</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.voiceSearchButton} onPress={onVoicePress}>
          <Text style={styles.voiceSearchIcon}>🎤</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Destinations */}
      <View style={styles.quickDestinations}>
        {quickDestinations.map((dest) => (
          <TouchableOpacity
            key={dest.id}
            style={[
              styles.quickDest,
              !dest.isSet && styles.quickDestNotSet,
            ]}
            onPress={() => handleQuickDestPress(dest.place, dest.id)}
          >
            <Text style={styles.quickDestIcon}>{dest.icon}</Text>
            <Text style={styles.quickDestLabel}>{dest.label}</Text>
            <Text style={[
              styles.quickDestTime,
              !dest.isSet && styles.quickDestTimeNotSet,
            ]}>
              {dest.time}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* AI Smart Suggestions */}
      <View style={styles.sectionHeader}>
        <Text>🧠</Text>
        <Text style={styles.sectionTitle}>Suggested for You</Text>
      </View>

      {loadingAI || loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : aiSuggestions.length > 0 ? (
        aiSuggestions.map((suggestion, index) => (
          <TouchableOpacity
            key={index}
            style={styles.recentItem}
            onPress={() => onQuickDestination({
              latitude: suggestion.latitude,
              longitude: suggestion.longitude,
              address: suggestion.address,
              name: suggestion.name,
            })}
          >
            <View style={[styles.recentIcon, { backgroundColor: suggestion.confidence === 'high' ? `${colors.primary}20` : colors.inputBackground }]}>
              <Text style={styles.recentIconText}>
                {suggestion.confidence === 'high' ? '⭐' : suggestion.confidence === 'medium' ? '📍' : '🔮'}
              </Text>
            </View>
            <View style={styles.recentInfo}>
              <Text style={styles.recentName}>{suggestion.name}</Text>
              <Text style={styles.recentAddress} numberOfLines={1}>{suggestion.reason}</Text>
            </View>
            {currentLocation && (
              <Text style={styles.recentEta}>
                {calculateETA(suggestion.latitude, suggestion.longitude)}
              </Text>
            )}
          </TouchableOpacity>
        ))
      ) : recentPlaces.length > 0 ? (
        // Fallback to recent places if no AI suggestions
        recentPlaces.map((place) => (
          <TouchableOpacity
            key={place.id}
            style={styles.recentItem}
            onPress={() => handleQuickDestPress(place)}
          >
            <View style={styles.recentIcon}>
              <Text style={styles.recentIconText}>{place.icon}</Text>
            </View>
            <View style={styles.recentInfo}>
              <Text style={styles.recentName}>{place.name}</Text>
              <Text style={styles.recentAddress} numberOfLines={1}>{place.address}</Text>
            </View>
            {currentLocation && (
              <Text style={styles.recentEta}>
                {calculateETA(place.latitude, place.longitude)}
              </Text>
            )}
          </TouchableOpacity>
        ))
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Take a ride to get personalized suggestions</Text>
        </View>
      )}
    </View>
  );
};

export default BottomSheet;