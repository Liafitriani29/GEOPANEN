const db = require("../config/db");

// TAMBAH SAWAH
exports.tambahSawah = (req, res) => {
  const {
    user_id,
    kecamatan_id,
    luas_m2,
    latitude,
    longitude,
    polygon,
    foto_sawah,
  } = req.body;

  const sql = `
    INSERT INTO sawah
    (
      user_id,
      kecamatan_id,
      luas_m2,
      latitude,
      longitude,
      polygon,
      foto_sawah
    )
    VALUES (?,?,?,?,?,?,?)
  `;

  db.query(
    sql,
    [
      user_id,
      kecamatan_id,
      luas_m2,
      latitude,
      longitude,
      polygon,
      foto_sawah,
    ],
    (err, result) => {
      if (err) {
        return res.status(500).json(err);
      }

      res.json({
        message: "Sawah berhasil ditambahkan",
        id: result.insertId,
      });
    }
  );
};

// LIHAT SEMUA SAWAH
exports.getSawah = (req, res) => {
  const sql = `
    SELECT
      s.*,
      k.nama_kecamatan,
      k.kode_kecamatan
    FROM sawah s
    JOIN kecamatan k
      ON s.kecamatan_id = k.id
    ORDER BY s.id DESC
  `;

  db.query(sql, (err, result) => {
    if (err) {
      return res.status(500).json(err);
    }

    res.json(result);
  });
};

// DETAIL SAWAH
exports.getSawahById = (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT
      s.*,
      k.nama_kecamatan,
      k.kode_kecamatan
    FROM sawah s
    JOIN kecamatan k
      ON s.kecamatan_id = k.id
    WHERE s.id = ?
  `;

  db.query(sql, [id], (err, result) => {
    if (err) {
      return res.status(500).json(err);
    }

    if (result.length === 0) {
      return res.status(404).json({
        message: "Sawah tidak ditemukan",
      });
    }

    res.json(result[0]);
  });
};

// UPDATE SAWAH
exports.updateSawah = (req, res) => {
  const { id } = req.params;

  const {
    kecamatan_id,
    luas_m2,
    latitude,
    longitude,
    polygon,
    foto_sawah,
  } = req.body;

  const sql = `
    UPDATE sawah
    SET
      kecamatan_id = ?,
      luas_m2 = ?,
      latitude = ?,
      longitude = ?,
      polygon = ?,
      foto_sawah = ?
    WHERE id = ?
  `;

  db.query(
    sql,
    [
      kecamatan_id,
      luas_m2,
      latitude,
      longitude,
      polygon,
      foto_sawah,
      id,
    ],
    (err, result) => {
      if (err) {
        return res.status(500).json(err);
      }

      res.json({
        message: "Sawah berhasil diupdate",
      });
    }
  );
};

// HAPUS SAWAH
exports.deleteSawah = (req, res) => {
  const { id } = req.params;

  const sql = `
    DELETE FROM sawah
    WHERE id = ?
  `;

  db.query(sql, [id], (err, result) => {
    if (err) {
      return res.status(500).json(err);
    }

    res.json({
      message: "Sawah berhasil dihapus",
    });
  });
};