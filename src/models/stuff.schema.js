const { Schema } = require("mongoose");

const stuffSchema = new Schema({
  head: {
    type: String,
    default: null,
  },
  chestplate: {
    type: String,
    default: null,
  },
  legs: {
    type: String,
    default: null,
  },
  boots: {
    type: String,
    default: null,
  },
  gloves: {
    type: String,
    default: null,
  },
  prof_item_1: {
    type: String,
    default: null,
  },
  prof_item_2: {
    type: String,
    default: null,
  },
  prof_item_3: {
    type: String,
    default: null,
  },
  prof_item_4: {
    type: String,
    default: null,
  },
});

module.exports = stuffSchema;
