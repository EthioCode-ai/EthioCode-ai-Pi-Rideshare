import React, { useEffect, useRef } from 'react';

interface SurgeZone {
  id: string;
  name: string;
  coordinates: { lat: number; lng: number };
  surgeMultiplier: number;
  demandLevel: 'low' | 'medium' | 'high' | 'extreme';
  radius?: number; // in kilometers
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
  showLabels = true,
  onZoneClick
}) => {
  const circlesRef = useRef<google.maps.Circle[]>([]);
  const labelsRef = useRef<google.maps.InfoWindow[]>([]);

  // Get color based on surge multiplier
  const getSurgeColor = (multiplier: number): string => {
    if (multiplier >= 2.5) return '#ef4444'; // Red - Extreme surge
    if (multiplier >= 2.0) return '#f97316'; // Orange - High surge  
    if (multiplier >= 1.5) return '#eab308'; // Yellow - Medium surge
    if (multiplier >= 1.2) return '#84cc16'; // Light green - Low surge
    return '#10b981'; // Green - Normal pricing
  };

  // Get opacity based on demand level
  const getSurgeOpacity = (demandLevel: string): number => {
    switch (demandLevel) {
      case 'extreme': return 0.4;
      case 'high': return 0.35;
      case 'medium': return 0.25;
      case 'low': return 0.15;
      default: return 0.2;
    }
  };

  // Get zone radius in meters
  const getZoneRadius = (zone: SurgeZone): number => {
    if (zone.radius) return zone.radius * 1000; // Convert km to meters
    
    // Default radius based on demand level
    switch (zone.demandLevel) {
      case 'extreme': return 3000; // 3km
      case 'high': return 2500;    // 2.5km
      case 'medium': return 2000;  // 2km
      case 'low': return 1500;     // 1.5km
      default: return 2000;
    }
  };

  // Clear existing overlays
  const clearOverlays = () => {
    circlesRef.current.forEach(circle => circle.setMap(null));
    labelsRef.current.forEach(label => label.close());
    circlesRef.current = [];
    labelsRef.current = [];
  };

  // Create surge zone overlays
  useEffect(() => {
    if (!map || !window.google || surgeZones.length === 0) return;

    clearOverlays();

    surgeZones.forEach(zone => {
      const { lat, lng } = zone.coordinates;
      const center = new google.maps.LatLng(lat, lng);
      const color = getSurgeColor(zone.surgeMultiplier);
      const opacity = getSurgeOpacity(zone.demandLevel);
      const radius = getZoneRadius(zone);

      // Create circle overlay for surge zone
      const circle = new google.maps.Circle({
        strokeColor: color,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        fillColor: color,
        fillOpacity: opacity,
        map: map,
        center: center,
        radius: radius,
        clickable: true,
        zIndex: 1
      });

      // Add click handler
      if (onZoneClick) {
        circle.addListener('click', () => onZoneClick(zone));
      }

      circlesRef.current.push(circle);

      // Create info label if enabled
      if (showLabels) {
        const labelContent = `
          <div style="
            background: white; 
            border-radius: 8px; 
            padding: 8px 12px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            border: 2px solid ${color};
            font-family: 'Inter', sans-serif;
            text-align: center;
            min-width: 120px;
          ">
            <div style="font-weight: 600; font-size: 14px; color: #1f2937; margin-bottom: 4px;">
              ${zone.name}
            </div>
            <div style="font-size: 18px; font-weight: 700; color: ${color}; margin-bottom: 2px;">
              ${zone.surgeMultiplier}x
            </div>
            <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; font-weight: 500;">
              ${zone.demandLevel} Demand
            </div>
          </div>
        `;

        const infoWindow = new google.maps.InfoWindow({
          content: labelContent,
          position: center,
          disableAutoPan: true,
          pixelOffset: new google.maps.Size(0, -10)
        });

        infoWindow.open(map);
        labelsRef.current.push(infoWindow);
      }
    });

    // Cleanup function
    return () => clearOverlays();
  }, [map, surgeZones, showLabels, onZoneClick]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearOverlays();
  }, []);

  return null; // This component doesn't render anything directly
};

export default SurgeHeatmapOverlay;