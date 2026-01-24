import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import API_BASE_URL from '../config/api.config';

const EditProfileScreen = () => {
  const { colors, isDark } = useTheme();
  const { user, updateUser } = useAuth();
  const navigation = useNavigation<any>();

  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Error', 'First name and last name are required.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${user?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
        }),
      });

      if (response.ok) {
        if (updateUser) {
          updateUser({ firstName, lastName, phone });
        }
        Alert.alert('Success', 'Profile updated successfully!', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        Alert.alert('Error', 'Could not update profile. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please check your connection.');
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
    avatarSection: {
      alignItems: 'center',
      marginBottom: 32,
    },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: '#E67E22',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    avatarText: {
      fontSize: 36,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    changePhotoButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    changePhotoText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#E67E22',
    },
    inputGroup: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#B0B0B0' : '#666666',
      marginBottom: 8,
    },
    input: {
      backgroundColor: isDark ? '#1a1a2e' : '#F5F5F5',
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      fontWeight: '500',
      color: isDark ? '#FFFFFF' : '#1a1a2e',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
    },
    inputDisabled: {
      opacity: 0.6,
    },
    inputHint: {
      fontSize: 12,
      color: isDark ? '#666666' : '#999999',
      marginTop: 6,
    },
    saveButton: {
      backgroundColor: '#E67E22',
      padding: 18,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 20,
      shadowColor: '#E67E22',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: 0.5,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {firstName?.[0]?.toUpperCase()}{lastName?.[0]?.toUpperCase()}
            </Text>
          </View>
          <TouchableOpacity style={styles.changePhotoButton}>
            <Text style={styles.changePhotoText}>Change Photo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>First Name</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Enter first name"
            placeholderTextColor={isDark ? '#666666' : '#999999'}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Last Name</Text>
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Enter last name"
            placeholderTextColor={isDark ? '#666666' : '#999999'}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={email}
            editable={false}
            placeholderTextColor={isDark ? '#666666' : '#999999'}
          />
          <Text style={styles.inputHint}>Email cannot be changed</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Enter phone number"
            placeholderTextColor={isDark ? '#666666' : '#999999'}
            keyboardType="phone-pad"
          />
        </View>

        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]} 
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default EditProfileScreen;