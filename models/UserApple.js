const bcrypt = require("bcryptjs");
const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const UserApple = sequelize.define(
  "appleusers",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    appleId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    timestamps: false,
  }
);

module.exports = UserApple;
