import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import API_BASE_URL from '../config/api.config';

const SafetyScreen = () => {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();

  const [emergencyContact, setEmergencyContact] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load emergency contact from profile
  useEffect(() => {
    const loadEmergencyContact = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.emergencyContact) {
            setEmergencyContact(data.emergencyContact);
          }
        }
      } catch (error) {
        console.log('Could not load emergency contact:', error);
      }
    };
    loadEmergencyContact();
  }, []);

  const handleCall911 = () => {
    Alert.alert(
      'Emergency Call',
      'Are you sure you want to call 911?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call 911', style: 'destructive', onPress: () => Linking.openURL('tel:911') }
      ]
    );
  };

  const handleCallEmergencyContact = () => {
    if (!emergencyContact) {
      Alert.alert('No Emergency Contact', 'Please add an emergency contact first.');
      return;
    }
    Linking.openURL(`tel:${emergencyContact}`);
  };

  const handleSaveEmergencyContact = async () => {
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          emergencyContact: emergencyContact.trim(),
        }),
      });

      if (response.ok) {
        setEditing(false);
        Alert.alert('Saved', 'Emergency contact updated.');
      } else {
        Alert.alert('Error', 'Could not save emergency contact.');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
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
    emergencyButton: {
      backgroundColor: '#DC3545',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      borderRadius: 16,
      marginBottom: 20,
      shadowColor: '#DC3545',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 6,
    },
    emergencyIcon: {
      fontSize: 28,
      marginRight: 12,
    },
    emergencyText: {
      fontSize: 20,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    section: {
      marginTop: 24,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: '#E67E22',
      marginBottom: 14,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    card: {
      backgroundColor: isDark ? '#1a1a2e' : '#FFFFFF',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    cardIcon: {
      fontSize: 24,
      marginRight: 12,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#1a1a2e',
    },
    cardDescription: {
      fontSize: 14,
      color: isDark ? '#B0B0B0' : '#666666',
      lineHeight: 20,
      marginBottom: 12,
    },
    input: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#F5F5F5',
      borderRadius: 10,
      padding: 14,
      fontSize: 16,
      fontWeight: '500',
      color: isDark ? '#FFFFFF' : '#1a1a2e',
      marginBottom: 12,
    },
    cardButton: {
      backgroundColor: '#E67E22',
      padding: 12,
      borderRadius: 10,
      alignItems: 'center',
    },
    cardButtonText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    cardButtonOutline: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: '#E67E22',
    },
    cardButtonOutlineText: {
      color: '#E67E22',
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    featureIcon: {
      fontSize: 22,
      marginRight: 16,
      width: 32,
      textAlign: 'center',
    },
    featureInfo: {
      flex: 1,
    },
    featureTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#FFFFFF' : '#1a1a2e',
      marginBottom: 2,
    },
    featureDescription: {
      fontSize: 13,
      color: isDark ? '#888888' : '#888888',
    },
    featureStatus: {
      fontSize: 13,
      fontWeight: '600',
      color: '#10B981',
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Safety</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.emergencyButton} onPress={handleCall911}>
          <Text style={styles.emergencyIcon}>🚨</Text>
          <Text style={styles.emergencyText}>Call 911</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Emergency Contact</Text>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardIcon}>👤</Text>
              <Text style={styles.cardTitle}>Trusted Contact</Text>
            </View>
            <Text style={styles.cardDescription}>
              Add someone who can be contacted in case of an emergency during your ride.
            </Text>
            {editing ? (
              <>
                <TextInput
                  style={styles.input}
                  value={emergencyContact}
                  onChangeText={setEmergencyContact}
                  placeholder="Enter phone number"
                  placeholderTextColor={isDark ? '#666666' : '#999999'}
                  keyboardType="phone-pad"
                />
                <TouchableOpacity 
                  style={[styles.cardButton, saving && { opacity: 0.6 }]} 
                  onPress={handleSaveEmergencyContact}
                  disabled={saving}
                >
                  <Text style={styles.cardButtonText}>{saving ? 'Saving...' : 'Save Contact'}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {emergencyContact ? (
                  <Text style={[styles.cardDescription, { fontWeight: '600', color: isDark ? '#FFFFFF' : '#1a1a2e' }]}>
                    {emergencyContact}
                  </Text>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity 
                    style={[styles.cardButton, { flex: 1 }]} 
                    onPress={() => setEditing(true)}
                  >
                    <Text style={styles.cardButtonText}>
                      {emergencyContact ? 'Edit' : 'Add Contact'}
                    </Text>
                  </TouchableOpacity>
                  {emergencyContact ? (
                    <TouchableOpacity 
                      style={[styles.cardButton, styles.cardButtonOutline, { flex: 1 }]} 
                      onPress={handleCallEmergencyContact}
                    >
                      <Text style={[styles.cardButtonText, styles.cardButtonOutlineText]}>Call</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safety Features</Text>
          
          <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>📍</Text>
            <View style={styles.featureInfo}>
              <Text style={styles.featureTitle}>Share Trip Status</Text>
              <Text style={styles.featureDescription}>Share your live location with trusted contacts</Text>
            </View>
            <Text style={styles.featureStatus}>Active</Text>
          </View>

          <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>🛡️</Text>
            <View style={styles.featureInfo}>
              <Text style={styles.featureTitle}>Ride Check</Text>
              <Text style={styles.featureDescription}>We'll check in if your trip seems unusual</Text>
            </View>
            <Text style={styles.featureStatus}>Active</Text>
          </View>

          <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>🔒</Text>
            <View style={styles.featureInfo}>
              <Text style={styles.featureTitle}>PIN Verification</Text>
              <Text style={styles.featureDescription}>Confirm your driver with a unique PIN</Text>
            </View>
            <Text style={styles.featureStatus}>Active</Text>
          </View>

          <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>🚗</Text>
            <View style={styles.featureInfo}>
              <Text style={styles.featureTitle}>Driver Verification</Text>
              <Text style={styles.featureDescription}>All drivers pass background checks</Text>
            </View>
            <Text style={styles.featureStatus}>Active</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SafetyScreen;