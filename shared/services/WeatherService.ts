/**
 * Secure Client-Side Weather Service
 * Calls secure server endpoints instead of exposing API keys
 */

export interface WeatherCondition {
  current: {
    temperature: number;
    conditions: 'clear' | 'clouds' | 'rain' | 'snow' | 'fog';
    humidity: number;
    precipitation: number;
    visibility: number;
    windSpeed: number;
  };
  forecast: Array<{
    timestamp: number;
    temperature: number;
    conditions: string;
    precipitation_probability: number;
    precipitation_intensity: number;
  }>;
  alerts: Array<{
    title: string;
    description: string;
    severity: 'minor' | 'moderate' | 'severe';
  }>;
}

export class WeatherService {
  private static instance: WeatherService;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance(): WeatherService {
    if (!WeatherService.instance) {
      WeatherService.instance = new WeatherService();
    }
    return WeatherService.instance;
  }

  /**
   * Get current weather for a specific location
   * Calls secure server endpoint at /api/weather/current
   */
  async getCurrentWeather(lat: number, lng: number): Promise<WeatherCondition> {
    const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      const response = await fetch(`/api/weather/current?lat=${lat}&lng=${lng}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }

      const weather = await response.json();
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: weather,
        timestamp: Date.now()
      });

      return weather;
    } catch (error) {
      console.error('Weather service error:', error);
      return this.getFallbackWeather();
    }
  }

  /**
   * Get weather for multiple zones
   * Calls secure server endpoint at /api/weather/zones
   */
  async getZoneWeather(zones: Array<{ name: string; lat: number; lng: number }>): Promise<Record<string, WeatherCondition>> {
    const cacheKey = `zones_${zones.map(z => z.name).join('_')}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      const response = await fetch('/api/weather/zones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ zones }),
      });

      if (!response.ok) {
        throw new Error(`Zone weather API error: ${response.status}`);
      }

      const weatherMap = await response.json();
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: weatherMap,
        timestamp: Date.now()
      });

      return weatherMap;
    } catch (error) {
      console.error('Zone weather service error:', error);
      // Return fallback weather for all zones
      const fallback = this.getFallbackWeather();
      const result: Record<string, WeatherCondition> = {};
      zones.forEach(zone => {
        result[zone.name] = fallback;
      });
      return result;
    }
  }

  /**
   * Get weather impact factor for demand prediction
   * Calls secure server endpoint at /api/weather/impact
   */
  async getWeatherImpactFactor(conditions: string, precipitation?: number): Promise<number> {
    try {
      const params = new URLSearchParams({
        conditions,
        ...(precipitation !== undefined && { precipitation: precipitation.toString() })
      });

      const response = await fetch(`/api/weather/impact?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Weather impact API error: ${response.status}`);
      }

      const { impact } = await response.json();
      return impact;
    } catch (error) {
      console.error('Weather impact service error:', error);
      // Fallback impact factors
      const impactMap: Record<string, number> = {
        'clear': 1.0,
        'clouds': 0.95,
        'rain': 1.3,
        'snow': 1.5,
        'fog': 1.2
      };
      return impactMap[conditions.toLowerCase()] || 1.0;
    }
  }

  /**
   * Fallback weather data when API is unavailable
   */
  private getFallbackWeather(): WeatherCondition {
    return {
      current: {
        temperature: 20,
        conditions: 'clear',
        humidity: 50,
        precipitation: 0,
        visibility: 10,
        windSpeed: 5
      },
      forecast: [],
      alerts: []
    };
  }

  /**
   * Clear weather cache
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