import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import AdminLogin from './AdminLogin';
import { 
  LayoutDashboard, 
  Users, 
  Car, 
  MapPin, 
  BarChart3, 
  Settings, 
  CreditCard, 
  User, 
  Mail,
  Menu,
  X,
  Globe,
  AlertTriangle,
  TrendingUp,
  Building2,
  FileText,
  Bell,
  Camera
} from 'lucide-react';


export default function Layout() {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (token: string, userData: any) => {
    setIsAuthenticated(true);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px',
        color: '#666'
      }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Users, label: 'Drivers', path: '/dashboard/drivers' },
    { icon: Users, label: 'Riders', path: '/dashboard/riders' },
    { icon: Car, label: 'Rides', path: '/dashboard/rides' },
    { icon: BarChart3, label: 'Analytics', path: '/dashboard/analytics' },
    { icon: MapPin, label: 'Dispatch', path: '/dashboard/dispatch' },
    { icon: Building2, label: 'Corporations', path: '/dashboard/corporations' },
    { icon: FileText, label: 'Corp Applications', path: '/dashboard/corporate-applications' },
    { icon: Camera, label: 'Badge Verification', path: '/dashboard/driver-badge-verification' },
    { icon: Globe, label: 'Markets', path: '/dashboard/markets' },
    { icon: AlertTriangle, label: 'Disputes', path: '/dashboard/disputes' },
    { icon: Settings, label: 'Settings', path: '/dashboard/settings' },
    { icon: CreditCard, label: 'Payment', path: '/dashboard/payment' },
    { icon: User, label: 'Profile', path: '/dashboard/profile' },
    { icon: Mail, label: 'Inbox', path: '/dashboard/inbox' },
    { icon: TrendingUp, label: 'Surge Map', path: '/dashboard/surge-map' },
    { icon: Settings, label: 'Surge Control', path: '/dashboard/surge-control' },
    { icon: Bell, label: 'Push Notifications', path: '/dashboard/push-notifications' },
  ];

  return (
    <div className="layout">
      {/* Sidebar */}
      <div className="sidebar">
        <div style={{ padding: '20px', borderBottom: '1px solid #334155' }}>
          <div>
            <h2 style={{ fontSize: '48px', fontWeight: '700', color: 'white', margin: 0, lineHeight: '1' }}>
              π
            </h2>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
              Admin Dashboard
            </p>
          </div>
        </div>

        <nav style={{ padding: '20px 0' }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 20px',
                  color: isActive ? '#3b82f6' : '#94a3b8',
                  textDecoration: 'none',
                  backgroundColor: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                  borderRight: isActive ? '3px solid #3b82f6' : '3px solid transparent',
                  fontSize: '14px',
                  fontWeight: isActive ? '600' : '500',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'rgba(148, 163, 184, 0.1)';
                    e.currentTarget.style.color = '#e2e8f0';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#94a3b8';
                  }
                }}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Header */}
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            

            <div>
              <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#1e293b', margin: 0 }}>
                Welcome back, Admin
              </h1>
              <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
                Here's what's happening with your platform today.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: '600',
              fontSize: '14px'
            }}>
              A
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="content">
          <Outlet />
        </main>
      </div>


      <style>
        {`
          .layout {
            display: flex;
            min-height: 100vh;
            background-color: #f8fafc;
          }

          .sidebar {
            width: 280px;
            background-color: #1e293b;
            border-right: 1px solid #334155;
            transition: width 0.3s ease;
            position: fixed;
            height: 100vh;
            overflow-y: auto;
            z-index: 30;
            display: flex;
            flex-direction: column;
          }

          .main-content {
            flex: 1;
            margin-left: 280px;
          }

          .header {
            background-color: white;
            border-bottom: 1px solid #e2e8f0;
            padding: 16px 32px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .content {
            padding: 32px;
          }

          .mobile-menu-btn {
            display: none;
          }

          @media (max-width: 768px) {
            .sidebar {
              width: 260px;
              transform: translateX(0);
              position: fixed;
              top: 0;
              left: 0;
              z-index: 40;
            }

            .main-content {
              margin-left: 260px;
            }
          }
        `}
      </style>
    </div>
  );
}