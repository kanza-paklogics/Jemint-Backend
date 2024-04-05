const crypto = require("crypto");
const bcrypt = require("bcryptjs");
var jwt = require("jsonwebtoken");
const { Op, Sequelize } = require("sequelize");
const axios = require("axios");
const nodemailer = require("nodemailer");
const moment = require("moment");

const getUniquePromoCode = require("../../helpers/generateReferralCode");
const validator = require("validator");
const otpGenerator = require("otp-generator");
const sendMail = require("../../helpers/nodeMailer");
const User = require("../../models/User");
const Role = require("../../models/Role");
const Player = require("../../models/Player");
const UserReferral = require("../../models/UserReferral");
const UserApple = require("../../models/UserApple");

const DynamicLink = require("../../helpers/dynamicLinks");
const fetch = require("fetch");

var zlib = require("zlib");
var { google } = require("googleapis");

const { OAuth2Client } = require("google-auth-library");

const PricingPlan = require("../../models/PricingPlan");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
var accountSid = process.env.TWILIO_ACCOUNT_SID;
var authToken = process.env.TWILIO_AUTH_TOKEN;
console.log(accountSid, authToken);
// const client = require("twilio")(accountSid, authToken);
const Twilio = require("twilio");
const client = new Twilio(accountSid, authToken);
var paypal = require("paypal-rest-sdk");

const gateway = require("../middlewares/gateway");
var Twocheckout = require("2checkout-node");
const response = require("2checkout-node/lib/2checkout/response");
Role.hasMany(User, { foreignKey: "role_id" });
User.belongsTo(Role, { foreignKey: "role_id" });

//2Checkout setup
var tco = new Twocheckout({
  sellerId: "seller-id", // Seller ID, required for all non Admin API bindings
  privateKey: "private-key", // Payment API private key, required for checkout.authorize binding
});

paypal.configure({
  mode: "sandbox", //sandbox or live
  client_id:
    "AfJ9jXUjTZXv8ZpW--7sYjnQ2ADJ4QBt22VpaZznV7YX5pXop3Vt_EvKqYjGjHgptHFInJkwItg6z1VB",
  client_secret:
    "ENiP0NbsIwU3gYvcSgxg4U-hGLgC5ydSlUqwA3jQTpY1ttKgRyz5AXMbRg37DlCopfuuaxcFaJTDd46H",
});

// Define a function to extract the accessToken asynchronously
const extractAccessToken = async (headers, userID) => {
  try {
    const user = await User.findOne({
      where: {
        id: userID,
      },
    });
    const token = await jwt.sign(
      {
        data: { userId: user.dataValues.id, role: "User" },
      },
      process.env.JWT_TOKEN_KEY,
      { expiresIn: "2y", algorithm: "HS256" }
    );

    console.log("(extractAccessToken) Access token is ", token);
    return token; // Remove "Bearer " prefix
  } catch (err) {
    console.log("error in extractAccessToken", err);
    return res
      .status(500)
      .send({ success: false, message: "Something went wrong", err });
  }
};

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
        message: "Phone Number and Password is required",
      });
    }
    User.findOne({
      where: {
        phoneNo: req.body.phoneNo,
        countryCode: req.body.countryCode,
      },
      include: [{ model: PricingPlan }],
    })
      .then((user) => {
        if (user) {
          bcrypt
            .compare(req.body.password, user.password)
            .then(async (doMatch) => {
              if (doMatch) {
                // req.session.isLoggedIn = true;
                // req.session.user = .dataValues;
                // return req.session.save(err => {
                // 	console.log(err);
                // 	res.redirect('/');
                // });
                if (!user.dataValues.isVerified) {
                  return res.status(200).send({
                    success: false,
                    message:
                      "User verification is required, verify your number by clicking sent url and try again.",
                  });
                }
                // if (user.dataValues.isSuspended) {
                // 	return res.status(200).send({ success: false, message: 'You are suspended by admin' });
                // }
                const token = await jwt.sign(
                  {
                    data: { userId: user.dataValues.id, role: "User" },
                  },
                  process.env.JWT_TOKEN_KEY,
                  { expiresIn: "2y" }
                );

                const refreshToken = await jwt.sign(
                  {
                    data: { userId: user.dataValues.id, role: "User" },
                  },
                  process.env.JWT_REFRESH_TOKEN_KEY,
                  { expiresIn: "2y" }
                );
                const {
                  fullName,
                  id,
                  phoneNo,
                  countryCode,
                  points,
                  membershipType,
                } = user.dataValues;
                var number = countryCode + "" + phoneNo;

                return res.status(200).send({
                  success: true,
                  message: "Login successful.",
                  token,
                  refreshToken,
                  user,
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
            message: "No user found with this Phone Number",
          });
        }
      })
      .catch((err) => {
        console.log(err);
        return res.status(500).send({
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

exports.googleLogin = async (req, res, next) => {
  const googleclient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  const { idToken } = req.body;
  console.log("===> Inside google login...");

  await googleclient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  console.log("===> Inside google login...");

  await googleclient
    .verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    })

    .then(async (response) => {
      console.log("==> RESPONSE...", response.payload);
      console.log("==> RESPONSE...", response.payload);
      const { email_verified, name, email } = response.payload;
      if (email_verified) {
        await User.findOne({
          where: {
            email: email,
          },
          include: [{ model: PricingPlan }],
        })
          .then(async (user) => {
            //User Already Exists
            if (user) {
              const token = await jwt.sign(
                {
                  data: { userId: user.dataValues.id, role: "User" },
                },
                process.env.JWT_TOKEN_KEY,
                { expiresIn: "2y" }
              );

              const refreshToken = await jwt.sign(
                {
                  data: { userId: user.dataValues.id, role: "User" },
                },
                process.env.JWT_REFRESH_TOKEN_KEY,
                { expiresIn: "2y" }
              );

              // const { fullName, id, phoneNo, countryCode, points, planId } =
              //   user.dataValues;
              // var number = countryCode + "" + phoneNo;

              return res.status(200).send({
                success: true,
                message: "Login successful.",
                token,
                refreshToken,
                user,
                alreadyExists: true,
                isEmail: true,
              });
            }
            //User not exists
            else {
              return res.status(200).send({
                success: true,
                message: "Need to send phone number",
                alreadyExists: false,
                isEmail: true,
              });
            }
          })
          .catch((err) => {
            return res
              .status(400)
              .send({ success: false, message: "Some Error happend" });
          });
      } else {
        return res.status(400).send({
          message: "Email not verified from Google",
          success: false,
        });
      }
    })
    .catch((err) =>
      res.status(400).send({
        message: "please try again",
        success: false,
      })
    );
};

exports.AppleLogin = async (req, res, next) => {
  const { idToken, appleId } = req.body;

  try {
    console.log("===> Inside apple login...");
    const email =
      idToken === null
        ? null
        : jwt.decode(idToken).email == undefined
        ? null
        : jwt.decode(idToken).email;

    console.log("--> email: ", email);

    if (email === null) {
      await UserApple.findOne({
        where: {
          appleId: appleId,
        },
      }).then(async (user) => {
        if (user) {
          console.log("--> user found by appleid: ", user);
          await User.findOne({
            where: {
              id: user.userId,
            },
          }).then(async (rec) => {
            if (rec) {
              console.log("--> user id found by appleid: ", rec.id);
              const token = await jwt.sign(
                {
                  data: { userId: rec.id, role: "User" },
                },
                process.env.JWT_TOKEN_KEY,
                { expiresIn: "2y" }
              );
              console.log("--> Token: ", token);

              const refreshToken = await jwt.sign(
                {
                  data: { userId: rec.id, role: "User" },
                },
                process.env.JWT_REFRESH_TOKEN_KEY,
                { expiresIn: "2y" }
              );
              console.log("--> refreshToken: ", refreshToken);

              return res.status(200).send({
                success: true,
                message: "Login successful.",
                token,
                refreshToken,
                rec,
                alreadyExists: true,
                isEmail: true,
              });
            }
          });
        } else {
          res.status(200).send({
            success: true,
            message: "New User.. Email and phone number is Needed",
            alreadyExists: false,
            isEmail: true,
          });
        }
      });
    } else {
      await UserApple.findOne({
        where: {
          appleId: appleId,
        },
      }).then(async (appleuser) => {
        if (appleuser) {
          await User.findOne({
            where: {
              id: appleuser.dataValues.userId,
            },
          }).then(async (user) => {
            const token = await jwt.sign(
              {
                data: { userId: user.dataValues.id, role: "User" },
              },
              process.env.JWT_TOKEN_KEY,
              { expiresIn: "2y" }
            );

            const refreshToken = await jwt.sign(
              {
                data: { userId: user.dataValues.id, role: "User" },
              },
              process.env.JWT_REFRESH_TOKEN_KEY,
              { expiresIn: "2y" }
            );

            return res.status(200).send({
              success: true,
              message: "Login successful.",
              token,
              refreshToken,
              user,
              alreadyExists: true,
              isEmail: true,
            });
          });
        } else {
          await User.findOne({
            where: {
              email,
            },
          })
            .then(async (user) => {
              if (user) {
                const token = await jwt.sign(
                  {
                    data: { userId: user.dataValues.id, role: "User" },
                  },
                  process.env.JWT_TOKEN_KEY,
                  { expiresIn: "2y" }
                );

                const refreshToken = await jwt.sign(
                  {
                    data: { userId: user.dataValues.id, role: "User" },
                  },
                  process.env.JWT_REFRESH_TOKEN_KEY,
                  { expiresIn: "2y" }
                );

                return res.status(200).send({
                  success: true,
                  message: "Login successful.",
                  token,
                  refreshToken,
                  user,
                  alreadyExists: true,
                  isEmail: true,
                });
              } else {
                return res.status(200).send({
                  success: true,
                  message: "Need to send phone number",
                  alreadyExists: false,
                  isEmail: true,
                });
              }
            })
            .catch((err) =>
              res
                .status(400)
                .send({ message: "Some Error occured", success: false })
            );
        }
      });
    }
  } catch (err) {
    res.status(500).send({ message: "Internal Server Error" });
  }
};

exports.toggleTutorialCompletion = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log("toggleTutorialCompletion ID...", id);
    const user = await User.findOne({ where: { id: id } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    // Set the "hasCompletedTutorial" field to true
    user.hasCompletedTutorial = true;
    await user.save();

    return res
      .status(200)
      .json({ message: "Tutorial completion status updated" });
  } catch (error) {
    next(error);
  }
};

// Google sign up
exports.userData = async (req, res, next) => {
  try {
    await User.findOne({
      where: {
        phoneNo: req.body.phoneNo,
      },
    }).then(async (user) => {
      if (user) {
        res
          .status(200)
          .send({ success: false, message: "Phone Number already exists" });
      } else {
        const promoCode = await getUniquePromoCode();
        console.log(`---> promoCode: ${promoCode}`);

        const userGoogle = new User({
          fullName: req.body.fullName,
          countryCode: req.body.countryCode,
          phoneNo: req.body.phoneNo,
          password: process.env.JWT_TOKEN_KEY + req.body.email,
          email: req.body.email,
          isVerified: true,
          promoCode,
          membershipType: 1,
          isEmail: true,
        });

        userGoogle
          .save()
          .then(async (user) => {
            const token = await jwt.sign(
              {
                data: { userId: user.dataValues.id, role: "User" },
              },
              process.env.JWT_TOKEN_KEY,
              { expiresIn: "2y" }
            );

            const refreshToken = await jwt.sign(
              {
                data: { userId: user.dataValues.id, role: "User" },
              },
              process.env.JWT_REFRESH_TOKEN_KEY,
              { expiresIn: "2y" }
            );
            return res.status(200).send({
              success: true,
              message: "Login successful.",
              token,
              refreshToken,
              user,
              isEmail: false,
            });
          })
          .catch((err) => {
            return res.status(400).send({
              success: false,
              message: "Login not successful.",
            });
          });
      }
    });
  } catch (err) {
    return res.status(500).send({
      message: "Internal Server Error",
      success: false,
    });
  }
};

// Apple sign up
exports.appleuserdata = async (req, res, next) => {
  try {
    console.log("ENtered");
    await User.findOne({
      where: {
        [Op.or]: [{ phoneNo: req.body.phoneNo }, { email: req.body.email }],
      },
    })
      .then(async (u) => {
        if (u) {
          return res.status(400).send({
            message:
              "Phone/email already registered; Please enter unique phone number  and email",
            success: false,
          });
        } else {
          await UserApple.findOne({
            where: {
              appleId: req.body.appleId,
            },
          }).then(async (user) => {
            console.log("Here");
            if (user) {
              return res.status(200).send({
                message:
                  "User already exists with given Apple ID , Please Login",
                success: false,
              });
            } else {
              const promoCode = await getUniquePromoCode();
              console.log(`---> promoCode: ${promoCode}`);

              await User.create({
                fullName: req.body.fullName,
                countryCode: req.body.countryCode,
                phoneNo: req.body.phoneNo,
                password: process.env.JWT_TOKEN_KEY + req.body.email,
                email: req.body.email,
                isVerified: true,
                promoCode,
                membershipType: 1,
                isEmail: true,
              })
                .then(async (usr) => {
                  console.log("Here33");
                  console.log("Usr is :", usr);
                  await UserApple.create({
                    userId: usr.dataValues.id,
                    appleId: req.body.appleId,
                  })
                    .then(async () => {
                      const token = await jwt.sign(
                        {
                          data: { userId: usr.dataValues.id, role: "User" },
                        },
                        process.env.JWT_TOKEN_KEY,
                        { expiresIn: "2y" }
                      );

                      const refreshToken = await jwt.sign(
                        {
                          data: { userId: usr.dataValues.id, role: "User" },
                        },
                        process.env.JWT_REFRESH_TOKEN_KEY,
                        { expiresIn: "2y" }
                      );
                      return res.status(200).send({
                        success: true,
                        message: "Login successful.",
                        token,
                        refreshToken,
                        user: usr,
                        isEmail: true,
                      });
                    })
                    .catch((err) => {
                      console.log("---------------------------rrr", err);
                      return res.status(400).send({
                        message: "Error creating apple user",
                        success: false,
                      });
                    });
                })
                .catch((err) => console.log("Error here", err));
            }
          });
        }
      })
      .catch((err) => {
        console.log(err);
        res.status(400).send({ message: "some error occured", success: false });
      });
  } catch (err) {
    console.log("Errrrrrrrrr:  ", err);
    return res.status(500).send({
      message: "Internal Server Error",
      success: false,
    });
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

exports.signUp = async (req, res, next) => {
  console.log("===> In signUp...");
  console.log("---> phoneNo is...", req?.body?.phoneNo);
  var length = req?.body?.phoneNo?.toString()?.length;
  if (length >= 8 && length <= 16) {
  } else {
    res.status(422).json({
      success: false,
      message: "Number of characters should be 8-16",
    });
  }
  if (!req.body.email) {
    res.status(422).send({
      success: false,
      message: "Email must be provided",
    });
  }
  try {
    const userExists = await User.findOne({
      where: {
        [Op.or]: [{ phoneNo: req.body.phoneNo }, { email: req.body.email }],
      },
    });

    console.log("User Existsssss : ", userExists);

    if (userExists) {
      if (!userExists.isVerified) {
        var message = `Enter This OTP ${userExists.verificationToken} to verify your account`;
        var number = userExists.countryCode + "" + userExists.phoneNo;
        client.messages
          .create({
            body: message,
            to: `+${number}`,
            from: process.env.TWILIO_NUMBER,
          })
          .then(async (message) => {
            return res.status(200).send({
              success: true,
              message:
                "User is already Registered but not yet verified. OTP Sent Successfully",
              resendOtp: true,
            });
          })
          .catch((err) => {
            console.log("---> Error in twilio is...", err);
            return res
              .status(200)
              .send({ success: false, message: "Error in sending message" });
          });
        // // Remove following response when twillio is activated
        // return res.status(200).send({
        //   success: false,
        //   message: "User Already Exists but not verified",
        // });
      } else {
        return res.status(200).send({
          success: false,
          message: "Already verified user. Please Login",
        });
      }
    } else {
      const hashedPassword = await bcrypt.hash(req.body.password, 12);
      const verificationToken = otpGenerator.generate(4, {
        digits: true,
        lowerCaseAlphabets: false,
        upperCaseAlphabets: false,
        specialChars: false,
      });
      console.log("---> verificationToken", verificationToken);
      // promoCode is own referral code, referralCode is from the one who referred
      const promoCode = await getUniquePromoCode();
      console.log(`---> promoCode: ${promoCode}`);
      const referralCode = req.body.referralCode;
      console.log(`---> referralCode: ${referralCode}`);

      if (referralCode === null || referralCode === "") {
        console.log("---> In case of no referralCode...");
        console.log("---> creating user...");
        await User.create({
          fullName: req.body.fullName,
          countryCode: req.body.countryCode,
          phoneNo: req.body.phoneNo,
          password: hashedPassword,
          verificationToken,
          email: req.body.email,
          membershipType: 1,
          promoCode,
          isEmail: false,
        });

        var message = `Enter This OTP ${verificationToken} to verify your account`;
        var number = req.body.countryCode + "" + req.body.phoneNo;
        // // twilio response flow
        client.messages
          .create({
            body: message,
            to: `+${number}`,
            from: process.env.TWILIO_NUMBER,
          })
          .then(async (message) => {
            return res.status(200).send({
              success: true,
              message:
                "User created successfully and message is sent successfully",
            });
          })
          .catch((err) => {
            res
              .status(200)
              .send({ success: false, message: "message not sent." });
          });
        // // Remove following response when twillio is activated
        // return res.status(200).send({
        //   success: true,
        //   message: "User created successfully",
        // });
      } else {
        console.log("---> In case of given referralCode...");
        await User.findOne({
          where: {
            promoCode: referralCode,
          },
        }).then(async (referral) => {
          if (referral) {
            await User.create({
              fullName: req.body.fullName,
              countryCode: req.body.countryCode,
              phoneNo: req.body.phoneNo,
              password: hashedPassword,
              verificationToken,
              email: req.body.email,
              membershipType: 1,
              promoCode,
              tickets: 1, // Ticket awarded to new referred user
              isEmail: false,
            }).then(async (newUser) => {
              referral.referralCount += 1;
              await referral.save();
              await UserReferral.create({
                senderId: referral.id,
                receiverId: newUser.id,
                receiverPhoneNo: newUser.phoneNo,
                receiverEmail: newUser.email,
                referralCode: referral.promoCode,
              })
                .then(() => {
                  //send otp Twillio
                  var message = `Enter This OTP ${newUser.verificationToken} to verify your account`;
                  var number = req.body.countryCode + "" + req.body.phoneNo;
                  client.messages
                    .create({
                      body: message,
                      to: `+${number}`,
                      from: process.env.TWILIO_NUMBER,
                    })
                    .then(async (message) => {
                      return res.status(200).send({
                        success: true,
                        message:
                          "Referred User created successfully and message is sent successfully",
                      });
                    })
                    .catch((err) => {
                      console.log(err.message);
                      res.status(200).send({
                        success: false,
                        message: "message not sent.",
                      });
                    });
                  // // Remove following response when twillio is activated
                  // return res.status(200).send({
                  //   success: true,
                  //   message: "Referred User created successfully",
                  // });
                })
                .catch((error) => {
                  throw error;
                });
            });
          } else {
            res.status(400).send({
              success: false,
              message: "Referral code is incorrect",
            });
          }
        });
      }
    }
  } catch (error) {
    res.status(500).send({ success: false, message: "Internal Server Error" });
  }
};

exports.resendOtp = async (req, res) => {
  try {
    var user = await User.findOne({
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
    const val = Math.floor(1000 + Math.random() * 9000);
    console.log(val);
    otp = val;
    const number = user.countryCode + "" + user.phoneNo;
    console.log("numberrr: ", number);
    //Sending verify OTP to user number
    await client.messages
      .create({
        body: `Enter This OTP ${otp} to verify your account`,
        to: `+${number}`,
        from: process.env.TWILIO_NUMBER,
      })
      .then(async (message) => {
        console.log(message);
        //Attaching otp to request document so we could verify on order completion
        const updatedUser = await User.update(
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
          message: "OTP Resent",
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
    const user = await User.findOne({
      where: {
        verificationToken: req.body.otp,
      },
    });

    if (user) {
      console.log(`---> New User id: ${user.id}`);
      const result = await user.update({
        isVerified: true,
        verificationToken: null,
      });

      if (result) {
        const referral = await UserReferral.findOne({
          where: {
            receiverId: result.id,
          },
        });

        if (referral) {
          console.log(`---> Referral sender id is: ${referral.senderId}`);
          const referralUser = await User.findOne({
            where: {
              id: referral.senderId,
            },
          });

          console.log("---> Referral user object...", referralUser);
          console.log(
            `---> Referral tickets before are: ${referralUser.dataValues.tickets}`
          );
          referralUser.tickets += 1;
          await referralUser.save();
        }
        const accessToken = await extractAccessToken(req.headers, user.id);

        return res.status(200).send({
          success: true,
          message: "User is Verified",
          accessToken,
          user,
        });
      } else {
        return res.status(400).send({
          success: false,
          message: "User Couldn't Be Verified",
        });
      }
    } else {
      return res
        .status(400)
        .send({ success: false, message: "Wrong Verification OTP" });
    }
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
    // console.log("length", req.body.phoneNo.toString().length);

    var length = req.body.phoneNo.toString().length;
    if (length >= 6 && length <= 12) {
    } else {
      res.status(422).json({
        success: false,
        message: "Number digits should be 6-12",
      });
    }

    User.findOne({
      where: {
        countryCode: req.body.countryCode,
        phoneNo: req.body.phoneNo,
      },
    })
      .then(async (user) => {
        if (user) {
          var otp = otpGenerator.generate(4, {
            digits: true,
            lowerCaseAlphabets: false,
            upperCaseAlphabets: false,
            specialChars: false,
          });
          console.log("otp ", otp);
          user.resetToken = otp;
          user.resetTokenExpiry = Date.now() + 3600000;
          const userSave = await user.save();
          if (!userSave) {
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
              return res.status(200).send({
                success: true,
                message: "Forget Passoword OTP has been sent to your number",
              });
            })
            .catch((error) => console.log(error));
        } else {
          res.status(404).send({
            message: "User Not Exists On This Number",
            success: !!user,
          });
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
exports.updateUser = async (req, res, next) => {
  try {
    console.log(req.body);
    console.log(req.auth);
    console.log(req.params);
    const userId = req?.auth?.data?.userId;
    console.log("userId ", userId);

    const user = await User.findOne({ where: { id: userId }, raw: true });
    if (!user) {
      return res.status(404).send({
        success: false,
        message: "User Not Found",
      });
    }
    var encryptedPassword;
    if (req.body.password) {
      await bcrypt.hash(req.body.password, 12).then(async (hashedPassword) => {
        console.log("hashedPassword ", hashedPassword);
        encryptedPassword = hashedPassword;
      });
    }
    const updatedUser = await User.update(
      {
        password: encryptedPassword ? encryptedPassword : user.password,
        fullName: req.body.fullName ? req.body.fullName : user.fullName,
      },
      {
        where: { id: userId },
      }
    );
    console.log("updatedUser ", updatedUser);
    if (updatedUser[0] > 0) {
      return res.status(200).send({
        success: true,
        message: "User Updated",
        updatedOrder: updatedUser,
      });
    } else {
      return res.status(404).send({
        success: false,
        message: "User Not Updated",
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
    User.findOne({
      where: {
        resetToken: verificationToken,
      },
    })
      .then(async (user) => {
        if (!user) {
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
    User.findOne({
      where: {
        resetToken: verificationToken,
      },
    })
      .then(async (user) => {
        if (!user) {
          res.status(404).send({ success: false, message: "Wrong Token" });
        }
        return bcrypt.hash(password, 12).then(async (hashedPassword) => {
          let result = await user.update({
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
exports.viewPackages = async (req, res, next) => {
  try {
    console.log(req.body);
    console.log(req.auth);
    const userId = req?.auth?.data?.userId;
    console.log("userId ", userId);

    const packages = await PricingPlan.findAll({
      where: {
        isDeleted: false,
      },
      raw: true,
    });
    console.log("packages ", packages);
    if (packages.length > 0) {
      return res.status(200).send({
        success: true,
        message: "Packages Found",
        packages: packages,
      });
    } else {
      return res.status(404).send({
        success: false,
        message: "Packages Not Found",
      });
    }
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};
exports.getUser = async (req, res) => {
  try {
    const userId = req?.auth?.data?.userId;
    console.log({ userId });
    const user = await User.findOne({
      where: {
        id: userId,
      },
      include: [
        {
          model: Role,
          required: false,
        },
        {
          model: PricingPlan,
        },
      ],
    });
    console.log("user is ", user);
    if (user) {
      res.status(200).send({ success: true, message: "User Found", user });
    } else {
      res.status(404).send({ success: false, message: "User NOT Found" });
    }
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};

exports.createPaymentIntent = async (req, res) => {
  try {
    console.log(req.auth);
    const userId = req?.auth?.data?.userId;
    console.log("userId ", userId);
    const user = await User.findOne({ where: { id: userId }, raw: true });
    const plan = await PricingPlan.findOne({
      where: { id: req.body.planId },
      raw: true,
    });
    console.log("user ", user);
    console.log("plan ", plan);
    if (!user) {
      return res.status(400).send({
        success: false,
        message: "User Doesn't Exists By This Token",
      });
    }
    let phoneNo = user.phoneNo;
    // create charge
    const paymentIntent = await stripe.paymentIntents.create({
      amount: plan.price * 100,
      currency: "USD",
      description: "Customer Payment",
    });
    console.log(paymentIntent);
    return res.status(200).send({
      success: true,
      message: "Payment has been made",
      paymentIntent: paymentIntent,
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
exports.payThroughCheckout = async (req, res) => {
  try {
    const plan = await PricingPlan.findOne({
      where: { id: req.body.planId },
      raw: true,
    });
    console.log(req.auth);
    const userId = req?.auth?.data?.userId;
    console.log("userId ", userId);
    if (plan) {
      var params = {
        merchantOrderId: userId,
        token: req.body.token,
        currency: "USD",
        total: plan.price,
        billingAddr: {
          name: "Testing Tester",
          addrLine1: "123 Test St",
          city: "Columbus",
          state: "Ohio",
          zipCode: "43123",
          country: "USA",
          email: "example@2co.com",
          phoneNumber: "5555555555",
        },
      };

      tco.checkout.authorize(params, function (error, data) {
        if (error) {
          response.send(error.message);
        } else {
          console.log(data.response.responseMsg);
          return res.status(200).send({
            success: true,
            message: "Payment Done",
          });
        }
      });
    } else {
      return res.status(400).send({
        success: false,
        message: "Plan Doesn't Exists",
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
//paypal payments
exports.paypalPayments = (req, res, next) => {
  try {
    var create_payment_json = {
      intent: "sale",
      payer: {
        payment_method: "paypal",
      },
      redirect_urls: {
        return_url: "http://return.url",
        cancel_url: "http://cancel.url",
      },
      transactions: [
        {
          item_list: {
            items: [
              {
                name: "item",
                sku: "item",
                price: "150.00",
                currency: "MYR",
                quantity: 1,
              },
            ],
          },
          amount: {
            currency: "MYR",
            total: "150.00",
          },
          description: "This is the payment description.",
        },
      ],
    };

    paypal.payment.create(create_payment_json, function (error, payment) {
      if (error) {
        throw error;
      } else {
        console.log("Create Payment Response");
        console.log(payment);
        res.status(200).send({
          success: true,
          message: "payment intent created",
          data: payment,
        });
      }
    });
  } catch (err) {
    console.log("error is ", error);
  }
};

exports.getVenmoToken = (req, res, next) => {
  try {
    gateway.clientToken
      .generate({})
      .then((response) => {
        res.status(200).send(response);
      })
      .catch((err) => res.status(500).send(err));
  } catch (err) {
    res.status(400).send("server error");
  }
};
exports.payThroughVenmo = async (req, res) => {
  try {
    const plan = await PricingPlan.findOne({
      where: { id: req?.body.planId },
      raw: true,
    });
    console.log("plan is", plan);

    const nonce = req.body.nonceFromClient;
    const userId = req?.auth?.data?.userId;

    User.findOne({
      where: {
        id: userId,
      },
    }).then((user) => {
      console.log("plan from user(membershipType) ", user.membershipType);
      console.log("plan enterteed is ", plan.id);
      if (user.membershipType !== plan.id) {
        if (plan && plan.id != 1) {
          var params = {
            amount: plan.price,
            paymentMethodNonce: nonce,
            options: {
              submitForSettlement: true,
            },
            // // deviceData: req.body.device_data,
            customer: {
              id: 1,
              firstName: "Irtaza",
              lastName: "Syed",
              company: "xyz company",
              email: "someone@example.com",
              website: "google.com",
              phone: "1234568",
            },
            customer: {
              id: 1,
              firstName: "Irtaza",
              lastName: "Syed",
              company: "xyz company",
              email: "someone@example.com",
              website: "google.com",
              phone: "1234568",
            },
          };

          gateway.transaction
            .sale(params)
            .then((result) => {
              console.log("payment Object is ", result);
              if (result.success === true) {
                res
                  .status(200)
                  .json({ success: true, message: "Payment Succesful" });
              } else if (result.success === false) {
                res
                  .status(401)
                  .json({ success: false, message: "Payment Unsuccesful" });
              }
            })
            .catch((err) => {
              console.log("");
              console.log(err, "Payment Unsucessful ", err);
            });
        } else {
          return res.status(400).send({
            success: false,
            message: "Payment invalid for this plan",
          });
        }
      } else {
        res.status(401).send({
          success: false,
          message: "You are already using this package",
        });
      }
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .send({ success: false, message: "Something went wrong", err });
  }
};

exports.switchPackage = async (req, res, next) => {
  console.log("===> in switchPackage...");
  try {
    console.log("req.body: ", req.body);
    const userId = req?.auth?.data?.userId;
    let expiresDate;

    if (req?.body?.planId === 40) {
      expiresDate = moment().add(30, "days").toDate();
    } else if (req?.body?.planId === 41) {
      expiresDate = moment().add(365, "days").toDate();
    }
    User.findOne({
      where: {
        id: userId,
      },
    })
      .then(async (user) => {
        if (user.membershipType) {
          if (user.membershipType != req.body.planId) {
            // res.redirect(process.env.VERIFY_RETURN_URL_FAIL)
            let result = await user.update({
              membershipType: req.body.planId,
              expiresDate,
            });

            console.log("result ", result);
            res
              .status(200)
              .json({ success: true, message: "Package Has Been Bought " });
            //res.status(200).send({ status: true, user: { fullName, id, email,role:user.Role } })
          } else {
            //res.status(200).send({ status: false, user: null,message:"User not found" })
            res.status(400).json({
              success: false,
              message:
                "You Already Brought This Package or package does not exist",
            });
          }
        } else {
          // let result = await user.update({ planId: req.body.planId });
          let result = await user.update({
            membershipType: req.body.planId,
            expiresDate,
          });
          console.log("result ", result);
          res
            .status(200)
            .json({ success: true, message: "Package Has Been Bought" });
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

exports.revertToBase = async (req, res, next) => {
  console.log("===> in revertToBase...");
  try {
    console.log("req.body: ", req.body);
    const userId = req?.auth?.data?.userId;
    const user = await User.findOne({
      where: {
        id: userId,
      },
    });
    if (user && user.membershipType !== 1) {
      await user.update({
        membershipType: 1,
        expiresDate: null,
      });
      return res.status(200).json({
        success: true,
        message: "Member Has Been Downgraded To Free ",
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "User not found or already has a free membership",
      });
    }
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ success: false, message: "Something went wrong", err });
  }
};

exports.downgradeToBase = async (req, res, next) => {
  console.log("===> in downgradeToBase...");
  try {
    console.log("req.body: ", req.body);
    // const userId = req?.auth?.data?.userId;
    const { userId } = req.body;
    const user = await User.findOne({
      where: {
        id: userId,
      },
    });
    if (user && user.membershipType !== 1) {
      await user.update({
        membershipType: 1,
        expiresDate: null,
      });
      return res.status(200).json({
        success: true,
        message: "Member Has Been Downgraded To Free ",
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "User not found or already has a free membership",
      });
    }
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ success: false, message: "Something went wrong", err });
  }
};

exports.sendSupportMessage = async (req, res) => {
  try {
    let { name, email, message } = req?.body;
    const nodemailer = require("nodemailer");
    var subject = `Support Message from ${name}`;
    var html = `Support message   ${message}`;

    async function sendEmail(email, message, html) {
      console.log("sending email");
      var response;
      let transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL,
          pass: process.env.PASSWORD,
        },
      });
      let mailOptions = {
        from: email,
        replyTo: email,
        to: "Support@thegemmintclub.com",
        subject: subject,
        html: html,
      };
      await transporter
        .sendMail(mailOptions)
        .then((data) => {
          console.log("data ", data);
          response = true;
        })
        .catch((err) => {
          console.log("err ", err);
          response = false;
        });
      return response;
    }
    var emailResponse = await sendEmail(email, message, html);
    if (emailResponse) {
      res
        .status(200)
        .json({ success: true, message: "Email sent succesfully" });
    } else {
      res.status(400).json({ success: false, message: "Email not sent" });
    }
    console.log("email resposne is", emailResponse, "message is", message);
  } catch (err) {
    console.log(err, "error message");
    return res
      .status(500)
      .send({ success: false, message: "Something went wrong", err });
  }
};

exports.updatePassword = async (req, res, next) => {
  try {
    console.log(req.body);
    console.log(req.auth);
    console.log(req.params);
    const userId = req?.auth?.data?.userId;
    console.log("userId ", userId);

    const user = await User.findOne({ where: { id: userId }, raw: true });
    if (!user) {
      return res.status(404).send({
        success: false,
        message: "User Not Found",
      });
    }
    bcrypt
      .compare(req.body.oldPassword, user.password)
      .then(async (doMatch) => {
        if (doMatch) {
          var encryptedPassword;
          if (req.body.newPassword) {
            await bcrypt
              .hash(req.body.newPassword, 12)
              .then(async (hashedPassword) => {
                console.log("hashedPassword ", hashedPassword);
                encryptedPassword = hashedPassword;
              });
          }
          const updatedUser = await User.update(
            {
              password: encryptedPassword ? encryptedPassword : user.password,
            },
            {
              where: { id: userId },
            }
          );
          console.log("updatedUser ", updatedUser);
          if (updatedUser[0] > 0) {
            return res.status(200).send({
              success: true,
              message: "Password Updated",
              updatedOrder: updatedUser,
            });
          } else {
            return res.status(404).send({
              success: false,
              message: "Password Not Updated",
            });
          }
        } else {
          return res.status(400).send({
            success: false,
            message: "Wrong Old Password",
          });
        }
      });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};

exports.switchMembership = async (req, res) => {
  console.log("===> in switchMembership...");
  try {
    const { planId, userId } = req.body;
    console.log(`---> Plan id is ${planId} and user id is ${userId}`);
    let expiresDate;

    if (req?.body?.planId === 40) {
      expiresDate = moment().add(30, "days").toDate();
    } else if (req?.body?.planId === 41) {
      expiresDate = moment().add(365, "days").toDate();
    }
    const plan = await PricingPlan.findOne({
      where: {
        id: planId,
      },
    });

    if (plan) {
      console.log("plan is ", plan.id);
      const user = await User.findOne({
        where: {
          id: userId,
        },
        attributes: ["id", "fullName", "phoneNo", "membershipType"],
        include: [
          {
            model: PricingPlan,
            attributes: ["id", "name", "price"],
          },
        ],
      });
      if (user) {
        console.log("user is ", user.id);
        await User.update(
          { membershipType: plan.id, expiresDate },
          { where: { id: userId } }
        );
        res
          .status(200)
          .send({ success: true, message: "Plan Updated Successfully", user });
      } else {
        res.status(402).send({ success: false, message: "User not found" });
      }
    } else {
      res.status(402).send({ success: false, message: "Plan not found" });
    }
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .send({ success: false, message: "Internal Server error", err });
  }
};

exports.inviteUser = async (req, res) => {
  console.log("===> inviteUser called");
  try {
    const phoneNumber = req.body.phoneNumber;
    console.log("---> Phone Number(to be sent promo code):", phoneNumber);
    const userId = req?.auth?.data?.userId;

    const user = await User.findOne({ where: { id: userId } });
    console.log("---> User name(who is inviting) is:", user.fullName);
    console.log("---> Promo code is:", user.promoCode);

    const formattedPhoneNo = phoneNumber.replace(/\s/g, "").replace("+", "");

    const userExists = await User.findOne({
      where: Sequelize.literal(
        `CONCAT(countryCode, phoneNo) = '${formattedPhoneNo}'`
      ),
    });

    if (!userExists) {
      await client.messages
        .create({
          body: `${user.fullName} invited you: ${process.env.REFERRAL_LINK}\nReferral Code: ${user.promoCode}`,
          to: phoneNumber,
          from: process.env.TWILIO_NUMBER,
        })
        .then(() => {
          console.log("---> Twilio message sent successfully");
          return res
            .status(200)
            .send({ success: true, message: "Message is sent" });
        })
        .catch((err) => {
          console.error("---> Error sending Twilio message:", err);
          return res
            .status(400)
            .send({ success: false, message: "Message not sent" });
        });
    } else {
      console.error(
        "---> User already exists with given phone number:",
        phoneNumber
      );
      // throw new Error("User already exists");
      return res
        .status(405)
        .send({ success: false, message: "User already exists" });
    }
  } catch (err) {
    console.error("---> Error in inviteUser:", err);
    res.status(500).send({ success: false, message: "Internal Server Error" });
  }
};
