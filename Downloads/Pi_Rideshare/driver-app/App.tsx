import React from 'react';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationProvider } from '@googlemaps/react-native-navigation-sdk';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  console.log('App starting with authentication...');
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* NavigationProvider MUST wrap screens that use useGoogleNav() hook */}
      <NavigationProvider
        termsAndConditionsDialogOptions={{
          title: 'Pi VIP Navigation',
          companyName: 'Pi VIP Rideshare',
        }}
      >
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <RootNavigator />
      </NavigationProvider>
    </GestureHandlerRootView>
  );
}