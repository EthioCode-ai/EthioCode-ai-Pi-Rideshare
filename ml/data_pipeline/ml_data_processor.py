"""
ML Data Processing Pipeline
Orchestrates data collection from database and APIs for ML model training
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
import logging
import json
import os
from pathlib import Path

# Import our custom utilities using package-relative imports
from ml.utils.database_connection import MLDatabaseConnection, get_ml_data_connection
from ml.utils.api_data_extractor import MLAPIDataExtractor, get_ml_api_extractor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MLDataProcessor:
    """
    Core ML Data Processing Pipeline
    Combines historical ride data, real-time weather/traffic, and driver positioning data
    """
    
    def __init__(self):
        self.db_connection = get_ml_data_connection()
        self.api_extractor = get_ml_api_extractor()
        
        # Define geographic zones for Bentonville, AR area
        self.zones = {
            'downtown': {'lat': 36.3729, 'lng': -94.2088, 'name': 'Downtown Business District'},
            'airport': {'lat': 36.3850, 'lng': -94.2200, 'name': 'XNA Regional Airport'},
            'business': {'lat': 36.3650, 'lng': -94.2000, 'name': 'Business Parks'},
            'residential': {'lat': 36.3800, 'lng': -94.1950, 'name': 'Residential Areas'},
            'retail': {'lat': 36.3680, 'lng': -94.2080, 'name': 'Shopping Centers'}
        }
        
        logger.info("🔧 ML Data Processor initialized")
    
    def create_comprehensive_training_dataset(self, 
                                            days_back: int = 30,
                                            include_live_data: bool = True) -> pd.DataFrame:
        """
        Create comprehensive training dataset combining all data sources
        
        Args:
            days_back: Number of days of historical data to include
            include_live_data: Whether to include current weather/traffic conditions
            
        Returns:
            Complete DataFrame ready for ML training
        """
        logger.info(f"📊 Creating comprehensive training dataset for last {days_back} days")
        
        # Step 1: Get historical ride data
        historical_rides = self._get_historical_ride_features(days_back)
        logger.info(f"✅ Retrieved {len(historical_rides)} historical rides")
        
        # Step 2: Get zone demand patterns
        zone_demand = self._get_zone_demand_features(days_back * 24)  # Convert to hours
        logger.info(f"✅ Retrieved demand data for {len(zone_demand)} zone-hour combinations")
        
        # Step 3: Get current driver positioning data
        driver_positions = self._get_driver_positioning_features()
        logger.info(f"✅ Retrieved positioning data for {len(driver_positions)} drivers")
        
        # Step 4: Get live weather and traffic data (if requested)
        if include_live_data:
            live_conditions = self._get_live_condition_features()
            logger.info(f"✅ Retrieved live conditions for {len(live_conditions)} zones")
        else:
            live_conditions = pd.DataFrame()
        
        # Step 5: Combine all data sources
        combined_dataset = self._combine_data_sources(
            historical_rides, 
            zone_demand, 
            driver_positions, 
            live_conditions
        )
        
        logger.info(f"🎯 Created comprehensive dataset with {len(combined_dataset)} rows and {len(combined_dataset.columns)} features")
        
        return combined_dataset
    
    def _get_historical_ride_features(self, days_back: int) -> pd.DataFrame:
        """Extract and engineer features from historical ride data"""
        with self.db_connection as db:
            rides_df = db.get_historical_rides(days_back)
        
        if rides_df.empty:
            logger.warning("⚠️ No historical ride data found")
            return pd.DataFrame()
        
        # Feature engineering for ride data
        rides_df['ride_date'] = pd.to_datetime(rides_df['created_at']).dt.date
        rides_df['ride_hour'] = pd.to_datetime(rides_df['created_at']).dt.hour
        rides_df['ride_day_of_week'] = pd.to_datetime(rides_df['created_at']).dt.dayofweek
        rides_df['is_weekend'] = rides_df['ride_day_of_week'].isin([5, 6])
        rides_df['is_rush_hour'] = rides_df['ride_hour'].isin([7, 8, 9, 17, 18, 19])
        
        # Calculate distance using Haversine formula and fare efficiency
        def haversine_distance(lat1, lon1, lat2, lon2):
            """Calculate distance in miles using Haversine formula"""
            from math import radians, cos, sin, asin, sqrt
            
            # Convert to radians
            lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
            
            # Haversine formula
            dlat = lat2 - lat1
            dlon = lon2 - lon1
            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
            c = 2 * asin(sqrt(a))
            r = 3956  # Earth's radius in miles
            return c * r
        
        # Calculate distance between pickup and dropoff
        rides_df['distance_miles'] = rides_df.apply(
            lambda row: haversine_distance(
                row['pickup_latitude'], row['pickup_longitude'],
                row['dropoff_latitude'], row['dropoff_longitude']
            ), axis=1
        )
        
        # Calculate fare efficiency (fare per mile)
        rides_df['fare_per_mile'] = rides_df['final_fare'] / rides_df['distance_miles'].replace(0, np.nan)
        
        # Add zone classification for pickup/dropoff
        rides_df['pickup_zone'] = rides_df.apply(
            lambda row: self._classify_location_to_zone(row['pickup_latitude'], row['pickup_longitude']), 
            axis=1
        )
        rides_df['dropoff_zone'] = rides_df.apply(
            lambda row: self._classify_location_to_zone(row['dropoff_latitude'], row['dropoff_longitude']), 
            axis=1
        )
        
        return rides_df
    
    def _get_zone_demand_features(self, hours_back: int) -> pd.DataFrame:
        """Get ride demand patterns by zone and time"""
        with self.db_connection as db:
            zone_data = db.get_zone_ride_counts(hours_back)
        
        if zone_data.empty:
            logger.warning("⚠️ No zone demand data found")
            return pd.DataFrame()
        
        # Calculate demand metrics
        zone_data['demand_density'] = zone_data['ride_count'] / zone_data.groupby(['lat_zone', 'lng_zone'])['ride_count'].transform('sum')
        zone_data['avg_fare_per_zone'] = zone_data.groupby(['lat_zone', 'lng_zone'])['avg_fare'].transform('mean')
        
        return zone_data
    
    def _get_driver_positioning_features(self) -> pd.DataFrame:
        """Get current driver locations and distribution"""
        with self.db_connection as db:
            driver_data = db.get_driver_locations()
        
        if driver_data.empty:
            logger.warning("⚠️ No driver positioning data found")
            return pd.DataFrame()
        
        # Calculate driver distribution metrics
        driver_data['driver_zone'] = driver_data.apply(
            lambda row: self._classify_location_to_zone(row['current_latitude'], row['current_longitude']), 
            axis=1
        )
        
        # Count drivers per zone
        zone_driver_counts = driver_data.groupby('driver_zone').size().reset_index().rename(columns={0: 'driver_count'})
        zone_driver_counts['driver_density'] = zone_driver_counts['driver_count'] / zone_driver_counts['driver_count'].sum()
        
        return zone_driver_counts
    
    def _get_live_condition_features(self) -> pd.DataFrame:
        """Get current weather and traffic conditions for all zones"""
        live_data = []
        
        for zone_name, zone_info in self.zones.items():
            # Get weather data
            weather_data = self.api_extractor.get_weather_data(zone_info['lat'], zone_info['lng'])
            
            # Get traffic data
            traffic_data = self.api_extractor.get_traffic_data(zone_name)
            
            if weather_data and traffic_data:
                combined_conditions = {
                    'zone': zone_name,
                    'zone_lat': zone_info['lat'],
                    'zone_lng': zone_info['lng'],
                    'timestamp': datetime.now().isoformat(),
                    **weather_data,
                    **traffic_data
                }
                live_data.append(combined_conditions)
        
        return pd.DataFrame(live_data)
    
    def _classify_location_to_zone(self, lat: float, lng: float, threshold_miles: float = 0.5) -> str:
        """
        Classify a lat/lng coordinate to the nearest predefined zone
        
        Args:
            lat: Latitude
            lng: Longitude  
            threshold_miles: Maximum distance to consider a match
            
        Returns:
            Zone name or 'other' if no close zone found
        """
        min_distance = float('inf')
        closest_zone = 'other'
        
        for zone_name, zone_info in self.zones.items():
            # Calculate approximate distance (simplified Haversine)
            lat_diff = abs(lat - zone_info['lat'])
            lng_diff = abs(lng - zone_info['lng'])
            distance = np.sqrt(lat_diff**2 + lng_diff**2) * 69  # Rough miles conversion
            
            if distance < min_distance and distance <= threshold_miles:
                min_distance = distance
                closest_zone = zone_name
        
        return closest_zone
    
    def _combine_data_sources(self, 
                            historical_rides: pd.DataFrame,
                            zone_demand: pd.DataFrame,
                            driver_positions: pd.DataFrame,
                            live_conditions: pd.DataFrame) -> pd.DataFrame:
        """
        Intelligently combine all data sources into training dataset
        """
        # Create base dataset from historical rides
        if historical_rides.empty:
            logger.error("❌ No historical ride data to build dataset")
            return pd.DataFrame()
        
        base_dataset = historical_rides.copy()
        
        # Add demand features by joining on zone and time
        if not zone_demand.empty:
            # First, classify lat/lng zones to named zones for proper matching
            if 'lat_zone' in zone_demand.columns and 'lng_zone' in zone_demand.columns:
                zone_demand['pickup_zone'] = zone_demand.apply(
                    lambda row: self._classify_location_to_zone(row['lat_zone'], row['lng_zone']), 
                    axis=1
                )
            
            # Create consistent zone-hour keys for joining
            base_dataset['zone_hour_key'] = (
                base_dataset['pickup_zone'] + '_' + 
                base_dataset['ride_hour'].astype(str)
            )
            
            zone_demand['zone_hour_key'] = (
                zone_demand['pickup_zone'] + '_' + 
                zone_demand['hour'].astype(str)
            )
            
            # Join demand data (simplified - in practice would need more sophisticated matching)
            demand_summary = zone_demand.groupby('zone_hour_key').agg({
                'ride_count': 'sum',
                'avg_fare': 'mean',
                'demand_density': 'mean'
            }).reset_index()
            
            base_dataset = base_dataset.merge(demand_summary, on='zone_hour_key', how='left', suffixes=('', '_demand'))
        
        # Add driver positioning features
        if not driver_positions.empty:
            driver_positions_renamed = driver_positions.copy()
            if 'driver_zone' in driver_positions_renamed.columns:
                driver_positions_renamed = driver_positions_renamed.rename(columns={'driver_zone': 'pickup_zone'})
                base_dataset = base_dataset.merge(driver_positions_renamed, on='pickup_zone', how='left')
        
        # Add live condition features (weather and traffic)
        if not live_conditions.empty:
            conditions_columns = ['zone', 'temperature', 'precipitation', 'traffic_severity', 'congestion_level', 'weather_severity', 'traffic_multiplier', 'weather_temp', 'weather_humidity', 'weather_condition', 'traffic_delay_minutes']
            available_columns = [col for col in conditions_columns if col in live_conditions.columns]
            conditions_simplified = live_conditions[available_columns].copy()
            if 'zone' in conditions_simplified.columns:
                conditions_simplified.rename(columns={
                    'zone': 'pickup_zone',
                    'temperature': 'weather_temp',
                    'precipitation': 'weather_humidity'
                }, inplace=True)
            base_dataset = base_dataset.merge(conditions_simplified, on='pickup_zone', how='left')
        
        # Fill missing values with reasonable defaults
        numeric_cols = base_dataset.select_dtypes(include=[np.number]).columns
        for col in numeric_cols:
            base_dataset[col] = base_dataset[col].fillna(0)
        
        categorical_cols = base_dataset.select_dtypes(include=['object']).columns
        for col in categorical_cols:
            base_dataset[col] = base_dataset[col].fillna('unknown')
        
        return base_dataset
    
    def save_training_dataset(self, dataset: pd.DataFrame, filename: str = None) -> str:
        """Save training dataset to file for model training"""
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"ml_training_dataset_{timestamp}.csv"
        
        # Create models directory if it doesn't exist
        models_dir = Path(__file__).parent.parent / "models"
        models_dir.mkdir(exist_ok=True)
        
        filepath = str(models_dir / filename)
        dataset.to_csv(filepath, index=False)
        
        logger.info(f"💾 Training dataset saved to: {filepath}")
        logger.info(f"📊 Dataset shape: {dataset.shape}")
        logger.info(f"🔧 Features: {list(dataset.columns)}")
        
        return filepath
    
    def generate_feature_summary(self, dataset: pd.DataFrame) -> Dict[str, Any]:
        """Generate comprehensive summary of dataset features for ML model development"""
        summary = {
            'dataset_info': {
                'rows': len(dataset),
                'columns': len(dataset.columns),
                'features': list(dataset.columns),
                'memory_usage_mb': dataset.memory_usage(deep=True).sum() / (1024 * 1024),
                'generated_at': datetime.now().isoformat()
            },
            'numeric_features': {},
            'categorical_features': {},
            'target_analysis': {},
            'data_quality': {}
        }
        
        # Analyze numeric features
        numeric_cols = dataset.select_dtypes(include=[np.number]).columns
        for col in numeric_cols:
            if col in dataset.columns:
                summary['numeric_features'][col] = {
                    'mean': float(dataset[col].mean()),
                    'std': float(dataset[col].std()),
                    'min': float(dataset[col].min()),
                    'max': float(dataset[col].max()),
                    'nulls': int(dataset[col].isnull().sum()),
                    'zeros': int((dataset[col] == 0).sum())
                }
        
        # Analyze categorical features
        categorical_cols = dataset.select_dtypes(include=['object']).columns
        for col in categorical_cols:
            if col in dataset.columns:
                value_counts = dataset[col].value_counts().head(10)
                summary['categorical_features'][col] = {
                    'unique_values': int(dataset[col].nunique()),
                    'most_common': value_counts.to_dict(),
                    'nulls': int(dataset[col].isnull().sum())
                }
        
        # Analyze potential target variables for different ML tasks
        if 'final_fare' in dataset.columns:
            summary['target_analysis']['fare_prediction'] = {
                'target': 'final_fare',
                'mean_fare': float(dataset['final_fare'].mean()),
                'fare_range': f"${dataset['final_fare'].min():.2f} - ${dataset['final_fare'].max():.2f}",
                'high_fare_threshold': float(dataset['final_fare'].quantile(0.8))
            }
        
        if 'surge_multiplier' in dataset.columns:
            summary['target_analysis']['surge_prediction'] = {
                'target': 'surge_multiplier',
                'avg_surge': float(dataset['surge_multiplier'].mean()),
                'max_surge': float(dataset['surge_multiplier'].max()),
                'surge_events': int((dataset['surge_multiplier'] > 1.0).sum())
            }
        
        # Data quality assessment
        total_cells = len(dataset) * len(dataset.columns)
        null_cells = dataset.isnull().sum().sum()
        summary['data_quality'] = {
            'completeness_percent': float(((total_cells - null_cells) / total_cells) * 100),
            'total_nulls': int(null_cells),
            'rows_with_nulls': int(dataset.isnull().any(axis=1).sum()),
            'duplicate_rows': int(dataset.duplicated().sum())
        }
        
        return summary

# Convenience function for easy access
def create_ml_training_dataset(days_back: int = 30, 
                              include_live_data: bool = True,
                              save_to_file: bool = True) -> Tuple[pd.DataFrame, Optional[str]]:
    """
    Convenience function to create complete ML training dataset
    
    Returns:
        Tuple of (dataset, filepath) where filepath is None if save_to_file is False
    """
    processor = MLDataProcessor()
    dataset = processor.create_comprehensive_training_dataset(days_back, include_live_data)
    
    filepath = None
    if save_to_file and not dataset.empty:
        filepath = processor.save_training_dataset(dataset)
    
    return dataset, filepath