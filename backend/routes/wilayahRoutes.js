const express = require("express");
const router = express.Router();
const db = require("../config/db");

// GET KECAMATAN
router.get("/kecamatan", async (req, res) => {
  const [data] = await db.query(
    "SELECT DISTINCT kecamatan FROM wilayah"
  );
  res.json(data);
});

// GET DESA BY KECAMATAN
router.get("/desa", async (req, res) => {
  const { kecamatan } = req.query;

  const [data] = await db.query(
    "SELECT desa FROM wilayah WHERE kecamatan=?",
    [kecamatan]
  );

  res.json(data);
});

module.exports = router;