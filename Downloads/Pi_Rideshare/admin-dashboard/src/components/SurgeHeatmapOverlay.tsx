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

  // Purple gradient based on multiplier
  const getColor = (multiplier: number): string => {
    if (multiplier >= 2.5) return '#581c87'; // Dark purple
    if (multiplier >= 2.0) return '#7c3aed'; // Purple
    if (multiplier >= 1.75) return '#8b5cf6'; // Medium purple
    return '#a78bfa'; // Light purple
  };

  const getOpacity = (multiplier: number): number => {
    if (multiplier >= 2.5) return 0.7;
    if (multiplier >= 2.0) return 0.55;
    if (multiplier >= 1.75) return 0.4;
    return 0.3;
  };

  useEffect(() => {
    if (!map || !window.google) return;
    clearOverlays();
    if (!gridCells || gridCells.length === 0) return;

    // Find hotspot centers for labels (highest multiplier zones)
    const hotspotCenters: { center: { lat: number; lng: number }; surgeAmount: string; multiplier: number }[] = [];
    const labeledZones = new Set<string>();

    // Sort by multiplier to find peaks
    const sorted = [...gridCells].sort((a, b) => b.multiplier - a.multiplier);
    
    for (const zone of sorted) {
      if (zone.multiplier < 1.5) continue;
      
      // Check if too close to existing label
      const tooClose = hotspotCenters.some(h => {
        const dist = Math.sqrt(
          Math.pow(h.center.lat - zone.center.lat, 2) +
          Math.pow(h.center.lng - zone.center.lng, 2)
        );
        return dist < 0.012; // ~0.8 mile apart minimum
      });

      if (!tooClose && zone.multiplier >= 2.0) {
        hotspotCenters.push({
          center: zone.center,
          surgeAmount: zone.surgeAmount,
          multiplier: zone.multiplier
        });
      }
    }

    // Render all zones as borderless polygons (they blend together)
    for (const zone of gridCells) {
      if (zone.multiplier < 1.25) continue;

      const polygonCoords = typeof zone.polygon === 'string' 
        ? JSON.parse(zone.polygon) 
        : zone.polygon;

      const polygon = new google.maps.Polygon({
        paths: polygonCoords.map((p: any) => ({ lat: p.lat, lng: p.lng })),
        strokeWeight: 0, // NO BORDERS - zones blend together
        strokeOpacity: 0,
        fillColor: getColor(zone.multiplier),
        fillOpacity: getOpacity(zone.multiplier),
        map: map,
        zIndex: Math.floor(zone.multiplier * 10)
      });

      polygonsRef.current.push(polygon);
    }

    // Add ONE label per hotspot area
    for (const hotspot of hotspotCenters) {
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
          fontSize: '14px',
          fontWeight: 'bold'
        },
        zIndex: 1000
      });

      markersRef.current.push(marker);
    }

    return () => clearOverlays();
  }, [map, gridCells, onCellClick]);

  useEffect(() => {
    return () => clearOverlays();
  }, []);

  return null;
};

export default SurgeHeatmapOverlay;