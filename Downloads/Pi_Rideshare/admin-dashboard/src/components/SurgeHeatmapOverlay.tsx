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
  const overlayRef = useRef<google.maps.GroundOverlay | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  const clearOverlays = () => {
    if (overlayRef.current) {
      overlayRef.current.setMap(null);
      overlayRef.current = null;
    }
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
  };

  useEffect(() => {
    if (!map || !window.google) return;
    clearOverlays();
    if (!gridCells || gridCells.length === 0) return;

    // Separate airport zones from city zones
    const airportZones = gridCells.filter((z: any) => z.zoneType === 'airport');
    const cityZones = gridCells.filter((z: any) => z.zoneType !== 'airport');

    const labelZones: { center: { lat: number; lng: number }; surgeAmount: string; multiplier: number }[] = [];

    // City labels - closer spacing for more labels on edges
    const sortedCity = [...cityZones].filter(z => z.multiplier >= 1.5).sort((a, b) => b.multiplier - a.multiplier);
    
    for (const zone of sortedCity) {
      const tooClose = labelZones.some(h => {
        const dist = Math.sqrt(
          Math.pow(h.center.lat - zone.center.lat, 2) +
          Math.pow(h.center.lng - zone.center.lng, 2)
        );
        return dist < 0.002; // Smaller = more labels
      });

      if (!tooClose) {
        labelZones.push({
          center: zone.center,
          surgeAmount: zone.surgeAmount,
          multiplier: zone.multiplier
        });
      }
    }

    // Airport labels - exactly 3: center + 2 edges
    const airportCodes = [...new Set(airportZones.map(z => z.code.split('-')[0]))];
    
    for (const code of airportCodes) {
      const cells = airportZones.filter(z => z.code.startsWith(code + '-') && z.multiplier >= 1.25);
      if (cells.length === 0) continue;
      
      const sorted = [...cells].sort((a, b) => b.multiplier - a.multiplier);
      const centerZone = sorted[0];
      
      // 1. Center label (rideshare lot)
      labelZones.push({
        center: centerZone.center,
        surgeAmount: centerZone.surgeAmount,
        multiplier: centerZone.multiplier
      });
      
      // 2 & 3. Find edge labels ~1.5 miles out, opposite directions
      const edgeLabels: typeof labelZones = [];
      
      for (const cell of sorted) {
        if (edgeLabels.length >= 2) break;
        
        const dist = Math.sqrt(
          Math.pow(cell.center.lat - centerZone.center.lat, 2) +
          Math.pow(cell.center.lng - centerZone.center.lng, 2)
        );
        
        // 1.5 miles = ~0.022 degrees
        if (dist >= 0.018 && dist <= 0.028) {
          // Check not too close to other edge labels
          const tooCloseToEdge = edgeLabels.some(e => {
            const d = Math.sqrt(
              Math.pow(e.center.lat - cell.center.lat, 2) +
              Math.pow(e.center.lng - cell.center.lng, 2)
            );
            return d < 0.015;
          });
          
          if (!tooCloseToEdge) {
            edgeLabels.push({
              center: cell.center,
              surgeAmount: cell.surgeAmount,
              multiplier: cell.multiplier
            });
          }
        }
      }
      
      labelZones.push(...edgeLabels);
    }

    // Calculate bounds
    const allZones = gridCells.filter(z => z.multiplier >= 1.25);
    if (allZones.length === 0) return;

    const lats = allZones.map(z => z.center.lat);
    const lngs = allZones.map(z => z.center.lng);
    const padding = 0.02;
    const minLat = Math.min(...lats) - padding;
    const maxLat = Math.max(...lats) + padding;
    const minLng = Math.min(...lngs) - padding;
    const maxLng = Math.max(...lngs) + padding;

    // Create canvas
    const canvas = document.createElement('canvas');
    const width = 1200;
    const height = 1200;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // Draw overlapping gradients
    for (const zone of allZones) {
      const x = ((zone.center.lng - minLng) / (maxLng - minLng)) * width;
      const y = ((maxLat - zone.center.lat) / (maxLat - minLat)) * height;
      
      const intensity = Math.min(1, (zone.multiplier - 1.0) / 1.5);
      const radius = 80 + (intensity * 40);

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      
      const alpha = 0.18 + (intensity * 0.25);
      gradient.addColorStop(0, `rgba(88, 28, 135, ${alpha})`);
      gradient.addColorStop(0.4, `rgba(124, 58, 237, ${alpha * 0.8})`);
      gradient.addColorStop(0.7, `rgba(139, 92, 246, ${alpha * 0.5})`);
      gradient.addColorStop(1, `rgba(167, 139, 250, 0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Create ground overlay
    const bounds = new google.maps.LatLngBounds(
      new google.maps.LatLng(minLat, minLng),
      new google.maps.LatLng(maxLat, maxLng)
    );

    overlayRef.current = new google.maps.GroundOverlay(
      canvas.toDataURL(),
      bounds,
      { opacity: 0.75 }
    );
    overlayRef.current.setMap(map);

    // Render all labels
    for (const zone of labelZones) {
      const fontSize = zone.multiplier >= 2.5 ? '11px' : zone.multiplier >= 2.0 ? '10px' : '9px';
      
      const marker = new google.maps.Marker({
        position: zone.center,
        map: map,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
        label: {
          text: `+$${zone.surgeAmount}`,
          color: 'white',
          fontSize: fontSize,
          fontWeight: 'bold'
        },
        zIndex: Math.floor(zone.multiplier * 100)
      });
      markersRef.current.push(marker);
    }

    return () => clearOverlays();
  }, [map, gridCells]);

  useEffect(() => {
    return () => clearOverlays();
  }, []);

  return null;
};

export default SurgeHeatmapOverlay;