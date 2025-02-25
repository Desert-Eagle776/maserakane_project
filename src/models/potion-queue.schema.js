const mongoose = require("mongoose");
const { Schema } = require("mongoose");

const potionQueueSchema = new Schema({
  player_id: { type: mongoose.Schema.Types.UUID, ref: "Player" },
  recipe_id: { type: Number, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending",
  },
});

module.exports = mongoose.model("potion_queue", potionQueueSchema);
