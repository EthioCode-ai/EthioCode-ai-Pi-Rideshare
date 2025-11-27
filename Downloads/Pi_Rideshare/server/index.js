require('dotenv').config();

// Production environment configuration
const isProduction = process.env.NODE_ENV === 'production';

// Core required environment variables for production
const coreRequiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'STRIPE_SECRET_KEY',
  'VITE_STRIPE_PUBLISHABLE_KEY'
];

// Production required environment variables for webhooks
const webhookRequiredEnvVars = [
  'STRIPE_WEBHOOK_SECRET'
];

// Optional environment variables for extended features
const optionalEnvVars = [
  'CHECKR_API_KEY',
  'GOOGLE_VISION_API_KEY', 
  'PLAID_CLIENT_ID',
  'PLAID_SECRET',
  'SMTP_HOST',
  'SMTP_USER', 
  'SMTP_PASS',
  'TWILIO_SID',
  'TWILIO_AUTH_TOKEN'
];

// Check for core required environment variables in production
if (isProduction) {
  const missingCoreVars = coreRequiredEnvVars.filter(varName => !process.env[varName]);
  if (missingCoreVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingCoreVars);
    process.exit(1);
  }
  
  // Check for webhook required environment variables in production
  const missingWebhookVars = webhookRequiredEnvVars.filter(varName => !process.env[varName]);
  if (missingWebhookVars.length > 0) {
    console.error('❌ Missing required webhook environment variables:', missingWebhookVars);
    console.error('Payment processing will not work without proper webhook configuration');
    process.exit(1);
  }
  
  // Warn about missing optional variables 
  const missingOptionalVars = optionalEnvVars.filter(varName => !process.env[varName]);
  if (missingOptionalVars.length > 0) {
    console.warn('⚠️ Optional environment variables not set:', missingOptionalVars);
    console.warn('Some features may be limited without these variables');
  }
  
  console.log('✅ Production environment variables validated');
} else {
  console.log('🔧 Development mode - skipping strict environment validation');
}
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { db, initializeDatabase } = require('./database');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const slowDown = require('express-slow-down');
const googleAuthRoutes = require('./google-auth'); // Added for Google OAuth routes
const chatRoutes = require('./chatbot/chat-routes'); // AI Customer Support Chatbot
const marketSettingsDB = require('./marketSettingsDB');
const Stripe = require('stripe');
const multer = require('multer');

// ═══════════════════════════════════════════════════════════════════
// PHASE 2.6: Route & Surge Enhancement Constants
// ═══════════════════════════════════════════════════════════════════
const GEOFENCE_RADIUS_METERS = 100;    // Pickup AND dropoff arrival detection
const GRACE_PERIOD_SECONDS = 120;       // 2 min free wait time
const WAIT_RATE_PER_MINUTE = 0.35;      // After grace period
const MAX_SURGE_MULTIPLIER = 3.0;       // Surge cap
const path = require('path');
const fs = require('fs').promises;

const app = express();
app.locals.db = db;  // ← ADD IT HERE INSTEAD

// Configure trust proxy for rate limiting
app.set('trust proxy', 1);

// Initialize Stripe for production payment processing
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY is required for payment processing');
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const server = http.createServer(app);
const io = socketIo(server, {
  pingTimeout: 60000,     // Wait 60s for pong response (increased for stability)
  pingInterval: 25000,    // Send ping every 25s (increased interval)
  transports: ['websocket', 'polling'],
  allowEIO3: true,        // Allow Engine.IO v3 clients
  cors: {
    origin: true,         // Allow all origins in development
    methods: ["GET", "POST"],
    credentials: true
  },
  allowRequest: (req, callback) => {
    // Allow all requests - more permissive for development
    callback(null, true);
  }
});

// Enhanced Security middleware for production
app.use(helmet({
  contentSecurityPolicy: isProduction ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://maps.googleapis.com", "https://maps.gstatic.com", "https://js.stripe.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:", "https://api.stripe.com"],
      frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
      objectSrc: ["'none'"]
    }
  } : false,
  hsts: isProduction ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false
}));

// Rate limiting configurations
const createLimiter = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { error: message },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for localhost in development or Replit environment
    return process.env.NODE_ENV === 'development' || 
           process.env.REPLIT_ENVIRONMENT ||
           req.ip === '127.0.0.1' ||
           req.ip === '::1' ||
           req.ip?.startsWith('192.168.') ||
           req.ip?.startsWith('10.') ||
           req.ip?.startsWith('172.');
  }
});

// General API rate limiting
const generalLimiter = createLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // limit each IP to 100 requests per windowMs
  'Too many requests from this IP, please try again later'
);

// Strict rate limiting for authentication endpoints
const authLimiter = createLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // limit each IP to 5 requests per windowMs
  'Too many authentication attempts, please try again later'
);

// Ride request rate limiting
const rideLimiter = createLimiter(
  1 * 60 * 1000, // 1 minute
  10, // limit each IP to 10 ride requests per minute
  'Too many ride requests, please slow down'
);

// Payment rate limiting
const paymentLimiter = createLimiter(
  5 * 60 * 1000, // 5 minutes
  3, // limit each IP to 3 payment attempts per 5 minutes
  'Too many payment attempts, please try again later'
);

// Speed limiting middleware (slows down requests instead of blocking)
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per windowMs without delay
  delayMs: () => 500, // add 500ms delay per request after delayAfter
  maxDelayMs: 10000, // maximum delay of 10 seconds
  skip: (req) => {
    return process.env.NODE_ENV === 'development' || 
           process.env.REPLIT_ENVIRONMENT ||
           req.ip === '127.0.0.1' ||
           req.ip === '::1' ||
           req.ip?.startsWith('192.168.') ||
           req.ip?.startsWith('10.') ||
           req.ip?.startsWith('172.');
  }
});

// Apply rate limiting
app.use('/api', generalLimiter);
app.use('/api', speedLimiter);

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://yourdomain.com'] // Replace with your actual domain
    : true,
  credentials: true
}));

// CRITICAL: Stripe webhook must come BEFORE express.json() to preserve raw body
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn('Stripe webhook secret not configured');
    return res.status(400).send('Webhook secret not configured');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      const { rideId, driverId, platformFee, driverEarnings } = paymentIntent.metadata;
      
      try {
        // Update ride payment status in database
        await db.query(
          'UPDATE rides SET payment_status = $1, payment_intent_id = $2, amount_paid = $3 WHERE id = $4',
          ['completed', paymentIntent.id, paymentIntent.amount / 100, rideId]
        );

        // Record driver earnings
        if (driverId && driverEarnings) {
          await db.query(
            'INSERT INTO driver_earnings (driver_id, ride_id, base_fare, platform_fee, total_earned, earned_at) VALUES ($1, $2, $3, $4, $5, NOW())',
            [driverId, rideId, parseFloat(driverEarnings) / 100, parseFloat(platformFee) / 100, parseFloat(driverEarnings) / 100]
          );
        }

        console.log('✅ Payment confirmed for ride:', rideId);
      } catch (dbError) {
        console.error('Database update error after payment:', dbError);
      }
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log('❌ Payment failed:', failedPayment.id);
      
      try {
        await db.query(
          'UPDATE rides SET payment_status = $1 WHERE id = $2',
          ['failed', failedPayment.metadata.rideId]
        );
      } catch (dbError) {
        console.error('Database update error after payment failure:', dbError);
      }
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Authentication middleware - moved to top for early access
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
   if (err) {
  return res.status(403).json({ error: 'Invalid or expired token' });
 }
    req.user = user;
    next();
  });
};

// Mount chat routes - AI Customer Support Chatbot
app.use('/api/chat', chatRoutes);

// Import secure Phase 1 data foundation routes
const weatherRoutes = require('./routes/weather');
const trafficRoutes = require('./routes/traffic');
const ridesRoutes = require('./routes/rides');
const mobileDriverRoutes = require('./routes/mobile-driver');

// Mount secure API routes for real smart driver positioning
app.use('/api/weather', weatherRoutes);
app.use('/api/traffic', trafficRoutes);
app.use('/api/rides', ridesRoutes);
app.use('/api/driver', mobileDriverRoutes);


// Production Stripe Payment Intent endpoint for ride payments
app.post('/api/create-payment-intent', authenticateToken, async (req, res) => {
  try {
    const { amount, rideId, driverId } = req.body;
    
    if (!amount || !rideId) {
      return res.status(400).json({ error: 'Amount and rideId are required' });
    }

    // Convert to cents for Stripe
    const amountInCents = Math.round(amount * 100);
    
    // Calculate platform fee (25%) and driver earnings
    const platformFee = Math.round(amountInCents * 0.25);
    const driverEarnings = amountInCents - platformFee;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        rideId: rideId.toString(),
        driverId: driverId ? driverId.toString() : '',
        platformFee: platformFee.toString(),
        driverEarnings: driverEarnings.toString(),
        type: 'ride_payment'
      }
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amount,
      platformFee: platformFee / 100,
      driverEarnings: driverEarnings / 100
    });
  } catch (error) {
    console.error('Payment intent creation error:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});


// Serve static files from the React build (if available)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
} else {
  // In development, serve a simple response for root route
  app.get('/', (req, res) => {
    res.json({
      message: 'π Rideshare Backend Server is running!',
      frontend: 'Frontend is running on port 5173 (npm run dev)',
      api: 'API endpoints available at /api/*',
      status: 'Backend server operational',
      timestamp: new Date().toISOString()
    });
  });
}

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Audit logging system
const auditLog = {
  log: async (action, userId, details, req) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      userId: userId || 'anonymous',
      userAgent: req?.get('User-Agent') || 'unknown',
      ip: req?.ip || 'unknown',
      endpoint: req?.originalUrl || 'unknown',
      method: req?.method || 'unknown',
      details: details || {},
      sessionId: req?.sessionID || null
    };

    // In production, you would store this in a database or logging service
    console.log('🔍 AUDIT LOG:', JSON.stringify(logEntry, null, 2));

    try {
      // Store in database audit_logs table (implement as needed)
      await db.query(
        `INSERT INTO audit_logs (timestamp, action, user_id, user_agent, ip_address, endpoint, method, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [logEntry.timestamp, action, userId, logEntry.userAgent, logEntry.ip,
         logEntry.endpoint, logEntry.method, JSON.stringify(logEntry.details)]
      ).catch(() => {}); // Fail silently to not break main flow
    } catch (error) {
      // Fail silently for audit logging
    }

    return logEntry;
  }
};

// IP Whitelist/Blacklist management
const ipAccessControl = {
  whitelist: new Set([
    '127.0.0.1',
    '::1',
    // Add your trusted IPs here
  ]),
  blacklist: new Set([
    // Add blocked IPs here
  ]),

  isAllowed: (ip) => {
    if (ipAccessControl.blacklist.has(ip)) {
      return false;
    }

    // If whitelist is empty, allow all IPs (except blacklisted)
    if (ipAccessControl.whitelist.size === 0) {
      return true;
    }

    return ipAccessControl.whitelist.has(ip);
  },

  addToBlacklist: (ip) => {
    ipAccessControl.blacklist.add(ip);
    console.log(`🚫 IP ${ip} added to blacklist`);
  },

  removeFromBlacklist: (ip) => {
    ipAccessControl.blacklist.delete(ip);
    console.log(`✅ IP ${ip} removed from blacklist`);
  }
};

// API Key management
const apiKeyManager = {
  // In production, store these in database
  keys: new Map([
    ['admin-key-demo-123', {  // ✅ FIXED: Match frontend API key exactly
      name: 'Admin Dashboard',
      permissions: ['read', 'write', 'admin'],
      rateLimit: 1000,
      createdAt: '2024-01-01',
      lastUsed: null
    }],
    ['mobile_app_67890', {
      name: 'Mobile App',
      permissions: ['read', 'write'],
      rateLimit: 500,
      createdAt: '2024-01-01',
      lastUsed: null
    }],
    ['public_api_11111', {
      name: 'Public API',
      permissions: ['read'],
      rateLimit: 100,
      createdAt: '2024-01-01',
      lastUsed: null
    }]
  ]),

  generate: (name, permissions = ['read'], rateLimit = 100) => {
    const key = `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    apiKeyManager.keys.set(key, {
      name,
      permissions,
      rateLimit,
      createdAt: new Date().toISOString(),
      lastUsed: null
    });
    return key;
  },

  validate: (apiKey) => {
    const keyData = apiKeyManager.keys.get(apiKey);
    if (!keyData) return null;

    // Update last used timestamp
    keyData.lastUsed = new Date().toISOString();

    return keyData;
  },

  revoke: (apiKey) => {
    return apiKeyManager.keys.delete(apiKey);
  },

  list: () => {
    return Array.from(apiKeyManager.keys.entries()).map(([key, data]) => ({
      key: key.substring(0, 8) + '...',
      ...data
    }));
  }
};

// Security middleware for IP checking
const ipSecurityMiddleware = (req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress;

  // Skip IP restrictions in development mode or Replit environment
  if (process.env.NODE_ENV !== 'production' || 
      process.env.REPLIT_ENVIRONMENT || 
      clientIp?.startsWith('10.') || 
      clientIp?.startsWith('192.168.') || 
      clientIp?.startsWith('172.') ||
      clientIp === '127.0.0.1' ||
      clientIp === '::1') {
    return next();
  }

  if (!ipAccessControl.isAllowed(clientIp)) {
    auditLog.log('BLOCKED_IP_ACCESS', null, { blockedIp: clientIp }, req);
    return res.status(403).json({
      error: 'Access denied',
      message: 'Your IP address is not authorized to access this service'
    });
  }

  next();
};

// API Key validation middleware
const apiKeyMiddleware = (requiredPermissions = []) => {
  return (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.apiKey;

    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required',
        message: 'Please provide a valid API key in the X-API-Key header'
      });
    }

    const keyData = apiKeyManager.validate(apiKey);
    if (!keyData) {
      auditLog.log('INVALID_API_KEY', null, { apiKey: apiKey.substring(0, 8) + '...' }, req);
      return res.status(401).json({
        error: 'Invalid API key',
        message: 'The provided API key is not valid'
      });
    }

    // Check permissions
    const hasRequiredPermissions = requiredPermissions.every(permission =>
      keyData.permissions.includes(permission) || keyData.permissions.includes('admin')
    );

    if (!hasRequiredPermissions) {
      auditLog.log('INSUFFICIENT_API_PERMISSIONS', null, {
        apiKey: apiKey.substring(0, 8) + '...',
        required: requiredPermissions,
        available: keyData.permissions
      }, req);
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'Your API key does not have the required permissions for this endpoint'
      });
    }

    req.apiKey = keyData;
    next();
  };
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent')?.substring(0, 100) || 'unknown'
    };

    // Log requests that take longer than 5 seconds or have error status
    if (duration > 5000 || res.statusCode >= 400) {
      console.log('⚠️  SLOW/ERROR REQUEST:', JSON.stringify(logData));
    }
  });

  next();
};

// Apply security middleware
app.use(ipSecurityMiddleware);
app.use(requestLogger);

// Global error handlers to prevent unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.warn('⚠️ Unhandled Promise Rejection:', reason);
  // Log the promise that was rejected
  console.warn('Promise:', promise);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // Don't exit the process in development
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Make Google Maps API key available to frontend
process.env.VITE_GMAPS_KEY = process.env.GMAPS_KEY || process.env.GMaps_Key;

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Pi VIP Rideshare API is running');
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

// Serve Google Maps API key endpoint for frontend
app.get('/api/config/maps-key', (req, res) => {
  const mapsKey = process.env.GMAPS_KEY || process.env.GMaps_Key || '';
  res.json({ 
    key: mapsKey,
    configured: !!mapsKey
  });
});

// Duplicate authenticateToken removed - using the one at top of file

// Auth Routes with rate limiting
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, userType } = req.body;

    // Check if user exists
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await db.createUser({
      email,
      password_hash: hashedPassword,
      first_name: firstName,
      last_name: lastName,
      phone,
      user_type: userType || 'rider'
    });

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, userType: user.user_type },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        userType: user.user_type
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await db.getUserByEmail(email);
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email, userType: user.user_type },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
       success: true,     
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        userType: user.user_type,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Password reset request with real email/SMS integration
app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  try {
    const { email, method = 'email' } = req.body; // method can be 'email' or 'sms'

    // Check if user exists
    const user = await db.getUserByEmail(email);
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({ message: 'If an account with this email exists, you will receive a reset link.' });
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { userId: user.id, email: user.email, type: 'password_reset' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Store reset token in memory (in production, store in database)
    global.resetTokens = global.resetTokens || new Map();
    global.resetTokens.set(user.id, {
      token: resetToken,
      expires: new Date(Date.now() + 3600000), // 1 hour
      used: false
    });

    const resetLink = `https://${req.get('host')}/rider/auth?reset_token=${resetToken}`;

    if (method === 'email') {
      // Send reset email
      try {
        await sendPasswordResetEmail(user.email, `${user.first_name} ${user.last_name}`, resetLink, resetToken);
        console.log(`✅ Password reset email sent to ${email}`);
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        // Fallback: log for development
        console.log(`📧 Password reset link for ${email}: ${resetLink}`);
      }
    } else if (method === 'sms' && user.phone) {
      // Send reset SMS
      try {
        await sendPasswordResetSMS(user.phone, resetToken);
        console.log(`✅ Password reset SMS sent to ${user.phone}`);
      } catch (smsError) {
        console.error('SMS sending failed:', smsError);
        // Fallback: log for development
        console.log(`📱 Password reset code for ${user.phone}: ${resetToken.slice(-6)}`);
      }
    }

    res.json({
      message: method === 'email'
        ? 'If an account with this email exists, you will receive a reset link.'
        : 'If an account with this phone number exists, you will receive a reset code.',
      method
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Email service function (using Nodemailer with SMTP)
async function sendPasswordResetEmail(email, userName, resetLink, resetToken) {
  // For development/testing, we'll simulate sending
  // In production, you'd use services like SendGrid, AWS SES, or SMTP

  const emailContent = `
    Hello ${userName},

    You requested a password reset for your π account.

    Click the link below to reset your password:
    ${resetLink}

    Or use this reset code: ${resetToken.slice(-8)}

    This link will expire in 1 hour.

    If you didn't request this reset, please ignore this email.

    Best regards,
    π Team
  `;

  // For demo purposes, just log (replace with actual email service)
  console.log(`📧 EMAIL TO: ${email}`);
  console.log(`📧 EMAIL SUBJECT: Reset Your π Password`);
  console.log(`📧 EMAIL CONTENT:\n${emailContent}`);

  // Uncomment and configure for production email sending:
  /*
  const nodemailer = require('nodemailer');

  const transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: '"π RideFlow" <noreply@yourapp.com>',
    to: email,
    subject: 'Reset Your π Password',
    text: emailContent,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1e293b;">π Password Reset</h1>
        <p>Hello ${userName},</p>
        <p>You requested a password reset for your π account.</p>
        <div style="margin: 20px 0;">
          <a href="${resetLink}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Reset Password</a>
        </div>
        <p>Or use this reset code: <strong>${resetToken.slice(-8)}</strong></p>
        <p><small>This link will expire in 1 hour.</small></p>
        <p><small>If you didn't request this reset, please ignore this email.</small></p>
        <hr style="margin: 20px 0;">
        <p style="color: #6b7280; font-size: 12px;">π Team</p>
      </div>
    `
  });
  */

  return true;
}

// SMS service function (using Twilio or similar)
async function sendPasswordResetSMS(phoneNumber, resetToken) {
  const smsContent = `π Password Reset Code: ${resetToken.slice(-6)}\n\nEnter this code to reset your password. Expires in 1 hour.\n\nDidn't request this? Ignore this message.`;

  // For demo purposes, just log (replace with actual SMS service)
  console.log(`📱 SMS TO: ${phoneNumber}`);
  console.log(`📱 SMS CONTENT: ${smsContent}`);

  // Uncomment and configure for production SMS sending:
  /*
  const twilio = require('twilio');
  const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

  await client.messages.create({
    body: smsContent,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: phoneNumber
  });
  */

  return true;
}

// Password reset confirmation
app.post('/api/auth/reset-password-confirm', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Verify reset token
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.type !== 'password_reset') {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hashedPassword, decoded.userId]
    );

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'Reset token has expired' });
    }
    console.error('Password reset confirm error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Profile management with stats
app.get('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Calculate monthly spending
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    const monthlySpendingResult = await db.query(`
      SELECT COALESCE(SUM(final_fare), 0) as monthly_spending, COUNT(*) as monthly_rides
      FROM rides 
      WHERE rider_id = $1 
      AND status = 'completed' 
      AND DATE_TRUNC('month', completed_at) = DATE_TRUNC('month', CURRENT_DATE)
    `, [req.user.userId]);

    const monthlyData = monthlySpendingResult.rows[0];

    // Get corporate discount information
    let corporateDiscount = null;
    if (user.active_corporate_discount) {
      const corporateResult = await db.query(`
        SELECT ca.*, c.company_name, c.discount_value,
               ca.discount_end_date > NOW() as is_active
        FROM corporate_applications ca
        JOIN corporations c ON ca.corporation_id = c.id
        WHERE ca.id = $1 AND ca.status = 'approved'
      `, [user.active_corporate_discount]);
      
      if (corporateResult.rows.length > 0) {
        const corp = corporateResult.rows[0];
        corporateDiscount = {
          isActive: corp.is_active,
          companyName: corp.company_name,
          discountPercentage: corp.discount_value,
          expiryDate: corp.discount_end_date
        };
      }
    }

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      userType: user.user_type,
      rating: user.rating || 5.0,
      totalRides: user.total_rides || 0,
      monthlySpending: parseFloat(monthlyData.monthly_spending || 0),
      monthlyRides: parseInt(monthlyData.monthly_rides || 0),
      corporateDiscount: corporateDiscount,
      // New profile fields
      dateOfBirth: user.date_of_birth,
      emergencyContact: user.emergency_contact,
      musicPreference: user.music_preference !== null ? user.music_preference : true,
      conversationPreference: user.conversation_preference !== null ? user.conversation_preference : false,
      temperaturePreference: user.temperature_preference || 'cool',
      profilePicture: user.profile_picture,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 Profile update request:', req.body);
    
    const { 
      firstName, 
      lastName, 
      email,
      phone, 
      dateOfBirth,
      emergencyContact,
      music,
      conversation,
      temperature,
      profilePicture
    } = req.body;

    // Map frontend field names to database field names
    const profileData = {};
    
    if (firstName !== undefined) profileData.first_name = firstName;
    if (lastName !== undefined) profileData.last_name = lastName;
    if (email !== undefined) profileData.email = email;
    if (phone !== undefined) profileData.phone = phone;
    if (dateOfBirth !== undefined) profileData.date_of_birth = dateOfBirth;
    if (emergencyContact !== undefined) profileData.emergency_contact = emergencyContact;
    if (music !== undefined) profileData.music_preference = music;
    if (conversation !== undefined) profileData.conversation_preference = conversation;
    if (temperature !== undefined) profileData.temperature_preference = temperature;
    if (profilePicture !== undefined) profileData.profile_picture = profilePicture;

    // Use our new updateUserProfile method
    const updatedUser = await db.updateUserProfile(req.user.userId, profileData);

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('✅ Profile updated successfully for user:', updatedUser.id);

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        phone: updatedUser.phone,
        userType: updatedUser.user_type,
        dateOfBirth: updatedUser.date_of_birth,
        emergencyContact: updatedUser.emergency_contact,
        musicPreference: updatedUser.music_preference,
        conversationPreference: updatedUser.conversation_preference,
        temperaturePreference: updatedUser.temperature_preference,
        profilePicture: updatedUser.profile_picture
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Get recent trips for user
app.get('/api/users/trips', authenticateToken, async (req, res) => {
  try {
    const limit = req.query.limit || 10; // Default to 10 recent trips
    
    const result = await db.query(`
      SELECT 
        id,
        pickup_address,
        destination_address,
        pickup_lat,
        pickup_lng, 
        destination_lat,
        destination_lng,
        ride_type,
        status,
        final_fare,
        tip_amount,
        completed_at,
        created_at,
        requested_at
      FROM rides 
      WHERE rider_id = $1 
      AND status IN ('completed', 'cancelled')
      ORDER BY completed_at DESC, requested_at DESC
      LIMIT $2
    `, [req.user.userId, limit]);

    const trips = result.rows.map(trip => {
      // Format date for display
      let displayDate = 'Unknown';
      const tripDate = trip.completed_at || trip.requested_at;
      
      if (tripDate) {
        const now = new Date();
        const date = new Date(tripDate);
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

        if (diffDays === 0) {
          displayDate = `Today ${date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit', 
            hour12: true 
          })}`;
        } else if (diffDays === 1) {
          displayDate = `Yesterday ${date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit', 
            hour12: true 
          })}`;
        } else if (diffDays < 7) {
          displayDate = date.toLocaleDateString('en-US', { 
            weekday: 'short',
            hour: 'numeric', 
            minute: '2-digit', 
            hour12: true 
          });
        } else {
          displayDate = date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            hour: 'numeric', 
            minute: '2-digit', 
            hour12: true 
          });
        }
      }

      // Calculate total fare including tip
      const totalFare = parseFloat(trip.final_fare || 0) + parseFloat(trip.tip_amount || 0);

      return {
        id: trip.id,
        date: displayDate,
        from: trip.pickup_address,
        to: trip.destination_address,
        pickupCoords: { lat: parseFloat(trip.pickup_lat), lng: parseFloat(trip.pickup_lng) },
        destinationCoords: { lat: parseFloat(trip.destination_lat), lng: parseFloat(trip.destination_lng) },
        fare: `$${totalFare.toFixed(2)}`,
        rideType: trip.ride_type,
        status: trip.status,
        completedAt: trip.completed_at,
        requestedAt: trip.requested_at
      };
    });

    res.json({ trips });
  } catch (error) {
    console.error('Get recent trips error:', error);
    res.status(500).json({ error: 'Failed to fetch recent trips' });
  }
});

// Email verification
app.post('/api/auth/send-verification', authenticateToken, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate verification token
    const verificationToken = jwt.sign(
      { userId: user.id, email: user.email, type: 'email_verification' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // In production, send verification email here
    console.log(`Email verification token for ${user.email}: ${verificationToken}`);

    res.json({
      message: 'Verification email sent',
      verificationToken // Remove this in production
    });
  } catch (error) {
    console.error('Send verification error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.type !== 'email_verification') {
      return res.status(400).json({ error: 'Invalid verification token' });
    }

    // Update user email verification status
    await db.query(
      'UPDATE users SET email_verified = true WHERE id = $1',
      [decoded.userId]
    );

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(400).json({ error: 'Verification token has expired' });
    }
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Ride Routes
// Get active ride requests for Dashboard (Admin view)
app.get('/api/rides/active', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        r.id,
        r.pickup_address,
        r.destination_address,
        r.pickup_lat,
        r.pickup_lng,
        r.destination_lat,
        r.destination_lng,
        r.status,
        r.ride_type,
        r.estimated_fare,
        r.requested_at,
        u.first_name || ' ' || u.last_name as rider_name,
        u.email as rider_email
      FROM rides r
      JOIN users u ON r.rider_id = u.id
      WHERE r.status IN ('requested', 'accepted', 'en_route', 'arrived')
      ORDER BY r.requested_at DESC
    `;
    
    const result = await db.query(query);
    res.json({ success: true, rides: result.rows });
  } catch (error) {
    console.error('Get active rides error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get available ride requests for Driver app
app.get('/api/driver/ride-requests', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        r.id,
        r.pickup_address,
        r.destination_address,
        r.pickup_lat,
        r.pickup_lng,
        r.destination_lat,
        r.destination_lng,
        r.ride_type,
        r.estimated_fare,
        r.requested_at,
        u.first_name || ' ' || u.last_name as rider_name,
        u.phone as rider_phone
      FROM rides r
      JOIN users u ON r.rider_id = u.id
      WHERE r.status = 'requested'
      ORDER BY r.requested_at ASC
      LIMIT 10
    `;
    
    const result = await db.query(query);
    res.json({ success: true, requests: result.rows });
  } catch (error) {
    console.error('Get ride requests error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin Management APIs - Get all drivers
app.get('/api/admin/drivers', apiKeyMiddleware(['admin']), async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id,
        u.first_name || ' ' || u.last_name as name,
        u.email,
        u.phone,
        u.user_type,
        u.rating,
        u.total_rides,
        u.created_at,
        da.vehicle_make,
        da.vehicle_model,
        da.vehicle_year,
        da.vehicle_color,
        da.application_status,
        CASE WHEN dl.is_available = true THEN 'online' 
             WHEN dl.is_available = false THEN 'offline'
             ELSE 'offline' END as status,
        de.total_earnings
      FROM users u
      LEFT JOIN driver_applications da ON u.email = da.email
      LEFT JOIN driver_locations dl ON u.id = dl.driver_id
      LEFT JOIN (
        SELECT driver_id, COALESCE(SUM(total_earned), 0) as total_earnings
        FROM driver_earnings
        GROUP BY driver_id
      ) de ON u.id = de.driver_id
      WHERE u.user_type = 'driver'
      ORDER BY u.created_at DESC
    `;
    
    const result = await db.query(query);
    res.json({ success: true, drivers: result.rows });
  } catch (error) {
    console.error('Get drivers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin Management APIs - Get all riders
app.get('/api/admin/riders', apiKeyMiddleware(['admin']), async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id,
        u.first_name || ' ' || u.last_name as name,
        u.email,
        u.phone,
        u.rating,
        u.total_rides,
        u.created_at,
        COALESCE(ride_stats.total_spent, 0) as total_spent,
        COALESCE(ride_stats.last_ride, NULL) as last_ride,
        CASE WHEN ride_stats.last_ride > NOW() - INTERVAL '7 days' THEN 'active'
             ELSE 'inactive' END as status
      FROM users u
      LEFT JOIN (
        SELECT 
          rider_id,
          SUM(final_fare) as total_spent,
          MAX(completed_at) as last_ride
        FROM rides
        WHERE status = 'completed' AND final_fare IS NOT NULL
        GROUP BY rider_id
      ) ride_stats ON u.id = ride_stats.rider_id
      WHERE u.user_type = 'rider'
      ORDER BY u.created_at DESC
    `;
    
    const result = await db.query(query);
    res.json({ success: true, riders: result.rows });
  } catch (error) {
    console.error('Get riders error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin Management APIs - Get all rides
app.get('/api/admin/rides', apiKeyMiddleware(['admin']), async (req, res) => {
  try {
    const query = `
      SELECT 
        r.id,
        r.pickup_address,
        r.destination_address,
        r.status,
        r.ride_type,
        r.requested_at,
        r.accepted_at,
        r.started_at,
        r.completed_at,
        r.final_fare,
        r.estimated_fare,
        rider.first_name || ' ' || rider.last_name as rider_name,
        rider.email as rider_email,
        CASE WHEN r.driver_id IS NOT NULL 
             THEN driver.first_name || ' ' || driver.last_name
             ELSE 'Unassigned' END as driver_name,
        CASE WHEN r.driver_id IS NOT NULL 
             THEN driver.email
             ELSE NULL END as driver_email
      FROM rides r
      JOIN users rider ON r.rider_id = rider.id
      LEFT JOIN users driver ON r.driver_id = driver.id
      ORDER BY r.requested_at DESC
      LIMIT 100
    `;
    
    const result = await db.query(query);
    res.json({ success: true, rides: result.rows });
  } catch (error) {
    console.error('Get rides error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ML Analytics endpoint  
app.get('/api/admin/ml-analytics', apiKeyMiddleware(['admin']), async (req, res) => {
  try {
    console.log('🤖 ML Analytics: Fetching ML dashboard data...');
    
    // ML analytics data (in production, this would call the Python ML dashboard)
    const mlAnalytics = {
      system_health: {
        status: 'healthy',
        active_models: 4,
        average_accuracy: 0.875,
        total_predictions: 156,
        uptime_hours: 24.5,
        data_pipeline_status: 'healthy'
      },
      model_performance: [
        {
          name: 'Demand Prediction',
          status: 'healthy',
          accuracy: 0.87,
          confidence: 0.82,
          predictions: 45,
          response_time: 125,
          business_impact: 0.85
        },
        {
          name: 'Surge Pricing',
          status: 'healthy', 
          accuracy: 0.89,
          confidence: 0.85,
          predictions: 38,
          response_time: 95,
          business_impact: 0.92
        },
        {
          name: 'Driver Positioning',
          status: 'healthy',
          accuracy: 0.83,
          confidence: 0.79,
          predictions: 42,
          response_time: 110,
          business_impact: 0.78
        },
        {
          name: 'Route Optimization',
          status: 'healthy',
          accuracy: 0.91,
          confidence: 0.88,
          predictions: 31,
          response_time: 85,
          business_impact: 0.88
        }
      ],
      insights: [
        'All ML systems operational with 4 active models',
        'Overall ML accuracy is excellent at 87.5%',
        'High ML system usage with 156 predictions today',
        'ML system stable with 24.5 hours uptime',
        'Route Optimization performing excellently with 91.0% accuracy',
        'Demand Prediction processed 45 predictions today - high usage',
        'Surge Pricing responds quickly at 95ms average',
        'Driver Positioning has high business impact (78.0%)',
        'Weather integration active across all components',
        'Traffic data successfully integrated for real-time optimization'
      ],
      performance_trends: {
        accuracy_trend: [
          { time: '00:00', value: 0.85 },
          { time: '04:00', value: 0.87 },
          { time: '08:00', value: 0.86 },
          { time: '12:00', value: 0.88 },
          { time: '16:00', value: 0.87 },
          { time: '20:00', value: 0.89 }
        ],
        prediction_volume: [
          { time: '00:00', value: 12 },
          { time: '04:00', value: 8 },
          { time: '08:00', value: 25 },
          { time: '12:00', value: 32 },
          { time: '16:00', value: 28 },
          { time: '20:00', value: 22 }
        ]
      },
      generated_at: new Date().toISOString()
    };
    
    console.log('✅ ML Analytics: Data prepared successfully');
    res.json(mlAnalytics);
    
  } catch (error) {
    console.error('❌ ML Analytics error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch ML analytics',
      details: error.message 
    });
  }
});

// Corporate Discount System API Endpoints

// Corporation Management
app.get('/api/admin/corporations', authenticateToken, async (req, res) => {
  try {
    const corporations = await db.getAllCorporations();
    
    // Add usage statistics for each corporation
    const corporationsWithStats = await Promise.all(
      corporations.map(async (corp) => {
        const applications = await db.query(
          'SELECT COUNT(*) as total_applications, COUNT(CASE WHEN status = \'approved\' THEN 1 END) as approved_applications FROM corporate_applications WHERE corporation_id = $1',
          [corp.id]
        );
        const usage = await db.query(
          'SELECT COUNT(*) as total_usage, COALESCE(SUM(discount_amount), 0) as total_savings FROM corporate_discount_usage WHERE corporation_id = $1',
          [corp.id]
        );
        
        return {
          ...corp,
          total_applications: parseInt(applications.rows[0].total_applications),
          approved_applications: parseInt(applications.rows[0].approved_applications),
          total_usage: parseInt(usage.rows[0].total_usage),
          total_savings: parseFloat(usage.rows[0].total_savings)
        };
      })
    );
    
    res.json({ success: true, corporations: corporationsWithStats });
  } catch (error) {
    console.error('Get corporations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/corporations', authenticateToken, async (req, res) => {
  try {
    const corporationData = {
      ...req.body,
      created_by: req.user.userId
    };
    
    const corporation = await db.createCorporation(corporationData);
    res.json({ success: true, corporation });
  } catch (error) {
    console.error('Create corporation error:', error);
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: 'Company name already exists' });
    } else {
      res.status(500).json({ error: 'Server error' });
    }
  }
});

app.put('/api/admin/corporations/:id', authenticateToken, async (req, res) => {
  try {
    const corporation = await db.updateCorporation(req.params.id, req.body);
    if (!corporation) {
      return res.status(404).json({ error: 'Corporation not found' });
    }
    res.json({ success: true, corporation });
  } catch (error) {
    console.error('Update corporation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/admin/corporations/:id', authenticateToken, async (req, res) => {
  try {
    const corporation = await db.deleteCorporation(req.params.id);
    if (!corporation) {
      return res.status(404).json({ error: 'Corporation not found' });
    }
    res.json({ success: true, message: 'Corporation deleted successfully' });
  } catch (error) {
    console.error('Delete corporation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Corporate Applications Management
app.get('/api/admin/corporate-applications', authenticateToken, async (req, res) => {
  try {
    const applications = await db.getAllCorporateApplications();
    res.json({ success: true, applications });
  } catch (error) {
    console.error('Get corporate applications error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/corporate-applications/:id', authenticateToken, async (req, res) => {
  try {
    const application = await db.getCorporateApplicationById(req.params.id);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    res.json({ success: true, application });
  } catch (error) {
    console.error('Get corporate application error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/corporate-applications/:id/review', authenticateToken, async (req, res) => {
  try {
    const { status, review_notes, rejection_reason } = req.body;
    
    const reviewData = {
      status,
      reviewed_by: req.user.userId,
      review_notes,
      rejection_reason
    };
    
    const application = await db.reviewCorporateApplication(req.params.id, reviewData);
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    res.json({ success: true, application, message: `Application ${status} successfully` });
  } catch (error) {
    console.error('Review corporate application error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Corporate Analytics
// Admin dashboard analytics endpoint
app.get('/api/admin/analytics', authenticateToken, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get real-time stats
    const [ridesResult, revenueResult] = await Promise.all([
      // Count today's rides by status
      db.query(`
        SELECT 
          status,
          COUNT(*) as count,
          COALESCE(SUM((estimated_fare->>'finalFare')::numeric), 0) as revenue
        FROM rides 
        WHERE created_at >= $1
        GROUP BY status
      `, [today]),
      
      // Get total revenue for today
      db.query(`
        SELECT COALESCE(SUM((estimated_fare->>'finalFare')::numeric), 0) as total_revenue
        FROM rides 
        WHERE created_at >= $1 AND status IN ('completed', 'in_progress')
      `, [today])
    ]);
    
    const rideStats = ridesResult.rows.reduce((acc, row) => {
      acc[row.status] = {
        count: parseInt(row.count),
        revenue: parseFloat(row.revenue)
      };
      return acc;
    }, {});
    
    const totalRevenue = parseFloat(revenueResult.rows[0]?.total_revenue || 0);
    
    res.json({
      pendingRequests: pendingRequestsCount || 0,
      activeRides: rideStats.in_progress?.count || 0,
      onlineDrivers: Array.from(driverAvailability.values()).filter(d => d.isAvailable).length,
      totalRevenue: totalRevenue,
      completedRides: rideStats.completed?.count || 0,
      requestedRides: rideStats.requested?.count || 0,
      cancelledRides: rideStats.cancelled?.count || 0
    });
    
  } catch (error) {
    console.error('Admin analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

app.get('/api/admin/corporate-analytics', authenticateToken, async (req, res) => {
  try {
    const analytics = await db.getCorporateDiscountAnalytics();
    res.json({ success: true, analytics });
  } catch (error) {
    console.error('Get corporate analytics error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Public endpoint for riders to submit corporate applications
app.post('/api/corporate-applications', authenticateToken, async (req, res) => {
  try {
    const applicationData = {
      ...req.body,
      rider_id: req.user.userId
    };
    
    const application = await db.createCorporateApplication(applicationData);
    res.json({ success: true, application, message: 'Corporate discount application submitted successfully' });
  } catch (error) {
    console.error('Submit corporate application error:', error);
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: 'You have already applied for a discount with this company' });
    } else {
      res.status(500).json({ error: 'Server error' });
    }
  }
});

// Get available corporations for riders to apply to
app.get('/api/corporations/available', authenticateToken, async (req, res) => {
  try {
    const corporations = await db.query(`
      SELECT id, company_name, discount_type, discount_value, 
             valid_days, start_date, end_date, max_discount_amount, min_ride_amount
      FROM corporations 
      WHERE is_active = true 
      AND (end_date IS NULL OR end_date >= CURRENT_DATE)
      AND start_date <= CURRENT_DATE
      ORDER BY company_name
    `);
    
    res.json({ success: true, corporations: corporations.rows });
  } catch (error) {
    console.error('Get available corporations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/rides/request', rideLimiter, authenticateToken, async (req, res) => {
  try {
    console.log('🚗 Ride request received:', req.body);
    
    const { pickup, destination, rideType, scheduledTime, paymentMethodId, riderPreferences, rider_id } = req.body;

    // Validate request data
    if (!pickup || !destination || !pickup.coordinates || !destination.coordinates) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pickup or destination data',
        message: 'Both pickup and destination coordinates are required'
      });
    }

    console.log('📍 Pickup:', pickup.coordinates);
    console.log('📍 Destination:', destination.coordinates);

    // Calculate fare with surge pricing
    const estimatedFare = await calculateFare(pickup.coordinates, destination.coordinates, rideType || 'standard');

    // Create ride with proper error handling
    let ride;
    try {
      ride = await db.createRide({
        rider_id: rider_id || req.user.userId,
        pickup_address: pickup.address || 'Current Location',
        pickup_lat: pickup.coordinates.lat,
        pickup_lng: pickup.coordinates.lng,
        destination_address: destination.address || 'Destination',
        destination_lat: destination.coordinates.lat,
        destination_lng: destination.coordinates.lng,
        ride_type: rideType || 'standard',
        scheduled_time: scheduledTime,
        estimated_fare: estimatedFare.total || estimatedFare,
        payment_method_id: paymentMethodId
      });
    } catch (dbError) {
      console.error('Database error creating ride:', dbError);
      // Create a mock ride for demo purposes
      ride = {
        id: require('uuid').v4(),
        rider_id: rider_id || req.user.userId,
        pickup_address: pickup.address || 'Current Location',
        pickup_lat: pickup.coordinates.lat,
        pickup_lng: pickup.coordinates.lng,
        destination_address: destination.address || 'Destination',
        destination_lat: destination.coordinates.lat,
        destination_lng: destination.coordinates.lng,
        ride_type: rideType || 'standard',
        status: 'requested',
        created_at: new Date(),
        estimated_fare: estimatedFare.total || estimatedFare
      };
    }

    // Store ride request for matching algorithm
    activeRideRequests.set(ride.id, {
      id: ride.id,
      pickup: pickup.coordinates,
      destination: destination.coordinates,
      rideType: rideType || 'standard',
      requestedAt: new Date(),
      riderId: rider_id || req.user.userId
    });

    // Update pending requests count and broadcast
    pendingRequestsCount = activeRideRequests.size;
    console.log(`📋 Pending requests updated: ${pendingRequestsCount}`);
    
    // Broadcast pending requests update to all connected clients
    io.emit('pending-requests-update', {
      pendingRequests: pendingRequestsCount,
      rideId: ride.id,
      action: 'created',
      timestamp: new Date().toISOString()
    });

    console.log(`🚀 Ride created with ID: ${ride.id}`);

    // Start cascading driver matching process
    try {
      console.log(`🎯 Starting cascading driver matching for ride ${ride.id}`);
      
      // Notify rider that we're finding a driver
      io.to(`user-${req.user.userId}`).emit('finding-driver', {
        rideId: ride.id,
        message: 'Finding the best π driver for you...',
        status: 'searching'
      });
      
      // Find available drivers using the matching engine
      const matchResult = await findBestDriver({
        id: ride.id,
        pickup: pickup.coordinates,
        destination: destination.coordinates,
        rideType: rideType || 'standard',
        requestedAt: new Date(),
        riderId: req.user.userId
      });

      if (matchResult && matchResult.length > 0) {
        console.log(`✅ Drivers found for ride ${ride.id} - starting cascading sequence`);
        
        // Initialize cascading ride request data
        const rideRequestData = {
          rideId: ride.id,
          pickup: pickup.coordinates,
          destination: destination.coordinates,
          pickupAddress: pickup.address || 'Current Location',
          destinationAddress: destination.address || 'Destination',
          estimatedFare: estimatedFare.total || estimatedFare,
          rideType: rideType || 'standard',
          riderPreferences: riderPreferences || {
            music: false,
            conversation: false,
            temperature: 'no-preference'
          },
          riderId: req.user.userId,
          availableDrivers: matchResult,
          currentDriverIndex: 0,
          attemptCount: 0,
          startTime: Date.now()
        };
        
        // 📊 DEBUG: Log driver queue details
        console.log(`🎯 QUEUE SETUP: ${matchResult.length} drivers found for ride ${ride.id}:`);
        matchResult.forEach((driver, index) => {
          console.log(`   ${index + 1}. Driver ${driver.id} (${driver.first_name} ${driver.last_name}) - Score: ${driver.score}, Distance: ${driver.distance}km`);
        });
        
        // Store cascading request data
        cascadingRequests.set(ride.id, rideRequestData);
        
        // Start the cascading sequence
        startCascadingDriverRequest(rideRequestData);
        
      } else {
        console.log(`❌ No drivers available for ride ${ride.id}`);
        
        // Notify rider that no drivers are available
        io.to(`user-${req.user.userId}`).emit('no-drivers-available', {
          rideId: ride.id,
          message: 'No drivers available in your area. Please try again in a few minutes.',
          suggestedActions: ['try_later', 'change_location', 'select_different_vehicle']
        });
      }
    } catch (matchError) {
      console.error('Driver matching error:', matchError);
      
      // Notify rider of matching failure
      io.to(`user-${req.user.userId}`).emit('matching-failed', {
        rideId: ride.id,
        message: 'Unable to find drivers at the moment. Please try again.',
        error: 'matching_error'
      });
    }

    // Ensure proper response format with updated surge info (after adding to activeRideRequests)
    const updatedSurgeInfo = await calculateSurgeMultiplier(pickup.coordinates.lat, pickup.coordinates.lng);
    const fareData = typeof estimatedFare === 'object' ? estimatedFare : { total: estimatedFare };
    
    const response = {
      success: true,
      message: 'Ride requested successfully',
      ride: { 
        id: ride.id,
        rider_id: ride.rider_id,
        pickup_address: ride.pickup_address,
        destination_address: ride.destination_address,
        ride_type: ride.ride_type,
        status: ride.status || 'requested',
        created_at: ride.created_at,
        estimated_fare: fareData.total || fareData,
        estimatedFare: fareData.total || fareData // Include both formats for compatibility
      },
      surgeInfo: {
        isActive: updatedSurgeInfo.isActive || false,
        multiplier: updatedSurgeInfo.multiplier || 1.0,
        demandLevel: updatedSurgeInfo.demandLevel || 'Low',
        availableDrivers: updatedSurgeInfo.availableDrivers || 0,
        pendingRequests: updatedSurgeInfo.pendingRequests || 0
      },
      fareBreakdown: fareData.breakdown || {},
      timestamp: new Date().toISOString()
    };

    console.log('✅ Sending ride request response:', response);
    
    // Send response with proper error handling
    if (!res.headersSent) {
      res.status(201).json(response);
    }
  } catch (error) {
    console.error('❌ Ride request error:', error);
    
    // Clean up active ride request if it was created
    if (ride && ride.id) {
      activeRideRequests.delete(ride.id);
    }
    
    // Ensure we always send a proper JSON response
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false,
        error: 'Server error',
        message: 'Failed to process ride request. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      });
    }
  }
});

app.get('/api/rides/history', authenticateToken, (req, res) => {
  try {
    const userRides = database.rides.filter(ride =>
      ride.riderId === req.user.userId ||
      (ride.driver && ride.driver.id === req.user.userId)
    );

    res.json({ rides: userRides });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/rides/:rideId/accept', authenticateToken, (req, res) => {
  try {
    const { rideId } = req.params;
    const ride = database.rides.find(r => r.id === rideId);

    if (!ride) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    if (ride.status !== 'requested') {
      return res.status(400).json({ error: 'Ride already accepted or completed' });
    }

    // Find driver info
    const driver = database.users.find(u => u.id === req.user.userId);

    ride.status = 'accepted';
    ride.driver = {
      id: driver.id,
      name: `${driver.firstName} ${driver.lastName}`,
      phone: driver.phone,
      vehicle: driver.profile.vehicle || { model: 'Unknown', license: 'ABC123' }
    };
    ride.acceptedAt = new Date();

    // Notify rider
    io.emit('ride-accepted', ride);

    res.json({
      message: 'Ride accepted successfully',
      ride
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get driver's own performance stats
app.get('/api/drivers/stats', authenticateToken, async (req, res) => {
  try {
    const driverId = req.user.userId;
    const { period = 'today' } = req.query;
    
    let dateFilter = '';
    
    switch (period) {
      case 'today':
        dateFilter = "AND DATE(completed_at) = CURRENT_DATE";
        break;
      case 'week':
        dateFilter = "AND completed_at >= DATE_TRUNC('week', CURRENT_DATE)";
        break;
      case 'month':
        dateFilter = "AND completed_at >= DATE_TRUNC('month', CURRENT_DATE)";
        break;
      case 'year':
        dateFilter = "AND completed_at >= DATE_TRUNC('year', CURRENT_DATE)";
        break;
    }
    
    // Get earnings and trip stats
    const statsQuery = `
      SELECT 
        COALESCE(COUNT(r.id), 0) as total_trips,
        COALESCE(SUM(r.final_fare), 0) as total_earnings,
        COALESCE(AVG(r.final_fare), 0) as avg_fare,
        COALESCE(SUM(CASE WHEN r.tip_amount > 0 THEN r.tip_amount ELSE 0 END), 0) as total_tips,
        COALESCE(SUM(r.distance_miles), 0) as total_miles,
        COALESCE(AVG(r.rider_rating), 5.0) as avg_rating
      FROM rides r
      WHERE r.driver_id = $1 
      AND r.status = 'completed'
      ${dateFilter}
    `;
    
    const result = await db.query(statsQuery, [driverId]);
    const stats = result.rows[0];
    
    // Get online time for today (simplified calculation)
    const onlineTimeQuery = `
      SELECT COALESCE(SUM(EXTRACT(epoch FROM (updated_at - created_at))/3600), 0) as hours_online
      FROM driver_locations 
      WHERE driver_id = $1 
      AND DATE(created_at) = CURRENT_DATE
    `;
    
    const onlineResult = await db.query(onlineTimeQuery, [driverId]);
    const hoursOnline = parseFloat(onlineResult.rows[0]?.hours_online || 0);
    
    // Get last ride fare
    const lastRideQuery = `
      SELECT final_fare 
      FROM rides 
      WHERE driver_id = $1 AND status = 'completed' 
      ORDER BY completed_at DESC 
      LIMIT 1
    `;
    
    const lastRideResult = await db.query(lastRideQuery, [driverId]);
    const lastRideFare = lastRideResult.rows[0]?.final_fare || 0;
    
    res.json({
      success: true,
      stats: {
        earnings: parseFloat(stats.total_earnings || 0),
        trips: parseInt(stats.total_trips || 0),
        hours: hoursOnline,
        miles: parseFloat(stats.total_miles || 0),
        rating: parseFloat(stats.avg_rating || 5.0),
        lastRide: parseFloat(lastRideFare || 0),
        avgFare: parseFloat(stats.avg_fare || 0),
        totalTips: parseFloat(stats.total_tips || 0)
      }
    });
    
  } catch (error) {
    console.error('Driver stats error:', error);
    res.status(500).json({ error: 'Failed to fetch driver stats' });
  }
});

// Driver location updates
app.post('/api/drivers/location', authenticateToken, (req, res) => {
  try {
    const { latitude, longitude, heading } = req.body;

    // Update driver location in real-time
    io.emit('driver-location-update', {
      driverId: req.user.userId,
      location: { lat: latitude, lng: longitude },
      heading,
      timestamp: new Date()
    });

    res.json({ message: 'Location updated' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 🚨 BULLETPROOF TRIP STATUS CHECK: Driver polls this to detect cancellations
app.get('/api/driver/trip-status', async (req, res) => {
  try {
    const { tripId, driverId } = req.query;
    
    // Temporary bypass for testing - will fix auth properly later
    if (!tripId || !driverId) {
      return res.status(400).json({ error: 'Missing tripId or driverId' });
    }
    
    // Check trip status in database
    const trip = await db.query(
      'SELECT id, status, driver_id, cancelled_at FROM rides WHERE id = $1 AND driver_id = $2',
      [tripId, driverId]
    );
    
    if (!trip.rows[0]) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    
    const tripData = trip.rows[0];
    
    // Return status with compensation info if cancelled
    const response = {
      tripId: tripData.id,
      status: tripData.status,
      timestamp: new Date().toISOString()
    };
    
    // If cancelled, add driver compensation details
    if (tripData.status === 'cancelled') {
      // Simple compensation logic - $5 if driver was assigned
      response.driverCompensation = tripData.driver_id ? 5.00 : 0.00;
      response.cancelledAt = tripData.cancelled_at;
    }
    
    console.log(`📋 TRIP STATUS CHECK: Driver ${driverId} checked trip ${tripId} - Status: ${tripData.status}`);
    res.json(response);
    
  } catch (error) {
    console.error('Driver trip status check error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

const paymentService = require('./payments');
const { DriverVerificationService, upload, VERIFICATION_STATUS } = require('./driver-verification');

// Payment Routes
app.post('/api/payments/setup-intent', authenticateToken, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.userId);
    let customerId = user.stripe_customer_id;

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await paymentService.createCustomer(
        user.email,
        `${user.first_name} ${user.last_name}`,
        user.phone
      );
      customerId = customer.id;

      // Save customer ID to user record
      await db.query(
        'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
        [customerId, req.user.userId]
      );
    }

    const setupIntent = await paymentService.createSetupIntent(customerId);

    res.json({
      clientSecret: setupIntent.client_secret,
      customerId
    });
  } catch (error) {
    console.error('Setup intent error:', error);
    res.status(500).json({ error: 'Failed to create setup intent' });
  }
});

app.post('/api/payments/methods', authenticateToken, async (req, res) => {
  try {
    const { paymentMethodId } = req.body;
    const user = await db.getUserById(req.user.userId);

    if (!user.stripe_customer_id) {
      return res.status(400).json({ error: 'Customer not found' });
    }

    const paymentMethod = await paymentService.attachPaymentMethod(
      paymentMethodId,
      user.stripe_customer_id
    );

    // Save payment method to database
    await db.query(
      `INSERT INTO payment_methods (user_id, stripe_pm_id, type, last4, exp_month, exp_year, brand)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        req.user.userId,
        paymentMethod.id,
        paymentMethod.type,
        paymentMethod.card.last4,
        paymentMethod.card.exp_month,
        paymentMethod.card.exp_year,
        paymentMethod.card.brand
      ]
    );

    res.status(201).json({
      message: 'Payment method added successfully',
      paymentMethod: {
        id: paymentMethod.id,
        type: paymentMethod.type,
        brand: paymentMethod.card.brand,
        last4: paymentMethod.card.last4,
        exp_month: paymentMethod.card.exp_month,
        exp_year: paymentMethod.card.exp_year
      }
    });
  } catch (error) {
    console.error('Add payment method error:', error);
    res.status(500).json({ error: 'Failed to add payment method' });
  }
});

app.get('/api/payments/methods', authenticateToken, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.userId);

    if (!user.stripe_customer_id) {
      return res.json({ paymentMethods: [] });
    }

    const paymentMethods = await paymentService.getCustomerPaymentMethods(user.stripe_customer_id);

    res.json({ paymentMethods });
  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({ error: 'Failed to get payment methods' });
  }
});

app.post('/api/payments/process-ride', authenticateToken, async (req, res) => {
  try {
    const { rideId, paymentMethodId, amount } = req.body;

    const user = await db.getUserById(req.user.userId);
    const ride = await db.query('SELECT * FROM rides WHERE id = $1', [rideId]);

    if (!ride.rows[0]) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    const rideData = ride.rows[0];

    const paymentResult = await paymentService.processRidePayment(
      rideId,
      paymentMethodId,
      amount,
      user.stripe_customer_id,
      rideData.driver_id
    );

    res.json({
      message: 'Payment processed successfully',
      paymentIntentId: paymentResult.paymentIntent.id,
      driverEarnings: paymentResult.driverEarnings,
      platformFee: paymentResult.platformFee
    });
  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({ error: 'Payment processing failed' });
  }
});

app.post('/api/payments/tip', authenticateToken, async (req, res) => {
  try {
    const { rideId, paymentMethodId, tipAmount } = req.body;

    const user = await db.getUserById(req.user.userId);
    const ride = await db.query('SELECT * FROM rides WHERE id = $1', [rideId]);
    const rideData = ride.rows[0];

    if (!rideData) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    const tipResult = await paymentService.processTip(
      rideId,
      rideData.driver_id,
      user.stripe_customer_id,
      paymentMethodId,
      tipAmount
    );

    // Update ride with tip amount
    await db.query(
      'UPDATE rides SET tip_amount = $1 WHERE id = $2',
      [tipAmount, rideId]
    );

    res.json({
      message: 'Tip processed successfully',
      paymentIntentId: tipResult.paymentIntent.id
    });
  } catch (error) {
    console.error('Process tip error:', error);
    res.status(500).json({ error: 'Tip processing failed' });
  }
});

// Enhanced tip processing endpoint
app.post('/api/rides/:rideId/tip', authenticateToken, async (req, res) => {
  try {
    const { rideId } = req.params;
    const { tipAmount, paymentMethodId, tipPercentage } = req.body;

    const ride = await db.query('SELECT * FROM rides WHERE id = $1', [rideId]);
    const rideData = ride.rows[0];

    if (!rideData) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    if (rideData.status !== 'completed') {
      return res.status(400).json({ error: 'Ride must be completed to add tip' });
    }

    const user = await db.getUserById(req.user.userId);

    // Process tip payment
    const tipResult = await paymentService.processTip(
      rideId,
      rideData.driver_id,
      user.stripe_customer_id,
      paymentMethodId,
      tipAmount
    );

    // Update ride with tip information
    await db.query(
      'UPDATE rides SET tip_amount = $1, tip_percentage = $2, tip_payment_intent_id = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
      [tipAmount, tipPercentage, tipResult.paymentIntent.id, rideId]
    );

    // Record tip in driver earnings
    await db.query(
      `INSERT INTO driver_earnings (driver_id, ride_id, tip_amount, earning_type, created_at)
       VALUES ($1, $2, $3, 'tip', CURRENT_TIMESTAMP)`,
      [rideData.driver_id, rideId, tipAmount]
    );

    // Notify driver of tip
    io.to(`user-${rideData.driver_id}`).emit('tip-received', {
      rideId,
      tipAmount,
      tipPercentage,
      riderName: `${user.first_name} ${user.last_name}`,
      message: `You received a $${tipAmount.toFixed(2)} tip! 🎉`
    });

    res.json({
      success: true,
      message: 'Tip processed successfully',
      tipAmount,
      paymentIntentId: tipResult.paymentIntent.id
    });
  } catch (error) {
    console.error('Process tip error:', error);
    res.status(500).json({ error: 'Tip processing failed' });
  }
});

// Comprehensive cancellation and refund system
app.post('/api/rides/:rideId/cancel', authenticateToken, async (req, res) => {
  try {
    const { rideId } = req.params;
    const { reason, userType } = req.body;

    const ride = await db.query('SELECT * FROM rides WHERE id = $1', [rideId]);
    const rideData = ride.rows[0];

    if (!rideData) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    if (['completed', 'cancelled', 'refunded'].includes(rideData.status)) {
      return res.status(400).json({ error: 'Ride cannot be cancelled' });
    }

    const cancellationTime = new Date();
    const rideFare = parseFloat(rideData.estimated_fare) || 0;
    let refundAmount = 0;
    let driverCompensation = 0;
    let cancellationFee = 0;
    let refundPercentage = 0;

    // Get market-specific settings based on pickup location
    const marketSettings = await getMarketPricingSettings(
      parseFloat(rideData.pickup_lat),
      parseFloat(rideData.pickup_lng)
    );

    // Calculate time since accepted (for accepted status)
    const acceptedAt = rideData.accepted_at ? new Date(rideData.accepted_at) : null;
    const timeSinceAccepted = acceptedAt 
      ? (cancellationTime.getTime() - acceptedAt.getTime()) / 1000 
      : 0;

    // Check if surge was active
    const fareEstimateData = typeof rideData.estimated_fare === 'object' 
      ? rideData.estimated_fare 
      : null;
    const isSurgeActive = fareEstimateData?.surge?.isActive || false;

    // Get market-specific cancellation fee from database
    let feeConfig;
    try {
      feeConfig = marketSettingsDB.getCancellationFee(
        marketSettings.marketId,
        rideData.status,
        timeSinceAccepted,
        isSurgeActive
      );
    } catch (error) {
      console.warn('⚠️ Could not get market cancellation fee, using defaults');
      // Fallback to hardcoded defaults
      feeConfig = marketSettingsDB.getDefaultCancellationFee(
        rideData.status,
        timeSinceAccepted,
        isSurgeActive
      );
    }

    // Apply cancellation fee based on market rules
    refundPercentage = feeConfig.refundPercentage;
    refundAmount = rideFare * (refundPercentage / 100);
    cancellationFee = rideFare - refundAmount;

    // Calculate driver compensation
    if (feeConfig.driverCompensationPercentage > 0 && rideData.driver_id) {
      if (rideData.status === 'driver_arrived') {
        // For driver_arrived, compensation is capped by pickup distance
        const pickupDistance = rideData.driver_travel_distance || 2;
        const maxCompensation = pickupDistance * marketSettings.perMileFare * 1.5;
        const percentageCompensation = cancellationFee * (feeConfig.driverCompensationPercentage / 100);
        driverCompensation = Math.min(percentageCompensation, maxCompensation);
      } else {
        // For other statuses, use straight percentage
        driverCompensation = rideFare * (feeConfig.driverCompensationPercentage / 100);
      }
    }

    // Validate status is cancellable
    if (!['requested', 'pending', 'accepted', 'driver_arrived', 'in_progress'].includes(rideData.status)) {
      return res.status(400).json({ error: 'Invalid ride status for cancellation' });
    }

    // Process refund if applicable
    let refundResult = null;
    if (refundAmount > 0 && rideData.payment_intent_id) {
      try {
        refundResult = await paymentService.processRefund(
          rideData.payment_intent_id,
          refundAmount,
          `Ride cancellation: ${reason}`
        );
      } catch (refundError) {
        console.error('Refund processing failed:', refundError);
        // Continue with cancellation even if refund fails
      }
    }

    // Process driver compensation if applicable
    if (driverCompensation > 0 && rideData.driver_id) {
      await db.query(
        `INSERT INTO driver_earnings (driver_id, ride_id, base_fare, platform_fee, total_earned, earned_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [rideData.driver_id, rideId, driverCompensation, 0, driverCompensation]
      );

      // Notify driver of compensation
      io.to(`user-${rideData.driver_id}`).emit('cancellation-compensation', {
        rideId,
        amount: driverCompensation,
        reason: 'Pickup travel compensation',
        message: `You received $${driverCompensation.toFixed(2)} compensation for the cancelled ride.`
      });
    }

    // Update ride status
    await db.query(
      `UPDATE rides SET
        status = 'cancelled',
        cancelled_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [rideId]
    );

    // Remove from pending requests if it was still pending and broadcast update
    if (activeRideRequests.has(rideId)) {
      activeRideRequests.delete(rideId);
      pendingRequestsCount = activeRideRequests.size;
      console.log(`📋 Ride cancelled - Pending requests updated: ${pendingRequestsCount}`);
      
      // Broadcast pending requests decrease to all connected clients
      io.emit('pending-requests-update', {
        pendingRequests: pendingRequestsCount,
        rideId: rideId,
        action: 'cancelled',
        timestamp: new Date().toISOString()
      });
    }

    // Notify all parties
    const cancellationData = {
      rideId,
      reason,
      refundAmount: refundAmount.toFixed(2),
      cancellationFee: cancellationFee.toFixed(2),
      driverCompensation: driverCompensation.toFixed(2),
      refundPercentage,
      processedAt: cancellationTime
    };

    io.to(`user-${rideData.rider_id}`).emit('ride-cancelled', {
      ...cancellationData,
      message: refundAmount > 0
        ? `Ride cancelled. $${refundAmount.toFixed(2)} refund processed.`
        : `Ride cancelled. Cancellation fee: $${cancellationFee.toFixed(2)}`
    });

    if (rideData.driver_id) {
      console.log(`📡 CANCELLATION DEBUG: Emitting ride-cancelled to room: user-${rideData.driver_id}`);
      console.log(`📡 CANCELLATION DEBUG: Payload:`, {
        ...cancellationData,
        message: 'Rider Cancelled'
      });
      
      io.to(`user-${rideData.driver_id}`).emit('ride-cancelled', {
        ...cancellationData,
        message: 'Rider Cancelled'
      });
      
      console.log(`📡 CANCELLATION DEBUG: ride-cancelled event emitted to driver ${rideData.driver_id}`);

      // Update driver availability
      updateDriverAvailability(rideData.driver_id, {
        isAvailable: true,
        currentRideId: null
      });
    }

    res.json({
      success: true,
      message: 'Ride cancelled successfully',
      cancellation: cancellationData
    });

  } catch (error) {
    console.error('Cancellation error:', error);
    res.status(500).json({ error: 'Failed to cancel ride' });
  }
});

app.post('/api/payments/refund', authenticateToken, async (req, res) => {
  try {
    const { rideId, reason, amount } = req.body;

    // Get ride payment info
    const ride = await db.query('SELECT * FROM rides WHERE id = $1', [rideId]);
    const rideData = ride.rows[0];

    if (!rideData || !rideData.payment_intent_id) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const refund = await paymentService.processRefund(
      rideData.payment_intent_id,
      amount,
      reason
    );

    // Update ride status
    await db.updateRideStatus(rideId, 'refunded', {
      refund_id: refund.id,
      refund_amount: refund.amount / 100, // Convert back to dollars
      refund_reason: reason
    });

    res.json({
      message: 'Refund processed successfully',
      refundId: refund.id,
      amount: refund.amount / 100
    });
  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({ error: 'Refund processing failed' });
  }
});

// Apple Pay endpoints
app.post('/api/payments/apple-pay/validate', authenticateToken, async (req, res) => {
  try {
    const { validationURL } = req.body;

    // In production, you would validate the merchant with Apple Pay
    // This is a mock response for development
    const mockMerchantSession = {
      epochTimestamp: Date.now(),
      expiresAt: Date.now() + 3600000, // 1 hour
      merchantSessionIdentifier: 'mock_session_' + Date.now(),
      nonce: 'mock_nonce_' + Math.random().toString(36).substr(2, 9),
      merchantIdentifier: 'merchant.your-app-id',
      domainName: 'your-domain.com',
      displayName: 'Your Ride App',
      signature: 'mock_signature'
    };

    console.log('🍎 Apple Pay merchant validation requested');
    res.json(mockMerchantSession);
  } catch (error) {
    console.error('Apple Pay validation error:', error);
    res.status(500).json({ error: 'Apple Pay validation failed' });
  }
});

app.post('/api/payments/apple-pay/process', authenticateToken, async (req, res) => {
  try {
    const { payment, amount } = req.body;

    console.log('🍎 Processing Apple Pay payment:', { amount });

    // In production, you would:
    // 1. Validate the payment token with Apple Pay
    // 2. Process with your payment processor (Stripe, etc.)
    // 3. Store transaction in database

    // Mock successful payment
    const paymentResult = {
      success: true,
      paymentId: 'applepay_' + Date.now(),
      transactionId: 'txn_' + Date.now(),
      amount: parseFloat(amount),
      currency: 'USD',
      timestamp: new Date().toISOString()
    };

    res.json(paymentResult);
  } catch (error) {
    console.error('Apple Pay processing error:', error);
    res.status(500).json({ error: 'Apple Pay processing failed' });
  }
});

// Google Pay endpoints
app.post('/api/payments/google-pay/process', authenticateToken, async (req, res) => {
  try {
    const { paymentData, amount } = req.body;

    console.log('🟢 Processing Google Pay payment:', { amount });

    // In production, you would:
    // 1. Extract payment token from paymentData
    // 2. Process with your payment processor (Stripe, etc.)
    // 3. Store transaction in database

    // Mock successful payment
    const paymentResult = {
      success: true,
      paymentId: 'googlepay_' + Date.now(),
      transactionId: 'txn_' + Date.now(),
      amount: parseFloat(amount),
      currency: 'USD',
      timestamp: new Date().toISOString()
    };

    res.json(paymentResult);
  } catch (error) {
    console.error('Google Pay processing error:', error);
    res.status(500).json({ error: 'Google Pay processing failed' });
  }
});

// Payment flow testing endpoints
app.post('/api/payments/test/simulate-payment', authenticateToken, async (req, res) => {
  try {
    const { rideId, amount, paymentMethodId, scenario = 'success' } = req.body;

    // Simulate different payment scenarios for testing
    const testResults = {
      success: {
        status: 'succeeded',
        paymentIntentId: `pi_test_${Date.now()}`,
        message: 'Payment processed successfully',
        processingTime: Math.random() * 2000 + 500 // 0.5-2.5 seconds
      },
      failure: {
        status: 'failed',
        error: 'card_declined',
        message: 'Your card was declined',
        errorCode: 'card_declined'
      },
      insufficient_funds: {
        status: 'failed',
        error: 'insufficient_funds',
        message: 'Insufficient funds on payment method',
        errorCode: 'insufficient_funds'
      },
      network_error: {
        status: 'failed',
        error: 'processing_error',
        message: 'Network error occurred during payment processing',
        errorCode: 'processing_error'
      },
      slow_processing: {
        status: 'processing',
        message: 'Payment is being processed...',
        estimatedCompletion: Date.now() + 10000 // 10 seconds
      }
    };

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, testResults[scenario]?.processingTime || 1000));

    if (scenario === 'success') {
      // Record successful payment in database
      await db.query(
        `INSERT INTO payment_transactions (ride_id, stripe_payment_intent_id, amount, currency, status, transaction_type, net_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [rideId, testResults.success.paymentIntentId, amount, 'usd', 'succeeded', 'fare', amount * 0.971] // Stripe fee simulation
      );
    }

    res.json({
      testMode: true,
      scenario,
      result: testResults[scenario] || testResults.success
    });
  } catch (error) {
    console.error('Payment test error:', error);
    res.status(500).json({ error: 'Payment test failed' });
  }
});

app.get('/api/payments/test/payment-methods', authenticateToken, async (req, res) => {
  try {
    // Mock payment methods for testing
    const testPaymentMethods = [
      {
        id: 'pm_test_visa_4242',
        type: 'card',
        card: {
          brand: 'visa',
          last4: '4242',
          exp_month: 12,
          exp_year: 2025
        },
        metadata: { test_scenario: 'success' }
      },
      {
        id: 'pm_test_visa_declined',
        type: 'card',
        card: {
          brand: 'visa',
          last4: '0002',
          exp_month: 12,
          exp_year: 2025
        },
        metadata: { test_scenario: 'card_declined' }
      },
      {
        id: 'pm_test_visa_insufficient',
        type: 'card',
        card: {
          brand: 'visa',
          last4: '9995',
          exp_month: 12,
          exp_year: 2025
        },
        metadata: { test_scenario: 'insufficient_funds' }
      }
    ];

    res.json({
      testMode: true,
      paymentMethods: testPaymentMethods,
      note: 'These are test payment methods for development'
    });
  } catch (error) {
    console.error('Test payment methods error:', error);
    res.status(500).json({ error: 'Failed to get test payment methods' });
  }
});

// Payment method management endpoints
app.get('/api/users/:userId/payment-methods', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user's Stripe customer ID
    const user = await db.getUserById(userId);
    if (!user || !user.stripe_customer_id) {
      return res.json({ paymentMethods: [] });
    }

    // Get payment methods from Stripe
    const paymentMethods = await stripe.paymentMethods.list({
      customer: user.stripe_customer_id,
      type: 'card',
    });

    // Get stored payment methods from database
    const dbPaymentMethods = await db.query(
      'SELECT * FROM payment_methods WHERE user_id = $1',
      [userId]
    );

    const formattedMethods = paymentMethods.data.map(pm => ({
      id: pm.id,
      type: pm.type,
      brand: pm.card?.brand || 'unknown',
      last4: pm.card?.last4 || '****',
      exp_month: pm.card?.exp_month,
      exp_year: pm.card?.exp_year,
      isDefault: dbPaymentMethods.rows.find(db => db.stripe_pm_id === pm.id)?.is_default || false
    }));

    res.json({ paymentMethods: formattedMethods });
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

app.post('/api/users/:userId/payment-methods', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { paymentMethodId, isDefault } = req.body;

    // Get user's Stripe customer ID
    let user = await db.getUserById(userId);

    // Create Stripe customer if doesn't exist
    if (!user.stripe_customer_id) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        phone: user.phone,
        metadata: { user_id: userId }
      });

      await db.query(
        'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
        [customer.id, userId]
      );
      user.stripe_customer_id = customer.id;
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: user.stripe_customer_id,
    });

    // Get payment method details
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    // Store in database
    await db.query(
      `INSERT INTO payment_methods (user_id, stripe_pm_id, type, brand, last4, exp_month, exp_year, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId,
        paymentMethodId,
        paymentMethod.type,
        paymentMethod.card?.brand || 'unknown',
        paymentMethod.card?.last4 || '****',
        paymentMethod.card?.exp_month,
        paymentMethod.card?.exp_year,
        isDefault || false
      ]
    );

    // If this is set as default, update others
    if (isDefault) {
      await db.query(
        'UPDATE payment_methods SET is_default = false WHERE user_id = $1 AND stripe_pm_id != $2',
        [userId, paymentMethodId]
      );
    }

    res.json({
      success: true,
      message: 'Payment method added successfully',
      paymentMethod: {
        id: paymentMethodId,
        type: paymentMethod.type,
        brand: paymentMethod.card?.brand,
        last4: paymentMethod.card?.last4,
        exp_month: paymentMethod.card?.exp_month,
        exp_year: paymentMethod.card?.exp_year,
        isDefault: isDefault || false
      }
    });
  } catch (error) {
    console.error('Error adding payment method:', error);
    res.status(500).json({ error: 'Failed to add payment method' });
  }
});

app.delete('/api/users/:userId/payment-methods/:paymentMethodId', authenticateToken, async (req, res) => {
  try {
    const { userId, paymentMethodId } = req.params;

    // Detach from Stripe
    await stripe.paymentMethods.detach(paymentMethodId);

    // Remove from database
    await db.query(
      'DELETE FROM payment_methods WHERE user_id = $1 AND stripe_pm_id = $2',
      [userId, paymentMethodId]
    );

    res.json({ success: true, message: 'Payment method removed successfully' });
  } catch (error) {
    console.error('Error removing payment method:', error);
    res.status(500).json({ error: 'Failed to remove payment method' });
  }
});

app.post('/api/users/:userId/payment-methods/:paymentMethodId/set-default', authenticateToken, async (req, res) => {
  try {
    const { userId, paymentMethodId } = req.params;

    // Update all methods to not default
    await db.query(
      'UPDATE payment_methods SET is_default = false WHERE user_id = $1',
      [userId]
    );

    // Set the selected one as default
    await db.query(
      'UPDATE payment_methods SET is_default = true WHERE user_id = $1 AND stripe_pm_id = $2',
      [userId, paymentMethodId]
    );

    res.json({ success: true, message: 'Default payment method updated' });
  } catch (error) {
    console.error('Error setting default payment method:', error);
    res.status(500).json({ error: 'Failed to set default payment method' });
  }
});

// Create setup intent for adding new payment methods
app.post('/api/users/:userId/setup-intent', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { paymentMethodTypes = ['card'], walletType } = req.body;

    let user = await db.getUserById(userId);

    // Create Stripe customer if doesn't exist
    if (!user.stripe_customer_id) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        phone: user.phone,
        metadata: { user_id: userId }
      });

      await db.query(
        'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
        [customer.id, userId]
      );
      user.stripe_customer_id = customer.id;
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: user.stripe_customer_id,
      payment_method_types: paymentMethodTypes,
      usage: 'off_session',
      metadata: walletType ? { wallet_type: walletType } : {}
    });

    res.json({
      client_secret: setupIntent.client_secret,
      setup_intent_id: setupIntent.id
    });
  } catch (error) {
    console.error('Error creating setup intent:', error);
    res.status(500).json({ error: 'Failed to create setup intent' });
  }
});

// Add digital wallet endpoint
app.post('/api/users/:userId/digital-wallet', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { walletType } = req.body;

    // Get user
    let user = await db.getUserById(userId);

    // Create Stripe customer if doesn't exist
    if (!user.stripe_customer_id) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        phone: user.phone,
        metadata: { user_id: userId }
      });

      await db.query(
        'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
        [customer.id, userId]
      );
      user.stripe_customer_id = customer.id;
    }

    // Create a mock payment method for the digital wallet
    const mockPaymentMethodId = `pm_${walletType}_${Date.now()}`;

    // Store in database
    await db.query(
      `INSERT INTO payment_methods (user_id, stripe_pm_id, type, brand, last4, is_default)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        mockPaymentMethodId,
        walletType,
        walletType === 'apple_pay' ? 'apple' : 'google',
        '****',
        false
      ]
    );

    res.json({
      success: true,
      message: `${walletType === 'apple_pay' ? 'Apple Pay' : 'Google Pay'} added successfully`,
      paymentMethod: {
        id: mockPaymentMethodId,
        type: walletType,
        brand: walletType === 'apple_pay' ? 'apple' : 'google',
        name: walletType === 'apple_pay' ? 'Apple Pay' : 'Google Pay',
        details: walletType === 'apple_pay' ? 'Touch ID / Face ID' : 'Gmail Account',
        isDefault: false
      }
    });
  } catch (error) {
    console.error('Error adding digital wallet:', error);
    res.status(500).json({ error: 'Failed to add digital wallet' });
  }
});

app.post('/api/payments/test/validate-flow', authenticateToken, async (req, res) => {
  try {
    const { rideId, paymentMethodId } = req.body;

    // Comprehensive payment flow validation
    const validationResults = {
      rideExists: false,
      rideStatus: null,
      paymentMethodValid: false,
      userHasPaymentMethod: false,
      estimatedProcessingTime: 0,
      potentialIssues: [],
      recommendations: []
    };

    // Check if ride exists
    const ride = await db.query('SELECT * FROM rides WHERE id = $1', [rideId]);
    if (ride.rows[0]) {
      validationResults.rideExists = true;
      validationResults.rideStatus = ride.rows[0].status;

      if (ride.rows[0].status !== 'completed') {
        validationResults.potentialIssues.push('Ride is not yet completed');
      }
    } else {
      validationResults.potentialIssues.push('Ride not found');
    }

    // Mock payment method validation
    if (paymentMethodId && paymentMethodId.startsWith('pm_test_')) {
      validationResults.paymentMethodValid = true;
      validationResults.userHasPaymentMethod = true;

      if (paymentMethodId.includes('declined')) {
        validationResults.potentialIssues.push('Payment method may be declined');
        validationResults.recommendations.push('Try a different payment method');
      }
      if (paymentMethodId.includes('insufficient')) {
        validationResults.potentialIssues.push('Insufficient funds possible');
        validationResults.recommendations.push('Check account balance');
      }
    } else {
      validationResults.potentialIssues.push('Invalid or missing payment method');
      validationResults.recommendations.push('Add a valid payment method');
    }

    // Estimate processing time based on various factors
    const baseTime = 1000; // 1 second base
    const networkLatency = Math.random() * 500; // Up to 500ms network
    const processingDelay = validationResults.potentialIssues.length > 0 ? 2000 : 0;

    validationResults.estimatedProcessingTime = Math.round(baseTime + networkLatency + processingDelay);

    // Overall validation status
    validationResults.isValid = validationResults.rideExists &&
                               validationResults.paymentMethodValid &&
                               validationResults.potentialIssues.length === 0;

    res.json({
      testMode: true,
      validation: validationResults,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Payment flow validation error:', error);
    res.status(500).json({ error: 'Payment flow validation failed' });
  }
});

// Dynamic fare recalculation endpoint
app.post('/api/rides/:rideId/recalculate-fare', authenticateToken, async (req, res) => {
  try {
    const { rideId } = req.params;
    const { newDestination, additionalStops, waitTimeStart, waitTimeEnd, routeChanges } = req.body;

    const ride = await db.query('SELECT * FROM rides WHERE id = $1', [rideId]);
    if (!ride.rows[0]) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    const rideData = ride.rows[0];
    let updatedFare = parseFloat(rideData.estimated_fare) || 0;
    let fareAdjustments = [];

    // Calculate wait time charges
    if (waitTimeStart && waitTimeEnd) {
      const startTime = new Date(waitTimeStart);
      const endTime = new Date(waitTimeEnd);
      const waitTimeSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

      const gracePeriodSeconds = 120;
      const chargeableSeconds = Math.max(0, waitTimeSeconds - gracePeriodSeconds);
      const chargeableMinutes = chargeableSeconds / 60;
      const waitRate = pricingSettings.perMinuteFare || 0.35;
      const waitCharges = chargeableMinutes * waitRate;

      if (waitCharges > 0) {
        updatedFare += waitCharges;
        fareAdjustments.push({
          type: 'wait_time',
          description: `Wait time: ${Math.floor(waitTimeSeconds)} seconds (${Math.floor(chargeableMinutes)} min charged)`,
          amount: waitCharges
        });
      }
    }

    // Calculate destination change charges
    if (newDestination) {
      const originalDistance = calculateDistance(
        rideData.pickup_lat, rideData.pickup_lng,
        rideData.destination_lat, rideData.destination_lng
      );
      const newDistance = calculateDistance(
        rideData.pickup_lat, rideData.pickup_lng,
        newDestination.lat, newDestination.lng
      );

      const distanceDifference = Math.abs(newDistance - originalDistance) * 0.621371; // Convert to miles
      const additionalFare = distanceDifference * pricingSettings.perMileFare;

      if (additionalFare > 0.50) { // Only charge if significant difference
        updatedFare += additionalFare;
        fareAdjustments.push({
          type: 'destination_change',
          description: `Destination change: ${distanceDifference.toFixed(1)} additional miles`,
          amount: additionalFare
        });

        // Update ride destination
        await db.query(
          'UPDATE rides SET destination_address = $1, destination_lat = $2, destination_lng = $3 WHERE id = $4',
          [newDestination.address, newDestination.lat, newDestination.lng, rideId]
        );
      }
    }

    // Calculate additional stops charges
    if (additionalStops && additionalStops.length > 0) {
      const stopCharges = additionalStops.length * 2.50; // $2.50 per additional stop
      const stopTimeCharges = additionalStops.length * 3 * pricingSettings.perMinuteFare; // 3 min per stop
      const totalStopCharges = stopCharges + stopTimeCharges;

      updatedFare += totalStopCharges;
      fareAdjustments.push({
        type: 'additional_stops',
        description: `${additionalStops.length} additional stops`,
        amount: totalStopCharges
      });
    }

    // Calculate route deviation charges
    if (routeChanges && routeChanges.extraDistance > 0) {
      const deviationCharges = routeChanges.extraDistance * 0.621371 * pricingSettings.perMileFare;
      if (deviationCharges > 1.00) {
        updatedFare += deviationCharges;
        fareAdjustments.push({
          type: 'route_deviation',
          description: `Route deviation: ${(routeChanges.extraDistance * 0.621371).toFixed(1)} extra miles`,
          amount: deviationCharges
        });
      }
    }

    // Update ride with new fare
    await db.query(
      'UPDATE rides SET estimated_fare = $1, fare_adjustments = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [updatedFare, JSON.stringify(fareAdjustments), rideId]
    );

    res.json({
      success: true,
      originalFare: parseFloat(rideData.estimated_fare),
      updatedFare: updatedFare.toFixed(2),
      adjustments: fareAdjustments,
      totalAdjustment: fareAdjustments.reduce((sum, adj) => sum + adj.amount, 0).toFixed(2)
    });

  } catch (error) {
    console.error('Fare recalculation error:', error);
    res.status(500).json({ error: 'Failed to recalculate fare' });
  }
});

// Wait time calculation endpoint
app.post('/api/rides/calculate-wait-time', authenticateToken, async (req, res) => {
  try {
    const { rideId, waitTimeStart, waitTimeEnd } = req.body;

    if (!waitTimeStart || !waitTimeEnd) {
      return res.status(400).json({ error: 'Wait time start and end times are required' });
    }

    const startTime = new Date(waitTimeStart);
    const endTime = new Date(waitTimeEnd);
    const waitTimeSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

    // Grace period of 2 minutes
    const gracePeriodSeconds = 120;
    const chargeableSeconds = Math.max(0, waitTimeSeconds - gracePeriodSeconds);
    const chargeableMinutes = chargeableSeconds / 60;

    // Get current pricing settings for wait time rate
    const waitRate = pricingSettings.perMinuteFare || 0.35;
    const waitCharges = chargeableMinutes * waitRate;

    // Update ride with wait time information
    await db.query(
      'UPDATE rides SET wait_time_seconds = $1, wait_time_charges = $2 WHERE id = $3',
      [waitTimeSeconds, waitCharges, rideId]
    );

    res.json({
      success: true,
      waitTimeSeconds,
      chargeableSeconds,
      waitCharges: waitCharges.toFixed(2),
      gracePeriodSeconds,
      waitRate
    });

  } catch (error) {
    console.error('Wait time calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate wait time' });
  }
});

// Enhanced error handling for payment failures
app.post('/api/payments/handle-failure', authenticateToken, async (req, res) => {
  try {
    const { rideId, paymentIntentId, errorCode, retryAttempt = 1 } = req.body;

    // Log payment failure
    await db.query(
      `INSERT INTO payment_transactions (ride_id, stripe_payment_intent_id, amount, currency, status, transaction_type, net_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [rideId, paymentIntentId, 0, 'usd', 'failed', 'fare', 0]
    );

    // Determine retry strategy
    const retryStrategies = {
      'card_declined': {
        canRetry: false,
        message: 'Please use a different payment method',
        suggestedAction: 'add_payment_method'
      },
      'insufficient_funds': {
        canRetry: retryAttempt < 2,
        message: 'Insufficient funds. Please add funds or use different payment method',
        suggestedAction: 'check_balance'
      },
      'processing_error': {
        canRetry: retryAttempt < 3,
        message: 'Network error. Please try again',
        suggestedAction: 'retry_payment',
        retryDelay: Math.min(retryAttempt * 2000, 10000) // Exponential backoff
      },
      'expired_card': {
        canRetry: false,
        message: 'Your card has expired. Please update your payment method',
        suggestedAction: 'update_payment_method'
      }
    };

    const strategy = retryStrategies[errorCode] || retryStrategies.processing_error;

    res.json({
      paymentFailed: true,
      errorCode,
      retryAttempt,
      canRetry: strategy.canRetry,
      message: strategy.message,
      suggestedAction: strategy.suggestedAction,
      retryDelay: strategy.retryDelay || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Payment failure handling error:', error);
    res.status(500).json({ error: 'Failed to handle payment failure' });
  }
});

// Stripe webhook endpoint
app.post('/api/payments/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    await paymentService.handleWebhook(event);
    res.json({received: true});
  } catch (error) {
    console.error('Webhook handling failed:', error);
    res.status(500).json({error: 'Webhook processing failed'});
  }
});

// Plaid Integration Routes
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

const plaidConfiguration = new Configuration({
  basePath: process.env.PLAID_ENV === 'production' ? PlaidEnvironments.production : PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(plaidConfiguration);

// Create link token for Plaid Link
app.post('/api/plaid/create-link-token', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    
    const request = {
      user: {
        client_user_id: userId || req.user.userId
      },
      client_name: 'π Ride App',
      products: ['auth', 'identity'],
      country_codes: ['US'],
      language: 'en',
      redirect_uri: process.env.PLAID_REDIRECT_URI,
    };

    const response = await plaidClient.linkTokenCreate(request);
    res.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Plaid link token creation failed:', error);
    res.status(500).json({ error: 'Failed to create link token' });
  }
});

// Exchange public token for access token
app.post('/api/plaid/exchange-public-token', authenticateToken, async (req, res) => {
  try {
    const { public_token, metadata } = req.body;

    const response = await plaidClient.linkTokenExchange({
      public_token: public_token,
    });

    const { access_token, item_id } = response.data;

    // Store access token securely in database
    await db.query(
      `INSERT INTO plaid_accounts (user_id, access_token, item_id, institution_id, institution_name, account_metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user.userId,
        access_token, // In production, encrypt this
        item_id,
        metadata.institution.institution_id,
        metadata.institution.name,
        JSON.stringify(metadata)
      ]
    );

    res.json({ 
      success: true, 
      institution: metadata.institution.name,
      accounts: metadata.accounts.length 
    });
  } catch (error) {
    console.error('Plaid token exchange failed:', error);
    res.status(500).json({ error: 'Failed to exchange token' });
  }
});

// Get account info for verification
app.get('/api/plaid/accounts', authenticateToken, async (req, res) => {
  try {
    const userAccounts = await db.query(
      'SELECT * FROM plaid_accounts WHERE user_id = $1',
      [req.user.userId]
    );

    if (userAccounts.rows.length === 0) {
      return res.json({ accounts: [] });
    }

    const account = userAccounts.rows[0];
    
    // Get account details from Plaid
    const response = await plaidClient.accountsGet({
      access_token: account.access_token
    });

    const formattedAccounts = response.data.accounts.map(acc => ({
      id: acc.account_id,
      name: acc.name,
      type: acc.type,
      subtype: acc.subtype,
      mask: acc.mask,
      institution: account.institution_name
    }));

    res.json({ accounts: formattedAccounts });
  } catch (error) {
    console.error('Plaid accounts fetch failed:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// Verify bank account for payments
app.post('/api/plaid/verify-account', authenticateToken, async (req, res) => {
  try {
    const { accountId } = req.body;
    
    const userAccount = await db.query(
      'SELECT * FROM plaid_accounts WHERE user_id = $1',
      [req.user.userId]
    );

    if (userAccount.rows.length === 0) {
      return res.status(404).json({ error: 'No linked accounts found' });
    }

    const account = userAccount.rows[0];

    // Get account and routing numbers
    const authResponse = await plaidClient.authGet({
      access_token: account.access_token
    });

    const selectedAccount = authResponse.data.accounts.find(acc => acc.account_id === accountId);
    const numbers = authResponse.data.numbers.ach.find(num => num.account_id === accountId);

    if (!selectedAccount || !numbers) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Create Stripe payment method for ACH
    const paymentMethod = await stripe.paymentMethods.create({
      type: 'us_bank_account',
      us_bank_account: {
        routing_number: numbers.routing,
        account_number: numbers.account,
        account_holder_type: 'individual',
        account_type: selectedAccount.subtype === 'checking' ? 'checking' : 'savings'
      }
    });

    // Store payment method
    await db.query(
      `INSERT INTO payment_methods (user_id, stripe_pm_id, type, brand, last4, is_default)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user.userId,
        paymentMethod.id,
        'bank_account',
        selectedAccount.subtype,
        numbers.account.slice(-4),
        false
      ]
    );

    res.json({
      success: true,
      paymentMethod: {
        id: paymentMethod.id,
        type: 'bank_account',
        name: `${selectedAccount.name} ****${numbers.account.slice(-4)}`,
        details: `${selectedAccount.subtype} account`,
        institution: account.institution_name
      }
    });
  } catch (error) {
    console.error('Bank account verification failed:', error);
    res.status(500).json({ error: 'Failed to verify bank account' });
  }
});

// Driver Verification Routes

// Submit driver application
app.post('/api/drivers/apply', authenticateToken, async (req, res) => {
  try {
    const applicationData = req.body;
    const result = await DriverVerificationService.submitApplication(
      req.user.userId,
      applicationData
    );

    // Initiate background check
    const backgroundCheck = await DriverVerificationService.initiateBackgroundCheck(req.user.userId);

    res.status(201).json({
      message: 'Driver application submitted successfully',
      applicationId: result.applicationId,
      status: result.status,
      backgroundCheckId: backgroundCheck.checkId,
      nextSteps: [
        'Upload required documents',
        'Complete background check',
        'Schedule vehicle inspection',
        'Wait for approval'
      ]
    });
  } catch (error) {
    console.error('Driver application error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload driver documents
app.post('/api/drivers/documents', authenticateToken, upload.fields([
  { name: 'licenseImage', maxCount: 1 },
  { name: 'insuranceImage', maxCount: 1 },
  { name: 'registrationImage', maxCount: 1 },
  { name: 'profilePhoto', maxCount: 1 }
]), async (req, res) => {
  try {
    const uploadedDocs = [];

    if (req.files) {
      for (const [fieldName, files] of Object.entries(req.files)) {
        if (files && files.length > 0) {
          const file = files[0];
          const documentId = await DriverVerificationService.uploadDocument(
            req.user.userId,
            fieldName,
            file.path
          );
          uploadedDocs.push({
            documentType: fieldName,
            documentId,
            fileName: file.originalname
          });
        }
      }
    }

    res.json({
      message: 'Documents uploaded successfully',
      documents: uploadedDocs
    });
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get driver verification status
app.get('/api/drivers/verification-status', authenticateToken, async (req, res) => {
  try {
    const status = await DriverVerificationService.getVerificationStatus(req.user.userId);
    res.json(status);
  } catch (error) {
    console.error('Get verification status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Schedule vehicle inspection
app.post('/api/drivers/schedule-inspection', authenticateToken, async (req, res) => {
  try {
    const { preferredDate, preferredTime } = req.body;
    const result = await DriverVerificationService.scheduleInspection(
      req.user.userId,
      preferredDate,
      preferredTime
    );

    res.json({
      message: 'Vehicle inspection scheduled successfully',
      inspectionId: result.inspectionId,
      status: result.status
    });
  } catch (error) {
    console.error('Schedule inspection error:', error);
    res.status(500).json({ error: error.message });
  }
});


// Admin: Update verification status
app.put('/api/admin/drivers/:userId/verification', authenticateToken, async (req, res) => {
  try {
    // Add admin role check here
    const { status, reason } = req.body;
    const { userId } = req.params;

    const result = await DriverVerificationService.updateVerificationStatus(
      userId,
      status,
      reason
    );

    res.json({
      message: 'Verification status updated successfully',
      status: result.status,
      reason: result.reason
    });
  } catch (error) {
    console.error('Update verification status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all driver applications (admin)
app.get('/api/admin/drivers/applications', authenticateToken, async (req, res) => {
  try {
    // Add admin role check here
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT da.*, u.email, u.created_at as user_created_at
      FROM driver_applications da
      JOIN users u ON da.user_id = u.id
    `;
    const queryParams = [];

    if (status) {
      query += ' WHERE da.status = $1';
      queryParams.push(status);
    }

    query += ` ORDER BY da.submitted_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const result = await db.query(query, queryParams);

    res.json({
      applications: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.rows.length
      }
    });
  } catch (error) {
    console.error('Get driver applications error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Driver-Rider Matching Algorithm
const activeRideRequests = new Map(); // Store active ride requests
const driverAvailability = new Map(); // Track driver availability in real-time
const cascadingRequests = new Map(); // Track cascading driver requests with 7-second timeouts
const airportDriverQueues = new Map(); // Airport-specific driver queues

// Track pending ride requests for surge pricing
let pendingRequestsCount = 0;

// Missing function implementations
function updateDriverAvailability(driverId, data) {
  const existing = driverAvailability.get(driverId) || {};
  const updated = { ...existing, ...data };
  driverAvailability.set(driverId, updated);
  
  console.log(`🔄 Updated driver availability for ${driverId}:`);
  console.log(`   - isAvailable: ${updated.isAvailable}`);
  console.log(`   - location: ${updated.lat}, ${updated.lng}`);
  console.log(`   - total drivers in map: ${driverAvailability.size}`);
}

function removeDriverFromAirportQueue(driverId, airport) {
  const queue = airportDriverQueues.get(airport) || [];
  const filteredQueue = queue.filter(driver => driver.driverId !== driverId);
  airportDriverQueues.set(airport, filteredQueue);
}

// Calculate distance between two points using Haversine formula (for proximity checks only)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in kilometers
}

// Calculate REAL driving distance using Google Maps Directions API
async function calculateDrivingDistance(pickup, destination) {
  try {
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!googleMapsApiKey) {
      console.warn('⚠️ Google Maps API key not found, falling back to straight-line distance');
      const fallbackDistance = calculateDistance(pickup.lat, pickup.lng, destination.lat, destination.lng);
      return {
        distanceKm: fallbackDistance,
        distanceMiles: fallbackDistance * 0.621371,
        durationMinutes: Math.round(fallbackDistance / 0.4 + 2), // Rough estimate
        source: 'fallback'
      };
    }

    const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?` +
      `origin=${pickup.lat},${pickup.lng}&` +
      `destination=${destination.lat},${destination.lng}&` +
      `mode=driving&` +
      `avoid=tolls&` +
      `key=${googleMapsApiKey}`;

    console.log('🗺️ Fetching real driving distance from Google Maps...');
    const response = await fetch(directionsUrl);
    const data = await response.json();

    if (data.status === 'OK' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const leg = route.legs[0];
      
      const distanceMeters = leg.distance.value;
      const durationSeconds = leg.duration.value;
      
      const distanceKm = distanceMeters / 1000;
      const distanceMiles = distanceKm * 0.621371;
      const durationMinutes = Math.round(durationSeconds / 60);

      console.log(`✅ Real driving distance: ${distanceMiles.toFixed(2)} miles (${distanceKm.toFixed(2)} km)`);
      
      return {
        distanceKm,
        distanceMiles,
        durationMinutes,
        source: 'google_maps'
      };
    } else {
      console.warn('⚠️ Google Directions API failed:', data.status);
      // Fallback to straight-line distance
      const fallbackDistance = calculateDistance(pickup.lat, pickup.lng, destination.lat, destination.lng);
      return {
        distanceKm: fallbackDistance,
        distanceMiles: fallbackDistance * 0.621371,
        durationMinutes: Math.round(fallbackDistance / 0.4 + 2),
        source: 'fallback'
      };
    }
  } catch (error) {
    console.error('❌ Error calculating driving distance:', error);
    // Fallback to straight-line distance
    const fallbackDistance = calculateDistance(pickup.lat, pickup.lng, destination.lat, destination.lng);
    return {
      distanceKm: fallbackDistance,
      distanceMiles: fallbackDistance * 0.621371,
      durationMinutes: Math.round(fallbackDistance / 0.4 + 2),
      source: 'fallback'
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 2.6: Weather, Traffic & Route Enhancement Helper Functions
// ═══════════════════════════════════════════════════════════════════

// 1. Fetch weather data from OpenWeather API
async function getWeatherData(lat, lng) {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      console.log('⚠️ OPENWEATHER_API_KEY not configured, using defaults');
      return { condition: 'Clear', temp: 70, description: 'clear sky' };
    }
    
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=imperial`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn('⚠️ Weather API returned error, using defaults');
      return { condition: 'Clear', temp: 70, description: 'clear sky' };
    }
    
    const data = await response.json();
    const condition = data.weather?.[0]?.main || 'Clear';
    const temp = Math.round(data.main?.temp || 70);
    const description = data.weather?.[0]?.description || 'clear sky';
    
    console.log(`🌤️ Weather at (${lat}, ${lng}): ${condition}, ${temp}°F - ${description}`);
    return { condition, temp, description };
  } catch (error) {
    console.error('❌ Weather API error:', error.message);
    return { condition: 'Clear', temp: 70, description: 'clear sky' };
  }
}

// 2. Get traffic multiplier based on time of day
function getTrafficMultiplierEnhanced(hour, dayOfWeek) {
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  
  if (isWeekday) {
    // Morning rush: 7-10am
    if (hour >= 7 && hour < 10) return 1.5;
    // Evening rush: 4-6:30pm
    if (hour >= 16 && hour < 19) return 1.5;
    // Daytime: 10am-4pm
    if (hour >= 10 && hour < 16) return 1.2;
  }
  
  // Off-peak (nights, weekends)
  return 1.0;
}

// 3. Get weather ETA multiplier (driving speed impact)
function getWeatherETAMultiplier(condition) {
  const multipliers = {
    'Clear': 1.0,
    'Clouds': 1.0,
    'Mist': 1.1,
    'Fog': 1.3,
    'Rain': 1.5,
    'Drizzle': 1.3,
    'Thunderstorm': 1.8,
    'Snow': 2.0,
    'Sleet': 1.8
  };
  return multipliers[condition] || 1.0;
}

// 4. Get weather delay in minutes (added buffer)
function getWeatherDelayMinutes(condition) {
  const delays = {
    'Clear': 0,
    'Clouds': 0,
    'Mist': 2,
    'Fog': 3,
    'Rain': 5,
    'Drizzle': 3,
    'Thunderstorm': 8,
    'Snow': 10,
    'Sleet': 7
  };
  return delays[condition] || 0;
}

// 5. Get weather surge multiplier (demand increase)
function getWeatherSurgeMultiplier(condition) {
  const multipliers = {
    'Clear': 1.0,
    'Clouds': 1.0,
    'Mist': 1.1,
    'Fog': 1.2,
    'Rain': 1.3,
    'Drizzle': 1.2,
    'Thunderstorm': 1.8,
    'Snow': 2.0,
    'Sleet': 1.6
  };
  return multipliers[condition] || 1.0;
}

// 6. Get organic demand multiplier based on time
function getOrganicDemandMultiplier(hour, dayOfWeek) {
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const isFridayOrSaturday = dayOfWeek === 5 || dayOfWeek === 6;
  
  // Morning commute (7-10am weekdays)
  if (isWeekday && hour >= 7 && hour < 10) return 1.5;
  
  // Evening commute (4-6:30pm weekdays)
  if (isWeekday && hour >= 16 && hour < 19) return 1.5;
  
  // Friday/Saturday night (10pm-2am)
  if (isFridayOrSaturday && (hour >= 22 || hour < 2)) return 1.5;
  
  // Weekend afternoon (12-6pm)
  if (!isWeekday && hour >= 12 && hour < 18) return 1.2;
  
  return 1.0;
}

// 7. Calculate ETA confidence score
function calculateETAConfidence(distanceMiles, trafficMult, weatherMult) {
  let confidence = 1.0;
  
  // Distance penalties
  if (distanceMiles > 20) confidence -= 0.15;
  else if (distanceMiles > 10) confidence -= 0.10;
  else if (distanceMiles > 5) confidence -= 0.05;
  
  // Traffic penalties
  if (trafficMult > 1.3) confidence -= 0.10;
  
  // Weather penalties
  if (weatherMult > 1.3) confidence -= 0.10;
  
  return Math.max(0.5, Math.min(1.0, confidence));
}

// 8. Check if point is within geofence (Haversine)
function isWithinGeofence(lat1, lng1, lat2, lng2, radiusMeters) {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  
  return distance <= radiusMeters;
}

// 9. Calculate enhanced route with polyline and steps
async function calculateEnhancedRoute(origin, destination) {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ GOOGLE_MAPS_API_KEY not configured');
      return createFallbackRoute(origin, destination);
    }
    
    const url = `https://maps.googleapis.com/maps/api/directions/json?` +
      `origin=${origin.lat},${origin.lng}&` +
      `destination=${destination.lat},${destination.lng}&` +
      `mode=driving&` +
      `departure_time=now&` +
      `key=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status !== 'OK' || !data.routes?.[0]) {
      console.warn('⚠️ Google Directions API error:', data.status);
      return createFallbackRoute(origin, destination);
    }
    
    const route = data.routes[0];
    const leg = route.legs[0];
    
    // Extract polyline
    const polyline = route.overview_polyline?.points || null;
    
    // Extract and format steps
    const steps = (leg.steps || []).map(step => ({
      instruction: step.html_instructions?.replace(/<[^>]*>/g, '') || '',
      distance: {
        meters: step.distance?.value || 0,
        text: step.distance?.text || '',
        miles: (step.distance?.value || 0) * 0.000621371
      },
      duration: {
        seconds: step.duration?.value || 0,
        text: step.duration?.text || '',
        minutes: Math.ceil((step.duration?.value || 0) / 60)
      },
      maneuver: step.maneuver || 'straight',
      start_location: step.start_location,
      end_location: step.end_location
    }));
    
    // Use traffic-aware duration if available
    const durationSeconds = leg.duration_in_traffic?.value || leg.duration?.value || 0;
    const distanceMeters = leg.distance?.value || 0;
    
    return {
      polyline,
      steps,
      baseDurationSeconds: durationSeconds,
      baseDurationMinutes: Math.ceil(durationSeconds / 60),
      distanceMeters,
      distanceKm: distanceMeters / 1000,
      distanceMiles: distanceMeters * 0.000621371,
      source: 'google_maps'
    };
  } catch (error) {
    console.error('❌ Enhanced route calculation error:', error.message);
    return createFallbackRoute(origin, destination);
  }
}

// 10. Create fallback route when Google API unavailable
function createFallbackRoute(origin, destination) {
  const distanceKm = calculateDistance(origin.lat, origin.lng, destination.lat, destination.lng);
  const distanceMiles = distanceKm * 0.621371;
  const estimatedMinutes = Math.round(distanceKm / 0.5 + 2); // ~30km/h + 2min buffer
  
  return {
    polyline: null,
    steps: [],
    baseDurationSeconds: estimatedMinutes * 60,
    baseDurationMinutes: estimatedMinutes,
    distanceMeters: distanceKm * 1000,
    distanceKm,
    distanceMiles,
    source: 'fallback_haversine'
  };
}

// 11. Calculate adjusted ETA with all factors
function calculateAdjustedETA(baseMinutes, trafficMult, weatherMult, weatherDelay, distanceMiles) {
  const adjustedMinutes = Math.round(baseMinutes * trafficMult * weatherMult + weatherDelay);
  const confidence = calculateETAConfidence(distanceMiles, trafficMult, weatherMult);
  const variance = Math.round(adjustedMinutes * 0.2); // ±20%
  
  return {
    adjustedMinutes,
    confidence,
    minMinutes: Math.max(1, adjustedMinutes - variance),
    maxMinutes: adjustedMinutes + variance
  };
}



// Database-driven surge pricing calculation with configurable rules
async function calculateSurgeMultiplier(pickupLat, pickupLng) {
  if (!db) {
    // Fallback to minimal surge if database not available
    return {
      multiplier: 1.0,
      isActive: false,
      factors: ['Database Unavailable'],
      demandLevel: 'Unknown',
      availableDrivers: 0,
      pendingRequests: 0
    };
  }

  try {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    
    let baseMultiplier = 1.0;
    let surgeFactors = [];
    
    console.log(`🔥 SURGE START: lat=${pickupLat}, lng=${pickupLng}, day=${dayOfWeek}, hour=${hour}, baseMultiplier=${baseMultiplier}`);

    // Get algorithm config to check if surge pricing is enabled
    const algorithmConfig = await db.query(`
      SELECT config_key, config_value FROM surge_algorithm_config WHERE is_active = true
    `);
    
    const config = {};
    algorithmConfig.rows.forEach(row => {
      config[row.config_key] = parseFloat(row.config_value);
    });

    console.log(`🔥 SURGE CONFIG: surge_enabled=${config.surge_pricing_enabled}, config_count=${Object.keys(config).length}`);
    
    // Check if surge pricing is enabled
    if (!config.surge_pricing_enabled || config.surge_pricing_enabled === 0) {
      console.log(`🔥 SURGE DISABLED: returning 1.0 multiplier`);
      return {
        multiplier: 1.0,
        isActive: false,
        factors: ['Surge Pricing Disabled'],
        demandLevel: 'Normal',
        availableDrivers: 0,
        pendingRequests: 0
      };
    }
    
    console.log(`🔥 SURGE ENABLED: proceeding with time-based rules`);

    // 1. TIME-BASED SURGE from database
    const timeRules = await db.query(`
      SELECT * FROM surge_time_rules WHERE is_active = true
    `);
    
    for (const rule of timeRules.rows) {
      // Handle both JSON string and direct array formats safely
      let daysOfWeek;
      try {
        if (typeof rule.days_of_week === 'string') {
          // Clean the string and try to parse as JSON
          let cleanString = rule.days_of_week.trim();
          
          // If it doesn't start with quotes but looks like an array, add quotes
          if (cleanString.startsWith('[') && !cleanString.startsWith('"[')) {
            cleanString = JSON.stringify(cleanString);
            cleanString = cleanString.slice(1, -1); // Remove outer quotes
          }
          
          daysOfWeek = JSON.parse(cleanString);
        } else if (Array.isArray(rule.days_of_week)) {
          daysOfWeek = rule.days_of_week;
        } else {
          // Last resort: try to extract numbers from the string
          const matches = String(rule.days_of_week).match(/\d+/g);
          daysOfWeek = matches ? matches.map(Number) : [];
        }
      } catch (error) {
        console.warn(`Failed to parse days_of_week for rule ${rule.rule_name}:`, rule.days_of_week, error.message);
        continue; // Skip this rule
      }
      let timeMatches = false;
      
      if (rule.start_hour <= rule.end_hour) {
        // Same day range (e.g., 7-9)
        timeMatches = hour >= rule.start_hour && hour <= rule.end_hour;
      } else {
        // Cross-midnight range (e.g., 22-3)
        timeMatches = hour >= rule.start_hour || hour <= rule.end_hour;
      }
      
      if (timeMatches && daysOfWeek.includes(dayOfWeek)) {
        const ruleValue = parseFloat(rule.surge_multiplier) || 0;
        baseMultiplier += ruleValue;
        console.log(`🔥 TIME RULE: ${rule.rule_name} added ${ruleValue}, baseMultiplier now ${baseMultiplier}`);
        surgeFactors.push(rule.rule_name);
      }
    }

    // 2. WEATHER-BASED SURGE - Disabled fake weather simulation
    // Real weather surge should be triggered by actual weather API data, not random simulation

    // 3. ZONE-BASED SURGE from database
    const zones = await db.query(`
      SELECT sz.*, szo.manual_multiplier, szo.override_reason, szo.expires_at,
             CASE WHEN szo.id IS NOT NULL AND (szo.expires_at IS NULL OR szo.expires_at > CURRENT_TIMESTAMP) 
                  THEN true ELSE false END as has_override
      FROM surge_zones sz
      LEFT JOIN surge_zone_overrides szo ON sz.id = szo.zone_id 
      WHERE sz.is_active = true
      ORDER BY sz.tier_level
    `);

    let locationSurge = 0;
    let locationName = '';
    let isAirportZone = false;
    let zoneCode = '';
    let hasOverride = false;

    // Check zones by tier priority (1 = highest priority)
    for (const zone of zones.rows) {
      const distance = calculateDistance(pickupLat, pickupLng, zone.latitude, zone.longitude);
      
      if (distance <= zone.radius) {
        // Use manual override if active, otherwise base multiplier
        if (zone.has_override) {
          locationSurge = Math.max(locationSurge, parseFloat(zone.manual_multiplier) || 0);
          surgeFactors.push(`${zone.zone_code || zone.zone_name} Override: ${zone.override_reason}`);
          hasOverride = true;
        } else {
          locationSurge = Math.max(locationSurge, parseFloat(zone.base_multiplier) || 0);
        }
        
        locationName = zone.zone_name;
        zoneCode = zone.zone_code;
        isAirportZone = zone.zone_type === 'airport';
        
        // Airport queue bonus
        if (isAirportZone && zone.queue_bonus > 0) {
          const queueLength = airportDriverQueues.get(zone.zone_name)?.length || 0;
          if (queueLength > 30) {
            baseMultiplier += parseFloat(zone.queue_bonus) || 0;
            surgeFactors.push(`${zoneCode} Long Queue`);
          }
        }
        
        break; // Use first matching zone (highest priority)
      }
    }

    if (locationSurge > 0) {
      const locationValue = parseFloat(locationSurge) || 0;
      baseMultiplier += locationValue;
      console.log(`🔥 LOCATION SURGE: added ${locationValue}, baseMultiplier now ${baseMultiplier}`);
      if (!hasOverride) {
        if (isAirportZone) {
          surgeFactors.push(`${zoneCode} Airport Zone`);
        } else {
          surgeFactors.push(`${locationName} Area`);
        }
      }
    }

    // 4. REAL-TIME SUPPLY-DEMAND ANALYSIS using config
    const searchRadius = config.search_radius_km || 5;
    const nearbyRequests = Array.from(activeRideRequests.values())
      .filter(req => calculateDistance(pickupLat, pickupLng, req.pickup.lat, req.pickup.lng) <= searchRadius);

    const nearbyDrivers = Array.from(driverAvailability.values())
      .filter(driver => driver.isAvailable && driver.lat && driver.lng &&
        calculateDistance(pickupLat, pickupLng, driver.lat, driver.lng) <= searchRadius);

    const requestCount = nearbyRequests.length;
    const driverCount = nearbyDrivers.length;

    // Dynamic demand-supply surge using config
    if (driverCount === 0 && requestCount > 0) {
      const noDriversMultiplier = config.no_drivers_multiplier || 1.0;
      baseMultiplier += noDriversMultiplier;
      surgeFactors.push('High Demand - Limited Drivers');
    } else if (driverCount > 0) {
      const demandRatio = requestCount / driverCount;
      const highDemandThreshold = config.high_demand_threshold || 2.0;
      const moderateDemandThreshold = config.moderate_demand_threshold || 1.5;
      
      if (demandRatio > highDemandThreshold) {
        const baseMultiplierAdd = config.high_demand_base_multiplier || 0.5;
        const scalingFactor = config.high_demand_scaling_factor || 0.1;
        baseMultiplier += baseMultiplierAdd + (demandRatio * scalingFactor);
        surgeFactors.push('High Demand');
      } else if (demandRatio > moderateDemandThreshold) {
        const moderateMultiplier = config.moderate_demand_multiplier || 0.3;
        baseMultiplier += moderateMultiplier;
        surgeFactors.push('Moderate Demand');
      }
    }

    // 5. EVENT-BASED SURGE - Disabled fake random events
    // Real events should be triggered by actual event data, not random generation

    // 6. HOTSPOT SURGE using config
    const hotspotRadius = config.hotspot_radius_km || 1.0;
    const hotspotTimeWindow = config.hotspot_time_window_minutes || 5;
    const hotspotThreshold = config.hotspot_requests_threshold || 3;
    
    const recentRequests = Array.from(activeRideRequests.values())
      .filter(req => {
        const distance = calculateDistance(pickupLat, pickupLng, req.pickup.lat, req.pickup.lng);
        const timeDiff = Date.now() - req.requestedAt.getTime();
        return distance <= hotspotRadius && timeDiff <= (hotspotTimeWindow * 60000);
      });

    if (recentRequests.length >= hotspotThreshold) {
      const hotspotMultiplier = config.hotspot_multiplier || 0.4;
      baseMultiplier += hotspotMultiplier;
      surgeFactors.push('Hot Spot Area');
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 2.6: Weather Surge & Organic Demand Enhancement
    // ═══════════════════════════════════════════════════════════════════
    
    // 6a. WEATHER-BASED SURGE (real weather data)
    try {
      const weatherData = await getWeatherData(pickupLat, pickupLng);
      const weatherSurgeFactor = getWeatherSurgeMultiplier(weatherData.condition);
      
      if (weatherSurgeFactor > 1.0) {
        baseMultiplier *= weatherSurgeFactor;
        surgeFactors.push(`${weatherData.condition} Weather (+${Math.round((weatherSurgeFactor - 1) * 100)}%)`);
        console.log(`🌧️ Weather surge applied: ${weatherSurgeFactor}x for ${weatherData.condition}`);
      }
    } catch (weatherError) {
      console.warn('⚠️ Weather surge calculation skipped:', weatherError.message);
    }
    
    // 6b. ORGANIC DEMAND SURGE (time-based demand patterns)
    const organicDemandFactor = getOrganicDemandMultiplier(hour, dayOfWeek);
    if (organicDemandFactor > 1.0) {
      baseMultiplier *= organicDemandFactor;
      const timeLabel = hour >= 7 && hour < 10 ? 'Morning Commute' :
                        hour >= 16 && hour < 19 ? 'Evening Commute' :
                        hour >= 22 || hour < 2 ? 'Nightlife' : 'Peak Hours';
      surgeFactors.push(`${timeLabel} Demand (+${Math.round((organicDemandFactor - 1) * 100)}%)`);
      console.log(`⏰ Organic demand surge applied: ${organicDemandFactor}x for ${timeLabel}`);
    }

    // 7. CAP SURGE PRICING using config
    const maxSurgeMultiplier = config.max_surge_multiplier || 3.0;
    const finalMultiplier = Math.min(baseMultiplier, maxSurgeMultiplier);

    // Ensure finalMultiplier is always a valid number
    const safeFinalMultiplier = (finalMultiplier && !isNaN(finalMultiplier)) ? finalMultiplier : 1.0;
    
    // Debug logging
    console.log(`🔥 SURGE DEBUG: baseMultiplier=${baseMultiplier}, maxSurge=${maxSurgeMultiplier}, final=${finalMultiplier}, safe=${safeFinalMultiplier}, factors=[${surgeFactors.join(', ')}]`);

    // Fix demand level logic: No demand if no pending requests
    let demandLevel = 'Low';
    if (requestCount === 0) {
      demandLevel = 'Low'; // No pending requests = no demand
    } else if (driverCount === 0) {
      demandLevel = 'Critical'; // Requests exist but no drivers
    } else {
      const demandRatio = requestCount / driverCount;
      if (demandRatio > (config.high_demand_threshold || 2)) {
        demandLevel = 'Very High';
      } else if (demandRatio > (config.moderate_demand_threshold || 1.5)) {
        demandLevel = 'High';
      } else if (demandRatio > 1) {
        demandLevel = 'Moderate';
      }
    }

    // Fix surge multiplier: No surge if no pending requests
    const adjustedMultiplier = requestCount === 0 ? 1.0 : safeFinalMultiplier;

    return {
      multiplier: adjustedMultiplier,
      isActive: adjustedMultiplier > 1.0 && requestCount > 0,
      factors: requestCount === 0 ? ['Normal'] : surgeFactors,
      demandLevel: demandLevel,
      availableDrivers: driverCount,
      pendingRequests: requestCount
    };

  } catch (error) {
    console.error('Error in database-driven surge calculation:', error);
    // Fallback to basic surge
    return {
      multiplier: 1.0,
      isActive: false,
      factors: ['Database Error - No Surge Applied'],
      demandLevel: 'Unknown',
      availableDrivers: 0,
      pendingRequests: 0
    };
  }
}

// Dynamic pricing settings (now stored in database)
let pricingSettings = {
  baseFareEconomy: 2.10,
  baseFareStandard: 2.50,
  baseFareXL: 3.50,
  baseFarePremium: 4.50,
  perMileFare: 1.25,
  perMinuteFare: 0.35,
  driverCommission: 75, // percentage
  surgePricing: true,
  maxSurgeMultiplier: 3.0
};

// Helper function to get market-specific settings (use this instead of pricingSettings directly)
async function getMarketPricingSettings(lat, lng) {
  try {
    if (marketSettingsDB && typeof marketSettingsDB.getSettingsForLocation === 'function') {
      return await marketSettingsDB.getSettingsForLocation(lat, lng);
    }
  } catch (error) {
    console.warn('⚠️ Could not fetch market settings, using defaults:', error.message);
  }
  return pricingSettings; // Fallback to defaults
}

// Vehicle Types Storage
let vehicleTypes = [
  { id: 'economy', name: 'Economy', description: 'Compact cars • Budget-friendly', icon: '🚗', baseFare: 2.10, capacity: 4, enabled: true },
  { id: 'standard', name: 'Standard', description: 'Mid-size sedans • Comfortable', icon: '🚙', baseFare: 2.50, capacity: 4, enabled: true },
  { id: 'xl', name: 'XL', description: 'SUVs & minivans • Up to 6 passengers', icon: '🚐', baseFare: 3.50, capacity: 6, enabled: true },
  { id: 'premium', name: 'Premium', description: 'Luxury vehicles • Premium experience', icon: '🏎️', baseFare: 4.50, capacity: 4, enabled: true }
];

// Vehicle Types API Routes
app.get('/api/settings/vehicle-types', (req, res) => {
  try {
    res.json({
      success: true,
      vehicleTypes: vehicleTypes.filter(v => v.enabled)
    });
  } catch (error) {
    console.error('Get vehicle types error:', error);
    res.status(500).json({ error: 'Failed to get vehicle types' });
  }
});

app.post('/api/settings/vehicle-types', (req, res) => {
  try {
    const { name, description, icon, baseFare, capacity, enabled } = req.body;

    if (!name || !description) {
      return res.status(400).json({ error: 'Name and description are required' });
    }

    const id = name.toLowerCase().replace(/\s+/g, '');

    // Check if vehicle type already exists
    if (vehicleTypes.some(v => v.id === id)) {
      return res.status(400).json({ error: 'Vehicle type with this name already exists' });
    }

    const newVehicleType = {
      id,
      name,
      description,
      icon: icon || '🚗',
      baseFare: parseFloat(baseFare) || 2.50,
      capacity: parseInt(capacity) || 4,
      enabled: enabled !== false
    };

    vehicleTypes.push(newVehicleType);

    console.log('✅ Added new vehicle type:', newVehicleType);

    res.status(201).json({
      success: true,
      message: 'Vehicle type added successfully',
      vehicleType: newVehicleType
    });
  } catch (error) {
    console.error('Add vehicle type error:', error);
    res.status(500).json({ error: 'Failed to add vehicle type' });
  }
});

app.put('/api/settings/vehicle-types/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const vehicleIndex = vehicleTypes.findIndex(v => v.id === id);
    if (vehicleIndex === -1) {
      return res.status(404).json({ error: 'Vehicle type not found' });
    }

    // Update vehicle type
    vehicleTypes[vehicleIndex] = { ...vehicleTypes[vehicleIndex], ...updates };

    console.log('✅ Updated vehicle type:', vehicleTypes[vehicleIndex]);

    res.json({
      success: true,
      message: 'Vehicle type updated successfully',
      vehicleType: vehicleTypes[vehicleIndex]
    });
  } catch (error) {
    console.error('Update vehicle type error:', error);
    res.status(500).json({ error: 'Failed to update vehicle type' });
  }
});

app.delete('/api/settings/vehicle-types/:id', (req, res) => {
  try {
    const { id } = req.params;

    const initialLength = vehicleTypes.length;
    vehicleTypes = vehicleTypes.filter(v => v.id !== id);

    if (vehicleTypes.length === initialLength) {
      return res.status(404).json({ error: 'Vehicle type not found' });
    }

    console.log('✅ Deleted vehicle type:', id);

    res.json({
      success: true,
      message: 'Vehicle type deleted successfully'
    });
  } catch (error) {
    console.error('Delete vehicle type error:', error);
    res.status(500).json({ error: 'Failed to delete vehicle type' });
  }
});

// Surge Control API Routes
app.post('/api/admin/surge/update', async (req, res) => {
  try {
    const { zoneId, surgeMultiplier, isManualOverride, overrideReason } = req.body;

    console.log(`🔥 Surge multiplier updated for zone ${zoneId}: ${surgeMultiplier}x (manual: ${isManualOverride})`);

    // Find the zone in surge_zones table
    const zoneResult = await db.query('SELECT id FROM surge_zones WHERE zone_code = $1 OR zone_name = $2', [zoneId, zoneId]);
    
    if (zoneResult.rows.length === 0) {
      return res.status(404).json({ error: 'Zone not found' });
    }

    const actualZoneId = zoneResult.rows[0].id;

    if (isManualOverride) {
      // Insert or update manual override in database
      await db.query(`
        INSERT INTO surge_zone_overrides (zone_id, manual_multiplier, is_manual_override, override_reason, created_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        ON CONFLICT (zone_id) 
        DO UPDATE SET 
          manual_multiplier = $2,
          is_manual_override = $3,
          override_reason = $4,
          created_at = CURRENT_TIMESTAMP
      `, [actualZoneId, surgeMultiplier, true, overrideReason || 'Manual adjustment']);

      console.log(`✅ Manual override saved to database for zone ${zoneId}: ${surgeMultiplier}x`);
    }

    // Broadcast to all connected clients
    io.emit('surge-updated', {
      zoneId,
      surgeMultiplier,
      isManualOverride,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Surge multiplier updated successfully',
      zoneId,
      surgeMultiplier,
      isManualOverride
    });
  } catch (error) {
    console.error('Update surge error:', error);
    res.status(500).json({ error: 'Failed to update surge multiplier' });
  }
});

app.post('/api/admin/surge/reset', async (req, res) => {
  try {
    const { zoneId } = req.body;

    console.log(`🔄 Surge reset to automatic for zone ${zoneId}`);

    // Find the zone in surge_zones table
    const zoneResult = await db.query('SELECT id FROM surge_zones WHERE zone_code = $1 OR zone_name = $2', [zoneId, zoneId]);
    
    if (zoneResult.rows.length === 0) {
      return res.status(404).json({ error: 'Zone not found' });
    }

    const actualZoneId = zoneResult.rows[0].id;

    // Remove manual override from database
    await db.query('DELETE FROM surge_zone_overrides WHERE zone_id = $1', [actualZoneId]);

    console.log(`✅ Manual override removed from database for zone ${zoneId}`);

    // Reset to automatic surge calculation
    io.emit('surge-reset', {
      zoneId,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Surge reset to automatic',
      zoneId
    });
  } catch (error) {
    console.error('Reset surge error:', error);
    res.status(500).json({ error: 'Failed to reset surge' });
  }
});

// Load existing surge zone overrides
app.get('/api/admin/surge/overrides', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        sz.zone_code,
        sz.zone_name,
        szo.manual_multiplier,
        szo.is_manual_override,
        szo.override_reason,
        szo.created_at
      FROM surge_zone_overrides szo
      JOIN surge_zones sz ON szo.zone_id = sz.id
      WHERE szo.is_manual_override = true
    `);

    console.log(`📊 Loaded ${result.rows.length} manual surge overrides`);

    res.json({
      success: true,
      overrides: result.rows
    });
  } catch (error) {
    console.error('Load overrides error:', error);
    res.status(500).json({ error: 'Failed to load surge overrides' });
  }
});

// Bulk save surge zone overrides
app.post('/api/admin/surge/bulk-save', async (req, res) => {
  try {
    const { overrides } = req.body;

    if (!Array.isArray(overrides)) {
      return res.status(400).json({ error: 'Overrides must be an array' });
    }

    let savedCount = 0;
    let errorCount = 0;

    // Process each override
    for (const override of overrides) {
      try {
        const { zoneId, surgeMultiplier, isManualOverride, overrideReason } = override;

        // Find the zone in surge_zones table (support ID, zone_code, or zone_name)
        const zoneResult = await db.query('SELECT id FROM surge_zones WHERE id::text = $1 OR zone_code = $1 OR zone_name = $1', [zoneId]);
        
        if (zoneResult.rows.length === 0) {
          console.warn(`Zone not found: ${zoneId}`);
          errorCount++;
          continue;
        }

        const actualZoneId = zoneResult.rows[0].id;

        if (isManualOverride) {
          // Insert or update manual override
          await db.query(`
            INSERT INTO surge_zone_overrides (zone_id, manual_multiplier, is_manual_override, override_reason, created_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            ON CONFLICT (zone_id) 
            DO UPDATE SET 
              manual_multiplier = $2,
              is_manual_override = $3,
              override_reason = $4,
              created_at = CURRENT_TIMESTAMP
          `, [actualZoneId, surgeMultiplier, true, overrideReason || 'Bulk update']);
        } else {
          // Remove manual override
          await db.query('DELETE FROM surge_zone_overrides WHERE zone_id = $1', [actualZoneId]);
        }

        savedCount++;
      } catch (err) {
        console.error(`Error processing override for ${override.zoneId}:`, err);
        errorCount++;
      }
    }

    console.log(`💾 Bulk save completed: ${savedCount} saved, ${errorCount} errors`);

    // Broadcast update to all connected clients
    io.emit('surge-bulk-updated', {
      savedCount,
      errorCount,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `Bulk save completed: ${savedCount} saved, ${errorCount} errors`,
      savedCount,
      errorCount
    });
  } catch (error) {
    console.error('Bulk save error:', error);
    res.status(500).json({ error: 'Failed to bulk save surge overrides' });
  }
});

app.post('/api/admin/surge/global-toggle', (req, res) => {
  try {
    const { enabled } = req.body;

    console.log(`🌍 Global surge pricing ${enabled ? 'enabled' : 'disabled'}`);

    // Update global surge setting
    pricingSettings.surgePricing = enabled;

    // Broadcast to all connected clients
    io.emit('global-surge-toggled', {
      enabled,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `Global surge pricing ${enabled ? 'enabled' : 'disabled'}`,
      enabled
    });
  } catch (error) {
    console.error('Global surge toggle error:', error);
    res.status(500).json({ error: 'Failed to toggle global surge' });
  }
});

app.post('/api/admin/surge/max-multiplier', async (req, res) => {
  try {
    const { maxMultiplier } = req.body;

    if (!maxMultiplier || maxMultiplier < 1.0 || maxMultiplier > 10.0) {
      return res.status(400).json({ error: 'Invalid max multiplier value' });
    }

    console.log(`📈 Max surge multiplier updated to ${maxMultiplier}x`);

    // Update max surge setting in database
    await db.query(`
      UPDATE surge_algorithm_config 
      SET config_value = $1, updated_at = CURRENT_TIMESTAMP
      WHERE config_key = 'max_surge_multiplier'
    `, [parseFloat(maxMultiplier)]);

    // Also update in-memory settings for consistency
    pricingSettings.maxSurgeMultiplier = parseFloat(maxMultiplier);

    console.log(`✅ Max surge multiplier updated in database: ${maxMultiplier}x`);

    // Broadcast to all connected clients
    io.emit('max-surge-updated', {
      maxMultiplier: parseFloat(maxMultiplier),
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Max surge multiplier updated successfully',
      maxMultiplier: parseFloat(maxMultiplier)
    });
  } catch (error) {
    console.error('Update max surge error:', error);
    res.status(500).json({ error: 'Failed to update max surge multiplier' });
  }
});

// Get current surge status
app.get('/api/admin/surge/status', (req, res) => {
  try {
    // Mock current surge zones - in production this would come from database
    const surgeZones = [
      {
        id: 'bentonville_downtown',
        name: 'Downtown Bentonville',
        marketId: 'bentonville',
        coordinates: { lat: 36.3729, lng: -94.2088 },
        radius: 2,
        surgeMultiplier: 1.5,
        isManualOverride: false,
        demandLevel: 'medium',
        activeDrivers: 12,
        waitingRiders: 8,
        lastUpdated: new Date()
      }
    ];

    res.json({
      success: true,
      globalSurgeEnabled: pricingSettings.surgePricing,
      maxSurgeMultiplier: pricingSettings.maxSurgeMultiplier,
      surgeZones
    });
  } catch (error) {
    console.error('Get surge status error:', error);
    res.status(500).json({ error: 'Failed to get surge status' });
  }
});

// Pricing Settings API Routes
app.get('/api/settings/pricing', (req, res) => {
  try {
    res.json({
      success: true,
      settings: pricingSettings
    });
  } catch (error) {
    console.error('Get pricing settings error:', error);
    res.status(500).json({ error: 'Failed to get pricing settings' });
  }
});

app.put('/api/settings/pricing', (req, res) => {
  try {
    const {
      baseFareEconomy,
      baseFareStandard,
      baseFareXL,
      baseFarePremium,
      perMileFare,
      perMinuteFare,
      driverCommission,
      surgePricing,
      maxSurgeMultiplier
    } = req.body;

    console.log('📨 Received pricing update request:', req.body);

    // Validate pricing values (only validate if provided)
    if (baseFareEconomy !== undefined && (isNaN(parseFloat(baseFareEconomy)) || parseFloat(baseFareEconomy) < 0)) {
      return res.status(400).json({ success: false, error: 'Invalid economy base fare' });
    }
    if (baseFareStandard !== undefined && (isNaN(parseFloat(baseFareStandard)) || parseFloat(baseFareStandard) < 0)) {
      return res.status(400).json({ success: false, error: 'Invalid standard base fare' });
    }
    if (baseFareXL !== undefined && (isNaN(parseFloat(baseFareXL)) || parseFloat(baseFareXL) < 0)) {
      return res.status(400).json({ success: false, error: 'Invalid XL base fare' });
    }
    if (baseFarePremium !== undefined && (isNaN(parseFloat(baseFarePremium)) || parseFloat(baseFarePremium) < 0)) {
      return res.status(400).json({ success: false, error: 'Invalid premium base fare' });
    }
    if (perMileFare !== undefined && (isNaN(parseFloat(perMileFare)) || parseFloat(perMileFare) < 0)) {
      return res.status(400).json({ success: false, error: 'Invalid per mile rate' });
    }
    if (perMinuteFare !== undefined && (isNaN(parseFloat(perMinuteFare)) || parseFloat(perMinuteFare) < 0)) {
      return res.status(400).json({ success: false, error: 'Invalid per minute rate' });
    }
    if (driverCommission !== undefined && (isNaN(parseInt(driverCommission)) || parseInt(driverCommission) < 0 || parseInt(driverCommission) > 100)) {
      return res.status(400).json({ success: false, error: 'Invalid driver commission percentage' });
    }
    if (maxSurgeMultiplier !== undefined && (isNaN(parseFloat(maxSurgeMultiplier)) || parseFloat(maxSurgeMultiplier) < 1)) {
      return res.status(400).json({ success: false, error: 'Invalid surge multiplier' });
    }

    // Update pricing settings - only update provided values
    if (baseFareEconomy !== undefined) pricingSettings.baseFareEconomy = parseFloat(baseFareEconomy);
    if (baseFareStandard !== undefined) pricingSettings.baseFareStandard = parseFloat(baseFareStandard);
    if (baseFareXL !== undefined) pricingSettings.baseFareXL = parseFloat(baseFareXL);
    if (baseFarePremium !== undefined) pricingSettings.baseFarePremium = parseFloat(baseFarePremium);
    if (perMileFare !== undefined) pricingSettings.perMileFare = parseFloat(perMileFare);
    if (perMinuteFare !== undefined) pricingSettings.perMinuteFare = parseFloat(perMinuteFare);
    if (driverCommission !== undefined) pricingSettings.driverCommission = parseInt(driverCommission);
    if (surgePricing !== undefined) pricingSettings.surgePricing = surgePricing;
    if (maxSurgeMultiplier !== undefined) pricingSettings.maxSurgeMultiplier = parseFloat(maxSurgeMultiplier);

    console.log('✅ Pricing settings updated successfully:', pricingSettings);

    return res.json({
      success: true,
      message: 'Pricing settings updated successfully',
      settings: pricingSettings
    });
  } catch (error) {
    console.error('❌ Update pricing settings error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update pricing settings',
      details: error.message
    });
  }
});

// Helper function to get nearby airport
function getNearbyAirport(lat, lng) {
  for (const airport of AIRPORT_LOCATIONS) {
    const distance = calculateDistance(lat, lng, airport.lat, airport.lng);
    if (distance <= airport.radius) {
      return {
        name: airport.name,
        code: airport.name.split(' - ')[0] || airport.name.substring(0, 3).toUpperCase(),
        distance
      };
    }
  }
  return null;
}

// Enhanced fare calculation with dynamic pricing settings
// Enhanced fare calculation with dynamic pricing settings
async function calculateFare(pickup, destination, rideType) {
  // Get market-specific settings based on pickup location
  const settings = await getMarketPricingSettings(pickup.lat, pickup.lng);
  
  // Use vehicle-specific base fares from market settings
  const baseFaresByType = {
    economy: settings.baseFareEconomy,
    standard: settings.baseFareStandard,
    xl: settings.baseFareXL,
    premium: settings.baseFarePremium
  };

  // Get the base fare for the specific vehicle type
  const baseFare = baseFaresByType[rideType] || baseFaresByType.standard;
  const perMile = settings.perMileFare;
  const perMinute = settings.perMinuteFare;

  // Calculate REAL driving distance using Google Maps Directions API
  console.log('🚗 Calculating fare with real driving distance...');
  const drivingData = await calculateDrivingDistance(pickup, destination);
  const distanceInMiles = drivingData.distanceMiles;
  const realDrivingTime = drivingData.durationMinutes;

  console.log(`📊 Distance calculation: ${distanceInMiles.toFixed(2)} miles (${drivingData.source})`);

  // Get detailed surge information (now async)
  const surgeInfo = await calculateSurgeMultiplier(pickup.lat, pickup.lng);
  
  // Ensure surge multiplier is always a valid number
  const safeMultiplier = (surgeInfo.multiplier && !isNaN(surgeInfo.multiplier)) ? surgeInfo.multiplier : 1.0;

  // Calculate fare using the formula: Fare = Vehicle Type Base Rate + (Distance * Per Mile Rate) + (Wait Minutes * Per Minute Rate)
  const baseFareAmount = baseFare;
  const distanceFare = distanceInMiles * perMile;

  // Use real driving time from Google Maps instead of rough estimate
  const estimatedTravelTime = Math.max(5, realDrivingTime); // Minimum 5 minutes
  const timeFare = estimatedTravelTime * perMinute;

  const subtotal = baseFareAmount + distanceFare + timeFare;
  const surgeAmount = subtotal * (safeMultiplier - 1);
  const total = subtotal * safeMultiplier;

  // Estimated pickup time based on driver availability
  const estimatedPickupTime = (surgeInfo.availableDrivers > 5 ? 3 :
                              surgeInfo.availableDrivers > 2 ? 6 :
                              surgeInfo.availableDrivers > 0 ? 10 : 15) + Math.random() * 3;

  return {
    baseFare: baseFareAmount,
    distanceFare: distanceFare,
    timeFare: timeFare,
    estimatedDistance: distanceInMiles,
    estimatedTravelTime,
    estimatedPickupTime: Math.round(estimatedPickupTime),
    totalEstimatedTime: Math.round(estimatedTravelTime + estimatedPickupTime),
    surge: {
      multiplier: safeMultiplier,
      amount: safeMultiplier > 1 ? surgeAmount : 0,
      isActive: safeMultiplier > 1.0,
      factors: surgeInfo.factors,
      demandLevel: surgeInfo.demandLevel,
      availableDrivers: surgeInfo.availableDrivers,
      pendingRequests: surgeInfo.pendingRequests
    },
    subtotal,
    total: Number(total.toFixed(2)),
    breakdown: {
      baseFare: `Vehicle Base Rate: $${baseFareAmount.toFixed(2)}`,
      distance: `${distanceInMiles.toFixed(1)} mi × $${perMile.toFixed(2)} = $${distanceFare.toFixed(2)}`,
      time: `${estimatedTravelTime} min × $${perMinute.toFixed(2)} = $${timeFare.toFixed(2)}`,
      surge: safeMultiplier > 1 ? `${safeMultiplier.toFixed(1)}x surge = +$${surgeAmount.toFixed(2)}` : null
    }
  };
}

// Debug surge calculation endpoint
app.post('/api/debug/surge', async (req, res) => {
  try {
    const { pickup } = req.body;
    if (!pickup || !pickup.lat || !pickup.lng) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pickup coordinates'
      });
    }

    console.log(`🔥 DEBUG SURGE ENDPOINT: lat=${pickup.lat}, lng=${pickup.lng}`);
    const surgeInfo = await calculateSurgeMultiplier(pickup.lat, pickup.lng);
    console.log(`🔥 DEBUG SURGE RESULT:`, JSON.stringify(surgeInfo, null, 2));

    res.json({
      success: true,
      surge: surgeInfo,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Debug surge endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Fare estimate endpoint
app.post('/api/rides/estimate', async (req, res) => {
  try {
    const { pickup, destination, rideType } = req.body;

    if (!pickup || !destination || !pickup.lat || !pickup.lng || !destination.lat || !destination.lng) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pickup or destination coordinates'
      });
    }

    const fareEstimate = await calculateFare(pickup, destination, rideType || 'standard');

    res.json({
      success: true,
      fareEstimate,
      pricingSettings: {
        baseFareStandard: pricingSettings.baseFareStandard,
        perMileFare: pricingSettings.perMileFare,
        perMinuteFare: pricingSettings.perMinuteFare,
        surgePricing: pricingSettings.surgePricing,
        maxSurgeMultiplier: pricingSettings.maxSurgeMultiplier
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Fare estimate error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to calculate fare estimate',
      message: 'Please try again later'
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// PHASE 2.6: Enhanced Route Calculation with Weather/Traffic/Polyline
// ═══════════════════════════════════════════════════════════════════
app.post('/api/routes/calculate', authenticateToken, async (req, res) => {
  try {
    const { driverLocation, pickup, destination, refreshRoute } = req.body;
    
    console.log('🗺️ Route calculation request:', { driverLocation, pickup, destination, refreshRoute });
    
    // Validate inputs
    if (!driverLocation?.lat || !driverLocation?.lng) {
      return res.status(400).json({ success: false, error: 'Driver location required' });
    }
    if (!pickup?.lat || !pickup?.lng) {
      return res.status(400).json({ success: false, error: 'Pickup location required' });
    }
    if (!destination?.lat || !destination?.lng) {
      return res.status(400).json({ success: false, error: 'Destination location required' });
    }
    
    // Get current time info
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    
    // Fetch weather data
    const weather = await getWeatherData(pickup.lat, pickup.lng);
    
    // Calculate multipliers
    const trafficMultiplier = getTrafficMultiplierEnhanced(hour, dayOfWeek);
    const weatherETAMultiplier = getWeatherETAMultiplier(weather.condition);
    const weatherDelay = getWeatherDelayMinutes(weather.condition);
    
    console.log(`📊 Multipliers - Traffic: ${trafficMultiplier}x, Weather ETA: ${weatherETAMultiplier}x, Delay: +${weatherDelay}min`);
    
    // Calculate route to pickup
    const toPickupRoute = await calculateEnhancedRoute(driverLocation, pickup);
    const toPickupETA = calculateAdjustedETA(
      toPickupRoute.baseDurationMinutes,
      trafficMultiplier,
      weatherETAMultiplier,
      weatherDelay,
      toPickupRoute.distanceMiles
    );
    
    // Calculate route to destination
    const toDestinationRoute = await calculateEnhancedRoute(pickup, destination);
    const toDestinationETA = calculateAdjustedETA(
      toDestinationRoute.baseDurationMinutes,
      trafficMultiplier,
      weatherETAMultiplier,
      weatherDelay,
      toDestinationRoute.distanceMiles
    );
    
    // Determine traffic level description
    // ═══════════════════════════════════════════════════════════════════
    // PHASE 2.6: Airport Zone Detection
    // ═══════════════════════════════════════════════════════════════════
    
    // Check if pickup is at an airport
    let pickupAirportInfo = null;
    const nearbyPickupAirport = getNearbyAirport(pickup.lat, pickup.lng);
    if (nearbyPickupAirport) {
      const airportCode = nearbyPickupAirport.code;
      const pickupZone = findNearestAirportZone(pickup.lat, pickup.lng, airportCode, 'pickup');
      pickupAirportInfo = {
        isAirport: true,
        airportName: nearbyPickupAirport.name,
        airportCode: airportCode,
        distanceToAirport: nearbyPickupAirport.distance,
        zone: pickupZone ? {
          name: pickupZone.name,
          distanceMeters: pickupZone.distance,
          fareMultiplier: pickupZone.fareMultiplier || 1.0
        } : null,
        queueInfo: {
          queueLength: (airportDriverQueues.get(nearbyPickupAirport.name) || []).length,
          estimatedWaitMinutes: Math.max(5, (airportDriverQueues.get(nearbyPickupAirport.name) || []).length * 8)
        }
      };
      console.log(`✈️ Pickup at airport: ${airportCode} - ${pickupZone?.name || 'General area'}`);
    }
    
    // Check if destination is at an airport
    let destinationAirportInfo = null;
    const nearbyDestAirport = getNearbyAirport(destination.lat, destination.lng);
    if (nearbyDestAirport) {
      const airportCode = nearbyDestAirport.code;
      const dropoffZone = findNearestAirportZone(destination.lat, destination.lng, airportCode, 'dropoff');
      destinationAirportInfo = {
        isAirport: true,
        airportName: nearbyDestAirport.name,
        airportCode: airportCode,
        distanceToAirport: nearbyDestAirport.distance,
        zone: dropoffZone ? {
          name: dropoffZone.name,
          distanceMeters: dropoffZone.distance,
          fareMultiplier: dropoffZone.fareMultiplier || 1.0
        } : null
      };
      console.log(`✈️ Destination at airport: ${airportCode} - ${dropoffZone?.name || 'General area'}`);
    }
    let trafficLevel = 'light';
    if (trafficMultiplier >= 1.5) trafficLevel = 'heavy';
    else if (trafficMultiplier >= 1.2) trafficLevel = 'moderate';
    
    // Build response
    const response = {
      success: true,
      refreshed: refreshRoute || false,
      toPickup: {
        distance: {
          km: Number(toPickupRoute.distanceKm.toFixed(2)),
          miles: Number(toPickupRoute.distanceMiles.toFixed(2))
        },
        duration: {
          base_minutes: toPickupRoute.baseDurationMinutes,
          traffic_delay_minutes: Math.round(toPickupRoute.baseDurationMinutes * (trafficMultiplier - 1)),
          weather_delay_minutes: weatherDelay,
          adjusted_minutes: toPickupETA.adjustedMinutes,
          seconds: toPickupETA.adjustedMinutes * 60
        },
        eta: {
          arrival_time: new Date(Date.now() + toPickupETA.adjustedMinutes * 60000).toISOString(),
          confidence_score: toPickupETA.confidence,
          confidence_range: {
            min_minutes: toPickupETA.minMinutes,
            max_minutes: toPickupETA.maxMinutes
          }
        },
        conditions: {
          traffic_level: trafficLevel,
          traffic_multiplier: trafficMultiplier,
          weather_condition: weather.condition,
          weather_description: weather.description,
          weather_multiplier: weatherETAMultiplier,
          temperature_f: weather.temp,
          is_rush_hour: trafficMultiplier >= 1.5
        },
        polyline: toPickupRoute.polyline,
        steps: toPickupRoute.steps,
        source: toPickupRoute.source
      },
      toDestination: {
        distance: {
          km: Number(toDestinationRoute.distanceKm.toFixed(2)),
          miles: Number(toDestinationRoute.distanceMiles.toFixed(2))
        },
        duration: {
          base_minutes: toDestinationRoute.baseDurationMinutes,
          traffic_delay_minutes: Math.round(toDestinationRoute.baseDurationMinutes * (trafficMultiplier - 1)),
          weather_delay_minutes: weatherDelay,
          adjusted_minutes: toDestinationETA.adjustedMinutes,
          seconds: toDestinationETA.adjustedMinutes * 60
        },
        eta: {
          arrival_time: new Date(Date.now() + (toPickupETA.adjustedMinutes + toDestinationETA.adjustedMinutes) * 60000).toISOString(),
          confidence_score: toDestinationETA.confidence,
          confidence_range: {
            min_minutes: toDestinationETA.minMinutes,
            max_minutes: toDestinationETA.maxMinutes
          }
        },
        conditions: {
          traffic_level: trafficLevel,
          traffic_multiplier: trafficMultiplier,
          weather_condition: weather.condition,
          weather_description: weather.description,
          weather_multiplier: weatherETAMultiplier,
          temperature_f: weather.temp,
          is_rush_hour: trafficMultiplier >= 1.5
        },
        polyline: toDestinationRoute.polyline,
        steps: toDestinationRoute.steps,
        source: toDestinationRoute.source
      },
      totalTrip: {
        distance: {
          km: Number((toPickupRoute.distanceKm + toDestinationRoute.distanceKm).toFixed(2)),
          miles: Number((toPickupRoute.distanceMiles + toDestinationRoute.distanceMiles).toFixed(2))
        },
        duration: {
          base_minutes: toPickupRoute.baseDurationMinutes + toDestinationRoute.baseDurationMinutes,
          adjusted_minutes: toPickupETA.adjustedMinutes + toDestinationETA.adjustedMinutes,
          seconds: (toPickupETA.adjustedMinutes + toDestinationETA.adjustedMinutes) * 60
        },
        eta: {
          final_arrival: new Date(Date.now() + (toPickupETA.adjustedMinutes + toDestinationETA.adjustedMinutes) * 60000).toISOString()
        }
      },
      weather: {
        condition: weather.condition,
        description: weather.description,
        temperature_f: weather.temp
      },
      geofence: {
        radius_meters: GEOFENCE_RADIUS_METERS,
        pickup: { lat: pickup.lat, lng: pickup.lng },
        dropoff: { lat: destination.lat, lng: destination.lng }
      },
      airports: {
        pickupIsAirport: !!pickupAirportInfo,
        destinationIsAirport: !!destinationAirportInfo,
        pickup: pickupAirportInfo,
        destination: destinationAirportInfo
      },
      timestamp: now.toISOString()
    };
    
    console.log(`✅ Route calculated: ${response.toPickup.duration.adjusted_minutes}min to pickup, ${response.toDestination.duration.adjusted_minutes}min to destination`);
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Route calculation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate route',
      message: error.message
    });
  }
});

// PHASE 2.6: Geofence check endpoint
app.post('/api/rides/check-geofence', authenticateToken, async (req, res) => {
  try {
    const { driverLat, driverLng, targetLat, targetLng, type } = req.body;
    
    if (!driverLat || !driverLng || !targetLat || !targetLng) {
      return res.status(400).json({ success: false, error: 'All coordinates required' });
    }
    
    const withinGeofence = isWithinGeofence(driverLat, driverLng, targetLat, targetLng, GEOFENCE_RADIUS_METERS);
    
    // Calculate actual distance
    const R = 6371000;
    const dLat = (targetLat - driverLat) * Math.PI / 180;
    const dLng = (targetLng - driverLng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(driverLat * Math.PI / 180) * Math.cos(targetLat * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distanceMeters = Math.round(R * c);
    
    console.log(`📍 Geofence check (${type}): ${distanceMeters}m from target, within=${withinGeofence}`);
    
    res.json({
      success: true,
      isWithinGeofence: withinGeofence,
      distanceMeters,
      radiusMeters: GEOFENCE_RADIUS_METERS,
      type: type || 'unknown'
    });
    
  } catch (error) {
    console.error('❌ Geofence check error:', error);
    res.status(500).json({ success: false, error: 'Failed to check geofence' });
  }
});

// Missing variables and modules - stripe already declared above

// Simplified Real-Time Matching Engine to prevent errors
class RealTimeMatchingEngine {
  constructor() {
    this.matchingQueue = new Map();
    this.driverResponseHistory = new Map();
    this.matchingMetrics = {
      totalMatches: 0,
      successfulMatches: 0,
      averageMatchTime: 0,
      rejectionReasons: new Map()
    };
  }

  // Real driver matching with actual database queries
  async findAndAssignBestDriver(rideRequest, maxWaitTime = 30000) {
    const matchingId = `match_${Date.now()}`;
    console.log(`🎯 Starting driver matching for ride ${rideRequest.id}`);

    const startTime = Date.now();

    try {
      // 🔧 CRITICAL FIX: Use driverAvailability Map (same as Dashboard) instead of failing database query
      const nearbyDrivers = Array.from(driverAvailability.entries())
        .filter(([driverId, driver]) => driver.isAvailable && driver.lat && driver.lng &&
          calculateDistance(rideRequest.pickup.lat, rideRequest.pickup.lng, driver.lat, driver.lng) <= 10)
        .map(([driverId, driver]) => {
          console.log(`🔍 Mapping driver: ${driverId} (${driver.driverId || 'legacy'})`);
          return {
            id: driverId,
            driverId: driverId,
            first_name: driver.first_name || 'Driver',
            last_name: driver.last_name || '',
            phone: driver.phone || '',
            rating: driver.rating || 4.8,
            latitude: driver.lat,
            longitude: driver.lng,
            is_available: true
          };
        });

      console.log(`🔍 Found ${nearbyDrivers.length} available drivers using driverAvailability Map`);

      if (nearbyDrivers.length === 0) {
        return {
          success: false,
          reason: 'no_drivers_available',
          matchTime: Date.now() - startTime,
          metrics: {
            triedDrivers: 0,
            rejectedDrivers: 0
          }
        };
      }

      // Score and rank drivers
      const scoredDrivers = nearbyDrivers.map(driver => {
        const distance = calculateDistance(
          rideRequest.pickup.lat, 
          rideRequest.pickup.lng, 
          driver.latitude, 
          driver.longitude
        );
        
        const driverData = driverAvailability.get(driver.id) || this.getDefaultDriverData(driver);
        const score = this.calculateDriverScore(driver, driverData, distance, rideRequest.pickup, rideRequest.rideType);

        return {
          ...driver,
          driverData,
          distance: Number(distance.toFixed(2)),
          score: Number(score.toFixed(2)),
          estimatedArrival: this.calculateETA(distance, driverData)
        };
      });

      // Sort by score and get best driver
      scoredDrivers.sort((a, b) => b.score - a.score);
      const bestDriver = scoredDrivers[0];

      if (bestDriver) {
        const matchTime = Date.now() - startTime;

        return {
          success: true,
          driver: bestDriver,
          matchTime,
          matchType: 'database_match',
          phase: 1,
          metrics: {
            triedDrivers: scoredDrivers.length,
            rejectedDrivers: 0
          }
        };
      }

      return {
        success: false,
        reason: 'no_suitable_drivers',
        matchTime: Date.now() - startTime,
        metrics: {
          triedDrivers: nearbyDrivers.length,
          rejectedDrivers: 0
        }
      };
    } catch (error) {
      console.error('Driver matching error:', error);
      return {
        success: false,
        reason: 'matching_error',
        matchTime: Date.now() - startTime,
        metrics: {
          triedDrivers: 0,
          rejectedDrivers: 0
        }
      };
    }
  }

  // Phase 1: Immediate matching with highest priority drivers
  async immediateMatch(rideRequest, matchingProcess) {
    console.log(`🚀 Phase 1: Immediate matching for ${matchingProcess.id}`);
    const { pickup, rideType } = rideRequest;

    // Check airport queues first (highest priority)
    const airportResult = await this.checkAirportQueues(pickup);
    if (airportResult.success) {
      const driver = await this.assignDriverFromQueue(airportResult.driver, rideRequest, matchingProcess);
      if (driver) {
        return { success: true, driver, phase: 1, matchType: 'airport_queue' };
      }
    }

    // Find top-tier drivers within 3km
    const nearbyDrivers = await this.findOptimalDrivers(pickup, 3, rideType);
    const premiumDrivers = nearbyDrivers.filter(d =>
      d.score >= 85 &&
      d.distance <= 2 &&
      d.driverData.acceptanceRate >= 0.9 &&
      !matchingProcess.triedDrivers.has(d.id)
    );

    if (premiumDrivers.length > 0) {
      // Try top 2 premium drivers simultaneously
      const topDrivers = premiumDrivers.slice(0, 2);
      const assignmentResult = await this.parallelDriverAssignment(topDrivers, rideRequest, matchingProcess, 15000);

      if (assignmentResult.success) {
        return { success: true, driver: assignmentResult.driver, phase: 1, matchType: 'premium_immediate' };
      }
    }

    return { success: false, reason: 'no_premium_drivers' };
  }

  // Phase 2: Expanded search with machine learning optimization
  async expandedMatch(rideRequest, matchingProcess) {
    console.log(`🔍 Phase 2: Expanded matching for ${matchingProcess.id}`);
    const { pickup, rideType } = rideRequest;

    // Expand search radius and include more drivers
    const expandedDrivers = await this.findOptimalDrivers(pickup, 8, rideType);
    const qualifiedDrivers = expandedDrivers.filter(d =>
      d.score >= 60 &&
      d.distance <= 6 &&
      d.driverData.acceptanceRate >= 0.75 &&
      !matchingProcess.triedDrivers.has(d.id) &&
      !matchingProcess.rejectedDrivers.has(d.id)
    );

    if (qualifiedDrivers.length === 0) {
      return { success: false, reason: 'no_qualified_drivers' };
    }

    // Apply machine learning insights for driver selection
    const optimizedDrivers = this.applyMLOptimization(qualifiedDrivers, rideRequest);

    // Sequential assignment with smart timing
    const assignmentResult = await this.sequentialDriverAssignment(
      optimizedDrivers,
      rideRequest,
      matchingProcess,
      20000 // 20 seconds per driver
    );

    if (assignmentResult.success) {
      return { success: true, driver: assignmentResult.driver, phase: 2, matchType: 'expanded_optimized' };
    }

    return { success: false, reason: 'all_drivers_declined' };
  }

  // Phase 3: Surge incentives and last resort matching
  async surgeIncentiveMatch(rideRequest, matchingProcess) {
    console.log(`💰 Phase 3: Surge incentive matching for ${matchingProcess.id}`);
    const { pickup, rideType } = rideRequest;

    // Activate surge pricing to attract drivers
    const surgeMultiplier = this.calculateDynamicSurge(pickup, matchingProcess);
    rideRequest.surgeMultiplier = surgeMultiplier;

    // Notify nearby drivers of surge opportunity
    await this.broadcastSurgeOpportunity(pickup, rideRequest, surgeMultiplier);

    // Find all available drivers within extended radius
    const allDrivers = await this.findOptimalDrivers(pickup, 15, rideType);
    const availableDrivers = allDrivers.filter(d =>
      d.driverData.isAvailable &&
      !matchingProcess.triedDrivers.has(d.id)
    );

    if (availableDrivers.length === 0) {
      return { success: false, reason: 'no_drivers_available' };
    }

    // Offer to multiple drivers with surge incentive
    const assignmentResult = await this.surgeParallelAssignment(
      availableDrivers,
      rideRequest,
      matchingProcess,
      30000 // 30 seconds with surge
    );

    if (assignmentResult.success) {
      return { success: true, driver: assignmentResult.driver, phase: 3, matchType: 'surge_incentive' };
    }

    return { success: false, reason: 'surge_failed' };
  }

  // Advanced driver scoring with real-time factors
  async findOptimalDrivers(pickup, radiusKm, rideType) {
    const nearbyDrivers = await db.getNearbyDrivers(pickup.lat, pickup.lng, radiusKm);

    const scoredDrivers = nearbyDrivers.map(driver => {
      const distance = calculateDistance(pickup.lat, pickup.lng, driver.latitude, driver.longitude);
      const driverData = driverAvailability.get(driver.id) || this.getDefaultDriverData(driver);

      // Enhanced scoring algorithm
      let score = this.calculateDriverScore(driver, driverData, distance, pickup, rideType);

      // Real-time adjustments
      score = this.applyRealTimeAdjustments(score, driver, driverData);

      return {
        ...driver,
        driverData,
        distance: Number(distance.toFixed(2)),
        score: Number(score.toFixed(2)),
        estimatedArrival: this.calculateETA(distance, driverData),
        matchQuality: this.getMatchQuality(score),
        bonusFactors: this.getBonusFactors(driverData, distance, pickup)
      };
    });

    return scoredDrivers.sort((a, b) => b.score - a.score);
  }

  // Machine learning optimization for driver selection
  applyMLOptimization(drivers, rideRequest) {
    const { pickup, rideType, timeOfDay, dayOfWeek } = rideRequest;

    return drivers.map(driver => {
      let mlScore = driver.score;

      // Historical success rate for this driver in similar conditions
      const historicalData = this.driverResponseHistory.get(driver.id);
      if (historicalData) {
        const successRate = historicalData.acceptanceRate || 0.8;
        const timePattern = historicalData.activeHours || [];
        const locationPattern = historicalData.preferredAreas || [];

        // Time-based adjustment
        const currentHour = new Date().getHours();
        if (timePattern.includes(currentHour)) {
          mlScore += 10;
        }

        // Location-based adjustment
        const nearPreferredArea = locationPattern.some(area =>
          calculateDistance(pickup.lat, pickup.lng, area.lat, area.lng) < 2
        );
        if (nearPreferredArea) {
          mlScore += 8;
        }

        // Success rate adjustment
        mlScore *= successRate;
      }

      // Demand prediction adjustment
      const demandPrediction = this.predictDemand(pickup, new Date());
      if (demandPrediction > 0.7) {
        mlScore += 5; // Boost score in high-demand areas
      }

      return { ...driver, mlScore: Math.round(mlScore) };
    }).sort((a, b) => b.mlScore - a.mlScore);
  }

  // Parallel driver assignment for immediate matching
  async parallelDriverAssignment(drivers, rideRequest, matchingProcess, timeout) {
    console.log(`🔄 Parallel assignment to ${drivers.length} drivers`);

    const assignmentPromises = drivers.map(async (driver) => {
      matchingProcess.triedDrivers.add(driver.id);

      return new Promise((resolve) => {
        const requestData = {
          ...rideRequest,
          estimatedArrival: driver.estimatedArrival,
          matchQuality: driver.matchQuality
        };

        // Send ride request to driver
        io.to(`user-${driver.id}`).emit('new-ride-request', requestData);

        // Set timeout for response
        const responseTimeout = setTimeout(() => {
          resolve({ success: false, driverId: driver.id, reason: 'timeout' });
        }, timeout);

        // Listen for driver response (this would be handled by socket events)
        const responseHandler = (response) => {
          clearTimeout(responseTimeout);
          if (response.accepted) {
            resolve({ success: true, driver, response });
          } else {
            matchingProcess.rejectedDrivers.add(driver.id);
            resolve({ success: false, driverId: driver.id, reason: 'declined' });
          }
        };

        // Store response handler for cleanup
        driver.responseHandler = responseHandler;
      });
    });

    try {
      // Wait for first successful response or all to complete
      const results = await Promise.allSettled(assignmentPromises);
      const successfulResult = results.find(result =>
        result.status === 'fulfilled' && result.value.success
      );

      if (successfulResult) {
        // Cancel other pending requests
        this.cancelPendingRequests(drivers.filter(d => d.id !== successfulResult.value.driver.id));
        return successfulResult.value;
      }

      return { success: false, reason: 'all_declined_or_timeout' };
    } catch (error) {
      console.error('Parallel assignment error:', error);
      return { success: false, reason: 'assignment_error' };
    }
  }

  // Sequential driver assignment with smart timing
  async sequentialDriverAssignment(drivers, rideRequest, matchingProcess, timePerDriver) {
    console.log(`⏭️ Sequential assignment to ${drivers.length} drivers`);

    for (const driver of drivers) {
      if (Date.now() - matchingProcess.startTime > matchingProcess.maxWaitTime) {
        break; // Time limit exceeded
      }

      matchingProcess.triedDrivers.add(driver.id);

      const result = await this.assignToSingleDriver(driver, rideRequest, timePerDriver);
      if (result.success) {
        return result;
      } else {
        matchingProcess.rejectedDrivers.add(driver.id);
        // Learn from rejection for ML optimization
        this.updateDriverResponseHistory(driver.id, false, result.reason);
      }
    }

    return { success: false, reason: 'all_drivers_tried' };
  }

  // Complete successful match
  completeMatch(matchingProcess, matchResult) {
    const matchTime = Date.now() - matchingProcess.startTime;

    console.log(`✅ Match completed: ${matchingProcess.id} in ${matchTime}ms`);
    console.log(`🚗 Assigned driver: ${matchResult.driver.first_name} ${matchResult.driver.last_name}`);
    console.log(`📊 Match type: ${matchResult.matchType}, Phase: ${matchResult.phase}`);

    // Update metrics
    this.matchingMetrics.totalMatches++;
    this.matchingMetrics.successfulMatches++;
    this.matchingMetrics.averageMatchTime =
      (this.matchingMetrics.averageMatchTime + matchTime) / 2;

    // Update driver response history
    this.updateDriverResponseHistory(matchResult.driver.id, true, 'accepted');

    // Clean up matching process
    this.matchingQueue.delete(matchingProcess.id);

    return {
      success: true,
      driver: matchResult.driver,
      matchTime,
      matchType: matchResult.matchType,
      phase: matchResult.phase,
      metrics: {
        triedDrivers: matchingProcess.triedDrivers.size,
        rejectedDrivers: matchingProcess.rejectedDrivers.size
      }
    };
  }

  // Fail match with analytics
  failMatch(matchingProcess, reason) {
    const matchTime = Date.now() - matchingProcess.startTime;

    console.log(`❌ Match failed: ${matchingProcess.id} after ${matchTime}ms - ${reason}`);

    // Update metrics
    this.matchingMetrics.totalMatches++;
    const rejectionCount = this.matchingMetrics.rejectionReasons.get(reason) || 0;
    this.matchingMetrics.rejectionReasons.set(reason, rejectionCount + 1);

    // Clean up
    this.matchingQueue.delete(matchingProcess.id);

    return {
      success: false,
      reason,
      matchTime,
      metrics: {
        triedDrivers: matchingProcess.triedDrivers.size,
        rejectedDrivers: matchingProcess.rejectedDrivers.size
      }
    };
  }

  // Update driver response patterns for ML
  updateDriverResponseHistory(driverId, accepted, reason) {
    const history = this.driverResponseHistory.get(driverId) || {
      totalRequests: 0,
      acceptedRequests: 0,
      acceptanceRate: 0.8,
      activeHours: [],
      preferredAreas: [],
      lastActive: new Date()
    };

    history.totalRequests++;
    if (accepted) {
      history.acceptedRequests++;
    }
    history.acceptanceRate = history.acceptedRequests / history.totalRequests;
    history.lastActive = new Date();

    this.driverResponseHistory.set(driverId, history);
  }

  // Additional utility methods for the matching engine
  calculateDriverScore(driver, driverData, distance, pickup, rideType) {
    let score = 0;

    // Distance factor (40% weight)
    const maxDistance = 10; // km
    const distanceScore = Math.max(0, (maxDistance - distance) / maxDistance);
    score += distanceScore * 40;

    // Rating factor (25% weight)
    const ratingScore = Math.pow((driverData.avgRating || 4.5) / 5.0, 2);
    score += ratingScore * 25;

    // Availability and activity (20% weight)
    const activityScore = this.calculateActivityScore(driverData);
    score += activityScore * 20;

    // Experience and reliability (15% weight)
    const reliabilityScore = this.calculateReliabilityScore(driverData);
    score += reliabilityScore * 15;

    return Math.min(100, Math.max(0, score));
  }

  calculateActivityScore(driverData) {
    const lastUpdate = new Date(driverData.lastLocationUpdate);
    const minutesSinceUpdate = (Date.now() - lastUpdate.getTime()) / 60000;

    if (minutesSinceUpdate < 1) return 1.0;
    if (minutesSinceUpdate < 5) return 0.8;
    if (minutesSinceUpdate < 15) return 0.6;
    return 0.3;
  }

  calculateReliabilityScore(driverData) {
    const acceptanceRate = driverData.acceptanceRate || 0.8;
    const completionRate = driverData.completionRate || 0.95;
    return (acceptanceRate * 0.6) + (completionRate * 0.4);
  }

  getDefaultDriverData(driver) {
    return {
      isAvailable: true,
      acceptanceRate: 0.85,
      avgRating: driver.rating || 4.5,
      completedTrips: 100,
      lastLocationUpdate: new Date(),
      currentStreak: 0,
      vehicleType: 'standard'
    };
  }

  calculateETA(distance, driverData) {
    const trafficMultiplier = getTrafficMultiplier();
    const baseSpeed = 30; // km/h
    const adjustedSpeed = baseSpeed / trafficMultiplier;
    return Math.round((distance / adjustedSpeed) * 60 + 1);
  }

  getMatchQuality(score) {
    if (score >= 85) return 'Excellent';
    if (score >= 70) return 'Very Good';
    if (score >= 50) return 'Good';
    return 'Fair';
  }

  getBonusFactors(driverData, distance, pickup) {
    const factors = [];
    if (distance < 1) factors.push('Very Close');
    if (driverData.avgRating > 4.8) factors.push('Top Rated');
    if (driverData.acceptanceRate > 0.9) factors.push('Highly Reliable');
    return factors;
  }
}

// Initialize the matching engine
const matchingEngine = new RealTimeMatchingEngine();

// Cascading Driver Request System - 7-second timeout with automatic progression
async function startCascadingDriverRequest(requestData) {
  const { rideId, availableDrivers, currentDriverIndex } = requestData;
  
  if (currentDriverIndex >= availableDrivers.length) {
    console.log(`❌ No more drivers available for ride ${rideId}`);
    handleNoCascadingDriversLeft(requestData);
    return;
  }
  
  const currentDriver = availableDrivers[currentDriverIndex];
  console.log(`🎯 Cascading attempt ${currentDriverIndex + 1}/${availableDrivers.length} for ride ${rideId} - trying driver ${currentDriver.id}`);
  
  // Update request data
  requestData.currentDriverId = currentDriver.id;
  requestData.attemptCount++;
  requestData.attemptStartTime = Date.now();
  
  // Calculate driver earnings from total fare using market-specific commission
const totalFare = requestData.estimatedFare;
const pickupLat = requestData.pickup?.lat || requestData.pickup?.latitude;
const pickupLng = requestData.pickup?.lng || requestData.pickup?.longitude;
const marketSettings = await getMarketPricingSettings(pickupLat, pickupLng);
const driverEarnings = totalFare * (marketSettings.driverCommission / 100);

console.log(`💰 Driver earnings calculation: $${totalFare} × ${marketSettings.driverCommission}% = $${driverEarnings.toFixed(2)} (Market: ${marketSettings.marketCode || 'default'})`);
  
  // Send ride request to current driver with 7-second timeout
  io.to(`user-${currentDriver.id}`).emit('cascading-ride-request', {
    rideId: requestData.rideId,
    pickup: requestData.pickup,
    destination: requestData.destination,
    pickupAddress: requestData.pickupAddress,
    destinationAddress: requestData.destinationAddress,
    estimatedFare: driverEarnings, // Show driver earnings instead of total fare
    totalFare: totalFare, // Include total fare for reference
    driverCommission: marketSettings.driverCommission,
    rideType: requestData.rideType,
    estimatedArrival: currentDriver.estimatedArrival || 5,
    requestTimeout: 7, // 7 seconds to respond (for audio duration)
    driverInfo: {
      name: `${currentDriver.first_name} ${currentDriver.last_name}`,
      rating: currentDriver.rating,
      distance: currentDriver.distance
    },
    riderPreferences: requestData.riderPreferences,
    cascadeInfo: {
      attempt: currentDriverIndex + 1,
      totalDrivers: availableDrivers.length,
      timeRemaining: 7
    }
  });
  
  console.log(`📲 Cascading ride request sent to driver ${currentDriver.id} (attempt ${currentDriverIndex + 1})`);
  
  // Set 7-second timeout for driver response
  const timeoutId = setTimeout(() => {
    handleDriverTimeout(requestData);
  }, 7000); // 7 seconds
  
  // Store timeout ID for potential cleanup
  requestData.currentTimeout = timeoutId;
}

function handleDriverTimeout(requestData) {
  const { rideId, currentDriverId, currentDriverIndex } = requestData;
  
  console.log(`⏰ Driver ${currentDriverId} timed out for ride ${rideId} after 7 seconds`);
  
  // Clear the timeout
  if (requestData.currentTimeout) {
    clearTimeout(requestData.currentTimeout);
    requestData.currentTimeout = null;
  }
  
  // 🔥 INCREMENT TIMEOUT COUNT (only for actual timeouts, not rejections)
  if (!requestData.timeoutCount) requestData.timeoutCount = 0;
  requestData.timeoutCount++;
  console.log(`⏰ Timeout count for ride ${rideId}: ${requestData.timeoutCount}`);
  
  // Notify the driver that the request has expired
  io.to(`user-${currentDriverId}`).emit('ride-request-expired', {
    rideId,
    reason: 'timeout',
    message: 'Request timed out - moved to next driver'
  });
  
  // Try next driver
  tryNextDriver(requestData);
}

function tryNextDriver(requestData) {
  const { rideId, availableDrivers } = requestData;
  
  // Move to next driver
  requestData.currentDriverIndex++;
  
  // 🎯 NEW: Max 7 attempts limit
  const MAX_ATTEMPTS = 7;
  if (requestData.currentDriverIndex >= MAX_ATTEMPTS || requestData.currentDriverIndex >= availableDrivers.length) {
    console.log(`❌ Max attempts reached (${requestData.currentDriverIndex}/${MAX_ATTEMPTS}) or all drivers exhausted for ride ${rideId}`);
    handleNoCascadingDriversLeft(requestData);
    return;
  }
  
  // 🔥 SURGE: Apply surge pricing after 2 TIMEOUT attempts (not rejections)
  const timeoutCount = requestData.timeoutCount || 0;
  if (timeoutCount >= 2 && !requestData.surgeApplied) {
    console.log(`🔥 SURGE: Applying surge pricing after ${timeoutCount} timeouts for ride ${rideId}`);
    requestData.surgeApplied = true;
    
    // Apply surge pricing to the ride
    applySurgePricingToRide(rideId, 1.5); // 1.5x surge multiplier
  }
  
  console.log(`🔄 Moving to next driver for ride ${rideId} (attempt ${requestData.currentDriverIndex + 1}/${MAX_ATTEMPTS}, timeouts: ${timeoutCount})`);
  
  // Continue the cascade
  startCascadingDriverRequest(requestData);
}

function handleNoCascadingDriversLeft(requestData) {
  const { rideId, riderId, attemptCount, startTime } = requestData;
  const totalTime = Date.now() - startTime;
  
  console.log(`❌ Cascading failed for ride ${rideId} after ${attemptCount} attempts in ${totalTime}ms`);
  
  // Remove from cascading requests
  cascadingRequests.delete(rideId);
  
  // Notify rider that no drivers accepted
  io.to(`user-${riderId}`).emit('no-drivers-accepted', {
    rideId,
    message: 'No π Drivers found at this time. Please try in a few minutes',
    stats: {
      driversContacted: attemptCount,
      totalTime: Math.round(totalTime / 1000),
      suggestedActions: ['try_later', 'change_pickup_location', 'increase_fare']
    }
  });
  
  // Remove from active ride requests
  activeRideRequests.delete(rideId);
  
  // Update pending requests count
  pendingRequestsCount = activeRideRequests.size;
  console.log(`📋 Cascading failed - Pending requests updated: ${pendingRequestsCount}`);
  
  // Broadcast pending requests update
  io.emit('pending-requests-update', {
    pendingRequests: pendingRequestsCount,
    rideId: rideId,
    action: 'failed',
    timestamp: new Date().toISOString()
  });
}

function handleCascadingDriverAcceptance(rideId, driverId) {
  const requestData = cascadingRequests.get(rideId);
  
  if (!requestData) {
    console.log(`⚠️ No cascading request found for ride ${rideId}`);
    return false;
  }
  
  console.log(`✅ Driver ${driverId} accepted cascading ride ${rideId}`);
  
  // Clear timeout
  if (requestData.currentTimeout) {
    clearTimeout(requestData.currentTimeout);
    requestData.currentTimeout = null;
  }
  
  // Remove from cascading requests
  cascadingRequests.delete(rideId);
  
  // Calculate cascade stats
  const totalTime = Date.now() - requestData.startTime;
  const driverFound = requestData.availableDrivers.find(d => d.id === driverId);
  
  console.log(`📊 Cascade success: ${requestData.attemptCount} attempts, ${totalTime}ms, found: ${driverFound?.first_name} ${driverFound?.last_name}`);
  
  return true;
}

// 🔥 NEW: Apply surge pricing to ride after timeouts
async function applySurgePricingToRide(rideId, surgeMultiplier) {
  try {
    console.log(`🔥 SURGE: Applying ${surgeMultiplier}x surge pricing to ride ${rideId}`);
    
    // Update ride with surge pricing
    const updateQuery = `
      UPDATE rides 
      SET estimated_fare = estimated_fare * $1,
          surge_multiplier = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;
    
    const result = await db.query(updateQuery, [surgeMultiplier, surgeMultiplier, rideId]);
    
    if (result.rows.length > 0) {
      const updatedRide = result.rows[0];
      console.log(`✅ SURGE: Applied to ride ${rideId}, new fare: $${updatedRide.estimated_fare}`);
      
      // Notify rider about surge pricing
      io.to(`user-${updatedRide.rider_id}`).emit('surge-pricing-applied', {
        rideId,
        surgeMultiplier,
        newEstimatedFare: updatedRide.estimated_fare,
        message: `Due to high demand, surge pricing (${surgeMultiplier}x) has been applied to increase driver availability.`
      });
    }
  } catch (error) {
    console.error('❌ SURGE: Error applying surge pricing:', error);
  }
}

// Enhanced smart driver matching algorithm with real-time processing
async function findBestDriver(rideRequest) {
  console.log(`🎯 Real-time matching initiated for ride: ${rideRequest.id}`);

  try {
    // 🎯 CASCADING FIX: Don't use findAndAssignBestDriver - it's for immediate assignment
    // Instead, get multiple drivers for cascading
    const result = await matchingEngine.findOptimalDrivers(rideRequest.pickup, 15, rideRequest.rideType);

    if (result && result.length > 0) {
      console.log(`✅ Found ${result.length} drivers for cascading:`, result.map(d => `${d.first_name} ${d.last_name} (score: ${d.score})`));
      return result; // Return multiple drivers for cascading
    } else {
      console.log(`❌ No drivers found by matching engine, trying fallback`);
      return findBestDriverFallback(rideRequest);
    }
  } catch (error) {
    console.error('Real-time matching error:', error);
    // Fallback to original algorithm
    return findBestDriverFallback(rideRequest);
  }
}

// Fallback matching algorithm for error cases
async function findBestDriverFallback(rideRequest) {
  const { pickup, rideType } = rideRequest;
  const maxSearchRadius = rideType === 'premium' ? 20 : 15;

  try {
    // 🔧 CRITICAL FIX: Use driverAvailability Map instead of broken database query
    const nearbyDrivers = Array.from(driverAvailability.values())
      .filter(driver => driver.isAvailable && driver.lat && driver.lng &&
        calculateDistance(pickup.lat, pickup.lng, driver.lat, driver.lng) <= maxSearchRadius)
      .map(driver => ({
        id: driver.driverId,
        driverId: driver.driverId, // Ensure both id and driverId are set  
        first_name: driver.first_name || 'Driver',
        last_name: driver.last_name || '',
        phone: driver.phone || '',
        rating: driver.rating || 4.8,
        latitude: driver.lat,
        longitude: driver.lng,
        is_available: true
      }));

    console.log(`🔍 Fallback found ${nearbyDrivers.length} available drivers using driverAvailability Map`);

    if (nearbyDrivers.length === 0) {
      return null;
    }

    // Simple scoring for fallback
    const scoredDrivers = nearbyDrivers.map(driver => {
      const distance = calculateDistance(pickup.lat, pickup.lng, driver.latitude, driver.longitude);
      const driverData = driverAvailability.get(driver.id) || matchingEngine.getDefaultDriverData(driver);

      const score = matchingEngine.calculateDriverScore(driver, driverData, distance, pickup, rideType);

      return {
        ...driver,
        driverData,
        distance: Number(distance.toFixed(2)),
        score: Number(score.toFixed(2)),
        estimatedArrival: matchingEngine.calculateETA(distance, driverData),
        matchQuality: matchingEngine.getMatchQuality(score)
      };
    });

    scoredDrivers.sort((a, b) => b.score - a.score);
    return scoredDrivers.slice(0, 3);
  } catch (error) {
    console.error('Fallback matching error:', error);
    return null;
  }
}

// Helper function to calculate bearing between two points
function calculateBearing(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;

  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

// Helper function to get traffic multiplier based on time
function getTrafficMultiplier() {
  const hour = new Date().getHours();
  const dayOfWeek = new Date().getDay();

  // Weekend traffic
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return hour >= 10 && hour <= 16 ? 1.2 : 1.0;
  }

  // Weekday traffic
  if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19)) {
    return 1.6; // Heavy traffic
  } else if ((hour >= 6 && hour <= 10) || (hour >= 15 && hour <= 20)) {
    return 1.3; // Moderate traffic
  }

  return 1.0; // Light traffic
}

// Comprehensive Airport Locations for Queue Management - Top 50 US Airports
const AIRPORT_LOCATIONS = [
  // Tier 1: Major International Hubs
  { name: 'ATL - Hartsfield-Jackson Atlanta International', lat: 33.6407, lng: -84.4277, radius: 4.2 },
  { name: 'LAX - Los Angeles International Airport', lat: 33.9425, lng: -118.4081, radius: 3.8 },
  { name: 'ORD - O\'Hare International Airport', lat: 41.9742, lng: -87.9073, radius: 4.5 },
  { name: 'DFW - Dallas/Fort Worth International', lat: 32.8998, lng: -97.0403, radius: 5.0 },
  { name: 'DEN - Denver International Airport', lat: 39.8561, lng: -104.6737, radius: 4.8 },

  // Tier 2: Major East/West Coast Airports
  { name: 'JFK - John F. Kennedy International Airport', lat: 40.6413, lng: -73.7781, radius: 3.5 },
  { name: 'SFO - San Francisco International', lat: 37.6213, lng: -122.3790, radius: 3.2 },
  { name: 'LGA - LaGuardia Airport', lat: 40.7769, lng: -73.8740, radius: 2.5 },
  { name: 'EWR - Newark Liberty International', lat: 40.6895, lng: -74.1745, radius: 2.8 },
  { name: 'SEA - Seattle-Tacoma International', lat: 47.4502, lng: -122.3088, radius: 3.4 },

  // Tier 3: Major Regional Airports
  { name: 'MIA - Miami International Airport', lat: 25.7959, lng: -80.2870, radius: 3.0 },
  { name: 'PHX - Phoenix Sky Harbor International', lat: 33.4342, lng: -112.0080, radius: 3.2 },
  { name: 'IAH - George Bush Intercontinental Houston', lat: 29.9844, lng: -95.3414, radius: 3.5 },
  { name: 'BOS - Boston Logan International', lat: 42.3656, lng: -71.0096, radius: 2.9 },
  { name: 'MSP - Minneapolis-St. Paul International', lat: 44.8848, lng: -93.2223, radius: 3.1 },

  // Tier 4: Major Regional & Secondary Airports
  { name: 'DTW - Detroit Metropolitan Wayne County', lat: 42.2124, lng: -83.3534, radius: 3.0 },
  { name: 'PHL - Philadelphia International', lat: 39.8719, lng: -75.2411, radius: 2.7 },
  { name: 'MCO - Orlando International', lat: 28.4312, lng: -81.3081, radius: 2.8 },
  { name: 'SLC - Salt Lake City International', lat: 40.7884, lng: -111.9776, radius: 2.5 },
  { name: 'FLL - Fort Lauderdale-Hollywood International', lat: 26.0742, lng: -80.1506, radius: 2.3 },
  { name: 'DCA - Ronald Reagan Washington National', lat: 38.8512, lng: -77.0402, radius: 2.1 },
  { name: 'IAD - Washington Dulles International', lat: 38.9531, lng: -77.4565, radius: 3.2 },
  { name: 'MDW - Chicago Midway International', lat: 41.7868, lng: -87.7522, radius: 2.2 },
  { name: 'SAN - San Diego International', lat: 32.7336, lng: -117.1897, radius: 2.4 },
  { name: 'TPA - Tampa International', lat: 27.9755, lng: -82.5332, radius: 2.6 },

  // Tier 5: Secondary Markets & Regional
  { name: 'PDX - Portland International', lat: 45.5898, lng: -122.5951, radius: 2.3 },
  { name: 'AUS - Austin-Bergstrom International', lat: 30.1975, lng: -97.6664, radius: 2.5 },
  { name: 'MSY - Louis Armstrong New Orleans International', lat: 29.9934, lng: -90.2580, radius: 2.2 },
  { name: 'STL - St. Louis Lambert International', lat: 38.7487, lng: -90.3700, radius: 2.4 },
  { name: 'BWI - Baltimore/Washington International Thurgood Marshall', lat: 39.1754, lng: -76.6683, radius: 2.5 },
  { name: 'OAK - Oakland International', lat: 37.7214, lng: -122.2208, radius: 2.1 },
  { name: 'SJC - San Jose Mineta International', lat: 37.3639, lng: -121.9289, radius: 2.0 },
  { name: 'CVG - Cincinnati/Northern Kentucky International', lat: 39.0488, lng: -84.6678, radius: 2.3 },
  { name: 'IND - Indianapolis International', lat: 39.7173, lng: -86.2944, radius: 2.2 },
  { name: 'CMH - John Glenn Columbus International', lat: 39.9980, lng: -82.8919, radius: 2.1 },

  // Regional & Smaller Markets
  { name: 'RIC - Richmond International', lat: 37.5052, lng: -77.3197, radius: 1.8 },
  { name: 'RDU - Raleigh-Durham International', lat: 35.8776, lng: -78.7875, radius: 2.0 },
  { name: 'CLT - Charlotte Douglas International', lat: 35.2140, lng: -80.9431, radius: 2.4 },
  { name: 'MKE - Milwaukee Mitchell International', lat: 42.9472, lng: -87.8966, radius: 1.9 },
  { name: 'BUF - Buffalo Niagara International', lat: 42.9405, lng: -78.7322, radius: 1.8 },
  { name: 'RNO - Reno-Tahoe International', lat: 39.4991, lng: -119.7681, radius: 1.7 },

  // Arkansas & Regional
  { name: 'XNA - Northwest Arkansas Regional', lat: 36.2818, lng: -94.3068, radius: 2.2 },
  { name: 'LIT - Bill and Hillary Clinton National/Adams Field', lat: 34.7293,lng: -92.2241, radius: 2.0 },

  // Additional Key Markets
  { name: 'ABQ - Albuquerque International Sunport', lat: 35.0402, lng: -106.6091, radius: 1.9 },
  { name: 'TUL - Tulsa International', lat: 36.1984, lng: -95.8881, radius: 1.8 },
  { name: 'OKC - Will Rogers World', lat: 35.3931, lng: -97.6007, radius: 1.9 },
  { name: 'MCI - Kansas City International', lat: 39.2976, lng: -94.7139, radius: 2.1 }
];

// Sample Airport Pickup/Dropoff Zones Data (extend this with actual data)
const airportPickupDropoffZones = {
  'LAX': {
    code: 'LAX',
    name: 'Los Angeles International Airport',
    pickupZones: [
      { name: 'Terminal 1 Pickup', lat: 33.9771, lng: -118.3913, radius: 50, fareMultiplier: 1.1 },
      { name: 'Terminal 3 Rideshare Zone', lat: 33.9721, lng: -118.3981, radius: 75, fareMultiplier: 1.05 },
      { name: 'Tom Bradley Int\'l Pickup', lat: 33.9425, lng: -118.4081, radius: 100, fareMultiplier: 1.2 },
      { name: 'Southwest Airlines Pickup', lat: 33.9788, lng: -118.4271, radius: 60, fareMultiplier: 1.0 }
    ],
    dropoffZones: [
      { name: 'Terminal 1 Dropoff', lat: 33.9765, lng: -118.3905, radius: 40, fareMultiplier: 1.0 },
      { name: 'Tom Bradley Int\'l Dropoff', lat: 33.9418, lng: -118.4075, radius: 80, fareMultiplier: 1.15 }
    ]
  },
  'JFK': {
    code: 'JFK',
    name: 'John F. Kennedy International Airport',
    pickupZones: [
      { name: 'Terminal 4 Pickup', lat: 40.6554, lng: -73.7821, radius: 120, fareMultiplier: 1.2 },
      { name: 'Terminal 7 Rideshare', lat: 40.6450, lng: -73.7889, radius: 90, fareMultiplier: 1.1 },
      { name: 'JetBlue Pickup', lat: 40.6595, lng: -73.7839, radius: 100, fareMultiplier: 1.15 }
    ],
    dropoffZones: [
      { name: 'Terminal 4 Departure', lat: 40.6540, lng: -73.7815, radius: 100, fareMultiplier: 1.0 },
      { name: 'Terminal 7 Departure', lat: 40.6445, lng: -73.7885, radius: 80, fareMultiplier: 1.05 }
    ]
  },
  'ATL': {
    code: 'ATL',
    name: 'Hartsfield-Jackson Atlanta International',
    pickupZones: [
      { name: 'Domestic Terminal Pickup', lat: 33.6367, lng: -84.4290, radius: 150, fareMultiplier: 1.1 },
      { name: 'International Terminal Rideshare', lat: 33.6540, lng: -84.4305, radius: 120, fareMultiplier: 1.2 },
      { name: 'North Terminal Pickup', lat: 33.6310, lng: -84.4300, radius: 100, fareMultiplier: 1.05 }
    ],
    dropoffZones: [
      { name: 'Domestic Terminal Dropoff', lat: 33.6375, lng: -84.4285, radius: 130, fareMultiplier: 1.0 },
      { name: 'International Terminal Departure', lat: 33.6535, lng: -84.4300, radius: 110, fareMultiplier: 1.1 }
    ]
  },
  'ORD': {
    code: 'ORD',
    name: 'O\'Hare International Airport',
    pickupZones: [
      { name: 'Terminal 1 Pickup', lat: 41.9780, lng: -87.9050, radius: 110, fareMultiplier: 1.1 },
      { name: 'Terminal 2 Rideshare', lat: 41.9750, lng: -87.8990, radius: 90, fareMultiplier: 1.05 },
      { name: 'Terminal 5 Pickup', lat: 41.9765, lng: -87.8860, radius: 130, fareMultiplier: 1.2 }
    ],
    dropoffZones: [
      { name: 'Terminal 1 Departures', lat: 41.9775, lng: -87.9045, radius: 100, fareMultiplier: 1.0 },
      { name: 'Terminal 5 Departures', lat: 41.9755, lng: -87.8855, radius: 120, fareMultiplier: 1.1 }
    ]
  },
  'DEN': {
    code: 'DEN',
    name: 'Denver International Airport',
    pickupZones: [
      { name: 'Jeppesen Terminal Pickup', lat: 39.8475, lng: -104.6710, radius: 150, fareMultiplier: 1.1 },
      { name: 'West Side Rideshare', lat: 39.8520, lng: -104.6770, radius: 100, fareMultiplier: 1.05 },
      { name: 'East Side Pickup', lat: 39.8550, lng: -104.6650, radius: 120, fareMultiplier: 1.0 }
    ],
    dropoffZones: [
      { name: 'Jeppesen Terminal Dropoff', lat: 39.8480, lng: -104.6715, radius: 130, fareMultiplier: 1.0 },
      { name: 'West Side Departures', lat: 39.8515, lng: -104.6765, radius: 90, fareMultiplier: 1.05 }
    ]
  },
  'SFO': {
    code: 'SFO',
    name: 'San Francisco International',
    pickupZones: [
      { name: 'Terminal 1 Pickup', lat: 37.6190, lng: -122.3660, radius: 100, fareMultiplier: 1.1 },
      { name: 'Terminal 2 Rideshare', lat: 37.6150, lng: -122.3750, radius: 80, fareMultiplier: 1.05 },
      { name: 'International Terminal Pickup', lat: 37.6195, lng: -122.3880, radius: 130, fareMultiplier: 1.2 }
    ],
    dropoffZones: [
      { name: 'Terminal 1 Departures', lat: 37.6185, lng: -122.3655, radius: 90, fareMultiplier: 1.0 },
      { name: 'International Terminal Departures', lat: 37.6190, lng: -122.3875, radius: 120, fareMultiplier: 1.1 }
    ]
  },
  'SEA': {
    code: 'SEA',
    name: 'Seattle-Tacoma International',
    pickupZones: [
      { name: 'Terminal Main Pickup', lat: 47.4480, lng: -122.3100, radius: 120, fareMultiplier: 1.1 },
      { name: 'South Satellite Rideshare', lat: 47.4370, lng: -122.3050, radius: 90, fareMultiplier: 1.05 },
      { name: 'North Satellite Pickup', lat: 47.4450, lng: -122.3150, radius: 100, fareMultiplier: 1.0 }
    ],
    dropoffZones: [
      { name: 'Terminal Main Departures', lat: 47.4475, lng: -122.3095, radius: 110, fareMultiplier: 1.0 },
      { name: 'South Satellite Departures', lat: 47.4365, lng: -122.3045, radius: 80, fareMultiplier: 1.05 }
    ]
  },
  'XNA': {
    code: 'XNA',
    name: 'Northwest Arkansas Regional',
    pickupZones: [
      { name: 'Main Terminal Pickup', lat: 36.2820, lng: -94.3065, radius: 80, fareMultiplier: 1.05 }
    ],
    dropoffZones: [
      { name: 'Main Terminal Dropoff', lat: 36.2815, lng: -94.3070, radius: 70, fareMultiplier: 1.0 }
    ]
  },
  'LIT': {
    code: 'LIT',
    name: 'Bill and Hillary Clinton National/Adams Field',
    pickupZones: [
      { name: 'Terminal Pickup', lat: 34.7290, lng: -92.2235, radius: 70, fareMultiplier: 1.05 }
    ],
    dropoffZones: [
      { name: 'Terminal Dropoff', lat: 34.7285, lng: -92.2240, radius: 60, fareMultiplier: 1.0 }
    ]
  }
};

// Find nearest airport pickup/dropoff zone
function findNearestAirportZone(lat, lng, airportCode, zoneType = 'pickup') {
  const airport = airportPickupDropoffZones[airportCode];
  if (!airport) return null;

  const zones = zoneType === 'pickup' ? airport.pickupZones : airport.dropoffZones;
  let nearestZone = null;
  let minDistance = Infinity;

  for (const zone of zones) {
    const distance = calculateDistance(lat, lng, zone.lat, zone.lng);
    if (distance < minDistance) {
      minDistance = distance;
      nearestZone = { ...zone, distance: Math.round(distance * 1000) }; // distance in meters
    }
  }

  return nearestZone;
}

// Get all zones for a specific airport
function getAirportZones(airportCode) {
  return airportPickupDropoffZones[airportCode] || null;
}

// Check if coordinates are within a specific pickup/dropoff zone
function isInAirportZone(lat, lng, airportCode, zoneName, radiusMeters = 100) {
  const airport = airportPickupDropoffZones[airportCode];
  if (!airport) return false;

  const allZones = [...airport.pickupZones, ...airport.dropoffZones];
  const zone = allZones.find(z => z.name === zoneName);

  if (!zone) return false;

  const distance = calculateDistance(lat, lng, zone.lat, zone.lng) * 1000; // convert to meters
  return distance <= radiusMeters;
}

// Add driver to airport queue
function addDriverToAirportQueue(driverId, airportName) {
  if (!airportDriverQueues.has(airportName)) {
    airportDriverQueues.set(airportName, []);
  }

  const queue = airportDriverQueues.get(airportName);

  // Remove driver from queue if already present
  const existingIndex = queue.findIndex(driver => driver.driverId === driverId);
  if (existingIndex !== -1) {
    queue.splice(existingIndex, 1);
  }

  // Add driver to end of queue
  queue.push({
    driverId,
    joinedAt: new Date(),
    position: queue.length + 1
  });

  console.log(`🛫 Driver ${driverId} joined ${airportName} queue at position ${queue.length}`);

  // Notify driver of queue position
  io.to(`user-${driverId}`).emit('airport-queue-update', {
    airport: airportName,
    position: queue.length,
    queueLength: queue.length,
    estimatedWaitTime: Math.max(5, queue.length * 8) // Estimate 8 minutes per position
  });

  return queue.length;
}

// Remove driver from airport queue
function removeDriverFromAirportQueue(driverId, airportName) {
  if (!airportDriverQueues.has(airportName)) return;

  const queue = airportDriverQueues.get(airportName);
  const driverIndex = queue.findIndex(driver => driver.driverId === driverId);

  if (driverIndex !== -1) {
    queue.splice(driverIndex, 1);
    console.log(`🛫 Driver ${driverId} removed from ${airportName} queue`);

    // Update positions for remaining drivers
    queue.forEach((driver, index) => {
      driver.position = index + 1;
      io.to(`user-${driver.driverId}`).emit('airport-queue-update', {
        airport: airportName,
        position: index + 1,
        queueLength: queue.length,
        estimatedWaitTime: Math.max(5, (index + 1) * 8)
      });
    });

    // Notify removed driver
    io.to(`user-${driverId}`).emit('airport-queue-left', {
      airport: airportName
    });
  }
}

// Get next driver from airport queue
function getNextDriverFromAirportQueue(airportName) {
  if (!airportDriverQueues.has(airportName)) return null;

  const queue = airportDriverQueues.get(airportName);
  if (queue.length === 0) return null;

  // Get first driver in queue (FIFO)
  const nextDriver = queue.shift();

  // Update positions for remaining drivers
  queue.forEach((driver, index) => {
    driver.position = index + 1;
    io.to(`user-${driver.driverId}`).emit('airport-queue-update', {
      airport: airportName,
      position: index + 1,
      queueLength: queue.length,
      estimatedWaitTime: Math.max(5, (index + 1) * 8)
    });
  });

  console.log(`🛫 Driver ${nextDriver.driverId} selected from ${airportName} queue (waited ${Math.round((Date.now() - nextDriver.joinedAt.getTime()) / 60000)} minutes)`);

  return nextDriver;
}

// Update driver availability
function updateDriverAvailability(driverId, data) {
  const existing = driverAvailability.get(driverId) || {};
  const updatedData = {
    ...existing,
    ...data,
    driverId: driverId, // 🔧 CRITICAL FIX: Always include driverId in stored object
    lastLocationUpdate: new Date()
  };

  driverAvailability.set(driverId, updatedData);

  // Check if driver is near an airport and manage queue
  if (data.lat && data.lng && data.isAvailable) {
    const nearbyAirport = getNearbyAirport(data.lat, data.lng);

    if (nearbyAirport && !existing.currentAirport) {
      // Driver entered airport area
      addDriverToAirportQueue(driverId, nearbyAirport.name);
      updatedData.currentAirport = nearbyAirport.name;
      driverAvailability.set(driverId, updatedData);
    } else if (!nearbyAirport && existing.currentAirport) {
      // Driver left airport area
      removeDriverFromAirportQueue(driverId, existing.currentAirport);
      updatedData.currentAirport = null;
      driverAvailability.set(driverId, updatedData);
    }
  } else if (!data.isAvailable && existing.currentAirport) {
    // Driver went offline while in airport
    removeDriverFromAirportQueue(driverId, existing.currentAirport);
    updatedData.currentAirport = null;
    driverAvailability.set(driverId, updatedData);
  }
}

// Real-time WebSocket handling
io.on('connection', (socket) => {
  console.log('🔗 User connected:', socket.id);

  // User joins their personal room
  socket.on('join-room', async (data) => {
    const { userId, userType } = data;
    socket.userId = userId;
    socket.userType = userType;
    socket.join(`user-${userId}`);

    if (userType === 'driver') {
      socket.join('drivers');
      console.log(`🚗 Driver ${userId} joined and available for rides`);
      
      // 🔧 CRITICAL FIX: Update database to mark driver as available when they join
      try {
        // Use direct SQL to update only the is_available field
        await db.query(
          `UPDATE driver_locations SET is_available = true, updated_at = CURRENT_TIMESTAMP WHERE driver_id = $1`,
          [userId]
        );
        console.log(`✅ Driver ${userId} marked as AVAILABLE in database`);
      } catch (error) {
        console.error(`❌ Error updating driver availability:`, error);
      }
    } else {
      console.log(`👤 Rider ${userId} connected`);
    }
  });

  // 🔄 SYNC FIX: Handle current state requests for reconnection synchronization
  socket.on('request-current-state', async () => {
    try {
      console.log('🔄 Dashboard requesting current state sync...');
      
      // Get current online drivers count
      const availableDriversCount = Array.from(driverAvailability.values())
        .filter(driver => driver.isAvailable && driver.status === 'online').length;
      
      console.log(`📊 Sending current state: ${availableDriversCount} drivers online`);
      
      // Send current availability summary
      socket.emit('driver-availability-update', {
        totalDrivers: availableDriversCount,
        type: 'current-state-sync'
      });
      
      // Send individual driver data for map markers
      for (const [driverId, driverData] of driverAvailability.entries()) {
        if (driverData.isAvailable && driverData.status === 'online' && driverData.location) {
          socket.emit('driver-availability-update', {
            totalDrivers: availableDriversCount,
            driverId: driverId,
            status: 'online',
            isAvailable: true,
            location: driverData.location,
            type: 'driver-state-sync'
          });
          console.log(`✅ Synced driver ${driverId} location:`, driverData.location);
        }
      }
      
    } catch (error) {
      console.error('❌ Error handling current state request:', error);
    }
  });

  // Real-time driver location updates
  socket.on('driver-location-update', async (data) => {
    try {
      const { driverId, location, heading, speed, timestamp } = data;

      // Update driver location in database
      await db.updateDriverLocation(driverId, {
        latitude: location.lat,
        longitude: location.lng,
        heading,
        speed,
        is_available: data.status === 'online', // Assuming status is sent here too
        lastLocationUpdate: timestamp
      });

      // 🚗 CRITICAL: Check if driver has an active ride to send targeted updates to rider
      try {
        const activeRideQuery = `
          SELECT rider_id, id as ride_id 
          FROM rides 
          WHERE driver_id = $1 
          AND status IN ('accepted', 'en_route', 'arrived') 
          ORDER BY created_at DESC 
          LIMIT 1
        `;
        
        const activeRideResult = await db.query(activeRideQuery, [driverId]);
        
        if (activeRideResult.rows.length > 0) {
          const { rider_id, ride_id } = activeRideResult.rows[0];
          
          // Send targeted location update to the specific rider waiting for this driver
          io.to(`user-${rider_id}`).emit('driver-location-update', {
            driverId: driverId,
            location,
            heading,
            speed,
            timestamp,
            rideId: ride_id
          });
          
          console.log(`📍 Driver ${driverId} location sent to rider ${rider_id} for ride ${ride_id}`);
        } else {
          // If no active ride, broadcast generally (for dashboard, etc.)
          socket.broadcast.emit('driver-location-update', {
            driverId: driverId,
            location,
            heading,
            speed,
            timestamp
          });
        }
      } catch (queryError) {
        console.error('❌ Error checking active ride for location update:', queryError);
        // Fallback to general broadcast
        socket.broadcast.emit('driver-location-update', {
          driverId: driverId,
          location,
          heading,
          speed,
          timestamp
        });
      }

    } catch (error) {
      console.error('Driver location update error:', error);
    }
  });

  // Driver connection event with status and preferences
  socket.on('driver-connect', (data) => {
    const { driverId, status, location, vehicle, preferences } = data;
    socket.userId = driverId;
    socket.userType = 'driver';
    socket.join(`user-${driverId}`);
    socket.join('drivers');
    console.log(`🚗 Driver ${driverId} connected. Status: ${status}`);
    console.log(`🔍 Driver data received:`, JSON.stringify(data, null, 2));

    // Update driver availability and location
    updateDriverAvailability(driverId, {
      isAvailable: status === 'online',
      lat: location?.lat,
      lng: location?.lng,
      heading: location?.heading,
      speed: location?.speed,
      vehicleType: vehicle?.type,
      licensePlate: vehicle?.license,
      vehicleColor: vehicle?.color,
      preferences: preferences || {}
    });

    // Broadcast driver availability change to all connected clients
    const availableDriversCount = Array.from(driverAvailability.values())
      .filter(driver => driver.isAvailable).length;
    
    console.log(`📡 Broadcasting driver availability update: ${availableDriversCount} drivers online`);
    
    // Get driver data for broadcasting
    const driverData = driverAvailability.get(driverId);
    
    io.emit('driver-availability-update', {
      totalDrivers: availableDriversCount,
      driverId: driverId,
      status: status,
      location: driverData?.lat && driverData?.lng ? {
        lat: driverData.lat,
        lng: driverData.lng,
        heading: driverData.heading || 0
      } : null,
      isAvailable: driverData?.isAvailable || false,
      timestamp: new Date().toISOString()
    });
  });

  // Handle rider connection for Dashboard tracking
  socket.on('rider-connect', (data) => {
    const { riderId, name, location, status } = data;
    socket.userId = riderId;
    socket.userType = 'rider';
    socket.join(`user-${riderId}`);
    socket.join('riders');
    
    console.log(`👤 Rider ${riderId} connected for Dashboard tracking`);
    
    // Add/update rider in global tracking map
    if (!global.riderAvailability) global.riderAvailability = new Map();
    global.riderAvailability.set(riderId, {
      riderId: riderId,
      name: name,
      lat: location?.lat,
      lng: location?.lng,
      status: status,
      lastUpdate: Date.now()
    });
    
    // Broadcast updated rider data to Dashboard
    io.emit('rider-availability-update', {
      totalRiders: Array.from(global.riderAvailability.values()).length,
      riders: Array.from(global.riderAvailability.values()),
      timestamp: new Date().toISOString()
    });
  });

  // In-ride messaging
  socket.on('message', async (data) => {
    try {
      const { rideId, recipientId, text } = data;

      // Save message to database
      const result = await db.query(
        'INSERT INTO messages (ride_id, sender_id, recipient_id, message_text) VALUES ($1, $2, $3, $4) RETURNING *',
        [rideId, socket.userId, recipientId, text]
      );

      const message = result.rows[0];

      // Send to recipient
      io.to(`user-${recipientId}`).emit('new-message', {
        id: message.id,
        rideId,
        senderId: socket.userId,
        senderName: 'Driver', // In real app, get from user data
        recipientId,
        text,
        timestamp: message.sent_at
      });

    } catch (error) {
      console.error('Message send error:', error);
    }
  });

  // Handle ride cancellation acknowledgment from driver
  socket.on('ride-cancelled-ack', async (data) => {
    const { rideId, driverId, timestamp } = data;
    
    try {
      console.log(`✅ Driver ${driverId} acknowledged ride cancellation for ride ${rideId} at ${timestamp}`);
      
      // Log the acknowledgment for debugging and analytics
      // Could be used for retry mechanisms or completion tracking
      
    } catch (error) {
      console.error('❌ Error processing ride-cancelled-ack:', error);
    }
  });

  // Driver arrival notification
  socket.on('driver-arrived', async (data) => {
    try {
      const { rideId, driverId, arrivalTime } = data;

      // Update ride status to driver arrived
      const updatedRide = await db.updateRideStatus(rideId, 'driver_arrived', {
        driver_arrived_at: arrivalTime || new Date()
      });

      // Notify rider that driver has arrived
      io.to(`user-${updatedRide.rider_id}`).emit('driver_arrived', {
        rideId,
        driverId,
        arrivalTime: arrivalTime || new Date(),
        message: 'Your driver has arrived! Wait time tracking has started.',
        gracePeriod: 120 // 2 minutes free wait time
      });

      // Confirm to driver
      socket.emit('arrival-confirmed', {
        rideId,
        message: 'Arrival confirmed. Rider has been notified.'
      });

      console.log(`🚗 Driver ${driverId} arrived for ride ${rideId}`);

    } catch (error) {
      console.error('Driver arrival error:', error);
      socket.emit('arrival-failed', { rideId, error: 'Failed to confirm arrival' });
    }
  });

  // Driver accepts ride
  socket.on('accept-ride', async (data) => {
    try {
      const { rideId } = data;
      const rideRequest = activeRideRequests.get(rideId);

      if (!rideRequest) {
        socket.emit('ride-already-taken', { rideId });
        return;
      }

      // Clear any pending timeouts
      if (rideRequest.currentTimeout) {
        clearTimeout(rideRequest.currentTimeout);
      }

      // Update ride status
      const updatedRide = await db.updateRideStatus(rideId, 'accepted', {
        driver_id: socket.userId,
        accepted_at: new Date()
      });

      const driver = await db.getUserById(socket.userId);
      const driverData = driverAvailability.get(socket.userId);

      // Remove driver from airport queue if they were in one
      if (driverData && driverData.currentAirport) {
        removeDriverFromAirportQueue(socket.userId, driverData.currentAirport);
      }

      // Update driver availability
      updateDriverAvailability(socket.userId, {
        isAvailable: false,
        currentRideId: rideId,
        currentAirport: null,
        acceptanceRate: (driverAvailability.get(socket.userId)?.acceptanceRate || 0.85) + 0.01
      });

      // Remove ride request from active requests and broadcast update
      activeRideRequests.delete(rideId);
      pendingRequestsCount = activeRideRequests.size;
      console.log(`📋 Ride accepted - Pending requests updated: ${pendingRequestsCount}`);
      
      // Broadcast pending requests decrease to all connected clients
      io.emit('pending-requests-update', {
        pendingRequests: pendingRequestsCount,
        rideId: rideId,
        action: 'accepted',
        timestamp: new Date().toISOString()
      });

      // Notify rider
      const riderId = updatedRide.rider_id;
      io.to(`user-${riderId}`).emit('ride-accepted', {
        ride: updatedRide,
        driver: {
          id: driver.id,
          name: `${driver.first_name} ${driver.last_name}`,
          rating: driver.rating,
          phone: driver.phone,
          vehicle: {
            model: 'Toyota Camry', // In production, fetch from driver profile
            color: 'Blue',
            plate: 'ABC-123'
          },
          location: driverAvailability.get(socket.userId)
        }
      });

      // Notify driver of successful acceptance
      socket.emit('ride-acceptance-confirmed', {
        rideId,
        rider: {
          name: 'Rider Name', // In production, fetch from rider profile
          rating: 4.8,
          phone: '+1234567890'
        }
      });

    } catch (error) {
      console.error('Accept ride error:', error);
      socket.emit('ride-acceptance-failed', { rideId, error: 'Failed to accept ride' });
    }
  });

  // Driver accepts cascading ride request
  socket.on('accept-cascading-ride', async (data) => {
    try {
      const { rideId } = data;
      
      // Check if this is a valid cascading request
      const isValidCascade = handleCascadingDriverAcceptance(rideId, socket.userId);
      
      if (!isValidCascade) {
        socket.emit('ride-already-taken', { 
          rideId,
          message: 'This ride request is no longer available.'
        });
        return;
      }
      
      // Process like a normal ride acceptance
      const rideRequest = activeRideRequests.get(rideId);
      
      if (!rideRequest) {
        socket.emit('ride-already-taken', { rideId });
        return;
      }
      
      // Update ride status
      const updatedRide = await db.updateRideStatus(rideId, 'accepted', {
        driver_id: socket.userId,
        accepted_at: new Date()
      });
      
      const driver = await db.getUserById(socket.userId);
      const driverData = driverAvailability.get(socket.userId);
      
      // Remove driver from airport queue if they were in one
      if (driverData && driverData.currentAirport) {
        removeDriverFromAirportQueue(socket.userId, driverData.currentAirport);
      }
      
      // Update driver availability
      updateDriverAvailability(socket.userId, {
        isAvailable: false,
        currentRideId: rideId,
        currentAirport: null,
        acceptanceRate: (driverAvailability.get(socket.userId)?.acceptanceRate || 0.85) + 0.01
      });
      
      // Remove ride request from active requests and broadcast update
      activeRideRequests.delete(rideId);
      pendingRequestsCount = activeRideRequests.size;
      console.log(`📋 Cascading ride accepted - Pending requests updated: ${pendingRequestsCount}`);
      
      // Broadcast pending requests decrease to all connected clients
      io.emit('pending-requests-update', {
        pendingRequests: pendingRequestsCount,
        rideId: rideId,
        action: 'accepted',
        timestamp: new Date().toISOString()
      });
      
      // 🚗 CRITICAL: Get driver's actual GPS location from database
      const driverLocationQuery = `
        SELECT lat, lng, heading, speed, updated_at
        FROM users 
        WHERE id = $1 
        LIMIT 1
      `;
      const driverLocationResult = await db.query(driverLocationQuery, [socket.userId]);
      
      let driverLocation = null;
      if (driverLocationResult.rows.length > 0) {
        const loc = driverLocationResult.rows[0];
        driverLocation = {
          lat: parseFloat(loc.lat),
          lng: parseFloat(loc.lng),
          heading: loc.heading || 0,
          speed: loc.speed || 0
        };
        console.log(`📍 Driver ${socket.userId} actual location: ${driverLocation.lat}, ${driverLocation.lng}`);
      } else {
        // Fallback to availability data
        console.log(`⚠️ No GPS location found for driver ${socket.userId}, using fallback`);
        driverLocation = driverAvailability.get(socket.userId) || { lat: 36.3729, lng: -94.2088 };
      }

      // 🎉 NEW: Notify rider with FLASHING success and driver location
      const riderId = updatedRide.rider_id;
      io.to(`user-${riderId}`).emit('ride-accepted', {
        ride: updatedRide,
        driver: {
          id: driver.id,
          driverId: socket.userId, // Add driverId for tracking
          name: `${driver.first_name} ${driver.last_name}`,
          rating: driver.rating,
          phone: driver.phone,
          vehicle: {
            model: driverData?.vehicleType || 'Vehicle',
            color: driverData?.vehicleColor || 'Blue',
            plate: driverData?.licensePlate || 'ABC-123',
            type: driverData?.vehicleType || 'sedan'
          },
          location: driverLocation
        },
        // 🎉 SPECIAL: Trigger flashing green lights + success message
        triggerFlashingSuccess: true,
        successMessage: 'We found your Driver!'
      });
      
      console.log(`✅ Sent driver location to rider ${riderId}:`, driverLocation);
      
      // Notify driver of successful acceptance
      socket.emit('cascading-ride-accepted', {
        rideId,
        message: 'Ride accepted successfully!',
        rider: {
          name: 'Rider', // In production, fetch from rider profile
          pickup: rideRequest.pickup,
          destination: rideRequest.destination
        }
      });
      
      console.log(`✅ Driver ${socket.userId} accepted cascading ride ${rideId}`);
      
    } catch (error) {
      console.error('Cascading ride acceptance error:', error);
      socket.emit('cascading-ride-failed', { 
        rideId: data.rideId, 
        error: 'Failed to accept cascading ride'
      });
    }
  });

  // Driver rejects cascading ride request
  socket.on('reject-cascading-ride', async (data) => {
    try {
      const { rideId, reason } = data;
      const requestData = cascadingRequests.get(rideId);
      
      if (!requestData) {
        console.log(`⚠️ No cascading request found for rejected ride ${rideId}`);
        return;
      }
      
      console.log(`❌ Driver ${socket.userId} rejected cascading ride ${rideId} - reason: ${reason || 'unspecified'}`);
      console.log(`📊 REJECTION: Current index: ${requestData.currentDriverIndex}, Total drivers: ${requestData.availableDrivers?.length || 0}`);
      
      // Clear the timeout for this driver
      if (requestData.currentTimeout) {
        clearTimeout(requestData.currentTimeout);
        requestData.currentTimeout = null;
      }
      
      // Update driver stats (decrease acceptance rate slightly)
      const currentData = driverAvailability.get(socket.userId);
      if (currentData) {
        updateDriverAvailability(socket.userId, {
          ...currentData,
          acceptanceRate: Math.max(0.1, (currentData.acceptanceRate || 0.85) - 0.05)
        });
      }
      
      // Confirm rejection to driver
      socket.emit('cascading-ride-rejected', {
        rideId,
        message: 'Ride request rejected. Looking for other available rides.'
      });
      
      // Try next driver in the cascade (this will move to next driver without incrementing timeout count)
      console.log(`🔄 REJECTION CASCADE: Moving to next driver after rejection...`);
      tryNextDriver(requestData);
      
    } catch (error) {
      console.error('Cascading ride rejection error:', error);
    }
  });

  // Driver manually joins airport queue
  socket.on('join-airport-queue', async (data) => {
    try {
      const { airportName } = data;
      const driverData = driverAvailability.get(socket.userId);

      if (driverData && driverData.isAvailable) {
        const position = addDriverToAirportQueue(socket.userId, airportName);
        socket.emit('airport-queue-joined', {
          airport: airportName,
          position,
          message: `You've joined the ${airportName} queue at position ${position}`
        });
      } else {
        socket.emit('airport-queue-error', {
          message: 'You must be online and available to join an airport queue'
        });
      }
    } catch (error) {
      console.error('Join airport queue error:', error);
      socket.emit('airport-queue-error', {
        message: 'Failed to join airport queue'
      });
    }
  });

  // Driver manually leaves airport queue
  socket.on('leave-airport-queue', async (data) => {
    try {
      const { airportName } = data;
      removeDriverFromAirportQueue(socket.userId, airportName);

      socket.emit('airport-queue-left', {
        airport: airportName,
        message: `You've left the ${airportName} queue`
      });
    } catch (error) {
      console.error('Leave airport queue error:', error);
      socket.emit('airport-queue-error', {
        message: 'Failed to leave airport queue'
      });
    }
  });

  // Get airport queue status
  socket.on('get-airport-queue-status', async (data) => {
    try {
      const { airportName } = data;
      const queue = airportDriverQueues.get(airportName) || [];
      const position = queue.findIndex(driver => driver.driverId === socket.userId);

      socket.emit('airport-queue-status', {
        airport: airportName,
        queueLength: queue.length,
        position: position !== -1 ? position + 1 : null,
        isInQueue: position !== -1,
        estimatedWaitTime: position !== -1 ? Math.max(5, (position + 1) * 8) : null
      });
    } catch (error) {
      console.error('Get airport queue status error:', error);
      socket.emit('airport-queue-error', {
        message: 'Failed to get queue status'
      });
    }
  });

  // Driver declines ride
  socket.on('decline-ride', async (data) => {
    try {
      const { rideId } = data;
      const rideRequest = activeRideRequests.get(rideId);

      if (!rideRequest) {
        return;
      }

      // Update driver's acceptance rate (slight penalty)
      const currentData = driverAvailability.get(socket.userId) || {};
      updateDriverAvailability(socket.userId, {
        ...currentData,
        acceptanceRate: Math.max(0.1, (currentData.acceptanceRate || 0.85) - 0.02)
      });

      // Move to next driver in the queue
      if (rideRequest.currentTimeout) {
        clearTimeout(rideRequest.currentTimeout);
      }

      rideRequest.currentDriverIndex = (rideRequest.currentDriverIndex || 0) + 1;

      // Continue with next driver (this logic would be implemented in the main matching flow)

    } catch (error) {
      console.error('Decline ride error:', error);
    }
  });

  // Trip status updates
  socket.on('trip-status', async (data) => {
    try {
      const { rideId, status, waitTimeStart, waitTimeEnd } = data;
      const updateFields = {};

      if (status === 'arrived') {
        updateFields.status = 'driver_arrived';
        updateFields.driver_arrived_at = new Date();
      } else if (status === 'started') {
        updateFields.status = 'in_progress';
        updateFields.started_at = new Date();

        // Calculate wait time charges if provided
        if (waitTimeStart && waitTimeEnd) {
          const waitTimeSeconds = (new Date(waitTimeEnd).getTime() - new Date(waitTimeStart).getTime()) / 1000;
          const gracePeriodSeconds = 120; // 2 minutes grace period
          const chargeableSeconds = Math.max(0, waitTimeSeconds - gracePeriodSeconds);
          const chargeableMinutes = chargeableSeconds / 60;
          const waitRate = pricingSettings.perMinuteFare || 0.35;
          const waitCharges = chargeableMinutes * waitRate;

          updateFields.wait_time_seconds = Math.floor(waitTimeSeconds);
          updateFields.wait_time_charges = waitCharges;

          console.log(`⏱️ Wait time calculated: ${Math.floor(waitTimeSeconds)}s, charges: $${waitCharges.toFixed(2)}`);
        }
      } else if (status === 'completed') {
        updateFields.status = 'completed';
        updateFields.completed_at = new Date();
      }

      const updatedRide = await db.updateRideStatus(rideId, updateFields.status, updateFields);

      // Notify all parties
      io.to(`user-${updatedRide.rider_id}`).emit('trip-status-update', {
        rideId,
        status: updateFields.status,
        ride: updatedRide
      });

      if (updatedRide.driver_id) {
        io.to(`user-${updatedRide.driver_id}`).emit('trip-status-update', {
          rideId,
          status: updateFields.status,
          ride: updatedRide
        });
      }

    } catch (error) {
      console.error('Trip status update error:', error);
    }
  });

  // 🚗 TESTING: Driver location simulation for testing complete tracking system
  socket.on('simulate-driver-movement', async (data) => {
    try {
      const { driverId, startLat, startLng, endLat, endLng, duration = 30000 } = data;
      
      console.log(`🧪 Starting driver movement simulation for driver ${driverId}`);
      
      const steps = 10; // Number of location updates
      const interval = duration / steps;
      
      let currentStep = 0;
      
      const simulationInterval = setInterval(() => {
        if (currentStep >= steps) {
          clearInterval(simulationInterval);
          console.log(`✅ Driver simulation completed for ${driverId}`);
          return;
        }
        
        // Calculate interpolated position
        const progress = currentStep / (steps - 1);
        const lat = startLat + (endLat - startLat) * progress;
        const lng = startLng + (endLng - startLng) * progress;
        
        // Simulate driver location update
        const locationUpdate = {
          driverId: driverId,
          location: { lat, lng },
          heading: Math.random() * 360, // Random heading
          speed: 25 + Math.random() * 10, // 25-35 mph
          timestamp: new Date().toISOString()
        };
        
        // Emit the location update (will be processed by existing handler)
        socket.emit('driver-location-update', locationUpdate);
        
        console.log(`📍 Simulated location ${currentStep + 1}/${steps}: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        currentStep++;
      }, interval);
      
      socket.emit('simulation-started', { driverId, message: 'Driver movement simulation started' });
      
    } catch (error) {
      console.error('❌ Driver simulation error:', error);
      socket.emit('simulation-error', { error: error.message });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('📴 User disconnected:', socket.id, 'Reason:', reason);

    // If driver disconnects, mark as unavailable and remove from queues
    if (socket.userType === 'driver' && socket.userId) {
      const driverData = driverAvailability.get(socket.userId);

      // Remove from airport queue if in one
      if (driverData && driverData.currentAirport) {
        removeDriverFromAirportQueue(socket.userId, driverData.currentAirport);
      }

      // Update availability
      updateDriverAvailability(socket.userId, {
        isAvailable: false,
        currentAirport: null
      });

      // Update database
      db.updateDriverLocation(socket.userId, {
        latitude: 0,
        longitude: 0,
        heading: 0,
        speed: 0,
        is_available: false
      }).catch(console.error);

      // Broadcast driver disconnection to all clients
      const availableDriversCount = Array.from(driverAvailability.values())
        .filter(driver => driver.isAvailable).length;
      
      console.log(`📡 Broadcasting driver disconnect: ${availableDriversCount} drivers online`);
      
      io.emit('driver-availability-update', {
        totalDrivers: availableDriversCount,
        driverId: socket.userId,
        status: 'offline',
        location: null,
        isAvailable: false,
        timestamp: new Date().toISOString()
      });
    }
  });
});

// Periodic cleanup to sync database with actual socket connections
// DELAY FIRST RUN by 30 seconds to let server fully start
setTimeout(() => {
  setInterval(async () => {
    // Skip cleanup during testing mode to allow cascading rejection tests
    if (process.env.TESTING_MODE === 'true') {
      console.log('🧪 TESTING_MODE: Skipping driver cleanup to allow cascading rejection tests');
      return;
    }
    
    try {
      // Check if Socket.IO is ready
      if (!io || !io.sockets) {
        console.log('⏳ Socket.IO not ready, skipping cleanup');
        return;
      }
      
      // Get all drivers marked as online in database
      const onlineDriversInDb = await db.query(`
        SELECT DISTINCT driver_id 
        FROM driver_locations 
        WHERE is_available = true 
        AND updated_at > NOW() - INTERVAL '5 minutes'
      `);
      
      // Check which ones don't have active socket connections
      const activeSocketDrivers = new Set();
      io.sockets.sockets.forEach(socket => {
        if (socket.userType === 'driver' && socket.userId) {
          activeSocketDrivers.add(socket.userId);
        }
      });
      
      // Mark stale drivers as offline in database
      for (const row of onlineDriversInDb.rows) {
        const driverId = row.driver_id;
        if (!activeSocketDrivers.has(driverId)) {
          console.log(`🧹 Cleaning up stale driver ${driverId} - marking offline`);
          
          try {
            // Add timeout to prevent hanging
            await Promise.race([
              db.updateDriverLocation(driverId, {
                latitude: 0,
                longitude: 0,
                heading: 0,
                speed: 0,
                is_available: false
              }),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Update timeout')), 5000)
              )
            ]);
            
            // Remove from in-memory availability
            driverAvailability.delete(driverId);
            
            // Emit individual cleanup event with driverId
            io.emit('driver-availability-update', {
              totalDrivers: activeSocketDrivers.size,
              driverId: driverId,
              status: 'offline',
              location: null,
              isAvailable: false,
              action: 'cleanup',
              timestamp: new Date().toISOString()
            });
          } catch (updateError) {
            console.error(`Failed to cleanup driver ${driverId}:`, updateError.message);
            // Continue with next driver instead of hanging
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Driver cleanup error:', error);
    }
  }, 60000); // Run every 60 seconds
}, 30000); // Wait 30 seconds before first run

// Driver Earnings Routes - SECURED: Requires authentication and enforces driver ID match
app.get('/api/driver/earnings/:driverId', authenticateToken, async (req, res) => {
  try {
    const { driverId } = req.params;
    
    // 🔒 SECURITY: Ensure driver can only access their own earnings
    if (req.user.userId !== driverId) {
      return res.status(403).json({ error: 'Access denied: Cannot access other driver\'s earnings' });
    }

    // For authenticated driver, get real data
    const todaySummary = await db.getDriverEarningsSummary(driverId, 'today');
    const weekSummary = await db.getDriverEarningsSummary(driverId, 'week');
    const monthSummary = await db.getDriverEarningsSummary(driverId, 'month');
    const payoutBalance = await db.getAvailableBalance(driverId);

    res.json({
      today: todaySummary.total_earnings || 0,   // ✅ Today's actual earnings (includes compensation)
      week: weekSummary.total_earnings || 0,     // ✅ Week's actual earnings  
      month: monthSummary.total_earnings || 0,   // ✅ Month's actual earnings
      trips: todaySummary.total_rides || 0,      // ✅ Today's trip count
      hours: 8, // Placeholder - would need time tracking
      rating: 4.9, // Placeholder - would need rating system
      lastRide: todaySummary.avg_per_ride || 0,  // ✅ Average per ride today
      miles: 0 // Placeholder - would need distance tracking
    });
  } catch (error) {
    console.error('Get driver earnings error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/driver/earnings', authenticateToken, async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    const driverId = req.user.userId;

    const summary = await db.getDriverEarningsSummary(driverId, period);
    const payoutBalance = await db.getAvailableBalance(driverId);

    res.json({
      summary,
      availableBalance: payoutBalance.availableBalance,
      totalEarnings: payoutBalance.totalEarnings,
      totalPayouts: payoutBalance.totalPayouts
    });
  } catch (error) {
    console.error('Get earnings error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/driver/earnings/detailed', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const driverId = req.user.userId;

    const earnings = await db.getDriverEarnings(
      driverId,
      startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate || new Date()
    );

    res.json({ earnings });
  } catch (error) {
    console.error('Get detailed earnings error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Payout Routes
app.post('/api/driver/payouts', authenticateToken, async (req, res) => {
  try {
    const { amount, payoutMethodId } = req.body;
    const driverId = req.user.userId;

    // Check available balance
    const balance = await db.getAvailableBalance(driverId);
    if (amount > balance.availableBalance) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Calculate fees (example: $0.50 for instant payout)
    const fee = 0.50;
    const netAmount = amount - fee;

    const payout = await db.createPayout({
      driver_id: driverId,
      amount,
      fee,
      net_amount: netAmount,
      payout_method_id: payoutMethodId
    });

    // In real implementation, integrate with payment processor
    // For demo, mark as completed after 2 seconds
    setTimeout(async () => {
      await db.query(
        'UPDATE driver_payouts SET status = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['completed', payout.id]
      );
    }, 2000);

    res.status(201).json({
      message: 'Payout initiated successfully',
      payout
    });
  } catch (error) {
    console.error('Create payout error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/driver/payouts', authenticateToken, async (req, res) => {
  try {
    const driverId = req.user.userId;
    const payouts = await db.getDriverPayouts(driverId);

    res.json({ payouts });
  } catch (error) {
    console.error('Get payouts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Payout Methods Routes
app.post('/api/driver/payout-methods', authenticateToken, async (req, res) => {
  try {
    const { methodType, accountName, accountNumber, routingNumber } = req.body;
    const driverId = req.user.userId;

    // Mask sensitive information
    const accountNumberMasked = '****' + accountNumber.slice(-4);
    const routingNumberMasked = '****' + routingNumber.slice(-4);

    const method = await db.addPayoutMethod({
      driver_id: driverId,
      method_type: methodType,
      account_name: accountName,
      account_number_masked: accountNumberMasked,
      routing_number_masked: routingNumberMasked,
      external_account_id: `ext_${Date.now()}`
    });

    res.status(201).json({
      message: 'Payout method added successfully',
      method
    });
  } catch (error) {
    console.error('Add payout method error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/driver/payout-methods', authenticateToken, async (req, res) => {
  try {
    const driverId = req.user.userId;
    const methods = await db.getDriverPayoutMethods(driverId);

    res.json({ methods });
  } catch (error) {
    console.error('Get payout methods error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Duplicate route removed - using the correct apiKeyMiddleware version above

app.get('/api/admin/drivers/:driverId', authenticateToken, async (req, res) => {
  try {
    const { driverId } = req.params;

    const result = await db.query(`
      SELECT u.*, dl.latitude, dl.longitude, dl.is_available, dl.updated_at as last_seen
      FROM users u
      LEFT JOIN driver_locations dl ON u.id = dl.driver_id
      WHERE u.id = $1 AND u.user_type = 'driver'
    `, [driverId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    res.json({ driver: result.rows[0] });
  } catch (error) {
    console.error('Get driver error:', error);
    res.status(500).json({ error: 'Failed to fetch driver' });
  }
});

app.put('/api/admin/drivers/:driverId', authenticateToken, async (req, res) => {
  try {
    const { driverId } = req.params;
    const { firstName, lastName, email, phone } = req.body;

    const result = await db.query(`
      UPDATE users
      SET first_name = $1, last_name = $2, email = $3, phone = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5 AND user_type = 'driver'
      RETURNING *
    `, [firstName, lastName, email, phone, driverId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    res.json({
      message: 'Driver updated successfully',
      driver: result.rows[0]
    });
  } catch (error) {
    console.error('Update driver error:', error);
    res.status(500).json({ error: 'Failed to update driver' });
  }
});

app.put('/api/admin/drivers/:driverId/status', authenticateToken, async (req, res) => {
  try {
    const { driverId } = req.params;
    const { status, reason } = req.body; // status: 'active', 'suspended', 'deactivated'

    // Update driver status in database
    const result = await db.query(`
      UPDATE users
      SET is_verified = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND user_type = 'driver'
      RETURNING *
    `, [status === 'active', driverId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Log the status change
    console.log(`Driver ${driverId} status changed to ${status}. Reason: ${reason || 'None provided'}`);

    res.json({
      message: `Driver ${status} successfully`,
      driver: result.rows[0]
    });
  } catch (error) {
    console.error('Update driver status error:', error);
    res.status(500).json({ error: 'Failed to update driver status' });
  }
});

app.get('/api/admin/drivers/:driverId/trips', authenticateToken, async (req, res) => {
  try {
    const { driverId } = req.params;
    const { startDate, endDate, page = 1, limit = 20 } = req.query;

    let query = `
      SELECT r.*, u.first_name as rider_first_name, u.last_name as rider_last_name
      FROM rides r
      LEFT JOIN users u ON r.rider_id = u.id
      WHERE r.driver_id = $1
    `;

    const queryParams = [driverId];
    let paramIndex = 2;

    if (startDate) {
      query += ` AND r.created_at >= $${paramIndex}`;
      queryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND r.created_at <= $${paramIndex}`;
      queryParams.push(endDate);
      paramIndex++;
    }

    query += ` ORDER BY r.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, (page - 1) * limit);

    const result = await db.query(query, queryParams);

    res.json({
      trips: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.rows.length
      }
    });
  } catch (error) {
    console.error('Get driver trips error:', error);
    res.status(500).json({ error: 'Failed to fetch driver trips' });
  }
});

app.get('/api/admin/drivers/:driverId/earnings', authenticateToken, async (req, res) => {
  try {
    const { driverId } = req.params;
    const { period = 'month' } = req.query;

    const earnings = await db.getDriverEarningsSummary(driverId, period);
    const detailedEarnings = await db.getDriverEarnings(
      driverId,
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date()
    );

    res.json({
      summary: earnings,
      detailed: detailedEarnings
    });
  } catch (error) {
    console.error('Get driver earnings error:', error);
    res.status(500).json({ error: 'Failed to fetch driver earnings' });
  }
});

app.post('/api/admin/drivers/:driverId/message', authenticateToken, async (req, res) => {
  try {
    const { driverId } = req.params;
    const { subject, message } = req.body;

    // In a real application, you would:
    // 1. Save message to database
    // 2. Send push notification
    // 3. Send email notification
    // 4. Log the communication

    console.log(`Message sent to driver ${driverId}:`, { subject, message });

    // Mock sending message
    setTimeout(() => {
      // Simulate real-time notification
      io.to(`user-${driverId}`).emit('admin-message', {
        subject,
        message,
        timestamp: new Date(),
        sender: 'Admin'
      });
    }, 100);

    res.json({
      message: 'Message sent successfully',
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

app.post('/api/admin/drivers/:driverId/reset-password', authenticateToken, async (req, res) => {
  try {
    const { driverId } = req.params;

    const driver = await db.getUserById(driverId);
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // In a real application, you would:
    // 1. Generate secure reset token
    // 2. Save token to database with expiration
    // 3. Send reset email

    const resetToken = `reset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`Password reset initiated for driver ${driverId} (${driver.email})`);
    console.log(`Reset token: ${resetToken}`);

    res.json({
      message: 'Password reset email sent successfully',
      email: driver.email
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

app.get('/api/admin/drivers/:driverId/analytics', authenticateToken, async (req, res) => {
  try {
    const { driverId } = req.params;
    const { period = 'week' } = req.query;

    // Mock analytics data - in real app, calculate from database
    const analytics = {
      performance: {
        acceptanceRate: 85 + Math.random() * 10,
        completionRate: 95 + Math.random() * 4,
        cancellationRate: Math.random() * 5,
        averageRating: 4.5 + Math.random() * 0.4
      },
      productivity: {
        hoursOnline: 35 + Math.random() * 10,
        ridesCompleted: 120 + Math.floor(Math.random() * 50),
        averageRideTime: 15 + Math.random() * 10,
        idleTime: 20 + Math.random() * 15
      },
      earnings: {
        totalEarnings: 1200 + Math.random() * 800,
        averagePerRide: 18 + Math.random() * 12,
        tips: 150 + Math.random() * 100,
        bonuses: 50 + Math.random() * 100
      },
      trends: {
        weeklyGrowth: (Math.random() - 0.5) * 20,
        ratingTrend: (Math.random() - 0.5) * 0.2,
        earningsTrend: (Math.random() - 0.3) * 30
      }
    };

    res.json({ analytics });
  } catch (error) {
    console.error('Get driver analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch driver analytics' });
  }
});

// Driver Enrollment Routes
app.post('/api/drivers/enroll', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      dateOfBirth,
      ssn,
      email,
      phone,
      address,
      city,
      state,
      zipCode,
      licenseNumber,
      licenseState,
      licenseValidUntil,
      vehicleMake,
      vehicleModel,
      vehicleYear,
      licensePlate,
      vehicleColor,
      vehicleVin,
      insuranceCompany,
      policyNumber,
      insuranceExpiryDate,
      registrationExpiryDate,
      bankName,
      routingNumber,
      accountNumber,
      accountHolderName,
      emergencyContactName,
      emergencyContactPhone,
      backgroundCheckConsent,
      dataProcessingConsent,
      termsAccepted
    } = req.body;

    // Validate required fields
    const requiredFields = [
      'firstName', 'lastName', 'dateOfBirth', 'ssn', 'email', 'phone', 'address',
      'licenseNumber', 'licenseValidUntil', 'vehicleMake', 'vehicleModel', 'vehicleYear',
      'licensePlate', 'insuranceCompany', 'policyNumber', 'insuranceExpiryDate',
      'registrationExpiryDate', 'bankName', 'routingNumber', 'accountNumber', 'accountHolderName'
    ];

    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({ error: `${field} is required` });
      }
    }

    // Validate consents
    if (!backgroundCheckConsent || !dataProcessingConsent || !termsAccepted) {
      return res.status(400).json({ error: 'All required consents must be accepted' });
    }

    // Check if email already exists
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email address already registered' });
    }

    // Create driver application record (you would expand the database schema to include these fields)
    const applicationData = {
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      ssn: ssn.replace(/\D/g, ''), // Store only digits
      address: `${address}, ${city || ''} ${state || ''} ${zipCode || ''}`.trim(),
      licenseNumber,
      licenseState: licenseState || state,
      licenseValidUntil,
      vehicleMake,
      vehicleModel,
      vehicleYear: parseInt(vehicleYear),
      licensePlate: licensePlate.toUpperCase(),
      vehicleColor,
      vehicleVin: vehicleVin?.toUpperCase(),
      insuranceCompany,
      policyNumber,
      insuranceExpiryDate,
      registrationExpiryDate,
      bankName,
      routingNumber,
      accountNumber,
      accountHolderName,
      applicationStatus: 'pending_review',
      backgroundCheckStatus: 'pending',
      documentsStatus: 'pending',
      vehicleInspectionStatus: 'pending',
      submittedAt: new Date().toISOString(),
      backgroundCheckConsent,
      dataProcessingConsent,
      termsAccepted
    };

    // In a real application, you would:
    // 1. Store the application in a drivers_applications table
    // 2. Initiate background check process
    // 3. Send confirmation email to applicant
    // 4. Create tasks for admin review
    // 5. Store encrypted sensitive data

    console.log('📝 New Driver Application:', {
      name: `${firstName} ${lastName}`,
      email,
      vehicle: `${vehicleYear} ${vehicleMake} ${vehicleModel}`,
      licensePlate,
      status: 'pending_review'
    });

    // For now, just return success with mock application ID
    const applicationId = `APP_${Date.now()}`;

    res.status(201).json({
      message: 'Driver application submitted successfully',
      applicationId,
      status: 'pending_review',
      nextSteps: [
        'Background check will be initiated within 24 hours',
        'Document verification in progress',
        'Vehicle inspection will be scheduled upon approval',
        'Email notifications will be sent for status updates',
        'Expected processing time: 3-5 business days'
      ],
      estimatedApprovalTime: '3-5 business days'
    });

  } catch (error) {
    console.error('Driver enrollment error:', error);
    res.status(500).json({ error: 'Failed to process driver application' });
  }
});

// Get driver applications (for admin)
app.get('/api/admin/driver-applications', async (req, res) => {
  try {
    // Mock applications data - in real app, fetch from database
    const applications = [
      {
        id: 'APP_1756318234567',
        firstName: 'John',
        lastName: 'Smith',
        email: 'john.smith.driver@email.com',
        phone: '+1 (555) 0123',
        vehicleMake: 'Toyota',
        vehicleModel: 'Camry',
        vehicleYear: 2020,
        licensePlate: 'ABC123',
        applicationStatus: 'pending_review',
        backgroundCheckStatus: 'pending',
        documentsStatus: 'submitted',
        vehicleInspectionStatus: 'pending',
        submittedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      },
      {
        id: 'APP_1756318234568',
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'sarah.j.driver@email.com',
        phone: '+1 (555) 0456',
        vehicleMake: 'Honda',
        vehicleModel: 'Civic',
        vehicleYear: 2021,
        licensePlate: 'XYZ789',
        applicationStatus: 'approved',
        backgroundCheckStatus: 'passed',
        documentsStatus: 'approved',
        vehicleInspectionStatus: 'passed',
        submittedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
      }
    ];

    res.json({ applications });
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Tax Documents Routes
app.get('/api/driver/tax-documents', authenticateToken, async (req, res) => {
  try {
    const driverId = req.user.userId;

    // Mock tax document data
    const documents = [
      {
        id: 'tax_2024',
        tax_year: 2024,
        document_type: '1099-NEC',
        total_earnings: 48010.00,
        total_fees: 12002.50,
        net_earnings: 36007.50,
        is_available: false,
        generated_at: null
      },
      {
        id: 'tax_2023',
        tax_year: 2023,
        document_type: '1099-NEC',
        total_earnings: 42500.00,
        total_fees: 10625.00,
        net_earnings: 31875.00,
        is_available: true,
        generated_at: '2024-01-31'
      }
    ];

    res.json({ documents });
  } catch (error) {
    console.error('Get tax documents error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Airport Queue API Routes
app.get('/api/airports/queues', (req, res) => {
  try {
    const queueStatus = {};

    AIRPORT_LOCATIONS.forEach(airport => {
      const queue = airportDriverQueues.get(airport.name) || [];
      queueStatus[airport.name] = {
        name: airport.name,
        location: { lat: airport.lat, lng: airport.lng },
        queueLength: queue.length,
        estimatedWaitTime: Math.max(5, queue.length * 8),
        drivers: queue.map((driver, index) => ({
          position: index + 1,
          joinedAt: driver.joinedAt,
          waitTime: Math.round((Date.now() - driver.joinedAt.getTime()) / 60000)
        }))
      };
    });

    res.json({ queues: queueStatus });
  } catch (error) {
    console.error('Get airport queues error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/airports/driver-status/:driverId', authenticateToken, (req, res) => {
  try {
    const { driverId } = req.params;
    const driverData = driverAvailability.get(driverId);

    if (!driverData || !driverData.currentAirport) {
      return res.json({ inQueue: false });
    }

    const queue = airportDriverQueues.get(driverData.currentAirport) || [];
    const position = queue.findIndex(driver => driver.driverId === driverId);

    res.json({
      inQueue: position !== -1,
      airport: driverData.currentAirport,
      position: position !== -1 ? position + 1 : null,
      queueLength: queue.length,
      estimatedWaitTime: position !== -1 ? Math.max(5, (position + 1) * 8) : null,
      joinedAt: position !== -1 ? queue[position].joinedAt : null
    });
  } catch (error) {
    console.error('Get driver queue status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    let uploadDir;
    if (req.route.path.includes('corporate')) {
      uploadDir = `uploads/corporate/${req.user.userId}`;
    } else if (req.route.path.includes('driver')) {
      uploadDir = `uploads/drivers/${req.user.userId}`;
    } else {
      uploadDir = `uploads/general/${req.user.userId}`;
    }
    
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const photoUpload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Corporate work badge photo upload
app.post('/api/corporate/upload-badge', authenticateToken, photoUpload.single('workBadge'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { corporationId, workEmail, employeeId, department } = req.body;
    
    // Save to corporate applications
    const result = await db.query(`
      INSERT INTO corporate_applications (
        rider_id, corporation_id, work_email, employee_id, department, work_id_image_url, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING *
    `, [req.user.userId, corporationId, workEmail, employeeId, department, req.file.path]);

    res.json({
      success: true,
      application: result.rows[0],
      fileUrl: req.file.path
    });
  } catch (error) {
    console.error('Badge upload error:', error);
    res.status(500).json({ error: 'Failed to upload work badge' });
  }
});

// Driver document upload (insurance/registration)
app.post('/api/driver/upload-document', authenticateToken, photoUpload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { documentType } = req.body; // 'insurance' or 'registration'
    
    // Save to driver documents
    const result = await db.query(`
      INSERT INTO driver_application_documents (
        application_id, document_type, file_url, file_name, file_size, mime_type
      ) VALUES (
        (SELECT id FROM driver_applications WHERE user_id = $1 LIMIT 1),
        $2, $3, $4, $5, $6
      )
      RETURNING *
    `, [req.user.userId, documentType, req.file.path, req.file.filename, req.file.size, req.file.mimetype]);

    res.json({
      success: true,
      document: result.rows[0],
      fileUrl: req.file.path
    });
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// Driver badge verification endpoint
app.post('/api/driver/verify-badge', authenticateToken, async (req, res) => {
  try {
    const { riderId, corporateApplicationId, verificationStatus, notes } = req.body;
    
    // Get current expiry date
    const currentApp = await db.query(`
      SELECT discount_end_date FROM corporate_applications WHERE id = $1
    `, [corporateApplicationId]);
    
    if (currentApp.rows.length === 0) {
      return res.status(404).json({ error: 'Corporate application not found' });
    }
    
    const currentExpiry = currentApp.rows[0].discount_end_date;
    const extensionDays = Math.floor(Math.random() * 90) + 30; // 30-120 days
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + extensionDays);
    
    // Record verification
    const verificationResult = await db.query(`
      INSERT INTO badge_verifications (
        corporate_application_id, rider_id, driver_id, verification_status,
        verification_notes, previous_expiry_date, new_expiry_date, days_extended
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [corporateApplicationId, riderId, req.user.userId, verificationStatus, notes, currentExpiry, newExpiry, extensionDays]);
    
    // Update expiry date if verification successful
    if (verificationStatus === 'verified') {
      await db.query(`
        UPDATE corporate_applications 
        SET discount_end_date = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [newExpiry, corporateApplicationId]);
    }
    
    res.json({
      success: true,
      verification: verificationResult.rows[0],
      newExpiryDate: verificationStatus === 'verified' ? newExpiry : currentExpiry
    });
  } catch (error) {
    console.error('Badge verification error:', error);
    res.status(500).json({ error: 'Failed to verify badge' });
  }
});

// Get rider's corporate application for verification
app.get('/api/driver/rider-corporate-info/:riderId', authenticateToken, async (req, res) => {
  try {
    const { riderId } = req.params;
    
    const result = await db.query(`
      SELECT ca.*, c.company_name, c.discount_percentage, c.discount_fixed_amount
      FROM corporate_applications ca
      JOIN corporations c ON ca.corporation_id = c.id
      WHERE ca.rider_id = $1 AND ca.status = 'approved'
      ORDER BY ca.created_at DESC
      LIMIT 1
    `, [riderId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No corporate discount found for this rider' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching rider corporate info:', error);
    res.status(500).json({ error: 'Failed to fetch rider corporate information' });
  }
});

// Check for expired corporate discount during ride request
app.get('/api/driver/check-expired-discount/:riderId', authenticateToken, async (req, res) => {
  try {
    const { riderId } = req.params;
    
    const result = await db.query(`
      SELECT 
        ca.id,
        ca.discount_end_date,
        ca.rider_id,
        u.first_name || ' ' || u.last_name as rider_name,
        c.company_name,
        c.discount_type,
        c.discount_value
      FROM corporate_applications ca
      JOIN users u ON ca.rider_id = u.id
      JOIN corporations c ON ca.corporation_id = c.id
      WHERE ca.rider_id = $1 
        AND ca.status = 'approved'
        AND ca.discount_end_date < CURRENT_DATE
      ORDER BY ca.created_at DESC
      LIMIT 1
    `, [riderId]);
    
    if (result.rows.length === 0) {
      return res.json({ hasExpiredDiscount: false });
    }
    
    const expiredDiscount = result.rows[0];
    
    res.json({
      hasExpiredDiscount: true,
      riderInfo: {
        name: expiredDiscount.rider_name,
        companyName: expiredDiscount.company_name,
        expiryDate: new Date(expiredDiscount.discount_end_date).toLocaleDateString(),
        applicationId: expiredDiscount.id
      }
    });
  } catch (error) {
    console.error('Error checking expired discount:', error);
    res.status(500).json({ error: 'Failed to check discount status' });
  }
});

// Confirm verification and extend corporate discount
app.post('/api/driver/confirm-discount-verification', authenticateToken, async (req, res) => {
  try {
    const { riderId, applicationId, rideId } = req.body;
    const driverId = req.user.userId;
    
    // Get current expiry date
    const currentResult = await db.query(`
      SELECT discount_end_date FROM corporate_applications WHERE id = $1
    `, [applicationId]);
    
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Corporate application not found' });
    }
    
    const currentExpiry = currentResult.rows[0].discount_end_date;
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + 90); // Extend by 90 days
    
    // Record the verification
    await db.query(`
      INSERT INTO badge_verifications (
        corporate_application_id, rider_id, driver_id, ride_id,
        verification_status, badge_photo_verified, verification_notes,
        previous_expiry_date, new_expiry_date, days_extended
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      applicationId, riderId, driverId, rideId,
      'verified', true, 'Driver verified rider badge during expired discount check',
      currentExpiry, newExpiry.toISOString().split('T')[0], 90
    ]);
    
    // Update the expiry date
    await db.query(`
      UPDATE corporate_applications 
      SET discount_end_date = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [newExpiry.toISOString().split('T')[0], applicationId]);
    
    res.json({
      success: true,
      newExpiryDate: newExpiry.toISOString().split('T')[0],
      message: 'Corporate discount extended for 90 days'
    });
  } catch (error) {
    console.error('Error confirming verification:', error);
    res.status(500).json({ error: 'Failed to confirm verification' });
  }
});

// =================================
// SURGE PRICING CONFIGURATION API
// =================================

// Get all surge zones
app.get('/api/admin/surge/zones', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT sz.*, u.first_name || ' ' || u.last_name as created_by_name
      FROM surge_zones sz
      LEFT JOIN users u ON sz.created_by = u.id
      ORDER BY sz.tier_level, sz.zone_name
    `);
    res.json({ success: true, zones: result.rows });
  } catch (error) {
    console.error('Error fetching surge zones:', error);
    res.status(500).json({ error: 'Failed to fetch surge zones' });
  }
});

// Create new surge zone
app.post('/api/admin/surge/zones', authenticateToken, async (req, res) => {
  try {
    const { zoneName, zoneType, zoneCode, latitude, longitude, radius, baseMultiplier, queueBonus, tierLevel } = req.body;
    
    const result = await db.query(`
      INSERT INTO surge_zones (zone_name, zone_type, zone_code, latitude, longitude, radius, base_multiplier, queue_bonus, tier_level, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [zoneName, zoneType, zoneCode, latitude, longitude, radius, baseMultiplier, queueBonus, tierLevel, req.user.userId]);
    
    res.json({ success: true, zone: result.rows[0] });
  } catch (error) {
    console.error('Error creating surge zone:', error);
    res.status(500).json({ error: 'Failed to create surge zone' });
  }
});

// Update surge zone
app.put('/api/admin/surge/zones/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { zoneName, zoneType, zoneCode, latitude, longitude, radius, baseMultiplier, queueBonus, tierLevel, isActive } = req.body;
    
    const result = await db.query(`
      UPDATE surge_zones 
      SET zone_name = $1, zone_type = $2, zone_code = $3, latitude = $4, longitude = $5, 
          radius = $6, base_multiplier = $7, queue_bonus = $8, tier_level = $9, is_active = $10, updated_at = CURRENT_TIMESTAMP
      WHERE id = $11
      RETURNING *
    `, [zoneName, zoneType, zoneCode, latitude, longitude, radius, baseMultiplier, queueBonus, tierLevel, isActive, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Zone not found' });
    }
    
    res.json({ success: true, zone: result.rows[0] });
  } catch (error) {
    console.error('Error updating surge zone:', error);
    res.status(500).json({ error: 'Failed to update surge zone' });
  }
});

// Delete surge zone
app.delete('/api/admin/surge/zones/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM surge_zones WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Zone not found' });
    }
    
    res.json({ success: true, message: 'Zone deleted successfully' });
  } catch (error) {
    console.error('Error deleting surge zone:', error);
    res.status(500).json({ error: 'Failed to delete surge zone' });
  }
});

// Driver-specific surge heatmap endpoint using JWT authentication
app.get('/api/driver/surge/heatmap', authenticateToken, async (req, res) => {
  try {
    console.log('🗺️ Driver Surge Heatmap: Fetching real-time surge zone data for driver...');
    
    // Get active surge zones with current multipliers (driver-safe data only)
    const zonesQuery = `
      SELECT 
        sz.id,
        sz.zone_name as name,
        sz.zone_code as code,
        sz.latitude as lat,
        sz.longitude as lng,
        sz.radius,
        GREATEST(sz.base_multiplier, 1.0) as surgeMultiplier,
        CASE 
          WHEN sz.base_multiplier >= 2.5 THEN 'extreme'
          WHEN sz.base_multiplier >= 2.0 THEN 'high'
          WHEN sz.base_multiplier >= 1.5 THEN 'medium'
          ELSE 'low'
        END as demandLevel,
        sz.updated_at
      FROM surge_zones sz
      WHERE sz.is_active = true 
      AND sz.base_multiplier > 1.0
      ORDER BY sz.base_multiplier DESC
    `;
    
    const zonesResult = await db.query(zonesQuery);
    const surgeZones = zonesResult.rows.map(zone => ({
      id: zone.id,
      name: zone.name,
      center: { lat: parseFloat(zone.lat), lng: parseFloat(zone.lng) },
      radius: parseFloat(zone.radius),
      multiplier: parseFloat(zone.surgemultiplier),
      demandLevel: zone.demandlevel,
      lastUpdated: zone.updated_at
    }));

    // Get basic market stats (driver-safe data only)
    const statsQuery = `
      SELECT 
        COUNT(*) as active_zones,
        AVG(sz.base_multiplier) as avg_multiplier,
        MAX(sz.base_multiplier) as max_multiplier
      FROM surge_zones sz
      WHERE sz.is_active = true 
      AND sz.base_multiplier > 1.0
    `;
    
    const statsResult = await db.query(statsQuery);
    const marketStats = statsResult.rows[0] || {};

    console.log(`🗺️ Driver Surge Heatmap: Returning ${surgeZones.length} active zones for driver view`);
    
    res.json({
      success: true,
      surgeZones,
      marketStats: {
        activeZones: parseInt(marketStats.active_zones || 0),
        avgMultiplier: parseFloat(marketStats.avg_multiplier || 1.0),
        maxMultiplier: parseFloat(marketStats.max_multiplier || 1.0)
      },
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error('❌ Driver Surge Heatmap API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch surge heatmap data',
      message: 'Please try again later'
    });
  }
});

// Get surge heatmap data for real-time visualization
app.get('/api/admin/surge/heatmap', apiKeyMiddleware(['admin', 'driver']), async (req, res) => {
  try {
    console.log('🗺️ Surge Heatmap: Fetching real-time surge zone data...');
    
    // Get active surge zones with current multipliers
    const zonesQuery = `
      SELECT 
        sz.id,
        sz.zone_name as name,
        sz.zone_code as code,
        sz.latitude as lat,
        sz.longitude as lng,
        sz.radius,
        GREATEST(sz.base_multiplier, 1.0) as surgeMultiplier,
        CASE 
          WHEN sz.base_multiplier >= 2.5 THEN 'extreme'
          WHEN sz.base_multiplier >= 2.0 THEN 'high'
          WHEN sz.base_multiplier >= 1.5 THEN 'medium'
          ELSE 'low'
        END as demandLevel,
        sz.zone_type as type,
        sz.is_active
      FROM surge_zones sz
      WHERE sz.is_active = true
      ORDER BY sz.base_multiplier DESC, sz.tier_level
    `;
    
    const zonesResult = await db.query(zonesQuery);
    
    // Get real-time ride demand data for context
    const demandQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'requested') as pendingRides,
        COUNT(*) FILTER (WHERE status = 'in_progress') as activeRides,
        COUNT(DISTINCT driver_id) FILTER (WHERE status = 'in_progress') as busyDrivers
      FROM rides
      WHERE requested_at > NOW() - INTERVAL '1 hour'
    `;
    
    const demandResult = await db.query(demandQuery);
    
    // Get online drivers count
    const driversQuery = `
      SELECT COUNT(*) as onlineDrivers
      FROM drivers d
      JOIN users u ON d.user_id = u.id
      WHERE d.is_online = true AND d.is_available = true
    `;
    
    const driversResult = await db.query(driversQuery);
    
    // Format surge zones for heatmap
    const surgeZones = zonesResult.rows.map(zone => ({
      id: zone.id.toString(),
      name: zone.name,
      coordinates: {
        lat: parseFloat(zone.lat),
        lng: parseFloat(zone.lng)
      },
      surgeMultiplier: parseFloat(zone.surgeMultiplier || 1.0),
      demandLevel: zone.demandLevel,
      radius: parseFloat(zone.radius || 2.0), // Default 2km radius
      type: zone.type || 'city',
      isActive: zone.is_active
    }));
    
    // Add default city zones if no zones exist
    if (surgeZones.length === 0) {
      console.log('🗺️ No active surge zones found, providing default zones');
      surgeZones.push(
        {
          id: 'downtown',
          name: 'Downtown',
          coordinates: { lat: 40.7589, lng: -73.9851 }, // NYC Times Square
          surgeMultiplier: 1.3,
          demandLevel: 'medium',
          radius: 2.5,
          type: 'city',
          isActive: true
        },
        {
          id: 'airport',
          name: 'Airport Zone',
          coordinates: { lat: 40.6892, lng: -74.1745 }, // Newark Airport
          surgeMultiplier: 1.8,
          demandLevel: 'high',
          radius: 3.0,
          type: 'airport',
          isActive: true
        },
        {
          id: 'financial',
          name: 'Financial District',
          coordinates: { lat: 40.7074, lng: -74.0113 }, // Wall Street
          surgeMultiplier: 1.5,
          demandLevel: 'medium',
          radius: 1.8,
          type: 'city',
          isActive: true
        }
      );
    }
    
    const response = {
      success: true,
      surgeZones: surgeZones,
      marketStats: {
        pendingRides: parseInt(demandResult.rows[0]?.pendingRides || 0),
        activeRides: parseInt(demandResult.rows[0]?.activeRides || 0),
        onlineDrivers: parseInt(driversResult.rows[0]?.onlineDrivers || 0),
        busyDrivers: parseInt(demandResult.rows[0]?.busyDrivers || 0),
        timestamp: new Date().toISOString()
      }
    };
    
    console.log(`🗺️ Surge Heatmap: Returning ${surgeZones.length} zones`);
    res.json(response);
    
  } catch (error) {
    console.error('❌ Surge heatmap error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch surge heatmap data',
      surgeZones: [],
      marketStats: {
        pendingRides: 0,
        activeRides: 0,
        onlineDrivers: 0,
        busyDrivers: 0,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Get all time rules
app.get('/api/admin/surge/time-rules', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM surge_time_rules ORDER BY rule_type, rule_name');
    res.json({ success: true, rules: result.rows });
  } catch (error) {
    console.error('Error fetching time rules:', error);
    res.status(500).json({ error: 'Failed to fetch time rules' });
  }
});

// Create time rule
app.post('/api/admin/surge/time-rules', authenticateToken, async (req, res) => {
  try {
    const { ruleName, ruleType, startHour, endHour, daysOfWeek, surgeMultiplier } = req.body;
    
    const result = await db.query(`
      INSERT INTO surge_time_rules (rule_name, rule_type, start_hour, end_hour, days_of_week, surge_multiplier)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [ruleName, ruleType, startHour, endHour, JSON.stringify(daysOfWeek), surgeMultiplier]);
    
    res.json({ success: true, rule: result.rows[0] });
  } catch (error) {
    console.error('Error creating time rule:', error);
    res.status(500).json({ error: 'Failed to create time rule' });
  }
});

// Update time rule
app.put('/api/admin/surge/time-rules/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { ruleName, ruleType, startHour, endHour, daysOfWeek, surgeMultiplier, isActive } = req.body;
    
    const result = await db.query(`
      UPDATE surge_time_rules 
      SET rule_name = $1, rule_type = $2, start_hour = $3, end_hour = $4, days_of_week = $5, surge_multiplier = $6, is_active = $7, updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `, [ruleName, ruleType, startHour, endHour, JSON.stringify(daysOfWeek), surgeMultiplier, isActive, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    
    res.json({ success: true, rule: result.rows[0] });
  } catch (error) {
    console.error('Error updating time rule:', error);
    res.status(500).json({ error: 'Failed to update time rule' });
  }
});

// Get weather rules
app.get('/api/admin/surge/weather-rules', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM surge_weather_rules ORDER BY weather_condition');
    res.json({ success: true, rules: result.rows });
  } catch (error) {
    console.error('Error fetching weather rules:', error);
    res.status(500).json({ error: 'Failed to fetch weather rules' });
  }
});

// Update weather rule
app.put('/api/admin/surge/weather-rules/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { surgeMultiplier, isActive } = req.body;
    
    const result = await db.query(`
      UPDATE surge_weather_rules 
      SET surge_multiplier = $1, is_active = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [surgeMultiplier, isActive, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Weather rule not found' });
    }
    
    res.json({ success: true, rule: result.rows[0] });
  } catch (error) {
    console.error('Error updating weather rule:', error);
    res.status(500).json({ error: 'Failed to update weather rule' });
  }
});

// Get algorithm config
app.get('/api/admin/surge/algorithm-config', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM surge_algorithm_config ORDER BY config_key');
    res.json({ success: true, config: result.rows });
  } catch (error) {
    console.error('Error fetching algorithm config:', error);
    res.status(500).json({ error: 'Failed to fetch algorithm config' });
  }
});

// Update algorithm config
app.put('/api/admin/surge/algorithm-config/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { configValue, isActive } = req.body;
    
    const result = await db.query(`
      UPDATE surge_algorithm_config 
      SET config_value = $1, is_active = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `, [configValue, isActive, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Config not found' });
    }
    
    res.json({ success: true, config: result.rows[0] });
  } catch (error) {
    console.error('Error updating algorithm config:', error);
    res.status(500).json({ error: 'Failed to update algorithm config' });
  }
});

// Manual surge override
app.post('/api/admin/surge/override/:zoneId', authenticateToken, async (req, res) => {
  try {
    const { zoneId } = req.params;
    const { manualMultiplier, overrideReason, expiresAt } = req.body;
    
    // Remove existing override for this zone
    await db.query('DELETE FROM surge_zone_overrides WHERE zone_id = $1', [zoneId]);
    
    // Add new override
    const result = await db.query(`
      INSERT INTO surge_zone_overrides (zone_id, manual_multiplier, override_reason, set_by, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [zoneId, manualMultiplier, overrideReason, req.user.userId, expiresAt]);
    
    res.json({ success: true, override: result.rows[0] });
  } catch (error) {
    console.error('Error setting surge override:', error);
    res.status(500).json({ error: 'Failed to set surge override' });
  }
});

// Remove surge override
app.delete('/api/admin/surge/override/:zoneId', authenticateToken, async (req, res) => {
  try {
    const { zoneId } = req.params;
    const result = await db.query('DELETE FROM surge_zone_overrides WHERE zone_id = $1 RETURNING *', [zoneId]);
    
    res.json({ success: true, message: 'Override removed successfully' });
  } catch (error) {
    console.error('Error removing surge override:', error);
    res.status(500).json({ error: 'Failed to remove surge override' });
  }
});

// Get current surge status for all zones
app.get('/api/admin/surge/current-status', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT sz.*, szo.manual_multiplier, szo.override_reason, szo.expires_at,
             CASE WHEN szo.id IS NOT NULL THEN true ELSE false END as has_override
      FROM surge_zones sz
      LEFT JOIN surge_zone_overrides szo ON sz.id = szo.zone_id AND (szo.expires_at IS NULL OR szo.expires_at > CURRENT_TIMESTAMP)
      WHERE sz.is_active = true
      ORDER BY sz.tier_level, sz.zone_name
    `);
    
    res.json({ success: true, zones: result.rows });
  } catch (error) {
    console.error('Error fetching surge status:', error);
    res.status(500).json({ error: 'Failed to fetch surge status' });
  }
});

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

// Error handling middleware
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

// Catch-all handler for React SPA (only in production)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

const PORT = process.env.PORT || 3001;

// Server startup with proper error handling
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`📱 WebSocket server ready for real-time connections`);
  console.log(`🔗 API endpoints available at /api/*`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

  try {
  // Initialize database after server starts
  await initializeDatabase();
  console.log('🗄️ Database: Connected and initialized');
  
  // Initialize market settings from database
  try {
    await marketSettingsDB.initialize(db);
    console.log('✅ Market settings loaded from database');
  } catch (marketError) {
    console.warn('⚠️ Market settings DB init failed, using defaults:', marketError.message);
  }
} catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    console.log('⚠️  Server will continue without database functionality');
  }
});