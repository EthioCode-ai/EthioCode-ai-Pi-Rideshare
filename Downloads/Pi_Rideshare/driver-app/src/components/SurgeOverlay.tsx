import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Polygon, Marker } from 'react-native-maps';

interface SurgeZone {
  id: string;
  code: string;
  zoneType: string;
  center: { lat: number; lng: number };
  polygon: { lat: number; lng: number }[];
  multiplier: number;
  surgeAmount: string;
}

interface SurgeOverlayProps {
  zones: SurgeZone[];
}

const SurgeOverlay: React.FC<SurgeOverlayProps> = ({ zones }) => {
  if (!zones || zones.length === 0) return null;

  // Get color based on multiplier
  const getColor = (multiplier: number): string => {
    if (multiplier >= 2.5) return 'rgba(88, 28, 135, 0.5)';   // Dark purple
    if (multiplier >= 2.0) return 'rgba(124, 58, 237, 0.45)'; // Purple
    if (multiplier >= 1.75) return 'rgba(139, 92, 246, 0.4)'; // Medium purple
    return 'rgba(167, 139, 250, 0.35)';                        // Light purple
  };

  // Filter labels - city zones spaced 0.012 apart, airport max 3
  const getLabels = () => {
    const labels: SurgeZone[] = [];
    const airportZones = zones.filter(z => z.zoneType === 'airport');
    const cityZones = zones.filter(z => z.zoneType !== 'airport');

    // City labels
    const sortedCity = [...cityZones]
      .filter(z => z.multiplier >= 1.5)
      .sort((a, b) => b.multiplier - a.multiplier);

    for (const zone of sortedCity) {
      const tooClose = labels.some(h => {
        const dist = Math.sqrt(
          Math.pow(h.center.lat - zone.center.lat, 2) +
          Math.pow(h.center.lng - zone.center.lng, 2)
        );
        return dist < 0.012;
      });
      if (!tooClose) labels.push(zone);
    }

    // Airport labels - max 3 per airport
    const airportCodes = [...new Set(airportZones.map(z => z.code.split('-')[0]))];
    
    for (const code of airportCodes) {
      const cells = airportZones
        .filter(z => z.code.startsWith(code + '-') && z.multiplier >= 1.25)
        .sort((a, b) => b.multiplier - a.multiplier);
      
      if (cells.length === 0) continue;
      
      // Center label
      labels.push(cells[0]);
      
      // 2 edge labels
      let edgeCount = 0;
      for (const cell of cells.slice(1)) {
        if (edgeCount >= 2) break;
        const dist = Math.sqrt(
          Math.pow(cell.center.lat - cells[0].center.lat, 2) +
          Math.pow(cell.center.lng - cells[0].center.lng, 2)
        );
        if (dist >= 0.018 && dist <= 0.028) {
          labels.push(cell);
          edgeCount++;
        }
      }
    }

    return labels;
  };

  const labels = getLabels();

  // Parse polygon coords
  const parsePolygon = (polygon: any) => {
    const coords = typeof polygon === 'string' ? JSON.parse(polygon) : polygon;
    return coords.map((p: any) => ({ latitude: p.lat, longitude: p.lng }));
  };

  return (
    <>
      {/* Render all surge polygons */}
      {zones.filter(z => z.multiplier >= 1.25).map(zone => (
        <Polygon
          key={zone.id}
          coordinates={parsePolygon(zone.polygon)}
          fillColor={getColor(zone.multiplier)}
          strokeColor="transparent"
          strokeWidth={0}
          zIndex={1}
        />
      ))}

      {/* Render labels */}
      {labels.map(zone => (
        <Marker
          key={`label-${zone.id}`}
          coordinate={{
            latitude: zone.center.lat,
            longitude: zone.center.lng,
          }}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
        >
          <View style={styles.labelContainer}>
            <Text style={[
              styles.labelText,
              zone.multiplier >= 2.5 ? styles.labelLarge :
              zone.multiplier >= 2.0 ? styles.labelMedium : styles.labelSmall
            ]}>
              +${zone.surgeAmount}
            </Text>
          </View>
        </Marker>
      ))}
    </>
  );
};

const styles = StyleSheet.create({
  labelContainer: {
    backgroundColor: 'transparent',
  },
  labelText: {
    color: 'white',
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  labelLarge: { fontSize: 12 },
  labelMedium: { fontSize: 11 },
  labelSmall: { fontSize: 10 },
});

export default SurgeOverlay;