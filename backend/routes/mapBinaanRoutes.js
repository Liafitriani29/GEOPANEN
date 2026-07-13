const express = require("express");
const router = express.Router();
const db = require("../config/db");

// ======================================================
// GET PETA BINAAN PENYULUH
// ======================================================
router.get("/", (req, res) => {
  const sql = `
    SELECT
      l.id AS id,
      l.id AS lahan_id,
      l.nama_lahan,
      l.varietas,
      l.luas_ha,
      l.luas_m2,
      l.lat,
      l.lng,
      l.tanggal_tanam,
      l.user_id,
      l.petani_id,
      l.kecamatan_id,
      l.desa_id,
      l.foto,

      u.nama AS nama_petani,
      u.email AS email_petani,

      d.nama_desa AS nama_desa,
      k.nama_kecamatan AS nama_kecamatan,

      p.prediksi_ton,
      p.prediksi_kg,
      p.produktivitas,
      p.confidence,
      p.estimasi_panen,
      p.suhu,
      p.curah_hujan,
      p.kelembapan,
      p.risk_score,
      p.status_risiko,
      p.periode,
      p.varietas AS varietas_prediksi,
      p.created_at AS tanggal_prediksi

    FROM lahan l

    LEFT JOIN users u
      ON u.id = COALESCE(l.petani_id, l.user_id)

    LEFT JOIN desa d
      ON d.id = l.desa_id

    LEFT JOIN kecamatan k
      ON k.id = l.kecamatan_id

    LEFT JOIN (
      SELECT p1.*
      FROM prediksi p1
      INNER JOIN (
        SELECT sawah_id, MAX(id) AS max_id
        FROM prediksi
        GROUP BY sawah_id
      ) latest
        ON latest.max_id = p1.id
    ) p
      ON p.sawah_id = l.id

    ORDER BY 
      u.nama ASC,
      l.id DESC
  `;

  db.query(sql, (err, result) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal mengambil data map binaan",
        error: err.sqlMessage || err.message,
      });
    }

    return res.json({
      message: "success",
      total: result.length,
      data: result || [],
    });
  });
});

module.exports = router;