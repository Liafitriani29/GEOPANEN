const express = require("express");
const router = express.Router();
const db = require("../config/db");

const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

router.get("/", async (req, res) => {
  try {
    const rows = await query(`
      SELECT *
      FROM template_notifikasi
      ORDER BY created_at DESC, id DESC
    `);

    res.json({
      status: true,
      message: "Template berhasil diambil",
      data: rows,
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: "Gagal mengambil template",
      error: err.message,
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const { judul, pesan, jenis = "informasi" } = req.body || {};

    if (!judul || !pesan) {
      return res.status(400).json({
        status: false,
        message: "Judul dan pesan template wajib diisi",
      });
    }

    const result = await query(
      `
      INSERT INTO template_notifikasi
        (judul, pesan, jenis, created_at, updated_at)
      VALUES
        (?, ?, ?, NOW(), NOW())
      `,
      [judul, pesan, jenis]
    );

    res.status(201).json({
      status: true,
      message: "Template berhasil dibuat",
      data: {
        id: result.insertId,
      },
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: "Gagal membuat template",
      error: err.message,
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { judul, pesan, jenis = "informasi" } = req.body || {};

    if (!judul || !pesan) {
      return res.status(400).json({
        status: false,
        message: "Judul dan pesan template wajib diisi",
      });
    }

    const result = await query(
      `
      UPDATE template_notifikasi
      SET
        judul = ?,
        pesan = ?,
        jenis = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [judul, pesan, jenis, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: false,
        message: "Template tidak ditemukan",
      });
    }

    res.json({
      status: true,
      message: "Template berhasil diperbarui",
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: "Gagal update template",
      error: err.message,
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query("DELETE FROM template_notifikasi WHERE id = ?", [
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: false,
        message: "Template tidak ditemukan",
      });
    }

    res.json({
      status: true,
      message: "Template berhasil dihapus",
    });
  } catch (err) {
    res.status(500).json({
      status: false,
      message: "Gagal hapus template",
      error: err.message,
    });
  }
});

module.exports = router;