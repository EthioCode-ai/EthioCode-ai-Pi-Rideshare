/**
 * Secure Client-Side Ride History Service
 * Calls secure server endpoints instead of direct database access
 */

export interface RideHistoryData {
  timestamp: number;
  rides: number;
  zone: string;
  dayOfWeek: number;
  averageFare: number;
  rideTypes: Record<string, number>;
  peakHours: number[];
}

export interface ZoneAnalytics {
  zone: string;
  totalRides: number;
  averageRides: number;
  peakHours: number[];
  seasonal_patterns: number[];
  weatherCorrelation: Record<string, number>;
  fareAnalytics: {
    average: number;
    median: number;
    surge_frequency: number;
  };
}

export class RideHistoryService {
  private static instance: RideHistoryService;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  static getInstance(): RideHistoryService {
    if (!RideHistoryService.instance) {
      RideHistoryService.instance = new RideHistoryService();
    }
    return RideHistoryService.instance;
  }

  /**
   * Get historical ride data for analysis
   * Calls secure server endpoint at /api/rides/history
   */
  async getHistoricalRides(
    startDate: Date, 
    endDate: Date, 
    zone?: string
  ): Promise<RideHistoryData[]> {
    const cacheKey = `history_${startDate.getTime()}_${endDate.getTime()}_${zone || 'all'}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        ...(zone && { zone })
      });

      const response = await fetch(`/api/rides/history?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Ride history API error: ${response.status}`);
      }

      const historyData = await response.json();
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: historyData,
        timestamp: Date.now()
      });

      return historyData;
    } catch (error) {
      console.error('Ride history service error:', error);
      return this.getFallbackHistoryData(startDate, endDate, zone);
    }
  }

  /**
   * Get zone analytics for all zones
   * Calls secure server endpoint at /api/rides/analytics/zones
   */
  async getZoneAnalytics(): Promise<Record<string, ZoneAnalytics>> {
    const cacheKey = 'zone_analytics';
    const cached = this.cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      const response = await fetch('/api/rides/analytics/zones', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Zone analytics API error: ${response.status}`);
      }

      const analytics = await response.json();
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: analytics,
        timestamp: Date.now()
      });

      return analytics;
    } catch (error) {
      console.error('Zone analytics service error:', error);
      return this.getFallbackZoneAnalytics();
    }
  }

  /**
   * Get driver availability by zone
   * Calls secure server endpoint at /api/rides/drivers/availability
   */
  async getDriverAvailability(): Promise<Record<string, number>> {
    const cacheKey = 'driver_availability';
    const cached = this.cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < 5 * 60 * 1000) { // 5 minutes for availability
      return cached.data;
    }

    try {
      const response = await fetch('/api/rides/drivers/availability', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Driver availability API error: ${response.status}`);
      }

      const availability = await response.json();
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: availability,
        timestamp: Date.now()
      });

      return availability;
    } catch (error) {
      console.error('Driver availability service error:', error);
      return this.getFallbackDriverAvailability();
    }
  }

  /**
   * Calculate demand patterns from historical data
   */
  calculateDemandPatterns(historyData: RideHistoryData[]): {
    hourlyPatterns: Record<number, number>;
    dailyPatterns: Record<number, number>;
    peakHours: number[];
  } {
    const hourlyPatterns: Record<number, number> = {};
    const dailyPatterns: Record<number, number> = {};
    
    // Initialize patterns
    for (let i = 0; i < 24; i++) hourlyPatterns[i] = 0;
    for (let i = 0; i < 7; i++) dailyPatterns[i] = 0;

    // Count occurrences
    const hourlyCounts: Record<number, number> = {};
    const dailyCounts: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hourlyCounts[i] = 0;
    for (let i = 0; i < 7; i++) dailyCounts[i] = 0;

    historyData.forEach(data => {
      const date = new Date(data.timestamp);
      const hour = date.getHours();
      const day = data.dayOfWeek;

      hourlyPatterns[hour] += data.rides;
      hourlyCounts[hour]++;
      
      dailyPatterns[day] += data.rides;
      dailyCounts[day]++;
    });

    // Calculate averages
    Object.keys(hourlyPatterns).forEach(hour => {
      const h = parseInt(hour);
      if (hourlyCounts[h] > 0) {
        hourlyPatterns[h] = hourlyPatterns[h] / hourlyCounts[h];
      }
    });

    Object.keys(dailyPatterns).forEach(day => {
      const d = parseInt(day);
      if (dailyCounts[d] > 0) {
        dailyPatterns[d] = dailyPatterns[d] / dailyCounts[d];
      }
    });

    // Identify peak hours
    const peakHours = Object.entries(hourlyPatterns)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 6)
      .map(([hour]) => parseInt(hour));

    return { hourlyPatterns, dailyPatterns, peakHours };
  }

  /**
   * Calculate surge probability based on historical data
   */
  calculateSurgeProbability(
    historyData: RideHistoryData[],
    currentHour: number,
    currentDay: number
  ): number {
    const relevantData = historyData.filter(data => {
      const date = new Date(data.timestamp);
      return date.getHours() === currentHour && data.dayOfWeek === currentDay;
    });

    if (relevantData.length === 0) return 0.15; // Default 15%

    const surgeThreshold = 1.5; // 1.5x base fare
    const totalRides = relevantData.reduce((sum, data) => sum + data.rides, 0);
    const avgRides = totalRides / relevantData.length;
    
    // Surge probability increases with demand
    if (avgRides > 25) return 0.8;
    if (avgRides > 20) return 0.6;
    if (avgRides > 15) return 0.4;
    if (avgRides > 10) return 0.2;
    return 0.05;
  }

  /**
   * Fallback historical data when API is unavailable
   */
  private getFallbackHistoryData(startDate: Date, endDate: Date, zone?: string): RideHistoryData[] {
    const data: RideHistoryData[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const hourMs = 60 * 60 * 1000;

    let current = new Date(start);
    while (current <= end) {
      data.push({
        timestamp: current.getTime(),
        rides: Math.floor(Math.random() * 20) + 5,
        zone: zone || 'mixed',
        dayOfWeek: current.getDay(),
        averageFare: 25 + Math.random() * 20,
        rideTypes: { standard: 70, premium: 30 },
        peakHours: [7, 8, 17, 18, 19]
      });
      current = new Date(current.getTime() + hourMs);
    }

    return data;
  }

  /**
   * Fallback zone analytics when API is unavailable
   */
  private getFallbackZoneAnalytics(): Record<string, ZoneAnalytics> {
    const zones = ['downtown', 'airport', 'business', 'residential'];
    const result: Record<string, ZoneAnalytics> = {};

    zones.forEach(zone => {
      result[zone] = {
        zone,
        totalRides: 800 + Math.floor(Math.random() * 400),
        averageRides: 12 + Math.floor(Math.random() * 8),
        peakHours: [7, 8, 17, 18, 19],
        seasonal_patterns: [0.8, 0.7, 0.7, 0.9, 1.1, 1.2, 1.0],
        weatherCorrelation: {
          clear: 1.0,
          rain: 1.3,
          snow: 1.5,
          clouds: 0.95
        },
        fareAnalytics: {
          average: 30 + Math.random() * 10,
          median: 25 + Math.random() * 8,
          surge_frequency: 0.1 + Math.random() * 0.2
        }
      };
    });

    return result;
  }

  /**
   * Fallback driver availability when API is unavailable
   */
  private getFallbackDriverAvailability(): Record<string, number> {
    return {
      downtown: 2 + Math.floor(Math.random() * 4),
      airport: 3 + Math.floor(Math.random() * 5),
      business: 1 + Math.floor(Math.random() * 3),
      residential: 3 + Math.floor(Math.random() * 4)
    };
  }

  /**
   * Clear ride history cache
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