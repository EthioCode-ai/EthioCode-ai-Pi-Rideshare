const { DataTypes } = require('sequelize');
const sequelize = require('./index');

const User = sequelize.define('User', {
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('rider', 'driver'), allowNull: false },
  name: { type: DataTypes.STRING },
  phone: { type: DataTypes.STRING },
});

module.exports = User;
