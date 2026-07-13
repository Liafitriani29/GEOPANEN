const db = require("../config/db");

// ==========================
// REKOMENDASI PUPUK BERBASIS KATAM
// ==========================
exports.getRekomendasiPupuk = (req, res) => {
  const { kecamatan_id } = req.params;

  if (!kecamatan_id) {
    return res.status(400).json({
      message: "kecamatan_id wajib"
    });
  }

  const sql = `
    SELECT 
      k.nama_kecamatan,
      p.jenis_pupuk,
      p.dosis_kg_ha,
      p.kondisi_musim
    FROM pupuk_katam p
    JOIN kecamatan k ON k.id = p.kecamatan_id
    WHERE p.kecamatan_id = ?
  `;

  db.query(sql, [kecamatan_id], (err, result) => {
    if (err) {
      return res.status(500).json({
        message: "DB Error",
        error: err
      });
    }

    return res.json({
      kecamatan: result[0]?.nama_kecamatan || "-",
      rekomendasi: result
    });
  });
};