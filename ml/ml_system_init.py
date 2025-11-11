"""
ML System Initialization Script
Main entry point for Phase 2 Machine Learning infrastructure
Tests all components and creates initial training dataset
"""

import sys
import os
import json
import logging
from datetime import datetime
from pathlib import Path

# Import ML components using package-relative imports
from ml.data_pipeline.ml_data_processor import MLDataProcessor, create_ml_training_dataset
from ml.utils.database_connection import get_ml_data_connection
from ml.utils.api_data_extractor import get_ml_api_extractor

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_ml_infrastructure():
    """
    Comprehensive test of all ML infrastructure components
    Returns success status and detailed test results
    """
    logger.info("🧪 Starting ML Infrastructure Test Suite")
    test_results = {
        'timestamp': datetime.now().isoformat(),
        'tests': {},
        'overall_success': False
    }
    
    # Test 1: Database Connection
    logger.info("📊 Testing database connection...")
    try:
        db_connection = get_ml_data_connection()
        with db_connection as db:
            # Simple connectivity test
            test_query = "SELECT COUNT(*) as count FROM rides LIMIT 1"
            result = db.execute_query(test_query)
            if result:
                test_results['tests']['database'] = {'status': 'PASS', 'message': 'Database connection successful'}
                logger.info("✅ Database connection test passed")
            else:
                test_results['tests']['database'] = {'status': 'FAIL', 'message': 'Database query failed'}
                logger.error("❌ Database connection test failed")
    except Exception as e:
        test_results['tests']['database'] = {'status': 'FAIL', 'message': f'Database error: {str(e)}'}
        logger.error(f"❌ Database connection failed: {e}")
    
    # Test 2: API Data Extractor
    logger.info("📡 Testing API data extractor...")
    try:
        api_extractor = get_ml_api_extractor()
        health_check = api_extractor.health_check()
        if health_check:
            test_results['tests']['api_extractor'] = {'status': 'PASS', 'message': 'Phase 1 APIs accessible'}
            logger.info("✅ API extractor test passed")
        else:
            test_results['tests']['api_extractor'] = {'status': 'FAIL', 'message': 'Phase 1 APIs not accessible'}
            logger.error("❌ API extractor test failed")
    except Exception as e:
        test_results['tests']['api_extractor'] = {'status': 'FAIL', 'message': f'API error: {str(e)}'}
        logger.error(f"❌ API extractor failed: {e}")
    
    # Test 3: Data Processing Pipeline
    logger.info("🔧 Testing data processing pipeline...")
    try:
        processor = MLDataProcessor()
        
        # Test historical data retrieval
        test_dataset, _ = create_ml_training_dataset(
            days_back=7,  # Small test dataset
            include_live_data=False,  # Skip live data for speed
            save_to_file=False  # Don't save test dataset
        )
        
        if not test_dataset.empty:
            test_results['tests']['data_processor'] = {
                'status': 'PASS', 
                'message': f'Created test dataset with {len(test_dataset)} rows and {len(test_dataset.columns)} features',
                'dataset_shape': test_dataset.shape,
                'sample_features': list(test_dataset.columns[:10])  # First 10 features
            }
            logger.info("✅ Data processing pipeline test passed")
        else:
            test_results['tests']['data_processor'] = {'status': 'FAIL', 'message': 'No training data could be generated'}
            logger.error("❌ Data processing pipeline test failed - no data")
    except Exception as e:
        test_results['tests']['data_processor'] = {'status': 'FAIL', 'message': f'Processing error: {str(e)}'}
        logger.error(f"❌ Data processing pipeline failed: {e}")
    
    # Test 4: Feature Engineering
    logger.info("⚙️ Testing feature engineering...")
    try:
        if 'data_processor' in test_results['tests'] and test_results['tests']['data_processor']['status'] == 'PASS':
            processor = MLDataProcessor()
            sample_dataset, _ = create_ml_training_dataset(days_back=3, include_live_data=False, save_to_file=False)
            
            if not sample_dataset.empty:
                feature_summary = processor.generate_feature_summary(sample_dataset)
                test_results['tests']['feature_engineering'] = {
                    'status': 'PASS',
                    'message': 'Feature engineering working correctly',
                    'numeric_features_count': len(feature_summary['numeric_features']),
                    'categorical_features_count': len(feature_summary['categorical_features']),
                    'data_quality_score': round(feature_summary['data_quality']['completeness_percent'], 2)
                }
                logger.info("✅ Feature engineering test passed")
            else:
                test_results['tests']['feature_engineering'] = {'status': 'FAIL', 'message': 'No data for feature analysis'}
        else:
            test_results['tests']['feature_engineering'] = {'status': 'SKIP', 'message': 'Skipped due to data processor failure'}
    except Exception as e:
        test_results['tests']['feature_engineering'] = {'status': 'FAIL', 'message': f'Feature engineering error: {str(e)}'}
        logger.error(f"❌ Feature engineering failed: {e}")
    
    # Determine overall success
    passed_tests = sum(1 for test in test_results['tests'].values() if test['status'] == 'PASS')
    total_tests = sum(1 for test in test_results['tests'].values() if test['status'] in ['PASS', 'FAIL'])
    test_results['overall_success'] = passed_tests == total_tests and total_tests > 0
    test_results['test_summary'] = f"{passed_tests}/{total_tests} tests passed"
    
    logger.info(f"🎯 ML Infrastructure Test Complete: {test_results['test_summary']}")
    return test_results

def initialize_ml_system():
    """
    Initialize the complete ML system and create first training dataset
    """
    logger.info("🚀 Initializing ML System for Phase 2")
    
    # Step 1: Test infrastructure
    test_results = test_ml_infrastructure()
    
    if not test_results['overall_success']:
        logger.error("❌ ML infrastructure tests failed. Cannot proceed with initialization.")
        return False
    
    logger.info("✅ All infrastructure tests passed. Proceeding with initialization.")
    
    # Step 2: Create initial comprehensive training dataset
    logger.info("📊 Creating initial comprehensive training dataset...")
    try:
        dataset, filepath = create_ml_training_dataset(
            days_back=30,  # One month of historical data
            include_live_data=True,  # Include current conditions
            save_to_file=True  # Save for ML model development
        )
        
        if not dataset.empty and filepath:
            logger.info(f"✅ Initial training dataset created successfully")
            logger.info(f"📁 Dataset saved to: {filepath}")
            logger.info(f"📊 Dataset contains {len(dataset)} samples with {len(dataset.columns)} features")
            
            # Generate and save feature summary
            processor = MLDataProcessor()
            feature_summary = processor.generate_feature_summary(dataset)
            
            # Save feature summary as JSON
            summary_path = Path(filepath).parent / f"feature_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            with open(summary_path, 'w') as f:
                json.dump(feature_summary, f, indent=2, default=str)
            
            logger.info(f"📋 Feature summary saved to: {summary_path}")
            
            # Log key dataset statistics
            logger.info("🔍 Dataset Summary:")
            logger.info(f"   • Data Quality: {feature_summary['data_quality']['completeness_percent']:.1f}% complete")
            logger.info(f"   • Numeric Features: {len(feature_summary['numeric_features'])}")
            logger.info(f"   • Categorical Features: {len(feature_summary['categorical_features'])}")
            
            if 'fare_prediction' in feature_summary['target_analysis']:
                fare_info = feature_summary['target_analysis']['fare_prediction']
                logger.info(f"   • Average Fare: ${fare_info['mean_fare']:.2f}")
                logger.info(f"   • Fare Range: {fare_info['fare_range']}")
            
            return True
        else:
            logger.error("❌ Failed to create initial training dataset")
            return False
            
    except Exception as e:
        logger.error(f"❌ ML system initialization failed: {e}")
        return False

def main():
    """Main entry point for ML system initialization"""
    print("=" * 60)
    print("🚀 Phase 2: ML System Initialization")
    print("=" * 60)
    
    success = initialize_ml_system()
    
    print("=" * 60)
    if success:
        print("✅ ML System initialization completed successfully!")
        print("📊 Ready for ML model development:")
        print("   • Historical ride data integrated")
        print("   • Real-time weather & traffic APIs connected") 
        print("   • Feature engineering pipeline operational")
        print("   • Training dataset generated and saved")
        print("\n🎯 Next Steps:")
        print("   • Task 2: Build demand prediction model")
        print("   • Task 3: Implement dynamic surge pricing")
        print("   • Task 4: Create driver positioning engine")
    else:
        print("❌ ML System initialization failed!")
        print("🔧 Check logs above for specific error details")
        print("🔄 Resolve issues and run initialization again")
    print("=" * 60)
    
    return success

if __name__ == "__main__":
    main()