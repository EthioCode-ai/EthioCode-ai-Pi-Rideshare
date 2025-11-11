
import React from 'react';

interface GoogleMapsErrorProps {
  error: string;
}

export default function GoogleMapsError({ error }: GoogleMapsErrorProps) {
  return (
    <div style={{
      padding: '24px',
      backgroundColor: '#fef2f2',
      border: '1px solid #fecaca',
      borderRadius: '8px',
      margin: '16px',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗺️</div>
      <h3 style={{ color: '#dc2626', marginBottom: '8px' }}>Google Maps Configuration Error</h3>
      <p style={{ color: '#7f1d1d', marginBottom: '16px' }}>{error}</p>
      
      <div style={{
        backgroundColor: 'white',
        padding: '16px',
        borderRadius: '6px',
        textAlign: 'left',
        fontSize: '14px',
        lineHeight: '1.5'
      }}>
        <h4 style={{ marginBottom: '8px', color: '#1f2937' }}>To fix this issue:</h4>
        <ol style={{ margin: 0, paddingLeft: '20px' }}>
          <li>Get a Google Maps API key from <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>Google Cloud Console</a></li>
          <li>Enable these APIs: Maps JavaScript API, Places API, Geocoding API</li>
          <li>Add your API key to Replit Secrets as 'GMaps_Key'</li>
          <li>Configure domain restrictions (add your Replit domain)</li>
          <li>Restart your application</li>
        </ol>
      </div>
    </div>
  );
}
