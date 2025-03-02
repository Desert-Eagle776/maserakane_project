const playerSchema = require("../models/player.schema");
const foodsData = require("../data/foods.json");

const status = async (req, res) => {
  try {
    const playerId = req.user.playerId;

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    return res.status(200).json({
      hunger: player.hunger,
      saturation: player.saturation,
      saturationEndTime: player.saturationEndTime,
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: "Server error" });
  }
};

const consume = async (req, res) => {
  try {
    const playerId = req.user.playerId;
    const { foodName } = req.body;

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    const food = foodsData.foods.find((f) => f.name === foodName);
    if (!food) {
      return res.status(404).json({ message: "Food not found" });
    }

    // Checking inventory for food availability
    const inventoryItem = player.inventory.find(
      (item) => item.name === foodName
    );
    if (!inventoryItem || inventoryItem.quantity <= 0) {
      return res
        .status(400)
        .json({ message: "Food not available in inventory" });
    }

    // Reducing the amount of food in the inventory
    inventoryItem.quantity -= 1;
    player.inventory = player.inventory.filter((item) => item.quantity > 0);

    // restore hunger
    player.hunger = Math.min(100, player.hunger + food.hungerRestore);

    // restore saturation
    player.saturation = Math.min(
      100,
      player.saturation + food.saturationRestore
    );
    player.saturationEndTime = Date.now() + food.saturationDuration * 1000;

    await player.save();

    return res.status(201).json({
      messgage: `Food consumed: ${foodName}`,
      hunger: player.hunger,
      saturation: player.saturation,
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: "Server error" });
  }
};

const decrease = async (req, res) => {
  try {
    const playerId = req.user.playerId;

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    const hungerDrainRate = getHungerDrainRate(player.level);
    const saturationDrainRate = getSaturationDrainRate(player.level);

    // Decreasing saturation if it's greater than 0
    if (player.saturation > 0) {
      player.saturation = Math.max(0, player.saturation - saturationDrainRate);
    }

    // If saturation is depleted, decrease hunger
    if (player.saturation === 0 || player.saturationEndTime < Date.now()) {
      player.hunger = Math.max(0, player.hunger - hungerDrainRate);
    }

    await player.save();

    return res.status(200).json({
      message: "Hunger and saturation decreased",
      hunger: player.hunger,
      saturation: player.saturation,
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: "Server error" });
  }
};

const setSaturation = async (req, res) => {
  try {
    const playerId = req.user.playerId;
    const { saturationDuration } = req.body;

    if (
      !saturationDuration ||
      typeof saturationDuration !== "number" ||
      saturationDuration <= 0
    ) {
      return res.status(400).json({ message: "Invalid saturation duration" });
    }

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    player.saturationEndTime = Date.now() + saturationDuration * 1000;
    await player.save();

    return res.status(200).json({
      message: "Saturation duration set",
      saturationEndTime: player.saturationEndTime,
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: "Server error" });
  }
};

// Determining the rate of hunger decrease and saturation depending on the player's level
const getHungerDrainRate = (level) => {
  if (level >= 16) return 3; // Very Fast (3x)
  if (level >= 11) return 2; // Fast (2x)
  if (level >= 6) return 1.5; // Faster (1.5x)
  return 1; // Normal (1x)
};

const getSaturationDrainRate = (level) => {
  if (level >= 16) return 3; // Rapid (3x)
  if (level >= 11) return 2; // Quick (2x)
  if (level >= 6) return 1.5; // Moderate (1.5x)
  return 1; // Slow (1x)
};

module.exports = {
  status,
  consume,
  decrease,
  setSaturation,
};
