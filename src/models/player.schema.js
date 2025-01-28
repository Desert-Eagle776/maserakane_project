const { Schema, model } = require("mongoose");
const { v4: uuidv4 } = require("uuid");
const stuffSchema = require("./stuff.schema");
const inventorySchema = require("./inventory.schema");
const currencySchema = require("./currency.schema");
const professionSchema = require("./profession.schema");

const playerSchema = new Schema({
  _id: {
    type: String,
    default: uuidv4,
  },
  token: {
    type: String,
    default: null,
  },
  wallets: [String],
  stuff: stuffSchema,
  inventory: [inventorySchema],
  money: currencySchema,
  profession_xp: [professionSchema],
  last_action: {
    type: Date,
    default: null,
  },
});

module.exports = model("Player", playerSchema);
