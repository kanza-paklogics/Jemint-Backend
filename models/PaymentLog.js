
const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PaymentLog = sequelize.define('payment_logs', {
	userplanId: DataTypes.INTEGER,
	amount: DataTypes.INTEGER,
	userId:DataTypes.INTEGER,
},{
	timestamps: true,
});
module.exports = PaymentLog;