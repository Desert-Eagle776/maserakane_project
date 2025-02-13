const express = require("express");
const controller = require("../controllers/alchemist.controller");
const { validateToken } = require("../midllewares/validateToken.middleware");

const router = express.Router();

router.post("/upgrade", validateToken, controller.upgradeMorter);
router.post("/craft", validateToken, controller.craftPotion);
router.get("/", validateToken, controller.getMortarDataAndRecipes);

module.exports = router;
