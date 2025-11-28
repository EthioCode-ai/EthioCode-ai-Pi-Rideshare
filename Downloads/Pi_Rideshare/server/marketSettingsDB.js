// ============================================================================
// Pi VIP Rideshare - Market Settings Database Module
// ============================================================================
// File: server/marketSettingsDB.js (NEW FILE)
// 
// Purpose: Replaces in-memory pricingSettings with database-backed settings
// 
// Usage in index.js:
//   const marketSettings = require('./marketSettingsDB');
//   await marketSettings.initialize(db);
//   const settings = await marketSettings.getSettingsForLocation(lat, lng);
// ============================================================================

// ============================================================================
// MODULE STATE
// ============================================================================
let db = null;
let marketsCache = [];
let settingsCache = new Map(); // market_id -> settings
let cancellationCache = new Map(); // market_id -> fees array
let airportsCache = [];
let lastCacheRefresh = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the module with database connection
 * Call this once on server startup
 */
async function initialize(database) {
  db = database;
  await refreshCache();
  console.log('✅ Market Settings DB initialized');
  
// Auto-refresh cache periodically
setInterval(refreshCache, CACHE_TTL_MS);
}

/**
 * Refresh all cached data from database
 */
async function refreshCache() {
  if (!db) {
    console.log('⚠️ Cache refresh skipped - no database connection');
    return;
  }
  try {
    // Load markets
    const marketsResult = await db.query(`
      SELECT * FROM markets WHERE status = 'active' ORDER BY market_name
    `);
    marketsCache = marketsResult.rows;
    
    // Load settings for each market
    const settingsResult = await db.query(`
      SELECT ms.*, m.market_code 
      FROM market_settings ms 
      JOIN markets m ON m.id = ms.market_id 
      WHERE ms.is_active = true
    `);
    settingsCache.clear();
    settingsResult.rows.forEach(row => {
      settingsCache.set(row.market_id, row);
    });
    
    // Load cancellation fees
    const cancelResult = await db.query(`
      SELECT mcf.*, m.market_code 
      FROM market_cancellation_fees mcf 
      JOIN markets m ON m.id = mcf.market_id 
      WHERE mcf.is_active = true
    `);
    cancellationCache.clear();
    cancelResult.rows.forEach(row => {
      const existing = cancellationCache.get(row.market_id) || [];
      existing.push(row);
      cancellationCache.set(row.market_id, existing);
    });
    
    // Load airports
    const airportsResult = await db.query(`
      SELECT az.*, m.market_code 
      FROM airport_zones az 
      LEFT JOIN markets m ON m.id = az.market_id 
      WHERE az.is_active = true
    `);
    airportsCache = airportsResult.rows;
    
    lastCacheRefresh = new Date();
    console.log(`📦 Cache refreshed: ${marketsCache.length} markets, ${airportsCache.length} airports`);
  } catch (error) {
    console.error('❌ Cache refresh failed:', error.message);
  }
}

// ============================================================================
// MARKET DETECTION
// ============================================================================

/**
 * Calculate Haversine distance between two points
 * @returns Distance in miles
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Find which market a location belongs to
 * @returns Market object or null if outside all markets
 */
function findMarketForLocation(lat, lng) {
  for (const market of marketsCache) {
    const distance = haversineDistance(
      lat, lng,
      parseFloat(market.center_lat),
      parseFloat(market.center_lng)
    );
    if (distance <= market.radius_miles) {
      return market;
    }
  }
  return null;
}

/**
 * Get all settings for a location
 * @returns Combined settings object or defaults if outside markets
 */
async function getSettingsForLocation(lat, lng) {
  const market = findMarketForLocation(lat, lng);
  
  if (!market) {
    // Return default settings for locations outside defined markets
    return getDefaultSettings();
  }
  
  return getSettingsForMarket(market.id);
}

/**
 * Get settings for a specific market by ID
 */
function getSettingsForMarket(marketId) {
  const settings = settingsCache.get(marketId);
  const market = marketsCache.find(m => m.id === marketId);
  
  if (!settings) {
    return getDefaultSettings();
  }
  
  return {
    marketId: marketId,
    marketCode: market?.market_code,
    marketName: market?.market_name,
    
    // Pricing
    baseFareEconomy: parseFloat(settings.base_fare_economy),
    baseFareStandard: parseFloat(settings.base_fare_standard),
    baseFareXL: parseFloat(settings.base_fare_xl),
    baseFarePremium: parseFloat(settings.base_fare_premium),
    perMileFare: parseFloat(settings.per_mile_fare),
    perMinuteFare: parseFloat(settings.per_minute_fare),
    minFare: parseFloat(settings.min_fare),
    bookingFee: parseFloat(settings.booking_fee),
    airportFee: parseFloat(settings.airport_fee),
    
    // Commission
    driverCommission: parseInt(settings.driver_commission_percent),
    
    // Surge
    surgePricing: settings.surge_enabled,
    maxSurgeMultiplier: parseFloat(settings.max_surge_multiplier),
    
    // Wait time
    gracePeriodSeconds: parseInt(settings.grace_period_seconds),
    waitRatePerMinute: parseFloat(settings.wait_rate_per_minute),
    maxWaitMinutes: parseInt(settings.max_wait_minutes),
    
    // Geofence
    arrivalRadiusMeters: parseInt(settings.arrival_radius_meters),
  };
}

/**
 * Get default settings for locations outside markets
 */
function getDefaultSettings() {
  return {
    marketId: null,
    marketCode: 'default',
    marketName: 'Default Market',
    
    // Pricing (defaults match original hardcoded values)
    baseFareEconomy: 2.50,
    baseFareStandard: 4.00,
    baseFareXL: 6.00,
    baseFarePremium: 10.00,
    perMileFare: 1.85,
    perMinuteFare: 0.35,
    minFare: 5.00,
    bookingFee: 1.50,
    airportFee: 3.00,
    
    // Commission
    driverCommission: 75,
    
    // Surge
    surgePricing: true,
    maxSurgeMultiplier: 3.0,
    
    // Wait time
    gracePeriodSeconds: 120,
    waitRatePerMinute: 0.35,
    maxWaitMinutes: 15,
    
    // Geofence
    arrivalRadiusMeters: 100,
  };
}

// ============================================================================
// CANCELLATION FEES
// ============================================================================

/**
 * Get cancellation fee settings for a market and ride status
 * @param marketId - Market UUID
 * @param rideStatus - 'requested', 'pending', 'accepted', 'driver_arrived', 'in_progress'
 * @param timeSinceAcceptedSeconds - Time since driver accepted (for accepted status)
 * @param isSurgeActive - Whether surge pricing is active
 * @returns Fee configuration object
 */
function getCancellationFee(marketId, rideStatus, timeSinceAcceptedSeconds = 0, isSurgeActive = false) {
  const fees = cancellationCache.get(marketId) || [];
  
  // Find matching fee rule
  let matchingFee = null;
  
  for (const fee of fees) {
    if (fee.ride_status !== rideStatus) continue;
    
    // Handle surge variant
    if (rideStatus === 'driver_arrived') {
      if (fee.is_surge_variant === isSurgeActive) {
        matchingFee = fee;
        break;
      }
      continue;
    }
    
    // Handle time-based conditions for 'accepted' status
    if (rideStatus === 'accepted' && fee.time_threshold_seconds) {
      if (fee.condition_name === 'under_2_minutes' && timeSinceAcceptedSeconds < fee.time_threshold_seconds) {
        matchingFee = fee;
        break;
      }
      if (fee.condition_name === 'over_2_minutes' && timeSinceAcceptedSeconds >= fee.time_threshold_seconds) {
        matchingFee = fee;
        break;
      }
      continue;
    }
    
    // Default match
    matchingFee = fee;
  }
  
  // Return fee or defaults
  if (matchingFee) {
    return {
      refundPercentage: matchingFee.refund_percentage,
      driverCompensationPercentage: matchingFee.driver_compensation_percentage,
      condition: matchingFee.condition_name,
    };
  }
  
  // Fallback defaults if no matching rule found
  return getDefaultCancellationFee(rideStatus, timeSinceAcceptedSeconds, isSurgeActive);
}

/**
 * Default cancellation fees (matches original hardcoded logic)
 */
function getDefaultCancellationFee(rideStatus, timeSinceAcceptedSeconds, isSurgeActive) {
  switch (rideStatus) {
    case 'requested':
    case 'pending':
      return { refundPercentage: 100, driverCompensationPercentage: 0, condition: 'immediate' };
    
    case 'accepted':
      if (timeSinceAcceptedSeconds < 120) {
        return { refundPercentage: 95, driverCompensationPercentage: 0, condition: 'under_2_minutes' };
      }
      return { refundPercentage: 85, driverCompensationPercentage: 10, condition: 'over_2_minutes' };
    
    case 'driver_arrived':
      if (isSurgeActive) {
        return { refundPercentage: 10, driverCompensationPercentage: 60, condition: 'during_surge' };
      }
      return { refundPercentage: 25, driverCompensationPercentage: 60, condition: 'normal_pricing' };
    
    case 'in_progress':
      return { refundPercentage: 0, driverCompensationPercentage: 100, condition: 'ride_started' };
    
    default:
      return { refundPercentage: 100, driverCompensationPercentage: 0, condition: 'unknown' };
  }
}

// ============================================================================
// AIRPORT DETECTION
// ============================================================================

/**
 * Check if a location is near an airport
 * @returns Airport info or null
 */
function getNearbyAirport(lat, lng) {
  for (const airport of airportsCache) {
    const distance = haversineDistance(
      lat, lng,
      parseFloat(airport.latitude),
      parseFloat(airport.longitude)
    );
    const radiusMiles = parseFloat(airport.geofence_radius_km) * 0.621371;
    
    if (distance <= radiusMiles) {
      return {
        airportCode: airport.airport_code,
        airportName: airport.airport_name,
        distanceToAirport: distance,
        geofenceRadiusKm: parseFloat(airport.geofence_radius_km),
        baseSurgeMultiplier: parseFloat(airport.base_surge_multiplier),
        airportFee: parseFloat(airport.airport_fee),
        queueEnabled: airport.queue_enabled,
        marketCode: airport.market_code,
      };
    }
  }
  return null;
}

/**
 * Get airport pickup zones for a specific airport
 */
async function getAirportPickupZones(airportCode) {
  if (!db) return [];
  
  try {
    const result = await db.query(`
      SELECT apz.* 
      FROM airport_pickup_zones apz
      JOIN airport_zones az ON az.id = apz.airport_id
      WHERE az.airport_code = $1 AND apz.is_active = true
    `, [airportCode]);
    
    return result.rows.map(zone => ({
      zoneName: zone.zone_name,
      zoneType: zone.zone_type,
      latitude: parseFloat(zone.latitude),
      longitude: parseFloat(zone.longitude),
      radiusMeters: zone.radius_meters,
      fareMultiplier: parseFloat(zone.fare_multiplier),
      instructions: zone.instructions,
    }));
  } catch (error) {
    console.error('Error fetching airport pickup zones:', error.message);
    return [];
  }
}

/**
 * Find nearest airport zone for a location
 */
async function findNearestAirportZone(lat, lng, airportCode) {
  const zones = await getAirportPickupZones(airportCode);
  let nearestZone = null;
  let minDistance = Infinity;
  
  for (const zone of zones) {
    const distance = haversineDistance(lat, lng, zone.latitude, zone.longitude) * 1609.34; // Convert to meters
    if (distance < minDistance && distance <= zone.radiusMeters) {
      minDistance = distance;
      nearestZone = {
        ...zone,
        distanceMeters: Math.round(distance),
      };
    }
  }
  
  return nearestZone;
}

// ============================================================================
// CRUD OPERATIONS (For Admin Dashboard)
// ============================================================================

/**
 * Get all markets
 */
async function getAllMarkets() {
  if (!db) return marketsCache;
  
  const result = await db.query(`
    SELECT m.*, 
           ms.base_fare_economy, ms.per_mile_fare, ms.driver_commission_percent,
           ms.surge_enabled, ms.max_surge_multiplier
    FROM markets m
    LEFT JOIN market_settings ms ON ms.market_id = m.id
    ORDER BY m.market_name
  `);
  return result.rows;
}

/**
 * Get single market with all settings
 */
async function getMarketById(marketId) {
  if (!db) return null;
  
  const marketResult = await db.query('SELECT * FROM markets WHERE id = $1', [marketId]);
  if (marketResult.rows.length === 0) return null;
  
  const settingsResult = await db.query('SELECT * FROM market_settings WHERE market_id = $1', [marketId]);
  const cancelResult = await db.query('SELECT * FROM market_cancellation_fees WHERE market_id = $1', [marketId]);
  
  return {
    market: marketResult.rows[0],
    settings: settingsResult.rows[0] || null,
    cancellationFees: cancelResult.rows,
  };
}

/**
 * Create a new market
 */
async function createMarket(marketData) {
  if (!db) throw new Error('Database not initialized');
  
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    
    // Insert market
    const marketResult = await client.query(`
      INSERT INTO markets (market_code, market_name, city, state, country, center_lat, center_lng, radius_miles, default_zoom, timezone, currency, status, launched_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      marketData.marketCode,
      marketData.marketName,
      marketData.city,
      marketData.state,
      marketData.country || 'USA',
      marketData.centerLat,
      marketData.centerLng,
      marketData.radiusMiles || 50,
      marketData.defaultZoom || 12,
      marketData.timezone || 'America/Chicago',
      marketData.currency || 'USD',
      marketData.status || 'active',
      marketData.launchedAt || null,
    ]);
    
    const newMarket = marketResult.rows[0];
    
    // Insert default settings
    await client.query(`
      INSERT INTO market_settings (market_id)
      VALUES ($1)
    `, [newMarket.id]);
    
    // Insert default cancellation fees
    const defaultFees = [
      ['requested', 'immediate', null, false, 100, 0],
      ['pending', 'immediate', null, false, 100, 0],
      ['accepted', 'under_2_minutes', 120, false, 95, 0],
      ['accepted', 'over_2_minutes', 120, false, 85, 10],
      ['driver_arrived', 'normal_pricing', null, false, 25, 60],
      ['driver_arrived', 'during_surge', null, true, 10, 60],
      ['in_progress', 'ride_started', null, false, 0, 100],
    ];
    
    for (const fee of defaultFees) {
      await client.query(`
        INSERT INTO market_cancellation_fees (market_id, ride_status, condition_name, time_threshold_seconds, is_surge_variant, refund_percentage, driver_compensation_percentage)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [newMarket.id, ...fee]);
    }
    
    await client.query('COMMIT');
    await refreshCache();
    
    return newMarket;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update market settings
 */
async function updateMarketSettings(marketId, settings) {
  if (!db) throw new Error('Database not initialized');
  
  const updateFields = [];
  const values = [marketId];
  let paramCount = 2;
  
  const allowedFields = {
    base_fare_economy: 'baseFareEconomy',
    base_fare_standard: 'baseFareStandard',
    base_fare_xl: 'baseFareXL',
    base_fare_premium: 'baseFarePremium',
    per_mile_fare: 'perMileFare',
    per_minute_fare: 'perMinuteFare',
    min_fare: 'minFare',
    booking_fee: 'bookingFee',
    airport_fee: 'airportFee',
    driver_commission_percent: 'driverCommission',
    surge_enabled: 'surgePricing',
    max_surge_multiplier: 'maxSurgeMultiplier',
    grace_period_seconds: 'gracePeriodSeconds',
    wait_rate_per_minute: 'waitRatePerMinute',
    max_wait_minutes: 'maxWaitMinutes',
    arrival_radius_meters: 'arrivalRadiusMeters',
  };
  
  for (const [dbField, inputField] of Object.entries(allowedFields)) {
    if (settings[inputField] !== undefined) {
      updateFields.push(`${dbField} = $${paramCount}`);
      values.push(settings[inputField]);
      paramCount++;
    }
  }
  
  if (updateFields.length === 0) {
    throw new Error('No valid fields to update');
  }
  
  const query = `
    UPDATE market_settings 
    SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE market_id = $1
    RETURNING *
  `;
  
  const result = await db.query(query, values);
  await refreshCache();
  
  return result.rows[0];
}

/**
 * Update cancellation fee for a market
 */
async function updateCancellationFee(marketId, rideStatus, conditionName, isSurgeVariant, updates) {
  if (!db) throw new Error('Database not initialized');
  
  const result = await db.query(`
    UPDATE market_cancellation_fees
    SET refund_percentage = COALESCE($5, refund_percentage),
        driver_compensation_percentage = COALESCE($6, driver_compensation_percentage),
        updated_at = CURRENT_TIMESTAMP
    WHERE market_id = $1 AND ride_status = $2 AND condition_name = $3 AND is_surge_variant = $4
    RETURNING *
  `, [marketId, rideStatus, conditionName, isSurgeVariant, updates.refundPercentage, updates.driverCompensationPercentage]);
  
  await refreshCache();
  return result.rows[0];
}

// ============================================================================
// COMPATIBILITY LAYER
// ============================================================================

/**
 * Get pricingSettings object (for backward compatibility with existing code)
 * This allows gradual migration from in-memory to database
 */
function getLegacyPricingSettings(marketId = null) {
  if (marketId) {
    const settings = getSettingsForMarket(marketId);
    return {
      baseFareEconomy: settings.baseFareEconomy,
      baseFareStandard: settings.baseFareStandard,
      baseFareXL: settings.baseFareXL,
      baseFarePremium: settings.baseFarePremium,
      perMileFare: settings.perMileFare,
      perMinuteFare: settings.perMinuteFare,
      driverCommission: settings.driverCommission,
      surgePricing: settings.surgePricing,
      maxSurgeMultiplier: settings.maxSurgeMultiplier,
    };
  }
  
  // Return defaults
  const defaults = getDefaultSettings();
  return {
    baseFareEconomy: defaults.baseFareEconomy,
    baseFareStandard: defaults.baseFareStandard,
    baseFareXL: defaults.baseFareXL,
    baseFarePremium: defaults.baseFarePremium,
    perMileFare: defaults.perMileFare,
    perMinuteFare: defaults.perMinuteFare,
    driverCommission: defaults.driverCommission,
    surgePricing: defaults.surgePricing,
    maxSurgeMultiplier: defaults.maxSurgeMultiplier,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================
module.exports = {
  // Initialization
  initialize,
  refreshCache,
  
  // Market detection
  findMarketForLocation,
  getSettingsForLocation,
  getSettingsForMarket,
  getDefaultSettings,
  
  // Cancellation fees
  getCancellationFee,
  getDefaultCancellationFee,
  
  // Airport detection
  getNearbyAirport,
  getAirportPickupZones,
  findNearestAirportZone,
  
  // CRUD operations
  getAllMarkets,
  getMarketById,
  createMarket,
  updateMarketSettings,
  updateCancellationFee,
  
  // Compatibility
  getLegacyPricingSettings,
  
  // Direct cache access (for debugging)
  getMarketsCache: () => marketsCache,
  getSettingsCache: () => settingsCache,
  getAirportsCache: () => airportsCache,
};
