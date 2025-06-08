import React, { useState, useEffect } from 'react';
import { Box, Button, List, ListItem, ListItemText } from '@mui/material';
import axios from 'axios';

const Dashboard = () => {
  const [rides, setRides] = useState([]);

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
        alert('Failed to load rides. Check console for details.');
      }
    };
    fetchRides();
  }, []);

  const acceptRide = async (rideId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`http://localhost:5000/api/rides/accept/${rideId}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRides(rides.filter((ride) => ride.id !== rideId));
      alert('Ride accepted');
    } catch (error) {
      alert('Failed to accept ride');
    }
  };

  return (
    <Box sx={{ maxWidth: 600, margin: 'auto', mt: 5 }}>
      <h2>Available Rides</h2>
      {rides.length === 0 ? (
        <p>No available rides.</p>
      ) : (
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
      )}
    </Box>
  );
};

export default Dashboard;
