import React, { useState, useEffect } from 'react';
import { MapPin, Clock, Users, DollarSign, Plane, RefreshCw } from 'lucide-react';
import { apiUrl } from '../config/api.config';

interface QueuedDriver {
  position: number;
  joinedAt: string;
  waitTime: number;
  driverId?: string;
  driverName?: string;
  vehicleType?: string;
}

interface Airport {
  code: string;
  name: string;
  queueLength: number;
  estimatedWaitTime: number;
  waitingLotName?: string;
  drivers: QueuedDriver[];
}

interface AirportLot {
  id: string;
  airportCode: string;
  airportName: string;
  lat: number;
  lng: number;
  name: string;
  queueSize: number;
}

const AirportQueue: React.FC = () => {
  const [airports, setAirports] = useState<Airport[]>([]);
  const [airportLots, setAirportLots] = useState<AirportLot[]>([]);
  const [selectedAirport, setSelectedAirport] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch airports and queue data from API
  const fetchAirportData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('authToken');

      // Fetch queue data
      const queuesResponse = await fetch(apiUrl('api/airports/queues'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (queuesResponse.ok) {
        const queuesData = await queuesResponse.json();
        console.log('✈️ Airport queues data:', queuesData);

        if (queuesData.queues) {
          const airportList: Airport[] = Object.values(queuesData.queues).map((q: any) => ({
            code: q.code || q.name?.substring(0, 3).toUpperCase() || 'UNK',
            name: q.name,
            queueLength: q.queueLength || 0,
            estimatedWaitTime: q.estimatedWaitTime || 0,
            drivers: q.drivers || []
          }));
          setAirports(airportList);

          // Set default selected airport
          if (airportList.length > 0 && !selectedAirport) {
            setSelectedAirport(airportList[0].name);
          }
        }
      }

      // Fetch rideshare lots data (includes waiting lot names)
      const lotsResponse = await fetch(apiUrl('api/airports/rideshare-lots'), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (lotsResponse.ok) {
        const lotsData = await lotsResponse.json();
        console.log('✈️ Airport lots data:', lotsData);

        if (lotsData.lots) {
          setAirportLots(lotsData.lots);
        }
      }

    } catch (err) {
      console.error('Error fetching airport data:', err);
      setError('Failed to load airport data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAirportData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchAirportData, 30000);
    return () => clearInterval(interval);
  }, []);

  const currentAirport = airports.find(a => a.name === selectedAirport);
  const currentLot = airportLots.find(l => l.airportName === selectedAirport);

  // Get waiting lot name for display
  const getWaitingLotName = (airportName: string): string => {
    const lot = airportLots.find(l => l.airportName === airportName);
    return lot?.name || 'Rideshare Waiting Lot';
  };

  // Format wait time
  const formatWaitTime = (minutes: number): string => {
    if (minutes < 1) return '< 1 min';
    return `${minutes} min`;
  };

  if (loading && airports.length === 0) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <div style={{ color: 'white', fontSize: '18px' }}>Loading airport data...</div>
      </div>
    );
  }

  if (error && airports.length === 0) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ color: 'white', fontSize: '18px' }}>{error}</div>
        <button
          onClick={fetchAirportData}
          style={{
            padding: '12px 24px',
            background: 'white',
            color: '#667eea',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      {/* Header */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '20px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Plane size={24} color="#3b82f6" />
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1f2937', margin: 0 }}>
              Airport Queue System
            </h1>
          </div>
          <button
            onClick={fetchAirportData}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151'
            }}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {/* Airport Selector */}
        {airports.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#6b7280',
            background: '#f9fafb',
            borderRadius: '12px',
            border: '2px dashed #e5e7eb'
          }}>
            <Plane size={48} color="#9ca3af" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: '16px', fontWeight: '600' }}>No Airports Configured</div>
            <div style={{ fontSize: '14px', marginTop: '4px' }}>Add airports with waiting lots in the database</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {airports.map(airport => (
              <button
                key={airport.name}
                onClick={() => setSelectedAirport(airport.name)}
                style={{
                  padding: '16px',
                  border: selectedAirport === airport.name ? '2px solid #3b82f6' : '2px solid #e5e7eb',
                  borderRadius: '12px',
                  background: selectedAirport === airport.name ? '#eff6ff' : 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontWeight: '700', color: '#1f2937', marginBottom: '4px' }}>
                  {airport.code}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                  {airport.name}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', color: '#059669' }}>
                    {formatWaitTime(airport.estimatedWaitTime)} wait
                  </span>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>
                    {airport.queueLength} drivers
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Current Queue Status */}
      {currentAirport && (
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1f2937', margin: 0 }}>
              {currentAirport.name} ({currentAirport.code})
            </h2>
            <div style={{
              background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              📍 LIVE QUEUE DATA
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div style={{ textAlign: 'center', padding: '16px', background: '#f3f4f6', borderRadius: '12px' }}>
              <Users size={24} color="#3b82f6" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#1f2937' }}>{currentAirport.queueLength}</div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Drivers in Queue</div>
            </div>

            <div style={{ textAlign: 'center', padding: '16px', background: '#f3f4f6', borderRadius: '12px' }}>
              <Clock size={24} color="#f59e0b" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#1f2937' }}>{formatWaitTime(currentAirport.estimatedWaitTime)}</div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Est. Wait Time</div>
            </div>

            <div style={{ textAlign: 'center', padding: '16px', background: '#f3f4f6', borderRadius: '12px' }}>
              <MapPin size={24} color="#10b981" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#1f2937' }}>Active</div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Queue Status</div>
            </div>
          </div>

          {/* Waiting Lot Info */}
          <div style={{
            background: '#fef3c7',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px',
            border: '2px solid #fbbf24'
          }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#92400e', marginBottom: '8px' }}>
              🅿️ Designated Waiting Lot
            </div>
            <div style={{ fontSize: '14px', color: '#78350f', fontWeight: '600' }}>
              {getWaitingLotName(currentAirport.name)}
            </div>
            {currentLot && (
              <div style={{ fontSize: '12px', color: '#92400e', marginTop: '4px' }}>
                📍 {currentLot.lat.toFixed(6)}, {currentLot.lng.toFixed(6)}
              </div>
            )}
          </div>

          {/* Pickup Zones Info */}
          <div style={{
            background: '#f0f9ff',
            borderRadius: '12px',
            padding: '16px',
            border: '2px solid #0ea5e9'
          }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0c4a6e', marginBottom: '8px' }}>
              📍 Designated Pickup Zones
            </div>
            <div style={{ fontSize: '12px', color: '#0369a1', lineHeight: '1.4' }}>
              Drivers will be directed to the terminal pickup zones when matched with a rider
            </div>
          </div>
        </div>
      )}

      {/* Queue List */}
      {currentAirport && (
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1f2937', marginBottom: '16px' }}>
            Current Queue {currentAirport.drivers.length > 0 ? `- ${currentAirport.drivers.length} Drivers` : ''}
          </h3>

          {currentAirport.drivers.length === 0 ? (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              color: '#6b7280',
              background: '#f9fafb',
              borderRadius: '12px',
              border: '2px dashed #e5e7eb'
            }}>
              <Users size={48} color="#9ca3af" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: '16px', fontWeight: '600' }}>No Drivers in Queue</div>
              <div style={{ fontSize: '14px', marginTop: '4px' }}>Drivers will appear here when they enter the waiting lot</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {currentAirport.drivers.slice(0, 10).map((driver, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    background: driver.position === 1 ? '#ecfdf5' : '#f9fafb',
                    border: driver.position === 1 ? '2px solid #10b981' : '1px solid #e5e7eb',
                    borderRadius: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      background: driver.position === 1 ? '#10b981' : '#6b7280',
                      color: 'white',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: '700'
                    }}>
                      {driver.position}
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', color: '#1f2937' }}>
                        {driver.driverName || `Driver #${driver.position}`}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        {driver.vehicleType || 'Standard Vehicle'}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: driver.position === 1 ? '#059669' : '#6b7280' }}>
                      {driver.position === 1 ? 'Next Up' : `#${driver.position}`}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      Wait: {formatWaitTime(driver.waitTime)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AirportQueue;