#!/usr/bin/env python3
"""
Dynamic Surge Pricing Model for Pi Rideshare Platform

This module implements a sophisticated surge pricing algorithm that dynamically
adjusts ride fares based on:
- Real-time supply vs demand balance
- Weather conditions impacting ride requests
- Traffic congestion affecting ride times
- Historical patterns and zone characteristics  
- Special events and peak period demand

Authors: Pi Rideshare ML Team
Version: 1.0.0
Date: September 2025
"""

import logging
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass
from pathlib import Path
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

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
class SurgePricing:
    """Data class for surge pricing results"""
    zone: str
    base_multiplier: float
    weather_multiplier: float 
    traffic_multiplier: float
    demand_multiplier: float
    final_multiplier: float
    confidence_score: float
    reasoning: str
    timestamp: datetime

class DynamicSurgePricingModel:
    """
    Advanced Dynamic Surge Pricing Model
    
    Features:
    - Supply vs Demand Analysis
    - Weather Impact Modeling 
    - Traffic Congestion Factors
    - Historical Pattern Recognition
    - Zone-specific Calibration
    - Real-time Price Adjustments
    """
    
    def __init__(self):
        """Initialize Dynamic Surge Pricing Model"""
        self.model = None
        self.scaler = StandardScaler()
        self.feature_columns = []
        self.zone_encodings = {}
        self.is_trained = False
        self.model_metadata = {}
        
        # Model configuration
        self.min_multiplier = 1.0  # Never below base price
        self.max_multiplier = 5.0  # Maximum 5x surge
        self.weather_weights = {
            'rain': 1.3,
            'snow': 1.8, 
            'storm': 2.0,
            'clear': 1.0,
            'cloudy': 1.1
        }
        self.traffic_thresholds = {
            'light': 1.0,
            'moderate': 1.2,
            'heavy': 1.5,
            'severe': 1.8
        }
        
        # Initialize ML components
        self.db_connection = MLDatabaseConnection()
        self.api_extractor = MLAPIDataExtractor()
        self.data_processor = MLDataProcessor()
        
        logger.info("💰 Dynamic Surge Pricing Model initialized")
    
    def prepare_training_data(self, include_live_data: bool = True) -> pd.DataFrame:
        """
        Prepare comprehensive training dataset for surge pricing model
        
        Args:
            include_live_data: Whether to include current weather/traffic conditions
            
        Returns:
            Training dataset with surge pricing features
        """
        logger.info("📈 Preparing surge pricing training dataset...")
        
        try:
            # Get comprehensive ML dataset
            training_data = self.data_processor.create_comprehensive_training_dataset(
                include_live_data=include_live_data
            )
            
            if training_data.empty:
                logger.warning("⚠️ No training data available")
                return pd.DataFrame()
            
            # Add surge pricing specific features
            surge_features = self._engineer_surge_features(training_data)
            
            logger.info(f"✅ Prepared {len(surge_features)} training samples with {len(surge_features.columns)} features")
            return surge_features
            
        except Exception as e:
            logger.error(f"❌ Failed to prepare training data: {e}")
            return pd.DataFrame()
    
    def _engineer_surge_features(self, data: pd.DataFrame) -> pd.DataFrame:
        """
        Engineer advanced features for surge pricing prediction
        
        Args:
            data: Base dataset with ride and environmental data
            
        Returns:
            Dataset enhanced with surge pricing features
        """
        logger.info("🔧 Engineering surge pricing features...")
        
        surge_data = data.copy()
        
        try:
            # 1. Supply vs Demand Ratio Features
            if 'driver_count' in surge_data.columns and 'ride_count' in surge_data.columns:
                surge_data['supply_demand_ratio'] = (
                    surge_data['driver_count'] / (surge_data['ride_count'] + 1)
                ).fillna(1.0)
            else:
                surge_data['supply_demand_ratio'] = 1.0
            
            # 2. Weather Impact Scoring
            surge_data['weather_severity_score'] = 0.0
            if 'weather_condition' in surge_data.columns:
                weather_mapping = {
                    'clear': 0.0, 'sunny': 0.0, 'partly_cloudy': 0.1,
                    'cloudy': 0.2, 'overcast': 0.3, 'mist': 0.4,
                    'light_rain': 0.5, 'rain': 0.7, 'heavy_rain': 0.9,
                    'snow': 1.0, 'storm': 1.2, 'severe_weather': 1.5
                }
                surge_data['weather_severity_score'] = surge_data['weather_condition'].map(
                    weather_mapping
                ).fillna(0.0)
            
            # 3. Traffic Congestion Impact
            surge_data['traffic_severity_score'] = 0.0
            if 'traffic_delay_minutes' in surge_data.columns:
                surge_data['traffic_severity_score'] = np.clip(
                    surge_data['traffic_delay_minutes'] / 30.0,  # Normalize to 30min max
                    0.0, 1.0
                )
            
            # 4. Time-based Demand Patterns
            current_time = datetime.now()
            surge_data['is_peak_hour'] = surge_data.get('is_rush_hour', 0)
            surge_data['is_weekend_evening'] = (
                surge_data.get('is_weekend', 0) * 
                (surge_data.get('ride_hour', 12) >= 18).astype(int)
            )
            
            # 5. Historical Surge Multiplier (Target Variable)
            # Calculate based on fare efficiency and market conditions
            if 'fare_per_mile' in surge_data.columns:
                # Estimate surge based on fare efficiency vs baseline
                baseline_fare_per_mile = surge_data['fare_per_mile'].median()
                surge_data['historical_surge_multiplier'] = np.clip(
                    surge_data['fare_per_mile'] / (baseline_fare_per_mile + 0.01),
                    1.0, 5.0
                )
            else:
                # Fallback: synthetic surge based on conditions
                surge_data['historical_surge_multiplier'] = (
                    1.0 + 
                    surge_data['weather_severity_score'] * 0.5 +
                    surge_data['traffic_severity_score'] * 0.3 +
                    (1.0 / (surge_data['supply_demand_ratio'] + 0.1) - 1.0) * 0.4
                ).clip(1.0, 5.0)
            
            # 6. Zone-specific Features
            if 'pickup_zone' in surge_data.columns:
                # Zone demand density
                zone_stats = surge_data.groupby('pickup_zone').agg({
                    'historical_surge_multiplier': 'mean',
                    'ride_count': 'sum'
                }).reset_index().rename(columns={
                    'historical_surge_multiplier': 'zone_avg_surge',
                    'ride_count': 'zone_total_rides'
                })
                surge_data = surge_data.merge(zone_stats, on='pickup_zone', how='left')
                
                # Encode zones numerically  
                unique_zones = surge_data['pickup_zone'].unique()
                self.zone_encodings = {zone: idx for idx, zone in enumerate(unique_zones)}
                surge_data['pickup_zone_encoded'] = surge_data['pickup_zone'].map(self.zone_encodings)
            
            logger.info(f"✅ Engineered surge features: {len(surge_data.columns)} total columns")
            return surge_data
            
        except Exception as e:
            logger.error(f"❌ Feature engineering failed: {e}")
            return data
    
    def train_model(self, training_data: pd.DataFrame) -> Dict[str, Any]:
        """
        Train the dynamic surge pricing model
        
        Args:
            training_data: Prepared training dataset with surge features
            
        Returns:
            Training results and performance metrics
        """
        if training_data.empty:
            logger.error("❌ Cannot train on empty dataset")
            return {'success': False, 'error': 'No training data'}
        
        if len(training_data) < 20:
            logger.error(f"❌ Insufficient data for training: {len(training_data)} samples (minimum 20 required)")
            return {'success': False, 'error': f'Insufficient training data: {len(training_data)} samples'}
        
        logger.info(f"💰 Training surge pricing model with {len(training_data)} samples...")
        
        try:
            # Define features for surge prediction
            feature_candidates = [
                'supply_demand_ratio', 'weather_severity_score', 'traffic_severity_score',
                'is_peak_hour', 'is_weekend_evening', 'ride_hour', 'ride_day_of_week',
                'pickup_zone_encoded', 'zone_avg_surge', 'zone_total_rides'
            ]
            
            # Select available features
            self.feature_columns = [col for col in feature_candidates if col in training_data.columns]
            
            if not self.feature_columns:
                logger.error("❌ No valid features found for training")
                return {'success': False, 'error': 'No valid features'}
            
            # Prepare feature matrix and target
            X = training_data[self.feature_columns].fillna(0)
            y = training_data['historical_surge_multiplier'].fillna(1.0)
            
            # Feature scaling
            X_scaled = self.scaler.fit_transform(X)
            
            # Train/validation split with fallback for small datasets
            try:
                if len(X) >= 40:
                    X_train, X_test, y_train, y_test = train_test_split(
                        X_scaled, y, test_size=0.2, random_state=42
                    )
                else:
                    logger.warning("⚠️ Small dataset - training on all data without holdout")
                    X_train, X_test, y_train, y_test = X_scaled, X_scaled, y, y
            except Exception as e:
                logger.warning(f"⚠️ Train/test split failed: {e} - using all data")
                X_train, X_test, y_train, y_test = X_scaled, X_scaled, y, y
            
            # Train Random Forest model for surge pricing
            self.model = RandomForestRegressor(
                n_estimators=100,
                max_depth=10,
                min_samples_split=5,
                min_samples_leaf=2,
                random_state=42,
                n_jobs=-1
            )
            
            self.model.fit(X_train, y_train)
            self.is_trained = True
            
            # Evaluate model performance
            y_pred = self.model.predict(X_test)
            
            # Calculate metrics
            mae = mean_absolute_error(y_test, y_pred)
            mse = mean_squared_error(y_test, y_pred)
            r2 = r2_score(y_test, y_pred)
            
            # Feature importance analysis
            feature_importance = dict(zip(
                self.feature_columns,
                self.model.feature_importances_
            ))
            sorted_features = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)
            
            # Store model metadata
            self.model_metadata = {
                'train_samples': len(X_train),
                'test_samples': len(X_test),
                'features_count': len(self.feature_columns),
                'mae': mae,
                'mse': mse,
                'r2_score': r2,
                'feature_importance': dict(sorted_features[:5]),
                'training_date': datetime.now().isoformat()
            }
            
            logger.info(f"✅ Surge pricing model trained successfully!")
            logger.info(f"📊 Model Performance: MAE={mae:.3f}, R²={r2:.3f}")
            logger.info(f"🕑 Top Features: {list(dict(sorted_features[:3]).keys())}")
            
            return {
                'success': True,
                'metrics': {
                    'mae': mae,
                    'mse': mse,
                    'r2_score': r2
                },
                'feature_importance': dict(sorted_features),
                'training_samples': len(X_train)
            }
            
        except Exception as e:
            logger.error(f"❌ Model training failed: {e}")
            import traceback
            traceback.print_exc()
            return {'success': False, 'error': str(e)}
    
    def calculate_surge_multiplier(self, zone: str, current_conditions: Dict[str, Any] = None) -> SurgePricing:
        """
        Calculate dynamic surge multiplier for a specific zone
        
        Args:
            zone: Target zone name
            current_conditions: Optional current weather/traffic conditions
            
        Returns:
            SurgePricing object with detailed surge calculation
        """
        if not self.is_trained:
            logger.warning("⚠️ Model not trained - using baseline surge")
            return self._baseline_surge_pricing(zone)
        
        try:
            # Prepare current feature vector
            current_features = self._prepare_current_features(zone, current_conditions)
            
            if current_features is None:
                return self._baseline_surge_pricing(zone)
            
            # Scale features
            features_scaled = self.scaler.transform([current_features])
            
            # Predict surge multiplier
            predicted_surge = self.model.predict(features_scaled)[0]
            
            # Apply constraints and business rules
            final_multiplier = np.clip(predicted_surge, self.min_multiplier, self.max_multiplier)
            
            # Calculate component multipliers for transparency
            weather_mult = self._calculate_weather_multiplier(current_conditions)
            traffic_mult = self._calculate_traffic_multiplier(current_conditions)
            demand_mult = predicted_surge / (weather_mult * traffic_mult) if (weather_mult * traffic_mult) > 0 else 1.0
            
            # Calculate confidence based on prediction certainty
            confidence = min(0.95, max(0.6, 1.0 - abs(predicted_surge - final_multiplier)))
            
            # Generate reasoning
            reasoning = self._generate_surge_reasoning(
                zone, weather_mult, traffic_mult, demand_mult, final_multiplier
            )
            
            return SurgePricing(
                zone=zone,
                base_multiplier=1.0,
                weather_multiplier=weather_mult,
                traffic_multiplier=traffic_mult,
                demand_multiplier=demand_mult,
                final_multiplier=final_multiplier,
                confidence_score=confidence,
                reasoning=reasoning,
                timestamp=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"❌ Surge calculation failed for {zone}: {e}")
            return self._baseline_surge_pricing(zone)
    
    def _prepare_current_features(self, zone: str, conditions: Dict[str, Any] = None) -> Optional[List[float]]:
        """Prepare feature vector for current zone and conditions"""
        try:
            features = [0.0] * len(self.feature_columns)
            
            # Current time features
            now = datetime.now()
            hour = now.hour
            day_of_week = now.weekday()
            
            for i, feature in enumerate(self.feature_columns):
                if feature == 'ride_hour':
                    features[i] = hour
                elif feature == 'ride_day_of_week':
                    features[i] = day_of_week
                elif feature == 'is_peak_hour':
                    features[i] = 1 if hour in [7, 8, 9, 17, 18, 19] else 0
                elif feature == 'is_weekend_evening':
                    features[i] = 1 if (day_of_week >= 5 and hour >= 18) else 0
                elif feature == 'pickup_zone_encoded':
                    features[i] = self.zone_encodings.get(zone, 0)
                elif feature == 'weather_severity_score' and conditions:
                    weather_condition = conditions.get('weather_condition', 'clear')
                    weather_scores = {
                        'clear': 0.0, 'cloudy': 0.2, 'rain': 0.7, 'snow': 1.0, 'storm': 1.2
                    }
                    features[i] = weather_scores.get(weather_condition, 0.0)
                elif feature == 'traffic_severity_score' and conditions:
                    traffic_delay = conditions.get('traffic_delay_minutes', 0)
                    features[i] = min(traffic_delay / 30.0, 1.0)
                elif feature == 'supply_demand_ratio':
                    # Default ratio - could be enhanced with real-time data
                    features[i] = 0.8
            
            return features
            
        except Exception as e:
            logger.error(f"❌ Feature preparation failed: {e}")
            return None
    
    def _calculate_weather_multiplier(self, conditions: Dict[str, Any] = None) -> float:
        """Calculate weather-based surge multiplier"""
        if not conditions:
            return 1.0
        
        weather_condition = conditions.get('weather_condition', 'clear')
        return self.weather_weights.get(weather_condition, 1.0)
    
    def _calculate_traffic_multiplier(self, conditions: Dict[str, Any] = None) -> float:
        """Calculate traffic-based surge multiplier"""
        if not conditions:
            return 1.0
        
        traffic_delay = conditions.get('traffic_delay_minutes', 0)
        if traffic_delay <= 5:
            return 1.0
        elif traffic_delay <= 15:
            return 1.2
        elif traffic_delay <= 30:
            return 1.5
        else:
            return 1.8
    
    def _baseline_surge_pricing(self, zone: str) -> SurgePricing:
        """Fallback surge pricing when model is unavailable"""
        now = datetime.now()
        hour = now.hour
        
        # Simple time-based surge
        if hour in [7, 8, 9, 17, 18, 19]:  # Rush hour
            multiplier = 1.5
            reasoning = "Rush hour surge pricing"
        elif hour >= 22 or hour <= 4:  # Late night
            multiplier = 1.3
            reasoning = "Late night surge pricing"
        else:
            multiplier = 1.0
            reasoning = "Standard pricing"
        
        return SurgePricing(
            zone=zone,
            base_multiplier=1.0,
            weather_multiplier=1.0,
            traffic_multiplier=1.0,
            demand_multiplier=multiplier,
            final_multiplier=multiplier,
            confidence_score=0.7,
            reasoning=reasoning,
            timestamp=datetime.now()
        )
    
    def _generate_surge_reasoning(self, zone: str, weather_mult: float, 
                                traffic_mult: float, demand_mult: float, final_mult: float) -> str:
        """Generate human-readable reasoning for surge pricing"""
        reasons = []
        
        if weather_mult > 1.2:
            reasons.append(f"Poor weather conditions ({weather_mult:.1f}x)")
        if traffic_mult > 1.2:
            reasons.append(f"Heavy traffic congestion ({traffic_mult:.1f}x)")
        if demand_mult > 1.3:
            reasons.append(f"High demand in {zone} ({demand_mult:.1f}x)")
        
        if not reasons:
            if final_mult > 1.1:
                reasons.append("Moderate demand increase")
            else:
                reasons.append("Normal pricing conditions")
        
        return "; ".join(reasons)
    
    def save_model(self, filepath: Optional[str] = None) -> str:
        """Save trained surge pricing model to disk"""
        if not self.is_trained:
            logger.error("❌ Cannot save untrained model")
            return ""
        
        if not filepath:
            models_dir = Path("ml/models")
            models_dir.mkdir(exist_ok=True)
            filepath = f"ml/models/surge_pricing_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pkl"
        
        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'feature_columns': self.feature_columns,
            'zone_encodings': self.zone_encodings,
            'is_trained': self.is_trained,
            'metadata': self.model_metadata,
            'min_multiplier': self.min_multiplier,
            'max_multiplier': self.max_multiplier,
            'weather_weights': self.weather_weights,
            'traffic_thresholds': self.traffic_thresholds,
            'version': '1.0.0'
        }
        
        try:
            joblib.dump(model_data, filepath)
            logger.info(f"💾 Surge pricing model saved to {filepath}")
            return filepath
        except Exception as e:
            logger.error(f"❌ Failed to save model: {e}")
            return ""
    
    def load_model(self, filepath: str) -> bool:
        """Load trained surge pricing model from disk"""
        try:
            if not Path(filepath).exists():
                logger.error(f"❌ Model file not found: {filepath}")
                return False
                
            model_data = joblib.load(filepath)
            
            # Validate and load model components
            required_keys = ['model', 'scaler', 'feature_columns', 'zone_encodings']
            for key in required_keys:
                if key not in model_data:
                    logger.error(f"❌ Invalid model file: missing {key}")
                    return False
            
            self.model = model_data['model']
            self.scaler = model_data['scaler']
            self.feature_columns = model_data['feature_columns']
            self.zone_encodings = model_data['zone_encodings']
            self.model_metadata = model_data.get('metadata', {})
            self.is_trained = model_data.get('is_trained', True)
            
            # Load configuration parameters
            self.min_multiplier = model_data.get('min_multiplier', 1.0)
            self.max_multiplier = model_data.get('max_multiplier', 5.0)
            self.weather_weights = model_data.get('weather_weights', self.weather_weights)
            self.traffic_thresholds = model_data.get('traffic_thresholds', self.traffic_thresholds)
            
            logger.info(f"📥 Surge pricing model loaded from {filepath}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to load model: {e}")
            return False

# Example usage and testing
if __name__ == "__main__":
    # Initialize surge pricing model
    surge_model = DynamicSurgePricingModel()
    
    # Test with synthetic data if no real data available
    print("💰 Testing Dynamic Surge Pricing Model...")
    
    # Test baseline surge pricing
    baseline_surge = surge_model.calculate_surge_multiplier("downtown")
    print(f"Baseline surge for downtown: {baseline_surge.final_multiplier:.2f}x")
    print(f"Reasoning: {baseline_surge.reasoning}")
