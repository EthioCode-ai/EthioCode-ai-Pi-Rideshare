import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, List, ListItem, ListItemText } from '@mui/material';
import axios from 'axios';
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

const Dashboard = () => {
  const [rides, setRides] = useState([]);
  const [activeRide, setActiveRide] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRides = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('http://localhost:5000/api/rides/available', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setRides(response.data);
      } catch (error) {
        console.error('Failed to fetch rides:', error);
      }
    };
    fetchRides();

    return () => socket.disconnect();
  }, []);

  const acceptRide = async (rideId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`http://localhost:5000/api/rides/accept/${rideId}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRides(rides.filter((ride) => ride.id !== rideId));
      setActiveRide(rideId);
      socket.emit('joinRide', rideId);
      alert('Ride accepted');
      navigate(`/ride-tracking/${rideId}`);
    } catch (error) {
      alert('Failed to accept ride: ' + (error.response?.data?.message || 'Unknown error'));
    }
  };

  const updateLocation = () => {
    if (activeRide) {
      const latitude = 37.7749 + (Math.random() - 0.5) * 0.01;
      const longitude = -122.4194 + (Math.random() - 0.5) * 0.01;
      socket.emit('updateLocation', {
        rideId: activeRide,
        latitude,
        longitude,
      });
      console.log(`Location updated for ride ${activeRide}: ${latitude}, ${longitude}`);
    }
  };

  return (
    <Box sx={{ maxWidth: 600, margin: 'auto', mt: 5 }}>
      <h2>Available Rides</h2>
      <List>
        {rides.map((ride) => (
          <ListItem key={ride.id} divider>
            <ListItemText
              primary={`Pickup: ${ride.pickupLocation}`}
              secondary={`Dropoff: ${ride.dropoffLocation}`}
            />
            <Button variant="contained" onClick={() => acceptRide(ride.id)}>Accept</Button>
          </ListItem>
        ))}
      </List>
      {activeRide && (
        <Box sx={{ mt: 3 }}>
          <h3>Active Ride: {activeRide}</h3>
          <Button variant="contained" onClick={updateLocation}>Update Location</Button>
        </Box>
      )}
    </Box>
  );
};

export default Dashboard;
