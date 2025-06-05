import React, { useState } from 'react';
import { TextField, Button, Box } from '@mui/material';
import axios from 'axios';

const RideRequest = () => {
  const [pickupLocation, setPickupLocation] = useState('');
  const [dropoffLocation, setDropoffLocation] = useState('');

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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 400, margin: 'auto', mt: 5 }}>
      <h2>Request a Ride</h2>
      <TextField
        label="Pickup Location"
        value={pickupLocation}
        onChange={(e) => setPickupLocation(e.target.value)}
      />
      <TextField
        label="Dropoff Location"
        value={dropoffLocation}
        onChange={(e) => setDropoffLocation(e.target.value)}
      />
      <Button variant="contained" onClick={handleRequest}>Request Ride</Button>
    </Box>
  );
};

export default RideRequest;
