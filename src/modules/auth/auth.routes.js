const express = require("express");
const { authenticate } = require("../../middleware/auth");
const { validateBody } = require("../../middleware/validate");
const { login, me, registerReseller } = require("./auth.controller");
const { validateLogin, validateRegister } = require("./auth.validators");

const router = express.Router();

router.post("/register", validateBody(validateRegister), registerReseller);
router.post("/login", validateBody(validateLogin), login);
router.get("/me", authenticate, me);

module.exports = router;
