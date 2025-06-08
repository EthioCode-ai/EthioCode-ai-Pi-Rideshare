const { DataTypes } = require('sequelize');
const sequelize = require('./index');
const User = require('./User');

const Ride = sequelize.define('Ride', {
  pickupLocation: { type: DataTypes.STRING, allowNull: false },
  dropoffLocation: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'accepted', 'completed'), defaultValue: 'pending' },
  paymentStatus: { type: DataTypes.ENUM('pending', 'paid', 'failed'), defaultValue: 'pending' },
  riderId: { type: DataTypes.INTEGER, allowNull: false },
  driverId: { type: DataTypes.INTEGER, allowNull: true },
});

Ride.belongsTo(User, { foreignKey: 'riderId', as: 'rider' });
Ride.belongsTo(User, { foreignKey: 'driverId', as: 'driver' });

module.exports = Ride;
