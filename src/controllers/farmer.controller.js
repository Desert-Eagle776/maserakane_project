const asyncQueue = require("async/queue");
const cropsData = require("../data/crops.json");
const zonesData = require("../data/zones.json");
const plantedCropsSchema = require("../models/planted-crops.schema");
const plantedCropSchema = require("../models/planted-crops.schema");
const playerSchema = require("../models/player.schema");

const plant = async (req, res) => {
  try {
    const playerId = req.user.playerId;
    const { cropId, farmingZone } = req.body;

    if (!cropId || !playerId || !farmingZone) {
      return res.status(400).json({ message: "Missing required fields" });
    }

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

    const zone = zonesData.zones.find((z) => z.zoneId === farmingZone);
    if (!zone) {
      return res.status(400).json({ message: "Zone not found" });
    }

    if (!zone.allowedCrops.includes(crop.name)) {
      return res.status(400).json({
        message: `The crop "${crop.name}" cannot be planted in zone "${zone.name}"`,
      });
    }

    const plantedCrop = await plantedCropSchema.create({
      cropId,
      farmingZone,
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

    const playerIdString = plantedCrop.player_id.toString("hex");

    return res.status(201).json({
      message: "Crop planted successfully",
      crop: {
        ...plantedCrop.toObject(),
        playerIdString,
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

    // const crop = await plantedCropsSchema.findOne({
    //   cropId: cropId,
    //   player_id: playerId,
    // });

    // if (!crop) {
    //   return res.status(400).json({ message: "Crop not found" });
    // }

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

    // crop.lastAction = action;
    // await crop.save();

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

    // const playerIdString = crop.player_id.toString("hex");

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

    const player = playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    const cropPlanted = await plantedCropsSchema.findOne({
      cropId: Number(cropId),
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

    const baseHarvest = 1;
    const bonusChance = 0.2; // 20% chance for double harvest
    const harvestAmount =
      Math.random() < bonusChance ? baseHarvest * 2 : baseHarvest;

    const cropDetails = cropsData.crops.find((c) => c.id === cropId);
    if (!cropDetails) {
      return res.status(404).json({ message: "Crop not found" });
    }

    const cropInPlayer = player.inventory.find(
      (item) => item.name === cropDetails.harvest
    );
    if (!cropInPlayer) {
      const newCrop = { name: cropDetails.harvest, quantity: harvestAmount };
      player.inventory.push(newCrop);
    }

    cropInPlayer.quantity += harvestAmount;
    await player.save();

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
    // Отримуємо всі посаджені культури
    const plantedCrops = await plantedCropsSchema.find();

    // Створюємо множину зайнятих зон
    const occupiedZones = new Set(plantedCrops.map((crop) => crop.zoneId));

    // Фільтруємо зони, залишаючи лише вільні
    const freeZones = zonesData.zones.filter(
      (zone) => !occupiedZones.has(zone.zoneId)
    );

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
      totalMilliseconds += value * 60 * 60 * 1000; // Перетворюємо години в мілісекунди
    } else if (unit === "m") {
      totalMilliseconds += value * 60 * 1000; // Перетворюємо хвилини в мілісекунди
    }
  }

  return totalMilliseconds; // Повертаємо в мілісекундах
}

// Функція для оновлення стадії рослин
const updatePlantStages = async () => {
  console.log(`[${new Date().toISOString()}] Cron job started`); // Лог початку виконання

  try {
    // Замість вибору всіх рослин, вибираємо лише ті, які потребують оновлення
    const crops = await plantedCropsSchema
      .find({
        lastStageChange: {
          $lt: new Date(Date.now() - parseTimeToMilliseconds("5m")), // перевіряємо, чи пройшло більше 5 хвилин
        },
      })
      .limit(100); // обмежуємо кількість рослин для обробки (наприклад, 100)

    if (crops.length === 0) {
      console.log(`[${new Date().toISOString()}] No crops to update`); // Лог, якщо не знайдено рослин для оновлення
      return;
    }

    console.log(
      `[${new Date().toISOString()}] Found ${crops.length} crops to update`
    ); // Лог кількості рослин для оновлення

    // Черга для обробки рослин
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
      const timeElapsed = currentTime - new Date(crop.lastStageChange); // Вимірюємо час, що минув

      const stageDuration = parseTimeToMilliseconds(currentStage.duration); // Тривалість поточної стадії в мілісекундах

      if (timeElapsed >= stageDuration) {
        // Якщо рослина дозріла (переміщається на наступну стадію або готова до збирання)
        if (nextStage) {
          crop.growthStage = nextStage.name;
          crop.lastStageChange = currentTime; // Оновлюємо час зміни стадії
          crop.timeRemaining = parseTimeToMilliseconds(nextStage.duration); // Оновлюємо час до завершення наступної стадії
          console.log(
            `[${new Date().toISOString()}] Crop ${crop._id} updated to stage ${
              nextStage.name
            }`
          ); // Лог успішного оновлення
        } else {
          // Якщо наступної стадії немає, рослина дозріла
          crop.readyToHarvest = true; // Додаємо поле "готова до збирання"
          crop.timeRemaining = null; // Якщо готова до збирання, значення timeRemaining стає null
          console.log(
            `[${new Date().toISOString()}] Crop ${crop._id} is ready to harvest`
          );
        }

        // Оновлюємо рослину в базі даних
        await crop.save();
      }
    }, 10); // Максимум 10 одночасних завдань

    // Додаємо рослини в чергу
    crops.forEach((crop) => {
      queue.push(crop);
    });
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Error updating plant stages:`,
      error
    ); // Лог помилки
  }

  console.log(`[${new Date().toISOString()}] Cron job completed`); // Лог завершення виконання
};

// // Функція для оновлення стадії рослин
// const updatePlantStages = async () => {
//   console.log(`[${new Date().toISOString()}] Cron job started`); // Лог початку виконання

//   try {
//     // Замість вибору всіх рослин, вибираємо лише ті, які потребують оновлення
//     const crops = await plantedCropsSchema
//       .find({
//         lastStageChange: {
//           $lt: new Date(Date.now() - parseTimeToMilliseconds("5m")),
//         }, // перевіряємо, чи пройшло більше 5 хвилин
//       })
//       .limit(100); // обмежуємо кількість рослин для обробки (наприклад, 100)

//     if (crops.length === 0) {
//       console.log(`[${new Date().toISOString()}] No crops to update`); // Лог, якщо не знайдено рослин для оновлення
//       return;
//     }

//     console.log(
//       `[${new Date().toISOString()}] Found ${crops.length} crops to update`
//     ); // Лог кількості рослин для оновлення

//     // Черга для обробки рослин
//     const queue = asyncQueue(async (crop) => {
//       const cropData = cropsData.crops.find((c) => c.id === crop.cropId);
//       if (!cropData) return;

//       const currentStageIndex = cropData.growth_stages.findIndex(
//         (stage) => stage.name === crop.growthStage
//       );

//       if (
//         currentStageIndex === -1 ||
//         currentStageIndex === cropData.growth_stages.length - 1
//       )
//         return;

//       const currentStage = cropData.growth_stages[currentStageIndex];
//       const nextStage = cropData.growth_stages[currentStageIndex + 1];

//       const currentTime = new Date();
//       const timeElapsed = currentTime - new Date(crop.lastStageChange); // Вимірюємо час, що минув

//       const stageDuration = parseTimeToMilliseconds(currentStage.duration); // Тривалість поточної стадії в мілісекундах
//       if (timeElapsed >= stageDuration) {
//         // Оновлюємо рослину на наступну стадію
//         crop.growthStage = nextStage.name;
//         crop.lastStageChange = currentTime; // Оновлюємо час зміни стадії
//         await crop.save();
//         console.log(
//           `[${new Date().toISOString()}] Crop ${crop._id} updated to stage ${
//             nextStage.name
//           }`
//         ); // Лог успішного оновлення
//       }
//     }, 10); // Максимум 10 одночасних завдань

//     // Додаємо рослини в чергу
//     crops.forEach((crop) => {
//       queue.push(crop);
//     });
//   } catch (error) {
//     console.error(
//       `[${new Date().toISOString()}] Error updating plant stages:`,
//       error
//     ); // Лог помилки
//   }

//   console.log(`[${new Date().toISOString()}] Cron job completed`); // Лог завершення виконання
// };

module.exports = {
  plant,
  statusCrop,
  performAction,
  harvest,
  getFarmingZones,
  parseTimeToMilliseconds,
  updatePlantStages,
};
