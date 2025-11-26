import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import AuthService from '../services/auth.service';
import type { AuthStackParamList } from '../types';

type SplashScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Splash'>;

interface Props {
  navigation: SplashScreenNavigationProp;
}

const SplashScreen: React.FC<Props> = ({ navigation }) => {
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Check if user is already logged in
      const user = await AuthService.initialize();

      // Wait at least 2 seconds to show splash
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (user) {
        // User is logged in - navigate to main app
        // This will be handled by the main navigation in Phase 1
        console.log('User already logged in:', user.name);
        // For now, just go to login - we'll fix this when we add main navigation
        navigation.replace('Login');
      } else {
        // User not logged in - go to login screen
        navigation.replace('Login');
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      navigation.replace('Login');
    }
  };

  return (
    <View style={styles.container}>
      {/* Logo placeholder - replace with actual logo */}
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>Pi VIP</Text>
        <Text style={styles.subtitleText}>Driver</Text>
      </View>

      <ActivityIndicator size="large" color="#4A90E2" style={styles.loader} />
      
      <Text style={styles.versionText}>Version 1.0.0</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  subtitleText: {
    fontSize: 24,
    color: '#666',
    marginTop: 8,
  },
  loader: {
    marginTop: 20,
  },
  versionText: {
    position: 'absolute',
    bottom: 30,
    color: '#999',
    fontSize: 12,
  },
});

export default SplashScreen;
