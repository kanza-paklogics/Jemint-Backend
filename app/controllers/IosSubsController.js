const base64url = require("base64url");
const moment = require("moment");

const User = require("../../models/User");
const IosSubscriptions = require("../../models/IosSubscriptions");
// const UserAppleSubscriptions = require("../../models/UserAppleSubscriptions");

// User.hasMany(IosSubscriptions, { foreignKey: "userId" });
// IosSubscriptions.belongsTo(User, { foreignKey: "userId" });

// User.hasMany(UserAppleSubscriptions, { foreignKey: "userId" });
// UserAppleSubscriptions.belongsTo(User, { foreignKey: "userId" });

const decodeSignedData = (encodedStr) => {
  let splitedStr = encodedStr.split(".")[1];
  let decodedStr = JSON.parse(base64url.decode(splitedStr));

  console.log("decoded data is ", decodedStr);
  return decodedStr;
};

const addSubscriptionRecord = async (signedPayload, IosSubscriptions) => {
  const bodyData = decodeSignedData(signedPayload);

  //console.log("Whole object stored in table for metadata ", obj);

  // console.log("Req body is subscription ", bodyData);
  let notificationType = bodyData?.notificationType;
  console.log(
    "(addSubscriptionRecord) notificationType is... ",
    notificationType
  );
  let subtype = bodyData?.subtype;
  console.log("subtype is ", subtype);
  console.log("downgrade data is ", bodyData);

  if (subtype || notificationType) {
    let data = bodyData?.data;
    let decodedSignedTransactionInfo = data?.signedTransactionInfo;
    let decodedSignedRenewalInfo = data?.signedRenewalInfo;
    decodedSignedTransactionInfo = decodeSignedData(
      decodedSignedTransactionInfo
    );
    decodedSignedRenewalInfo = decodeSignedData(decodedSignedRenewalInfo);

    console.log("signed transaction data is ", decodedSignedTransactionInfo);
    console.log("signed Renewal data is ", decodedSignedRenewalInfo);
    data.signedTransactionInfo = decodedSignedTransactionInfo;
    data.signedRenewalInfo = decodedSignedRenewalInfo;

    let subscriptionObj = await IosSubscriptions.create({
      notificationType,
      subtype,
      transactionId: decodedSignedTransactionInfo?.transactionId,
      originalTransactionId:
        decodedSignedTransactionInfo?.originalTransactionId,
      purchaseDate: decodedSignedTransactionInfo?.purchaseDate,
      originalPurchaseDate: decodedSignedTransactionInfo?.originalPurchaseDate,
      expiresDate: decodedSignedTransactionInfo?.expiresDate,
      metadata: {
        notificationType,
        subtype,
        data,
      },
    });

    console.log("Subscription data is inserted ", subscriptionObj);
    return {
      notificationType,
      subtype,
      originalTransactionId:
        decodedSignedTransactionInfo?.originalTransactionId,
      purchaseDate: decodedSignedTransactionInfo?.purchaseDate,
      expiresDate: decodedSignedTransactionInfo?.expiresDate,
    };
  }

  return {};
};

const updateUserFunc = async (isSub, tId, expiresDate, message, User) => {
  console.log("===> updateUserFunc called ===>");
  if (!isSub) {
    console.log("---> membershipType update case...");
    let userUpdate = await User.update(
      {
        membershipType: 1,
        isSubscriptionValid: isSub,
        expiresDate,
        subscriptionMessage: message,
      },
      {
        where: {
          originalTransactionId: tId,
        },
      }
    );
    console.log(
      "Updated user on Apple server to server notifications is ",
      userUpdate
    );
  } else {
    console.log("---> membershipType NOT update case...");
    let userUpdate = await User.update(
      {
        isSubscriptionValid: isSub,
        expiresDate,
        subscriptionMessage: message,
      },
      {
        where: {
          originalTransactionId: tId,
        },
      }
    );
    console.log(
      "---> Updated user on Apple server to server notifications is ",
      userUpdate
    );
  }
};

exports.iosSubscriptions = async (req, res, next) => {
  try {
    console.log("===> ⚓Apple Webhook Called ===>");
    if (req.body.signedPayload) {
      let data = await addSubscriptionRecord(
        req.body.signedPayload,
        IosSubscriptions
      );

      console.log("---> notificationType is... ", data?.notificationType);
      console.log("function response is ", data);

      if (
        data?.notificationType === "SUBSCRIBED" &&
        data?.subtype === "RESUBSCRIBE"
      ) {
        await updateUserFunc(
          true,
          data.originalTransactionId,
          data.expiresDate,
          "You have resubscribed to the subscription",
          User
        );
      } else if (
        data?.notificationType === "DID_RENEW" &&
        (data?.subtype === "" ||
          data?.subtype === "BILLING_RECOVERY" ||
          data?.subtype === undefined)
      ) {
        console.log("in undefined renewel");
        /*DID_RENEW 
        A notification type that, along with its subtype, indicates that the subscription successfully renewed. 
        If the subtype is BILLING_RECOVERY, the expired subscription that previously failed to renew has successfully
        renewed. If the substate is empty, the active subscription has successfully auto-renewed for a new transaction
        period. Provide the customer with access to the subscriptions content or service.
      */
        await updateUserFunc(
          true,
          data.originalTransactionId,
          data.expiresDate,
          "Your subscription has been renewed",
          User
        );
        console.log("renewed");
      } else if (data?.notificationType === "EXPIRED") {
        /*EXPIRED
        A notification type that, along with its subtype, indicates that a subscription expired.
        If the subtype is VOLUNTARY, the subscription expired after the user disabled subscription renewal.
        If the subtype is BILLING_RETRY, the subscription expired because the billing retry period ended
        without a successful billing transaction. If the subtype is PRICE_INCREASE, the subscription expired
        because the user didn’t consent to a price increase that requires user consent. If the subtype is
        PRODUCT_NOT_FOR_SALE, the subscription expired because the product wasn’t available for purchase at the
        time the subscription attempted to renew.
        A notification without a subtype indicates that the subscription expired for some other reason.
        */
        await updateUserFunc(
          false,
          data.originalTransactionId,
          data.expiresDate,
          "Your subscription is expired.",
          User
        );
        console.log("User subscription is expired");
      } else if (data?.notificationType === "DID_CHANGE_RENEWAL_STATUS") {
        /*
        DID_CHANGE_RENEWAL_STATUS
        A notification type that, along with its subtype, indicates that the user made a change to the subscription
        renewal status. If the subtype is AUTO_RENEW_ENABLED, the user reenabled subscription auto-renewal. If the
        subtype is AUTO_RENEW_DISABLED, the user disabled subscription auto-renewal, or the App Store disabled
        subscription auto-renewal after the user requested a refund.
        */
        console.log("autorenew changed");
      } else if (data?.notificationType === "DID_CHANGE_RENEWAL_PREF") {
        /*
        A notification type that, along with its subtype, indicates that the user made a change to their
        subscription plan. If the subtype is UPGRADE, the user upgraded their subscription, or cross-graded
        to a subscription with the same duration. The upgrade goes into effect immediately, starting a 
        new billing period, and the user receives a prorated refund for the unused portion of the previous period.
        If the subtype is DOWNGRADE, the user downgraded their subscription or cross-graded to a subscription with
        a different duration. Downgrades take effect at the next renewal date and don’t affect the currently active plan.
        If the subtype is empty, the user changed their renewal preference back to the current subscription,
        effectively canceling a downgrade.
        */
        console.log("user changed its subscription upgrade or downgrade");
      } else if (data?.notificationType === "GRACE_PERIOD_EXPIRED") {
        /*
        A notification type that indicates that the billing grace period has ended without renewing the
        subscription, so you can turn off access to the service or content. Inform the user that there may 
        be an issue with their billing information. The App Store continues to retry billing for 60 days, 
        or until the user resolves their billing issue or cancels their subscription, whichever comes first.
        */
        await updateUserFunc(
          false,
          data.originalTransactionId,
          data.expiresDate,
          "Your subscription is in grace period, that's why you can't create any deal",
          User
        );
      } else {
        console.log("no type matched");
      }
    }

    return res.status(200).send({
      success: true,
      message: "Ios notification received 11",
      //   decodedSignedTransactionInfo,
      //   decodedSignedRenewalInfo,
    });
  } catch (error) {
    console.log("Error in ios notification ", error);
    return res.status(500).send({
      success: false,
      message: "Something went wrong!",
      error,
    });
  }
};

// Call this api from app the first time a user buys
// error if transaction id already exists, first check
// check user id
exports.addInitialUserSubscription = async (req, res, next) => {
  try {
    console.log(
      "in add initial subscription request ",
      req.body,
      req?.auth?.data?.userId
    );

    const userId = req?.auth?.data?.userId;

    const {
      subscribedPlanId,
      originalTransactionId,
      platformSubscriptionName,
    } = req.body;

    // transaction id an user id check
    let user = await User.findOne({
      where: {
        id: userId,
      },
    });

    console.log(
      "user id and transaction id is...",
      user.id,
      user.originalTransactionId
    );

    let expiresDate;

    if (subscribedPlanId === 40) {
      expiresDate = moment().add(30, "days").toDate();
    } else if (subscribedPlanId === 41) {
      expiresDate = moment().add(365, "days").toDate();
    }

    let userUpdate = await User.update(
      {
        membershipType: subscribedPlanId,
        expiresDate,
        originalTransactionId: originalTransactionId,
        platformSubscriptionName: platformSubscriptionName,
        isSubscriptionValid: true,
      },
      {
        where: {
          id: userId,
        },
      }
    );

    console.log("Updated user is ", userUpdate);

    if (userUpdate) {
      return res.status(200).send({
        success: true,
        message: "New subscription record added",
        userUpdate,
      });
    } else {
      return res.status(200).send({
        success: false,
        message: "No subscription record added",
      });
    }
  } catch (error) {
    console.log("in initial buy subscription error ", error);
    return res.status(500).send({
      success: false,
      message: "Something went wrong!",
      error,
    });
  }
};

// --------------------------------------------------------------------------- //

async function checkSubscriptionStatus(userId) {
  try {
    // Retrieve user and subscription information from the database
    const user = await UserModel.findById(userId);
    const subscription = await SubscriptionModel.findByUserId(userId);

    // Use the Apple API to check the latest subscription status
    const appleSubscriptionStatus = await checkAppleSubscriptionStatus(
      user.appleSubscriptionId
    );

    // Update the database based on the latest information
    if (appleSubscriptionStatus === "active") {
      // Update subscription status in the database
      await SubscriptionModel.updateStatus(subscription.id, "active");
    } else {
      // Update subscription status in the database
      await SubscriptionModel.updateStatus(subscription.id, "expired");
    }
  } catch (error) {
    console.error("Error checking subscription status:", error);
  }
}

// Replace this function with the actual implementation of checking Apple's server
async function checkAppleSubscriptionStatus(appleSubscriptionId) {
  // Call Apple's API to check subscription status
  // Return 'active' or 'expired' based on the response
  // ...
}

const checkAndRefreshSubscriptionStatus = async (userId) => {
  try {
    // Retrieve user information from the database
    const user = await User.findOne({
      where: {
        id: userId,
      },
    });

    if (user) {
      // Call the function to check Apple's server for the latest subscription status
      const isSubscriptionValid = await checkAppleSubscriptionStatus(
        user.originalTransactionId
      );

      // Update the user's subscription status in the database
      await User.update(
        {
          isSubscriptionValid: isSubscriptionValid,
        },
        {
          where: {
            id: userId,
          },
        }
      );

      console.log(
        `Subscription status updated for user ${userId}: ${isSubscriptionValid}`
      );
    }
  } catch (error) {
    console.error("Error checking and updating subscription status:", error);
  }
};

// Call this function periodically (e.g., using a scheduler like cron)
// Specify the user IDs for which you want to check the subscription status

// Example usage:
const userIdToCheck = "123";
checkAndRefreshSubscriptionStatus(userIdToCheck);
