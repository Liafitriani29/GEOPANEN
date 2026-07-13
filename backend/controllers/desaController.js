const db = require("../config/db");

exports.getByKecamatan = (req, res) => {
  let { kecamatan_id } = req.query;

  // ================= VALIDASI DASAR =================
  if (kecamatan_id === undefined || kecamatan_id === null || kecamatan_id === "") {
    return res.status(400).json({
      message: "kecamatan_id wajib diisi",
      data: [],
    });
  }

  kecamatan_id = parseInt(kecamatan_id, 10);

  // ================= VALIDASI ANGKA =================
  if (Number.isNaN(kecamatan_id)) {
    return res.status(400).json({
      message: "kecamatan_id tidak valid",
      data: [],
    });
  }

  // ================= QUERY =================
  // lat dan lng wajib ikut dikirim agar frontend bisa isi koordinat otomatis.
  const sql = `
    SELECT 
      id,
      nama_desa,
      kecamatan_id,
      lat,
      lng
    FROM desa
    WHERE kecamatan_id = ?
    ORDER BY nama_desa ASC
  `;

  db.query(sql, [kecamatan_id], (err, result) => {
    if (err) {
      console.error("🔥 DESA DB ERROR:", err);

      return res.status(500).json({
        message: "Gagal mengambil data desa",
        error: err.sqlMessage || err.message,
        data: [],
      });
    }

    return res.status(200).json({
      message: "success",
      data: result || [],
    });
  });
};