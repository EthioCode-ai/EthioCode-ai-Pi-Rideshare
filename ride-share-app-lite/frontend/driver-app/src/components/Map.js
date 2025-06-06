import React, { useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

const Map = () => {
  const mapRef = useRef(null);

  useEffect(() => {
    const loader = new Loader({
      apiKey: 'YOUR_ACTUAL_API_KEY', // Replace with your Google Maps API key
      version: 'weekly',
      libraries: ['places'],
    });

    loader
      .load()
      .then(() => {
        new window.google.maps.Map(mapRef.current, {
          center: { lat: 37.7749, lng: -122.4194 }, // San Francisco coordinates
          zoom: 12,
        });
      })
      .catch((error) => {
        console.error('Failed to load Google Maps:', error);
        alert('Google Maps failed to load. Check console for details.');
      });
  }, []);

  return (
    <div>
      <h2>Driver Map</h2>
      <div ref={mapRef} style={{ height: '400px', width: '100%' }} />
    </div>
  );
};

export default Map;
