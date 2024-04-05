const { Sequelize, DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const PaypalSubscriptions = require("./PaypalSubscriptions");

const User = sequelize.define(
  "users",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false,
      primaryKey: true,
    },

    fullName: DataTypes.STRING,

    countryCode: DataTypes.INTEGER,

    phoneNo: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },

    email: {
      type: DataTypes.STRING,
      defaultValue: "x@gmail.com",
    },

    points: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
    },

    amountSpent: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
    },

    totalAmount: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
    },

    tickets: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
    },

    referralCount: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
    },

    payments: {
      type: DataTypes.BIGINT,
      defaultValue: 0,
    },

    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },

    isSuspended: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },

    verificationToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    resetToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    resetTokenExpiry: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    planId: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    isEmail: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    // New columns
    tutorialStepCounter: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    hasCompletedTutorial: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    isApprovedInfluencer: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    promoCode: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // For paypal subscriptions
    subscriptionId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // New columns for ios subscriptions
    originalTransactionId: {
      type: DataTypes.STRING,
    },
    platformSubscriptionName: {
      type: DataTypes.STRING,
    },
    isSubscriptionValid: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    expiresDate: {
      type: DataTypes.DATE,
    },
    subscriptionMessage: {
      type: DataTypes.STRING,
    },
  },
  {
    indexes: [
      // Create a unique index on phoneNo
      {
        unique: true,
        fields: ["phoneNo"],
      },
    ],
  }
);

module.exports = User;
