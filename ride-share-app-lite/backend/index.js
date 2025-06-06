const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const sequelize = require('./models');
const authRoutes = require('./routes/auth');
const rideRoutes = require('./routes/rides');
const paymentRoutes = require('./routes/payments');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/payments', paymentRoutes);

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('joinRide', (rideId) => {
    socket.join(rideId);
    console.log(`User ${socket.id} joined ride ${rideId}`);
  });

  socket.on('updateLocation', (data) => {
    io.to(data.rideId).emit('locationUpdate', {
      rideId: data.rideId,
      latitude: data.latitude,
      longitude: data.longitude,
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

sequelize.sync({ force: true }); // Remove { force: true } in production
