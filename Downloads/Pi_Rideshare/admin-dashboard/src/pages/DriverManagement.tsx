import React, { useState } from 'react';
import { 
  User, 
  MapPin, 
  Star, 
  Phone, 
  Mail,
  Car,
  DollarSign,
  Calendar,
  Search,
  Filter,
  MoreVertical,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Edit,
  UserX,
  UserCheck,
  MessageSquare,
  FileText,
  BarChart3,
  Key,
  AlertTriangle
} from 'lucide-react';
import DriverEnrollmentForm from '../components/DriverEnrollmentForm';
import { apiUrl } from '../config/api.config';
import { io } from 'socket.io-client';
import { getSocketUrl } from '../config/api.config';


const DriverManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showEnrollmentForm, setShowEnrollmentForm] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [showDriverProfile, setShowDriverProfile] = useState(false);
  const [showEditDriver, setShowEditDriver] = useState(false);
  const [showTripHistory, setShowTripHistory] = useState(false);
  const [showEarningsReport, setShowEarningsReport] = useState(false);
  const [showSendMessage, setShowSendMessage] = useState(false);
  const [showPerformanceAnalytics, setShowPerformanceAnalytics] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{type: string, driver: any} | null>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

// Fetch real drivers from database
const fetchDrivers = async () => {
  try {
    console.log('🚗 Fetching drivers from API...');
    const token = localStorage.getItem('authToken');
    const response = await fetch(apiUrl('api/admin/drivers'), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('🚗 Response status:', response.status, response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('🚗 API response data:', data);
      
      const driversList = Array.isArray(data) ? data : (data.drivers || []);
      console.log('🚗 Drivers list extracted:', driversList);
      
      if (driversList.length > 0) {
        const transformedDrivers = driversList.map((driver: any) => ({
          id: driver.id,
          name: driver.name,
          email: driver.email,
          phone: driver.phone || 'N/A',
          status: driver.status || 'offline',
          rating: parseFloat(driver.rating) || 5.0,
          totalRides: driver.total_rides || 0,
          earnings: driver.total_earnings ? `$${parseFloat(driver.total_earnings).toFixed(2)}` : '$0.00',
          vehicleModel: driver.vehicle_make && driver.vehicle_model 
            ? `${driver.vehicle_year || ''} ${driver.vehicle_make} ${driver.vehicle_model}`.trim()
            : 'Vehicle Pending',
          location: 'City Area',
          joinDate: driver.created_at ? new Date(driver.created_at).toLocaleDateString() : 'Unknown'
        }));
          console.log('🚗 Transformed drivers:', transformedDrivers);
          setDrivers(transformedDrivers);
         } else {
          console.log('🚗 No drivers found in response');
         }
        } else {
          console.error('🚗 API error:', response.status, await response.text());
        }
       } catch (error) {
          console.error('🚗 Failed to fetch drivers:', error);
       } finally {
         setLoading(false);
       }
   };

   React.useEffect(() => {
        fetchDrivers();
  
     // Connect to Socket.IO for real-time updates
      const socket = io(getSocketUrl(), {
      transports: ['websocket', 'polling']
    });
  
   socket.on('driver-availability-update', () => {
    console.log('🔄 Driver status changed, refreshing...');
    fetchDrivers();
  });
  
  return () => {
    socket.disconnect();
  };
}, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return '#10b981';
      case 'offline': return '#6b7280';
      case 'busy': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return <CheckCircle size={16} />;
      case 'offline': return <XCircle size={16} />;
      case 'busy': return <Clock size={16} />;
      default: return <XCircle size={16} />;
    }
  };

  const filteredDrivers = drivers.filter(driver => {
    const matchesSearch = driver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         driver.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || driver.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleNewDriverSubmit = (driverData: any) => {
    console.log('🚗 New Driver Application Submitted:', driverData);
    
    // Here you would typically send the data to your backend API
    // For now, we'll just log it and show a success message
    alert(`Driver application submitted successfully!\n\nName: ${driverData.firstName} ${driverData.lastName}\nEmail: ${driverData.email}\nVehicle: ${driverData.vehicleYear} ${driverData.vehicleMake} ${driverData.vehicleModel}\n\nApplication will be reviewed within 2-3 business days.`);
    
    setShowEnrollmentForm(false);
  };

  const handleDriverAction = (action: string, driver: any) => {
    setSelectedDriver(driver);
    setActiveDropdown(null);
    
    switch (action) {
      case 'view':
        setShowDriverProfile(true);
        break;
      case 'edit':
        setShowEditDriver(true);
        break;
      case 'suspend':
        setConfirmAction({type: 'suspend', driver});
        break;
      case 'activate':
        setConfirmAction({type: 'activate', driver});
        break;
      case 'trips':
        setShowTripHistory(true);
        break;
      case 'earnings':
        setShowEarningsReport(true);
        break;
      case 'message':
        setShowSendMessage(true);
        break;
      case 'analytics':
        setShowPerformanceAnalytics(true);
        break;
      case 'deactivate':
        setConfirmAction({type: 'deactivate', driver});
        break;
      case 'reset-password':
        setConfirmAction({type: 'reset-password', driver});
        break;
      default:
        break;
    }
  };

  const executeAction = async (actionType: string, driver: any) => {
    try {
      // Here you would make API calls to your backend
      switch (actionType) {
        case 'suspend':
          console.log(`Suspending driver ${driver.name}`);
          alert(`Driver ${driver.name} has been suspended.`);
          break;
        case 'activate':
          console.log(`Activating driver ${driver.name}`);
          alert(`Driver ${driver.name} has been activated.`);
          break;
        case 'deactivate':
          console.log(`Deactivating driver ${driver.name}`);
          alert(`Driver ${driver.name} has been permanently deactivated.`);
          break;
        case 'reset-password':
          console.log(`Resetting password for driver ${driver.name}`);
          alert(`Password reset email sent to ${driver.email}`);
          break;
        default:
          break;
      }
      setConfirmAction(null);
    } catch (error) {
      console.error('Action failed:', error);
      alert('Action failed. Please try again.');
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b', margin: '0 0 8px 0' }}>
            Driver Management
          </h2>
          <p style={{ fontSize: '16px', color: '#64748b', margin: 0 }}>
            Manage your driver fleet and monitor performance
          </p>
        </div>
        <button 
          onClick={() => setShowEnrollmentForm(true)}
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Add New Driver
        </button>
      </div>

      {/* Filters */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        gap: '16px',
        alignItems: 'center'
      }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Search drivers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 12px 12px 44px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '12px',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '14px',
            minWidth: '120px'
          }}
        >
          <option value="all">All Status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="busy">Busy</option>
        </select>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <div style={{ color: '#10b981', fontSize: '24px', fontWeight: '700' }}>
            {loading ? '...' : drivers.filter(d => d.status === 'online').length}
          </div>
          <div style={{ color: '#64748b', fontSize: '14px' }}>Online Drivers</div>
        </div>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <div style={{ color: '#3b82f6', fontSize: '24px', fontWeight: '700' }}>
            {loading ? '...' : drivers.length}
          </div>
          <div style={{ color: '#64748b', fontSize: '14px' }}>Total Drivers</div>
        </div>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <div style={{ color: '#f59e0b', fontSize: '24px', fontWeight: '700' }}>
            {loading ? '...' : drivers.length > 0 ? (drivers.reduce((sum, d) => sum + d.rating, 0) / drivers.length).toFixed(1) : '0.0'}
          </div>
          <div style={{ color: '#64748b', fontSize: '14px' }}>Avg Rating</div>
        </div>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <div style={{ color: '#8b5cf6', fontSize: '24px', fontWeight: '700' }}>
            {loading ? '...' : drivers.length > 0 ? 
              `$${(drivers.reduce((sum, d) => sum + parseFloat(d.earnings.replace('$', '')), 0) / drivers.length).toFixed(0)}` : '$0'}
          </div>
          <div style={{ color: '#64748b', fontSize: '14px' }}>Avg Earnings</div>
        </div>
      </div>

      {/* Drivers Table */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Driver
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Status
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Rating
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Rides
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Earnings
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Vehicle
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredDrivers.map((driver) => (
                <tr key={driver.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        backgroundColor: '#e2e8f0',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#64748b'
                      }}>
                        {driver.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div style={{ fontWeight: '600', color: '#1e293b' }}>{driver.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{driver.id}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      backgroundColor: `${getStatusColor(driver.status)}20`,
                      color: getStatusColor(driver.status)
                    }}>
                      {getStatusIcon(driver.status)}
                      {driver.status.charAt(0).toUpperCase() + driver.status.slice(1)}
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Star size={14} fill="#f59e0b" color="#f59e0b" />
                      <span style={{ fontWeight: '600', color: '#1e293b' }}>{driver.rating}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px', fontWeight: '600', color: '#1e293b' }}>
                    {driver.totalRides.toLocaleString()}
                  </td>
                  <td style={{ padding: '16px', fontWeight: '600', color: '#10b981' }}>
                    {driver.earnings}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontSize: '14px', color: '#64748b' }}>
                      {driver.vehicleModel}
                    </div>
                  </td>
                  <td style={{ padding: '16px', position: 'relative' }}>
                    <button 
                      onClick={() => setActiveDropdown(activeDropdown === driver.id ? null : driver.id)}
                      style={{
                        padding: '8px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      <MoreVertical size={16} color="#64748b" />
                    </button>
                    
                    {activeDropdown === driver.id && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        right: '16px',
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                        zIndex: 1000,
                        minWidth: '200px'
                      }}>
                        <div style={{ padding: '8px 0' }}>
                          <button
                            onClick={() => handleDriverAction('view', driver)}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              textAlign: 'left',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              fontSize: '14px'
                            }}
                            onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#f8fafc'}
                            onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
                          >
                            <Eye size={16} color="#6b7280" />
                            View Profile
                          </button>
                          <button
                            onClick={() => handleDriverAction('edit', driver)}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              textAlign: 'left',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              fontSize: '14px'
                            }}
                            onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#f8fafc'}
                            onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
                          >
                            <Edit size={16} color="#6b7280" />
                            Edit Information
                          </button>
                          <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' }} />
                          {driver.status === 'online' ? (
                            <button
                              onClick={() => handleDriverAction('suspend', driver)}
                              style={{
                                width: '100%',
                                padding: '12px 16px',
                                border: 'none',
                                backgroundColor: 'transparent',
                                textAlign: 'left',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                fontSize: '14px',
                                color: '#f59e0b'
                              }}
                              onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#f8fafc'}
                              onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
                            >
                              <UserX size={16} />
                              Suspend Driver
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDriverAction('activate', driver)}
                              style={{
                                width: '100%',
                                padding: '12px 16px',
                                border: 'none',
                                backgroundColor: 'transparent',
                                textAlign: 'left',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                fontSize: '14px',
                                color: '#10b981'
                              }}
                              onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#f8fafc'}
                              onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
                            >
                              <UserCheck size={16} />
                              Activate Driver
                            </button>
                          )}
                          <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' }} />
                          <button
                            onClick={() => handleDriverAction('trips', driver)}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              textAlign: 'left',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              fontSize: '14px'
                            }}
                            onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#f8fafc'}
                            onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
                          >
                            <Car size={16} color="#6b7280" />
                            View Trip History
                          </button>
                          <button
                            onClick={() => handleDriverAction('earnings', driver)}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              textAlign: 'left',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              fontSize: '14px'
                            }}
                            onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#f8fafc'}
                            onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
                          >
                            <DollarSign size={16} color="#6b7280" />
                            Earnings Report
                          </button>
                          <button
                            onClick={() => handleDriverAction('analytics', driver)}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              textAlign: 'left',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              fontSize: '14px'
                            }}
                            onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#f8fafc'}
                            onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
                          >
                            <BarChart3 size={16} color="#6b7280" />
                            Performance Analytics
                          </button>
                          <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' }} />
                          <button
                            onClick={() => handleDriverAction('message', driver)}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              textAlign: 'left',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              fontSize: '14px'
                            }}
                            onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#f8fafc'}
                            onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
                          >
                            <MessageSquare size={16} color="#6b7280" />
                            Send Message
                          </button>
                          <button
                            onClick={() => handleDriverAction('reset-password', driver)}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              textAlign: 'left',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              fontSize: '14px'
                            }}
                            onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#f8fafc'}
                            onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
                          >
                            <Key size={16} color="#6b7280" />
                            Reset Password
                          </button>
                          <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' }} />
                          <button
                            onClick={() => handleDriverAction('deactivate', driver)}
                            style={{
                              width: '100%',
                              padding: '12px 16px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              textAlign: 'left',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              fontSize: '14px',
                              color: '#ef4444'
                            }}
                            onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#f8fafc'}
                            onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = 'transparent'}
                          >
                            <AlertTriangle size={16} />
                            Deactivate Driver
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Driver Enrollment Form Modal */}
      <DriverEnrollmentForm
        isOpen={showEnrollmentForm}
        onClose={() => setShowEnrollmentForm(false)}
        onSubmit={handleNewDriverSubmit}
      />

      {/* Driver Profile Modal */}
      {showDriverProfile && selectedDriver && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Driver Profile</h3>
              <button
                onClick={() => setShowDriverProfile(false)}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <h4 style={{ margin: '0 0 10px 0', color: '#374151' }}>Personal Information</h4>
                <p><strong>Name:</strong> {selectedDriver.name}</p>
                <p><strong>Email:</strong> {selectedDriver.email}</p>
                <p><strong>Phone:</strong> {selectedDriver.phone}</p>
                <p><strong>Status:</strong> 
                  <span style={{ 
                    color: getStatusColor(selectedDriver.status),
                    fontWeight: '600',
                    marginLeft: '8px'
                  }}>
                    {selectedDriver.status.charAt(0).toUpperCase() + selectedDriver.status.slice(1)}
                  </span>
                </p>
                <p><strong>Member Since:</strong> {new Date(selectedDriver.joinDate).toLocaleDateString()}</p>
              </div>
              
              <div>
                <h4 style={{ margin: '0 0 10px 0', color: '#374151' }}>Performance Metrics</h4>
                <p><strong>Rating:</strong> ⭐ {selectedDriver.rating}</p>
                <p><strong>Total Rides:</strong> {selectedDriver.totalRides.toLocaleString()}</p>
                <p><strong>Total Earnings:</strong> {selectedDriver.earnings}</p>
                <p><strong>Vehicle:</strong> {selectedDriver.vehicleModel}</p>
                <p><strong>Current Location:</strong> {selectedDriver.location}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Driver Modal */}
      {showEditDriver && selectedDriver && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Edit Driver Information</h3>
              <button
                onClick={() => setShowEditDriver(false)}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            
            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Full Name</label>
                <input 
                  type="text" 
                  defaultValue={selectedDriver.name}
                  style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Email</label>
                <input 
                  type="email" 
                  defaultValue={selectedDriver.email}
                  style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Phone</label>
                <input 
                  type="tel" 
                  defaultValue={selectedDriver.phone}
                  style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Vehicle Model</label>
                <input 
                  type="text" 
                  defaultValue={selectedDriver.vehicleModel}
                  style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                />
              </div>
              
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button
                  onClick={() => {
                    alert('Driver information updated successfully!');
                    setShowEditDriver(false);
                  }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setShowEditDriver(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trip History Modal */}
      {showTripHistory && selectedDriver && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '800px',
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Trip History - {selectedDriver.name}</h3>
              <button
                onClick={() => setShowTripHistory(false)}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f8fafc' }}>
                  <tr>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Date</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Route</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Fare</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { date: '2024-01-15', from: 'Downtown', to: 'Airport', fare: '$45.50', rating: 5 },
                    { date: '2024-01-15', from: 'Mall', to: 'Hospital', fare: '$28.75', rating: 4 },
                    { date: '2024-01-14', from: 'Hotel', to: 'Conference Center', fare: '$18.25', rating: 5 },
                    { date: '2024-01-14', from: 'Airport', to: 'Downtown', fare: '$52.00', rating: 5 },
                    { date: '2024-01-13', from: 'University', to: 'Shopping Center', fare: '$22.50', rating: 4 }
                  ].map((trip, index) => (
                    <tr key={index} style={{ borderTop: index > 0 ? '1px solid #f1f5f9' : 'none' }}>
                      <td style={{ padding: '12px', fontSize: '14px' }}>{trip.date}</td>
                      <td style={{ padding: '12px', fontSize: '14px' }}>{trip.from} → {trip.to}</td>
                      <td style={{ padding: '12px', fontSize: '14px', fontWeight: '600', color: '#10b981' }}>{trip.fare}</td>
                      <td style={{ padding: '12px', fontSize: '14px' }}>{'⭐'.repeat(trip.rating)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Send Message Modal */}
      {showSendMessage && selectedDriver && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Send Message to {selectedDriver.name}</h3>
              <button
                onClick={() => setShowSendMessage(false)}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            
            <div style={{ display: 'grid', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Subject</label>
                <input 
                  type="text" 
                  placeholder="Message subject"
                  style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Message</label>
                <textarea 
                  placeholder="Type your message here..."
                  rows={6}
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '6px',
                    resize: 'vertical'
                  }}
                />
              </div>
              
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button
                  onClick={() => {
                    alert('Message sent successfully!');
                    setShowSendMessage(false);
                  }}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Send Message
                </button>
                <button
                  onClick={() => setShowSendMessage(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <AlertTriangle size={48} color="#f59e0b" style={{ marginBottom: '16px' }} />
              <h3 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 8px 0' }}>
                Confirm {confirmAction.type.charAt(0).toUpperCase() + confirmAction.type.slice(1)}
              </h3>
              <p style={{ color: '#64748b', margin: 0 }}>
                Are you sure you want to {confirmAction.type} {confirmAction.driver.name}?
                {confirmAction.type === 'deactivate' && ' This action cannot be undone.'}
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => executeAction(confirmAction.type, confirmAction.driver)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: confirmAction.type === 'deactivate' ? '#ef4444' : '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {confirmAction.type === 'reset-password' ? 'Send Reset Email' : 
                 confirmAction.type.charAt(0).toUpperCase() + confirmAction.type.slice(1)}
              </button>
              <button
                onClick={() => setConfirmAction(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close dropdown */}
      {activeDropdown && (
        <div
          onClick={() => setActiveDropdown(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999
          }}
        />
      )}
    </div>
  );
};

export default DriverManagement;