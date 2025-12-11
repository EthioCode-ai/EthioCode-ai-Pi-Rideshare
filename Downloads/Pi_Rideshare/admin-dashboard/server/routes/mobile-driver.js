/**
 * Mobile Driver Routes
 * 
 * Mobile-specific endpoints for the Pi VIP Driver App
 * These complement the existing driver endpoints in server/index.js
 */

const express = require('express');
const router = express.Router();

/**
 * GET /api/driver/performance/today/:driverId
 * 
 * Returns today's performance metrics for a specific driver
 * Used by: Mobile Driver App - HomeScreen performance panel
 * 
 * Response format:
 * {
 *   today: 125.50,      // Today's earnings
 *   trips: 8,           // Number of trips completed today
 *   hours: 6.5,         // Hours online today
 *   miles: 45.2,        // Miles driven today
 *   lastRide: 18.75     // Last ride earnings
 * }
 */
router.get('/performance/today/:driverId', async (req, res) => {
  try {
    const { driverId } = req.params;
    const db = req.app.locals.db;

    // Get today's date range (midnight to now)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Query 1: Get today's completed rides
    const ridesQuery = `
      SELECT 
        COUNT(*) as trip_count,
        COALESCE(SUM(final_fare), 0) as total_earnings,
        COALESCE(SUM(distance), 0) as total_miles
      FROM rides
      WHERE driver_id = $1
        AND status = 'completed'
        AND completed_at >= $2
        AND completed_at <= $3
    `;

    const ridesResult = await db.query(ridesQuery, [driverId, todayStart, todayEnd]);
    const ridesData = ridesResult.rows[0];

    // Query 2: Get last completed ride
    const lastRideQuery = `
      SELECT final_fare, completed_at
      FROM rides
      WHERE driver_id = $1
        AND status = 'completed'
      ORDER BY completed_at DESC
      LIMIT 1
    `;

    const lastRideResult = await db.query(lastRideQuery, [driverId]);
    const lastRide = lastRideResult.rows[0];

    // Query 3: Calculate online hours today
    // This assumes you have a driver_sessions or driver_locations table
    // Adjust based on your actual schema
    const hoursQuery = `
      SELECT 
        COALESCE(
          EXTRACT(EPOCH FROM (MAX(updated_at) - MIN(updated_at))) / 3600, 
          0
        ) as hours_online
      FROM driver_locations
      WHERE driver_id = $1
        AND updated_at >= $2
        AND updated_at <= $3
    `;

    const hoursResult = await db.query(hoursQuery, [driverId, todayStart, todayEnd]);
    const hoursData = hoursResult.rows[0];

    // Format response
    const performance = {
      today: parseFloat(ridesData.total_earnings) || 0,
      trips: parseInt(ridesData.trip_count) || 0,
      hours: parseFloat(hoursData.hours_online).toFixed(1) || 0,
      miles: parseFloat(ridesData.total_miles).toFixed(1) || 0,
      lastRide: lastRide ? parseFloat(lastRide.final_fare) : 0,
    };

    res.json(performance);

  } catch (error) {
    console.error('Error fetching driver performance:', error);
    res.status(500).json({ 
      error: 'Failed to fetch performance data',
      message: error.message 
    });
  }
});

/**
 * POST /api/driver/status
 * 
 * Updates driver's online/offline status
 * Used by: Mobile Driver App - GO ONLINE button and power button
 * 
 * Request body:
 * {
 *   driverId: "driver123",
 *   isOnline: true,
 *   location: {
 *     latitude: 36.1234,
 *     longitude: -94.5678
 *   }
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   status: "online",
 *   timestamp: "2025-01-14T12:34:56Z"
 * }
 */
router.post('/status', async (req, res) => {
  try {
    const { driverId, isOnline, location } = req.body;

    // Validation
    if (!driverId) {
      return res.status(400).json({ error: 'Driver ID is required' });
    }

    if (typeof isOnline !== 'boolean') {
      return res.status(400).json({ error: 'isOnline must be a boolean' });
    }

    const db = req.app.locals.db;
    const io = req.app.locals.io;

    // Update driver status in database
    const updateQuery = `
      UPDATE users
      SET 
        is_available = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING id, is_available
    `;

    const result = await db.query(updateQuery, [isOnline, driverId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // If going online and location provided, update location
    if (isOnline && location) {
      const locationQuery = `
        INSERT INTO driver_locations (driver_id, latitude, longitude, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (driver_id) 
        DO UPDATE SET 
          latitude = $2,
          longitude = $3,
          updated_at = NOW()
      `;

      await db.query(locationQuery, [
        driverId,
        location.latitude,
        location.longitude
      ]);
    }

    // Emit Socket.IO event to notify system
    if (io) {
      io.to('admin').emit('driver-availability-update', {
        driverId,
        isOnline,
        timestamp: new Date().toISOString()
      });
    }

    // Log status change
    console.log(`📱 Driver ${driverId} is now ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

    res.json({
      success: true,
      status: isOnline ? 'online' : 'offline',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error updating driver status:', error);
    res.status(500).json({ 
      error: 'Failed to update status',
      message: error.message 
    });
  }
});

/**
 * GET /api/driver/earnings/:driverId
 * 
 * Returns comprehensive earnings data for EarningsModal
 * Used by: Mobile Driver App - EarningsModal (detailed view)
 * 
 * Response format:
 * {
 *   today: 125.50,
 *   week: 687.25,
 *   month: 2840.00,
 *   trips: 8,
 *   hours: 6.5,
 *   rating: 4.8,
 *   lastRide: 18.75,
 *   miles: 45.2
 * }
 */
router.get('/earnings/:driverId', async (req, res) => {
  try {
    const { driverId } = req.params;
    const db = req.app.locals.db;

    // Date ranges
    const now = new Date();
    
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    
    const monthStart = new Date(now);
    monthStart.setMonth(now.getMonth() - 1);

    // Query earnings for different time periods
    const earningsQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN completed_at >= $2 THEN final_fare ELSE 0 END), 0) as today,
        COALESCE(SUM(CASE WHEN completed_at >= $3 THEN final_fare ELSE 0 END), 0) as week,
        COALESCE(SUM(CASE WHEN completed_at >= $4 THEN final_fare ELSE 0 END), 0) as month,
        COUNT(CASE WHEN completed_at >= $2 THEN 1 END) as trips_today,
        COALESCE(SUM(CASE WHEN completed_at >= $2 THEN distance ELSE 0 END), 0) as miles
      FROM rides
      WHERE driver_id = $1
        AND status = 'completed'
    `;

    const earningsResult = await db.query(earningsQuery, [
      driverId,
      todayStart,
      weekStart,
      monthStart
    ]);

    const earnings = earningsResult.rows[0];

    // Get driver rating
    const ratingQuery = `
      SELECT rating
      FROM users
      WHERE id = $1
    `;

    const ratingResult = await db.query(ratingQuery, [driverId]);
    const rating = ratingResult.rows[0]?.rating || 0;

    // Get last ride
    const lastRideQuery = `
      SELECT final_fare
      FROM rides
      WHERE driver_id = $1
        AND status = 'completed'
      ORDER BY completed_at DESC
      LIMIT 1
    `;

    const lastRideResult = await db.query(lastRideQuery, [driverId]);
    const lastRide = lastRideResult.rows[0];

    // Calculate online hours (simplified)
    const hoursQuery = `
      SELECT 
        COALESCE(
          EXTRACT(EPOCH FROM (MAX(updated_at) - MIN(updated_at))) / 3600,
          0
        ) as hours_online
      FROM driver_locations
      WHERE driver_id = $1
        AND updated_at >= $2
    `;

    const hoursResult = await db.query(hoursQuery, [driverId, todayStart]);
    const hours = hoursResult.rows[0]?.hours_online || 0;

    res.json({
      today: parseFloat(earnings.today) || 0,
      week: parseFloat(earnings.week) || 0,
      month: parseFloat(earnings.month) || 0,
      trips: parseInt(earnings.trips_today) || 0,
      hours: parseFloat(hours).toFixed(1),
      rating: parseFloat(rating) || 0,
      lastRide: lastRide ? parseFloat(lastRide.final_fare) : 0,
      miles: parseFloat(earnings.miles).toFixed(1) || 0
    });

  } catch (error) {
    console.error('Error fetching earnings:', error);
    res.status(500).json({ 
      error: 'Failed to fetch earnings',
      message: error.message 
    });
  }
});

module.exports = router;