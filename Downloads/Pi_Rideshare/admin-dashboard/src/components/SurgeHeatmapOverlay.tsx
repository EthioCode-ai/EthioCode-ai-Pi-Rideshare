import React, { useEffect, useRef } from 'react';

interface GridCell {
  id: string;
  code: string;
  center: { lat: number; lng: number };
  polygon: { lat: number; lng: number }[];
  demand: number;
}

interface SurgeHeatmapOverlayProps {
  map: google.maps.Map | null;
  gridCells: GridCell[];
  onCellClick?: (cell: GridCell) => void;
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

  // Get color based on demand
  const getDemandColor = (demand: number): string => {
    if (demand >= 2.5) return '#dc2626'; // Red
    if (demand >= 2.0) return '#f97316'; // Orange  
    if (demand >= 1.75) return '#eab308'; // Yellow
    if (demand >= 1.5) return '#84cc16'; // Light green
    return 'transparent'; // No color for normal demand
  };

  const getOpacity = (demand: number): number => {
    if (demand >= 2.5) return 0.6;
    if (demand >= 2.0) return 0.5;
    if (demand >= 1.75) return 0.4;
    if (demand >= 1.5) return 0.3;
    return 0;
  };

  useEffect(() => {
    if (!map || !window.google) return;

    clearOverlays();

    gridCells.forEach(cell => {
      const color = getDemandColor(cell.demand);
      const opacity = getOpacity(cell.demand);
      
      // Only render cells with demand >= 1.5
      if (cell.demand < 1.5) return;

      const polygon = new google.maps.Polygon({
        paths: cell.polygon.map(p => ({ lat: p.lat, lng: p.lng })),
        strokeColor: color,
        strokeOpacity: 0.8,
        strokeWeight: 1,
        fillColor: color,
        fillOpacity: opacity,
        map: map,
        zIndex: Math.floor(cell.demand * 10)
      });

      if (onCellClick) {
        polygon.addListener('click', () => onCellClick(cell));
      }

      polygonsRef.current.push(polygon);

      // Add surge label for high demand cells
      if (cell.demand >= 1.75) {
        const surgeExtra = ((cell.demand - 1) * 5).toFixed(2);
        
        const marker = new google.maps.Marker({
          position: cell.center,
          map: map,
          label: {
            text: `+$${surgeExtra}`,
            color: 'white',
            fontSize: '11px',
            fontWeight: 'bold'
          },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 0
          }
        });
        
        markersRef.current.push(marker);
      }
    });

    return () => clearOverlays();
  }, [map, gridCells, onCellClick]);

  useEffect(() => {
    return () => clearOverlays();
  }, []);

  return null;
};

export default SurgeHeatmapOverlay;