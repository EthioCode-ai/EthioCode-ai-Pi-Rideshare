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
  const circlesRef = useRef<google.maps.Circle[]>([]);
  const markersRef = useRef<google.maps.Marker[]>([]);

  const clearOverlays = () => {
    circlesRef.current.forEach(c => c.setMap(null));
    markersRef.current.forEach(m => m.setMap(null));
    circlesRef.current = [];
    markersRef.current = [];
  };

  useEffect(() => {
    if (!map || !window.google) return;
    clearOverlays();
    if (!gridCells || gridCells.length === 0) return;

    // Group zones into hotspots (cluster nearby zones)
    const hotspots: { center: { lat: number; lng: number }; maxMultiplier: number; surgeAmount: string; zones: SurgeZone[] }[] = [];
    const processed = new Set<string>();

    // Sort by multiplier descending to find hotspot centers first
    const sortedZones = [...gridCells].sort((a, b) => b.multiplier - a.multiplier);

    for (const zone of sortedZones) {
      if (processed.has(zone.id)) continue;
      if (zone.multiplier < 1.5) continue;

      // Start a new hotspot
      const hotspot = {
        center: zone.center,
        maxMultiplier: zone.multiplier,
        surgeAmount: zone.surgeAmount,
        zones: [zone]
      };
      processed.add(zone.id);

      // Find all zones within 0.015 degrees (~1 mile) of this center
      for (const other of sortedZones) {
        if (processed.has(other.id)) continue;
        const dist = Math.sqrt(
          Math.pow(other.center.lat - zone.center.lat, 2) +
          Math.pow(other.center.lng - zone.center.lng, 2)
        );
        if (dist < 0.015) {
          hotspot.zones.push(other);
          processed.add(other.id);
        }
      }

      hotspots.push(hotspot);
    }

    // Render each hotspot as smooth gradient circles
    hotspots.forEach(hotspot => {
      const baseRadius = 800 + (hotspot.zones.length * 100); // Radius based on cluster size
      
      // Create concentric circles for gradient effect (outer to inner)
      const layers = 5;
      for (let i = layers; i >= 1; i--) {
        const radius = baseRadius * (i / layers);
        const opacity = 0.15 + (0.35 * ((layers - i + 1) / layers));
        
        // Purple color like Uber - darker in center
        const purple = i <= 2 ? '#7c3aed' : i <= 3 ? '#8b5cf6' : '#a78bfa';
        
        const circle = new google.maps.Circle({
          center: hotspot.center,
          radius: radius,
          strokeColor: purple,
          strokeOpacity: 0,
          strokeWeight: 0,
          fillColor: purple,
          fillOpacity: opacity,
          map: map,
          zIndex: layers - i
        });

        circlesRef.current.push(circle);
      }

      // ONE label per hotspot - at center with pill background
      const marker = new google.maps.Marker({
        position: hotspot.center,
        map: map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 0
        },
        label: {
          text: `+$${hotspot.surgeAmount}`,
          color: 'white',
          fontSize: '13px',
          fontWeight: 'bold',
          className: 'surge-label-pill'
        },
        zIndex: 1000
      });

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