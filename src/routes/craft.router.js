const express = require("express");
const craftController = require("../controllers/craft.controller");
const { validateToken } = require("../midllewares/validateToken.middleware");

const router = express.Router();

router.post("/blacksmith", validateToken, craftController.blacksmithCraft);
router.post("/armorer", validateToken, craftController.armorerCraft);
router.post("/basic", validateToken, craftController.basicCraft);

module.exports = router;
