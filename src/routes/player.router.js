const express = require("express");
const controller = require("../controllers/player.controller");
const { validateToken } = require("../midllewares/validateToken.middleware");

const router = express.Router();

router.post("/connect-wallet", validateToken, controller.connectWallet);
router.post("/generatePlayerId", controller.generatePlayerId);
router.post("/generateToken", controller.generateToken);
router.post("/updateStuff", validateToken, controller.updateStuff);
router.post("/inventory/add", validateToken, controller.addItemToInventory);
router.get("/inventory/:wallet", controller.getInventory);

module.exports = router;
