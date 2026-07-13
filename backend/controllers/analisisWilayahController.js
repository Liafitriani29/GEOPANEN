const db = require("../config/db");

/*
|--------------------------------------------------------------------------
| HELPER DATABASE
|--------------------------------------------------------------------------
*/

const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows || []);
    });
  });
};

/*
|--------------------------------------------------------------------------
| HELPER ANGKA
|--------------------------------------------------------------------------
*/

const toNumber = (value, fallback = 0) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
};

const roundNumber = (value, digit = 2) => {
  return Number(
    toNumber(value).toFixed(digit)
  );
};

/*
|--------------------------------------------------------------------------
| KONVERSI LUAS KE HEKTARE
|--------------------------------------------------------------------------
*/

const getLuasHa = (row) => {
  const luasHa = toNumber(row?.luas_ha);

  if (luasHa > 0) {
    return luasHa;
  }

  const luasM2 = toNumber(row?.luas_m2);

  if (luasM2 > 0) {
    return luasM2 / 10000;
  }

  return 0;
};

/*
|--------------------------------------------------------------------------
| MENGAMBIL PRODUKTIVITAS
|--------------------------------------------------------------------------
*/

const getProduktivitas = (row) => {
  const produktivitas = toNumber(
    row?.produktivitas
  );

  if (produktivitas > 0) {
    return produktivitas;
  }

  const luasHa = getLuasHa(row);
  const prediksiTon = toNumber(
    row?.prediksi_ton
  );

  if (luasHa <= 0 || prediksiTon <= 0) {
    return 0;
  }

  return prediksiTon / luasHa;
};

/*
|--------------------------------------------------------------------------
| MENGAMBIL TAHUN DARI TANGGAL
|--------------------------------------------------------------------------
*/

const getYearFromDate = (dateValue) => {
  if (!dateValue) {
    return null;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return String(date.getFullYear());
};

/*
|--------------------------------------------------------------------------
| MENGHITUNG RINGKASAN WILAYAH
|--------------------------------------------------------------------------
|
| Produktivitas wilayah dihitung:
|
| total prediksi seluruh lahan / total luas seluruh lahan
|
| Metode ini lebih adil ketika ukuran lahan berbeda.
|
*/

const calculateRegionalSummary = ({
  rows,
  currentProductivity,
  regionName,
}) => {
  const validRows = (rows || [])
    .map((row) => {
      const luasHa = getLuasHa(row);

      const prediksiTon = toNumber(
        row?.prediksi_ton
      );

      const produktivitas =
        getProduktivitas(row);

      return {
        ...row,

        luas_ha_normalized: luasHa,

        prediksi_ton_normalized:
          prediksiTon,

        produktivitas_normalized:
          produktivitas,
      };
    })
    .filter((row) => {
      return (
        row.produktivitas_normalized > 0
      );
    });

  const totalPrediction = validRows.reduce(
    (total, row) => {
      return (
        total +
        row.prediksi_ton_normalized
      );
    },
    0
  );

  const totalArea = validRows.reduce(
    (total, row) => {
      return (
        total +
        row.luas_ha_normalized
      );
    },
    0
  );

  let averageProductivity = 0;

  if (totalArea > 0) {
    averageProductivity =
      totalPrediction / totalArea;
  } else if (validRows.length > 0) {
    const totalProductivity =
      validRows.reduce((total, row) => {
        return (
          total +
          row.produktivitas_normalized
        );
      }, 0);

    averageProductivity =
      totalProductivity /
      validRows.length;
  }

  const differenceTonHa =
    averageProductivity > 0
      ? toNumber(currentProductivity) -
        averageProductivity
      : 0;

  const differencePercent =
    averageProductivity > 0
      ? (
          differenceTonHa /
          averageProductivity
        ) * 100
      : 0;

  return {
    name: regionName || "-",

    avg_productivity_ton_ha:
      roundNumber(
        averageProductivity,
        2
      ),

    rata_produktivitas_ton_ha:
      roundNumber(
        averageProductivity,
        2
      ),

    total_prediction_ton:
      roundNumber(
        totalPrediction,
        2
      ),

    total_prediksi_ton:
      roundNumber(
        totalPrediction,
        2
      ),

    total_area_ha:
      roundNumber(
        totalArea,
        4
      ),

    total_luas_ha:
      roundNumber(
        totalArea,
        4
      ),

    land_count: validRows.length,

    jumlah_lahan: validRows.length,

    difference_ton_ha:
      roundNumber(
        differenceTonHa,
        2
      ),

    difference_percent:
      roundNumber(
        differencePercent,
        2
      ),
  };
};

/*
|--------------------------------------------------------------------------
| GET ANALISIS WILAYAH
|--------------------------------------------------------------------------
|
| Endpoint:
|
| GET /api/prediksi/analisis-wilayah
|
| Query parameter:
|
| sawah_id
| lahan_id
| prediksi_id
| tanggal_prediksi
| periode
|
*/

exports.getAnalisisWilayah = async (
  req,
  res
) => {
  try {
    const sawahId = Number(
      req.query.sawah_id ||
      req.query.lahan_id
    );

    const predictionId = Number(
      req.query.prediksi_id || 0
    );

    /*
    |--------------------------------------------------------------------------
    | VALIDASI LAHAN
    |--------------------------------------------------------------------------
    */

    if (
      !Number.isInteger(sawahId) ||
      sawahId <= 0
    ) {
      return res.status(400).json({
        success: false,

        message:
          "sawah_id atau lahan_id wajib diisi dengan benar",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | AMBIL DETAIL LAHAN
    |--------------------------------------------------------------------------
    */

    const lahanRows = await query(
      `
        SELECT
          l.id,
          l.nama_lahan,
          l.luas_ha,
          l.luas_m2,
          l.desa_id,
          l.kecamatan_id,

          d.nama_desa,
          k.nama_kecamatan

        FROM lahan l

        LEFT JOIN desa d
          ON d.id = l.desa_id

        LEFT JOIN kecamatan k
          ON k.id = l.kecamatan_id

        WHERE l.id = ?

        LIMIT 1
      `,
      [sawahId]
    );

    const selectedLahan =
      lahanRows[0];

    if (!selectedLahan) {
      return res.status(404).json({
        success: false,
        message: "Lahan tidak ditemukan",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | AMBIL PREDIKSI AKTIF
    |--------------------------------------------------------------------------
    */

    let currentPredictionRows = [];

    if (predictionId > 0) {
      currentPredictionRows =
        await query(
          `
            SELECT
              p.id,
              p.sawah_id,
              p.prediksi_ton,
              p.produktivitas,
              p.periode,
              p.created_at,

              l.luas_ha,
              l.luas_m2

            FROM prediksi p

            INNER JOIN lahan l
              ON l.id = p.sawah_id

            WHERE p.id = ?
              AND p.sawah_id = ?

            LIMIT 1
          `,
          [
            predictionId,
            sawahId,
          ]
        );
    }

    /*
     * Jika prediksi_id tidak ditemukan,
     * ambil prediksi terbaru berdasarkan lahan.
     */

    if (
      currentPredictionRows.length === 0
    ) {
      currentPredictionRows =
        await query(
          `
            SELECT
              p.id,
              p.sawah_id,
              p.prediksi_ton,
              p.produktivitas,
              p.periode,
              p.created_at,

              l.luas_ha,
              l.luas_m2

            FROM prediksi p

            INNER JOIN lahan l
              ON l.id = p.sawah_id

            WHERE p.sawah_id = ?

            ORDER BY
              p.created_at DESC,
              p.id DESC

            LIMIT 1
          `,
          [sawahId]
        );
    }

    const currentPrediction =
      currentPredictionRows[0];

    if (!currentPrediction) {
      return res.status(404).json({
        success: false,

        message:
          "Data prediksi untuk lahan tersebut belum tersedia",
      });
    }

    /*
    |--------------------------------------------------------------------------
    | MENENTUKAN PERIODE
    |--------------------------------------------------------------------------
    */

    const requestedPeriod = String(
      req.query.periode || ""
    ).trim();

    const datePeriod =
      getYearFromDate(
        req.query.tanggal_prediksi
      );

    const predictionPeriod = String(
      currentPrediction.periode || ""
    ).trim();

    const period =
      requestedPeriod ||
      datePeriod ||
      predictionPeriod ||
      String(new Date().getFullYear());

    const periodYear = Number(period);

    /*
    |--------------------------------------------------------------------------
    | AMBIL PREDIKSI TERBARU SETIAP LAHAN DALAM KECAMATAN
    |--------------------------------------------------------------------------
    |
    | Data desa diambil dengan melakukan filter dari data kecamatan.
    |
    */

    let regionalRows = [];

    if (selectedLahan.kecamatan_id) {
      regionalRows = await query(
        `
          SELECT
            p.id,
            p.sawah_id,
            p.prediksi_ton,
            p.produktivitas,
            p.periode,
            p.created_at,

            l.nama_lahan,
            l.luas_ha,
            l.luas_m2,
            l.desa_id,
            l.kecamatan_id,

            d.nama_desa,
            k.nama_kecamatan

          FROM prediksi p

          INNER JOIN
          (
            SELECT
              p2.sawah_id,
              MAX(p2.id) AS max_id

            FROM prediksi p2

            WHERE
              p2.periode = ?
              OR YEAR(p2.created_at) = ?

            GROUP BY
              p2.sawah_id
          ) latest_prediction

            ON latest_prediction.max_id =
               p.id

          INNER JOIN lahan l
            ON l.id = p.sawah_id

          LEFT JOIN desa d
            ON d.id = l.desa_id

          LEFT JOIN kecamatan k
            ON k.id = l.kecamatan_id

          WHERE l.kecamatan_id = ?
        `,
        [
          period,

          Number.isFinite(periodYear)
            ? periodYear
            : new Date().getFullYear(),

          selectedLahan.kecamatan_id,
        ]
      );
    }

    /*
    |--------------------------------------------------------------------------
    | PRODUKTIVITAS LAHAN YANG DIPILIH
    |--------------------------------------------------------------------------
    */

    const currentProductivity =
      getProduktivitas(
        currentPrediction
      );

    /*
    |--------------------------------------------------------------------------
    | FILTER DATA DESA
    |--------------------------------------------------------------------------
    */

    const villageRows =
      regionalRows.filter((row) => {
        return (
          String(row.desa_id || "") ===
          String(
            selectedLahan.desa_id || ""
          )
        );
      });

    /*
    |--------------------------------------------------------------------------
    | RINGKASAN DESA
    |--------------------------------------------------------------------------
    */

    const village =
      calculateRegionalSummary({
        rows: villageRows,

        currentProductivity,

        regionName:
          selectedLahan.nama_desa ||
          "-",
      });

    /*
    |--------------------------------------------------------------------------
    | RINGKASAN KECAMATAN
    |--------------------------------------------------------------------------
    */

    const district =
      calculateRegionalSummary({
        rows: regionalRows,

        currentProductivity,

        regionName:
          selectedLahan
            .nama_kecamatan ||
          "-",
      });

    /*
    |--------------------------------------------------------------------------
    | RESPONSE
    |--------------------------------------------------------------------------
    */

    return res.status(200).json({
      success: true,

      message:
        "Analisis perbandingan wilayah berhasil diambil",

      data: {
        period,
        periode: period,

        method:
          "total_prediction_divided_by_total_area",

        current: {
          prediction_id:
            currentPrediction.id,

          sawah_id: sawahId,
          lahan_id: sawahId,

          nama_lahan:
            selectedLahan.nama_lahan ||
            "-",

          nama_desa:
            selectedLahan.nama_desa ||
            "-",

          nama_kecamatan:
            selectedLahan
              .nama_kecamatan ||
            "-",

          productivity_ton_ha:
            roundNumber(
              currentProductivity,
              2
            ),

          produktivitas_ton_ha:
            roundNumber(
              currentProductivity,
              2
            ),

          prediction_ton:
            roundNumber(
              currentPrediction
                .prediksi_ton,
              2
            ),

          prediksi_ton:
            roundNumber(
              currentPrediction
                .prediksi_ton,
              2
            ),

          area_ha:
            roundNumber(
              getLuasHa(
                currentPrediction
              ),
              4
            ),

          luas_ha:
            roundNumber(
              getLuasHa(
                currentPrediction
              ),
              4
            ),
        },

        village,
        desa: village,

        district,
        kecamatan: district,
      },
    });
  } catch (error) {
    console.error(
      "ERROR ANALISIS WILAYAH:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Gagal mengambil analisis perbandingan wilayah",

      error: error.message,
    });
  }
};