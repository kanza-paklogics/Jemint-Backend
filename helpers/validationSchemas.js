const Joi = require("@hapi/joi");

// const receiptSchema = Joi.object({
//     name:Joi.string().min(2).required()

// })
const receiptSchema = Joi.object({
  name: Joi.string().required(),
  location: Joi.string().allow(null), // Make 'location' not required, but allow 'null'
  amount: Joi.number().allow(null), // Make 'amount' not required, but allow 'null'
  date: Joi.date().allow(null), // Make 'date' not required, but allow 'null'
});

const receiptSchemaV2 = Joi.object({
  name: Joi.string().required(),
  location: Joi.string().required(),
  amount: Joi.number().required(),
  date: Joi.date().required(),
});

const raffleSchema = Joi.object({
  name: Joi.string().min(2).required(),
});

module.exports = {
  receiptSchema,
  receiptSchemaV2,
};
