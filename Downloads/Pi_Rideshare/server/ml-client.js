/**
 * ML API Client for Pi Rideshare
 * Calls the Python ML API server for surge pricing predictions
 */

const ML_API_URL = process.env.ML_API_URL || 'https://pi-rideshare-ml.onrender.com';
const ML_API_KEY = process.env.ML_API_KEY || 'pi-rideshare-ml-key-2025';

const mlClient = {
  /**
   * Predict surge multiplier for a zone
   * @param {Object} params - Prediction parameters
   * @param {string} params.zone - Zone name
   * @param {number} params.lat - Latitude
   * @param {number} params.lng - Longitude
   * @param {Object} params.conditions - Current conditions
   * @returns {Object} Surge prediction result
   */
  async predictSurge({ zone, lat, lng, conditions = {} }) {
    try {
      const response = await fetch(`${ML_API_URL}/api/ml/surge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': ML_API_KEY
        },
        body: JSON.stringify({
          zone: zone || 'default',
          lat,
          lng,
          conditions: {
            weather_condition: conditions.weather || 'clear',
            traffic_delay_minutes: conditions.trafficDelay || 0,
            active_drivers: conditions.activeDrivers || 0,
            pending_requests: conditions.pendingRequests || 0
          }
        })
      });

      if (!response.ok) {
        console.warn(`⚠️ ML API returned ${response.status}`);
        return null;
      }

      const result = await response.json();
      
      if (result.success) {
        console.log(`🤖 ML Surge: ${result.multiplier}x (${result.confidence * 100}% confidence)`);
        return {
          multiplier: result.multiplier,
          confidence: result.confidence,
          components: result.components,
          reasoning: result.reasoning
        };
      }
      
      return null;
    } catch (error) {
      console.error('❌ ML API error:', error.message);
      return null;
    }
  },

  /**
   * Check ML API health
   * @returns {boolean} Whether ML API is available
   */
  async isHealthy() {
    try {
      const response = await fetch(`${ML_API_URL}/health`, {
        method: 'GET',
        timeout: 3000
      });
      return response.ok;
    } catch {
      return false;
    }
  }
};

module.exports = mlClient;