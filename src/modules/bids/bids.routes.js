const express = require("express");
const { authenticate } = require("../../middleware/auth");
const { validateBody } = require("../../middleware/validate");
const { listLotBids, placeBid } = require("./bids.controller");
const { validateBid } = require("./bids.validators");

const router = express.Router();

router.get("/lots/:lotId/bids", authenticate, listLotBids);
router.post("/lots/:lotId/bids", authenticate, validateBody(validateBid), placeBid);

module.exports = router;
