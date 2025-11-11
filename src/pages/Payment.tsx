import React, { useState } from 'react';
import { 
  CreditCard, 
  DollarSign, 
  TrendingUp, 
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  TestTube,
  Play,
  Zap
} from 'lucide-react';

const Payment: React.FC = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState('today');
  const [testResults, setTestResults] = useState<any>(null);
  const [isRunningTest, setIsRunningTest] = useState(false);

  const runPaymentTest = async (scenario: string) => {
    setIsRunningTest(true);
    try {
      const response = await fetch('/api/payments/test/simulate-payment', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          rideId: 'test_ride_123',
          amount: 25.50,
          paymentMethodId: 'pm_test_visa_4242',
          scenario
        })
      });
      const data = await response.json();
      setTestResults(data);
    } catch (error) {
      console.error('Payment test failed:', error);
      setTestResults({ error: 'Test failed' });
    } finally {
      setIsRunningTest(false);
    }
  };

  const validatePaymentFlow = async () => {
    setIsRunningTest(true);
    try {
      const response = await fetch('/api/payments/test/validate-flow', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          rideId: 'test_ride_123',
          paymentMethodId: 'pm_test_visa_4242'
        })
      });
      const data = await response.json();
      setTestResults(data);
    } catch (error) {
      console.error('Payment validation failed:', error);
      setTestResults({ error: 'Validation failed' });
    } finally {
      setIsRunningTest(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px', color: '#1e293b' }}>
        Payment Management
      </h1>
      <p style={{ color: '#64748b', marginBottom: '32px' }}>
        Manage payment methods, view transaction history, and handle billing
      </p>

      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>
          Payment Dashboard
        </h2>
        <p style={{ color: '#64748b' }}>
          Payment management features will be implemented here.
        </p>

        <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px', marginTop: '32px' }}>
          Payment Testing Interface
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
          <button 
            onClick={() => runPaymentTest('successful_payment')} 
            disabled={isRunningTest}
            style={{ 
              padding: '12px 20px', 
              borderRadius: '8px', 
              backgroundColor: '#4CAF50', 
              color: 'white', 
              border: 'none', 
              cursor: isRunningTest ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px'
            }}
          >
            {isRunningTest ? <RefreshCw className="animate-spin mr-2" /> : <CheckCircle className="mr-2" />}
            Run Successful Payment Test
          </button>
          <button 
            onClick={() => runPaymentTest('failed_payment')} 
            disabled={isRunningTest}
            style={{ 
              padding: '12px 20px', 
              borderRadius: '8px', 
              backgroundColor: '#f44336', 
              color: 'white', 
              border: 'none', 
              cursor: isRunningTest ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px'
            }}
          >
            {isRunningTest ? <RefreshCw className="animate-spin mr-2" /> : <AlertCircle className="mr-2" />}
            Run Failed Payment Test
          </button>
          <button 
            onClick={validatePaymentFlow} 
            disabled={isRunningTest}
            style={{ 
              padding: '12px 20px', 
              borderRadius: '8px', 
              backgroundColor: '#ff9800', 
              color: 'white', 
              border: 'none', 
              cursor: isRunningTest ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px'
            }}
          >
            {isRunningTest ? <RefreshCw className="animate-spin mr-2" /> : <Zap className="mr-2" />}
            Validate Payment Flow
          </button>
        </div>

        {testResults && (
          <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#f0f4f8', borderRadius: '8px' }}>
            <h4 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>Test Results:</h4>
            {testResults.error ? (
              <div style={{ color: '#f44336', display: 'flex', alignItems: 'center' }}>
                <AlertCircle className="mr-2" />
                <span>Error: {testResults.error}</span>
              </div>
            ) : (
              <pre style={{ color: '#1e293b', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {JSON.stringify(testResults, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Payment;