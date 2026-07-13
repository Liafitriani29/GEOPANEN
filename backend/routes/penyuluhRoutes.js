const express = require("express");
const router = express.Router();
const controller = require("../controllers/penyuluhController");

router.get("/summary", controller.summary);
router.get("/analisis", controller.analisisProduksi);

module.exports = router;