"""
API Data Extractor for ML Pipeline
Connects to Phase 1 secure server APIs to gather weather and traffic data
"""

import requests
import json
import time
from datetime import datetime, timedelta
import pandas as pd
from typing import Dict, List, Any, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MLAPIDataExtractor:
    """
    Extracts data from Phase 1 secure server APIs for ML model training
    Uses secure /api/* endpoints that protect API keys on server-side
    """
    
    def __init__(self, base_url: str = "http://localhost:3001"):
        self.base_url = base_url
        self.session = requests.Session()
        # Set timeout for all requests
        self.default_timeout = 30
        logger.info("🔌 ML API Data Extractor initialized")
    
    def get_weather_data(self, lat: float, lng: float) -> Optional[Dict[str, Any]]:
        """
        Get current weather data from secure server endpoint
        Uses Phase 1 /api/weather/current endpoint
        """
        try:
            url = f"{self.base_url}/api/weather/current"
            params = {"lat": lat, "lng": lng}
            
            response = self.session.get(url, params=params, timeout=self.default_timeout)
            response.raise_for_status()
            
            weather_data = response.json()
            logger.info(f"✅ Weather data retrieved for {lat:.3f}, {lng:.3f}")
            
            # Extract ML-relevant features
            current = weather_data.get('current', {})
            return {
                'timestamp': datetime.now().isoformat(),
                'latitude': lat,
                'longitude': lng,
                'temperature': current.get('temperature', 0),
                'conditions': current.get('conditions', 'unknown'),
                'humidity': current.get('humidity', 0),
                'precipitation': current.get('precipitation', 0),
                'visibility': current.get('visibility', 10),
                'wind_speed': current.get('windSpeed', 0),
                'weather_severity': self._calculate_weather_severity(current)
            }
            
        except Exception as e:
            logger.error(f"❌ Weather API error: {e}")
            return None
    
    def get_traffic_data(self, zone_name: str) -> Optional[Dict[str, Any]]:
        """
        Get traffic data from secure server endpoint
        Uses Phase 1 /api/traffic/zone/{zone} endpoint
        """
        try:
            url = f"{self.base_url}/api/traffic/zone/{zone_name}"
            
            response = self.session.get(url, timeout=self.default_timeout)
            response.raise_for_status()
            
            traffic_data = response.json()
            logger.info(f"✅ Traffic data retrieved for zone: {zone_name}")
            
            return {
                'timestamp': datetime.now().isoformat(),
                'zone': zone_name,
                'traffic_severity': traffic_data.get('trafficSeverity', 'light'),
                'congestion_level': traffic_data.get('congestionLevel', 0),
                'travel_times': traffic_data.get('travelTimes', {}),
                'incidents_count': len(traffic_data.get('incidents', [])),
                'traffic_multiplier': self._calculate_traffic_multiplier(traffic_data)
            }
            
        except Exception as e:
            logger.error(f"❌ Traffic API error: {e}")
            return None
    
    def get_demand_forecast_data(self, zone: str, hours_ahead: int = 24) -> Optional[Dict[str, Any]]:
        """
        Get demand forecast from secure server endpoint
        Uses Phase 1 /api/rides/demand-forecast endpoint
        """
        try:
            url = f"{self.base_url}/api/rides/demand-forecast"
            params = {"zone": zone, "hours": hours_ahead}
            
            response = self.session.get(url, params=params, timeout=self.default_timeout)
            response.raise_for_status()
            
            forecast_data = response.json()
            logger.info(f"✅ Demand forecast retrieved for zone: {zone}")
            
            return {
                'timestamp': datetime.now().isoformat(),
                'zone': zone,
                'forecast_hours': hours_ahead,
                'predicted_demand': forecast_data.get('predictedDemand', []),
                'confidence_score': forecast_data.get('confidence', 0.5),
                'peak_hours': forecast_data.get('peakHours', []),
                'base_demand': forecast_data.get('baseDemand', 1.0)
            }
            
        except Exception as e:
            logger.error(f"❌ Demand forecast API error: {e}")
            return None
    
    def collect_zone_data_batch(self, zones: List[str]) -> pd.DataFrame:
        """
        Collect weather and traffic data for multiple zones
        Returns comprehensive dataset for ML training
        """
        zone_coordinates = {
            'downtown': (36.3729, -94.2088),
            'airport': (36.3850, -94.2200), 
            'business': (36.3650, -94.2000),
            'residential': (36.3800, -94.1950)
        }
        
        data_records = []
        
        for zone in zones:
            if zone not in zone_coordinates:
                logger.warning(f"⚠️ Unknown zone: {zone}")
                continue
            
            lat, lng = zone_coordinates[zone]
            
            # Get weather data
            weather_data = self.get_weather_data(lat, lng)
            
            # Get traffic data  
            traffic_data = self.get_traffic_data(zone)
            
            # Get demand forecast
            demand_data = self.get_demand_forecast_data(zone)
            
            if weather_data and traffic_data:
                # Combine all data sources
                combined_record = {
                    **weather_data,
                    **traffic_data,
                    'demand_prediction': demand_data.get('predicted_demand', []) if demand_data else [],
                    'hour_of_day': datetime.now().hour,
                    'day_of_week': datetime.now().weekday(),
                    'is_weekend': datetime.now().weekday() >= 5,
                    'collection_timestamp': datetime.now().isoformat()
                }
                
                data_records.append(combined_record)
            
            # Respectful delay to avoid overwhelming APIs
            time.sleep(0.5)
        
        df = pd.DataFrame(data_records)
        logger.info(f"✅ Collected data for {len(df)} zones")
        
        return df
    
    def _calculate_weather_severity(self, weather_data: Dict[str, Any]) -> float:
        """Calculate weather impact severity score (0-1)"""
        base_score = 0.0
        
        # Temperature extremes
        temp = weather_data.get('temperature', 20)
        if temp < 0 or temp > 35:  # Very cold or very hot
            base_score += 0.3
        elif temp < 5 or temp > 30:  # Cold or hot
            base_score += 0.1
        
        # Precipitation
        precipitation = weather_data.get('precipitation', 0)
        if precipitation > 0:
            base_score += min(precipitation * 0.1, 0.4)  # Max 0.4 for heavy rain
        
        # Visibility
        visibility = weather_data.get('visibility', 10)
        if visibility < 1:  # Very poor visibility
            base_score += 0.3
        elif visibility < 3:  # Poor visibility
            base_score += 0.1
        
        # Wind
        wind = weather_data.get('windSpeed', 0)
        if wind > 15:  # Strong wind
            base_score += 0.1
        
        return min(base_score, 1.0)
    
    def _calculate_traffic_multiplier(self, traffic_data: Dict[str, Any]) -> float:
        """Calculate traffic impact multiplier for pricing"""
        severity = traffic_data.get('trafficSeverity', 'light')
        congestion = traffic_data.get('congestionLevel', 0)
        incidents = len(traffic_data.get('incidents', []))
        
        base_multiplier = 1.0
        
        # Traffic severity impact
        if severity == 'heavy':
            base_multiplier += 0.3
        elif severity == 'moderate':
            base_multiplier += 0.15
        
        # Congestion level impact
        base_multiplier += (congestion / 100) * 0.2
        
        # Incidents impact  
        base_multiplier += incidents * 0.05
        
        return min(base_multiplier, 2.0)  # Cap at 2x multiplier
    
    def health_check(self) -> bool:
        """Check if all Phase 1 APIs are accessible"""
        try:
            # Test weather API
            weather_test = self.get_weather_data(36.3729, -94.2088)
            
            # Test traffic API  
            traffic_test = self.get_traffic_data('downtown')
            
            # Test demand forecast API (optional - may not exist yet)
            try:
                demand_test = self.get_demand_forecast_data('downtown', 1)
                logger.info("✅ Demand forecast API accessible")
            except:
                logger.warning("⚠️ Demand forecast API not available - proceeding without it")
                demand_test = True  # Don't fail health check for optional feature
            
            if weather_test and traffic_test and demand_test:
                logger.info("✅ All critical Phase 1 APIs are accessible")
                return True
            else:
                logger.error("❌ One or more critical APIs are not accessible")
                return False
                
        except Exception as e:
            logger.error(f"❌ API health check failed: {e}")
            return False

# Convenience function
def get_ml_api_extractor() -> MLAPIDataExtractor:
    """Get a new ML API data extractor instance"""
    return MLAPIDataExtractor()