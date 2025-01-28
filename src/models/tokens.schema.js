const { Schema, default: mongoose, model } = require("mongoose");

const tokenSchema = new Schema({
  player_id: [{ type: mongoose.Schema.Types.UUID, ref: "Player" }],
  token: {
    type: String,
    default: null,
  },
  expires_at: {
    type: Date,
  },
});

module.exports = model("Tokens", tokenSchema);
