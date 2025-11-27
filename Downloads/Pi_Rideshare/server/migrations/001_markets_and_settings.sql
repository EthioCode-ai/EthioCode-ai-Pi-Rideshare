-- ============================================================================
-- Pi VIP Rideshare - Database Migration 001
-- Markets & Platform Settings Persistence
-- ============================================================================
-- Date: November 26, 2025
-- Description: Creates tables for market-specific settings, replacing in-memory storage
-- 
-- Tables Created:
--   1. markets - Service areas/cities
--   2. market_settings - Per-market pricing, commission, surge, wait time, geofence
--   3. market_cancellation_fees - Per-market cancellation policies
--   4. airport_zones - Airports linked to markets
--   5. airport_pickup_zones - Detailed pickup/dropoff zones within airports
--
-- Run this migration: psql -d your_database -f 001_markets_and_settings.sql
-- ============================================================================

-- ============================================================================
-- TABLE 1: MARKETS
-- Core service area definitions
-- ============================================================================
CREATE TABLE IF NOT EXISTS markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identification
  market_code VARCHAR(50) UNIQUE NOT NULL,        -- 'bentonville', 'nwa', 'dfw'
  market_name VARCHAR(100) NOT NULL,              -- 'Northwest Arkansas'
  city VARCHAR(100) NOT NULL,                     -- 'Bentonville'
  state VARCHAR(50) NOT NULL,                     -- 'Arkansas'
  country VARCHAR(50) DEFAULT 'USA',
  
  -- Geographic Center & Bounds
  center_lat DECIMAL(10,7) NOT NULL,
  center_lng DECIMAL(10,7) NOT NULL,
  radius_miles INTEGER DEFAULT 50,
  default_zoom INTEGER DEFAULT 12,
  
  -- Operational
  timezone VARCHAR(50) DEFAULT 'America/Chicago',
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(20) DEFAULT 'active',            -- 'active', 'inactive', 'pending'
  launched_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_markets_status ON markets(status);
CREATE INDEX IF NOT EXISTS idx_markets_code ON markets(market_code);

-- ============================================================================
-- TABLE 2: MARKET_SETTINGS
-- All configurable settings per market (pricing, commission, surge, wait, geofence)
-- ============================================================================
CREATE TABLE IF NOT EXISTS market_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  
  -- ===================
  -- PRICING
  -- ===================
  base_fare_economy DECIMAL(10,2) DEFAULT 2.50,
  base_fare_standard DECIMAL(10,2) DEFAULT 4.00,
  base_fare_xl DECIMAL(10,2) DEFAULT 6.00,
  base_fare_premium DECIMAL(10,2) DEFAULT 10.00,
  per_mile_fare DECIMAL(10,2) DEFAULT 1.85,
  per_minute_fare DECIMAL(10,2) DEFAULT 0.35,
  min_fare DECIMAL(10,2) DEFAULT 5.00,
  booking_fee DECIMAL(10,2) DEFAULT 1.50,
  airport_fee DECIMAL(10,2) DEFAULT 3.00,
  
  -- ===================
  -- DRIVER COMMISSION
  -- ===================
  driver_commission_percent INTEGER DEFAULT 75,   -- Driver keeps this % of fare
  
  -- ===================
  -- SURGE PRICING
  -- ===================
  surge_enabled BOOLEAN DEFAULT true,
  max_surge_multiplier DECIMAL(3,1) DEFAULT 3.0,
  
  -- ===================
  -- WAIT TIME BILLING
  -- ===================
  grace_period_seconds INTEGER DEFAULT 120,       -- Free wait time (2 min)
  wait_rate_per_minute DECIMAL(10,2) DEFAULT 0.35,
  max_wait_minutes INTEGER DEFAULT 15,            -- Auto-cancel after this
  
  -- ===================
  -- GEOFENCE DETECTION
  -- ===================
  arrival_radius_meters INTEGER DEFAULT 100,      -- Pickup/dropoff arrival trigger
  
  -- ===================
  -- META
  -- ===================
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID,                                -- References users(id)
  
  -- One settings row per market
  UNIQUE(market_id)
);

-- Index for active settings lookup
CREATE INDEX IF NOT EXISTS idx_market_settings_market ON market_settings(market_id);

-- ============================================================================
-- TABLE 3: MARKET_CANCELLATION_FEES
-- Per-market cancellation policies by ride status
-- ============================================================================
CREATE TABLE IF NOT EXISTS market_cancellation_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  
  -- Condition Identification
  ride_status VARCHAR(50) NOT NULL,               -- 'requested', 'accepted', 'driver_arrived', 'in_progress'
  condition_name VARCHAR(100) NOT NULL,           -- 'immediate', 'under_2_minutes', 'over_2_minutes', etc.
  time_threshold_seconds INTEGER,                 -- NULL or threshold (e.g., 120 for 2-min rule)
  is_surge_variant BOOLEAN DEFAULT false,         -- Different fee during surge?
  
  -- Fee Structure
  refund_percentage INTEGER NOT NULL,             -- Rider gets this % back (0-100)
  driver_compensation_percentage INTEGER DEFAULT 0, -- Driver gets this % of fee
  
  -- Meta
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique per market + status + condition + surge variant
  UNIQUE(market_id, ride_status, condition_name, is_surge_variant)
);

-- Index for fast fee lookups
CREATE INDEX IF NOT EXISTS idx_cancellation_market_status ON market_cancellation_fees(market_id, ride_status);

-- ============================================================================
-- TABLE 4: AIRPORT_ZONES
-- Airports linked to their markets
-- ============================================================================
CREATE TABLE IF NOT EXISTS airport_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID REFERENCES markets(id) ON DELETE SET NULL,  -- Can exist without market
  
  -- Airport Identification
  airport_code VARCHAR(10) NOT NULL,              -- 'XNA', 'LAX', 'JFK'
  airport_name VARCHAR(150) NOT NULL,             -- 'Northwest Arkansas Regional'
  
  -- Location
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  
  -- Settings
  geofence_radius_km DECIMAL(5,2) DEFAULT 4.0,    -- Airport zone radius
  base_surge_multiplier DECIMAL(3,2) DEFAULT 1.5, -- Default surge at airport
  airport_fee DECIMAL(10,2) DEFAULT 3.00,         -- Flat airport pickup fee
  
  -- Queue Management
  queue_enabled BOOLEAN DEFAULT true,
  
  -- Meta
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique airport code
  UNIQUE(airport_code)
);

-- Index for geographic queries
CREATE INDEX IF NOT EXISTS idx_airport_zones_market ON airport_zones(market_id);
CREATE INDEX IF NOT EXISTS idx_airport_zones_code ON airport_zones(airport_code);

-- ============================================================================
-- TABLE 5: AIRPORT_PICKUP_ZONES
-- Detailed pickup/dropoff zones within each airport
-- ============================================================================
CREATE TABLE IF NOT EXISTS airport_pickup_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airport_id UUID NOT NULL REFERENCES airport_zones(id) ON DELETE CASCADE,
  
  -- Zone Identification
  zone_name VARCHAR(100) NOT NULL,                -- 'Terminal 1 Pickup', 'Rideshare Lot'
  zone_type VARCHAR(20) NOT NULL,                 -- 'pickup' or 'dropoff'
  
  -- Location
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  radius_meters INTEGER DEFAULT 200,
  
  -- Pricing
  fare_multiplier DECIMAL(3,2) DEFAULT 1.0,       -- Zone-specific fare adjustment
  
  -- Driver Instructions
  instructions TEXT,                              -- 'Follow signs to Rideshare Pickup Area'
  
  -- Meta
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique zone per airport
  UNIQUE(airport_id, zone_name)
);

-- Index for zone lookups
CREATE INDEX IF NOT EXISTS idx_airport_pickup_zones_airport ON airport_pickup_zones(airport_id);
CREATE INDEX IF NOT EXISTS idx_airport_pickup_zones_type ON airport_pickup_zones(zone_type);

-- ============================================================================
-- TRIGGER: Auto-update updated_at timestamps
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
DROP TRIGGER IF EXISTS update_markets_updated_at ON markets;
CREATE TRIGGER update_markets_updated_at
  BEFORE UPDATE ON markets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_market_settings_updated_at ON market_settings;
CREATE TRIGGER update_market_settings_updated_at
  BEFORE UPDATE ON market_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_market_cancellation_fees_updated_at ON market_cancellation_fees;
CREATE TRIGGER update_market_cancellation_fees_updated_at
  BEFORE UPDATE ON market_cancellation_fees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_airport_zones_updated_at ON airport_zones;
CREATE TRIGGER update_airport_zones_updated_at
  BEFORE UPDATE ON airport_zones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next: Run 002_seed_markets_data.sql to populate initial data
