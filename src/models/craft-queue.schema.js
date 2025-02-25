const mongoose = require("mongoose");
const { Schema } = require("mongoose");

const craftQueueSchema = new Schema({
  player_id: { type: mongoose.Schema.Types.UUID, ref: "Player" },
  type: { type: String, required: true },
  material: { type: String, required: true },
  rarity: { type: String, required: true },
  successRate: { type: Number, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending",
  },
});

module.exports = mongoose.model("craft_queue", craftQueueSchema);
