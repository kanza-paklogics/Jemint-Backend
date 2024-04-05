const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PaypalSubscriptions = sequelize.define(
  "paypal_subscriptions",
  {
    subscriptionId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
    },
    status: DataTypes.STRING,
  },
  {
    timestamps: true,
  }
);

module.exports = PaypalSubscriptions;
