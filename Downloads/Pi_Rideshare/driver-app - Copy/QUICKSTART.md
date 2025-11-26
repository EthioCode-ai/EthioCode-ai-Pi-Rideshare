# 🚀 QUICK START GUIDE

Get the Pi VIP Driver app running in 10 minutes!

---

## ⚡ Fast Setup (5 Steps)

### Step 1: Install Dependencies (2 min)

```bash
cd mobile-driver
npm install
```

Wait for installation to complete...

---

### Step 2: Get Google Maps API Key (3 min)

1. Go to: https://console.cloud.google.com/
2. Create new project (or select existing)
3. Enable APIs:
   - Maps SDK for Android ✅
   - Geocoding API ✅
4. Create API Key: Credentials → Create → API Key
5. Copy your key

**⚠️ IMPORTANT:** You need to add billing info to Google Cloud (free tier available)

---

### Step 3: Add API Key (1 min)

**Edit `app.json`** (line 36):
```json
"googleMaps": {
  "apiKey": "PASTE_YOUR_KEY_HERE"
}
```

**Edit `src/config/environment.ts`** (line 21):
```typescript
GOOGLE_MAPS_API_KEY: 'PASTE_YOUR_KEY_HERE',
```

---

### Step 4: Start Android Emulator (2 min)

**Option A: Android Studio Emulator**
1. Open Android Studio
2. Tools → Device Manager → Play button
3. Wait for emulator to start

**Option B: Physical Phone**
1. Enable USB Debugging on your Android phone
2. Connect via USB

---

### Step 5: Run the App (2 min)

```bash
npm start
```

Then press `a` to launch on Android!

---

## ✅ First Launch Checklist

When app opens:

1. ✅ See "Pi VIP Driver" splash screen
2. ✅ Login screen appears
3. ✅ Can tap "Sign Up"
4. ✅ Fill registration form
5. ✅ Submit (creates account on backend)
6. ✅ Login with credentials
7. ✅ Grant location permission when prompted
8. ✅ See Google Maps on Home screen
9. ✅ Toggle "Online" switch
10. ✅ See your location marker on map

---

## 🐛 Quick Fixes

**Maps not showing?**
```bash
# Check API key is correct
# Enable billing in Google Cloud
# Restart app: Press R in terminal
```

**"Unable to resolve module"?**
```bash
npm install
npm start -- --clear
```

**Backend not connecting?**
- Check: Backend running at localhost:3001 OR
- Using production URL (already in config)

**Location not working?**
- Grant "Allow all the time" permission
- Check GPS is enabled on device

---

## 🎯 What's Working in Phase 1

✅ **Authentication**
- Login
- Signup (driver registration)
- Password reset
- JWT token storage

✅ **Home Screen**
- Google Maps integration
- Real-time GPS tracking
- Online/Offline toggle
- Location updates

✅ **Backend Integration**
- API connection
- Socket.IO real-time connection
- Driver status updates
- Location broadcasting

---

## 📱 Test the App

1. **Create Account:**
   - Tap "Sign Up"
   - Fill all fields (use fake data for testing)
   - Submit

2. **Login:**
   - Use your credentials
   - Should navigate to Home screen

3. **Location:**
   - Grant permission
   - See your location on map
   - Blue dot should move as you move

4. **Go Online:**
   - Toggle switch
   - Status changes to "Online" (green)
   - Console shows "Socket connected"

5. **Check Logs:**
```bash
# In terminal where you ran npm start
# Look for:
# - "Socket connected" ✅
# - No red errors ✅
# - Location updates ✅
```

---

## 🔥 Common First-Run Issues

### Issue: Black screen
**Fix:** Press `R` in terminal to reload

### Issue: "Network request failed"
**Fix:** 
- Change to production URL in `environment.ts`:
- Set `MODE: 'production'`

### Issue: Google Maps gray screen
**Fix:**
- API key incorrect
- Billing not enabled in Google Cloud
- APIs not enabled

### Issue: Location permission denied
**Fix:**
- Settings → Apps → Pi VIP Driver → Permissions
- Enable Location → "Allow all the time"

---

## 📞 Still Having Issues?

Check the full README.md for detailed troubleshooting.

Console logs are your friend! Look for:
- ❌ Red errors = Something's wrong
- ⚠️ Yellow warnings = Usually okay
- ✅ Green/normal text = All good

---

## 🎉 Success!

If you see:
- ✅ Maps loading
- ✅ Your location showing
- ✅ Can toggle online/offline
- ✅ "Socket connected" in logs

**CONGRATULATIONS! Phase 1 is complete!** 🎊

Ready for Phase 2: Ride acceptance, active rides, earnings dashboard!

---

**Quick Commands:**

```bash
# Run app
npm start → press 'a'

# Clear cache
npm start -- --clear

# Stop
Ctrl + C

# Reload app
Press 'r' in terminal or shake device
```
