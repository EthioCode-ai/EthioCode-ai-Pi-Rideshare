import React, { useState } from 'react';
import { TextField, Button, Box } from '@mui/material';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', { email, password });
      localStorage.setItem('token', response.data.token);
      alert('Login successful');
      navigate('/dashboard');
    } catch (error) {
      alert('Login failed: ' + (error.response?.data?.message || 'Unknown error'));
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 300, margin: 'auto', mt: 5 }}>
      <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <Button variant="contained" onClick={handleLogin}>Login</Button>
    </Box>
  );
};

export default Login;
