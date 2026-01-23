#!/usr/bin/env python3
"""
Pi Rideshare ML API Server - Simplified
"""

import os
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
from functools import wraps

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

ML_API_KEY = os.environ.get('ML_API_KEY', 'pi-rideshare-ml-key-2025')

def require_api_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        if api_key != ML_API_KEY:
            return jsonify({'error': 'Invalid API key'}), 401
        return f(*args, **kwargs)
    return decorated

def calculate_surge(zone, conditions):
    """Simple surge calculation without ML model"""
    now = datetime.now()
    hour = now.hour
    
    base = 1.0
    
    # Time-based surge
    if hour in [7, 8, 9, 17, 18, 19]:
        base += 0.4
        reasoning = "Rush hour"
    elif hour >= 22 or hour <= 4:
        base += 0.2
        reasoning = "Late night"
    else:
        reasoning = "Normal conditions"
    
    # Weather impact
    weather = conditions.get('weather_condition', 'clear')
    weather_mult = {'clear': 1.0, 'cloudy': 1.1, 'rain': 1.3, 'snow': 1.8, 'storm': 2.0}
    weather_factor = weather_mult.get(weather, 1.0)
    
    # Traffic impact
    traffic_delay = conditions.get('traffic_delay_minutes', 0)
    traffic_factor = 1.0 + min(traffic_delay / 60, 0.8)
    
    # Supply/demand
    drivers = conditions.get('active_drivers', 1) or 1
    requests = conditions.get('pending_requests', 1) or 1
    demand_factor = min(requests / drivers, 3.0) if drivers > 0 else 1.5
    
    final = base * weather_factor * traffic_factor * (0.7 + 0.3 * demand_factor)
    final = max(1.0, min(5.0, final))
    
    return {
        'multiplier': round(final, 2),
        'confidence': 0.75,
        'base': base,
        'weather': round(weather_factor, 2),
        'traffic': round(traffic_factor, 2),
        'demand': round(demand_factor, 2),
        'reasoning': reasoning
    }

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'Pi Rideshare ML API',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/ml/surge', methods=['POST'])
@require_api_key
def predict_surge():
    try:
        data = request.get_json() or {}
        zone = data.get('zone', 'default')
        conditions = data.get('conditions', {})
        
        result = calculate_surge(zone, conditions)
        
        return jsonify({
            'success': True,
            'zone': zone,
            'multiplier': result['multiplier'],
            'confidence': result['confidence'],
            'components': {
                'base': result['base'],
                'weather': result['weather'],
                'traffic': result['traffic'],
                'demand': result['demand']
            },
            'reasoning': result['reasoning'],
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Surge error: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'multiplier': 1.0,
            'confidence': 0.0
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('ML_API_PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)