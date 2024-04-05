const express = require("express");
const router = express.Router();
const AuthController = require("../app/controllers/AuthController");
const IosSubsController = require("../app/controllers/IosSubsController");

router.post("/login", AuthController.login);
router.post("/gmaillogin", AuthController.googleLogin);
router.post("/applelogin", AuthController.AppleLogin);
router.post("/userdata", AuthController.userData);
router.post("/appleuserdata", AuthController.appleuserdata);
router.post("/logout", AuthController.logout);
router.patch("/resendotp", AuthController.resendOtp);
router.post("/verify", AuthController.accountVerify);
router.post("/sign-up", AuthController.signUp);
router.post("/forgot-password", AuthController.forgotPassword);
router.patch("/updateuser", AuthController.updateUser);
router.post("/checkotp", AuthController.checkOtp);
router.post("/reset-password", AuthController.resetPassword);
router.get("/viewpackages", AuthController.viewPackages);
router.post("/createpaymentintent", AuthController.createPaymentIntent);
router.post("/paythroughcheckout", AuthController.payThroughCheckout);

router.post("/switchpackage", AuthController.switchPackage);
router.post("/revert-to-base", AuthController.revertToBase);
router.post("/downgrade-to-base", AuthController.downgradeToBase);

router.get("/tokenforclient", AuthController.getVenmoToken);
router.post("/paythroughvenmo", AuthController.payThroughVenmo);
router.post("/supportmessage", AuthController.sendSupportMessage);
router.patch("/updatepassword", AuthController.updatePassword);

router.patch(
  "/toggle-tutorial-completion/:id",
  AuthController.toggleTutorialCompletion
);

// switch membership (used in app, switch package is not used)
router.patch(
  "/toggle-tutorial-completion/:id",
  AuthController.toggleTutorialCompletion
);

// switch membership (used in app, switch package is not used)
router.post("/switchmembership", AuthController.switchMembership);

//paypal
router.post("/paypal", AuthController.paypalPayments);

router.post("/invite", AuthController.inviteUser);

// IOS subscriptions
// webhook
router.post("/ios-notification", IosSubsController.iosSubscriptions);
// other
router.post(
  "/add-subscription-record",
  IosSubsController.addInitialUserSubscription
);

// router.get("/getlinkstats",AuthController.getLinkStats)

module.exports = router;
