const cron = require("node-cron");
const craftQueueSchema = require("../../models/craft-queue.schema");
const playerSchema = require("../../models/player.schema");
const { updateQuestProgress } = require("../../controllers/quest.controller");

const processCraftQueue = async () => {
  try {
    console.log("Starting blacksmith queue processing...");

    const now = new Date();
    console.log(`Current time: ${now.toISOString()}`);

    const pendingCrafts = await craftQueueSchema.find({
      endTime: { $lte: now },
      status: "pending",
    });

    console.log(`Found ${pendingCrafts.length} pending crafts.`);

    for (const craft of pendingCrafts) {
      console.log(`Processing craft: ${craft._id}`);
      console.log(`Player ID: ${craft.player_id}`);
      console.log(`Success rate: ${craft.successRate}%`);
      console.log(`Craft endTime: ${craft.endTime}`);

      const randomValue = Math.random() * 100;
      console.log(`Generated random value: ${randomValue}`);

      const success = randomValue < craft.successRate;
      console.log(`Craft success: ${success}`);

      craft.status = success ? "completed" : "failed";
      await craft.save();
      console.log(`Updated craft status to: ${craft.status}`);

      if (success) {
        console.log("Craft was successful! Fetching player data...");
        const player = await playerSchema.findById(craft.player_id);

        if (player) {
          console.log(`Player found: ${player._id}`);
          const newItem = {
            name: `${craft.rarity} ${craft.material} ${craft.type}`,
            quantity: 1,
          };

          console.log(`New item to be added: ${newItem.name}`);

          const existingItem = player.inventory.find(
            (item) => item.name === newItem.name
          );

          if (existingItem) {
            console.log(
              `Item already exists in inventory, increasing quantity.`
            );
            existingItem.quantity += 1;
          } else {
            console.log(`Item not found in inventory, adding new item.`);
            player.inventory.push(newItem);
          }

          await player.save();
          console.log("Player inventory updated.");
        } else {
          console.log("Player not found, skipping inventory update.");
        }

        const questItem = craft.type.toLowerCase().replace(/\s+/g, "_");
        console.log(`Updating quest progress for item: ${questItem}`);

        const questResult = await updateQuestProgress(
          craft.player_id,
          "Crafting Basics",
          "craft",
          questItem,
          1
        );

        console.log("Quest progress updated:", questResult);
      }
    }

    console.log("Blacksmith queue processing completed.");
  } catch (e) {
    console.error("Error during cron job:", e);
  }
};

// Run cron every 5 seconds
cron.schedule("*/5 * * * * *", processCraftQueue);

module.exports = {
  processCraftQueue,
};
