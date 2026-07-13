const express = require("express");
const router = express.Router();

const controller = require("../controllers/laporanController");

// GET /api/laporan
router.get("/", controller.getLaporanPanen);

module.exports = router;