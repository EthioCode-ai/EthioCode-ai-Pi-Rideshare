#!/usr/bin/env python3
"""
Pi Rideshare ML API Server
Flask API that exposes ML models for the Node.js backend
"""

import os
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
from functools import wraps

from algorithms.surge_pricing import DynamicSurgePricingModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

ML_API_KEY = os.environ.get('ML_API_KEY', 'pi-rideshare-ml-key-2025')

surge_model = DynamicSurgePricingModel()

def require_api_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        if api_key != ML_API_KEY:
            return jsonify({'error': 'Invalid API key'}), 401
        return f(*args, **kwargs)
    return decorated

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'service': 'Pi Rideshare ML API',
        'timestamp': datetime.now().isoformat(),
        'models': {'surge_pricing': surge_model.is_trained}
    })

@app.route('/api/ml/surge', methods=['POST'])
@require_api_key
def predict_surge():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        zone = data.get('zone', 'default')
        conditions = data.get('conditions', {})
        
        if 'active_drivers' in conditions and 'pending_requests' in conditions:
            drivers = conditions['active_drivers'] or 1
            requests = conditions['pending_requests'] or 1
            conditions['supply_demand_ratio'] = drivers / requests
        
        surge_result = surge_model.calculate_surge_multiplier(zone, conditions)
        
        return jsonify({
            'success': True,
            'zone': surge_result.zone,
            'multiplier': round(surge_result.final_multiplier, 2),
            'confidence': round(surge_result.confidence_score, 2),
            'components': {
                'base': surge_result.base_multiplier,
                'weather': round(surge_result.weather_multiplier, 2),
                'traffic': round(surge_result.traffic_multiplier, 2),
                'demand': round(surge_result.demand_multiplier, 2)
            },
            'reasoning': surge_result.reasoning,
            'timestamp': surge_result.timestamp.isoformat()
        })
    except Exception as e:
        logger.error(f"Surge prediction error: {e}")
        return jsonify({
            'success': False,
            'error': str(e),
            'multiplier': 1.0,
            'confidence': 0.0
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('ML_API_PORT', 5001))
    logger.info(f"🚀 Starting ML API Server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)