
// Demand Forecasting ML System
// Simulates sophisticated ML predictions with realistic algorithms

interface HistoricalData {
  timestamp: number;
  rides: number;
  weather: 'sunny' | 'rainy' | 'cloudy' | 'snowy';
  temperature: number;
  dayOfWeek: number;
  isHoliday: boolean;
  events: string[];
  zone: string;
}

interface DemandPrediction {
  timestamp: number;
  predictedRides: number;
  confidence: number;
  factors: {
    weather: number;
    seasonal: number;
    events: number;
    historical: number;
  };
  zone: string;
  surgeProbability: number;
}

interface OptimalDriverPosition {
  zone: string;
  lat: number;
  lng: number;
  predictedDemand: number;
  driverRecommendation: number;
  revenue_potential: number;
}

export class DemandForecaster {
  private historicalData: HistoricalData[] = [];
  private seasonalPatterns: Map<string, number[]> = new Map();
  private weatherImpact: Map<string, number> = new Map([
    ['sunny', 1.0],
    ['cloudy', 0.95],
    ['rainy', 1.3],
    ['snowy', 1.5]
  ]);

  constructor() {
    this.initializeSeasonalPatterns();
    this.generateHistoricalData();
  }

  private initializeSeasonalPatterns() {
    // Weekly patterns for different zones
    this.seasonalPatterns.set('downtown', [0.6, 0.4, 0.5, 0.7, 1.2, 1.5, 1.3]); // Mon-Sun
    this.seasonalPatterns.set('airport', [1.1, 0.8, 0.9, 1.0, 1.4, 1.6, 1.5]);
    this.seasonalPatterns.set('residential', [0.8, 0.7, 0.7, 0.8, 1.0, 1.2, 0.9]);
    this.seasonalPatterns.set('business', [1.3, 1.2, 1.2, 1.3, 1.1, 0.6, 0.4]);
  }

  private generateHistoricalData() {
    const zones = ['downtown', 'airport', 'residential', 'business'];
    const weathers = ['sunny', 'rainy', 'cloudy', 'snowy'] as const;
    
    // Generate 30 days of historical data
    for (let day = 0; day < 30; day++) {
      for (let hour = 0; hour < 24; hour++) {
        for (const zone of zones) {
          const timestamp = Date.now() - (day * 24 * 60 * 60 * 1000) + (hour * 60 * 60 * 1000);
          const dayOfWeek = new Date(timestamp).getDay();
          const weather = weathers[Math.floor(Math.random() * weathers.length)];
          
          // Calculate base demand using patterns
          const hourlyPattern = this.getHourlyPattern(hour, zone);
          const weeklyPattern = this.seasonalPatterns.get(zone)?.[dayOfWeek] || 1.0;
          const weatherMultiplier = this.weatherImpact.get(weather) || 1.0;
          
          const baseRides = 50 + (hourlyPattern * weeklyPattern * weatherMultiplier * 30);
          const rides = Math.floor(baseRides + (Math.random() - 0.5) * baseRides * 0.2);

          this.historicalData.push({
            timestamp,
            rides: Math.max(0, rides),
            weather,
            temperature: 60 + Math.random() * 30,
            dayOfWeek,
            isHoliday: Math.random() < 0.05,
            events: this.generateEvents(zone, hour),
            zone
          });
        }
      }
    }
  }

  private getHourlyPattern(hour: number, zone: string): number {
    // Different zones have different hourly patterns
    switch (zone) {
      case 'downtown':
        if (hour >= 7 && hour <= 9) return 1.5; // Morning rush
        if (hour >= 17 && hour <= 19) return 1.8; // Evening rush
        if (hour >= 21 && hour <= 23) return 1.3; // Nightlife
        return 0.7;
      
      case 'airport':
        if (hour >= 5 && hour <= 8) return 1.4; // Early flights
        if (hour >= 14 && hour <= 18) return 1.6; // Afternoon arrivals
        return 1.0;
      
      case 'business':
        if (hour >= 8 && hour <= 10) return 1.7; // Work start
        if (hour >= 12 && hour <= 14) return 1.2; // Lunch
        if (hour >= 17 && hour <= 19) return 1.6; // Work end
        return 0.5;
      
      case 'residential':
        if (hour >= 19 && hour <= 22) return 1.2; // Evening activities
        return 0.8;
      
      default:
        return 1.0;
    }
  }

  private generateEvents(zone: string, hour: number): string[] {
    const events: string[] = [];
    
    if (Math.random() < 0.1) {
      const eventTypes = {
        downtown: ['Concert', 'Sports Game', 'Conference', 'Festival'],
        airport: ['Flight Delays', 'International Arrivals', 'Holiday Travel'],
        business: ['Corporate Event', 'Meeting Rush', 'Conference'],
        residential: ['School Pickup', 'Local Event', 'Shopping']
      };
      
      const zoneEvents = eventTypes[zone as keyof typeof eventTypes] || eventTypes.downtown;
      events.push(zoneEvents[Math.floor(Math.random() * zoneEvents.length)]);
    }
    
    return events;
  }

  // Advanced ML Prediction Algorithm (Simulated)
  public predictDemand(
    timestamp: number,
    zone: string,
    weather: string = 'sunny',
    events: string[] = []
  ): DemandPrediction {
    const date = new Date(timestamp);
    const hour = date.getHours();
    const dayOfWeek = date.getDay();
    
    // Feature extraction
    const hourlyPattern = this.getHourlyPattern(hour, zone);
    const weeklyPattern = this.seasonalPatterns.get(zone)?.[dayOfWeek] || 1.0;
    const weatherMultiplier = this.weatherImpact.get(weather) || 1.0;
    const eventMultiplier = 1 + (events.length * 0.2);
    
    // Historical average for this time/zone
    const historicalAverage = this.getHistoricalAverage(hour, dayOfWeek, zone);
    
    // ML prediction factors
    const factors = {
      weather: weatherMultiplier - 1,
      seasonal: weeklyPattern - 1,
      events: eventMultiplier - 1,
      historical: 1.0
    };
    
    // Combined prediction
    const basePrediction = historicalAverage * hourlyPattern * weeklyPattern * weatherMultiplier * eventMultiplier;
    
    // Add noise and smoothing (simulates real ML uncertainty)
    const noise = (Math.random() - 0.5) * 0.1;
    const predictedRides = Math.max(0, Math.floor(basePrediction * (1 + noise)));
    
    // Calculate confidence based on data quality and factors
    const confidence = Math.min(95, 
      70 + 
      (this.getDataQuality(hour, dayOfWeek, zone) * 20) +
      (Math.random() * 10)
    );
    
    // Surge probability based on supply/demand
    const surgeProbability = this.calculateSurgeProbability(predictedRides, zone, hour);
    
    return {
      timestamp,
      predictedRides,
      confidence: Math.round(confidence),
      factors,
      zone,
      surgeProbability
    };
  }

  private getHistoricalAverage(hour: number, dayOfWeek: number, zone: string): number {
    const relevantData = this.historicalData.filter(d => 
      new Date(d.timestamp).getHours() === hour &&
      d.dayOfWeek === dayOfWeek &&
      d.zone === zone
    );
    
    if (relevantData.length === 0) return 25; // Default fallback
    
    const sum = relevantData.reduce((acc, d) => acc + d.rides, 0);
    return sum / relevantData.length;
  }

  private getDataQuality(hour: number, dayOfWeek: number, zone: string): number {
    const dataPoints = this.historicalData.filter(d => 
      new Date(d.timestamp).getHours() === hour &&
      d.dayOfWeek === dayOfWeek &&
      d.zone === zone
    ).length;
    
    return Math.min(1.0, dataPoints / 10); // Quality based on data points
  }

  private calculateSurgeProbability(predictedRides: number, zone: string, hour: number): number {
    // Simulate driver supply vs demand
    const avgDrivers = this.getAverageDrivers(zone, hour);
    const demandRatio = predictedRides / Math.max(1, avgDrivers);
    
    if (demandRatio > 2.0) return 0.9;
    if (demandRatio > 1.5) return 0.7;
    if (demandRatio > 1.2) return 0.5;
    if (demandRatio > 1.0) return 0.3;
    return 0.1;
  }

  private getAverageDrivers(zone: string, hour: number): number {
    // Simulate driver availability patterns
    const baseDrivers = {
      downtown: 45,
      airport: 30,
      business: 25,
      residential: 20
    };
    
    const hourMultiplier = hour >= 6 && hour <= 22 ? 1.2 : 0.7;
    return Math.floor((baseDrivers[zone as keyof typeof baseDrivers] || 25) * hourMultiplier);
  }

  // Optimal Driver Positioning Algorithm
  public getOptimalDriverPositions(timestamp: number): OptimalDriverPosition[] {
    const zones = [
      { name: 'downtown', lat: 36.3729, lng: -94.2088 },
      { name: 'airport', lat: 36.3850, lng: -94.2200 },
      { name: 'business', lat: 36.3650, lng: -94.2000 },
      { name: 'residential', lat: 36.3800, lng: -94.1950 }
    ];
    
    return zones.map(zone => {
      const prediction = this.predictDemand(timestamp, zone.name);
      const currentDrivers = this.getAverageDrivers(zone.name, new Date(timestamp).getHours());
      const optimalDrivers = Math.ceil(prediction.predictedRides / 3.5); // 3.5 rides per driver avg
      const driverRecommendation = Math.max(0, optimalDrivers - currentDrivers);
      
      // Calculate revenue potential
      const averageFare = 35 + (Math.random() * 10);
      const surgeMultiplier = prediction.surgeProbability > 0.7 ? 1.5 : 1.0;
      const revenue_potential = prediction.predictedRides * averageFare * surgeMultiplier * 0.75; // 75% to driver
      
      return {
        zone: zone.name,
        lat: zone.lat + (Math.random() - 0.5) * 0.01,
        lng: zone.lng + (Math.random() - 0.5) * 0.01,
        predictedDemand: prediction.predictedRides,
        driverRecommendation,
        revenue_potential: Math.round(revenue_potential)
      };
    });
  }

  // Batch prediction for analytics dashboard
  public batchPredict(hours: number = 24, zone: string = 'all'): DemandPrediction[] {
    const predictions: DemandPrediction[] = [];
    const now = Date.now();
    
    const zones = zone === 'all' ? ['downtown', 'airport', 'business', 'residential'] : [zone];
    
    for (let h = 0; h < hours; h++) {
      const timestamp = now + (h * 60 * 60 * 1000);
      for (const z of zones) {
        const weather = Math.random() > 0.8 ? 'rainy' : 'sunny';
        const events = Math.random() > 0.9 ? ['Special Event'] : [];
        predictions.push(this.predictDemand(timestamp, z, weather, events));
      }
    }
    
    return predictions;
  }

  // Performance metrics for the ML model
  public getModelPerformance(): {
    accuracy: number;
    precision: number;
    recall: number;
    mse: number;
    lastTrained: string;
  } {
    return {
      accuracy: 87.5 + Math.random() * 5, // Simulate 87-92% accuracy
      precision: 83.2 + Math.random() * 7,
      recall: 89.1 + Math.random() * 4,
      mse: 12.3 + Math.random() * 3,
      lastTrained: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    };
  }
}

// Export singleton instance
export const demandForecaster = new DemandForecaster();

// Utility functions for components
export const formatPrediction = (prediction: DemandPrediction) => ({
  time: new Date(prediction.timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  }),
  rides: prediction.predictedRides,
  confidence: `${prediction.confidence}%`,
  surge: prediction.surgeProbability > 0.7 ? 'High' : 
         prediction.surgeProbability > 0.4 ? 'Medium' : 'Low'
});

export const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 90) return '#10b981';
  if (confidence >= 80) return '#f59e0b';
  return '#ef4444';
};

export const getSurgeColor = (probability: number): string => {
  if (probability >= 0.7) return '#dc2626';
  if (probability >= 0.4) return '#f59e0b';
  return '#10b981';
};
