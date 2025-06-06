import React, { useState } from 'react';
import { TextField, Button, Box } from '@mui/material';
import axios from 'axios';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';

const mapContainerStyle = {
  height: '400px',
  width: '100%',
};

const center = {
  lat: 37.7749,
  lng: -122.4194,
};

const RideRequest = () => {
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');
  const [pickupPosition, setPickupPosition] = useState(center);
  const [dropoffPosition, setDropoffPosition] = useState(null);

  const handleRequest = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        'http://localhost:5000/api/rides/request',
        { pickupLocation, dropoffLocation },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Ride requested successfully');
      setPickupLocation('');
      setDropoffLocation('');
    } catch (error) {
      alert('Failed to request ride: ' + (error.response?.data?.message || 'Unknown error'));
    }
  };

  const onMapClick = (e) => {
    if (!pickupPosition) {
      setPickupPosition({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    } else if (!dropoffPosition) {
      setDropoffPosition({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    }
  };

  return (
    <Box sx={{ maxWidth: 600, margin: 'auto', mt: 5 }}>
      <h2>Request a Ride</h2>
      <LoadScript googleMapsApiKey="AIzaSyCYJnVS_4EdeLrxACl4W5eTOCQiwgYTk28">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={10}
          onClick={onMapClick}
        >
          {pickupPosition && <Marker position={pickupPosition} label="P" />}
          {dropoffPosition && <Marker position={dropoffPosition} label="D" />}
        </GoogleMap>
      </LoadScript>
      <TextField
        label="Pickup Location"
        value={pickupLocation}
        onChange={(e) => setPickupLocation(e.target.value)}
        fullWidth
        sx={{ mt: 2 }}
      />
      <TextField
        label="Dropoff Location"
        value={dropoffLocation}
        onChange={(e) => setDropoffLocation(e.target.value)}
        fullWidth
        sx={{ mt: 2 }}
      />
      <Button variant="contained" onClick={handleRequest} sx={{ mt: 2 }}>
        Request Ride
      </Button>
    </Box>
  );
};

export default RideRequest;
