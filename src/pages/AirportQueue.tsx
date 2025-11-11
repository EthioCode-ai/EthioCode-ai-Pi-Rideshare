
import React, { useState, useEffect } from 'react';
import { MapPin, Clock, Users, DollarSign, Plane } from 'lucide-react';

interface QueuedDriver {
  id: string;
  name: string;
  vehicleType: string;
  queuePosition: number;
  waitTime: string;
  earnings: number;
}

interface Airport {
  id: string;
  name: string;
  code: string;
  queueLength: number;
  avgWaitTime: string;
  surgeMultiplier: number;
}

const AirportQueue: React.FC = () => {
  const [selectedAirport, setSelectedAirport] = useState<string>('LAX');
  const [driverInQueue, setDriverInQueue] = useState<boolean>(false);
  const [queuePosition, setQueuePosition] = useState<number>(0);

  const airports: Airport[] = [
    { id: 'LAX', name: 'Los Angeles International', code: 'LAX', queueLength: 47, avgWaitTime: '23 min', surgeMultiplier: 1.8 },
    { id: 'JFK', name: 'John F. Kennedy International', code: 'JFK', queueLength: 32, avgWaitTime: '18 min', surgeMultiplier: 1.6 },
    { id: 'ORD', name: "O'Hare International", code: 'ORD', queueLength: 28, avgWaitTime: '15 min', surgeMultiplier: 1.5 },
    { id: 'ATL', name: 'Hartsfield-Jackson Atlanta International', code: 'ATL', queueLength: 41, avgWaitTime: '20 min', surgeMultiplier: 1.4 },
    { id: 'DFW', name: 'Dallas/Fort Worth International', code: 'DFW', queueLength: 35, avgWaitTime: '16 min', surgeMultiplier: 1.3 },
    { id: 'SFO', name: 'San Francisco International', code: 'SFO', queueLength: 39, avgWaitTime: '21 min', surgeMultiplier: 1.7 },
    { id: 'SEA', name: 'Seattle-Tacoma International', code: 'SEA', queueLength: 26, avgWaitTime: '14 min', surgeMultiplier: 1.4 },
    { id: 'MIA', name: 'Miami International', code: 'MIA', queueLength: 19, avgWaitTime: '12 min', surgeMultiplier: 1.5 },
    { id: 'XNA', name: 'Northwest Arkansas Regional', code: 'XNA', queueLength: 8, avgWaitTime: '8 min', surgeMultiplier: 1.1 }
  ];

  const queuedDrivers: QueuedDriver[] = [
    { id: '1', name: 'Michael R.', vehicleType: 'Tesla Model 3', queuePosition: 1, waitTime: '2 min', earnings: 847.50 },
    { id: '2', name: 'Sarah L.', vehicleType: 'Toyota Camry', queuePosition: 2, waitTime: '8 min', earnings: 692.30 },
    { id: '3', name: 'David K.', vehicleType: 'Honda Accord', queuePosition: 3, waitTime: '15 min', earnings: 523.80 },
    { id: '4', name: 'Jennifer M.', vehicleType: 'Nissan Altima', queuePosition: 4, waitTime: '22 min', earnings: 765.90 }
  ];

  const currentAirport = airports.find(a => a.id === selectedAirport)!;

  const joinQueue = () => {
    setDriverInQueue(true);
    setQueuePosition(currentAirport.queueLength + 1);
  };

  const leaveQueue = () => {
    setDriverInQueue(false);
    setQueuePosition(0);
  };

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <Plane size={24} color="#3b82f6" />
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1f2937', margin: 0 }}>
            Airport Queue System
          </h1>
        </div>

        {/* Airport Selector */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {airports.map(airport => (
            <button
              key={airport.id}
              onClick={() => setSelectedAirport(airport.id)}
              style={{
                padding: '16px',
                border: selectedAirport === airport.id ? '2px solid #3b82f6' : '2px solid #e5e7eb',
                borderRadius: '12px',
                background: selectedAirport === airport.id ? '#eff6ff' : 'white',
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
                  {airport.surgeMultiplier}x surge
                </span>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>
                  {airport.queueLength} drivers
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Current Queue Status */}
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
            📍 PICKUP ZONES MAPPED
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
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#1f2937' }}>{currentAirport.avgWaitTime}</div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>Avg Wait Time</div>
          </div>
          
          <div style={{ textAlign: 'center', padding: '16px', background: '#f3f4f6', borderRadius: '12px' }}>
            <DollarSign size={24} color="#10b981" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#1f2937' }}>{currentAirport.surgeMultiplier}x</div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>Surge Multiplier</div>
          </div>
        </div>

        {/* Pickup Zones Info */}
        <div style={{
          background: '#f0f9ff',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '16px',
          border: '2px solid #0ea5e9'
        }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#0c4a6e', marginBottom: '8px' }}>
            📍 Designated Pickup Zones
          </div>
          <div style={{ fontSize: '12px', color: '#0369a1', lineHeight: '1.4' }}>
            {currentAirport.code === 'XNA' && 'Main Terminal Rideshare Zone • Ground Transportation Area'}
            {currentAirport.code === 'LAX' && 'LAX-it Rideshare Hub • Terminal 1, 4, 7 Pickup Areas'}
            {currentAirport.code === 'JFK' && 'Terminal 1, 4, 5, 7, 8 Rideshare Zones'}
            {currentAirport.code === 'ORD' && 'Terminal 1, 2, 3, 5 Rideshare Zones'}
            {currentAirport.code === 'ATL' && 'Terminal North/South Rideshare • Ground Transportation Center'}
            {!['XNA', 'LAX', 'JFK', 'ORD', 'ATL'].includes(currentAirport.code) && 'Multiple terminal pickup zones available'}
          </div>
        </div>

        {/* Queue Action Button */}
        {!driverInQueue ? (
          <button
            onClick={joinQueue}
            style={{
              width: '100%',
              padding: '16px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            🛬 Join Airport Queue
          </button>
        ) : (
          <div style={{
            padding: '20px',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            borderRadius: '12px',
            color: 'white',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>
              You're in the queue!
            </div>
            <div style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>
              #{queuePosition}
            </div>
            <div style={{ marginBottom: '16px', opacity: 0.9 }}>
              Estimated wait: {Math.ceil(queuePosition * 5)} minutes
            </div>
            <button
              onClick={leaveQueue}
              style={{
                padding: '12px 24px',
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Leave Queue
            </button>
          </div>
        )}
      </div>

      {/* Queue List */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '20px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1f2937', marginBottom: '16px' }}>
          Current Queue - Next 4 Drivers
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {queuedDrivers.map(driver => (
            <div
              key={driver.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                background: driver.queuePosition === 1 ? '#ecfdf5' : '#f9fafb',
                border: driver.queuePosition === 1 ? '2px solid #10b981' : '1px solid #e5e7eb',
                borderRadius: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  background: driver.queuePosition === 1 ? '#10b981' : '#6b7280',
                  color: 'white',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: '700'
                }}>
                  {driver.queuePosition}
                </div>
                <div>
                  <div style={{ fontWeight: '600', color: '#1f2937' }}>{driver.name}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{driver.vehicleType}</div>
                </div>
              </div>
              
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#059669' }}>
                  ${driver.earnings.toFixed(2)}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  Wait: {driver.waitTime}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AirportQueue;
