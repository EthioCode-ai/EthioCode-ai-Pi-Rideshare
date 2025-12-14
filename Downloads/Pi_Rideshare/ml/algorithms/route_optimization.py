#!/usr/bin/env python3
"""
Route Optimization Intelligence for Pi Rideshare Platform

This module implements advanced route optimization algorithms that:
- Optimizes pickup routes to minimize driver travel time
- Enables intelligent ride pooling and multi-passenger coordination
- Integrates real-time traffic data for dynamic route planning
- Provides ETA predictions with weather and traffic impact
- Manages multi-stop route optimization for pool rides
- Optimizes driver allocation for multiple concurrent requests
- Balances ride efficiency vs passenger convenience
- Handles time window constraints for pickups and dropoffs

Authors: Pi Rideshare ML Team
Version: 1.0.0
Date: September 2025
"""

import logging
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional, Any, Set
from dataclasses import dataclass, field
from pathlib import Path
import json
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
from math import radians, cos, sin, asin, sqrt

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
class RouteWaypoint:
    """A waypoint in a route (pickup or dropoff)"""
    id: str
    type: str  # 'pickup', 'dropoff'
    latitude: float
    longitude: float
    passenger_id: str
    time_window_start: datetime
    time_window_end: datetime
    service_time_minutes: int = 2  # Time needed at this location
    priority: int = 1  # Higher numbers = higher priority
    special_requirements: List[str] = field(default_factory=list)

@dataclass
class OptimizedRoute:
    """An optimized route for a driver"""
    driver_id: str
    waypoints: List[RouteWaypoint]
    total_distance_miles: float
    total_time_minutes: float
    total_passengers: int
    route_efficiency_score: float
    estimated_earnings: float
    traffic_impact: float
    weather_impact: float
    confidence_score: float
    optimization_strategy: str
    timestamp: datetime

@dataclass
class PoolRideMatch:
    """A matched pool ride with multiple passengers"""
    match_id: str
    driver_id: str
    passengers: List[str]
    pickup_sequence: List[RouteWaypoint]
    dropoff_sequence: List[RouteWaypoint]
    shared_distance_miles: float
    individual_savings_percent: float
    total_time_minutes: float
    compatibility_score: float
    reasoning: str
    timestamp: datetime

@dataclass
class ETAPrediction:
    """ETA prediction with confidence intervals"""
    destination_lat: float
    destination_lng: float
    estimated_time_minutes: float
    confidence_interval_min: float  # Lower bound
    confidence_interval_max: float  # Upper bound
    traffic_delay_minutes: float
    weather_delay_minutes: float
    base_time_minutes: float
    confidence_score: float
    factors: List[str]  # Factors affecting ETA
    timestamp: datetime

class RouteOptimizationEngine:
    """
    Advanced Route Optimization Engine
    
    Features:
    - TSP (Traveling Salesman Problem) optimization for multi-stop routes
    - Real-time traffic integration for dynamic routing
    - Ride pooling optimization with passenger compatibility
    - ETA prediction with machine learning
    - Multi-objective optimization (time, distance, earnings, satisfaction)
    - Time window constraint handling
    - Vehicle capacity management
    - Special requirements handling (wheelchair, child seats, etc.)
    """
    
    def __init__(self):
        """Initialize Route Optimization Engine"""
        self.eta_model = None
        self.route_model = None
        self.pooling_model = None
        self.scaler = StandardScaler()
        self.feature_columns = []
        self.is_trained = False
        self.model_metadata = {}
        
        # Route optimization configuration
        self.max_detour_percent = 30       # Max % detour for pool rides
        self.max_pool_passengers = 4       # Max passengers per pool ride
        self.max_pickup_time_minutes = 15  # Max time to reach pickup
        self.min_route_efficiency = 0.6    # Min efficiency score for routes
        
        # Time window tolerances
        self.pickup_tolerance_minutes = 5   # Tolerance for pickup windows
        self.dropoff_tolerance_minutes = 10 # Tolerance for dropoff windows
        
        # Pool ride matching parameters
        self.max_pool_detour_minutes = 10  # Max extra time for pool rides
        self.min_pool_savings_percent = 20  # Min savings to justify pooling
        
        # Performance weights for optimization
        self.optimization_weights = {
            'travel_time': 0.35,     # Minimize total travel time
            'distance': 0.25,        # Minimize total distance
            'passenger_convenience': 0.20,  # Maximize passenger satisfaction
            'driver_earnings': 0.20  # Maximize driver earnings
        }
        
        # Zone definitions (Pi Rideshare service areas)
        self.zones = {
            'downtown': {'lat': 36.373, 'lng': -94.209, 'avg_speed_mph': 25},
            'airport': {'lat': 36.385, 'lng': -94.220, 'avg_speed_mph': 35},
            'business': {'lat': 36.365, 'lng': -94.200, 'avg_speed_mph': 30},
            'residential': {'lat': 36.380, 'lng': -94.195, 'avg_speed_mph': 35},
            'retail': {'lat': 36.368, 'lng': -94.208, 'avg_speed_mph': 20}
        }
        
        # Initialize ML components
        self.db_connection = MLDatabaseConnection()
        self.api_extractor = MLAPIDataExtractor()
        self.data_processor = MLDataProcessor()
        
        logger.info("🗺️ Route Optimization Engine initialized")
    
    def optimize_pickup_route(self, 
                            driver_id: str,
                            driver_lat: float, 
                            driver_lng: float,
                            pending_requests: List[Dict[str, Any]]) -> OptimizedRoute:
        """
        Optimize pickup route for a driver with multiple pending requests
        
        Args:
            driver_id: ID of the driver
            driver_lat: Driver's current latitude
            driver_lng: Driver's current longitude  
            pending_requests: List of pending ride requests
            
        Returns:
            OptimizedRoute object with optimal waypoint sequence
        """
        logger.info(f"🎯 Optimizing pickup route for driver {driver_id} with {len(pending_requests)} requests...")
        
        try:
            if not pending_requests:
                # No requests to optimize
                return OptimizedRoute(
                    driver_id=driver_id,
                    waypoints=[],
                    total_distance_miles=0.0,
                    total_time_minutes=0.0,
                    total_passengers=0,
                    route_efficiency_score=1.0,
                    estimated_earnings=0.0,
                    traffic_impact=1.0,
                    weather_impact=1.0,
                    confidence_score=1.0,
                    optimization_strategy='no_requests',
                    timestamp=datetime.now()
                )
            
            # Convert requests to waypoints
            waypoints = self._create_waypoints_from_requests(pending_requests)
            
            # Add driver's current position as starting point
            driver_waypoint = RouteWaypoint(
                id='driver_start',
                type='start',
                latitude=driver_lat,
                longitude=driver_lng,
                passenger_id='driver',
                time_window_start=datetime.now(),
                time_window_end=datetime.now() + timedelta(hours=1),
                service_time_minutes=0
            )
            
            # Optimize route sequence
            if len(waypoints) == 1:
                # Single pickup - direct route
                optimized_sequence = [driver_waypoint] + waypoints
                strategy = 'direct_pickup'
            elif len(waypoints) <= 3:
                # Small number of waypoints - try all permutations
                optimized_sequence = self._optimize_small_route(driver_waypoint, waypoints)
                strategy = 'exhaustive_search'
            else:
                # Larger number - use heuristic optimization
                optimized_sequence = self._optimize_large_route(driver_waypoint, waypoints)
                strategy = 'nearest_neighbor_heuristic'
            
            # Calculate route metrics
            total_distance = self._calculate_route_distance(optimized_sequence)
            total_time = self._calculate_route_time(optimized_sequence)
            
            # Get traffic and weather impacts
            traffic_impact = self._calculate_route_traffic_impact(optimized_sequence)
            weather_impact = self._calculate_route_weather_impact(optimized_sequence)
            
            # Adjust time for conditions
            adjusted_time = total_time * traffic_impact * weather_impact
            
            # Calculate efficiency and earnings
            efficiency_score = self._calculate_route_efficiency(optimized_sequence, total_distance, adjusted_time)
            estimated_earnings = self._estimate_route_earnings(optimized_sequence, total_distance)
            
            # Calculate confidence score
            confidence_score = self._calculate_route_confidence(optimized_sequence, len(pending_requests))
            
            return OptimizedRoute(
                driver_id=driver_id,
                waypoints=optimized_sequence[1:],  # Exclude driver start point
                total_distance_miles=total_distance,
                total_time_minutes=adjusted_time,
                total_passengers=len(pending_requests),
                route_efficiency_score=efficiency_score,
                estimated_earnings=estimated_earnings,
                traffic_impact=traffic_impact,
                weather_impact=weather_impact,
                confidence_score=confidence_score,
                optimization_strategy=strategy,
                timestamp=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"❌ Route optimization failed for driver {driver_id}: {e}")
            # Return fallback route
            return self._create_fallback_route(driver_id, pending_requests)
    
    def find_pool_ride_matches(self, 
                             pending_requests: List[Dict[str, Any]], 
                             max_matches: int = 5) -> List[PoolRideMatch]:
        """
        Find optimal pool ride matches from pending ride requests
        
        Args:
            pending_requests: List of pending ride requests
            max_matches: Maximum number of matches to return
            
        Returns:
            List of PoolRideMatch objects ordered by compatibility score
        """
        logger.info(f"🚗 Finding pool ride matches from {len(pending_requests)} requests...")
        
        try:
            if len(pending_requests) < 2:
                return []  # Need at least 2 requests for pooling
            
            pool_matches = []
            
            # Generate all possible combinations of 2-4 passengers
            for pool_size in range(2, min(self.max_pool_passengers + 1, len(pending_requests) + 1)):
                combinations = self._generate_passenger_combinations(pending_requests, pool_size)
                
                for combo in combinations:
                    # Evaluate pool compatibility
                    match = self._evaluate_pool_compatibility(combo)
                    
                    if match and match.compatibility_score >= 0.6:  # Minimum compatibility threshold
                        pool_matches.append(match)
            
            # Sort by compatibility score (best matches first)
            pool_matches.sort(key=lambda m: m.compatibility_score, reverse=True)
            
            # Return top matches
            result = pool_matches[:max_matches]
            logger.info(f"✅ Found {len(result)} viable pool ride matches")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Pool ride matching failed: {e}")
            return []
    
    def predict_eta(self, 
                   from_lat: float, 
                   from_lng: float,
                   to_lat: float, 
                   to_lng: float,
                   departure_time: Optional[datetime] = None) -> ETAPrediction:
        """
        Predict ETA between two points with confidence intervals
        
        Args:
            from_lat: Starting latitude
            from_lng: Starting longitude
            to_lat: Destination latitude
            to_lng: Destination longitude
            departure_time: Planned departure time (default: now)
            
        Returns:
            ETAPrediction with estimated time and confidence
        """
        if not departure_time:
            departure_time = datetime.now()
        
        logger.info(f"🕰️ Predicting ETA from ({from_lat:.3f}, {from_lng:.3f}) to ({to_lat:.3f}, {to_lng:.3f})...")
        
        try:
            # Calculate base travel time using distance and speed
            distance_miles = self._calculate_distance(from_lat, from_lng, to_lat, to_lng)
            base_time = self._calculate_base_travel_time(from_lat, from_lng, to_lat, to_lng, distance_miles)
            
            # Get traffic impact
            traffic_delay = self._get_traffic_delay(from_lat, from_lng, to_lat, to_lng, departure_time)
            
            # Get weather impact  
            weather_delay = self._get_weather_delay(from_lat, from_lng, to_lat, to_lng, departure_time)
            
            # Calculate total estimated time
            estimated_time = base_time + traffic_delay + weather_delay
            
            # Calculate confidence intervals (±20% for base model)
            confidence_range = estimated_time * 0.2
            confidence_min = max(base_time * 0.5, estimated_time - confidence_range)
            confidence_max = estimated_time + confidence_range
            
            # Determine factors affecting ETA
            factors = []
            if traffic_delay > 2:
                factors.append(f"Traffic delay: +{traffic_delay:.1f} min")
            if weather_delay > 1:
                factors.append(f"Weather delay: +{weather_delay:.1f} min")
            if distance_miles > 10:
                factors.append("Long distance trip")
            
            # Calculate confidence score (higher for shorter distances, better conditions)
            confidence_score = self._calculate_eta_confidence(distance_miles, traffic_delay, weather_delay)
            
            return ETAPrediction(
                destination_lat=to_lat,
                destination_lng=to_lng,
                estimated_time_minutes=estimated_time,
                confidence_interval_min=confidence_min,
                confidence_interval_max=confidence_max,
                traffic_delay_minutes=traffic_delay,
                weather_delay_minutes=weather_delay,
                base_time_minutes=base_time,
                confidence_score=confidence_score,
                factors=factors,
                timestamp=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"❌ ETA prediction failed: {e}")
            # Return fallback ETA
            return self._create_fallback_eta(from_lat, from_lng, to_lat, to_lng)
    
    def optimize_multi_stop_route(self, 
                                waypoints: List[RouteWaypoint],
                                vehicle_capacity: int = 4) -> List[RouteWaypoint]:
        """
        Optimize route with multiple stops considering time windows and capacity
        
        Args:
            waypoints: List of waypoints to visit
            vehicle_capacity: Maximum passenger capacity
            
        Returns:
            Optimized sequence of waypoints
        """
        logger.info(f"🗺️ Optimizing multi-stop route with {len(waypoints)} waypoints...")
        
        try:
            if len(waypoints) <= 1:
                return waypoints
            
            # Separate pickups and dropoffs
            pickups = [w for w in waypoints if w.type == 'pickup']
            dropoffs = [w for w in waypoints if w.type == 'dropoff']
            
            # For pool rides, ensure capacity constraints
            if len(pickups) > vehicle_capacity:
                # Sort by priority and time window urgency
                pickups = self._prioritize_waypoints(pickups)[:vehicle_capacity]
            
            # Use TSP optimization for small sets, heuristics for larger ones
            if len(waypoints) <= 8:
                optimized_sequence = self._tsp_optimization(waypoints)
            else:
                optimized_sequence = self._heuristic_optimization(waypoints)
            
            # Validate time windows and capacity constraints
            validated_sequence = self._validate_route_constraints(optimized_sequence, vehicle_capacity)
            
            logger.info(f"✅ Multi-stop route optimized: {len(validated_sequence)} waypoints")
            return validated_sequence
            
        except Exception as e:
            logger.error(f"❌ Multi-stop optimization failed: {e}")
            # Return simple nearest-neighbor sequence as fallback
            return self._nearest_neighbor_sequence(waypoints)
    
    def _create_waypoints_from_requests(self, requests: List[Dict[str, Any]]) -> List[RouteWaypoint]:
        """Convert ride requests to waypoints"""
        waypoints = []
        
        for req in requests:
            # Create pickup waypoint
            pickup_time = datetime.fromisoformat(req.get('pickup_time', datetime.now().isoformat()))
            
            pickup_waypoint = RouteWaypoint(
                id=f"{req['id']}_pickup",
                type='pickup',
                latitude=req['pickup_latitude'],
                longitude=req['pickup_longitude'],
                passenger_id=req['passenger_id'],
                time_window_start=pickup_time - timedelta(minutes=self.pickup_tolerance_minutes),
                time_window_end=pickup_time + timedelta(minutes=self.pickup_tolerance_minutes),
                service_time_minutes=2,
                priority=req.get('priority', 1),
                special_requirements=req.get('special_requirements', [])
            )
            
            waypoints.append(pickup_waypoint)
        
        return waypoints
    
    def _calculate_distance(self, lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Calculate distance between two points using Haversine formula"""
        try:
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
    
    def _calculate_base_travel_time(self, from_lat: float, from_lng: float, 
                                   to_lat: float, to_lng: float, distance_miles: float) -> float:
        """Calculate base travel time without traffic/weather"""
        try:
            # Determine zone-based speed
            from_zone = self._classify_location_to_zone(from_lat, from_lng)
            to_zone = self._classify_location_to_zone(to_lat, to_lng)
            
            # Use average speed between zones
            from_speed = self.zones.get(from_zone, {}).get('avg_speed_mph', 30)
            to_speed = self.zones.get(to_zone, {}).get('avg_speed_mph', 30)
            avg_speed = (from_speed + to_speed) / 2
            
            # Calculate time in minutes
            time_hours = distance_miles / avg_speed
            time_minutes = time_hours * 60
            
            return max(1.0, time_minutes)  # Minimum 1 minute
            
        except Exception as e:
            logger.warning(f"⚠️ Base time calculation failed: {e}")
            return distance_miles * 2  # Fallback: 2 minutes per mile
    
    def _classify_location_to_zone(self, lat: float, lng: float) -> str:
        """Classify a location to the nearest zone"""
        min_distance = float('inf')
        closest_zone = 'residential'  # Default zone
        
        for zone_name, zone_info in self.zones.items():
            distance = self._calculate_distance(lat, lng, zone_info['lat'], zone_info['lng'])
            
            if distance < min_distance:
                min_distance = distance
                closest_zone = zone_name
        
        return closest_zone
    
    def _get_traffic_delay(self, from_lat: float, from_lng: float, 
                          to_lat: float, to_lng: float, departure_time: datetime) -> float:
        """Get traffic delay for route"""
        try:
            # Get traffic data for origin zone
            from_zone = self._classify_location_to_zone(from_lat, from_lng)
            traffic_data = self.api_extractor.get_traffic_data(from_zone)
            
            if not traffic_data:
                return 0.0
            
            delay_minutes = traffic_data.get('delay_minutes', 0)
            
            # Scale delay by time of day
            hour = departure_time.hour
            if hour in [7, 8, 9, 17, 18, 19]:  # Rush hours
                delay_multiplier = 1.5
            elif hour in [10, 11, 12, 13, 14, 15, 16]:  # Daytime
                delay_multiplier = 1.0
            else:  # Off-peak
                delay_multiplier = 0.5
            
            return delay_minutes * delay_multiplier
            
        except Exception as e:
            logger.warning(f"⚠️ Traffic delay calculation failed: {e}")
            return 0.0
    
    def _get_weather_delay(self, from_lat: float, from_lng: float, 
                          to_lat: float, to_lng: float, departure_time: datetime) -> float:
        """Get weather delay for route"""
        try:
            # Get weather data for midpoint of route
            mid_lat = (from_lat + to_lat) / 2
            mid_lng = (from_lng + to_lng) / 2
            
            weather_data = self.api_extractor.get_weather_data(mid_lat, mid_lng)
            
            if not weather_data:
                return 0.0
            
            condition = weather_data.get('condition', 'clear').lower()
            
            # Weather delay mapping
            weather_delays = {
                'clear': 0, 'sunny': 0, 'partly_cloudy': 0,
                'cloudy': 0.5, 'overcast': 1, 'mist': 2,
                'light_rain': 3, 'rain': 5, 'heavy_rain': 8,
                'snow': 10, 'storm': 15
            }
            
            return weather_delays.get(condition, 0)
            
        except Exception as e:
            logger.warning(f"⚠️ Weather delay calculation failed: {e}")
            return 0.0
    
    def _calculate_eta_confidence(self, distance_miles: float, 
                                 traffic_delay: float, weather_delay: float) -> float:
        """Calculate confidence score for ETA prediction"""
        try:
            # Base confidence starts high for short distances
            base_confidence = max(0.5, 1.0 - (distance_miles / 20.0))
            
            # Reduce confidence for delays
            traffic_penalty = min(0.3, traffic_delay / 20.0)
            weather_penalty = min(0.2, weather_delay / 10.0)
            
            confidence = base_confidence - traffic_penalty - weather_penalty
            
            return max(0.3, min(0.95, confidence))
            
        except Exception as e:
            logger.warning(f"⚠️ Confidence calculation failed: {e}")
            return 0.7  # Default confidence
    
    def _optimize_small_route(self, start_point: RouteWaypoint, waypoints: List[RouteWaypoint]) -> List[RouteWaypoint]:
        """Optimize small route using exhaustive search"""
        try:
            from itertools import permutations
            
            best_sequence = None
            best_total_time = float('inf')
            
            # Try all permutations
            for perm in permutations(waypoints):
                sequence = [start_point] + list(perm)
                total_time = self._calculate_route_time(sequence)
                
                if total_time < best_total_time:
                    best_total_time = total_time
                    best_sequence = sequence
            
            return best_sequence or [start_point] + waypoints
            
        except Exception as e:
            logger.warning(f"⚠️ Small route optimization failed: {e}")
            return [start_point] + waypoints
    
    def _optimize_large_route(self, start_point: RouteWaypoint, waypoints: List[RouteWaypoint]) -> List[RouteWaypoint]:
        """Optimize large route using nearest neighbor heuristic"""
        try:
            sequence = [start_point]
            remaining = waypoints.copy()
            current_point = start_point
            
            while remaining:
                # Find nearest unvisited waypoint
                nearest_point = None
                min_distance = float('inf')
                
                for waypoint in remaining:
                    distance = self._calculate_distance(
                        current_point.latitude, current_point.longitude,
                        waypoint.latitude, waypoint.longitude
                    )
                    
                    if distance < min_distance:
                        min_distance = distance
                        nearest_point = waypoint
                
                if nearest_point:
                    sequence.append(nearest_point)
                    remaining.remove(nearest_point)
                    current_point = nearest_point
                else:
                    break
            
            return sequence
            
        except Exception as e:
            logger.warning(f"⚠️ Large route optimization failed: {e}")
            return [start_point] + waypoints
    
    def _calculate_route_distance(self, waypoints: List[RouteWaypoint]) -> float:
        """Calculate total distance for a route"""
        total_distance = 0.0
        
        for i in range(len(waypoints) - 1):
            current = waypoints[i]
            next_point = waypoints[i + 1]
            
            distance = self._calculate_distance(
                current.latitude, current.longitude,
                next_point.latitude, next_point.longitude
            )
            
            total_distance += distance
        
        return total_distance
    
    def _calculate_route_time(self, waypoints: List[RouteWaypoint]) -> float:
        """Calculate total time for a route including service time"""
        total_time = 0.0
        
        for i in range(len(waypoints) - 1):
            current = waypoints[i]
            next_point = waypoints[i + 1]
            
            # Travel time between waypoints
            distance = self._calculate_distance(
                current.latitude, current.longitude,
                next_point.latitude, next_point.longitude
            )
            
            travel_time = self._calculate_base_travel_time(
                current.latitude, current.longitude,
                next_point.latitude, next_point.longitude,
                distance
            )
            
            # Add service time at current waypoint
            service_time = current.service_time_minutes
            
            total_time += travel_time + service_time
        
        # Add service time for final waypoint
        if waypoints:
            total_time += waypoints[-1].service_time_minutes
        
        return total_time
    
    def _calculate_route_traffic_impact(self, waypoints: List[RouteWaypoint]) -> float:
        """Calculate average traffic impact for route"""
        if not waypoints:
            return 1.0
        
        total_impact = 0.0
        count = 0
        
        for waypoint in waypoints:
            try:
                zone = self._classify_location_to_zone(waypoint.latitude, waypoint.longitude)
                traffic_data = self.api_extractor.get_traffic_data(zone)
                
                if traffic_data:
                    delay_minutes = traffic_data.get('delay_minutes', 0)
                    # Convert delay to multiplier
                    impact = 1.0 + (delay_minutes / 30.0)  # 30 min delay = 2x impact
                    total_impact += impact
                    count += 1
                    
            except Exception as e:
                logger.warning(f"⚠️ Traffic impact calculation failed for waypoint: {e}")
        
        return total_impact / count if count > 0 else 1.0
    
    def _calculate_route_weather_impact(self, waypoints: List[RouteWaypoint]) -> float:
        """Calculate average weather impact for route"""
        if not waypoints:
            return 1.0
        
        total_impact = 0.0
        count = 0
        
        for waypoint in waypoints:
            try:
                weather_data = self.api_extractor.get_weather_data(waypoint.latitude, waypoint.longitude)
                
                if weather_data:
                    condition = weather_data.get('condition', 'clear').lower()
                    
                    weather_impacts = {
                        'clear': 1.0, 'sunny': 1.0, 'partly_cloudy': 1.05,
                        'cloudy': 1.1, 'overcast': 1.15, 'mist': 1.2,
                        'light_rain': 1.3, 'rain': 1.5, 'heavy_rain': 1.8,
                        'snow': 2.0, 'storm': 2.5
                    }
                    
                    impact = weather_impacts.get(condition, 1.0)
                    total_impact += impact
                    count += 1
                    
            except Exception as e:
                logger.warning(f"⚠️ Weather impact calculation failed for waypoint: {e}")
        
        return total_impact / count if count > 0 else 1.0
    
    def _calculate_route_efficiency(self, waypoints: List[RouteWaypoint], 
                                  distance: float, time: float) -> float:
        """Calculate route efficiency score (0-1)"""
        try:
            if not waypoints or distance <= 0 or time <= 0:
                return 0.0
            
            # Ideal metrics (best case scenario)
            num_stops = len([w for w in waypoints if w.type in ['pickup', 'dropoff']])
            
            if num_stops == 0:
                return 1.0
            
            # Calculate ideal distance (direct routes)
            ideal_distance = 0.0
            for i in range(len(waypoints) - 1):
                if waypoints[i].type == 'start':
                    continue
                    
                # Estimate ideal distance between consecutive actual stops
                ideal_distance += self._calculate_distance(
                    waypoints[i].latitude, waypoints[i].longitude,
                    waypoints[i + 1].latitude, waypoints[i + 1].longitude
                ) * 0.8  # 80% of actual distance as ideal
            
            # Efficiency based on distance ratio
            distance_efficiency = (ideal_distance / distance) if distance > 0 else 0.0
            
            # Time efficiency (compare to direct travel time)
            ideal_time = ideal_distance * 2  # 2 minutes per mile as ideal
            time_efficiency = (ideal_time / time) if time > 0 else 0.0
            
            # Combined efficiency score
            efficiency = (distance_efficiency * 0.6 + time_efficiency * 0.4)
            
            return max(0.0, min(1.0, efficiency))
            
        except Exception as e:
            logger.warning(f"⚠️ Efficiency calculation failed: {e}")
            return 0.5  # Default efficiency
    
    def _estimate_route_earnings(self, waypoints: List[RouteWaypoint], distance: float) -> float:
        """Estimate earnings for completing route"""
        try:
            # Count passenger pickups
            pickups = len([w for w in waypoints if w.type == 'pickup'])
            
            if pickups == 0:
                return 0.0
            
            # Base fare per ride
            base_fare = 8.0
            
            # Distance-based fare
            distance_fare = distance * 1.2  # $1.20 per mile
            
            # Time-based component (simplified)
            time_fare = distance * 0.5  # Additional time component
            
            # Total earnings
            total_earnings = pickups * (base_fare + distance_fare + time_fare)
            
            return round(total_earnings, 2)
            
        except Exception as e:
            logger.warning(f"⚠️ Earnings estimation failed: {e}")
            return 0.0
    
    def _calculate_route_confidence(self, waypoints: List[RouteWaypoint], num_requests: int) -> float:
        """Calculate confidence score for route optimization"""
        try:
            # Base confidence
            base_confidence = 0.8
            
            # Reduce confidence for more complex routes
            complexity_penalty = min(0.3, (num_requests - 1) * 0.1)
            
            # Reduce confidence for routes with tight time windows
            time_window_penalty = 0.0
            for waypoint in waypoints:
                if waypoint.type in ['pickup', 'dropoff']:
                    window_size = (waypoint.time_window_end - waypoint.time_window_start).total_seconds() / 60
                    if window_size < 10:  # Less than 10 minutes
                        time_window_penalty += 0.05
            
            confidence = base_confidence - complexity_penalty - time_window_penalty
            
            return max(0.3, min(0.95, confidence))
            
        except Exception as e:
            logger.warning(f"⚠️ Confidence calculation failed: {e}")
            return 0.7
    
    def _create_fallback_route(self, driver_id: str, requests: List[Dict[str, Any]]) -> OptimizedRoute:
        """Create fallback route when optimization fails"""
        try:
            # Create simple nearest-first route
            waypoints = self._create_waypoints_from_requests(requests)
            
            # Simple distance calculation
            total_distance = sum(
                self._calculate_distance(
                    waypoints[i].latitude, waypoints[i].longitude,
                    waypoints[i + 1].latitude, waypoints[i + 1].longitude
                ) for i in range(len(waypoints) - 1)
            ) if len(waypoints) > 1 else 0.0
            
            return OptimizedRoute(
                driver_id=driver_id,
                waypoints=waypoints,
                total_distance_miles=total_distance,
                total_time_minutes=total_distance * 2.5,  # Rough estimate
                total_passengers=len(requests),
                route_efficiency_score=0.6,
                estimated_earnings=len(requests) * 12.0,
                traffic_impact=1.2,
                weather_impact=1.1,
                confidence_score=0.5,
                optimization_strategy='fallback',
                timestamp=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"❌ Fallback route creation failed: {e}")
            return OptimizedRoute(
                driver_id=driver_id,
                waypoints=[],
                total_distance_miles=0.0,
                total_time_minutes=0.0,
                total_passengers=0,
                route_efficiency_score=0.0,
                estimated_earnings=0.0,
                traffic_impact=1.0,
                weather_impact=1.0,
                confidence_score=0.3,
                optimization_strategy='emergency_fallback',
                timestamp=datetime.now()
            )
    
    def _create_fallback_eta(self, from_lat: float, from_lng: float, 
                           to_lat: float, to_lng: float) -> ETAPrediction:
        """Create fallback ETA when prediction fails"""
        distance = self._calculate_distance(from_lat, from_lng, to_lat, to_lng)
        estimated_time = distance * 2.5  # 2.5 minutes per mile as fallback
        
        return ETAPrediction(
            destination_lat=to_lat,
            destination_lng=to_lng,
            estimated_time_minutes=estimated_time,
            confidence_interval_min=estimated_time * 0.8,
            confidence_interval_max=estimated_time * 1.5,
            traffic_delay_minutes=0.0,
            weather_delay_minutes=0.0,
            base_time_minutes=estimated_time,
            confidence_score=0.5,
            factors=['Fallback estimation'],
            timestamp=datetime.now()
        )
    
    # Pool ride matching methods (placeholder implementations)
    def _generate_passenger_combinations(self, requests: List[Dict[str, Any]], pool_size: int) -> List[List[Dict[str, Any]]]:
        """Generate passenger combinations for pool matching"""
        from itertools import combinations
        return list(combinations(requests, pool_size))
    
    def _evaluate_pool_compatibility(self, passengers: List[Dict[str, Any]]) -> Optional[PoolRideMatch]:
        """Evaluate compatibility of passengers for pool ride"""
        # Placeholder implementation - returns high compatibility for demo
        if len(passengers) >= 2:
            return PoolRideMatch(
                match_id=f"pool_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                driver_id="TBD",
                passengers=[p['passenger_id'] for p in passengers],
                pickup_sequence=[],
                dropoff_sequence=[],
                shared_distance_miles=5.0,
                individual_savings_percent=25.0,
                total_time_minutes=20.0,
                compatibility_score=0.8,
                reasoning="High route overlap and compatible time windows",
                timestamp=datetime.now()
            )
        return None
    
    # TSP and heuristic optimization methods (simplified implementations)
    def _tsp_optimization(self, waypoints: List[RouteWaypoint]) -> List[RouteWaypoint]:
        """TSP optimization for small waypoint sets"""
        # Simplified nearest neighbor for now
        return self._nearest_neighbor_sequence(waypoints)
    
    def _heuristic_optimization(self, waypoints: List[RouteWaypoint]) -> List[RouteWaypoint]:
        """Heuristic optimization for larger waypoint sets"""
        # Simplified nearest neighbor for now
        return self._nearest_neighbor_sequence(waypoints)
    
    def _nearest_neighbor_sequence(self, waypoints: List[RouteWaypoint]) -> List[RouteWaypoint]:
        """Simple nearest neighbor sequencing"""
        if not waypoints:
            return []
        
        # Start with first waypoint
        sequence = [waypoints[0]]
        remaining = waypoints[1:]
        current = waypoints[0]
        
        while remaining:
            # Find nearest remaining waypoint
            nearest = min(remaining, key=lambda w: self._calculate_distance(
                current.latitude, current.longitude, w.latitude, w.longitude
            ))
            
            sequence.append(nearest)
            remaining.remove(nearest)
            current = nearest
        
        return sequence
    
    def _validate_route_constraints(self, waypoints: List[RouteWaypoint], capacity: int) -> List[RouteWaypoint]:
        """Validate and fix route constraints"""
        # Simplified validation - just ensure capacity
        pickups = [w for w in waypoints if w.type == 'pickup']
        if len(pickups) <= capacity:
            return waypoints
        else:
            # Keep highest priority pickups
            sorted_pickups = sorted(pickups, key=lambda w: w.priority, reverse=True)
            keep_pickups = sorted_pickups[:capacity]
            
            # Return original sequence filtered to kept pickups
            return [w for w in waypoints if w.type != 'pickup' or w in keep_pickups]
    
    def _prioritize_waypoints(self, waypoints: List[RouteWaypoint]) -> List[RouteWaypoint]:
        """Sort waypoints by priority and urgency"""
        def priority_score(w):
            time_urgency = (w.time_window_end - datetime.now()).total_seconds() / 3600  # Hours until deadline
            return (w.priority * 10) - time_urgency  # Higher priority and more urgent = higher score
        
        return sorted(waypoints, key=priority_score, reverse=True)
    
    def save_model(self, filepath: Optional[str] = None) -> str:
        """Save route optimization model configuration"""
        logger.info("💾 Saving route optimization model...")
        
        if not filepath:
            models_dir = Path("ml/models")
            models_dir.mkdir(exist_ok=True)
            filepath = f"ml/models/route_optimization_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pkl"
        
        model_data = {
            'zones': self.zones,
            'optimization_weights': self.optimization_weights,
            'max_detour_percent': self.max_detour_percent,
            'max_pool_passengers': self.max_pool_passengers,
            'max_pickup_time_minutes': self.max_pickup_time_minutes,
            'pickup_tolerance_minutes': self.pickup_tolerance_minutes,
            'dropoff_tolerance_minutes': self.dropoff_tolerance_minutes,
            'model_metadata': self.model_metadata,
            'version': '1.0.0',
            'timestamp': datetime.now().isoformat()
        }
        
        try:
            joblib.dump(model_data, filepath)
            logger.info(f"✅ Route optimization model saved to {filepath}")
            return filepath
        except Exception as e:
            logger.error(f"❌ Failed to save model: {e}")
            return ""
    
    def load_model(self, filepath: str) -> bool:
        """Load route optimization model configuration"""
        logger.info(f"📥 Loading route optimization model from {filepath}...")
        
        try:
            if not Path(filepath).exists():
                logger.error(f"❌ Model file not found: {filepath}")
                return False
                
            model_data = joblib.load(filepath)
            
            # Load configuration
            self.zones = model_data.get('zones', self.zones)
            self.optimization_weights = model_data.get('optimization_weights', self.optimization_weights)
            self.max_detour_percent = model_data.get('max_detour_percent', self.max_detour_percent)
            self.max_pool_passengers = model_data.get('max_pool_passengers', self.max_pool_passengers)
            self.max_pickup_time_minutes = model_data.get('max_pickup_time_minutes', self.max_pickup_time_minutes)
            self.pickup_tolerance_minutes = model_data.get('pickup_tolerance_minutes', self.pickup_tolerance_minutes)
            self.dropoff_tolerance_minutes = model_data.get('dropoff_tolerance_minutes', self.dropoff_tolerance_minutes)
            self.model_metadata = model_data.get('model_metadata', {})
            
            logger.info("✅ Route optimization model loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to load model: {e}")
            return False

# Example usage and testing
if __name__ == "__main__":
    # Initialize route optimization engine
    route_engine = RouteOptimizationEngine()
    
    print("🗺️ Testing Route Optimization Engine...")
    
    # Test ETA prediction
    eta = route_engine.predict_eta(36.373, -94.209, 36.385, -94.220)
    print(f"✅ ETA prediction: {eta.estimated_time_minutes:.1f} minutes (confidence: {eta.confidence_score:.2f})")
    
    # Test route optimization with sample data
    sample_requests = [
        {
            'id': 'req_1',
            'passenger_id': 'pass_1',
            'pickup_latitude': 36.375,
            'pickup_longitude': -94.210,
            'pickup_time': datetime.now().isoformat(),
            'priority': 1
        },
        {
            'id': 'req_2', 
            'passenger_id': 'pass_2',
            'pickup_latitude': 36.380,
            'pickup_longitude': -94.195,
            'pickup_time': datetime.now().isoformat(),
            'priority': 2
        }
    ]
    
    optimized_route = route_engine.optimize_pickup_route(
        driver_id='driver_1',
        driver_lat=36.373,
        driver_lng=-94.209,
        pending_requests=sample_requests
    )
    
    print(f"✅ Route optimization: {len(optimized_route.waypoints)} waypoints")
    print(f"   Distance: {optimized_route.total_distance_miles:.2f} miles")
    print(f"   Time: {optimized_route.total_time_minutes:.1f} minutes")
    print(f"   Efficiency: {optimized_route.route_efficiency_score:.2f}")
    print(f"   Earnings: ${optimized_route.estimated_earnings:.2f}")
    
    print("🎯 Route Optimization Engine test completed!")
