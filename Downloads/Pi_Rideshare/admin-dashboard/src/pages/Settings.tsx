import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  RefreshCw,
  Database,
  Mail,
  Bell,
  MapPin,
  DollarSign,
  Shield,
  Users,
  Car,
  Clock,
  Check,
  X
} from 'lucide-react';
import { apiUrl } from '../config/api.config';

const Settings: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState<string>('');

  const [generalSettings, setGeneralSettings] = useState({
    siteName: 'RideFlow Admin',
    siteDescription: 'Advanced Ride-Sharing Management Platform',
    defaultTimezone: 'America/Los_Angeles',
    currency: 'USD',
    language: 'en',
    maintenanceMode: false,
    debugMode: false
  });

  const [rideSettings, setRideSettings] = useState({
    baseFare: 2.50,
    perMileRate: 1.85,
    perMinuteRate: 0.35,
    bookingFee: 1.50,
    cancellationFee: 3.00,
    maxRideRadius: 25,
    allowScheduledRides: true,
    acceptPets: false,
    acceptTeens: false,
    surgeMultiplierMax: 3.0,
    driverCommission: 75
  });

  const [markets, setMarkets] = useState<any[]>([]);

  const [selectedMarketId, setSelectedMarketId] = useState<string>('');

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    smsNotifications: true,
    pushNotifications: true,
    riderNotifications: true,
    driverNotifications: true,
    adminAlerts: true,
    systemMaintenanceAlerts: true,
    paymentFailureAlerts: true
  });

  const [securitySettings, setSecuritySettings] = useState({
    requireTwoFactor: false,
    sessionTimeout: 60,
    maxLoginAttempts: 5,
    passwordMinLength: 8,
    requirePasswordComplexity: true,
    allowRememberMe: true,
    apiRateLimit: 100,
    enableAuditLogging: true
  });

  const [mapSettings, setMapSettings] = useState({
    defaultMapType: 'roadmap',
    enableTraffic: true,
    enableTransit: true,
    defaultZoom: 13,
    enableGeolocation: true,
    mapProvider: 'google',
    updateInterval: 5000,
    showDriverLocations: true
  });

  useEffect(() => {
  const loadSettings = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(apiUrl('api/admin/settings'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('⚙️ Settings loaded:', data);
        if (data.settings) {
          if (data.settings.general) setGeneralSettings(data.settings.general);
          if (data.settings.ride) setRideSettings(data.settings.ride);
          if (data.settings.notifications) setNotificationSettings(data.settings.notifications);
          if (data.settings.security) setSecuritySettings(data.settings.security);
          if (data.settings.map) setMapSettings(data.settings.map);
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };
  
  loadSettings();
loadMarkets();
}, []);

const loadMarkets = async () => {
  try {
    const token = localStorage.getItem('authToken');
    const response = await fetch(apiUrl('api/admin/market-pricing'), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    if (response.ok) {
      const data = await response.json();
      console.log('📍 Markets loaded for pricing:', data.markets?.length);
      setMarkets(data.markets || []);
      if (data.markets?.length > 0) {
        setSelectedMarketId(data.markets[0].id);
        loadMarketPricing(data.markets[0].id);
      }
    }
  } catch (error) {
    console.error('Failed to load markets:', error);
  }
};

const loadMarketPricing = async (marketId: string) => {
  try {
    const token = localStorage.getItem('authToken');
    const response = await fetch(apiUrl(`api/admin/market-pricing/${marketId}`), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    if (response.ok) {
      const data = await response.json();
      console.log('💰 Market pricing loaded:', data.market);
      const m = data.market;
      setRideSettings({
        baseFare: parseFloat(m.base_fare_economy) || 2.50,
        perMileRate: parseFloat(m.per_mile_fare) || 1.85,
        perMinuteRate: parseFloat(m.per_minute_fare) || 0.35,
        bookingFee: parseFloat(m.booking_fee) || 1.50,
        cancellationFee: 3.00,
        maxRideRadius: 25,
        allowScheduledRides: true,
        acceptPets: false,
        acceptTeens: false,
        surgeMultiplierMax: parseFloat(m.max_surge_multiplier) || 3.0,
        driverCommission: parseInt(m.driver_commission_percent) || 75
      });
    }
  } catch (error) {
    console.error('Failed to load market pricing:', error);
  }
};

  const handleGeneralChange = (key: string, value: any) => {
    setGeneralSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleRideChange = (key: string, value: any) => {
    setRideSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleNotificationChange = (key: string, value: boolean) => {
    setNotificationSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSecurityChange = (key: string, value: any) => {
    setSecuritySettings(prev => ({ ...prev, [key]: value }));
  };

  const handleMapChange = (key: string, value: any) => {
    setMapSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveAllSettings = async () => {
  setIsLoading(true);
  try {
    const token = localStorage.getItem('authToken');
    const settings = [
      { key: 'general', value: generalSettings },
      { key: 'ride', value: rideSettings },
      { key: 'notifications', value: notificationSettings },
      { key: 'security', value: securitySettings },
      { key: 'map', value: mapSettings }
    ];
    
// Save market-specific pricing
if (selectedMarketId) {
  await fetch(apiUrl(`api/admin/market-pricing/${selectedMarketId}`), {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      base_fare_economy: rideSettings.baseFare,
      per_mile_fare: rideSettings.perMileRate,
      per_minute_fare: rideSettings.perMinuteRate,
      booking_fee: rideSettings.bookingFee,
      driver_commission_percent: rideSettings.driverCommission,
      max_surge_multiplier: rideSettings.surgeMultiplierMax
    })
  });
}

    for (const setting of settings) {
      await fetch(apiUrl(`api/admin/settings/${setting.key}`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value: setting.value })
      });
    }
    
    const saveTime = new Date().toLocaleString();
    setLastSaved(saveTime);
    showNotification('✅ All settings saved successfully!', 'success');
  } catch (error) {
    console.error('Failed to save settings:', error);
    showNotification('❌ Failed to save settings', 'error');
  } finally {
    setIsLoading(false);
  }
};

  const resetToDefaults = () => {
    if (confirm('Are you sure you want to reset all settings to default values? This action cannot be undone.')) {
      // Reset all settings to defaults
      setGeneralSettings({
        siteName: 'RideFlow Admin',
        siteDescription: 'Advanced Ride-Sharing Management Platform',
        defaultTimezone: 'America/Los_Angeles',
        currency: 'USD',
        language: 'en',
        maintenanceMode: false,
        debugMode: false
      });

      setRideSettings({
        baseFare: 2.50,
        perMileRate: 1.85,
        perMinuteRate: 0.35,
        bookingFee: 1.50,
        cancellationFee: 3.00,
        maxRideRadius: 25,
        allowScheduledRides: true,
        acceptPets: false,
        acceptTeens: false,
        surgeMultiplierMax: 3.0,
        driverCommission: 75
      });

      showNotification('🔄 Settings reset to defaults', 'info');
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 10000;
      animation: slideIn 0.3s ease-out;
      max-width: 300px;
    `;

    notification.textContent = message;
    document.body.appendChild(notification);

    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { opacity: 0; transform: translateX(100%); }
        to { opacity: 1; transform: translateX(0); }
      }
    `;
    document.head.appendChild(style);

    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    }, 4000);
  };

  const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) => (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: '44px',
        height: '24px',
        backgroundColor: checked ? '#10b981' : '#d1d5db',
        borderRadius: '12px',
        position: 'relative',
        cursor: 'pointer',
        transition: 'all 0.2s ease'
      }}
    >
      <div
        style={{
          width: '20px',
          height: '20px',
          backgroundColor: 'white',
          borderRadius: '50%',
          position: 'absolute',
          top: '2px',
          left: checked ? '22px' : '2px',
          transition: 'all 0.2s ease',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}
      />
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b', margin: '0 0 8px 0' }}>
            System Settings
          </h2>
          <p style={{ fontSize: '16px', color: '#64748b', margin: 0 }}>
            Configure platform settings and preferences
            {lastSaved && (
              <span style={{ marginLeft: '16px', fontSize: '14px', color: '#10b981' }}>
                Last saved: {lastSaved}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={resetToDefaults}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#6b7280',
              color: 'white',
              border: 'none',
              padding: '12px 20px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={16} />
            Reset to Defaults
          </button>
          <button
            onClick={saveAllSettings}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1
            }}
          >
            {isLoading ? (
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid #ffffff40',
                borderTop: '2px solid white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            ) : <Save size={16} />}
            {isLoading ? 'Saving...' : 'Save All Settings'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* General Settings */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '32px'
          }}>
            <h3 style={{
              fontSize: '20px',
              fontWeight: '700',
              color: '#1e293b',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <SettingsIcon size={20} color="#3b82f6" />
              General Settings
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Site Name
                </label>
                <input
                  type="text"
                  value={generalSettings.siteName}
                  onChange={(e) => handleGeneralChange('siteName', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Site Description
                </label>
                <textarea
                  value={generalSettings.siteDescription}
                  onChange={(e) => handleGeneralChange('siteDescription', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    minHeight: '80px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                    Default Timezone
                  </label>
                  <select
                    value={generalSettings.defaultTimezone}
                    onChange={(e) => handleGeneralChange('defaultTimezone', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: 'white'
                    }}
                  >
                    <option value="America/Los_Angeles">Pacific Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/New_York">Eastern Time</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                    Currency
                  </label>
                  <select
                    value={generalSettings.currency}
                    onChange={(e) => handleGeneralChange('currency', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: 'white'
                    }}
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CAD">CAD ($)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>Maintenance Mode</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Disable public access to the platform</div>
                </div>
                <ToggleSwitch
                  checked={generalSettings.maintenanceMode}
                  onChange={(checked) => handleGeneralChange('maintenanceMode', checked)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>Debug Mode</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Enable detailed logging and error reporting</div>
                </div>
                <ToggleSwitch
                  checked={generalSettings.debugMode}
                  onChange={(checked) => handleGeneralChange('debugMode', checked)}
                />
              </div>
            </div>
          </div>

          {/* Ride Settings */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '32px'
          }}>
            <h3 style={{
              fontSize: '20px',
              fontWeight: '700',
              color: '#1e293b',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Car size={20} color="#3b82f6" />
              Ride Settings
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                    Base Fare ($)
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    value={rideSettings.baseFare}
                    onChange={(e) => handleRideChange('baseFare', parseFloat(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                 {/* Market Selector */}
                 <div style={{ marginBottom: '16px' }}>
                 <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                 Select Market
               </label>
              <select
               value={selectedMarketId}
               onChange={(e) => {
                setSelectedMarketId(e.target.value);
                loadMarketPricing(e.target.value);
             }}
               style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: 'white'
           }}
        >
              {markets.map(m => (
              <option key={m.id} value={m.id}>{m.market_name} ({m.city}, {m.state})</option>
            ))}
             </select>
               </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                    Per Mile Rate ($)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={rideSettings.perMileRate}
                    onChange={(e) => handleRideChange('perMileRate', parseFloat(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                    Per Minute Rate ($)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={rideSettings.perMinuteRate}
                    onChange={(e) => handleRideChange('perMinuteRate', parseFloat(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                    Driver Commission (%)
                  </label>
                  <input
                    type="number"
                    min="50"
                    max="95"
                    value={rideSettings.driverCommission}
                    onChange={(e) => handleRideChange('driverCommission', parseInt(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>Accept Pets</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Allow riders to bring pets on rides</div>
                </div>
                <ToggleSwitch
                  checked={rideSettings.acceptPets}
                  onChange={(checked) => handleRideChange('acceptPets', checked)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>Accept Teens</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Allow unaccompanied minors (13-17) to book rides</div>
                </div>
                <ToggleSwitch
                  checked={rideSettings.acceptTeens}
                  onChange={(checked) => handleRideChange('acceptTeens', checked)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>Allow Scheduled Rides</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Enable advance booking of rides</div>
                </div>
                <ToggleSwitch
                  checked={rideSettings.allowScheduledRides}
                  onChange={(checked) => handleRideChange('allowScheduledRides', checked)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Notification Settings */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '32px'
          }}>
            <h3 style={{
              fontSize: '20px',
              fontWeight: '700',
              color: '#1e293b',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Bell size={20} color="#3b82f6" />
              Notification Settings
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.entries(notificationSettings).map(([key, value]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', textTransform: 'capitalize' }}>
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {key.includes('Admin') ? 'Administrative notifications' :
                       key.includes('System') ? 'System maintenance alerts' :
                       key.includes('Payment') ? 'Payment failure notifications' :
                       'General platform notifications'}
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={value}
                    onChange={(checked) => handleNotificationChange(key, checked)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Security Settings */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '32px'
          }}>
            <h3 style={{
              fontSize: '20px',
              fontWeight: '700',
              color: '#1e293b',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Shield size={20} color="#3b82f6" />
              Security Settings
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                    Session Timeout (minutes)
                  </label>
                  <input
                    type="number"
                    min="15"
                    max="480"
                    value={securitySettings.sessionTimeout}
                    onChange={(e) => handleSecurityChange('sessionTimeout', parseInt(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                    Max Login Attempts
                  </label>
                  <input
                    type="number"
                    min="3"
                    max="10"
                    value={securitySettings.maxLoginAttempts}
                    onChange={(e) => handleSecurityChange('maxLoginAttempts', parseInt(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>Require Two-Factor Authentication</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Force all users to enable 2FA</div>
                </div>
                <ToggleSwitch
                  checked={securitySettings.requireTwoFactor}
                  onChange={(checked) => handleSecurityChange('requireTwoFactor', checked)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>Enable Audit Logging</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Log all administrative actions</div>
                </div>
                <ToggleSwitch
                  checked={securitySettings.enableAuditLogging}
                  onChange={(checked) => handleSecurityChange('enableAuditLogging', checked)}
                />
              </div>
            </div>
          </div>

          {/* Map Settings */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '32px'
          }}>
            <h3 style={{
              fontSize: '20px',
              fontWeight: '700',
              color: '#1e293b',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <MapPin size={20} color="#3b82f6" />
              Map Settings
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                    Default Map Type
                  </label>
                  <select
                    value={mapSettings.defaultMapType}
                    onChange={(e) => handleMapChange('defaultMapType', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: 'white'
                    }}
                  >
                    <option value="roadmap">Roadmap</option>
                    <option value="satellite">Satellite</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="terrain">Terrain</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                    Update Interval (ms)
                  </label>
                  <input
                    type="number"
                    min="1000"
                    max="30000"
                    step="1000"
                    value={mapSettings.updateInterval}
                    onChange={(e) => handleMapChange('updateInterval', parseInt(e.target.value))}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>Enable Traffic Layer</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Show real-time traffic information</div>
                </div>
                <ToggleSwitch
                  checked={mapSettings.enableTraffic}
                  onChange={(checked) => handleMapChange('enableTraffic', checked)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>Show Driver Locations</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Display live driver positions on map</div>
                </div>
                <ToggleSwitch
                  checked={mapSettings.showDriverLocations}
                  onChange={(checked) => handleMapChange('showDriverLocations', checked)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default Settings;