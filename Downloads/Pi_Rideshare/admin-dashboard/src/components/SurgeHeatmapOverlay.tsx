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
  showLabels = true,
  onZoneClick
}) => {
  const circlesRef = useRef<google.maps.Circle[]>([]);
  const markersRef = useRef<google.maps.Marker[]>([]);

  // Clear existing overlays
  const clearOverlays = () => {
    circlesRef.current.forEach(circle => circle.setMap(null));
    markersRef.current.forEach(marker => marker.setMap(null));
    circlesRef.current = [];
    markersRef.current = [];
  };

  // Get color based on surge multiplier
  const getSurgeColor = (multiplier: number): string => {
    if (multiplier >= 2.5) return '#dc2626'; // Red
    if (multiplier >= 2.0) return '#f97316'; // Orange
    if (multiplier >= 1.5) return '#eab308'; // Yellow
    return '#22c55e'; // Green
  };

  // Create gradient circles
  useEffect(() => {
    if (!map || !window.google) return;

    clearOverlays();

    if (surgeZones.length === 0) return;

    surgeZones.forEach(zone => {
      const baseRadius = zone.radius || 2000;
      const color = getSurgeColor(zone.surgeMultiplier);
      
      // Create concentric circles for gradient effect (outer to inner)
      const layers = 5;
      for (let i = layers; i >= 1; i--) {
        const layerRadius = baseRadius * (i / layers);
        const opacity = 0.1 + (0.4 * ((layers - i + 1) / layers));
        
        const circle = new google.maps.Circle({
          strokeColor: color,
          strokeOpacity: i === layers ? 0.3 : 0,
          strokeWeight: i === layers ? 1 : 0,
          fillColor: color,
          fillOpacity: opacity,
          map: map,
          center: zone.coordinates,
          radius: layerRadius,
          clickable: true,
          zIndex: i
        });

        if (onZoneClick) {
          circle.addListener('click', () => onZoneClick(zone));
        }

        circlesRef.current.push(circle);
      }

      // Add surge amount label
      const surgeExtra = ((zone.surgeMultiplier - 1) * 5).toFixed(2);
      
      const marker = new google.maps.Marker({
        position: zone.coordinates,
        map: map,
        label: {
          text: `+$${surgeExtra}`,
          color: 'white',
          fontSize: '13px',
          fontWeight: 'bold'
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 0
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

  useEffect(() => {
    return () => clearOverlays();
  }, []);

  return null;
};

export default SurgeHeatmapOverlay;