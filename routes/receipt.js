const express = require("express");
const router = express.Router();
const ReceiptController = require("../app/controllers/ReceiptController");
var { receiptImageMiddleware } = require("../app/middlewares/Multer");
//Receipts APIs Started
//Route for creating receipt
router.post(
  "/createreceipt",
  receiptImageMiddleware,
  ReceiptController.createReceipt
);
router.post(
  "/createreceiptv2",
  receiptImageMiddleware,
  ReceiptController.createReceiptV2
);
//Route for viewing receipt
router.get("/viewreceipt/:id", ReceiptController.viewReceipt);
//Route for getting points
//router.get('/getpoints/:id', ReceiptController.getPoints);
//Route for deleting receipt
router.delete("/deletereceipt/:id", ReceiptController.deleteReceipt);
//Route for my receipt
router.get("/myreceipts", ReceiptController.getAllReceipts);
module.exports = router;
