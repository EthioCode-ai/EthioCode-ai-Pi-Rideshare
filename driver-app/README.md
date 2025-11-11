# Pi VIP Rideshare - Driver App

Native mobile app for drivers to accept rides and navigate to passengers.

## Features
- 📍 Background GPS tracking
- 🚗 Real-time ride requests
- 🗺️ Turn-by-turn navigation
- 💰 Earnings tracking
- 🔔 Push notifications for ride requests
- 🌐 Offline support

## Build Instructions

### Development
```bash
npm install
npm run dev
```

### Build for Production
```bash
npm run build
```

### iOS Build
1. Build the web app:
   ```bash
   npm run build
   ```

2. Add iOS platform:
   ```bash
   npm run cap:add:ios
   ```

3. Sync changes:
   ```bash
   npm run cap:sync
   ```

4. Open in Xcode:
   ```bash
   npm run cap:open:ios
   ```

5. In Xcode:
   - Select your development team
   - Connect your device
   - Click Run

### Android Build
1. Build the web app:
   ```bash
   npm run build
   ```

2. Add Android platform:
   ```bash
   npm run cap:add:android
   ```

3. Sync changes:
   ```bash
   npm run cap:sync
   ```

4. Open in Android Studio:
   ```bash
   npm run cap:open:android
   ```

5. In Android Studio:
   - Wait for Gradle sync
   - Connect your device
   - Click Run

## App Configuration
- **App ID**: `com.pivip.rideshare.driver`
- **App Name**: Pi VIP Driver
- **Theme Color**: Green (#10b981)

## Native Features
- Background Geolocation Tracking
- Push Notifications (ride requests)
- Network Status Monitoring
- Camera (document verification)

## Privacy & Permissions
The app requests:
- **Location (Always)**: For continuous driver tracking during rides
- **Notifications**: For ride request alerts
- **Camera**: For driver license and vehicle verification

See `ios/App/App/PrivacyInfo.xcprivacy` for full privacy manifest.

## Background Location
This app uses background location tracking to:
- Accept ride requests while app is backgrounded
- Provide real-time location to riders during active trips
- Navigate to pickup and dropoff locations
