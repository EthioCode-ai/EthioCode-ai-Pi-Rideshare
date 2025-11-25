// ========================================
// BAREBONES PI VIP RIDESHARE BACKEND
// Minimal version for testing deployment
// ========================================

require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

// Initialize Express
const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Socket.IO setup
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

console.log('🚀 Starting Pi VIP Rideshare Backend (MINIMAL VERSION)...');

// ========================================
// DATABASE SETUP - SIMPLE VERSION
// ========================================

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
  } else {
    console.log('✅ Database connected successfully');
  }
});

// ========================================
// BASIC ROUTES
// ========================================

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Pi VIP Rideshare API - Minimal Version',
    status: 'running',
    version: '0.1.0-minimal',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Database health check
app.get('/health/database', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: result.rows[0].now
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: error.message
    });
  }
});

// Test driver endpoint
app.get('/api/driver/test/:driverId', async (req, res) => {
  try {
    const { driverId } = req.params;
    
    res.json({
      success: true,
      driverId: driverId,
      message: 'Driver endpoint working',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// SOCKET.IO - MINIMAL SETUP
// ========================================

io.on('connection', (socket) => {
  console.log('📱 Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('📱 Client disconnected:', socket.id);
  });

  // Basic ping/pong for testing
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date().toISOString() });
  });
});

// ========================================
// ERROR HANDLING
// ========================================

app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

// ========================================
// START SERVER
// ========================================

const PORT = process.env.PORT || 8080;

server.listen(PORT, '0.0.0.0', () => {
  console.log('✅ Server running on port', PORT);
  console.log('✅ Environment:', process.env.NODE_ENV || 'development');
  console.log('✅ WebSocket ready');
  console.log('✅ API endpoints ready');
  console.log('');
  console.log('🎯 MINIMAL VERSION - NO CLEANUP CODE');
  console.log('📍 Test endpoints:');
  console.log('   GET  /');
  console.log('   GET  /health');
  console.log('   GET  /health/database');
  console.log('   GET  /api/driver/test/:driverId');
  console.log('');
  console.log('✨ Server fully initialized and ready!');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    pool.end();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    pool.end();
    process.exit(0);
  });
});