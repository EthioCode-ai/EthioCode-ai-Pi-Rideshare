
import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Plus, 
  Edit3, 
  Trash2, 
  Globe, 
  Users, 
  Car, 
  DollarSign,
  Settings,
  Eye,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { marketService, Market } from '../utils/marketService';



const MarketManagement: React.FC = () => {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [showAddMarket, setShowAddMarket] = useState(false);
  const [showEditMarket, setShowEditMarket] = useState(false);
  const [showMarketDetails, setShowMarketDetails] = useState(false);

  useEffect(() => {
    loadMarkets();
  }, []);

  const loadMarkets = () => {
    // Load markets from shared service
    const allMarkets = marketService.getAllMarkets();
    setMarkets(allMarkets);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'pending': return '#f59e0b';
      case 'inactive': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle size={16} />;
      case 'pending': return <Clock size={16} />;
      case 'inactive': return <AlertCircle size={16} />;
      default: return <AlertCircle size={16} />;
    }
  };

  const handleAddMarket = (marketData: any) => {
    const newMarket: Market = {
      id: marketData.city.toLowerCase().replace(/\s+/g, ''),
      name: marketData.name,
      city: marketData.city,
      state: marketData.state,
      country: marketData.country,
      center: { lat: parseFloat(marketData.lat), lng: parseFloat(marketData.lng) },
      radius: parseInt(marketData.radius),
      zoom: 13, // Default zoom level
      timezone: marketData.timezone,
      currency: marketData.currency,
      status: 'pending',
      launchedAt: new Date().toISOString().split('T')[0],
      totalDrivers: 0,
      totalRiders: 0,
      monthlyRides: 0,
      monthlyRevenue: 0,
      config: {
        baseFare: parseFloat(marketData.baseFare),
        perMileFare: parseFloat(marketData.perMileFare),
        perMinuteFare: parseFloat(marketData.perMinuteFare),
        maxSurgeMultiplier: parseFloat(marketData.maxSurgeMultiplier),
        airportFee: parseFloat(marketData.airportFee),
        cancellationFee: parseFloat(marketData.cancellationFee)
      }
    };

    marketService.addMarket(newMarket);
    loadMarkets(); // Reload from service
    setShowAddMarket(false);
    alert(`Market "${newMarket.name}" added successfully!`);
  };

  const handleEditMarket = (marketData: any) => {
    if (!selectedMarket) return;

    marketService.updateMarket(selectedMarket.id, marketData);
    loadMarkets(); // Reload from service
    setShowEditMarket(false);
    setSelectedMarket(null);
    alert('Market updated successfully!');
  };

  const handleDeleteMarket = (marketId: string, marketName: string) => {
    if (confirm(`Are you sure you want to delete ${marketName}?`)) {
      marketService.deleteMarket(marketId);
      loadMarkets(); // Reload from service
      alert('Market deleted successfully!');
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '28px', fontWeight: '700', color: '#1e293b', margin: '0 0 8px 0' }}>
            Market Management
          </h2>
          <p style={{ fontSize: '16px', color: '#64748b', margin: 0 }}>
            Manage markets across multiple cities and regions
          </p>
        </div>
        <button 
          onClick={() => setShowAddMarket(true)}
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Plus size={16} />
          Add New Market
        </button>
      </div>

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <Globe size={24} color="#3b82f6" />
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', margin: 0 }}>
              Total Markets
            </h3>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#1e293b' }}>
            {markets.length}
          </div>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>
            {markets.filter(m => m.status === 'active').length} active
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <Users size={24} color="#10b981" />
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', margin: 0 }}>
              Total Users
            </h3>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#1e293b' }}>
            {markets.reduce((sum, market) => sum + market.totalDrivers + market.totalRiders, 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>
            Across all markets
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <Car size={24} color="#f59e0b" />
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', margin: 0 }}>
              Monthly Rides
            </h3>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#1e293b' }}>
            {markets.reduce((sum, market) => sum + market.monthlyRides, 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>
            This month
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <DollarSign size={24} color="#8b5cf6" />
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', margin: 0 }}>
              Monthly Revenue
            </h3>
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#1e293b' }}>
            ${markets.reduce((sum, market) => sum + market.monthlyRevenue, 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>
            This month
          </div>
        </div>
      </div>

      {/* Markets Table */}
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
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                  Market
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                  Status
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                  Drivers
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                  Riders
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                  Monthly Rides
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                  Revenue
                </th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {markets.map((market) => (
                <tr key={market.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '16px' }}>
                    <div>
                      <div style={{ fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>
                        {market.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={12} />
                        {market.city}, {market.state}
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
                      backgroundColor: `${getStatusColor(market.status)}20`,
                      color: getStatusColor(market.status)
                    }}>
                      {getStatusIcon(market.status)}
                      {market.status.charAt(0).toUpperCase() + market.status.slice(1)}
                    </div>
                  </td>
                  <td style={{ padding: '16px', fontWeight: '600', color: '#1e293b' }}>
                    {market.totalDrivers.toLocaleString()}
                  </td>
                  <td style={{ padding: '16px', fontWeight: '600', color: '#1e293b' }}>
                    {market.totalRiders.toLocaleString()}
                  </td>
                  <td style={{ padding: '16px', fontWeight: '600', color: '#1e293b' }}>
                    {market.monthlyRides.toLocaleString()}
                  </td>
                  <td style={{ padding: '16px', fontWeight: '600', color: '#10b981' }}>
                    ${market.monthlyRevenue.toLocaleString()}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => {
                          setSelectedMarket(market);
                          setShowMarketDetails(true);
                        }}
                        style={{
                          padding: '6px',
                          backgroundColor: '#f3f4f6',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                        title="View Details"
                      >
                        <Eye size={14} color="#374151" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedMarket(market);
                          setShowEditMarket(true);
                        }}
                        style={{
                          padding: '6px',
                          backgroundColor: '#f3f4f6',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                        title="Edit Market"
                      >
                        <Edit3 size={14} color="#374151" />
                      </button>
                      <button
                        onClick={() => handleDeleteMarket(market.id, market.name)}
                        style={{
                          padding: '6px',
                          backgroundColor: '#fef2f2',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                        title="Delete Market"
                      >
                        <Trash2 size={14} color="#ef4444" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Market Modal */}
      {showAddMarket && (
        <AddMarketModal
          onClose={() => setShowAddMarket(false)}
          onSubmit={handleAddMarket}
        />
      )}

      {/* Edit Market Modal */}
      {showEditMarket && selectedMarket && (
        <EditMarketModal
          market={selectedMarket}
          onClose={() => {
            setShowEditMarket(false);
            setSelectedMarket(null);
          }}
          onSubmit={handleEditMarket}
        />
      )}

      {/* Market Details Modal */}
      {showMarketDetails && selectedMarket && (
        <MarketDetailsModal
          market={selectedMarket}
          onClose={() => {
            setShowMarketDetails(false);
            setSelectedMarket(null);
          }}
        />
      )}
    </div>
  );
};

// Add Market Modal Component
const AddMarketModal: React.FC<{
  onClose: () => void;
  onSubmit: (data: any) => void;
}> = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: '',
    city: '',
    state: '',
    country: 'USA',
    lat: '',
    lng: '',
    radius: '25',
    timezone: 'America/Chicago',
    currency: 'USD',
    baseFare: '2.50',
    perMileFare: '1.25',
    perMinuteFare: '0.35',
    maxSurgeMultiplier: '2.5',
    airportFee: '3.50',
    cancellationFee: '5.00'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
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
          <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Add New Market</h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
        
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Market Name</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>City</label>
              <input 
                type="text" 
                value={formData.city}
                onChange={(e) => setFormData({...formData, city: e.target.value})}
                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>State/Province</label>
              <input 
                type="text" 
                value={formData.state}
                onChange={(e) => setFormData({...formData, state: e.target.value})}
                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Country</label>
              <select 
                value={formData.country}
                onChange={(e) => setFormData({...formData, country: e.target.value})}
                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
              >
                <option value="USA">United States</option>
                <option value="CAN">Canada</option>
                <option value="MEX">Mexico</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Service Radius (km)</label>
              <input 
                type="number" 
                value={formData.radius}
                onChange={(e) => setFormData({...formData, radius: e.target.value})}
                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                min="5"
                max="100"
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Latitude</label>
              <input 
                type="number" 
                step="any"
                value={formData.lat}
                onChange={(e) => setFormData({...formData, lat: e.target.value})}
                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Longitude</label>
              <input 
                type="number" 
                step="any"
                value={formData.lng}
                onChange={(e) => setFormData({...formData, lng: e.target.value})}
                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Timezone</label>
              <select 
                value={formData.timezone}
                onChange={(e) => setFormData({...formData, timezone: e.target.value})}
                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
              >
                <option value="America/Chicago">Central Time</option>
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="America/Denver">Mountain Time</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Currency</label>
              <select 
                value={formData.currency}
                onChange={(e) => setFormData({...formData, currency: e.target.value})}
                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
              >
                <option value="USD">USD ($)</option>
                <option value="CAD">CAD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
          </div>

          <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', margin: '16px 0 8px 0' }}>
            Pricing Configuration
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Base Fare ($)</label>
              <input 
                type="number" 
                step="0.25"
                value={formData.baseFare}
                onChange={(e) => setFormData({...formData, baseFare: e.target.value})}
                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Per Mile ($)</label>
              <input 
                type="number" 
                step="0.05"
                value={formData.perMileFare}
                onChange={(e) => setFormData({...formData, perMileFare: e.target.value})}
                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Per Minute ($)</label>
              <input 
                type="number" 
                step="0.05"
                value={formData.perMinuteFare}
                onChange={(e) => setFormData({...formData, perMinuteFare: e.target.value})}
                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Max Surge Multiplier</label>
              <input 
                type="number" 
                step="0.1"
                value={formData.maxSurgeMultiplier}
                onChange={(e) => setFormData({...formData, maxSurgeMultiplier: e.target.value})}
                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                min="1.0"
                max="5.0"
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Airport Fee ($)</label>
              <input 
                type="number" 
                step="0.50"
                value={formData.airportFee}
                onChange={(e) => setFormData({...formData, airportFee: e.target.value})}
                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Cancellation Fee ($)</label>
              <input 
                type="number" 
                step="0.50"
                value={formData.cancellationFee}
                onChange={(e) => setFormData({...formData, cancellationFee: e.target.value})}
                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                required
              />
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button
              type="submit"
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
              Create Market
            </button>
            <button
              type="button"
              onClick={onClose}
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
        </form>
      </div>
    </div>
  );
};

// Edit Market Modal Component (similar structure to Add)
const EditMarketModal: React.FC<{
  market: Market;
  onClose: () => void;
  onSubmit: (data: any) => void;
}> = ({ market, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: market.name,
    city: market.city,
    state: market.state,
    country: market.country,
    lat: market.center.lat.toString(),
    lng: market.center.lng.toString(),
    radius: market.radius.toString(),
    timezone: market.timezone,
    currency: market.currency,
    status: market.status,
    baseFare: market.config.baseFare.toString(),
    perMileFare: market.config.perMileFare.toString(),
    perMinuteFare: market.config.perMinuteFare.toString(),
    maxSurgeMultiplier: market.config.maxSurgeMultiplier.toString(),
    airportFee: market.config.airportFee.toString(),
    cancellationFee: market.config.cancellationFee.toString()
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedData = {
      ...formData,
      center: { lat: parseFloat(formData.lat), lng: parseFloat(formData.lng) },
      radius: parseInt(formData.radius),
      config: {
        baseFare: parseFloat(formData.baseFare),
        perMileFare: parseFloat(formData.perMileFare),
        perMinuteFare: parseFloat(formData.perMinuteFare),
        maxSurgeMultiplier: parseFloat(formData.maxSurgeMultiplier),
        airportFee: parseFloat(formData.airportFee),
        cancellationFee: parseFloat(formData.cancellationFee)
      }
    };
    onSubmit(updatedData);
  };

  return (
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
          <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Edit Market: {market.name}</h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
        
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
          {/* Status Field */}
          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Market Status</label>
            <select 
              value={formData.status}
              onChange={(e) => setFormData({...formData, status: e.target.value as any})}
              style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
            >
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Same form fields as Add Market Modal, but pre-populated */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Market Name</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Service Radius (km)</label>
              <input 
                type="number" 
                value={formData.radius}
                onChange={(e) => setFormData({...formData, radius: e.target.value})}
                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                min="5"
                max="100"
                required
              />
            </div>
          </div>

          <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#374151', margin: '16px 0 8px 0' }}>
            Pricing Configuration
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Base Fare ($)</label>
              <input 
                type="number" 
                step="0.25"
                value={formData.baseFare}
                onChange={(e) => setFormData({...formData, baseFare: e.target.value})}
                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Per Mile ($)</label>
              <input 
                type="number" 
                step="0.05"
                value={formData.perMileFare}
                onChange={(e) => setFormData({...formData, perMileFare: e.target.value})}
                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '4px' }}>Per Minute ($)</label>
              <input 
                type="number" 
                step="0.05"
                value={formData.perMinuteFare}
                onChange={(e) => setFormData({...formData, perMinuteFare: e.target.value})}
                style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                required
              />
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <button
              type="submit"
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
              Update Market
            </button>
            <button
              type="button"
              onClick={onClose}
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
        </form>
      </div>
    </div>
  );
};

// Market Details Modal Component
const MarketDetailsModal: React.FC<{
  market: Market;
  onClose: () => void;
}> = ({ market, onClose }) => {
  return (
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
        maxWidth: '700px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Market Details: {market.name}</h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <h4 style={{ margin: '0 0 10px 0', color: '#374151' }}>Market Information</h4>
            <p><strong>Location:</strong> {market.city}, {market.state}, {market.country}</p>
            <p><strong>Service Radius:</strong> {market.radius} km</p>
            <p><strong>Timezone:</strong> {market.timezone}</p>
            <p><strong>Currency:</strong> {market.currency}</p>
            <p><strong>Launched:</strong> {new Date(market.launchedAt).toLocaleDateString()}</p>
            <p><strong>Status:</strong> 
              <span style={{ 
                color: getStatusColor(market.status),
                fontWeight: '600',
                marginLeft: '8px'
              }}>
                {market.status.charAt(0).toUpperCase() + market.status.slice(1)}
              </span>
            </p>
          </div>
          
          <div>
            <h4 style={{ margin: '0 0 10px 0', color: '#374151' }}>Performance Metrics</h4>
            <p><strong>Total Drivers:</strong> {market.totalDrivers.toLocaleString()}</p>
            <p><strong>Total Riders:</strong> {market.totalRiders.toLocaleString()}</p>
            <p><strong>Monthly Rides:</strong> {market.monthlyRides.toLocaleString()}</p>
            <p><strong>Monthly Revenue:</strong> ${market.monthlyRevenue.toLocaleString()}</p>
            <p><strong>Avg Revenue per Ride:</strong> ${(market.monthlyRevenue / market.monthlyRides).toFixed(2)}</p>
          </div>
        </div>

        <div style={{ marginTop: '20px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#374151' }}>Pricing Configuration</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Base Fare</div>
              <div style={{ fontSize: '18px', fontWeight: '600' }}>${market.config.baseFare}</div>
            </div>
            <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Per Mile</div>
              <div style={{ fontSize: '18px', fontWeight: '600' }}>${market.config.perMileFare}</div>
            </div>
            <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Per Minute</div>
              <div style={{ fontSize: '18px', fontWeight: '600' }}>${market.config.perMinuteFare}</div>
            </div>
            <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Max Surge</div>
              <div style={{ fontSize: '18px', fontWeight: '600' }}>{market.config.maxSurgeMultiplier}x</div>
            </div>
            <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Airport Fee</div>
              <div style={{ fontSize: '18px', fontWeight: '600' }}>${market.config.airportFee}</div>
            </div>
            <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: '#64748b' }}>Cancellation Fee</div>
              <div style={{ fontSize: '18px', fontWeight: '600' }}>${market.config.cancellationFee}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketManagement;
