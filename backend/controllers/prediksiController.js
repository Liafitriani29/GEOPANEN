const axios = require("axios");
const db = require("../config/db");

/* =====================================================
   KONFIGURASI FASTAPI

   Isi file .env backend Node.js:
   FASTAPI_URL=http://127.0.0.1:8000
===================================================== */
const FASTAPI_BASE_URL = String(
  process.env.FASTAPI_URL || "http://127.0.0.1:8000"
)
  .trim()
  .replace(/\/+$/, "");

const FASTAPI_PREDIKSI_URL = FASTAPI_BASE_URL.endsWith("/prediksi")
  ? FASTAPI_BASE_URL
  : `${FASTAPI_BASE_URL}/prediksi`;

/* =====================================================
   METRIK EVALUASI GLOBAL MODEL

   Catatan:
   - Bukan confidence per prediksi.
   - MAPE adalah rata-rata kesalahan model.
   - R2 adalah koefisien determinasi model.
===================================================== */
const MODEL_METRICS = Object.freeze({
  mape: 7.91,
  r2: 0.9282,
  kedekatanSederhana: 92.09,
});

/*
 * Target rekomendasi sistem dibuat 15% di atas hasil prediksi.
 * Nilai ini dapat dipindahkan ke file .env apabila nanti ingin
 * dikonfigurasi tanpa mengubah kode.
 */
const targetSystemPercentEnv = Number(
  process.env.TARGET_SYSTEM_PERCENT
);

const TARGET_SYSTEM_PERCENT =
  Number.isFinite(
    targetSystemPercentEnv
  ) &&
  targetSystemPercentEnv >= 0
    ? targetSystemPercentEnv
    : 15;

/* =====================================================
   HELPER
===================================================== */
const isDefined = (value) => {
  return value !== undefined && value !== null && value !== "";
};

const pickDefined = (...values) => {
  for (const value of values) {
    if (isDefined(value)) {
      return value;
    }
  }

  return null;
};

const toNumber = (value, fallback = 0) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
};

const toNullableNumber = (value) => {
  if (!isDefined(value)) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
};

const toFixedNumber = (value, digit = 2) => {
  return Number(
    toNumber(value).toFixed(digit)
  );
};

/*
 * Menghasilkan seluruh informasi target secara konsisten.
 *
 * Target Petani:
 * - Diisi langsung oleh petani.
 * - Boleh null jika petani tidak memiliki target.
 *
 * Target Sistem:
 * - Dihitung otomatis dari hasil prediksi.
 * - Rumus: prediksi_ton × (1 + persentase / 100).
 *
 * Target Aktif:
 * - Memakai Target Petani jika tersedia.
 * - Jika kosong, memakai Target Sistem.
 */
const buildTargetMetrics = ({
  prediksiTon,
  targetPetaniTon = null,
  targetSistemTon = null,
  sumberTarget = null,
  persentaseTargetSistem = TARGET_SYSTEM_PERCENT,
}) => {
  const prediksi = toFixedNumber(
    prediksiTon,
    2
  );

  const rawPersentase =
    toNullableNumber(
      persentaseTargetSistem
    );

  const persentase =
    rawPersentase !== null &&
    rawPersentase >= 0
      ? toFixedNumber(
          rawPersentase,
          2
        )
      : toFixedNumber(
          TARGET_SYSTEM_PERCENT,
          2
        );

  const rawTargetPetani =
    toNullableNumber(
      targetPetaniTon
    );

  const targetPetani =
    rawTargetPetani !== null &&
    rawTargetPetani > 0
      ? toFixedNumber(
          rawTargetPetani,
          2
        )
      : null;

  const rawTargetSistem =
    toNullableNumber(
      targetSistemTon
    );

  const targetSistem =
    rawTargetSistem !== null &&
    rawTargetSistem >= 0
      ? toFixedNumber(
          rawTargetSistem,
          2
        )
      : toFixedNumber(
          prediksi *
            (1 + persentase / 100),
          2
        );

  const storedSource =
    String(
      sumberTarget || ""
    ).toUpperCase();

  let sumber =
    storedSource === "PETANI" ||
    storedSource === "SISTEM"
      ? storedSource
      : targetPetani !== null
      ? "PETANI"
      : "SISTEM";

  if (
    sumber === "PETANI" &&
    targetPetani === null
  ) {
    sumber = "SISTEM";
  }

  const targetAktif =
    sumber === "PETANI"
      ? targetPetani
      : targetSistem;

  const selisih =
    targetAktif === null
      ? null
      : toFixedNumber(
          prediksi - targetAktif,
          2
        );

  let status = "BELUM TERSEDIA";

  if (targetAktif !== null) {
    if (prediksi >= targetAktif) {
      status = "TERCAPAI";
    } else if (
      prediksi >= targetAktif * 0.9
    ) {
      status = "MENDEKATI";
    } else {
      status = "BELUM TERCAPAI";
    }
  }

  return {
    targetPetaniTon:
      targetPetani,

    targetSistemTon:
      targetSistem,

    targetAktifTon:
      targetAktif,

    sumberTarget:
      sumber,

    persentaseTargetSistem:
      persentase,

    selisihTargetTon:
      selisih,

    statusTarget:
      status,
  };
};

const toSqlDate = (dateValue) => {
  if (!dateValue) {
    return null;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const addDays = (dateValue, days) => {
  const date = dateValue
    ? new Date(dateValue)
    : new Date();

  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();

    fallback.setDate(
      fallback.getDate() + days
    );

    return fallback;
  }

  date.setDate(
    date.getDate() + days
  );

  return date;
};

const safeJson = (
  value,
  fallback = []
) => {
  try {
    return JSON.stringify(
      value ?? fallback
    );
  } catch {
    return JSON.stringify(
      fallback
    );
  }
};

const parseJsonSafe = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  try {
    const parsed = JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return String(value)
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }
};

const getLuasHa = (lahan) => {
  const luasHa = toNumber(
    lahan?.luas_ha
  );

  if (luasHa > 0) {
    return luasHa;
  }

  const luasM2 = toNumber(
    lahan?.luas_m2
  );

  if (luasM2 > 0) {
    return luasM2 / 10000;
  }

  return 0;
};

const getStatusRisiko = (
  riskScore
) => {
  const score = toNumber(
    riskScore
  );

  if (score >= 70) {
    return "KRITIS";
  }

  if (score >= 40) {
    return "WASPADA";
  }

  return "AMAN";
};

const normalizeConfidence = (
  value
) => {
  const number =
    toNullableNumber(value);

  if (
    number === null ||
    number < 0 ||
    number > 100
  ) {
    return null;
  }

  return toFixedNumber(
    number,
    2
  );
};

const enrichPredictionRow = (
  item = {}
) => {
  const targetMetrics =
    buildTargetMetrics({
      prediksiTon:
        item.prediksi_ton,

      targetPetaniTon:
        item.target_petani_ton,

      targetSistemTon:
        item.target_sistem_ton,

      sumberTarget:
        item.sumber_target,

      persentaseTargetSistem:
        item.persentase_target_sistem,
    });

  return {
    ...item,

    confidence:
      normalizeConfidence(
        item.confidence
      ),

    model_mape:
      MODEL_METRICS.mape,

    model_r2:
      MODEL_METRICS.r2,

    model_kedekatan_sederhana:
      MODEL_METRICS
        .kedekatanSederhana,

    target_petani_ton:
      targetMetrics
        .targetPetaniTon,

    target_sistem_ton:
      targetMetrics
        .targetSistemTon,

    target_aktif_ton:
      targetMetrics
        .targetAktifTon,

    sumber_target:
      targetMetrics
        .sumberTarget,

    persentase_target_sistem:
      targetMetrics
        .persentaseTargetSistem,

    selisih_target_ton:
      targetMetrics
        .selisihTargetTon,

    status_target:
      targetMetrics
        .statusTarget,

    nama_petani:
      item.nama_petani || "-",

    email_petani:
      item.email_petani || "-",

    rekomendasi:
      parseJsonSafe(
        item.rekomendasi_json ||
          item.rekomendasi
      ),

    proyeksi:
      parseJsonSafe(
        item.proyeksi_json
      ),
  };
};

/* =====================================================
   MEMBUAT REKOMENDASI FALLBACK

   Digunakan jika FastAPI tidak mengirim rekomendasi.
===================================================== */
const buildRekomendasi = ({
  produktivitas,
  luasHa,
  suhu,
  curahHujan,
  kelembapan,
  statusRisiko,
}) => {
  const list = [];

  if (produktivitas >= 8) {
    list.push(
      "Pertahankan pemupukan sesuai jadwal karena produktivitas tergolong baik."
    );
  } else if (
    produktivitas >= 5
  ) {
    list.push(
      "Optimalkan pemupukan untuk meningkatkan produktivitas lahan."
    );
  } else {
    list.push(
      "Evaluasi pemupukan dan kondisi pertumbuhan tanaman karena produktivitas masih rendah."
    );
  }

  if (
    luasHa > 0 &&
    luasHa < 0.2
  ) {
    list.push(
      "Gunakan pemupukan presisi karena ukuran lahan relatif kecil."
    );
  }

  if (
    toNumber(curahHujan) > 50
  ) {
    list.push(
      "Perhatikan drainase lahan karena curah hujan cukup tinggi."
    );
  }

  if (
    toNumber(kelembapan) > 85
  ) {
    list.push(
      "Pantau risiko jamur atau penyakit karena kelembapan tinggi."
    );
  }

  if (
    toNumber(suhu) > 33
  ) {
    list.push(
      "Lakukan pengairan tambahan jika tanaman menunjukkan gejala layu."
    );
  }

  if (
    statusRisiko === "WASPADA" ||
    statusRisiko === "KRITIS"
  ) {
    list.push(
      "Lakukan pemantauan berkala dan konsultasikan kondisi lahan dengan penyuluh."
    );
  }

  if (list.length === 0) {
    list.push(
      "Lakukan pemantauan kondisi tanaman secara berkala."
    );
  }

  return list.slice(0, 5);
};

/* =====================================================
   MEMBUAT DATA PROYEKSI

   Digunakan jika FastAPI tidak mengirim proyeksi.
===================================================== */
const buildProyeksi = ({
  prediksiTon,
  rataRiwayatTon,
  targetAktifTon,
  sumberTarget,
  tanggalPrediksi,
}) => {
  const finalTon = toNumber(
    prediksiTon
  );

  const rata = toNumber(
    rataRiwayatTon
  );

  const target = toNumber(
    targetAktifTon
  );

  const startTon =
    finalTon > 0
      ? Math.max(
          finalTon * 0.25,
          0.01
        )
      : 0;

  const baseDate =
    tanggalPrediksi
      ? new Date(
          tanggalPrediksi
        )
      : new Date();

  const rows = [];

  for (
    let index = 0;
    index < 6;
    index += 1
  ) {
    const date = new Date(
      baseDate
    );

    date.setDate(
      date.getDate() +
        index * 7
    );

    const label =
      date.toLocaleDateString(
        "id-ID",
        {
          day: "numeric",
          month: "short",
        }
      );

    const progress =
      index / 5;

    const prediction =
      startTon +
      (finalTon - startTon) *
        Math.pow(
          progress,
          0.9
        );

    rows.push({
      label,

      prediksi:
        toFixedNumber(
          prediction,
          2
        ),

      rataRiwayat:
        toFixedNumber(
          rata,
          2
        ),

      /*
       * targetPetani dipertahankan untuk kompatibilitas
       * dengan frontend lama. Nilainya adalah target aktif.
       */
      targetPetani:
        toFixedNumber(
          target,
          2
        ),

      targetAktif:
        toFixedNumber(
          target,
          2
        ),

      sumberTarget:
        sumberTarget || "SISTEM",
    });
  }

  return rows;
};

const getRataRiwayatSql = `
  SELECT
    AVG(prediksi_ton) AS rata_ton
  FROM prediksi
  WHERE sawah_id = ?
`;

/* =====================================================
   GET DETAIL LAHAN + MONITORING TERBARU
===================================================== */
const getLahanDetail = (
  sawahId,
  callback
) => {
  const sql = `
    SELECT
      l.id,
      l.nama_lahan,
      l.luas_m2,
      l.luas_ha,
      l.varietas,
      l.user_id,
      l.petani_id,
      l.kecamatan_id,
      l.desa_id,
      l.tanggal_tanam,

      k.nama_kecamatan,
      d.nama_desa,

      u.nama AS nama_petani,
      u.email AS email_petani,

      mt.umur_tanam,
      mt.fase_tanam,
      mt.status_kesehatan,
      mt.suhu,
      mt.kelembapan,
      mt.curah_hujan

    FROM lahan l

    LEFT JOIN kecamatan k
      ON k.id = l.kecamatan_id

    LEFT JOIN desa d
      ON d.id = l.desa_id

    LEFT JOIN users u
      ON u.id = COALESCE(
        l.petani_id,
        l.user_id
      )

    LEFT JOIN (
      SELECT m1.*
      FROM monitoring_tanaman m1

      INNER JOIN (
        SELECT
          sawah_id,
          MAX(id) AS max_id
        FROM monitoring_tanaman
        GROUP BY sawah_id
      ) latest_monitoring
        ON latest_monitoring.max_id =
          m1.id
    ) mt
      ON mt.sawah_id = l.id

    WHERE l.id = ?
    LIMIT 1
  `;

  db.query(
    sql,
    [sawahId],
    (error, rows) => {
      if (error) {
        return callback(error);
      }

      return callback(
        null,
        rows?.[0] || null
      );
    }
  );
};

/* =====================================================
   POST /api/prediksi

   HITUNG PREDIKSI + SIMPAN
===================================================== */
exports.prediksiPanen = (
  req,
  res
) => {
  const body = req.body || {};

  const sawahId =
    body.sawah_id ??
    body.lahan_id;

  const tanggalPrediksi =
    body.tanggal_prediksi ||
    null;

  if (
    !sawahId ||
    Number(sawahId) <= 0
  ) {
    return res
      .status(400)
      .json({
        status: false,

        message:
          "sawah_id atau lahan_id wajib diisi",
      });
  }

  const predictionDateObject =
    tanggalPrediksi
      ? new Date(
          `${tanggalPrediksi}T00:00:00`
        )
      : new Date();

  if (
    Number.isNaN(
      predictionDateObject.getTime()
    )
  ) {
    return res
      .status(400)
      .json({
        status: false,

        message:
          "tanggal_prediksi tidak valid",
      });
  }

  const rawTargetPetani =
    body.target_petani_ton;

  if (
    isDefined(rawTargetPetani) &&
    (
      !Number.isFinite(
        Number(rawTargetPetani)
      ) ||
      Number(rawTargetPetani) <= 0
    )
  ) {
    return res
      .status(400)
      .json({
        status: false,

        message:
          "target_petani_ton harus berupa angka lebih besar dari 0 atau dikosongkan.",
      });
  }

  getLahanDetail(
    Number(sawahId),

    (
      lahanError,
      lahan
    ) => {
      if (lahanError) {
        return res
          .status(500)
          .json({
            status: false,

            message:
              "Gagal mengambil data lahan",

            error:
              lahanError.message,
          });
      }

      if (!lahan) {
        return res
          .status(404)
          .json({
            status: false,

            message:
              "Lahan tidak ditemukan",
          });
      }

      const luasHa =
        getLuasHa(lahan);

      if (luasHa <= 0) {
        return res
          .status(422)
          .json({
            status: false,

            message:
              "Luas lahan belum valid. Isi luas_ha atau luas_m2 terlebih dahulu.",
          });
      }

      db.query(
        getRataRiwayatSql,

        [Number(sawahId)],

        async (
          averageError,
          averageRows
        ) => {
          if (
            averageError
          ) {
            return res
              .status(500)
              .json({
                status:
                  false,

                message:
                  "Gagal mengambil rata-rata riwayat",

                error:
                  averageError.message,
              });
          }

          try {
            const tahun =
              predictionDateObject.getFullYear();

            let aiResponse;

            /*
             * Hanya ada satu pemanggilan POST.
             * Alamat akhirnya selalu:
             * http://127.0.0.1:8000/prediksi
             */
            try {
              console.log(
                "Memanggil FastAPI:",
                FASTAPI_PREDIKSI_URL
              );

              aiResponse =
                await axios.post(
                  FASTAPI_PREDIKSI_URL,

                  {
                    lahan_id:
                      Number(
                        lahan.id
                      ),

                    tahun:
                      Number(
                        tahun
                      ),
                  },

                  {
                    timeout:
                      15000,

                    headers: {
                      "Content-Type":
                        "application/json",
                    },
                  }
                );

              console.log(
                "Respons FastAPI berhasil:",
                aiResponse.data
              );
            } catch (
              fastApiError
            ) {
              console.error(
                "FASTAPI ERROR:",
                fastApiError
                  .response
                  ?.status,

                fastApiError
                  .response
                  ?.data ||
                  fastApiError.message
              );

              return res
                .status(503)
                .json({
                  status:
                    false,

                  message:
                    fastApiError
                      .response
                      ?.status ===
                    405
                      ? `Endpoint FastAPI salah. Controller harus mengakses ${FASTAPI_PREDIKSI_URL}`
                      : "Layanan model Random Forest tidak dapat dihubungi. Pastikan FastAPI aktif.",

                  error:
                    fastApiError
                      .response
                      ?.data ||
                    fastApiError.message,
                });
            }

            /*
             * FastAPI mengirim beberapa nilai
             * di dalam properti data.
             * Nilai top-level dan nested digabung.
             */
            const responseBody =
              aiResponse?.data ||
              {};

            const nestedData =
              responseBody.data &&
              typeof responseBody.data ===
                "object"
                ? responseBody.data
                : {};

            const aiData = {
              ...responseBody,
              ...nestedData,
            };

            const rawPrediksiTon =
              pickDefined(
                aiData.prediksi_ton,
                aiData.prediksi,
                aiData.hasil_panen
              );

            const prediksiTonNumber =
              toNullableNumber(
                rawPrediksiTon
              );

            /*
             * Tidak memakai fallback
             * luasHa * 9.6.
             * Hasil harus benar-benar
             * berasal dari FastAPI.
             */
            if (
              prediksiTonNumber ===
                null ||
              prediksiTonNumber < 0
            ) {
              return res
                .status(502)
                .json({
                  status:
                    false,

                  message:
                    "FastAPI berhasil dipanggil, tetapi tidak mengembalikan prediksi_ton yang valid.",

                  data_fastapi:
                    responseBody,
                });
            }

            const prediksiTon =
              toFixedNumber(
                prediksiTonNumber,
                2
              );

            const prediksiKg =
              toFixedNumber(
                pickDefined(
                  aiData.prediksi_kg,

                  prediksiTon *
                    1000
                ),

                0
              );

            const produktivitas =
              toFixedNumber(
                prediksiTon /
                  luasHa,

                2
              );

            /*
             * Random Forest Regression
             * tidak otomatis menghasilkan
             * probabilitas confidence.
             *
             * Nilai menjadi null jika
             * FastAPI tidak menghitungnya.
             */
            const confidence =
              normalizeConfidence(
                pickDefined(
                  aiData.confidence,
                  aiData.akurasi
                )
              );

            const aiWeather =
              aiData.cuaca &&
              typeof aiData.cuaca ===
                "object"
                ? aiData.cuaca
                : {};

            const suhu =
              toFixedNumber(
                pickDefined(
                  aiData.suhu,
                  aiWeather.suhu,
                  lahan.suhu,
                  body.suhu,
                  27.6
                ),

                2
              );

            const curahHujan =
              toFixedNumber(
                pickDefined(
                  aiData.curah_hujan,

                  aiWeather.curah_hujan,

                  aiWeather
                    .curah_hujan_24_jam,

                  lahan.curah_hujan,

                  body.curah_hujan,

                  0
                ),

                2
              );

            const kelembapan =
              toFixedNumber(
                pickDefined(
                  aiData.kelembapan,

                  aiWeather.kelembapan,

                  lahan.kelembapan,

                  body.kelembapan,

                  71
                ),

                2
              );

            const riskScore =
              toFixedNumber(
                pickDefined(
                  aiData.risk_score,

                  aiData.skor_risiko,

                  0
                ),

                2
              );

            const statusRisiko =
              pickDefined(
                aiData.status_risiko,

                aiData.status
              ) ||
              getStatusRisiko(
                riskScore
              );

            const modelAi =
              pickDefined(
                aiData.model_ai,

                aiData.model,

                body.model_ai
              ) ||
              "Random Forest Regressor";

            const rataRiwayatTon =
              toNumber(
                pickDefined(
                  averageRows?.[0]
                    ?.rata_ton,

                  prediksiTon
                ),

                prediksiTon
              );

            /*
             * Target Petani hanya berasal dari input pengguna.
             * FastAPI tidak menetapkan Target Petani.
             *
             * Jika petani tidak mengisi target, sistem memakai
             * Target Sistem sebagai target aktif.
             */
            const targetMetrics =
              buildTargetMetrics({
                prediksiTon,

                targetPetaniTon:
                  isDefined(
                    rawTargetPetani
                  )
                    ? rawTargetPetani
                    : null,

                targetSistemTon:
                  null,

                sumberTarget:
                  isDefined(
                    rawTargetPetani
                  )
                    ? "PETANI"
                    : "SISTEM",

                persentaseTargetSistem:
                  TARGET_SYSTEM_PERCENT,
              });

            const {
              targetPetaniTon,
              targetSistemTon,
              targetAktifTon,
              sumberTarget,
              persentaseTargetSistem,
              selisihTargetTon,
              statusTarget,
            } = targetMetrics;

            const baseTanggalPrediksi =
              tanggalPrediksi ||
              predictionDateObject
                .toISOString()
                .slice(0, 10);

            const estimasiPanen =
              toSqlDate(
                pickDefined(
                  aiData
                    .estimasi_panen,

                  aiData
                    .tanggal_panen,

                  addDays(
                    lahan
                      .tanggal_tanam ||
                      baseTanggalPrediksi,

                    99
                  )
                )
              );

            const rekomendasiAi =
              parseJsonSafe(
                pickDefined(
                  aiData
                    .rekomendasi_json,

                  aiData
                    .rekomendasi
                )
              );

            const rekomendasiList =
              rekomendasiAi.length >
              0
                ? rekomendasiAi
                : buildRekomendasi(
                    {
                      produktivitas,

                      luasHa,

                      suhu,

                      curahHujan,

                      kelembapan,

                      statusRisiko,
                    }
                  );

            const proyeksiAi =
              parseJsonSafe(
                pickDefined(
                  aiData
                    .proyeksi_json,

                  aiData.proyeksi
                )
              );

            const proyeksiList =
              proyeksiAi.length > 0
                ? proyeksiAi
                : buildProyeksi(
                    {
                      prediksiTon,

                      rataRiwayatTon,

                      targetAktifTon,

                      sumberTarget,

                      tanggalPrediksi:
                        baseTanggalPrediksi,
                    }
                  );

            const periode =
              String(tahun);

            const varietas =
              pickDefined(
                lahan.varietas,

                aiData.varietas,

                "-"
              );

            const insertSql = `
              INSERT INTO prediksi
              (
                sawah_id,
                prediksi_ton,
                prediksi_kg,
                produktivitas,
                confidence,
                estimasi_panen,
                suhu,
                curah_hujan,
                kelembapan,
                risk_score,
                status_risiko,
                rekomendasi,
                periode,
                varietas,
                model_ai,
                target_petani_ton,
                target_sistem_ton,
                sumber_target,
                persentase_target_sistem,
                proyeksi_json,
                rekomendasi_json,
                created_at
              )
              VALUES
              (
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?,
                NOW()
              )
            `;

            const insertParams =
              [
                lahan.id,

                prediksiTon,

                prediksiKg,

                produktivitas,

                confidence,

                estimasiPanen,

                suhu,

                curahHujan,

                kelembapan,

                riskScore,

                statusRisiko,

                safeJson(
                  rekomendasiList
                ),

                periode,

                varietas,

                modelAi,

                targetPetaniTon,

                targetSistemTon,

                sumberTarget,

                persentaseTargetSistem,

                safeJson(
                  proyeksiList
                ),

                safeJson(
                  rekomendasiList
                ),
              ];

            db.query(
              insertSql,

              insertParams,

              (
                saveError,
                saveResult
              ) => {
                if (
                  saveError
                ) {
                  return res
                    .status(500)
                    .json({
                      status:
                        false,

                      message:
                        "Gagal menyimpan hasil prediksi",

                      error:
                        saveError.message,
                    });
                }

                return res.json({
                  status:
                    true,

                  message:
                    "Prediksi berhasil",

                  data: {
                    id:
                      saveResult.insertId,

                    sawah_id:
                      lahan.id,

                    lahan_id:
                      lahan.id,

                    nama_lahan:
                      lahan.nama_lahan,

                    nama_petani:
                      lahan.nama_petani ||
                      "-",

                    email_petani:
                      lahan.email_petani ||
                      "-",

                    nama_kecamatan:
                      lahan.nama_kecamatan,

                    nama_desa:
                      lahan.nama_desa,

                    luas_m2:
                      lahan.luas_m2,

                    luas_ha:
                      luasHa,

                    varietas,

                    prediksi_ton:
                      prediksiTon,

                    prediksi_kg:
                      prediksiKg,

                    produktivitas,

                    /*
                     * Null jika FastAPI
                     * tidak menghitung
                     * confidence.
                     */
                    confidence,

                    /*
                     * Metrik evaluasi
                     * keseluruhan model.
                     */
                    model_mape:
                      MODEL_METRICS.mape,

                    model_r2:
                      MODEL_METRICS.r2,

                    model_kedekatan_sederhana:
                      MODEL_METRICS
                        .kedekatanSederhana,

                    estimasi_panen:
                      estimasiPanen,

                    suhu,

                    curah_hujan:
                      curahHujan,

                    kelembapan,

                    cuaca: {
                      ...aiWeather,

                      suhu,

                      curah_hujan:
                        curahHujan,

                      kelembapan,
                    },

                    risk_score:
                      riskScore,

                    status_risiko:
                      statusRisiko,

                    rekomendasi:
                      rekomendasiList,

                    rekomendasi_json:
                      safeJson(
                        rekomendasiList
                      ),

                    proyeksi:
                      proyeksiList,

                    proyeksi_json:
                      safeJson(
                        proyeksiList
                      ),

                    model_ai:
                      modelAi,

                    sumber_prediksi:
                      "FastAPI Random Forest",

                    target_petani_ton:
                      targetPetaniTon,

                    target_sistem_ton:
                      targetSistemTon,

                    target_aktif_ton:
                      targetAktifTon,

                    sumber_target:
                      sumberTarget,

                    persentase_target_sistem:
                      persentaseTargetSistem,

                    selisih_target_ton:
                      selisihTargetTon,

                    status_target:
                      statusTarget,

                    periode,

                    created_at:
                      new Date()
                        .toISOString(),
                  },
                });
              }
            );
          } catch (error) {
            console.error(
              "PREDIKSI CONTROLLER ERROR:",
              error
            );

            return res
              .status(500)
              .json({
                status:
                  false,

                message:
                  "Gagal memproses prediksi",

                error:
                  error.message,
              });
          }
        }
      );
    }
  );
};

/* =====================================================
   GET /api/prediksi

   RIWAYAT SEMUA PREDIKSI
===================================================== */
exports.getPrediksi = (
  req,
  res
) => {
  const {
    petani_id,
    user_id,
    latest,
  } = req.query || {};

  const filterUserId =
    petani_id || user_id;

  const latestJoin =
    latest === "1" ||
    latest === "true"
      ? `
        INNER JOIN
        (
          SELECT
            sawah_id,
            MAX(id) AS max_id
          FROM prediksi
          GROUP BY sawah_id
        ) latest_prediksi
          ON latest_prediksi.max_id =
            p.id
      `
      : "";

  let sql = `
    SELECT
      p.id,
      p.sawah_id,
      p.sawah_id AS lahan_id,
      p.prediksi_ton,
      p.prediksi_kg,
      p.produktivitas,
      p.confidence,
      p.estimasi_panen,
      p.suhu,
      p.curah_hujan,
      p.kelembapan,
      p.risk_score,
      p.status_risiko,
      p.rekomendasi,
      p.periode,
      p.varietas AS varietas_prediksi,
      p.model_ai,
      p.target_petani_ton,
      p.target_sistem_ton,
      p.sumber_target,
      p.persentase_target_sistem,
      p.proyeksi_json,
      p.rekomendasi_json,
      p.created_at,

      l.nama_lahan,
      l.varietas,
      l.luas_m2,
      l.luas_ha,
      l.user_id,
      l.petani_id,
      l.tanggal_tanam,

      d.nama_desa,
      k.nama_kecamatan,

      u.nama AS nama_petani,
      u.email AS email_petani

    FROM prediksi p

    ${latestJoin}

    LEFT JOIN lahan l
      ON l.id = p.sawah_id

    LEFT JOIN desa d
      ON d.id = l.desa_id

    LEFT JOIN kecamatan k
      ON k.id = l.kecamatan_id

    LEFT JOIN users u
      ON u.id = COALESCE(
        l.petani_id,
        l.user_id
      )
  `;

  const params = [];

  if (filterUserId) {
    sql += `
      WHERE
      (
        l.user_id = ?
        OR l.petani_id = ?
      )
    `;

    params.push(
      filterUserId,
      filterUserId
    );
  }

  sql += `
    ORDER BY
      p.created_at DESC,
      p.id DESC
  `;

  db.query(
    sql,
    params,

    (error, rows) => {
      if (error) {
        return res
          .status(500)
          .json({
            status: false,

            message:
              "Gagal mengambil prediksi",

            error:
              error.message,
          });
      }

      return res.json({
        status: true,

        message:
          "Prediksi berhasil diambil",

        data:
          (rows || []).map(
            enrichPredictionRow
          ),
      });
    }
  );
};

/* =====================================================
   GET /api/prediksi/riwayat

   RIWAYAT TERBARU PER LAHAN
===================================================== */
exports.getRiwayatPanen = (
  req,
  res
) => {
  const {
    petani_id,
    user_id,
  } = req.query || {};

  const filterUserId =
    petani_id || user_id;

  let sql = `
    SELECT
      p.id,
      p.sawah_id,
      p.sawah_id AS lahan_id,
      p.prediksi_ton,
      p.prediksi_kg,
      p.produktivitas,
      p.confidence,
      p.estimasi_panen,
      p.suhu,
      p.curah_hujan,
      p.kelembapan,
      p.risk_score,
      p.status_risiko,
      p.rekomendasi,
      p.periode,
      p.varietas AS varietas_prediksi,
      p.model_ai,
      p.target_petani_ton,
      p.target_sistem_ton,
      p.sumber_target,
      p.persentase_target_sistem,
      p.proyeksi_json,
      p.rekomendasi_json,
      p.created_at,

      l.nama_lahan,
      l.varietas,
      l.luas_m2,
      l.luas_ha,
      l.user_id,
      l.petani_id,
      l.tanggal_tanam,

      d.nama_desa,
      k.nama_kecamatan,

      u.nama AS nama_petani,
      u.email AS email_petani

    FROM prediksi p

    INNER JOIN
    (
      SELECT
        sawah_id,
        MAX(id) AS max_id
      FROM prediksi
      GROUP BY sawah_id
    ) latest_prediksi
      ON latest_prediksi.max_id =
        p.id

    LEFT JOIN lahan l
      ON l.id = p.sawah_id

    LEFT JOIN desa d
      ON d.id = l.desa_id

    LEFT JOIN kecamatan k
      ON k.id = l.kecamatan_id

    LEFT JOIN users u
      ON u.id = COALESCE(
        l.petani_id,
        l.user_id
      )
  `;

  const params = [];

  if (filterUserId) {
    sql += `
      WHERE
      (
        l.user_id = ?
        OR l.petani_id = ?
      )
    `;

    params.push(
      filterUserId,
      filterUserId
    );
  }

  sql += `
    ORDER BY p.id DESC
  `;

  db.query(
    sql,
    params,

    (error, rows) => {
      if (error) {
        return res
          .status(500)
          .json({
            status:
              false,

            message:
              "Gagal mengambil riwayat",

            error:
              error.message,
          });
      }

      return res.json({
        status: true,

        message:
          "Riwayat prediksi berhasil diambil",

        data:
          (rows || []).map(
            enrichPredictionRow
          ),
      });
    }
  );
};

/* =====================================================
   GET /api/prediksi/:id
===================================================== */
exports.getPrediksiById = (
  req,
  res
) => {
  const { id } = req.params;

  if (
    !id ||
    Number(id) <= 0
  ) {
    return res
      .status(400)
      .json({
        status: false,

        message:
          "ID prediksi tidak valid",
      });
  }

  const sql = `
    SELECT
      p.*,
      p.sawah_id AS lahan_id,

      l.nama_lahan,
      l.varietas,
      l.luas_m2,
      l.luas_ha,
      l.user_id,
      l.petani_id,
      l.tanggal_tanam,

      d.nama_desa,
      k.nama_kecamatan,

      u.nama AS nama_petani,
      u.email AS email_petani

    FROM prediksi p

    LEFT JOIN lahan l
      ON l.id = p.sawah_id

    LEFT JOIN desa d
      ON d.id = l.desa_id

    LEFT JOIN kecamatan k
      ON k.id = l.kecamatan_id

    LEFT JOIN users u
      ON u.id = COALESCE(
        l.petani_id,
        l.user_id
      )

    WHERE p.id = ?
    LIMIT 1
  `;

  db.query(
    sql,

    [Number(id)],

    (error, rows) => {
      if (error) {
        return res
          .status(500)
          .json({
            status:
              false,

            message:
              "Gagal mengambil detail prediksi",

            error:
              error.message,
          });
      }

      if (
        !rows ||
        rows.length === 0
      ) {
        return res
          .status(404)
          .json({
            status:
              false,

            message:
              "Prediksi tidak ditemukan",
          });
      }

      return res.json({
        status: true,

        message:
          "Detail prediksi berhasil diambil",

        data:
          enrichPredictionRow(
            rows[0]
          ),
      });
    }
  );
};

/* =====================================================
   PUT /api/prediksi/:id
===================================================== */
exports.updatePrediksi = (
  req,
  res
) => {
  const { id } = req.params;
  const body = req.body || {};

  if (
    !id ||
    Number(id) <= 0
  ) {
    return res
      .status(400)
      .json({
        status: false,

        message:
          "ID prediksi tidak valid",
      });
  }

  const rekomendasiList =
    Array.isArray(
      body.rekomendasi
    )
      ? body.rekomendasi
      : parseJsonSafe(
          body.rekomendasi ||
            body.rekomendasi_json
        );

  const proyeksiList =
    Array.isArray(
      body.proyeksi
    )
      ? body.proyeksi
      : parseJsonSafe(
          body.proyeksi ||
            body.proyeksi_json
        );

  /*
   * Data lama dibaca terlebih dahulu agar perubahan target
   * tetap konsisten, termasuk ketika Target Petani dihapus.
   */
  db.query(
    `
      SELECT
        prediksi_ton,
        target_petani_ton,
        target_sistem_ton,
        sumber_target,
        persentase_target_sistem
      FROM prediksi
      WHERE id = ?
      LIMIT 1
    `,

    [Number(id)],

    (
      readError,
      rows
    ) => {
      if (readError) {
        return res
          .status(500)
          .json({
            status: false,

            message:
              "Gagal membaca data prediksi sebelum pembaruan",

            error:
              readError.message,
          });
      }

      if (
        !rows ||
        rows.length === 0
      ) {
        return res
          .status(404)
          .json({
            status: false,

            message:
              "Prediksi tidak ditemukan",
          });
      }

      const current =
        rows[0];

      const hasTargetPetaniField =
        Object.prototype
          .hasOwnProperty
          .call(
            body,
            "target_petani_ton"
          );

      const rawTargetPetani =
        hasTargetPetaniField
          ? body.target_petani_ton
          : current.target_petani_ton;

      if (
        isDefined(rawTargetPetani) &&
        (
          !Number.isFinite(
            Number(rawTargetPetani)
          ) ||
          Number(rawTargetPetani) <= 0
        )
      ) {
        return res
          .status(400)
          .json({
            status: false,

            message:
              "target_petani_ton harus berupa angka lebih besar dari 0 atau dikosongkan.",
          });
      }

      const prediksiTonBaru =
        isDefined(
          body.prediksi_ton
        )
          ? toFixedNumber(
              body.prediksi_ton,
              2
            )
          : toFixedNumber(
              current.prediksi_ton,
              2
            );

      const persentaseBaru =
        isDefined(
          body
            .persentase_target_sistem
        )
          ? body
              .persentase_target_sistem
          : current
              .persentase_target_sistem;

      if (
        isDefined(persentaseBaru) &&
        (
          !Number.isFinite(
            Number(persentaseBaru)
          ) ||
          Number(persentaseBaru) < 0
        )
      ) {
        return res
          .status(400)
          .json({
            status: false,

            message:
              "persentase_target_sistem harus berupa angka 0 atau lebih.",
          });
      }

      /*
       * Target Sistem selalu dihitung ulang berdasarkan
       * prediksi terbaru dan persentase yang berlaku.
       */
      const targetMetrics =
        buildTargetMetrics({
          prediksiTon:
            prediksiTonBaru,

          targetPetaniTon:
            isDefined(
              rawTargetPetani
            )
              ? rawTargetPetani
              : null,

          targetSistemTon:
            null,

          sumberTarget:
            isDefined(
              rawTargetPetani
            )
              ? "PETANI"
              : "SISTEM",

          persentaseTargetSistem:
            isDefined(
              persentaseBaru
            )
              ? persentaseBaru
              : TARGET_SYSTEM_PERCENT,
        });

      const sql = `
        UPDATE prediksi
        SET
          prediksi_ton =
            COALESCE(
              ?,
              prediksi_ton
            ),

          prediksi_kg =
            COALESCE(
              ?,
              prediksi_kg
            ),

          produktivitas =
            COALESCE(
              ?,
              produktivitas
            ),

          confidence =
            COALESCE(
              ?,
              confidence
            ),

          estimasi_panen =
            COALESCE(
              ?,
              estimasi_panen
            ),

          suhu =
            COALESCE(
              ?,
              suhu
            ),

          curah_hujan =
            COALESCE(
              ?,
              curah_hujan
            ),

          kelembapan =
            COALESCE(
              ?,
              kelembapan
            ),

          risk_score =
            COALESCE(
              ?,
              risk_score
            ),

          status_risiko =
            COALESCE(
              ?,
              status_risiko
            ),

          model_ai =
            COALESCE(
              ?,
              model_ai
            ),

          target_petani_ton = ?,

          target_sistem_ton = ?,

          sumber_target = ?,

          persentase_target_sistem = ?,

          rekomendasi =
            COALESCE(
              ?,
              rekomendasi
            ),

          rekomendasi_json =
            COALESCE(
              ?,
              rekomendasi_json
            ),

          proyeksi_json =
            COALESCE(
              ?,
              proyeksi_json
            )

        WHERE id = ?
      `;

      const params = [
        body.prediksi_ton ??
          null,

        body.prediksi_kg ??
          null,

        body.produktivitas ??
          null,

        body.confidence ??
          null,

        body.estimasi_panen ||
          null,

        body.suhu ??
          null,

        body.curah_hujan ??
          null,

        body.kelembapan ??
          null,

        body.risk_score ??
          null,

        body.status_risiko ||
          null,

        body.model_ai ||
          null,

        targetMetrics
          .targetPetaniTon,

        targetMetrics
          .targetSistemTon,

        targetMetrics
          .sumberTarget,

        targetMetrics
          .persentaseTargetSistem,

        rekomendasiList.length > 0
          ? safeJson(
              rekomendasiList
            )
          : null,

        rekomendasiList.length > 0
          ? safeJson(
              rekomendasiList
            )
          : null,

        proyeksiList.length > 0
          ? safeJson(
              proyeksiList
            )
          : null,

        Number(id),
      ];

      db.query(
        sql,
        params,

        (
          updateError,
          result
        ) => {
          if (updateError) {
            return res
              .status(500)
              .json({
                status: false,

                message:
                  "Gagal memperbarui prediksi",

                error:
                  updateError.message,
              });
          }

          if (
            result.affectedRows ===
            0
          ) {
            return res
              .status(404)
              .json({
                status: false,

                message:
                  "Prediksi tidak ditemukan",
              });
          }

          return res.json({
            status: true,

            message:
              "Prediksi berhasil diperbarui",

            data: {
              id:
                Number(id),

              target_petani_ton:
                targetMetrics
                  .targetPetaniTon,

              target_sistem_ton:
                targetMetrics
                  .targetSistemTon,

              target_aktif_ton:
                targetMetrics
                  .targetAktifTon,

              sumber_target:
                targetMetrics
                  .sumberTarget,

              persentase_target_sistem:
                targetMetrics
                  .persentaseTargetSistem,

              selisih_target_ton:
                targetMetrics
                  .selisihTargetTon,

              status_target:
                targetMetrics
                  .statusTarget,
            },
          });
        }
      );
    }
  );
};

/* =====================================================
   DELETE /api/prediksi/:id
===================================================== */
exports.deletePrediksi = (
  req,
  res
) => {
  const { id } = req.params;

  if (
    !id ||
    Number(id) <= 0
  ) {
    return res
      .status(400)
      .json({
        status: false,

        message:
          "ID prediksi tidak valid",
      });
  }

  db.query(
    `
      DELETE FROM prediksi
      WHERE id = ?
    `,

    [Number(id)],

    (
      error,
      result
    ) => {
      if (error) {
        return res
          .status(500)
          .json({
            status:
              false,

            message:
              "Gagal menghapus prediksi",

            error:
              error.message,
          });
      }

      if (
        result.affectedRows ===
        0
      ) {
        return res
          .status(404)
          .json({
            status:
              false,

            message:
              "Prediksi tidak ditemukan",
          });
      }

      return res.json({
        status: true,

        message:
          "Prediksi berhasil dihapus",
      });
    }
  );
};