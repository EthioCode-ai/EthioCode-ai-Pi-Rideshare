
interface Market {
  id: string;
  name: string;
  city: string;
  state: string;
  country: string;
  center: { lat: number; lng: number };
  radius: number;
  zoom: number;
  timezone: string;
  currency: string;
  status: 'active' | 'inactive' | 'pending';
  launchedAt: string;
  totalDrivers: number;
  totalRiders: number;
  monthlyRides: number;
  monthlyRevenue: number;
  config: {
    baseFare: number;
    perMileFare: number;
    perMinuteFare: number;
    maxSurgeMultiplier: number;
    airportFee: number;
    cancellationFee: number;
  };
}

// Shared market data - in production this would come from your database
let marketsData: Market[] = [
  {
    id: 'bentonville',
    name: 'Bentonville Metro',
    city: 'Bentonville',
    state: 'Arkansas',
    country: 'USA',
    center: { lat: 36.3729, lng: -94.2088 },
    radius: 25,
    zoom: 13,
    timezone: 'America/Chicago',
    currency: 'USD',
    status: 'active',
    launchedAt: '2023-01-15',
    totalDrivers: 234,
    totalRiders: 1847,
    monthlyRides: 12450,
    monthlyRevenue: 287650,
    config: {
      baseFare: 2.50,
      perMileFare: 1.25,
      perMinuteFare: 0.35,
      maxSurgeMultiplier: 2.5,
      airportFee: 3.50,
      cancellationFee: 5.00
    }
  },
  {
    id: 'fayetteville',
    name: 'Fayetteville',
    city: 'Fayetteville',
    state: 'Arkansas',
    country: 'USA',
    center: { lat: 36.0625, lng: -94.1574 },
    radius: 20,
    zoom: 13,
    timezone: 'America/Chicago',
    currency: 'USD',
    status: 'active',
    launchedAt: '2023-03-20',
    totalDrivers: 156,
    totalRiders: 1203,
    monthlyRides: 8765,
    monthlyRevenue: 198450,
    config: {
      baseFare: 2.25,
      perMileFare: 1.15,
      perMinuteFare: 0.30,
      maxSurgeMultiplier: 2.0,
      airportFee: 2.50,
      cancellationFee: 4.00
    }
  },
  {
    id: 'springdale',
    name: 'Springdale',
    city: 'Springdale',
    state: 'Arkansas',
    country: 'USA',
    center: { lat: 36.1867, lng: -94.1288 },
    radius: 12,
    zoom: 13,
    timezone: 'America/Chicago',
    currency: 'USD',
    status: 'active',
    launchedAt: '2023-05-10',
    totalDrivers: 89,
    totalRiders: 756,
    monthlyRides: 5432,
    monthlyRevenue: 123850,
    config: {
      baseFare: 2.25,
      perMileFare: 1.15,
      perMinuteFare: 0.30,
      maxSurgeMultiplier: 2.0,
      airportFee: 2.50,
      cancellationFee: 4.00
    }
  },
  {
    id: 'rogers',
    name: 'Rogers',
    city: 'Rogers',
    state: 'Arkansas',
    country: 'USA',
    center: { lat: 36.3320, lng: -94.1185 },
    radius: 18,
    zoom: 13,
    timezone: 'America/Chicago',
    currency: 'USD',
    status: 'active',
    launchedAt: '2023-06-15',
    totalDrivers: 112,
    totalRiders: 923,
    monthlyRides: 6789,
    monthlyRevenue: 154320,
    config: {
      baseFare: 2.50,
      perMileFare: 1.25,
      perMinuteFare: 0.35,
      maxSurgeMultiplier: 2.5,
      airportFee: 3.50,
      cancellationFee: 5.00
    }
  },
  {
    id: 'tulsa',
    name: 'Tulsa Metro',
    city: 'Tulsa',
    state: 'Oklahoma',
    country: 'USA',
    center: { lat: 36.1539, lng: -95.9928 },
    radius: 25,
    zoom: 12,
    timezone: 'America/Chicago',
    currency: 'USD',
    status: 'pending',
    launchedAt: '2024-02-01',
    totalDrivers: 45,
    totalRiders: 234,
    monthlyRides: 1250,
    monthlyRevenue: 28450,
    config: {
      baseFare: 2.75,
      perMileFare: 1.35,
      perMinuteFare: 0.40,
      maxSurgeMultiplier: 3.0,
      airportFee: 4.00,
      cancellationFee: 5.50
    }
  },
  {
    id: 'little-rock',
    name: 'Little Rock',
    city: 'Little Rock',
    state: 'Arkansas',
    country: 'USA',
    center: { lat: 34.7465, lng: -92.2896 },
    radius: 30,
    zoom: 12,
    timezone: 'America/Chicago',
    currency: 'USD',
    status: 'active',
    launchedAt: '2023-08-20',
    totalDrivers: 198,
    totalRiders: 1456,
    monthlyRides: 9876,
    monthlyRevenue: 234560,
    config: {
      baseFare: 2.75,
      perMileFare: 1.35,
      perMinuteFare: 0.40,
      maxSurgeMultiplier: 3.0,
      airportFee: 4.00,
      cancellationFee: 5.50
    }
  },
  {
    id: 'oklahoma-city',
    name: 'Oklahoma City',
    city: 'Oklahoma City',
    state: 'Oklahoma',
    country: 'USA',
    center: { lat: 35.4676, lng: -97.5164 },
    radius: 35,
    zoom: 12,
    timezone: 'America/Chicago',
    currency: 'USD',
    status: 'pending',
    launchedAt: '2024-03-15',
    totalDrivers: 67,
    totalRiders: 389,
    monthlyRides: 2134,
    monthlyRevenue: 48760,
    config: {
      baseFare: 2.75,
      perMileFare: 1.35,
      perMinuteFare: 0.40,
      maxSurgeMultiplier: 3.0,
      airportFee: 4.00,
      cancellationFee: 5.50
    }
  },
  {
    id: 'kansas-city',
    name: 'Kansas City Metro',
    city: 'Kansas City',
    state: 'Missouri',
    country: 'USA',
    center: { lat: 39.0997, lng: -94.5786 },
    radius: 40,
    zoom: 11,
    timezone: 'America/Chicago',
    currency: 'USD',
    status: 'pending',
    launchedAt: '2024-04-01',
    totalDrivers: 78,
    totalRiders: 456,
    monthlyRides: 2567,
    monthlyRevenue: 58930,
    config: {
      baseFare: 3.00,
      perMileFare: 1.50,
      perMinuteFare: 0.45,
      maxSurgeMultiplier: 3.5,
      airportFee: 4.50,
      cancellationFee: 6.00
    }
  },
  {
    id: 'dallas',
    name: 'Dallas-Fort Worth Metro',
    city: 'Dallas',
    state: 'Texas',
    country: 'USA',
    center: { lat: 32.7767, lng: -96.7970 },
    radius: 50,
    zoom: 10,
    timezone: 'America/Chicago',
    currency: 'USD',
    status: 'pending',
    launchedAt: '2024-05-01',
    totalDrivers: 156,
    totalRiders: 892,
    monthlyRides: 4567,
    monthlyRevenue: 98760,
    config: {
      baseFare: 3.25,
      perMileFare: 1.65,
      perMinuteFare: 0.50,
      maxSurgeMultiplier: 4.0,
      airportFee: 5.00,
      cancellationFee: 6.50
    }
  },
  {
    id: 'washington-dc',
    name: 'Metropolitan Washington D.C.',
    city: 'Washington',
    state: 'District of Columbia',
    country: 'USA',
    center: { lat: 38.9072, lng: -77.0369 },
    radius: 45,
    zoom: 10,
    timezone: 'America/New_York',
    currency: 'USD',
    status: 'pending',
    launchedAt: '2024-06-01',
    totalDrivers: 189,
    totalRiders: 1234,
    monthlyRides: 6789,
    monthlyRevenue: 145670,
    config: {
      baseFare: 3.50,
      perMileFare: 1.85,
      perMinuteFare: 0.55,
      maxSurgeMultiplier: 4.5,
      airportFee: 5.50,
      cancellationFee: 7.00
    }
  }
];

export const marketService = {
  // Get all markets
  getAllMarkets: (): Market[] => {
    return [...marketsData];
  },

  // Get active markets only
  getActiveMarkets: (): Market[] => {
    return marketsData.filter(market => market.status === 'active');
  },

  // Get market by ID
  getMarketById: (id: string): Market | undefined => {
    return marketsData.find(market => market.id === id);
  },

  // Add new market
  addMarket: (market: Market): void => {
    marketsData.push(market);
  },

  // Update market
  updateMarket: (id: string, updatedData: Partial<Market>): boolean => {
    const index = marketsData.findIndex(market => market.id === id);
    if (index !== -1) {
      marketsData[index] = { ...marketsData[index], ...updatedData };
      return true;
    }
    return false;
  },

  // Delete market
  deleteMarket: (id: string): boolean => {
    const index = marketsData.findIndex(market => market.id === id);
    if (index !== -1) {
      marketsData.splice(index, 1);
      return true;
    }
    return false;
  },

  // Get market stats
  getMarketStats: () => {
    return {
      totalMarkets: marketsData.length,
      activeMarkets: marketsData.filter(m => m.status === 'active').length,
      pendingMarkets: marketsData.filter(m => m.status === 'pending').length,
      totalUsers: marketsData.reduce((sum, m) => sum + m.totalDrivers + m.totalRiders, 0),
      totalRevenue: marketsData.reduce((sum, m) => sum + m.monthlyRevenue, 0),
      totalRides: marketsData.reduce((sum, m) => sum + m.monthlyRides, 0)
    };
  }
};

export type { Market };
