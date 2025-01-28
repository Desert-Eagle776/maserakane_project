require("dotenv").config();
const express = require("express");
const http = require('http')
const WebSocket = require('ws');
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");
const mainMapsPath = "./maps/main_maps.json";



const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "your_default_secret";



// Path to serve static files (index.html, styles, scripts, etc.)
const publicPath = '/home/newgenesis/htdocs/www.newgenesis.io';
app.use(express.static(publicPath));
// Middleware
app.use(bodyParser.json());
const db = new sqlite3.Database("./game.db", (err) => {
    if (err) {
        console.error("Error opening database:", err.message);
    } else {
        console.log("Connected to SQLite database.");

        // Création de la table `players`
        db.run(`
            CREATE TABLE IF NOT EXISTS players (
                id TEXT PRIMARY KEY,
                token TEXT,
                wallet TEXT,
                stuff TEXT,
                inventory TEXT,
                money INTEGER DEFAULT 0,
                profession_xp TEXT DEFAULT '{}', -- Stockage des données JSON sous forme de chaîne
                last_action TEXT
            )
        `, (err) => {
            if (err) {
                console.error("Error creating players table:", err.message);
            } else {
                console.log("Players table ready.");
            }
        });

        // Création de la table `tokens`
        db.run(`
            CREATE TABLE IF NOT EXISTS tokens (
                player_id TEXT PRIMARY KEY,
                token TEXT,
                expires_at TIMESTAMP,
                FOREIGN KEY(player_id) REFERENCES players(id)
            )
        `, (err) => {
            if (err) {
                console.error("Error creating tokens table:", err.message);
            } else {
                console.log("Tokens table ready.");
            }
        });
    }
});

// Helper functions
function generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0,
            v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

function initializeProfessionXP() {
    return JSON.stringify({
        miner: 0,
        lumberjack: 0,
        blacksmith: 0,
        alchemist: 0,
        fisherman: 0,
        herbalist: 0,
        cook: 0
    });
}


function validateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "Token required" });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: "Invalid token" });
        }

        // Vérifie que le token contient un playerId
        if (!user.playerId) {
            return res.status(403).json({ message: "Invalid token: playerId not found" });
        }

        // Ajouter playerId et d'autres informations utilisateur à la requête
        req.playerId = user.playerId;
        req.user = user;

        next();
    });
}

// API Endpoints

app.post("/api/generatePlayerId", (req, res) => {
    console.log("Received request to /api/generatePlayerId");

    const playerId = generateUUID();
    console.log("Generated player ID:", playerId);

    const initialToken = jwt.sign({ playerId }, JWT_SECRET, { expiresIn: "1h" });
    console.log("Generated JWT token for player ID:", initialToken);

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // Token expiration in 1 hour
    const initialWallet = null; // Address of the wallet (empty initially)
    const initialStuff = JSON.stringify({
        head: null,
        chestplate: null,
        legs: null,
        boots: null,
        gloves: null,
        prof_item_1: null,
        prof_item_2: null,
        prof_item_3: null,
        prof_item_4: null
    });
    const initialInventory = JSON.stringify({});
    const initialMoney = 0;
    const initialProfessionXP = initializeProfessionXP();

    console.log("Initializing player data:", {
        playerId,
        wallet: initialWallet,
        stuff: initialStuff,
        inventory: initialInventory,
        money: initialMoney,
        professionXP: initialProfessionXP
    });

    // Start transaction to insert player and token
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // Insert player into `players` table
        db.run(
            "INSERT INTO players (id, token, wallet, stuff, inventory, money, profession_xp) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [playerId, initialToken, initialWallet, initialStuff, initialInventory, initialMoney, initialProfessionXP],
            (err) => {
                if (err) {
                    console.error("Error inserting player into database:", err.message);
                    db.run("ROLLBACK");
                    return res.status(500).json({ message: "Database error: Failed to create player." });
                }
                console.log("Player inserted successfully into `players` table.");
            }
        );

        // Insert token into `tokens` table
        db.run(
            "INSERT INTO tokens (player_id, token, expires_at) VALUES (?, ?, ?)",
            [playerId, initialToken, expiresAt],
            (err) => {
                if (err) {
                    console.error("Error inserting token into database:", err.message);
                    db.run("ROLLBACK");
                    return res.status(500).json({ message: "Database error: Failed to store token." });
                }
                console.log("Token inserted successfully into `tokens` table.");
            }
        );

        // Commit transaction and send response
        db.run("COMMIT", (err) => {
            if (err) {
                console.error("Error committing transaction:", err.message);
                return res.status(500).json({ message: "Database error: Failed to commit transaction." });
            }
            console.log("Transaction committed successfully.");
            res.json({ playerId, token: initialToken, expiresAt });
        });
    });
});


app.post("/api/generateToken", (req, res) => {
    console.log("Received request to /api/generateToken");

    const { playerId } = req.body;

    if (!playerId) {
        console.warn("Request missing playerId in the body");
        return res.status(400).json({ message: "Player ID is required." });
    }

    console.log("Checking if player exists for playerId:", playerId);

    // Vérifier si le joueur existe
    db.get("SELECT id FROM players WHERE id = ?", [playerId], (err, player) => {
        if (err) {
            console.error("Database error while checking player existence:", err.message);
            return res.status(500).json({ message: "Database error." });
        }

        if (!player) {
            console.warn("Player not found for playerId:", playerId);
            return res.status(404).json({ message: "Player not found." });
        }

        console.log("Player exists. Checking token validity...");

        // Vérifier si un token existe déjà et s'il est encore valide
        db.get("SELECT token, expires_at FROM tokens WHERE player_id = ?", [playerId], (err, tokenRow) => {
            if (err) {
                console.error("Database error while checking token:", err.message);
                return res.status(500).json({ message: "Database error." });
            }

            const now = new Date();

            if (tokenRow && new Date(tokenRow.expires_at) > now) {
                console.log("Valid token found for playerId:", playerId);
                return res.json({
                    playerId,
                    token: tokenRow.token,
                    expiresAt: tokenRow.expires_at,
                });
            }

            console.log("No valid token found. Generating a new token...");

            // Générer un nouveau token
            const newToken = jwt.sign({ playerId }, JWT_SECRET, { expiresIn: "1h" });
            const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString(); // 1 heure d'expiration

            console.log("New token generated:", { newToken, expiresAt });

            // Insérer ou mettre à jour le token dans la base de données
            db.run(
                `
                INSERT INTO tokens (player_id, token, expires_at)
                VALUES (?, ?, ?)
                ON CONFLICT(player_id) DO UPDATE SET token = excluded.token, expires_at = excluded.expires_at
                `,
                [playerId, newToken, expiresAt],
                (err) => {
                    if (err) {
                        console.error("Database error while inserting/updating token:", err.message);
                        return res.status(500).json({ message: "Failed to generate token." });
                    }

                    console.log("Token stored successfully in database for playerId:", playerId);

                    res.json({
                        playerId,
                        token: newToken,
                        expiresAt,
                    });
                }
            );
        });
    });
});


app.post("/api/updateStuff", validateToken, (req, res) => {
    console.log("Received request to /api/updateStuff");

    const playerId = req.user.playerId;
    console.log("Player ID extracted from token:", playerId);

    const newStuff = req.body;
    console.log("New stuff data received:", newStuff);

    // Valider les clés et les valeurs du stuff
    const validKeys = [
        "head", "chestplate", "legs", "boots", "gloves",
        "prof_item_1", "prof_item_2", "prof_item_3", "prof_item_4"
    ];

    const isValidStuff = Object.keys(newStuff).every((key) =>
        validKeys.includes(key) && (typeof newStuff[key] === "string" || newStuff[key] === null)
    );

    if (!isValidStuff) {
        console.warn("Invalid stuff data received:", newStuff);
        return res.status(400).json({ message: "Invalid stuff data." });
    }

    console.log("Validated new stuff data. Updating database...");

    // Mettre à jour le stuff dans la base de données
    db.run(
        "UPDATE players SET stuff = ? WHERE id = ?",
        [JSON.stringify(newStuff), playerId],
        (err) => {
            if (err) {
                console.error("Error updating stuff in database:", err.message);
                return res.status(500).json({ message: "Failed to update stuff." });
            }

            console.log("Stuff updated successfully for player ID:", playerId);
            res.json({ message: "Stuff updated successfully.", stuff: newStuff });
        }
    );
});



// Endpoint pour récupérer l'inventory par wallet
app.get("/api/inventory/:wallet", (req, res) => {
    const wallet = req.params.wallet;

    db.get("SELECT inventory FROM players WHERE wallet = ?", [wallet], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        if (!row) {
            res.status(404).json({ message: "Wallet not found." });
            return;
        }

        // Retourner l'inventory au format JSON
        res.json(JSON.parse(row.inventory));
    });
});

app.post("/api/lumberjack/chop", validateToken, async (req, res) => {
    console.log("Received request to /api/lumberjack/chop");

    const playerId = req.user.playerId;
    const { material, rarity, mapId, position } = req.body;

    if (!material || !rarity || !mapId || !position) {
        console.error("Missing required parameters:", { material, rarity, mapId, position });
        return res.status(400).json({ message: "Missing required parameters." });
    }

    const axesData = require("./axes.json");

    try {
        // Validation de la hache
        if (!axesData.axes[material] || !axesData.axes[material][rarity]) {
            console.warn("Invalid axe material or rarity:", { material, rarity });
            return res.status(400).json({ message: "Invalid axe material or rarity." });
        }

        const axeConfig = axesData.axes[material][rarity];

        // Chargement des données de la carte
        if (!fs.existsSync(mainMapsPath)) {
            console.error("Map data file not found at:", mainMapsPath);
            return res.status(500).json({ message: "Map data not found." });
        }

        const mapsHashmap = JSON.parse(fs.readFileSync(mainMapsPath, "utf-8"));

        if (mapsHashmap[mapId]) {
            console.log("Available positions in map:", Object.keys(mapsHashmap[mapId]));
        } else {
            console.error(`Map '${mapId}' not found in mapsHashmap.`);
        }

        // Validation de la carte et de la position
        if (!mapsHashmap[mapId] || !mapsHashmap[mapId][position]) {
            console.warn("Invalid map or position:", { mapId, position });
            return res.status(400).json({ message: "Invalid map or position." });
        }

        console.log("Map and position are valid.");
        const tree = mapsHashmap[mapId][position];

        // Vérification du cooldown
        const now = Date.now();
        const lastChop = tree.players.find(player => player.playerId === playerId)?.timestamp || 0;

        if (lastChop && now - new Date(lastChop).getTime() < 3 * 60 * 60 * 1000) {
            console.warn("Tree still in cooldown for player:", playerId);
            return res.status(400).json({ message: "This tree is still regrowing. Cooldown is 3 hours." });
        }

        // Récupération des données du joueur
        db.get("SELECT stuff, inventory, profession_xp FROM players WHERE id = ?", [playerId], (err, row) => {
            if (err || !row) {
                console.error("Error fetching player data from database or player not found:", err?.message);
                return res.status(400).json({ message: "Player not found." });
            }

            const stuff = JSON.parse(row.stuff);
            const inventory = JSON.parse(row.inventory || "{}");
            const professionXP = JSON.parse(row.profession_xp || "{}");

            // Vérification de la hache équipée
            const equippedAxeKey = `${rarity} ${material} Axe`;
            const equippedAxe = [
                stuff.prof_item_1,
                stuff.prof_item_2,
                stuff.prof_item_3,
                stuff.prof_item_4
            ].includes(equippedAxeKey);

            if (!equippedAxe) {
                console.warn("Player does not have the required axe equipped:", equippedAxeKey);
                return res.status(400).json({
                    message: `You do not have a ${rarity} ${material} axe equipped.`,
                });
            }

            // if (!inventory[equippedAxeKey] || inventory[equippedAxeKey] <= 0) {
            //     console.warn("Player does not have the required axe in inventory:", equippedAxeKey);
            //     return res.status(400).json({
            //         message: `You need at least one ${rarity} ${material} axe in your inventory to chop wood.`,
            //     });
            // }


            // Récompenses et mise à jour
            const woodAmount = axeConfig.woodAmount;
            console.log("Calculating bait probability...");
            console.log("Axe configuration bait probability:", axeConfig.baitProbability);

            // Generate a random value and compare it
            const randomValue = Math.random() * 100;
            console.log("Generated random value:", randomValue);

            const hasBait = randomValue < axeConfig.baitProbability;
            console.log("Does the player have bait?", hasBait);

            console.log("Wood amount:", woodAmount, "Has bait:", hasBait);

            inventory.wood = (inventory.wood || 0) + woodAmount;
            if (hasBait) {
                inventory.worm_bait = (inventory.worm_bait || 0) + 1;
            }

            professionXP.lumberjack = (professionXP.lumberjack || 0) + axeConfig.xpGained;

            tree.players.push({ playerId, timestamp: new Date().toISOString() });
            fs.writeFileSync(mainMapsPath, JSON.stringify(mapsHashmap, null, 2), "utf-8");
            console.log("Updated map data saved.");

            db.run(
                "UPDATE players SET inventory = ?, profession_xp = ?, last_action = ? WHERE id = ?",
                [JSON.stringify(inventory), JSON.stringify(professionXP), new Date().toISOString(), playerId],
                (err) => {
                    if (err) {
                        console.error("Failed to update player data in database:", err.message);
                        return res.status(500).json({ message: "Failed to update player data." });
                    }

                    console.log("Player data updated successfully in database.");
                    res.json({
                        message: "Chopping successful!",
                        rewards: {
                            wood: woodAmount,
                            worm_bait: hasBait ? 1 : 0,
                            xp_gained: axeConfig.xpGained
                        },
                        inventory,
                        professionXP
                    });
                }
            );
        });
    } catch (err) {
        console.error("An unexpected error occurred:", err.message);
        res.status(500).json({ message: "An error occurred while chopping wood." });
    }
});



app.post("/api/fishermen/catch", validateToken, async (req, res) => {
    const playerId = req.user.playerId;
    const { material, rarity, mapId, position, result } = req.body; // Include mapId, position, and result
    const fishingData = require("./fishing.json");


    try {
        // Validate fishing rod type and rarity
        if (!fishingData.fishingRods[material] || !fishingData.fishingRods[material][rarity]) {
            console.warn("Invalid fishing rod material or rarity:", material, rarity);
            return res.status(400).json({ message: "Invalid fishing rod material or rarity." });
        }
        const rodConfig = fishingData.fishingRods[material][rarity];

        // Load map data
        if (!fs.existsSync(mainMapsPath)) {
            console.error("Map data not found at path:", mainMapsPath);
            return res.status(500).json({ message: "Map data not found." });
        }

        const mapsHashmap = JSON.parse(fs.readFileSync(mainMapsPath, "utf-8"));

        // Validate fishing spot
        if (!mapsHashmap[mapId] || !mapsHashmap[mapId][position] || mapsHashmap[mapId][position].type !== "fish") {
            console.warn("Invalid fishing spot:", { mapId, position });
            return res.status(400).json({ message: "Invalid fishing spot." });
        }

        console.log("Fishing spot validated:", mapsHashmap[mapId][position]);

        // Fetch player's stuff, inventory, and profession XP
        db.get("SELECT stuff, inventory, profession_xp FROM players WHERE id = ?", [playerId], (err, row) => {
            if (err) {
                console.error("Database error while fetching player data:", err);
                return res.status(500).json({ message: "Failed to fetch player data." });
            }
            if (!row) {
                console.warn("Player not found in database:", playerId);
                return res.status(400).json({ message: "Player not found." });
            }

            console.log("Player data fetched:", row);
            const stuff = JSON.parse(row.stuff);
            const inventory = JSON.parse(row.inventory);
            const professionXP = JSON.parse(row.profession_xp || "{}");

            // Check if the player has the required fishing rod equipped
            const equippedRodKey = `${rarity} ${material} Rod`;
            console.log("Equipped rod key being checked:", equippedRodKey);

            const equippedRod = stuff.prof_item_1 === equippedRodKey ||
                stuff.prof_item_2 === equippedRodKey ||
                stuff.prof_item_3 === equippedRodKey ||
                stuff.prof_item_4 === equippedRodKey;

            if (!equippedRod) {
                console.warn("Player does not have the required fishing rod equipped:", equippedRodKey);
                return res.status(400).json({
                    message: `You do not have a ${rarity} ${material} fishing rod equipped.`,
                });
            }

            console.log("Player has the required fishing rod equipped.");

            // Verify that the player has enough worm bait
            console.log("Checking player's worm bait:", inventory.worm_bait);

            if (!inventory.worm_bait || inventory.worm_bait <= 0) {
                console.warn("Player does not have enough worm bait.");
                return res.status(400).json({
                    message: "You need at least one worm bait to fish."
                });
            }

            // Deduct one worm bait
            inventory.worm_bait -= 1;
            console.log("Worm bait deducted. Remaining worm bait:", inventory.worm_bait);

            // Determine the fish caught based on result
            let fishCaught = 0;
            console.log("Fishing result provided:", result);

            if (result === "Grey") {
                fishCaught = 0; // No fish
            } else if (result === "Green") {
                fishCaught = 1; // 1 fish
            } else if (result === "Red") {
                fishCaught = 2; // 2 fish
            } else {
                console.warn("Invalid fishing result type:", result);
                return res.status(400).json({ message: "Invalid result type." });
            }

            console.log("Number of fish to catch:", fishCaught);

            const caughtFishes = [];
            for (let i = 0; i < fishCaught; i++) {
                const roll = Math.random() * 100;
                let fishRarity;

                if (roll < rodConfig.commonFishDropRate) {
                    fishRarity = "common";
                } else if (roll < rodConfig.commonFishDropRate + rodConfig.uncommonFishDropRate) {
                    fishRarity = "uncommon";
                } else if (roll < rodConfig.commonFishDropRate + rodConfig.uncommonFishDropRate + rodConfig.rareFishDropRate) {
                    fishRarity = "rare";
                } else if (roll < rodConfig.commonFishDropRate + rodConfig.uncommonFishDropRate + rodConfig.rareFishDropRate + rodConfig.epicFishDropRate) {
                    fishRarity = "epic";
                } else {
                    fishRarity = "legendary";
                }

                console.log(`Fish rarity rolled (${roll}):`, fishRarity);

                const fishOptions = fishingData.fish[fishRarity];
                const caughtFish = fishOptions[Math.floor(Math.random() * fishOptions.length)];

                console.log("Fish caught:", caughtFish);

                // Update inventory with the caught fish
                inventory[caughtFish] = (inventory[caughtFish] || 0) + 1;
                caughtFishes.push(caughtFish);
            }

            console.log("All caught fishes:", caughtFishes);

            // Update Fisherman XP
            const xpGained = rodConfig.xpGained;
            console.log("XP gained from fishing:", xpGained);

            professionXP.fisherman = (professionXP.fisherman || 0) + xpGained;
            console.log("Updated profession XP:", professionXP);

            // Update the database
            db.run(
                "UPDATE players SET inventory = ?, profession_xp = ?, last_action = ? WHERE id = ?",
                [JSON.stringify(inventory), JSON.stringify(professionXP), new Date().toISOString(), playerId],
                (err) => {
                    if (err) {
                        console.error("Database update error:", err);
                        return res.status(500).json({ message: "Failed to update player data." });
                    }

                    console.log("Player data updated successfully in the database.");

                    // Respond with rewards and XP gained
                    res.json({
                        message: "Fishing successful!",
                        rewards: {
                            fishes: caughtFishes,
                            xp_gained: xpGained
                        },
                        inventory,
                        professionXP
                    });

                    console.log("Fishing operation completed successfully.");
                }
            );
        });
    } catch (err) {
        console.error("Unexpected error during fishing operation:", err);
        res.status(500).json({ message: "An error occurred while fishing." });
    }
});


function getBlacksmithLevel(totalXp) {
    // Courbe des XP nécessaires pour chaque niveau (la courbe se répète avec 30, 20, 30, 30...)
    const xpCurve = [30, 20, 30, 30];
    let level = 0;
    let requiredXp = 0;

    while (totalXp >= requiredXp) {
        level++;
        const nextXp = xpCurve[(level - 1) % xpCurve.length];
        requiredXp += nextXp;

        if (totalXp < requiredXp) {
            break;
        }
    }

    return level - 1; // Retourner le niveau actuel
}


app.post('/craft/blacksmith', validateToken, async (req, res) => {
    const { type, material, rarity } = req.body;

    if (!type || !material || !rarity) {
        return res.status(400).json({ error: 'Missing required fields: type, material, or rarity' });
    }

    const playerId = req.playerId;
    if (!playerId) {
        return res.status(401).json({ error: 'Unauthorized: Player ID not found' });
    }

    let craftingData;
    try {
        craftingData = JSON.parse(fs.readFileSync('./blacksmith.json', 'utf-8'));
    } catch (error) {
        console.error('Error reading blacksmith.json:', error);
        return res.status(500).json({ error: 'Server error: Unable to read crafting data' });
    }

    if (!craftingData[type] || !craftingData[type][material] || !craftingData[type][material][rarity]) {
        return res.status(400).json({ error: 'Invalid crafting type, material, or rarity' });
    }

    const craft = craftingData[type][material][rarity];

    db.get('SELECT profession_xp, inventory FROM players WHERE id = ?', [playerId], (err, row) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!row) {
            return res.status(404).json({ error: 'Player not found' });
        }

        const professionXp = JSON.parse(row.profession_xp || '{}');
        const playerXp = professionXp.blacksmith || 0;
        const playerLevel = getBlacksmithLevel(playerXp);

        if (playerLevel < craft.requiredLevel) {
            return res.status(400).json({
                error: `Insufficient blacksmith level. Required: ${craft.requiredLevel}, Yours: ${playerLevel}`
            });
        }

        let inventory = JSON.parse(row.inventory || '[]');

        // Vérification des matériaux requis
        for (const requiredMaterial of craft.materials) {
            const playerMaterial = inventory.find(m => m.name === requiredMaterial.name);
            if (!playerMaterial || playerMaterial.quantity < requiredMaterial.quantity) {
                return res.status(400).json({
                    error: `Insufficient materials for ${requiredMaterial.name}`
                });
            }
        }

        const successRate = craft.successRate || 100;
        const isSuccess = Math.random() * 100 < successRate;

        // Mise à jour des matériaux dans l'inventaire
        const updatedInventory = inventory.map(item => {
            const requiredMaterial = craft.materials.find(m => m.name === item.name);
            if (requiredMaterial) {
                return { ...item, quantity: item.quantity - requiredMaterial.quantity };
            }
            return item;
        }).filter(item => item.quantity > 0);

        let craftedItemName = null;
        let xpGained = craft.xpReward || 10; // XP gagné après craft réussi

        if (isSuccess) {
            craftedItemName = `${rarity} ${material} ${type}`;
            updatedInventory.push({ name: craftedItemName, quantity: 1 });

            // Ajouter l'XP gagné au joueur
            professionXp.blacksmith = (professionXp.blacksmith || 0) + xpGained;
        }

        db.run(
            'UPDATE players SET inventory = ?, profession_xp = ? WHERE id = ?',
            [JSON.stringify(updatedInventory), JSON.stringify(professionXp), playerId],
            (err) => {
                if (err) {
                    console.error("Database error:", err);
                    return res.status(500).json({ error: 'Failed to update inventory and XP' });
                }

                if (isSuccess) {
                    return res.status(200).json({
                        message: 'Craft successful',
                        craftedItem: craftedItemName,
                        inventory: updatedInventory,
                        xpGained: xpGained
                    });
                } else {
                    return res.status(400).json({
                        error: 'Craft failed. Materials have been consumed.',
                        inventory: updatedInventory
                    });
                }
            }
        );
    });
});


function getArmorerLevel(totalXp) {
    // Courbe des XP nécessaires pour chaque niveau (la courbe se répète avec 30, 20, 30, 30...)
    const xpCurve = [30, 20, 30, 30];
    let level = 0;
    let requiredXp = 0;

    while (totalXp >= requiredXp) {
        level++;
        const nextXp = xpCurve[(level - 1) % xpCurve.length];
        requiredXp += nextXp;

        if (totalXp < requiredXp) {
            break;
        }
    }

    return level - 1; // Retourner le niveau actuel
}

app.post('/craft/armorer', validateToken, async (req, res) => {
    const { type, material, rarity } = req.body;

    // Vérification des champs requis
    if (!type || !material) {
        return res.status(400).json({ error: 'Missing required fields: type or material' });
    }

    // Récupération de playerId depuis le middleware validateToken
    const playerId = req.playerId; // Assurez-vous que validateToken ajoute playerId à req
    if (!playerId) {
        return res.status(401).json({ error: 'Unauthorized: Player ID not found' });
    }

    // Lecture du fichier crafting.json
    let craftingData;
    try {
        craftingData = JSON.parse(fs.readFileSync('./armorer.json', 'utf-8'));
    } catch (error) {
        console.error('Error reading crafting.json:', error);
        return res.status(500).json({ error: 'Server error: Unable to read crafting data' });
    }

    // Gestion des items sans rareté
    const craftingTypeData = craftingData[type]?.[material];
    console.log("type", type)
    console.log("material", material)
    console.log("craftingTypeData", craftingTypeData)
    if (!craftingTypeData) {
        return res.status(400).json({ error: 'Invalid crafting type or material' });
    }

    const craft = rarity ? craftingTypeData[rarity] : craftingTypeData.base;
    if (!craft) {
        return res.status(400).json({ error: 'Invalid crafting rarity or base item not found' });
    }

    // Récupération des données du joueur dans la base de données
    db.get('SELECT profession_xp, inventory FROM players WHERE id = ?', [playerId], (err, row) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!row) {
            return res.status(404).json({ error: 'Player not found' });
        }

        const professionXp = JSON.parse(row.profession_xp || '{}');
        const playerXp = professionXp.armorer || 0;

        // Calcul du niveau à partir de l'XP
        const playerLevel = getArmorerLevel(playerXp);

        // Vérification du niveau requis
        if (playerLevel < craft.requiredLevel) {
            return res.status(400).json({
                error: `Insufficient armorer level. Required: ${craft.requiredLevel}, Yours: ${playerLevel}`
            });
        }

        let inventory;
        try {
            inventory = JSON.parse(row.inventory || '[]');
            console.log(inventory)
            if (!Array.isArray(inventory)) {
                console.error("Inventory data is not an array, resetting to empty array.");
                inventory = [];
            }
        } catch (error) {
            console.error("Error parsing inventory JSON:", error);
            inventory = [];
        }

        // Vérification des matériaux requis
        for (const requiredMaterial of craft.materials) {
            const playerMaterial = inventory.find(m => m.name === requiredMaterial.name);
            if (!playerMaterial || playerMaterial.quantity < requiredMaterial.quantity) {
                return res.status(400).json({
                    error: `Insufficient materials for ${requiredMaterial.name}`
                });
            }
        }

        // Simulation de la probabilité de succès
        const successRate = craft.successRate || 100; // Défaut à 100% si non défini
        const isSuccess = Math.random() * 100 < successRate;

        // Mise à jour des matériaux dans l'inventaire
        const updatedInventory = inventory.map(item => {
            const requiredMaterial = craft.materials.find(m => m.name === item.name);
            if (requiredMaterial) {
                return { ...item, quantity: item.quantity - requiredMaterial.quantity };
            }
            return item;
        }).filter(item => item.quantity > 0);

        if (isSuccess) {
            // Ajout du nom de l'item dans l'inventaire
            const craftedItemName = rarity ? `${rarity} ${material} ${type}` : `${material} ${type}`; // Exemple : "Iron Chestplate" ou "Rare Iron Chestplate"
            updatedInventory.push(craftedItemName);

            // Mise à jour de la base de données
            db.run(
                'UPDATE players SET inventory = ?, profession_xp = ? WHERE id = ?',
                [JSON.stringify(updatedInventory), JSON.stringify({ ...professionXp, armorer: playerXp + craft.xp }), playerId],
                (err) => {
                    if (err) {
                        console.error("Database error:", err);
                        return res.status(500).json({ error: 'Failed to update inventory' });
                    }

                    return res.status(200).json({
                        message: 'Craft successful',
                        craftedItem: craftedItemName
                    });
                }
            );
        } else {
            // Mise à jour de l'inventaire sans ajouter l'item crafté
            db.run(
                'UPDATE players SET inventory = ? WHERE id = ?',
                [JSON.stringify(updatedInventory), playerId],
                (err) => {
                    if (err) {
                        console.error("Database error:", err);
                        return res.status(500).json({ error: 'Failed to update inventory after failed craft' });
                    }

                    return res.status(400).json({
                        error: 'Craft failed. Materials have been consumed.'
                    });
                }
            );
        }
    });
});


app.post('/craft/basic', validateToken, async (req, res) => {
    try {
        console.log('Craft request received:', req.body);
        const { item } = req.body;
        if (!item) return res.status(400).json({ error: 'Missing required field: item' });

        const playerId = req.playerId;
        console.log('Player ID:', playerId);
        if (!playerId) return res.status(401).json({ error: 'Unauthorized: Player ID not found' });

        // Read crafting data
        let basicCraftData;
        try {
            basicCraftData = JSON.parse(fs.readFileSync('./basics.json', 'utf-8'));
            console.log('Crafting data loaded successfully');
        } catch (error) {
            console.error('Error reading basics.json:', error);
            return res.status(500).json({ error: 'Server error: Unable to read basic crafting data' });
        }

        const craft = basicCraftData[item];
        if (!craft) return res.status(400).json({ error: 'Invalid basic crafting item' });
        console.log('Crafting details:', craft);

        db.get('SELECT profession_xp, inventory FROM players WHERE id = ?', [playerId], (err, row) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            if (!row) return res.status(404).json({ error: 'Player not found' });
            console.log('Player data retrieved:', row);

            const professionXp = JSON.parse(row.profession_xp || '{}');
            const playerXp = professionXp[craft.jobs] || 0;
            console.log('Player XP:', playerXp);

            if (playerXp < craft.requiredLevel) {
                return res.status(400).json({
                    error: `Insufficient level. Required: ${craft.requiredLevel}, Yours: ${playerXp}`
                });
            }

            let inventory = {};
            try {
                inventory = JSON.parse(row.inventory || '{}');
                if (typeof inventory !== 'object' || Array.isArray(inventory)) inventory = {};
                console.log('Player inventory:', inventory);
            } catch (error) {
                console.error('Error parsing inventory JSON:', error);
                return res.status(500).json({ error: 'Server error: Inventory parsing failed' });
            }

            // Validate materials
            for (const material of craft.materials) {
                if (!inventory[material.name] || inventory[material.name] < material.quantity) {
                    console.log('Insufficient material:', material);
                    return res.status(400).json({ error: `Insufficient materials for ${material.name}` });
                }
            }

            // Check crafting success rate
            const success = Math.random() * 100 < craft.successRate;
            console.log('Crafting success:', success);

            if (success) {
                // Deduct materials and add crafted item
                craft.materials.forEach(({ name, quantity }) => {
                    inventory[name] -= quantity;
                    if (inventory[name] <= 0) delete inventory[name];
                });
                inventory[item] = (inventory[item] || 0) + 1;

                // Update XP
                professionXp[craft.jobs] = (professionXp[craft.jobs] || 0) + craft.xpGained;
            } else {
                craft.materials.forEach(({ name, quantity }) => {
                    inventory[name] -= quantity;
                    if (inventory[name] <= 0) delete inventory[name];
                });
            }

            console.log('Updated inventory:', inventory);
            db.run(
                'UPDATE players SET inventory = ?, profession_xp = ? WHERE id = ?',
                [JSON.stringify(inventory), JSON.stringify(professionXp), playerId],
                (err) => {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).json({ error: 'Failed to update inventory and XP' });
                    }

                    if (success) {
                        console.log('Craft successful:', item);
                        res.status(200).json({
                            message: 'Craft successful',
                            craftedItem: item,
                            inventory,
                            xpGained: craft.xpGained
                        });
                    } else {
                        console.log('Craft failed, materials consumed');
                        res.status(400).json({
                            error: 'Craft failed. Materials have been consumed.',
                            inventory
                        });
                    }
                }
            );
        });
    } catch (error) {
        console.error('Unexpected error:', error);
        res.status(500).json({ error: 'Unexpected server error' });
    }
});



// Fallback route to serve index.html for all unmatched routes
app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// Create HTTP server and attach Express
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('New WebSocket connection');
    ws.on('message', (message) => {
        console.log('Message received:', message.toString());
        ws.send(JSON.stringify({ type: 'acknowledgment', message: 'Message received' }));
    });
    ws.on('close', () => {
        console.log('WebSocket connection closed');
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server is running and listening on port ${PORT}`);
});
