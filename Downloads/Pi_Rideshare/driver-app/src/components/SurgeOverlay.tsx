import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Circle, Marker } from 'react-native-maps';

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

  // Group zones into hotspots
  const getHotspots = () => {
    const hotspots: { center: { lat: number; lng: number }; maxMultiplier: number; surgeAmount: string }[] = [];
    const sorted = [...zones].filter(z => z.multiplier >= 1.5).sort((a, b) => b.multiplier - a.multiplier);
    const assigned = new Set<string>();

    for (const zone of sorted) {
      if (assigned.has(zone.id)) continue;

      const cluster = zones.filter(z => {
        const dist = Math.sqrt(
          Math.pow(z.center.lat - zone.center.lat, 2) +
          Math.pow(z.center.lng - zone.center.lng, 2)
        );
        return dist < 0.02;
      });

      cluster.forEach(z => assigned.add(z.id));
      hotspots.push({
        center: zone.center,
        maxMultiplier: zone.multiplier,
        surgeAmount: zone.surgeAmount,
      });
    }
    return hotspots;
  };

  const hotspots = getHotspots();

  // Create smooth gradient with 10 rings per hotspot
  const renderGradient = (hotspot: typeof hotspots[0], idx: number) => {
    const rings = [];
    const baseRadius = 2500; // meters
    const numRings = 10;

    for (let i = numRings; i >= 1; i--) {
      const ratio = i / numRings;
      const radius = baseRadius * ratio;
      const opacity = 0.35 * (1 - ratio) + 0.05; // Fade from 0.05 (outer) to 0.35 (inner)
      
      rings.push(
        <Circle
          key={`ring-${idx}-${i}`}
          center={{ latitude: hotspot.center.lat, longitude: hotspot.center.lng }}
          radius={radius}
          fillColor={`rgba(88, 28, 135, ${opacity})`}
          strokeColor="transparent"
          strokeWidth={0}
          zIndex={i}
        />
      );
    }
    return rings;
  };

  return (
    <>
      {hotspots.map((hotspot, idx) => renderGradient(hotspot, idx))}

      {hotspots.map((hotspot, idx) => (
        <Marker
          key={`label-${idx}`}
          coordinate={{
            latitude: hotspot.center.lat,
            longitude: hotspot.center.lng,
          }}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
        >
          <View style={styles.labelContainer}>
            <Text style={styles.labelText}>+${hotspot.surgeAmount}</Text>
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
    fontSize: 9,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});

export default SurgeOverlay;