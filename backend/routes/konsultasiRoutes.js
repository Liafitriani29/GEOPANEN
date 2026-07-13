const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const db = require("../config/db");

const router = express.Router();

const uploadDir = path.join(__dirname, "..", "uploads", "konsultasi");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/jpg",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Format file tidak didukung"));
    }

    cb(null, true);
  },
});

const normalizeStatusAfterMessage = (senderRole) => {
  if (String(senderRole).toLowerCase() === "penyuluh") return "dibalas";
  return "open";
};

router.get("/petani/:petaniId", async (req, res) => {
  try {
    const { petaniId } = req.params;

    const rows = await query(
      `
      SELECT
        k.id,
        k.petani_id,
        k.penyuluh_id,
        k.lahan_id,
        k.status,
        k.created_at,
        k.updated_at,

        COALESCE(p.nama, 'Petani') AS nama_petani,
        COALESCE(py.nama, 'Penyuluh') AS nama_penyuluh,

        COALESCE(l.nama_lahan, '-') AS nama_lahan,
        COALESCE(l.varietas, '-') AS varietas,
        COALESCE(l.luas_ha, 0) AS luas_ha,

        COALESCE(d.nama_desa, '-') AS nama_desa,
        COALESCE(kc.nama_kecamatan, '-') AS nama_kecamatan,

        (
          SELECT pk.pesan
          FROM pesan_konsultasi pk
          WHERE pk.konsultasi_id = k.id
          ORDER BY pk.created_at DESC, pk.id DESC
          LIMIT 1
        ) AS pesan_terakhir,

        (
          SELECT pk.created_at
          FROM pesan_konsultasi pk
          WHERE pk.konsultasi_id = k.id
          ORDER BY pk.created_at DESC, pk.id DESC
          LIMIT 1
        ) AS pesan_terakhir_at,

        (
          SELECT COUNT(*)
          FROM pesan_konsultasi pk
          WHERE pk.konsultasi_id = k.id
          AND pk.is_read = 0
          AND pk.sender_role = 'penyuluh'
        ) AS unread_count

      FROM konsultasi k
      LEFT JOIN users p ON p.id = k.petani_id
      LEFT JOIN users py ON py.id = k.penyuluh_id
      LEFT JOIN lahan l ON l.id = k.lahan_id
      LEFT JOIN desa d ON d.id = l.desa_id
      LEFT JOIN kecamatan kc ON kc.id = l.kecamatan_id
      WHERE k.petani_id = ?
      ORDER BY k.updated_at DESC, k.id DESC
      `,
      [petaniId]
    );

    res.json({
      status: true,
      message: "Konsultasi petani berhasil diambil",
      data: rows,
    });
  } catch (err) {
    console.error("ERROR GET KONSULTASI PETANI:", err);
    res.status(500).json({
      status: false,
      message: "Gagal mengambil konsultasi petani",
      error: err.message,
    });
  }
});

router.get("/penyuluh/:penyuluhId", async (req, res) => {
  try {
    const { penyuluhId } = req.params;

    const rows = await query(
      `
      SELECT
        k.id,
        k.petani_id,
        k.penyuluh_id,
        k.lahan_id,
        k.status,
        k.created_at,
        k.updated_at,

        COALESCE(p.nama, 'Petani') AS nama_petani,
        COALESCE(p.email, '-') AS email_petani,
        '' AS no_hp,
        '' AS foto_url,

        COALESCE(l.nama_lahan, '-') AS nama_lahan,
        COALESCE(l.varietas, '-') AS varietas,
        COALESCE(l.luas_ha, 0) AS luas_ha,

        COALESCE(d.nama_desa, '-') AS nama_desa,
        COALESCE(kc.nama_kecamatan, '-') AS nama_kecamatan,

        COALESCE(mt.umur_tanam, 0) AS umur_tanam,
        COALESCE(mt.fase_tanam, 'Vegetatif Awal') AS fase_tanam,
        COALESCE(mt.status_kesehatan, 'sehat') AS status_kesehatan,

        (
          SELECT pk.pesan
          FROM pesan_konsultasi pk
          WHERE pk.konsultasi_id = k.id
          ORDER BY pk.created_at DESC, pk.id DESC
          LIMIT 1
        ) AS pesan_terakhir,

        (
          SELECT pk.created_at
          FROM pesan_konsultasi pk
          WHERE pk.konsultasi_id = k.id
          ORDER BY pk.created_at DESC, pk.id DESC
          LIMIT 1
        ) AS pesan_terakhir_at,

        (
          SELECT COUNT(*)
          FROM pesan_konsultasi pk
          WHERE pk.konsultasi_id = k.id
          AND pk.is_read = 0
          AND pk.sender_role = 'petani'
        ) AS unread_count

      FROM konsultasi k
      LEFT JOIN users p ON p.id = k.petani_id
      LEFT JOIN lahan l ON l.id = k.lahan_id
      LEFT JOIN desa d ON d.id = l.desa_id
      LEFT JOIN kecamatan kc ON kc.id = l.kecamatan_id
      LEFT JOIN (
        SELECT m1.*
        FROM monitoring_tanaman m1
        INNER JOIN (
          SELECT sawah_id, MAX(id) AS max_id
          FROM monitoring_tanaman
          GROUP BY sawah_id
        ) mx ON mx.max_id = m1.id
      ) mt ON mt.sawah_id = l.id
      WHERE k.penyuluh_id = ?
      ORDER BY k.updated_at DESC, k.id DESC
      `,
      [penyuluhId]
    );

    res.json({
      status: true,
      message: "Konsultasi penyuluh berhasil diambil",
      data: rows,
    });
  } catch (err) {
    console.error("ERROR GET KONSULTASI PENYULUH:", err);
    res.status(500).json({
      status: false,
      message: "Gagal mengambil konsultasi penyuluh",
      error: err.message,
    });
  }
});

router.get("/:id/pesan", async (req, res) => {
  try {
    const { id } = req.params;

    const rows = await query(
      `
      SELECT
        pk.id,
        pk.konsultasi_id,
        pk.sender_id,
        pk.sender_role,
        pk.pesan,
        pk.file_url,
        pk.file_name,
        pk.file_type,
        pk.file_size,
        pk.is_read,
        pk.created_at,
        COALESCE(u.nama, pk.sender_role) AS nama_pengirim
      FROM pesan_konsultasi pk
      LEFT JOIN users u ON u.id = pk.sender_id
      WHERE pk.konsultasi_id = ?
      ORDER BY pk.created_at ASC, pk.id ASC
      `,
      [id]
    );

    res.json({
      status: true,
      message: "Pesan konsultasi berhasil diambil",
      data: rows,
    });
  } catch (err) {
    console.error("ERROR GET PESAN:", err);
    res.status(500).json({
      status: false,
      message: "Gagal mengambil pesan",
      error: err.message,
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const { petani_id, penyuluh_id, lahan_id, pesan } = req.body || {};

    if (!petani_id || !penyuluh_id || !pesan) {
      return res.status(400).json({
        status: false,
        message: "petani_id, penyuluh_id, dan pesan wajib diisi",
      });
    }

    const result = await query(
      `
      INSERT INTO konsultasi
      (petani_id, penyuluh_id, lahan_id, status, created_at, updated_at)
      VALUES (?, ?, ?, 'open', NOW(), NOW())
      `,
      [petani_id, penyuluh_id, lahan_id || null]
    );

    const konsultasiId = result.insertId;

    await query(
      `
      INSERT INTO pesan_konsultasi
      (konsultasi_id, sender_id, sender_role, pesan, is_read, created_at)
      VALUES (?, ?, 'petani', ?, 0, NOW())
      `,
      [konsultasiId, petani_id, pesan]
    );

    res.json({
      status: true,
      message: "Konsultasi berhasil dibuat",
      data: {
        id: konsultasiId,
        petani_id,
        penyuluh_id,
        lahan_id,
        status: "open",
      },
    });
  } catch (err) {
    console.error("ERROR CREATE KONSULTASI:", err);
    res.status(500).json({
      status: false,
      message: "Gagal membuat konsultasi",
      error: err.message,
    });
  }
});

router.post("/:id/pesan", async (req, res) => {
  try {
    const { id } = req.params;
    const { sender_id, sender_role, pesan } = req.body || {};

    if (!sender_id || !sender_role || !pesan) {
      return res.status(400).json({
        status: false,
        message: "sender_id, sender_role, dan pesan wajib diisi",
      });
    }

    await query(
      `
      INSERT INTO pesan_konsultasi
      (konsultasi_id, sender_id, sender_role, pesan, is_read, created_at)
      VALUES (?, ?, ?, ?, 0, NOW())
      `,
      [id, sender_id, sender_role, pesan]
    );

    await query(
      `
      UPDATE konsultasi
      SET status = ?, updated_at = NOW()
      WHERE id = ?
      `,
      [normalizeStatusAfterMessage(sender_role), id]
    );

    res.json({
      status: true,
      message: "Pesan berhasil dikirim",
    });
  } catch (err) {
    console.error("ERROR SEND PESAN:", err);
    res.status(500).json({
      status: false,
      message: "Gagal mengirim pesan",
      error: err.message,
    });
  }
});

router.post("/:id/pesan/upload", upload.single("file"), async (req, res) => {
  try {
    const { id } = req.params;
    const { sender_id, sender_role, pesan } = req.body || {};

    if (!sender_id || !sender_role) {
      return res.status(400).json({
        status: false,
        message: "sender_id dan sender_role wajib diisi",
      });
    }

    if (!req.file && !pesan) {
      return res.status(400).json({
        status: false,
        message: "File atau pesan wajib diisi",
      });
    }

    const fileUrl = req.file
      ? `/uploads/konsultasi/${req.file.filename}`
      : null;

    await query(
      `
      INSERT INTO pesan_konsultasi
      (
        konsultasi_id,
        sender_id,
        sender_role,
        pesan,
        file_url,
        file_name,
        file_type,
        file_size,
        is_read,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())
      `,
      [
        id,
        sender_id,
        sender_role,
        pesan || "",
        fileUrl,
        req.file?.originalname || null,
        req.file?.mimetype || null,
        req.file?.size || null,
      ]
    );

    await query(
      `
      UPDATE konsultasi
      SET status = ?, updated_at = NOW()
      WHERE id = ?
      `,
      [normalizeStatusAfterMessage(sender_role), id]
    );

    res.json({
      status: true,
      message: "Lampiran berhasil dikirim",
      data: {
        file_url: fileUrl,
        file_name: req.file?.originalname || null,
        file_type: req.file?.mimetype || null,
        file_size: req.file?.size || null,
      },
    });
  } catch (err) {
    console.error("ERROR UPLOAD PESAN:", err);
    res.status(500).json({
      status: false,
      message: "Gagal upload lampiran",
      error: err.message,
    });
  }
});

router.patch("/:id/selesai", async (req, res) => {
  try {
    const { id } = req.params;

    await query(
      `
      UPDATE konsultasi
      SET status = 'selesai', updated_at = NOW()
      WHERE id = ?
      `,
      [id]
    );

    res.json({
      status: true,
      message: "Konsultasi berhasil diselesaikan",
    });
  } catch (err) {
    console.error("ERROR SELESAI KONSULTASI:", err);
    res.status(500).json({
      status: false,
      message: "Gagal menyelesaikan konsultasi",
      error: err.message,
    });
  }
});

module.exports = router;