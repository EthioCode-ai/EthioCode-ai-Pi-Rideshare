import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, User, Phone } from 'lucide-react';
import { apiUrl } from '../config/api.config';

export default function RiderAuthFixed() {
  const [currentView, setCurrentView] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [authData, setAuthData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
    agreeToTerms: false,
    agreeToMarketing: false
  });

  const [errors, setErrors] = useState<{[key: string]: string}>({});

  // Simple notification system
  const showNotification = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 600;
      font-size: 14px;
      z-index: 10000;
      min-width: 300px;
      max-width: 500px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transform: translateX(100%);
      transition: transform 0.3s ease-in-out;
      ${type === 'success' ? 'background-color: #10b981;' : ''}
      ${type === 'error' ? 'background-color: #ef4444;' : ''}
      ${type === 'warning' ? 'background-color: #f59e0b;' : ''}
      ${type === 'info' ? 'background-color: #3b82f6;' : ''}
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 4000);
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string) => {
    return password.length >= 6;
  };

  const validatePhone = (phone: string) => {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/\s+/g, ''));
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    const newErrors: {[key: string]: string} = {};
    if (!validateEmail(authData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!authData.password) {
      newErrors.password = 'Password is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(apiUrl('api/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: authData.email,
          password: authData.password
        })
      });

      const data = await response.json();

      if (response.ok) {
        showNotification('✅ Welcome back! Signed in successfully.', 'success');
        
        // Store user data and token
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('token', data.token);  // Fallback key
        localStorage.setItem('userData', JSON.stringify(data.user));
        
        // Redirect to rider app
        setTimeout(() => {
          window.location.href = '/rider';
        }, 1000);
      } else {
        setErrors({ general: data.error || 'Invalid email or password' });
      }
    } catch (error) {
      console.error('Sign in error:', error);
      setErrors({ general: 'Network error. Please try again.' });
    }
    
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    const newErrors: {[key: string]: string} = {};
    
    // Validation
    if (!authData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!authData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    if (!validateEmail(authData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!validatePassword(authData.password)) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (authData.password !== authData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (!validatePhone(authData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }
    if (!authData.agreeToTerms) {
      newErrors.agreeToTerms = 'You must agree to the terms and conditions';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(apiUrl('api/auth/register'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: authData.email,
          password: authData.password,
          firstName: authData.firstName,
          lastName: authData.lastName,
          phone: authData.phone,
          userType: 'rider'
        })
      });

      const data = await response.json();

      if (response.ok) {
        showNotification('🎉 Welcome to π! Account created successfully.', 'success');
        
        // Store user data and token
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('token', data.token);  // Fallback key
        localStorage.setItem('userData', JSON.stringify(data.user));
        
        // Redirect to rider app
        setTimeout(() => {
          window.location.href = '/rider';
        }, 1000);
      } else {
        setErrors({ general: data.error || 'Registration failed. Please try again.' });
      }
    } catch (error) {
      console.error('Sign up error:', error);
      setErrors({ general: 'Network error. Please try again.' });
    }
    
    setIsLoading(false);
  };

  return (
    <div style={{
      maxWidth: '450px',
      margin: '0 auto',
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        color: 'white',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '28px', fontWeight: '700', margin: '0 0 8px 0' }}>
          π Rider Authentication
        </h1>
        <p style={{ fontSize: '16px', opacity: 0.9, margin: 0 }}>
          {currentView === 'signin' ? 'Welcome back!' : 'Join the ride revolution'}
        </p>
      </div>

      <div style={{ padding: '32px 24px' }}>
        {/* Toggle between Sign In and Sign Up */}
        <div style={{
          display: 'flex',
          backgroundColor: '#e5e7eb',
          borderRadius: '12px',
          padding: '4px',
          marginBottom: '32px'
        }}>
          <button
            onClick={() => {
              setCurrentView('signin');
              setErrors({});
              setAuthData({
                email: '',
                password: '',
                confirmPassword: '',
                firstName: '',
                lastName: '',
                phone: '',
                agreeToTerms: false,
                agreeToMarketing: false
              });
            }}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: currentView === 'signin' ? 'white' : 'transparent',
              color: currentView === 'signin' ? '#1f2937' : '#6b7280',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: currentView === 'signin' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            Sign In
          </button>
          <button
            onClick={() => {
              setCurrentView('signup');
              setErrors({});
              setAuthData({
                email: '',
                password: '',
                confirmPassword: '',
                firstName: '',
                lastName: '',
                phone: '',
                agreeToTerms: false,
                agreeToMarketing: false
              });
            }}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: currentView === 'signup' ? 'white' : 'transparent',
              color: currentView === 'signup' ? '#1f2937' : '#6b7280',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: currentView === 'signup' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            Sign Up
          </button>
        </div>

        {/* Sign In Form */}
        {currentView === 'signin' && (
          <form onSubmit={handleSignIn}>
            {errors.general && (
              <div style={{
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '14px'
              }}>
                {errors.general}
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={20} style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af'
                }} />
                <input
                  type="email"
                  value={authData.email}
                  onChange={(e) => setAuthData({...authData, email: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '16px 16px 16px 48px',
                    border: `2px solid ${errors.email ? '#ef4444' : '#e5e7eb'}`,
                    borderRadius: '12px',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  placeholder="Enter your email"
                />
              </div>
              {errors.email && (
                <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>
                  {errors.email}
                </p>
              )}
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={20} style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af'
                }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={authData.password}
                  onChange={(e) => setAuthData({...authData, password: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '16px 48px 16px 48px',
                    border: `2px solid ${errors.password ? '#ef4444' : '#e5e7eb'}`,
                    borderRadius: '12px',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    color: '#9ca3af'
                  }}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.password && (
                <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>
                  {errors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: isLoading ? '#9ca3af' : '#1e293b',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {isLoading ? (
                <>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    border: '2px solid #ffffff40',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Signing In...
                </>
              ) : (
                '🚀 Sign In'
              )}
            </button>
          </form>
        )}

        {/* Sign Up Form */}
        {currentView === 'signup' && (
          <form onSubmit={handleSignUp}>
            {errors.general && (
              <div style={{
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '14px'
              }}>
                {errors.general}
              </div>
            )}

            {/* Name Fields */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
              <div style={{ flex: 1 }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  First Name
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={20} style={{
                    position: 'absolute',
                    left: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#9ca3af'
                  }} />
                  <input
                    type="text"
                    value={authData.firstName}
                    onChange={(e) => setAuthData({...authData, firstName: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '16px 16px 16px 48px',
                      border: `2px solid ${errors.firstName ? '#ef4444' : '#e5e7eb'}`,
                      borderRadius: '12px',
                      fontSize: '16px',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    placeholder="First name"
                  />
                </div>
                {errors.firstName && (
                  <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                    {errors.firstName}
                  </p>
                )}
              </div>

              <div style={{ flex: 1 }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Last Name
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={20} style={{
                    position: 'absolute',
                    left: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#9ca3af'
                  }} />
                  <input
                    type="text"
                    value={authData.lastName}
                    onChange={(e) => setAuthData({...authData, lastName: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '16px 16px 16px 48px',
                      border: `2px solid ${errors.lastName ? '#ef4444' : '#e5e7eb'}`,
                      borderRadius: '12px',
                      fontSize: '16px',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    placeholder="Last name"
                  />
                </div>
                {errors.lastName && (
                  <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                    {errors.lastName}
                  </p>
                )}
              </div>
            </div>

            {/* Email */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={20} style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af'
                }} />
                <input
                  type="email"
                  value={authData.email}
                  onChange={(e) => setAuthData({...authData, email: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '16px 16px 16px 48px',
                    border: `2px solid ${errors.email ? '#ef4444' : '#e5e7eb'}`,
                    borderRadius: '12px',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  placeholder="Enter your email"
                />
              </div>
              {errors.email && (
                <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>
                  {errors.email}
                </p>
              )}
            </div>

            {/* Phone */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Phone Number
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={20} style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af'
                }} />
                <input
                  type="tel"
                  value={authData.phone}
                  onChange={(e) => setAuthData({...authData, phone: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '16px 16px 16px 48px',
                    border: `2px solid ${errors.phone ? '#ef4444' : '#e5e7eb'}`,
                    borderRadius: '12px',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  placeholder="Enter your phone number"
                />
              </div>
              {errors.phone && (
                <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>
                  {errors.phone}
                </p>
              )}
            </div>

            {/* Password */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={20} style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af'
                }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={authData.password}
                  onChange={(e) => setAuthData({...authData, password: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '16px 48px 16px 48px',
                    border: `2px solid ${errors.password ? '#ef4444' : '#e5e7eb'}`,
                    borderRadius: '12px',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  placeholder="Create a password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    color: '#9ca3af'
                  }}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.password && (
                <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>
                  {errors.password}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Confirm Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={20} style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af'
                }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={authData.confirmPassword}
                  onChange={(e) => setAuthData({...authData, confirmPassword: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '16px 48px 16px 48px',
                    border: `2px solid ${errors.confirmPassword ? '#ef4444' : '#e5e7eb'}`,
                    borderRadius: '12px',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  placeholder="Confirm your password"
                />
              </div>
              {errors.confirmPassword && (
                <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            {/* Terms and Conditions */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#374151'
              }}>
                <input
                  type="checkbox"
                  checked={authData.agreeToTerms}
                  onChange={(e) => setAuthData({...authData, agreeToTerms: e.target.checked})}
                  style={{
                    marginTop: '2px',
                    accentColor: '#1e293b'
                  }}
                />
                <span>
                  I agree to the{' '}
                  <a href="#" style={{ color: '#1e293b', textDecoration: 'underline' }}>
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="#" style={{ color: '#1e293b', textDecoration: 'underline' }}>
                    Privacy Policy
                  </a>
                </span>
              </label>
              {errors.agreeToTerms && (
                <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>
                  {errors.agreeToTerms}
                </p>
              )}
            </div>

            {/* Marketing Consent */}
            <div style={{ marginBottom: '32px' }}>
              <label style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#374151'
              }}>
                <input
                  type="checkbox"
                  checked={authData.agreeToMarketing}
                  onChange={(e) => setAuthData({...authData, agreeToMarketing: e.target.checked})}
                  style={{
                    marginTop: '2px',
                    accentColor: '#1e293b'
                  }}
                />
                <span>
                  I'd like to receive updates about new features and promotions (optional)
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: isLoading ? '#9ca3af' : '#1e293b',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {isLoading ? (
                <>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    border: '2px solid #ffffff40',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Creating Account...
                </>
              ) : (
                '🎉 Create Account'
              )}
            </button>
          </form>
        )}
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
}