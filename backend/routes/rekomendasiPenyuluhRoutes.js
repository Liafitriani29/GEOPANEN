const express = require("express");
const router = express.Router();
const axios = require("axios");

const FASTAPI = "http://127.0.0.1:8000";

// ==========================
// REKOMENDASI
// ==========================
router.get("/rekomendasi/:id", async (req, res) => {
  try {
    const response = await axios.get(
      `${FASTAPI}/penyuluh/rekomendasi/${req.params.id}`
    );

    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: "Gagal ambil rekomendasi" });
  }
});

// ==========================
// NOTIFIKASI
// ==========================
router.get("/notifikasi/:id", async (req, res) => {
  try {
    const response = await axios.get(
      `${FASTAPI}/penyuluh/notifikasi/${req.params.id}`
    );

    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: "Gagal ambil notifikasi" });
  }
});

// ==========================
// GRAFIK
// ==========================
router.get("/grafik/:id", async (req, res) => {
  try {
    const response = await axios.get(
      `${FASTAPI}/penyuluh/grafik/${req.params.id}`
    );

    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: "Gagal ambil grafik" });
  }
});

module.exports = router;