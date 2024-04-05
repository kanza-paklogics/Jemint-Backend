const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const IosSubscriptions = sequelize.define(
  "ios_subscriptions",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    notificationType: {
      type: DataTypes.STRING,
    },
    subtype: {
      type: DataTypes.STRING,
    },
    transactionId: {
      type: DataTypes.STRING,
    },
    originalTransactionId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: false,
    },
    purchaseDate: {
      type: DataTypes.DATE,
    },
    originalPurchaseDate: {
      type: DataTypes.DATE,
    },
    expiresDate: {
      type: DataTypes.DATE,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = IosSubscriptions;
