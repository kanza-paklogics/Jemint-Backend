const bcrypt = require("bcryptjs");
const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const UserReferral = sequelize.define("userreferrals", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
    primaryKey: true,
  },

  senderId: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },

  receiverId: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },

  // isReceiverVerified: {
  //   type: DataTypes.BOOLEAN,
  //   defaultValue: false,
  // },

  receiverPhoneNo: {
    type: DataTypes.BIGINT,
    defaultValue: 123456789,
  },

  receiverEmail: {
    type: DataTypes.STRING,
    defaultValue: "x@gmail.com",
  },

  referralCode: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

module.exports = UserReferral;
