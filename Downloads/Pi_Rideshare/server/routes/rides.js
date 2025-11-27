/**
 * Secure Server-Side Ride History API
 * Handles database queries for historical ride data
 */

const express = require('express');
const router = express.Router();
const { getDB } = require('../database');

// Cache for ride data (30 minutes)
const rideCache = new Map();
const CACHE_DURATION = 30 * 60 * 1000;

// Zone boundaries
const zoneBoundaries = {
  'downtown': { latMin: 36.365, latMax: 36.380, lngMin: -94.210, lngMax: -94.190 },
  'airport': { latMin: 36.378, latMax: 36.392, lngMin: -94.230, lngMax: -94.210 },
  'business': { latMin: 36.358, latMax: 36.372, lngMin: -94.210, lngMax: -94.190 },
  'residential': { latMin: 36.372, latMax: 36.388, lngMin: -94.205, lngMax: -94.185 }
};

class RideHistoryService {
  async getHistoricalRides(startDate, endDate, zone) {
    const cacheKey = `history_${startDate}_${endDate}_${zone || 'all'}`;
    const cached = rideCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return cached.data;
    }

    try {
      const pool = getDB();

      let zoneCondition = '';
      let queryParams = [startDate, endDate];
      
      if (zone && zoneBoundaries[zone]) {
        const boundaries = zoneBoundaries[zone];
        zoneCondition = `AND pickup_lat BETWEEN $3 AND $4 AND pickup_lng BETWEEN $5 AND $6`;
        queryParams.push(boundaries.latMin, boundaries.latMax, boundaries.lngMin, boundaries.lngMax);
      }

      const query = `
        SELECT 
          DATE_TRUNC('hour', requested_at) as hour_bucket,
          COUNT(*) as ride_count,
          AVG(final_fare) as avg_fare,
          STRING_AGG(DISTINCT ride_type, ',') as ride_types,
          EXTRACT(DOW FROM requested_at) as day_of_week,
          EXTRACT(HOUR FROM requested_at) as hour_of_day
        FROM rides 
        WHERE requested_at >= $1 AND requested_at <= $2
          AND status IN ('completed', 'cancelled')
          ${zoneCondition}
        GROUP BY hour_bucket, day_of_week, hour_of_day
        ORDER BY hour_bucket
      `;

      const result = await pool.query(query, queryParams);
      
      const historyData = result.rows.map(row => {
        const rideTypes = {};
        if (row.ride_types) {
          const types = row.ride_types.split(',');
          types.forEach(type => {
            rideTypes[type] = (rideTypes[type] || 0) + 1;
          });
        }

        return {
          timestamp: new Date(row.hour_bucket).getTime(),
          rides: parseInt(row.ride_count),
          zone: zone || 'mixed',
          dayOfWeek: parseInt(row.day_of_week),
          averageFare: parseFloat(row.avg_fare) || 0,
          rideTypes,
          peakHours: this.identifyPeakHours([parseInt(row.hour_of_day)])
        };
      });

      // Cache the result
      rideCache.set(cacheKey, {
        data: historyData,
        timestamp: Date.now()
      });

      return historyData;
    } catch (error) {
      console.error('RideHistoryService Error:', error);
      return this.getFallbackHistoryData(startDate, endDate, zone);
    }
  }

  async getZoneAnalytics() {
    const cacheKey = 'zone_analytics';
    const cached = rideCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return cached.data;
    }

    const zones = Object.keys(zoneBoundaries);
    const analyticsMap = {};
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);

    for (const zone of zones) {
      try {
        const historyData = await this.getHistoricalRides(startDate.toISOString(), endDate.toISOString(), zone);
        
        analyticsMap[zone] = {
          zone,
          totalRides: historyData.reduce((sum, data) => sum + data.rides, 0),
          averageRides: historyData.length > 0 ? 
            historyData.reduce((sum, data) => sum + data.rides, 0) / historyData.length : 0,
          peakHours: this.calculatePeakHours(historyData),
          seasonal_patterns: this.calculateSeasonalPatterns(historyData),
          weatherCorrelation: this.getWeatherCorrelation(),
          fareAnalytics: this.calculateFareAnalytics(historyData)
        };
      } catch (error) {
        console.error(`Failed to get analytics for zone ${zone}:`, error);
        analyticsMap[zone] = this.getFallbackAnalytics(zone);
      }
    }

    // Cache the result
    rideCache.set(cacheKey, {
      data: analyticsMap,
      timestamp: Date.now()
    });

    return analyticsMap;
  }

  async getDriverAvailability() {
    try {
      const pool = getDB();

      const query = `
        SELECT 
          CASE 
            WHEN latitude BETWEEN 36.365 AND 36.380 AND longitude BETWEEN -94.210 AND -94.190 THEN 'downtown'
            WHEN latitude BETWEEN 36.378 AND 36.392 AND longitude BETWEEN -94.230 AND -94.210 THEN 'airport'
            WHEN latitude BETWEEN 36.358 AND 36.372 AND longitude BETWEEN -94.210 AND -94.190 THEN 'business'
            WHEN latitude BETWEEN 36.372 AND 36.388 AND longitude BETWEEN -94.205 AND -94.185 THEN 'residential'
            ELSE 'other'
          END as zone,
          COUNT(*) as available_drivers
        FROM driver_locations dl
        INNER JOIN users u ON dl.driver_id = u.id
        WHERE dl.is_available = true 
          AND u.user_type = 'driver'
          AND dl.updated_at > NOW() - INTERVAL '10 minutes'
        GROUP BY zone
      `;

      const result = await pool.query(query);
      const availability = {};
      
      result.rows.forEach(row => {
        if (row.zone !== 'other') {
          availability[row.zone] = parseInt(row.available_drivers);
        }
      });

      // Ensure all zones are represented
      Object.keys(zoneBoundaries).forEach(zone => {
        if (!availability[zone]) {
          availability[zone] = 0;
        }
      });

      return availability;
    } catch (error) {
      console.error('Failed to get driver availability:', error);
      return {
        downtown: 3,
        airport: 5,
        business: 2,
        residential: 4
      };
    }
  }

  identifyPeakHours(hours) {
    const commonPeakHours = [7, 8, 9, 17, 18, 19];
    return hours.filter(hour => commonPeakHours.includes(hour));
  }

  calculatePeakHours(historyData) {
    const hourCounts = {};
    
    historyData.forEach(data => {
      const hour = new Date(data.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + data.rides;
    });

    return Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));
  }

  calculateSeasonalPatterns(historyData) {
    const dayPatterns = new Array(7).fill(0);
    const dayCounts = new Array(7).fill(0);

    historyData.forEach(data => {
      const day = data.dayOfWeek;
      dayPatterns[day] += data.rides;
      dayCounts[day]++;
    });

    const averages = dayPatterns.map((sum, i) => dayCounts[i] > 0 ? sum / dayCounts[i] : 0);
    const overallAverage = averages.reduce((sum, avg) => sum + avg, 0) / 7;
    
    return averages.map(avg => overallAverage > 0 ? avg / overallAverage : 1);
  }

  getWeatherCorrelation() {
    return {
      clear: 1.0,
      rain: 1.3,
      snow: 1.5,
      clouds: 0.95
    };
  }

  calculateFareAnalytics(historyData) {
    const fares = historyData.map(data => data.averageFare).filter(fare => fare > 0);
    
    if (fares.length === 0) {
      return { average: 35, median: 30, surge_frequency: 0.15 };
    }

    const average = fares.reduce((sum, fare) => sum + fare, 0) / fares.length;
    const sortedFares = fares.sort((a, b) => a - b);
    const median = sortedFares[Math.floor(sortedFares.length / 2)];
    
    const surgeThreshold = average * 1.5;
    const surgeCount = fares.filter(fare => fare > surgeThreshold).length;
    const surge_frequency = surgeCount / fares.length;

    return { average, median, surge_frequency };
  }

  getFallbackHistoryData(startDate, endDate, zone) {
    const data = [];
    const start = new Date(startDate);
    const hourMs = 60 * 60 * 1000;

    for (let i = 0; i < 24; i++) {
      data.push({
        timestamp: start.getTime() + (i * hourMs),
        rides: Math.floor(Math.random() * 20) + 10,
        zone: zone || 'mixed',
        dayOfWeek: start.getDay(),
        averageFare: 35,
        rideTypes: { standard: 80, premium: 20 },
        peakHours: [7, 8, 17, 18]
      });
    }

    return data;
  }

  getFallbackAnalytics(zone) {
    return {
      zone,
      totalRides: 1000,
      averageRides: 15,
      peakHours: [7, 8, 17, 18],
      seasonal_patterns: [0.8, 0.7, 0.7, 0.8, 1.0, 1.2, 0.9],
      weatherCorrelation: {
        clear: 1.0,
        rain: 1.3,
        clouds: 0.95
      },
      fareAnalytics: {
        average: 35,
        median: 30,
        surge_frequency: 0.15
      }
    };
  }
}

const rideHistoryService = new RideHistoryService();

// API Routes

// Get historical rides
router.get('/history', async (req, res) => {
  try {
    const { startDate, endDate, zone } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const historyData = await rideHistoryService.getHistoricalRides(startDate, endDate, zone);
    res.json(historyData);
  } catch (error) {
    console.error('Ride history API error:', error);
    res.status(500).json({ error: 'Failed to get ride history' });
  }
});

// Get zone analytics
router.get('/analytics/zones', async (req, res) => {
  try {
    const analytics = await rideHistoryService.getZoneAnalytics();
    res.json(analytics);
  } catch (error) {
    console.error('Zone analytics API error:', error);
    res.status(500).json({ error: 'Failed to get zone analytics' });
  }
});

// Get driver availability by zone
router.get('/drivers/availability', async (req, res) => {
  try {
    const availability = await rideHistoryService.getDriverAvailability();
    res.json(availability);
  } catch (error) {
    console.error('Driver availability API error:', error);
    res.status(500).json({ error: 'Failed to get driver availability' });
  }
});
// Calculate route with Google Directions API
router.post('/routes/calculate', async (req, res) => {
  try {
    const { driverLocation, pickup, destination } = req.body;
    
    // Validate inputs
    if (!driverLocation?.lat || !driverLocation?.lng) {
      return res.status(400).json({ error: 'Driver location required' });
    }
    if (!pickup?.lat || !pickup?.lng) {
      return res.status(400).json({ error: 'Pickup location required' });
    }
    if (!destination?.lat || !destination?.lng) {
      return res.status(400).json({ error: 'Destination location required' });
    }

    const { Client } = require('@googlemaps/google-maps-services-js');
    const googleMapsClient = new Client({});

    // Haversine fallback function
    const haversineDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371; // Earth's radius in km
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
          Math.cos(lat2 * (Math.PI / 180)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const haversineFallback = (fromLat, fromLng, toLat, toLng) => {
      const distanceKm = haversineDistance(fromLat, fromLng, toLat, toLng);
      const distanceMiles = distanceKm * 0.621371;
      // Estimate: 30 km/h average speed in city
      const durationMinutes = Math.round((distanceKm / 30) * 60);
      return {
        distance: { km: parseFloat(distanceKm.toFixed(2)), miles: parseFloat(distanceMiles.toFixed(2)) },
        duration: { minutes: durationMinutes, seconds: durationMinutes * 60 },
        source: 'fallback'
      };
    };

    let toPickup, toDestination;
    let usesFallback = false;

    try {
      // Call 1: Driver → Pickup
      const route1 = await googleMapsClient.directions({
        params: {
          origin: `${driverLocation.lat},${driverLocation.lng}`,
          destination: `${pickup.lat},${pickup.lng}`,
          mode: 'driving',
          departure_time: 'now',
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
      });

      // Call 2: Pickup → Destination
      const route2 = await googleMapsClient.directions({
        params: {
          origin: `${pickup.lat},${pickup.lng}`,
          destination: `${destination.lat},${destination.lng}`,
          mode: 'driving',
          departure_time: 'now',
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
      });

      if (!route1.data.routes?.length || !route2.data.routes?.length) {
        throw new Error('No routes found');
      }

      const leg1 = route1.data.routes[0].legs[0];
      const leg2 = route2.data.routes[0].legs[0];

      // Extract polyline from overview_polyline
      const polyline1 = route1.data.routes[0].overview_polyline?.points || null;
      const polyline2 = route2.data.routes[0].overview_polyline?.points || null;

      // Extract and format steps for turn-by-turn navigation
      const formatSteps = (steps) => {
        if (!steps || !Array.isArray(steps)) return [];
        return steps.map(step => ({
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
      };

      const steps1 = formatSteps(leg1.steps);
      const steps2 = formatSteps(leg2.steps);

      toPickup = {
        distance: {
          km: parseFloat((leg1.distance.value / 1000).toFixed(2)),
          miles: parseFloat((leg1.distance.value / 1609.34).toFixed(2)),
        },
        duration: {
          minutes: Math.round(leg1.duration.value / 60),
          seconds: leg1.duration.value,
        },
        polyline: polyline1,
        steps: steps1,
        source: 'google_maps',
      };

      toDestination = {
        distance: {
          km: parseFloat((leg2.distance.value / 1000).toFixed(2)),
          miles: parseFloat((leg2.distance.value / 1609.34).toFixed(2)),
        },
        duration: {
          minutes: Math.round(leg2.duration.value / 60),
          seconds: leg2.duration.value,
        },
        polyline: polyline2,
        steps: steps2,
        source: 'google_maps',
      };

    } catch (googleError) {
      console.error('Google Maps API error, using fallback:', googleError.message);
      usesFallback = true;

      // Fallback calculations
      toPickup = haversineFallback(
        driverLocation.lat,
        driverLocation.lng,
        pickup.lat,
        pickup.lng
      );

      toDestination = haversineFallback(
        pickup.lat,
        pickup.lng,
        destination.lat,
        destination.lng
      );
    }

    // Calculate totals
    const totalTrip = {
      distance: {
        km: parseFloat((toPickup.distance.km + toDestination.distance.km).toFixed(2)),
        miles: parseFloat((toPickup.distance.miles + toDestination.distance.miles).toFixed(2)),
      },
      duration: {
        minutes: toPickup.duration.minutes + toDestination.duration.minutes,
        seconds: toPickup.duration.seconds + toDestination.duration.seconds,
      },
    };

    res.json({
      success: true,
      toPickup,
      toDestination,
      totalTrip,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Route calculation error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to calculate routes',
      message: error.message 
    });
  }
});

module.exports = router;
