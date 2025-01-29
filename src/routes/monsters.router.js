const express = require("express");
const controller = require("../controllers/monsters.controller");
const { validateToken } = require("../midllewares/validateToken.middleware");

const router = express.Router();

router.post("/kill-monster", validateToken, controller.killMonster);

module.exports = router;
