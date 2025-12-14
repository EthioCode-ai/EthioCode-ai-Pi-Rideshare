#!/usr/bin/env python3
"""
ML Analytics Dashboard for Pi Rideshare Platform

This module implements a comprehensive ML analytics dashboard that:
- Monitors model performance across all ML components
- Tracks prediction accuracy and confidence scores
- Displays real-time ML system health and metrics
- Provides performance trends and anomaly detection
- Generates automated insights and recommendations
- Manages model training schedules and data quality
- Tracks business impact of ML predictions
- Enables A/B testing of different ML models

Authors: Pi Rideshare ML Team
Version: 1.0.0
Date: September 2025
"""

import logging
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional, Any, Union
from dataclasses import dataclass, field
from pathlib import Path
import json
import time
from collections import defaultdict, deque
from enum import Enum

# Initialize logging first to prevent import-time logger bugs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Analytics and visualization imports
try:
    import matplotlib.pyplot as plt
    import seaborn as sns
    VISUALIZATION_AVAILABLE = True
except ImportError:
    VISUALIZATION_AVAILABLE = False
    logger.warning("⚠️ Visualization libraries not available (matplotlib/seaborn)")

# ML imports
import sys
sys_path = Path(__file__).parent.parent
if str(sys_path) not in sys.path:
    sys.path.append(str(sys_path))

from utils.database_connection import MLDatabaseConnection
from utils.api_data_extractor import MLAPIDataExtractor
from data_pipeline.ml_data_processor import MLDataProcessor

# Import ML components for monitoring
try:
    from algorithms.demand_prediction import DemandPredictionModel
    from algorithms.surge_pricing import DynamicSurgePricingModel  
    from algorithms.driver_positioning import DriverPositioningEngine
    from algorithms.route_optimization import RouteOptimizationEngine
    ML_COMPONENTS_AVAILABLE = True
except ImportError as e:
    ML_COMPONENTS_AVAILABLE = False
    logger.warning(f"⚠️ ML components not fully available: {e}")

class MetricType(Enum):
    """Types of metrics tracked by the dashboard"""
    ACCURACY = "accuracy"
    CONFIDENCE = "confidence"
    RESPONSE_TIME = "response_time"
    ERROR_RATE = "error_rate"
    PREDICTION_COUNT = "prediction_count"
    BUSINESS_IMPACT = "business_impact"
    DATA_QUALITY = "data_quality"
    MODEL_DRIFT = "model_drift"

class ModelStatus(Enum):
    """Status of ML models"""
    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"
    OFFLINE = "offline"
    TRAINING = "training"
    UPDATING = "updating"

@dataclass
class ModelMetric:
    """A single model performance metric"""
    model_name: str
    metric_type: MetricType
    value: float
    timestamp: datetime
    metadata: Dict[str, Any] = field(default_factory=dict)
    threshold_status: str = "normal"  # normal, warning, critical

@dataclass
class ModelPerformanceReport:
    """Comprehensive model performance report"""
    model_name: str
    status: ModelStatus
    accuracy_score: float
    confidence_average: float
    prediction_count: int
    error_rate: float
    avg_response_time_ms: float
    business_impact_score: float
    data_quality_score: float
    last_updated: datetime
    alerts: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)

@dataclass
class SystemHealthSummary:
    """Overall ML system health summary"""
    overall_status: ModelStatus
    total_predictions_today: int
    average_accuracy: float
    active_models: int
    critical_alerts: int
    system_uptime_hours: float
    data_pipeline_status: str
    timestamp: datetime

class MLAnalyticsDashboard:
    """
    Machine Learning Analytics Dashboard
    
    Features:
    - Real-time model performance monitoring
    - Automated anomaly detection and alerting
    - Model comparison and A/B testing support
    - Business impact tracking and ROI analysis
    - Data quality monitoring and drift detection
    - Performance trend analysis and forecasting
    - Automated insights and recommendations
    - Model training schedule management
    """
    
    def __init__(self, retention_days: int = 30):
        """Initialize ML Analytics Dashboard"""
        self.retention_days = retention_days
        self.metrics_buffer = defaultdict(lambda: deque(maxlen=1000))  # In-memory metrics buffer
        self.model_instances = {}
        self.performance_thresholds = {
            'accuracy_min': 0.7,
            'confidence_min': 0.6,
            'error_rate_max': 0.1,
            'response_time_max_ms': 1000,
            'data_quality_min': 0.8
        }
        
        # Initialize ML components
        self.db_connection = MLDatabaseConnection()
        self.api_extractor = MLAPIDataExtractor()
        self.data_processor = MLDataProcessor()
        
        # Load ML model instances if available
        self._initialize_model_instances()
        
        # Performance tracking
        self.start_time = datetime.now()
        self.system_alerts = deque(maxlen=100)
        
        logger.info("📊 ML Analytics Dashboard initialized")
    
    def get_system_health_summary(self) -> SystemHealthSummary:
        """
        Get comprehensive system health summary
        
        Returns:
            SystemHealthSummary with overall ML system status
        """
        logger.info("👩‍⚕️ Generating system health summary...")
        
        try:
            # Get model reports for all components
            model_reports = []
            for model_name in ['demand_prediction', 'surge_pricing', 'driver_positioning', 'route_optimization']:
                try:
                    report = self.get_model_performance_report(model_name)
                    model_reports.append(report)
                except Exception as e:
                    logger.warning(f"⚠️ Failed to get report for {model_name}: {e}")
            
            # Calculate overall metrics
            if model_reports:
                average_accuracy = sum(r.accuracy_score for r in model_reports) / len(model_reports)
                active_models = len([r for r in model_reports if r.status in [ModelStatus.HEALTHY, ModelStatus.WARNING]])
                critical_alerts = len([r for r in model_reports if r.status == ModelStatus.CRITICAL])
                total_predictions = sum(r.prediction_count for r in model_reports)
            else:
                average_accuracy = 0.0
                active_models = 0
                critical_alerts = 0
                total_predictions = 0
            
            # Determine overall status based on model instances and metrics
            if critical_alerts > 0:
                overall_status = ModelStatus.CRITICAL
            elif any(r.status == ModelStatus.WARNING for r in model_reports):
                overall_status = ModelStatus.WARNING
            elif active_models > 0 or (len(self.model_instances) > 0 and ML_COMPONENTS_AVAILABLE):
                # System is healthy if we have active models OR initialized model instances
                overall_status = ModelStatus.HEALTHY
            else:
                overall_status = ModelStatus.OFFLINE
            
            # Calculate uptime
            uptime_hours = (datetime.now() - self.start_time).total_seconds() / 3600
            
            # Check data pipeline status
            data_pipeline_status = self._check_data_pipeline_health()
            
            return SystemHealthSummary(
                overall_status=overall_status,
                total_predictions_today=total_predictions,
                average_accuracy=average_accuracy,
                active_models=active_models,
                critical_alerts=critical_alerts,
                system_uptime_hours=uptime_hours,
                data_pipeline_status=data_pipeline_status,
                timestamp=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"❌ System health summary failed: {e}")
            return SystemHealthSummary(
                overall_status=ModelStatus.OFFLINE,
                total_predictions_today=0,
                average_accuracy=0.0,
                active_models=0,
                critical_alerts=1,
                system_uptime_hours=0.0,
                data_pipeline_status="error",
                timestamp=datetime.now()
            )
    
    def get_model_performance_report(self, model_name: str) -> ModelPerformanceReport:
        """
        Get comprehensive performance report for a specific model
        
        Args:
            model_name: Name of the model to analyze
            
        Returns:
            ModelPerformanceReport with detailed metrics
        """
        logger.info(f"📊 Generating performance report for {model_name}...")
        
        try:
            # Get recent metrics for this model
            recent_metrics = self._get_recent_metrics(model_name, hours=24)
            
            if not recent_metrics:
                return self._create_empty_report(model_name)
            
            # Calculate performance metrics
            accuracy_metrics = [m for m in recent_metrics if m.metric_type == MetricType.ACCURACY]
            confidence_metrics = [m for m in recent_metrics if m.metric_type == MetricType.CONFIDENCE]
            response_time_metrics = [m for m in recent_metrics if m.metric_type == MetricType.RESPONSE_TIME]
            error_metrics = [m for m in recent_metrics if m.metric_type == MetricType.ERROR_RATE]
            prediction_count_metrics = [m for m in recent_metrics if m.metric_type == MetricType.PREDICTION_COUNT]
            
            # Calculate averages
            accuracy_score = np.mean([m.value for m in accuracy_metrics]) if accuracy_metrics else 0.0
            confidence_average = np.mean([m.value for m in confidence_metrics]) if confidence_metrics else 0.0
            avg_response_time = np.mean([m.value for m in response_time_metrics]) if response_time_metrics else 0.0
            error_rate = np.mean([m.value for m in error_metrics]) if error_metrics else 0.0
            prediction_count = sum([m.value for m in prediction_count_metrics])
            
            # Simulate business impact and data quality scores
            business_impact_score = self._calculate_business_impact(model_name, recent_metrics)
            data_quality_score = self._calculate_data_quality_score(model_name)
            
            # Determine model status
            status = self._determine_model_status(accuracy_score, confidence_average, error_rate, avg_response_time)
            
            # Generate alerts and recommendations
            alerts = self._generate_alerts(model_name, accuracy_score, confidence_average, error_rate, avg_response_time)
            recommendations = self._generate_recommendations(model_name, status, recent_metrics)
            
            return ModelPerformanceReport(
                model_name=model_name,
                status=status,
                accuracy_score=accuracy_score,
                confidence_average=confidence_average,
                prediction_count=int(prediction_count),
                error_rate=error_rate,
                avg_response_time_ms=avg_response_time,
                business_impact_score=business_impact_score,
                data_quality_score=data_quality_score,
                last_updated=datetime.now(),
                alerts=alerts,
                recommendations=recommendations
            )
            
        except Exception as e:
            logger.error(f"❌ Performance report failed for {model_name}: {e}")
            return self._create_error_report(model_name, str(e))
    
    def track_prediction(self, model_name: str, prediction_data: Dict[str, Any]) -> None:
        """
        Track a model prediction for analytics
        
        Args:
            model_name: Name of the model making prediction
            prediction_data: Dictionary containing prediction details
        """
        try:
            timestamp = datetime.now()
            
            # Extract metrics from prediction data
            confidence = prediction_data.get('confidence', 0.0)
            response_time = prediction_data.get('response_time_ms', 0.0)
            
            # Record metrics
            self._record_metric(model_name, MetricType.CONFIDENCE, confidence, timestamp)
            self._record_metric(model_name, MetricType.RESPONSE_TIME, response_time, timestamp)
            self._record_metric(model_name, MetricType.PREDICTION_COUNT, 1, timestamp)
            
            # Check for anomalies
            self._check_prediction_anomalies(model_name, prediction_data)
            
        except Exception as e:
            logger.warning(f"⚠️ Failed to track prediction for {model_name}: {e}")
    
    def track_model_accuracy(self, model_name: str, actual_outcome: Any, predicted_outcome: Any, metadata: Dict[str, Any] = None) -> None:
        """
        Track model accuracy by comparing predictions with actual outcomes
        
        Args:
            model_name: Name of the model
            actual_outcome: The actual result
            predicted_outcome: The predicted result
            metadata: Additional context data
        """
        try:
            timestamp = datetime.now()
            
            # Calculate accuracy based on outcome type
            if isinstance(actual_outcome, (int, float)) and isinstance(predicted_outcome, (int, float)):
                # Numerical accuracy (using relative error)
                if actual_outcome != 0:
                    relative_error = abs(actual_outcome - predicted_outcome) / abs(actual_outcome)
                    accuracy = max(0.0, 1.0 - relative_error)
                else:
                    accuracy = 1.0 if predicted_outcome == 0 else 0.0
            else:
                # Categorical accuracy
                accuracy = 1.0 if actual_outcome == predicted_outcome else 0.0
            
            # Record accuracy metric
            self._record_metric(model_name, MetricType.ACCURACY, accuracy, timestamp, metadata or {})
            
            # Update error rate
            error_rate = 1.0 - accuracy
            self._record_metric(model_name, MetricType.ERROR_RATE, error_rate, timestamp)
            
        except Exception as e:
            logger.warning(f"⚠️ Failed to track accuracy for {model_name}: {e}")
    
    def get_performance_trends(self, model_name: str, hours: int = 24) -> Dict[str, List[Tuple[datetime, float]]]:
        """
        Get performance trends for a model over time
        
        Args:
            model_name: Name of the model
            hours: Number of hours to look back
            
        Returns:
            Dictionary mapping metric types to time series data
        """
        logger.info(f"📈 Getting performance trends for {model_name} over {hours} hours...")
        
        try:
            recent_metrics = self._get_recent_metrics(model_name, hours)
            
            trends = defaultdict(list)
            
            for metric in recent_metrics:
                metric_key = metric.metric_type.value
                trends[metric_key].append((metric.timestamp, metric.value))
            
            # Sort by timestamp
            for metric_type in trends:
                trends[metric_type].sort(key=lambda x: x[0])
            
            return dict(trends)
            
        except Exception as e:
            logger.error(f"❌ Failed to get trends for {model_name}: {e}")
            return {}
    
    def generate_insights(self, model_name: str = None) -> List[str]:
        """
        Generate automated insights about model performance
        
        Args:
            model_name: Specific model to analyze (None for all models)
            
        Returns:
            List of insight strings
        """
        logger.info(f"💡 Generating insights for {model_name or 'all models'}...")
        
        insights = []
        
        try:
            if model_name:
                model_names = [model_name]
            else:
                model_names = ['demand_prediction', 'surge_pricing', 'driver_positioning', 'route_optimization']
            
            for name in model_names:
                try:
                    report = self.get_model_performance_report(name)
                    model_insights = self._generate_model_insights(name, report)
                    insights.extend(model_insights)
                except Exception as e:
                    logger.warning(f"⚠️ Failed to generate insights for {name}: {e}")
            
            # Add system-wide insights
            system_insights = self._generate_system_insights()
            insights.extend(system_insights)
            
            return insights
            
        except Exception as e:
            logger.error(f"❌ Insight generation failed: {e}")
            return ["Unable to generate insights due to system error"]
    
    def get_dashboard_data(self) -> Dict[str, Any]:
        """
        Get comprehensive dashboard data for display
        
        Returns:
            Dictionary containing all dashboard data
        """
        logger.info("📊 Generating comprehensive dashboard data...")
        
        try:
            # Get system health
            system_health = self.get_system_health_summary()
            
            # Get model reports
            model_reports = {}
            model_trends = {}
            
            for model_name in ['demand_prediction', 'surge_pricing', 'driver_positioning', 'route_optimization']:
                try:
                    model_reports[model_name] = self.get_model_performance_report(model_name)
                    model_trends[model_name] = self.get_performance_trends(model_name, hours=24)
                except Exception as e:
                    logger.warning(f"⚠️ Failed to get data for {model_name}: {e}")
            
            # Get insights
            insights = self.generate_insights()
            
            # Get recent alerts
            recent_alerts = list(self.system_alerts)[-10:]  # Last 10 alerts
            
            dashboard_data = {
                'system_health': system_health,
                'model_reports': model_reports,
                'performance_trends': model_trends,
                'insights': insights,
                'recent_alerts': recent_alerts,
                'generated_at': datetime.now().isoformat(),
                'dashboard_version': '1.0.0'
            }
            
            logger.info(f"✅ Dashboard data generated with {len(model_reports)} models")
            return dashboard_data
            
        except Exception as e:
            logger.error(f"❌ Dashboard data generation failed: {e}")
            return {
                'error': f'Dashboard generation failed: {e}',
                'generated_at': datetime.now().isoformat()
            }
    
    def _initialize_model_instances(self) -> None:
        """Initialize ML model instances for monitoring"""
        try:
            if ML_COMPONENTS_AVAILABLE:
                # Initialize model instances (these will be used for health checks)
                self.model_instances = {
                    'demand_prediction': DemandPredictionModel(),
                    'surge_pricing': DynamicSurgePricingModel(),
                    'driver_positioning': DriverPositioningEngine(),
                    'route_optimization': RouteOptimizationEngine()
                }
                logger.info(f"✅ Initialized {len(self.model_instances)} ML model instances")
            else:
                logger.warning("⚠️ ML components not available - using simulation mode")
                self.model_instances = {}
        except Exception as e:
            logger.warning(f"⚠️ Failed to initialize model instances: {e}")
            self.model_instances = {}
    
    def _record_metric(self, model_name: str, metric_type: MetricType, value: float, 
                      timestamp: datetime, metadata: Dict[str, Any] = None) -> None:
        """Record a metric in the buffer"""
        metric = ModelMetric(
            model_name=model_name,
            metric_type=metric_type,
            value=value,
            timestamp=timestamp,
            metadata=metadata or {}
        )
        
        # Add to buffer
        buffer_key = f"{model_name}_{metric_type.value}"
        self.metrics_buffer[buffer_key].append(metric)
    
    def _get_recent_metrics(self, model_name: str, hours: int = 24) -> List[ModelMetric]:
        """Get recent metrics for a model"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        metrics = []
        
        for buffer_key, buffer in self.metrics_buffer.items():
            if buffer_key.startswith(f"{model_name}_"):
                for metric in buffer:
                    if metric.timestamp >= cutoff_time:
                        metrics.append(metric)
        
        return sorted(metrics, key=lambda m: m.timestamp)
    
    def _determine_model_status(self, accuracy: float, confidence: float, 
                              error_rate: float, response_time: float) -> ModelStatus:
        """Determine model status based on metrics"""
        if accuracy < self.performance_thresholds['accuracy_min'] * 0.5:
            return ModelStatus.CRITICAL
        elif error_rate > self.performance_thresholds['error_rate_max'] * 2:
            return ModelStatus.CRITICAL
        elif response_time > self.performance_thresholds['response_time_max_ms'] * 3:
            return ModelStatus.CRITICAL
        elif accuracy < self.performance_thresholds['accuracy_min']:
            return ModelStatus.WARNING
        elif error_rate > self.performance_thresholds['error_rate_max']:
            return ModelStatus.WARNING
        elif response_time > self.performance_thresholds['response_time_max_ms']:
            return ModelStatus.WARNING
        else:
            return ModelStatus.HEALTHY
    
    def _generate_alerts(self, model_name: str, accuracy: float, confidence: float, 
                        error_rate: float, response_time: float) -> List[str]:
        """Generate alerts based on performance metrics"""
        alerts = []
        
        if accuracy < self.performance_thresholds['accuracy_min']:
            alerts.append(f"Low accuracy: {accuracy:.2f} (threshold: {self.performance_thresholds['accuracy_min']:.2f})")
        
        if confidence < self.performance_thresholds['confidence_min']:
            alerts.append(f"Low confidence: {confidence:.2f} (threshold: {self.performance_thresholds['confidence_min']:.2f})")
        
        if error_rate > self.performance_thresholds['error_rate_max']:
            alerts.append(f"High error rate: {error_rate:.2f} (threshold: {self.performance_thresholds['error_rate_max']:.2f})")
        
        if response_time > self.performance_thresholds['response_time_max_ms']:
            alerts.append(f"Slow response: {response_time:.1f}ms (threshold: {self.performance_thresholds['response_time_max_ms']:.0f}ms)")
        
        return alerts
    
    def _generate_recommendations(self, model_name: str, status: ModelStatus, 
                                metrics: List[ModelMetric]) -> List[str]:
        """Generate recommendations based on model performance"""
        recommendations = []
        
        if status == ModelStatus.CRITICAL:
            recommendations.append("Consider retraining the model with recent data")
            recommendations.append("Review model parameters and feature engineering")
            recommendations.append("Check data quality and preprocessing pipeline")
        elif status == ModelStatus.WARNING:
            recommendations.append("Monitor model closely for degradation")
            recommendations.append("Consider incremental model updates")
            recommendations.append("Review recent data patterns for drift")
        
        # Add model-specific recommendations
        if model_name == 'demand_prediction':
            recommendations.append("Consider adding more weather and event data features")
        elif model_name == 'surge_pricing':
            recommendations.append("Review surge multiplier thresholds and business rules")
        elif model_name == 'driver_positioning':
            recommendations.append("Verify GPS data quality and zone definitions")
        elif model_name == 'route_optimization':
            recommendations.append("Update traffic patterns and optimize route algorithms")
        
        return recommendations
    
    def _calculate_business_impact(self, model_name: str, metrics: List[ModelMetric]) -> float:
        """Calculate business impact score for a model"""
        try:
            # Simplified business impact calculation
            if not metrics:
                return 0.5  # Neutral impact
            
            # Weight by model importance
            model_weights = {
                'demand_prediction': 0.3,
                'surge_pricing': 0.4,
                'driver_positioning': 0.2,
                'route_optimization': 0.3
            }
            
            base_weight = model_weights.get(model_name, 0.25)
            
            # Consider accuracy and prediction volume
            accuracy_metrics = [m for m in metrics if m.metric_type == MetricType.ACCURACY]
            avg_accuracy = np.mean([m.value for m in accuracy_metrics]) if accuracy_metrics else 0.7
            
            prediction_count = len([m for m in metrics if m.metric_type == MetricType.PREDICTION_COUNT])
            volume_factor = min(1.0, prediction_count / 100)  # Normalize to 100 predictions
            
            # Business impact = base weight * accuracy * volume factor
            impact = base_weight * avg_accuracy * volume_factor
            
            return min(1.0, max(0.0, impact))
            
        except Exception as e:
            logger.warning(f"⚠️ Business impact calculation failed for {model_name}: {e}")
            return 0.5
    
    def _calculate_data_quality_score(self, model_name: str) -> float:
        """Calculate data quality score for a model"""
        try:
            # Simulate data quality assessment
            # In a real implementation, this would check:
            # - Missing data percentage
            # - Data freshness
            # - Feature distribution drift
            # - Outlier detection
            
            # For now, return a simulated score based on model type
            base_scores = {
                'demand_prediction': 0.85,
                'surge_pricing': 0.90,
                'driver_positioning': 0.80,
                'route_optimization': 0.88
            }
            
            return base_scores.get(model_name, 0.80)
            
        except Exception as e:
            logger.warning(f"⚠️ Data quality calculation failed for {model_name}: {e}")
            return 0.75
    
    def _check_data_pipeline_health(self) -> str:
        """Check health of data processing pipeline"""
        try:
            # Check database connection using proper MLDatabaseConnection methods
            with self.db_connection as db:
                # Use the proper execute_query method
                result = db.execute_query("SELECT 1")
                if result and len(result) > 0 and result[0].get('?column?') == 1:
                    return "healthy"
                else:
                    return "warning"
                    
        except Exception as e:
            logger.warning(f"⚠️ Data pipeline health check failed: {e}")
            return "error"
    
    def _check_prediction_anomalies(self, model_name: str, prediction_data: Dict[str, Any]) -> None:
        """Check for anomalies in prediction data"""
        try:
            # Simple anomaly detection
            confidence = prediction_data.get('confidence', 0.0)
            response_time = prediction_data.get('response_time_ms', 0.0)
            
            # Check for unusually low confidence
            if confidence < 0.3:
                alert = f"Anomaly detected in {model_name}: Very low confidence ({confidence:.2f})"
                self.system_alerts.append(alert)
                logger.warning(f"⚠️ {alert}")
            
            # Check for slow response times
            if response_time > 5000:  # 5 seconds
                alert = f"Anomaly detected in {model_name}: Very slow response ({response_time:.0f}ms)"
                self.system_alerts.append(alert)
                logger.warning(f"⚠️ {alert}")
                
        except Exception as e:
            logger.warning(f"⚠️ Anomaly detection failed for {model_name}: {e}")
    
    def _generate_model_insights(self, model_name: str, report: ModelPerformanceReport) -> List[str]:
        """Generate insights for a specific model"""
        insights = []
        
        try:
            # Performance insights
            if report.accuracy_score > 0.9:
                insights.append(f"{model_name} is performing excellently with {report.accuracy_score:.1%} accuracy")
            elif report.accuracy_score < 0.7:
                insights.append(f"{model_name} accuracy is below target at {report.accuracy_score:.1%} - consider retraining")
            
            # Volume insights
            if report.prediction_count > 100:
                insights.append(f"{model_name} processed {report.prediction_count} predictions today - high usage")
            elif report.prediction_count < 10:
                insights.append(f"{model_name} has low usage with only {report.prediction_count} predictions today")
            
            # Response time insights
            if report.avg_response_time_ms < 100:
                insights.append(f"{model_name} responds quickly at {report.avg_response_time_ms:.0f}ms average")
            elif report.avg_response_time_ms > 1000:
                insights.append(f"{model_name} response time is slow at {report.avg_response_time_ms:.0f}ms - optimization needed")
            
            # Business impact insights
            if report.business_impact_score > 0.8:
                insights.append(f"{model_name} has high business impact ({report.business_impact_score:.1%})")
            
        except Exception as e:
            logger.warning(f"⚠️ Failed to generate insights for {model_name}: {e}")
        
        return insights
    
    def _generate_system_insights(self) -> List[str]:
        """Generate system-wide insights"""
        insights = []
        
        try:
            system_health = self.get_system_health_summary()
            
            # System health insights
            if system_health.overall_status == ModelStatus.HEALTHY:
                insights.append(f"All ML systems operational with {system_health.active_models} active models")
            elif system_health.overall_status == ModelStatus.WARNING:
                insights.append(f"Some ML systems need attention - {system_health.critical_alerts} critical issues")
            elif system_health.overall_status == ModelStatus.CRITICAL:
                insights.append(f"Critical ML system issues detected - immediate attention required")
            
            # Performance insights
            if system_health.average_accuracy > 0.85:
                insights.append(f"Overall ML accuracy is excellent at {system_health.average_accuracy:.1%}")
            elif system_health.average_accuracy < 0.70:
                insights.append(f"Overall ML accuracy needs improvement at {system_health.average_accuracy:.1%}")
            
            # Volume insights
            if system_health.total_predictions_today > 500:
                insights.append(f"High ML system usage with {system_health.total_predictions_today} predictions today")
            
            # Uptime insights
            if system_health.system_uptime_hours > 24:
                insights.append(f"ML system stable with {system_health.system_uptime_hours:.1f} hours uptime")
            
        except Exception as e:
            logger.warning(f"⚠️ Failed to generate system insights: {e}")
        
        return insights
    
    def _create_empty_report(self, model_name: str) -> ModelPerformanceReport:
        """Create empty report when no metrics available"""
        # Check if model instance is available but just hasn't generated metrics yet
        if model_name in self.model_instances and ML_COMPONENTS_AVAILABLE:
            status = ModelStatus.HEALTHY  # Model is initialized and ready
            alerts = ["Model initialized but no recent metrics available"]
            recommendations = ["Start making predictions to generate performance metrics"]
        else:
            status = ModelStatus.OFFLINE  # Model not available
            alerts = ["Model not available or not initialized"]
            recommendations = ["Check model initialization and component availability"]
            
        return ModelPerformanceReport(
            model_name=model_name,
            status=status,
            accuracy_score=0.0,
            confidence_average=0.0,
            prediction_count=0,
            error_rate=0.0,
            avg_response_time_ms=0.0,
            business_impact_score=0.0,
            data_quality_score=0.0,
            last_updated=datetime.now(),
            alerts=alerts,
            recommendations=recommendations
        )
    
    def _create_error_report(self, model_name: str, error_message: str) -> ModelPerformanceReport:
        """Create error report when analysis fails"""
        return ModelPerformanceReport(
            model_name=model_name,
            status=ModelStatus.CRITICAL,
            accuracy_score=0.0,
            confidence_average=0.0,
            prediction_count=0,
            error_rate=1.0,
            avg_response_time_ms=0.0,
            business_impact_score=0.0,
            data_quality_score=0.0,
            last_updated=datetime.now(),
            alerts=[f"Analysis failed: {error_message}"],
            recommendations=["Check system logs and troubleshoot the issue"]
        )
    
    def export_dashboard_data(self, filepath: Optional[str] = None) -> str:
        """Export dashboard data to JSON file"""
        logger.info("💾 Exporting dashboard data...")
        
        if not filepath:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filepath = f"ml/analytics/dashboard_export_{timestamp}.json"
        
        try:
            # Ensure directory exists
            Path(filepath).parent.mkdir(parents=True, exist_ok=True)
            
            # Get dashboard data
            dashboard_data = self.get_dashboard_data()
            
            # Convert datetime objects to strings for JSON serialization
            def serialize_datetime(obj):
                if isinstance(obj, datetime):
                    return obj.isoformat()
                elif hasattr(obj, '__dict__'):
                    return {k: serialize_datetime(v) for k, v in obj.__dict__.items()}
                elif isinstance(obj, list):
                    return [serialize_datetime(item) for item in obj]
                elif isinstance(obj, dict):
                    return {k: serialize_datetime(v) for k, v in obj.items()}
                else:
                    return obj
            
            serializable_data = serialize_datetime(dashboard_data)
            
            # Write to file
            with open(filepath, 'w') as f:
                json.dump(serializable_data, f, indent=2, default=str)
            
            logger.info(f"✅ Dashboard data exported to {filepath}")
            return filepath
            
        except Exception as e:
            logger.error(f"❌ Dashboard export failed: {e}")
            return ""

# Example usage and testing
if __name__ == "__main__":
    # Initialize dashboard
    dashboard = MLAnalyticsDashboard()
    
    print("📊 Testing ML Analytics Dashboard...")
    
    # Test system health
    health = dashboard.get_system_health_summary()
    print(f"✅ System health: {health.overall_status.value} with {health.active_models} active models")
    
    # Test model performance reports
    for model_name in ['demand_prediction', 'surge_pricing', 'driver_positioning', 'route_optimization']:
        try:
            report = dashboard.get_model_performance_report(model_name)
            print(f"✅ {model_name}: {report.status.value} status, {report.accuracy_score:.2f} accuracy")
        except Exception as e:
            print(f"⚠️ {model_name}: {e}")
    
    # Test insights generation
    insights = dashboard.generate_insights()
    print(f"✅ Generated {len(insights)} insights")
    for insight in insights[:3]:  # Show first 3
        print(f"   • {insight}")
    
    # Test dashboard data export
    export_path = dashboard.export_dashboard_data()
    if export_path:
        print(f"✅ Dashboard data exported to {export_path}")
    
    print("🎯 ML Analytics Dashboard test completed!")
