const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../config/db");

// ======================================================
// UPLOAD FOTO LAHAN
// ======================================================
const UPLOAD_DIR_DB = "uploads/lahan";
const UPLOAD_DIR_ABSOLUTE = path.join(process.cwd(), UPLOAD_DIR_DB);

if (!fs.existsSync(UPLOAD_DIR_ABSOLUTE)) {
  fs.mkdirSync(UPLOAD_DIR_ABSOLUTE, { recursive: true });
}

const allowedImageTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR_ABSOLUTE);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    const baseName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .toLowerCase();

    const fileName = `lahan-${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}-${baseName}${ext}`;

    cb(null, fileName);
  },
});

const fileFilter = (req, file, cb) => {
  if (allowedImageTypes.includes(file.mimetype)) {
    cb(null, true);
    return;
  }

  cb(new Error("Format foto harus JPG, JPEG, PNG, atau WEBP."), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024,
  },
});

const uploadFotoLahan = (req, res, next) => {
  upload.single("foto")(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          status: false,
          message: "Ukuran foto maksimal 3 MB.",
        });
      }

      return res.status(400).json({
        status: false,
        message: err.message || "Upload foto gagal.",
      });
    }

    return res.status(400).json({
      status: false,
      message: err.message || "Upload foto gagal.",
    });
  });
};

// ======================================================
// HELPER
// ======================================================
const safeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const isFilled = (value) => {
  return value !== null && value !== undefined && value !== "";
};

const isExternalImage = (value) => {
  const text = String(value || "").trim();

  return (
    text.startsWith("http://") ||
    text.startsWith("https://") ||
    text.startsWith("data:image") ||
    text.startsWith("blob:")
  );
};

const normalizeUploadPathForDb = (file) => {
  if (!file) return null;
  return `${UPLOAD_DIR_DB}/${file.filename}`;
};

const resolveUploadLocalPath = (value) => {
  if (!value || isExternalImage(value)) return null;

  const cleanValue = String(value).trim().replaceAll("\\", "/");

  if (!cleanValue || cleanValue === "null" || cleanValue === "undefined") {
    return null;
  }

  if (cleanValue.startsWith("/uploads/")) {
    return path.join(process.cwd(), cleanValue.replace(/^\//, ""));
  }

  if (cleanValue.startsWith("uploads/")) {
    return path.join(process.cwd(), cleanValue);
  }

  return path.join(UPLOAD_DIR_ABSOLUTE, path.basename(cleanValue));
};

const deleteUploadedFile = (value) => {
  const localPath = resolveUploadLocalPath(value);

  if (!localPath) return;

  fs.unlink(localPath, (err) => {
    if (err && err.code !== "ENOENT") {
      console.log("GAGAL HAPUS FILE FOTO:", err.message);
    }
  });
};

const getSavedPhotoValue = (row) => {
  return (
    row?.foto ||
    row?.foto_url ||
    row?.foto_lahan ||
    row?.gambar ||
    row?.image ||
    row?.dokumentasi ||
    null
  );
};

const normalizeLahanRow = (row) => {
  const fotoValue = getSavedPhotoValue(row);

  return {
    id: row.id,
    nama_lahan: row.nama_lahan,
    varietas: row.varietas,
    tanaman: row.tanaman || row.jenis_tanaman || "Padi",

    lat: row.lat,
    lng: row.lng,

    foto: fotoValue,
    foto_url: fotoValue,
    foto_lahan: fotoValue,

    kecamatan_id: row.kecamatan_id,
    desa_id: row.desa_id,
    user_id: row.user_id,
    petani_id: row.petani_id,

    luas_m2: row.luas_m2,
    luas_ha: row.luas_ha,

    tanggal_tanam: row.tanggal_tanam || null,
    umur_tanam: row.umur_tanam || row.umur_tanaman || null,
    fase_tanam: row.fase_tanam || null,
    status_lahan: row.status_lahan || row.status || "active",

    nama_petani: row.nama_petani,
    email_petani: row.email_petani,
    nama_desa: row.nama_desa || row.desa || row.kelurahan || null,
    nama_kecamatan:
      row.nama_kecamatan || row.kecamatan || row.nama_kec || null,

    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
};

const insertAktivitas = (userId, pesan, role = "penyuluh") => {
  if (!userId || !pesan) return;

  const sql = `
    INSERT INTO notifikasi (user_id, pesan, is_read, created_at, role)
    VALUES (?, ?, 0, NOW(), ?)
  `;

  db.query(sql, [userId, pesan, role], (err) => {
    if (err) {
      console.log("GAGAL INSERT AKTIVITAS:", err.message);
    }
  });
};

let lahanColumnsCache = null;

const getLahanColumns = (callback) => {
  if (lahanColumnsCache) {
    callback(null, lahanColumnsCache);
    return;
  }

  db.query("SHOW COLUMNS FROM lahan", (err, rows) => {
    if (err) {
      callback(err);
      return;
    }

    lahanColumnsCache = new Set(rows.map((row) => row.Field));
    callback(null, lahanColumnsCache);
  });
};

const addFieldIfExists = (fields, columns, fieldName, value) => {
  if (columns.has(fieldName)) {
    fields[fieldName] = value;
  }
};

const addPhotoFieldsIfExists = (fields, columns, fotoPath) => {
  if (!fotoPath) return;

  addFieldIfExists(fields, columns, "foto", fotoPath);
  addFieldIfExists(fields, columns, "foto_url", fotoPath);
  addFieldIfExists(fields, columns, "foto_lahan", fotoPath);
  addFieldIfExists(fields, columns, "gambar", fotoPath);
  addFieldIfExists(fields, columns, "image", fotoPath);
  addFieldIfExists(fields, columns, "dokumentasi", fotoPath);
};

const buildInsertQuery = (fields) => {
  const fieldNames = Object.keys(fields);
  const placeholders = fieldNames.map(() => "?").join(", ");
  const columns = fieldNames.map((name) => `\`${name}\``).join(", ");
  const values = fieldNames.map((name) => fields[name]);

  return {
    sql: `INSERT INTO lahan (${columns}) VALUES (${placeholders})`,
    values,
  };
};

const buildUpdateQuery = (fields, id) => {
  const fieldNames = Object.keys(fields);
  const setClause = fieldNames.map((name) => `\`${name}\` = ?`).join(", ");
  const values = fieldNames.map((name) => fields[name]);

  values.push(id);

  return {
    sql: `UPDATE lahan SET ${setClause} WHERE id = ?`,
    values,
  };
};

// ======================================================
// GET SEMUA LAHAN
// GET /api/lahan
// GET /api/lahan?user_id=7
// GET /api/lahan?petani_id=7
// ======================================================
router.get("/", (req, res) => {
  const userId = req.query.user_id || req.query.petani_id || null;

  let sql = `
    SELECT
      l.*,
      u.nama AS nama_petani,
      u.email AS email_petani,
      d.nama_desa,
      k.nama_kecamatan
    FROM lahan l
    LEFT JOIN users u
      ON u.id = COALESCE(l.user_id, l.petani_id)
    LEFT JOIN desa d
      ON d.id = l.desa_id
    LEFT JOIN kecamatan k
      ON k.id = l.kecamatan_id
  `;

  const params = [];

  if (userId) {
    sql += `
      WHERE COALESCE(l.user_id, l.petani_id) = ?
    `;
    params.push(userId);
  }

  sql += `
    ORDER BY l.id DESC
  `;

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.log("ERROR GET LAHAN:", err);

      return res.status(500).json({
        status: false,
        message: "Gagal mengambil data lahan",
        error: err.message,
      });
    }

    return res.json({
      status: true,
      message: "Data lahan berhasil diambil",
      total: rows.length,
      data: rows.map(normalizeLahanRow),
    });
  });
});

// ======================================================
// GET DETAIL LAHAN
// GET /api/lahan/:id
// ======================================================
router.get("/:id", (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT
      l.*,
      u.nama AS nama_petani,
      u.email AS email_petani,
      d.nama_desa,
      k.nama_kecamatan
    FROM lahan l
    LEFT JOIN users u
      ON u.id = COALESCE(l.user_id, l.petani_id)
    LEFT JOIN desa d
      ON d.id = l.desa_id
    LEFT JOIN kecamatan k
      ON k.id = l.kecamatan_id
    WHERE l.id = ?
    LIMIT 1
  `;

  db.query(sql, [id], (err, rows) => {
    if (err) {
      console.log("ERROR DETAIL LAHAN:", err);

      return res.status(500).json({
        status: false,
        message: "Gagal mengambil detail lahan",
        error: err.message,
      });
    }

    if (!rows.length) {
      return res.status(404).json({
        status: false,
        message: "Data lahan tidak ditemukan",
      });
    }

    return res.json({
      status: true,
      message: "Detail lahan berhasil diambil",
      data: normalizeLahanRow(rows[0]),
    });
  });
});

// ======================================================
// CREATE LAHAN
// POST /api/lahan
// Form-data: foto
// ======================================================
router.post("/", uploadFotoLahan, (req, res) => {
  const body = req.body || {};

  const {
    nama_lahan,
    varietas,
    kecamatan_id,
    desa_id,
    user_id,
    petani_id,
    luas_m2,
    luas,
    luas_ha,
    tanggal_tanam,
    lat,
    lng,
    latitude,
    longitude,
    fase_tanam,
    status_lahan,
  } = body;

  const finalPetaniId = user_id || petani_id;
  const finalLuasM2 = safeNumber(luas_m2 || luas, 0);
  const finalLuasHa =
    luas_ha !== undefined && luas_ha !== null && luas_ha !== ""
      ? safeNumber(luas_ha, 0)
      : finalLuasM2 / 10000;

  const finalLat = isFilled(lat) ? lat : latitude || null;
  const finalLng = isFilled(lng) ? lng : longitude || null;
  const fotoPath = normalizeUploadPathForDb(req.file);

  if (!nama_lahan || !finalPetaniId || !kecamatan_id || !desa_id) {
    deleteUploadedFile(fotoPath);

    return res.status(400).json({
      status: false,
      message: "Nama lahan, petani, kecamatan, dan desa wajib diisi.",
      body_diterima: body,
    });
  }

  if (finalLuasM2 <= 0) {
    deleteUploadedFile(fotoPath);

    return res.status(400).json({
      status: false,
      message: "Luas lahan harus lebih dari 0.",
    });
  }

  getLahanColumns((columnErr, columns) => {
    if (columnErr) {
      deleteUploadedFile(fotoPath);

      return res.status(500).json({
        status: false,
        message: "Gagal membaca struktur tabel lahan.",
        error: columnErr.message,
      });
    }

    const fields = {};

    addFieldIfExists(fields, columns, "nama_lahan", nama_lahan.trim());
    addFieldIfExists(fields, columns, "varietas", varietas || "Ciherang");
    addFieldIfExists(fields, columns, "tanaman", "Padi");
    addFieldIfExists(fields, columns, "jenis_tanaman", "Padi");

    addFieldIfExists(fields, columns, "kecamatan_id", kecamatan_id);
    addFieldIfExists(fields, columns, "desa_id", desa_id);

    addFieldIfExists(fields, columns, "user_id", finalPetaniId);
    addFieldIfExists(fields, columns, "petani_id", finalPetaniId);

    addFieldIfExists(fields, columns, "luas_m2", finalLuasM2);
    addFieldIfExists(fields, columns, "luas_ha", finalLuasHa);
    addFieldIfExists(fields, columns, "luas", finalLuasM2);

    addFieldIfExists(fields, columns, "lat", finalLat);
    addFieldIfExists(fields, columns, "lng", finalLng);
    addFieldIfExists(fields, columns, "latitude", finalLat);
    addFieldIfExists(fields, columns, "longitude", finalLng);

    addFieldIfExists(fields, columns, "tanggal_tanam", tanggal_tanam || null);
    addFieldIfExists(fields, columns, "fase_tanam", fase_tanam || "Vegetatif");
    addFieldIfExists(fields, columns, "status_lahan", status_lahan || "active");

    addPhotoFieldsIfExists(fields, columns, fotoPath);

    const { sql, values } = buildInsertQuery(fields);

    db.query(sql, values, (err, result) => {
      if (err) {
        deleteUploadedFile(fotoPath);

        console.log("ERROR CREATE LAHAN:", err);

        return res.status(500).json({
          status: false,
          message: "Gagal menambah data lahan",
          error: err.message,
        });
      }

      insertAktivitas(
        finalPetaniId,
        `Tambah lahan ${nama_lahan}`,
        "penyuluh"
      );

      return res.status(201).json({
        status: true,
        message: "Data lahan berhasil ditambahkan",
        data: {
          id: result.insertId,
          nama_lahan: nama_lahan.trim(),
          varietas: varietas || "Ciherang",
          tanaman: "Padi",
          kecamatan_id,
          desa_id,
          user_id: finalPetaniId,
          petani_id: finalPetaniId,
          luas_m2: finalLuasM2,
          luas_ha: finalLuasHa,
          tanggal_tanam: tanggal_tanam || null,
          lat: finalLat,
          lng: finalLng,
          foto: fotoPath,
          foto_url: fotoPath,
        },
      });
    });
  });
});

// ======================================================
// UPDATE LAHAN
// PUT /api/lahan/:id
// Form-data: foto optional
// ======================================================
router.put("/:id", uploadFotoLahan, (req, res) => {
  const { id } = req.params;
  const body = req.body || {};

  db.query("SELECT * FROM lahan WHERE id = ? LIMIT 1", [id], (findErr, rows) => {
    if (findErr) {
      deleteUploadedFile(normalizeUploadPathForDb(req.file));

      return res.status(500).json({
        status: false,
        message: "Gagal mengambil data lahan lama.",
        error: findErr.message,
      });
    }

    if (!rows.length) {
      deleteUploadedFile(normalizeUploadPathForDb(req.file));

      return res.status(404).json({
        status: false,
        message: "Data lahan tidak ditemukan.",
      });
    }

    const oldData = rows[0];
    const oldFoto = getSavedPhotoValue(oldData);
    const newFotoPath = normalizeUploadPathForDb(req.file);

    const finalNamaLahan = body.nama_lahan || oldData.nama_lahan;
    const finalPetaniId =
      body.user_id || body.petani_id || oldData.user_id || oldData.petani_id;
    const finalKecamatanId = body.kecamatan_id || oldData.kecamatan_id;
    const finalDesaId = body.desa_id || oldData.desa_id;

    const finalLuasM2 = isFilled(body.luas_m2 || body.luas)
      ? safeNumber(body.luas_m2 || body.luas, 0)
      : safeNumber(oldData.luas_m2 || oldData.luas, 0);

    const finalLuasHa = isFilled(body.luas_ha)
      ? safeNumber(body.luas_ha, 0)
      : isFilled(oldData.luas_ha)
      ? safeNumber(oldData.luas_ha, 0)
      : finalLuasM2 / 10000;

    const finalLat = isFilled(body.lat)
      ? body.lat
      : isFilled(body.latitude)
      ? body.latitude
      : oldData.lat || oldData.latitude || null;

    const finalLng = isFilled(body.lng)
      ? body.lng
      : isFilled(body.longitude)
      ? body.longitude
      : oldData.lng || oldData.longitude || null;

    if (!finalNamaLahan || !finalPetaniId || !finalKecamatanId || !finalDesaId) {
      deleteUploadedFile(newFotoPath);

      return res.status(400).json({
        status: false,
        message: "Nama lahan, petani, kecamatan, dan desa wajib diisi.",
      });
    }

    if (finalLuasM2 <= 0) {
      deleteUploadedFile(newFotoPath);

      return res.status(400).json({
        status: false,
        message: "Luas lahan harus lebih dari 0.",
      });
    }

    getLahanColumns((columnErr, columns) => {
      if (columnErr) {
        deleteUploadedFile(newFotoPath);

        return res.status(500).json({
          status: false,
          message: "Gagal membaca struktur tabel lahan.",
          error: columnErr.message,
        });
      }

      const fields = {};

      addFieldIfExists(fields, columns, "nama_lahan", finalNamaLahan.trim());
      addFieldIfExists(
        fields,
        columns,
        "varietas",
        body.varietas || oldData.varietas || "Ciherang"
      );
      addFieldIfExists(fields, columns, "tanaman", "Padi");
      addFieldIfExists(fields, columns, "jenis_tanaman", "Padi");

      addFieldIfExists(fields, columns, "kecamatan_id", finalKecamatanId);
      addFieldIfExists(fields, columns, "desa_id", finalDesaId);

      addFieldIfExists(fields, columns, "user_id", finalPetaniId);
      addFieldIfExists(fields, columns, "petani_id", finalPetaniId);

      addFieldIfExists(fields, columns, "luas_m2", finalLuasM2);
      addFieldIfExists(fields, columns, "luas_ha", finalLuasHa);
      addFieldIfExists(fields, columns, "luas", finalLuasM2);

      addFieldIfExists(fields, columns, "lat", finalLat);
      addFieldIfExists(fields, columns, "lng", finalLng);
      addFieldIfExists(fields, columns, "latitude", finalLat);
      addFieldIfExists(fields, columns, "longitude", finalLng);

      addFieldIfExists(
        fields,
        columns,
        "tanggal_tanam",
        body.tanggal_tanam || oldData.tanggal_tanam || null
      );
      addFieldIfExists(
        fields,
        columns,
        "fase_tanam",
        body.fase_tanam || oldData.fase_tanam || "Vegetatif"
      );
      addFieldIfExists(
        fields,
        columns,
        "status_lahan",
        body.status_lahan || oldData.status_lahan || "active"
      );

      addPhotoFieldsIfExists(fields, columns, newFotoPath);

      const { sql, values } = buildUpdateQuery(fields, id);

      db.query(sql, values, (err, result) => {
        if (err) {
          deleteUploadedFile(newFotoPath);

          console.log("ERROR UPDATE LAHAN:", err);

          return res.status(500).json({
            status: false,
            message: "Gagal memperbarui data lahan",
            error: err.message,
          });
        }

        if (result.affectedRows === 0) {
          deleteUploadedFile(newFotoPath);

          return res.status(404).json({
            status: false,
            message: "Data lahan tidak ditemukan",
          });
        }

        if (newFotoPath && oldFoto && oldFoto !== newFotoPath) {
          deleteUploadedFile(oldFoto);
        }

        insertAktivitas(
          finalPetaniId,
          `Update lahan ${finalNamaLahan}`,
          "penyuluh"
        );

        return res.json({
          status: true,
          message: "Data lahan berhasil diperbarui",
          data: {
            id: Number(id),
            nama_lahan: finalNamaLahan.trim(),
            varietas: body.varietas || oldData.varietas || "Ciherang",
            tanaman: "Padi",
            kecamatan_id: finalKecamatanId,
            desa_id: finalDesaId,
            user_id: finalPetaniId,
            petani_id: finalPetaniId,
            luas_m2: finalLuasM2,
            luas_ha: finalLuasHa,
            tanggal_tanam: body.tanggal_tanam || oldData.tanggal_tanam || null,
            lat: finalLat,
            lng: finalLng,
            foto: newFotoPath || oldFoto,
            foto_url: newFotoPath || oldFoto,
          },
        });
      });
    });
  });
});

// ======================================================
// DELETE LAHAN
// DELETE /api/lahan/:id
// ======================================================
router.delete("/:id", (req, res) => {
  const { id } = req.params;

  db.query("SELECT * FROM lahan WHERE id = ? LIMIT 1", [id], (findErr, rows) => {
    if (findErr) {
      return res.status(500).json({
        status: false,
        message: "Gagal mengambil data lahan.",
        error: findErr.message,
      });
    }

    if (!rows.length) {
      return res.status(404).json({
        status: false,
        message: "Data lahan tidak ditemukan.",
      });
    }

    const oldFoto = getSavedPhotoValue(rows[0]);

    const deleteKalender = `
      DELETE FROM kalender_budidaya
      WHERE lahan_id = ?
    `;

    const deletePrediksi = `
      DELETE FROM prediksi
      WHERE sawah_id = ?
    `;

    const deleteMonitoring = `
      DELETE FROM monitoring_tanaman
      WHERE sawah_id = ?
    `;

    const deleteLahan = `
      DELETE FROM lahan
      WHERE id = ?
    `;

    db.query(deleteKalender, [id], (errKalender) => {
      if (errKalender) {
        console.log("ERROR DELETE KALENDER:", errKalender);

        return res.status(500).json({
          status: false,
          message: "Gagal menghapus kalender terkait lahan",
          error: errKalender.message,
        });
      }

      db.query(deletePrediksi, [id], (errPrediksi) => {
        if (errPrediksi) {
          console.log("ERROR DELETE PREDIKSI:", errPrediksi);

          return res.status(500).json({
            status: false,
            message: "Gagal menghapus prediksi terkait lahan",
            error: errPrediksi.message,
          });
        }

        db.query(deleteMonitoring, [id], (errMonitoring) => {
          if (errMonitoring) {
            console.log("ERROR DELETE MONITORING:", errMonitoring);

            return res.status(500).json({
              status: false,
              message: "Gagal menghapus monitoring terkait lahan",
              error: errMonitoring.message,
            });
          }

          db.query(deleteLahan, [id], (errLahan, result) => {
            if (errLahan) {
              console.log("ERROR DELETE LAHAN:", errLahan);

              return res.status(500).json({
                status: false,
                message: "Gagal menghapus data lahan",
                error: errLahan.message,
              });
            }

            if (result.affectedRows === 0) {
              return res.status(404).json({
                status: false,
                message: "Data lahan tidak ditemukan",
              });
            }

            deleteUploadedFile(oldFoto);

            return res.json({
              status: true,
              message: "Data lahan berhasil dihapus",
              id: Number(id),
            });
          });
        });
      });
    });
  });
});

module.exports = router;