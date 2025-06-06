import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

const RideTracking = () => {
  const { rideId } = useParams();
  const [location, setLocation] = useState(null);

  useEffect(() => {
    if (rideId) {
      socket.emit('joinRide', rideId);

      socket.on('locationUpdate', (data) => {
        if (data.rideId === parseInt(rideId)) {
          setLocation({ latitude: data.latitude, longitude: data.longitude });
          console.log('Rider location update received:', data);
        }
      });

      return () => {
        socket.off('locationUpdate');
        socket.disconnect();
      };
    }
  }, [rideId]);

  return (
    <Box sx={{ maxWidth: 400, margin: 'auto', mt: 5 }}>
      <h2>Rider Tracking for Ride {rideId}</h2>
      {location ? (
        <Typography>
          Rider Location: Latitude {location.latitude.toFixed(4)}, Longitude {location.longitude.toFixed(4)}
        </Typography>
      ) : (
        <Typography>Waiting for rider location...</Typography>
      )}
    </Box>
  );
};

export default RideTracking;
