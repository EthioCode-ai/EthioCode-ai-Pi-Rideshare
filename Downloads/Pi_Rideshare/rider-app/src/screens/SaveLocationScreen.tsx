import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Keyboard,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { debounce } from 'lodash';

import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { placesService, PlacePrediction } from '../services/places.service';
import { StorageKeys } from '../constants';
import { SavedPlace } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SaveLocation'>;
type RouteProps = RouteProp<RootStackParamList, 'SaveLocation'>;

const SaveLocationScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { colors, isDark } = useTheme();

  const locationType = route.params?.type || 'home';
  const label = locationType === 'home' ? 'Home' : 'Work';
  const icon = locationType === 'home' ? '🏠' : '💼';

  const [searchText, setSearchText] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const searchPlaces = useCallback(
    debounce(async (text: string) => {
      if (text.length < 2) {
        setPredictions([]);
        setLoading(false);
        return;
      }

      try {
        const results = await placesService.autocomplete(text);
        setPredictions(results);
      } catch (error) {
        console.error('Search error:', error);
        setPredictions([]);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  const handleInputChange = (text: string) => {
    setSearchText(text);
    setLoading(true);
    searchPlaces(text);
  };

  const handleSelectPlace = async (prediction: PlacePrediction) => {
    Keyboard.dismiss();
    setSaving(true);

    try {
      const details = await placesService.getPlaceDetails(prediction.placeId);

      if (details) {
        // Load existing saved places
        const existingData = await AsyncStorage.getItem(StorageKeys.SAVED_PLACES);
        let savedPlaces: SavedPlace[] = existingData ? JSON.parse(existingData) : [];

        // Remove existing entry for this type if exists
        savedPlaces = savedPlaces.filter(p => p.label !== locationType);

        // Add new entry
        const newPlace: SavedPlace = {
          id: `${locationType}-${Date.now()}`,
          name: prediction.mainText,
          label: locationType as 'home' | 'work',
          location: {
            latitude: details.latitude,
            longitude: details.longitude,
            address: details.address,
          },
          icon: icon,
        };

        savedPlaces.push(newPlace);

        // Save to AsyncStorage
        await AsyncStorage.setItem(StorageKeys.SAVED_PLACES, JSON.stringify(savedPlaces));

        Alert.alert(
          `${label} Saved!`,
          `${prediction.mainText} has been saved as your ${label.toLowerCase()} address.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (error) {
      console.error('Error saving place:', error);
      Alert.alert('Error', 'Failed to save location. Please try again.');
    } finally {
      setSaving(false);
    }
  };

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
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
    },
    closeButton: {
      marginRight: 16,
    },
    closeText: {
      fontSize: 24,
      color: colors.text,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    headerIcon: {
      fontSize: 24,
      marginRight: 10,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      paddingHorizontal: 14,
      borderWidth: 2,
      borderColor: colors.primary,
    },
    inputIcon: {
      fontSize: 20,
      marginRight: 10,
    },
    input: {
      flex: 1,
      height: 52,
      fontSize: 16,
      color: colors.text,
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
    savingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    savingText: {
      color: '#fff',
      marginTop: 10,
      fontSize: 16,
    },
  });

  const renderPrediction = ({ item }: { item: PlacePrediction }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleSelectPlace(item)}
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
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
            <Text style={styles.closeText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerIcon}>{icon}</Text>
          <Text style={styles.headerTitle}>Set {label} Address</Text>
        </View>
        
        <Text style={styles.subtitle}>
          Search for your {label.toLowerCase()} address to save it for quick access
        </Text>

        <View style={styles.inputContainer}>
          <Text style={styles.inputIcon}>{icon}</Text>
          <TextInput
            style={styles.input}
            placeholder={`Enter your ${label.toLowerCase()} address`}
            placeholderTextColor={colors.textMuted}
            value={searchText}
            onChangeText={handleInputChange}
            autoFocus
          />
        </View>
      </View>

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
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>{icon}</Text>
              <Text style={styles.emptyText}>
                Search for your {label.toLowerCase()} address
              </Text>
            </View>
          }
        />
      )}

      {saving && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.savingText}>Saving {label}...</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

export default SaveLocationScreen;