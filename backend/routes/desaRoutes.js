const express = require("express");
const router = express.Router();
const controller = require("../controllers/desaController");

// ini PENTING
router.get("/", controller.getByKecamatan);

module.exports = router;