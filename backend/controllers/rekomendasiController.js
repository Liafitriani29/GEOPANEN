const db = require("../config/db");

// ======================================================
// GENERATE REKOMENDASI + AUTO KALENDER (FINAL FIX LAHAN)
// ======================================================
exports.generateRekomendasi = (req, res) => {

  const { lahan_id, fase_tanaman } = req.body || {};

  if (!lahan_id || !fase_tanaman) {
    return res.status(400).json({
      message: "lahan_id dan fase_tanaman wajib diisi"
    });
  }

  let pupuk = "";
  let alasan = "";
  let base_dosis = 0;

  // ======================================================
  // RULE KATAM
  // ======================================================
  switch (fase_tanaman) {
    case "vegetatif_awal":
      pupuk = "Urea";
      base_dosis = 100;
      alasan = "Fase vegetatif awal butuh nitrogen tinggi";
      break;

    case "vegetatif_lanjut":
      pupuk = "NPK";
      base_dosis = 150;
      alasan = "Fase vegetatif lanjut butuh NPK seimbang";
      break;

    case "generatif":
      pupuk = "KCL + NPK";
      base_dosis = 120;
      alasan = "Fase generatif butuh kalium tinggi";
      break;

    default:
      pupuk = "NPK";
      base_dosis = 150;
      alasan = "Default rekomendasi";
  }

  // ======================================================
  // AMBIL LUAS LAHAN
  // ======================================================
  const getLuasSQL = `SELECT luas_ha FROM lahan WHERE id = ?`;

  db.query(getLuasSQL, [lahan_id], (err, result) => {

    if (err || result.length === 0) {
      return res.status(500).json({
        message: "Gagal ambil data lahan",
        error: err
      });
    }

    const luas = parseFloat(result[0].luas_ha || 0.1);

    const dosis_per_ha = base_dosis;
    const dosis_total = parseFloat((dosis_per_ha * luas).toFixed(2));

    // ======================================================
    // SIMPAN REKOMENDASI (FIX CALLBACK)
    // ======================================================
    const sqlInsert = `
      INSERT INTO rekomendasi 
      (lahan_id, pupuk, dosis, alasan, status)
      VALUES (?, ?, ?, ?, ?)
    `;

    db.query(sqlInsert, [
      lahan_id,
      pupuk,
      `${dosis_per_ha} kg/ha`,
      alasan,
      "aktif"
    ], (err) => {

      if (err) {
        return res.status(500).json({
          message: "Gagal simpan rekomendasi",
          error: err
        });
      }

      // ======================================================
      // AUTO KALENDER
      // ======================================================
      const today = new Date();

      const kalender = [
        {
          plus: 0,
          pupuk: pupuk,
          dosis_per_ha: dosis_per_ha,
          dosis_total: dosis_total,
          alasan: "Rekomendasi AI awal",
          status: "aktif"
        },
        {
          plus: 7,
          pupuk: "Penyiraman",
          dosis_per_ha: 0,
          dosis_total: 0,
          alasan: "Perawatan tanaman",
          status: "aktif"
        },
        {
          plus: 14,
          pupuk: "Pengendalian Hama",
          dosis_per_ha: 0,
          dosis_total: 0,
          alasan: "Proteksi tanaman",
          status: "aktif"
        }
      ];

      kalender.forEach((item) => {

        const tanggal = new Date(today);
        tanggal.setDate(today.getDate() + item.plus);

     db.query(`
  INSERT INTO jadwal_pupuk 
  (lahan_id, pupuk, dosis_per_ha, dosis_total, alasan, status, tanggal)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`, [
  lahan_id,
  item.pupuk,
  item.dosis_per_ha,
  item.dosis_total,
  item.alasan,
  item.status,
  tanggal
]);
      });

      // ======================================================
      // RESPONSE
      // ======================================================
      return res.json({
        message: "Rekomendasi + Kalender berhasil dibuat",
        data: {
          lahan_id,
          pupuk,
          dosis_per_ha,
          dosis_total,
          luas
        }
      });

    });
  });
};
exports.getKalenderBudidaya = (req, res) => {

  const { lahan_id } = req.params;

  if (!lahan_id) {
    return res.status(400).json({
      status: false,
      message: "lahan_id wajib diisi"
    });
  }

  const sql = `
    SELECT 
      pupuk,
      dosis_per_ha,
      dosis_total,
      alasan,
      status,
      DATE_FORMAT(tanggal, '%Y-%m-%d') AS tanggal
    FROM jadwal_pupuk
    WHERE lahan_id = ?
    ORDER BY tanggal ASC
  `;

  db.query(sql, [lahan_id], (err, result) => {

    if (err) {
      return res.status(500).json({
        status: false,
        message: "Database error",
        error: err.sqlMessage || err.message
      });
    }

    return res.json({
      status: true,
      data: result || []
    });
  });
};

// ======================================================
// RIWAYAT REKOMENDASI
// ======================================================
exports.getRiwayatRekomendasi = (req, res) => {

  const { lahan_id } = req.query;

  const sql = `
    SELECT * FROM rekomendasi
    WHERE lahan_id = ?
    ORDER BY id DESC
  `;

  db.query(sql, [lahan_id], (err, result) => {

    if (err) {
      return res.status(500).json({
        message: "Gagal ambil riwayat",
        error: err
      });
    }

    return res.json({
      status: true,
      data: result
    });

  });
};