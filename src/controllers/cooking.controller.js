const playerSchema = require("../models/player.schema");
const recipes = require("../data/cooking-recipes.json");
const cookingQuqueSchema = require("../models/cooking-queue.schema");

const upgradeFireplace = async (req, res) => {
  try {
    const playerId = req.user.playerId;

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    const stoneRequired = player.fireplaceLevel * 5; //for example, each level requires more stone
    const stoneItem = player.inventory.find((item) => item.name === "Stone");

    if (!stoneItem || stoneItem.quantity < stoneRequired) {
      return res.status(400).json({ message: "Not enough stone" });
    }

    stoneItem.quantity -= stoneRequired;
    player.fireplaceLevel += 1;

    await player.save();

    return res
      .status(200)
      .json({ message: "Fireplace upgraded!", level: player.fireplaceLevel });
  } catch (e) {
    console.log(e);
    return res
      .status(500)
      .json({ message: "An error occurred while upgrading the fireplace" });
  }
};

const getAvailableRecipes = async (req, res) => {
  try {
    const playerId = req.user.playerId;

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    const availableRecipes = recipes.filter(
      (r) => player.fireplaceLevel >= r.requiredLevel
    );

    return res.status(200).json({ recipes: availableRecipes });
  } catch (e) {
    console.log(e);
    return res.status(500).json({
      message: "An error occurred while retrieving available recipes",
    });
  }
};

const cookRecipe = async (req, res) => {
  try {
    const { recipeId } = req.body;
    const playerId = req.user.playerId;

    if (!recipeId || typeof recipeId !== "string" || !recipeId.length) {
      return res.status(400).json({ message: "Invalid or missing recipeId" });
    }

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) {
      return res.status(400).json({ message: "Recipe not found" });
    }

    if (player.fireplaceLevel < recipe.requiredLevel) {
      return res.status(400).json({ message: "Fireplace level too low" });
    }

    for (let ingredient in recipe.ingredients) {
      const item = player.inventory.find((i) => i.name === ingredient);
      if (!item || item.quantity < recipe.ingredients[ingredient]) {
        return res.status(400).json({ message: `Not enough ${ingredient}` });
      }
    }

    for (let fuel in recipe.fuel) {
      const item = player.inventory.find((i) => i.name === fuel);
      if (!item || item.quantity < recipe.fuel[fuel]) {
        return res.status(400).json({ message: `Not enough ${fuel}` });
      }
    }

    for (let ingredient in recipe.ingredients) {
      const item = player.inventory.find((i) => i.name === ingredient);
      item.quantity -= recipe.ingredients[ingredient];
      if (item.quantity <= 0) {
        player.inventory = player.inventory.filter(
          (i) => i.name !== ingredient
        );
      }
    }

    for (let fuel in recipe.fuel) {
      const item = player.inventory.find((i) => i.name === fuel);
      item.quantity -= recipe.fuel[fuel];
      if (item.quantity <= 0) {
        player.inventory = player.inventory.filter((i) => i.name !== fuel);
      }
    }

    await player.save();

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + recipe.cookingTime);

    const cookingProcess = await cookingQuqueSchema.create({
      startTime,
      endTime,
      player_id: playerId,
      recipe_id: recipeId,
    });

    const playerIdString = cookingProcess.player_id.toString("hex");

    return res.status(200).json({
      message: `Cooking started! It will be ready in ${
        recipe.cookingTime / 1000
      } seconds`,
      cookingProcess: {
        ...cookingProcess.toObject(),
        player_id: playerIdString,
      },
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({
      message: "An error occurred while retrieving available recipes",
    });
  }
};

module.exports = {
  upgradeFireplace,
  getAvailableRecipes,
  cookRecipe,
};
