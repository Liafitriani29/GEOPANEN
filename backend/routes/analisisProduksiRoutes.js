const express = require("express");
const router = express.Router();

const analisisProduksiController = require("../controllers/analisisProduksiController");

router.get(
  "/analisis-produksi",
  analisisProduksiController.getAnalisisProduksi
);

module.exports = router;