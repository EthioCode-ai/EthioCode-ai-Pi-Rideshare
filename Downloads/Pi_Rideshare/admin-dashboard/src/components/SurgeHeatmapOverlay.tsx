import React, { useEffect, useRef } from 'react';

interface SurgeZone {
  id: string;
  code: string;
  center: { lat: number; lng: number };
  polygon: { lat: number; lng: number }[];
  demand: number;
  supply: number;
  avgWaitMinutes: number;
  multiplier: number;
  surgeAmount: string;
  factors: string[];
}

interface SurgeHeatmapOverlayProps {
  map: google.maps.Map | null;
  gridCells: SurgeZone[];
  onCellClick?: (cell: SurgeZone) => void;
}

const SurgeHeatmapOverlay: React.FC<SurgeHeatmapOverlayProps> = ({
  map,
  gridCells,
  onCellClick
}) => {
  const polygonsRef = useRef<google.maps.Polygon[]>([]);
  const markersRef = useRef<google.maps.Marker[]>([]);

  const clearOverlays = () => {
    polygonsRef.current.forEach(p => p.setMap(null));
    markersRef.current.forEach(m => m.setMap(null));
    polygonsRef.current = [];
    markersRef.current = [];
  };

  // Get color based on multiplier
  const getSurgeColor = (multiplier: number): string => {
    if (multiplier >= 2.5) return '#dc2626'; // Red - extreme
    if (multiplier >= 2.0) return '#f97316'; // Orange - high
    if (multiplier >= 1.75) return '#eab308'; // Yellow - medium
    if (multiplier >= 1.5) return '#84cc16'; // Light green - low
    return 'transparent';
  };

  const getOpacity = (multiplier: number): number => {
    if (multiplier >= 2.5) return 0.6;
    if (multiplier >= 2.0) return 0.5;
    if (multiplier >= 1.75) return 0.4;
    if (multiplier >= 1.5) return 0.3;
    return 0;
  };

  useEffect(() => {
    if (!map || !window.google) return;

    clearOverlays();

    if (!gridCells || gridCells.length === 0) return;

    gridCells.forEach(zone => {
      const color = getSurgeColor(zone.multiplier);
      const opacity = getOpacity(zone.multiplier);

      // Only render zones with active surge
      if (zone.multiplier < 1.5) return;

      // Parse polygon if it's a string
      const polygonCoords = typeof zone.polygon === 'string' 
        ? JSON.parse(zone.polygon) 
        : zone.polygon;

      const polygon = new google.maps.Polygon({
        paths: polygonCoords.map((p: any) => ({ lat: p.lat, lng: p.lng })),
        strokeColor: color,
        strokeOpacity: 0.8,
        strokeWeight: 1,
        fillColor: color,
        fillOpacity: opacity,
        map: map,
        zIndex: Math.floor(zone.multiplier * 10)
      });

      if (onCellClick) {
        polygon.addListener('click', () => onCellClick(zone));
      }

      polygonsRef.current.push(polygon);

      // Add surge label
      const marker = new google.maps.Marker({
        position: zone.center,
        map: map,
        label: {
          text: `+$${zone.surgeAmount}`,
          color: 'white',
          fontSize: '11px',
          fontWeight: 'bold'
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 0
        },
        title: `${zone.code}: ${zone.multiplier}x surge\n${zone.demand} rides, ${zone.supply} drivers\n${zone.factors.join(', ')}`
      });

      if (onCellClick) {
        marker.addListener('click', () => onCellClick(zone));
      }
      markersRef.current.push(marker);
    });

    return () => clearOverlays();
  }, [map, gridCells, onCellClick]);

  useEffect(() => {
    return () => clearOverlays();
  }, []);

  return null;
};

export default SurgeHeatmapOverlay;