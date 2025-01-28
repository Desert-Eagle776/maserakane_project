const express = require("express");
const fishermenController = require("../controllers/fishermen.controller");
const { validateToken } = require("../midllewares/validateToken.middleware");

const router = express.Router();

router.post("/catch", validateToken, fishermenController.catchFish);

module.exports = router;
