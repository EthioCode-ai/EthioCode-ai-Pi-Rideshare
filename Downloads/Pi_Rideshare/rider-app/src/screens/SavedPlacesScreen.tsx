import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import API_BASE_URL from '../config/api.config';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SavedPlace {
  id: string;
  name: string;
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}

const SavedPlacesScreen = () => {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSavedPlaces();
  }, []);

 const fetchSavedPlaces = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/rider/${user?.id}/saved-places`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        const data = await response.json();
        setPlaces(data.places || []);
      }
    } catch (error) {
      console.log('Could not fetch saved places:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPlaceIcon = (label: string) => {
    switch (label.toLowerCase()) {
      case 'home': return '🏠';
      case 'work': return '💼';
      case 'gym': return '🏋️';
      case 'school': return '🎓';
      default: return '📍';
    }
  };

  const handleAddPlace = () => {
    navigation.navigate('SaveLocation');
  };

  const handleDeletePlace = (placeId: string, placeName: string) => {
    Alert.alert(
      'Delete Place',
      `Are you sure you want to delete "${placeName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
           try {
              const token = await AsyncStorage.getItem('authToken');
              await fetch(`${API_BASE_URL}/api/rider/${user?.id}/saved-places/${placeId}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              });
              setPlaces(places.filter(p => p.id !== placeId));
            } catch (error) {
              Alert.alert('Error', 'Could not delete place');
            }
          }
        },
      ]
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 20,
      paddingTop: 10,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
    },
    backButton: {
      padding: 8,
      marginRight: 12,
    },
    backText: {
      fontSize: 24,
      color: isDark ? '#FFFFFF' : '#1a1a2e',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#1a1a2e',
    },
    content: {
      flex: 1,
      padding: 20,
    },
    placeItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1a1a2e' : '#FFFFFF',
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    placeIcon: {
      fontSize: 28,
      marginRight: 16,
    },
    placeInfo: {
      flex: 1,
    },
    placeName: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#1a1a2e',
      marginBottom: 4,
    },
    placeAddress: {
      fontSize: 14,
      color: isDark ? '#B0B0B0' : '#666666',
    },
    deleteButton: {
      padding: 8,
    },
    deleteText: {
      fontSize: 20,
      color: '#DC3545',
    },
    addButton: {
      backgroundColor: '#E67E22',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      borderRadius: 12,
      marginTop: 12,
    },
    addButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
      marginLeft: 8,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    },
    emptyIcon: {
      fontSize: 64,
      marginBottom: 16,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#888888' : '#666666',
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: isDark ? '#666666' : '#999999',
      textAlign: 'center',
      paddingHorizontal: 40,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Places</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {places.length === 0 && !loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📍</Text>
            <Text style={styles.emptyText}>No saved places yet</Text>
            <Text style={styles.emptySubtext}>
              Save your favorite locations for quick access when booking rides.
            </Text>
          </View>
        ) : (
          places.map((place) => (
            <View key={place.id} style={styles.placeItem}>
              <Text style={styles.placeIcon}>{getPlaceIcon(place.label)}</Text>
              <View style={styles.placeInfo}>
                <Text style={styles.placeName}>{place.name}</Text>
                <Text style={styles.placeAddress} numberOfLines={1}>{place.address}</Text>
              </View>
              <TouchableOpacity 
                style={styles.deleteButton} 
                onPress={() => handleDeletePlace(place.id, place.name)}
              >
                <Text style={styles.deleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        <TouchableOpacity style={styles.addButton} onPress={handleAddPlace}>
          <Text style={styles.addButtonText}>+ Add New Place</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SavedPlacesScreen;