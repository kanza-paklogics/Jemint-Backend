const express = require("express");
const router = express.Router();
const RaffleController = require("../app/controllers/RaffleController");

//Raffle APIs Started
//Route for viewing raffle
router.get("/availableraffles", RaffleController.availableRaffles);
//Route for my raffles
// router.get("/myraffles", RaffleController.myRaffles);

router.get("/myraffles", RaffleController.userRaffles);
//Route for getting single raffle
router.get("/raffle/:id", RaffleController.viewRaffle);

router.post("/buytickets/:id", RaffleController.buyTickets);
//Route for testing cron code
router.get("/testcroncode", RaffleController.testCroncode);
//Route for buying raffle
// router.post("/buyraffle/:id", RaffleController.buyRaff   le);

router.post("/addpoints/:receiptId", RaffleController.addPointsToRaffle);

router.post("/addticket/:userId", RaffleController.assignTicketsUser);

module.exports = router;
