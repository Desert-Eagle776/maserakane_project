const { Schema } = require("mongoose");

const professionSchema = new Schema({
  profession: {
    type: String,
  },
  current_level: {
    type: Number,
    default: 0,
  },
  current_xp: {
    type: Number,
    default: 0,
  },
});

module.exports = professionSchema;
