const { Schema } = require("mongoose");

const currencySchema = new Schema({
  gold: {
    type: Number,
    default: 0,
  },
  silver: {
    type: Number,
    default: 0,
  },
  gems: {
    type: Number,
    default: 0,
  },
});

module.exports = currencySchema;
