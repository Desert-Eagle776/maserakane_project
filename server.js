require("dotenv").config();
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const fishermenRouter = require("./src/routes/fishermen.router");
const craftRouter = require("./src/routes/craft.router");
const playerRouter = require("./src/routes/player.router");
const lumberjackRouter = require("./src/routes/lumberjack.router");

const connectToMongoDB = require("./src/config/mongodbConnection");

const app = express();
const PORT = process.env.PORT || 3000;

// Path to serve static files (index.html, styles, scripts, etc.)
const publicPath = "/home/newgenesis/htdocs/www.newgenesis.io";
app.use(express.static(publicPath));
// Middleware
app.use(express.json());

// connect to MongoDB
connectToMongoDB();

app.use("/api", playerRouter);
app.use("/api/fishermen", fishermenRouter);
app.use("/api/craft", craftRouter);
app.use("/api/lumberjack", lumberjackRouter);

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
