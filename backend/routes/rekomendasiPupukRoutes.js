const express = require("express");
const router = express.Router();

const pupukController = require("../controllers/rekomendasiPupuk");

// GET rekomendasi pupuk berbasis katam
router.get(
  "/rekomendasi-pupuk/:kecamatan_id",
  pupukController.getRekomendasiPupuk
);

module.exports = router;