import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pivip.rideshare.rider',
  appName: 'Pi VIP Rider',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#3b82f6",
      androidScaleType: "CENTER_CROP",
      showSpinner: false
    }
  }
};

export default config;
