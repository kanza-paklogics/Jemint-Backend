const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Receipt = sequelize.define(
  "receipts",
  {
    name: DataTypes.STRING,
    url: DataTypes.STRING,
    points: DataTypes.STRING,
    location: DataTypes.STRING,
    amount: DataTypes.DECIMAL(10, 2),
    date: {
      type: DataTypes.DATEONLY,
      defaultValue: null,
    },
    addedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: "In-Progress",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = Receipt;
