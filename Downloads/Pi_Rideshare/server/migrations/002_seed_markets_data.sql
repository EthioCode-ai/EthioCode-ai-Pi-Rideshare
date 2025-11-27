-- ============================================================================
-- Pi VIP Rideshare - Database Migration 002
-- Seed Data for Markets & Settings
-- ============================================================================
-- Date: November 26, 2025
-- Description: Populates initial market data based on existing marketService.ts
-- 
-- Run this after: 001_markets_and_settings.sql
-- Run command: psql -d your_database -f 002_seed_markets_data.sql
-- ============================================================================

-- ============================================================================
-- SEED MARKETS - 20 Major Metro Areas
-- ============================================================================
-- Note: Admin can add new markets via Dashboard INSERT function
-- Markets represent entire metro areas, not individual cities
-- ============================================================================
INSERT INTO markets (market_code, market_name, city, state, country, center_lat, center_lng, radius_miles, default_zoom, timezone, currency, status, launched_at)
VALUES
  -- Arkansas
  ('nwa', 'Northwest Arkansas', 'Bentonville', 'Arkansas', 'USA', 36.2729, -94.1606, 35, 11, 'America/Chicago', 'USD', 'active', '2024-01-01'),
  ('little_rock', 'Little Rock Metro', 'Little Rock', 'Arkansas', 'USA', 34.7465, -92.2896, 30, 11, 'America/Chicago', 'USD', 'active', '2024-06-01'),
  ('fort_smith', 'Fort Smith Metro', 'Fort Smith', 'Arkansas', 'USA', 35.3859, -94.3985, 25, 11, 'America/Chicago', 'USD', 'pending', NULL),
  
  -- Oklahoma
  ('tulsa', 'Tulsa Metro', 'Tulsa', 'Oklahoma', 'USA', 36.1540, -95.9928, 35, 11, 'America/Chicago', 'USD', 'pending', NULL),
  ('okc', 'Oklahoma City Metro', 'Oklahoma City', 'Oklahoma', 'USA', 35.4676, -97.5164, 40, 10, 'America/Chicago', 'USD', 'pending', NULL),
  
  -- Texas
  ('dallas', 'Dallas-Fort Worth', 'Dallas', 'Texas', 'USA', 32.7767, -96.7970, 50, 10, 'America/Chicago', 'USD', 'pending', NULL),
  ('austin', 'Austin Metro', 'Austin', 'Texas', 'USA', 30.2672, -97.7431, 35, 11, 'America/Chicago', 'USD', 'pending', NULL),
  ('houston', 'Houston Metro', 'Houston', 'Texas', 'USA', 29.7604, -95.3698, 50, 10, 'America/Chicago', 'USD', 'pending', NULL),
  ('san_antonio', 'San Antonio Metro', 'San Antonio', 'Texas', 'USA', 29.4241, -98.4936, 35, 11, 'America/Chicago', 'USD', 'pending', NULL),
  
  -- West Coast
  ('seattle', 'Seattle-Tacoma', 'Seattle', 'Washington', 'USA', 47.6062, -122.3321, 40, 10, 'America/Los_Angeles', 'USD', 'pending', NULL),
  ('portland', 'Portland Metro', 'Portland', 'Oregon', 'USA', 45.5152, -122.6784, 35, 11, 'America/Los_Angeles', 'USD', 'pending', NULL),
  ('sf_bay', 'San Francisco Bay Area', 'San Francisco', 'California', 'USA', 37.7749, -122.4194, 45, 10, 'America/Los_Angeles', 'USD', 'pending', NULL),
  ('la', 'Los Angeles Metro', 'Los Angeles', 'California', 'USA', 34.0522, -118.2437, 50, 10, 'America/Los_Angeles', 'USD', 'pending', NULL),
  
  -- Midwest
  ('chicago', 'Chicago Metro', 'Chicago', 'Illinois', 'USA', 41.8781, -87.6298, 45, 10, 'America/Chicago', 'USD', 'pending', NULL),
  ('denver', 'Denver Metro', 'Denver', 'Colorado', 'USA', 39.7392, -104.9903, 40, 10, 'America/Denver', 'USD', 'pending', NULL),
  ('minneapolis', 'Minneapolis-St. Paul', 'Minneapolis', 'Minnesota', 'USA', 44.9778, -93.2650, 35, 11, 'America/Chicago', 'USD', 'pending', NULL),
  
  -- East Coast
  ('dc', 'Washington D.C. Metro', 'Washington', 'District of Columbia', 'USA', 38.9072, -77.0369, 40, 10, 'America/New_York', 'USD', 'pending', NULL),
  ('nyc', 'New York City Metro', 'New York', 'New York', 'USA', 40.7128, -74.0060, 35, 10, 'America/New_York', 'USD', 'pending', NULL),
  ('atlanta', 'Atlanta Metro', 'Atlanta', 'Georgia', 'USA', 33.7490, -84.3880, 45, 10, 'America/New_York', 'USD', 'pending', NULL),
  ('miami', 'Miami Metro', 'Miami', 'Florida', 'USA', 25.7617, -80.1918, 40, 10, 'America/New_York', 'USD', 'pending', NULL)
ON CONFLICT (market_code) DO UPDATE SET
  market_name = EXCLUDED.market_name,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  center_lat = EXCLUDED.center_lat,
  center_lng = EXCLUDED.center_lng,
  updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- SEED MARKET_SETTINGS - Default pricing for each market
-- ============================================================================
-- Insert settings for each market with NWA-appropriate defaults
INSERT INTO market_settings (
  market_id,
  base_fare_economy, base_fare_standard, base_fare_xl, base_fare_premium,
  per_mile_fare, per_minute_fare, min_fare, booking_fee, airport_fee,
  driver_commission_percent,
  surge_enabled, max_surge_multiplier,
  grace_period_seconds, wait_rate_per_minute, max_wait_minutes,
  arrival_radius_meters
)
SELECT 
  m.id,
  2.50, 4.00, 6.00, 10.00,    -- Base fares
  1.85, 0.35, 5.00, 1.50, 3.00, -- Per-unit rates & fees
  75,                          -- Driver commission %
  true, 3.0,                   -- Surge settings
  120, 0.35, 15,               -- Wait time settings
  100                          -- Geofence radius (meters)
FROM markets m
WHERE NOT EXISTS (
  SELECT 1 FROM market_settings ms WHERE ms.market_id = m.id
);

-- ============================================================================
-- SEED MARKET_CANCELLATION_FEES - Standard cancellation policies
-- ============================================================================
-- Create a function to insert cancellation fees for a market
DO $$
DECLARE
  market_record RECORD;
BEGIN
  FOR market_record IN SELECT id FROM markets LOOP
    
    -- 1. Requested/Pending - Full refund
    INSERT INTO market_cancellation_fees (market_id, ride_status, condition_name, time_threshold_seconds, is_surge_variant, refund_percentage, driver_compensation_percentage)
    VALUES (market_record.id, 'requested', 'immediate', NULL, false, 100, 0)
    ON CONFLICT (market_id, ride_status, condition_name, is_surge_variant) DO NOTHING;
    
    INSERT INTO market_cancellation_fees (market_id, ride_status, condition_name, time_threshold_seconds, is_surge_variant, refund_percentage, driver_compensation_percentage)
    VALUES (market_record.id, 'pending', 'immediate', NULL, false, 100, 0)
    ON CONFLICT (market_id, ride_status, condition_name, is_surge_variant) DO NOTHING;
    
    -- 2. Accepted - Under 2 minutes (95% refund)
    INSERT INTO market_cancellation_fees (market_id, ride_status, condition_name, time_threshold_seconds, is_surge_variant, refund_percentage, driver_compensation_percentage)
    VALUES (market_record.id, 'accepted', 'under_2_minutes', 120, false, 95, 0)
    ON CONFLICT (market_id, ride_status, condition_name, is_surge_variant) DO NOTHING;
    
    -- 3. Accepted - Over 2 minutes (85% refund, driver gets 10%)
    INSERT INTO market_cancellation_fees (market_id, ride_status, condition_name, time_threshold_seconds, is_surge_variant, refund_percentage, driver_compensation_percentage)
    VALUES (market_record.id, 'accepted', 'over_2_minutes', 120, false, 85, 10)
    ON CONFLICT (market_id, ride_status, condition_name, is_surge_variant) DO NOTHING;
    
    -- 4. Driver Arrived - Normal pricing (25% refund, driver gets 60%)
    INSERT INTO market_cancellation_fees (market_id, ride_status, condition_name, time_threshold_seconds, is_surge_variant, refund_percentage, driver_compensation_percentage)
    VALUES (market_record.id, 'driver_arrived', 'normal_pricing', NULL, false, 25, 60)
    ON CONFLICT (market_id, ride_status, condition_name, is_surge_variant) DO NOTHING;
    
    -- 5. Driver Arrived - During surge (10% refund, driver gets 60%)
    INSERT INTO market_cancellation_fees (market_id, ride_status, condition_name, time_threshold_seconds, is_surge_variant, refund_percentage, driver_compensation_percentage)
    VALUES (market_record.id, 'driver_arrived', 'during_surge', NULL, true, 10, 60)
    ON CONFLICT (market_id, ride_status, condition_name, is_surge_variant) DO NOTHING;
    
    -- 6. In Progress - No refund (driver gets full earnings)
    INSERT INTO market_cancellation_fees (market_id, ride_status, condition_name, time_threshold_seconds, is_surge_variant, refund_percentage, driver_compensation_percentage)
    VALUES (market_record.id, 'in_progress', 'ride_started', NULL, false, 0, 100)
    ON CONFLICT (market_id, ride_status, condition_name, is_surge_variant) DO NOTHING;
    
  END LOOP;
END $$;

-- ============================================================================
-- SEED AIRPORT_ZONES - Major US Airports (Linked to Metro Markets)
-- ============================================================================
INSERT INTO airport_zones (market_id, airport_code, airport_name, latitude, longitude, geofence_radius_km, base_surge_multiplier, airport_fee, queue_enabled)
VALUES
  -- Arkansas
  ((SELECT id FROM markets WHERE market_code = 'nwa'), 'XNA', 'Northwest Arkansas Regional Airport', 36.2818, -94.3068, 4.8, 1.4, 3.00, true),
  ((SELECT id FROM markets WHERE market_code = 'fort_smith'), 'FSM', 'Fort Smith Regional Airport', 35.3366, -94.3674, 3.5, 1.3, 2.50, true),
  ((SELECT id FROM markets WHERE market_code = 'little_rock'), 'LIT', 'Bill and Hillary Clinton National Airport', 34.7294, -92.2243, 4.5, 1.5, 3.50, true),
  
  -- Oklahoma
  ((SELECT id FROM markets WHERE market_code = 'tulsa'), 'TUL', 'Tulsa International Airport', 36.1984, -95.8881, 4.0, 1.4, 3.50, true),
  ((SELECT id FROM markets WHERE market_code = 'okc'), 'OKC', 'Will Rogers World Airport', 35.3931, -97.6007, 4.5, 1.4, 3.50, true),
  
  -- Texas
  ((SELECT id FROM markets WHERE market_code = 'dallas'), 'DFW', 'Dallas/Fort Worth International Airport', 32.8998, -97.0403, 5.0, 1.5, 4.00, true),
  ((SELECT id FROM markets WHERE market_code = 'dallas'), 'DAL', 'Dallas Love Field', 32.8471, -96.8518, 3.5, 1.4, 3.50, true),
  ((SELECT id FROM markets WHERE market_code = 'austin'), 'AUS', 'Austin-Bergstrom International Airport', 30.1975, -97.6664, 4.5, 1.5, 4.00, true),
  ((SELECT id FROM markets WHERE market_code = 'houston'), 'IAH', 'George Bush Intercontinental Airport', 29.9902, -95.3368, 4.5, 1.5, 4.00, true),
  ((SELECT id FROM markets WHERE market_code = 'houston'), 'HOU', 'William P. Hobby Airport', 29.6454, -95.2789, 3.5, 1.4, 3.50, true),
  ((SELECT id FROM markets WHERE market_code = 'san_antonio'), 'SAT', 'San Antonio International Airport', 29.5337, -98.4698, 4.0, 1.4, 3.50, true),
  
  -- West Coast
  ((SELECT id FROM markets WHERE market_code = 'seattle'), 'SEA', 'Seattle-Tacoma International Airport', 47.4502, -122.3088, 4.0, 1.6, 4.50, true),
  ((SELECT id FROM markets WHERE market_code = 'portland'), 'PDX', 'Portland International Airport', 45.5898, -122.5951, 4.0, 1.5, 4.00, true),
  ((SELECT id FROM markets WHERE market_code = 'sf_bay'), 'SFO', 'San Francisco International Airport', 37.6213, -122.3790, 3.5, 1.8, 5.50, true),
  ((SELECT id FROM markets WHERE market_code = 'sf_bay'), 'OAK', 'Oakland International Airport', 37.7213, -122.2208, 3.5, 1.6, 4.50, true),
  ((SELECT id FROM markets WHERE market_code = 'sf_bay'), 'SJC', 'San Jose International Airport', 37.3639, -121.9289, 3.5, 1.6, 4.50, true),
  ((SELECT id FROM markets WHERE market_code = 'la'), 'LAX', 'Los Angeles International Airport', 33.9416, -118.4085, 4.0, 1.8, 5.00, true),
  ((SELECT id FROM markets WHERE market_code = 'la'), 'BUR', 'Hollywood Burbank Airport', 34.2007, -118.3585, 3.0, 1.5, 4.00, true),
  
  -- Midwest
  ((SELECT id FROM markets WHERE market_code = 'chicago'), 'ORD', 'O''Hare International Airport', 41.9742, -87.9073, 4.5, 1.7, 5.00, true),
  ((SELECT id FROM markets WHERE market_code = 'chicago'), 'MDW', 'Chicago Midway International Airport', 41.7868, -87.7522, 3.5, 1.5, 4.00, true),
  ((SELECT id FROM markets WHERE market_code = 'denver'), 'DEN', 'Denver International Airport', 39.8561, -104.6737, 5.0, 1.5, 4.00, true),
  ((SELECT id FROM markets WHERE market_code = 'minneapolis'), 'MSP', 'Minneapolis-Saint Paul International', 44.8848, -93.2223, 4.0, 1.5, 4.00, true),
  
  -- East Coast
  ((SELECT id FROM markets WHERE market_code = 'dc'), 'DCA', 'Ronald Reagan Washington National', 38.8512, -77.0402, 3.0, 1.7, 5.00, true),
  ((SELECT id FROM markets WHERE market_code = 'dc'), 'IAD', 'Washington Dulles International', 38.9531, -77.4565, 4.5, 1.6, 4.50, true),
  ((SELECT id FROM markets WHERE market_code = 'dc'), 'BWI', 'Baltimore/Washington International', 39.1774, -76.6684, 4.0, 1.5, 4.00, true),
  ((SELECT id FROM markets WHERE market_code = 'nyc'), 'JFK', 'John F. Kennedy International Airport', 40.6413, -73.7781, 4.0, 1.9, 6.00, true),
  ((SELECT id FROM markets WHERE market_code = 'nyc'), 'LGA', 'LaGuardia Airport', 40.7769, -73.8740, 3.0, 1.7, 5.50, true),
  ((SELECT id FROM markets WHERE market_code = 'nyc'), 'EWR', 'Newark Liberty International Airport', 40.6895, -74.1745, 4.0, 1.8, 5.50, true),
  ((SELECT id FROM markets WHERE market_code = 'atlanta'), 'ATL', 'Hartsfield-Jackson Atlanta International', 33.6407, -84.4277, 4.5, 1.6, 4.50, true),
  ((SELECT id FROM markets WHERE market_code = 'miami'), 'MIA', 'Miami International Airport', 25.7959, -80.2870, 4.0, 1.7, 4.50, true),
  ((SELECT id FROM markets WHERE market_code = 'miami'), 'FLL', 'Fort Lauderdale-Hollywood International', 26.0742, -80.1506, 4.0, 1.6, 4.00, true)
ON CONFLICT (airport_code) DO UPDATE SET
  market_id = EXCLUDED.market_id,
  airport_name = EXCLUDED.airport_name,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  geofence_radius_km = EXCLUDED.geofence_radius_km,
  base_surge_multiplier = EXCLUDED.base_surge_multiplier,
  airport_fee = EXCLUDED.airport_fee,
  updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- SEED AIRPORT_PICKUP_ZONES - Detailed zones for key airports
-- ============================================================================
-- XNA (Northwest Arkansas Regional)
INSERT INTO airport_pickup_zones (airport_id, zone_name, zone_type, latitude, longitude, radius_meters, fare_multiplier, instructions)
SELECT 
  az.id,
  zone_data.zone_name,
  zone_data.zone_type,
  zone_data.latitude,
  zone_data.longitude,
  zone_data.radius_meters,
  zone_data.fare_multiplier,
  zone_data.instructions
FROM airport_zones az
CROSS JOIN (VALUES
  ('Terminal Pickup', 'pickup', 36.2820, -94.3065, 150, 1.05, 'Pull into designated rideshare pickup area at Terminal curb'),
  ('Cell Phone Lot', 'pickup', 36.2835, -94.3090, 200, 1.00, 'Wait in Cell Phone Lot until rider is ready'),
  ('Terminal Dropoff', 'dropoff', 36.2818, -94.3062, 100, 1.00, 'Drop off at Terminal departure level')
) AS zone_data(zone_name, zone_type, latitude, longitude, radius_meters, fare_multiplier, instructions)
WHERE az.airport_code = 'XNA'
ON CONFLICT (airport_id, zone_name) DO NOTHING;

-- LAX
INSERT INTO airport_pickup_zones (airport_id, zone_name, zone_type, latitude, longitude, radius_meters, fare_multiplier, instructions)
SELECT 
  az.id,
  zone_data.zone_name,
  zone_data.zone_type,
  zone_data.latitude,
  zone_data.longitude,
  zone_data.radius_meters,
  zone_data.fare_multiplier,
  zone_data.instructions
FROM airport_zones az
CROSS JOIN (VALUES
  ('LAXit Rideshare Pickup', 'pickup', 33.9425, -118.3920, 300, 1.10, 'All rideshare pickups at LAXit lot. Take shuttle from terminal.'),
  ('Terminal 1 Dropoff', 'dropoff', 33.9461, -118.4022, 150, 1.00, 'Upper level departures'),
  ('Terminal 3 Dropoff', 'dropoff', 33.9435, -118.4040, 150, 1.00, 'Upper level departures'),
  ('TBIT Dropoff', 'dropoff', 33.9415, -118.4105, 200, 1.05, 'Tom Bradley International Terminal')
) AS zone_data(zone_name, zone_type, latitude, longitude, radius_meters, fare_multiplier, instructions)
WHERE az.airport_code = 'LAX'
ON CONFLICT (airport_id, zone_name) DO NOTHING;

-- JFK
INSERT INTO airport_pickup_zones (airport_id, zone_name, zone_type, latitude, longitude, radius_meters, fare_multiplier, instructions)
SELECT 
  az.id,
  zone_data.zone_name,
  zone_data.zone_type,
  zone_data.latitude,
  zone_data.longitude,
  zone_data.radius_meters,
  zone_data.fare_multiplier,
  zone_data.instructions
FROM airport_zones az
CROSS JOIN (VALUES
  ('Terminal 1 Pickup', 'pickup', 40.6424, -73.7880, 150, 1.10, 'Arrivals level, follow rideshare signs'),
  ('Terminal 4 Pickup', 'pickup', 40.6437, -73.7820, 150, 1.10, 'Ground level near Door 4'),
  ('Terminal 5 Pickup', 'pickup', 40.6453, -73.7765, 150, 1.10, 'JetBlue terminal arrivals'),
  ('Terminal 7 Pickup', 'pickup', 40.6488, -73.7833, 150, 1.10, 'British Airways terminal'),
  ('Terminal 8 Pickup', 'pickup', 40.6454, -73.7895, 150, 1.10, 'American Airlines terminal')
) AS zone_data(zone_name, zone_type, latitude, longitude, radius_meters, fare_multiplier, instructions)
WHERE az.airport_code = 'JFK'
ON CONFLICT (airport_id, zone_name) DO NOTHING;

-- ATL
INSERT INTO airport_pickup_zones (airport_id, zone_name, zone_type, latitude, longitude, radius_meters, fare_multiplier, instructions)
SELECT 
  az.id,
  zone_data.zone_name,
  zone_data.zone_type,
  zone_data.latitude,
  zone_data.longitude,
  zone_data.radius_meters,
  zone_data.fare_multiplier,
  zone_data.instructions
FROM airport_zones az
CROSS JOIN (VALUES
  ('North Terminal Pickup', 'pickup', 33.6407, -84.4320, 200, 1.05, 'Ground Transportation level, North side'),
  ('South Terminal Pickup', 'pickup', 33.6400, -84.4200, 200, 1.05, 'Ground Transportation level, South side'),
  ('Domestic Dropoff', 'dropoff', 33.6410, -84.4277, 200, 1.00, 'Departures level')
) AS zone_data(zone_name, zone_type, latitude, longitude, radius_meters, fare_multiplier, instructions)
WHERE az.airport_code = 'ATL'
ON CONFLICT (airport_id, zone_name) DO NOTHING;

-- DFW
INSERT INTO airport_pickup_zones (airport_id, zone_name, zone_type, latitude, longitude, radius_meters, fare_multiplier, instructions)
SELECT 
  az.id,
  zone_data.zone_name,
  zone_data.zone_type,
  zone_data.latitude,
  zone_data.longitude,
  zone_data.radius_meters,
  zone_data.fare_multiplier,
  zone_data.instructions
FROM airport_zones az
CROSS JOIN (VALUES
  ('Terminal A Pickup', 'pickup', 32.8992, -97.0380, 150, 1.05, 'Lower level arrivals'),
  ('Terminal B Pickup', 'pickup', 32.8978, -97.0420, 150, 1.05, 'Lower level arrivals'),
  ('Terminal C Pickup', 'pickup', 32.8963, -97.0450, 150, 1.05, 'Lower level arrivals'),
  ('Terminal D Pickup', 'pickup', 32.8952, -97.0485, 150, 1.05, 'International arrivals'),
  ('Terminal E Pickup', 'pickup', 32.8988, -97.0510, 150, 1.05, 'Lower level arrivals')
) AS zone_data(zone_name, zone_type, latitude, longitude, radius_meters, fare_multiplier, instructions)
WHERE az.airport_code = 'DFW'
ON CONFLICT (airport_id, zone_name) DO NOTHING;

-- ============================================================================
-- VERIFY SEED DATA
-- ============================================================================
DO $$
DECLARE
  market_count INTEGER;
  settings_count INTEGER;
  cancel_fee_count INTEGER;
  airport_count INTEGER;
  zone_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO market_count FROM markets;
  SELECT COUNT(*) INTO settings_count FROM market_settings;
  SELECT COUNT(*) INTO cancel_fee_count FROM market_cancellation_fees;
  SELECT COUNT(*) INTO airport_count FROM airport_zones;
  SELECT COUNT(*) INTO zone_count FROM airport_pickup_zones;
  
  RAISE NOTICE '✅ Seed Data Complete:';
  RAISE NOTICE '   Markets: %', market_count;
  RAISE NOTICE '   Market Settings: %', settings_count;
  RAISE NOTICE '   Cancellation Fee Rules: %', cancel_fee_count;
  RAISE NOTICE '   Airport Zones: %', airport_count;
  RAISE NOTICE '   Airport Pickup Zones: %', zone_count;
END $$;

-- ============================================================================
-- SEED COMPLETE
-- ============================================================================
