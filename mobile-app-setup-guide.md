# Pi VIP Rideshare - Mobile App Backend Connection Guide

## 🔌 Backend API Integration

Your mobile apps (Rider & Driver) connect to the centralized backend server running on Replit. Here's how everything is wired together:

### **Backend Architecture**

**Backend Server URL**: `https://c3ae5066-b07d-4ca3-8a63-d0ea5329a006-00-3c9c4iku143gi.sisko.replit.dev`

The backend handles:
- ✅ **PostgreSQL Database** - All ride data, users, payments stored securely
- ✅ **JWT Authentication** - Secure user login/signup
- ✅ **Stripe Payments** - Payment processing via secure server endpoints
- ✅ **Twilio SMS** - Notifications sent from server
- ✅ **OpenAI API** - Pi Assistant chatbot powered by server
- ✅ **OpenWeather API** - Weather data fetched server-side
- ✅ **Google Maps Geocoding** - Address validation on server
- ✅ **Socket.IO** - Real-time ride updates and driver tracking
- ✅ **Admin Dashboard** - Full operations management

### **API Endpoints Available**

#### **Authentication**
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login (returns JWT token)
- `POST /api/auth/verify` - Verify JWT token

#### **Rides**
- `POST /api/rides/request` - Request a new ride
- `GET /api/rides/active` - Get active rides for user
- `GET /api/rides/history` - Get ride history
- `POST /api/rides/:id/complete` - Complete a ride
- `POST /api/rides/:id/cancel` - Cancel a ride

#### **Driver**
- `POST /api/driver/availability` - Update driver online/offline status
- `POST /api/driver/location` - Update driver GPS location
- `GET /api/driver/earnings` - Get driver earnings
- `POST /api/driver/accept-ride` - Accept a ride request

#### **Payments (via Stripe)**
- `POST /api/payment/create-intent` - Create Stripe payment intent
- `POST /api/payment/methods` - Add payment method
- `GET /api/payment/methods` - Get saved payment methods

#### **Pi Assistant (OpenAI)**
- `POST /api/chat/send` - Send message to Pi Assistant
- `POST /api/chat/voice` - Voice input to Pi Assistant

#### **Weather & Traffic**
- `GET /api/weather?lat=&lng=` - Get weather for location
- `GET /api/traffic?origin=&destination=` - Get traffic data

#### **Admin Dashboard**
- `GET /api/admin/stats` - Platform statistics
- `GET /api/admin/drivers` - All drivers
- `GET /api/admin/rides` - All rides
- `POST /api/admin/disputes/resolve` - Resolve disputes

### **Real-Time Features (Socket.IO)**

The mobile apps connect to Socket.IO for real-time updates:

```javascript
// Socket.IO events the apps listen to:
socket.on('ride-request', (data) => {}) // Driver receives ride request
socket.on('ride-accepted', (data) => {}) // Rider notified driver accepted
socket.on('driver-location', (data) => {}) // Live driver GPS updates
socket.on('ride-status', (data) => {}) // Ride status changes
socket.on('driver-availability-update', (data) => {}) // Driver online/offline
```

### **Environment Configuration**

#### **1. Configure Backend URL**

Edit these files in your mobile apps:

**`rider-app/.env.production`**
```env
VITE_API_URL=https://c3ae5066-b07d-4ca3-8a63-d0ea5329a006-00-3c9c4iku143gi.sisko.replit.dev
VITE_SOCKET_URL=https://c3ae5066-b07d-4ca3-8a63-d0ea5329a006-00-3c9c4iku143gi.sisko.replit.dev
VITE_GOOGLE_MAPS_API_KEY=your_key_here
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

**`driver-app/.env.production`**
```env
VITE_API_URL=https://c3ae5066-b07d-4ca3-8a63-d0ea5329a006-00-3c9c4iku143gi.sisko.replit.dev
VITE_SOCKET_URL=https://c3ae5066-b07d-4ca3-8a63-d0ea5329a006-00-3c9c4iku143gi.sisko.replit.dev
VITE_GOOGLE_MAPS_API_KEY=your_key_here
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

#### **2. Required API Keys**

**Client-Side (in mobile apps):**
- Google Maps API Key - For maps display
- Stripe Publishable Key - For payment UI

**Server-Side (already on backend):**
- ✅ Database URL (PostgreSQL Neon)
- ✅ JWT Secret (authentication)
- ✅ Stripe Secret Key (payments)
- ✅ Twilio credentials (SMS)
- ✅ OpenAI API Key (Pi Assistant)
- ✅ OpenWeather API Key (weather)

### **Security Architecture**

**✅ Secure Design:**
- Mobile apps only contain PUBLIC keys (Google Maps, Stripe Publishable)
- All SECRET keys stay on backend server
- Mobile apps make authenticated API calls to backend
- Backend validates JWT tokens before processing requests
- Backend handles all sensitive operations (payments, SMS, AI)

**❌ Never Put in Mobile Apps:**
- Database credentials
- Stripe Secret Key
- Twilio Auth Token
- OpenAI API Key
- JWT Secret

### **Testing Backend Connection**

#### **1. Start Backend Server**
```bash
npm run dev:all
```

#### **2. Test API Endpoint**
```bash
curl https://c3ae5066-b07d-4ca3-8a63-d0ea5329a006-00-3c9c4iku143gi.sisko.replit.dev/api/health
```

Should return: `{"status": "ok", "database": "connected"}`

#### **3. Build Mobile App with Backend**
```bash
cd rider-app
npm run build  # Uses .env.production
npx cap sync
```

### **Admin Dashboard Access**

The Admin Dashboard is accessible at:
```
https://c3ae5066-b07d-4ca3-8a63-d0ea5329a006-00-3c9c4iku143gi.sisko.replit.dev/dashboard
```

**Login Credentials:**
- Username: `admin@pivip.com`
- Password: Check backend environment variables

### **Database Access**

The PostgreSQL database is hosted on Neon and accessible via:
- Direct connection string in `DATABASE_URL` environment variable
- Backend API endpoints that query the database
- Admin Dashboard for viewing/managing data

**Tables:**
- `users` - All riders and drivers
- `rides` - Ride requests and history
- `driver_verification` - Driver documents and approval status
- `payments` - Payment transactions
- `corporate_discounts` - Workplace discount programs
- `airport_queue` - Airport driver queue management

### **Deployment Checklist**

Before deploying mobile apps to production:

- [ ] Update `.env.production` with actual API keys
- [ ] Replace Replit dev domain with production domain (if different)
- [ ] Test all API endpoints from mobile device
- [ ] Verify Socket.IO real-time connection works
- [ ] Test payments with Stripe test mode
- [ ] Confirm Pi Assistant responds
- [ ] Verify Google Maps displays correctly
- [ ] Test authentication flow (signup/login)

### **Troubleshooting**

**Mobile app can't connect to backend:**
- Check backend server is running (`npm run dev:all`)
- Verify CORS is enabled on backend (already configured)
- Check `.env.production` has correct backend URL
- Ensure mobile device/emulator has internet connection

**Socket.IO not connecting:**
- Confirm `VITE_SOCKET_URL` in `.env.production`
- Check backend Socket.IO server is running (port 3001)
- Verify CORS settings allow WebSocket connections

**API returns 401 Unauthorized:**
- Check JWT token is being sent in request headers
- Verify token hasn't expired (re-login)
- Confirm backend JWT_SECRET matches token signature

**Payments failing:**
- Verify Stripe keys are correct (test/production)
- Check backend Stripe webhook is configured
- Confirm payment methods are properly saved

---

## 📱 Quick Start Commands

```bash
# Build Rider App with backend connection
cd rider-app
npm install
npm run build
npx cap add android
npx cap sync

# Build Driver App with backend connection  
cd driver-app
npm install
npm run build
npx cap add android
npx cap sync
```

Your mobile apps are now fully connected to the backend with all APIs functional! 🚀
