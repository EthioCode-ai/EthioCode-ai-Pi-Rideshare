"""
Demand Prediction Model - Component 1
Predicts ride demand by geographic zone and time periods using historical data, weather, and patterns
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple, Optional
import logging
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
from pathlib import Path

# Package-relative imports for production reliability
from ml.utils.database_connection import get_ml_data_connection
from ml.utils.api_data_extractor import get_ml_api_extractor
from ml.data_pipeline.ml_data_processor import MLDataProcessor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DemandPredictionModel:
    """
    Intelligent demand prediction model that forecasts ride requests by zone and time.
    
    Features:
    - Time-based patterns (hour, day of week, seasonality)
    - Weather impact analysis
    - Geographic zone demand distribution
    - Historical trend learning
    - Multiple prediction horizons (1h, 4h, 24h)
    """
    
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.feature_columns = []
        self.zone_encodings = {}
        self.is_trained = False
        self.model_metadata = {}
        
        # Geographic zones (from Bentonville, AR area)
        self.zones = {
            'downtown': {'lat': 36.3729, 'lng': -94.2088, 'name': 'Downtown Business District'},
            'airport': {'lat': 36.3850, 'lng': -94.2200, 'name': 'XNA Regional Airport'},
            'business': {'lat': 36.3650, 'lng': -94.2000, 'name': 'Business Parks'},
            'residential': {'lat': 36.3800, 'lng': -94.1950, 'name': 'Residential Areas'},
            'retail': {'lat': 36.3680, 'lng': -94.2080, 'name': 'Shopping Centers'}
        }
        
        # Data pipeline components
        self.db_connection = get_ml_data_connection()
        self.api_extractor = get_ml_api_extractor()
        self.data_processor = MLDataProcessor()
        
        logger.info("🎯 Demand Prediction Model initialized")
    
    def prepare_training_data(self, days_back: int = 30) -> pd.DataFrame:
        """
        Prepare comprehensive training dataset for demand prediction
        
        Args:
            days_back: Number of days of historical data to use
            
        Returns:
            Prepared DataFrame with features and target variable
        """
        logger.info(f"📊 Preparing training data for {days_back} days...")
        
        # Get comprehensive dataset from our ML data processor
        dataset = self.data_processor.create_comprehensive_training_dataset(
            days_back=days_back,
            include_live_data=True  # Include weather and traffic patterns for training
        )
        
        if dataset.empty:
            logger.error("❌ No training data available")
            return pd.DataFrame()
        
        # Feature engineering for demand prediction
        logger.info("🔧 Engineering demand prediction features...")
        
        # Time-based features
        if 'created_at' in dataset.columns:
            dataset['prediction_hour'] = pd.to_datetime(dataset['created_at']).dt.hour
            dataset['prediction_day_of_week'] = pd.to_datetime(dataset['created_at']).dt.dayofweek
            dataset['prediction_month'] = pd.to_datetime(dataset['created_at']).dt.month
            dataset['is_weekend'] = dataset['prediction_day_of_week'].isin([5, 6]).astype(int)
            dataset['is_rush_hour'] = dataset['prediction_hour'].isin([7, 8, 9, 17, 18, 19]).astype(int)
        
        # Zone-based demand aggregation
        if 'pickup_zone' in dataset.columns:
            # Count rides per zone per hour as our target variable
            zone_hourly_demand = dataset.groupby(['pickup_zone', 'prediction_hour']).size().reset_index(name='demand_count')
            
            # Create zone encoding for categorical data
            unique_zones = zone_hourly_demand['pickup_zone'].unique()
            self.zone_encodings = {zone: idx for idx, zone in enumerate(unique_zones)}
            zone_hourly_demand['zone_encoded'] = zone_hourly_demand['pickup_zone'].map(self.zone_encodings)
        else:
            logger.warning("⚠️ No zone information available, using basic aggregation")
            # Fallback: aggregate by hour only
            zone_hourly_demand = dataset.groupby('prediction_hour').size().reset_index(name='demand_count')
            zone_hourly_demand['zone_encoded'] = 0  # Default zone
        
        # Weather impact features
        weather_features = []
        if 'weather_temp' in dataset.columns:
            weather_features.extend(['weather_temp', 'weather_humidity'])
        if 'weather_condition' in dataset.columns:
            # Encode weather conditions
            weather_conditions = dataset['weather_condition'].fillna('clear').unique()
            weather_encoding = {condition: idx for idx, condition in enumerate(weather_conditions)}
            dataset['weather_encoded'] = dataset['weather_condition'].fillna('clear').map(weather_encoding)
            weather_features.append('weather_encoded')
        
        # Traffic impact features
        traffic_features = []
        if 'traffic_delay_minutes' in dataset.columns:
            traffic_features.extend(['traffic_delay_minutes'])
        
        # Merge weather and traffic data back to zone_hourly_demand
        if weather_features or traffic_features:
            # Get average weather/traffic conditions per hour
            hourly_conditions = dataset.groupby('prediction_hour')[weather_features + traffic_features].mean().reset_index()
            zone_hourly_demand = zone_hourly_demand.merge(hourly_conditions, on='prediction_hour', how='left')
        
        # Fill any missing values
        zone_hourly_demand = zone_hourly_demand.fillna(0)
        
        logger.info(f"✅ Training data prepared: {len(zone_hourly_demand)} samples")
        logger.info(f"📈 Average demand per hour: {zone_hourly_demand['demand_count'].mean():.2f}")
        
        return zone_hourly_demand
    
    def train_model(self, training_data: pd.DataFrame) -> Dict[str, Any]:
        """
        Train the demand prediction model with robustness checks
        
        Args:
            training_data: Prepared training dataset
            
        Returns:
            Training results and metrics
        """
        if training_data.empty:
            logger.error("❌ Cannot train on empty dataset")
            return {'success': False, 'error': 'No training data'}
        
        # Minimum sample check for robust training
        if len(training_data) < 10:
            logger.error(f"❌ Insufficient data for training: {len(training_data)} samples (minimum 10 required)")
            return {'success': False, 'error': f'Insufficient training data: {len(training_data)} samples'}
        
        logger.info(f"🤖 Training demand prediction model with {len(training_data)} samples...")
        
        # Prepare features and target
        feature_cols = ['prediction_hour', 'zone_encoded', 'is_weekend', 'is_rush_hour']
        
        # Add weather features if available
        weather_cols = [col for col in training_data.columns if col.startswith('weather_')]
        feature_cols.extend(weather_cols)
        
        # Add traffic features if available
        traffic_cols = [col for col in training_data.columns if col.startswith('traffic_')]
        feature_cols.extend(traffic_cols)
        
        # Filter to available columns only
        available_features = [col for col in feature_cols if col in training_data.columns]
        
        if not available_features:
            logger.error("❌ No valid features found for training")
            return {'success': False, 'error': 'No valid features'}
        
        self.feature_columns = available_features
        
        # Prepare X (features) and y (target)
        X = training_data[self.feature_columns]
        y = training_data['demand_count']
        
        logger.info(f"📊 Training with features: {self.feature_columns}")
        logger.info(f"📊 Training samples: {len(X)}, Target range: {y.min():.1f} - {y.max():.1f}")
        
        # Split data for training and validation with fallback
        try:
            if len(X) >= 20:  # Sufficient for train/test split
                X_train, X_test, y_train, y_test = train_test_split(
                    X, y, test_size=0.2, random_state=42, stratify=None
                )
            else:
                # Fallback: train on all data for small datasets
                logger.warning("⚠️ Small dataset - training on all data without holdout")
                X_train, X_test, y_train, y_test = X, X, y, y
        except Exception as e:
            logger.warning(f"⚠️ Train/test split failed: {e} - using all data")
            X_train, X_test, y_train, y_test = X, X, y, y
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Train Random Forest model (robust for demand prediction)
        self.model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            min_samples_split=5,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1
        )
        
        self.model.fit(X_train_scaled, y_train)
        
        # Evaluate model
        y_pred = self.model.predict(X_test_scaled)
        
        metrics = {
            'mae': mean_absolute_error(y_test, y_pred),
            'mse': mean_squared_error(y_test, y_pred),
            'rmse': np.sqrt(mean_squared_error(y_test, y_pred)),
            'r2': r2_score(y_test, y_pred)
        }
        
        # Feature importance
        feature_importance = dict(zip(self.feature_columns, self.model.feature_importances_))
        
        self.is_trained = True
        self.model_metadata = {
            'training_date': datetime.now().isoformat(),
            'training_samples': len(X_train),
            'test_samples': len(X_test),
            'features': self.feature_columns,
            'metrics': metrics,
            'feature_importance': feature_importance
        }
        
        logger.info("✅ Model training completed")
        logger.info(f"📊 Model Performance - MAE: {metrics['mae']:.2f}, R²: {metrics['r2']:.3f}")
        
        return {
            'success': True,
            'metrics': metrics,
            'feature_importance': feature_importance,
            'model_metadata': self.model_metadata
        }
    
    def predict_demand(self, zone: str, hour: int, 
                      weather_data: Optional[Dict] = None,
                      traffic_data: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Predict demand for a specific zone and time
        
        Args:
            zone: Geographic zone name
            hour: Hour of day (0-23)
            weather_data: Optional weather conditions
            traffic_data: Optional traffic conditions
            
        Returns:
            Prediction results with confidence
        """
        if not self.is_trained:
            logger.error("❌ Model not trained yet")
            return {'error': 'Model not trained'}
        
        # Prepare prediction features
        features = {}
        
        # Time features
        features['prediction_hour'] = hour
        features['is_weekend'] = 1 if datetime.now().weekday() >= 5 else 0
        features['is_rush_hour'] = 1 if hour in [7, 8, 9, 17, 18, 19] else 0
        
        # Zone encoding
        if zone in self.zone_encodings:
            features['zone_encoded'] = self.zone_encodings[zone]
        else:
            features['zone_encoded'] = 0  # Default fallback
        
        # Weather features (if model was trained with them)
        if weather_data:
            if 'weather_temp' in self.feature_columns:
                features['weather_temp'] = weather_data.get('temperature', 70)
                features['weather_humidity'] = weather_data.get('humidity', 50)
            if 'weather_encoded' in self.feature_columns:
                # Simple weather encoding
                condition = weather_data.get('condition', 'clear').lower()
                if 'rain' in condition:
                    features['weather_encoded'] = 1
                elif 'snow' in condition:
                    features['weather_encoded'] = 2
                else:
                    features['weather_encoded'] = 0
        
        # Traffic features (if model was trained with them)
        if traffic_data and 'traffic_delay_minutes' in self.feature_columns:
            features['traffic_delay_minutes'] = traffic_data.get('delay_minutes', 0)
        
        # Fill missing features with defaults
        for col in self.feature_columns:
            if col not in features:
                features[col] = 0
        
        # Create prediction array
        X_pred = np.array([[features[col] for col in self.feature_columns]])
        X_pred_scaled = self.scaler.transform(X_pred)
        
        # Make prediction
        if self.model is None:
            logger.error("❌ Model is None")
            return {'error': 'Model not initialized'}
            
        predicted_demand = self.model.predict(X_pred_scaled)[0]
        
        # Get prediction confidence (using tree variance for Random Forest)
        tree_predictions = [tree.predict(X_pred_scaled)[0] for tree in self.model.estimators_]
        prediction_std = np.std(tree_predictions)
        confidence = max(0, 1 - (prediction_std / max(predicted_demand, 1)))
        
        result = {
            'zone': zone,
            'hour': hour,
            'predicted_demand': max(0, round(predicted_demand, 2)),  # No negative demand
            'confidence': round(confidence, 3),
            'prediction_range': {
                'low': max(0, round(predicted_demand - prediction_std, 2)),
                'high': round(predicted_demand + prediction_std, 2)
            },
            'features_used': features,
            'timestamp': datetime.now().isoformat()
        }
        
        return result
    
    def get_zone_demand_forecast(self, hours_ahead: int = 24) -> List[Dict[str, Any]]:
        """
        Get demand forecast for all zones for the next N hours
        
        Args:
            hours_ahead: Number of hours to forecast
            
        Returns:
            List of demand predictions for each zone and hour
        """
        if not self.is_trained:
            logger.error("❌ Model not trained yet")
            return []
        
        forecasts = []
        current_time = datetime.now()
        
        # Get current weather if possible (for more accurate predictions)
        try:
            current_weather = self.api_extractor.get_weather_data(36.3729, -94.2088)
        except:
            current_weather = None
        
        # Forecast for each zone and each hour
        for zone_name in self.zones.keys():
            for hour_offset in range(hours_ahead):
                forecast_time = current_time + timedelta(hours=hour_offset)
                forecast_hour = forecast_time.hour
                
                prediction = self.predict_demand(
                    zone=zone_name,
                    hour=forecast_hour,
                    weather_data=current_weather
                )
                
                if 'error' not in prediction:
                    prediction['forecast_time'] = forecast_time.isoformat()
                    forecasts.append(prediction)
        
        logger.info(f"📈 Generated {len(forecasts)} demand forecasts")
        return forecasts
    
    def save_model(self, filepath: Optional[str] = None) -> str:
        """Save trained model to disk with full persistence"""
        if not self.is_trained:
            logger.error("❌ Cannot save untrained model")
            return ""
        
        if not filepath:
            models_dir = Path("ml/models")
            models_dir.mkdir(exist_ok=True)
            filepath = f"ml/models/demand_prediction_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pkl"
        
        # Complete model persistence data
        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'feature_columns': self.feature_columns,
            'zone_encodings': self.zone_encodings,
            'zones': self.zones,
            'is_trained': self.is_trained,
            'metadata': self.model_metadata,
            'version': '1.0.0'
        }
        
        try:
            joblib.dump(model_data, filepath)
            logger.info(f"💾 Model saved successfully to {filepath}")
            return filepath
        except Exception as e:
            logger.error(f"❌ Failed to save model: {e}")
            return ""
    
    def load_model(self, filepath: str) -> bool:
        """Load trained model from disk with compatibility validation"""
        try:
            if not Path(filepath).exists():
                logger.error(f"❌ Model file not found: {filepath}")
                return False
                
            model_data = joblib.load(filepath)
            
            # Validate model compatibility
            required_keys = ['model', 'scaler', 'feature_columns', 'zone_encodings', 'metadata']
            for key in required_keys:
                if key not in model_data:
                    logger.error(f"❌ Invalid model file: missing {key}")
                    return False
            
            # Load with validation
            self.model = model_data['model']
            self.scaler = model_data['scaler']
            self.feature_columns = model_data['feature_columns']
            self.zone_encodings = model_data['zone_encodings']
            self.zones = model_data.get('zones', self.zones)  # Fallback to default
            self.model_metadata = model_data['metadata']
            self.is_trained = True
            
            # Validate feature compatibility
            if not isinstance(self.feature_columns, list) or not self.feature_columns:
                logger.error("❌ Invalid feature columns in loaded model")
                return False
                
            logger.info(f"📥 Model loaded successfully from {filepath}")
            logger.info(f"📊 Features: {len(self.feature_columns)}, Zones: {len(self.zone_encodings)}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to load model: {e}")
            return False
    
    def load_latest_model(self, models_dir: str = "ml/models") -> bool:
        """Load the most recent model from models directory"""
        models_path = Path(models_dir)
        if not models_path.exists():
            logger.error(f"❌ Models directory not found: {models_dir}")
            return False
            
        # Find latest model file
        model_files = list(models_path.glob("demand_prediction_*.pkl"))
        if not model_files:
            logger.error("❌ No demand prediction models found")
            return False
            
        latest_model = max(model_files, key=lambda x: x.stat().st_mtime)
        logger.info(f"🔍 Loading latest model: {latest_model.name}")
        
        return self.load_model(str(latest_model))
    
    def is_model_compatible(self, filepath: str) -> bool:
        """Check if model file is compatible without loading"""
        try:
            model_data = joblib.load(filepath)
            required_keys = ['model', 'scaler', 'feature_columns', 'zone_encodings', 'metadata']
            return all(key in model_data for key in required_keys)
        except:
            return False

# Convenience function for easy access
def train_demand_prediction_model(days_back: int = 30) -> DemandPredictionModel:
    """
    Train a new demand prediction model with historical data
    
    Args:
        days_back: Number of days of historical data to use
        
    Returns:
        Trained DemandPredictionModel instance
    """
    model = DemandPredictionModel()
    training_data = model.prepare_training_data(days_back)
    
    if not training_data.empty:
        result = model.train_model(training_data)
        if result.get('success'):
            logger.info("🎯 Demand prediction model trained successfully")
        else:
            logger.error(f"❌ Model training failed: {result.get('error')}")
    else:
        logger.error("❌ No training data available")
    
    return model