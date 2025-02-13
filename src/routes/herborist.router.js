const express = require("express");
const controller = require("../controllers/herborist.controller");
const { validateToken } = require("../midllewares/validateToken.middleware");

const router = express.Router();

router.post("/harvest", validateToken, controller.harvestedBushes);

module.exports = router;
