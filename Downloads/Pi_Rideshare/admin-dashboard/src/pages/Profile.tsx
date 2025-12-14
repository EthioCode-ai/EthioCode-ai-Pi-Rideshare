
import React, { useState, useEffect } from 'react';
import { 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  MapPin,
  Edit,
  Save,
  Camera,
  Shield,
  Bell,
  Settings,
  Key,
  Database,
  Users,
  Activity
} from 'lucide-react';
import { apiUrl } from '../config/api.config';


const Profile: React.FC = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notifications, setNotifications] = useState({
    email: true,
    sms: false,
    push: true,
    marketing: false
  });
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [profile, setProfile] = useState({
    name: 'Administrator',
    email: 'admin@rideflow.com',
    phone: '+1 (555) 123-4567',
    role: 'System Administrator',
    joinDate: 'January 15, 2023',
    location: 'San Francisco, CA',
    timezone: 'Pacific Time (PT)',
    lastLogin: new Date().toLocaleString(),
    department: 'Operations',
    emergencyContact: {
      name: 'Jane Smith',
      phone: '+1 (555) 987-6543',
      relationship: 'Supervisor'
    },
    permissions: {
      userManagement: true,
      rideManagement: true,
      analytics: true,
      payments: true,
      settings: true
    }
  });

  useEffect(() => {
  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(apiUrl('api/users/profile'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('👤 Profile loaded:', data);
        const user = data.user || data;
        setProfile(prev => ({
          ...prev,
          name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Administrator',
          email: user.email || prev.email,
          phone: user.phone || prev.phone,
          role: user.user_type === 'admin' ? 'System Administrator' : user.user_type,
          joinDate: user.created_at ? new Date(user.created_at).toLocaleDateString() : prev.joinDate,
          lastLogin: new Date().toLocaleString()
        }));
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };
  
  fetchProfile();
  
  // Also load from localStorage for notifications/2FA
  const savedNotifications = localStorage.getItem('admin_notifications');
  const saved2FA = localStorage.getItem('admin_2fa');
  if (savedNotifications) setNotifications(JSON.parse(savedNotifications));
  if (saved2FA) setTwoFactorEnabled(JSON.parse(saved2FA));
}, []);

  const handleInputChange = (key: string, value: string) => {
    setProfile(prev => ({ ...prev, [key]: value }));
  };

  const handleEmergencyContactChange = (key: string, value: string) => {
    setProfile(prev => ({
      ...prev,
      emergencyContact: { ...prev.emergencyContact, [key]: value }
    }));
  };

  const handleNotificationChange = (key: string, value: boolean) => {
    setNotifications(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Save to localStorage
    localStorage.setItem('admin_profile', JSON.stringify(profile));
    localStorage.setItem('admin_notifications', JSON.stringify(notifications));
    localStorage.setItem('admin_2fa', JSON.stringify(twoFactorEnabled));
    
    setIsEditing(false);
    setIsLoading(false);
    showNotification('✅ Profile updated successfully!', 'success');
  };

  const toggleTwoFactor = async () => {
    setIsLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setTwoFactorEnabled(!twoFactorEnabled);
    localStorage.setItem('admin_2fa', JSON.stringify(!twoFactorEnabled));
    setIsLoading(false);
    
    const message = twoFactorEnabled 
      ? '🔓 Two-factor authentication disabled' 
      : '🔒 Two-factor authentication enabled';
    showNotification(message, 'info');
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

  const resetPassword = () => {
    showNotification('🔄 Password reset email sent to your account!', 'info');
  };

  const exportData = () => {
    const data = {
      profile,
      notifications,
      twoFactorEnabled,
      exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'admin-profile-export.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('📄 Profile data exported successfully!', 'success');
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b', margin: '0 0 8px 0' }}>
            Profile Settings
          </h2>
          <p style={{ fontSize: '16px', color: '#64748b', margin: 0 }}>
            Manage your account information and system preferences
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={exportData}
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
            <Database size={16} />
            Export Data
          </button>
          <button
            onClick={() => isEditing ? handleSave() : setIsEditing(true)}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: isEditing ? '#10b981' : '#3b82f6',
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
            ) : isEditing ? <Save size={16} /> : <Edit size={16} />}
            {isLoading ? 'Saving...' : isEditing ? 'Save Changes' : 'Edit Profile'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '32px' }}>
        {/* Profile Card */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '32px',
          textAlign: 'center',
          height: 'fit-content'
        }}>
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '24px' }}>
            <div style={{
              width: '120px',
              height: '120px',
              backgroundColor: '#3b82f6',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '48px',
              fontWeight: '700',
              color: 'white',
              margin: '0 auto'
            }}>
              {profile.name.split(' ').map(n => n[0]).join('')}
            </div>
            <button 
              onClick={() => showNotification('📸 Photo upload feature coming soon!', 'info')}
              style={{
                position: 'absolute',
                bottom: '8px',
                right: '8px',
                width: '32px',
                height: '32px',
                backgroundColor: 'white',
                border: '2px solid #e2e8f0',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
            >
              <Camera size={14} color="#64748b" />
            </button>
          </div>

          <h3 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>
            {profile.name}
          </h3>
          <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '4px' }}>
            {profile.role}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '24px' }}>
            Member since {profile.joinDate}
          </div>

          <div style={{
            padding: '16px',
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
              <Shield size={16} color="#10b981" />
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#10b981' }}>
                Account Verified
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Last login: {profile.lastLogin}
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={resetPassword}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Key size={16} />
              Reset Password
            </button>
          </div>
        </div>

        {/* Profile Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Personal Information */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '32px'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>
              Personal Information
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  <User size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                  Full Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                ) : (
                  <div style={{ 
                    padding: '12px', 
                    backgroundColor: '#f8fafc', 
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#1e293b'
                  }}>
                    {profile.name}
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  <Mail size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                  Email Address
                </label>
                {isEditing ? (
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                ) : (
                  <div style={{ 
                    padding: '12px', 
                    backgroundColor: '#f8fafc', 
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#1e293b'
                  }}>
                    {profile.email}
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  <Phone size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                  Phone Number
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                ) : (
                  <div style={{ 
                    padding: '12px', 
                    backgroundColor: '#f8fafc', 
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#1e293b'
                  }}>
                    {profile.phone}
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  <MapPin size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle' }} />
                  Location
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={profile.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                ) : (
                  <div style={{ 
                    padding: '12px', 
                    backgroundColor: '#f8fafc', 
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#1e293b'
                  }}>
                    {profile.location}
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Department
                </label>
                {isEditing ? (
                  <select
                    value={profile.department}
                    onChange={(e) => handleInputChange('department', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: 'white'
                    }}
                  >
                    <option value="Operations">Operations</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Customer Support">Customer Support</option>
                    <option value="Finance">Finance</option>
                    <option value="Marketing">Marketing</option>
                  </select>
                ) : (
                  <div style={{ 
                    padding: '12px', 
                    backgroundColor: '#f8fafc', 
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#1e293b'
                  }}>
                    {profile.department}
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Timezone
                </label>
                {isEditing ? (
                  <select
                    value={profile.timezone}
                    onChange={(e) => handleInputChange('timezone', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: 'white'
                    }}
                  >
                    <option value="Pacific Time (PT)">Pacific Time (PT)</option>
                    <option value="Mountain Time (MT)">Mountain Time (MT)</option>
                    <option value="Central Time (CT)">Central Time (CT)</option>
                    <option value="Eastern Time (ET)">Eastern Time (ET)</option>
                  </select>
                ) : (
                  <div style={{ 
                    padding: '12px', 
                    backgroundColor: '#f8fafc', 
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#1e293b'
                  }}>
                    {profile.timezone}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '32px'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>
              Emergency Contact
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Contact Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={profile.emergencyContact.name}
                    onChange={(e) => handleEmergencyContactChange('name', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                ) : (
                  <div style={{ 
                    padding: '12px', 
                    backgroundColor: '#f8fafc', 
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#1e293b'
                  }}>
                    {profile.emergencyContact.name}
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Phone Number
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={profile.emergencyContact.phone}
                    onChange={(e) => handleEmergencyContactChange('phone', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                ) : (
                  <div style={{ 
                    padding: '12px', 
                    backgroundColor: '#f8fafc', 
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#1e293b'
                  }}>
                    {profile.emergencyContact.phone}
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Relationship
                </label>
                {isEditing ? (
                  <select
                    value={profile.emergencyContact.relationship}
                    onChange={(e) => handleEmergencyContactChange('relationship', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: 'white'
                    }}
                  >
                    <option value="Supervisor">Supervisor</option>
                    <option value="Manager">Manager</option>
                    <option value="HR Contact">HR Contact</option>
                    <option value="Family">Family</option>
                    <option value="Friend">Friend</option>
                  </select>
                ) : (
                  <div style={{ 
                    padding: '12px', 
                    backgroundColor: '#f8fafc', 
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#1e293b'
                  }}>
                    {profile.emergencyContact.relationship}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Security & Notifications */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '32px'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>
              Security & Notifications
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Two-Factor Authentication */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px',
                backgroundColor: twoFactorEnabled ? '#f0fdf4' : '#fef3c7',
                borderRadius: '12px',
                border: `2px solid ${twoFactorEnabled ? '#bbf7d0' : '#fde68a'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Shield size={20} color={twoFactorEnabled ? '#10b981' : '#f59e0b'} />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>
                      Two-Factor Authentication
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {twoFactorEnabled ? 'Your account is protected' : 'Add an extra layer of security'}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={toggleTwoFactor}
                  disabled={isLoading}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: twoFactorEnabled ? '#10b981' : '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    opacity: isLoading ? 0.7 : 1
                  }}
                >
                  {twoFactorEnabled ? 'Enabled' : 'Enable'}
                </button>
              </div>

              {/* Notification Preferences */}
              <div style={{
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <Bell size={20} color="#64748b" />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>
                      Notification Preferences
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Choose how you want to be notified
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {Object.entries(notifications).map(([key, value]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => handleNotificationChange(key, e.target.checked)}
                        style={{ accentColor: '#3b82f6' }}
                      />
                      <span style={{ fontSize: '14px', color: '#374151', textTransform: 'capitalize' }}>
                        {key === 'sms' ? 'SMS' : key}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* System Permissions */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '32px'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>
              System Permissions
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              {Object.entries(profile.permissions).map(([key, value]) => (
                <div key={key} style={{
                  padding: '12px',
                  backgroundColor: value ? '#f0fdf4' : '#fef2f2',
                  borderRadius: '8px',
                  border: `2px solid ${value ? '#bbf7d0' : '#fecaca'}`,
                  textAlign: 'center'
                }}>
                  <div style={{ 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    color: value ? '#10b981' : '#ef4444',
                    marginBottom: '4px',
                    textTransform: 'capitalize'
                  }}>
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {value ? '✓ Granted' : '✗ Denied'}
                  </div>
                </div>
              ))}
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

export default Profile;
