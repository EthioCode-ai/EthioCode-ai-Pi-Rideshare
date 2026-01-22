import React, { useRef, useEffect, useState } from 'react';
import {
  Users,
  Car,
  DollarSign,
  TrendingUp,
  MapPin,
  Clock,
  Star,
  Navigation,
  Eye,
  EyeOff
} from 'lucide-react';
import QRCodeGenerator from '../components/QRCodeGenerator';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { marketService, Market } from '../utils/marketService';
import GoogleMapsError from '../components/GoogleMapsError';
import { io, Socket } from 'socket.io-client';
import PiCarIcon from '../assets/Pi_Car1.png';
import SurgeHeatmapOverlay from '../components/SurgeHeatmapOverlay';
const SurgeHeatmapOverlayAny = SurgeHeatmapOverlay as any;
import { apiUrl, getSocketUrl } from '../config/api.config';

declare global {
  interface Window {
    google: any;
    initDashboardMap: () => void;
  }
}

const Dashboard: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [showDrivers, setShowDrivers] = useState(true);
  const [showRiders, setShowRiders] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [activeRides, setActiveRides] = useState<any[]>([]);
  const [driverMarkers, setDriverMarkers] = useState<any[]>([]);
  const [riderMarkers, setRiderMarkers] = useState<any[]>([]);
  const [availableMarkets, setAvailableMarkets] = useState<Market[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [marketRadius, setMarketRadius] = useState(15);
  const [radiusCircle, setRadiusCircle] = useState<any>(null);
  const [adminLocation, setAdminLocation] = useState<{lat: number, lng: number} | null>(null);
  const [adminMarker, setAdminMarker] = useState<any>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [realDrivers, setRealDrivers] = useState<any[]>([]);
  const [realRiders, setRealRiders] = useState<any[]>([]);
  const [airportLots, setAirportLots] = useState<any[]>([]);
  const [airportMarkers, setAirportMarkers] = useState<any[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [liveStats, setLiveStats] = useState({
    pendingRequests: 0,
    activeRides: 0,
    onlineDrivers: 0,
    totalRevenue: 0,
    completedRides: 0
  });
  
  // Surge Management State
  const [activeTab, setActiveTab] = useState('overview');
  const [surgeZones, setSurgeZones] = useState<any[]>([]);
  const [timeRules, setTimeRules] = useState<any[]>([]);
  const [weatherRules, setWeatherRules] = useState<any[]>([]);
  const [algorithmConfig, setAlgorithmConfig] = useState<any[]>([]);
  const [currentSurgeStatus, setCurrentSurgeStatus] = useState<any[]>([]);
  const [showSurgeModal, setShowSurgeModal] = useState(false);
  const [selectedZone, setSelectedZone] = useState<any>(null);
  const [surgeModalType, setSurgeModalType] = useState('');
  const [formData, setFormData] = useState<any>({});
  
  // Heatmap State
  const [heatmapZones, setHeatmapZones] = useState<any[]>([]);
  const [heatmapStats, setHeatmapStats] = useState<any>({});

  useEffect(() => {
    // Load markets from shared service
    const markets = marketService.getAllMarkets();
    setAvailableMarkets(markets);
    
    // Set default market to Bentonville instead of first market (which might be NYC)
    const bentonvilleMarket = markets.find(m => m.name === 'Bentonville, AR');
    if (bentonvilleMarket) {
      setSelectedMarket(bentonvilleMarket);
    } else if (markets.length > 0) {
      setSelectedMarket(markets[0]);
    }
  }, []);

  // Connect to real-time Socket.IO for live updates
  useEffect(() => {
    console.log('📡 Dashboard: Connecting to Socket.IO...');
    const socketConnection = io(getSocketUrl(), {
      transports: ['websocket', 'polling']
    });
    
    setSocket(socketConnection);
    
    socketConnection.on('connect', () => {
      console.log('✅ Dashboard: Socket.IO connected successfully!');
      
      // 🔄 SYNC FIX: Request current driver state when reconnecting
      console.log('🔄 Requesting current driver state after reconnection...');
      socketConnection.emit('request-current-state');
    });
    
    socketConnection.on('disconnect', () => {
      console.log('❌ Dashboard: Socket.IO disconnected');
    });
    
    socketConnection.on('connect_error', (error) => {
      console.log('🚫 Dashboard: Socket.IO connection error:', error);
    });
    
    // Listen for real-time driver updates
    socketConnection.on('driver-location-update', (data) => {
      console.log('📍 Real-time driver update:', data);
      setRealDrivers(prevDrivers => {
        const existingIndex = prevDrivers.findIndex(d => d.id === data.driverId);
        
        if (existingIndex >= 0) {
          // Update existing driver's location
          const updated = [...prevDrivers];
          updated[existingIndex] = {
            ...updated[existingIndex],
            lat: data.location.lat,
            lng: data.location.lng,
            heading: data.heading || data.location.heading || updated[existingIndex].heading || 0,
            last_update: 'Live'
          };
          console.log('📍 Updated driver location:', data.driverId);
          return updated;
        }
        
        // Driver not in array - don't add from location-only updates
        // (driver-availability-update handles adding/removing)
        console.log('⚠️ Location update for unknown driver:', data.driverId);
        return prevDrivers;
      });
    });
    
    // Listen for pending requests updates
    socketConnection.on('pending-requests-update', (data) => {
      console.log('📋 Pending requests update:', data);
      setLiveStats(prev => ({
        ...prev,
        pendingRequests: data.pendingRequests || 0
      }));
    });
    
    // Listen for driver availability updates
    socketConnection.on('driver-availability-update', (data) => {
      console.log('🚗 Dashboard: Driver availability update received:', data);
      
      setLiveStats(prev => ({
        ...prev,
        onlineDrivers: data.totalDrivers || 0
      }));
      
      // Also handle individual driver status changes
      if (data.driverId) {
        console.log('🔧 Processing driver update:', data.driverId, 'status:', data.status, 'location:', data.location);
        console.log('🔧 Data isAvailable:', data.isAvailable, 'status check:', data.status === 'online', 'location check:', !!data.location);
        
        setRealDrivers(prevDrivers => {
          console.log('🔧 Current drivers before update:', prevDrivers.length, prevDrivers.map(d => `${d.name}(${d.user_type})`));
          
          // Remove any existing driver with this ID
          const updated = prevDrivers.filter(d => d.id !== data.driverId);
          console.log('🔧 After removing existing driver:', updated.length);
          
          // Add driver if online and has location  
          if (data.status === 'online' && data.location && data.isAvailable) {
            const newDriver = {
              id: data.driverId,
              name: `Driver ${data.driverId.slice(-4)}`,
              email: 'driver@example.com',
              user_type: 'driver',
              rating: 5.0,
              status: 'available',
              lat: data.location.lat,
              lng: data.location.lng,
              heading: data.location.heading || 0,
              last_update: 'Live'
            };
            updated.push(newDriver);
            console.log('✅ Added driver to map:', newDriver.name, 'at', newDriver.lat, newDriver.lng);
          } else {
            console.log('❌ Driver not added - status:', data.status, 'hasLocation:', !!data.location, 'isAvailable:', data.isAvailable);
          }
          
          console.log('📊 Total entities on map after driver update:', updated.length);
          console.log('📊 Updated drivers list:', updated.map(d => `${d.name}(${d.user_type}) at ${d.lat},${d.lng}`));
          return updated;
        });
      } else {
        console.log('❌ No driverId in driver update data');
      }
    });
    
    // Progressive green lights fix deployed - rider ID mismatch resolved

    // Listen for rider availability updates  
    socketConnection.on('rider-availability-update', (data) => {
      console.log('📡 Dashboard: Rider availability update received:', data);
      
      // Update riders list for map display
      if (data.riders) {
        const riders = data.riders.map((rider: any) => ({
          id: rider.riderId,
          name: rider.name || `Rider ${rider.riderId?.slice(-4)}`,
          email: 'rider@example.com',
          user_type: 'rider',
          status: rider.status || 'online',
          lat: rider.lat,
          lng: rider.lng,
          last_update: 'Live'
        }));
        
        // Store riders in the dedicated riders state
        setRealRiders(riders);
        
        console.log(`👤 Dashboard: ${data.totalRiders} riders online, added to map`);
      }
    });
    
    return () => {
      socketConnection.disconnect();
    };
  }, []);
  
  // Fetch active rides for dashboard
  const fetchActiveRides = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch(apiUrl('api/rides/active'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setActiveRides(data.rides || []);
          console.log(`🚗 Dashboard: ${data.rides?.length || 0} active rides`);
        }
      }
    } catch (error) {
      console.error('Error fetching active rides:', error);
    }
  };

  // Fetch airport waiting lots for map display
  const fetchAirportLots = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch(apiUrl('api/airports/rideshare-lots'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.lots) {
          setAirportLots(data.lots);
          console.log(`✈️ Dashboard: ${data.lots.length} airport lots loaded`);
        }
      }
    } catch (error) {
      console.error('Error fetching airport lots:', error);
    }
  };

  // Fetch real analytics data
  const fetchRealAnalytics = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;
      
      const response = await fetch(apiUrl('api/admin/analytics'), {
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => null);
      
      if (response && response.ok) {
        const data = await response.json().catch(() => null);
        if (!data) return;
        setLiveStats(prev => ({
          ...prev,
          totalRevenue: data.totalRevenue || 0,
          activeRides: data.activeRides || 0,
          completedRides: data.completedRides || 0,
          onlineDrivers: data.onlineDrivers || prev.onlineDrivers || 0
        }));
      }
    } catch (error) {
      console.log('Unable to fetch analytics:', error);
    }
  };

  // Fetch real data when component mounts or market changes
  useEffect(() => {
    fetchRealAnalytics();
    fetchActiveRides();
    fetchAirportLots();  // Add this line
    fetchSurgeData();
    fetchHeatmapData();
  }, [selectedMarket]);
  
  // Auto-refresh analytics every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchHeatmapData();
      fetchActiveRides();
    }, 30000);
    return () => clearInterval(interval);
  }, []);
  

  // Dynamic stats based on real-time data
  const stats = [
    {
      title: 'Pending Requests',
      value: liveStats.pendingRequests.toString(),
      change: '+0.0%',
      positive: true,
      color: '#f59e0b',
      icon: Clock
    },
    {
      title: 'Active Rides',
      value: liveStats.activeRides.toString(),
      change: '+0.0%',
      positive: true,
      color: '#3b82f6',
      icon: Car
    },
    {
      title: 'Online Drivers',
      value: liveStats.onlineDrivers.toString(),
      change: '+0.0%',
      positive: true,
      color: '#10b981',
      icon: Users
    },
    {
      title: 'Today Revenue',
      value: `$${liveStats.totalRevenue.toFixed(2)}`,
      change: '+0.0%',
      positive: true,
      color: '#ef4444',
      icon: DollarSign
    }
  ];
  
  // Sample chart data for today's activity
  const chartData = [
    { time: '6 AM', rides: 2 },
    { time: '8 AM', rides: 8 },
    { time: '10 AM', rides: 12 },
    { time: '12 PM', rides: 18 },
    { time: '2 PM', rides: 15 },
    { time: '4 PM', rides: 22 },
    { time: '6 PM', rides: 25 },
    { time: '8 PM', rides: 20 },
    { time: '10 PM', rides: 12 }
  ];
  
  // Sample recent activities
  const activities = [
    {
      id: 1,
      user: 'Driver John',
      action: 'completed a ride',
      time: '2 min ago',
      avatar: '🚗'
    },
    {
      id: 2,
      user: 'Rider Sarah',
      action: 'requested a ride',
      time: '5 min ago',
      avatar: '👤'
    },
    {
      id: 3,
      user: 'Driver Mike',
      action: 'went online',
      time: '8 min ago',
      avatar: '🚗'
    }
  ];

  // Fetch surge heatmap data for visualization
  const fetchHeatmapData = async () => {
  try {
    const token = localStorage.getItem('authToken');
    if (!token) return;
    console.log('🔥 Dashboard: Fetching active surge zones...');
    const response = await fetch(apiUrl('api/admin/surge/active-zones'), {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        setHeatmapZones(data.zones || []);
        console.log(`🔥 Dashboard: ${data.zones?.length || 0} active surge zones`);
      }
    }
  } catch (error) {
    console.error('❌ Error fetching grid cells:', error);
    setHeatmapZones([]);
    }
  };

  // Fetch surge configuration data
  const fetchSurgeData = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const headers = { 'Authorization': `Bearer ${token}` };

      const [zonesRes, timeRulesRes, weatherRulesRes, configRes, statusRes] = await Promise.all([
        fetch(apiUrl('api/admin/surge/zones'), { headers }).catch(() => ({ ok: false, json: () => Promise.resolve([]) })),
        fetch(apiUrl('api/admin/surge/time-rules'), { headers }).catch(() => ({ ok: false, json: () => Promise.resolve([]) })),
        fetch(apiUrl('api/admin/surge/weather-rules'), { headers }).catch(() => ({ ok: false, json: () => Promise.resolve([]) })),
        fetch(apiUrl('api/admin/surge/algorithm-config'), { headers }).catch(() => ({ ok: false, json: () => Promise.resolve({}) })),
        fetch(apiUrl('api/admin/surge/current-status'), { headers }).catch(() => ({ ok: false, json: () => Promise.resolve({}) }))
      ]);

      if (zonesRes.ok) {
        const data = await zonesRes.json();
        setSurgeZones(data.zones || []);
      }
      if (timeRulesRes.ok) {
        const data = await timeRulesRes.json();
        setTimeRules(data.rules || []);
      }
      if (weatherRulesRes.ok) {
        const data = await weatherRulesRes.json();
        setWeatherRules(data.rules || []);
      }
      if (configRes.ok) {
        const data = await configRes.json();
        setAlgorithmConfig(data.config || []);
      }
      if (statusRes.ok) {
        const data = await statusRes.json();
        setCurrentSurgeStatus(data.zones || []);
      }
    } catch (error) {
      console.error('Error fetching surge data:', error);
    }
  };

  // Handle surge configuration updates
  const updateSurgeConfig = async (endpoint: string, data: any, method = 'PUT') => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch(apiUrl(endpoint), {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        await fetchSurgeData(); // Refresh data
        setShowSurgeModal(false);
        setFormData({});
      }
    } catch (error) {
      console.error('Error updating surge config:', error);
    }
  };

  // Set manual surge override
  const setSurgeOverride = async (zoneId: string, multiplier: number, reason: string, expiresAt?: string) => {
    await updateSurgeConfig(`api/admin/surge/override/${zoneId}`, {
      manualMultiplier: multiplier,
      overrideReason: reason,
      expiresAt
    }, 'POST');
  };

  // Remove surge override
  const removeSurgeOverride = async (zoneId: string) => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const response = await fetch(apiUrl(`api/admin/surge/override/${zoneId}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        await fetchSurgeData();
      }
    } catch (error) {
      console.error('Error removing surge override:', error);
    }
  };

  // Use real drivers instead of mock data

  // Real statistics will be calculated dynamically from liveStats

  // This section was cleaned up - real-time Socket.IO approach is used above

  // Real-time stats are now handled by Socket.IO above

  // chartData is already defined above in the stats section

  // activities is already defined above in the stats section

  // Initialize Google Maps
  useEffect(() => {
    console.log('🗺️ Dashboard Google Maps initializing (auto-refresh paused)');
    initializeGoogleMaps();

    // Cleanup function to prevent memory leaks
    return () => {
      if (adminMarker) {
        adminMarker.setMap(null);
      }
      if (radiusCircle) {
        radiusCircle.setMap(null);
      }
      driverMarkers.forEach(marker => marker.setMap(null));
      riderMarkers.forEach(marker => marker.setMap(null));
    };
  }, []);

  // Load Google Maps API key and script
  useEffect(() => {
    const loadGoogleMaps = async () => {
      try {
        // Get API key from server
        const response = await fetch(apiUrl('api/config/maps-key')).catch(() => null);
        if (!response || !response.ok) {
          console.warn('Maps API key not available, using environment variable');
          initializeMap();
          return;
        }
        const data = await response.json().catch(() => null);
        if (!data) {
          initializeMap();
          return;
        }

        if (!data.key) {
          setMapError('Google Maps API key not configured. Please add GMaps_Key to your environment variables.');
          return;
        }

        // Load Google Maps if not already loaded
        if (!window.google) {
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${data.key}&libraries=places,geometry`;
          script.async = true;
          script.defer = true;
          script.onload = () => {
            setMapsLoaded(true);
          };
          script.onerror = () => {
            console.error('Failed to load Google Maps');
            setMapError('Failed to load Google Maps. Please check your API key configuration.');
          };
          document.head.appendChild(script);
        } else {
          setMapsLoaded(true);
        }
      } catch (error) {
        console.error('Error loading Google Maps config:', error);
        setMapError('Failed to load Google Maps configuration.');
      }
    };

    loadGoogleMaps();
  }, []);


  // Track admin location
  useEffect(() => {
    if (map && isMapLoaded) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setAdminLocation(location);

          // Add admin location marker
          if (adminMarker) {
            adminMarker.setMap(null);
          }

          // Add admin location marker using AdvancedMarkerElement
          if (window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement) {
            new window.google.maps.marker.AdvancedMarkerElement({
              position: location,
              map: map,
              title: 'Your Admin Location'
            });
          } else {
            // Fallback to regular marker if AdvancedMarkerElement is not available
            const adminMarker = new window.google.maps.Marker({
              position: location,
              map: map,
              title: 'Your Admin Location',
              icon: {
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                  <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="16" cy="16" r="14" fill="#dc2626" stroke="white" stroke-width="3"/>
                    <text x="16" y="20" text-anchor="middle" fill="white" font-size="12" font-weight="bold">A</text>
                  </svg>
                `),
                scaledSize: new window.google.maps.Size(32, 32),
                anchor: new window.google.maps.Point(16, 16)
              }
            });

            const infoWindow = new window.google.maps.InfoWindow({
              content: `
                <div style="padding: 8px; font-family: Arial, sans-serif;">
                  <div style="font-weight: bold; color: #dc2626;">👨‍💼 Admin Location</div>
                  <div style="font-size: 12px; color: #6b7280; margin: 4px 0;">Live GPS Position</div>
                  <div style="font-size: 12px; margin: 2px 0;">
                    📍 ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}
                  </div>
                </div>
              `
            });

            adminMarker.addListener('click', () => {
              infoWindow.open(map, adminMarker);
            });
          }


          // Admin marker handled above
          console.log('📍 Admin location added to Dashboard map:', location);
        },
        (error) => {
          console.log('📍 Admin location unavailable:', error.message);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        }
      );
    }
  }, [map, isMapLoaded]);

  // Update markers when visibility toggles change
  useEffect(() => {
    if (map && isMapLoaded) {
      updateMarkers();
    }
  }, [showDrivers, showRiders, map, isMapLoaded]);

  // Update markers when driver/rider data changes
  useEffect(() => {
    if (map && isMapLoaded) {
      console.log('🔄 Dashboard: Updating markers due to realDrivers change, count:', realDrivers.length);
      updateMarkers();
    }
  }, [realDrivers, realRiders, map, isMapLoaded]);

  // Update map when market changes
  useEffect(() => {
    if (selectedMarket && map && isMapLoaded) {
      updateMapForMarket();
    }
  }, [selectedMarket, map, isMapLoaded]);

  // Update radius circle when radius changes
  useEffect(() => {
    if (map && isMapLoaded) {
      updateRadiusCircle();
    }
  }, [marketRadius, selectedMarket, map, isMapLoaded]);

// Helper function to create car icon for Google Maps
  const createTopDownCarIcon = (color: string, rotation: number = 0, size: number = 32) => {
   return {
    url: PiCarIcon,
    scaledSize: new window.google.maps.Size(size, size * 1.35),
    anchor: new window.google.maps.Point(size / 2, (size * 1.2) / 2)
   };
   };

  const initializeGoogleMaps = () => {
    // Prevent multiple initializations during hot reload
    if (map || (window.google && window.google.maps && isMapLoaded)) {
      console.log('🗺️ Dashboard map already initialized - skipping');
      return;
    }

    if (window.google && window.google.maps) {
      initializeMap();
      return;
    }

    // Remove any existing broken scripts first
    const existingScripts = document.querySelectorAll('script[src*="maps.googleapis.com"]');
    existingScripts.forEach(script => {
      const scriptEl = script as HTMLScriptElement;
      if (scriptEl.src && (scriptEl.src.includes('%VITE_GMAPS_KEY%') || scriptEl.src.includes('YOUR_GOOGLE_MAPS_API_KEY'))) {
        console.log('🗺️ Removing broken Google Maps script');
        script.remove();
      }
    });

    // Check if a valid script already exists
    const validScript = document.querySelector('script[src*="maps.googleapis.com"][src*="AIza"]');
    if (validScript) {
      console.log('🗺️ Valid Google Maps script already loaded - waiting for initialization');
      if (window.google && window.google.maps) {
        initializeMap();
      }
      return;
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY') {
      console.error('❌ Google Maps API key not found. Please check your .env file.');
      setIsMapLoaded(false);
      return;
    }

    console.log('🗺️ Loading Google Maps API with key:', apiKey.substring(0, 10) + '...');

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry,visualization&callback=initDashboardMap&loading=async`;
    script.async = true;
    script.defer = true;

    window.initDashboardMap = () => {
      console.log('✅ Google Maps API loaded successfully for dashboard');
      initializeMap();
    };

    script.onerror = (error) => {
      console.error('❌ Failed to load Google Maps API:', error);
      setIsMapLoaded(false);
    };

    document.head.appendChild(script);
  };

  const initializeMap = () => {
    if (!mapRef.current || !window.google || !window.google.maps) {
      console.error('Map container or Google Maps API not available');
      return;
    }

    try {
      const mapInstance = new window.google.maps.Map(mapRef.current, {
        center: adminLocation || (selectedMarket ? selectedMarket.center : { lat: 36.3729, lng: -94.2088 }), // Use admin location or Bentonville, AR
        zoom: selectedMarket ? selectedMarket.zoom : 4,
        mapTypeId: 'roadmap',
        styles: [
          {
            "featureType": "poi",
            "elementType": "labels",
            "stylers": [{ "visibility": "off" }]
          },
          {
            "featureType": "transit",
            "elementType": "labels",
            "stylers": [{ "visibility": "off" }]
          }
        ],
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        gestureHandling: 'cooperative',
      });

      setMap(mapInstance);
      setIsMapLoaded(true);
      console.log('Dashboard map initialized');

      // Add initial markers
      updateMarkers(mapInstance);

    } catch (error) {
      console.error('Error initializing dashboard map:', error);
      setIsMapLoaded(false);
    }
  };

  const updateMarkers = (mapInstance?: any) => {
    const currentMap = mapInstance || map;
    if (!currentMap || !window.google) return;

    // Clear existing markers
    driverMarkers.forEach(marker => marker.setMap(null));
    riderMarkers.forEach(marker => marker.setMap(null));
    airportMarkers.forEach(marker => marker.setMap(null));

    const newDriverMarkers: any[] = [];
    const newRiderMarkers: any[] = [];

    // Add driver and rider markers (they're both in realDrivers array)
    console.log('🔧 Dashboard: Creating markers for', realDrivers.length, 'users. Selected market:', selectedMarket?.name || 'none');
    realDrivers.forEach(user => {
        if (user.user_type === 'driver' && showDrivers) {
          const color = user.status === 'available' ? '#10b981' :
                       user.status === 'busy' ? '#f59e0b' : '#6b7280';

          const icon = createTopDownCarIcon(color, user.heading || 0, 24);

          const marker = new window.google.maps.Marker({
            position: { lat: user.lat, lng: user.lng },
            map: currentMap,
            icon: icon,
            title: `Driver: ${user.name}`
          });

          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div style="padding: 8px; font-family: Arial, sans-serif;">
                <div style="font-weight: bold; color: #1f2937;">🚗 ${user.name}</div>
                <div style="font-size: 12px; color: #6b7280; margin: 4px 0;">ID: ${user.id}</div>
                <div style="font-size: 12px; margin: 2px 0;">
                  <span style="color: ${color}; font-weight: bold;">●</span> ${user.status.toUpperCase()}
                </div>
                <div style="font-size: 12px; margin: 2px 0;">
                  ⭐ ${user.rating || 5.0} rating
                </div>
              </div>
            `
          });

          marker.addListener('click', () => {
            infoWindow.open(currentMap, marker);
          });

          newDriverMarkers.push(marker);
        }
      });

    // Also add riders
    realRiders.forEach(user => {
        if (user.user_type === 'rider' && showRiders) {
          const color = user.status === 'waiting' ? '#ef4444' :
                       user.status === 'matched' ? '#f59e0b' : '#8b5cf6';

          const riderName = user.name?.split(' ')[0] || 'Rider';
          const icon = {
             url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg width="60" height="50" viewBox="0 0 60 50" xmlns="http://www.w3.org/2000/svg">
              <path d="M30 0C23.372 0 18 5.372 18 12c0 12 12 18 12 18s12-6 12-18C42 5.372 36.628 0 30 0z" fill="${color}"/>
              <circle cx="30" cy="12" r="6" fill="white"/>
              <text x="30" y="16" text-anchor="middle" fill="${color}" font-size="8" font-weight="bold">👤</text>
              <rect x="5" y="34" width="50" height="14" rx="3" fill="white" stroke="${color}" stroke-width="1"/>
              <text x="30" y="45" text-anchor="middle" fill="#1f2937" font-size="10" font-weight="bold">${riderName}</text>
              </svg>
        `),
           scaledSize: new window.google.maps.Size(60, 50),
           anchor: new window.google.maps.Point(30, 30)
 };

          const marker = new window.google.maps.Marker({
           position: { lat: user.lat, lng: user.lng },
           map: currentMap,
           icon: icon,
           title: `Rider: ${user.name?.split(' ')[0] || 'Rider'}`,
           label: {
           text: user.name?.split(' ')[0] || 'Rider',
           color: '#1f2937',
           fontSize: '11px',
           fontWeight: 'bold',
           className: 'rider-marker-label'
       }
    });

       // Create name label that's always visible
           const nameLabel = new window.google.maps.InfoWindow({
            content: `<div style="background: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; color: #1f2937; white-space: nowrap;">${riderName}</div>`,
            disableAutoPan: true
            });
            nameLabel.open(currentMap, marker);

          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div style="padding: 8px; font-family: Arial, sans-serif;">
                <div style="font-weight: bold; color: #1f2937;">👤 ${user.name?.split(' ')[0] || 'Rider'}</div>
                <div style="font-size: 12px; color: #6b7280; margin: 4px 0;">ID: ${user.id}</div>
                <div style="font-size: 12px; margin: 2px 0;">
                  <span style="color: ${color}; font-weight: bold;">●</span> ${user.status.toUpperCase()}
                </div>
                <div style="font-size: 12px; margin: 2px 0;">
                  📍 Live Location
                </div>
              </div>
            `
          });

          marker.addListener('click', () => {
            infoWindow.open(currentMap, marker);
          });

          newRiderMarkers.push(marker);
        }
      });

      // Add airport waiting lot markers
    const newAirportMarkers: any[] = [];
    airportLots.forEach(lot => {
      if (lot.lat && lot.lng) {
        const icon = {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
              <rect x="5" y="5" width="30" height="30" rx="4" fill="#3b82f6" stroke="#1d4ed8" stroke-width="2"/>
              <text x="20" y="27" text-anchor="middle" fill="white" font-size="18">✈️</text>
              <rect x="2" y="38" width="36" height="12" rx="2" fill="white" stroke="#3b82f6" stroke-width="1"/>
              <text x="20" y="47" text-anchor="middle" fill="#1e40af" font-size="7" font-weight="bold">${lot.airportCode || 'APT'}</text>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(40, 50),
          anchor: new window.google.maps.Point(20, 50)
        };

        const marker = new window.google.maps.Marker({
          position: { lat: lot.lat, lng: lot.lng },
          map: currentMap,
          icon: icon,
          title: lot.name || 'Airport Waiting Lot'
        });

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="padding: 10px; font-family: Arial, sans-serif; min-width: 180px;">
              <div style="font-weight: bold; color: #1e40af; font-size: 14px;">✈️ ${lot.airportName || 'Airport'}</div>
              <div style="font-size: 12px; color: #3b82f6; margin: 4px 0;">${lot.airportCode || ''}</div>
              <div style="font-size: 13px; color: #1f2937; margin: 8px 0; padding: 6px; background: #f0f9ff; border-radius: 4px;">
                🅿️ <strong>${lot.name || 'Waiting Lot'}</strong>
              </div>
              <div style="font-size: 11px; color: #6b7280;">
                📍 ${lot.lat.toFixed(6)}, ${lot.lng.toFixed(6)}
              </div>
              <div style="font-size: 12px; margin-top: 8px;">
                <div style="font-weight: 600; color: #1f2937; margin-bottom: 4px;">Queue by Type:</div>
                <div style="font-size: 11px;">
                  ${Object.entries(lot.queueByVehicleType || {}).map(([type, count]) => 
                    `<div>${type}: ${count}</div>`
                  ).join('')}
                </div>
                <div style="margin-top: 4px; color: #059669; font-weight: 600;">
                  👥 Total: ${lot.queueSize || 0} drivers
                </div>
              </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(currentMap, marker);
        });

        newAirportMarkers.push(marker);
      }
    });

    setAirportMarkers(newAirportMarkers);
    setDriverMarkers(newDriverMarkers);
    setRiderMarkers(newRiderMarkers);
  };

  const updateMapForMarket = () => {
    if (!map || !window.google || !selectedMarket) return;

    // Update map center and zoom
    map.setCenter(selectedMarket.center);
    map.setZoom(selectedMarket.zoom);

    // Update radius
    setMarketRadius(selectedMarket.radius);

    // Clear and update markers for new market
    updateMarkers();
    updateRadiusCircle();
  };

  const updateRadiusCircle = () => {
    if (!map || !window.google || !selectedMarket) return;

    // Remove existing circle
    if (radiusCircle) {
      radiusCircle.setMap(null);
    }

    // Create new radius circle
    const circle = new window.google.maps.Circle({
      strokeColor: '#3b82f6',
      strokeOpacity: 0.6,
      strokeWeight: 2,
      fillColor: '#3b82f6',
      fillOpacity: 0.1,
      map: map,
      center: selectedMarket.center,
      radius: marketRadius * 1609.34 // Convert miles to meters
    });

    setRadiusCircle(circle);
  };

  const handleMarketChange = (marketId: string) => {
    const market = availableMarkets.find(m => m.id === marketId);
    if (market) {
      setSelectedMarket(market);
    }
  };

  const handleRadiusChange = (radius: number) => {
    setMarketRadius(radius);
    setSelectedMarket(prev => prev ? { ...prev, radius } : null);
  };

  return (
    <div>
      {/* Market Selector */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '24px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr auto',
          gap: '20px',
          alignItems: 'end'
        }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Select Market
            </label>
            <select
              value={selectedMarket?.id || ''}
              onChange={(e) => {
                const market = availableMarkets.find(m => m.id === e.target.value);
                if (market) setSelectedMarket(market);
              }}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                backgroundColor: 'white',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {availableMarkets.map(market => (
                <option key={market.id} value={market.id}>
                  {market.city}, {market.state}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Service Radius: {marketRadius} miles
            </label>
            <input
              type="range"
              min="5"
              max="50"
              step="1"
              value={marketRadius}
              onChange={(e) => handleRadiusChange(Number(e.target.value))}
              style={{
                width: '100%',
                height: '6px',
                borderRadius: '5px',
                background: '#e5e7eb',
                outline: 'none',
                cursor: 'pointer'
              }}
            />
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: '#6b7280',
              marginTop: '4px'
            }}>
              <span>5 miles</span>
              <span>50 miles</span>
            </div>
          </div>

          <div style={{
            background: '#f8fafc',
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Coverage Area</div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>
              {(Math.PI * marketRadius * marketRadius).toFixed(0)} mi²
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>
              {selectedMarket?.timezone || 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Map Section */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '24px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <div>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '700',
              color: '#1e293b',
              margin: '0 0 4px 0'
            }}>
              Live Activity Map
            </h2>
            <p style={{
              fontSize: '14px',
              color: '#64748b',
              margin: 0
            }}>
              Real-time overview of riders and drivers in the trade area
            </p>
          </div>

          {/* Map Controls */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => setShowDrivers(!showDrivers)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                backgroundColor: showDrivers ? '#10b981' : '#f1f5f9',
                color: showDrivers ? 'white' : '#64748b',
                border: `2px solid ${showDrivers ? '#10b981' : '#e2e8f0'}`,
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {showDrivers ? <Eye size={14} /> : <EyeOff size={14} />}
              Drivers ({realDrivers.filter(d => d.user_type === 'driver' && d.status !== 'offline').length})
            </button>

            <button
              onClick={() => setShowRiders(!showRiders)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                backgroundColor: showRiders ? '#3b82f6' : '#f1f5f9',
                color: showRiders ? 'white' : '#64748b',
                border: `2px solid ${showRiders ? '#3b82f6' : '#e2e8f0'}`,
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {showRiders ? <Eye size={14} /> : <EyeOff size={14} />}
              Riders ({realRiders.length})
            </button>

            <div
             style={{
             display: 'flex',
             alignItems: 'center',
             gap: '6px',
             padding: '8px 12px',
             backgroundColor: heatmapZones.length > 0 ? '#fef2f2' : '#f1f5f9',
             color: heatmapZones.length > 0 ? '#dc2626' : '#64748b',
             border: `2px solid ${heatmapZones.length > 0 ? '#fecaca' : '#e2e8f0'}`,
             borderRadius: '8px',
             fontSize: '12px',
             fontWeight: '600'
           }}
>
           <TrendingUp size={14} />
           Surge Zones: {heatmapZones.length}
          </div>
          </div>
        </div>

        {/* Map Container */}
        <div style={{
          height: '400px',
          position: 'relative',
          backgroundColor: '#f8fafc',
          borderRadius: '12px',
          border: '2px solid #e2e8f0',
          overflow: 'hidden'
        }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
          
          {showHeatmap && map && (
            <>
              {/* @ts-ignore */}
              <SurgeHeatmapOverlayAny
                map={map}
                gridCells={heatmapZones}
                onZoneClick={(zone: any) => {
                  console.log('🗺️ Surge zone clicked:', zone);
                  // Could open zone details modal here
                }}
              />
            </>
          )}
          

          {!isMapLoaded && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              textAlign: 'center',
              padding: '20px'
            }}>
              <div>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗺️</div>
                <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Loading Live Map...</div>
                <div style={{ fontSize: '14px', opacity: 0.8 }}>Connecting to Google Maps</div>
              </div>
            </div>
          )}

          {mapError && (
            <GoogleMapsError error={mapError} />
          )}

          {/* Map Legend */}
          {isMapLoaded && (
            <div style={{
              position: 'absolute',
              bottom: '16px',
              left: '16px',
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(10px)',
              padding: '12px',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              fontSize: '12px'
            }}>
              <div style={{ fontWeight: '600', marginBottom: '8px', color: '#1e293b' }}>Map Legend</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontWeight: '600', fontSize: '11px', color: '#64748b', marginBottom: '2px', borderBottom: '1px solid #e2e8f0', paddingBottom: '2px' }}>
                  DRIVERS (🚗 Car Icons)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                  <span style={{ fontSize: '11px' }}>Available</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></div>
                  <span style={{ fontSize: '11px' }}>Busy</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#6b7280' }}></div>
                  <span style={{ fontSize: '11px' }}>Offline</span>
                </div>
                
                <div style={{ fontWeight: '600', fontSize: '11px', color: '#64748b', marginTop: '6px', marginBottom: '2px', borderBottom: '1px solid #e2e8f0', paddingBottom: '2px' }}>
                  RIDERS (📍 Location Pins)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#8b5cf6' }}></div>
                  <span style={{ fontSize: '11px' }}>Online</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
                  <span style={{ fontSize: '11px' }}>Waiting for Ride</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></div>
                  <span style={{ fontSize: '11px' }}>Matched</span>
                </div>

                {/* Surge Heatmap Legend */}
                {showHeatmap && (
                  <>
                    <div style={{ fontWeight: '600', fontSize: '11px', color: '#64748b', marginTop: '6px', marginBottom: '2px', borderBottom: '1px solid #e2e8f0', paddingBottom: '2px' }}>
                      SURGE ZONES (🎯 Color Overlays)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                      <span style={{ fontSize: '11px' }}>Normal (1.0-1.2x)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#84cc16' }}></div>
                      <span style={{ fontSize: '11px' }}>Low Surge (1.2-1.5x)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#eab308' }}></div>
                      <span style={{ fontSize: '11px' }}>Medium Surge (1.5-2.0x)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f97316' }}></div>
                      <span style={{ fontSize: '11px' }}>High Surge (2.0-2.5x)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
                      <span style={{ fontSize: '11px' }}>Extreme Surge (2.5x+)</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Live Stats Overlay */}
          {isMapLoaded && (
            <div style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(10px)',
              padding: '12px',
              borderRadius: '8px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              fontSize: '12px'
            }}>
              <div style={{ fontWeight: '600', marginBottom: '8px', color: '#1e293b' }}>Live Stats</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div>🚗 {realDrivers.filter(d => d.status === 'available').length} Available</div>
                <div>🟡 {realDrivers.filter(d => d.status === 'busy').length} Busy</div>
                <div>👤 {realRiders.length} Total Riders</div>
                <div>⏳ {realRiders.filter(r => r.status === 'waiting' || r.status === 'online').length} Waiting</div>
                <div>🚗 {realRiders.filter(r => r.status === 'riding').length} Active Rides</div>
              </div>
            </div>
          )}
        </div>
      </div>
{/* Active Rides Section */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '24px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <div>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '700',
              color: '#1e293b',
              margin: '0 0 4px 0'
            }}>
              🚗 Active Rides
            </h2>
            <p style={{
              fontSize: '14px',
              color: '#64748b',
              margin: 0
            }}>
              Real-time view of rides in progress
            </p>
          </div>
          <button
            onClick={fetchActiveRides}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              color: '#475569',
              cursor: 'pointer'
            }}
          >
            🔄 Refresh
          </button>
        </div>

        {activeRides.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#64748b',
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            border: '2px dashed #e2e8f0'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🚗</div>
            <div style={{ fontSize: '16px', fontWeight: '600' }}>No Active Rides</div>
            <div style={{ fontSize: '14px', marginTop: '4px' }}>Rides will appear here when drivers accept requests</div>
          </div>
        ) : (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {activeRides.map((ride) => (
              <div
                key={ride.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 2fr 2fr 100px 100px',
                  alignItems: 'center',
                  padding: '16px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '12px',
                  marginBottom: '12px',
                  border: '1px solid #e2e8f0',
                  gap: '16px'
                }}
              >
                {/* Status */}
                <div>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '600',
                    backgroundColor: 
                      ride.status === 'requested' ? '#fef3c7' :
                      ride.status === 'accepted' ? '#dbeafe' :
                      ride.status === 'en_route' ? '#d1fae5' :
                      ride.status === 'arrived' ? '#fce7f3' : '#f1f5f9',
                    color:
                      ride.status === 'requested' ? '#92400e' :
                      ride.status === 'accepted' ? '#1e40af' :
                      ride.status === 'en_route' ? '#065f46' :
                      ride.status === 'arrived' ? '#9d174d' : '#475569'
                  }}>
                    {ride.status === 'requested' ? '⏳ Requested' :
                     ride.status === 'accepted' ? '✅ Accepted' :
                     ride.status === 'en_route' ? '🚗 En Route' :
                     ride.status === 'arrived' ? '📍 Arrived' : ride.status}
                  </span>
                </div>

                {/* Pickup */}
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', marginBottom: '2px' }}>
                    📍 PICKUP
                  </div>
                  <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: '500' }}>
                    {ride.pickup_address?.substring(0, 40)}...
                  </div>
                </div>

                {/* Destination */}
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', marginBottom: '2px' }}>
                    🎯 DESTINATION
                  </div>
                  <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: '500' }}>
                    {ride.destination_address?.substring(0, 40)}...
                  </div>
                </div>

                {/* Rider */}
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', marginBottom: '2px' }}>
                    👤 RIDER
                  </div>
                  <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: '500' }}>
                    {ride.rider_name || 'Unknown'}
                  </div>
                </div>

                {/* Fare */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', marginBottom: '2px' }}>
                    💰 FARE
                  </div>
                  <div style={{ fontSize: '16px', color: '#10b981', fontWeight: '700' }}>
                    ${parseFloat(ride.estimated_fare || 0).toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="stat-card">
              <div className="stat-header">
                <span className="stat-title">{stat.title}</span>
                <div className="stat-icon" style={{ backgroundColor: `${stat.color}20`, color: stat.color }}>
                  <Icon size={24} />
                </div>
              </div>
              <div className="stat-value">{stat.value}</div>
              <div className={`stat-change ${stat.positive ? 'positive' : 'negative'}`}>
                <TrendingUp size={12} />
                {stat.change}
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts and Activity Feed */}
      <div className="dashboard-grid">
        <div className="chart-card">
          <h3 className="chart-title">Rides Today</h3>
          <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            📊 Chart temporarily disabled for debugging
          </div>
        </div>

        <div className="activity-feed">
          <div className="activity-header">
            <h3 className="chart-title">Recent Activity</h3>
          </div>
          <div className="activity-list">
            {activities.map((activity) => (
              <div key={activity.id} className="activity-item">
                <div className="activity-avatar">
                  {activity.avatar}
                </div>
                <div className="activity-content">
                  <div className="activity-text">
                    <strong>{activity.user}</strong> {activity.action}
                  </div>
                  <div className="activity-time">{activity.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Surge Pricing Management */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px'
          }}>
            <div>
              <h3 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#1e293b',
                marginBottom: '4px'
              }}>
                🚀 Surge Pricing Management
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#64748b',
                margin: 0
              }}>
                Configure dynamic pricing zones, rules, and overrides
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={fetchSurgeData}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                🔄 Refresh
              </button>
              
              <button
                onClick={() => {
                  const userInput = prompt(
                    '📍 Admin GPS not accurate?\n\nEnter your current city and state:\n(e.g., "Seattle, WA" or "Dallas, TX")'
                  );
                  
                  if (userInput && window.google && window.google.maps) {
                    const service = new window.google.maps.places.PlacesService(map);
                    const request = {
                      query: userInput,
                      fields: ['geometry', 'formatted_address']
                    };
                    
                    service.textSearch(request, (results: any[], status: any) => {
                      if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                        const place = results[0];
                        const newLocation = {
                          lat: place.geometry.location.lat(),
                          lng: place.geometry.location.lng()
                        };
                        
                        console.log('📍 Admin location manually calibrated to:', newLocation);
                        setAdminLocation(newLocation);
                        
                        // Update map center
                        if (map) {
                          map.setCenter(newLocation);
                          map.setZoom(13);
                          
                          // Update admin marker if it exists
                          if ((window as any).adminMarker) {
                            (window as any).adminMarker.setPosition(newLocation);
                          }
                        }
                        
                        alert(`✅ Admin location updated: ${place.formatted_address}`);
                      } else {
                        alert('❌ Could not find that location. Please try again.');
                      }
                    });
                  }
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#10b981',
                  border: '1px solid #059669',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: 'white',
                  cursor: 'pointer'
                }}
                title="Fix Admin GPS Location"
              >
                📍 Fix GPS
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div style={{
            display: 'flex',
            gap: '4px',
            marginBottom: '24px',
            borderBottom: '2px solid #f1f5f9',
            paddingBottom: '8px'
          }}>
            {[
              { id: 'overview', label: '📊 Overview', icon: '📊' },
              { id: 'zones', label: '🗺️ Zones', icon: '🗺️' },
              { id: 'time-rules', label: '⏰ Time Rules', icon: '⏰' },
              { id: 'weather', label: '🌦️ Weather', icon: '🌦️' },
              { id: 'algorithm', label: '⚙️ Algorithm', icon: '⚙️' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: activeTab === tab.id ? '#3b82f6' : 'transparent',
                  color: activeTab === tab.id ? 'white' : '#64748b',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '16px',
                marginBottom: '24px'
              }}>
                <div style={{
                  padding: '16px',
                  backgroundColor: '#f0f9ff',
                  borderRadius: '12px',
                  border: '1px solid #0ea5e9'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#0369a1', marginBottom: '8px' }}>
                    📍 Active Zones
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#0c4a6e' }}>
                    {currentSurgeStatus.length}
                  </div>
                </div>
                <div style={{
                  padding: '16px',
                  backgroundColor: '#fef3c7',
                  borderRadius: '12px',
                  border: '1px solid #f59e0b'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#92400e', marginBottom: '8px' }}>
                    🔥 Manual Overrides
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#78350f' }}>
                    {currentSurgeStatus.filter(z => z.has_override).length}
                  </div>
                </div>
                <div style={{
                  padding: '16px',
                  backgroundColor: '#f0fdf4',
                  borderRadius: '12px',
                  border: '1px solid #10b981'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#047857', marginBottom: '8px' }}>
                    ⏰ Time Rules
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#065f46' }}>
                    {timeRules.filter(r => r.is_active).length}
                  </div>
                </div>
              </div>

              {/* Current Surge Status */}
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', marginBottom: '12px' }}>
                  🔴 Live Surge Status
                </h4>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {currentSurgeStatus.slice(0, 10).map(zone => (
                    <div
                      key={zone.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px',
                        backgroundColor: zone.has_override ? '#fef2f2' : '#f8fafc',
                        borderRadius: '8px',
                        marginBottom: '8px',
                        border: `1px solid ${zone.has_override ? '#fca5a5' : '#e2e8f0'}`
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>
                          {zone.zone_type === 'airport' ? '✈️' : '🏙️'} {zone.zone_name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {zone.zone_code} • {zone.zone_type} • Tier {zone.tier_level}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: '16px',
                          fontWeight: '700',
                          color: zone.has_override ? '#dc2626' : zone.base_multiplier > 0 ? '#f59e0b' : '#10b981'
                        }}>
                          {zone.has_override ? `${zone.manual_multiplier}x` : `${zone.base_multiplier}x`}
                        </div>
                        {zone.has_override && (
                          <button
                            onClick={() => removeSurgeOverride(zone.id)}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#dc2626',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '10px',
                              cursor: 'pointer',
                              marginTop: '4px'
                            }}
                          >
                            Remove Override
                          </button>
                        )}
                        {!zone.has_override && (
                          <button
                            onClick={() => {
                              setSelectedZone(zone);
                              setSurgeModalType('override');
                              setShowSurgeModal(true);
                            }}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '10px',
                              cursor: 'pointer',
                              marginTop: '4px'
                            }}
                          >
                            Set Override
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'zones' && (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px'
              }}>
                <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', margin: 0 }}>
                  🗺️ Surge Zones ({surgeZones.length})
                </h4>
                <button
                  onClick={() => {
                    setSurgeModalType('new-zone');
                    setShowSurgeModal(true);
                    setFormData({});
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  + Add Zone
                </button>
              </div>
              
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {surgeZones.map(zone => (
                  <div
                    key={zone.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 120px 100px 100px 80px',
                      alignItems: 'center',
                      padding: '12px',
                      backgroundColor: zone.is_active ? '#f8fafc' : '#fef2f2',
                      borderRadius: '8px',
                      marginBottom: '8px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12px',
                      gap: '12px'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '600', color: '#1e293b', marginBottom: '2px' }}>
                        {zone.zone_type === 'airport' ? '✈️' : '🏙️'} {zone.zone_name}
                      </div>
                      <div style={{ color: '#64748b' }}>
                        {zone.zone_code} • {zone.latitude.toFixed(4)}, {zone.longitude.toFixed(4)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', color: '#64748b' }}>
                      Tier {zone.tier_level}
                    </div>
                    <div style={{ textAlign: 'center', fontWeight: '600', color: '#f59e0b' }}>
                      {zone.base_multiplier}x base
                    </div>
                    <div style={{ textAlign: 'center', color: '#64748b' }}>
                      {zone.radius}km radius
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: zone.is_active ? '#10b981' : '#ef4444',
                        margin: '0 auto'
                      }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'time-rules' && (
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', marginBottom: '16px' }}>
                ⏰ Time-based Surge Rules ({timeRules.length})
              </h4>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {timeRules.map(rule => (
                  <div
                    key={rule.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px',
                      backgroundColor: rule.is_active ? '#f8fafc' : '#fef2f2',
                      borderRadius: '8px',
                      marginBottom: '8px',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '2px' }}>
                        {rule.rule_name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {rule.start_hour}:00 - {rule.end_hour}:00 • {rule.rule_type}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '700',
                        color: rule.is_active ? '#f59e0b' : '#94a3b8'
                      }}>
                        +{rule.surge_multiplier}x
                      </div>
                      <div style={{
                        fontSize: '10px',
                        color: rule.is_active ? '#10b981' : '#ef4444',
                        fontWeight: '600'
                      }}>
                        {rule.is_active ? 'ACTIVE' : 'DISABLED'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'weather' && (
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', marginBottom: '16px' }}>
                🌦️ Weather-based Surge Rules
              </h4>
              <div style={{ display: 'grid', gap: '12px' }}>
                {weatherRules.map(rule => (
                  <div
                    key={rule.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <div style={{ fontSize: '24px' }}>
                        {rule.weather_condition === 'clear' ? '☀️' : 
                         rule.weather_condition === 'rain' ? '🌧️' :
                         rule.weather_condition === 'snow' ? '❄️' : '⛈️'}
                      </div>
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', textTransform: 'capitalize' }}>
                          {rule.weather_condition}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          Weather-based surge multiplier
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: '20px',
                        fontWeight: '700',
                        color: rule.surge_multiplier > 0 ? '#f59e0b' : '#10b981'
                      }}>
                        +{rule.surge_multiplier}x
                      </div>
                      <div style={{
                        fontSize: '10px',
                        color: rule.is_active ? '#10b981' : '#ef4444',
                        fontWeight: '600'
                      }}>
                        {rule.is_active ? 'ENABLED' : 'DISABLED'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'algorithm' && (
            <div>
              <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', marginBottom: '16px' }}>
                ⚙️ Algorithm Configuration
              </h4>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {algorithmConfig.map(config => (
                  <div
                    key={config.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '8px',
                      marginBottom: '12px',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>
                        {config.config_key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {config.config_description}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '700',
                        color: '#3b82f6'
                      }}>
                        {config.config_value}
                      </div>
                      <div style={{
                        fontSize: '10px',
                        color: config.is_active ? '#10b981' : '#ef4444',
                        fontWeight: '600'
                      }}>
                        {config.is_active ? 'ACTIVE' : 'DISABLED'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Surge Override Modal */}
        {showSurgeModal && (
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
              borderRadius: '16px',
              padding: '24px',
              width: '90%',
              maxWidth: '500px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}>
              {surgeModalType === 'override' && (
                <>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: '#1e293b' }}>
                    🔥 Set Manual Surge Override
                  </h3>
                  <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>
                    Zone: <strong>{selectedZone?.zone_name}</strong>
                  </p>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#374151' }}>
                      Surge Multiplier
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="1.0"
                      max="10.0"
                      value={formData.manualMultiplier || '1.0'}
                      onChange={(e) => setFormData({...formData, manualMultiplier: parseFloat(e.target.value)})}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '4px', color: '#374151' }}>
                      Reason
                    </label>
                    <input
                      type="text"
                      value={formData.overrideReason || ''}
                      onChange={(e) => setFormData({...formData, overrideReason: e.target.value})}
                      placeholder="e.g., Special event, weather emergency"
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setShowSurgeModal(false)}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (selectedZone && formData.manualMultiplier && formData.overrideReason) {
                          setSurgeOverride(selectedZone.id, formData.manualMultiplier, formData.overrideReason);
                        }
                      }}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Set Override
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* QR Codes for Mobile Apps */}
        <div className="qr-code-card">
          <h3 className="chart-title">Mobile App QR Codes</h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            padding: '10px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <h4 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#1e293b',
                marginBottom: '12px'
              }}>
                🚗 Driver App
              </h4>
              <QRCodeGenerator url={`${window.location.origin}/driver`} size={150} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h4 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#1e293b',
                marginBottom: '12px'
              }}>
                👤 Rider App
              </h4>
              <QRCodeGenerator url={`${window.location.origin}/rider`} size={150} />
            </div>
          </div>
          <div style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#f0f9ff',
            borderRadius: '8px',
            border: '1px solid #0ea5e9',
            textAlign: 'center'
          }}>
            <p style={{
              fontSize: '12px',
              color: '#0369a1',
              margin: 0,
              fontWeight: '500'
            }}>
              📱 Scan these codes with mobile devices to access the apps directly
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;