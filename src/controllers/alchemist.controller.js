const playerSchema = require("../models/player.schema");
const mortarLevels = require("../data/mortars.json");
const recipes = require("../data/potion-recipes.json");
const potionQueueSchema = require("../models/potion-queue.schema");

const getMortarDataAndRecipes = async (req, res) => {
  try {
    const playerId = req.user.playerId;

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    // Ensure unlocked_recipes is an array before using .includes()
    if (!Array.isArray(player.unlocked_recipes)) {
      return res.status(500).json({
        message: "Player's unlocked recipes are not properly defined",
      });
    }

    const mortarData = mortarLevels[player.mortar_level - 1];
    console.log(mortarData);
    const availableRecipes = recipes.filter((recipe) =>
      player.unlocked_recipes.includes(recipe.id)
    );

    return res.status(200).json({
      mortar: {
        level: player.mortar_level,
        upgradeRequirements: mortarData.upgradeRequirements,
        perks: mortarData.perks,
      },
      recipes: availableRecipes,
    });
  } catch (e) {
    console.log(
      "An error occurred while retrieving mortar data and recipes: ",
      e
    );
    return res.status(500).json({
      message: "An error occurred while retrieving mortar data and recipes.",
    });
  }
};

const upgradeMorter = async (req, res) => {
  try {
    const { level } = req.body;
    const playerId = req.user.playerId;

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    const currentLevel = player.mortar_level;

    if (level <= currentLevel) {
      return res.status(400).json({ message: "Invalid level upgrade request" });
    }

    let totalRequiredStone = 0;

    for (let i = currentLevel; i < level; i++) {
      const upgradeReq = mortarLevels[i - 1]?.upgradeRequirements;
      if (!upgradeReq) {
        return res.status(400).json({ message: "Invalid level upgrade path" });
      }
      totalRequiredStone += upgradeReq.stone;
    }

    const stoneItem = player.inventory.find((item) => item.name === "Stone");

    if (!stoneItem || stoneItem.quantity < totalRequiredStone) {
      return res.status(400).json({ message: "Not enough Stone for upgrade" });
    }

    player.mortar_level = level;
    stoneItem.quantity -= totalRequiredStone;

    await player.save();

    return res.status(201).json({
      message: "Mortar upgraded successfully",
      level: player.mortar_level,
    });
  } catch (e) {
    console.error("Error in upgradeMortar:", e);
    return res.status(500).json({
      message: "Internal server error while upgrading mortar",
    });
  }
};

const craftPotion = async (req, res) => {
  try {
    const { recipeId, ingredients } = req.body;
    const playerId = req.user.playerId;

    if (!recipeId || typeof recipeId !== "number") {
      return res.status(400).json({ message: "Invalid or missing recipeId" });
    }

    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return res
        .status(400)
        .json({ message: "Invalid or missing ingredients" });
    }

    for (let ingredient of ingredients) {
      if (
        !ingredient.name ||
        typeof ingredient.name !== "string" ||
        !ingredient.amount ||
        typeof ingredient.amount !== "number" ||
        ingredient.amount <= 0
      ) {
        return res.status(400).json({ message: "Invalid ingredient format" });
      }
    }

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) {
      return res.status(400).json({ message: "Recipe not found" });
    }

    const canCraft = ingredients.every((ingredient) => {
      const playerIngredient = player.inventory.find(
        (i) => i.name === ingredient.name
      );
      return playerIngredient && playerIngredient.quantity >= ingredient.amount;
    });

    if (!canCraft) {
      return res
        .status(400)
        .json({ message: "Not enough ingredients for crafting" });
    }

    for (let ingredient of recipe.ingredients) {
      const item = player.inventory.find((i) => i.name === ingredient.name);
      item.quantity -= ingredient.amount;
      if (item.quantity <= 0) {
        player.inventory = player.inventory.filter(
          (i) => i.name !== ingredient.name
        );
      }
    }

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + recipe.craftingTime);

    const craftingProcess = await potionQueueSchema.create({
      startTime,
      endTime,
      player_id: playerId,
      recipe_id: recipeId,
    });

    await player.save();

    return res.status(200).json({
      message: `Crafting started! It will be ready in ${
        recipe.craftingTime / 1000
      } seconds.`,
      craftingProcess: {
        ...craftingProcess.toObject(),
        player_id: playerId.toString("hex"),
      },
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getMortarDataAndRecipes,
  upgradeMorter,
  craftPotion,
};
