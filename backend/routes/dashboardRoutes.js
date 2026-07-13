const express = require("express");
const router = express.Router();

const {
  getDashboard,
  getGrafikProduksi,
  getMapLahan,
  getProduksiKecamatan,
} = require("../controllers/dashboardController");

router.get("/dashboard", getDashboard);
router.get("/grafik-produksi", getGrafikProduksi);
router.get("/map-lahan", getMapLahan);
router.get("/produksi-kecamatan", getProduksiKecamatan);

module.exports = router;