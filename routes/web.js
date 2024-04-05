const express = require("express");
const router = express.Router();
const AuthController = require("../app/controllers/AuthController");

// Define the current app version
const appVersion = "v4.24";

router.get("/version", (req, res) => {
  console.log("🧮 App version is:", appVersion);
  res.json({ version: appVersion });
});

router.get("admin/version", (req, res) => {
  console.log("🧮 App version is:", appVersion);
  res.json({ version: appVersion });
});

router.get("/ping", (req, res) => {
  console.log("Here");
  res.status(200).send("Server is accessible !!");
});

router.get("/user", AuthController.getUser);
module.exports = router;
