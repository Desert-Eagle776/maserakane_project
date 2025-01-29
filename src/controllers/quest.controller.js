const fs = require("fs");
const quests = require("../../quests.json");
const playerQuestSchema = require("../models/player-quest.schema");
const playerSchema = require("../models/player.schema");

const questStart = async (req, res) => {
  try {
    const { questName } = req.body;
    const playerId = req.user.playerId;

    if (!questName) {
      return res
        .status(400)
        .json({ message: `Missing required field: ${questName}` });
    }

    const quest = quests.quests.find(
      (quest) => quest.name.toLowerCase() === questName.toLowerCase()
    );

    if (!quest) {
      return res.status(400).json({ message: "Invalid quest name" });
    }

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    await playerQuestSchema.create({
      player_id: playerId,
      quest_name: questName,
      current_step: quest.steps[0].id,
    });

    console.log("The quest start data has been successfully saved");

    return res.status(201).json({
      message: "Quest started!",
      step: quest.steps[0],
    });
  } catch (e) {
    console.log("Server error while starting quest: ", e);
    return res
      .status(500)
      .json({ message: "Server error while starting quest" });
  }
};

const questProgress = async (req, res) => {
  try {
    const { questName, itemCollected, quantity } = req.body;
    const playerId = req.user.playerId;

    if (!questName || !itemCollected || quantity === undefined) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const quest = quests.quests.find(
      (quest) => quest.name.toLowerCase() === questName.toLowerCase()
    );

    console.log("Quest: ", quest);

    if (!quest) {
      return res.status(400).json({ message: "Invalid quest name" });
    }

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    const questProgress = await playerQuestSchema.findOne({
      player_id: playerId,
      quest_name: questName,
    });

    if (!questProgress) {
      return res
        .status(404)
        .json({ message: "Quest not found or not started" });
    }

    console.log("Quest progress: ", questProgress);

    if (questProgress.completed) {
      return res.status(400).json({ message: "Quest completed" });
    }

    const currentStep = quest.steps.find(
      (step) => step.id === questProgress.current_step
    );

    // If the task field is missing
    if (
      !currentStep.task ||
      !currentStep.task.items ||
      currentStep.task.items.length === 0
    ) {
      currentStep.reward.items.forEach((rewardItem) => {
        const itemInInventory = player.inventory.find(
          (item) => item.name === rewardItem.name
        );

        if (itemInInventory) {
          itemInInventory.quantity += rewardItem.quantity;
        } else {
          player.inventory.push({
            name: rewardItem.name,
            quantity: rewardItem.quantity,
          });
        }
      });

      // If there is an xp field
      if (currentStep.reward.xp) {
        const { name, quantity } = currentStep.reward.xp;

        console.log(name, quantity);

        const xpIndex = player.profession_xp.findIndex(
          (xp) => xp.profession === name
        );

        if (!xpIndex) {
          player.profession_xp[xpIndex].quantity += quantity;
        } else {
          player.profession_xp.push({ name, quantity });
        }

        await player.save();
      }

      const nextStep = currentStep.next || null;

      questProgress.current_step = nextStep;
      questProgress.progress = 0;
      questProgress.completed = nextStep === "quest_complete" ? true : false;

      await questProgress.save();

      return res.status(200).json({
        message: nextStep ? "Step completed!" : "Quest completed!",
        nextStep,
      });
    } else {
      // If the task field is present
      const isItemCollected =
        currentStep &&
        currentStep.task.items.some((item) => item.name === itemCollected);

      if (!isItemCollected) {
        return res.status(400).json({ message: "Invalid quest step or item" });
      }

      const item = currentStep.task.items.find(
        (item) => item.name === itemCollected
      );
      if (!item) {
        return res.status(400).json({ message: "Item not found in the task" });
      }

      const newProgress = questProgress.progress + quantity;
      if (newProgress >= item.quantity) {
        const nextStep = currentStep.next || null;

        questProgress.current_step = nextStep;
        questProgress.progress = 0;
        questProgress.completed = nextStep === "quest_complete" ? true : false;

        await questProgress.save();

        return res.status(200).json({
          message: nextStep ? "Step completed!" : "Quest completed!",
          nextStep,
        });
      } else {
        questProgress.progress = newProgress;

        await questProgress.save();

        return res
          .status(200)
          .json({ message: "Progress updated", currentProgress: newProgress });
      }
    }
  } catch (e) {
    console.log("Server error while updating quest: ", e);
    return res
      .status(500)
      .json({ message: "Server error while updating quest" });
  }
};

const questComplete = async (req, res) => {
  try {
    const { questName } = req.body;
    const playerId = req.user.playerId;

    const quest = quests.quests.find(
      (quest) => quest.name.toLowerCase() === questName.toLowerCase()
    );

    console.log("Quest: ", quest);

    if (!quest) {
      return res.status(400).json({ message: "Invalid quest name" });
    }

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    const questProgress = await playerQuestSchema.findOne({
      player_id: playerId,
      quest_name: questName,
    });

    if (!questProgress) {
      return res
        .status(404)
        .json({ message: "Quest not found or not started" });
    }

    if (!questProgress.completed) {
      return res.status(400).json({ message: "Quest not completed" });
    }

    console.log("Quest progress: ", questProgress);

    const stepData = quest.steps.find(
      (step) => step.id === questProgress.current_step
    );

    console.log(stepData);

    if (!stepData) {
      return res.status(404).json({ message: "Step not found" });
    }

    if (stepData.id === "quest_complete") {
      return res
        .status(400)
        .json({ message: "The quest has already been completed earlier" });
    }

    console.log(stepData.reward, "Quest Reward");

    if (stepData.reward.xp) {
      const { name, quantity } = stepData.reward.xp;

      console.log(name, quantity);

      const xpIndex = player.profession_xp.findIndex((xp) => xp.name === name);

      if (!xpIndex) {
        player.profession_xp[xpIndex].quantity += quantity;
      } else {
        player.profession_xp.push({ name, quantity });
      }

      await player.save();
    }

    stepData.reward.items.forEach((rewardItem) => {
      const itemInInventory = player.inventory.find(
        (item) => item.name === rewardItem.name
      );

      if (itemInInventory) {
        itemInInventory.quantity += rewardItem.quantity;
      } else {
        player.inventory.push({
          name: rewardItem.name,
          quantity: rewardItem.quantity,
        });
      }
    });

    await player.save();

    await playerQuestSchema.deleteOne({
      player_id: playerId,
      quest_name: questName,
    });

    return res
      .status(200)
      .json({ message: "Quest completed!", ...stepData.reward });
  } catch (e) {
    console.log("Server error while complete quest", e);
    return res
      .status(500)
      .json({ message: "Server error while complete quest: " });
  }
};

module.exports = {
  questStart,
  questProgress,
  questComplete,
};
