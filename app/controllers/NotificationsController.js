// import { createNotification as cN } from "./AdminController";
// const { createNotification } = require("./AdminController");
const AdminController = require("./AdminController");

const OneSignal = require("onesignal-node");

const User = require("../../models/User");
const Player = require("../../models/Player");
const Receipt = require("../../models/Receipt");

User.hasMany(Player);
Player.belongsTo(User);

const client = new OneSignal.Client(
  process.env.ONESIGNAL_APP_ID,
  process.env.ONESIGNAL_REST_API_KEY
);

var playerID = [];

async function sendNotification(playerId, message) {
  console.log("----------> Inside sendNotification");
  const notification = {
    // headers: {
    //   "Content-Type": "application/json",
    // },
    // contents: { en: message },
    // include_player_ids: [playerId],
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

  // let devices = await Player.findAll({});
  // console.log("devices are");
  // console.log(devices);

  // console.log(devices.playerId);

  // if (playerId) {
  //   // console.log("Inside new Raffle if");
  //   await createNotification(
  //     "The receipt has been approved.",
  //     "11",
  //     "push",
  //     devices
  //   );
  // }

  // return await client.cN(notification);
  // return await client.createNotification(notification);
  const playerArray = [{ playerId: playerId }];

  return await AdminController.createNotification(
    "The receipt has been approved",
    "11",
    "push",
    playerArray
  );
}

exports.updatePlayerId = async (req, res) => {
  try {
    const userId = req?.auth?.data?.userId;
    console.log(userId);
    User.findOne({
      where: {
        id: userId,
      },
    })
      .then(async (user) => {
        const player = await new Player({
          playerId: req.body.playerId,
          userId: userId,
        });
        var newplayer = await player.save();
        console.log("newplayer ", newplayer);
        res.status(200).send({ status: true, newplayer: newplayer });
      })
      .catch((err) => {
        console.log(err);
      });
  } catch (err) {
    console.log("update Player Id Error ", err);
    return res
      .status(500)
      .send({ status: false, message: "Internal Server Error", err });
  }
};

exports.deletePlayerId = async (req, res) => {
  try {
    const userId = req?.auth?.data?.userId;
    Player.destroy({
      where: {
        playerId: req.body.playerId,
      },
    })
      .then(() => {
        res.status(200).send({
          success: true,
          message: "Player Id(s) Deleted Successfully",
        });
      })
      .catch((err) => {
        res
          .status(401)
          .send({ success: false, message: "Error deleting player id", err });
      });
  } catch (err) {
    console.log("player id deletion error", err);
    res.status(500).send({ success: false, message: " Internal Server Error" });
  }
};

exports.notifyReceiptApproval = async (req, res) => {
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
};

// Following sending notifications to all users on any receipt approval:

// exports.notifyReceiptApproval = async (req, res) => {
//   console.log(
//     "-------------------------Inside Notify Receipt Approval--------------------------------"
//   );
//   try {
//     const receiptId = req?.body?.receiptId;
//     const receipt = await Receipt.findOne({ id: receiptId });

//     if (receipt && receipt.status === "Approved") {
//       const players = await Player.findAll({
//         userId: receipt.addedBy,
//       });

//       for (const player of players) {
//         await sendNotification(
//           player.playerId,
//           "The receipt has been approved!"
//         );
//       }

//       if (res) {
//         // check if res is defined
//         console.log("Notification sent on receipt approval", res);
//         res
//           .status(200)
//           .send({ success: true, message: "Notification sent successfully" });
//       }
//     } else {
//       res
//         .status(400)
//         .send({ success: false, message: "Receipt not found or not approved" });
//     }
//   } catch (err) {
//     console.log("Error sending notification", err);
//     if (res) {
//       res
//         .status(500)
//         .send({ success: false, message: "Internal Server Error" });
//     }
//   }
// };
