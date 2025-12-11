
import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  MapPin, 
  Star, 
  Download, 
  Car,
  CreditCard,
  Calendar,
  DollarSign
} from 'lucide-react';

interface RideHistoryItem {
  id: string;
  pickup: { lat: number; lng: number; address: string };
  destination: { lat: number; lng: number; address: string };
  driver: {
    name: string;
    rating: number;
    vehicle: { model: string; color: string; licensePlate: string };
  };
  fare: {
    total: number;
    baseFare: number;
    distanceFare: number;
    timeFare: number;
    surgePricing: number;
    distance: number;
    estimatedTime: number;
  };
  paymentMethod: {
    name: string;
    icon: string;
  };
  bookedAt: Date;
  completedAt: Date;
  finalFare: number;
  tip?: number;
  rating?: number;
}

const RideHistory: React.FC = () => {
  const [rideHistory, setRideHistory] = useState<RideHistoryItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'this-week' | 'this-month'>('all');

  useEffect(() => {
    loadRideHistory();
  }, []);

  const loadRideHistory = () => {
    const history = JSON.parse(localStorage.getItem('ride_history') || '[]');
    // Convert date strings back to Date objects
    const processedHistory = history.map((ride: any) => ({
      ...ride,
      bookedAt: new Date(ride.bookedAt),
      completedAt: new Date(ride.completedAt)
    }));
    setRideHistory(processedHistory);
  };

  const filteredRides = rideHistory.filter(ride => {
    const now = new Date();
    const rideDate = ride.completedAt;
    
    switch (filter) {
      case 'this-week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return rideDate >= weekAgo;
      case 'this-month':
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return rideDate >= monthAgo;
      default:
        return true;
    }
  });

  const totalSpent = filteredRides.reduce((sum, ride) => sum + ride.finalFare, 0);
  const totalRides = filteredRides.length;

  const downloadReceipt = (ride: RideHistoryItem) => {
    // In a real app, this would generate a PDF receipt
    alert(`Receipt for ride ${ride.id} would be downloaded`);
  };

  const rateRide = (rideId: string, rating: number) => {
    const updatedHistory = rideHistory.map(ride => 
      ride.id === rideId ? { ...ride, rating } : ride
    );
    setRideHistory(updatedHistory);
    localStorage.setItem('ride_history', JSON.stringify(updatedHistory));
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        background: 'white',
        padding: '20px',
        borderBottom: '1px solid #e2e8f0'
      }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>
          Ride History
        </h1>
        
        {/* Summary Stats */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          <div style={{
            background: '#eff6ff',
            padding: '16px',
            borderRadius: '12px',
            flex: 1,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#3b82f6' }}>
              {totalRides}
            </div>
            <div style={{ fontSize: '14px', color: '#64748b' }}>Total Rides</div>
          </div>
          <div style={{
            background: '#f0fdf4',
            padding: '16px',
            borderRadius: '12px',
            flex: 1,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#10b981' }}>
              ${totalSpent.toFixed(2)}
            </div>
            <div style={{ fontSize: '14px', color: '#64748b' }}>Total Spent</div>
          </div>
        </div>

        {/* Filter Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { key: 'all', label: 'All Time' },
            { key: 'this-week', label: 'This Week' },
            { key: 'this-month', label: 'This Month' }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key as any)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: filter === key ? '#3b82f6' : '#f1f5f9',
                color: filter === key ? 'white' : '#64748b',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Ride List */}
      <div style={{ padding: '20px' }}>
        {filteredRides.length === 0 ? (
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '40px',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <Car size={48} color="#d1d5db" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
              No rides found
            </h3>
            <p style={{ fontSize: '14px', color: '#6b7280' }}>
              Your completed rides will appear here
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredRides.map((ride) => (
              <div
                key={ride.id}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}
              >
                {/* Ride Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px'
                }}>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: '600', color: '#1e293b' }}>
                      ${ride.finalFare.toFixed(2)}
                    </div>
                    <div style={{ fontSize: '14px', color: '#64748b' }}>
                      {ride.completedAt.toLocaleDateString()} at {ride.completedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <button
                    onClick={() => downloadReceipt(ride)}
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '14px',
                      color: '#374151'
                    }}
                  >
                    <Download size={16} />
                    Receipt
                  </button>
                </div>

                {/* Driver Info */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: '600'
                  }}>
                    {ride.driver.name[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', color: '#1e293b' }}>
                      {ride.driver.name}
                    </div>
                    <div style={{ fontSize: '14px', color: '#64748b' }}>
                      {ride.driver.vehicle.color} {ride.driver.vehicle.model}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Star size={16} color="#f59e0b" fill="#f59e0b" />
                    <span style={{ fontSize: '14px', fontWeight: '500' }}>
                      {ride.driver.rating}
                    </span>
                  </div>
                </div>

                {/* Route Info */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '4px'
                  }}>
                    <MapPin size={14} color="#10b981" />
                    <span style={{ fontSize: '14px', color: '#64748b' }}>From:</span>
                    <span style={{ fontSize: '14px' }}>{ride.pickup.address}</span>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <MapPin size={14} color="#ef4444" />
                    <span style={{ fontSize: '14px', color: '#64748b' }}>To:</span>
                    <span style={{ fontSize: '14px' }}>{ride.destination.address}</span>
                  </div>
                </div>

                {/* Payment Info */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '16px',
                  borderTop: '1px solid #e5e7eb'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>{ride.paymentMethod.icon}</span>
                    <span style={{ fontSize: '14px', color: '#64748b' }}>
                      Paid with {ride.paymentMethod.name}
                    </span>
                  </div>
                  
                  {/* Rating */}
                  {!ride.rating && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '14px', color: '#64748b' }}>Rate:</span>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => rateRide(ride.id, star)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '2px'
                          }}
                        >
                          <Star size={16} color="#d1d5db" />
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {ride.rating && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '14px', color: '#64748b' }}>Your rating:</span>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={14}
                            color="#f59e0b"
                            fill={star <= ride.rating! ? "#f59e0b" : "none"}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RideHistory;
