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
    const airportZones = gridCells.filter(z => z.code.match(/^[A-Z]{3}-/));
    const cityZones = gridCells.filter(z => !z.code.match(/^[A-Z]{3}-/));

    // Find city hotspot labels (existing logic)
    const cityLabels: { center: { lat: number; lng: number }; surgeAmount: string; multiplier: number }[] = [];
    const sortedCity = [...cityZones].filter(z => z.multiplier >= 1.5).sort((a, b) => b.multiplier - a.multiplier);
    
    for (const zone of sortedCity) {
      const tooClose = cityLabels.some(h => {
        const dist = Math.sqrt(
          Math.pow(h.center.lat - zone.center.lat, 2) +
          Math.pow(h.center.lng - zone.center.lng, 2)
        );
        return dist < 0.008;
      });

      if (!tooClose) {
        cityLabels.push({
          center: zone.center,
          surgeAmount: zone.surgeAmount,
          multiplier: zone.multiplier
        });
      }
    }

    // Airport labels - only 3 per airport: center + 2 approach roads
    const airportLabels: { center: { lat: number; lng: number }; surgeAmount: string; multiplier: number }[] = [];
    const airportCodes = [...new Set(airportZones.map(z => z.code.split('-')[0]))];
    
    for (const code of airportCodes) {
      const airportCells = airportZones.filter(z => z.code.startsWith(code + '-'));
      if (airportCells.length === 0) continue;
      
      // Find highest surge zone as center
      const sorted = [...airportCells].sort((a, b) => b.multiplier - a.multiplier);
      const centerZone = sorted[0];
      
      if (centerZone.multiplier >= 1.5) {
        // Main label at center (rideshare lot)
        airportLabels.push({
          center: centerZone.center,
          surgeAmount: centerZone.surgeAmount,
          multiplier: centerZone.multiplier
        });
        
        // Two approach labels ~1.5 miles out (0.022 degrees)
        const approachDist = 0.022;
        
        // Find zones near approach points
        const northApproach = airportCells.find(z => 
          Math.abs(z.center.lat - (centerZone.center.lat + approachDist)) < 0.005 &&
          Math.abs(z.center.lng - centerZone.center.lng) < 0.005
        );
        const southApproach = airportCells.find(z => 
          Math.abs(z.center.lat - (centerZone.center.lat - approachDist)) < 0.005 &&
          Math.abs(z.center.lng - centerZone.center.lng) < 0.005
        );
        
        if (northApproach && northApproach.multiplier >= 1.25) {
          airportLabels.push({
            center: northApproach.center,
            surgeAmount: northApproach.surgeAmount,
            multiplier: northApproach.multiplier
          });
        }
        if (southApproach && southApproach.multiplier >= 1.25) {
          airportLabels.push({
            center: southApproach.center,
            surgeAmount: southApproach.surgeAmount,
            multiplier: southApproach.multiplier
          });
        }
      }
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

    // Create ground overlay with LOW zIndex (behind roads)
    const bounds = new google.maps.LatLngBounds(
      new google.maps.LatLng(minLat, minLng),
      new google.maps.LatLng(maxLat, maxLng)
    );

    // Use custom overlay for zIndex control
    class SurgeOverlay extends google.maps.OverlayView {
      private bounds: google.maps.LatLngBounds;
      private image: string;
      private div: HTMLDivElement | null = null;

      constructor(bounds: google.maps.LatLngBounds, image: string) {
        super();
        this.bounds = bounds;
        this.image = image;
      }

      onAdd() {
        this.div = document.createElement('div');
        this.div.style.borderStyle = 'none';
        this.div.style.borderWidth = '0px';
        this.div.style.position = 'absolute';

        const img = document.createElement('img');
        img.src = this.image;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.opacity = '0.85';
        this.div.appendChild(img);

        // Add to mapPane (below roads) instead of overlayLayer
        const panes = this.getPanes();
        panes?.mapPane.appendChild(this.div);
      }

      draw() {
        const overlayProjection = this.getProjection();
        const sw = overlayProjection.fromLatLngToDivPixel(this.bounds.getSouthWest());
        const ne = overlayProjection.fromLatLngToDivPixel(this.bounds.getNorthEast());

        if (this.div && sw && ne) {
          this.div.style.left = sw.x + 'px';
          this.div.style.top = ne.y + 'px';
          this.div.style.width = (ne.x - sw.x) + 'px';
          this.div.style.height = (sw.y - ne.y) + 'px';
        }
      }

      onRemove() {
        if (this.div) {
          this.div.parentNode?.removeChild(this.div);
          this.div = null;
        }
      }
    }

    const overlay = new SurgeOverlay(bounds, canvas.toDataURL());
    overlay.setMap(map);
    overlayRef.current = overlay as any;

    // Add labels - city + airport (max 3 per airport)
    const allLabels = [...cityLabels, ...airportLabels];
    
    for (const label of allLabels) {
      const fontSize = label.multiplier >= 2.5 ? '11px' : label.multiplier >= 2.0 ? '10px' : '9px';
      
      const marker = new google.maps.Marker({
        position: label.center,
        map: map,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
        label: {
          text: `+$${label.surgeAmount}`,
          color: 'white',
          fontSize: fontSize,
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