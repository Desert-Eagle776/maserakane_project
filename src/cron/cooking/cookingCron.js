const cron = require("node-cron");
const cookingQueueSchema = require("../../models/cooking-queue.schema");
const playerSchema = require("../../models/player.schema");
const recipes = require("../../data/cooking-recipes.json");

const processCookingQueue = async () => {
  try {
    console.log("Checking cooking status...");
    const now = new Date();

    const cookingProcesses = await cookingQueueSchema.find({
      status: "pending",
      endTime: { $lte: now },
    });

    for (const process of cookingProcesses) {
      const player = await playerSchema.findById(process.player_id);
      if (!player) {
        process.status = "failed";
        await process.save();
        console.log(`Player ${process.player_id} not found, cooking canceled.`);
        continue;
      }

      const recipe = recipes.find((r) => r.id === process.recipe_id);
      if (!recipe) {
        process.status = "failed";
        await process.save();
        console.log(`Recipe ${process.recipe_id} not found, cooking canceled.`);
        continue;
      }

      const success = Math.random() * 100 < recipe.successRate;
      let dishName;
      if (success) {
        for (let result in recipe.result) {
          dishName = result;

          const item = player.inventory.find((i) => i.name === result);
          if (item) {
            item.quantity += recipe.result[result];
            console.log(recipe.result[result], "IF");
          } else {
            console.log(recipe.result[result]), "ELSE";
            player.inventory.push({
              name: result,
              quantity: recipe.result[result],
            });
          }
        }

        await player.save();
        process.status = "completed";
        console.log(`Cooking completed: ${dishName} for player ${player._id}`);
      } else {
        process.status = "failed";
        console.log(`Cooking ${dishName} failed for player ${player._id}`);
      }

      await process.save();
    }
  } catch (error) {
    console.error("Error updating cooking status:", error);
  }
};

// Run cron every 5 seconds
cron.schedule("*/5 * * * * *", processCookingQueue);

module.exports = {
  processCookingQueue,
};
