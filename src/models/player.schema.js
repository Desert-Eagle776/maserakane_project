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
  mortar_level: { type: Number, default: 1 },
  unlocked_potion_recipes: [Number],
  harvestedBushes: [
    {
      bushId: String,
      lastHarvested: Date,
      position: String,
      mapId: String,
    },
  ],
  minedNodes: { type: Map, of: Date, default: {} },
  fireplaceLevel: { type: Number, default: 1 },
  unlocked_cooked_recipes: { type: [String], default: [] },
  level: { type: Number, default: 1 },
  hunger: { type: Number, default: 100 },
  saturation: { type: Number, default: 100 },
  saturationEndTime: { type: Date, default: null },
  last_action: {
    type: Date,
    default: null,
  },
});

module.exports = model("Player", playerSchema);
