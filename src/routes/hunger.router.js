const express = require("express");
const { validateToken } = require("../midllewares/validateToken.middleware");
const controller = require("../controllers/hunger.controller");

const router = express.Router();

router.post("/consume", validateToken, controller.consume);
router.put("/decrease", validateToken, controller.decrease);
router.put("/set_saturation", validateToken, controller.setSaturation);
router.get("/status", validateToken, controller.status);

module.exports = router;
