import { Geolocation } from '@capacitor/geolocation';
import { PushNotifications } from '@capacitor/push-notifications';
import { Network } from '@capacitor/network';
import { App } from '@capacitor/app';

export async function initializePlugins() {
  // Request location permissions
  try {
    const permissions = await Geolocation.requestPermissions();
    console.log('📍 Location permissions:', permissions);
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

  // Monitor network status
  Network.addListener('networkStatusChange', status => {
    console.log('🌐 Network status changed:', status);
  });

  // Handle app state changes
  App.addListener('appStateChange', ({ isActive }) => {
    console.log('📱 App state changed. Active:', isActive);
  });

  // Listen for push notification events
  PushNotifications.addListener('registration', token => {
    console.log('🔑 Push token:', token.value);
    // Send token to server for push notifications
  });

  PushNotifications.addListener('pushNotificationReceived', notification => {
    console.log('📬 Push notification received:', notification);
  });

  PushNotifications.addListener('pushNotificationActionPerformed', action => {
    console.log('👆 Push notification action:', action);
  });
}
