const playerSchema = require("../models/player.schema");
const mortarLevels = require("../data/mortars.json");
const recipes = require("../data/potion-recipes.json");

const getMortarDataAndRecipes = async (req, res) => {
  try {
    const playerId = req.user.playerId;

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
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

    // Виконуємо апгрейд
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

    const playerIngredients = [];
    for (let i = 0; i < ingredients.length; i++) {
      const item = player.inventory.find(
        (itm) => itm.name === ingredients[i].name
      );
      if (item) {
        item.quantity -= ingredients[i].amount;
        playerIngredients.push(item);
      }
    }

    const success = Math.random() * 100 < recipe.successRate;
    if (!success) {
      await player.save();
      return res
        .status(200)
        .json({ messgae: "Crafting failed. Ingredients deducted." });
    }

    const potion = {
      name: recipe.name,
      effects: recipe.effects,
    };

    player.inventory.push({ name: potion.name, quantity: 1 });
    await player.save();

    return res.status(200).json({ message: "Crafting successful", potion });
  } catch (e) {
    console.log(e);
  }
};

module.exports = {
  getMortarDataAndRecipes,
  upgradeMorter,
  craftPotion,
};
