const fs = require("fs");
const quests = require("../data/quests.json");
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
    const { questName } = req.body;
    const playerId = req.user.playerId;

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    const quest = quests.quests.find(
      (quest) => quest.name.toLowerCase() === questName.toLowerCase()
    );

    console.log("Quest: ", quest);

    if (!quest) {
      return res.status(404).json({ message: "Quest not found" });
    }

    const playerQuest = await playerQuestSchema.findOne({
      quest_name: questName,
      player_id: playerId,
    });
    if (!playerQuest) {
      return res
        .status(400)
        .json({ message: `Player has not started the quest '${questName}` });
    }

    if (playerQuest.completed) {
      return res.status(400).json({ message: "Quest completed" });
    }

    const currentStep = quest.steps.find(
      (step) => step.id === playerQuest.current_step
    );

    // If the task field is missing
    if (!currentStep.task?.items?.length) {
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

        if (xpIndex !== -1) {
          player.profession_xp[xpIndex].quantity += quantity;
        } else {
          player.profession_xp.push({ profession: name, quantity });
        }

        await player.save();
      }

      const nextStep = currentStep.next || null;

      playerQuest.current_step = nextStep;
      playerQuest.progress = 0;
      playerQuest.completed = nextStep === "quest_complete" ? true : false;

      await playerQuest.save();

      return res.status(200).json({
        message: nextStep ? "Step completed!" : "Quest completed!",
        nextStep,
      });
    } else {
      // If the task field is present

      const allItemsCollected = currentStep.task.items.every((taskItem) =>
        player.inventory.some(
          (invItem) =>
            invItem.name === taskItem.name &&
            invItem.quantity >= taskItem.quantity
        )
      );
      console.log(
        currentStep.task.items.forEach((taskItem) => console.log(taskItem))
      );

      console.log("ALL ITEMS COLLECTED: ", allItemsCollected);

      if (!allItemsCollected) {
        return res.status(200).json({
          message: "Progress updated",
          currentProgress: playerQuest.progress,
          currentStep: currentStep.id,
        });
      }

      const nextStep = currentStep.next || null;

      playerQuest.current_step = nextStep || null;
      playerQuest.progress = 0;
      playerQuest.completed = nextStep === "quest_complete";

      await playerQuest.save();

      return res.status(200).json({
        message: nextStep ? "Step completed!" : "Quest completed!",
        nextStep,
      });
    }
  } catch (e) {
    console.log("An error occurred while updating quest progress: ", e);
    return res
      .status(500)
      .json({ message: "An error occurred while updating quest progress" });
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

const updateQuestProgress = async (
  playerId,
  questName,
  actionType,
  actionItem,
  quantity
) => {
  console.log(
    `\n🔄 [START] Mise à jour de la progression de quête pour le joueur ${playerId}`
  );

  try {
    const player = await playerSchema.findById(playerId);
    if (!player) {
      console.error("Player not found");
      return { message: "Player not found" };
    }

    const playerQuest = await playerQuestSchema.findOne({
      player_id: playerId,
      quest_name: questName,
      completed: false,
    });
    if (!playerQuest) {
      console.error("No active quest found");
      return { message: "No active quest found" };
    }

    console.log(
      `✅ Quête active trouvée: ${playerQuest.quest_name} (Étape actuelle: ${playerQuest.current_step})`
    );

    const quest = quests.quests.find(
      (quest) => quest.name.toLowerCase() === questName.toLowerCase()
    );
    if (!quest) {
      console.error("Quest not found");
      return { message: "Quest not found" };
    }

    const currentStep = quest.steps.find(
      (step) => step.id === playerQuest.current_step
    );
    if (!currentStep) {
      console.error(`❌ Étape de quête invalide: ${playerQuest.current_step}`);
      return { message: "Invalid quest step" };
    }

    if (currentStep.id === "quest_complete") {
      console.log("Quest completed: ", currentStep);
      playerQuest.completed = true;

      await playerQuest.save();

      return {
        message: "All steps in the quest have been successfully completed",
      };
    }

    console.log(
      `📌 Étape actuelle: ${currentStep.id}, Type: ${currentStep.task.type}`
    );

    let isActionValid = false;
    let newProgress = playerQuest.progress + quantity;
    let requiredQuantity = 0;

    switch (actionType) {
      case "kill":
        if (
          currentStep.task.type === "kill" &&
          currentStep.task.target === actionItem
        ) {
          isActionValid = true;
          requiredQuantity = currentStep.task.items.quantity;
        }
        break;

      case "gather": {
        const gatherItemRequired = currentStep.task.items.find(
          (item) => item.name === actionItem
        );
        if (currentStep.task.type === "gather" && gatherItemRequired) {
          isActionValid = true;
          requiredQuantity = gatherItemRequired.quantity;
        }
        break;
      }

      case "craft": {
        const craftItemRequired = currentStep.task.items.find(
          (item) => item.name === actionItem
        );
        if (currentStep.task.type === "craft" && craftItemRequired) {
          isActionValid = true;
          requiredQuantity = craftItemRequired.quantity;
        }
        break;
      }

      default:
        console.warn(`🚫 Action inconnue: ${actionType}`);
        return { message: `Unknown action type: ${actionType}` };
    }

    if (!isActionValid) {
      return { message: "Action not related to current quest step" };
    }

    console.log(
      `📊 Progression mise à jour: ${newProgress}/${requiredQuantity}`
    );

    if (newProgress >= requiredQuantity) {
      console.log(`🏆 Étape '${currentStep.id}' complétée !`);
      playerQuest.progress = 0;
      const nextStepId = currentStep.next;

      if (currentStep.reward && Array.isArray(currentStep.reward.items)) {
        console.log("🎁 Ajout des récompenses...");
        await givePlayerRewards(player, currentStep.reward.items);
      }

      if (nextStepId) {
        console.log(`➡️ Passage à l'étape suivante: ${nextStepId}`);
        playerQuest.current_step = nextStepId;
      }

      await playerQuest.save();
      await player.save();

      return {
        message: `Quest step completed!`,
        reward: currentStep.reward,
        updatedInventory: player.inventory,
      };
    } else {
      playerQuest.progress = newProgress;
      await playerQuest.save();
      return {
        message: `Progress updated to ${newProgress}/${requiredQuantity}`,
      };
    }
  } catch (e) {
    console.error("Server error while updating quest progress:", e);
    return { message: "Server error while updating quest progress" };
  }
};

// Функція для видачі нагород гравцю
const givePlayerRewards = async (player, rewardItems) => {
  for (const item of rewardItems) {
    let existingItem = player.inventory.find(
      (invItem) => invItem.name === item.name
    );

    if (!existingItem) {
      player.inventory.push({ name: item.name, quantity: item.quantity });
    } else {
      existingItem.quantity += item.quantity; // Тепер це точно працює
    }

    existingItem.quantity += item.quantity;
  }

  player.last_action = new Date().toISOString();
  await player.save();
};

module.exports = {
  questStart,
  questProgress,
  questComplete,
  updateQuestProgress,
};
