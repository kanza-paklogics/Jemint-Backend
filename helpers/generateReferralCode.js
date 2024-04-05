const User = require("../models/User");
const crypto = require("crypto");

async function getUniquePromoCode() {
  console.log("===> getUniquePromoCode called");
  const promoCode = `U-${crypto.randomBytes(3).toString("hex")}`;
  const userWithPromoCode = await User.findOne({
    where: { promoCode },
  });
  if (userWithPromoCode) {
    return getUniquePromoCode();
  }
  console.log("--> promoCode...", promoCode);
  return promoCode;
}

module.exports = getUniquePromoCode;
