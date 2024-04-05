const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RaffleBuyer = sequelize.define('raffle_buyers', {
  raffleId: DataTypes.INTEGER,
  userId: DataTypes.INTEGER
},
  {
    timestamps: true,
  });

module.exports = RaffleBuyer;