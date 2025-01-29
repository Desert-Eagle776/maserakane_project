const monsters = require("../../monsters.json");
const playerSchema = require("../models/player.schema");

const killMonster = async (req, res) => {
  try {
    const monsterName = req.body.name;
    const playerId = req.user.playerId;

    console.log(
      `Received request to kill monster: ${monsterName} for player ID: ${playerId}`
    );

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    console.log(
      `Player data retrieved: Inventory - ${player.inventory}, Money - ${player.money}`
    );

    const monster = monsters.find((m) => m.name === monsterName);
    if (!monster) {
      console.warn(`Monster '${monsterName}' not found.`);
      return res.status(404).json({ message: "Monster not found." });
    }

    console.log(`Monster found: ${monsterName}, calculating rewards...`);

    const droppedItems = monster.rewards.items.filter(
      (item) => Math.random() < item.dropRate
    );
    const droppedItemNames = droppedItems.map((item) => item.name);
    droppedItemNames.forEach((itemName) => {
      const itemInInventory = player.inventory.find(
        (item) => item.name === itemName
      );

      if (itemInInventory) {
        itemInInventory.quantity += 1;
      } else {
        player.inventory.push({ name: itemName, quantity: 1 });
      }
    });

    console.log(`Items dropped by ${monsterName}:`, droppedItemNames);

    const goldEarned =
      Math.floor(
        Math.random() *
          (monster.rewards.gold.max - monster.rewards.gold.min + 1)
      ) + monster.rewards.gold.min;
    const newMoney = player.money.gold + goldEarned;
    // Expérience gagnée
    const xpGained = monster.rewards.xp;

    console.log(`Gold earned: ${goldEarned}, Total new money: ${newMoney}`);

    player.money.gold = newMoney;

    await player.save();

    console.log(
      `Player ${playerId} successfully updated after killing ${monsterName}`
    );

    return res.status(201).json({
      message: "Monster defeated! Rewards added.",
      rewards: {
        items: droppedItemNames,
        gold: goldEarned,
        xp: xpGained,
      },
    });
  } catch (e) {
    console.log("Server error while kill monster: ", e);
    return res.status(500).json({ message: "Server error while kill monster" });
  }
};

module.exports = {
  killMonster,
};
