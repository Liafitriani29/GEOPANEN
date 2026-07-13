const express = require("express");
const router = express.Router();
const db = require("../config/db");

const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

router.get("/", async (req, res) => {
  try {
    const rows = await query(`
      SELECT
        COALESCE(suhu, 28) AS suhu,
        COALESCE(kelembapan, 78) AS kelembapan,
        COALESCE(curah_hujan, 2) AS curah_hujan,
        updated_at
      FROM monitoring_tanaman
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `);

    const item =
      rows[0] || {
        suhu: 28,
        kelembapan: 78,
        curah_hujan: 2,
      };

    const hujan = Number(item.curah_hujan || 0);
    let kondisi = "Cerah";

    if (hujan >= 20) kondisi = "Hujan";
    else if (hujan >= 5) kondisi = "Berawan";

    res.json({
      status: true,
      data: {
        suhu: Number(item.suhu || 28),
        kelembapan: Number(item.kelembapan || 78),
        curah_hujan: hujan,
        kondisi,
        updated_at: item.updated_at || null,
      },
    });
  } catch (err) {
    res.json({
      status: true,
      data: {
        suhu: 28,
        kelembapan: 78,
        curah_hujan: 2,
        kondisi: "Cerah",
        updated_at: null,
      },
    });
  }
});

module.exports = router;