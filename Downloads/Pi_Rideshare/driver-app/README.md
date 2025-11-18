# Pi VIP Driver App - React Native

Mobile app for Pi VIP Rideshare drivers built with React Native and Expo.

## 🚀 Phase 1 - Project Foundation Complete!

### ✅ What's Built

- ✅ Expo React Native + TypeScript project
- ✅ Complete folder structure
- ✅ Navigation (Auth + Main stacks)
- ✅ Service layer (API, Socket.IO, Auth, Location, Storage)
- ✅ Authentication screens (Splash, Login, Signup, Forgot Password)
- ✅ Home screen with Google Maps
- ✅ GPS tracking
- ✅ Real-time Socket.IO connection
- ✅ Backend API integration

---

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** or **yarn**
- **Android Studio** (for Android development)
- **Java Development Kit (JDK)** (for Android)
- **Git**

---

## 🛠️ Setup Instructions

### 1. Install Dependencies

```bash
cd mobile-driver
npm install
```

### 2. Configure Environment

Open `src/config/environment.ts` and update:

#### Backend URLs
- Already configured with your Replit production URL
- For local testing, change `MODE` to `'development'`

#### Google Maps API Key
You need to get a Google Maps API key:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable these APIs:
   - Maps SDK for Android
   - Maps SDK for iOS
   - Geocoding API
   - Places API
4. Create credentials → API Key
5. Copy your API key

Then update in **TWO places**:

**File 1: `app.json`**
```json
"android": {
  "config": {
    "googleMaps": {
      "apiKey": "YOUR_GOOGLE_MAPS_API_KEY_HERE"
    }
  }
}
```

**File 2: `src/config/environment.ts`**
```typescript
GOOGLE_MAPS_API_KEY: 'YOUR_GOOGLE_MAPS_API_KEY_HERE',
```

### 3. Setup Android Emulator (Recommended)

1. Open Android Studio
2. Go to: Tools → Device Manager
3. Create Virtual Device → Select a phone (e.g., Pixel 5)
4. Download a system image (e.g., Android 13 - Tiramisu)
5. Finish setup and start the emulator

---

## 🚀 Running the App

### Option 1: Android Emulator (Recommended)

```bash
npm start
# Then press 'a' to open on Android emulator
```

### Option 2: Physical Android Device

1. Enable Developer Options on your phone:
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times
   - Go back → Developer Options → Enable "USB Debugging"

2. Connect your phone via USB

3. Run:
```bash
npm start
# Then press 'a' to open on Android device
```

### Option 3: Expo Go (Quick Testing)

1. Install Expo Go app from Play Store
2. Run:
```bash
npm start
# Scan the QR code with Expo Go app
```

---

## 📱 Testing the App

### Test User Credentials (Development)

Create a test account through the app or use existing backend test accounts.

### Test Flow

1. **Launch App** → Should show splash screen
2. **Login/Signup** → Create driver account
3. **Home Screen** → Should show Google Maps
4. **Allow Location** → Grant permission when prompted
5. **Go Online** → Toggle switch to go online
6. **GPS Tracking** → Should see your location on map
7. **Socket Connection** → Check console for "Socket connected"

---

## 🔍 Debugging

### Check Backend Connection

The app connects to:
- **Development:** `http://localhost:3001`
- **Production:** `https://c3ae5066-b07d-4ca3-8a63-d0ea5329a006-00-3c9c4iku143gi.sisko.replit.dev`

To test backend:
```bash
# In browser or Postman
GET https://c3ae5066-b07d-4ca3-8a63-d0ea5329a006-00-3c9c4iku143gi.sisko.replit.dev/api/health
```

### View Logs

```bash
npm start
# Logs appear in terminal
# Or use React Native Debugger
```

### Common Issues

**Issue: "Unable to resolve module"**
```bash
npm install
# Clear cache
npm start -- --clear
```

**Issue: "Google Maps not showing"**
- Check API key is set in both `app.json` and `environment.ts`
- Enable required APIs in Google Cloud Console
- Add billing to Google Cloud project (required for Maps)

**Issue: "Location permission denied"**
- Go to phone Settings → Apps → Pi VIP Driver → Permissions
- Enable Location (Allow all the time for background tracking)

**Issue: "Socket not connecting"**
- Check backend is running
- Check `SOCKET_URL` in `environment.ts`
- Check network/firewall settings

---

## 📂 Project Structure

```
mobile-driver/
├── src/
│   ├── config/
│   │   └── environment.ts          # API URLs, config
│   ├── services/
│   │   ├── api.service.ts          # HTTP requests
│   │   ├── auth.service.ts         # Authentication
│   │   ├── socket.service.ts       # Socket.IO
│   │   ├── location.service.ts     # GPS tracking
│   │   └── storage.service.ts      # AsyncStorage
│   ├── screens/
│   │   ├── SplashScreen.tsx        # Splash screen
│   │   ├── LoginScreen.tsx         # Login
│   │   ├── SignupScreen.tsx        # Driver registration
│   │   ├── ForgotPasswordScreen.tsx # Password reset
│   │   └── HomeScreen.tsx          # Main map screen
│   ├── navigation/
│   │   └── RootNavigator.tsx       # Navigation setup
│   └── types/
│       └── index.ts                # TypeScript types
├── App.tsx                          # Entry point
├── package.json                     # Dependencies
├── tsconfig.json                    # TypeScript config
└── app.json                         # Expo config
```

---

## 🎯 Next Steps (Phase 2)

After Phase 1 is working, we'll add:

- [ ] Ride acceptance flow
- [ ] Active ride screen with navigation
- [ ] Driver earnings dashboard
- [ ] Document upload (license, insurance, etc.)
- [ ] Profile management
- [ ] Push notifications
- [ ] Chat with riders

---

## 📞 Need Help?

If you encounter issues:

1. Check console logs for errors
2. Verify backend is running
3. Confirm Google Maps API key is valid
4. Check location permissions are granted
5. Try clearing cache: `npm start -- --clear`

---

## 🔧 Development Commands

```bash
# Start development server
npm start

# Run on Android
npm run android

# Clear cache and restart
npm start -- --clear

# Install new dependency
npm install <package-name>

# Type check
npx tsc --noEmit
```

---

## ✅ Phase 1 Checklist

Before moving to Phase 2, verify:

- [ ] App launches without errors
- [ ] Login screen appears
- [ ] Can create driver account
- [ ] Login with credentials works
- [ ] Home screen shows Google Maps
- [ ] GPS location is accurate
- [ ] Can toggle online/offline
- [ ] Socket.IO connects (check logs)
- [ ] No console errors

---

**Status:** Phase 1 Complete ✅  
**Next:** Phase 2 - Core Driver Features
