# Pi VIP Rideshare - Native Mobile Apps Setup Guide

## 📦 Package Contents

You have received two separate native mobile app packages:

### 1. **pi-vip-rider-complete.tar.gz** (Rider App)
- **App ID**: `com.pivip.rideshare.rider`
- **App Name**: Pi VIP Rider
- **Theme**: Blue (#3b82f6)
- **For**: Passengers booking rides
- **Includes**: rider-app/ + shared/ folder

### 2. **pi-vip-driver-complete.tar.gz** (Driver App)
- **App ID**: `com.pivip.rideshare.driver`
- **App Name**: Pi VIP Driver
- **Theme**: Green (#10b981)
- **For**: Drivers accepting and completing rides
- **Includes**: driver-app/ + shared/ folder

**⚠️ Important**: Both archives include the `shared/` folder which contains components, services, and utilities used by both apps.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- iOS: macOS with Xcode 15+
- Android: Android Studio installed
- Capacitor CLI: `npm install -g @capacitor/cli`

### Step 1: Extract the Archives

```bash
# Extract Rider App
mkdir pi-rider && tar -xzf pi-vip-rider-complete.tar.gz -C pi-rider
cd pi-rider

# Extract Driver App (in separate directory)
mkdir pi-driver && tar -xzf pi-vip-driver-complete.tar.gz -C pi-driver
cd pi-driver
```

**Note**: Each archive extracts to `rider-app/` or `driver-app/` plus `shared/` folder.

### Step 2: Install Dependencies

Each app needs its dependencies installed:

```bash
# In rider app directory
npm install

# In driver app directory
npm install
```

**Note**: Both apps share the same dependencies from the root `node_modules`, so you may need to install them from the project root first.

---

## 📱 Building for iOS

### Rider App - iOS

```bash
cd pi-rider

# 1. Build the web app
npm run build

# 2. Add iOS platform (first time only)
npm run cap:add:ios

# 3. Sync web build to native app
npm run cap:sync

# 4. Open in Xcode
npm run cap:open:ios
```

**In Xcode:**
1. Select your development team (Signing & Capabilities)
2. Select a connected iOS device or simulator
3. Click Run (▶️)

### Driver App - iOS

```bash
cd pi-driver

# Same steps as rider app
npm run build
npm run cap:add:ios
npm run cap:sync
npm run cap:open:ios
```

---

## 🤖 Building for Android

### Rider App - Android

```bash
cd pi-rider

# 1. Build the web app
npm run build

# 2. Add Android platform (first time only)
npm run cap:add:android

# 3. Sync web build to native app
npm run cap:sync

# 4. Open in Android Studio
npm run cap:open:android
```

**In Android Studio:**
1. Wait for Gradle sync to complete
2. Select a connected Android device or emulator
3. Click Run (▶️)

### Driver App - Android

```bash
cd pi-driver

# Same steps as rider app
npm run build
npm run cap:add:android
npm run cap:sync
npm run cap:open:android
```

---

## 🔄 Development Workflow

### Live Development (Web Preview)

```bash
# Rider App
cd pi-rider
npm run dev
# Opens at http://localhost:5000

# Driver App
cd pi-driver
npm run dev
# Opens at http://localhost:5001
```

### Syncing Changes to Native Apps

After making code changes:

```bash
npm run build
npm run cap:sync
```

Then rebuild in Xcode/Android Studio.

---

## 🔐 iOS App Store Submission

### Compliance Configuration ✅

Both apps include **required compliance elements** for App Store submission:

**⚠️ Note**: Apps need to be built and tested on real devices before submission. The following configurations are in place:

1. **Privacy Manifest** (`ios/App/App/PrivacyInfo.xcprivacy`)
   - Location data collection documented
   - API usage reasons declared
   - Third-party SDKs listed

2. **Permission Descriptions** (`ios/App/App/Info.plist`)
   - Location: Ride tracking and navigation
   - Camera: Profile photos and verification
   - Notifications: Ride updates

3. **Native Features**
   - ✅ Real-time GPS tracking
   - ✅ Push notifications
   - ✅ Background location (driver app)
   - ✅ Network status monitoring
   - ✅ Camera access

4. **App-Like Experience**
   - Native navigation
   - Mobile-optimized UI
   - Offline support
   - Real-time features

### Submission Steps

1. **Xcode Archive**:
   - Product → Archive
   - Distribute App → App Store Connect
   - Upload

2. **App Store Connect**:
   - Add app metadata
   - Upload screenshots (6.5" and 5.5" iPhone)
   - Add privacy policy URL
   - Submit for review

---

## 🤖 Google Play Store Submission

### Rider App

1. **Generate Signed APK** in Android Studio
2. **Upload to Google Play Console**
3. **Add Store Listing**:
   - Description
   - Screenshots
   - App icon

### Driver App

Same process as Rider app.

---

## 🔧 Configuration

### Environment Variables

Both apps need access to the backend server. Set in `.env` files:

```env
VITE_API_URL=https://your-backend-api.com
VITE_SOCKET_URL=https://your-backend-api.com
VITE_GMAPS_KEY=your-google-maps-key
```

### Backend Server

Ensure your backend server is running and accessible at the API URL. Both apps connect to the same backend on port 3001 (or your production URL).

---

## 📊 Key Differences Between Apps

| Feature | Rider App | Driver App |
|---------|-----------|------------|
| **Background Location** | No | Yes (always) |
| **Ride Requests** | Send | Receive |
| **Navigation** | View only | Turn-by-turn |
| **Earnings** | No | Yes |
| **Pi Assistant** | Voice booking | Voice FAQ |
| **Theme Color** | Blue | Green |

---

## 🐛 Troubleshooting

### Build Errors

1. **TypeScript errors**: Run `npm install` first
2. **Capacitor sync fails**: Delete `ios/` and `android/` folders, run `cap:add` again
3. **Import errors**: Ensure shared folder is accessible

### Runtime Issues

1. **Location not working**: Check permissions in Settings
2. **Push notifications fail**: Ensure FCM/APNs configured
3. **Map not loading**: Verify Google Maps API key

### Common Fixes

```bash
# Clean and rebuild
rm -rf node_modules dist ios android
npm install
npm run build
npm run cap:add:ios
npm run cap:add:android
```

---

## 📚 Architecture

```
pi-vip-rideshare/
├── rider-app/          # Rider mobile app
│   ├── src/
│   │   ├── pages/      # RiderApp.tsx
│   │   ├── components/ # Rider-specific components
│   │   └── plugins.ts  # Capacitor plugin initialization
│   ├── ios/            # iOS native project (generated)
│   ├── android/        # Android native project (generated)
│   └── capacitor.config.ts
│
├── driver-app/         # Driver mobile app
│   ├── src/
│   │   ├── pages/      # DriverApp.tsx
│   │   ├── components/ # Driver-specific components
│   │   └── plugins.ts  # Capacitor plugin initialization
│   ├── ios/            # iOS native project (generated)
│   ├── android/        # Android native project (generated)
│   └── capacitor.config.ts
│
└── shared/             # Shared code (if extracted)
    ├── components/     # Shared UI components
    ├── services/       # API services
    └── utils/          # Utilities
```

---

## ✅ Next Steps

1. **Test on Real Devices**: Always test native features (GPS, push) on physical devices
2. **Configure Firebase**: Set up FCM for push notifications
3. **App Store Assets**: Prepare icons, screenshots, descriptions
4. **Backend Deployment**: Ensure production backend is accessible
5. **Submit for Review**: Follow App Store and Play Store guidelines

---

## 📞 Support

For issues or questions:
- Check app-specific README.md files
- Review Capacitor docs: https://capacitorjs.com
- iOS guidelines: https://developer.apple.com/app-store/review/guidelines/

---

**Built with**:
- ⚛️ React 18 + TypeScript
- ⚡ Vite
- 📱 Capacitor 7
- 🗺️ Google Maps
- 🔌 Socket.IO
- 💳 Stripe

Both apps are configured for native mobile deployment with all compliance elements in place. Build and test on real devices before production use! 🚀
