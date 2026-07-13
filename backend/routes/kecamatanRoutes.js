const express = require("express");
const router = express.Router();

const {
  getKecamatan
} = require("../controllers/kecamatanController");

router.get("/", getKecamatan);

module.exports = router;