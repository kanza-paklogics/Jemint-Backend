const env = require("dotenv");
env.config();

console.log("private key :", process.env.JWT_TOKEN_KEY);
console.log("refresh eky: ", process.env.JWT_REFRESH_TOKEN_KEY);

module.exports = {
  development: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_DATABASE,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    dialect: "mysql",
  },
  test: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_DATABASE,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    dialect: "mysql",
  },
  production: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_DATABASE,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    dialect: "mysql",
  },
};
