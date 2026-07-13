const db = require("../config/db");

// ===============================
// GET LAPORAN PANEN ADMIN
// ===============================
exports.getLaporanPanen = (req, res) => {
  const sql = `
    SELECT 
      p.id,
      p.sawah_id,
      p.sawah_id AS lahan_id,

      p.prediksi_ton,
      p.prediksi_kg,
      p.produktivitas,
      p.periode,
      p.status_risiko,
      p.created_at,

      l.nama_lahan,
      l.luas_ha,
      l.luas_m2,
      l.varietas,
      l.petani_id,
      l.user_id,
      l.kecamatan_id,
      l.desa_id,

      u.nama AS nama_petani,
      u.email AS email_petani,

      k.nama_kecamatan,
      d.nama_desa,

      CASE
        WHEN p.status_risiko IS NULL THEN 'selesai'
        WHEN LOWER(p.status_risiko) = 'aman' THEN 'selesai'
        WHEN LOWER(p.status_risiko) = 'berhasil' THEN 'selesai'
        WHEN LOWER(p.status_risiko) = 'selesai' THEN 'selesai'
        WHEN LOWER(p.status_risiko) = 'waspada' THEN 'selesai'
        WHEN LOWER(p.status_risiko) = 'kritis' THEN 'gagal'
        ELSE 'selesai'
      END AS status_prediksi,

      CASE
        WHEN l.luas_ha IS NOT NULL AND l.luas_ha > 0 THEN l.luas_ha
        WHEN l.luas_m2 IS NOT NULL AND l.luas_m2 > 0 THEN l.luas_m2 / 10000
        ELSE 0
      END AS luas_lahan_ha,

      CASE
        WHEN 
          (
            CASE
              WHEN l.luas_ha IS NOT NULL AND l.luas_ha > 0 THEN l.luas_ha
              WHEN l.luas_m2 IS NOT NULL AND l.luas_m2 > 0 THEN l.luas_m2 / 10000
              ELSE 0
            END
          ) > 0
        THEN 
          p.prediksi_ton / 
          (
            CASE
              WHEN l.luas_ha IS NOT NULL AND l.luas_ha > 0 THEN l.luas_ha
              WHEN l.luas_m2 IS NOT NULL AND l.luas_m2 > 0 THEN l.luas_m2 / 10000
              ELSE 1
            END
          )
        ELSE 0
      END AS rata_rata_ton_ha

    FROM prediksi p
    LEFT JOIN lahan l ON l.id = p.sawah_id
    LEFT JOIN users u ON u.id = COALESCE(l.petani_id, l.user_id)
    LEFT JOIN kecamatan k ON k.id = l.kecamatan_id
    LEFT JOIN desa d ON d.id = l.desa_id

    ORDER BY p.created_at DESC, p.id DESC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      return res.status(500).json({
        status: false,
        message: "Gagal ambil laporan panen",
        error: err.message,
      });
    }

    const data = (rows || []).map((item) => {
      const luasHa = Number(item.luas_lahan_ha || item.luas_ha || 0);
      const prediksiTon = Number(item.prediksi_ton || 0);
      const prediksiKg = Number(item.prediksi_kg || prediksiTon * 1000);

      return {
        id: item.id,
        sawah_id: item.sawah_id,
        lahan_id: item.lahan_id,

        nama_lahan: item.nama_lahan || "-",
        nama_petani: item.nama_petani || "-",
        email_petani: item.email_petani || "-",
        nama_kecamatan: item.nama_kecamatan || "-",
        nama_desa: item.nama_desa || "-",
        varietas: item.varietas || "-",

        luas_ha: luasHa,
        luas_m2: Number(item.luas_m2 || luasHa * 10000 || 0),

        prediksi_ton: prediksiTon,
        prediksi_kg: prediksiKg,

        produktivitas: Number(
          item.produktivitas || item.rata_rata_ton_ha || 0
        ),

        rata_rata_ton_ha: Number(item.rata_rata_ton_ha || 0),
        total_produksi: prediksiTon,

        periode: item.periode || "-",
        status_risiko: item.status_risiko || "AMAN",
        status_prediksi: item.status_prediksi || "selesai",
        status: item.status_prediksi || "selesai",

        created_at: item.created_at,
      };
    });

    return res.json({
      status: true,
      message: "Laporan panen berhasil diambil",
      data,
    });
  });
};