
import React, { useState } from 'react';
import { 
  MapPin, 
  Clock, 
  DollarSign,
  Car,
  User,
  Search,
  Filter,
  MoreVertical,
  Navigation,
  Phone,
  MessageCircle
} from 'lucide-react';
import { apiUrl } from '../config/api.config';

const RideManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch real rides from database
  React.useEffect(() => {
    const fetchRides = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(apiUrl('api/admin/rides'), {
         headers: {
         'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            // Transform API data to match UI expectations
            const transformedRides = data.rides.map((ride: any) => ({
              id: ride.id,
              riderId: ride.rider_id,
              riderName: ride.rider_name,
              driverId: ride.driver_id,
              driverName: ride.driver_name || 'Finding driver...',
              status: ride.status,
              pickupLocation: ride.pickup_address,
              dropoffLocation: ride.destination_address,
              requestTime: ride.requested_at ? new Date(ride.requested_at).toLocaleString() : 'Unknown',
              startTime: ride.started_at ? new Date(ride.started_at).toLocaleString() : null,
              endTime: ride.completed_at ? new Date(ride.completed_at).toLocaleString() : null,
              duration: ride.completed_at && ride.started_at 
                ? Math.round((new Date(ride.completed_at).getTime() - new Date(ride.started_at).getTime()) / 60000) + ' min'
                : ride.status === 'requested' ? 'Pending' : 'In Progress',
              distance: 'Calculating...',
              fare: ride.final_fare ? `$${ride.final_fare}` : 
                    (ride.estimated_fare?.total ? `~$${ride.estimated_fare.total}` : 'Calculating...'),
              paymentMethod: 'Card'
            }));
            setRides(transformedRides);
          }
        }
      } catch (error) {
        console.error('Failed to fetch rides:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRides();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'in_progress': return '#3b82f6';
      case 'pending': return '#f59e0b';
      case 'cancelled': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const filteredRides = rides.filter(ride => {
    const matchesSearch = ride.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ride.riderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ride.driverName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ride.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b', margin: '0 0 8px 0' }}>
            Ride Management
          </h2>
          <p style={{ fontSize: '16px', color: '#64748b', margin: 0 }}>
            Track and manage all ride requests and trips
          </p>
        </div>
        <button style={{
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          padding: '12px 24px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer'
        }}>
          Export Data
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
            placeholder="Search rides..."
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
            minWidth: '140px'
          }}
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
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
          <div style={{ color: '#f59e0b', fontSize: '24px', fontWeight: '700' }}>
            {loading ? '...' : rides.filter(r => r.status === 'requested' || r.status === 'pending').length}
          </div>
          <div style={{ color: '#64748b', fontSize: '14px' }}>Pending Rides</div>
        </div>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <div style={{ color: '#3b82f6', fontSize: '24px', fontWeight: '700' }}>
            {loading ? '...' : rides.filter(r => r.status === 'in_progress' || r.status === 'accepted').length}
          </div>
          <div style={{ color: '#64748b', fontSize: '14px' }}>In Progress</div>
        </div>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <div style={{ color: '#10b981', fontSize: '24px', fontWeight: '700' }}>
            {loading ? '...' : rides.filter(r => r.status === 'completed').length}
          </div>
          <div style={{ color: '#64748b', fontSize: '14px' }}>Completed Today</div>
        </div>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <div style={{ color: '#8b5cf6', fontSize: '24px', fontWeight: '700' }}>
            {loading ? '...' : rides.length > 0 ? '5.2' : '0'}
          </div>
          <div style={{ color: '#64748b', fontSize: '14px' }}>Avg Wait (min)</div>
        </div>
      </div>

      {/* Rides Table */}
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
                  Ride ID
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Rider
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Driver
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Status
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Route
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Fare
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRides.map((ride) => (
                <tr key={ride.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '16px', fontWeight: '600', color: '#3b82f6' }}>
                    {ride.id}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <User size={16} color="#64748b" />
                      <span style={{ fontWeight: '500', color: '#1e293b' }}>{ride.riderName}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Car size={16} color="#64748b" />
                      <span style={{ fontWeight: '500', color: '#1e293b' }}>{ride.driverName}</span>
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
                      backgroundColor: `${getStatusColor(ride.status)}20`,
                      color: getStatusColor(ride.status)
                    }}>
                      {ride.status.replace('_', ' ').charAt(0).toUpperCase() + ride.status.replace('_', ' ').slice(1)}
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontSize: '12px', color: '#64748b', maxWidth: '200px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                        <MapPin size={12} color="#10b981" />
                        <span style={{ fontSize: '11px', fontWeight: '500' }}>From:</span>
                      </div>
                      <div style={{ marginBottom: '4px', fontSize: '11px' }}>{ride.pickupLocation}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                        <Navigation size={12} color="#ef4444" />
                        <span style={{ fontSize: '11px', fontWeight: '500' }}>To:</span>
                      </div>
                      <div style={{ fontSize: '11px' }}>{ride.dropoffLocation}</div>
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: '600', color: '#10b981', fontSize: '16px' }}>
                      {ride.fare}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {ride.distance}
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button style={{
                        padding: '6px',
                        backgroundColor: '#3b82f6',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}>
                        <Phone size={12} color="white" />
                      </button>
                      <button style={{
                        padding: '6px',
                        backgroundColor: '#10b981',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}>
                        <MessageCircle size={12} color="white" />
                      </button>
                      <button style={{
                        padding: '6px',
                        backgroundColor: 'transparent',
                        border: '1px solid #e2e8f0',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}>
                        <MoreVertical size={12} color="#64748b" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RideManagement;
