const express = require("express");
const router = express.Router();
const NotificationsController = require("../app/controllers/NotificationsController");

router.post("/update/playerid", NotificationsController.updatePlayerId);

router.delete("/delete/playerid", NotificationsController.deletePlayerId);

router.post("/receipt/approval", NotificationsController.notifyReceiptApproval);

// router.post("/send/receipt-approval/:userId", async (req, res) => {
//   console.log("abc");
//   //   const { userId } = req.params;
//   //   await NotificationsController.sendReceiptApprovalNotification(userId);
//   //   res
//   //     .status(200)
//   //     .send({ success: true, message: "Receipt approval notification sent" });
// });

module.exports = router;
