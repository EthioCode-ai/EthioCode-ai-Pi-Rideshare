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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

    // Find hotspots (zones with multiplier >= 2.0 for labels)
    const hotspots: { center: { lat: number; lng: number }; surgeAmount: string; multiplier: number }[] = [];
    const sorted = [...gridCells].filter(z => z.multiplier >= 2.0).sort((a, b) => b.multiplier - a.multiplier);
    
    for (const zone of sorted) {
      const tooClose = hotspots.some(h => {
        const dist = Math.sqrt(
          Math.pow(h.center.lat - zone.center.lat, 2) +
          Math.pow(h.center.lng - zone.center.lng, 2)
        );
        return dist < 0.015;
      });

      if (!tooClose) {
        hotspots.push({
          center: zone.center,
          surgeAmount: zone.surgeAmount,
          multiplier: zone.multiplier
        });
      }
    }

    // Calculate bounds
    const allZones = gridCells.filter(z => z.multiplier >= 1.25);
    if (allZones.length === 0) return;

    const lats = allZones.map(z => z.center.lat);
    const lngs = allZones.map(z => z.center.lng);
    const minLat = Math.min(...lats) - 0.01;
    const maxLat = Math.max(...lats) + 0.01;
    const minLng = Math.min(...lngs) - 0.01;
    const maxLng = Math.max(...lngs) + 0.01;

    // Create canvas for smooth heatmap
    const canvas = document.createElement('canvas');
    const width = 800;
    const height = 800;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear with transparent
    ctx.clearRect(0, 0, width, height);

    // Draw each zone as a soft radial gradient
    for (const zone of allZones) {
      const x = ((zone.center.lng - minLng) / (maxLng - minLng)) * width;
      const y = ((maxLat - zone.center.lat) / (maxLat - minLat)) * height;
      
      const intensity = (zone.multiplier - 1.0) / 2.0; // 0 to 1
      const radius = 25 + (intensity * 15);

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      
      // Purple gradient
      const alpha = Math.min(0.6, intensity * 0.8);
      gradient.addColorStop(0, `rgba(124, 58, 237, ${alpha})`);
      gradient.addColorStop(0.5, `rgba(139, 92, 246, ${alpha * 0.7})`);
      gradient.addColorStop(1, `rgba(167, 139, 250, 0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Apply blur for smoothness
    ctx.filter = 'blur(8px)';
    const imageData = ctx.getImageData(0, 0, width, height);
    ctx.putImageData(imageData, 0, 0);

    // Create ground overlay
    const bounds = new google.maps.LatLngBounds(
      new google.maps.LatLng(minLat, minLng),
      new google.maps.LatLng(maxLat, maxLng)
    );

    overlayRef.current = new google.maps.GroundOverlay(
      canvas.toDataURL(),
      bounds,
      { opacity: 0.85 }
    );
    overlayRef.current.setMap(map);

    // Add ONE label per hotspot (only high-surge centers)
    for (const hotspot of hotspots) {
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
  }, [map, gridCells]);

  useEffect(() => {
    return () => clearOverlays();
  }, []);

  return null;
};

export default SurgeHeatmapOverlay;