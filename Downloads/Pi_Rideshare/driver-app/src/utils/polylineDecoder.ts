/**
 * Polyline Decoder Utility
 * Decodes Google Maps encoded polylines into coordinate arrays
 * 
 * Based on Google's Polyline Algorithm:
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */

export interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Decode a Google Maps encoded polyline string into an array of coordinates
 * @param encoded - The encoded polyline string
 * @returns Array of {latitude, longitude} objects
 */
export function decodePolyline(encoded: string): Coordinate[] {
  if (!encoded || encoded.length === 0) {
    return [];
  }

  const coordinates: Coordinate[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    // Decode latitude
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    // Decode longitude
    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    // Convert to decimal degrees (Google uses 1e5 precision)
    coordinates.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return coordinates;
}

/**
 * Calculate distance between two points using Haversine formula
 * @returns Distance in meters
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Find the closest point on a polyline to a given location
 * @param coordinates - Polyline coordinates
 * @param location - Current location
 * @returns Index of closest point and distance in meters
 */
export function findClosestPointOnPolyline(
  coordinates: Coordinate[],
  location: { latitude: number; longitude: number }
): { index: number; distance: number } {
  if (coordinates.length === 0) {
    return { index: -1, distance: Infinity };
  }

  let minDistance = Infinity;
  let closestIndex = 0;

  for (let i = 0; i < coordinates.length; i++) {
    const distance = haversineDistance(
      location.latitude,
      location.longitude,
      coordinates[i].latitude,
      coordinates[i].longitude
    );

    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = i;
    }
  }

  return {
    index: closestIndex,
    distance: minDistance,
  };
}
