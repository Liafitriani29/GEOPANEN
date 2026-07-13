const databaseModule = require("../config/db");

/**
 * Mendukung dua bentuk ekspor koneksi mysql2:
 * 1. mysql2/promise pool, langsung memiliki query()
 * 2. mysql2 pool biasa, harus dipanggil dengan promise()
 */
function resolveDatabase(connection) {
  if (connection && typeof connection.promise === "function") {
    return connection.promise();
  }

  if (connection && typeof connection.query === "function") {
    return connection;
  }

  if (connection?.pool && typeof connection.pool.promise === "function") {
    return connection.pool.promise();
  }

  if (connection?.pool && typeof connection.pool.query === "function") {
    return connection.pool;
  }

  throw new Error(
    "Koneksi database dari config/db.js tidak valid. Pastikan file tersebut mengekspor pool atau connection mysql2."
  );
}

const db = resolveDatabase(databaseModule);

let schemaCache = null;

function quoteIdentifier(value) {
  return `\`${String(value).replace(/`/g, "``")}\``;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function findColumn(columns, candidates) {
  return candidates.find((candidate) => columns.has(candidate)) || null;
}

async function getTableColumns(tableName) {
  try {
    const [rows] = await db.query(
      `SHOW COLUMNS FROM ${quoteIdentifier(tableName)}`
    );

    return new Set(rows.map((row) => row.Field));
  } catch (error) {
    const wrappedError = new Error(
      `Gagal membaca struktur tabel ${tableName}: ${error.message}`
    );

    wrappedError.statusCode = 500;
    throw wrappedError;
  }
}

/**
 * Mendeteksi nama kolom wilayah dan luas pada tabel sawah.
 *
 * Kode mendukung:
 * - sawah.nama_desa dan sawah.nama_kecamatan
 * - sawah.desa_id dan sawah.kecamatan_id
 * - kecamatan melalui relasi tabel desa
 * - luas_ha, luas_m2, luas, atau luas_lahan
 */
async function resolveSawahSchema() {
  if (schemaCache) {
    return schemaCache;
  }

  const sawahColumns = await getTableColumns("sawah");

  if (!sawahColumns.has("id")) {
    throw new Error("Tabel sawah tidak memiliki kolom id.");
  }

  const joins = [];

  let desaColumns = null;
  let kecamatanColumns = null;
  let desaJoined = false;
  let kecamatanJoined = false;

  async function ensureDesaJoin() {
    if (desaJoined) return;

    if (!sawahColumns.has("desa_id")) {
      throw new Error(
        "Kolom nama_desa tidak ditemukan dan tabel sawah juga tidak memiliki desa_id."
      );
    }

    desaColumns = desaColumns || (await getTableColumns("desa"));

    if (!desaColumns.has("id")) {
      throw new Error("Tabel desa tidak memiliki kolom id.");
    }

    joins.push("LEFT JOIN desa d ON d.id = s.desa_id");
    desaJoined = true;
  }

  async function ensureKecamatanJoin(joinThroughDesa = false) {
    if (kecamatanJoined) return;

    kecamatanColumns =
      kecamatanColumns || (await getTableColumns("kecamatan"));

    if (!kecamatanColumns.has("id")) {
      throw new Error("Tabel kecamatan tidak memiliki kolom id.");
    }

    if (joinThroughDesa) {
      await ensureDesaJoin();

      if (!desaColumns.has("kecamatan_id")) {
        throw new Error(
          "Tabel desa tidak memiliki kolom kecamatan_id untuk relasi wilayah."
        );
      }

      joins.push("LEFT JOIN kecamatan k ON k.id = d.kecamatan_id");
    } else {
      if (!sawahColumns.has("kecamatan_id")) {
        throw new Error(
          "Tabel sawah tidak memiliki kolom kecamatan_id untuk relasi wilayah."
        );
      }

      joins.push("LEFT JOIN kecamatan k ON k.id = s.kecamatan_id");
    }

    kecamatanJoined = true;
  }

  /*
  |--------------------------------------------------------------------------
  | KOLOM DESA
  |--------------------------------------------------------------------------
  */

  let villageExpression = null;

  const directVillageColumn = findColumn(sawahColumns, [
    "nama_desa",
    "desa",
  ]);

  if (directVillageColumn) {
    villageExpression = `s.${quoteIdentifier(directVillageColumn)}`;
  } else {
    await ensureDesaJoin();

    const desaNameColumn = findColumn(desaColumns, [
      "nama_desa",
      "nama",
      "name",
    ]);

    if (!desaNameColumn) {
      throw new Error(
        "Nama desa tidak ditemukan. Gunakan kolom nama_desa atau nama pada tabel desa."
      );
    }

    villageExpression = `d.${quoteIdentifier(desaNameColumn)}`;
  }

  /*
  |--------------------------------------------------------------------------
  | KOLOM KECAMATAN
  |--------------------------------------------------------------------------
  */

  let districtExpression = null;

  const directDistrictColumn = findColumn(sawahColumns, [
    "nama_kecamatan",
    "kecamatan",
  ]);

  if (directDistrictColumn) {
    districtExpression = `s.${quoteIdentifier(directDistrictColumn)}`;
  } else if (sawahColumns.has("kecamatan_id")) {
    await ensureKecamatanJoin(false);

    const kecamatanNameColumn = findColumn(kecamatanColumns, [
      "nama_kecamatan",
      "nama",
      "name",
    ]);

    if (!kecamatanNameColumn) {
      throw new Error(
        "Nama kecamatan tidak ditemukan pada tabel kecamatan."
      );
    }

    districtExpression = `k.${quoteIdentifier(kecamatanNameColumn)}`;
  } else {
    await ensureDesaJoin();

    const districtNameInDesa = findColumn(desaColumns, [
      "nama_kecamatan",
      "kecamatan",
    ]);

    if (districtNameInDesa) {
      districtExpression = `d.${quoteIdentifier(districtNameInDesa)}`;
    } else {
      await ensureKecamatanJoin(true);

      const kecamatanNameColumn = findColumn(kecamatanColumns, [
        "nama_kecamatan",
        "nama",
        "name",
      ]);

      if (!kecamatanNameColumn) {
        throw new Error(
          "Nama kecamatan tidak ditemukan pada tabel kecamatan."
        );
      }

      districtExpression = `k.${quoteIdentifier(kecamatanNameColumn)}`;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | KOLOM LUAS LAHAN
  |--------------------------------------------------------------------------
  */

  let areaExpression = null;

  if (sawahColumns.has("luas_ha")) {
    areaExpression = "COALESCE(s.luas_ha, 0)";
  } else if (sawahColumns.has("luas_m2")) {
    areaExpression = "COALESCE(s.luas_m2, 0) / 10000";
  } else {
    const flexibleAreaColumn = findColumn(sawahColumns, [
      "luas",
      "luas_lahan",
    ]);

    if (!flexibleAreaColumn) {
      throw new Error(
        "Kolom luas tidak ditemukan pada tabel sawah. Gunakan luas_ha, luas_m2, luas, atau luas_lahan."
      );
    }

    const quotedAreaColumn =
      `s.${quoteIdentifier(flexibleAreaColumn)}`;

    areaExpression = `
      CASE
        WHEN COALESCE(${quotedAreaColumn}, 0) > 20
          THEN COALESCE(${quotedAreaColumn}, 0) / 10000
        ELSE COALESCE(${quotedAreaColumn}, 0)
      END
    `;
  }

  /*
  |--------------------------------------------------------------------------
  | PRODUKTIVITAS
  |--------------------------------------------------------------------------
  */

  const productivityExpression = `
    COALESCE(
      NULLIF(p.produktivitas, 0),
      p.prediksi_ton / NULLIF((${areaExpression}), 0),
      0
    )
  `;

  schemaCache = {
    joins: joins.join("\n"),
    villageExpression,
    districtExpression,
    areaExpression,
    productivityExpression,
  };

  return schemaCache;
}

function getYearRange(dateValue) {
  const parsedDate = dateValue
    ? new Date(dateValue)
    : new Date();

  const validDate = Number.isNaN(parsedDate.getTime())
    ? new Date()
    : parsedDate;

  const year = validDate.getFullYear();

  return {
    year,
    startDate: `${year}-01-01 00:00:00`,
    endDate: `${year + 1}-01-01 00:00:00`,
  };
}

function getComparisonStatus(differencePercent, average) {
  if (average <= 0) {
    return "BELUM ADA DATA";
  }

  if (Math.abs(differencePercent) < 1) {
    return "SETARA";
  }

  return differencePercent > 0
    ? "LEBIH TINGGI"
    : "LEBIH RENDAH";
}

function buildLevelResult(
  row,
  currentProductivity,
  nameField
) {
  const average = toNumber(
    row?.avg_productivity_ton_ha
  );

  const difference =
    toNumber(currentProductivity) - average;

  const differencePercent =
    average > 0
      ? (difference / average) * 100
      : 0;

  return {
    name: row?.[nameField] || "-",

    avg_productivity_ton_ha: average,

    total_prediction_ton: toNumber(
      row?.total_prediction_ton
    ),

    total_area_ha: toNumber(
      row?.total_area_ha
    ),

    land_count: Math.max(
      0,
      Math.round(toNumber(row?.land_count))
    ),

    difference_ton_ha: difference,
    difference_percent: differencePercent,

    comparison_status: getComparisonStatus(
      differencePercent,
      average
    ),
  };
}

/*
|--------------------------------------------------------------------------
| MENGAMBIL PREDIKSI LAHAN YANG DIPILIH
|--------------------------------------------------------------------------
*/

async function getSelectedPrediction({
  sawahId,
  predictionId,
}) {
  const schema = await resolveSawahSchema();

  const params = [sawahId];
  let predictionFilter = "";

  if (predictionId) {
    predictionFilter = "AND p.id = ?";
    params.push(predictionId);
  }

  const [rows] = await db.query(
    `
      SELECT
        p.id AS prediksi_id,
        p.sawah_id,
        p.prediksi_ton,

        ${schema.productivityExpression}
          AS productivity_ton_ha,

        ${schema.areaExpression}
          AS area_ha,

        ${schema.villageExpression}
          AS nama_desa,

        ${schema.districtExpression}
          AS nama_kecamatan,

        p.created_at AS prediction_date

      FROM prediksi p

      INNER JOIN sawah s
        ON s.id = p.sawah_id

      ${schema.joins}

      WHERE p.sawah_id = ?
        ${predictionFilter}

      ORDER BY p.id DESC

      LIMIT 1
    `,
    params
  );

  return rows[0] || null;
}

/*
|--------------------------------------------------------------------------
| AGREGASI DESA
|--------------------------------------------------------------------------
*/

async function getVillageAggregate({
  villageName,
  districtName,
  startDate,
  endDate,
}) {
  const schema = await resolveSawahSchema();

  const [rows] = await db.query(
    `
      SELECT
        ${schema.villageExpression}
          AS nama_desa,

        COALESCE(
          SUM(p.prediksi_ton)
            / NULLIF(
                SUM(${schema.areaExpression}),
                0
              ),
          AVG(${schema.productivityExpression}),
          0
        ) AS avg_productivity_ton_ha,

        COALESCE(
          SUM(p.prediksi_ton),
          0
        ) AS total_prediction_ton,

        COALESCE(
          SUM(${schema.areaExpression}),
          0
        ) AS total_area_ha,

        COUNT(
          DISTINCT p.sawah_id
        ) AS land_count

      FROM prediksi p

      INNER JOIN (
        SELECT
          sawah_id,
          MAX(id) AS latest_prediction_id

        FROM prediksi

        WHERE created_at >= ?
          AND created_at < ?

        GROUP BY sawah_id
      ) latest
        ON latest.latest_prediction_id = p.id

      INNER JOIN sawah s
        ON s.id = p.sawah_id

      ${schema.joins}

      WHERE ${schema.villageExpression} = ?
        AND ${schema.districtExpression} = ?

      GROUP BY ${schema.villageExpression}

      LIMIT 1
    `,
    [
      startDate,
      endDate,
      villageName,
      districtName,
    ]
  );

  return (
    rows[0] || {
      nama_desa: villageName,
      avg_productivity_ton_ha: 0,
      total_prediction_ton: 0,
      total_area_ha: 0,
      land_count: 0,
    }
  );
}

/*
|--------------------------------------------------------------------------
| AGREGASI KECAMATAN
|--------------------------------------------------------------------------
*/

async function getDistrictAggregate({
  districtName,
  startDate,
  endDate,
}) {
  const schema = await resolveSawahSchema();

  const [rows] = await db.query(
    `
      SELECT
        ${schema.districtExpression}
          AS nama_kecamatan,

        COALESCE(
          SUM(p.prediksi_ton)
            / NULLIF(
                SUM(${schema.areaExpression}),
                0
              ),
          AVG(${schema.productivityExpression}),
          0
        ) AS avg_productivity_ton_ha,

        COALESCE(
          SUM(p.prediksi_ton),
          0
        ) AS total_prediction_ton,

        COALESCE(
          SUM(${schema.areaExpression}),
          0
        ) AS total_area_ha,

        COUNT(
          DISTINCT p.sawah_id
        ) AS land_count

      FROM prediksi p

      INNER JOIN (
        SELECT
          sawah_id,
          MAX(id) AS latest_prediction_id

        FROM prediksi

        WHERE created_at >= ?
          AND created_at < ?

        GROUP BY sawah_id
      ) latest
        ON latest.latest_prediction_id = p.id

      INNER JOIN sawah s
        ON s.id = p.sawah_id

      ${schema.joins}

      WHERE ${schema.districtExpression} = ?

      GROUP BY ${schema.districtExpression}

      LIMIT 1
    `,
    [
      startDate,
      endDate,
      districtName,
    ]
  );

  return (
    rows[0] || {
      nama_kecamatan: districtName,
      avg_productivity_ton_ha: 0,
      total_prediction_ton: 0,
      total_area_ha: 0,
      land_count: 0,
    }
  );
}

/*
|--------------------------------------------------------------------------
| FUNGSI UTAMA ANALISIS WILAYAH
|--------------------------------------------------------------------------
*/

async function getRegionalAnalysis({
  sawahId,
  predictionId = null,
  predictionDate = null,
}) {
  const selected = await getSelectedPrediction({
    sawahId,
    predictionId,
  });

  if (!selected) {
    const error = new Error(
      predictionId
        ? "Data prediksi dengan prediksi_id tersebut tidak ditemukan pada sawah yang dipilih."
        : "Data prediksi untuk sawah tersebut belum tersedia."
    );

    error.statusCode = 404;
    throw error;
  }

  /*
   * Tabel prediksi belum mempunyai tanggal_prediksi.
   * Periode analisis memakai tahun dari created_at.
   */
  const {
    year,
    startDate,
    endDate,
  } = getYearRange(selected.prediction_date);

  const [
    villageRow,
    districtRow,
  ] = await Promise.all([
    getVillageAggregate({
      villageName: selected.nama_desa,
      districtName: selected.nama_kecamatan,
      startDate,
      endDate,
    }),

    getDistrictAggregate({
      districtName: selected.nama_kecamatan,
      startDate,
      endDate,
    }),
  ]);

  const currentProductivity = toNumber(
    selected.productivity_ton_ha
  );

  return {
    period: String(year),

    date_source: "created_at",

    requested_prediction_date:
      predictionDate || null,

    selected: {
      prediction_id: selected.prediksi_id,
      sawah_id: selected.sawah_id,

      prediction_ton: toNumber(
        selected.prediksi_ton
      ),

      productivity_ton_ha:
        currentProductivity,

      area_ha: toNumber(
        selected.area_ha
      ),

      village_name:
        selected.nama_desa || "-",

      district_name:
        selected.nama_kecamatan || "-",

      prediction_date:
        selected.prediction_date,
    },

    village: buildLevelResult(
      villageRow,
      currentProductivity,
      "nama_desa"
    ),

    district: buildLevelResult(
      districtRow,
      currentProductivity,
      "nama_kecamatan"
    ),
  };
}

module.exports = {
  getRegionalAnalysis,
};