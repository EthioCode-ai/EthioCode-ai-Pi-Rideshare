/**
 * RootNavigator - Main app navigation with authentication state management
 * Phase 2.6 - Added ActiveRideScreen
 */

import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthStack from './AuthStack';
import HomeScreen from '../screens/HomeScreen';
import ActiveRideScreen from '../screens/ActiveRideScreen';
import { StorageKeys } from '../constants/StorageKeys';
import { ActiveRide } from '../types/ride.types';

import { createStackNavigator } from '@react-navigation/stack';

export type MainStackParamList = {
  Home: {
  completedTrip?: {
    rideId: string;
    fare: number;
    distance: number;
    riderName: string;
    completedAt: string;
  };
  stayOnline?: boolean;
} | undefined;

  ActiveRide: { 
    ride: ActiveRide;
    routeData: {
      toPickup: {
        polyline: string;
        distance: { km: number; miles: number };
        duration: { adjusted_minutes: number; seconds: number };
        steps: any[];
      };
      toDestination: {
        polyline: string;
        distance: { km: number; miles: number };
        duration: { adjusted_minutes: number; seconds: number };
        steps: any[];
      };
    };
  };
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
      <MainStack.Screen 
        name="ActiveRide" 
        component={ActiveRideScreen}
        options={{
          gestureEnabled: false, // Prevent swipe back during active ride
        }}
      />
    </MainStack.Navigator>
  );
}

export default function RootNavigator() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    console.log('🚀 RootNavigator mounted');
    checkAuthStatus();

    const authCheckInterval = setInterval(checkAuthStatus, 2000);

    return () => clearInterval(authCheckInterval);
  }, []);

  const checkAuthStatus = async () => {
    console.log('🔍 Checking auth status...');
    try {
      const token = await AsyncStorage.getItem(StorageKeys.AUTH_TOKEN);
      console.log('🔑 Token:', token ? 'EXISTS' : 'NONE');
      
      if (token) {
        setIsAuthenticated(true);
        console.log('✅ User is authenticated');
      } else {
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
