import React from 'react';
import { StatusBar } from 'react-native';
// TODO: Re-enable after rebuilding development build with native modules
// import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  console.log('App starting with authentication...');
  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* TODO: Re-enable SafeAreaProvider after running: npx expo prebuild --clean && npx expo run:android */}
      {/* <SafeAreaProvider> */}
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <RootNavigator />
      {/* </SafeAreaProvider> */}
    </GestureHandlerRootView>
  );
}