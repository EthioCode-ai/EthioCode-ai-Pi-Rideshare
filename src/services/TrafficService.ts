/**
 * Secure Client-Side Traffic Service
 * Calls secure server endpoints instead of exposing API keys
 */

export interface TrafficData {
  zone: string;
  travelTimes: Record<string, number>; // zone name -> travel time in minutes
  trafficSeverity: 'light' | 'moderate' | 'heavy';
  incidents: TrafficIncident[];
  congestionLevel: number; // 0-100
  alternateRoutes: RouteAlternative[];
}

export interface TrafficIncident {
  id: string;
  type: 'accident' | 'construction' | 'weather' | 'event';
  location: { lat: number; lng: number };
  severity: 'minor' | 'moderate' | 'major';
  description: string;
  estimatedDuration: number; // minutes
}

export interface RouteAlternative {
  description: string;
  estimatedTime: number; // minutes
  distance: number; // miles
  impactFactor: number; // multiplier for pricing
}

export class TrafficService {
  private static instance: TrafficService;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

  static getInstance(): TrafficService {
    if (!TrafficService.instance) {
      TrafficService.instance = new TrafficService();
    }
    return TrafficService.instance;
  }

  /**
   * Get traffic data for a specific zone
   * Calls secure server endpoint at /api/traffic/zone/:zoneName
   */
  async getTrafficData(zoneName: string): Promise<TrafficData> {
    const cacheKey = `traffic_${zoneName}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      const response = await fetch(`/api/traffic/zone/${encodeURIComponent(zoneName)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Traffic API error: ${response.status}`);
      }

      const trafficData = await response.json();
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: trafficData,
        timestamp: Date.now()
      });

      return trafficData;
    } catch (error) {
      console.error('Traffic service error:', error);
      return this.getFallbackTrafficData(zoneName);
    }
  }

  /**
   * Get traffic data for all zones
   * Calls secure server endpoint at /api/traffic/zones
   */
  async getAllZonesTraffic(): Promise<Record<string, TrafficData>> {
    const cacheKey = 'all_zones_traffic';
    const cached = this.cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      const response = await fetch('/api/traffic/zones', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`All zones traffic API error: ${response.status}`);
      }

      const trafficMap = await response.json();
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: trafficMap,
        timestamp: Date.now()
      });

      return trafficMap;
    } catch (error) {
      console.error('All zones traffic service error:', error);
      
      // Return fallback data for all zones
      const zones = ['downtown', 'airport', 'business', 'residential'];
      const result: Record<string, TrafficData> = {};
      zones.forEach(zone => {
        result[zone] = this.getFallbackTrafficData(zone);
      });
      return result;
    }
  }

  /**
   * Calculate traffic impact factor for pricing
   */
  calculateTrafficImpact(trafficData: TrafficData): number {
    const severityMultiplier = {
      'light': 1.0,
      'moderate': 1.15,
      'heavy': 1.3
    };

    const congestionMultiplier = 1 + (trafficData.congestionLevel / 100) * 0.2;
    const incidentMultiplier = trafficData.incidents.length > 0 ? 1.1 : 1.0;

    return severityMultiplier[trafficData.trafficSeverity] * congestionMultiplier * incidentMultiplier;
  }

  /**
   * Get travel time between zones
   */
  getTravelTime(fromZone: string, toZone: string, trafficMap: Record<string, TrafficData>): number {
    const fromData = trafficMap[fromZone];
    if (!fromData || !fromData.travelTimes[toZone]) {
      return 12; // Default 12 minutes
    }
    return fromData.travelTimes[toZone];
  }

  /**
   * Analyze zone congestion levels
   */
  analyzeZoneCongestion(trafficMap: Record<string, TrafficData>): Record<string, 'low' | 'medium' | 'high'> {
    const result: Record<string, 'low' | 'medium' | 'high'> = {};
    
    Object.entries(trafficMap).forEach(([zone, data]) => {
      if (data.congestionLevel < 30) result[zone] = 'low';
      else if (data.congestionLevel < 60) result[zone] = 'medium';
      else result[zone] = 'high';
    });

    return result;
  }

  /**
   * Get optimal routing suggestions based on traffic
   */
  getOptimalRoute(fromZone: string, trafficMap: Record<string, TrafficData>): string[] {
    const fromData = trafficMap[fromZone];
    if (!fromData) return [];

    // Sort zones by travel time (ascending)
    return Object.entries(fromData.travelTimes)
      .sort(([,timeA], [,timeB]) => timeA - timeB)
      .map(([zone]) => zone);
  }

  /**
   * Fallback traffic data when API is unavailable
   */
  private getFallbackTrafficData(zoneName: string): TrafficData {
    const zones = ['downtown', 'airport', 'business', 'residential'];
    const travelTimes: Record<string, number> = {};
    
    zones.forEach(zone => {
      if (zone !== zoneName) {
        travelTimes[zone] = 10 + Math.floor(Math.random() * 8); // 10-18 minutes
      }
    });

    return {
      zone: zoneName,
      travelTimes,
      trafficSeverity: 'moderate',
      incidents: [],
      congestionLevel: 30 + Math.floor(Math.random() * 40), // 30-70%
      alternateRoutes: []
    };
  }

  /**
   * Clear traffic cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size for debugging
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}