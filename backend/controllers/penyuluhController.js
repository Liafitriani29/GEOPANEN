const db = require("../config/db");

/* =========================================================
   1. SUMMARY DASHBOARD PENYULUH
========================================================= */
exports.summary = (req, res) => {
  const sql = `
    SELECT 
      COUNT(DISTINCT petani_id) AS totalPetani,
      SUM(luas_ha) AS totalLahan
    FROM lahan
    WHERE petani_id IS NOT NULL
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.log("SUMMARY ERROR:", err);
      return res.status(500).json({ message: "error summary" });
    }

    const row = result[0];

    res.json({
      totalLahan: row.totalLahan || 0,
      totalPetani: row.totalPetani || 0,
      totalProduksi: 0,
      prediksiBulanIni: 0,
    });
  });
};

/* =========================================================
   2. ANALISIS PRODUKSI + PREDIKSI (CHART + TABLE)
========================================================= */
exports.analisisProduksi = (req, res) => {
  const { kecamatan } = req.query;

  const sql = `
    SELECT 
      u.nama AS petani,
      l.luas_ha AS lahan,
      k.nama_kecamatan AS kecamatan,

      (l.luas_ha * 5) AS produksi,
      (l.luas_ha * 5.5) AS prediksi,

      CASE 
        WHEN l.luas_ha >= 1 THEN 'aman'
        WHEN l.luas_ha >= 0.5 THEN 'waspada'
        ELSE 'kritis'
      END AS status,

      l.id AS lahan_id

    FROM lahan l
    LEFT JOIN users u ON u.id = l.petani_id
    LEFT JOIN kecamatan k ON k.id = l.kecamatan_id

    WHERE (? = 'all' OR k.nama_kecamatan = ?)
  `;

  db.query(sql, [kecamatan, kecamatan], (err, result) => {
    if (err) return res.status(500).json(err);

    res.json(result);
  });
};