const db = require("../config/db");

// ============================
// GET DATA PETA BINAAN PENYULUH
// ============================
exports.getMapBinaan = (req, res) => {
  const sql = `
SELECT 
  l.id,
  l.nama_lahan,
  l.lat,
  l.lng,
  l.luas_ha,
  l.foto,
  u.nama AS nama_petani
FROM lahan l
JOIN users u ON u.id = l.user_id
`;

  db.query(sql, (err, result) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal mengambil data peta binaan",
        error: err
      });
    }

    res.json(result);
  });
};