/**
 * RiderCard Component
 * Displays rider information with contact and cancel options
 * 
 * Phase 2.6 - Updated:
 * - Shows "Picking up [Name]" / "Dropping off [Name]" instead of fare
 * - Cancel button moved to bottom
 * - Removed fare display (driver already accepted)
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { RiderInfo, TripStatus, formatDistance, formatDuration } from '../../types/ride.types';

// Colors
const COLORS = {
  text: '#1F2937',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  primary: '#6B46C1',
  star: '#FBBF24',
};

interface RiderCardProps {
  rider: RiderInfo;
  pickup: { address: string };
  destination: { address: string };
  tripStatus: TripStatus;
  distanceToTarget?: number; // in miles
  etaToTarget?: number; // in minutes
  onCall: () => void;
  onMessage: () => void;
  onCancel: () => void;
  showCancelButton: boolean;
}

const RiderCard: React.FC<RiderCardProps> = ({
  rider,
  pickup,
  destination,
  tripStatus,
  distanceToTarget,
  etaToTarget,
  onCall,
  onMessage,
  onCancel,
  showCancelButton,
}) => {
  // Get first name only
  const getFirstName = (fullName: string): string => {
    return fullName.split(' ')[0];
  };

  // Get initials for avatar fallback
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Render star rating
  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);

    for (let i = 0; i < 5; i++) {
      stars.push(
        <Text key={i} style={[styles.star, i < fullStars && styles.starFilled]}>
          ★
        </Text>
      );
    }
    return stars;
  };

  // Get status-specific display info
  const getStatusDisplay = () => {
    const firstName = getFirstName(rider.name);
    
    switch (tripStatus) {
      case 'en_route_to_pickup':
        return {
          actionLabel: `Picking up ${firstName}`,
          address: pickup.address,
          showEta: true,
          dotColor: COLORS.success,
        };
      case 'at_pickup':
        return {
          actionLabel: `Waiting for ${firstName}`,
          address: pickup.address,
          showEta: false,
          dotColor: COLORS.warning,
        };
      case 'in_trip':
        return {
          actionLabel: `Dropping off ${firstName}`,
          address: destination.address,
          showEta: true,
          dotColor: COLORS.primary,
        };
      case 'completed':
        return {
          actionLabel: `Trip completed`,
          address: destination.address,
          showEta: false,
          dotColor: COLORS.success,
        };
      default:
        return {
          actionLabel: rider.name,
          address: destination.address,
          showEta: false,
          dotColor: COLORS.textSecondary,
        };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <View style={styles.container}>
      {/* Rider info row */}
      <View style={styles.riderRow}>
        {/* Avatar */}
        {rider.photoUrl ? (
          <Image source={{ uri: rider.photoUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>{getInitials(rider.name)}</Text>
          </View>
        )}

        {/* Name and rating */}
        <View style={styles.riderInfo}>
          <Text style={styles.riderName}>{rider.name}</Text>
          <View style={styles.ratingRow}>
            <View style={styles.starsContainer}>
              {renderStars(rider.rating)}
            </View>
            <Text style={styles.ratingText}>{rider.rating.toFixed(1)}</Text>
          </View>
        </View>

        {/* Contact buttons */}
        <View style={styles.contactButtons}>
          <TouchableOpacity style={styles.contactButton} onPress={onMessage}>
            <Text style={styles.contactIcon}>💬</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.contactButton, styles.callButton]} 
            onPress={onCall}
          >
            <Text style={styles.contactIcon}>📞</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Status/Action label - "Picking up John" / "Dropping off John" */}
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: statusDisplay.dotColor }]} />
        <View style={styles.statusInfo}>
          <Text style={styles.statusLabel}>{statusDisplay.actionLabel}</Text>
          <Text style={styles.statusAddress} numberOfLines={1}>
            {statusDisplay.address}
          </Text>
        </View>
        {statusDisplay.showEta && distanceToTarget !== undefined && (
          <View style={styles.etaContainer}>
            <Text style={styles.etaValue}>
              {formatDistance(distanceToTarget)}
            </Text>
            {etaToTarget !== undefined && (
              <Text style={styles.etaTime}>{formatDuration(etaToTarget)}</Text>
            )}
          </View>
        )}
      </View>
      
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  riderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  riderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  riderName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    marginRight: 6,
  },
  star: {
    fontSize: 12,
    color: '#D1D5DB',
  },
  starFilled: {
    color: COLORS.star,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  contactButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callButton: {
    backgroundColor: '#ECFDF5',
  },
  contactIcon: {
    fontSize: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  statusInfo: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  statusAddress: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  etaContainer: {
    alignItems: 'flex-end',
  },
  etaValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  etaTime: {
    fontSize: 13,
    color: COLORS.success,
    fontWeight: '600',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelIcon: {
    fontSize: 14,
    color: COLORS.danger,
    marginRight: 6,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.danger,
  },
});

export default RiderCard;
