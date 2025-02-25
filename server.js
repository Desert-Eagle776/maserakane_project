require("dotenv").config();
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");
const { Session } = require("@wharfkit/session");
const {
  WalletPluginPrivateKey,
} = require("@wharfkit/wallet-plugin-privatekey");
const cron = require("node-cron");

const fishermenRouter = require("./src/routes/fishermen.router");
const craftRouter = require("./src/routes/craft.router");
const playerRouter = require("./src/routes/player.router");
const lumberjackRouter = require("./src/routes/lumberjack.router");
const questRouter = require("./src/routes/quest.router");
const monsterRouter = require("./src/routes/monsters.router");
const cryptoRouter = require("./src/routes/crypto.router");
const alchemistRouter = require("./src/routes/alchemist.router");
const herboristRouter = require("./src/routes/herborist.router");
const minerRouter = require("./src/routes/miner.router");
const cookingRouter = require("./src/routes/cooking.router");
const farmerRouter = require("./src/routes/farmer.router");
const hungerRouter = require("./src/routes/hunger.router");

const connectToMongoDB = require("./src/config/mongodbConnection");
const { updatePlantStages } = require("./src/controllers/farmer.controller");

// cron
require("./src/cron/index");

const app = express();
const PORT = process.env.PORT || 3000;

// Charger la clé privée (environnement ou autre méthode sécurisée)
const privateKey = process.env.PRIVATE_KEY;
const accountName = process.env.ACCOUNT_NAME;
const permissionName = process.env.PERMISSION_NAME;

// Configuration de la blockchain
const chain = {
  id: process.env.BLOCKCHAIN_ID,
  url: process.env.BLOCKCHAIN_URL,
};
const walletPlugin = new WalletPluginPrivateKey(privateKey);

const session = new Session({
  actor: accountName,
  permission: permissionName,
  chain,
  walletPlugin,
});

// Path to serve static files (index.html, styles, scripts, etc.)
const publicPath = "/home/newgenesis/htdocs/www.newgenesis.io";
app.use(express.static(publicPath));
// Middleware
app.use(express.json());
// Attach the session to requests
app.use((req, res, next) => {
  req.session = session;
  next();
});

// connect to MongoDB
connectToMongoDB();

// Виконання cron кожні 5 хвилин
cron.schedule("*/5 * * * *", updatePlantStages); // Перевіряємо кожні 5 хвилин

app.use("/api", playerRouter);
app.use("/api/fishermen", fishermenRouter);
app.use("/api/craft", craftRouter);
app.use("/api/lumberjack", lumberjackRouter);
app.use("/api/quest", questRouter);
app.use("/api/monsters", monsterRouter);
app.use("/api/crypto", cryptoRouter);
app.use("/api/alchemist", alchemistRouter);
app.use("/api/herborist", herboristRouter);
app.use("/api/miner", minerRouter);
app.use("/api/cooking", cookingRouter);
app.use("/api/farmer", farmerRouter);
app.use("/api/hunger", hungerRouter);

// Fallback route to serve index.html for all unmatched routes
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next(); // skip API requests further
  }

  res.sendFile(path.join(publicPath, "index.html"));
});

// Create HTTP server and attach Express
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("New WebSocket connection");
  ws.on("message", (message) => {
    console.log("Message received:", message.toString());
    ws.send(
      JSON.stringify({ type: "acknowledgment", message: "Message received" })
    );
  });
  ws.on("close", () => {
    console.log("WebSocket connection closed");
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running and listening on port ${PORT}`);
});
