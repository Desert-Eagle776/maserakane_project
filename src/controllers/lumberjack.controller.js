const fs = require("fs");
const path = require("path");
const axesData = require("../../axes.json");
const playerSchema = require("../models/player.schema");
const { updateQuestProgress } = require("./quest.controller");

const mainMapsPath = path.resolve(__dirname, "..", "..", "maps/main_maps.json");

const chopWood = async (req, res) => {
  try {
    console.log("Received request to /api/lumberjack/chop");

    const playerId = req.user.playerId;
    const { material, rarity, mapId } = req.body;
    let { position } = req.body;

    //Convert “x12y31” to “12.31”
    position = position.replace(/x(\d+)y(\d+)/, "$1,$2");

    if (!material || !rarity || !mapId || !position) {
      console.error("Missing required parameters:", {
        material,
        rarity,
        mapId,
        position,
      });
      return res.status(400).json({ message: "Missing required parameters." });
    }

    // Validation de la hache
    if (!axesData.axes[material] || !axesData.axes[material][rarity]) {
      console.warn("Invalid axe material or rarity:", { material, rarity });
      return res
        .status(400)
        .json({ message: "Invalid axe material or rarity." });
    }

    const axeConfig = axesData.axes[material][rarity];

    // Chargement des données de la carte
    if (!fs.existsSync(mainMapsPath)) {
      console.error("Map data file not found at:", mainMapsPath);
      return res.status(500).json({ message: "Map data not found." });
    }

    const mapsHashmap = JSON.parse(fs.readFileSync(mainMapsPath, "utf-8"));

    // Validation de la carte et de la position
    if (!mapsHashmap[mapId] || !mapsHashmap[mapId][position]) {
      console.warn("Invalid map or position:", { mapId, position });

      return res.status(400).json({ message: "Invalid map or position." });
    }

    console.log("Map and position are valid.");
    const tree = mapsHashmap[mapId][position];

    // Vérification du cooldown
    const now = Date.now();
    const lastChop =
      tree.players.find((player) => player.playerId === playerId)?.timestamp ||
      0;

    if (lastChop && now - new Date(lastChop).getTime() < 3 * 60 * 60 * 1000) {
      console.warn("Tree still in cooldown for player:", playerId);

      return res.status(400).json({
        message: "This tree is still regrowing. Cooldown is 3 hours.",
      });
    }

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    // Vérification de la hache équipée
    const equippedAxeKey = `${rarity} ${material} Axe`;
    const equippedAxe = [
      player.stuff.prof_item_1,
      player.stuff.prof_item_2,
      player.stuff.prof_item_3,
      player.stuff.prof_item_4,
    ].includes(equippedAxeKey);

    if (!equippedAxe) {
      console.warn(
        "Player does not have the required axe equipped:",
        equippedAxeKey
      );
      return res.status(400).json({
        message: `You do not have a ${rarity} ${material} axe equipped.`,
      });
    }

    // Récompenses et mise à jour
    const woodAmount = axeConfig.woodAmount;
    console.log("Calculating bait probability...");
    console.log(
      "Axe configuration bait probability:",
      axeConfig.baitProbability
    );

    // Generate a random value and compare it
    const randomValue = Math.random() * 100;
    console.log("Generated random value:", randomValue);

    const hasBait = randomValue < axeConfig.baitProbability;
    console.log("Does the player have bait?", hasBait);

    console.log("Wood amount:", woodAmount, "Has bait:", hasBait);

    const woodItem = player.inventory.find((item) => item.name === "Wood");
    if (woodItem) {
      woodItem.quantity = (woodItem.quantity || 0) + woodAmount;
    }

    if (hasBait) {
      const baitItem = player.inventory.find(
        (item) => item.name === "worm_bait"
      );

      if (baitItem) {
        baitItem.quantity = (baitItem.quantity || 0) + 1;
      }
    }

    const profession = player.profession_xp.find(
      (item) => item.profession === "lumberjack"
    );

    if (profession) {
      profession.current_xp = (profession.current_xp || 0) + axeConfig.xpGained;
    } else {
      player.profession_xp.push({
        profession: "lumberjack",
        current_xp: axeConfig.xpGained,
      });
    }

    tree.players.push({ playerId, timestamp: new Date().toISOString() });

    fs.writeFileSync(
      mainMapsPath,
      JSON.stringify(mapsHashmap, null, 2),
      "utf-8"
    );
    console.log("Updated map data saved.");

    player.last_action = new Date().toISOString();
    await player.save();

    const questResult = await updateQuestProgress(playerId, 'Lumberjack Training', 'gather', 'wood', woodAmount);
    console.log("Quest progress updated:", questResult);

    return res.status(201).json({
      message: "Chopping successful!",
      rewards: {
        wood: woodAmount,
        worm_bait: hasBait ? 1 : 0,
        xp_gained: axeConfig.xpGained,
      },
      questUpdate: questResult,
      inventory: player.inventory,
      professionXp: player.profession_xp,
    });
  } catch (e) {
    console.error("An error occurred while chopping wood: ", e);
    return res
      .status(500)
      .json({ message: "An error occurred while chopping wood." });
  }
};

module.exports = {
  chopWood,
};
