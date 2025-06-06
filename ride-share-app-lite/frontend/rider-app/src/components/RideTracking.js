import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

const RideTracking = () => {
  const [location, setLocation] = useState(null);
  const rideId = 1; // Hardcoded for testing; in production, get dynamically

  useEffect(() => {
    socket.emit('joinRide', rideId);

    socket.on('locationUpdate', (data) => {
      if (data.rideId === rideId) {
        setLocation({ latitude: data.latitude, longitude: data.longitude });
        console.log('Location update received:', data);
      }
    });

    return () => {
      socket.off('locationUpdate');
      socket.disconnect();
    };
  }, []);

  return (
    <Box sx={{ maxWidth: 400, margin: 'auto', mt: 5 }}>
      <h2>Ride Tracking</h2>
      {location ? (
        <Typography>
          Driver Location: Latitude {location.latitude.toFixed(4)}, Longitude {location.longitude.toFixed(4)}
        </Typography>
      ) : (
        <Typography>Waiting for driver location...</Typography>
      )}
    </Box>
  );
};

export default RideTracking;
