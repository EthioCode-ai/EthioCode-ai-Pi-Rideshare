import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

const Map = ({ ride }) => {
  const mapRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loader = new Loader({
      apiKey: 'YOUR_ACTUAL_API_KEY', // Replace with your Google Maps API key
      version: 'weekly',
      libraries: ['places'],
    });

    loader
      .load()
      .then(() => {
        const map = new window.google.maps.Map(mapRef.current, {
          center: { lat: 37.7749, lng: -122.4194 }, // Default: San Francisco
          zoom: 12,
        });

        // Add marker for ride pickup location if provided
        if (ride && ride.pickupLocation) {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ address: ride.pickupLocation }, (results, status) => {
            if (status === 'OK' && results[0]) {
              map.setCenter(results[0].geometry.location);
              new window.google.maps.Marker({
                map,
                position: results[0].geometry.location,
                title: 'Pickup Location: ' + ride.pickupLocation,
              });
            } else {
              setError('Geocode failed for pickup location: ' + status);
              console.error('Geocode error:', status);
            }
          });
        }
      })
      .catch((err) => {
        setError('Failed to load Google Maps: ' + err.message);
        console.error('Google Maps load error:', err);
      });
  }, [ride]);

  if (error) {
    return <div style={{ color: 'red', padding: '20px' }}>{error}</div>;
  }

  return (
    <div>
      <h2>Driver Map</h2>
      <div ref={mapRef} style={{ height: '400px', width: '100%' }} />
    </div>
  );
};

export default Map;
