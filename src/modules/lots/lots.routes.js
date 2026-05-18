const express = require("express");
const { authenticate, requireRole } = require("../../middleware/auth");
const { validateBody } = require("../../middleware/validate");
const {
  createLot,
  getLot,
  listActiveLots,
  listAdminLots,
  updateLot,
  updateLotStatus
} = require("./lots.controller");
const { validateLotCreate, validateLotUpdate } = require("./lots.validators");

const router = express.Router();

router.get("/admin/all", authenticate, requireRole("admin"), listAdminLots);
router.post("/admin", authenticate, requireRole("admin"), validateBody(validateLotCreate), createLot);
router.patch(
  "/admin/:id",
  authenticate,
  requireRole("admin"),
  validateBody(validateLotUpdate),
  updateLot
);
router.patch("/admin/:id/status", authenticate, requireRole("admin"), updateLotStatus);

router.get("/", listActiveLots);
router.get("/:id", getLot);

module.exports = router;
