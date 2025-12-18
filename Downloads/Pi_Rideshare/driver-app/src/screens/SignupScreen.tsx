import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import AuthService from '../services/auth.service';
import type { AuthStackParamList, RegisterRequest } from '../types';

type SignupScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Signup'>;

interface Props {
  navigation: SignupScreenNavigationProp;
}

const SignupScreen: React.FC<Props> = ({ navigation }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    licenseNumber: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    vehicleColor: '',
    licensePlate: '',
    vehicleType: 'sedan' as 'sedan' | 'suv' | 'luxury' | 'xl',
  });
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    // Validation
    if (!formData.name.trim() || !formData.email.trim() || !formData.password.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!formData.email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (formData.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (!formData.phone.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }

    setLoading(true);

    try {
      const registerData: RegisterRequest = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        password: formData.password,
        role: 'driver',
        licenseNumber: formData.licenseNumber.trim(),
        vehicleInfo: {
          make: formData.vehicleMake.trim(),
          model: formData.vehicleModel.trim(),
          year: parseInt(formData.vehicleYear) || new Date().getFullYear(),
          color: formData.vehicleColor.trim(),
          licensePlate: formData.licensePlate.trim().toUpperCase(),
          vehicleType: formData.vehicleType,
        },
      };

      const result = await AuthService.register(registerData);

      if (result.success && result.user) {
        // Registration successful
        Alert.alert(
          'Success',
          'Account created successfully! Please upload your documents for verification.',
          [{ text: 'OK', onPress: () => navigation.replace('Login') }]
        );
      } else {
        // Registration failed
        Alert.alert('Registration Failed', (result as any).error || 'Unable to create account');
      }
    } catch (error) {
      console.error('Signup error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Create Driver Account</Text>
          <Text style={styles.subtitle}>Start earning with Pi VIP</Text>
        </View>

        {/* Personal Information */}
        <Text style={styles.sectionTitle}>Personal Information</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Full Name *"
          value={formData.name}
          onChangeText={(value) => updateFormData('name', value)}
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Email *"
          value={formData.email}
          onChangeText={(value) => updateFormData('email', value)}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Phone Number *"
          value={formData.phone}
          onChangeText={(value) => updateFormData('phone', value)}
          keyboardType="phone-pad"
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Password (min 6 characters) *"
          value={formData.password}
          onChangeText={(value) => updateFormData('password', value)}
          secureTextEntry
          autoCapitalize="none"
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm Password *"
          value={formData.confirmPassword}
          onChangeText={(value) => updateFormData('confirmPassword', value)}
          secureTextEntry
          autoCapitalize="none"
          editable={!loading}
        />

        {/* Driver Information */}
        <Text style={styles.sectionTitle}>Driver Information</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Driver's License Number *"
          value={formData.licenseNumber}
          onChangeText={(value) => updateFormData('licenseNumber', value)}
          editable={!loading}
        />

        {/* Vehicle Information */}
        <Text style={styles.sectionTitle}>Vehicle Information</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Vehicle Make (e.g., Toyota)"
          value={formData.vehicleMake}
          onChangeText={(value) => updateFormData('vehicleMake', value)}
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Vehicle Model (e.g., Camry)"
          value={formData.vehicleModel}
          onChangeText={(value) => updateFormData('vehicleModel', value)}
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Year (e.g., 2020)"
          value={formData.vehicleYear}
          onChangeText={(value) => updateFormData('vehicleYear', value)}
          keyboardType="number-pad"
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Color (e.g., Silver)"
          value={formData.vehicleColor}
          onChangeText={(value) => updateFormData('vehicleColor', value)}
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="License Plate"
          value={formData.licensePlate}
          onChangeText={(value) => updateFormData('licensePlate', value)}
          autoCapitalize="characters"
          editable={!loading}
        />

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.signupButton, loading && styles.signupButtonDisabled]}
          onPress={handleSignup}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.signupButtonText}>Create Account</Text>
          )}
        </TouchableOpacity>

        {/* Login Link */}
        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={loading}>
            <Text style={styles.loginLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4A90E2',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 12,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
  },
  signupButton: {
    height: 50,
    backgroundColor: '#4A90E2',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  signupButtonDisabled: {
    backgroundColor: '#A0C4E8',
  },
  signupButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  loginText: {
    color: '#666',
    fontSize: 14,
  },
  loginLink: {
    color: '#4A90E2',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default SignupScreen;
