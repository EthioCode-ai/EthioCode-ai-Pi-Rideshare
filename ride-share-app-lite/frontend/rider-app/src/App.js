import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import { Box, AppBar, Toolbar, Typography, Button } from '@mui/material';
import Login from './components/Login';
import RideRequest from './components/RideRequest';
import RideTracking from './components/RideTracking';
import Payment from './components/Payment';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Ride Share App Lite - Rider
          </Typography>
          <Button color="inherit" component={Link} to="/ride-request">
            Request Ride
          </Button>
          <Button color="inherit" component={Link} to="/ride-tracking">
            Track Ride
          </Button>
          <Button color="inherit" component={Link} to="/payment">
            Pay for Ride
          </Button>
          <Button color="inherit" onClick={() => localStorage.removeItem('token')}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>
      <Box sx={{ mt: 4 }}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/ride-request"
            element={
              <ProtectedRoute>
                <RideRequest />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ride-tracking"
            element={
              <ProtectedRoute>
                <RideTracking />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payment"
            element={
              <ProtectedRoute>
                <Payment amount={500} />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Login />} />
        </Routes>
      </Box>
    </Router>
  );
}

export default App;
