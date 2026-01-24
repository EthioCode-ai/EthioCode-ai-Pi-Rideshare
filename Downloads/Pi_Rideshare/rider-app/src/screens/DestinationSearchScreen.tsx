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
  LayoutAnimation,
  Platform,
  UIManager,
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

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'DestinationSearch'>;
type RouteProps = RouteProp<RootStackParamList, 'DestinationSearch'>;

type ActiveField = 'pickup' | 'destination' | 'stop';

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
  const [stop, setStop] = useState<LocationData | null>(null);

  // Input text states
  const [pickupText, setPickupText] = useState(initialPickup?.address || '');
  const [destinationText, setDestinationText] = useState('');
  const [stopText, setStopText] = useState('');

  // UI states
  const [activeField, setActiveField] = useState<ActiveField>('destination');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [gettingCurrentLocation, setGettingCurrentLocation] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [showAddStop, setShowAddStop] = useState(false);

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
        // Pass stop as part of navigation params if needed
        // stops: stop ? [stop] : [],
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
    setPickup(null);
    setActiveField('pickup');
    setLoading(true);
    searchPlaces(text, 'pickup');
  };

  const handleDestinationChange = (text: string) => {
    setDestinationText(text);
    setDestination(null);
    setActiveField('destination');
    setLoading(true);
    searchPlaces(text, 'destination');
  };

  const handleStopChange = (text: string) => {
    setStopText(text);
    setStop(null);
    setActiveField('stop');
    setLoading(true);
    searchPlaces(text, 'stop');
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
        } else if (activeField === 'stop') {
          setStop(locationData);
          setStopText(prediction.mainText);
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
      field: activeField === 'stop' ? 'destination' : activeField,
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
    } else if (activeField === 'stop') {
      setStop(locationData);
      setStopText(place.name);
      setActiveField('destination');
    } else {
      setDestination(locationData);
      setDestinationText(place.name);
    }
  };

  const toggleAddStop = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowAddStop(!showAddStop);
    if (!showAddStop) {
      setActiveField('stop');
    }
  };

  const removeStop = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStop(null);
    setStopText('');
    setShowAddStop(false);
    setActiveField('destination');
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
      borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
    },
   closeButton: {
      padding: 8,
      marginBottom: 16,
    },
    closeText: {
      fontSize: 36,
      color: isDark ? '#FFFFFF' : '#1a1a2e',
      fontWeight: '300',
    },
    inputsContainer: {
      gap: 12,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    dotsContainer: {
      alignItems: 'center',
      paddingTop: 14,
    },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    dotPickup: {
      backgroundColor: '#10B981',
    },
    dotStop: {
      backgroundColor: '#F59E0B',
    },
    dotDest: {
      backgroundColor: '#EF4444',
    },
    dotLine: {
      width: 2,
      height: 20,
      backgroundColor: isDark ? '#333333' : '#E5E7EB',
      marginVertical: 4,
    },
    inputsRight: {
      flex: 1,
      gap: 8,
    },
    input: {
      backgroundColor: isDark ? '#1a1a2e' : '#F5F5F5',
      borderRadius: 12,
      padding: 14,
      fontSize: 15,
      fontWeight: '500',
      color: isDark ? '#FFFFFF' : '#1a1a2e',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    inputActive: {
      borderColor: '#E67E22',
    },
    inputFilled: {
      borderColor: '#10B981',
    },
    inputLoading: {
      opacity: 0.7,
    },
    addStopSection: {
      marginTop: 8,
    },
    addStopButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? '#1a1a2e' : '#FFFFFF',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
    },
    addStopLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    addStopIcon: {
      fontSize: 20,
    },
    addStopText: {
      fontSize: 15,
      fontWeight: '600',
      color: isDark ? '#FFFFFF' : '#1a1a2e',
    },
    addStopArrow: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: isDark ? '#333333' : '#F0F0F0',
      justifyContent: 'center',
      alignItems: 'center',
    },
    addStopArrowText: {
      fontSize: 14,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#1a1a2e',
    },
    stopInputContainer: {
      marginTop: 12,
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.08)',
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    stopInputHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    stopInputLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: '#F59E0B',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    removeStopButton: {
      padding: 4,
    },
    removeStopText: {
      fontSize: 18,
      color: '#EF4444',
      fontWeight: '600',
    },
    stopInput: {
      backgroundColor: isDark ? '#1a1a2e' : '#FFFFFF',
      borderRadius: 10,
      padding: 12,
      fontSize: 15,
      fontWeight: '500',
      color: isDark ? '#FFFFFF' : '#1a1a2e',
      borderWidth: 2,
      borderColor: activeField === 'stop' ? '#F59E0B' : 'transparent',
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
      backgroundColor: isDark ? '#1a1a2e' : '#FFFFFF',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
    },
    quickActionText: {
      fontSize: 13,
      color: '#E67E22',
      fontWeight: '600',
    },
    confirmButton: {
      backgroundColor: '#E67E22',
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 16,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      shadowColor: '#E67E22',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    confirmButtonDisabled: {
      opacity: 0.5,
    },
    confirmButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    savedPlacesContainer: {
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    savedPlacesTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: '#E67E22',
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 1,
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
      backgroundColor: isDark ? '#1a1a2e' : '#FFFFFF',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
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
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#1a1a2e',
    },
    savedPlaceAddress: {
      fontSize: 11,
      color: isDark ? '#888888' : '#666666',
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
      borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    resultIcon: {
      width: 44,
      height: 44,
      backgroundColor: isDark ? '#1a1a2e' : '#F5F5F5',
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
      color: isDark ? '#FFFFFF' : '#1a1a2e',
      marginBottom: 3,
    },
    resultSecondary: {
      fontSize: 13,
      color: isDark ? '#888888' : '#666666',
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
      color: isDark ? '#888888' : '#666666',
      textAlign: 'center',
    },
    activeFieldLabel: {
      fontSize: 12,
      color: '#E67E22',
      marginBottom: 8,
      fontWeight: '700',
    },
    poweredBy: {
      padding: 10,
      alignItems: 'center',
    },
    poweredByText: {
      fontSize: 11,
      color: isDark ? '#666666' : '#999999',
    },
    readyBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
      paddingVertical: 12,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: '#10B981',
    },
    readyBannerIcon: {
      fontSize: 16,
      color: '#10B981',
    },
    readyBannerText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#10B981',
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
          <Text style={styles.readyBannerIcon}>✓</Text>
          <Text style={styles.readyBannerText}>Both locations selected!</Text>
        </View>
      )}

      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
          <Text style={styles.closeText}>‹</Text>
        </TouchableOpacity>

        <View style={styles.inputsContainer}>
          <View style={styles.inputRow}>
            <View style={styles.dotsContainer}>
              <View style={[styles.dot, styles.dotPickup]} />
              <View style={styles.dotLine} />
              {showAddStop && (
                <>
                  <View style={[styles.dot, styles.dotStop]} />
                  <View style={styles.dotLine} />
                </>
              )}
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
                placeholderTextColor={isDark ? '#666666' : '#999999'}
                value={pickupText}
                onChangeText={handlePickupChange}
                onFocus={() => setActiveField('pickup')}
                editable={!gettingCurrentLocation}
              />

              {showAddStop && (
                <View style={styles.stopInputContainer}>
                  <View style={styles.stopInputHeader}>
                    <Text style={styles.stopInputLabel}>Add Stop Location</Text>
                    <TouchableOpacity style={styles.removeStopButton} onPress={removeStop}>
                      <Text style={styles.removeStopText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.stopInput}
                    placeholder="Enter address or business name..."
                    placeholderTextColor={isDark ? '#666666' : '#999999'}
                    value={stopText}
                    onChangeText={handleStopChange}
                    onFocus={() => setActiveField('stop')}
                    autoFocus={showAddStop && !stop}
                  />
                </View>
              )}

              <TextInput
                style={[
                  styles.input,
                  activeField === 'destination' && styles.inputActive,
                  destination && activeField !== 'destination' && styles.inputFilled,
                ]}
                placeholder="Where to?"
                placeholderTextColor={isDark ? '#666666' : '#999999'}
                value={destinationText}
                onChangeText={handleDestinationChange}
                onFocus={() => setActiveField('destination')}
                autoFocus={!!initialPickup && !selectedLocation && !showAddStop}
              />
            </View>
          </View>

          {/* Add a Stop Section */}
          {!showAddStop && (
            <View style={styles.addStopSection}>
              <TouchableOpacity style={styles.addStopButton} onPress={toggleAddStop}>
                <View style={styles.addStopLeft}>
                  <Text style={styles.addStopIcon}>📍</Text>
                  <Text style={styles.addStopText}>Add a Stop</Text>
                </View>
                <View style={styles.addStopArrow}>
                  <Text style={styles.addStopArrowText}>▼</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

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

          {/* Confirm Button */}
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

      {/* Saved Places */}
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
          {activeField === 'pickup' ? 'Select pickup location' : activeField === 'stop' ? 'Select stop location' : 'Select destination'}
        </Text>
      )}

      {loading && predictions.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#E67E22" size="large" />
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
            !canConfirm && (pickupText.length > 2 || destinationText.length > 2 || stopText.length > 2) && !loading ? (
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