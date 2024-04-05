const path = require("path");
// load dependencies
const env = require("dotenv");
const express = require("express");
const bodyParser = require("body-parser");
var { expressjwt: jwt } = require("express-jwt");

const app = express();

//Loading Routes
const webRoutes = require("./routes/web");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const receiptRoutes = require("./routes/receipt");
const raffleRoutes = require("./routes/raffles");
const paypalRoutes = require("./routes/paypal");
const notificationsRoutes = require("./routes/notification");

const sequelize = require("./config/database");
const errorController = require("./app/controllers/ErrorController");
var cors = require("cors");
setTimeout(function () {
  const { createPlans } = require("./helpers/createPlans");
  createPlans();
}, 4000);

env.config();
app.use(cors({}));
app.use(bodyParser.urlencoded({ extended: false }));
app.use("/files", express.static(path.join(__dirname, "src")));
// app.use("/files", express.static(path.join(__dirname, "app/src")));
// console.log("private key :", process.env.JWT_TOKEN_KEY);
// console.log("refresh eky: ", process.env.JWT_REFRESH_TOKEN_KEY);
app.use(bodyParser.json());
app.use(
  jwt({
    secret: process.env.JWT_TOKEN_KEY,
    algorithms: ["HS256"],
  }).unless({
    path: [
      "/files/src/*",
      "/app/api/auth/sign-up",
      "/app/api/auth/login",
      "/app/api/auth/userdata",
      "/app/api/auth/appleuserdata",
      "/app/api/auth/gmaillogin",
      "/app/api/auth/applelogin",
      "/app/api/auth/reset-password",
      "/app/api/auth/forgot-password",
      "/app/api/auth/verify",
      "/app/api/test",
      "/app/api/ping",
      "/app/api/version",
      "/app/api/auth/checkotp",
      "/app/api/auth/resendotp",
      "/app/api/admin/paypal-webhooks",
      "/app/api/auth/ios-notification",
      "/app/api/admin/sign-up",
      "/app/api/admin/login",
      "/app/api/admin/reset-password",
      "/app/api/admin/forgot-password",
      "/app/api/admin/verify",
      "/app/api/admin/checkotp",
      "/app/api/admin/resendotp",
      "/app/src/*",
      "/src/*",
      "/files/*",
      "/files/src/*",
    ],
  })
);

app.use("/app/api", webRoutes);
app.use("/app/api/auth", authRoutes);
app.use("/app/api/admin", adminRoutes);
app.use("/app/api/receipt", receiptRoutes);
app.use("/app/api/raffle", raffleRoutes);
app.use("/app/api/paypal", paypalRoutes);
app.use("/app/api/notifications", notificationsRoutes);

sequelize
  // .sync({ force: true })
  // .sync({ alter: true })
  .sync()
  .then(() => {
    app.listen(process.env.PORT);
    //pending set timezone
    console.log("App listening on port " + process.env.PORT);
  })
  .catch((err) => {
    console.log(err);
  });
