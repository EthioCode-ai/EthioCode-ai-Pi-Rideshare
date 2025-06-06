const express = require('express');
const jwt = require('jsonwebtoken');
const Ride = require('../models/Ride');

const router = express.Router();

const authMiddleware = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = decoded;
    next();
  });
};

router.post('/request', authMiddleware, async (req, res) => {
  if (req.user.role !== 'rider') return res.status(403).json({ message: 'Only riders can request rides' });

  const { pickupLocation, dropoffLocation } = req.body;
  try {
    const ride = await Ride.create({
      pickupLocation,
      dropoffLocation,
      riderId: req.user.id,
    });
    res.status(201).json({ message: 'Ride requested', ride });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/available', authMiddleware, async (req, res) => {
  if (req.user.role !== 'driver') return res.status(403).json({ message: 'Only drivers can view rides' });

  const rides = await Ride.findAll({ where: { status: 'pending', driverId: null } });
  res.json(rides);
});

router.put('/accept/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'driver') return res.status(403).json({ message: 'Only drivers can accept rides' });

  const ride = await Ride.findByPk(req.params.id);
  if (!ride || ride.status !== 'pending' || ride.driverId) {
    return res.status(400).json({ message: 'Ride not available' });
  }

  ride.driverId = req.user.id;
  ride.status = 'accepted';
  await ride.save();
  res.json({ message: 'Ride accepted', ride });
});

module.exports = router;
