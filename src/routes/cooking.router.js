const express = require("express");
const { validateToken } = require("../midllewares/validateToken.middleware");
const controller = require("../controllers/cooking.controller");

const router = express.Router();

router.post("/fireplace/upgrade", validateToken, controller.upgradeFireplace);
router.get("/recipes", validateToken, controller.getAvailableRecipes);
router.post("/cook", validateToken, controller.cookRecipe);

module.exports = router;
