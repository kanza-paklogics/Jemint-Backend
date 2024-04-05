const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Player = sequelize.define("player", {
  playerId: DataTypes.STRING,
});

module.exports = Player;
