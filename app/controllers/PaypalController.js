//subscription flow

var paypal = require("paypal-rest-sdk");
// paypal.configure({
//   mode: "sandbox", //sandbox or live
//   client_id:
//     "AfJ9jXUjTZXv8ZpW--7sYjnQ2ADJ4QBt22VpaZznV7YX5pXop3Vt_EvKqYjGjHgptHFInJkwItg6z1VB",
//   client_secret:
//     "ENiP0NbsIwU3gYvcSgxg4U-hGLgC5ydSlUqwA3jQTpY1ttKgRyz5AXMbRg37DlCopfuuaxcFaJTDd46H",
// });
var CircularJSON = require("circular-json");
var baseUrl = process.env.PAYPAL_BASE_URL;
const axios = require("axios");
const moment = require("moment");
var token = "";
var util = require("util");
const Flatted = require("flatted");
const {
  ExecutionStepContextInstance,
} = require("twilio/lib/rest/studio/v1/flow/execution/executionStep/executionStepContext");

const PaypalSubscriptions = require("../../models/PaypalSubscriptions");
const User = require("../../models/User");
const PricingPlan = require("../../models/PricingPlan");

User.hasOne(PaypalSubscriptions, { foreignKey: "subscriber" });
PaypalSubscriptions.belongsTo(User, { foreignKey: "subscriber" });

PricingPlan.hasOne(PaypalSubscriptions);
PaypalSubscriptions.belongsTo(PricingPlan);

exports.redirect = (req, res) => {
  try {
    res.status(200).send({ message: "Redirect Successful" });
  } catch (err) {
    console.log("err is ", err);
  }
};

exports.createPayment = async (req, res) => {
  try {
    const create_payment_json = req.body;
    console.log("create payment json is ", create_payment_json);
    paypal.payment.create(create_payment_json, function (error, payment) {
      if (error) {
        console.log("error at 102", error);
        res.status(401).send(error);
      } else {
        for (let i = 0; i < payment.links.length; i++) {
          if (payment.links[i].rel === "approval_url") {
            res.status(200).send({ paymentLinks: payment.links });
          }
        }
      }
    });
  } catch (err) {}
};

exports.paymentSuccess = async (req, res) => {
  try {
    const { paymentId } = req.body;
    const { execute_payment_json } = req.body;

    paypal.payment.execute(
      paymentId,
      execute_payment_json,
      function (error, payment) {
        if (error) {
          console.log(error.response);
          res.status(401).send({ success: false, error });
        } else {
          res.send("success");
        }
      }
    );
  } catch (err) {
    console.log(err);
  }
};

exports.getToken = async (req, res) => {
  try {
    const username = process.env.PAYPAL_CLIENT_ID;
    const password = process.env.PAYPAL_CLIENT_SECRET;
    let response = await axios({
      method: "post",
      url: `${baseUrl}/v1/oauth2/token`,
      data: "grant_type=client_credentials", // => this is mandatory x-www-form-urlencoded. DO NOT USE json format for this
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded", // => needed to handle data parameter
        "Accept-Language": "en_US",
      },
      auth: {
        username,
        password,
      },
    });
    response = JSON.stringify(response.data.access_token);
    response = JSON.parse(response);
    console.log("token is", response);
    res.status(200).send({
      success: true,
      token: response,
    });
  } catch (err) {
    console.log(err);
  }
};

exports.terminateTokenTest = async (req, res) => {
  try {
    // const username = process.env.PAYPAL_CLIENT_ID;
    // const password = process.env.PAYPAL_CLIENT_SECRET;
    const { token } = req.params;
    console.log("token is ", token);
    let response = await axios.post(
      `${baseUrl}/v1/oauth2/token/terminate`,
      {
        token,
        token_type_hint: "ACCESS_TOKEN",
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    console.log("response is ");

    response = JSON.stringify(response);
    response = JSON.parse(response);
    console.log("response is ", response);
    res.status(200).send({
      success: true,
      token: response,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send({
      success: false,
      message: "error",
      err,
    });
  }
};

const terminateAccessToken = async (token) => {
  try {
    console.log("token is ", token);
    let response = await axios.post(
      `${baseUrl}/v1/oauth2/token/terminate`,
      {
        token,
        token_type_hint: "ACCESS_TOKEN",
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    // console.log("token termination console", response);
    if (response.status === 200) {
      console.log("token terminated successfully");
    }
  } catch (err) {
    console.log(err);
  }
};

exports.createProduct = async (req, res) => {
  try {
    var timestamp = Date.now();
    console.log(timestamp);
    let token = await generateAccessToken();
    token = token.replace(/['"]+/g, "");
    console.log("generated token is ", token);

    const { name, type, description, category } = req.body;
    let product = await axios.post(
      `${baseUrl}/v1/catalogs/products`,
      {
        name,
        type,
        id: `${timestamp}`,
        description,
        category,
        image_url: `https://example.com/gallary/images/${timestamp}.jpg`,
        home_url: `https://example.com/catalog/${timestamp}.jpg`,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    terminateAccessToken(token);
    product = JSON.stringify(product.data);
    product = JSON.parse(product);
    if (product) {
      res.status(200).send({
        success: true,
        message: "Product Created Successfully",
        product,
      });
    } else {
      res
        .status(401)
        .send({ success: false, message: "Error Creating Product" });
    }
  } catch (err) {
    console.log(err);
    terminateAccessToken(token);
    res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};

exports.listProducts = async (req, res) => {
  try {
    let token = await generateAccessToken();
    console.log("generated token is ", token);
    token = token.replace(/['"]+/g, "");

    let products = await axios.get(
      `${baseUrl}/v1/catalogs/products?page_size=10&page=1&total_required=true`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    terminateAccessToken(token);

    let structProducts = JSON.stringify(products.data.products);
    let total_items = products.data.total_items;
    let total_pages = products.data.total_pages;
    let links = products.data.links;

    structProducts = JSON.parse(structProducts);
    if (products) {
      res.status(200).send({
        success: true,
        products: structProducts,
        total_items,
        total_pages,
        links,
      });
    } else {
      res.status(404).send({ success: false, message: "Products not found" });
    }
  } catch (err) {
    console.log(err);
    terminateAccessToken(token);
    res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};

exports.showProductDetails = async (req, res) => {
  try {
    let token = await generateAccessToken();
    token = token.replace(/['"]+/g, "");

    const { productId } = req.params;
    let product = await axios.get(
      `${baseUrl}/v1/catalogs/products/${productId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    terminateAccessToken(token);
    let productStatus = JSON.stringify(product.status);
    let productData = JSON.stringify(product.data);
    console.log({ productStatus });
    productData = JSON.parse(productData);
    if (productStatus === "200") {
      res.status(200).send({ success: true, product: productData });
    } else {
      res.status(404).send({ success: false, message: "Product not found" });
    }
  } catch (err) {
    console.log(err);
    terminateAccessToken(token);
    res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};

//***********PAYPAL PLAN APIS ***************/
// not being used, the same api in admin controller is actually being used
exports.createPlan = async (req, res) => {
  try {
    let token = await generateAccessToken();
    token = token.replace(/['"]+/g, "");
    console.log({ token });
    const { name, description, interval_unit, price, tickets } = req.body;

    let plan = await axios.post(
      `${baseUrl}/v1/billing/plans`,
      {
        product_id: "1669361823",
        name: name,
        description: description,
        status: "ACTIVE",
        billing_cycles: [
          {
            frequency: {
              interval_unit: interval_unit,
              interval_count: 1,
            },
            tenure_type: "TRIAL",
            sequence: 1,
            total_cycles: 1,
            pricing_scheme: {
              fixed_price: {
                value: "1",
                currency_code: "USD",
              },
            },
          },
          {
            frequency: {
              interval_unit: "MONTH",
              interval_count: 1,
            },
            tenure_type: "REGULAR",
            sequence: 2,
            total_cycles: 12,
            pricing_scheme: {
              fixed_price: {
                value: price,
                currency_code: "USD",
              },
            },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee: {
            value: "10",
            currency_code: "USD",
          },
          setup_fee_failure_action: "CONTINUE",
          payment_failure_threshold: 3,
        },
        taxes: {
          percentage: "10",
          inclusive: false,
        },
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    // terminateAccessToken(token);
    planStatus = plan.status;
    plan = JSON.stringify(plan.data);
    plan = JSON.parse(plan);
    if (planStatus === 201) {
      res.status(200).send({
        success: true,
        message: "Plan Created Successfully",
        plan,
      });
    } else {
      res
        .status(401)
        .send({ success: false, message: "Error Creating Product" });
    }
  } catch (err) {
    console.log(err);
    terminateAccessToken(token);
    res
      .status(500)
      .send({ success: false, message: "Internal Server Error ", err });
  }
};

exports.listPlans = async (req, res) => {
  try {
    let token = await generateAccessToken();
    token = token.replace(/['"]+/g, "");
    let plans = await axios.get(
      `${baseUrl}/v1/billing/plans?page_size=10&page=1&total_required=true`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    terminateAccessToken(token);
    let structPlans = JSON.stringify(plans.data.plans);
    let total_items = plans.data.total_items;
    let total_pages = plans.data.total_pages;
    let links = plans.data.links;

    structPlans = JSON.parse(structPlans);
    if (plans) {
      console.log("---> In listPlans if plans found...");
      console.log("Plans are as follows", structPlans);
      res.status(200).send({
        success: true,
        plans: structPlans,
        total_items,
        total_pages,
        links,
      });
    } else {
      res.status(404).send({ success: false, message: "Plans not found" });
    }
  } catch (err) {
    console.log(err);
    terminateAccessToken(token);
    res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};

exports.showPlanDetails = async (req, res) => {
  try {
    let token = await generateAccessToken();
    token = token.replace(/['"]+/g, "");

    const { billing_plan_id } = req.params;
    let plan = await axios.get(
      `${baseUrl}/v1/billing/plans/${billing_plan_id}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    terminateAccessToken(token);
    let planStatus = plan.status;
    let planData = JSON.stringify(plan.data);
    console.log({ planStatus });
    planData = JSON.parse(planData);
    if (planStatus === 200) {
      res.status(200).send({ success: true, plan: planData });
    } else {
      res.status(404).send({ success: false, message: "Plan not found" });
    }
  } catch (err) {
    console.log(err);
    terminateAccessToken(token);
    res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    let token = await generateAccessToken();
    token = token.replace(/['"]+/g, "");
    const { billing_plan_id } = req.params;
    const { name, description, price, tickets } = req.body;

    let updatedPlan = await axios.patch(
      `${baseUrl}/v1/billing/plans/${billing_plan_id}`,
      [
        { op: "replace", path: "/name", value: name },
        { op: "replace", path: "/description", value: description },
        {
          op: "replace",
          path: "/payment_preferences/setup_fee",
          value: {
            currency_code: "USD",
            value: price,
          },
        },
      ],
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    console.log("updated plan status is ", updatedPlan.status);
    terminateAccessToken(token);
    if (updatedPlan.status === 204) {
      res
        .status(200)
        .send({ success: true, message: "Plan Updated Successfully" });
    } else {
      res.status(401).send({ success: false, message: "Error Updating Plan" });
    }
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};

exports.deactivatePlan = async (req, res) => {
  try {
    let token = await generateAccessToken();
    token = token.replace(/['"]+/g, "");
    console.log({ token });
    const { billing_plan_id } = req.params;
    let deactivatePlan = await axios.post(
      `${baseUrl}/v1/billing/plans/${billing_plan_id}/deactivate`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    terminateAccessToken(token);
    let status = deactivatePlan.status;
    console.log({ status });
    deactivatePlan = JSON.stringify(deactivatePlan.data);
    deactivatePlan = JSON.parse(deactivatePlan);

    console.log("deactivate plan, ");
    console.log(deactivatePlan);
    if (status === 200) {
      res.status(200).send({
        success: true,
        message: "Subscription Suspended",
        deactivatePlan,
      });
    } else {
      res.status(401).send({
        success: false,
        message: "Error Suspending Subscription",
        deactivatePlan,
      });
    }
  } catch (err) {
    console.log("suspend subscription error", err);
    terminateAccessToken(token);
    res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};

// Main paypal suscription api in use in the android appisSubscriptionValid field
//******************subscriptions
exports.createSubscription = async (req, res) => {
  try {
    console.log("---> createSubscription API Hitting");
    console.log(req.auth);
    const userId = req?.auth?.data?.userId;
    const { plan_id, start_time, subscriber } = req.body;

    let user = await User.findOne({
      where: { id: userId },
    });

    console.log("-> user is:");
    console.log(user);
    if (!user) {
      return res
        .status(404)
        .send({ success: false, message: "User Not Found" });
    }
    let plan = await PricingPlan.findOne({
      where: { plan_id },
    });
    if (!plan) {
      return res
        .status(404)
        .send({ success: false, message: "Plan not found" });
    }
    console.log("-> plan paypal id is...", plan_id);
    console.log("-> plan local id...", plan.id);

    let token = await generateAccessToken();
    console.log("-> token is: ", token);
    token = token.replace(/['"]+/g, "");

    console.log("-> before post request api call...", baseUrl);

    let subscription = await axios.post(
      `${baseUrl}/v1/billing/subscriptions`,
      {
        plan_id: plan_id,
        start_time: start_time,
        subscriber,
        application_context: {
          brand_name: "Gem Mint Club Rewards",
          locale: "en-US",
          shipping_preference: "SET_PROVIDED_ADDRESS",
          user_action: "SUBSCRIBE_NOW",
          payment_method: {
            payer_selected: "PAYPAL",
            payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED",
          },
          return_url: "https://example.com/returnUrl",
          cancel_url: "https://example.com/cancelUrl",
        },
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    terminateAccessToken(token);
    let subscriptionStatus = subscription.status;
    console.log("subscription status is ", subscriptionStatus);
    subscription = JSON.stringify(subscription.data);
    subscription = JSON.parse(subscription);
    console.log("subscription", subscription);

    if (subscriptionStatus === 201) {
      let subscriptionData = await PaypalSubscriptions.create({
        subscriptionId: subscription.id,
        subscriber: user.id,
        pricingPlanId: plan.id,
      });
      if (subscriptionData) {
        return res.status(200).send({
          success: true,
          message: "Subscription Created",
          subscription,
        });
      } else {
        return res.status(401).send({
          success: false,
          message: "Error creating subscription",
          subscriptionData,
        });
      }
    } else {
      res.status(401).send({
        success: false,
        message: "Error Creating Subscription",
        error: subscription,
      });
    }
  } catch (err) {
    console.log("try catch error ", err);
    res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};

exports.showSubscriptionDetails = async (req, res) => {
  try {
    let token = await generateAccessToken();
    token = token.replace(/['"]+/g, "");

    const { subscription_id } = req.params;
    let subscription = await axios.get(
      `${baseUrl}/v1/billing/subscriptions/${subscription_id}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    let subscriptionStatus = subscription.status;
    console.log("subscription status is ", subscriptionStatus);
    subscription = JSON.stringify(subscription.data);
    subscription = JSON.parse(subscription);
    console.log("subscription is ", subscription);
    if (subscriptionStatus === 200) {
      terminateAccessToken(token);
      return res.status(200).send({ success: true, subscription });
    } else {
      terminateAccessToken(token);
      return res
        .status(404)
        .send({ success: false, message: "Subscription not found" });
    }
  } catch (err) {
    console.log(err);
    terminateAccessToken(token);
    res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};

exports.cancelSubscription = async (req, res) => {
  try {
    let token = await generateAccessToken();
    token = token.replace(/['"]+/g, "");
    const { subscription_id } = req.params;
    const { reason } = req.body;
    let cancelSubscription = await axios.post(
      `${baseUrl}/v1/billing/subscriptions/${subscription_id}/cancel`,
      { reason },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    terminateAccessToken(token);
    let status = cancelSubscription.status;
    console.log("status is ", status);

    if (status === 204) {
      res.status(200).send({
        success: true,
        message: "Subscription Cancelled Successfully",
      });
    } else {
      res.status(401).send({
        success: false,
        message: "Error Cancelling Subscription",
      });
    }
  } catch (err) {
    console.log("Cancel subscription error", err);
    terminateAccessToken(token);
    res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};

const generateAccessToken = async () => {
  try {
    console.log("generateAccessToken Here----------->");
    const username = process.env.PAYPAL_CLIENT_ID;
    const password = process.env.PAYPAL_CLIENT_SECRET;
    console.log("post url is...", `${baseUrl}/v1/oauth2/token`);
    const response = await axios({
      method: "post",
      url: `${baseUrl}/v1/oauth2/token`,
      data: "grant_type=client_credentials", // => this is mandatory x-www-form-urlencoded. DO NOT USE json format for this
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded", // => needed to handle data parameter
        "Accept-Language": "en_US",
      },
      auth: {
        username,
        password,
      },
    });

    return JSON.stringify(response.data.access_token);
  } catch (err) {
    console.log(err);
  }
};
