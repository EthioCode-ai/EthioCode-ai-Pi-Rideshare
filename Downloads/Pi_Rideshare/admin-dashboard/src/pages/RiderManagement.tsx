
import React, { useState } from 'react';
import { 
  User, 
  MapPin, 
  Star, 
  Phone, 
  Mail,
  Calendar,
  Search,
  Filter,
  MoreVertical,
  CreditCard,
  Clock,
  TrendingUp
} from 'lucide-react';
import { apiUrl } from '../config/api.config';

const RiderManagement: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riders, setRiders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch real riders from database
  React.useEffect(() => {
    const fetchRiders = async () => {
      try {
        console.log('🚶 Fetching riders from API...');
        const token = localStorage.getItem('authToken');
        const response = await fetch(apiUrl('api/admin/riders'), {
         headers: {
        'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('🚶 Response status:', response.status, response.statusText);
        
        if (response.ok) {
          const data = await response.json();
          console.log('🚶 API response data:', data);
          
          // Handle both array and object responses
          const ridersList = Array.isArray(data) ? data : (data.riders || []);
          console.log('🚶 Riders list extracted:', ridersList);
          
          if (ridersList.length > 0) {
            // Transform API data to match UI expectations
            const transformedRiders = ridersList.map((rider: any) => ({
              id: rider.id,
              name: rider.name,
              email: rider.email,
              phone: rider.phone || 'N/A',
              status: rider.status || 'inactive', // Use actual status from API
              rating: parseFloat(rider.rating) || 5.0,
              totalRides: rider.total_rides || 0,
              totalSpent: rider.total_spent ? `$${parseFloat(rider.total_spent).toFixed(2)}` : '$0.00',
              joinDate: rider.created_at ? new Date(rider.created_at).toLocaleDateString() : 'Unknown',
              lastRide: rider.last_ride ? new Date(rider.last_ride).toLocaleDateString() : 'Never',
              favoriteLocation: 'Various Locations'
            }));
            console.log('🚶 Transformed riders:', transformedRiders);
            setRiders(transformedRiders);
          } else {
            console.log('🚶 No riders found in response');
          }
        } else {
          console.error('🚶 API error:', response.status, await response.text());
        }
      } catch (error) {
        console.error('🚶 Failed to fetch riders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRiders();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'inactive': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const filteredRiders = riders.filter(rider => {
    const matchesSearch = rider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         rider.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || rider.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b', margin: '0 0 8px 0' }}>
            Rider Management
          </h2>
          <p style={{ fontSize: '16px', color: '#64748b', margin: 0 }}>
            Monitor rider activity and engagement
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
          Send Promotion
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
            placeholder="Search riders..."
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
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
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
          <div style={{ color: '#3b82f6', fontSize: '24px', fontWeight: '700' }}>
            {loading ? '...' : riders.length.toLocaleString()}
          </div>
          <div style={{ color: '#64748b', fontSize: '14px' }}>Total Riders</div>
        </div>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <div style={{ color: '#10b981', fontSize: '24px', fontWeight: '700' }}>
            {loading ? '...' : riders.filter(r => r.status === 'active').length}
          </div>
          <div style={{ color: '#64748b', fontSize: '14px' }}>Active This Week</div>
        </div>
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <div style={{ color: '#f59e0b', fontSize: '24px', fontWeight: '700' }}>
            {loading ? '...' : riders.length > 0 ? (riders.reduce((sum, r) => sum + r.rating, 0) / riders.length).toFixed(1) : '0.0'}
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
            {loading ? '...' : riders.length > 0 ? 
              `$${(riders.reduce((sum, r) => sum + parseFloat(r.totalSpent.replace('$', '')), 0) / riders.length).toFixed(0)}` : '$0'}
          </div>
          <div style={{ color: '#64748b', fontSize: '14px' }}>Avg Spend</div>
        </div>
      </div>

      {/* Riders Table */}
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
                  Rider
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Status
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Rating
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Rides
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Spent
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Last Ride
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRiders.map((rider) => (
                <tr key={rider.id} style={{ borderTop: '1px solid #f1f5f9' }}>
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
                        {rider.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div style={{ fontWeight: '600', color: '#1e293b' }}>{rider.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{rider.email}</div>
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
                      backgroundColor: `${getStatusColor(rider.status)}20`,
                      color: getStatusColor(rider.status)
                    }}>
                      {rider.status.charAt(0).toUpperCase() + rider.status.slice(1)}
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Star size={14} fill="#f59e0b" color="#f59e0b" />
                      <span style={{ fontWeight: '600', color: '#1e293b' }}>{rider.rating}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px', fontWeight: '600', color: '#1e293b' }}>
                    {rider.totalRides}
                  </td>
                  <td style={{ padding: '16px', fontWeight: '600', color: '#10b981' }}>
                    {rider.totalSpent}
                  </td>
                  <td style={{ padding: '16px', fontSize: '14px', color: '#64748b' }}>
                    {rider.lastRide}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <button style={{
                      padding: '8px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}>
                      <MoreVertical size={16} color="#64748b" />
                    </button>
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

export default RiderManagement;
