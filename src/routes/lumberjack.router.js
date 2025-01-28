const express = require("express");
const controller = require("../controllers/lumberjack.controller");
const { validateToken } = require("../midllewares/validateToken.middleware");

const router = express.Router();

router.post("/chop", validateToken, controller.chopWood);

module.exports = router;
