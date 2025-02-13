const express = require("express");
const { validateToken } = require("../midllewares/validateToken.middleware");
const controller = require("../controllers/miner.controller");

const router = express.Router();

router.post("/", validateToken, controller.mineNode);

module.exports = router;
