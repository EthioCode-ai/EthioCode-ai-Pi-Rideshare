import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pivip.rideshare.driver',
  appName: 'Pi VIP Driver',
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
      backgroundColor: "#10b981",
      androidScaleType: "CENTER_CROP",
      showSpinner: false
    },
    BackgroundGeolocation: {
      desiredAccuracy: 0,
      distanceFilter: 10,
      stopOnTerminate: false,
      startOnBoot: true
    }
  }
};

export default config;
