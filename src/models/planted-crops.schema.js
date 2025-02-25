const { mongoose, Schema, model } = require("mongoose");

const plantedCropSchema = new Schema({
  cropId: { type: Number },
  player_id: { type: mongoose.Schema.Types.UUID, ref: "Player" },
  plantType: { type: String },
  mapId: { type: String },
  position: { type: String },
  growthStage: { type: String },
  timeRemaining: { type: String },
  lastStageChange: { type: Date },
  plantedAt: { type: Date },
});

module.exports = model("planted_crops", plantedCropSchema);
