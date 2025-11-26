/**
 * RootNavigator - Main app navigation with authentication state management
 * Phase 2.3 Implementation
 * 
 * Handles:
 * - Auth state checking on app startup
 * - Conditional rendering (Auth vs Main app)
 * - Token validation
 * - Navigation between auth and authenticated states
 */

import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthStack from './AuthStack';
import HomeScreen from '../screens/HomeScreen'; // Your existing HomeScreen
import { StorageKeys } from '../constants/StorageKeys';

// Temporary simple navigator for HomeScreen until you implement full MainApp navigator
import { createStackNavigator } from '@react-navigation/stack';

export type MainStackParamList = {
  Home: undefined;
  // Add other authenticated screens here later
};

const MainStack = createStackNavigator<MainStackParamList>();

function MainAppNavigator() {
  return (
    <MainStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <MainStack.Screen name="Home" component={HomeScreen} />
    </MainStack.Navigator>
  );
}

export default function RootNavigator() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    console.log('🚀 RootNavigator mounted');
    checkAuthStatus();

    // Listen for authentication changes every 2 seconds
    const authCheckInterval = setInterval(checkAuthStatus, 2000);

    return () => clearInterval(authCheckInterval);
  }, []);

  const checkAuthStatus = async () => {
    console.log('🔍 Checking auth status...');
    try {
      const token = await AsyncStorage.getItem(StorageKeys.AUTH_TOKEN);
      console.log('🔑 Token:', token ? 'EXISTS' : 'NONE');
      
      if (token) {
        // Token exists - user is authenticated
        setIsAuthenticated(true);
        console.log('✅ User is authenticated');
      } else {
        // No token - user needs to login
        setIsAuthenticated(false);
        console.log('❌ User NOT authenticated - showing LoginScreen');
      }
    } catch (error) {
      console.error('💥 Error checking auth status:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
      console.log('✅ Loading complete');
    }
  };

  console.log('📊 RootNavigator State:', { isLoading, isAuthenticated });

  // Show loading screen while checking auth status
  if (isLoading) {
    console.log('⏳ Showing loading screen');
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E40AF" />
      </View>
    );
  }

  console.log('🎯 Rendering:', isAuthenticated ? 'MainApp (HomeScreen)' : 'AuthStack (LoginScreen)');

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainAppNavigator /> : <AuthStack />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});