const PricingPlan = require("../models/PricingPlan");
const createPlans = async () => {
  console.log("yoo ");
  const ifbasicplan = await PricingPlan.findOne({
    where: { name: "Base" },
    raw: true,
  });

  if (!ifbasicplan) {
    await PricingPlan.create({
      id: 1,
      name: "Base",
      price: 0,
      details: "Access to Basic Raffles",
    });
  }

  // }
  // const ifpremiumplan = await PricingPlan.findOne({ where: { name: "Premium" }, raw: true });
  // console.log("ifpremiumplan ",ifpremiumplan)
  // if(!ifpremiumplan){
  //     const pricingPlan = await new PricingPlan({
  //         name: "Premium",
  //         price: 54,
  //         details:"Premium plan yo",
  //     });
  //     var newpricingPlan = await pricingPlan.save();
  // }
};
module.exports = {
  createPlans,
};
