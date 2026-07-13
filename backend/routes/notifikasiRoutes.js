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

const normalizeStatus = (value) => {
  const raw = String(value || "").toLowerCase();

  if (raw.includes("draft")) return "draft";
  if (raw.includes("jadwal")) return "dijadwalkan";
  if (raw.includes("dibaca")) return "dibaca";
  if (raw.includes("terkirim")) return "terkirim";

  return "terkirim";
};

const getStatusKirim = (status) => {
  if (status === "terkirim" || status === "dibaca") return "terkirim";
  return "pending";
};

const getIsRead = (status, value) => {
  if (status === "dibaca") return 1;
  return Number(value || 0);
};

const SELECT_NOTIFIKASI = `
  SELECT
    n.id,
    n.user_id,
    n.role,
    COALESCE(n.tipe, 'informasi') AS tipe,
    COALESCE(n.judul, '') AS judul,
    COALESCE(n.pesan, '') AS pesan,
    COALESCE(n.status, 'terkirim') AS status,
    COALESCE(n.status_kirim, 'pending') AS status_kirim,
    COALESCE(n.is_read, 0) AS is_read,
    n.jadwal_kirim,
    n.read_at,
    n.created_at,
    n.updated_at,
    n.dikirim_oleh,
    n.lahan_id,

    COALESCE(
      u.nama,
      (
        SELECT u2.nama
        FROM lahan l2
        LEFT JOIN users u2
          ON u2.id = COALESCE(l2.user_id, l2.petani_id)
        WHERE COALESCE(l2.user_id, l2.petani_id) = n.user_id
        ORDER BY l2.id DESC
        LIMIT 1
      ),
      CONCAT('Petani ', n.user_id)
    ) AS nama_petani,

    COALESCE(u.email, '-') AS email_petani,

    COALESCE(
      l.nama_lahan,
      (
        SELECT l2.nama_lahan
        FROM lahan l2
        WHERE COALESCE(l2.user_id, l2.petani_id) = n.user_id
        ORDER BY l2.id DESC
        LIMIT 1
      ),
      '-'
    ) AS nama_lahan,

    COALESCE(
      d.nama_desa,
      (
        SELECT d2.nama_desa
        FROM lahan l2
        LEFT JOIN desa d2
          ON d2.id = l2.desa_id
        WHERE COALESCE(l2.user_id, l2.petani_id) = n.user_id
        ORDER BY l2.id DESC
        LIMIT 1
      ),
      '-'
    ) AS nama_desa,

    COALESCE(
      k.nama_kecamatan,
      (
        SELECT k2.nama_kecamatan
        FROM lahan l2
        LEFT JOIN kecamatan k2
          ON k2.id = l2.kecamatan_id
        WHERE COALESCE(l2.user_id, l2.petani_id) = n.user_id
        ORDER BY l2.id DESC
        LIMIT 1
      ),
      '-'
    ) AS nama_kecamatan

  FROM notifikasi n
  LEFT JOIN users u
    ON u.id = n.user_id
  LEFT JOIN lahan l
    ON l.id = n.lahan_id
  LEFT JOIN desa d
    ON d.id = l.desa_id
  LEFT JOIN kecamatan k
    ON k.id = l.kecamatan_id
`;

// =============================
// GET ALL NOTIFIKASI
// =============================
router.get("/", async (req, res) => {
  try {
    const { user_id, role, status, tipe } = req.query;

    const where = [];
    const params = [];

    if (user_id) {
      where.push("n.user_id = ?");
      params.push(user_id);
    }

    if (role) {
      where.push("n.role = ?");
      params.push(role);
    }

    if (status && status !== "all") {
      where.push("n.status = ?");
      params.push(status);
    }

    if (tipe && tipe !== "all") {
      where.push("n.tipe = ?");
      params.push(tipe);
    }

    let sql = SELECT_NOTIFIKASI;

    if (where.length > 0) {
      sql += ` WHERE ${where.join(" AND ")}`;
    }

    sql += ` ORDER BY n.created_at DESC, n.id DESC`;

    const rows = await query(sql, params);

    res.json({
      status: true,
      message: "Notifikasi berhasil diambil",
      data: rows,
    });
  } catch (err) {
    console.log("ERROR GET NOTIFIKASI:", err);

    res.status(500).json({
      status: false,
      message: "Gagal mengambil notifikasi",
      error: err.message,
    });
  }
});

// =============================
// COUNT BELUM DIBACA
// =============================
router.get("/count", async (req, res) => {
  try {
    const { user_id, role } = req.query;

    const where = ["(is_read = 0 OR is_read IS NULL)"];
    const params = [];

    if (user_id) {
      where.push("user_id = ?");
      params.push(user_id);
    }

    if (role) {
      where.push("role = ?");
      params.push(role);
    }

    const rows = await query(
      `
      SELECT COUNT(*) AS total
      FROM notifikasi
      WHERE ${where.join(" AND ")}
      `,
      params
    );

    res.json({
      status: true,
      total: rows[0]?.total || 0,
    });
  } catch (err) {
    console.log("ERROR COUNT NOTIFIKASI:", err);

    res.status(500).json({
      status: false,
      message: "Gagal menghitung notifikasi",
      error: err.message,
    });
  }
});

// =============================
// CREATE NOTIFIKASI
// =============================
router.post("/", async (req, res) => {
  try {
    const {
      user_id,
      role = "petani",
      tipe = "informasi",
      judul = "",
      pesan = "",
      message = "",
      status = "terkirim",
      jadwal_kirim = null,
      dikirim_oleh = null,
      lahan_id = null,
    } = req.body || {};

    if (!user_id) {
      return res.status(400).json({
        status: false,
        message: "user_id penerima wajib diisi",
      });
    }

    const finalPesan = pesan || message || judul;

    if (!finalPesan) {
      return res.status(400).json({
        status: false,
        message: "Pesan notifikasi wajib diisi",
      });
    }

    const finalStatus = normalizeStatus(status);
    const finalStatusKirim = getStatusKirim(finalStatus);
    const finalIsRead = getIsRead(finalStatus, 0);

    const result = await query(
      `
      INSERT INTO notifikasi
        (
          user_id,
          role,
          tipe,
          judul,
          pesan,
          status,
          status_kirim,
          is_read,
          jadwal_kirim,
          dikirim_oleh,
          lahan_id,
          created_at,
          updated_at
        )
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [
        user_id,
        role,
        tipe,
        judul || "Notifikasi Baru",
        finalPesan,
        finalStatus,
        finalStatusKirim,
        finalIsRead,
        finalStatus === "dijadwalkan" ? jadwal_kirim : null,
        dikirim_oleh,
        lahan_id || null,
      ]
    );

    res.status(201).json({
      status: true,
      message: "Notifikasi berhasil dibuat",
      data: {
        id: result.insertId,
        user_id,
        role,
        tipe,
        judul: judul || "Notifikasi Baru",
        pesan: finalPesan,
        status: finalStatus,
        status_kirim: finalStatusKirim,
        is_read: finalIsRead,
        jadwal_kirim: finalStatus === "dijadwalkan" ? jadwal_kirim : null,
        dikirim_oleh,
        lahan_id: lahan_id || null,
      },
    });
  } catch (err) {
    console.log("ERROR CREATE NOTIFIKASI:", err);

    res.status(500).json({
      status: false,
      message: "Gagal membuat notifikasi",
      error: err.message,
    });
  }
});

// =============================
// UPDATE NOTIFIKASI
// =============================
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      user_id,
      role = "petani",
      tipe = "informasi",
      judul = "",
      pesan = "",
      message = "",
      status = "terkirim",
      jadwal_kirim = null,
      dikirim_oleh = null,
      lahan_id = null,
    } = req.body || {};

    if (!user_id) {
      return res.status(400).json({
        status: false,
        message: "user_id penerima wajib diisi",
      });
    }

    const finalPesan = pesan || message || judul;

    if (!finalPesan) {
      return res.status(400).json({
        status: false,
        message: "Pesan notifikasi wajib diisi",
      });
    }

    const finalStatus = normalizeStatus(status);
    const finalStatusKirim = getStatusKirim(finalStatus);
    const finalIsRead = getIsRead(finalStatus, 0);

    const result = await query(
      `
      UPDATE notifikasi
      SET
        user_id = ?,
        role = ?,
        tipe = ?,
        judul = ?,
        pesan = ?,
        status = ?,
        status_kirim = ?,
        is_read = ?,
        jadwal_kirim = ?,
        dikirim_oleh = ?,
        lahan_id = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [
        user_id,
        role,
        tipe,
        judul || "Notifikasi Baru",
        finalPesan,
        finalStatus,
        finalStatusKirim,
        finalIsRead,
        finalStatus === "dijadwalkan" ? jadwal_kirim : null,
        dikirim_oleh,
        lahan_id || null,
        id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: false,
        message: "Notifikasi tidak ditemukan",
      });
    }

    res.json({
      status: true,
      message: "Notifikasi berhasil diperbarui",
    });
  } catch (err) {
    console.log("ERROR UPDATE NOTIFIKASI:", err);

    res.status(500).json({
      status: false,
      message: "Gagal update notifikasi",
      error: err.message,
    });
  }
});

// =============================
// MARK READ
// =============================
router.put("/:id/read", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `
      UPDATE notifikasi
      SET
        is_read = 1,
        status = 'dibaca',
        status_kirim = 'terkirim',
        read_at = NOW(),
        updated_at = NOW()
      WHERE id = ?
      `,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: false,
        message: "Notifikasi tidak ditemukan",
      });
    }

    res.json({
      status: true,
      message: "Notifikasi berhasil ditandai dibaca",
    });
  } catch (err) {
    console.log("ERROR READ NOTIFIKASI:", err);

    res.status(500).json({
      status: false,
      message: "Gagal update notifikasi",
      error: err.message,
    });
  }
});

// =============================
// DELETE NOTIFIKASI
// =============================
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query("DELETE FROM notifikasi WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: false,
        message: "Notifikasi tidak ditemukan",
      });
    }

    res.json({
      status: true,
      message: "Notifikasi berhasil dihapus",
    });
  } catch (err) {
    console.log("ERROR DELETE NOTIFIKASI:", err);

    res.status(500).json({
      status: false,
      message: "Gagal menghapus notifikasi",
      error: err.message,
    });
  }
});

module.exports = router;