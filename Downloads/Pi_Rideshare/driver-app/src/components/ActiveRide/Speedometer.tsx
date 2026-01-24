import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface SpeedometerProps {
  speed: number;
  isSpeedingMinor: boolean;
  isSpeedingMajor: boolean;
}

const Speedometer: React.FC<SpeedometerProps> = ({ 
  speed, 
  isSpeedingMinor, 
  isSpeedingMajor 
}) => {
  const getBackgroundColor = () => {
    if (isSpeedingMajor) return '#DC2626'; // Red
    if (isSpeedingMinor) return '#F59E0B'; // Amber
    return '#1F2937'; // Dark gray
  };

  const getTextColor = () => {
    if (isSpeedingMajor || isSpeedingMinor) return '#FFFFFF';
    return '#FFFFFF';
  };

  return (
    <View style={[styles.container, { backgroundColor: getBackgroundColor() }]}>
      <Text style={[styles.speed, { color: getTextColor() }]}>{speed}</Text>
      <Text style={[styles.unit, { color: getTextColor() }]}>MPH</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 220,
    left: 16,
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  speed: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  unit: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: -2,
  },
});

export default Speedometer;