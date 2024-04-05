const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Raffle = sequelize.define(
  "raffles",
  {
    name: DataTypes.STRING,
    price: DataTypes.INTEGER,
    status: {
      type: DataTypes.STRING,
    },
    totalTickets: { type: DataTypes.INTEGER, defaultValue: 100 },
    startDate: DataTypes.STRING,
    endDate: DataTypes.STRING,
    state: DataTypes.STRING,
    winnerId: DataTypes.INTEGER,
    details: DataTypes.TEXT,
    url: DataTypes.STRING,
  },
  {
    timestamps: true,
  }
);

module.exports = Raffle;
