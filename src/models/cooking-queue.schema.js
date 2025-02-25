const mongoose = require("mongoose");
const { Schema } = require("mongoose");

const cookingQueueSchema = new Schema({
  player_id: { type: mongoose.Schema.Types.UUID, ref: "Player" },
  recipe_id: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  status: {
    type: String,
    enum: ["pending", "completed", "failed"],
    default: "pending",
  },
});

module.exports = mongoose.model("cooking_queue", cookingQueueSchema);
