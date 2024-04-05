const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const path = require("path");
var jwt = require("jsonwebtoken");
// const nodemailer = require("nodemailer");
const validator = require("validator");
const User = require("../../models/User");
const Receipt = require("../../models/Receipt");
const Raffle = require("../../models/Raffle");
const PricingPlan = require("../../models/PricingPlan");
const s3Upload = require("../../helpers/s3Upload");
const s3Delete = require("../../helpers/s3Delete");

User.hasMany(Receipt, { foreignKey: "addedBy" });
Receipt.belongsTo(User, { foreignKey: "addedBy" });

Raffle.hasMany(Receipt, { foreignKey: "receiptType" });
Receipt.belongsTo(Raffle, { foreignKey: "receiptType" });

const sendMail = require("../../helpers/nodeMailer");

const {
  receiptSchema,
  receiptSchemaV2,
} = require("../../helpers/validationSchemas");

exports.createReceiptV2 = async (req, res, next) => {
  try {
    const result = await receiptSchemaV2.validateAsync(req.body);
    console.log(req.body);
    const userId = req?.auth?.data?.userId;
    console.log("userId ", userId);
    const user = await User.findOne({ where: { id: userId }, raw: true });
    console.log("user ", user);
    const receiptImage = req.files["receiptImage"]
      ? req.files["receiptImage"][0].filename
      : null;
    console.log("receiptImage", receiptImage);
    const S3imageURL = await s3Upload(receiptImage, receiptImage);
    console.log("S3imageURL", S3imageURL);

    // console.log("Receit model is :", Receipt);
    const receipt = await new Receipt({
      name: req.body.name,
      url: "/files/" + receiptImage,
      location: req.body.location,
      amount: req.body.amount,
      date: req.body.date,
      addedBy: userId,
      userId: userId,
    });
    var userreceipt = await receipt.save();
    if (userreceipt) {
      return res.status(200).send({
        success: true,
        userreceipt: userreceipt,
        message: "Your Receipt Has Been Created",
      });
    } else {
      return res.status(400).send({
        success: false,
        message: "Your Receipt Couldn't Created",
      });
    }
  } catch (err) {
    console.log("err.isJoi: ", err);
    if (err.isJoi) {
      res.status(422).json({
        success: false,
        message: err.details[0].message,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  }
};

exports.createReceipt = async (req, res, next) => {
  try {
    const result = await receiptSchema.validateAsync(req.body);
    console.log(req.body);
    const userId = req?.auth?.data?.userId;
    console.log("userId ", userId);
    const user = await User.findOne({ where: { id: userId }, raw: true });
    console.log("user ", user);
    const receiptImage = req.files["receiptImage"]
      ? req.files["receiptImage"][0].filename
      : null;
    console.log("receiptImage", receiptImage);
    const S3imageURL = await s3Upload(receiptImage, receiptImage);
    console.log("S3imageURL", S3imageURL);

    // console.log("Receit model is :", Receipt);
    const receipt = await new Receipt({
      name: req.body.name,
      url: "/files/" + receiptImage,
      location: req.body.location || null,
      amount: req.body.amount || null,
      date: req.body.date || null,
      addedBy: userId,
      userId: userId,
    });
    var userreceipt = await receipt.save();
    if (userreceipt) {
      return res.status(200).send({
        success: true,
        userreceipt: userreceipt,
        message: "Your Receipt Has Been Created",
      });
    } else {
      return res.status(400).send({
        success: false,
        message: "Your Receipt Couldn't Created",
      });
    }
  } catch (err) {
    console.log("err.isJoi: ", err);
    if (err.isJoi) {
      res.status(422).json({
        success: false,
        message: err.details[0].message,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  }
};

exports.viewReceipt = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log(req.body);
    console.log(req.auth);
    const userId = req?.auth?.data?.userId;
    console.log("userId ", userId);
    const user = await User.findOne({ where: { id: userId }, raw: true });
    console.log("user ", user);
    const receipt = await Receipt.findOne({
      where: { id: id },
      raw: true,
      include: [User],
    });
    if (receipt) {
      return res.status(200).send({
        success: true,
        receipt: receipt,
        message: "Receipt Is Found",
      });
    } else {
      return res.status(400).send({
        success: false,
        message: "Receipt Isn't Found",
      });
    }
  } catch (err) {
    console.log("err.isJoi: ", err);
    if (err.isJoi) {
      res.status(422).json({
        success: false,
        message: err.details[0].message,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  }
};

exports.deleteReceipt = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log(req.body);
    console.log(req.auth);
    const userId = req?.auth?.data?.userId;
    console.log("userId ", userId);

    const receipt = await Receipt.findOne({
      where: { id: id },
      raw: true,
      include: [User],
    });
    if (!receipt.addedBy === userId) {
      return res.status(400).send({
        success: false,
        message: "You can't delete this receipt",
      });
    }
    // console.log("receipt ", receipt);

    // delete the image from s3:
    if (receipt.url && receipt.url.startsWith("/files/")) {
      const fileName = receipt.url.slice("/files/".length);
      await s3Delete(fileName);
    }

    if (receipt) {
      const receiptDeleted = await Receipt.destroy({
        where: {
          id: id,
        },
        raw: true,
      });
      console.log("receiptDeleted ", receiptDeleted);
      if (receiptDeleted > 0) {
        return res.status(200).send({
          success: true,
          message: "Receipt Deleted",
          receiptDeleted: receiptDeleted,
        });
      } else {
        return res.status(400).send({
          success: false,
          message: "Receipt Couldn't Not Deleted",
        });
      }
    } else {
      return res.status(400).send({
        success: false,
        message: "Receipt Isn't Found",
      });
    }
  } catch (err) {
    console.log("err.isJoi: ", err);
    if (err.isJoi) {
      res.status(422).json({
        success: false,
        message: err.details[0].message,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Internal Server Error",
      });
    }
  }
};

exports.getAllReceipts = async (req, res, next) => {
  try {
    const userId = req?.auth?.data?.userId;

    const receipts = await Receipt.findAll({
      raw: true,
      where: { addedBy: userId },
      include: [
        { model: User },
        {
          model: Raffle,
          attributes: ["name"],
          include: [
            {
              model: PricingPlan,
              attributes: ["name", "price"],
            },
          ],
        },
      ],
    });
    console.log("🧾 Receipts are...", receipts);
    if (receipts.length > 0) {
      return res.status(200).send({
        success: true,
        message: "receipts Of User Found",
        receipts: receipts,
      });
    } else {
      return res.status(404).send({
        success: false,
        message: "receipts Not Found",
      });
    }
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};
