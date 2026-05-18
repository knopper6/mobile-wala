const express = require("express");
const { authenticate, requireRole } = require("../../middleware/auth");
const {
  createResellerByAdmin,
  getResellerProfile,
  listResellers,
  updateResellerStatus,
  updateAdminProfile,
  updateResellerByAdmin,
  resetResellerPassword
} = require("./users.controller");

const router = express.Router();

router.get("/reseller/profile", authenticate, requireRole("reseller"), getResellerProfile);
router.get("/admin/resellers", authenticate, requireRole("admin"), listResellers);
router.post("/admin/resellers", authenticate, requireRole("admin"), createResellerByAdmin);
router.patch("/admin/resellers/:id/status", authenticate, requireRole("admin"), updateResellerStatus);
router.patch("/admin/resellers/:id", authenticate, requireRole("admin"), updateResellerByAdmin);
router.patch("/admin/resellers/:id/password", authenticate, requireRole("admin"), resetResellerPassword);
router.patch("/admin/profile", authenticate, requireRole("admin"), updateAdminProfile);

module.exports = router;
