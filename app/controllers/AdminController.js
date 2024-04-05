const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const path = require("path");
var jwt = require("jsonwebtoken");
const validator = require("validator");
// models
const Raffle = require("../../models/Raffle");
const PricingPlan = require("../../models/PricingPlan");
const Admin = require("../../models/Admin");
const Receipt = require("../../models/Receipt");
const UserReferral = require("../../models/UserReferral");
const User = require("../../models/User");
const RaffleBuyer = require("../../models/RaffleBuyers");
const Player = require("../../models/Player");
// helpers
const sendMail = require("../../helpers/nodeMailer");
const getUniquePromoCode = require("../../helpers/generateReferralCode");
const { raffleSchema } = require("../../helpers/validationSchemas");
const s3Upload = require("../../helpers/s3Upload");
const s3Delete = require("../../helpers/s3Delete");
const calculateWeeklyOrMonthlyCounts = require("../../helpers/calculateWeeklyOrMonthlyCounts");
const calculateWeeklyOrMonthlyIncome = require("../../helpers/calculateWeeklyOrMonthlyIncome");

const otpGenerator = require("otp-generator");
var accountSid = process.env.TWILIO_ACCOUNT_SID;
var authToken = process.env.TWILIO_AUTH_TOKEN;
console.log("AccountSid: " + accountSid + "\nAuthToken: " + authToken);
const client = require("twilio")(accountSid, authToken);
console.log("Client is :======", client);
const axios = require("axios");
var baseUrl = process.env.PAYPAL_BASE_URL;
const moment = require("moment-timezone");
const { Op } = require("sequelize");

const OneSignal = require("onesignal-node");
const oneSignalClient = new OneSignal.Client(
  process.env.ONESIGNAL_APP_ID,
  process.env.ONESIGNAL_REST_API_KEY
);

User.hasMany(Raffle, { foreignKey: "winnerId" });
Raffle.belongsTo(User, { foreignKey: "winnerId" });

PricingPlan.hasMany(Raffle, { foreignKey: "raffleType" });
Raffle.belongsTo(PricingPlan, { foreignKey: "raffleType" });

PricingPlan.hasMany(User, { foreignKey: "membershipType" });
User.belongsTo(PricingPlan, { foreignKey: "membershipType" });

const cron = require("node-cron");
const { date } = require("@hapi/joi");
const { response } = require("express");

// Schedule tasks to be run on the server.
cron.schedule("0 0 */1 * * *", async function () {
  try {
    console.log("running a task every hour");
    const raffles = await Raffle.findAll({
      raw: true,
      include: [{ model: User }],
    });
    // console.log("raffles ", raffles);
    for (let i = 0; i < raffles.length; i++) {
      // console.log(raffles[i]);
      var enddate = raffles[i].endDate.split("-");
      console.log("enddate ", enddate);
      enddate = enddate[2] + "-" + enddate[1] + "-" + enddate[0];
      enddate = new Date(enddate);

      enddate = moment(enddate).add(28, "hours").toDate();
      var today = new Date();
      console.log("enddate , today ", enddate, today);
      if (today > enddate) {
        console.log("enddate passed");
        const updatedRaffle = await Raffle.update(
          {
            status: "Closed",
          },
          {
            where: { id: raffles[i].id },
          }
        );
      } else {
        console.log("enddate not passed");
      }
    }

    // New code for updating receipt statuses to "Expired"
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const updatedReceipts = await Receipt.update(
      { status: "Expired" },
      {
        where: {
          createdAt: {
            [Op.lte]: thirtyDaysAgo,
          },
          status: "In-Progress",
        },
      }
    );

    console.log(`${updatedReceipts} receipts marked as "Expired"`);
  } catch (err) {
    console.error("Error in cron job:", err);
  }
});

cron.schedule("0 */6 * * *", async function () {
  try {
    console.log("===> Raffle activator");
    const currentDate = new Date();
    const raffles = await Raffle.findAll({
      raw: true,
      where: {
        status: "Scheduled",
      },
    });

    let devices = await Player.findAll({});

    for (let i = 0; i < raffles.length; i++) {
      const startDate = new Date(raffles[i].startDate);

      if (currentDate.toISOString() >= startDate.toISOString()) {
        // Update status to "Active"
        const updatedRaffle = await Raffle.update(
          {
            status: "Active",
          },
          {
            where: { id: raffles[i].id },
          }
        );
        console.log(`${updatedRaffle} raffles marked as "Active"`);
        await createNotification(
          "A New Raffle has been created",
          "1234",
          "push",
          devices
        );
      }
    }
  } catch (err) {
    console.error("Error in cron job:", err);
  }
});

const generateAccessToken = async () => {
  try {
    const username = process.env.PAYPAL_CLIENT_ID;
    const password = process.env.PAYPAL_CLIENT_SECRET;
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
    console.log("token terminated successfully");
  } catch (err) {
    console.log(err);
  }
};

//create notiicaiton function
// exports.createNotification = async function (message, id, type, playerId) {
async function createNotification(message, id, type, playerId) {
  console.log("=============> Inside Create Notification");
  var Ids = [];
  playerId.map((data) => {
    return Ids.push(data.playerId);
  });
  console.log("firing create notification method");
  console.log("player id ", Ids);
  if (playerId.length < 1) {
    return null;
  }
  const notification = {
    headers: {
      "Content-Type": "application/json",
    },
    contents: {
      en: message,
    },
    data: {
      id: id,
      type: type,
    },
    include_player_ids: Ids,
  };

  console.log(
    "===> Final Notification in Create Notification...",
    notification
  );

  const response = await oneSignalClient.createNotification(notification);
  console.log(
    "****************************response******************************************* "
  );
  console.log(response);
  return response;
}
async function createNotification2(message, id, type, playerIds) {
  console.log("=============> Inside Create Notification 2");
  console.log("firing create notification method");
  console.log("player id ", playerIds);
  if (playerIds.length < 1) {
    return null;
  }
  const notification = {
    headers: {
      "Content-Type": "application/json",
    },
    contents: {
      en: message,
    },
    data: {
      id: id,
      type: type,
    },
    include_player_ids: playerIds,
  };

  console.log(
    "===> Final Notification in Create Notification...",
    notification
  );

  const response = await oneSignalClient.createNotification(notification);
  console.log(
    "****************************response******************************************* "
  );
  console.log(response);
  return response;
}

async function sendNotification(playerId, message) {
  console.log("----------> Inside sendNotification");
  const notification = {
    headers: {
      "Content-Type": "application/json",
    },
    contents: {
      en: message,
    },
    data: {
      id: "11",
      type: "push",
    },
    include_player_ids: [playerId],
  };
  console.log("Notification", notification);

  const playerArray = [{ playerId: playerId }];

  return await createNotification(
    "The receipt has been approved",
    "1234",
    "push",
    playerArray
  );
}

// create notification on receipt approval
async function notifyReceiptApproval(req, res) {
  console.log(
    "-----------------------------------------------------------------------------"
  );
  console.log(
    "-                    Inside Notify Receipt Approval                         -"
  );
  console.log(
    "-----------------------------------------------------------------------------"
  );

  try {
    const receiptId = req?.body?.receiptId;
    const receipt = await Receipt.findOne({ id: receiptId });
    console.log("Inside notifyReceiptApproval Try");

    if (receipt && receipt.status === "Approved") {
      console.log("Inside notifyReceiptApproval Try If");
      const addedByPlayer = await Player.findOne({
        userId: receipt.addedBy,
      });

      if (addedByPlayer) {
        console.log(
          "------------> Notification sending, added by player(receiver)",
          addedByPlayer
        );
        await sendNotification(
          addedByPlayer.playerId,
          "The receipt has been approved!"
        );
        // not reaching here
        if (res) {
          // check if res is defined
          console.log("=> Notification sent on receipt approval", res);
          res
            .status(200)
            .send({ success: true, message: "Notification sent successfully" });
        }
      } else {
        res.status(400).send({ success: false, message: "Player not found" });
      }
    } else {
      res
        .status(400)
        .send({ success: false, message: "Receipt not found or not approved" });
    }
  } catch (err) {
    console.log("Error sending notification", err);
    if (res) {
      res
        .status(500)
        .send({ success: false, message: "Internal Server Error" });
    }
  }
}

exports.login = (req, res, next) => {
  try {
    console.log("req.body ", req.body);
    const validationErrors = [];
    console.log("length", req.body.phoneNo.toString().length);
    var length = req.body.phoneNo.toString().length;
    if (length >= 6 && length <= 12) {
    } else {
      return res.status(400).json({
        success: false,
        message: "Number digits should be 6-12",
      });
    }
    if (validator.isEmpty(req.body.password))
      validationErrors.push("Password cannot be blank.");
    if (validationErrors.length) {
      return res.status(400).send({
        success: false,
        message: "Phone number and Password is required.",
      });
    }
    Admin.findOne({
      where: {
        phoneNo: req.body.phoneNo,
        countryCode: req.body.countryCode,
      },
    })
      .then((admin) => {
        if (admin) {
          bcrypt
            .compare(req.body.password, admin.password)
            .then(async (doMatch) => {
              if (doMatch) {
                // req.session.isLoggedIn = true;
                // req.session.admin = .dataValues;
                // return req.session.save(err => {
                // 	console.log(err);
                // 	res.redirect('/');
                // });
                if (!admin.dataValues.isVerified) {
                  return res.status(200).send({
                    success: false,
                    message:
                      "Admin verification is required, verify your number by clicking sent url and try again.",
                    isVerified: false,
                  });
                }
                const token = await jwt.sign(
                  {
                    data: { adminId: admin.dataValues.id, role: "Admin" },
                  },
                  process.env.JWT_TOKEN_KEY,
                  { expiresIn: "1h" }
                );

                const refreshToken = await jwt.sign(
                  {
                    data: { adminId: admin.dataValues.id, role: "Admin" },
                  },
                  process.env.JWT_REFRESH_TOKEN_KEY,
                  { expiresIn: "7d" }
                );
                const { fullName, id, phoneNo, countryCode } = admin.dataValues;
                var number = countryCode + "" + phoneNo;

                return res.status(200).send({
                  success: true,
                  message: "Login successful.",
                  token,
                  refreshToken,
                  admin: { fullName, id, number },
                });
              } else {
                return res.status(200).send({
                  success: false,
                  message: "Phone Number or Password is incorrect.",
                });
              }
            })
            .catch((err) => {
              console.log(err);
              return res.status(500).send({
                success: false,
                message: "Sorry! Somethig went wrong.",
                err,
              });
            });
        } else {
          return res.status(200).send({
            success: false,
            message: "No admin found with this Phone Number",
          });
        }
      })
      .catch((err) => {
        console.log(err);
        return res.status(500)({
          success: false,
          message: "Sorry! Something went wrong.",
          err,
        });
      });
  } catch (err) {
    return res
      .status(400)
      .send({ success: false, message: "Sorry! Something went wrong.", err });
  }
};

exports.logout = (req, res, next) => {
  if (res.locals.isAuthenticated) {
    req.session.destroy((err) => {
      return res.redirect("/");
    });
  } else {
    return res.redirect("/login");
  }
};

exports.signUp = (req, res, next) => {
  console.log("length", req.body.phoneNo.toString().length);
  console.log("Hell");
  var length = req.body.phoneNo.toString().length;
  if (length >= 6 && length <= 12) {
  } else {
    res.status(422).json({
      success: false,
      message: "Number digits should be 6-12",
    });
  }
  Admin.findOne({
    where: {
      countryCode: req.body.countryCode,
      phoneNo: req.body.phoneNo,
    },
  })
    .then((admin) => {
      if (!admin) {
        return bcrypt
          .hash(req.body.password, 12)
          .then(async (hashedPassword) => {
            var otp = otpGenerator.generate(4, {
              digits: true,
              upperCaseAlphabets: false,
              upperCaseAlphabets: false,
              specialChars: false,
            });
            console.log("otp ", otp);

            const admin = new Admin({
              fullName: req.body.fullName,
              countryCode: req.body.countryCode,
              phoneNo: req.body.phoneNo,
              password: hashedPassword,
              verificationToken: otp,
            });
            return admin.save();
          })
          .then(async (result) => {
            var message = `Enter This OTP ${result.verificationToken} to verify your account`;
            var number = req.body.countryCode + "" + req.body.phoneNo;
            client.messages
              .create({
                body: message,
                to: `+${number}`,
                from: process.env.TWILIO_NUMBER,
              })
              .then(async (message) => {
                console.log(message);
                return res.status(200).send({
                  success: true,
                  message: "Admin created succcessfully.",
                });
              })
              .catch((err) => {
                console.log(err); // handle error
              });
          });
      } else {
        return res.status(400).send({
          success: false,
          message: "Phone number exists already, please pick a different one.",
        });
      }
    })
    .catch((err) => {
      console.log(err);
      return res
        .status(400)
        .send({ success: false, message: "Error creating admin", err });
    });
};

exports.resendOtp = async (req, res) => {
  try {
    var admin = await Admin.findOne({
      where: {
        countryCode: req.body.countryCode,
        phoneNo: req.body.phoneNo,
      },
    });
    //Creating Reset OTP for SMS
    var otp = otpGenerator.generate(4, {
      digits: true,
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
    });
    const number = admin.countryCode + "" + admin.phoneNo;
    console.log("numberrr: ", number);
    //Sending verify OTP to admin number
    await client.messages
      .create({
        body: `Enter This OTP ${otp} to verify your account`,
        to: `+${number}`,
        from: process.env.TWILIO_NUMBER,
      })
      .then(async (message) => {
        console.log(message);
        //Attaching otp to request document so we could verify on order completion
        const updatedAdmin = await Admin.update(
          {
            verificationToken: otp,
          },
          {
            where: {
              countryCode: req.body.countryCode,
              phoneNo: req.body.phoneNo,
            },
          }
        );
        return res.status(200).send({
          success: true,
          otp: otp,
          message: "OTP Resent.",
        });
      })
      .catch((error) => {
        console.log(error);
      });
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

exports.accountVerify = async (req, res, next) => {
  try {
    Admin.findOne({
      where: {
        verificationToken: req.body.otp,
      },
    })
      .then(async (admin) => {
        if (admin) {
          let result = await admin.update({
            isVerified: true,
            verificationToken: null,
          });
          if (result) {
            return res
              .status(200)
              .send({ success: true, message: "Admin Verified" });
          } else {
            return res
              .status(400)
              .send({ success: false, message: "Admin Couldn't Be Verified" });
          }
        } else {
          return res
            .status(400)
            .send({ success: false, message: "Wrong Verification OTP" });

          // res.status(200).send({ message:"Invalid token",status:false })
        }
      })
      .catch((err) => {
        console.log(err);
      });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .send({ success: false, message: "Something went wrong", err });
  }
};

exports.forgotPassword = async (req, res, next) => {
  const validationErrors = [];
  try {
    console.log("length", req.body.phoneNo.toString().length);
    var length = req.body.phoneNo.toString().length;
    if (length >= 6 && length <= 12) {
    } else {
      res.status(422).json({
        success: false,
        message: "Number digits should be 6-12",
      });
    }

    Admin.findOne({
      where: {
        countryCode: req.body.countryCode,
        phoneNo: req.body.phoneNo,
      },
    })
      .then(async (admin) => {
        if (admin) {
          var otp = otpGenerator.generate(4, {
            digits: true,
            lowerCaseAlphabets: false,
            upperCaseAlphabets: false,
            specialChars: false,
          });
          console.log("otp ", otp);
          admin.resetToken = otp;
          admin.resetTokenExpiry = Date.now() + 3600000;
          const adminSave = await admin.save();
          if (!adminSave) {
            return res
              .status(500)
              .send({ success: false, message: "Something went wrong" });
          }
          var message = `Add This OTP ${otp} to reset password`;
          var number = req.body.countryCode + "" + req.body.phoneNo;
          client.messages
            .create({
              body: message,
              to: `+${number}`,
              from: process.env.TWILIO_NUMBER,
            })
            .then(async (message) => {
              console.log(message);
              return res.status(200).send({
                success: true,
                message: "Forget Password OTP has been sent to your number.",
              });
            });
        } else {
          res
            .status(200)
            .send({ message: "Admin Not Exists", success: !!admin });
        }
      })
      .catch((err) => {
        console.log(err);
      });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .send({ success: false, message: "Something went wrong", err });
  }
};
exports.updateAdmin = async (req, res, next) => {
  try {
    console.log(req.body);
    console.log(req.auth);
    console.log(req.params);
    const adminId = req?.auth?.data?.adminId;
    console.log("adminId ", adminId);

    const admin = await Admin.findOne({ where: { id: adminId }, raw: true });
    if (!admin) {
      return res.status(404).send({
        success: false,
        message: "Admin Not Found",
      });
    }
    var encryptedPassword;
    if (req.body.password) {
      await bcrypt.hash(req.body.password, 12).then(async (hashedPassword) => {
        console.log("hashedPassword ", hashedPassword);
        encryptedPassword = hashedPassword;
      });
    }
    const updatedAdmin = await Admin.update(
      {
        password: encryptedPassword ? encryptedPassword : admin.password,
        fullName: req.body.fullName ? req.body.fullName : admin.fullName,
      },
      {
        where: { id: adminId },
      }
    );
    console.log("updatedAdmin ", updatedAdmin);
    if (updatedAdmin[0] > 0) {
      return res.status(200).send({
        success: true,
        message: "Admin Updated",
        updatedOrder: updatedAdmin,
      });
    } else {
      return res.status(404).send({
        success: false,
        message: "Admin Not Updated",
      });
    }
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};
exports.checkOtp = async (req, res, next) => {
  try {
    const { verificationToken } = req.body;
    Admin.findOne({
      where: {
        resetToken: verificationToken,
      },
    })
      .then(async (admin) => {
        if (!admin) {
          return res
            .status(404)
            .send({ success: false, message: "Wrong Token" });
        } else {
          return res
            .status(200)
            .send({ success: true, message: "Navigate To Next Screen" });
        }
      })
      .catch((err) => {
        console.log(err);
      });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .send({ success: false, message: "Something went wrong", err });
  }
};
exports.resetPassword = async (req, res, next) => {
  try {
    const { verificationToken, password } = req.body;
    Admin.findOne({
      where: {
        resetToken: verificationToken,
      },
    })
      .then(async (admin) => {
        if (!admin) {
          res.status(404).send({ success: false, message: "Wrong Token" });
        }
        return bcrypt.hash(password, 12).then(async (hashedPassword) => {
          let result = await admin.update({
            password: hashedPassword,
            resetToken: null,
            resetTokenExpiry: null,
          });
          if (result) {
            res
              .status(200)
              .send({ message: "Password updated", success: true });
          } else {
            res.status(200).send({
              message: "Err updating password try again",
              success: false,
            });
          }
        });
      })
      .catch((err) => {
        console.log(err);
      });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .send({ success: false, message: "Something went wrong", err });
  }
};
exports.viewallUsers = async (req, res, next) => {
  try {
    const role = req?.auth?.data?.role;
    console.log("role ", role);
    if (role !== "Admin") {
      return res.status(400).send({
        success: false,
        message: "Only Admin Can View All Users",
      });
    }
    const users = await User.findAll({
      raw: true,
      include: [{ model: PricingPlan }],
      where: {
        isApprovedInfluencer: false,
      },
    });

    // Sort users by the createdAt property in descending order (newest first)
    users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    var newUsers = [];
    for (let i = 0; i < users.length; i++) {
      var user = users[i];
      console.log("user.id ", user.id);
      const usersRafflesBought = await RaffleBuyer.findAll({
        attributes: ["raffleId"],
        raw: true,
        where: { userId: user.id },
      });
      console.log("usersRafflesBought ", usersRafflesBought);
      await Object.defineProperty(user, "totalTickets", {
        value: usersRafflesBought.length,
      });
      console.log("usersRaffles.length ", usersRafflesBought.length);
      user["totalTickets"] = usersRafflesBought.length;
      console.log("raffle after update ", user);
      users[i] = {
        ...user,
        totalTickets: usersRafflesBought.length,
      };
    }
    console.log("users ", users);
    if (users.length > 0) {
      return res.status(200).send({
        success: true,
        message: "All Users Found",
        users: users,
      });
    } else {
      return res.status(404).send({
        success: false,
        message: "Users Not Found",
      });
    }
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};

exports.viewAllUsersOf30Days = async (req, res, next) => {
  try {
    console.log(req.body);
    console.log(req.auth);
    const role = req?.auth?.data?.role;
    console.log("role ", role);
    if (role !== "Admin") {
      return res.status(400).send({
        success: false,
        message: "Only Admin Can View All Users",
      });
    }
    var today = new Date();
    console.log("today");
    var yesterdaydate = moment(today).subtract(30, "days").toDate();
    console.log("yesterdaydate ", yesterdaydate);
    const users = await User.findAll({
      where: {},
      raw: true,
    });
    console.log("users ", users);
    if (users.length > 0) {
      return res.status(200).send({
        success: true,
        message: "All Users Found",
        users: users,
      });
    } else {
      return res.status(404).send({
        success: false,
        message: "Users Not Found",
      });
    }
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};
exports.suspendUser = async (req, res, next) => {
  try {
    console.log(req.body);
    console.log(req.auth);
    console.log(req.params);
    const role = req?.auth?.data?.role;
    console.log("role ", role);
    if (role !== "Admin") {
      return res.status(400).send({
        success: false,
        message: "Only Admin Can CView All Receipts",
      });
    }

    const user = await User.findOne({
      where: { id: req.params.id },
      raw: true,
    });
    if (!user) {
      return res.status(404).send({
        success: false,
        message: "User Not Found",
      });
    }
    const updatedUser = await User.update(
      {
        isSuspended: true,
      },
      {
        where: { id: req.params.id },
      }
    );
    console.log("updatedUser ", updatedUser);
    if (updatedUser[0] > 0) {
      return res.status(200).send({
        success: true,
        message: "User Suspended",
        updatedOrder: updatedUser,
      });
    } else {
      return res.status(404).send({
        success: false,
        message: "User Not Suspended",
      });
    }
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};
exports.softDeleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log(req.body);
    console.log(req.auth);
    const role = req?.auth?.data?.role;
    console.log("role ", role);
    if (role !== "Admin") {
      return res.status(400).send({
        success: false,
        message: "Only Admin Can Soft Delete User",
      });
    }

    const user = await User.findOne({
      where: { id: id },
      raw: true,
    });
    console.log("User ", user);
    if (user) {
      const userSoftDeleted = await User.destroy({
        where: {
          id: id,
        },
        raw: true,
      });
      console.log("userSoftDeleted ", userSoftDeleted);
      if (userSoftDeleted > 0) {
        return res.status(200).send({
          success: true,
          message: "User Soft Deleted",
          userSoftDeleted: userSoftDeleted,
        });
      } else {
        return res.status(400).send({
          success: false,
          message: "User Couldn't be Soft Deleted",
        });
      }
    } else {
      return res.status(400).send({
        success: false,
        message: "User Isn't Found",
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
exports.deleteUserPermanently = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log(req.body);
    console.log(req.auth);
    const role = req?.auth?.data?.role;
    console.log("role ", role);
    if (role !== "Admin") {
      return res.status(400).send({
        success: false,
        message: "Only Admin Can Permanently Delete User",
      });
    }

    const user = await User.findOne({
      where: { id: id },
      raw: true,
    });
    console.log("User ", user);
    if (user) {
      const userSoftDeleted = await User.destroy({
        where: {
          id: id,
        },
        raw: true,
      });
      console.log("userSoftDeleted ", userSoftDeleted);
      if (userSoftDeleted > 0) {
        return res.status(200).send({
          success: true,
          message: "User Soft Deleted",
          userSoftDeleted: userSoftDeleted,
        });
      } else {
        return res.status(400).send({
          success: false,
          message: "User Couldn't be Soft Deleted",
        });
      }
    } else {
      return res.status(400).send({
        success: false,
        message: "User Isn't Found",
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

exports.incrementTutorialStepCounter = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log("Increment tutorial step counter for user ID...", id);
    const user = await User.findOne({ where: { id: id } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    // Increment the tutorialStepCounter field by 1
    user.tutorialStepCounter = (user.tutorialStepCounter || 0) + 1;
    await user.save();

    return res
      .status(200)
      .json({ message: "Tutorial step counter incremented" });
  } catch (error) {
    next(error);
  }
};

// Influencers
exports.viewAllInfluencers = async (req, res, next) => {
  try {
    const role = req?.auth?.data?.role;
    console.log("role ", role);
    if (role !== "Admin") {
      return res.status(400).send({
        success: false,
        message: "Only Admin Can View All Influencers",
      });
    }
    const users = await User.findAll({
      raw: true,
      include: [{ model: PricingPlan }],
      where: {
        isApprovedInfluencer: true,
      },
    });
    var newUsers = [];
    for (let i = 0; i < users.length; i++) {
      var user = users[i];
      console.log("user.id ", user.id);
      const usersRafflesBought = await RaffleBuyer.findAll({
        attributes: ["raffleId"],
        raw: true,
        where: { userId: user.id },
      });
      console.log("usersRafflesBought ", usersRafflesBought);
      await Object.defineProperty(user, "totalTickets", {
        value: usersRafflesBought.length,
      });
      console.log("usersRaffles.length ", usersRafflesBought.length);
      user["totalTickets"] = usersRafflesBought.length;
      console.log("raffle after update ", user);
      users[i] = {
        ...user,
        totalTickets: usersRafflesBought.length,
      };
    }
    console.log("users ", users);
    if (users.length > 0) {
      return res.status(200).send({
        success: true,
        message: "All Influencers Found",
        users: users,
      });
    } else {
      return res.status(404).send({
        success: false,
        message: "Influencers Not Found",
      });
    }
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};

exports.toggleInfluencerStatus = async (req, res, next) => {
  try {
    const role = req?.auth?.data?.role;
    if (role !== "Admin") {
      return res.status(400).send({
        success: false,
        message: "Only Admins can toggle influencer status",
      });
    }

    const userId = req.params.id;
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).send({
        success: false,
        message: "User not found",
      });
    }

    const isApprovedInfluencer = !user.isApprovedInfluencer;
    const [numAffectedRows, affectedRows] = await User.update(
      { isApprovedInfluencer },
      {
        where: { id: userId },
        returning: true,
        plain: true,
      }
    );

    return res.status(200).send({
      success: true,
      message: `Influencer status for user with id ${userId} updated`,
      user: affectedRows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({
      success: false,
      message: "Internal Server Error",
      error: error,
    });
  }
};

exports.assignInfluencerCode = async (req, res, next) => {
  try {
    console.log("===> In assignInfluencerCode...");
    const role = req?.auth?.data?.role;
    if (role !== "Admin") {
      return res.status(400).send({
        success: false,
        message: "Only admins can assign promo codes to influencers",
      });
    }

    const userId = req.params.id;
    const { promoCode } = req.body;

    console.log(`---> promoCode to be set: ${promoCode}`);

    const userWithCode = await User.findOne({
      where: { promoCode },
    });

    if (userWithCode && userWithCode.id !== userId) {
      return res.status(400).send({
        success: false,
        message: "Promo code already exists for another user",
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).send({
        success: false,
        message: "Influencer not found",
      });
    }

    // Update the influencer with the provided promo code
    const [numAffectedRows, affectedRows] = await User.update(
      { promoCode },
      {
        where: { id: userId },
        returning: true,
        plain: true,
      }
    );

    return res.status(200).send({
      success: true,
      message: `Promo code assigned to influencer with id ${userId}`,
      user: affectedRows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({
      success: false,
      message: "Internal Server Error",
      error: error,
    });
  }
};

exports.assignUserCode = async (req, res, next) => {
  try {
    console.log("===> In assignUserCode...");
    const role = req?.auth?.data?.role;
    if (role !== "Admin") {
      return res.status(400).send({
        success: false,
        message: "Only Admins can assign auto-generated promo codes to users",
      });
    }

    const userId = req.params.id;
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).send({
        success: false,
        message: "User not found",
      });
    }

    // Generate a new promo code
    const newPromoCode = await getUniquePromoCode();
    console.log(`---> promoCode to be set: ${newPromoCode}`);

    // Update the influencer with the new promo code
    const [numAffectedRows, affectedRows] = await User.update(
      { promoCode: newPromoCode },
      {
        where: { id: userId },
        returning: true,
        plain: true,
      }
    );

    return res.status(200).send({
      success: true,
      message: `New promo code assigned to user with id ${userId}`,
      user: affectedRows,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send({
      success: false,
      message: "Internal Server Error",
      error: error,
    });
  }
};

exports.viewUsersReferred = async (req, res, next) => {
  try {
    const { id } = req.params; // influencer id

    const usersReferred = await UserReferral.findAll({
      where: { senderId: id },
      raw: true,
    });

    const receiverIds = usersReferred.map(
      (userReferral) => userReferral.receiverId
    );

    const usersDetail = await User.findAll({
      where: { id: receiverIds },
      include: [{ model: PricingPlan }],
      raw: true,
    });

    if (usersDetail) {
      if (usersDetail.length > 0) {
        return res.status(200).send({
          success: true,
          usersDetail,
          message: "Users Referred Found",
        });
      } else {
        return res.status(400).send({
          success: false,
          message: "Users Referred Not Found",
        });
      }
    } else {
      return res.status(400).send({
        success: false,
        message: "Users Referred Not Found",
      });
    }
  } catch (err) {
    console.log("Error: ", err);
  }
};

// Raffles
exports.viewallRaffles = async (req, res, next) => {
  try {
    console.log(req.body);
    const role = req?.auth?.data?.role;
    console.log("role ", role);
    // const { raffleId } = req.params;

    if (role !== "Admin") {
      return res.status(400).send({
        success: false,
        message: "Only Admin Can View All Receipts",
      });
    }
    const raffles = await Raffle.findAll({
      raw: true,
      where: {},
      include: [{ model: PricingPlan }],
    });
    // console.log("raffles are ");
    // console.log("raffles ", raffles);
    let winnerArray = [];
    for (let i = 0; i < raffles.length; i++) {
      winnerArray.push(raffles[i].winnerId);
    }

    console.log("winner array is ", winnerArray);
    var newRaffles = [];
    for (let i = 0; i < raffles.length; i++) {
      var raffle = raffles[i];
      console.log("raffle. winner ", raffles.winnerId);
      const usersRaffles = await RaffleBuyer.findAll({
        attributes: ["raffleId"],
        raw: true,
        where: { raffleId: raffle.id },
      });

      // console.log("raffles ids are ", raffles.id);

      const winner = await User.findAll({
        where: { id: winnerArray },
        // raw: true,
      });
      console.log("winner is", winner);

      console.log("usersRaffles ", usersRaffles);
      newRaffles.push({
        ...raffle,
        winner,
        totalEntries: usersRaffles.length,
      });
    }

    // Sort the newRaffles array to place 'Active' raffles at the top
    newRaffles.sort((a, b) => {
      if (a.status === "Active" && b.status !== "Active") return -1;
      if (a.status !== "Active" && b.status === "Active") return 1;
      return 0;
    });

    console.log("newRaffles ", newRaffles);
    if (raffles.length > 0) {
      return res.status(200).send({
        success: true,
        message: "All Raffles Found",
        raffles: newRaffles,
      });
    } else {
      return res.status(404).send({
        success: false,
        message: "Raffles Not Found",
      });
    }
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};

exports.viewAllRafflesOf30Days = async (req, res, next) => {
  try {
    console.log(req.body);
    console.log(req.auth);
    const role = req?.auth?.data?.role;
    console.log("role ", role);
    if (role !== "Admin") {
      return res.status(400).send({
        success: false,
        message: "Only Admin Can View All Receipts",
      });
    }
    var today = new Date();
    console.log("today");
    var yesterdaydate = moment(today).subtract(30, "days").toDate();
    console.log("yesterdaydate ", yesterdaydate);
    const raffles = await Raffle.findAll({
      where: {
        createdAt: {
          [Op.gte]: yesterdaydate,
        },
      },
      raw: true,
    });
    // console.log("raffles ", raffles);
    if (raffles.length > 0) {
      return res.status(200).send({
        success: true,
        message: "All Raffles Found",
        raffles: raffles,
      });
    } else {
      return res.status(404).send({
        success: false,
        message: "Raffles Not Found",
      });
    }
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};

exports.createRaffle = async (req, res, next) => {
  try {
    console.log(
      "-----------------------------------------------------------------------------"
    );
    console.log("Raffle creating api");
    const role = req?.auth?.data?.role;
    console.log("role ", role);
    if (role !== "Admin") {
      return res.status(400).send({
        success: false,
        message: "Only Admin Can Create Raffle",
      });
    }
    const raffleImage = req.files["raffleImage"]
      ? req.files["raffleImage"][0].filename
      : null;
    console.log("raffleImage", raffleImage);
    const S3imageURL = await s3Upload(raffleImage, raffleImage);
    console.log("S3imageURL", S3imageURL);

    const currentDate = new Date();
    const startDate = new Date(req.body.startDate);

    // Check if the createdAt date is in the past compared to the start date
    const status = currentDate >= startDate ? "Active" : "Scheduled";

    const raffle = await new Raffle({
      name: req.body.name,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      totalTickets: req.body.totalTickets,
      raffleType: req.body.raffleType,
      details: req.body.details,
      url: "/files/" + raffleImage,
      status: status,
    });

    var newraffle = await raffle.save();

    let devices = await Player.findAll({});
    console.log("New Reffle is :", newraffle);
    console.log("devices playerid are");
    console.log(devices);

    console.log(devices.playerId);

    if (newraffle && status === "Active") {
      console.log("--> if same date raffle creation");
      await createNotification(
        "A New Raffle has been created",
        "1234",
        "push",
        devices
      );
      console.log("Inside new Raffle if after notification");
      return res.status(200).send({
        success: true,
        newraffle: newraffle,
        message: "Your Raffle Has Been Created",
      });
    } else if (newraffle && status === "Scheduled") {
      return res.status(201).send({
        success: true,
        message: "Your Raffle Has Been Scheduled",
      });
    } else {
      return res.status(400).send({
        success: false,
        message: "Your Raffle Couldn't be Created",
      });
    }
  } catch (err) {
    console.log("Err is : ", err);
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

exports.updateRaffle = async (req, res, next) => {
  console.log("Form Data for UPDATE: ", req?.auth?.data);
  try {
    const role = req?.auth?.data?.role;
    const { id } = req.params;
    if (role !== "Admin") {
      return res.status(400).send({
        success: false,
        message: "You are not authorized to perform this operation",
      });
    }

    const raffleImage = req.files["raffleImage"]
      ? req.files["raffleImage"][0].filename
      : null;
    console.log("raffle image is ", raffleImage);
    const raffle = await Raffle.findOne({
      where: { id },
    });

    if (raffle) {
      const currentDate = new Date();
      const endDate = new Date(req.body.endDate);

      let status = "Active";

      if (endDate < currentDate) {
        status = "Closed";
      }

      if (raffleImage === null) {
        const updatedRaffle = await Raffle.update(
          {
            name: req.body.name,
            startDate: req.body.startDate,
            endDate: req.body.endDate,
            totalTickets: req.body.totalTickets,
            details: req.body.details,
            status: status,
          },
          { where: { id: raffle.id } }
        );
        if (updatedRaffle) {
          return res.status(200).send({
            success: true,
            updatedRaffle,
            message: "Raffle Updated",
          });
        } else {
          return res.status(400).send({
            success: false,
            message: "Your Raffle Couldn't Update",
          });
        }
      } else {
        const S3imageURL = await s3Upload(raffleImage, raffleImage);

        const updatedRaffle = await Raffle.update(
          {
            name: req.body.name,
            startDate: req.body.startDate,
            endDate: req.body.endDate,
            totalTickets: req.body.totalTickets,
            details: req.body.details,
            url: "/files/" + raffleImage,
            status: status,
          },
          { where: { id: raffle.id } }
        );
        if (updatedRaffle) {
          return res.status(200).send({
            success: true,
            updatedRaffle,
            message: "Raffle Updated",
          });
        } else {
          return res.status(400).send({
            success: false,
            message: "Your Raffle Couldn't Update",
          });
        }
      }
    } else {
      return res
        .status(404)
        .success({ success: false, message: "Raffle not found" });
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

exports.deleteRaffle = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log(req.body);
    console.log(req.auth);
    const role = req?.auth?.data?.role;
    console.log("role ", role);
    if (role !== "Admin") {
      return res.status(400).send({
        success: false,
        message: "Only Admin Can Delete Raffle",
      });
    }

    const raffle = await Raffle.findOne({
      where: { id: id },
      raw: true,
    });
    // console.log("raffle ", raffle);
    if (raffle) {
      const raffleImage = raffle.url.split("/")[2]; // extract the image name from the url
      await s3Delete(raffleImage); // call the deleteFile function with the image name
      const raffleDeleted = await Raffle.destroy({
        where: {
          id: id,
        },
        raw: true,
      });
      console.log("raffleDeleted ", raffleDeleted);
      if (raffleDeleted > 0) {
        return res.status(200).send({
          success: true,
          message: "Raffle Deleted",
          raffleDeleted: raffleDeleted,
        });
      } else {
        return res.status(400).send({
          success: false,
          message: "Raffle Couldn't Not Deleted",
        });
      }
    } else {
      return res.status(400).send({
        success: false,
        message: "Raffle Isn't Found",
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

exports.viewRaffleEntries = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log(req.body);
    console.log(req.auth);
    const role = req?.auth?.data?.role;
    console.log("role ", role);
    if (role !== "Admin") {
      return res.status(400).send({
        success: false,
        message: "Only Admin Can Delete Raffle",
      });
    }

    const raffleEntries = await RaffleBuyer.findAll({
      where: { raffleId: id },
      attributes: ["id", "userId"],
      include: [{ model: User }, { model: Raffle }],
      raw: true,
    });

    const raffle = await Raffle.findOne({
      where: {
        id,
      },
    });

    let winner = await User.findOne({
      where: {
        id: raffle.winnerId,
      },
    });
    console.log("winner is ", winner);

    // console.log("raffleEntries ", raffleEntries);
    if (raffleEntries) {
      if (raffleEntries.length > 0) {
        return res.status(200).send({
          success: true,
          raffleEntries: raffleEntries,
          message: "Raffle Entries Found",
        });
      } else {
        return res.status(400).send({
          success: false,
          message: "Raffle Entries Not Found",
        });
      }
    } else {
      return res.status(400).send({
        success: false,
        message: "Raffle Entries Not Found",
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

exports.raffleWinner = async (req, res, next) => {
  try {
    const { raffleId, userId } = req.body;
    console.log(req.body);
    console.log(req.auth);
    const role = req?.auth?.data?.role;
    console.log("role ", role);
    if (role !== "Admin") {
      return res.status(400).send({
        success: false,
        message: "Only Admin Can Delete Raffle",
      });
    }

    const updatedRaffle = await Raffle.update(
      {
        winnerId: userId,
        status: "Closed",
      },
      {
        where: { id: raffleId },
      }
    );
    if (updatedRaffle) {
      if (updatedRaffle > 0) {
        return res.status(200).send({
          success: true,
          updatedRaffle: updatedRaffle,
          message: "Winner Added To Raffle",
        });
      } else {
        return res.status(400).send({
          success: false,
          message: "Winner Couldn't Be Added",
        });
      }
    } else {
      return res.status(400).send({
        success: false,
        message: "Winner Couldn't Be Added",
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

exports.addPlan = async (req, res, next) => {
  try {
    //const result = await raffleSchema.validateAsync(req.body)
    console.log(req.body);
    console.log(req.auth);
    const role = req?.auth?.data?.role;
    console.log("role ", role);
    if (role !== "Admin") {
      return res.status(400).send({
        success: false,
        message: "Only Admin Can Create Raffle",
      });
    }
    const pricingPlan = await new PricingPlan({
      name: req.body.name,
      price: req.body.price,
      details: req.body.details,
      tickets: req.body.tickets,
      isDeleted: false,
    });
    var newpricingPlan = await pricingPlan.save();
    if (newpricingPlan) {
      return res.status(200).send({
        success: true,
        newpricingPlan: newpricingPlan,
        message: "Your Plan Has Been Created",
      });
    } else {
      return res.status(400).send({
        success: false,
        message: "Your Plan Couldn't Created",
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

//Paypal Plan Creation
exports.createPlan = async (req, res) => {
  console.log("Hitting Plan Creation API");
  let token = await generateAccessToken();
  try {
    console.log("token is ", token);
    token = token.replace(/['"]+/g, "");
    const { name, description, interval_unit, price, tickets } = req.body;

    let plan = await axios.post(
      `${baseUrl}/v1/billing/plans`,
      {
        // TODO: change for production
        product_id: "1710496526145", //active sandbox product id
        // product_id: "1671725830577", //active live product id
        // product: Gemmint Test Subscriptions, in Exquisite Plan with plan id: P-17E64896AH168020UMSIVWYQ
        // product_id: "1687247586841",
        // product: Gemmint Test Subscriptions, in Basic Plan with plan id: P-
        // product_id: "1687247586841",
        name: name,
        description: name,
        status: "ACTIVE",
        billing_cycles: [
          {
            frequency: {
              interval_unit: interval_unit,
              interval_count: 1,
            },
            tenure_type: "REGULAR",
            sequence: 1,
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
            value: "2",
            currency_code: "USD",
          },
          setup_fee_failure_action: "CONTINUE",
          payment_failure_threshold: 3,
        },
        taxes: {
          percentage: "8",
          inclusive: false,
        },
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    terminateAccessToken(token);
    planStatus = plan.status;
    plan = JSON.stringify(plan.data);
    plan = JSON.parse(plan);
    if (planStatus === 201) {
      const pricingPlan = await new PricingPlan({
        plan_id: plan.id,
        name: plan.name,
        price,
        tickets: tickets,
        planInterval: interval_unit,
        details: description,
        isDeleted: false,
      });
      let newPricingPlan = await pricingPlan.save();
      if (newPricingPlan) {
        res.status(200).send({
          success: true,
          message: "Plan Created Successfully",
          plan,
        });
        terminateAccessToken(token);
      } else {
        res
          .status(401)
          .send({ success: false, message: "error saving Plan to DB" });
      }
    } else {
      res.status(401).send({ success: false, message: "Error Creating Plan" });
    }
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .send({ success: false, message: "Internal Server Error ", err });
    terminateAccessToken(token);
  }
};

exports.viewAllPlans = async (req, res, next) => {
  try {
    console.log(req.body);
    console.log(req.auth);
    const role = req?.auth?.data?.role;
    console.log("role ", role);
    if (role !== "Admin") {
      return res.status(400).send({
        success: false,
        message: "You are not authorized to make this request",
      });
    }

    const plans = await PricingPlan.findAll({
      where: {
        isDeleted: false,
      },
    });
    console.log("plans", plans);

    if (plans.length > 0) {
      return res.status(200).send({
        success: true,
        message: "All Plans",
        plans: plans,
      });
    } else {
      return res.status(404).send({
        success: false,
        message: "No Plan Found",
      });
    }
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};

exports.editPlan = async (req, res, next) => {
  try {
    const { name, price, details, planId, tickets } = req.body;
    const plan = await PricingPlan.findOne({
      where: {
        id: planId,
      },
    });
    await PricingPlan.update(
      {
        name,
        price,
        details,
        tickets,
      },
      { where: { id: planId, isDeleted: false } }
    )
      .then((plans) => {
        return res.status(200).send({
          success: true,
          message: "Plan update successfully",
          data: plans,
        });
      })
      .catch((err) => {
        console.log(err);
        res.status(401).send("Plan not found");
      });
  } catch (err) {
    console.log("error", err);
    return res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};

exports.updatePlan = async (req, res) => {
  let token = await generateAccessToken();
  try {
    token = token.replace(/['"]+/g, "");
    const { billing_plan_id } = req.params;
    const { planId, name, description, price, tickets } = req.body;
    console.log({ billing_plan_id, planId, name, description, price, tickets });
    if (billing_plan_id === null) {
      let updatedPlan = await axios.patch(
        `${baseUrl}/v1/billing/plans/${billing_plan_id}`,
        [
          { op: "replace", path: "/name", value: name },
          { op: "replace", path: "/description", value: name },
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
      terminateAccessToken(token);
      console.log("updated plan status is ", updatedPlan.status);
      if (updatedPlan.status === 204) {
        const pricingPlanDb = await PricingPlan.update(
          {
            name,
            price,
            tickets: tickets,
            details: description,
          },
          { where: { plan_id: billing_plan_id, isDeleted: false } }
        );

        if (pricingPlanDb) {
          return res
            .status(200)
            .send({ success: true, message: "Plan Updated Successfully" });
        } else {
          return res
            .status(200)
            .send({ success: false, message: "Error Updating Plans DB" });
        }
      } else {
        return res
          .status(401)
          .send({ success: false, message: "Error Updating Plan" });
      }
    } else {
      const pricingPlanDb = await PricingPlan.update(
        {
          name,
          price,
          tickets: tickets,
          details: description,
        },
        { where: { id: planId, isDeleted: false } }
      );
      if (pricingPlanDb) {
        return res
          .status(200)
          .send({ success: true, message: "Plan Updated Successfully" });
      } else {
        return res
          .status(404)
          .send({ success: false, message: "Error Updating Plan" });
      }
    }
  } catch (err) {
    terminateAccessToken(token);
    console.log(err);
    return res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};

exports.deletePlan = async (req, res, next) => {
  console.log("Api hit");
  const { planId } = req.params;
  const plan = await PricingPlan.findOne({
    where: {
      id: planId,
    },
  });
  if (plan.name === "Base") {
    return res
      .status(404)
      .send({ success: false, message: "Cannot delete Base Plan" });
  }

  try {
    const plans = await PricingPlan.update(
      {
        isDeleted: true,
      },
      { where: { id: planId, isDeleted: false } }
    );
    if (!plans) {
      return res.status(401).send("Plan does not exist");
    }

    return res
      .status(200)
      .send({ success: true, message: "Plan Deleted Successfully" });
  } catch (err) {
    console.log("error", err);
    res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};

exports.activateSubscription = async (req, res) => {
  try {
    let token = await generateAccessToken();
    token = token.replace(/['"]+/g, "");
    const { subscription_id } = req.params;
    let subscription = await axios.get(
      `${baseUrl}/v1/billing/subscriptions/${subscription_id}/activate`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    terminateAccessToken(token);
    let subscriptionStatus = subscription.status;
    console.log("subscription status is ", subscriptionStatus);
    subscription = JSON.stringify(subscription.data);
    subscription = JSON.parse(subscription);
    console.log("subscription is ", subscription);
    if (subscriptionStatus === 200) {
      res.status(200).send({
        success: true,
        message: "Subscription Activated Successfully ",
        subscription,
      });
    } else {
      console.log("subscription", subscription);
      res.status(401).send({
        success: false,
        message: "Error Activating subscription ",
        subscription,
      });
    }
  } catch (err) {
    console.log("error is ", err);
    terminateAccessToken(token);
    res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};

exports.suspendSubscription = async (req, res) => {
  try {
    let token = await generateAccessToken();
    token = token.replace(/['"]+/g, "");
    const { subscription_id } = req.params;
    const { reason } = req.body;
    let suspendSubscription = await axios.post(
      `${baseUrl}/v1/billing/subscriptions/${subscription_id}/suspend`,
      { reason },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    terminateAccessToken(token);
    let status = suspendSubscription.status;
    suspendSubscription = JSON.stringify(suspendSubscription.data);
    suspendSubscription = JSON.parse(suspendSubscription);
    console.log(suspendSubscription);
    if (status === 200) {
      res.status(200).send({
        success: true,
        message: "Subscription Suspended",
        suspendSubscription,
      });
    } else {
      res.status(401).send({
        success: false,
        message: "Error Suspending Subscription",
        suspendSubscription,
      });
    }
  } catch (err) {
    terminateAccessToken(token);
    console.log("suspend subscription error", err);
    res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};

exports.viewallReceipts = async (req, res, next) => {
  try {
    const role = req?.auth?.data?.role;
    console.log("role ", role);
    if (role !== "Admin") {
      return res.status(400).send({
        success: false,
        message: "Only Admin Can View All Receipts",
      });
    }

    const receipts = await Receipt.findAll({
      raw: true,
      where: { status: { [Op.ne]: "Expired" } },
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
      order: [["id", "DESC"]],
    });
    console.log("🧾 Receipts are...", receipts);

    if (receipts.length > 0) {
      return res.status(200).send({
        success: true,
        message: "All Receipts",
        receipts: receipts,
      });
    } else {
      return res.status(404).send({
        success: false,
        message: "Receipts Not Found",
      });
    }
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};

exports.rejectReceipt = async (req, res, next) => {
  try {
    const role = req?.auth?.data?.role;
    console.log("role ", role);
    if (role !== "Admin") {
      return res.status(400).send({
        success: false,
        message: "Only Admin Can Reject Receipt",
      });
    }
    Receipt.findOne({
      where: {
        id: req.params.id,
      },
      // include: [{ model: User, include: [{ model: Player }] }], // Include the User model and the associated Player model
    })
      .then(async (receipt) => {
        if (receipt) {
          let data = await Player.findAll({
            where: {
              userId: receipt.dataValues.userId,
            },
          });
          // console.log("==> Matched DATA in players table...", data);

          const playerIds = data.map((item) => item.dataValues.playerId);

          let result = await receipt.update({ status: "Rejected" });
          if (result) {
            // Send notification to the Player whose receipt has been rejected
            console.log(
              "------------------------------------------------------------------------------------"
            );
            console.log("Player IDs in reject notification...", playerIds);
            console.log(
              "------------------------------------------------------------------------------------"
            );
            await createNotification2(
              "The receipt has been rejected",
              "1234",
              "push",
              playerIds
              // ["d7e63a8b-c7d6-46a7-8919-b5953819a65f"]
            );
            return res
              .status(200)
              .send({ success: true, message: "Receipt Rejected" });
          } else {
            return res.status(400).send({
              success: false,
              message: "Receipt Couldn't Be Rejected",
            });
          }
        } else {
          return res
            .status(404)
            .send({ success: false, message: "No Receipt By This ID" });

          // res.status(200).send({ message:"Invalid token",status:false })
        }
      })
      .catch((err) => {
        console.log(err);
      });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};

exports.approveReceipt = async (req, res, next) => {
  try {
    const role = req?.auth?.data?.role;
    console.log("role ", role);
    if (role !== "Admin") {
      return res.status(400).send({
        success: false,
        message: "Only Admin Can Approve Receipt",
      });
    }
    const { points } = req.body;
    const { id } = req.params;

    const receipt = await Receipt.findOne({
      where: {
        id,
      },
    });
    if (receipt) {
      await receipt.update({
        status: "Approved",
        points,
      });
      let data = await Player.findAll({
        where: {
          userId: receipt.dataValues.userId,
        },
      });
      // console.log(
      //   "==> (approve receipt) Matched DATA in players table...",
      //   data
      // );

      const playerIds = data.map((item) => item.dataValues.playerId);

      const user = await User.findOne({
        where: {
          id: receipt.addedBy,
        },
      });
      console.log(
        "-------------> User's membership type...",
        user.dataValues.membershipType
      );
      const plan = await PricingPlan.findOne({
        where: {
          id: user.dataValues.membershipType,
        },
      });
      console.log(
        "--------------------------------> Approve Receipt <----------------------------------------"
      );
      console.log(
        "-------------> Ticket in queried Plan...",
        plan.dataValues.tickets
      );
      const ticketsBasedOnPlan = plan.dataValues.tickets;
      if (user) {
        user.points = user.points + points;
        user.totalAmount = user.totalAmount + points;
        let tickets = 0;
        if (user.points >= 500 && ticketsBasedOnPlan > 0) {
          // tickets = user.points / 500;
          tickets = Math.floor(user.points / 500) * ticketsBasedOnPlan;
          // tickets += ticketsBasedOnPlan;
          console.log("===> tickets...", tickets);
          // ticketsAssigned = tickets;
          // console.log("===> tickets assigned...", ticketsAssigned);
          user.tickets = user.tickets + tickets;
          console.log("===> user tickets...", user.tickets);
          ticketInterval = Math.floor(user.points / 500);
          for (let i = 0; i < ticketInterval; i++) {
            user.amountSpent = user.amountSpent + 500;
            user.points = user.points - 500;
            console.log("===> user points...", user.points);
          }
        }

        await user.save();
        // Trigger notification after receipt approval, disable when testing locally
        await createNotification2(
          "The receipt has been approved",
          "1234",
          "push",
          playerIds
        );

        if (tickets === 0) {
          res.status(200).send({
            success: true,
            message: "Receipt Approved",
            tickets: "No Tickets assigned",
          });
        } else {
          res.status(200).send({
            success: true,
            message: "Receipt Approved",
            tickets,
          });
        }
      } else {
        res.status(401).send({ success: false, message: "User Not found" });
      }
    } else {
      res.status(401).send({ success: false, message: "No receipts found" });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  }
};

exports.assignTickets = async (req, res, next) => {
  try {
    console.log("assign tickets body...", req.body);
    console.log("assign tickets auth...", req.auth);
    var { userId } = req.params;
    const { tickets } = req.body;
    const role = req?.auth?.data?.role;
    console.log("role ", role);
    if (role !== "Admin") {
      return res.status(400).send({
        success: false,
        message: "Only Admin Can Approve Receipt",
      });
    }
    if (tickets < 1) {
      return res.status(400).send({
        success: false,
        message: "Not Enough Tickets",
      });
    }
    const raffles = await Raffle.findAll({
      raw: true,
      include: [{ model: User }],
      order: [["createdAt", "DESC"]],
    });

    if (raffles[0]) {
      if (raffles[0].status === "Active") {
        console.log("buying ", tickets);
        for (let i = 0; i < tickets; i++) {
          const totalBoughtRaffles = await RaffleBuyer.findAll({
            where: { raffleId: raffles[0].id },
            raw: true,
          });
          console.log("totalBoughtRaffles.length ", totalBoughtRaffles.length);
          const userboughtRaffles = await RaffleBuyer.findAll({
            where: { raffleId: raffles[0].id, userId: userId },
            raw: true,
          });
          console.log("userboughtRaffles.length ", userboughtRaffles.length);
          if (totalBoughtRaffles.length >= 100) {
            return res.status(200).send({
              success: true,
              message: `Total ${i} number of tickets were bought as recently active raffle reached its limit of 100 and remaining amount successfully added to user's wallet`,
            });
          }
          if (userboughtRaffles.length >= 10) {
            return res.status(200).send({
              success: true,
              message: `Total ${i} number of tickets were bought as user has reached limit of 10 tickets per raffle and remaining amount successfully added to user's wallet`,
            });
          }
          console.log("purchasing", raffles[0].id, userId);
          var raffleId = parseInt(raffles[0].id);
          userId = parseInt(userId);
          var buyRaffle = await new RaffleBuyer({
            raffleId: raffleId,
            userId: userId,
          }).save();
          console.log("buyRaffle ", buyRaffle);
          User.findOne({
            where: {
              id: userId,
            },
          }).then(async (user) => {
            if (user) {
              let result = await user.update({
                points: user.points - 500,
                amountSpent: user.amountSpent + 500,
              });
              console.log("result ", result);
            }
          });
        }
        return res
          .status(200)
          .send({ success: true, message: "Raffles bought against tickets" });
      } else {
        console.log("just adding points based on tickets ", tickets);
        // for(let i = 0; i < tickets; i++){
        //     User.findOne({
        //         where: {
        //           id: userId,
        //         },
        //       })
        //         .then(async (user) => {
        //           if (user) {
        //             let result = await user.update({
        //               points: user.points+500
        //             });
        //             console.log("result ",result)
        //         }})
        // }
        return res.status(404).send({
          success: false,
          message: "No Active Raffles But Points Added To User",
        });
      }
    } else {
      return res
        .status(404)
        .send({ success: false, message: "No Active Raffles" });
    }
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};

exports.deleteReceipt = async (req, res, next) => {
  try {
    const role = req?.auth?.data?.role;
    console.log("role ", role);
    if (role !== "Admin") {
      return res.status(400).send({
        success: false,
        message: "Only Admin Can Delete Receipt",
      });
    }

    const receiptId = req.params.id;
    // console.log("receipt id is", receiptId);
    const deletedReceipt = await Receipt.destroy({
      where: {
        id: receiptId,
      },
    });
    console.log("deleted receipt");
    console.log(deletedReceipt);
    if (deletedReceipt) {
      return res
        .status(200)
        .send({ success: true, message: "Receipt Deleted Successfully" });
    } else {
      return res
        .status(404)
        .send({ success: false, message: "Error Deleting Receipt" });
    }
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};

exports.sendMail = async (req, res, next) => {
  const userId = req?.auth?.data?.userId;
  const { mailList } = req.body;

  const user = await User.findOne({
    where: {
      id: userId,
    },
  });

  const InvitationLink = process.env.REFERRAL_LINK.replace(
    "id",
    userId
  ).replace("timestamp", Date.now());

  mailList.map(async (m) => {
    await sendMail({
      from: `"Gemmint" ${process.env.EMAIL}`,
      to: m,
      subject: "Invitation",
      text: `${user.fullName} has invited you to join The Gem Mint Club!
                    It’s a free reward app for the trading card industry.
                    Spend money on trading cards and get rewarded! ${InvitationLink}
                    Referral Code: ${user.promoCode}`,
    });
  });

  res.status(200).send({ success: true, message: "Mails sent successfully" });
};

exports.addTickets = async (req, res, next) => {
  try {
    const userId = req?.auth?.data?.userId;
    const { tickets, id } = req.body;
    console.log("---------------------------");
    console.log(tickets);

    await User.findOne({
      where: {
        id: id,
      },
    })
      .then(async (user) => {
        if (user) {
          await user
            .update({
              tickets: parseInt("" + tickets) + parseInt("" + user.tickets),
            })
            .then((usr) => {
              if (usr) {
                return res.status(200).send({
                  success: true,
                  message: "tickets updated successfully",
                });
              }
            })
            .catch((err) => {
              console.log(err);
              return res.status(200).send({
                success: false,
                message: "Error while updating tickets : " + err.message,
              });
            });
        }
      })
      .catch((err) =>
        res.status(200).send({
          success: false,
          message: "Error occured : " + err.message,
        })
      );
  } catch (error) {
    res.status(500).send({
      message: "Internal Server Error",
      success: false,
    });
  }
};

exports.recordPayment = async (req, res, next) => {
  try {
    const userId = req?.auth?.data?.userId;
    const { payments, id } = req.body;
    console.log("---------------------------");
    console.log(payments);

    await User.findOne({
      where: {
        id: id,
      },
    })
      .then(async (user) => {
        if (user) {
          await user
            .update({
              payments: parseInt("" + payments) + parseInt("" + user.payments),
            })
            .then((usr) => {
              if (usr) {
                return res.status(200).send({
                  success: true,
                  message: "payments updated successfully",
                });
              }
            })
            .catch((err) => {
              console.log(err);
              return res.status(200).send({
                success: false,
                message: "Error while updating payments : " + err.message,
              });
            });
        }
      })
      .catch((err) =>
        res.status(200).send({
          success: false,
          message: "Error occured : " + err.message,
        })
      );
  } catch (error) {
    res.status(500).send({
      message: "Internal Server Error",
      success: false,
    });
  }
};

// Charts and Analytics in Dashboard

exports.viewUsersAcquired = async (req, res, next) => {
  const { isWeekly } = req.params;
  try {
    const users = await User.findAll({
      raw: true,
      where: {
        isApprovedInfluencer: false,
        isVerified: true,
      },
      attributes: ["id", "fullName", "membershipType", "createdAt"],
      include: [
        {
          model: PricingPlan,
          attributes: ["name"],
        },
      ],
    });

    const countWithPeriod = calculateWeeklyOrMonthlyCounts(users, isWeekly);

    return res.status(200).send({
      success: true,
      message: "Users Acquired Fetched Successfully",
      countWithPeriod,
    });
  } catch (err) {
    res.status(500).send({
      success: false,
      message: "Internal Server Error" + err,
    });
  }
  next();
};

exports.viewInfluencerReferrals = async (req, res, next) => {
  const { isWeekly } = req.params;

  try {
    const users = await User.findAll({
      raw: true,
      where: {
        isApprovedInfluencer: false,
        isVerified: true,
      },
      attributes: ["id", "fullName", "membershipType", "createdAt"],
      include: [
        {
          model: PricingPlan,
          attributes: ["name"],
          where: {
            price: {
              [Op.gt]: 0,
            },
            isDeleted: false,
          },
        },
      ],
    });

    // ids of all paying users
    const userIds = users.map((user) => user.id);

    const referredUsers = await UserReferral.findAll({
      attributes: ["referralCode", "receiverId"],
      where: {
        receiverId: userIds,
        referralCode: {
          [Op.like]: "I%", // To filter referralCode values that start with 'I' for influencer referrals
        },
      },
    });

    const payingReferredUsers = users.filter((user) => {
      return referredUsers.some(
        (referredUser) => referredUser.receiverId === user.id
      );
    });

    // console.log(
    //   "🗣👋💲 infuencer referred paid users are...",
    //   payingReferredUsers
    // );

    const countWithPeriod = calculateWeeklyOrMonthlyCounts(
      payingReferredUsers,
      isWeekly
    );

    return res.status(200).send({
      success: true,
      message: "Influencer Referrals Fetched Successfully",
      countWithPeriod,
    });
  } catch (err) {
    res.status(500).send({
      success: false,
      message: "Internal Server Error" + err,
    });
  }
  next();
};

exports.viewIncome = async (req, res, next) => {
  const { isWeekly } = req.params;

  try {
    const users = await User.findAll({
      raw: true,
      where: {
        isApprovedInfluencer: false,
        isVerified: true,
      },
      attributes: ["id", "fullName", "membershipType", "createdAt"],
      include: [
        {
          model: PricingPlan,
          attributes: ["name", "price"],
          where: {
            price: {
              [Op.gt]: 0,
            },
            isDeleted: false,
          },
        },
      ],
    });

    const incomeWithPeriod = calculateWeeklyOrMonthlyIncome(users, isWeekly);
    console.log("💹income with period is...", incomeWithPeriod);

    return res.status(200).send({
      success: true,
      message: "Income Fetched Successfully",
      incomeWithPeriod,
    });
  } catch (err) {
    res.status(500).send({
      success: false,
      message: "Internal Server Error" + err,
    });
  }
  next();
};
