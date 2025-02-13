const { v4: uuidv4 } = require("uuid");
const blacksmithData = require("../data/blacksmith.json");
const armorerData = require("../data/armorer.json");
const basicsData = require("../data/basics.json");
const playerSchema = require("../models/player.schema");
const { updateQuestProgress } = require("./quest.controller");

const blacksmithCraft = async (req, res) => {
  const playerId = req.user.playerId;
  const { type, material, rarity } = req.body;

  try {
    if (
      !blacksmithData[type] ||
      !blacksmithData[type][material] ||
      !blacksmithData[type][material][rarity]
    ) {
      console.log(
        "Invalid crafting parameters: type, material, or rarity is missing or incorrect: ",
        type,
        material,
        rarity
      );
      return res.status(400).json({
        message:
          "Invalid crafting parameters: type, material, or rarity is missing or incorrect.",
      });
    }

    const blacksmithConfig = blacksmithData[type][material][rarity];
    console.log("Blacksmith Config: ", blacksmithConfig);

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found." });
    }

    console.log(blacksmithConfig.materials);

    for (const material of blacksmithConfig.materials) {
      const item = player.inventory.find(
        (invItem) => invItem.name === material.name
      );

      if (!item || parseInt(item.quantity) < parseInt(material.quantity)) {
        return res.status(400).json({
          message: `Not enough ${material.name} in inventory.`,
        });
      }

      item.quantity -= material.quantity;
      console.log(
        `${material.name} deducated. Remaining ${material.name}: ${item.quantity}`
      );
    }

    const success = Math.random() * 100 <= blacksmithConfig.successRate;
    console.log(success);
    if (!success) {
      // Failed crafting, material loss or partial completion
      await player.save();
      return res
        .status(201)
        .json({ message: "Crafting failed. Material loss occurred." });
    }

    console.log(blacksmithConfig);

    const craftedItem = `${rarity} ${material} ${type}`;

    console.log(craftedItem);

    const existingItem = player.inventory.find(
      (item) => item.name === craftedItem
    );
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      const itemId = uuidv4();
      player.inventory.push({
        item_id: itemId,
        name: craftedItem,
        quantity: 1,
      });
    }

    await player.save();

    const questItem = type.toLowerCase().replace(/\s+/g, "_");
    const questResult = await updateQuestProgress(
      playerId,
      "Crafting Basics",
      "craft",
      questItem,
      1
    );
    console.log("Quest progress updated:", questResult);

    return res.status(201).json({
      message: "Craft successful",
      craftedItem,
      inventory: player.inventory,
      xpGained: blacksmithConfig.xpGained,
    });
  } catch (e) {
    console.error("Error during crafting process:", e.message);
    return res.status(500).json({
      message: "An error occurred during the crafting process.",
    });
  }
};

const armorerCraft = async (req, res) => {
  const playerId = req.user.playerId;
  const { type, material, rarity } = req.body;

  try {
    if (
      !armorerData[type] ||
      !armorerData[type][material] ||
      !armorerData[type][material][rarity]
    ) {
      console.log(
        "Invalid crafting parameters: type, material, or rarity is missing or incorrect: ",
        type,
        material,
        rarity
      );
      return res.status(400).json({
        message:
          "Invalid crafting parameters: type, material, or rarity is missing or incorrect.",
      });
    }

    const armorerConfig = armorerData[type][material][rarity];
    console.log("Armorer Config: ", armorerConfig);

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found." });
    }

    console.log(armorerConfig.materials);

    for (const material of armorerConfig.materials) {
      const item = player.inventory.find(
        (invItem) => invItem.name === material.name
      );

      if (!item || parseInt(item.quantity) < parseInt(material.quantity)) {
        return res.status(400).json({
          message: `Not enough ${material.name} in inventory.`,
        });
      }

      item.quantity -= material.quantity;
      console.log(
        `${material.name} deducated. Remaining ${material.name}: ${item.quantity}`
      );
    }

    const success = Math.random() * 100 <= armorerConfig.successRate;
    console.log(success);
    if (!success) {
      // Failed crafting, material loss or partial completion
      await player.save();
      return res
        .status(201)
        .json({ message: "Crafting failed. Material loss occurred." });
    }

    console.log(armorerConfig);

    const craftedItem = `${rarity} ${material} ${type}`;

    console.log(craftedItem);

    const existingItem = player.inventory.find(
      (item) => item.name === craftedItem
    );
    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      const itemId = uuidv4();
      player.inventory.push({
        item_id: itemId,
        name: craftedItem,
        quantity: 1,
      });
    }

    await player.save();

    const questItem = craftedItem.toLowerCase().replace(/\s+/g, "_");
    const questResult = await updateQuestProgress(
      playerId,
      "Crafting Basics",
      "craft",
      questItem,
      1
    );
    console.log("Quest progress updated:", questResult);

    return res.status(201).json({
      message: "Craft successful",
      craftedItem,
      inventory: player.inventory,
      xpGained: armorerConfig.xpGained,
      questUpdate: questResult,
    });
  } catch (e) {
    console.error("Error during crafting process:", e.message);
    return res.status(500).json({
      message: "An error occurred during the crafting process.",
    });
  }
};

const basicCraft = async (req, res) => {
  const playerId = req.user.playerId;
  const { item } = req.body;
  try {
    if (!basicsData[item]) {
      console.log(
        "Invalid crafting parameters: item is missing or incorrect: ",
        item
      );
      return res.status(400).json({
        message: "Invalid crafting parameters: item is missing or incorrect.",
      });
    }

    if (basicsData[item].requiredLevel > 0) {
      console.log("Base item detected, level required.");
      return res
        .status(400)
        .json({ message: "Base item detected, level required." });
    }

    const basicsConfig = basicsData[item];

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found." });
    }

    console.log(basicsConfig.materials);

    for (const material of basicsConfig.materials) {
      const item = player.inventory.find(
        (invItem) => invItem.name === material.name
      );

      if (!item || parseInt(item.quantity) < parseInt(material.quantity)) {
        return res.status(400).json({
          message: `Not enough ${material.name} in inventory.`,
        });
      }

      item.quantity -= material.quantity;
      console.log(
        `${material.name} deducated. Remaining ${material.name}: ${item.quantity}`
      );
    }

    const success = Math.random() * 100 <= basicsConfig.successRate;
    console.log(success);
    if (!success) {
      // Failed crafting, material loss or partial completion
      await player.save();
      return res
        .status(201)
        .json({ message: "Crafting failed. Material loss occurred." });
    }

    const existingItem = player.inventory.find((data) => data.name === item);
    console.log(`Existing item: ${existingItem}`);

    if (existingItem) {
      existingItem.quantity += 1;
      await existingItem.save();
      console.log(
        "The item already exists in the inventory, and its quantity has been increased by 1."
      );
    } else {
      const itemId = uuidv4();
      player.inventory.push({
        item_id: itemId,
        name: item,
        quantity: 1,
      });
      console.log(
        `The item has been added to the inventory - itemID: ${itemId}, name: ${item}, quantity: 1`
      );
    }

    const profession = player.profession_xp.find(
      (data) => data.profession === basicsConfig.jobs
    );

    if (profession) {
      profession.current_xp += basicsConfig.xpGained;
      console.log(`Current XP increased by ${basicsConfig.xpGained}`);
    } else {
      player.profession_xp.push({
        profession: basicsConfig.jobs,
        current_xp: basicsConfig.xpGained,
      });
      console.log(`Profession created: ${basicsConfig.jobs}`);
    }

    await player.save();

    // get xpGained
    const currentXpForPosition = player.profession_xp.find(
      (data) => data.profession === basicsConfig.jobs
    );

    return res.status(201).json({
      message: "Craft successful",
      craftedItem: item,
      inventory: player.inventory,
      xpGained: basicsConfig.xpGained,
    });
  } catch (e) {
    console.error("Error during crafting process:", e.message);
    return res.status(500).json({
      message: "An error occurred during the crafting process.",
    });
  }
};

module.exports = {
  blacksmithCraft,
  armorerCraft,
  basicCraft,
};
