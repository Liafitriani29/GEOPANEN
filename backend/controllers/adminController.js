const db = require("../config/db");
const axios = require("axios");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

// ======================================================
// IMPORT CONFIG
// ======================================================
const uploadDir = path.join(process.cwd(), "uploads", "imports");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const importUpload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
}).single("file");

const runUploadImport = (req, res) => {
  return new Promise((resolve, reject) => {
    importUpload(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

// ======================================================
// HELPERS
// ======================================================
const cleanText = (value) => String(value || "").trim();

const normalizeStatus = (value) => {
  const text = String(value || "aktif").toLowerCase();

  if (
    text.includes("hapus") ||
    text.includes("delete") ||
    text.includes("deleted")
  ) {
    return "dihapus";
  }

  if (
    text.includes("nonaktif") ||
    text.includes("inactive") ||
    text.includes("tidak") ||
    text === "0"
  ) {
    return "nonaktif";
  }

  if (
    text.includes("verifikasi") ||
    text.includes("pending") ||
    text.includes("menunggu")
  ) {
    return "verifikasi";
  }

  return "aktif";
};

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const getPetaniSelectSql = () => {
  return `
    SELECT
      u.id,
      u.nama,
      u.email,
      u.role,
      u.no_hp,
      u.foto_url,
      COALESCE(u.status, 'aktif') AS status,
      u.created_at,

      COALESCE(COUNT(DISTINCT l.id), 0) AS total_lahan,

      COALESCE(
        SUM(
          CASE
            WHEN l.luas_ha IS NOT NULL AND l.luas_ha > 0 THEN l.luas_ha
            WHEN l.luas_m2 IS NOT NULL AND l.luas_m2 > 0 THEN l.luas_m2 / 10000
            ELSE 0
          END
        ),
        0
      ) AS total_luas,

      'Padi' AS komoditas,

      COALESCE(
        NULLIF(GROUP_CONCAT(DISTINCT d.nama_desa ORDER BY d.nama_desa SEPARATOR ', '), ''),
        '-'
      ) AS nama_desa,

      COALESCE(
        NULLIF(GROUP_CONCAT(DISTINCT k.nama_kecamatan ORDER BY k.nama_kecamatan SEPARATOR ', '), ''),
        '-'
      ) AS nama_kecamatan

    FROM users u

    LEFT JOIN lahan l
      ON l.user_id = u.id OR l.petani_id = u.id

    LEFT JOIN desa d
      ON d.id = l.desa_id

    LEFT JOIN kecamatan k
      ON k.id = l.kecamatan_id
  `;
};

const getPetaniGroupBySql = () => {
  return `
    GROUP BY
      u.id,
      u.nama,
      u.email,
      u.role,
      u.no_hp,
      u.foto_url,
      u.status,
      u.created_at
  `;
};

// ======================================================
// PETANI
// ======================================================
const getPetani = (req, res) => {
  const sql = `
    ${getPetaniSelectSql()}
    WHERE u.role = 'petani'
      AND COALESCE(u.status, 'aktif') <> 'dihapus'
    ${getPetaniGroupBySql()}
    ORDER BY u.id DESC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      return res.status(500).json({
        status: false,
        message: "Gagal mengambil data petani.",
        error: err.message,
      });
    }

    return res.json({
      status: true,
      message: "success",
      data: rows,
    });
  });
};

const getPetaniById = (req, res) => {
  const { id } = req.params;

  const sql = `
    ${getPetaniSelectSql()}
    WHERE u.role = 'petani'
      AND COALESCE(u.status, 'aktif') <> 'dihapus'
      AND u.id = ?
    ${getPetaniGroupBySql()}
    LIMIT 1
  `;

  db.query(sql, [id], (err, rows) => {
    if (err) {
      return res.status(500).json({
        status: false,
        message: "Gagal mengambil detail petani.",
        error: err.message,
      });
    }

    return res.json({
      status: true,
      message: "success",
      data: rows[0] || null,
    });
  });
};

const createPetani = async (req, res) => {
  try {
    const nama = cleanText(req.body.nama);
    const email = cleanText(req.body.email);
    const password = cleanText(req.body.password);
    const noHp = cleanText(req.body.no_hp || req.body.nomor_hp);
    const status = normalizeStatus(req.body.status);

    if (!nama || !email || !password) {
      return res.status(400).json({
        status: false,
        message: "Nama, email, dan password wajib diisi.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const sql = `
      INSERT INTO users
      (nama, email, password, role, no_hp, status, created_at)
      VALUES (?, ?, ?, 'petani', ?, ?, NOW())
    `;

    db.query(sql, [nama, email, hashedPassword, noHp || null, status], (err) => {
      if (err) {
        return res.status(500).json({
          status: false,
          message:
            err.code === "ER_DUP_ENTRY"
              ? "Email sudah terdaftar."
              : "Gagal menambah petani.",
          error: err.message,
        });
      }

      return res.json({
        status: true,
        message: "Petani berhasil ditambahkan.",
      });
    });
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: "Gagal menambah petani.",
      error: err.message,
    });
  }
};

const updatePetani = async (req, res) => {
  try {
    const { id } = req.params;

    const nama = cleanText(req.body.nama);
    const email = cleanText(req.body.email);
    const password = cleanText(req.body.password);
    const noHp = cleanText(req.body.no_hp || req.body.nomor_hp);
    const status = normalizeStatus(req.body.status);

    if (!nama || !email) {
      return res.status(400).json({
        status: false,
        message: "Nama dan email wajib diisi.",
      });
    }

    const fields = ["nama = ?", "email = ?", "no_hp = ?", "status = ?"];
    const values = [nama, email, noHp || null, status];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      fields.push("password = ?");
      values.push(hashedPassword);
    }

    values.push(id);

    const sql = `
      UPDATE users
      SET ${fields.join(", ")}
      WHERE id = ?
        AND role = 'petani'
        AND COALESCE(status, 'aktif') <> 'dihapus'
    `;

    db.query(sql, values, (err, result) => {
      if (err) {
        return res.status(500).json({
          status: false,
          message:
            err.code === "ER_DUP_ENTRY"
              ? "Email sudah digunakan."
              : "Gagal memperbarui petani.",
          error: err.message,
        });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          status: false,
          message: "Petani tidak ditemukan.",
        });
      }

      return res.json({
        status: true,
        message: "Petani berhasil diperbarui.",
      });
    });
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: "Gagal memperbarui petani.",
      error: err.message,
    });
  }
};

// ======================================================
// DELETE PETANI
// SOFT DELETE AGAR TIDAK KENA FOREIGN KEY
// ======================================================
const deletePetani = (req, res) => {
  const { id } = req.params;

  const sql = `
    UPDATE users
    SET status = 'dihapus'
    WHERE id = ?
      AND role = 'petani'
  `;

  db.query(sql, [id], (err, result) => {
    if (err) {
      return res.status(500).json({
        status: false,
        message: "Gagal menghapus petani.",
        error: err.message,
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: false,
        message: "Petani tidak ditemukan.",
      });
    }

    return res.json({
      status: true,
      message: "Petani berhasil dihapus dari daftar.",
    });
  });
};

// ======================================================
// PETANI STATS
// ======================================================
const getPetaniStats = (req, res) => {
  const sql = `
    SELECT
      (
        SELECT COUNT(*)
        FROM users
        WHERE role = 'petani'
          AND COALESCE(status, 'aktif') <> 'dihapus'
      ) AS total_petani,

      (
        SELECT COUNT(*)
        FROM users
        WHERE role = 'petani'
          AND COALESCE(status, 'aktif') = 'aktif'
      ) AS petani_aktif,

      (
        SELECT COUNT(*)
        FROM users
        WHERE role = 'petani'
          AND COALESCE(status, 'aktif') = 'nonaktif'
      ) AS petani_nonaktif,

      (
        SELECT COUNT(*)
        FROM users
        WHERE role = 'petani'
          AND COALESCE(status, 'aktif') = 'verifikasi'
      ) AS petani_verifikasi,

      (
        SELECT COALESCE(
          SUM(
            CASE
              WHEN l.luas_ha IS NOT NULL AND l.luas_ha > 0 THEN l.luas_ha
              WHEN l.luas_m2 IS NOT NULL AND l.luas_m2 > 0 THEN l.luas_m2 / 10000
              ELSE 0
            END
          ),
          0
        )
        FROM lahan l
        LEFT JOIN users u
          ON u.id = l.user_id OR u.id = l.petani_id
        WHERE u.role = 'petani'
          AND COALESCE(u.status, 'aktif') <> 'dihapus'
      ) AS total_luas,

      (
        SELECT COUNT(*)
        FROM users
        WHERE role = 'petani'
          AND COALESCE(status, 'aktif') <> 'dihapus'
          AND created_at >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')
      ) AS petani_bulan_ini,

      (
        SELECT COUNT(*)
        FROM users
        WHERE role = 'petani'
          AND COALESCE(status, 'aktif') <> 'dihapus'
          AND created_at >= DATE_FORMAT(CURRENT_DATE() - INTERVAL 1 MONTH, '%Y-%m-01')
          AND created_at < DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')
      ) AS petani_bulan_lalu
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      return res.status(500).json({
        status: false,
        message: "Gagal mengambil statistik petani.",
        error: err.message,
      });
    }

    const row = rows[0] || {};

    const totalPetani = Number(row.total_petani || 0);
    const totalLuas = Number(row.total_luas || 0);
    const petaniBulanIni = Number(row.petani_bulan_ini || 0);
    const petaniBulanLalu = Number(row.petani_bulan_lalu || 0);

    return res.json({
      status: true,
      message: "success",
      data: {
        total_petani: totalPetani,
        petani_aktif: Number(row.petani_aktif || 0),
        petani_nonaktif: Number(row.petani_nonaktif || 0),
        petani_verifikasi: Number(row.petani_verifikasi || 0),
        total_luas: totalLuas,
        rata_rata_luas: totalPetani > 0 ? totalLuas / totalPetani : 0,
        petani_bulan_ini: petaniBulanIni,
        petani_bulan_lalu: petaniBulanLalu,
        selisih_petani: petaniBulanIni - petaniBulanLalu,
        luas_bulan_ini: totalLuas,
        luas_bulan_lalu: totalLuas,
        selisih_luas: 0,
      },
    });
  });
};

// ======================================================
// IMPORT PETANI
// ======================================================
const importPetani = async (req, res) => {
  try {
    await runUploadImport(req, res);

    if (!req.file) {
      return res.status(400).json({
        status: false,
        message: "File import wajib diupload.",
      });
    }

    const workbook = XLSX.readFile(req.file.path);
    const firstSheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]);

    fs.unlink(req.file.path, () => {});

    if (!rows.length) {
      return res.status(400).json({
        status: false,
        message: "File import kosong.",
      });
    }

    const values = [];

    for (const row of rows) {
      const nama = cleanText(row.nama || row.Nama || row["Nama"]);
      const email = cleanText(row.email || row.Email || row["Email"]);
      const noHp = cleanText(
        row.no_hp || row.nomor_hp || row["No HP"] || row["Nomor HP"]
      );
      const status = normalizeStatus(row.status || row.Status || "aktif");
      const passwordPlain = cleanText(row.password || row.Password || "123456");

      if (!nama || !email) continue;

      const hashedPassword = await bcrypt.hash(passwordPlain, 10);

      values.push([nama, email, hashedPassword, "petani", noHp || null, status]);
    }

    if (!values.length) {
      return res.status(400).json({
        status: false,
        message: "Tidak ada data valid. Minimal wajib ada kolom nama dan email.",
      });
    }

    const sql = `
      INSERT INTO users
      (nama, email, password, role, no_hp, status)
      VALUES ?
      ON DUPLICATE KEY UPDATE
        nama = VALUES(nama),
        no_hp = VALUES(no_hp),
        status = VALUES(status)
    `;

    db.query(sql, [values], (err) => {
      if (err) {
        return res.status(500).json({
          status: false,
          message: "Import petani gagal.",
          error: err.message,
        });
      }

      return res.json({
        status: true,
        message: "Import petani berhasil.",
        total: values.length,
      });
    });
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: "Import petani gagal.",
      error: err.message,
    });
  }
};

// ======================================================
// NOTIFIKASI
// ======================================================
const getUnreadNotificationCount = (req, res) => {
  const sql = `
    SELECT COUNT(*) AS total
    FROM notifikasi
    WHERE is_read = 0
      AND (role = 'admin' OR role IS NULL)
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      return res.json({
        status: true,
        message: "Tabel notifikasi belum tersedia.",
        count: 0,
      });
    }

    return res.json({
      status: true,
      message: "success",
      count: Number(rows[0]?.total || 0),
    });
  });
};

// ======================================================
// KECAMATAN
// ======================================================
const getKecamatan = (req, res) => {
  const sql = `
    SELECT id, nama_kecamatan, kode_kecamatan
    FROM kecamatan
    ORDER BY id DESC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      return res.status(500).json({
        status: false,
        message: "Gagal mengambil kecamatan.",
        error: err.message,
      });
    }

    return res.json({
      status: true,
      message: "success",
      data: rows,
    });
  });
};

const createKecamatan = (req, res) => {
  const { nama_kecamatan, kode_kecamatan } = req.body;

  const sql = `
    INSERT INTO kecamatan
    (nama_kecamatan, kode_kecamatan)
    VALUES (?, ?)
  `;

  db.query(sql, [nama_kecamatan, kode_kecamatan], (err) => {
    if (err) {
      return res.status(500).json({
        status: false,
        message: "Gagal menambah kecamatan.",
        error: err.message,
      });
    }

    return res.json({
      status: true,
      message: "Kecamatan berhasil ditambahkan.",
    });
  });
};

const updateKecamatan = (req, res) => {
  const { id } = req.params;
  const { nama_kecamatan, kode_kecamatan } = req.body;

  const sql = `
    UPDATE kecamatan
    SET nama_kecamatan = ?, kode_kecamatan = ?
    WHERE id = ?
  `;

  db.query(sql, [nama_kecamatan, kode_kecamatan, id], (err) => {
    if (err) {
      return res.status(500).json({
        status: false,
        message: "Gagal memperbarui kecamatan.",
        error: err.message,
      });
    }

    return res.json({
      status: true,
      message: "Kecamatan berhasil diperbarui.",
    });
  });
};

const deleteKecamatan = (req, res) => {
  const { id } = req.params;

  const sql = `
    DELETE FROM kecamatan
    WHERE id = ?
  `;

  db.query(sql, [id], (err) => {
    if (err) {
      return res.status(500).json({
        status: false,
        message: "Gagal menghapus kecamatan.",
        error: err.message,
      });
    }

    return res.json({
      status: true,
      message: "Kecamatan berhasil dihapus.",
    });
  });
};

// ======================================================
// CUACA
// ======================================================
const getCuaca = async (req, res) => {
  try {
    const apiKey =
      process.env.OPENWEATHER_API_KEY || "c2a7097008f4af97f1f88f2cef7e7fa8";

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=-7.557&lon=110.822&appid=${apiKey}&units=metric`;

    const response = await axios.get(url);
    const w = response.data;

    return res.json({
      status: true,
      message: "success",
      data: [
        {
          suhu: w.main?.temp,
          kelembapan: w.main?.humidity,
          kondisi: w.weather?.[0]?.description,
        },
      ],
    });
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: "Gagal mengambil cuaca.",
      error: err.message,
    });
  }
};

// ======================================================
// PREDIKSI PANEN
// ======================================================
const prediksiPanen = (req, res) => {
  const { lahan_id } = req.body;

  const sql = `
    SELECT id, nama_lahan, luas_ha
    FROM lahan
    ${lahan_id ? "WHERE id = ?" : ""}
  `;

  db.query(sql, lahan_id ? [lahan_id] : [], async (err, result) => {
    if (err) {
      return res.status(500).json({
        status: false,
        message: "Gagal mengambil lahan.",
        error: err.message,
      });
    }

    if (!result.length) {
      return res.status(404).json({
        status: false,
        message: "Lahan tidak ditemukan.",
      });
    }

    try {
      const apiKey =
        process.env.OPENWEATHER_API_KEY || "c2a7097008f4af97f1f88f2cef7e7fa8";

      const url = `https://api.openweathermap.org/data/2.5/weather?lat=-7.557&lon=110.822&appid=${apiKey}&units=metric`;

      const r = await axios.get(url);
      const w = r.data;
      const lahan = result[0];

      let factor = 1;
      const suhu = w.main?.temp;
      const hum = w.main?.humidity;

      if (suhu > 32) factor -= 0.1;
      if (suhu < 20) factor -= 0.05;
      if (hum > 80) factor += 0.05;

      const hasil = Number(lahan.luas_ha || 0) * 6 * factor;

      return res.json({
        status: true,
        message: "success",
        data: {
          lahan: lahan.nama_lahan,
          prediksi_ton: Number(hasil.toFixed(2)),
          prediksi_kg: Number((hasil * 1000).toFixed(0)),
        },
      });
    } catch (e) {
      return res.status(500).json({
        status: false,
        message: "Gagal mengambil cuaca.",
        error: e.message,
      });
    }
  });
};
const getPenyuluh = (req, res) => {
  const sql = `
    SELECT
      id,
      nama,
      email,
      no_hp,
      role,
      CONCAT('PYN-', LPAD(id, 3, '0')) AS kode_penyuluh
    FROM users
    WHERE role = 'penyuluh'
      AND COALESCE(status, 'aktif') <> 'dihapus'
    ORDER BY nama ASC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      return res.status(500).json({
        status: false,
        message: "Gagal mengambil data penyuluh.",
        error: err.message,
      });
    }

    res.json({
      status: true,
      message: "success",
      data: rows,
    });
  });
};

const getDesa = (req, res) => {
  const sql = `
    SELECT
      d.id,
      d.nama_desa,
      d.kecamatan_id,
      k.nama_kecamatan
    FROM desa d
    LEFT JOIN kecamatan k
      ON k.id = d.kecamatan_id
    ORDER BY d.nama_desa ASC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      return res.status(500).json({
        status: false,
        message: "Gagal mengambil data desa.",
        error: err.message,
      });
    }

    res.json({
      status: true,
      message: "success",
      data: rows,
    });
  });
};

module.exports = {
  getPetani,
  getPetaniById,
  createPetani,
  updatePetani,
  deletePetani,

  getPetaniStats,
  importPetani,
  getUnreadNotificationCount,

  getKecamatan,
  createKecamatan,
  updateKecamatan,
  deleteKecamatan,

  getCuaca,
  prediksiPanen,
  getPenyuluh,
  getDesa,
};