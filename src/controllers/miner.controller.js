const nodesData = require("../data/nodes.json");
const playerSchema = require("../models/player.schema");

const mineNode = async (req, res) => {
  try {
    const { nodeId } = req.body;
    const playerId = req.user.playerId;

    if (
      !playerId ||
      typeof playerId !== "string" ||
      !nodeId ||
      typeof nodeId !== "string"
    ) {
      return res.status(400).json({
        message:
          "Invalid request: playerId and nodeId must be non-empty strings",
      });
    }

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    const node = nodesData.find((n) => n.id === nodeId);
    if (!node) {
      return res.status(404).json({ message: "Mining node not found" });
    }

    const lastMined = player.minedNodes.get(nodeId);
    if (
      lastMined &&
      Date.now() - new Date(lastMined).getTime() < 6 * 60 * 60 * 1000
    ) {
      return res.status(400).json({ message: "Node is still on cooldown" });
    }

    const minedResources = [];
    node.possibleDrops.forEach((drop) => {
      if (Math.random() * 100 < drop.dropChance) {
        let resource = minedResources.find((r) => r.itemName === drop.itemName);
        if (!resource) {
          minedResources.push({
            name: drop.itemName,
            quantity: drop.quantity,
            rarity: drop.rarity,
          });
        } else {
          resource.quantity += drop.quantity;
        }
      }
    });

    if (minedResources.length === 0) {
      return res.status(400).json({ message: "No resources were mind" });
    }

    minedResources.forEach((newItem) => {
      let existingItem = player.inventory.find(
        (item) => item.name === newItem.name
      );

      if (!existingItem) {
        player.inventory.push(newItem);
      }

      existingItem.quantity += newItem.quantity;
    });

    if (player.minedNodes.has(nodeId)) {
      player.minedNodes.delete(nodeId);
    }

    player.minedNodes.set(nodeId, new Date());

    await player.save();

    return res
      .status(201)
      .json({ message: "Mining successful", minedResources });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: "An error occurred while mining" });
  }
};

module.exports = {
  mineNode,
};
