/**
 * AuthStack - Navigation stack for authentication screens
 * Phase 2.3 Implementation
 */

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../screens/LoginScreen';

export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined; // Future implementation
  SignUp: undefined; // Future implementation
};

const Stack = createStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false, // No header for auth screens
        cardStyle: { backgroundColor: '#FFFFFF' },
      }}
    >
      <Stack.Screen 
        name="Login" 
        component={LoginScreen}
      />
      {/* 
        Future screens:
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
      */}
    </Stack.Navigator>
  );
}