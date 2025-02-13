const playerSchema = require("../models/player.schema");
const bushesData = require("../data/bushes.json");

const COOLDOWN_HOURS = 6; // Таймер респавну куща (6 годин)

// Функція перевірки, чи минув cooldown
const canHarvest = (lastHarvested) => {
  if (!lastHarvested) return true;
  const now = new Date();
  return now - new Date(lastHarvested) >= COOLDOWN_HOURS * 60 * 60 * 1000;
};

const harvestedBushes = async (req, res) => {
  try {
    const { bushId } = req.body;
    const playerId = req.user.playerId;

    if (!bushId || typeof bushId !== "string") {
      return res.status(400).json({ message: "bushId must be a string" });
    }

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    const bush = bushesData.find((b) => b.id === bushId);
    if (!bush) {
      return res.status(404).json({ message: "Bush not found" });
    }

    const harvestedBush = player.harvestedBushes.find(
      (b) => b.bushId === bushId
    );

    if (harvestedBush && !canHarvest(harvestedBush.lastHarvested)) {
      return res.status(400).json({ message: "Bush is still on cooldown" });
    }

    const randomDrop = bush.possibleDrops.find(
      (drop) => Math.random() * 100 < drop.dropChance
    );

    if (!randomDrop) {
      return res
        .status(200)
        .json({ message: "No leaves were harvested this time." });
    }

    const inventoryItem = player.inventory.find(
      (item) => item.name === randomDrop.itemName
    );
    if (inventoryItem) {
      inventoryItem.quantity += 1;
    } else {
      player.inventory.push({ name: randomDrop.itemName, quantity: 1 });
    }

    if (harvestedBush) {
      harvestedBush.lastHarvested = new Date();
    } else {
      player.harvestedBushes.push({ bushId, lastHarvested: new Date() });
    }

    await player.save();

    return res.status(200).json({
      message: `You harvested a ${randomDrop.itemName}!`,
      item: randomDrop.itemName,
    });
  } catch (e) {
    console.log("An error occurred while harvesting: ", e);
    return res
      .status(500)
      .json({ message: "An error occurred while harvesting" });
  }
};

module.exports = {
  harvestedBushes,
};
