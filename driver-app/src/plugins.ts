import { Geolocation } from '@capacitor/geolocation';
import { PushNotifications } from '@capacitor/push-notifications';
import { Network } from '@capacitor/network';
import { App } from '@capacitor/app';

export async function initializePlugins() {
  // Request location permissions (always and when in use for background tracking)
  try {
    const permissions = await Geolocation.requestPermissions();
    console.log('📍 Location permissions:', permissions);
    
    // Check current location to verify
    const position = await Geolocation.getCurrentPosition();
    console.log('📍 Current position:', position.coords);
  } catch (error) {
    console.error('❌ Location permission error:', error);
  }

  // Request push notification permissions
  try {
    const result = await PushNotifications.requestPermissions();
    if (result.receive === 'granted') {
      await PushNotifications.register();
      console.log('🔔 Push notifications enabled');
    }
  } catch (error) {
    console.error('❌ Push notification error:', error);
  }

  // Monitor network status (critical for drivers)
  Network.addListener('networkStatusChange', status => {
    console.log('🌐 Network status changed:', status);
    if (!status.connected) {
      console.warn('⚠️ Network disconnected - ride updates may be delayed');
    }
  });

  // Handle app state changes
  App.addListener('appStateChange', ({ isActive }) => {
    console.log('📱 App state changed. Active:', isActive);
    if (!isActive) {
      console.log('📱 App backgrounded - background location tracking active');
    }
  });

  // Listen for push notification events (ride requests)
  PushNotifications.addListener('registration', token => {
    console.log('🔑 Push token:', token.value);
    // Send token to server for ride request notifications
  });

  PushNotifications.addListener('pushNotificationReceived', notification => {
    console.log('📬 Push notification received:', notification);
    // Handle new ride request notifications
  });

  PushNotifications.addListener('pushNotificationActionPerformed', action => {
    console.log('👆 Push notification action:', action);
    // Handle ride acceptance from notification
  });
}
