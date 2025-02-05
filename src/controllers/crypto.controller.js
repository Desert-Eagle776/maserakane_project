const playerSchema = require("../models/player.schema");
require("dotenv").config();

// Charger la clé privée (environnement ou autre méthode sécurisée)
const accountName = process.env.ACCOUNT_NAME;
const permissionName = process.env.PERMISSION_NAME;

const converttoNft = async (req, res) => {
  try {
    const playerId = req.user.playerId; // Get player ID from token
    const { nftName, quantity } = req.body; // Get NFT name and quantity
    const session = req.session; // Get session

    console.log(nftName, quantity);

    // Validate input
    if (!nftName || typeof nftName !== "string") {
      return res.status(400).json({ error: "NFT name is required and must be a string." });
    }

    if (!quantity || typeof quantity !== "number" || quantity <= 0) {
      return res.status(400).json({ error: "Quantity must be a positive number." });
    }

    console.log(`🔄 Checking inventory for player ${playerId} before minting ${quantity} ${nftName}`);

    // Step 1: Fetch the player's wallet & inventory from the database
    const player = await playerSchema.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found." });
    }

    if (!player.wallets[0]) {
      return res.status(400).json({ message: "Player wallet not found." });
    }

    const playerWallet = player.wallets[0];
    const playerInventory = player.inventory;

    console.log(`✅ Found wallet: ${playerWallet}, Inventory:`, playerInventory);

    // Step 2: Validate the player has enough items
    if (!playerInventory[nftName] || playerInventory[nftName] < quantity) {
      return res.status(400).json({ message: `Insufficient ${nftName} in inventory.` });
    }

    // Step 3: Get the template ID for the NFT
    const templateId = getTemplateId(nftName);
    if (!templateId) {
      return res.status(400).json({ message: "Invalid NFT name. Template ID not found." });
    }

    // Step 4: Mint NFT using the player's wallet
    const mintNfts = await mintMultipleNFTs(templateId, playerWallet, quantity, session);
    if (!mintNfts) {
      return res.status(500).json({ message: "Failed to mint NFT. Please try again later." });
    }

    console.log(`✅ Successfully minted ${quantity} ${nftName} for player ${playerId}`);

    // Step 5: Deduct the items from the player's inventory
    playerInventory[nftName] -= quantity;

    // Remove item from inventory if it reaches 0
    if (playerInventory[nftName] <= 0) {
      delete playerInventory[nftName];
    }

    await player.save();

    console.log(`📉 Updated inventory after minting:`, playerInventory);
    return res.status(200).json({
      success: true,
      message: `${quantity} ${nftName} successfully converted to NFT for player ${playerId}.`,
    });
  } catch (e) {
    console.error("❌ NFT Minting Error:", e);
    return res.status(500).json({ message: "Failed to mint NFT. Please try again later." });
  }
}

const getTemplateId = (type) => {
  const templateMap = {
    "Wood": "647952",
  };
  return templateMap[type] || null;
}

const mintMultipleNFTs = async (templateId, recipient, count, session) => {
  try {
    const actions = [];
    for (let i = 0; i < count; i++) {
      actions.push({
        account: 'atomicassets',
        name: 'mintasset',
        authorization: [{
          actor: accountName,
          permission: permissionName,
        }],
        data: {
          authorized_minter: accountName,
          collection_name: 'newgenesis11', // Nom de votre collection
          schema_name: 'ressources',           // Nom de votre schéma
          template_id: templateId,
          new_asset_owner: recipient,
          immutable_data: [],
          mutable_data: [],
          tokens_to_back: [],
        },
      });
    }

    const result = await session.transact({ actions });
    console.log(`NFTs mintés avec succès ! Transaction ID : ${result.transaction_id}`);
    return true;
  } catch (e) {
    console.error('Erreur lors du mint des NFT :', e);
    return null;
  }
}

module.exports = {
  converttoNft,
};