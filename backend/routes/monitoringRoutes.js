const express = require("express");
const router = express.Router();
const monitoringController = require("../controllers/monitoringController");

// Analisis Fuzzy Tsukamoto / fallback lokal
router.post("/analisis", monitoringController.analisisMonitoring);

// Data suhu, kelembapan, curah hujan 24 jam, hujan saat ini, dan umur tanaman terbaru
router.get("/lingkungan", monitoringController.getLingkungan);

// Grafik pertumbuhan tanaman
router.get("/pertumbuhan", monitoringController.getPertumbuhan);

// Riwayat aktivitas lahan
router.get("/aktivitas", monitoringController.getAktivitas);

module.exports = router;