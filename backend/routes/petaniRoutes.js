const express = require("express");
const router = express.Router();

const controller = require("../controllers/petaniController");

// ✅ INI BENAR (pakai nama file kamu)
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// ================= DASHBOARD =================
router.get(
  "/dashboard",
  authMiddleware,
  roleMiddleware(["petani"]),
  controller.getDashboardPetani
);

// ================= GET PETANI BY ID =================
router.get("/:id", controller.getPetaniById);

module.exports = router;