const express = require("express");
const router = express.Router();
const PaypalController = require("../app/controllers/PaypalController");

//redirect apis
router.post("/redirect", PaypalController.redirect);

router.post("/create/payment", PaypalController.createPayment);
router.post("/execute/payment", PaypalController.paymentSuccess);

// paypal product APIs
router.post("/create/product", PaypalController.createProduct);
router.get("/list/products", PaypalController.listProducts);
router.get(
  "/show/productdetails/:productId",
  PaypalController.showProductDetails
);

//paypal plan APIs
router.get("/generate/accesstoken", PaypalController.getToken);

router.delete(
  "/terminate/accesstoken/:token",
  PaypalController.terminateTokenTest
);

router.post("/create/plan", PaypalController.createPlan);
router.get("/list/plans", PaypalController.listPlans);
router.get(
  "/show/plandetails/:billing_plan_id",
  PaypalController.showPlanDetails
);
router.patch("/update/plan/:billing_plan_id", PaypalController.updatePlan);
router.post(
  "/deactivate/plan/:billing_plan_id",
  PaypalController.deactivatePlan
);

//paypal subscription APIs
router.post("/create/subscription", PaypalController.createSubscription);
router.get(
  "/show/subscription/:subscription_id",
  PaypalController.showSubscriptionDetails
);

router.post(
  "/cancel/subscription/:subscription_id",
  PaypalController.cancelSubscription
);
module.exports = router;
