const fs = require("fs");
const path = require("path");
const asyncQueue = require("async/queue");
const cropsData = require("../data/crops.json");
const mapsData = require("../../maps/main_maps.json");
const zonesData = require("../data/zones.json");
const plantedCropsSchema = require("../models/planted-crops.schema");
const plantedCropSchema = require("../models/planted-crops.schema");
const playerSchema = require("../models/player.schema");

const mainMapsPath = path.resolve(__dirname, "..", "..", "maps/main_maps.json");

const plant = async (req, res) => {
  try {
    const playerId = req.user.playerId;
    const { cropId, mapId, position } = req.body;

    if (!cropId || !playerId || !mapId || !position) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    //Convert “x12y31” to “12,31” (example)
    const modifyPosition = position.replace(/x(\d+)y(\d+)/, "$1,$2");

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    const crop = cropsData.crops.find((c) => c.id === cropId);
    if (!crop) {
      return res.status(400).json({ message: "Crop not found" });
    }

    const cropInPlayer = player.inventory.find(
      (item) => item.name === crop.name
    );
    if (!cropInPlayer) {
      return res.status(404).json({ message: "Crop not found in inventory" });
    }

    if (!fs.existsSync(mainMapsPath)) {
      console.error("Map data file not found at:", mainMapsPath);
      return res.status(500).json({ message: "Map data not found." });
    }

    const mapsHashmap = JSON.parse(fs.readFileSync(mainMapsPath, "utf-8"));

    const map = mapsHashmap[mapId];
    const cell = map[modifyPosition];

    if (!cell || cell.type !== "field" || cell.players.length > 0) {
      return res
        .status(400)
        .json({ message: "The cell is not available for planting" });
    }

    const plantedCrop = await plantedCropSchema.create({
      cropId,
      mapId,
      position,
      player_id: playerId,
      plantType: crop.type,
      growthStage: crop.growth_stages[0].name,
      timeRemaining: crop.growth_stages[0].duration,
      lastStageChange: new Date().toISOString(),
      plantedAt: new Date().toISOString(),
    });

    if (cropInPlayer && cropInPlayer.quantity <= 0) {
      await player.inventory.deleteOne({ cropId: cropInPlayer.cropId });
    }

    cell.players.push({ playerId, timestamp: new Date().toISOString() });

    fs.writeFileSync(
      mainMapsPath,
      JSON.stringify(mapsHashmap, null, 2),
      "utf-8"
    );
    console.log("Updated map data saved.");

    const playerIdString = plantedCrop.player_id.toString("hex");

    return res.status(201).json({
      message: "Crop planted successfully",
      crop: {
        ...plantedCrop.toObject(),
        player_id: playerIdString,
      },
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: "Server error" });
  }
};

const statusCrop = async (req, res) => {
  try {
    const { cropId } = req.params;
    const playerId = req.user.playerId;

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    const cropPlanted = await plantedCropsSchema.findOne({
      cropId: Number(cropId),
      player_id: playerId,
    });
    if (!cropPlanted) {
      return res.status(400).json({ message: "The seed was not planted" });
    }

    const playerIdString = cropPlanted.player_id.toString("hex");

    return res.status(200).json({
      message: "The crop status has been successfully retrieved",
      crop: {
        ...cropPlanted.toObject(),
        player_id: playerIdString,
      },
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: "Server error" });
  }
};

const performAction = async (req, res) => {
  try {
    const { cropId } = req.params;
    console.log(cropId);
    const { action } = req.body;
    const playerId = req.user.playerId;

    if (!action || !cropId || !playerId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    const cropsActionsData = cropsData.crops.find(
      (crop) => crop.id === Number(cropId)
    );
    if (!cropsActionsData) {
      return res.status(404).json({ message: "Crop not found" });
    }

    const validActions = cropsActionsData.actions.map((a) =>
      a.action.toLowerCase()
    );
    if (!validActions.includes(action.toLowerCase())) {
      return res
        .status(400)
        .json({ message: `Action "${action}" is not valid for this crop` });
    }

    const cropInPlayer = player.inventory.find(
      (item) => item.name === cropsActionsData.name
    );
    if (!cropInPlayer) {
      const newCrop = {
        name: cropsActionsData.name,
        quantity: cropsActionsData.quantity,
      };
      player.inventory.push(newCrop);
    } else {
      cropInPlayer.quantity += cropsActionsData.quantity;
    }

    await player.save();

    return res.status(200).json({
      message: `Action "${action}" performed successfully on the crop`,
      crop: {
        playerId,
        name: cropsActionsData.name,
        type: cropsActionsData.type,
        growth_time: cropsActionsData.growth_time,
      },
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: "Server error" });
  }
};

const harvest = async (req, res) => {
  try {
    const { cropId } = req.params;
    const playerId = req.user.playerId;

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    const cropPlanted = await plantedCropsSchema.findOne({
      _id: cropId,
      player_id: playerId,
    });

    if (!cropPlanted) {
      return res.status(404).json({ message: "Crop not found" });
    }

    // Check the growth stage
    if (cropPlanted.growthStage !== "Mature") {
      return res.status(400).json({
        message: `The crop "${cropPlanted.plantType}" is not ready for harvest.`,
      });
    }

    if (!fs.existsSync(mainMapsPath)) {
      console.error("Map data file not found at:", mainMapsPath);
      return res.status(500).json({ message: "Map data not found." });
    }

    const position = cropPlanted.position.replace(/x(\d+)y(\d+)/, "$1,$2");
    const mapsHashmap = JSON.parse(fs.readFileSync(mainMapsPath, "utf-8"));

    const map = mapsHashmap[cropPlanted.mapId];
    const cell = map[position];

    const baseHarvest = 1;
    const bonusChance = 0.2; // 20% chance for double harvest
    const harvestAmount =
      Math.random() < bonusChance ? baseHarvest * 2 : baseHarvest;

    const cropDetails = cropsData.crops.find(
      (c) => c.id === cropPlanted.cropId
    );
    if (!cropDetails) {
      return res.status(404).json({ message: "Crop not found" });
    }

    let cropInPlayer = player.inventory.find(
      (item) => item.name === cropDetails.harvest
    );
    if (!cropInPlayer) {
      cropInPlayer = { name: cropDetails.harvest, quantity: harvestAmount };
      player.inventory.push(cropInPlayer);
    }

    console.log(cropInPlayer);

    cropInPlayer.quantity += harvestAmount;
    await player.save();

    console.log(cell);

    cell.players = [];

    fs.writeFileSync(
      mainMapsPath,
      JSON.stringify(mapsHashmap, null, 2),
      "utf-8"
    );
    console.log("Updated map data saved.");

    // Remove the crop after harvesting
    await plantedCropsSchema.deleteOne({ _id: cropPlanted._id });

    return res.status(201).json({
      message: `Harvest successful. You received ${harvestAmount} crops.`,
      harvestAmount,
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({ message: "Server error" });
  }
};

const getFarmingZones = async (req, res) => {
  try {
    const freeZones = [];

    for (const map in mapsData) {
      for (position in mapsData[map]) {
        const cell = mapsData[map][position];

        if (cell.type && cell.type === "field" && cell.players.length === 0) {
          freeZones.push({
            map,
            position,
            name: cell.name,
            type: cell.type,
          });
        }
      }
    }

    return res.status(200).json({
      message: "Available farming zones retrieved successfully",
      zones: freeZones,
    });
  } catch (error) {
    console.error("Error retrieving available farming zones:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

function parseTimeToMilliseconds(time) {
  const regex = /(\d+)(h|m)/g;
  let totalMilliseconds = 0;

  let match;
  while ((match = regex.exec(time)) !== null) {
    const value = parseInt(match[1], 10);
    const unit = match[2];

    if (unit === "h") {
      totalMilliseconds += value * 60 * 60 * 1000;
    } else if (unit === "m") {
      totalMilliseconds += value * 60 * 1000;
    }
  }

  return totalMilliseconds;
}

const updatePlantStages = async () => {
  console.log(`[${new Date().toISOString()}] Cron job started`);

  try {
    const crops = await plantedCropsSchema
      .find({
        lastStageChange: {
          $lt: new Date(Date.now() - parseTimeToMilliseconds("5m")),
        },
      })
      .limit(100);

    if (crops.length === 0) {
      console.log(`[${new Date().toISOString()}] No crops to update`);
      return;
    }

    console.log(
      `[${new Date().toISOString()}] Found ${crops.length} crops to update`
    );

    const queue = asyncQueue(async (crop) => {
      const cropData = cropsData.crops.find((c) => c.id === crop.cropId);
      if (!cropData) return;

      const currentStageIndex = cropData.growth_stages.findIndex(
        (stage) => stage.name === crop.growthStage
      );

      if (
        currentStageIndex === -1 ||
        currentStageIndex === cropData.growth_stages.length - 1
      )
        return;

      const currentStage = cropData.growth_stages[currentStageIndex];
      const nextStage = cropData.growth_stages[currentStageIndex + 1];

      const currentTime = new Date();
      const timeElapsed = currentTime - new Date(crop.lastStageChange);

      const stageDuration = parseTimeToMilliseconds(currentStage.duration);

      if (timeElapsed >= stageDuration) {
        if (nextStage) {
          crop.growthStage = nextStage.name;
          crop.lastStageChange = currentTime;
          crop.timeRemaining = parseTimeToMilliseconds(nextStage.duration);
          console.log(
            `[${new Date().toISOString()}] Crop ${crop._id} updated to stage ${
              nextStage.name
            }`
          );
        } else {
          crop.readyToHarvest = true;
          crop.timeRemaining = null;
          console.log(
            `[${new Date().toISOString()}] Crop ${crop._id} is ready to harvest`
          );
        }

        await crop.save();
      }
    }, 10);

    crops.forEach((crop) => {
      queue.push(crop);
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Error updating plant stages:`,
      error
    );
  }

  console.log(`[${new Date().toISOString()}] Cron job completed`);
};

module.exports = {
  plant,
  statusCrop,
  performAction,
  harvest,
  getFarmingZones,
  parseTimeToMilliseconds,
  updatePlantStages,
};
