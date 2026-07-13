const db = require("../config/db");

exports.getPetaniBinaan = (req, res) => {
  const sql = `
    SELECT 
      l.id,
      l.nama_lahan,
      l.luas_ha,
      l.varietas AS komoditas,
      l.lat,
      l.lng,

      u.nama AS nama_petani,

      k.nama_kecamatan,

      CASE 
        WHEN l.luas_ha >= 1 THEN 'sehat'
        WHEN l.luas_ha >= 0.5 THEN 'waspada'
        ELSE 'kritis'
      END AS status

    FROM lahan l
    LEFT JOIN users u ON u.id = l.petani_id
    LEFT JOIN kecamatan k ON k.id = l.kecamatan_id
  `;

  db.query(sql, (err, result) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal mengambil data peta binaan",
        error: err
      });
    }

    res.json({
      message: "success",
      data: result
    });
  });
};