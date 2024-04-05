const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PricingPlan = sequelize.define(
  "pricing_plans",
  {
    plan_id: DataTypes.STRING,
    name: DataTypes.STRING,
    status: DataTypes.STRING,
    price: DataTypes.INTEGER,
    details: DataTypes.TEXT,
    planInterval: DataTypes.TEXT,
    tickets: {
      type: DataTypes.BIGINT,
    },
    planTier: DataTypes.INTEGER,
    isDeleted: DataTypes.BOOLEAN,
  },
  {
    timestamps: true,
  }
);

module.exports = PricingPlan;
