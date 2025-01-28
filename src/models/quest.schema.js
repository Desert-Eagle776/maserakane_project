const { Schema, default: mongoose, model } = require("mongoose");

const questSchema = new Schema({
  quest_name: { type: String, required: true },
  current_step: { type: String, required: true },
  progress: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },
  player_id: { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
});

module.exports = model("Quest", questSchema);
