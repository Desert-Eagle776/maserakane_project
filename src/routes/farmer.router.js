const express = require("express");
const { validateToken } = require("../midllewares/validateToken.middleware");
const controller = require("../controllers/farmer.controller");

const router = express.Router();

router.post("/plant", validateToken, controller.plant);
router.post("/action/:cropId", validateToken, controller.performAction);
router.post("/harvest/:cropId", validateToken, controller.harvest);
router.get("/status/:cropId", validateToken, controller.statusCrop);
router.get("/zones", validateToken, controller.getFarmingZones);

module.exports = router;
