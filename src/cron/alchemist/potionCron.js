const cron = require("node-cron");
const potionQueueSchema = require("../../models/potion-queue.schema");
const playerSchema = require("../../models/player.schema");
const recipes = require("../../data/potion-recipes.json");

const processPotionQueue = async () => {
  try {
    console.log("Checking potion status...");

    const now = new Date();
    const craftingProcesses = await potionQueueSchema.find({
      status: "pending",
      endTime: { $lte: now },
    });

    console.log(
      `Found ${craftingProcesses.length} potion(s) ready for completion.`
    );

    for (let process of craftingProcesses) {
      console.log(`Processing potion crafting ID: ${process._id}`);

      const player = await playerSchema.findById(process.player_id);
      const recipe = recipes.find((r) => r.id === process.recipe_id);

      if (!player) {
        console.log(
          `Player with ID ${process.player_id} not found. Deleting process.`
        );
        await potionQueueSchema.findByIdAndDelete(process._id);
        continue;
      }

      if (!recipe) {
        console.log(
          `Recipe with ID ${process.recipe_id} not found. Deleting process.`
        );
        await potionQueueSchema.findByIdAndDelete(process._id);
        continue;
      }

      console.log(`Player: ${player._id}, Recipe: ${recipe.name}`);

      const success = Math.random() * 100 < recipe.successRate;
      if (success) {
        console.log(`Crafting SUCCESS! ${recipe.name} added to inventory.`);

        const potion = { name: recipe.name, quantity: 1 };
        const existingItem = player.inventory.find(
          (i) => i.name === potion.name
        );

        if (existingItem) {
          existingItem.quantity += potion.quantity;
          console.log(
            `Updated inventory: ${potion.name} x${existingItem.quantity}`
          );
        } else {
          player.inventory.push(potion);
          console.log(`Added new potion: ${potion.name}`);
        }

        process.status = "completed";
      } else {
        console.log(`Crafting FAILED for ${recipe.name}.`);
        process.status = "failed";
      }

      await player.save();
      await process.save();
      console.log(
        `Process ${process._id} updated with status: ${process.status}`
      );
    }

    console.log("Potion processing cycle completed.\n");
  } catch (e) {
    console.error("Crafting cron error:", e);
  }
};

// Run cron every 5 seconds
cron.schedule("*/5 * * * * *", processPotionQueue);

module.exports = {
  processPotionQueue,
};
