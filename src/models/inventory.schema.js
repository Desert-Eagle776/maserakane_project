const { Schema } = require("mongoose");

const inventorySchema = new Schema({
  item_id: {
    type: String,
  },
  name: {
    type: String,
  },
  quantity: {
    type: Number,
  },
});

module.exports = inventorySchema;
