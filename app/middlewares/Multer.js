const multer = require("multer");
const fs = require("fs");
//Multer Setup Started
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // cb(null, "./src");
    fs.mkdir("./src/", (err) => {
      cb(null, "./src/");
    });
  },
  filename: (req, file, cb) => {
    console.log("file.originalname ", file.originalname);
    var originalname = file.originalname;
    originalname = originalname.replace(/\s/g, "");
    console.log("originalname", originalname);
    cb(null, Date.now() + "-" + originalname);
  },
});
const receiptImageMiddleware = multer({
  storage: storage,
  limits: { fieldSize: 100 * 1024 * 1024 },
}).fields([{ name: "receiptImage" }]);

const raffleImageMiddleware = multer({
  storage: storage,
  limits: { fieldSize: 100 * 1024 * 1024 },
}).fields([{ name: "raffleImage" }]);
module.exports = {
  receiptImageMiddleware,
  raffleImageMiddleware,
};
