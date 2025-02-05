const express = require('express');
const { validateToken } = require('../midllewares/validateToken.middleware');
const controller = require('../controllers/crypto.controller');

const router = express.Router();

router.post("/converttoNFT", validateToken, controller.converttoNft);

module.exports = router;