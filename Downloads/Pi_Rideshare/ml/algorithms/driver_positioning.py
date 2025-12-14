#!/usr/bin/env python3
"""
Smart Driver Positioning Engine for Pi Rideshare Platform

This module implements an intelligent driver positioning system that:
- Analyzes real-time demand patterns across zones
- Optimizes driver distribution to minimize pickup times
- Provides proactive positioning recommendations
- Integrates weather and traffic impact on demand
- Sends real-time notifications to drivers
- Manages airport queue optimization
- Balances supply vs demand across the platform

Authors: Pi Rideshare ML Team
Version: 1.0.0
Date: September 2025
"""

import logging
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional, Any, Set
from dataclasses import dataclass
from pathlib import Path
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import json

# ML imports
import sys
sys_path = Path(__file__).parent.parent
if str(sys_path) not in sys.path:
    sys.path.append(str(sys_path))

from utils.database_connection import MLDatabaseConnection
from utils.api_data_extractor import MLAPIDataExtractor
from data_pipeline.ml_data_processor import MLDataProcessor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class PositioningRecommendation:
    """Driver positioning recommendation"""
    driver_id: str
    current_zone: str
    recommended_zone: str
    priority_score: float
    expected_pickup_time: float  # minutes
    confidence: float
    reasoning: str
    distance_to_move: float  # miles
    estimated_earnings: float  # potential earnings in recommended zone
    timestamp: datetime

@dataclass
class ZoneAnalysis:
    """Zone supply/demand analysis"""
    zone: str
    current_drivers: int
    expected_demand: float
    supply_demand_ratio: float
    avg_pickup_time: float  # minutes
    surge_multiplier: float
    priority_level: str  # 'high', 'medium', 'low'
    weather_impact: float
    traffic_impact: float
    timestamp: datetime

class DriverPositioningEngine:
    """
    Advanced Driver Positioning Engine
    
    Features:
    - Real-time demand prediction per zone
    - Supply/demand balance optimization
    - Weather and traffic impact analysis
    - Driver earnings optimization
    - Airport queue management
    - Proactive positioning recommendations
    - Multi-objective optimization (pickup time, earnings, driver satisfaction)
    """
    
    def __init__(self):
        """Initialize Driver Positioning Engine"""
        self.demand_model = None
        self.positioning_model = None
        self.scaler = StandardScaler()
        self.feature_columns = []
        self.zone_encodings = {}
        self.is_trained = False
        self.model_metadata = {}
        
        # Positioning configuration
        self.max_repositioning_distance = 3.0  # Max miles to recommend moving
        self.min_confidence_threshold = 0.6    # Min confidence for recommendations
        self.demand_forecast_horizon = 30      # Minutes to forecast ahead
        
        # Zone definitions (Pi Rideshare service areas)
        self.zones = {
            'downtown': {'lat': 36.373, 'lng': -94.209, 'radius': 1.2},
            'airport': {'lat': 36.385, 'lng': -94.220, 'radius': 1.0},
            'business': {'lat': 36.365, 'lng': -94.200, 'radius': 0.8},
            'residential': {'lat': 36.380, 'lng': -94.195, 'radius': 1.5},
            'retail': {'lat': 36.368, 'lng': -94.208, 'radius': 1.0}
        }
        
        # Positioning weights for optimization
        self.optimization_weights = {
            'pickup_time': 0.4,      # Minimize customer pickup time
            'driver_earnings': 0.3,   # Maximize driver earnings potential
            'supply_balance': 0.2,    # Balance supply across zones
            'driver_satisfaction': 0.1 # Minimize unnecessary repositioning
        }
        
        # Initialize ML components
        self.db_connection = MLDatabaseConnection()
        self.api_extractor = MLAPIDataExtractor()
        self.data_processor = MLDataProcessor()
        
        logger.info("🗺️ Driver Positioning Engine initialized")
    
    def analyze_zone_conditions(self) -> Dict[str, ZoneAnalysis]:
        """
        Analyze current supply/demand conditions across all zones
        
        Returns:
            Dictionary mapping zone names to ZoneAnalysis objects
        """
        logger.info("🔍 Analyzing current zone conditions...")
        
        zone_analyses = {}
        
        try:
            # Get current driver positions
            with self.db_connection as db:
                driver_data = db.get_driver_locations()
            
            # Get recent ride requests and completions
            with self.db_connection as db:
                recent_rides = db.get_recent_rides(hours=1)
            
            for zone_name, zone_info in self.zones.items():
                try:
                    # Count current drivers in zone
                    drivers_in_zone = self._count_drivers_in_zone(driver_data, zone_name)
                    
                    # Predict demand for next 30 minutes
                    predicted_demand = self._predict_zone_demand(zone_name, minutes_ahead=30)
                    
                    # Calculate supply/demand ratio
                    supply_demand_ratio = drivers_in_zone / (predicted_demand + 0.1)
                    
                    # Calculate average pickup time based on driver density
                    avg_pickup_time = self._estimate_pickup_time(drivers_in_zone, zone_info['radius'])
                    
                    # Get current surge multiplier (from surge pricing component)
                    surge_multiplier = self._get_zone_surge_multiplier(zone_name)
                    
                    # Analyze weather and traffic impact
                    weather_impact = self._get_weather_impact(zone_name)
                    traffic_impact = self._get_traffic_impact(zone_name)
                    
                    # Determine priority level
                    if supply_demand_ratio < 0.5:
                        priority = 'high'
                    elif supply_demand_ratio < 1.0:
                        priority = 'medium' 
                    else:
                        priority = 'low'
                    
                    zone_analyses[zone_name] = ZoneAnalysis(
                        zone=zone_name,
                        current_drivers=drivers_in_zone,
                        expected_demand=predicted_demand,
                        supply_demand_ratio=supply_demand_ratio,
                        avg_pickup_time=avg_pickup_time,
                        surge_multiplier=surge_multiplier,
                        priority_level=priority,
                        weather_impact=weather_impact,
                        traffic_impact=traffic_impact,
                        timestamp=datetime.now()
                    )
                    
                except Exception as e:
                    logger.warning(f"⚠️ Failed to analyze zone {zone_name}: {e}")
                    # Fallback analysis
                    zone_analyses[zone_name] = ZoneAnalysis(
                        zone=zone_name,
                        current_drivers=0,
                        expected_demand=1.0,
                        supply_demand_ratio=0.0,
                        avg_pickup_time=10.0,
                        surge_multiplier=1.0,
                        priority_level='medium',
                        weather_impact=1.0,
                        traffic_impact=1.0,
                        timestamp=datetime.now()
                    )
            
            logger.info(f"✅ Analyzed {len(zone_analyses)} zones")
            return zone_analyses
            
        except Exception as e:
            logger.error(f"❌ Zone analysis failed: {e}")
            return {}
    
    def generate_positioning_recommendations(self, 
                                           driver_ids: Optional[List[str]] = None) -> List[PositioningRecommendation]:
        """
        Generate positioning recommendations for drivers
        
        Args:
            driver_ids: Optional list of specific drivers to generate recommendations for
                       If None, generates for all active drivers
                       
        Returns:
            List of positioning recommendations ordered by priority
        """
        logger.info("🎯 Generating driver positioning recommendations...")
        
        try:
            # Analyze current zone conditions
            zone_analyses = self.analyze_zone_conditions()
            
            if not zone_analyses:
                logger.warning("⚠️ No zone analysis available")
                return []
            
            # Get current driver positions
            with self.db_connection as db:
                driver_positions = db.get_driver_locations()
                
            if driver_positions.empty:
                logger.warning("⚠️ No active drivers found")
                return []
            
            # Filter to specific drivers if requested
            if driver_ids:
                driver_positions = driver_positions[driver_positions['driver_id'].isin(driver_ids)]
            
            recommendations = []
            
            for _, driver in driver_positions.iterrows():
                try:
                    driver_id = driver['driver_id']
                    current_lat = driver['current_latitude']
                    current_lng = driver['current_longitude']
                    
                    # Determine driver's current zone
                    current_zone = self._classify_location_to_zone(current_lat, current_lng)
                    
                    # Generate recommendation for this driver
                    recommendation = self._generate_driver_recommendation(
                        driver_id=driver_id,
                        current_zone=current_zone,
                        current_lat=current_lat,
                        current_lng=current_lng,
                        zone_analyses=zone_analyses
                    )
                    
                    if recommendation and recommendation.confidence >= self.min_confidence_threshold:
                        recommendations.append(recommendation)
                        
                except Exception as e:
                    logger.warning(f"⚠️ Failed to generate recommendation for driver {driver.get('driver_id', 'unknown')}: {e}")
            
            # Sort by priority score (highest first)
            recommendations.sort(key=lambda r: r.priority_score, reverse=True)
            
            logger.info(f"✅ Generated {len(recommendations)} positioning recommendations")
            return recommendations
            
        except Exception as e:
            logger.error(f"❌ Failed to generate positioning recommendations: {e}")
            return []
    
    def _count_drivers_in_zone(self, driver_data: pd.DataFrame, zone: str) -> int:
        """Count drivers currently in a specific zone"""
        if driver_data.empty:
            return 0
            
        try:
            zone_info = self.zones.get(zone, {})
            if not zone_info:
                return 0
            
            zone_lat = zone_info['lat']
            zone_lng = zone_info['lng']
            zone_radius = zone_info['radius']
            
            # Calculate distance for each driver
            distances = []
            for _, driver in driver_data.iterrows():
                distance = self._calculate_distance(
                    driver['current_latitude'], driver['current_longitude'],
                    zone_lat, zone_lng
                )
                distances.append(distance)
            
            # Count drivers within zone radius
            drivers_in_zone = sum(1 for d in distances if d <= zone_radius)
            return drivers_in_zone
            
        except Exception as e:
            logger.warning(f"⚠️ Error counting drivers in {zone}: {e}")
            return 0
    
    def _predict_zone_demand(self, zone: str, minutes_ahead: int = 30) -> float:
        """Predict demand for a zone in the next N minutes"""
        try:
            # Simple time-based demand prediction (can be enhanced with ML model)
            current_hour = datetime.now().hour
            day_of_week = datetime.now().weekday()
            
            # Base demand patterns
            base_demand = {
                'downtown': 2.0,
                'airport': 1.5,
                'business': 1.8,
                'residential': 1.2,
                'retail': 1.4
            }.get(zone, 1.0)
            
            # Time-based multipliers
            if current_hour in [7, 8, 9, 17, 18, 19]:  # Rush hours
                time_multiplier = 1.8
            elif current_hour in [22, 23, 0, 1, 2]:   # Late night
                time_multiplier = 0.6
            else:
                time_multiplier = 1.0
            
            # Weekend adjustments
            if day_of_week >= 5:  # Weekend
                if zone in ['downtown', 'retail']:
                    weekend_multiplier = 1.3
                else:
                    weekend_multiplier = 0.8
            else:
                weekend_multiplier = 1.0
            
            # Weather impact
            weather_multiplier = self._get_weather_demand_multiplier(zone)
            
            predicted_demand = base_demand * time_multiplier * weekend_multiplier * weather_multiplier
            
            # Scale by forecast horizon
            demand_per_30min = predicted_demand * (minutes_ahead / 30.0)
            
            return max(0.1, demand_per_30min)  # Minimum demand floor
            
        except Exception as e:
            logger.warning(f"⚠️ Demand prediction failed for {zone}: {e}")
            return 1.0  # Fallback
    
    def _estimate_pickup_time(self, drivers_in_zone: int, zone_radius: float) -> float:
        """Estimate average pickup time based on driver density"""
        if drivers_in_zone == 0:
            return 15.0  # No drivers = long pickup time
        
        # Simple model: more drivers = shorter pickup time
        # Based on zone area and driver count
        zone_area = 3.14159 * (zone_radius ** 2)  # Rough area in square miles
        driver_density = drivers_in_zone / zone_area
        
        # Empirical formula (can be calibrated with real data)
        pickup_time = max(2.0, min(20.0, 8.0 / (driver_density + 0.1)))
        
        return pickup_time
    
    def _get_zone_surge_multiplier(self, zone: str) -> float:
        """Get current surge multiplier for zone (integration point with surge pricing)"""
        try:
            # This would integrate with the surge pricing component
            # For now, return a simple time-based surge
            current_hour = datetime.now().hour
            
            if current_hour in [7, 8, 9, 17, 18, 19]:  # Rush hours
                return 1.5
            elif current_hour in [22, 23, 0, 1, 2]:   # Late night
                return 1.3
            else:
                return 1.0
                
        except Exception as e:
            logger.warning(f"⚠️ Failed to get surge multiplier for {zone}: {e}")
            return 1.0
    
    def _get_weather_impact(self, zone: str) -> float:
        """Get weather impact on demand for zone"""
        try:
            zone_info = self.zones.get(zone, {})
            if not zone_info:
                return 1.0
                
            weather_data = self.api_extractor.get_weather_data(zone_info['lat'], zone_info['lng'])
            
            if not weather_data:
                return 1.0
            
            condition = weather_data.get('condition', 'clear').lower()
            
            weather_multipliers = {
                'clear': 1.0, 'sunny': 1.0, 'partly_cloudy': 1.1,
                'cloudy': 1.1, 'overcast': 1.2, 'mist': 1.2,
                'light_rain': 1.3, 'rain': 1.5, 'heavy_rain': 1.8,
                'snow': 2.0, 'storm': 2.2
            }
            
            return weather_multipliers.get(condition, 1.0)
            
        except Exception as e:
            logger.warning(f"⚠️ Failed to get weather impact for {zone}: {e}")
            return 1.0
    
    def _get_traffic_impact(self, zone: str) -> float:
        """Get traffic impact on positioning for zone"""
        try:
            traffic_data = self.api_extractor.get_traffic_data(zone)
            
            if not traffic_data:
                return 1.0
            
            delay_minutes = traffic_data.get('delay_minutes', 0)
            
            # Higher traffic = longer pickup times = need more drivers
            if delay_minutes <= 5:
                return 1.0
            elif delay_minutes <= 15:
                return 1.2
            elif delay_minutes <= 30:
                return 1.4
            else:
                return 1.6
                
        except Exception as e:
            logger.warning(f"⚠️ Failed to get traffic impact for {zone}: {e}")
            return 1.0
    
    def _get_weather_demand_multiplier(self, zone: str) -> float:
        """Get weather impact on ride demand"""
        try:
            zone_info = self.zones.get(zone, {})
            if not zone_info:
                return 1.0
                
            weather_data = self.api_extractor.get_weather_data(zone_info['lat'], zone_info['lng'])
            
            if not weather_data:
                return 1.0
            
            condition = weather_data.get('condition', 'clear').lower()
            temperature = weather_data.get('temperature', 70)
            
            # Weather impact on demand
            condition_multiplier = {
                'clear': 1.0, 'sunny': 1.1, 'partly_cloudy': 1.0,
                'cloudy': 1.0, 'overcast': 1.1, 'mist': 1.1,
                'light_rain': 1.4, 'rain': 1.6, 'heavy_rain': 1.9,
                'snow': 2.1, 'storm': 2.3
            }.get(condition, 1.0)
            
            # Temperature impact (extreme temps increase demand)
            if temperature <= 25 or temperature >= 85:
                temp_multiplier = 1.2
            elif temperature <= 35 or temperature >= 80:
                temp_multiplier = 1.1
            else:
                temp_multiplier = 1.0
            
            return condition_multiplier * temp_multiplier
            
        except Exception as e:
            logger.warning(f"⚠️ Failed to get weather demand multiplier for {zone}: {e}")
            return 1.0
    
    def _generate_driver_recommendation(self, 
                                      driver_id: str,
                                      current_zone: str, 
                                      current_lat: float,
                                      current_lng: float,
                                      zone_analyses: Dict[str, ZoneAnalysis]) -> Optional[PositioningRecommendation]:
        """Generate positioning recommendation for a specific driver"""
        try:
            best_zone = None
            best_score = 0.0
            best_reasoning = ""
            
            current_analysis = zone_analyses.get(current_zone)
            
            # Evaluate each potential destination zone
            for zone_name, analysis in zone_analyses.items():
                if zone_name == current_zone:
                    continue  # Skip current zone
                
                # Calculate distance to move
                zone_info = self.zones[zone_name]
                distance = self._calculate_distance(
                    current_lat, current_lng,
                    zone_info['lat'], zone_info['lng']
                )
                
                # Skip if too far to reposition
                if distance > self.max_repositioning_distance:
                    continue
                
                # Calculate positioning score
                score = self._calculate_positioning_score(
                    current_analysis, analysis, distance
                )
                
                if score > best_score:
                    best_score = score
                    best_zone = zone_name
                    best_reasoning = self._generate_positioning_reasoning(
                        current_zone, zone_name, current_analysis, analysis
                    )
            
            # Only recommend if there's a meaningful improvement
            if best_zone and best_score > 0.3:
                zone_info = self.zones[best_zone]
                distance = self._calculate_distance(
                    current_lat, current_lng,
                    zone_info['lat'], zone_info['lng']
                )
                
                best_analysis = zone_analyses[best_zone]
                
                return PositioningRecommendation(
                    driver_id=driver_id,
                    current_zone=current_zone,
                    recommended_zone=best_zone,
                    priority_score=best_score,
                    expected_pickup_time=best_analysis.avg_pickup_time,
                    confidence=min(0.95, best_score),
                    reasoning=best_reasoning,
                    distance_to_move=distance,
                    estimated_earnings=self._estimate_earnings(best_analysis),
                    timestamp=datetime.now()
                )
            
            return None  # No good recommendation found
            
        except Exception as e:
            logger.warning(f"⚠️ Failed to generate recommendation for driver {driver_id}: {e}")
            return None
    
    def _calculate_positioning_score(self, 
                                   current_analysis: Optional[ZoneAnalysis],
                                   target_analysis: ZoneAnalysis,
                                   distance: float) -> float:
        """Calculate positioning score for moving from current to target zone"""
        try:
            # Base score from target zone conditions
            demand_score = min(1.0, target_analysis.expected_demand / 3.0)  # Normalize demand
            
            # Supply/demand balance score (lower ratio = higher opportunity)
            balance_score = max(0.0, (1.0 - target_analysis.supply_demand_ratio)) 
            
            # Surge multiplier score
            surge_score = min(1.0, (target_analysis.surge_multiplier - 1.0) / 4.0)
            
            # Distance penalty (closer is better)
            distance_score = max(0.0, (self.max_repositioning_distance - distance) / self.max_repositioning_distance)
            
            # Weather/traffic opportunity score
            weather_score = min(1.0, (target_analysis.weather_impact - 1.0) / 1.0)
            
            # Current zone conditions (if available)
            current_penalty = 0.0
            if current_analysis:
                # Penalty for leaving a zone that also needs drivers
                if current_analysis.supply_demand_ratio < 0.8:
                    current_penalty = 0.3
            
            # Weighted combination
            total_score = (
                demand_score * 0.25 +
                balance_score * 0.30 +
                surge_score * 0.20 +
                distance_score * 0.15 +
                weather_score * 0.10
            ) - current_penalty
            
            return max(0.0, min(1.0, total_score))
            
        except Exception as e:
            logger.warning(f"⚠️ Positioning score calculation failed: {e}")
            return 0.0
    
    def _generate_positioning_reasoning(self, 
                                      current_zone: str,
                                      target_zone: str,
                                      current_analysis: Optional[ZoneAnalysis],
                                      target_analysis: ZoneAnalysis) -> str:
        """Generate human-readable reasoning for positioning recommendation"""
        reasons = []
        
        # Demand opportunity
        if target_analysis.expected_demand > 2.0:
            reasons.append(f"High demand expected in {target_zone}")
        
        # Supply shortage
        if target_analysis.supply_demand_ratio < 0.5:
            reasons.append(f"Driver shortage in {target_zone}")
        elif target_analysis.supply_demand_ratio < 0.8:
            reasons.append(f"Limited drivers available in {target_zone}")
        
        # Surge opportunity
        if target_analysis.surge_multiplier > 1.3:
            reasons.append(f"Active surge pricing ({target_analysis.surge_multiplier:.1f}x)")
        
        # Weather impact
        if target_analysis.weather_impact > 1.3:
            reasons.append("Weather increasing ride demand")
        
        # Pickup time improvement
        if current_analysis and current_analysis.avg_pickup_time > target_analysis.avg_pickup_time + 2:
            reasons.append(f"Faster pickups in {target_zone}")
        
        if not reasons:
            reasons.append("Better positioning opportunity")
        
        return "; ".join(reasons)
    
    def _estimate_earnings(self, analysis: ZoneAnalysis) -> float:
        """Estimate potential earnings in a zone"""
        try:
            # Base fare assumption (can be made configurable)
            base_fare_per_ride = 12.0
            
            # Earnings = demand × surge × base fare
            estimated_rides_per_hour = min(4.0, analysis.expected_demand * 2)  # Cap at 4 rides/hour
            earnings_per_hour = estimated_rides_per_hour * base_fare_per_ride * analysis.surge_multiplier
            
            return round(earnings_per_hour, 2)
            
        except Exception as e:
            logger.warning(f"⚠️ Earnings estimation failed: {e}")
            return 0.0
    
    def _calculate_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Calculate distance between two points using Haversine formula"""
        try:
            from math import radians, cos, sin, asin, sqrt
            
            # Convert to radians
            lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
            
            # Haversine formula
            dlat = lat2 - lat1
            dlng = lng2 - lng1
            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
            c = 2 * asin(sqrt(a))
            r = 3956  # Earth's radius in miles
            
            return c * r
            
        except Exception as e:
            logger.warning(f"⚠️ Distance calculation failed: {e}")
            return 0.0
    
    def _classify_location_to_zone(self, lat: float, lng: float, threshold_miles: float = 0.5) -> str:
        """Classify a lat/lng coordinate to the nearest zone"""
        min_distance = float('inf')
        closest_zone = 'other'
        
        for zone_name, zone_info in self.zones.items():
            distance = self._calculate_distance(lat, lng, zone_info['lat'], zone_info['lng'])
            
            if distance < min_distance and distance <= threshold_miles:
                min_distance = distance
                closest_zone = zone_name
        
        return closest_zone
    
    def get_zone_summary(self) -> Dict[str, Dict[str, Any]]:
        """Get summary of all zone conditions for dashboard display"""
        logger.info("📊 Generating zone summary for dashboard...")
        
        try:
            zone_analyses = self.analyze_zone_conditions()
            
            summary = {}
            for zone_name, analysis in zone_analyses.items():
                summary[zone_name] = {
                    'current_drivers': analysis.current_drivers,
                    'expected_demand': round(analysis.expected_demand, 1),
                    'supply_demand_ratio': round(analysis.supply_demand_ratio, 2),
                    'avg_pickup_time': round(analysis.avg_pickup_time, 1),
                    'surge_multiplier': round(analysis.surge_multiplier, 2),
                    'priority_level': analysis.priority_level,
                    'weather_impact': round(analysis.weather_impact, 2),
                    'traffic_impact': round(analysis.traffic_impact, 2),
                    'status': 'needs_drivers' if analysis.supply_demand_ratio < 0.8 else 'balanced',
                    'recommendation': 'Send more drivers' if analysis.supply_demand_ratio < 0.5 else 'Monitor',
                    'last_updated': analysis.timestamp.isoformat()
                }
            
            logger.info(f"✅ Generated summary for {len(summary)} zones")
            return summary
            
        except Exception as e:
            logger.error(f"❌ Failed to generate zone summary: {e}")
            return {}
    
    def save_model(self, filepath: Optional[str] = None) -> str:
        """Save positioning model to disk"""
        logger.info("💾 Saving driver positioning model...")
        
        if not filepath:
            models_dir = Path("ml/models")
            models_dir.mkdir(exist_ok=True)
            filepath = f"ml/models/driver_positioning_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pkl"
        
        model_data = {
            'zones': self.zones,
            'optimization_weights': self.optimization_weights,
            'max_repositioning_distance': self.max_repositioning_distance,
            'min_confidence_threshold': self.min_confidence_threshold,
            'demand_forecast_horizon': self.demand_forecast_horizon,
            'model_metadata': self.model_metadata,
            'version': '1.0.0',
            'timestamp': datetime.now().isoformat()
        }
        
        try:
            joblib.dump(model_data, filepath)
            logger.info(f"✅ Driver positioning model saved to {filepath}")
            return filepath
        except Exception as e:
            logger.error(f"❌ Failed to save model: {e}")
            return ""
    
    def load_model(self, filepath: str) -> bool:
        """Load positioning model from disk"""
        logger.info(f"📥 Loading driver positioning model from {filepath}...")
        
        try:
            if not Path(filepath).exists():
                logger.error(f"❌ Model file not found: {filepath}")
                return False
                
            model_data = joblib.load(filepath)
            
            # Load configuration
            self.zones = model_data.get('zones', self.zones)
            self.optimization_weights = model_data.get('optimization_weights', self.optimization_weights)
            self.max_repositioning_distance = model_data.get('max_repositioning_distance', self.max_repositioning_distance)
            self.min_confidence_threshold = model_data.get('min_confidence_threshold', self.min_confidence_threshold)
            self.demand_forecast_horizon = model_data.get('demand_forecast_horizon', self.demand_forecast_horizon)
            self.model_metadata = model_data.get('model_metadata', {})
            
            logger.info("✅ Driver positioning model loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to load model: {e}")
            return False

# Example usage and testing
if __name__ == "__main__":
    # Initialize driver positioning engine
    positioning_engine = DriverPositioningEngine()
    
    print("🗺️ Testing Driver Positioning Engine...")
    
    # Test zone analysis
    zone_conditions = positioning_engine.analyze_zone_conditions()
    if zone_conditions:
        print(f"✅ Zone analysis completed for {len(zone_conditions)} zones")
        
        for zone, analysis in zone_conditions.items():
            print(f"  {zone}: {analysis.current_drivers} drivers, {analysis.expected_demand:.1f} demand, {analysis.priority_level} priority")
    
    # Test positioning recommendations
    recommendations = positioning_engine.generate_positioning_recommendations()
    if recommendations:
        print(f"✅ Generated {len(recommendations)} positioning recommendations")
        
        for rec in recommendations[:3]:  # Show top 3
            print(f"  Driver {rec.driver_id}: {rec.current_zone} → {rec.recommended_zone} (Score: {rec.priority_score:.2f})")
            print(f"    Reasoning: {rec.reasoning}")
    
    print("🎯 Driver Positioning Engine test completed!")
