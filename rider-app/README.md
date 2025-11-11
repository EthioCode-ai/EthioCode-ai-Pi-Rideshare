# Pi VIP Rideshare - Rider App

Native mobile app for riders to book and track rides.

## Features
- 📍 Real-time GPS location
- 🚗 Live driver tracking
- 💳 Multiple payment methods
- 🗣️ Voice-enabled Pi Assistant
- 🔔 Push notifications
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
- **App ID**: `com.pivip.rideshare.rider`
- **App Name**: Pi VIP Rider
- **Theme Color**: Blue (#3b82f6)

## Native Features
- Geolocation (foreground/background)
- Push Notifications
- Network Status Monitoring
- Camera (profile photos)

## Privacy & Permissions
The app requests:
- **Location**: To show nearby drivers and track rides
- **Notifications**: For ride updates and driver arrivals
- **Camera**: For profile photos

See `ios/App/App/PrivacyInfo.xcprivacy` for full privacy manifest.
