"""
Database Connection Utility for ML Pipeline
Secure connection to PostgreSQL database using environment variables
"""

import os
import psycopg2
import pandas as pd
from typing import List, Dict, Any, Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MLDatabaseConnection:
    """
    Secure database connection for ML data pipeline
    Connects to the same PostgreSQL database used by the main application
    """
    
    def __init__(self):
        self.connection_string = os.environ.get('DATABASE_URL')
        if not self.connection_string:
            raise ValueError("DATABASE_URL environment variable not found")
        
        self.connection = None
        logger.info("🔌 ML Database Connection initialized")
    
    def connect(self):
        """Establish database connection"""
        try:
            self.connection = psycopg2.connect(self.connection_string)
            self.connection.autocommit = False
            logger.info("✅ ML Database connected successfully")
            return True
        except Exception as e:
            logger.error(f"❌ Database connection failed: {e}")
            return False
    
    def disconnect(self):
        """Close database connection"""
        if self.connection:
            self.connection.close()
            logger.info("🔌 ML Database disconnected")
    
    def execute_query(self, query: str, params: Optional[tuple] = None) -> List[Dict[str, Any]]:
        """Execute SELECT query and return results as list of dictionaries"""
        if not self.connection:
            if not self.connect():
                return []
        
        try:
            if not self.connection:
                logger.error("❌ No database connection available")
                return []
                
            cursor = self.connection.cursor()
            cursor.execute(query, params or ())
            
            # Get column names
            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            
            # Fetch results
            rows = cursor.fetchall()
            cursor.close()
            
            # Convert to list of dictionaries
            results = [dict(zip(columns, row)) for row in rows]
            
            logger.info(f"✅ Query executed successfully - {len(results)} rows returned")
            return results
            
        except Exception as e:
            logger.error(f"❌ Query execution failed: {e}")
            return []
    
    def execute_query_dataframe(self, query: str, params: Optional[tuple] = None) -> pd.DataFrame:
        """Execute query and return results as pandas DataFrame"""
        if not self.connection:
            if not self.connect():
                return pd.DataFrame()
        
        try:
            df = pd.read_sql_query(query, self.connection, params=list(params) if params else None)
            logger.info(f"✅ Query executed successfully - DataFrame shape: {df.shape}")
            return df
        except Exception as e:
            logger.error(f"❌ DataFrame query failed: {e}")
            return pd.DataFrame()
    
    def get_historical_rides(self, days_back: int = 30) -> pd.DataFrame:
        """
        Extract historical ride data for ML training
        Returns rides from the last N days with relevant features
        """
        query = """
        SELECT 
            r.id,
            r.created_at,
            r.pickup_lat as pickup_latitude,
            r.pickup_lng as pickup_longitude,
            r.destination_lat as dropoff_latitude,
            r.destination_lng as dropoff_longitude,
            r.final_fare,
            r.status,
            r.ride_type as vehicle_type,
            EXTRACT(hour FROM r.created_at) as hour_of_day,
            EXTRACT(dow FROM r.created_at) as day_of_week,
            EXTRACT(month FROM r.created_at) as month
        FROM rides r
        WHERE r.created_at >= NOW() - CAST(%s AS interval)
        AND r.status IN ('completed', 'cancelled')
        ORDER BY r.created_at DESC
        """
        
        return self.execute_query_dataframe(query, (f'{days_back} days',))
    
    def get_zone_ride_counts(self, hours_back: int = 24) -> pd.DataFrame:
        """
        Get ride counts by geographic zones for demand analysis
        """
        query = """
        SELECT 
            ROUND(pickup_lat::numeric, 3) as lat_zone,
            ROUND(pickup_lng::numeric, 3) as lng_zone,
            COUNT(*) as ride_count,
            AVG(final_fare) as avg_fare,
            EXTRACT(hour FROM created_at) as hour
        FROM rides
        WHERE created_at >= NOW() - CAST(%s AS interval)
        AND status = 'completed'
        GROUP BY lat_zone, lng_zone, hour
        ORDER BY ride_count DESC
        """
        
        return self.execute_query_dataframe(query, (f'{hours_back} hours',))
    
    def get_driver_locations(self) -> pd.DataFrame:
        """
        Get current driver locations and availability status
        """
        query = """
        SELECT 
            u.id as driver_id,
            u.lat as current_latitude,
            u.lng as current_longitude,
            'online' as status,
            'standard' as vehicle_type
        FROM users u
        WHERE u.user_type = 'driver'
        AND u.lat IS NOT NULL 
        AND u.lng IS NOT NULL
        """
        
        return self.execute_query_dataframe(query)
    
    def __enter__(self):
        """Context manager entry"""
        if self.connect():
            return self
        else:
            raise Exception("Failed to establish database connection")
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.disconnect()
        # Return False to propagate any exceptions
        return False

# Convenience function for quick database access
def get_ml_data_connection() -> MLDatabaseConnection:
    """Get a new ML database connection instance"""
    return MLDatabaseConnection()