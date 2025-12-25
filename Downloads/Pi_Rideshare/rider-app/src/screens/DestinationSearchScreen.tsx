import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { debounce } from 'lodash';

import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { placesService, PlacePrediction } from '../services/places.service';
import { locationService } from '../services/location.service';
import { StorageKeys } from '../constants';
import { SavedPlace } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'DestinationSearch'>;
type RouteProps = RouteProp<RootStackParamList, 'DestinationSearch'>;

type ActiveField = 'pickup' | 'destination';

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
}

const DestinationSearchScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { colors, isDark } = useTheme();

  const initialPickup = route.params?.pickup;
  const selectedLocation = route.params?.selectedLocation;
  const selectedField = route.params?.field;

  // Location states
  const [pickup, setPickup] = useState<LocationData | null>(initialPickup || null);
  const [destination, setDestination] = useState<LocationData | null>(null);

  // Input text states
  const [pickupText, setPickupText] = useState(initialPickup?.address || '');
  const [destinationText, setDestinationText] = useState('');

  // UI states
  const [activeField, setActiveField] = useState<ActiveField>('destination');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [gettingCurrentLocation, setGettingCurrentLocation] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);

  // Handle returned location from MapPickerScreen
  useEffect(() => {
    if (selectedLocation && selectedField) {
      if (selectedField === 'pickup') {
        setPickup(selectedLocation);
        setPickupText(selectedLocation.address);
        setActiveField('destination');
      } else if (selectedField === 'destination') {
        setDestination(selectedLocation);
        setDestinationText(selectedLocation.address);
      }
    }
  }, [selectedLocation, selectedField]);

  // Auto-navigate when both pickup and destination are set
  useEffect(() => {
    if (pickup && destination) {
      // Small delay to show the user both fields are filled
      const timer = setTimeout(() => {
        navigateToRideConfirm();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [pickup, destination]);

  const navigateToRideConfirm = () => {
    if (pickup && destination) {
      navigation.navigate('RideConfirm', {
        pickup,
        destination,
      });
    }
  };

  useEffect(() => {
    loadSavedPlaces();
    if (!initialPickup) {
      getCurrentLocation();
    }
  }, []);

  const loadSavedPlaces = async () => {
    try {
      const data = await AsyncStorage.getItem(StorageKeys.SAVED_PLACES);
      if (data) {
        setSavedPlaces(JSON.parse(data));
      }
    } catch (error) {
      console.error('Error loading saved places:', error);
    }
  };

  const getCurrentLocation = async () => {
    setGettingCurrentLocation(true);
    try {
      const location = await locationService.getCurrentLocation();
      if (location) {
        const address = await locationService.getAddressFromCoordinates(
          location.latitude,
          location.longitude
        );
        setPickup({
          latitude: location.latitude,
          longitude: location.longitude,
          address,
        });
        setPickupText(address);
      }
    } catch (error) {
      console.error('Error getting current location:', error);
    } finally {
      setGettingCurrentLocation(false);
    }
  };

  // Debounced search function
  const searchPlaces = useCallback(
    debounce(async (text: string, field: ActiveField) => {
      if (text.length < 2) {
        setPredictions([]);
        setLoading(false);
        return;
      }

      try {
        const results = await placesService.autocomplete(text, pickup ? {
          latitude: pickup.latitude,
          longitude: pickup.longitude,
        } : undefined);
        setPredictions(results);
      } catch (error) {
        console.error('Search error:', error);
        setPredictions([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    [pickup]
  );

  const handlePickupChange = (text: string) => {
    setPickupText(text);
    setPickup(null); // Clear pickup when editing
    setActiveField('pickup');
    setLoading(true);
    searchPlaces(text, 'pickup');
  };

  const handleDestinationChange = (text: string) => {
    setDestinationText(text);
    setDestination(null); // Clear destination when editing
    setActiveField('destination');
    setLoading(true);
    searchPlaces(text, 'destination');
  };

  const handleSelectPrediction = async (prediction: PlacePrediction) => {
    Keyboard.dismiss();
    setLoading(true);

    try {
      const details = await placesService.getPlaceDetails(prediction.placeId);

      if (details) {
        const locationData: LocationData = {
          latitude: details.latitude,
          longitude: details.longitude,
          address: details.address,
        };

        if (activeField === 'pickup') {
          setPickup(locationData);
          setPickupText(prediction.mainText);
          setPredictions([]);
          setActiveField('destination');
        } else {
          setDestination(locationData);
          setDestinationText(prediction.mainText);
          setPredictions([]);
        }
      }
    } catch (error) {
      console.error('Error getting place details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    setActiveField('pickup');
    await getCurrentLocation();
    setPredictions([]);
  };

  const handlePickOnMap = () => {
    navigation.navigate('MapPicker', {
      field: activeField,
      currentLocation: activeField === 'pickup' ? pickup || undefined : destination || undefined,
    });
  };

  const handleSavedPlacePress = (place: SavedPlace) => {
    const locationData: LocationData = {
      latitude: place.location.latitude,
      longitude: place.location.longitude,
      address: place.location.address || place.name,
    };

    if (activeField === 'pickup') {
      setPickup(locationData);
      setPickupText(place.name);
      setActiveField('destination');
    } else {
      setDestination(locationData);
      setDestinationText(place.name);
    }
  };

  const canConfirm = pickup && destination;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    closeButton: {
      marginBottom: 20,
    },
    closeText: {
      fontSize: 24,
      color: colors.text,
    },
    inputsContainer: {
      gap: 12,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    dotsContainer: {
      alignItems: 'center',
      paddingVertical: 4,
    },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    dotPickup: {
      backgroundColor: colors.primary,
    },
    dotDest: {
      backgroundColor: colors.secondary,
    },
    dotLine: {
      width: 2,
      height: 20,
      backgroundColor: colors.cardBorder,
      marginVertical: 4,
    },
    inputsRight: {
      flex: 1,
      gap: 8,
    },
    input: {
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      padding: 14,
      fontSize: 15,
      color: colors.text,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    inputActive: {
      borderColor: colors.primary,
    },
    inputFilled: {
      borderColor: colors.secondary,
    },
    inputLoading: {
      opacity: 0.7,
    },
    quickActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 16,
    },
    quickAction: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.inputBackground,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    quickActionText: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '600',
    },
    confirmButton: {
      backgroundColor: colors.primary,
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 16,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    confirmButtonDisabled: {
      opacity: 0.5,
    },
    confirmButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? '#0d0d1a' : '#ffffff',
    },
    savedPlacesContainer: {
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    savedPlacesTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 12,
      textTransform: 'uppercase',
    },
    savedPlaceRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
    },
    savedPlaceButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      gap: 10,
    },
    savedPlaceIcon: {
      fontSize: 20,
    },
    savedPlaceInfo: {
      flex: 1,
    },
    savedPlaceLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    savedPlaceAddress: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    resultsList: {
      flex: 1,
    },
    resultsContent: {
      padding: 10,
    },
    resultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    resultIcon: {
      width: 44,
      height: 44,
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 14,
    },
    resultIconText: {
      fontSize: 20,
    },
    resultInfo: {
      flex: 1,
    },
    resultMain: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 3,
    },
    resultSecondary: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    loadingContainer: {
      padding: 30,
      alignItems: 'center',
    },
    emptyContainer: {
      padding: 40,
      alignItems: 'center',
    },
    emptyIcon: {
      fontSize: 48,
      marginBottom: 12,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
    },
    activeFieldLabel: {
      fontSize: 12,
      color: colors.primary,
      marginBottom: 8,
      fontWeight: '600',
    },
    poweredBy: {
      padding: 10,
      alignItems: 'center',
    },
    poweredByText: {
      fontSize: 11,
      color: colors.textMuted,
    },
    readyBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${colors.secondary}20`,
      paddingVertical: 12,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.secondary,
    },
    readyBannerText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.secondary,
    },
  });

  const renderPrediction = ({ item }: { item: PlacePrediction }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleSelectPrediction(item)}
    >
      <View style={styles.resultIcon}>
        <Text style={styles.resultIconText}>📍</Text>
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultMain} numberOfLines={1}>{item.mainText}</Text>
        <Text style={styles.resultSecondary} numberOfLines={1}>{item.secondaryText}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Ready Banner */}
      {canConfirm && (
        <View style={styles.readyBanner}>
          <Text>✓</Text>
          <Text style={styles.readyBannerText}>Both locations selected!</Text>
        </View>
      )}

      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
          <Text style={styles.closeText}>←</Text>
        </TouchableOpacity>

        <View style={styles.inputsContainer}>
          <View style={styles.inputRow}>
            <View style={styles.dotsContainer}>
              <View style={[styles.dot, styles.dotPickup]} />
              <View style={styles.dotLine} />
              <View style={[styles.dot, styles.dotDest]} />
            </View>

            <View style={styles.inputsRight}>
              <TextInput
                style={[
                  styles.input,
                  activeField === 'pickup' && styles.inputActive,
                  pickup && activeField !== 'pickup' && styles.inputFilled,
                  gettingCurrentLocation && styles.inputLoading,
                ]}
                placeholder={gettingCurrentLocation ? "Getting location..." : "Pickup location"}
                placeholderTextColor={colors.textMuted}
                value={pickupText}
                onChangeText={handlePickupChange}
                onFocus={() => setActiveField('pickup')}
                editable={!gettingCurrentLocation}
              />

              <TextInput
                style={[
                  styles.input,
                  activeField === 'destination' && styles.inputActive,
                  destination && activeField !== 'destination' && styles.inputFilled,
                ]}
                placeholder="Where to?"
                placeholderTextColor={colors.textMuted}
                value={destinationText}
                onChangeText={handleDestinationChange}
                onFocus={() => setActiveField('destination')}
                autoFocus={!!initialPickup && !selectedLocation}
              />
            </View>
          </View>

          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.quickAction} onPress={handleUseCurrentLocation}>
              <Text>📍</Text>
              <Text style={styles.quickActionText}>Current Location</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickAction} onPress={handlePickOnMap}>
              <Text>🗺️</Text>
              <Text style={styles.quickActionText}>Pick on Map</Text>
            </TouchableOpacity>
          </View>

          {/* Confirm Button - Always visible when both locations are set */}
          <TouchableOpacity
            style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
            onPress={navigateToRideConfirm}
            disabled={!canConfirm}
          >
            <Text style={styles.confirmButtonText}>🚗</Text>
            <Text style={styles.confirmButtonText}>Continue to Ride Options</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Saved Places - Only show when not both selected */}
      {savedPlaces.length > 0 && predictions.length === 0 && !canConfirm && (
        <View style={styles.savedPlacesContainer}>
          <Text style={styles.savedPlacesTitle}>Saved Places</Text>
          <View style={styles.savedPlaceRow}>
            {savedPlaces.map((place) => (
              <TouchableOpacity
                key={place.id}
                style={styles.savedPlaceButton}
                onPress={() => handleSavedPlacePress(place)}
              >
                <Text style={styles.savedPlaceIcon}>{place.icon}</Text>
                <View style={styles.savedPlaceInfo}>
                  <Text style={styles.savedPlaceLabel}>
                    {place.label === 'home' ? 'Home' : 'Work'}
                  </Text>
                  <Text style={styles.savedPlaceAddress} numberOfLines={1}>
                    {place.name}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {!canConfirm && activeField && (
        <Text style={[styles.activeFieldLabel, { paddingHorizontal: 20, paddingTop: savedPlaces.length > 0 && predictions.length === 0 ? 0 : 16 }]}>
          {activeField === 'pickup' ? 'Select pickup location' : 'Select destination'}
        </Text>
      )}

      {loading && predictions.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={predictions}
          keyExtractor={(item) => item.placeId}
          renderItem={renderPrediction}
          style={styles.resultsList}
          contentContainerStyle={styles.resultsContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            !canConfirm && (pickupText.length > 2 || destinationText.length > 2) && !loading ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyText}>No results found</Text>
              </View>
            ) : !canConfirm && savedPlaces.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>✈️</Text>
                <Text style={styles.emptyText}>
                  Search for an address, airport,{'\n'}business, or landmark
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            predictions.length > 0 ? (
              <View style={styles.poweredBy}>
                <Text style={styles.poweredByText}>Powered by Google</Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
};

export default DestinationSearchScreen;