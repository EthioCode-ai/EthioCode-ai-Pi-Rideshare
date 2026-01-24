/**
 * SettingsScreen - Driver preferences and settings
 * Version 1.5
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api.config';
import { StorageKeys } from '../constants/StorageKeys';

interface DriverSettings {
  voiceGuidance: boolean;
  acceptCash: boolean;
  longTrips: boolean;
  poolRides: boolean;
  autoAccept: boolean;
  acceptPets: boolean;
  acceptTeens: boolean;
  notifications: boolean;
}

interface AdminSettings {
  cashEnabled: boolean;
  poolEnabled: boolean;
}

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<DriverSettings>({
    voiceGuidance: true,
    acceptCash: false,
    longTrips: true,
    poolRides: true,
    autoAccept: false,
    acceptPets: false,
    acceptTeens: false,
    notifications: true,
  });
  const [adminSettings, setAdminSettings] = useState<AdminSettings>({
    cashEnabled: true,
    poolEnabled: true,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const token = await AsyncStorage.getItem(StorageKeys.AUTH_TOKEN);
      const userData = await AsyncStorage.getItem(StorageKeys.USER_DATA);
      
      if (!token || !userData) {
        setLoading(false);
        return;
      }

      const user = JSON.parse(userData);

      // Load driver settings from server
      const response = await fetch(`${API_BASE_URL}/api/driver/settings/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setSettings(prev => ({ ...prev, ...data.settings }));
        }
        if (data.adminSettings) {
          setAdminSettings(data.adminSettings);
        }
      } else {
        // Load from local storage as fallback
        const localSettings = await AsyncStorage.getItem('@driver_settings');
        if (localSettings) {
          setSettings(prev => ({ ...prev, ...JSON.parse(localSettings) }));
        }
      }
    } catch (error) {
      console.log('Error loading settings:', error);
      // Load from local storage as fallback
      const localSettings = await AsyncStorage.getItem('@driver_settings');
      if (localSettings) {
        setSettings(prev => ({ ...prev, ...JSON.parse(localSettings) }));
      }
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: keyof DriverSettings, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    // Save locally immediately
    await AsyncStorage.setItem('@driver_settings', JSON.stringify(newSettings));

    // Sync to server
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem(StorageKeys.AUTH_TOKEN);
      const userData = await AsyncStorage.getItem(StorageKeys.USER_DATA);
      
      if (token && userData) {
        const user = JSON.parse(userData);
        await fetch(`${API_BASE_URL}/api/driver/settings/${user.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ settings: newSettings }),
        });
      }
    } catch (error) {
      console.log('Error saving settings to server:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleVehicleInfo = () => {
    Alert.alert('Vehicle Info', 'Vehicle information screen coming soon!');
  };

  const handleInsurance = () => {
    navigation.navigate('Documents' as never);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6B46C1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        {saving && <ActivityIndicator size="small" color="#6B46C1" style={styles.savingIndicator} />}
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Navigation Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Navigation</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingIcon}>🔊</Text>
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Voice Guidance</Text>
                <Text style={styles.settingDescription}>Turn-by-turn navigation announcements</Text>
                {settings.voiceGuidance && (
                  <Text style={styles.statusText}>✓ Voice guidance is ON</Text>
                )}
              </View>
            </View>
            <Switch
              value={settings.voiceGuidance}
              onValueChange={(value) => updateSetting('voiceGuidance', value)}
              trackColor={{ false: '#E5E7EB', true: '#10B981' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Ride Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ride Preferences</Text>

          {adminSettings.cashEnabled && (
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingIcon}>💵</Text>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Accept Cash</Text>
                  <Text style={styles.settingDescription}>Accept cash payments from riders</Text>
                </View>
              </View>
              <Switch
                value={settings.acceptCash}
                onValueChange={(value) => updateSetting('acceptCash', value)}
                trackColor={{ false: '#E5E7EB', true: '#10B981' }}
                thumbColor="#FFFFFF"
              />
            </View>
          )}

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingIcon}>🚗</Text>
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Long Trips</Text>
                <Text style={styles.settingDescription}>Accept rides over 45 minutes</Text>
              </View>
            </View>
            <Switch
              value={settings.longTrips}
              onValueChange={(value) => updateSetting('longTrips', value)}
              trackColor={{ false: '#E5E7EB', true: '#10B981' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {adminSettings.poolEnabled && (
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingIcon}>👥</Text>
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Pool Rides</Text>
                  <Text style={styles.settingDescription}>Accept shared rides with multiple passengers</Text>
                </View>
              </View>
              <Switch
                value={settings.poolRides}
                onValueChange={(value) => updateSetting('poolRides', value)}
                trackColor={{ false: '#E5E7EB', true: '#10B981' }}
                thumbColor="#FFFFFF"
              />
            </View>
          )}

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingIcon}>⚡</Text>
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Auto Accept</Text>
                <Text style={styles.settingDescription}>Automatically accept ride requests</Text>
              </View>
            </View>
            <Switch
              value={settings.autoAccept}
              onValueChange={(value) => updateSetting('autoAccept', value)}
              trackColor={{ false: '#E5E7EB', true: '#10B981' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingIcon}>🐾</Text>
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Accept Pets</Text>
                <Text style={styles.settingDescription}>Allow riders to bring pets on rides</Text>
              </View>
            </View>
            <Switch
              value={settings.acceptPets}
              onValueChange={(value) => updateSetting('acceptPets', value)}
              trackColor={{ false: '#E5E7EB', true: '#10B981' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingIcon}>👶</Text>
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Accept Teens</Text>
                <Text style={styles.settingDescription}>Allow unaccompanied minors (13-17) to book rides</Text>
              </View>
            </View>
            <Switch
              value={settings.acceptTeens}
              onValueChange={(value) => updateSetting('acceptTeens', value)}
              trackColor={{ false: '#E5E7EB', true: '#10B981' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingIcon}>🔔</Text>
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Notifications</Text>
                <Text style={styles.settingDescription}>Push notifications and alerts</Text>
              </View>
            </View>
            <Switch
              value={settings.notifications}
              onValueChange={(value) => updateSetting('notifications', value)}
              trackColor={{ false: '#E5E7EB', true: '#10B981' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Vehicle & Documents Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle & Documents</Text>
          
          <TouchableOpacity style={styles.settingRow} onPress={handleVehicleInfo}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingIcon}>🚙</Text>
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Vehicle Info</Text>
                <Text style={styles.settingDescription}>View and edit vehicle details</Text>
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingRow} onPress={handleInsurance}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingIcon}>📄</Text>
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Insurance</Text>
                <Text style={styles.settingDescription}>View insurance status and documents</Text>
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  backIcon: {
    fontSize: 24,
    color: '#1F2937',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  savingIndicator: {
    marginLeft: 8,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    paddingHorizontal: 16,
    paddingVertical: 8,
    textTransform: 'uppercase',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  settingDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  statusText: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 4,
  },
  chevron: {
    fontSize: 24,
    color: '#9CA3AF',
  },
  bottomPadding: {
    height: 40,
  },
});

export default SettingsScreen;