
import React, { useState } from 'react';
import { 
  MapPin, 
  Clock, 
  Car,
  User,
  Phone,
  MessageCircle,
  Navigation,
  AlertCircle,
  CheckCircle,
  Play
} from 'lucide-react';
import { apiUrl } from '../config/api.config';

const Dispatch: React.FC = () => {
  const [selectedRide, setSelectedRide] = useState<number | null>(null);

  // Real rides data from database
  const [activeRides, setActiveRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch real rides from database
  React.useEffect(() => {
    const fetchRides = async () => {
      try {
        console.log('🚗 DISPATCH: Starting to fetch rides...');
        
        const token = localStorage.getItem('authToken');
        const response = await fetch(apiUrl('api/admin/rides'), {
        method: 'GET',
        headers: {
        'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });
        
        console.log('🚗 DISPATCH: Response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('🚗 DISPATCH: API error:', response.status, errorText);
          setActiveRides([]); // Clear any existing data
          return;
        }

        const data = await response.json();
        console.log('🚗 DISPATCH: Raw API data:', data);
        
        if (data.success && data.rides) {
          // Transform API data for dispatch view
          const transformedRides = data.rides.map((ride: any, index: number) => ({
            id: ride.id, // Use actual ride ID instead of index
            riderId: ride.rider_id,
            riderName: ride.rider_name,
            driverId: ride.driver_id,
            driverName: ride.driver_name === 'Unassigned' ? null : ride.driver_name,
            status: ride.status === 'requested' ? 'pending' : 
                   ride.status === 'accepted' ? 'pickup' : 
                   ride.status === 'started' ? 'in_progress' : ride.status,
            pickup: ride.pickup_address,
            dropoff: ride.destination_address,
            estimatedTime: ride.status === 'requested' ? 'Finding driver...' : '12 min',
            fare: ride.final_fare ? `$${parseFloat(ride.final_fare).toFixed(2)}` :
                   (ride.estimated_fare ? `~$${parseFloat(ride.estimated_fare).toFixed(2)}` : 'Calculating...'),
            distance: '4.2 miles'
          }));
          
          console.log('🚗 DISPATCH: Transformed rides:', transformedRides);
          console.log('🚗 DISPATCH: Rider names:', transformedRides.map(r => r.riderName));
          
          setActiveRides(transformedRides);
        } else {
          console.error('🚗 DISPATCH: Invalid data structure:', data);
          setActiveRides([]);
        }
      } catch (error) {
        console.error('🚗 DISPATCH: Network error:', error);
        setActiveRides([]); // Clear any existing data on error
      } finally {
        setLoading(false);
      }
    };

    fetchRides();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'pickup': return '#3b82f6';
      case 'in_progress': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock size={16} />;
      case 'pickup': return <Car size={16} />;
      case 'in_progress': return <Play size={16} />;
      default: return <AlertCircle size={16} />;
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b', margin: '0 0 8px 0' }}>
            Live Dispatch Center
          </h2>
          <p style={{ fontSize: '16px', color: '#64748b', margin: 0 }}>
            Monitor and manage active rides in real-time
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button style={{
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <CheckCircle size={16} />
            Auto-Dispatch: ON
          </button>
        </div>
      </div>

      {/* Live Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <div style={{ color: '#f59e0b', fontSize: '24px', fontWeight: '700' }}>
            {loading ? '...' : activeRides.filter(r => r.status === 'pending').length}
          </div>
          <div style={{ color: '#64748b', fontSize: '14px' }}>Pending Requests</div>
        </div>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <div style={{ color: '#3b82f6', fontSize: '24px', fontWeight: '700' }}>
            {loading ? '...' : activeRides.filter(r => r.status === 'pickup').length}
          </div>
          <div style={{ color: '#64748b', fontSize: '14px' }}>En Route to Pickup</div>
        </div>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <div style={{ color: '#10b981', fontSize: '24px', fontWeight: '700' }}>
            {loading ? '...' : activeRides.filter(r => r.status === 'in_progress').length}
          </div>
          <div style={{ color: '#64748b', fontSize: '14px' }}>Active Rides</div>
        </div>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <div style={{ color: '#8b5cf6', fontSize: '24px', fontWeight: '700' }}>
            {loading ? '...' : '3'}
          </div>
          <div style={{ color: '#64748b', fontSize: '14px' }}>Available Drivers</div>
        </div>
      </div>

      {/* Active Rides Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Rides List */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '20px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
              Active Rides
            </h3>
          </div>
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {loading && (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                Loading real rides...
              </div>
            )}
            {!loading && activeRides.length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                No active rides at the moment
              </div>
            )}
            {activeRides.map((ride) => (
              <div
                key={ride.id}
                onClick={() => setSelectedRide(ride.id)}
                style={{
                  padding: '20px',
                  borderBottom: '1px solid #f1f5f9',
                  cursor: 'pointer',
                  backgroundColor: selectedRide === ride.id ? '#eff6ff' : 'white',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (selectedRide !== ride.id) {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedRide !== ride.id) {
                    e.currentTarget.style.backgroundColor = 'white';
                  }
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: '700', color: '#3b82f6' }}>#{ride.id.toString().padStart(4, '0')}</span>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '600',
                      backgroundColor: `${getStatusColor(ride.status)}20`,
                      color: getStatusColor(ride.status)
                    }}>
                      {getStatusIcon(ride.status)}
                      {ride.status.replace('_', ' ').charAt(0).toUpperCase() + ride.status.replace('_', ' ').slice(1)}
                    </div>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#10b981' }}>
                    {ride.fare}
                  </div>
                </div>

                <div style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <User size={14} color="#64748b" />
                    <span style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>
                      {ride.riderName}
                    </span>
                  </div>
                  {ride.driverName && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Car size={14} color="#64748b" />
                      <span style={{ fontSize: '14px', color: '#64748b' }}>
                        {ride.driverName}
                      </span>
                    </div>
                  )}
                </div>

                <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.4' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '4px' }}>
                    <MapPin size={12} color="#10b981" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <span>{ride.pickup}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <Navigation size={12} color="#ef4444" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <span>{ride.dropoff}</span>
                  </div>
                </div>

                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginTop: '12px',
                  paddingTop: '12px',
                  borderTop: '1px solid #f1f5f9'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={12} color="#64748b" />
                    <span style={{ fontSize: '12px', color: '#64748b' }}>{ride.estimatedTime}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    {ride.distance}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ride Details */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          border: '1px solid #e2e8f0'
        }}>
          {selectedRide ? (
            <div>
              <div style={{
                padding: '20px',
                borderBottom: '1px solid #e2e8f0',
                backgroundColor: '#f8fafc'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
                    Ride Details #{selectedRide.toString().padStart(4, '0')}
                  </h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button style={{
                      padding: '8px 12px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Phone size={12} />
                      Call
                    </button>
                    <button style={{
                      padding: '8px 12px',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <MessageCircle size={12} />
                      Message
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ padding: '20px' }}>
                {(() => {
                  const ride = activeRides.find(r => r.id === selectedRide);
                  if (!ride) return null;
                  
                  return (
                    <div>
                      <div style={{ marginBottom: '24px' }}>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          backgroundColor: `${getStatusColor(ride.status)}20`,
                          color: getStatusColor(ride.status),
                          marginBottom: '16px'
                        }}>
                          {getStatusIcon(ride.status)}
                          {ride.status.replace('_', ' ').charAt(0).toUpperCase() + ride.status.replace('_', ' ').slice(1)}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                          <div>
                            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>
                              RIDER
                            </div>
                            <div style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                              {ride.riderName}
                            </div>
                            <div style={{ fontSize: '14px', color: '#64748b' }}>
                              ID: {ride.riderId}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>
                              DRIVER
                            </div>
                            <div style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b' }}>
                              {ride.driverName || 'Searching...'}
                            </div>
                            <div style={{ fontSize: '14px', color: '#64748b' }}>
                              {ride.driverId ? `ID: ${ride.driverId}` : 'No driver assigned'}
                            </div>
                          </div>
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '8px' }}>
                            ROUTE
                          </div>
                          <div style={{ marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                              <MapPin size={16} color="#10b981" style={{ marginTop: '2px', flexShrink: 0 }} />
                              <div>
                                <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b', marginBottom: '2px' }}>
                                  Pickup Location
                                </div>
                                <div style={{ fontSize: '13px', color: '#64748b' }}>
                                  {ride.pickup}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                              <Navigation size={16} color="#ef4444" style={{ marginTop: '2px', flexShrink: 0 }} />
                              <div>
                                <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b', marginBottom: '2px' }}>
                                  Dropoff Location
                                </div>
                                <div style={{ fontSize: '13px', color: '#64748b' }}>
                                  {ride.dropoff}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '18px', fontWeight: '700', color: '#10b981' }}>
                              {ride.fare}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>Fare</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '18px', fontWeight: '700', color: '#3b82f6' }}>
                              {ride.distance}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>Distance</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '18px', fontWeight: '700', color: '#f59e0b' }}>
                              {ride.estimatedTime}
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>ETA</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div style={{
              padding: '60px 20px',
              textAlign: 'center',
              color: '#64748b'
            }}>
              <Car size={48} color="#e2e8f0" style={{ marginBottom: '16px' }} />
              <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '4px' }}>
                Select a ride to view details
              </div>
              <div style={{ fontSize: '14px' }}>
                Click on any active ride to see detailed information
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dispatch;
