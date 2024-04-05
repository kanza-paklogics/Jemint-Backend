const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const UserAppleSubscriptions = sequelize.define("user-apple-subscriptions", {
  originalTransactionId: {
    type: DataTypes.STRING,
  },
});

module.exports = UserAppleSubscriptions;
