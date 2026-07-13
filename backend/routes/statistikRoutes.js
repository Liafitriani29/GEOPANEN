const express = require("express");
const router = express.Router();

const controller = require("../controllers/statistikController");

// GET STATISTIK
router.get("/", controller.getStatistik);

module.exports = router;