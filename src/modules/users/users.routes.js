const express = require("express");
const { authenticate, requireRole } = require("../../middleware/auth");
const {
  createResellerByAdmin,
  getResellerProfile,
  listResellers,
  updateResellerStatus
} = require("./users.controller");

const router = express.Router();

router.get("/reseller/profile", authenticate, requireRole("reseller"), getResellerProfile);
router.get("/admin/resellers", authenticate, requireRole("admin"), listResellers);
router.post("/admin/resellers", authenticate, requireRole("admin"), createResellerByAdmin);
router.patch("/admin/resellers/:id/status", authenticate, requireRole("admin"), updateResellerStatus);

module.exports = router;
