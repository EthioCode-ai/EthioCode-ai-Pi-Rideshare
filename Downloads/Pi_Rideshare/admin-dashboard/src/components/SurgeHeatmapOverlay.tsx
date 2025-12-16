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

    // Find labels - include outer edges (lower threshold)
    const labelZones: { center: { lat: number; lng: number }; surgeAmount: string; multiplier: number }[] = [];
    const sorted = [...gridCells].filter(z => z.multiplier >= 1.5).sort((a, b) => b.multiplier - a.multiplier);
    
    for (const zone of sorted) {
      // Closer spacing for more labels
      const tooClose = labelZones.some(h => {
        const dist = Math.sqrt(
          Math.pow(h.center.lat - zone.center.lat, 2) +
          Math.pow(h.center.lng - zone.center.lng, 2)
        );
        return dist < 0.008; // Closer spacing = more labels
      });

      if (!tooClose) {
        labelZones.push({
          center: zone.center,
          surgeAmount: zone.surgeAmount,
          multiplier: zone.multiplier
        });
      }
    }

    // Calculate bounds with padding
    const allZones = gridCells.filter(z => z.multiplier >= 1.25);
    if (allZones.length === 0) return;

    const lats = allZones.map(z => z.center.lat);
    const lngs = allZones.map(z => z.center.lng);
    const padding = 0.02;
    const minLat = Math.min(...lats) - padding;
    const maxLat = Math.max(...lats) + padding;
    const minLng = Math.min(...lngs) - padding;
    const maxLng = Math.max(...lngs) + padding;

    // Create high-res canvas
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
      
      const alpha = 0.25 + (intensity * 0.35);
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
      { opacity: 0.9 }
    );
    overlayRef.current.setMap(map);

    // Labels with proportional font size
    for (const zone of labelZones) {
      // Smaller font - scales with multiplier
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