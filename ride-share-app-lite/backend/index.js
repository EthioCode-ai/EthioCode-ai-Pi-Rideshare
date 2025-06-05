const express = require('express');
const cors = require('cors');
const sequelize = require('./models');
const authRoutes = require('./routes/auth');
const rideRoutes = require('./routes/rides');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

sequelize.sync({ force: true });
