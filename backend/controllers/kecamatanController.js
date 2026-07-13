const db = require("../config/db");
const multer = require("multer");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const uploadDir = path.join(process.cwd(), "uploads", "imports");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const uploadImport = multer({
  dest: uploadDir,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
}).single("file");

const runUploadImport = (req, res) => {
  return new Promise((resolve, reject) => {
    uploadImport(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const cleanText = (value) => {
  return String(value || "").trim();
};

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
    text.includes("tidak") ||
    text.includes("inactive") ||
    text === "0"
  ) {
    return "nonaktif";
  }

  return "aktif";
};

const parsePenyuluhRaw = (raw) => {
  if (!raw) return [];

  return String(raw)
    .split("||")
    .filter(Boolean)
    .map((item) => {
      const [id, nama, email, kode] = item.split("::");

      return {
        id: id || null,
        nama: nama || "-",
        email: email || "-",
        kode_penyuluh: kode || (id ? `PYN-${String(id).padStart(3, "0")}` : "-"),
      };
    });
};

// ======================================================
// GET KECAMATAN DINAMIS
// ======================================================
const getKecamatan = async (req, res) => {
  try {
    const sql = `
      SELECT
        k.id,
        k.nama_kecamatan,
        COALESCE(k.kode_kecamatan, '-') AS kode_kecamatan,
        COALESCE(k.kabupaten, 'Sukoharjo') AS kabupaten,
        COALESCE(k.status, 'aktif') AS status,
        COALESCE(
          k.deskripsi,
          CONCAT(
            'Kecamatan ',
            k.nama_kecamatan,
            ' merupakan wilayah pertanian padi dalam sistem GeoPanen.'
          )
        ) AS deskripsi,
        k.created_at,
        k.updated_at,

        COUNT(DISTINCT d.id) AS jumlah_desa,

        COUNT(
          DISTINCT
          CASE
            WHEN COALESCE(l.petani_id, l.user_id) IS NOT NULL
            THEN COALESCE(l.petani_id, l.user_id)
            ELSE NULL
          END
        ) AS jumlah_petani,

        COUNT(
          DISTINCT
          CASE
            WHEN l.penyuluh_id IS NOT NULL
            THEN l.penyuluh_id
            ELSE NULL
          END
        ) AS jumlah_penyuluh,

        GROUP_CONCAT(
          DISTINCT
          CASE
            WHEN py.id IS NOT NULL
            THEN CONCAT(
              py.id,
              '::',
              COALESCE(py.nama, '-'),
              '::',
              COALESCE(py.email, '-'),
              '::',
              CONCAT('PYN-', LPAD(py.id, 3, '0'))
            )
            ELSE NULL
          END
          SEPARATOR '||'
        ) AS penyuluh_binaan_raw

      FROM kecamatan k

      LEFT JOIN desa d
        ON d.kecamatan_id = k.id

      LEFT JOIN lahan l
        ON l.kecamatan_id = k.id

      LEFT JOIN users py
        ON py.id = l.penyuluh_id
        AND py.role = 'penyuluh'

      WHERE COALESCE(k.status, 'aktif') <> 'dihapus'

      GROUP BY
        k.id,
        k.nama_kecamatan,
        k.kode_kecamatan,
        k.kabupaten,
        k.status,
        k.deskripsi,
        k.created_at,
        k.updated_at

      ORDER BY
        k.kode_kecamatan ASC,
        k.nama_kecamatan ASC
    `;

    const rows = await runQuery(sql);

    const data = rows.map((row) => ({
      ...row,
      jumlah_desa: Number(row.jumlah_desa || 0),
      jumlah_petani: Number(row.jumlah_petani || 0),
      jumlah_penyuluh: Number(row.jumlah_penyuluh || 0),
      penyuluh_binaan: parsePenyuluhRaw(row.penyuluh_binaan_raw),
    }));

    return res.json({
      status: true,
      message: "Data kecamatan berhasil diambil.",
      data,
    });
  } catch (err) {
    console.log("ERROR GET KECAMATAN:", err);

    return res.status(500).json({
      status: false,
      message: "Gagal mengambil data kecamatan.",
      error: err.message,
    });
  }
};

// ======================================================
// CREATE
// ======================================================
const createKecamatan = async (req, res) => {
  try {
    const {
      nama_kecamatan,
      kode_kecamatan,
      kabupaten,
      status,
      deskripsi,
    } = req.body;

    if (!cleanText(nama_kecamatan)) {
      return res.status(400).json({
        status: false,
        message: "Nama kecamatan wajib diisi.",
      });
    }

    const sql = `
      INSERT INTO kecamatan
      (
        nama_kecamatan,
        kode_kecamatan,
        kabupaten,
        status,
        deskripsi,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, NOW())
    `;

    const values = [
      cleanText(nama_kecamatan),
      cleanText(kode_kecamatan) || null,
      cleanText(kabupaten) || "Sukoharjo",
      normalizeStatus(status),
      cleanText(deskripsi) || null,
    ];

    await runQuery(sql, values);

    return res.status(201).json({
      status: true,
      message: "Kecamatan berhasil ditambahkan.",
    });
  } catch (err) {
    console.log("ERROR CREATE KECAMATAN:", err);

    return res.status(500).json({
      status: false,
      message: "Gagal menambah kecamatan.",
      error: err.message,
    });
  }
};

// ======================================================
// UPDATE
// ======================================================
const updateKecamatan = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      nama_kecamatan,
      kode_kecamatan,
      kabupaten,
      status,
      deskripsi,
    } = req.body;

    if (!cleanText(nama_kecamatan)) {
      return res.status(400).json({
        status: false,
        message: "Nama kecamatan wajib diisi.",
      });
    }

    const sql = `
      UPDATE kecamatan
      SET
        nama_kecamatan = ?,
        kode_kecamatan = ?,
        kabupaten = ?,
        status = ?,
        deskripsi = ?,
        updated_at = NOW()
      WHERE id = ?
    `;

    const values = [
      cleanText(nama_kecamatan),
      cleanText(kode_kecamatan) || null,
      cleanText(kabupaten) || "Sukoharjo",
      normalizeStatus(status),
      cleanText(deskripsi) || null,
      id,
    ];

    const result = await runQuery(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: false,
        message: "Data kecamatan tidak ditemukan.",
      });
    }

    return res.json({
      status: true,
      message: "Kecamatan berhasil diperbarui.",
    });
  } catch (err) {
    console.log("ERROR UPDATE KECAMATAN:", err);

    return res.status(500).json({
      status: false,
      message: "Gagal memperbarui kecamatan.",
      error: err.message,
    });
  }
};

// ======================================================
// DELETE SOFT DELETE
// ======================================================
const deleteKecamatan = async (req, res) => {
  try {
    const { id } = req.params;

    const sql = `
      UPDATE kecamatan
      SET
        status = 'dihapus',
        updated_at = NOW()
      WHERE id = ?
    `;

    const result = await runQuery(sql, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: false,
        message: "Data kecamatan tidak ditemukan.",
      });
    }

    return res.json({
      status: true,
      message: "Kecamatan berhasil dihapus dari daftar.",
    });
  } catch (err) {
    console.log("ERROR DELETE KECAMATAN:", err);

    return res.status(500).json({
      status: false,
      message: "Gagal menghapus kecamatan.",
      error: err.message,
    });
  }
};

// ======================================================
// IMPORT
// ======================================================
const importKecamatan = async (req, res) => {
  try {
    await runUploadImport(req, res);

    if (!req.file) {
      return res.status(400).json({
        status: false,
        message: "File import wajib diupload.",
      });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames.includes("Import Kecamatan")
      ? "Import Kecamatan"
      : workbook.SheetNames[0];

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      defval: "",
    });

    fs.unlink(req.file.path, () => {});

    if (!rows.length) {
      return res.status(400).json({
        status: false,
        message: "File import kosong.",
      });
    }

    let success = 0;
    let failed = 0;

    for (const row of rows) {
      const namaKecamatan = cleanText(
        row.nama_kecamatan ||
          row["Nama Kecamatan"] ||
          row.kecamatan ||
          row.Kecamatan
      );

      const kodeKecamatan = cleanText(
        row.kode_kecamatan ||
          row["Kode Kecamatan"] ||
          row.kode ||
          row.Kode
      );

      const kabupaten = cleanText(
        row.kabupaten ||
          row.Kabupaten ||
          "Sukoharjo"
      );

      const status = normalizeStatus(
        row.status ||
          row.Status ||
          "aktif"
      );

      const deskripsi = cleanText(
        row.deskripsi ||
          row.Deskripsi ||
          row.keterangan ||
          row.Keterangan
      );

      if (!namaKecamatan) {
        failed += 1;
        continue;
      }

      try {
        const existing = await runQuery(
          `
            SELECT id
            FROM kecamatan
            WHERE LOWER(nama_kecamatan) = LOWER(?)
            LIMIT 1
          `,
          [namaKecamatan]
        );

        if (existing.length > 0) {
          await runQuery(
            `
              UPDATE kecamatan
              SET
                kode_kecamatan = ?,
                kabupaten = ?,
                status = ?,
                deskripsi = ?,
                updated_at = NOW()
              WHERE id = ?
            `,
            [
              kodeKecamatan || null,
              kabupaten || "Sukoharjo",
              status,
              deskripsi || null,
              existing[0].id,
            ]
          );
        } else {
          await runQuery(
            `
              INSERT INTO kecamatan
              (
                nama_kecamatan,
                kode_kecamatan,
                kabupaten,
                status,
                deskripsi,
                created_at
              )
              VALUES (?, ?, ?, ?, ?, NOW())
            `,
            [
              namaKecamatan,
              kodeKecamatan || null,
              kabupaten || "Sukoharjo",
              status,
              deskripsi || null,
            ]
          );
        }

        success += 1;
      } catch (err) {
        console.log("ERROR IMPORT ROW KECAMATAN:", err.message);
        failed += 1;
      }
    }

    return res.json({
      status: true,
      message: "Import kecamatan selesai.",
      total_berhasil: success,
      total_gagal: failed,
    });
  } catch (err) {
    console.log("ERROR IMPORT KECAMATAN:", err);

    return res.status(500).json({
      status: false,
      message: "Import kecamatan gagal.",
      error: err.message,
    });
  }
};

module.exports = {
  getKecamatan,
  createKecamatan,
  updateKecamatan,
  deleteKecamatan,
  importKecamatan,
};