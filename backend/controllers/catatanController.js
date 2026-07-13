const db = require("../config/db");

const SQL_NOW = "__SQL_NOW__";

const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// =====================================================
// HELPER DATABASE
// =====================================================
const tableColumnsCache = {};

const isSafeTableName = (tableName) => /^[a-zA-Z0-9_]+$/.test(tableName);

const getTableColumns = async (tableName) => {
  if (!isSafeTableName(tableName)) {
    return new Set();
  }

  if (tableColumnsCache[tableName]) {
    return tableColumnsCache[tableName];
  }

  try {
    const rows = await query(`SHOW COLUMNS FROM \`${tableName}\``);
    const columns = new Set(rows.map((row) => row.Field));
    tableColumnsCache[tableName] = columns;
    return columns;
  } catch (err) {
    console.log(`ERROR CEK KOLOM ${tableName}:`, err.message);
    return new Set();
  }
};

const tableExists = async (tableName) => {
  if (!isSafeTableName(tableName)) return false;

  try {
    const rows = await query("SHOW TABLES LIKE ?", [tableName]);
    return rows.length > 0;
  } catch (err) {
    console.log(`ERROR CEK TABEL ${tableName}:`, err.message);
    return false;
  }
};

const insertDynamic = async (tableName, data) => {
  const exists = await tableExists(tableName);

  if (!exists) {
    throw new Error(`Tabel ${tableName} tidak ditemukan`);
  }

  const columns = await getTableColumns(tableName);

  const entries = Object.entries(data).filter(([key, value]) => {
    return columns.has(key) && value !== undefined;
  });

  if (entries.length === 0) {
    throw new Error(`Tidak ada kolom cocok untuk insert ke tabel ${tableName}`);
  }

  const fields = entries.map(([key]) => `\`${key}\``).join(", ");

  const placeholders = entries
    .map(([, value]) => {
      if (value === SQL_NOW) return "NOW()";
      return "?";
    })
    .join(", ");

  const values = entries
    .filter(([, value]) => value !== SQL_NOW)
    .map(([, value]) => value);

  const sql = `
    INSERT INTO \`${tableName}\`
      (${fields})
    VALUES
      (${placeholders})
  `;

  return query(sql, values);
};

const updateDynamic = async (tableName, data, whereSql, whereParams = []) => {
  const exists = await tableExists(tableName);

  if (!exists) {
    throw new Error(`Tabel ${tableName} tidak ditemukan`);
  }

  const columns = await getTableColumns(tableName);

  const entries = Object.entries(data).filter(([key, value]) => {
    return columns.has(key) && value !== undefined;
  });

  if (entries.length === 0) {
    throw new Error(`Tidak ada kolom cocok untuk update tabel ${tableName}`);
  }

  const setSql = entries
    .map(([key, value]) => {
      if (value === SQL_NOW) return `\`${key}\` = NOW()`;
      return `\`${key}\` = ?`;
    })
    .join(", ");

  const values = entries
    .filter(([, value]) => value !== SQL_NOW)
    .map(([, value]) => value);

  const sql = `
    UPDATE \`${tableName}\`
    SET ${setSql}
    WHERE ${whereSql}
  `;

  return query(sql, [...values, ...whereParams]);
};

const isTruthy = (value) => {
  return value === true || value === 1 || value === "1" || value === "true";
};

const safeNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;

  const numberValue = Number(value);

  if (Number.isNaN(numberValue)) return null;

  return numberValue;
};

// =====================================================
// HELPER NOTIFIKASI
// =====================================================
const getTipeNotifikasiByKategori = (kategori = "") => {
  const raw = String(kategori || "").toLowerCase();

  if (raw.includes("pupuk") || raw.includes("pemupukan")) {
    return "rekomendasi";
  }

  if (
    raw.includes("hama") ||
    raw.includes("penyakit") ||
    raw.includes("blast") ||
    raw.includes("wereng") ||
    raw.includes("tikus")
  ) {
    return "peringatan";
  }

  if (raw.includes("pengingat") || raw.includes("jadwal")) {
    return "pengingat";
  }

  return "informasi";
};

const getLabelKategori = (kategori = "") => {
  const raw = String(kategori || "").trim();

  if (!raw) return "Catatan";

  return raw;
};

const getLahanDetail = async (lahanId) => {
  const rows = await query(
    `
    SELECT
      l.id,
      l.nama_lahan,
      l.luas_ha,
      l.varietas,
      l.user_id,
      l.petani_id,
      COALESCE(l.user_id, l.petani_id) AS pemilik_lahan_id,

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
    `,
    [lahanId]
  );

  return rows[0] || null;
};

const createNotificationFromCatatan = async ({
  catatanId,
  judul,
  isi,
  kategori,
  lahan_id,
  status,
  tindak_lanjut,
  penyuluh_id,
  dikirim_oleh,
}) => {
  try {
    const exists = await tableExists("notifikasi");

    if (!exists) {
      return {
        created: false,
        reason: "Tabel notifikasi tidak ditemukan",
      };
    }

    const lahan = await getLahanDetail(lahan_id);

    if (!lahan) {
      return {
        created: false,
        reason: "Lahan tidak ditemukan, notifikasi tidak dibuat",
      };
    }

    const petaniId =
      lahan.pemilik_lahan_id || lahan.user_id || lahan.petani_id || null;

    if (!petaniId) {
      return {
        created: false,
        reason: "Petani pemilik lahan tidak ditemukan",
      };
    }

    const tipe = getTipeNotifikasiByKategori(kategori);
    const labelKategori = getLabelKategori(kategori);
    const namaLahan = lahan.nama_lahan || "lahan";
    const namaDesa = lahan.nama_desa || "-";
    const namaKecamatan = lahan.nama_kecamatan || "-";

    const judulNotifikasi = `Catatan Lapangan Baru - ${labelKategori}`;

    const pesanNotifikasi = [
      `Penyuluh menambahkan catatan lapangan untuk ${namaLahan}.`,
      `Topik: ${labelKategori}.`,
      judul ? `Judul: ${judul}.` : "",
      isi ? `Catatan: ${isi}.` : "",
      tindak_lanjut ? `Tindak lanjut: ${tindak_lanjut}.` : "",
      `Lokasi: ${namaDesa}, Kec. ${namaKecamatan}.`,
    ]
      .filter(Boolean)
      .join(" ");

    const notifData = {
      user_id: petaniId,
      role: "petani",

      tipe,
      jenis: tipe,

      judul: judulNotifikasi,
      pesan: pesanNotifikasi,
      message: pesanNotifikasi,

      status: "terkirim",
      status_kirim: "terkirim",
      is_read: 0,

      dikirim_oleh: dikirim_oleh || "Penyuluh",
      penyuluh_id: safeNumberOrNull(penyuluh_id),
      lahan_id: safeNumberOrNull(lahan_id),

      catatan_id: catatanId,
      source_id: catatanId,
      source_type: "catatan_lapangan",

      jadwal_kirim: null,

      created_at: SQL_NOW,
      updated_at: SQL_NOW,
    };

    const result = await insertDynamic("notifikasi", notifData);

    return {
      created: true,
      id: result.insertId,
      user_id: petaniId,
      tipe,
      judul: judulNotifikasi,
    };
  } catch (err) {
    console.log("ERROR CREATE NOTIFIKASI DARI CATATAN:", err.message);

    return {
      created: false,
      reason: err.message,
    };
  }
};

// =====================================================
// SELECT CATATAN JOIN
// =====================================================
const SELECT_CATATAN_JOIN = `
  SELECT
    c.id,
    c.judul,
    c.isi,
    c.kategori,
    COALESCE(c.status, 'Menunggu') AS status,
    c.tindak_lanjut,
    c.tanggal_tindak_lanjut,
    c.foto_url,
    c.lahan_id,
    c.created_at,
    c.updated_at,

    l.nama_lahan,
    l.luas_ha,
    l.varietas,
    COALESCE(l.lat, d.lat) AS lat,
    COALESCE(l.lng, d.lng) AS lng,

    COALESCE(l.user_id, l.petani_id) AS petani_id,
    COALESCE(u.nama, 'Petani') AS nama_petani,
    COALESCE(u.email, '-') AS email_petani,

    COALESCE(d.nama_desa, '-') AS nama_desa,
    COALESCE(k.nama_kecamatan, '-') AS nama_kecamatan

  FROM catatan_penyuluh c
  LEFT JOIN lahan l
    ON l.id = c.lahan_id
  LEFT JOIN users u
    ON u.id = COALESCE(l.user_id, l.petani_id)
  LEFT JOIN desa d
    ON d.id = l.desa_id
  LEFT JOIN kecamatan k
    ON k.id = l.kecamatan_id
`;

// =====================================================
// GET ALL
// =====================================================
exports.getAll = async (req, res) => {
  try {
    const penyuluhId =
      req.query.penyuluh_id ||
      req.query.user_id ||
      req.body?.penyuluh_id ||
      null;

    const catatanColumns = await getTableColumns("catatan_penyuluh");

    let whereSql = "";
    const params = [];

    if (penyuluhId && catatanColumns.has("penyuluh_id")) {
      whereSql = "WHERE c.penyuluh_id = ?";
      params.push(penyuluhId);
    }

    const rows = await query(
      `
      ${SELECT_CATATAN_JOIN}
      ${whereSql}
      ORDER BY c.created_at DESC, c.id DESC
      `,
      params
    );

    res.json({
      status: true,
      message: "Catatan lapangan berhasil diambil",
      data: rows,
    });
  } catch (err) {
    console.log("ERROR GET CATATAN:", err);

    res.status(500).json({
      status: false,
      message: "Gagal mengambil catatan lapangan",
      error: err.message,
    });
  }
};

// =====================================================
// GET DETAIL
// =====================================================
exports.getDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const rows = await query(
      `
      ${SELECT_CATATAN_JOIN}
      WHERE c.id = ?
      LIMIT 1
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        status: false,
        message: "Catatan tidak ditemukan",
      });
    }

    res.json({
      status: true,
      message: "Detail catatan berhasil diambil",
      data: rows[0],
    });
  } catch (err) {
    console.log("ERROR DETAIL CATATAN:", err);

    res.status(500).json({
      status: false,
      message: "Gagal mengambil detail catatan",
      error: err.message,
    });
  }
};

// =====================================================
// CREATE
// =====================================================
exports.create = async (req, res) => {
  try {
    const {
      judul,
      isi,
      kategori = "Umum",
      petani_id = null,
      lahan_id,
      status = "Menunggu",
      tindak_lanjut = null,
      tanggal_tindak_lanjut = null,
      foto_url = null,
      penyuluh_id = null,
      kirim_notifikasi = false,
      dikirim_oleh = "Penyuluh",
    } = req.body || {};

    if (!judul || !String(judul).trim()) {
      return res.status(400).json({
        status: false,
        message: "Judul catatan wajib diisi",
      });
    }

    if (!isi || !String(isi).trim()) {
      return res.status(400).json({
        status: false,
        message: "Isi catatan wajib diisi",
      });
    }

    if (!lahan_id) {
      return res.status(400).json({
        status: false,
        message:
          "Lahan wajib dipilih agar petani, lokasi, kunjungan, dan marker peta bisa dinamis.",
      });
    }

    const catatanData = {
      judul: String(judul).trim(),
      isi: String(isi).trim(),
      kategori: kategori || "Umum",
      petani_id: safeNumberOrNull(petani_id),
      lahan_id: safeNumberOrNull(lahan_id),
      status: status || "Menunggu",
      tindak_lanjut: tindak_lanjut || null,
      tanggal_tindak_lanjut: tanggal_tindak_lanjut || null,
      foto_url: foto_url || null,
      penyuluh_id: safeNumberOrNull(penyuluh_id),
      created_at: SQL_NOW,
      updated_at: SQL_NOW,
    };

    const result = await insertDynamic("catatan_penyuluh", catatanData);

    let notifikasiResult = {
      created: false,
      reason: "Opsi kirim notifikasi tidak dicentang",
    };

    if (isTruthy(kirim_notifikasi)) {
      notifikasiResult = await createNotificationFromCatatan({
        catatanId: result.insertId,
        judul,
        isi,
        kategori,
        lahan_id,
        status,
        tindak_lanjut,
        penyuluh_id,
        dikirim_oleh,
      });
    }

    res.status(201).json({
      status: true,
      message: notifikasiResult.created
        ? "Catatan berhasil ditambahkan dan notifikasi dikirim ke petani"
        : "Catatan berhasil ditambahkan",
      data: {
        id: result.insertId,
        notifikasi: notifikasiResult,
      },
    });
  } catch (err) {
    console.log("ERROR CREATE CATATAN:", err);

    res.status(500).json({
      status: false,
      message: "Gagal menambah catatan",
      error: err.message,
    });
  }
};

// =====================================================
// UPDATE
// =====================================================
exports.update = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      judul,
      isi,
      kategori,
      petani_id = null,
      lahan_id,
      status,
      tindak_lanjut,
      tanggal_tindak_lanjut,
      foto_url,
      penyuluh_id = null,
      kirim_notifikasi = false,
      dikirim_oleh = "Penyuluh",
    } = req.body || {};

    if (!judul || !String(judul).trim()) {
      return res.status(400).json({
        status: false,
        message: "Judul catatan wajib diisi",
      });
    }

    if (!isi || !String(isi).trim()) {
      return res.status(400).json({
        status: false,
        message: "Isi catatan wajib diisi",
      });
    }

    if (!lahan_id) {
      return res.status(400).json({
        status: false,
        message: "Lahan wajib dipilih agar data petani dan lokasi bisa muncul.",
      });
    }

    const updateData = {
      judul: String(judul).trim(),
      isi: String(isi).trim(),
      kategori: kategori || "Umum",
      petani_id: safeNumberOrNull(petani_id),
      lahan_id: safeNumberOrNull(lahan_id),
      status: status || "Menunggu",
      tindak_lanjut: tindak_lanjut || null,
      tanggal_tindak_lanjut: tanggal_tindak_lanjut || null,
      foto_url: foto_url || null,
      penyuluh_id: safeNumberOrNull(penyuluh_id),
      updated_at: SQL_NOW,
    };

    await updateDynamic("catatan_penyuluh", updateData, "id = ?", [id]);

    let notifikasiResult = {
      created: false,
      reason: "Opsi kirim notifikasi tidak dicentang",
    };

    if (isTruthy(kirim_notifikasi)) {
      notifikasiResult = await createNotificationFromCatatan({
        catatanId: id,
        judul,
        isi,
        kategori,
        lahan_id,
        status,
        tindak_lanjut,
        penyuluh_id,
        dikirim_oleh,
      });
    }

    res.json({
      status: true,
      message: notifikasiResult.created
        ? "Catatan berhasil diperbarui dan notifikasi dikirim ke petani"
        : "Catatan berhasil diperbarui",
      data: {
        id,
        notifikasi: notifikasiResult,
      },
    });
  } catch (err) {
    console.log("ERROR UPDATE CATATAN:", err);

    res.status(500).json({
      status: false,
      message: "Gagal update catatan",
      error: err.message,
    });
  }
};

// =====================================================
// DELETE
// =====================================================
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    await query("DELETE FROM catatan_penyuluh WHERE id = ?", [id]);

    res.json({
      status: true,
      message: "Catatan berhasil dihapus",
    });
  } catch (err) {
    console.log("ERROR DELETE CATATAN:", err);

    res.status(500).json({
      status: false,
      message: "Gagal menghapus catatan",
      error: err.message,
    });
  }
};

// =====================================================
// CUACA DINAMIS
// =====================================================
exports.getLatestWeather = async (req, res) => {
  try {
    const rows = await query(`
      SELECT
        COALESCE(suhu, 28) AS suhu,
        COALESCE(kelembapan, 78) AS kelembapan,
        COALESCE(curah_hujan, 2) AS curah_hujan,
        updated_at
      FROM monitoring_tanaman
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `);

    const item =
      rows[0] || {
        suhu: 28,
        kelembapan: 78,
        curah_hujan: 2,
        updated_at: null,
      };

    let kondisi = "Cerah";

    if (Number(item.curah_hujan) >= 20) {
      kondisi = "Hujan";
    } else if (Number(item.curah_hujan) >= 5) {
      kondisi = "Berawan";
    }

    res.json({
      status: true,
      data: {
        suhu: Number(item.suhu || 28),
        kelembapan: Number(item.kelembapan || 78),
        curah_hujan: Number(item.curah_hujan || 2),
        kondisi,
        updated_at: item.updated_at,
      },
    });
  } catch (err) {
    console.log("ERROR CUACA CATATAN:", err);

    res.json({
      status: true,
      data: {
        suhu: 28,
        kelembapan: 78,
        curah_hujan: 2,
        kondisi: "Cerah",
        updated_at: null,
      },
    });
  }
};

// =====================================================
// UPLOAD DOKUMENTASI
// =====================================================
exports.uploadDokumentasi = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: false,
        message: "File dokumentasi wajib dikirim",
      });
    }

    const fileUrl = `/uploads/catatan/${req.file.filename}`;

    res.json({
      status: true,
      message: "File dokumentasi berhasil diupload",
      data: {
        filename: req.file.filename,
        file_url: fileUrl,
      },
    });
  } catch (err) {
    console.log("ERROR UPLOAD CATATAN:", err);

    res.status(500).json({
      status: false,
      message: "Gagal upload dokumentasi",
      error: err.message,
    });
  }
};