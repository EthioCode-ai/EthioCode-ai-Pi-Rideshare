import React, { useEffect, useRef } from 'react';

interface SurgeZone {
  id: string;
  name: string;
  coordinates: { lat: number; lng: number };
  surgeMultiplier: number;
  demandLevel: 'low' | 'medium' | 'high' | 'extreme';
  radius?: number;
}

interface SurgeHeatmapOverlayProps {
  map: google.maps.Map | null;
  surgeZones: SurgeZone[];
  showLabels?: boolean;
  onZoneClick?: (zone: SurgeZone) => void;
}

const SurgeHeatmapOverlay: React.FC<SurgeHeatmapOverlayProps> = ({
  map,
  surgeZones,
  showLabels = false,
  onZoneClick
}) => {
  const heatmapRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  // Clear existing overlays
  const clearOverlays = () => {
    if (heatmapRef.current) {
      heatmapRef.current.setMap(null);
      heatmapRef.current = null;
    }
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
  };

  // Get weight based on surge multiplier (higher surge = more intense heat)
  const getWeight = (multiplier: number): number => {
    if (multiplier >= 2.5) return 10;
    if (multiplier >= 2.0) return 7;
    if (multiplier >= 1.5) return 5;
    if (multiplier >= 1.2) return 3;
    return 1;
  };

  // Create heatmap layer
  useEffect(() => {
    if (!map || !window.google || !window.google.maps.visualization) {
      console.warn('Google Maps visualization library not loaded');
      return;
    }

    clearOverlays();

    if (surgeZones.length === 0) return;

    // Create weighted points for heatmap
    const heatmapData: google.maps.visualization.WeightedLocation[] = [];
    
    surgeZones.forEach(zone => {
      const weight = getWeight(zone.surgeMultiplier);
      const radius = zone.radius || 2000; // Default 2km
      
      // Add center point with high weight
      heatmapData.push({
        location: new google.maps.LatLng(zone.coordinates.lat, zone.coordinates.lng),
        weight: weight * 2
      });
      
      // Add surrounding points to create spread effect based on radius
      const spreadPoints = 8;
      const radiusInDegrees = radius / 111000; // Rough meters to degrees
      
      for (let i = 0; i < spreadPoints; i++) {
        const angle = (i / spreadPoints) * 2 * Math.PI;
        const spreadLat = zone.coordinates.lat + (radiusInDegrees * 0.5 * Math.cos(angle));
        const spreadLng = zone.coordinates.lng + (radiusInDegrees * 0.5 * Math.sin(angle));
        
        heatmapData.push({
          location: new google.maps.LatLng(spreadLat, spreadLng),
          weight: weight
        });
      }
    });

    // Create heatmap layer
    heatmapRef.current = new google.maps.visualization.HeatmapLayer({
      data: heatmapData,
      map: map,
      radius: 50,
      opacity: 0.7,
      gradient: [
        'rgba(0, 255, 0, 0)',      // Transparent green
        'rgba(0, 255, 0, 0.4)',    // Green
        'rgba(173, 255, 47, 0.6)', // Yellow-green
        'rgba(255, 255, 0, 0.7)',  // Yellow
        'rgba(255, 165, 0, 0.8)',  // Orange
        'rgba(255, 69, 0, 0.9)',   // Red-orange
        'rgba(255, 0, 0, 1)'       // Red
      ]
    });

    // Add labels showing surge amount
surgeZones.forEach(zone => {
  const surgeExtra = ((zone.surgeMultiplier - 1) * 5).toFixed(2); // $5 base fare estimate
  const color = zone.surgeMultiplier >= 2.0 ? '#dc2626' : zone.surgeMultiplier >= 1.5 ? '#f97316' : '#eab308';
  
  const marker = new google.maps.Marker({
  position: zone.coordinates,
  map: map,
  label: {
    text: `+$${surgeExtra}`,
    color: 'white',
    fontSize: '14px',
    fontWeight: 'bold',
    className: 'surge-label'
  },
  icon: {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 0,
    fillOpacity: 0,
    strokeOpacity: 0
  },
  title: `${zone.name}: ${zone.surgeMultiplier}x surge`
});
  
  if (onZoneClick) {
    marker.addListener('click', () => onZoneClick(zone));
  }
  markersRef.current.push(marker);
});

    return () => clearOverlays();
  }, [map, surgeZones, onZoneClick]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearOverlays();
  }, []);

  return null;
};

export default SurgeHeatmapOverlay;