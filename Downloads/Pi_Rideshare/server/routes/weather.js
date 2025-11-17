/**
 * Secure Server-Side Weather API
 * Handles OpenWeather API calls with protected API keys
 */

const express = require('express');
const router = express.Router();

// Cache for weather data (5 minutes)
const weatherCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;

// Weather service class
class WeatherService {
  constructor() {
    this.API_KEY = process.env.OPENWEATHER_API_KEY;
    this.BASE_URL = 'https://api.openweathermap.org/data/2.5';
  }

  async getCurrentWeather(lat, lng) {
    const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    const cached = weatherCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return cached.data;
    }

    try {
      // Current weather
      const currentResponse = await fetch(
        `${this.BASE_URL}/weather?lat=${lat}&lon=${lng}&appid=${this.API_KEY}&units=metric`
      );
      
      if (!currentResponse.ok) {
        throw new Error(`Weather API error: ${currentResponse.status}`);
      }
      
      const currentData = await currentResponse.json();

      // Forecast
      const forecastResponse = await fetch(
        `${this.BASE_URL}/forecast?lat=${lat}&lon=${lng}&appid=${this.API_KEY}&units=metric&cnt=24`
      );
      
      const forecastData = forecastResponse.ok ? await forecastResponse.json() : { list: [] };

      const weatherCondition = {
        current: {
          temperature: currentData.main.temp,
          conditions: this.mapWeatherCondition(currentData.weather[0].main),
          humidity: currentData.main.humidity,
          precipitation: currentData.rain?.['1h'] || currentData.snow?.['1h'] || 0,
          visibility: currentData.visibility / 1000,
          windSpeed: currentData.wind.speed
        },
        forecast: forecastData.list.map(item => ({
          timestamp: item.dt * 1000,
          temperature: item.main.temp,
          conditions: item.weather[0].main,
          precipitation_probability: item.pop * 100,
          precipitation_intensity: item.rain?.['3h'] || item.snow?.['3h'] || 0
        })),
        alerts: []
      };

      // Cache the result
      weatherCache.set(cacheKey, {
        data: weatherCondition,
        timestamp: Date.now()
      });

      return weatherCondition;
    } catch (error) {
      console.error('Weather Service Error:', error);
      return this.getFallbackWeather();
    }
  }

  mapWeatherCondition(openWeatherCondition) {
    const condition = openWeatherCondition.toLowerCase();
    
    if (condition.includes('rain') || condition.includes('drizzle') || condition.includes('thunderstorm')) {
      return 'rain';
    }
    if (condition.includes('snow') || condition.includes('sleet')) {
      return 'snow';
    }
    if (condition.includes('fog') || condition.includes('mist') || condition.includes('haze')) {
      return 'fog';
    }
    if (condition.includes('cloud')) {
      return 'clouds';
    }
    
    return 'clear';
  }

  getFallbackWeather() {
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

  getWeatherImpactFactor(conditions, precipitation = 0) {
    const impactMap = {
      'clear': 1.0,
      'clouds': 0.95,
      'rain': 1.3 + (precipitation * 0.1),
      'snow': 1.5 + (precipitation * 0.15),
      'fog': 1.2
    };

    return impactMap[conditions.toLowerCase()] || 1.0;
  }
}

const weatherService = new WeatherService();

// API Routes

// Get current weather for a location
router.get('/current', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const weather = await weatherService.getCurrentWeather(parseFloat(lat), parseFloat(lng));
    res.json(weather);
  } catch (error) {
    console.error('Weather API error:', error);
    res.status(500).json({ error: 'Failed to get weather data' });
  }
});

// Get weather for multiple zones
router.post('/zones', async (req, res) => {
  try {
    const { zones } = req.body;
    
    if (!zones || !Array.isArray(zones)) {
      return res.status(400).json({ error: 'Zones array is required' });
    }

    const weatherMap = {};
    
    const promises = zones.map(async zone => {
      try {
        const weather = await weatherService.getCurrentWeather(zone.lat, zone.lng);
        weatherMap[zone.name] = weather;
      } catch (error) {
        console.error(`Failed to get weather for ${zone.name}:`, error);
        weatherMap[zone.name] = weatherService.getFallbackWeather();
      }
    });

    await Promise.all(promises);
    res.json(weatherMap);
  } catch (error) {
    console.error('Multi-zone weather API error:', error);
    res.status(500).json({ error: 'Failed to get weather data for zones' });
  }
});

// Get weather impact factor
router.get('/impact', async (req, res) => {
  try {
    const { conditions, precipitation } = req.query;
    const impact = weatherService.getWeatherImpactFactor(conditions, parseFloat(precipitation) || 0);
    res.json({ impact });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate weather impact' });
  }
});

module.exports = router;