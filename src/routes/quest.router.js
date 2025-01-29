const express = require("express");
const controller = require("../controllers/quest.controller");
const { validateToken } = require("../midllewares/validateToken.middleware");

const router = express.Router();

router.post("/start", validateToken, controller.questStart);
router.post("/progress", validateToken, controller.questProgress);
router.post("/complete", validateToken, controller.questComplete);

module.exports = router;
