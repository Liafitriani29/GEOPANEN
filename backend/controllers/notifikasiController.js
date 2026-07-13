const db = require("../config/db");

// =====================
// GET NOTIFIKASI USER
// =====================
exports.getNotifikasi = (req, res) => {
  const userId = req.query.user_id || req.query.petani_id;
  const role = req.query.role || "petani";

  if (!userId) {
    return res.status(400).json({
      message: "user_id wajib diisi",
    });
  }

  const sql = `
    SELECT 
      id,
      user_id,
      role,
      judul,
      pesan,
      link,
      is_read,
      created_at
    FROM notifikasi
    WHERE user_id = ? AND role = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 50
  `;

  db.query(sql, [userId, role], (err, result) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal mengambil notifikasi",
        error: err.sqlMessage || err.message,
      });
    }

    return res.json({
      message: "success",
      data: result || [],
    });
  });
};

// =====================
// GET UNREAD COUNT
// =====================
exports.getUnreadCount = (req, res) => {
  const userId = req.query.user_id || req.query.petani_id;
  const role = req.query.role || "petani";

  if (!userId) {
    return res.status(400).json({
      message: "user_id wajib diisi",
    });
  }

  const sql = `
    SELECT COUNT(*) AS total
    FROM notifikasi
    WHERE user_id = ? AND role = ? AND is_read = 0
  `;

  db.query(sql, [userId, role], (err, result) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal menghitung notifikasi",
        error: err.sqlMessage || err.message,
      });
    }

    return res.json({
      message: "success",
      total: result?.[0]?.total || 0,
    });
  });
};

// =====================
// READ ONE NOTIFIKASI
// =====================
exports.readNotifikasi = (req, res) => {
  const { id } = req.params;

  const sql = `
    UPDATE notifikasi 
    SET is_read = 1 
    WHERE id = ?
  `;

  db.query(sql, [id], (err) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal update notifikasi",
        error: err.sqlMessage || err.message,
      });
    }

    return res.json({
      message: "Notifikasi dibaca",
    });
  });
};

// =====================
// READ ALL NOTIFIKASI (FIX UTAMA)
// =====================
exports.readAllNotifikasi = (req, res) => {
  const userId = req.body.user_id || req.query.user_id;
  const role = req.body.role || req.query.role || "petani";

  if (!userId) {
    return res.status(400).json({
      message: "user_id wajib diisi",
    });
  }

  const sql = `
    UPDATE notifikasi
    SET is_read = 1
    WHERE user_id = ? AND role = ?
  `;

  db.query(sql, [userId, role], (err) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal update semua notifikasi",
        error: err.sqlMessage || err.message,
      });
    }

    return res.json({
      message: "Semua notifikasi dibaca",
      success: true,
    });
  });
};