const express = require("express");
const router = express.Router();

const {
  generateRekomendasi,
  getRiwayatRekomendasi,
  getKalenderBudidaya
} = require("../controllers/rekomendasiController");

router.post("/generate", generateRekomendasi);
router.get("/riwayat", getRiwayatRekomendasi);

// 🔥 INI WAJIB ADA
router.get("/kalender/:lahan_id", getKalenderBudidaya);

module.exports = router;