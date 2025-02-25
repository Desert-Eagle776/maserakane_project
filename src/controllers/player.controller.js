const jwt = require("jsonwebtoken");
const playerSchema = require("../models/player.schema");
const tokenSchema = require("../models/tokens.schema");
require("dotenv").config();

const generatePlayerId = async (req, res) => {
  try {
    console.log("Received request to /api/generatePlayerId");

    const initialMoney = { gold: 0, silver: 0, gems: 0 };
    const initialProfessionXP = [
      { profession: "miner", current_level: 0, current_xp: 0 },
      { profession: "lumberjack", current_level: 0, current_xp: 0 },
      { profession: "blacksmith", current_level: 0, current_xp: 0 },
      { profession: "alchemist", current_level: 0, current_xp: 0 },
      { profession: "fisherman", current_level: 0, current_xp: 0 },
      { profession: "herbalist", current_level: 0, current_xp: 0 },
      { profession: "cook", current_level: 0, current_xp: 0 },
    ];

    const initialPlayer = {
      money: initialMoney,
      profession_xp: initialProfessionXP,
    };

    console.log("Initializing player data:", {
      money: initialMoney,
      profession_xp: initialProfessionXP,
    });

    const player = await playerSchema.create({ ...initialPlayer });

    console.log("Generated player ID:", player._id);

    const playerId = player._id;

    const initialToken = jwt.sign({ playerId }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    console.log("Generated JWT token for player ID:", initialToken);

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // Token expiration in 1 hour

    const token = await tokenSchema.create({
      player_id: player._id,
      token: initialToken,
      expires_at: expiresAt,
    });

    res
      .status(201)
      .json({ expiresAt, playerId: player._id, token: token.token });
  } catch (e) {
    console.log("An error occurred while generating player ID: ", e);
    return res
      .status(500)
      .json({ message: "An error occurred while generating player ID" });
  }
};

const generateToken = async (req, res) => {
  try {
    console.log("Received request to /api/generateToken");

    const now = new Date();
    const { playerId } = req.body;
    if (!playerId) {
      console.warn("Request missing playerId in the body");
      return res.status(400).json({ message: "Player ID is required." });
    }

    console.log("Checking if player exists for playerId:", playerId);

    const player = await playerSchema.findById(playerId);
    if (!player) {
      console.warn("Player not found for playerId:", playerId);
      return res.status(404).json({ message: "Player not found." });
    }

    console.log("Player exists. Checking token validity...");

    const token = await tokenSchema.findOne({ player_id: playerId });
    if (token && new Date(token.expires_at) > now) {
      console.log("Valid token found for playerId:", playerId);

      return res.status(201).json({
        playerId,
        token: token.token,
        expiresAt: token.expires_at,
      });
    }

    console.log("No valid token found. Generating a new token...");

    // Générer un nouveau token
    const updateToken = jwt.sign({ playerId }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString(); // 1 heure d'expiration

    console.log("New token generated:", { updateToken, expiresAt });

    await player.updateOne({ token: updateToken, expires_at: expiresAt });

    console.log(
      "Token stored successfully in database for playerId:",
      playerId
    );

    res.status(201).json({
      playerId,
      token: updateToken,
      expiresAt,
    });
  } catch (e) {
    console.log("An error occurred while generating token: ", e);
    return res
      .status(500)
      .json({ message: "An error occurred while generating token" });
  }
};

const updateStuff = async (req, res) => {
  try {
    console.log("Received request to /api/updateStuff");

    const newStuff = req.body;
    const playerId = req.user.playerId;

    console.log("Player ID extracted from token:", playerId);

    // Valider les clés et les valeurs du stuff
    const validKeys = [
      "head",
      "chestplate",
      "legs",
      "boots",
      "gloves",
      "prof_item_1",
      "prof_item_2",
      "prof_item_3",
      "prof_item_4",
    ];

    const isValidStuff = Object.keys(newStuff).every(
      (key) =>
        validKeys.includes(key) &&
        (typeof newStuff[key] === "string" || newStuff[key] === null)
    );

    if (!isValidStuff) {
      console.warn("Invalid stuff data received:", newStuff);
      return res.status(400).json({ message: "Invalid stuff data." });
    }

    console.log("Validated new stuff data. Updating database...");

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    for (const stuff in newStuff) {
      const existingStuff = player.inventory.find(
        (item) => item.name === newStuff[stuff]
      );

      if (!existingStuff || existingStuff.quantity <= 0) {
        console.log(`The item is not in the inventory: ${newStuff[stuff]}`);
        return res.status(400).json({
          message: `The item is not in the inventory: ${newStuff[stuff]}`,
        });
      }
    }

    // object to be updated
    const updateFields = {};
    for (const key of Object.keys(newStuff)) {
      updateFields[`stuff.${key}`] = newStuff[key];
    }

    const updatedPlayer = await playerSchema.findByIdAndUpdate(
      playerId,
      { $set: updateFields },
      { new: true }
    );

    console.log("Stuff updated successfully:", updatedPlayer.stuff);
    return res.status(201).json({
      message: "Stuff updated successfully",
      stuff: updatedPlayer.stuff,
    });
  } catch (e) {
    console.log("An error occurred while updating stuff: ", e);
    return res
      .status(500)
      .json({ message: "An error occurred while updating stuff" });
  }
};

const getInventory = async (req, res) => {
  try {
    const wallet = req.params.wallet;

    const player = await playerSchema.findOne({ wallets: wallet });
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    let updateInventory = {};
    if (Array.isArray(player.inventory)) {
      for (const item of player.inventory) {
        updateInventory[item.name] = item.quantity;
      }
    }

    return res.status(200).json(updateInventory);
  } catch (e) {
    console.error("An error occurred while retrieving inventory: ", e);
    return res
      .status(500)
      .json({ message: "An error occurred while retrieving inventory." });
  }
};

const addItemToInventory = async (req, res) => {
  try {
    const { name, quantity } = req.body;
    const playerId = req.user.playerId;

    if (
      typeof name !== "string" ||
      name.trim().length === 0 ||
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      return res.status(400).json({ message: "Invalid arguments" });
    }

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    const existingItem = player.inventory.find((item) => item.name === name);
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      player.inventory.push({ name, quantity });
    }

    await player.save();

    return res.status(200).json({
      message: "Item added successfully",
      inventory: player.inventory,
    });
  } catch (e) {
    console.error("Error adding item to inventory:", e);
    return res.status(500).json({ message: "Server error" });
  }
};

const connectWallet = async (req, res) => {
  try {
    const playerId = req.user.playerId;
    const { wallet_address } = req.body;
    if (!wallet_address) {
      return res.status(400).json({ message: "Wallet address is required." });
    }

    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found." });
    }

    const checkWallet = player.wallets.find(
      (wallet) => wallet === wallet_address
    );
    if (checkWallet) {
      return res
        .status(400)
        .json({ message: "A wallet address like this already exists." });
    }

    player.wallets.push(wallet_address);
    await player.save();

    return res.status(201).json({
      message: "Wallet successfully added.",
    });
  } catch (e) {
    console.log("An error occurred while connecting the wallet: ", e);
    return res
      .status(500)
      .json({ message: "An error occurred while connecting the wallet." });
  }
};

module.exports = {
  generatePlayerId,
  generateToken,
  updateStuff,
  getInventory,
  addItemToInventory,
  connectWallet,
};
