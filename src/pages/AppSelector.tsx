import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, User, BarChart3, MapPin } from 'lucide-react';

const AppSelector: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '20px',
        padding: '40px',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        {/* Logo */}
        <div style={{ marginBottom: '30px' }}>
          <h1 style={{ 
            fontSize: '64px', 
            fontWeight: '700', 
            color: '#4F46E5', 
            margin: 0,
            lineHeight: '1'
          }}>
            π
          </h1>
          <h2 style={{ 
            fontSize: '24px', 
            fontWeight: '600', 
            color: '#1e293b', 
            margin: '10px 0 5px 0' 
          }}>
            Pi VIP Rideshare
          </h2>
          <p style={{ 
            fontSize: '16px', 
            color: '#64748b', 
            margin: 0 
          }}>
            Choose your app to get started
          </p>
        </div>

        {/* App Selection Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Rider App */}
          <button
            onClick={() => navigate('/rider')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              padding: '20px 24px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#2563eb';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#3b82f6';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <User size={24} />
            <span>Book a Ride</span>
          </button>

          {/* Driver App */}
          <button
            onClick={() => navigate('/driver')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              padding: '20px 24px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#059669';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#10b981';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <Car size={24} />
            <span>Start Driving</span>
          </button>

          {/* Admin Dashboard */}
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              padding: '20px 24px',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#7c3aed';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#8b5cf6';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <BarChart3 size={24} />
            <span>Admin Dashboard</span>
          </button>
        </div>

        {/* Footer */}
        <div style={{ 
          marginTop: '30px', 
          paddingTop: '20px', 
          borderTop: '1px solid #e2e8f0' 
        }}>
          <p style={{ 
            fontSize: '14px', 
            color: '#94a3b8', 
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <MapPin size={16} />
            Premium rideshare platform
          </p>
        </div>
      </div>
    </div>
  );
};

export default AppSelector;