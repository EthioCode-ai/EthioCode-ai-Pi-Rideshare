import React, { useEffect, useState } from 'react';
import { Download, Smartphone, Apple, Play } from 'lucide-react';
import QRCodeGenerator from '../components/QRCodeGenerator';

const DownloadRider: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsInstallable(false);
      }
    }
  };

  const openRiderApp = () => {
    window.location.href = '/rider';
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{ fontSize: '64px', marginBottom: '10px' }}>π</div>
        <h1 style={{
          color: 'white',
          fontSize: '48px',
          margin: '0',
          fontWeight: '700'
        }}>
          Pi VIP Rider
        </h1>
        <p style={{
          color: 'rgba(255,255,255,0.9)',
          fontSize: '18px',
          margin: '10px 0'
        }}>
          Premium Rideshare Experience
        </p>
      </div>

      {/* App Preview */}
      <div style={{
        width: '300px',
        height: '600px',
        background: 'white',
        borderRadius: '30px',
        padding: '20px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        marginBottom: '40px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
          borderRadius: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🚗</div>
          <h3 style={{ color: '#1e293b', fontSize: '24px', marginBottom: '10px' }}>Book Your Ride</h3>
          <p style={{ color: '#64748b', fontSize: '16px', lineHeight: '1.5', padding: '0 20px' }}>
            Premium vehicles, professional drivers, real-time tracking, and seamless payments
          </p>
          <div style={{
            background: '#3b82f6',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '25px',
            marginTop: '20px',
            fontSize: '16px',
            fontWeight: '600'
          }}>
            Get Started
          </div>
        </div>
      </div>

      {/* Installation Options */}
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '30px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{
          color: '#1e293b',
          fontSize: '24px',
          textAlign: 'center',
          marginBottom: '20px',
          fontWeight: '600'
        }}>
          Install Pi VIP Rider App
        </h2>

        {/* Android Install Button */}
        {isInstallable && (
          <button
            onClick={handleInstallClick}
            style={{
              width: '100%',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '15px',
              padding: '16px',
              fontSize: '18px',
              fontWeight: '600',
              cursor: 'pointer',
              marginBottom: '15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'background 0.3s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#059669'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#10b981'}
          >
            <Download size={24} />
            Install App Now
          </button>
        )}

        {/* iOS Instructions */}
        {isIOS && (
          <div style={{
            background: '#f1f5f9',
            borderRadius: '15px',
            padding: '20px',
            marginBottom: '15px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '10px'
            }}>
              <Apple size={20} color="#1e293b" />
              <span style={{ fontWeight: '600', color: '#1e293b' }}>iOS Installation:</span>
            </div>
            <ol style={{ color: '#64748b', margin: 0, paddingLeft: '20px' }}>
              <li>Tap the Share button <span style={{ fontSize: '18px' }}>⬆️</span></li>
              <li>Select "Add to Home Screen"</li>
              <li>Tap "Add" to install</li>
            </ol>
          </div>
        )}

        {/* Open Web App Button */}
        <button
          onClick={openRiderApp}
          style={{
            width: '100%',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '15px',
            padding: '16px',
            fontSize: '18px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            transition: 'background 0.3s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#2563eb'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#3b82f6'}
        >
          <Smartphone size={24} />
          Open Rider App
        </button>

        {/* Features */}
        <div style={{ marginTop: '25px' }}>
          <h3 style={{ color: '#1e293b', fontSize: '18px', marginBottom: '15px' }}>Features:</h3>
          <div style={{ display: 'grid', gap: '10px' }}>
            {[
              '🚗 Book rides instantly',
              '📍 Real-time tracking',
              '🛣️ Multiple stops with voice input',
              '💳 Secure payments',
              '⭐ Rate your experience',
              '🎯 Favorite locations',
              '🏢 Corporate discounts'
            ].map((feature, index) => (
              <div key={index} style={{ color: '#64748b', fontSize: '16px' }}>
                {feature}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* QR Code for Sharing */}
      <div style={{ marginTop: '20px' }}>
        <QRCodeGenerator 
          url="https://c3ae5066-b07d-4ca3-8a63-d0ea5329a006-00-3c9c4iku143gi.sisko.replit.dev/rider" 
          size={180}
        />
      </div>

      {/* Demo Account Info */}
      <div style={{
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '15px',
        padding: '20px',
        marginTop: '20px',
        textAlign: 'center',
        color: 'white'
      }}>
        <p style={{ margin: '0', fontSize: '14px', opacity: '0.9' }}>
          <strong>Demo Account:</strong> demo@rider.com | Password: password
        </p>
      </div>
    </div>
  );
};

export default DownloadRider;