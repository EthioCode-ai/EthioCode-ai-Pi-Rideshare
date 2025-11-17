/**
 * Secure Server-Side Traffic API
 * Handles Google Maps API calls with protected API keys
 */

const express = require('express');
const router = express.Router();

// Cache for traffic data (2 minutes)
const trafficCache = new Map();
const CACHE_DURATION = 2 * 60 * 1000;

// Default zone coordinates (Bentonville, AR area)
const zones = [
  { name: 'downtown', lat: 36.3729, lng: -94.2088 },
  { name: 'airport', lat: 36.3850, lng: -94.2200 },
  { name: 'business', lat: 36.3650, lng: -94.2000 },
  { name: 'residential', lat: 36.3800, lng: -94.1950 },
  { name: 'retail', lat: 36.3680, lng: -94.2080 }
];

class TrafficService {
  constructor() {
    this.API_KEY = process.env.GOOGLE_MAPS_API_KEY;
  }

  async getTrafficData(zoneName) {
    const cacheKey = `traffic_${zoneName}`;
    const cached = trafficCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return cached.data;
    }

    try {
      const zone = zones.find(z => z.name === zoneName);
      if (!zone) {
        throw new Error(`Zone ${zoneName} not found`);
      }

      // Get travel times to all other zones
      const travelTimes = await this.calculateTravelTimes(zone);
      
      // Analyze traffic severity
      const trafficSeverity = this.analyzeTrafficSeverity(travelTimes);
      
      // Calculate congestion level
      const congestionLevel = this.calculateCongestionLevel(travelTimes);

      const trafficData = {
        zone: zoneName,
        travelTimes: Object.fromEntries(travelTimes), // Convert Map to object for JSON
        trafficSeverity,
        incidents: [], // Placeholder for traffic incidents
        congestionLevel,
        alternateRoutes: []
      };

      // Cache the result
      trafficCache.set(cacheKey, {
        data: trafficData,
        timestamp: Date.now()
      });

      return trafficData;
    } catch (error) {
      console.error('Traffic Service Error:', error);
      return this.getFallbackTrafficData(zoneName);
    }
  }

  async calculateTravelTimes(fromZone) {
    const travelTimes = new Map();

    // Use Google Maps Distance Matrix API
    const destinations = zones
      .filter(z => z.name !== fromZone.name)
      .map(z => `${z.lat},${z.lng}`)
      .join('|');

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${fromZone.lat},${fromZone.lng}&destinations=${destinations}&departure_time=now&traffic_model=best_guess&key=${this.API_KEY}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Distance Matrix API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.status === 'OK') {
        data.rows[0].elements.forEach((element, index) => {
          const zoneName = zones.filter(z => z.name !== fromZone.name)[index].name;
          
          if (element.status === 'OK') {
            const duration = element.duration_in_traffic?.value || element.duration?.value || 0;
            travelTimes.set(zoneName, Math.ceil(duration / 60));
          } else {
            // Fallback calculation
            const targetZone = zones.find(z => z.name === zoneName);
            const distance = this.calculateDistance(fromZone.lat, fromZone.lng, targetZone.lat, targetZone.lng);
            travelTimes.set(zoneName, Math.ceil(distance / 0.5));
          }
        });
      }
    } catch (error) {
      console.error('Distance Matrix API failed:', error);
      // Fallback to distance-based estimates
      zones.forEach(zone => {
        if (zone.name !== fromZone.name) {
          const distance = this.calculateDistance(fromZone.lat, fromZone.lng, zone.lat, zone.lng);
          travelTimes.set(zone.name, Math.ceil(distance / 0.5));
        }
      });
    }

    return travelTimes;
  }

  analyzeTrafficSeverity(travelTimes) {
    const times = Array.from(travelTimes.values());
    const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    
    if (averageTime > 25) return 'heavy';
    if (averageTime > 15) return 'moderate';
    return 'light';
  }

  calculateCongestionLevel(travelTimes) {
    const times = Array.from(travelTimes.values());
    const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    
    let congestion = Math.min(100, (averageTime - 10) * 4);
    const variance = times.reduce((sum, time) => sum + Math.pow(time - averageTime, 2), 0) / times.length;
    congestion += Math.sqrt(variance) * 2;
    
    return Math.max(0, Math.min(100, congestion));
  }

  getFallbackTrafficData(zoneName) {
    const travelTimes = {};
    zones.forEach(zone => {
      if (zone.name !== zoneName) {
        travelTimes[zone.name] = 12; // Default 12 minute travel time
      }
    });

    return {
      zone: zoneName,
      travelTimes,
      trafficSeverity: 'moderate',
      incidents: [],
      congestionLevel: 30,
      alternateRoutes: []
    };
  }

  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}

const trafficService = new TrafficService();

// API Routes

// Get traffic data for a specific zone
router.get('/zone/:zoneName', async (req, res) => {
  try {
    const { zoneName } = req.params;
    const trafficData = await trafficService.getTrafficData(zoneName);
    res.json(trafficData);
  } catch (error) {
    console.error('Traffic API error:', error);
    res.status(500).json({ error: 'Failed to get traffic data' });
  }
});

// Get traffic data for all zones
router.get('/zones', async (req, res) => {
  try {
    const trafficMap = {};
    
    const promises = zones.map(async zone => {
      try {
        const trafficData = await trafficService.getTrafficData(zone.name);
        trafficMap[zone.name] = trafficData;
      } catch (error) {
        console.error(`Failed to get traffic for ${zone.name}:`, error);
        trafficMap[zone.name] = trafficService.getFallbackTrafficData(zone.name);
      }
    });

    await Promise.all(promises);
    res.json(trafficMap);
  } catch (error) {
    console.error('Multi-zone traffic API error:', error);
    res.status(500).json({ error: 'Failed to get traffic data for zones' });
  }
});

module.exports = router;