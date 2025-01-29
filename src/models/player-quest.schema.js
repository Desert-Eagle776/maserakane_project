const { Schema, default: mongoose, model } = require("mongoose");

const playerQuestSchema = new Schema({
  quest_name: {
    type: String,
    required: true,
  },
  current_step: {
    type: String,
    required: true,
  },
  progress: {
    type: Number,
    default: 0,
  },
  player_id: { type: mongoose.Schema.Types.UUID, ref: "Player" },
  completed: {
    type: Boolean,
    default: false,
  },
});

module.exports = model("player_quests", playerQuestSchema);
