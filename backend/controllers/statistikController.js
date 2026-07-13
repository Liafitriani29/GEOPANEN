const db = require("../config/db");

// =========================
// GET STATISTIK ADMIN
// =========================
exports.getStatistik = (req, res) => {
  const sql = `
    SELECT 
      -- TOTAL PETANI
      (
        SELECT COUNT(*) 
        FROM users 
        WHERE role = 'petani'
      ) AS total_petani,

      -- TOTAL LAHAN BERDASARKAN JUMLAH DATA
      (
        SELECT COUNT(*) 
        FROM lahan
      ) AS total_lahan,

      -- TOTAL LUAS LAHAN DALAM HEKTARE
      (
        SELECT COALESCE(
          SUM(
            CASE 
              WHEN luas_ha IS NOT NULL AND luas_ha > 0 THEN luas_ha
              WHEN luas_m2 IS NOT NULL AND luas_m2 > 0 THEN luas_m2 / 10000
              ELSE 0
            END
          ), 
        0)
        FROM lahan
      ) AS total_luas,

      -- TOTAL PREDIKSI AI
      (
        SELECT COUNT(*) 
        FROM prediksi
      ) AS total_prediksi,

      -- RATA-RATA HASIL PREDIKSI
      (
        SELECT COALESCE(AVG(prediksi_ton), 0) 
        FROM prediksi
      ) AS rata_rata_ton,

      -- PANEN TERTINGGI
      (
        SELECT COALESCE(MAX(prediksi_ton), 0) 
        FROM prediksi
      ) AS max_ton,

      -- PANEN TERENDAH
      (
        SELECT COALESCE(MIN(prediksi_ton), 0) 
        FROM prediksi
      ) AS min_ton,

      -- PREDIKSI BULAN INI
      (
        SELECT COUNT(*) 
        FROM prediksi
        WHERE MONTH(created_at) = MONTH(CURDATE())
        AND YEAR(created_at) = YEAR(CURDATE())
      ) AS prediksi_bulan_ini,

      -- KECAMATAN AKTIF
      (
        SELECT COUNT(DISTINCT kecamatan_id)
        FROM lahan
        WHERE kecamatan_id IS NOT NULL
      ) AS kecamatan_aktif,

      -- PENYULUH LOGIN HARI INI
      (
        SELECT COUNT(*) 
        FROM users
        WHERE role = 'penyuluh'
        AND DATE(last_login) = CURDATE()
      ) AS penyuluh_login_hari_ini,

      -- CUACA REALTIME, TIDAK DISIMPAN DI DATABASE
      0 AS update_cuaca_hari_ini
  `;

  db.query(sql, (err, result) => {
    if (err) {
      return res.status(500).json({
        status: false,
        message: "Gagal ambil statistik",
        error: err.message,
      });
    }

    const row = result?.[0] || {};

    return res.json({
      status: true,
      message: "Statistik berhasil diambil",
      data: {
        total_petani: Number(row.total_petani || 0),
        total_lahan: Number(row.total_lahan || 0),
        total_luas: Number(row.total_luas || 0),
        total_prediksi: Number(row.total_prediksi || 0),
        rata_rata_ton: Number(row.rata_rata_ton || 0),
        max_ton: Number(row.max_ton || 0),
        min_ton: Number(row.min_ton || 0),
        prediksi_bulan_ini: Number(row.prediksi_bulan_ini || 0),
        kecamatan_aktif: Number(row.kecamatan_aktif || 0),
        penyuluh_login_hari_ini: Number(row.penyuluh_login_hari_ini || 0),
        update_cuaca_hari_ini: Number(row.update_cuaca_hari_ini || 0),
      },
    });
  });
};