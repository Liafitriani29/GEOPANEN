const express = require("express");
const router = express.Router();
const db = require("../config/db");

// ======================================================
// HELPER
// ======================================================
const safeColumn = (columns, candidates) => {
  for (const item of candidates) {
    if (columns.includes(item)) return item;
  }

  return null;
};

const buildMonitoringJoin = (columns) => {
  const idKolom = safeColumn(columns, [
    "lahan_id",
    "sawah_id",
    "id_lahan",
    "id_sawah",
  ]);

  const statusKolom = safeColumn(columns, [
    "status_kesehatan",
    "status",
    "kesehatan",
    "kondisi_tanaman",
    "status_tanaman",
  ]);

  const umurKolom = safeColumn(columns, [
    "umur_tanam",
    "umur_tanaman",
    "umur",
  ]);

  const faseKolom = safeColumn(columns, [
    "fase_tanam",
    "fase_tanaman",
    "fase",
  ]);

  const updatedKolom = safeColumn(columns, [
    "updated_at",
    "created_at",
    "tanggal",
  ]);

  // Kalau tabel monitoring_tanaman belum punya kolom penghubung,
  // jangan join agar endpoint tetap aman.
  if (!idKolom) {
    return {
      joinSql: "",
      selectSql: `
        'sehat' AS status_kesehatan,
        'aktif' AS status,
        88 AS skor_kesehatan,
        0 AS umur_tanaman,
        'Vegetatif Awal' AS fase_tanaman
      `,
    };
  }

  const statusSelect = statusKolom
    ? `COALESCE(m.${statusKolom}, 'sehat')`
    : `'sehat'`;

  const umurSelect = umurKolom
    ? `COALESCE(m.${umurKolom}, 0)`
    : `0`;

  const faseSelect = faseKolom
    ? `COALESCE(m.${faseKolom}, 'Vegetatif Awal')`
    : `'Vegetatif Awal'`;

  const orderKolom = updatedKolom || "id";

  return {
    joinSql: `
      LEFT JOIN (
        SELECT mt1.*
        FROM monitoring_tanaman mt1
        INNER JOIN (
          SELECT 
            ${idKolom} AS ref_lahan_id,
            MAX(id) AS max_id
          FROM monitoring_tanaman
          GROUP BY ${idKolom}
        ) mt2
          ON mt1.id = mt2.max_id
      ) m
        ON m.${idKolom} = l.id
    `,

    selectSql: `
      ${statusSelect} AS status_kesehatan,

      CASE
        WHEN LOWER(${statusSelect}) IN ('sehat', 'baik', 'normal') THEN 'aktif'
        WHEN LOWER(${statusSelect}) IN ('waspada', 'sedang', 'perlu perhatian') THEN 'perlu_perhatian'
        WHEN LOWER(${statusSelect}) IN ('kritis', 'buruk', 'bahaya') THEN 'perlu_perhatian'
        ELSE 'aktif'
      END AS status,

      CASE
        WHEN LOWER(${statusSelect}) IN ('sehat', 'baik', 'normal') THEN 91
        WHEN LOWER(${statusSelect}) IN ('waspada', 'sedang', 'perlu perhatian') THEN 62
        WHEN LOWER(${statusSelect}) IN ('kritis', 'buruk', 'bahaya') THEN 45
        ELSE 88
      END AS skor_kesehatan,

      ${umurSelect} AS umur_tanaman,
      ${faseSelect} AS fase_tanaman
    `,
  };
};

// ======================================================
// GET PETANI BINAAN PENYULUH
// URL: GET /api/penyuluh/petani-binaan
// ======================================================
router.get("/petani-binaan", (req, res) => {
  // Cek struktur tabel monitoring_tanaman dulu,
  // karena kolom di project kamu bisa berbeda: lahan_id / sawah_id.
  db.query("SHOW COLUMNS FROM monitoring_tanaman", (colErr, colRows) => {
    let monitoringColumns = [];

    if (!colErr && Array.isArray(colRows)) {
      monitoringColumns = colRows.map((item) => item.Field);
    }

    const monitoring = buildMonitoringJoin(monitoringColumns);

    const sql = `
      SELECT
        l.id AS id,
        l.id AS lahan_id,

        COALESCE(l.user_id, l.petani_id) AS petani_id,

        COALESCE(u.nama, 'Petani') AS nama_petani,
        COALESCE(u.email, '-') AS email_petani,

        '-' AS no_hp,

        COALESCE(l.nama_lahan, '-') AS nama_lahan,
        COALESCE(l.varietas, '-') AS varietas,
        COALESCE(l.luas_ha, 0) AS luas_ha,

        COALESCE(l.lat, d.lat) AS lat,
        COALESCE(l.lng, d.lng) AS lng,

        COALESCE(d.nama_desa, '-') AS nama_desa,
        COALESCE(k.nama_kecamatan, '-') AS nama_kecamatan,

        'Padi' AS komoditas,

        ${monitoring.selectSql},

        COALESCE(p.prediksi_ton, 0) AS prediksi_ton,
        COALESCE(p.prediksi_kg, 0) AS prediksi_kg,
        COALESCE(p.periode, '-') AS periode_prediksi,

        NULL AS created_at,
        NULL AS updated_at

      FROM lahan l

      LEFT JOIN users u 
        ON u.id = COALESCE(l.user_id, l.petani_id)

      LEFT JOIN desa d 
        ON d.id = l.desa_id

      LEFT JOIN kecamatan k 
        ON k.id = l.kecamatan_id

      LEFT JOIN (
        SELECT 
          p1.id,
          p1.sawah_id,
          p1.prediksi_ton,
          p1.prediksi_kg,
          p1.periode,
          p1.varietas,
          p1.created_at
        FROM prediksi p1
        INNER JOIN (
          SELECT 
            sawah_id,
            MAX(id) AS max_id
          FROM prediksi
          GROUP BY sawah_id
        ) p2 
          ON p1.id = p2.max_id
      ) p 
        ON p.sawah_id = l.id

      ${monitoring.joinSql}

      ORDER BY l.id DESC
    `;

    db.query(sql, (err, result) => {
      if (err) {
        console.log("ERROR PETANI BINAAN:", err);

        return res.status(500).json({
          status: false,
          message: "Gagal mengambil data petani binaan",
          error: err.message,
        });
      }

      return res.json({
        status: true,
        message: "Data petani binaan berhasil diambil",
        total: result.length,
        monitoring_columns: monitoringColumns,
        data: result,
      });
    });
  });
});

module.exports = router;