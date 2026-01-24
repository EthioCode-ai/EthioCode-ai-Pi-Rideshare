import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// Auth Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';

// Main Screens
import HomeScreen from '../screens/HomeScreen';
import ActivityScreen from '../screens/ActivityScreen';
import AccountScreen from '../screens/AccountScreen';
import SaveLocationScreen from '../screens/SaveLocationScreen';

// Account Sub-Screens
import SavedPlacesScreen from '../screens/SavedPlacesScreen';
import PaymentMethodsScreen from '../screens/PaymentMethodsScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import SafetyScreen from '../screens/SafetyScreen';
import HelpSupportScreen from '../screens/HelpSupportScreen';


// Ride Screens
import DestinationSearchScreen from '../screens/DestinationSearchScreen';
import RideConfirmScreen from '../screens/RideConfirmScreen';
import ActiveRideScreen from '../screens/ActiveRideScreen';
import RideCompleteScreen from '../screens/RideCompleteScreen';
import MapPickerScreen from '../screens/MapPickerScreen';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Activity: undefined;
  Account: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  DestinationSearch: { 
    pickup?: { latitude: number; longitude: number; address: string };
    selectedLocation?: { latitude: number; longitude: number; address: string };
    field?: 'pickup' | 'destination';
  };
  MapPicker: {
    field: 'pickup' | 'destination';
    currentLocation?: { latitude: number; longitude: number; address: string };
  };
  SaveLocation: {
    type: 'home' | 'work';
  };
  RideConfirm: {
    pickup: {
      latitude: number;
      longitude: number;
      address: string;
    };
    destination: {
      latitude: number;
      longitude: number;
      address: string;
    };
    scheduledTime?: string;
  };
  ActiveRide: { 
    rideId: string;
    driver?: {
      id: string;
      driverId?: string;
      name: string;
      rating: number;
      phone: string;
      vehicle: {
        model: string;
        make?: string;
        color?: string;
        licensePlate?: string;
      };
    };
    pickup?: {
      latitude: number;
      longitude: number;
      address?: string;
    };
    destination?: {
      latitude: number;
      longitude: number;
      address?: string;
    };
    eta?: number;
    fare?: number;  // ✅ ADDED: Fare from backend calculation
  };
 RideComplete: { rideId: string; fare: number };
  SavedPlaces: undefined;
  PaymentMethods: undefined;
  NotificationSettings: undefined;
  EditProfile: undefined;
  Safety: undefined;
  HelpSupport: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

const TabIcon = ({ name, focused, color }: { name: string; focused: boolean; color: string }) => {
  const icons: Record<string, string> = {
    Home: '🏠',
    Activity: '📋',
    Account: '👤',
  };
  return (
    <Text style={{ fontSize: focused ? 26 : 22 }}>{icons[name]}</Text>
  );
};

const MainTabs = () => {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.cardBorder,
          paddingBottom: 8,
          paddingTop: 8,
          height: 70,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarIcon: ({ focused, color }) => (
          <TabIcon name={route.name} focused={focused} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
};

const AuthNavigator = () => {
  const { colors } = useTheme();

  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
};

const MainNavigator = () => {
  const { colors } = useTheme();

  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <RootStack.Screen name="MainTabs" component={MainTabs} />
      <RootStack.Screen 
        name="DestinationSearch" 
        component={DestinationSearchScreen}
        options={{ presentation: 'modal' }}
      />
     <RootStack.Screen 
       name="MapPicker" 
       component={MapPickerScreen}
       options={{ presentation: 'modal' }}
     />
     <RootStack.Screen 
       name="SaveLocation" 
       component={SaveLocationScreen}
       options={{ presentation: 'modal' }}
     />
      <RootStack.Screen 
        name="RideConfirm" 
        component={RideConfirmScreen}
        options={{ presentation: 'modal' }}
      />
      <RootStack.Screen 
        name="ActiveRide" 
        component={ActiveRideScreen}
        options={{ gestureEnabled: false }}
      />
      <RootStack.Screen
        name="RideComplete"
        component={RideCompleteScreen}
        options={{ presentation: 'modal', gestureEnabled: false }}
      />
      <RootStack.Screen
        name="SavedPlaces"
        component={SavedPlacesScreen}
        options={{ presentation: 'card' }}
      />
      <RootStack.Screen
        name="PaymentMethods"
        component={PaymentMethodsScreen}
        options={{ presentation: 'card' }}
      />
      <RootStack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ presentation: 'card' }}
      />
      <RootStack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ presentation: 'card' }}
      />
      <RootStack.Screen
        name="Safety"
        component={SafetyScreen}
        options={{ presentation: 'card' }}
      />
      <RootStack.Screen
        name="HelpSupport"
        component={HelpSupportScreen}
        options={{ presentation: 'card' }}
      />
    </RootStack.Navigator>
  );
};

const AppNavigator = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default AppNavigator;