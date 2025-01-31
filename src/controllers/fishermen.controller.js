const fs = require("fs");
const path = require("path");
const mainMapsPath = path.resolve(__dirname, "..", "..", "maps/main_maps.json");
const fishingData = require("../../fishing.json");
const playerSchema = require("../models/player.schema");
const { updateQuestProgress } = require("./quest.controller");

const catchFish = async (req, res) => {
  try {
    const playerId = req.user.playerId;
    const { material, rarity, mapId, result } = req.body; // Include mapId, position, and result
    let { position } = req.body;

    //Convert “x12y31” to “12,31” (example)
    position = position.replace(/x(\d+)y(\d+)/, "$1,$2");

    const rodConfig = fishingData.fishingRods[material][rarity];

    // Validate fishing rod type and rarity
    if (
      !fishingData.fishingRods[material] ||
      !fishingData.fishingRods[material][rarity]
    ) {
      console.warn("Invalid fishing rod material or rarity:", material, rarity);
      return res
        .status(400)
        .json({ message: "Invalid fishing rod material or rarity." });
    }

    // Load map data
    if (!fs.existsSync(mainMapsPath)) {
      console.error("Map data not found at path:", mainMapsPath);
      return res.status(500).json({ message: "Map data not found." });
    }

    const mapsHashmap = JSON.parse(fs.readFileSync(mainMapsPath, "utf-8"));

    // Validate fishing spot
    if (
      !mapsHashmap[mapId] ||
      !mapsHashmap[mapId][position] ||
      mapsHashmap[mapId][position].type !== "fish"
    ) {
      console.warn("Invalid fishing spot:", { mapId, position });
      return res.status(400).json({ message: "Invalid fishing spot." });
    }

    console.log("Fishing spot validated:", mapsHashmap[mapId][position]);

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found." });
    }

    // Check if the player has the required fishing rod equipped
    const equippedRodKey = `${rarity} ${material} Rod`;
    console.log("Equipped rod key being checked:", equippedRodKey);

    const equippedRod = [
      player.stuff.prof_item_1,
      player.stuff.prof_item_2,
      player.stuff.prof_item_3,
      player.stuff.prof_item_4,
    ].includes(equippedRodKey);

    if (!equippedRod) {
      console.warn(
        "Player does not have the required fishing rod equipped:",
        equippedRodKey
      );
      return res.status(400).json({
        message: `You do not have a ${rarity} ${material} fishing rod equipped.`,
      });
    }

    console.log("Player has the required fishing rod equipped.");

    let baitItem = player.inventory.find((item) => item.name === "worm_bait");

    // Verify that the player has enough worm bait
    console.log("Checking player's worm bait:", baitItem);

    if (!baitItem || baitItem <= 0) {
      console.warn("Player does not have enough worm bait.");
      return res.status(400).json({
        message: "You need at least one worm bait to fish.",
      });
    }

    // Deduct one worm bait
    baitItem -= 1;
    console.log("Worm bait deducted. Remaining worm bait:", baitItem);

    // Determine the fish caught based on result
    let fishCaught = 0;
    console.log("Fishing result provided:", result);

    if (result === "Grey") {
      fishCaught = 0; // No fish
    } else if (result === "Green") {
      fishCaught = 1; // 1 fish
    } else if (result === "Red") {
      fishCaught = 2; // 2 fish
    } else {
      console.warn("Invalid fishing result type:", result);
      return res.status(400).json({ message: "Invalid result type." });
    }

    console.log("Number of fish to catch:", fishCaught);

    const caughtFishes = [];
    for (let i = 0; i < fishCaught; i++) {
      const roll = Math.random() * 100;
      let fishRarity;

      if (roll < rodConfig.commonFishDropRate) {
        fishRarity = "common";
      } else if (
        roll <
        rodConfig.commonFishDropRate + rodConfig.uncommonFishDropRate
      ) {
        fishRarity = "uncommon";
      } else if (
        roll <
        rodConfig.commonFishDropRate +
        rodConfig.uncommonFishDropRate +
        rodConfig.rareFishDropRate
      ) {
        fishRarity = "rare";
      } else if (
        roll <
        rodConfig.commonFishDropRate +
        rodConfig.uncommonFishDropRate +
        rodConfig.rareFishDropRate +
        rodConfig.epicFishDropRate
      ) {
        fishRarity = "epic";
      } else {
        fishRarity = "legendary";
      }

      console.log(`Fish rarity rolled (${roll}):`, fishRarity);

      const fishOptions = fishingData.fish[fishRarity];
      const caughtFish =
        fishOptions[Math.floor(Math.random() * fishOptions.length)];

      console.log("Fish caught:", caughtFish);

      // Update inventory with the caught fish
      const fishInInventoryIndex = player.inventory.findIndex(
        (item) => item.name === caughtFish
      );

      if (fishInInventoryIndex !== -1) {
        console.log(
          `The fish ${caughtFish} already exists in the inventory. Quantity increased by 1.`
        );
        player.inventory[fishInInventoryIndex].quantity += 1;
      } else {
        console.log(`The fish ${caughtFish} has been added to the inventory.`);

        player.inventory.push({ name: caughtFish, quantity: 1 });
      }

      caughtFishes.push(caughtFish);
    }

    console.log("All caught fishes:", caughtFishes);

    // Update Fisherman XP
    const xpGained = rodConfig.xpGained;
    console.log("XP gained from fishing:", xpGained);

    const profession = player.profession_xp.find(
      (prof) => prof.profession === "fisherman"
    );

    if (profession) {
      profession.current_xp = (profession.current_xp || 0) + xpGained;
      console.log("Updated profession XP:", profession.current_xp);
    } else {
      player.profession_xp.push({
        profession: "fisherman",
        current_level: 0,
        current_xp: xpGained,
      });
    }

    player.last_action = new Date().toISOString();
    await player.save();

    console.log("Fishing operation completed successfully.");

    const questResult = await updateQuestProgress(playerId, 'Fisher', 'gather', 'fish', caughtFishes.length);
    console.log("Quest progress updated:", questResult);

    res.status(201).json({
      message: "Fishing successful!",
      rewards: {
        fishes: caughtFishes,
        xp_gained: xpGained,
      },
      questUpdate: questResult,
      inventory: player.inventory,
      professionXp: player.profession_xp,
    });
  } catch (err) {
    console.error("Unexpected error during fishing operation:", err);
    res.status(500).json({ message: "An error occurred while fishing." });
  }
};

module.exports = {
  catchFish,
};
