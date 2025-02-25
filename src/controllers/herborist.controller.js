const fs = require("fs");
const path = require("path");
const playerSchema = require("../models/player.schema");
const bushesData = require("../data/bushes.json");

const mainMapsPath = path.resolve(__dirname, "..", "..", "maps/main_maps.json");

const COOLDOWN_HOURS = 6; // Bush respawn timer (6 hours)

// Function to check if the cooldown has expired
const canHarvest = (lastHarvested) => {
  if (!lastHarvested) return true;
  const now = new Date();
  return now - new Date(lastHarvested) >= COOLDOWN_HOURS * 60 * 60 * 1000;
};

const harvestedBushes = async (req, res) => {
  try {
    const { type, position, mapId } = req.body;
    const playerId = req.user.playerId;

    if (!type || !mapId || !position) {
      console.error("Missing required parameters:", {
        type,
        mapId,
        position,
      });
      return res.status(400).json({ message: "Missing required parameters." });
    }

    const modifyPosition = position.replace(/x(\d+)y(\d+)/, "$1,$2");

    if (!fs.existsSync(mainMapsPath)) {
      console.error("Map data file not found at:", mainMapsPath);
      return res.status(500).json({ message: "Map data not found." });
    }

    const mapsHashmap = JSON.parse(fs.readFileSync(mainMapsPath, "utf-8"));

    const map = mapsHashmap[mapId];
    const cell = map[modifyPosition];

    if (!cell || cell.type !== "harvest" || cell.players.length > 0) {
      return res
        .status(400)
        .json({ message: "The cell is not available for harvesting" });
    }

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    const bush = bushesData.bushes.find((b) => b.type === type);
    if (!bush) {
      return res.status(404).json({ message: "Bush not found" });
    }

    const harvestedBush = player.harvestedBushes.find(
      (b) =>
        b.position === position && b.mapId === mapId && b.bushId === bush.id
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
      player.harvestedBushes.push({
        position,
        mapId,
        bushId: bush.id,
        lastHarvested: new Date(),
      });
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
