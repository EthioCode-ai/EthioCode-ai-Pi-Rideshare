/**
 * StatusRow Component
 * Shows pickup/dropoff status during navigation
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
type TripStatus = 'en_route_to_pickup' | 'at_pickup' | 'in_trip' | 'completed' | 'cancelled';


const COLORS = {
  text: '#1F2937',
  textSecondary: '#6B7280',
  success: '#10B981',
  warning: '#F59E0B',
  primary: '#6B46C1',
  border: '#E5E7EB',
};

interface StatusRowProps {
  riderName: string;
  address: string;
  tripStatus: TripStatus;
  distance?: string;
  eta?: string;
}

const StatusRow: React.FC<StatusRowProps> = ({
  riderName,
  address,
  tripStatus,
  distance,
  eta,
}) => {
    
  const getFirstName = (fullName: string): string => {
    return fullName.split(' ')[0];
  };

  const getStatusDisplay = () => {
    const firstName = getFirstName(riderName);
    
    switch (tripStatus) {
      case 'en_route_to_pickup':
        return {
          label: `Picking up ${firstName}`,
          dotColor: COLORS.success,
        };
      case 'at_pickup':
        return {
          label: `Waiting for ${firstName}`,
          dotColor: COLORS.warning,
        };
      case 'in_trip':
        return {
          label: `Dropping off ${firstName}`,
          dotColor: COLORS.primary,
        };
      default:
        return {
          label: riderName,
          dotColor: COLORS.textSecondary,
        };
    }
  };

  const statusDisplay = getStatusDisplay();

    return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: statusDisplay.dotColor }]} />
      <View style={styles.info}>
        <Text style={styles.label}>{statusDisplay.label}</Text>
        <Text style={styles.address} numberOfLines={1}>{address}</Text>
      </View>
      <View style={styles.distanceContainer}>
        {eta && <Text style={styles.eta}>{eta}</Text>}
        {distance && <Text style={styles.nearby}>{distance}</Text>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  address: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  nearby: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  distanceContainer: {
    alignItems: 'flex-end',
  },
  eta: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.success,
    marginBottom: 2,
  },
});

export default StatusRow;