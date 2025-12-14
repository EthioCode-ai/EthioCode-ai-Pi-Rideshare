
import React, { useState, useEffect } from 'react';
import { TrendingUp, MapPin, DollarSign, Users, Clock, Plane } from 'lucide-react';
import { apiUrl } from '../config/api.config';

interface SurgeZone {
  id: string;
  name: string;
  coordinates: { lat: number; lng: number };
  surgeMultiplier: number;
  demandLevel: 'low' | 'medium' | 'high' | 'extreme';
  estimatedRides: number;
  avgFare: number;
  radius?: number;
  isAirport?: boolean;
  airportCode?: string;
}

interface AirportGeofence {
  id: string;
  name: string;
  code: string;
  coordinates: { lat: number; lng: number };
  radius: number; // in kilometers
  surgeMultiplier: number;
  queueLength: number;
  avgWaitTime: string;
  demandLevel: 'low' | 'medium' | 'high' | 'extreme';
}

const SurgeMap: React.FC = () => {
  const [selectedZone, setSelectedZone] = useState<string>('lax');
  const [refreshInterval, setRefreshInterval] = useState<number>(30);
  const [showAirportMode, setShowAirportMode] = useState<boolean>(true);
  const [showAddAirport, setShowAddAirport] = useState<boolean>(false);
  const [surgeZones, setSurgeZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAirport, setNewAirport] = useState({
    name: '',
    code: '',
    lat: '',
    lng: '',
    radius: '2.5'
  });

  // Comprehensive US Airport Locations with Geofencing - Top 50 Busiest Airports
  const airportGeofences: AirportGeofence[] = [
    // Tier 1: Major International Hubs (Highest Volume)
    {
      id: 'atl',
      name: 'Hartsfield-Jackson Atlanta International',
      code: 'ATL',
      coordinates: { lat: 33.6407, lng: -84.4277 },
      radius: 4.2,
      surgeMultiplier: 1.6,
      queueLength: 52,
      avgWaitTime: '22 min',
      demandLevel: 'extreme'
    },
    {
      id: 'lax',
      name: 'Los Angeles International Airport',
      code: 'LAX',
      coordinates: { lat: 33.9425, lng: -118.4081 },
      radius: 3.8,
      surgeMultiplier: 1.8,
      queueLength: 47,
      avgWaitTime: '23 min',
      demandLevel: 'extreme'
    },
    {
      id: 'ord',
      name: "O'Hare International Airport",
      code: 'ORD',
      coordinates: { lat: 41.9742, lng: -87.9073 },
      radius: 4.5,
      surgeMultiplier: 1.7,
      queueLength: 45,
      avgWaitTime: '21 min',
      demandLevel: 'extreme'
    },
    {
      id: 'dfw',
      name: 'Dallas/Fort Worth International',
      code: 'DFW',
      coordinates: { lat: 32.8998, lng: -97.0403 },
      radius: 5.0,
      surgeMultiplier: 1.5,
      queueLength: 38,
      avgWaitTime: '19 min',
      demandLevel: 'high'
    },
    {
      id: 'den',
      name: 'Denver International Airport',
      code: 'DEN',
      coordinates: { lat: 39.8561, lng: -104.6737 },
      radius: 4.8,
      surgeMultiplier: 1.4,
      queueLength: 34,
      avgWaitTime: '17 min',
      demandLevel: 'high'
    },

    // Tier 2: Major East/West Coast Airports
    {
      id: 'jfk',
      name: 'John F. Kennedy International Airport',
      code: 'JFK',
      coordinates: { lat: 40.6413, lng: -73.7781 },
      radius: 3.5,
      surgeMultiplier: 1.9,
      queueLength: 43,
      avgWaitTime: '24 min',
      demandLevel: 'extreme'
    },
    {
      id: 'sfo',
      name: 'San Francisco International',
      code: 'SFO',
      coordinates: { lat: 37.6213, lng: -122.3790 },
      radius: 3.2,
      surgeMultiplier: 1.8,
      queueLength: 41,
      avgWaitTime: '22 min',
      demandLevel: 'extreme'
    },
    {
      id: 'lga',
      name: 'LaGuardia Airport',
      code: 'LGA',
      coordinates: { lat: 40.7769, lng: -73.8740 },
      radius: 2.5,
      surgeMultiplier: 1.7,
      queueLength: 29,
      avgWaitTime: '16 min',
      demandLevel: 'high'
    },
    {
      id: 'ewr',
      name: 'Newark Liberty International',
      code: 'EWR',
      coordinates: { lat: 40.6895, lng: -74.1745 },
      radius: 2.8,
      surgeMultiplier: 1.6,
      queueLength: 31,
      avgWaitTime: '17 min',
      demandLevel: 'high'
    },
    {
      id: 'sea',
      name: 'Seattle-Tacoma International',
      code: 'SEA',
      coordinates: { lat: 47.4502, lng: -122.3088 },
      radius: 3.4,
      surgeMultiplier: 1.5,
      queueLength: 28,
      avgWaitTime: '15 min',
      demandLevel: 'high'
    },

    // Tier 3: Regional Major Airports
    {
      id: 'mia',
      name: 'Miami International Airport',
      code: 'MIA',
      coordinates: { lat: 25.7959, lng: -80.2870 },
      radius: 3.0,
      surgeMultiplier: 1.6,
      queueLength: 26,
      avgWaitTime: '14 min',
      demandLevel: 'high'
    },
    {
      id: 'phx',
      name: 'Phoenix Sky Harbor International',
      code: 'PHX',
      coordinates: { lat: 33.4342, lng: -112.0080 },
      radius: 3.2,
      surgeMultiplier: 1.3,
      queueLength: 22,
      avgWaitTime: '12 min',
      demandLevel: 'medium'
    },
    {
      id: 'iah',
      name: 'George Bush Intercontinental Houston',
      code: 'IAH',
      coordinates: { lat: 29.9844, lng: -95.3414 },
      radius: 3.5,
      surgeMultiplier: 1.4,
      queueLength: 25,
      avgWaitTime: '13 min',
      demandLevel: 'high'
    },
    {
      id: 'bos',
      name: 'Boston Logan International',
      code: 'BOS',
      coordinates: { lat: 42.3656, lng: -71.0096 },
      radius: 2.9,
      surgeMultiplier: 1.5,
      queueLength: 24,
      avgWaitTime: '13 min',
      demandLevel: 'high'
    },
    {
      id: 'msp',
      name: 'Minneapolis-St. Paul International',
      code: 'MSP',
      coordinates: { lat: 44.8848, lng: -93.2223 },
      radius: 3.1,
      surgeMultiplier: 1.2,
      queueLength: 19,
      avgWaitTime: '11 min',
      demandLevel: 'medium'
    },

    // Tier 4: Major Regional & Secondary Airports
    {
      id: 'dtw',
      name: 'Detroit Metropolitan Wayne County',
      code: 'DTW',
      coordinates: { lat: 42.2124, lng: -83.3534 },
      radius: 3.0,
      surgeMultiplier: 1.2,
      queueLength: 17,
      avgWaitTime: '10 min',
      demandLevel: 'medium'
    },
    {
      id: 'phl',
      name: 'Philadelphia International',
      code: 'PHL',
      coordinates: { lat: 39.8719, lng: -75.2411 },
      radius: 2.7,
      surgeMultiplier: 1.3,
      queueLength: 21,
      avgWaitTime: '12 min',
      demandLevel: 'medium'
    },
    {
      id: 'mcl',
      name: 'Orlando International',
      code: 'MCO',
      coordinates: { lat: 28.4312, lng: -81.3081 },
      radius: 2.8,
      surgeMultiplier: 1.4,
      queueLength: 23,
      avgWaitTime: '13 min',
      demandLevel: 'high'
    },
    {
      id: 'slc',
      name: 'Salt Lake City International',
      code: 'SLC',
      coordinates: { lat: 40.7884, lng: -111.9776 },
      radius: 2.5,
      surgeMultiplier: 1.1,
      queueLength: 14,
      avgWaitTime: '9 min',
      demandLevel: 'medium'
    },
    {
      id: 'fll',
      name: 'Fort Lauderdale-Hollywood International',
      code: 'FLL',
      coordinates: { lat: 26.0742, lng: -80.1506 },
      radius: 2.3,
      surgeMultiplier: 1.3,
      queueLength: 18,
      avgWaitTime: '11 min',
      demandLevel: 'medium'
    },
    {
      id: 'dca',
      name: 'Ronald Reagan Washington National',
      code: 'DCA',
      coordinates: { lat: 38.8512, lng: -77.0402 },
      radius: 2.1,
      surgeMultiplier: 1.5,
      queueLength: 26,
      avgWaitTime: '14 min',
      demandLevel: 'high'
    },
    {
      id: 'iad',
      name: 'Washington Dulles International',
      code: 'IAD',
      coordinates: { lat: 38.9531, lng: -77.4565 },
      radius: 3.2,
      surgeMultiplier: 1.4,
      queueLength: 22,
      avgWaitTime: '12 min',
      demandLevel: 'medium'
    },
    {
      id: 'mdw',
      name: 'Chicago Midway International',
      code: 'MDW',
      coordinates: { lat: 41.7868, lng: -87.7522 },
      radius: 2.2,
      surgeMultiplier: 1.3,
      queueLength: 16,
      avgWaitTime: '10 min',
      demandLevel: 'medium'
    },
    {
      id: 'san',
      name: 'San Diego International',
      code: 'SAN',
      coordinates: { lat: 32.7336, lng: -117.1897 },
      radius: 2.4,
      surgeMultiplier: 1.3,
      queueLength: 20,
      avgWaitTime: '11 min',
      demandLevel: 'medium'
    },
    {
      id: 'tpa',
      name: 'Tampa International',
      code: 'TPA',
      coordinates: { lat: 27.9755, lng: -82.5332 },
      radius: 2.6,
      surgeMultiplier: 1.2,
      queueLength: 15,
      avgWaitTime: '9 min',
      demandLevel: 'medium'
    },

    // Tier 5: Secondary Markets & Regional Airports
    {
      id: 'pdx',
      name: 'Portland International',
      code: 'PDX',
      coordinates: { lat: 45.5898, lng: -122.5951 },
      radius: 2.3,
      surgeMultiplier: 1.2,
      queueLength: 13,
      avgWaitTime: '8 min',
      demandLevel: 'medium'
    },
    {
      id: 'aus',
      name: 'Austin-Bergstrom International',
      code: 'AUS',
      coordinates: { lat: 30.1975, lng: -97.6664 },
      radius: 2.5,
      surgeMultiplier: 1.3,
      queueLength: 18,
      avgWaitTime: '11 min',
      demandLevel: 'medium'
    },
    {
      id: 'msy',
      name: 'Louis Armstrong New Orleans International',
      code: 'MSY',
      coordinates: { lat: 29.9934, lng: -90.2580 },
      radius: 2.2,
      surgeMultiplier: 1.2,
      queueLength: 12,
      avgWaitTime: '8 min',
      demandLevel: 'medium'
    },
    {
      id: 'stl',
      name: 'St. Louis Lambert International',
      code: 'STL',
      coordinates: { lat: 38.7487, lng: -90.3700 },
      radius: 2.4,
      surgeMultiplier: 1.1,
      queueLength: 11,
      avgWaitTime: '7 min',
      demandLevel: 'low'
    },
    {
      id: 'bwi',
      name: 'Baltimore/Washington International Thurgood Marshall',
      code: 'BWI',
      coordinates: { lat: 39.1754, lng: -76.6683 },
      radius: 2.5,
      surgeMultiplier: 1.3,
      queueLength: 19,
      avgWaitTime: '11 min',
      demandLevel: 'medium'
    },
    {
      id: 'oak',
      name: 'Oakland International',
      code: 'OAK',
      coordinates: { lat: 37.7214, lng: -122.2208 },
      radius: 2.1,
      surgeMultiplier: 1.4,
      queueLength: 16,
      avgWaitTime: '10 min',
      demandLevel: 'medium'
    },
    {
      id: 'sjc',
      name: 'San Jose Mineta International',
      code: 'SJC',
      coordinates: { lat: 37.3639, lng: -121.9289 },
      radius: 2.0,
      surgeMultiplier: 1.3,
      queueLength: 14,
      avgWaitTime: '9 min',
      demandLevel: 'medium'
    },
    {
      id: 'cvg',
      name: 'Cincinnati/Northern Kentucky International',
      code: 'CVG',
      coordinates: { lat: 39.0488, lng: -84.6678 },
      radius: 2.3,
      surgeMultiplier: 1.1,
      queueLength: 10,
      avgWaitTime: '7 min',
      demandLevel: 'low'
    },
    {
      id: 'ind',
      name: 'Indianapolis International',
      code: 'IND',
      coordinates: { lat: 39.7173, lng: -86.2944 },
      radius: 2.2,
      surgeMultiplier: 1.1,
      queueLength: 9,
      avgWaitTime: '6 min',
      demandLevel: 'low'
    },
    {
      id: 'cmh',
      name: 'John Glenn Columbus International',
      code: 'CMH',
      coordinates: { lat: 39.9980, lng: -82.8919 },
      radius: 2.1,
      surgeMultiplier: 1.1,
      queueLength: 8,
      avgWaitTime: '6 min',
      demandLevel: 'low'
    },

    // Regional & Smaller Markets
    {
      id: 'ric',
      name: 'Richmond International',
      code: 'RIC',
      coordinates: { lat: 37.5052, lng: -77.3197 },
      radius: 1.8,
      surgeMultiplier: 1.0,
      queueLength: 6,
      avgWaitTime: '5 min',
      demandLevel: 'low'
    },
    {
      id: 'rdu',
      name: 'Raleigh-Durham International',
      code: 'RDU',
      coordinates: { lat: 35.8776, lng: -78.7875 },
      radius: 2.0,
      surgeMultiplier: 1.2,
      queueLength: 12,
      avgWaitTime: '8 min',
      demandLevel: 'medium'
    },
    {
      id: 'clt',
      name: 'Charlotte Douglas International',
      code: 'CLT',
      coordinates: { lat: 35.2140, lng: -80.9431 },
      radius: 2.4,
      surgeMultiplier: 1.3,
      queueLength: 17,
      avgWaitTime: '10 min',
      demandLevel: 'medium'
    },
    {
      id: 'mke',
      name: 'Milwaukee Mitchell International',
      code: 'MKE',
      coordinates: { lat: 42.9472, lng: -87.8966 },
      radius: 1.9,
      surgeMultiplier: 1.0,
      queueLength: 7,
      avgWaitTime: '5 min',
      demandLevel: 'low'
    },
    {
      id: 'buf',
      name: 'Buffalo Niagara International',
      code: 'BUF',
      coordinates: { lat: 42.9405, lng: -78.7322 },
      radius: 1.8,
      surgeMultiplier: 1.0,
      queueLength: 5,
      avgWaitTime: '4 min',
      demandLevel: 'low'
    },
    {
      id: 'rno',
      name: 'Reno-Tahoe International',
      code: 'RNO',
      coordinates: { lat: 39.4991, lng: -119.7681 },
      radius: 1.7,
      surgeMultiplier: 1.0,
      queueLength: 4,
      avgWaitTime: '4 min',
      demandLevel: 'low'
    },

    // Arkansas & Regional (Including your local airports)
    {
      id: 'xna',
      name: 'Northwest Arkansas Regional',
      code: 'XNA',
      coordinates: { lat: 36.2818, lng: -94.3068 },
      radius: 2.2,
      surgeMultiplier: 1.2,
      queueLength: 12,
      avgWaitTime: '8 min',
      demandLevel: 'medium'
    },
    {
      id: 'lit',
      name: 'Bill and Hillary Clinton National/Adams Field',
      code: 'LIT',
      coordinates: { lat: 34.7293, lng: -92.2241 },
      radius: 2.0,
      surgeMultiplier: 1.1,
      queueLength: 8,
      avgWaitTime: '6 min',
      demandLevel: 'low'
    },

    // Additional Key Markets
    {
      id: 'abq',
      name: 'Albuquerque International Sunport',
      code: 'ABQ',
      coordinates: { lat: 35.0402, lng: -106.6091 },
      radius: 1.9,
      surgeMultiplier: 1.0,
      queueLength: 6,
      avgWaitTime: '5 min',
      demandLevel: 'low'
    },
    {
      id: 'tul',
      name: 'Tulsa International',
      code: 'TUL',
      coordinates: { lat: 36.1984, lng: -95.8881 },
      radius: 1.8,
      surgeMultiplier: 1.0,
      queueLength: 5,
      avgWaitTime: '4 min',
      demandLevel: 'low'
    },
    {
      id: 'okc',
      name: 'Will Rogers World',
      code: 'OKC',
      coordinates: { lat: 35.3931, lng: -97.6007 },
      radius: 1.9,
      surgeMultiplier: 1.1,
      queueLength: 7,
      avgWaitTime: '5 min',
      demandLevel: 'low'
    },
    {
      id: 'mci',
      name: 'Kansas City International',
      code: 'MCI',
      coordinates: { lat: 39.2976, lng: -94.7139 },
      radius: 2.1,
      surgeMultiplier: 1.1,
      queueLength: 9,
      avgWaitTime: '6 min',
      demandLevel: 'low'
    }
  ];

  // Regular city surge zones
  const cityZones: SurgeZone[] = [
    {
      id: 'hollywood',
      name: 'Hollywood & Highland',
      coordinates: { lat: 34.1022, lng: -118.3390 },
      surgeMultiplier: 1.4,
      demandLevel: 'high',
      estimatedRides: 23,
      avgFare: 18.75
    },
    {
      id: 'downtown_la',
      name: 'Downtown LA',
      coordinates: { lat: 34.0522, lng: -118.2437 },
      surgeMultiplier: 1.2,
      demandLevel: 'medium',
      estimatedRides: 31,
      avgFare: 22.30
    },
    {
      id: 'bentonville_square',
      name: 'Bentonville Town Square',
      coordinates: { lat: 36.3729, lng: -94.2088 },
      surgeMultiplier: 1.2,
      demandLevel: 'medium',
      estimatedRides: 67,
      avgFare: 28.50
    },
    {
      id: 'south_beach',
      name: 'South Beach Miami',
      coordinates: { lat: 25.7907, lng: -80.1300 },
      surgeMultiplier: 1.6,
      demandLevel: 'high',
      estimatedRides: 42,
      avgFare: 24.80
    }
  ];

  const getDemandColor = (level: string) => {
    switch (level) {
      case 'extreme': return '#dc2626';
      case 'high': return '#ea580c';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getSurgeIcon = (multiplier: number) => {
    if (multiplier >= 1.5) return '🔥';
    if (multiplier >= 1.3) return '⚡';
    if (multiplier >= 1.1) return '📈';
    return '✅';
  };

  // Use pricing settings for premium calculations
  const pricingSettings = {
    baseFare: 2.50,
    perMileFare: 1.25,
    perMinuteFare: 0.35,
    maxSurgeMultiplier: 3.0
  };

  const getAirportPremium = (surgeMultiplier: number, baseFare: number = 25) => {
    // Calculate premium based on average trip fare with settings
    const avgTripDistance = 5; // miles
    const avgTripTime = 15; // minutes
    const estimatedBaseFare = (pricingSettings.baseFare + 
                             (avgTripDistance * pricingSettings.perMileFare) + 
                             (avgTripTime * pricingSettings.perMinuteFare));
    
    return `+$${((surgeMultiplier - 1) * estimatedBaseFare).toFixed(0)}`;
  };

  useEffect(() => {
  loadSurgeZones();
  const timer = setInterval(loadSurgeZones, refreshInterval * 1000);
  return () => clearInterval(timer);
}, [refreshInterval]);

const loadSurgeZones = async () => {
  try {
    const token = localStorage.getItem('authToken');
    const response = await fetch(apiUrl('api/admin/surge/zones'), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('🗺️ Surge zones loaded:', data.zones?.length);
      
      // Transform to match UI format
      const transformed = (data.zones || []).map((z: any) => ({
        id: z.zone_code?.toLowerCase() || z.id,
        name: z.zone_name,
        code: z.zone_code,
        coordinates: { lat: parseFloat(z.latitude), lng: parseFloat(z.longitude) },
        radius: z.radius / 1000, // Convert meters to km
        surgeMultiplier: parseFloat(z.base_multiplier),
        queueLength: 0,
        avgWaitTime: 'N/A',
        demandLevel: z.base_multiplier >= 1.5 ? 'high' : z.base_multiplier >= 1.2 ? 'medium' : 'low',
        isAirport: z.zone_type === 'airport',
        zoneType: z.zone_type
      }));
      setSurgeZones(transformed);
    }
  } catch (error) {
    console.error('Failed to load surge zones:', error);
  } finally {
    setLoading(false);
  }
};

  const addNewAirport = () => {
    if (newAirport.name && newAirport.code && newAirport.lat && newAirport.lng) {
      const newAirportData: AirportGeofence = {
        id: newAirport.code.toLowerCase(),
        name: newAirport.name,
        code: newAirport.code.toUpperCase(),
        coordinates: { lat: parseFloat(newAirport.lat), lng: parseFloat(newAirport.lng) },
        radius: parseFloat(newAirport.radius),
        surgeMultiplier: 1.0,
        queueLength: 0,
        avgWaitTime: '0 min',
        demandLevel: 'low'
      };
      
      airportGeofences.push(newAirportData);
      setShowAddAirport(false);
      setNewAirport({ name: '', code: '', lat: '', lng: '', radius: '2.5' });
      console.log(`✅ Added new airport: ${newAirport.code}`);
    }
  };

  return (
    <div>
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
            <TrendingUp size={24} color="#dc2626" />
            <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1f2937', margin: 0 }}>
              Live Surge & Airport Heatmap
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {showAirportMode && (
              <button
                onClick={() => setShowAddAirport(true)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#10b981',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                + Add Airport
              </button>
            )}
            <div style={{
              width: '8px',
              height: '8px',
              background: '#10b981',
              borderRadius: '50%',
              animation: 'pulse 2s infinite'
            }} />
            <span style={{ fontSize: '12px', color: '#6b7280' }}>
              Updates every {refreshInterval}s
            </span>
          </div>
        </div>

        {/* Mode Toggle */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <button
            onClick={() => setShowAirportMode(true)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: showAirportMode ? '#3b82f6' : '#f3f4f6',
              color: showAirportMode ? 'white' : '#6b7280',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plane size={16} />
            Airport Zones
          </button>
          <button
            onClick={() => setShowAirportMode(false)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: !showAirportMode ? '#3b82f6' : '#f3f4f6',
              color: !showAirportMode ? 'white' : '#6b7280',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <MapPin size={16} />
            City Zones
          </button>
        </div>

        {/* Heatmap Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>Surge Level:</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { level: 'low', color: '#10b981', label: '1.0-1.2x' },
                { level: 'medium', color: '#f59e0b', label: '1.2-1.4x' },
                { level: 'high', color: '#ea580c', label: '1.4-1.7x' },
                { level: 'extreme', color: '#dc2626', label: '1.7x+' }
              ].map(item => (
                <div key={item.level} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    background: item.color,
                    borderRadius: '2px'
                  }} />
                  <span style={{ fontSize: '10px', color: '#6b7280' }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add Airport Modal */}
      {showAddAirport && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '24px',
            width: '400px',
            maxWidth: '90vw'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '20px', color: '#1f2937' }}>
              Add New Airport
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Airport Name
                </label>
                <input
                  type="text"
                  value={newAirport.name}
                  onChange={(e) => setNewAirport({...newAirport, name: e.target.value})}
                  placeholder="e.g., Memphis International Airport"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Airport Code
                </label>
                <input
                  type="text"
                  value={newAirport.code}
                  onChange={(e) => setNewAirport({...newAirport, code: e.target.value})}
                  placeholder="e.g., MEM"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    textTransform: 'uppercase'
                  }}
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newAirport.lat}
                    onChange={(e) => setNewAirport({...newAirport, lat: e.target.value})}
                    placeholder="35.0428"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={newAirport.lng}
                    onChange={(e) => setNewAirport({...newAirport, lng: e.target.value})}
                    placeholder="-89.9767"
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  Geofence Radius (km)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={newAirport.radius}
                  onChange={(e) => setNewAirport({...newAirport, radius: e.target.value})}
                  placeholder="2.5"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                onClick={() => setShowAddAirport(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#f3f4f6',
                  color: '#6b7280',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={addNewAirport}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Add Airport
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Airport Geofences Grid */}
      {showAirportMode && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px',
          marginBottom: '20px'
        }}>
          {airportGeofences.map(airport => (
            <div
              key={airport.id}
              onClick={() => setSelectedZone(airport.id)}
              style={{
                background: selectedZone === airport.id ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : 'white',
                color: selectedZone === airport.id ? 'white' : '#1f2937',
                borderRadius: '16px',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.3s',
                boxShadow: selectedZone === airport.id ? '0 8px 30px rgba(59, 130, 246, 0.3)' : '0 4px 20px rgba(0,0,0,0.1)',
                transform: selectedZone === airport.id ? 'translateY(-4px)' : 'none'
              }}
            >
              {/* Airport Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Plane size={20} />
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '16px' }}>{airport.code}</div>
                    <div style={{ fontSize: '12px', opacity: 0.8 }}>{airport.name}</div>
                  </div>
                </div>
                <div style={{ fontSize: '20px' }}>{getSurgeIcon(airport.surgeMultiplier)}</div>
              </div>

              {/* Geofence Info */}
              <div style={{
                background: selectedZone === airport.id ? 'rgba(255,255,255,0.1)' : '#f8fafc',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px'
              }}>
                <div style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>
                  GEOFENCE RADIUS
                </div>
                <div style={{ fontSize: '16px', fontWeight: '700' }}>
                  {airport.radius} km
                </div>
              </div>

              {/* Surge Multiplier */}
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: '700',
                  marginBottom: '4px',
                  color: selectedZone === airport.id ? 'white' : getDemandColor(airport.demandLevel)
                }}>
                  {airport.surgeMultiplier}x
                </div>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>
                  {getAirportPremium(airport.surgeMultiplier)} premium
                </div>
              </div>

              {/* Airport Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ textAlign: 'center', padding: '12px', background: selectedZone === airport.id ? 'rgba(255,255,255,0.1)' : '#f9fafb', borderRadius: '8px' }}>
                  <Users size={16} style={{ margin: '0 auto 4px', display: 'block' }} />
                  <div style={{ fontSize: '16px', fontWeight: '700' }}>{airport.queueLength}</div>
                  <div style={{ fontSize: '10px', opacity: 0.8 }}>Queue Length</div>
                </div>
                
                <div style={{ textAlign: 'center', padding: '12px', background: selectedZone === airport.id ? 'rgba(255,255,255,0.1)' : '#f9fafb', borderRadius: '8px' }}>
                  <Clock size={16} style={{ margin: '0 auto 4px', display: 'block' }} />
                  <div style={{ fontSize: '16px', fontWeight: '700' }}>{airport.avgWaitTime}</div>
                  <div style={{ fontSize: '10px', opacity: 0.8 }}>Avg Wait</div>
                </div>
              </div>

              {/* Demand Level Indicator */}
              <div style={{
                marginTop: '12px',
                padding: '8px 12px',
                background: selectedZone === airport.id ? 'rgba(255,255,255,0.1)' : getDemandColor(airport.demandLevel),
                color: selectedZone === airport.id ? 'white' : 'white',
                borderRadius: '8px',
                textAlign: 'center',
                fontSize: '12px',
                fontWeight: '600',
                textTransform: 'uppercase'
              }}>
                {airport.demandLevel} Demand Zone
              </div>
            </div>
          ))}
        </div>
      )}

      {/* City Zones Grid */}
      {!showAirportMode && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
          marginBottom: '20px'
        }}>
          {cityZones.map(zone => (
            <div
              key={zone.id}
              onClick={() => setSelectedZone(zone.id)}
              style={{
                background: selectedZone === zone.id ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : 'white',
                color: selectedZone === zone.id ? 'white' : '#1f2937',
                borderRadius: '16px',
                padding: '20px',
                cursor: 'pointer',
                transition: 'all 0.3s',
                boxShadow: selectedZone === zone.id ? '0 8px 30px rgba(59, 130, 246, 0.3)' : '0 4px 20px rgba(0,0,0,0.1)',
                transform: selectedZone === zone.id ? 'translateY(-4px)' : 'none'
              }}
            >
              {/* Zone Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={20} />
                  <span style={{ fontWeight: '600', fontSize: '14px' }}>{zone.name}</span>
                </div>
                <div style={{ fontSize: '20px' }}>{getSurgeIcon(zone.surgeMultiplier)}</div>
              </div>

              {/* Surge Multiplier */}
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <div style={{
                  fontSize: '32px',
                  fontWeight: '700',
                  marginBottom: '4px',
                  color: selectedZone === zone.id ? 'white' : getDemandColor(zone.demandLevel)
                }}>
                  {zone.surgeMultiplier}x
                </div>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>
                  Surge Multiplier
                </div>
              </div>

              {/* Zone Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ textAlign: 'center', padding: '12px', background: selectedZone === zone.id ? 'rgba(255,255,255,0.1)' : '#f9fafb', borderRadius: '8px' }}>
                  <Users size={16} style={{ margin: '0 auto 4px', display: 'block' }} />
                  <div style={{ fontSize: '16px', fontWeight: '700' }}>{zone.estimatedRides}</div>
                  <div style={{ fontSize: '10px', opacity: 0.8 }}>Est. Rides</div>
                </div>
                
                <div style={{ textAlign: 'center', padding: '12px', background: selectedZone === zone.id ? 'rgba(255,255,255,0.1)' : '#f9fafb', borderRadius: '8px' }}>
                  <DollarSign size={16} style={{ margin: '0 auto 4px', display: 'block' }} />
                  <div style={{ fontSize: '16px', fontWeight: '700' }}>${zone.avgFare.toFixed(2)}</div>
                  <div style={{ fontSize: '10px', opacity: 0.8 }}>Avg Fare</div>
                </div>
              </div>

              {/* Demand Level Indicator */}
              <div style={{
                marginTop: '12px',
                padding: '8px 12px',
                background: selectedZone === zone.id ? 'rgba(255,255,255,0.1)' : getDemandColor(zone.demandLevel),
                color: selectedZone === zone.id ? 'white' : 'white',
                borderRadius: '8px',
                textAlign: 'center',
                fontSize: '12px',
                fontWeight: '600',
                textTransform: 'uppercase'
              }}>
                {zone.demandLevel} Demand
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Live Activity Feed */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '20px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1f2937', marginBottom: '16px' }}>
          Live Activity Feed
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            { time: '1 min ago', message: 'LAX surge increased to 1.8x (+$13 premium)', type: 'surge', airport: true },
            { time: '3 min ago', message: 'JFK airport queue: 32 drivers waiting', type: 'queue', airport: true },
            { time: '5 min ago', message: 'SFO geofence activated - high demand detected', type: 'geofence', airport: true },
            { time: '8 min ago', message: 'ORD surge decreased to 1.5x', type: 'surge', airport: true },
            { time: '12 min ago', message: 'Times Square demand spike - 1.9x surge', type: 'demand', airport: false },
            { time: '15 min ago', message: 'DEN airport: 24 drivers in queue', type: 'queue', airport: true },
            { time: '18 min ago', message: 'ATL geofence breach - driver entering zone', type: 'geofence', airport: true }
          ].map((activity, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 16px',
                background: '#f9fafb',
                borderRadius: '8px',
                borderLeft: `4px solid ${
                  activity.type === 'surge' ? '#dc2626' :
                  activity.type === 'queue' ? '#3b82f6' :
                  activity.type === 'geofence' ? '#8b5cf6' :
                  activity.type === 'demand' ? '#f59e0b' : '#10b981'
                }`
              }}
            >
              <div style={{ marginRight: '12px' }}>
                {activity.airport ? <Plane size={16} color="#6b7280" /> : <MapPin size={16} color="#6b7280" />}
              </div>
              <Clock size={14} color="#6b7280" style={{ marginRight: '8px' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', color: '#1f2937' }}>{activity.message}</div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>{activity.time}</div>
              </div>
              {activity.type === 'geofence' && (
                <div style={{
                  background: '#8b5cf6',
                  color: 'white',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: '600'
                }}>
                  GEOFENCE
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SurgeMap;
