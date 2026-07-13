const db = require("../config/db");
const multer = require("multer");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

// ======================================================
// UPLOAD IMPORT CONFIG
// ======================================================
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

// ======================================================
// BASIC HELPERS
// ======================================================
const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const cleanText = (value) => String(value || "").trim();

const normalizeNumber = (value) => {
  const number = Number(String(value || "0").replace(",", "."));
  return Number.isFinite(number) ? number : 0;
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
    return "tidak_aktif";
  }

  return "aktif";
};

const q = (name) => `\`${name}\``;

const has = (schema, table, column) => {
  return schema?.[table]?.has(column);
};

const col = (alias, column) => {
  return `${alias}.${q(column)}`;
};

const existingColExprs = (schema, table, alias, columns) => {
  return columns
    .filter((column) => has(schema, table, column))
    .map((column) => col(alias, column));
};

const coalesce = (exprs, fallback) => {
  if (!exprs.length) return fallback;
  return `COALESCE(${[...exprs, fallback].join(", ")})`;
};

const getColumns = async (tableName) => {
  try {
    const rows = await runQuery(`SHOW COLUMNS FROM ${q(tableName)}`);
    return new Set(rows.map((row) => row.Field));
  } catch {
    return new Set();
  }
};

const getSchema = async () => {
  const [lahan, users, kecamatan, desa, kalender] = await Promise.all([
    getColumns("lahan"),
    getColumns("users"),
    getColumns("kecamatan"),
    getColumns("desa"),
    getColumns("kalender_budidaya"),
  ]);

  return {
    lahan,
    users,
    kecamatan,
    desa,
    kalender_budidaya: kalender,
  };
};

const getLuasHaExpr = (schema) => {
  const cases = [];

  if (has(schema, "lahan", "luas_ha")) {
    cases.push(`
      WHEN ${col("l", "luas_ha")} IS NOT NULL AND ${col("l", "luas_ha")} > 0
      THEN ${col("l", "luas_ha")}
    `);
  }

  if (has(schema, "lahan", "luas_m2")) {
    cases.push(`
      WHEN ${col("l", "luas_m2")} IS NOT NULL AND ${col("l", "luas_m2")} > 0
      THEN ${col("l", "luas_m2")} / 10000
    `);
  }

  if (has(schema, "lahan", "luas")) {
    cases.push(`
      WHEN ${col("l", "luas")} IS NOT NULL AND ${col("l", "luas")} > 20
      THEN ${col("l", "luas")} / 10000
    `);

    cases.push(`
      WHEN ${col("l", "luas")} IS NOT NULL
      THEN ${col("l", "luas")}
    `);
  }

  return `
    CASE
      ${cases.join("\n")}
      ELSE 0
    END
  `;
};

const getLuasM2Expr = (schema) => {
  const cases = [];

  if (has(schema, "lahan", "luas_m2")) {
    cases.push(`
      WHEN ${col("l", "luas_m2")} IS NOT NULL AND ${col("l", "luas_m2")} > 0
      THEN ${col("l", "luas_m2")}
    `);
  }

  if (has(schema, "lahan", "luas_ha")) {
    cases.push(`
      WHEN ${col("l", "luas_ha")} IS NOT NULL AND ${col("l", "luas_ha")} > 0
      THEN ${col("l", "luas_ha")} * 10000
    `);
  }

  if (has(schema, "lahan", "luas")) {
    cases.push(`
      WHEN ${col("l", "luas")} IS NOT NULL AND ${col("l", "luas")} > 20
      THEN ${col("l", "luas")}
    `);

    cases.push(`
      WHEN ${col("l", "luas")} IS NOT NULL
      THEN ${col("l", "luas")} * 10000
    `);
  }

  return `
    CASE
      ${cases.join("\n")}
      ELSE 0
    END
  `;
};

const getStatusExpr = (schema) => {
  if (has(schema, "lahan", "status_lahan")) {
    return `COALESCE(${col("l", "status_lahan")}, 'aktif')`;
  }

  if (has(schema, "lahan", "status")) {
    return `COALESCE(${col("l", "status")}, 'aktif')`;
  }

  return `'aktif'`;
};

const getKomoditasExpr = (schema) => {
  const exprs = [];

  if (has(schema, "lahan", "komoditas")) {
    exprs.push(col("l", "komoditas"));
  }

  if (has(schema, "lahan", "tanaman")) {
    exprs.push(col("l", "tanaman"));
  }

  if (has(schema, "lahan", "jenis_tanaman")) {
    exprs.push(col("l", "jenis_tanaman"));
  }

  return coalesce(exprs, "'Padi'");
};

const getWhereConditions = (schema) => {
  const conditions = [];

  if (has(schema, "lahan", "status_lahan")) {
    conditions.push(`COALESCE(${col("l", "status_lahan")}, 'aktif') <> 'dihapus'`);
  } else if (has(schema, "lahan", "status")) {
    conditions.push(`COALESCE(${col("l", "status")}, 'aktif') <> 'dihapus'`);
  }

  return conditions;
};

const buildWhereSql = (conditions) => {
  if (!conditions.length) return "";
  return `WHERE ${conditions.join(" AND ")}`;
};

// ======================================================
// SUBQUERY PUPUK TERDEKAT DARI KALENDER
// ======================================================
const buildPupukSubqueries = (schema) => {
  const kb = schema.kalender_budidaya;

  if (!kb || kb.size === 0 || !has(schema, "kalender_budidaya", "lahan_id")) {
    return {
      pupuk_rekomendasi: "NULL",
      dosis_pupuk_per_ha: "NULL",
      dosis_pupuk_total: "NULL",
      tanggal_pemupukan: "NULL",
    };
  }

  const tanggalOrder = has(schema, "kalender_budidaya", "tanggal")
    ? "kb.tanggal ASC"
    : "kb.id ASC";

  const conditions = ["kb.lahan_id = l.id"];

  if (has(schema, "kalender_budidaya", "tanggal")) {
    conditions.push("kb.tanggal >= CURDATE()");
  }

  if (has(schema, "kalender_budidaya", "status")) {
    conditions.push("COALESCE(kb.status, 'terjadwal') <> 'selesai'");
  }

  const pupukConditions = [];

  if (has(schema, "kalender_budidaya", "jenis")) {
    pupukConditions.push("LOWER(COALESCE(kb.jenis, '')) LIKE '%pupuk%'");
    pupukConditions.push("LOWER(COALESCE(kb.jenis, '')) = 'pemupukan'");
  }

  if (has(schema, "kalender_budidaya", "nama_kegiatan")) {
    pupukConditions.push("LOWER(COALESCE(kb.nama_kegiatan, '')) LIKE '%pupuk%'");
    pupukConditions.push("LOWER(COALESCE(kb.nama_kegiatan, '')) LIKE '%pemupukan%'");
  }

  if (has(schema, "kalender_budidaya", "pupuk")) {
    pupukConditions.push("(kb.pupuk IS NOT NULL AND kb.pupuk <> '')");
  }

  if (pupukConditions.length) {
    conditions.push(`(${pupukConditions.join(" OR ")})`);
  }

  const where = conditions.join(" AND ");

  const pupukExpr = coalesce(
    existingColExprs(schema, "kalender_budidaya", "kb", [
      "pupuk",
      "nama_kegiatan",
      "jenis",
    ]),
    "'Belum ada rekomendasi'"
  );

  const dosisHaExpr = coalesce(
    existingColExprs(schema, "kalender_budidaya", "kb", [
      "dosis_per_ha",
      "dosis_acuan",
      "dosis",
    ]),
    "NULL"
  );

  const dosisTotalExpr = coalesce(
    existingColExprs(schema, "kalender_budidaya", "kb", [
      "dosis_total",
      "total_lahan",
      "total",
    ]),
    "NULL"
  );

  const tanggalExpr = has(schema, "kalender_budidaya", "tanggal")
    ? "kb.tanggal"
    : "NULL";

  const sub = (expr) => `
    (
      SELECT ${expr}
      FROM kalender_budidaya kb
      WHERE ${where}
      ORDER BY ${tanggalOrder}
      LIMIT 1
    )
  `;

  return {
    pupuk_rekomendasi: sub(pupukExpr),
    dosis_pupuk_per_ha: sub(dosisHaExpr),
    dosis_pupuk_total: sub(dosisTotalExpr),
    tanggal_pemupukan: sub(tanggalExpr),
  };
};

// ======================================================
// QUERY BUILDER
// ======================================================
const buildLahanSelectQuery = async (filters = {}) => {
  const schema = await getSchema();

  const joins = [];
  const params = [];
  const conditions = getWhereConditions(schema);

  const petaniJoinConditions = [];

  if (has(schema, "users", "id") && has(schema, "lahan", "petani_id")) {
    petaniJoinConditions.push(`p.id = ${col("l", "petani_id")}`);
  }

  if (has(schema, "users", "id") && has(schema, "lahan", "user_id")) {
    petaniJoinConditions.push(`p.id = ${col("l", "user_id")}`);
  }

  if (petaniJoinConditions.length) {
    joins.push(`
      LEFT JOIN users p
        ON ${petaniJoinConditions.join(" OR ")}
    `);
  }

  if (has(schema, "kecamatan", "id") && has(schema, "lahan", "kecamatan_id")) {
    joins.push(`
      LEFT JOIN kecamatan k
        ON k.id = ${col("l", "kecamatan_id")}
    `);
  }

  if (has(schema, "desa", "id") && has(schema, "lahan", "desa_id")) {
    joins.push(`
      LEFT JOIN desa d
        ON d.id = ${col("l", "desa_id")}
    `);
  }

  if (has(schema, "users", "id") && has(schema, "lahan", "penyuluh_id")) {
    joins.push(`
      LEFT JOIN users py
        ON py.id = ${col("l", "penyuluh_id")}
        ${has(schema, "users", "role") ? "AND py.role = 'penyuluh'" : ""}
    `);
  }

  const idExpr = has(schema, "lahan", "id") ? col("l", "id") : "0";

  const namaLahanExpr = coalesce(
    existingColExprs(schema, "lahan", "l", ["nama_lahan", "nama"]),
    "'-'"
  );

  const kodeLahanExpr = coalesce(
    existingColExprs(schema, "lahan", "l", ["kode_lahan", "kode"]),
    `CONCAT('LH-', LPAD(${idExpr}, 4, '0'))`
  );

  const petaniIdExpr = coalesce(
    existingColExprs(schema, "lahan", "l", ["petani_id", "user_id"]),
    "NULL"
  );

  const userIdExpr = has(schema, "lahan", "user_id")
    ? col("l", "user_id")
    : "NULL";

  const penyuluhIdExpr = has(schema, "lahan", "penyuluh_id")
    ? col("l", "penyuluh_id")
    : "NULL";

  const kecamatanIdExpr = has(schema, "lahan", "kecamatan_id")
    ? col("l", "kecamatan_id")
    : "NULL";

  const desaIdExpr = has(schema, "lahan", "desa_id")
    ? col("l", "desa_id")
    : "NULL";

  const namaPetaniExprs = [];

  if (petaniJoinConditions.length) {
    namaPetaniExprs.push(
      ...existingColExprs(schema, "users", "p", ["nama", "name", "full_name"])
    );
  }

  namaPetaniExprs.push(
    ...existingColExprs(schema, "lahan", "l", ["nama_petani"])
  );

  const namaPetaniExpr = coalesce(namaPetaniExprs, "'-'");

  const emailPetaniExpr =
    petaniJoinConditions.length && has(schema, "users", "email")
      ? col("p", "email")
      : "NULL";

  const noHpPetaniExpr =
    petaniJoinConditions.length && has(schema, "users", "no_hp")
      ? col("p", "no_hp")
      : "NULL";

  const namaKecamatanExprs = [];

  if (has(schema, "lahan", "kecamatan_id")) {
    namaKecamatanExprs.push(
      ...existingColExprs(schema, "kecamatan", "k", [
        "nama_kecamatan",
        "kecamatan",
        "nama",
      ])
    );
  }

  namaKecamatanExprs.push(
    ...existingColExprs(schema, "lahan", "l", [
      "nama_kecamatan",
      "kecamatan",
      "nama_kec",
    ])
  );

  const namaKecamatanExpr = coalesce(namaKecamatanExprs, "'-'");

  const namaDesaExprs = [];

  if (has(schema, "lahan", "desa_id")) {
    namaDesaExprs.push(
      ...existingColExprs(schema, "desa", "d", [
        "nama_desa",
        "desa",
        "kelurahan",
        "nama",
      ])
    );
  }

  namaDesaExprs.push(
    ...existingColExprs(schema, "lahan", "l", [
      "nama_desa",
      "desa",
      "kelurahan",
    ])
  );

  const namaDesaExpr = coalesce(namaDesaExprs, "'-'");

  const namaPenyuluhExprs = [];

  if (has(schema, "lahan", "penyuluh_id")) {
    namaPenyuluhExprs.push(
      ...existingColExprs(schema, "users", "py", ["nama", "name", "full_name"])
    );
  }

  namaPenyuluhExprs.push(
    ...existingColExprs(schema, "lahan", "l", ["penyuluh", "nama_penyuluh"])
  );

  const namaPenyuluhExpr = coalesce(namaPenyuluhExprs, "'-'");

  const idPenyuluhExpr =
    has(schema, "lahan", "penyuluh_id") && has(schema, "users", "id")
      ? "py.id"
      : "NULL";

  const varietasExpr = coalesce(
    existingColExprs(schema, "lahan", "l", ["varietas"]),
    "'-'"
  );

  const deskripsiExpr = coalesce(
    existingColExprs(schema, "lahan", "l", ["deskripsi", "keterangan"]),
    "'Belum ada deskripsi lahan.'"
  );

  const latExpr = coalesce(
    existingColExprs(schema, "lahan", "l", ["lat", "latitude", "lokasi_lat"]),
    "NULL"
  );

  const lngExpr = coalesce(
    existingColExprs(schema, "lahan", "l", ["lng", "longitude", "lokasi_lng"]),
    "NULL"
  );

  const tanggalTanamExpr = coalesce(
    existingColExprs(schema, "lahan", "l", [
      "tanggal_tanam",
      "tgl_tanam",
      "planting_date",
    ]),
    "NULL"
  );

  const panjangExpr = coalesce(
    existingColExprs(schema, "lahan", "l", [
      "panjang_m",
      "panjang_sawah",
      "panjang_lahan",
      "panjang",
    ]),
    "NULL"
  );

  const lebarExpr = coalesce(
    existingColExprs(schema, "lahan", "l", [
      "lebar_m",
      "lebar_sawah",
      "lebar_lahan",
      "lebar",
    ]),
    "NULL"
  );

  const createdAtExpr = coalesce(
    existingColExprs(schema, "lahan", "l", ["created_at", "tanggal_input"]),
    "NULL"
  );

  const updatedAtExpr = coalesce(
    existingColExprs(schema, "lahan", "l", ["updated_at"]),
    "NULL"
  );

  const userFilter = filters.user_id || filters.petani_id || filters.id_user;

  if (userFilter) {
    const userConditions = [];

    if (has(schema, "lahan", "user_id")) {
      userConditions.push(`${col("l", "user_id")} = ?`);
      params.push(userFilter);
    }

    if (has(schema, "lahan", "petani_id")) {
      userConditions.push(`${col("l", "petani_id")} = ?`);
      params.push(userFilter);
    }

    if (userConditions.length) {
      conditions.push(`(${userConditions.join(" OR ")})`);
    }
  }

  const pupukSub = buildPupukSubqueries(schema);

  const sql = `
    SELECT
      ${idExpr} AS id,
      ${namaLahanExpr} AS nama_lahan,
      ${kodeLahanExpr} AS kode_lahan,

      ${petaniIdExpr} AS petani_id,
      ${userIdExpr} AS user_id,
      ${namaPetaniExpr} AS nama_petani,
      ${emailPetaniExpr} AS email_petani,
      ${noHpPetaniExpr} AS no_hp_petani,

      ${penyuluhIdExpr} AS penyuluh_id,
      ${idPenyuluhExpr} AS id_penyuluh,
      ${namaPenyuluhExpr} AS nama_penyuluh,

      ${kecamatanIdExpr} AS kecamatan_id,
      ${desaIdExpr} AS desa_id,
      ${namaKecamatanExpr} AS nama_kecamatan,
      ${namaDesaExpr} AS nama_desa,

      ${getLuasHaExpr(schema)} AS luas_ha,
      ${getLuasM2Expr(schema)} AS luas_m2,
      ${panjangExpr} AS panjang_m,
      ${lebarExpr} AS lebar_m,

      ${varietasExpr} AS varietas,
      ${getKomoditasExpr(schema)} AS komoditas,
      ${getKomoditasExpr(schema)} AS tanaman,
      ${getStatusExpr(schema)} AS status_lahan,
      ${deskripsiExpr} AS deskripsi,

      ${latExpr} AS lat,
      ${lngExpr} AS lng,
      ${latExpr} AS latitude,
      ${lngExpr} AS longitude,

      ${tanggalTanamExpr} AS tanggal_tanam,

      ${pupukSub.pupuk_rekomendasi} AS pupuk_rekomendasi,
      ${pupukSub.dosis_pupuk_per_ha} AS dosis_pupuk_per_ha,
      ${pupukSub.dosis_pupuk_total} AS dosis_pupuk_total,
      ${pupukSub.tanggal_pemupukan} AS tanggal_pemupukan,

      ${createdAtExpr} AS created_at,
      ${updatedAtExpr} AS updated_at

    FROM lahan l
    ${joins.join("\n")}
    ${buildWhereSql(conditions)}
    ORDER BY ${idExpr} DESC
  `;

  return {
    sql,
    params,
    schema,
  };
};

// ======================================================
// GET LAHAN
// ======================================================
const getLahan = async (req, res) => {
  try {
    const { sql, params } = await buildLahanSelectQuery(req.query);
    const rows = await runQuery(sql, params);

    return res.json({
      status: true,
      message: "success",
      data: rows,
    });
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: "Gagal mengambil data lahan.",
      error: err.message,
    });
  }
};

// ======================================================
// GET STATS
// ======================================================
const getLahanStats = async (req, res) => {
  try {
    const schema = await getSchema();

    const luasExpr = getLuasHaExpr(schema);
    const statusExpr = getStatusExpr(schema);
    const conditions = getWhereConditions(schema);
    const where = buildWhereSql(conditions);

    const petaniExpr = coalesce(
      existingColExprs(schema, "lahan", "l", ["petani_id", "user_id"]),
      "NULL"
    );

    const penyuluhExpr = coalesce(
      existingColExprs(schema, "lahan", "l", ["penyuluh_id"]),
      "NULL"
    );

    let luasBulanIniExpr = "0";
    let luasBulanLaluExpr = "0";

    if (has(schema, "lahan", "created_at")) {
      luasBulanIniExpr = `
        SUM(
          CASE
            WHEN ${col("l", "created_at")} >= DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')
            THEN ${luasExpr}
            ELSE 0
          END
        )
      `;

      luasBulanLaluExpr = `
        SUM(
          CASE
            WHEN ${col("l", "created_at")} >= DATE_FORMAT(CURRENT_DATE() - INTERVAL 1 MONTH, '%Y-%m-01')
             AND ${col("l", "created_at")} < DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')
            THEN ${luasExpr}
            ELSE 0
          END
        )
      `;
    }

    const sql = `
      SELECT
        COUNT(*) AS total_lahan,
        COALESCE(SUM(${luasExpr}), 0) AS total_luas,

        COALESCE(
          SUM(
            CASE
              WHEN ${statusExpr} = 'aktif'
              THEN ${luasExpr}
              ELSE 0
            END
          ),
          0
        ) AS lahan_aktif,

        COALESCE(
          SUM(
            CASE
              WHEN ${statusExpr} = 'tidak_aktif'
              THEN ${luasExpr}
              ELSE 0
            END
          ),
          0
        ) AS lahan_tidak_aktif,

        COUNT(DISTINCT ${petaniExpr}) AS jumlah_petani,
        COUNT(DISTINCT ${penyuluhExpr}) AS jumlah_penyuluh,

        COALESCE(${luasBulanIniExpr}, 0) AS luas_bulan_ini,
        COALESCE(${luasBulanLaluExpr}, 0) AS luas_bulan_lalu

      FROM lahan l
      ${where}
    `;

    const rows = await runQuery(sql);
    const row = rows[0] || {};

    const totalLahan = Number(row.total_lahan || 0);
    const totalLuas = Number(row.total_luas || 0);
    const luasBulanIni = Number(row.luas_bulan_ini || 0);
    const luasBulanLalu = Number(row.luas_bulan_lalu || 0);

    return res.json({
      status: true,
      message: "success",
      data: {
        total_lahan: totalLahan,
        total_luas: totalLuas,
        lahan_aktif: Number(row.lahan_aktif || 0),
        lahan_tidak_aktif: Number(row.lahan_tidak_aktif || 0),
        jumlah_petani: Number(row.jumlah_petani || 0),
        jumlah_penyuluh: Number(row.jumlah_penyuluh || 0),
        rata_rata: totalLahan > 0 ? totalLuas / totalLahan : 0,
        luas_bulan_ini: luasBulanIni,
        luas_bulan_lalu: luasBulanLalu,
        selisih_luas: luasBulanIni - luasBulanLalu,
      },
    });
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: "Gagal mengambil statistik lahan.",
      error: err.message,
    });
  }
};

// ======================================================
// INSERT / UPDATE HELPERS
// ======================================================
const buildLahanValues = (schema, body, isUpdate = false) => {
  const namaLahan = cleanText(body.nama_lahan || body.nama);
  const petaniId = body.petani_id || body.user_id || null;
  const penyuluhId = body.penyuluh_id || null;
  const kecamatanId = body.kecamatan_id || null;
  const desaId = body.desa_id || null;

  const luasHa = normalizeNumber(body.luas_ha || body.luas);
  const luasM2 = normalizeNumber(body.luas_m2);

  const finalLuasHa = luasHa > 0 ? luasHa : luasM2 / 10000;
  const finalLuasM2 = luasM2 > 0 ? luasM2 : luasHa * 10000;

  const panjangM = normalizeNumber(body.panjang_m || body.panjang);
  const lebarM = normalizeNumber(body.lebar_m || body.lebar);

  const varietas = cleanText(body.varietas);
  const komoditas = cleanText(body.komoditas || body.tanaman || "Padi");
  const status = normalizeStatus(body.status_lahan || body.status || "aktif");
  const deskripsi = cleanText(body.deskripsi || body.keterangan);

  const lat = body.lat || body.latitude || body.lokasi_lat || null;
  const lng = body.lng || body.longitude || body.lokasi_lng || null;

  const tanggalTanam =
    body.tanggal_tanam || body.tgl_tanam || body.planting_date || null;

  const values = [];

  const add = (column, value) => {
    if (has(schema, "lahan", column)) {
      values.push({
        column,
        value,
        raw: false,
      });
    }
  };

  const addRaw = (column, value) => {
    if (has(schema, "lahan", column)) {
      values.push({
        column,
        value,
        raw: true,
      });
    }
  };

  add("nama_lahan", namaLahan);
  add("nama", namaLahan);

  add("petani_id", petaniId);
  add("user_id", petaniId);
  add("nama_petani", cleanText(body.nama_petani));

  add("penyuluh_id", penyuluhId);
  add("penyuluh", cleanText(body.penyuluh));
  add("nama_penyuluh", cleanText(body.penyuluh));

  add("kecamatan_id", kecamatanId);
  add("desa_id", desaId);
  add("nama_kecamatan", cleanText(body.nama_kecamatan));
  add("nama_desa", cleanText(body.nama_desa));

  add("luas_ha", finalLuasHa);
  add("luas_m2", finalLuasM2);
  add("luas", finalLuasHa);

  add("panjang_m", panjangM || null);
  add("panjang_sawah", panjangM || null);
  add("panjang_lahan", panjangM || null);
  add("panjang", panjangM || null);

  add("lebar_m", lebarM || null);
  add("lebar_sawah", lebarM || null);
  add("lebar_lahan", lebarM || null);
  add("lebar", lebarM || null);

  add("varietas", varietas);

  add("komoditas", komoditas);
  add("tanaman", komoditas);
  add("jenis_tanaman", komoditas);

  add("status_lahan", status);
  add("status", status);

  add("deskripsi", deskripsi);
  add("keterangan", deskripsi);

  add("lat", lat);
  add("latitude", lat);
  add("lokasi_lat", lat);

  add("lng", lng);
  add("longitude", lng);
  add("lokasi_lng", lng);

  add("tanggal_tanam", tanggalTanam);
  add("tgl_tanam", tanggalTanam);
  add("planting_date", tanggalTanam);

  if (!isUpdate) {
    addRaw("created_at", "NOW()");
  }

  if (isUpdate) {
    addRaw("updated_at", "NOW()");
  }

  return {
    namaLahan,
    finalLuasHa,
    values,
  };
};

const insertLahanRecord = async (schema, body) => {
  const { namaLahan, finalLuasHa, values } = buildLahanValues(schema, body);

  if (!namaLahan) {
    const err = new Error("Nama lahan wajib diisi.");
    err.statusCode = 400;
    throw err;
  }

  if (!finalLuasHa || finalLuasHa <= 0) {
    const err = new Error("Luas lahan wajib diisi.");
    err.statusCode = 400;
    throw err;
  }

  const columns = values.map((item) => q(item.column)).join(", ");
  const placeholders = values
    .map((item) => (item.raw ? item.value : "?"))
    .join(", ");
  const params = values.filter((item) => !item.raw).map((item) => item.value);

  const sql = `
    INSERT INTO lahan (${columns})
    VALUES (${placeholders})
  `;

  return runQuery(sql, params);
};

const updateLahanRecord = async (schema, id, body) => {
  const { namaLahan, finalLuasHa, values } = buildLahanValues(
    schema,
    body,
    true
  );

  if (!namaLahan) {
    const err = new Error("Nama lahan wajib diisi.");
    err.statusCode = 400;
    throw err;
  }

  if (!finalLuasHa || finalLuasHa <= 0) {
    const err = new Error("Luas lahan wajib diisi.");
    err.statusCode = 400;
    throw err;
  }

  const assignments = values
    .map((item) => `${q(item.column)} = ${item.raw ? item.value : "?"}`)
    .join(", ");

  const params = values.filter((item) => !item.raw).map((item) => item.value);
  params.push(id);

  const sql = `
    UPDATE lahan
    SET ${assignments}
    WHERE id = ?
  `;

  return runQuery(sql, params);
};

// ======================================================
// CREATE
// ======================================================
const createLahan = async (req, res) => {
  try {
    const schema = await getSchema();

    await insertLahanRecord(schema, req.body);

    return res.json({
      status: true,
      message: "Lahan berhasil ditambahkan.",
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      status: false,
      message: err.message || "Gagal menambah lahan.",
      error: err.message,
    });
  }
};

// ======================================================
// UPDATE
// ======================================================
const updateLahan = async (req, res) => {
  try {
    const schema = await getSchema();
    const { id } = req.params;

    const result = await updateLahanRecord(schema, id, req.body);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: false,
        message: "Data lahan tidak ditemukan.",
      });
    }

    return res.json({
      status: true,
      message: "Lahan berhasil diperbarui.",
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      status: false,
      message: err.message || "Gagal memperbarui lahan.",
      error: err.message,
    });
  }
};

// ======================================================
// DELETE
// ======================================================
const deleteLahan = async (req, res) => {
  try {
    const schema = await getSchema();
    const { id } = req.params;

    let sql;

    if (has(schema, "lahan", "status_lahan")) {
      sql = `
        UPDATE lahan
        SET status_lahan = 'dihapus'
        ${has(schema, "lahan", "updated_at") ? ", updated_at = NOW()" : ""}
        WHERE id = ?
      `;
    } else if (has(schema, "lahan", "status")) {
      sql = `
        UPDATE lahan
        SET status = 'dihapus'
        ${has(schema, "lahan", "updated_at") ? ", updated_at = NOW()" : ""}
        WHERE id = ?
      `;
    } else {
      sql = `
        DELETE FROM lahan
        WHERE id = ?
      `;
    }

    const result = await runQuery(sql, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: false,
        message: "Data lahan tidak ditemukan.",
      });
    }

    return res.json({
      status: true,
      message: "Lahan berhasil dihapus dari daftar.",
    });
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: "Gagal menghapus lahan.",
      error: err.message,
    });
  }
};

// ======================================================
// IMPORT
// ======================================================
const importLahan = async (req, res) => {
  try {
    await runUploadImport(req, res);

    if (!req.file) {
      return res.status(400).json({
        status: false,
        message: "File import wajib diupload.",
      });
    }

    const schema = await getSchema();

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

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
      const body = {
        nama_lahan:
          row.nama_lahan ||
          row["Nama Lahan"] ||
          row.nama ||
          row.Nama,

        petani_id:
          row.petani_id ||
          row.user_id ||
          row["ID Petani"] ||
          row["Petani ID"],

        penyuluh_id:
          row.penyuluh_id ||
          row["ID Penyuluh"] ||
          row["Penyuluh ID"],

        kecamatan_id:
          row.kecamatan_id ||
          row["ID Kecamatan"] ||
          row["Kecamatan ID"],

        desa_id:
          row.desa_id ||
          row["ID Desa"] ||
          row["Desa ID"],

        luas_ha:
          row.luas_ha ||
          row.luas ||
          row["Luas Ha"] ||
          row["Luas"],

        luas_m2:
          row.luas_m2 ||
          row["Luas m2"] ||
          row["Luas M2"],

        panjang_m:
          row.panjang_m ||
          row.panjang ||
          row["Panjang"] ||
          row["Panjang m"],

        lebar_m:
          row.lebar_m ||
          row.lebar ||
          row["Lebar"] ||
          row["Lebar m"],

        varietas:
          row.varietas ||
          row.Varietas,

        komoditas:
          row.komoditas ||
          row.Komoditas ||
          row.tanaman ||
          row.Tanaman ||
          "Padi",

        status_lahan:
          row.status_lahan ||
          row.Status ||
          row.status ||
          "aktif",

        deskripsi:
          row.deskripsi ||
          row.Deskripsi ||
          row.keterangan ||
          row.Keterangan,

        lat:
          row.lat ||
          row.latitude ||
          row.Latitude,

        lng:
          row.lng ||
          row.longitude ||
          row.Longitude,

        tanggal_tanam:
          row.tanggal_tanam ||
          row.tgl_tanam ||
          row["Tanggal Tanam"] ||
          row["Tgl Tanam"],
      };

      try {
        await insertLahanRecord(schema, body);
        success += 1;
      } catch {
        failed += 1;
      }
    }

    return res.json({
      status: true,
      message: "Import lahan selesai.",
      total_berhasil: success,
      total_gagal: failed,
    });
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: "Import lahan gagal.",
      error: err.message,
    });
  }
};

module.exports = {
  getLahan,
  getLahanStats,
  createLahan,
  updateLahan,
  deleteLahan,
  importLahan,
};