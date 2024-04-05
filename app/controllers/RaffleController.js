const crypto = require("crypto");
const bcrypt = require("bcryptjs");
var jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
// const nodemailer = require("nodemailer");
const validator = require("validator");
const User = require("../../models/User");
const Raffle = require("../../models/Raffle");
const RaffleBuyer = require("../../models/RaffleBuyers");
const Receipt = require("../../models/Receipt");
const PricingPlan = require("../../models/PricingPlan");
const sendMail = require("../../helpers/nodeMailer");
const { date } = require("@hapi/joi");
User.hasMany(RaffleBuyer, { foreignKey: "userId" });
RaffleBuyer.belongsTo(User, { foreignKey: "userId" });
Raffle.hasMany(RaffleBuyer, { foreignKey: "raffleId" });
RaffleBuyer.belongsTo(Raffle, { foreignKey: "raffleId" });
const moment = require("moment-timezone");
const { findOne } = require("domutils");

exports.viewRaffle = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log(req.body);
    console.log(req.auth);
    const userId = req?.auth?.data?.userId;
    console.log("userId ", userId);
    const user = await User.findOne({ where: { id: userId }, raw: true });
    console.log("user ", user);
    const raffle = await Raffle.findOne({
      where: { id: id },
      raw: true,
      include: [{ User }, { PricingPlan }],
    });
    if (raffle) {
      return res.status(200).send({
        success: true,
        raffle: raffle,
        message: "Raffle Is Found",
      });
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

// exports.allRaffles = async (req, res, next) => {
//   try {
//     const userId = req?.auth?.data?.userId;
//     console.log("userId");

//   } catch (err) {
//     console.log(err);
//     res
//       .status(500)
//       .send({ success: false, message: "Internal Server Error", err });
//   }
// };

exports.myRaffles = async (req, res, next) => {
  console.log("MY RAffles API");
  try {
    console.log(req.body);
    console.log(req.auth);
    const userId = req?.auth?.data?.userId;
    console.log("userId ", userId);

    const raffles = await RaffleBuyer.findAll({
      raw: true,
      where: { userId: userId },

      include: [
        {
          model: Raffle,
          include: [{ model: PricingPlan }],
          order: [["pricing_plan", "price", "ASC"]],
        },
      ],
      // order: [["", "id", "desc"]],
    });
    // console.log("raffles ", raffles);
    let myRafflesIds = [];
    for (let i = 0; i < raffles.length; i++) {
      myRafflesIds.push(raffles[i].raffleId);
    }
    console.log("myRafflesIds ", myRafflesIds);
    const myRaffles = await Raffle.findAll({
      raw: true,
      where: { id: { [Op.in]: myRafflesIds } },
      include: [{ model: PricingPlan, attributes: ["id", "name", "price"] }],
    });
    // console.log("myRaffles 89", myRaffles);
    var newRaffles = [];
    for (let i = 0; i < myRaffles.length; i++) {
      var raffle = myRaffles[i];
      // console.log("raffle.raffleId ", raffle.id);
      const usersRaffles = await RaffleBuyer.findAll({
        attributes: ["raffleId"],
        raw: true,
        where: { raffleId: raffle.id, userId: userId },
      });
      console.log("usersRaffles ", usersRaffles);
      // console.log("raffles at 100", raffle);
      await newRaffles.push({
        ...raffle,
        totalEntries: usersRaffles.length,
      });
    }
    if (myRaffles.length > 0) {
      return res.status(200).send({
        success: true,
        message: "Raffles Of User Found",
        myRaffles: newRaffles,
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

exports.userRaffles = async (req, res) => {
  console.log("USER RAFFLES API");
  try {
    console.log(req.body);
    console.log(req.auth);
    const userId = req?.auth?.data?.userId;

    const user = await User.findOne({
      where: {
        id: userId,
      },
    });
    const raffles = await Raffle.findAll({
      where: {
        raffleType: user.membershipType,
      },
    });
    if (raffles) {
      res
        .status(200)
        .send({ success: true, message: "Raffles Found", raffles });
    } else {
      res.status(404).send({ success: false, message: "No Raffles Found" });
    }
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};

exports.availableRaffles = async (req, res, next) => {
  console.log("AVAILABLE RAFFLES API");
  try {
    console.log(req.body);
    console.log(req.auth);
    const userId = req?.auth?.data?.userId;
    console.log("userId ", userId);
    const raffles = await Raffle.findAll({
      raw: true,
      where: { status: "Active" },
      include: [{ model: PricingPlan, attributes: ["id", "name", "price"] }],
      order: [["pricing_plan", "price", "ASC"]],
    });
    // console.log("raffles ", raffles);
    var newRaffles = [];
    for (let i = 0; i < raffles.length; i++) {
      var raffle = raffles[i];
      // console.log("raffle.raffleId ", raffle.id);
      const usersRaffles = await RaffleBuyer.findAll({
        attributes: ["raffleId"],
        raw: true,
        where: { raffleId: raffle.id },
      });

      const raffleForThisUser = await RaffleBuyer.findAll({
        where: {
          raffleId: raffle.id,
          userId: userId,
        },
      });

      await Object.defineProperty(raffle, "totalEntries", {
        value: usersRaffles.length,
      });

      console.log("usersRaffles.length ", usersRaffles.length);
      raffle["totalEntries"] = usersRaffles.length;
      // console.log("raffle after update ", raffle);
      newRaffles.push({
        raffle,
        totalEntries: usersRaffles.length,
        raffleForThisUser: raffleForThisUser.length,
      });
    }

    console.log("newRaffles ", newRaffles);
    if (raffles.length > 0) {
      return res.status(200).send({
        success: true,
        message: "Raffles Of User Found",
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

exports.addPointsToRaffle = async (req, res) => {
  try {
    const { id, raffleId, receiptid } = req.body;
    let user = await User.findOne({
      where: {
        id,
      },
    });
    let receipt = await Receipt.findOne({
      where: {
        id: receiptid,
      },
    });
    console.log("user is ", user);
    if (user) {
      var points = user.points;
      console.log("points are ", points);
      var tickets = points / 500;
      var ticketsToBeAdded;
      tickets = parseInt(tickets);
      console.log("upper tickets ", tickets);
      //new logic
      const raffles = await Raffle.findOne({
        raw: true,
        where: {
          id: raffleId,
        },
        include: [{ model: User }],
        order: [["createdAt", "DESC"]],
      });

      // console.log("raffles are ", raffles);
      console.log("buying ", tickets);
      if (raffles.status === "Active") {
        var userId = receipt.addedBy;
        const totalBoughtRaffles = await RaffleBuyer.findAll({
          where: { raffleId: raffles.id },
          raw: true,
        });
        console.log("totalBoughtRaffles.length ", totalBoughtRaffles.length);
        const userboughtRaffles = await RaffleBuyer.findAll({
          where: { raffleId: raffles.id, userId: userId },
          raw: true,
        });
        console.log("userboughtRaffles.length ", userboughtRaffles.length);
        // var totalRaffleTicketsRemain = 100 - totalBoughtRaffles.length;
        var totalRaffleTicketsRemain =
          raffles.totalTickets - totalBoughtRaffles.length;
        var userRaffleTicketsRemain = 10 - userboughtRaffles.length;
        if (userRaffleTicketsRemain < totalRaffleTicketsRemain) {
          if (tickets > userRaffleTicketsRemain) {
            ticketsToBeAdded = userRaffleTicketsRemain;
          } else {
            ticketsToBeAdded = tickets;
          }
        } else {
          if (tickets > totalRaffleTicketsRemain) {
            ticketsToBeAdded = totalRaffleTicketsRemain;
          } else {
            ticketsToBeAdded = tickets;
          }
        }
      } else {
        ticketsToBeAdded = 0;
      }

      //new logic
      return res.status(200).send({
        success: true,
        message: `${tickets} Tickets Bought against raffle ${raffles.name}`,
        tickets: tickets,
      });
    } else {
      return res.status(400).send({
        success: false,
        message: "Receipt Couldn't Be Approved",
      });
    }
  } catch (err) {
    console.log(err);
  }
};

exports.buyTickets = async (req, res, next) => {
  try {
    var { userId } = req.params;
    const { points } = req.body;
    const tickets = points / 500;

    if (tickets < 1) {
      return res.status(400).send({
        success: false,
        message:
          "Not Enough Points to buy a ticket, you need at least 500 points",
      });
    }
    const raffles = await Raffle.findAll({
      raw: true,
      where: {
        id: raffleId,
      },
      include: [{ model: User }],
      order: [["createdAt", "DESC"]],
    });

    // console.log("raffles[0]", raffles[0]);
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
          // if (totalBoughtRaffles.length >= 100) {
          if (totalBoughtRaffles.length >= raffles.totalTickets) {
            return res.status(200).send({
              success: true,
              message: `This Raffle has reached its limit. Please select another raffle`,
            });
          }
          if (userboughtRaffles.length >= 10) {
            // return res.status(200).send({
            //   success: true,
            //   message: `Fazool Project`,
            // });
            if (i === 0) {
              return res.status(200).send({
                success: true,
                message: `You have reached the maximum limit against this raffle`,
              });
            } else {
              return res.status(200).send({
                success: true,
                message: `Total ${i} number of tickets were added to this raffle`,
              });
            }
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
        //             });`
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

// exports.buyRaffle = async (req, res, next) => {
//     try {
//         const { id } = req.params
//         console.log(req.body)
//         console.log(req.auth)
//         const userId = req?.auth?.data?.userId;
//         console.log("userId ", userId)
//         const user = await User.findOne({ where: { id: userId }, raw: true });
//         console.log("user ", user)
//         console.log("raffleId", req.params.id)
//         const raffle = await Raffle.findOne({
//             where: { id: id },
//             raw: true
//         })
//         const totalBoughtRaffles = await RaffleBuyer.findAll({ where: { raffleId: req.params.id }, raw: true });
//         console.log("totalBoughtRaffles.length ",totalBoughtRaffles.length)
//         const userboughtRaffles = await RaffleBuyer.findAll({ where: { raffleId: req.params.id, userId: userId, }, raw: true });
//         console.log("userboughtRaffles.length ",userboughtRaffles.length)
//         if (totalBoughtRaffles.length >= 100) {
//             return res.status(400).send({
//                 success: false,
//                 message: "Raffles has already been bought 100 times"
//             });
//         }
//         if (userboughtRaffles.length >= 10) {
//             return res.status(400).send({
//                 success: false,
//                 message: "You've already bought this raffle 10 times"
//             });
//         }
//         console.log("user ", user)
//         if (user.points != undefined) {
//             if (raffle.price > user.points) {
//                 return res.status(400).send({
//                     success: false,
//                     message: "You Don't Have Enough Points"
//                 });
//             }
//         } else {
//             return res.status(400).send({
//                 success: false,
//                 message: "You Don't Have Enough Points"
//             });
//         }

//         const buyRaffle = await new RaffleBuyer({
//             raffleId: req.params.id,
//             userId: userId,
//         });
//         console.log("buyRaffle ", buyRaffle)
//         var buyerRaffle = await buyRaffle.save();
//         if (buyerRaffle) {
//             console.log("user", user)
//             await User.update(
//                 { points: user.points - raffle.price },
//                 {
//                     where: { id: userId }
//                 })
//             return res.status(200).send({
//                 success: true,
//                 buyerRaffle: buyerRaffle,
//                 points:user.points - raffle.price,
//                 message: "Raffle Has Been Bought"
//             });
//         } else {
//             return res.status(400).send({
//                 success: false,
//                 message: "Raffle Isn't Found"
//             });
//         }
//     }
//     catch (err) {
//         console.log("err.isJoi: ", err)
//         if (err.isJoi) {
//             res.status(422).json({
//                 success: false,
//                 message: err.details[0].message
//             })
//         } else {
//             res.status(500).json({
//                 success: false,
//                 message: "Internal Server Error"
//             })
//         }
//     }
// };

exports.testCroncode = async (req, res, next) => {
  try {
    console.log("running a task every hour");
    const raffles = await Raffle.findAll({
      raw: true,
      include: [{ model: User }],
    });
    // console.log("raffles ", raffles);
    for (let i = 0; i < raffles.length; i++) {
      console.log(raffles[i]);
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

exports.assignTicketsUser = async (req, res, next) => {
  try {
    var { userId } = req.params;
    let user = await User.findOne({
      where: {
        id: userId,
      },
    });

    if (user) {
      if (user.tickets <= 0) {
        res.status(401).send({ success: false, message: "Not Enough Tickets" });
      }

      const { raffleId, tickets } = req.body;
      if (tickets < 1) {
        return res.status(400).send({
          success: false,
          message: "You need at least 1 ticket",
        });
      }
      const raffle = await Raffle.findOne({
        raw: true,
        where: {
          id: raffleId,
        },
        include: [{ model: User }],
        order: [["createdAt", "DESC"]],
      });
      if (raffle) {
        if (raffle.status === "Active") {
          for (let i = 0; i < tickets; i++) {
            const totalBoughtRaffles = await RaffleBuyer.findAll({
              where: { raffleId: raffle.id },
              raw: true,
            });
            const userboughtRaffles = await RaffleBuyer.findAll({
              where: { raffleId: raffle.id, userId: userId },
              raw: true,
            });
            // userId = parseInt(userId);
            // await new RaffleBuyer({
            //   raffleId: raffle.id,
            //   userId: userId,
            // }).save();

            if (totalBoughtRaffles.length >= raffle.totalTickets) {
              // if (totalBoughtRaffles.length >= 100) {
              return res.status(200).send({
                success: true,
                message: `Raffle has reached its maximum limit. Please select another raffle`,
              });
            }
            if (userboughtRaffles.length >= 10) {
              user.tickets = user.tickets - i;
              user.save();

              // return res.status(200).send({
              //   success: true,
              //   message: `Fazool Project`,
              // });
              if (i === 0) {
                return res.status(200).send({
                  success: true,
                  message: `You have reached the maximum limit against this raffle`,
                });
              } else {
                return res.status(200).send({
                  success: true,
                  message: `Total ${i} number of tickets were added to this raffle`,
                });
              }
            }
            let raffleId = parseInt(raffle.id);
            userId = parseInt(userId);
            await new RaffleBuyer({
              raffleId: raffleId,
              userId: userId,
            }).save();
          }
          user.tickets = user.tickets - tickets;
          user.save();
          return res.status(200).send({
            success: true,
            message: "Raffles bought against tickets",
          });
        } else {
          console.log("just adding points based on tickets ", tickets);
          return res.status(404).send({
            success: false,
            message: "No Active Raffles But Points Added To User",
          });
        }
      } else {
        return res
          .status(404)
          .send({ success: false, message: "Raffle is not active" });
      }
    } else {
      res.status(404).send({ success: false, message: "User not found" });
    }
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .send({ success: false, message: "Internal Server Error", err });
  }
};
