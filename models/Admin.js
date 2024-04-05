const bcrypt = require('bcryptjs');
const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Admin = sequelize.define('admins', {
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			allowNull: false,
			primaryKey: true
		},
		fullName: DataTypes.STRING,
		countryCode: DataTypes.INTEGER,
		phoneNo: DataTypes.BIGINT,
		password: {
			type: DataTypes.STRING,
			allowNull: false
		},
		isVerified: {
			type: DataTypes.BOOLEAN,
			defaultValue:false,
			allowNull: false
		},
		verificationToken: {
			type: DataTypes.STRING,
			allowNull: true
		},
		resetToken: {
			type: DataTypes.STRING,
			allowNull: true
		},
		resetTokenExpiry: {
			type: DataTypes.DATE,
			allowNull:true
		},
  	},
	{
		indexes: [
			// Create a unique index on phoneNo
			{
				unique: true,
				fields: ['phoneNo']
			}],
	});

module.exports = Admin;