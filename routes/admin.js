const express = require("express");
const moment = require("moment");
const router = express.Router();
const AdminController = require("../app/controllers/AdminController");
const {
  receiptImageMiddleware,
  raffleImageMiddleware,
} = require("../app/middlewares/Multer");

const PaypalSubscriptions = require("../models/PaypalSubscriptions");
const PricingPlan = require("../models/PricingPlan");
const User = require("../models/User");

router.post("/login", AdminController.login);
router.post("/logout", AdminController.logout);
router.patch("/resendotp", AdminController.resendOtp);
router.post("/verify", AdminController.accountVerify);
router.post("/sign-up", AdminController.signUp);
router.post("/forgot-password", AdminController.forgotPassword);
router.patch("/updateuser", AdminController.updateAdmin);
router.post("/checkotp", AdminController.checkOtp);
router.post("/reset-password", AdminController.resetPassword);
//Users related admin apis started
router.get("/viewallusers", AdminController.viewallUsers);
router.get("/viewallusersof30days", AdminController.viewAllUsersOf30Days);
router.patch("/suspenduser/:id", AdminController.suspendUser);
router.delete("/softdeleteuser/:id", AdminController.softDeleteUser);
router.delete(
  "/deleteuserpermanently/:id",
  AdminController.deleteUserPermanently
);
router.patch(
  "/increment-tutorial-step/:id",
  AdminController.incrementTutorialStepCounter
);
//Users related admin apis ended

// Influencers related admin apis started
router.get("/view-all-influencers", AdminController.viewAllInfluencers);
router.patch(
  "/toggle-influencer-status/:id",
  AdminController.toggleInfluencerStatus
);
router.patch(
  "/assign-influencer-code/:id",
  AdminController.assignInfluencerCode
);
router.patch("/assign-user-code/:id", AdminController.assignUserCode);
router.get("/view-users-referred/:id", AdminController.viewUsersReferred);

// Influencers related admin apis ended

//Raffles related admin apis started
router.get("/viewallraffles", AdminController.viewallRaffles);
router.get("/viewallrafflesof30days", AdminController.viewAllRafflesOf30Days);
router.post(
  "/creareRaffle",
  raffleImageMiddleware,
  AdminController.createRaffle
);

router.patch(
  "/updateRaffle/:id",
  raffleImageMiddleware,
  AdminController.updateRaffle
);
router.delete("/deleteraffle/:id", AdminController.deleteRaffle);
router.get("/viewraffleentries/:id", AdminController.viewRaffleEntries);
router.patch("/rafflewinner", AdminController.raffleWinner);
//Raffles related admin apis ended
//Plans related admin apis started
router.post("/addplan", AdminController.addPlan);

//create plan paypal
router.post("/createplan", AdminController.createPlan);
//update plan paypal
router.patch("/updateplan/:billing_plan_id", AdminController.updatePlan);

router.get("/viewplans", AdminController.viewAllPlans);
router.patch("/editplan", AdminController.editPlan);

router.delete("/deleteplan/:planId", AdminController.deletePlan);

router.patch(
  "/activate-subscription/: subscription_id ",
  AdminController.activateSubscription
);
router.patch(
  "/suspend-subscription/: subscription_id ",
  AdminController.suspendSubscription
);

//Plans related admin apis ended
//Receipt related admin apis started
router.get("/viewallreceipts", AdminController.viewallReceipts);
router.patch("/rejectreceipt/:id", AdminController.rejectReceipt);
router.patch("/approvereceipt/:id", AdminController.approveReceipt);
router.post("/assigntickets/:userId", AdminController.assignTickets);
router.delete("/deletereceipt/:id", AdminController.deleteReceipt);

// router.post("/receipt/approval", AdminController.notifyReceiptApproval);

//Receipt related admin apis ended

//Send Emails to Users
router.post("/sendmail", AdminController.sendMail);

//admin api for assigning tickets manually

router.patch("/awardtickets", AdminController.addTickets);
router.patch("/record-payments", AdminController.recordPayment);

// *****for detecting the subscription status of the user's paypal plan*****
router.post("/paypal-webhooks", async (req, res) => {
  try {
    const event = req.body;
    console.log("===> ⚓ Paypal webhooks");
    console.log("---> Received event type:", event?.event_type);
    if (
      event?.event_type === "BILLING.SUBSCRIPTION.ACTIVATED" ||
      event?.event_type === "BILLING.SUBSCRIPTION.RE-ACTIVATED" ||
      event?.event_type === "BILLING.SUBSCRIPTION.UPDATED"
    ) {
      console.log("---> Billing subscription has been...", event?.event_type);
      const { resource } = event;
      const { id, plan_id } = resource;
      console.log(`---> User's subscription id: ${id} and plan id: ${plan_id}`);

      // Retrieve the subscription details like user id from the paypal_subscriptions table with
      const subscriptionDetails = await PaypalSubscriptions.findOne({
        where: {
          subscriptionId: id,
        },
      });

      console.log(
        "---> Subscriber:",
        subscriptionDetails.dataValues.subscriber
      );

      const subscriber = subscriptionDetails.dataValues.subscriber;

      // Retrieve the pricing plan details from the pricing_plans table
      const planDetails = await PricingPlan.findOne({
        where: {
          plan_id,
        },
      });

      console.log("---> User's current plan id:", planDetails.dataValues.id);

      const planId = planDetails.dataValues.id;

      let expiresDate;

      if (planId === 40) {
        expiresDate = moment().add(30, "days").toDate();
      } else if (planId === 41) {
        expiresDate = moment().add(365, "days").toDate();
      }

      // Update user's membershipType and expiration date
      await User.update(
        {
          membershipType: planId,
          expiresDate,
          isSubscriptionValid: 1,
          subscriptionId: id,
        },
        {
          where: {
            id: subscriber,
          },
        }
      );

      const updatedUser = await User.findOne({
        where: {
          id: subscriber,
        },
      });

      console.log(
        `---> User's plan is updated to: ${updatedUser.membershipType} and expiry date is: ${updatedUser.expiresDate}`
      );
    }

    if (
      event?.event_type === "BILLING.SUBSCRIPTION.EXPIRED" ||
      event?.event_type === "BILLING.SUBSCRIPTION.CANCELLED"
    ) {
      // Handle the event
      console.log("---> Received event:", event?.event_type);
      const { resource } = event;
      const { id, plan_id } = resource;

      console.log(`---> User's subscription id: ${id} and plan id: ${plan_id}`);

      // Retrieve the subscription details like user id from the paypal_subscriptions table with
      const subscriptionDetails = await PaypalSubscriptions.findOne({
        where: {
          subscriptionId: id,
        },
      });

      console.log(
        "---> Subscriber:",
        subscriptionDetails.dataValues.subscriber
      );

      const subscriber = subscriptionDetails.dataValues.subscriber;

      // Retrieve the pricing plan details from the pricing_plans table
      const planDetails = await PricingPlan.findOne({
        where: {
          id: plan_id,
        },
      });

      console.log("---> User's current plan details:", planDetails);

      // Update the user's membershipType to the default value of 1
      await User.update(
        { membershipType: 1, expiresDate: null, isSubscriptionValid: 0 },
        {
          where: {
            id: subscriber,
          },
        }
      );
    }

    return res.sendStatus(200);
  } catch (error) {
    console.log("Error:", error);
    return res.status(400).send("Something went wrong");
  }
});

// Admin Analytics APIS start
router.get("/users-acquired/:isWeekly", AdminController.viewUsersAcquired);
router.get(
  "/influencer-referrals/:isWeekly",
  AdminController.viewInfluencerReferrals
);
router.get("/income/:isWeekly", AdminController.viewIncome);

module.exports = router;
