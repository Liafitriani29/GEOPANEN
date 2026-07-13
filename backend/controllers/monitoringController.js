const axios = require("axios");
const db = require("../config/db");

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

// =====================================================
// DATABASE HELPER
// =====================================================
function query(sql, params = []) {
  if (db.promise) {
    return db.promise().query(sql, params).then(([rows]) => rows);
  }

  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function safeQuery(sql, params = [], fallback = []) {
  try {
    return await query(sql, params);
  } catch (err) {
    const code = err?.code || "";

    if (
      code === "ER_NO_SUCH_TABLE" ||
      code === "ER_BAD_FIELD_ERROR" ||
      code === "ER_PARSE_ERROR"
    ) {
      console.warn("SAFE QUERY FALLBACK:", err.sqlMessage || err.message);
      return fallback;
    }

    throw err;
  }
}

// =====================================================
// FORMAT & NORMALIZER
// =====================================================
function isFilled(value) {
  return value !== null && value !== undefined && value !== "";
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatDateSql(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getLuasHa(lahan) {
  const luasHa = lahan?.luas_ha ?? lahan?.luasHa;

  if (isFilled(luasHa)) return toNumber(luasHa, 0);

  const luas = toNumber(lahan?.luas_m2 ?? lahan?.luas, 0);

  if (luas > 20) return luas / 10000;

  return luas;
}

function getTanggalTanam(lahan) {
  return (
    lahan?.tanggal_tanam ||
    lahan?.tgl_tanam ||
    lahan?.tanggalTanam ||
    lahan?.tanggal_mulai_tanam ||
    lahan?.tanggal_awal_tanam ||
    lahan?.planting_date ||
    lahan?.day_of_planting ||
    null
  );
}

function hitungUmurDariTanggal(tanggalTanam) {
  if (!tanggalTanam) return null;

  const tanam = new Date(tanggalTanam);
  const sekarang = new Date();

  if (Number.isNaN(tanam.getTime())) return null;

  tanam.setHours(0, 0, 0, 0);
  sekarang.setHours(0, 0, 0, 0);

  const selisihMs = sekarang.getTime() - tanam.getTime();
  const selisihHari = Math.floor(selisihMs / (1000 * 60 * 60 * 24));

  return selisihHari >= 0 ? selisihHari : null;
}

function hitungUmurTanaman(lahan) {
  const umurLangsung =
    lahan?.umur_tanaman ??
    lahan?.umur_tanam ??
    lahan?.umur_hari ??
    lahan?.umur;

  if (isFilled(umurLangsung)) {
    const umurNumber = Number(umurLangsung);

    if (Number.isFinite(umurNumber) && umurNumber >= 0) {
      return umurNumber;
    }
  }

  const umurDariTanggal = hitungUmurDariTanggal(getTanggalTanam(lahan));

  if (umurDariTanggal !== null) return umurDariTanggal;

  return 0;
}

function getNamaDesa(lahan) {
  return lahan?.nama_desa || lahan?.desa || "-";
}

function getNamaKecamatan(lahan) {
  return lahan?.nama_kecamatan || lahan?.kecamatan || "-";
}

function getKondisiCuaca(curahHujan24Jam, curahHujanSaatIni) {
  const hujanSaatIni = toNumber(curahHujanSaatIni, 0);
  const hujan24Jam = toNumber(curahHujan24Jam, 0);

  if (hujanSaatIni > 0) return "Hujan";
  if (hujan24Jam >= 100) return "Basah";
  if (hujan24Jam > 0) return "Berawan";

  return "Cerah";
}

function normalizeFastApiResponse(raw, fallback) {
  const source = raw?.data || raw?.analisis || raw || {};
  const sourceCuaca = source.cuaca || {};
  const fallbackCuaca = fallback.cuaca || {};

  const curahHujan24Jam = toNumber(
    sourceCuaca.curah_hujan_24_jam ??
      sourceCuaca.curah_hujan ??
      source.curah_hujan_24_jam ??
      source.curah_hujan ??
      fallbackCuaca.curah_hujan_24_jam ??
      fallbackCuaca.curah_hujan,
    0
  );

  const curahHujanSaatIni = toNumber(
    sourceCuaca.curah_hujan_saat_ini ??
      source.curah_hujan_saat_ini ??
      fallbackCuaca.curah_hujan_saat_ini,
    0
  );

  return {
    lahan_id: fallback.lahan_id,
    nama_lahan: fallback.nama_lahan,
    umur_tanaman: source.umur_tanaman ?? fallback.umur_tanaman,

    kondisi_tanaman:
      source.kondisi_tanaman || source.kondisi || fallback.kondisi_tanaman,

    risiko_hama: source.risiko_hama || fallback.risiko_hama,

    tingkat_risiko:
      source.tingkat_risiko || source.status_risiko || fallback.tingkat_risiko,

    skor_risiko: source.skor_risiko ?? source.skor ?? fallback.skor_risiko,

    risk_score:
      source.risk_score ??
      source.skor_risiko ??
      source.skor ??
      fallback.risk_score ??
      fallback.skor_risiko,

    status_risiko:
      source.status_risiko || source.tingkat_risiko || fallback.status_risiko,

    prediksi_panen: source.prediksi_panen || fallback.prediksi_panen,
    prediksi_ton: source.prediksi_ton ?? fallback.prediksi_ton ?? null,

    cuaca: {
      suhu: toNumber(sourceCuaca.suhu ?? source.suhu ?? fallbackCuaca.suhu, 28),

      kelembapan: toNumber(
        sourceCuaca.kelembapan ??
          source.kelembapan ??
          fallbackCuaca.kelembapan,
        80
      ),

      // Dipakai frontend dan fuzzy sebagai akumulasi 24 jam
      curah_hujan: curahHujan24Jam,
      curah_hujan_24_jam: curahHujan24Jam,

      // Dipakai frontend untuk kartu "Hujan Saat Ini"
      curah_hujan_saat_ini: curahHujanSaatIni,

      kondisi:
        sourceCuaca.kondisi ||
        fallbackCuaca.kondisi ||
        getKondisiCuaca(curahHujan24Jam, curahHujanSaatIni),

      sumber: sourceCuaca.sumber || fallbackCuaca.sumber || "fastapi",
    },

    pertumbuhan: source.pertumbuhan || fallback.pertumbuhan,

    rekomendasi:
      Array.isArray(source.rekomendasi) && source.rekomendasi.length > 0
        ? source.rekomendasi
        : fallback.rekomendasi,

    detail_fuzzy: source.detail_fuzzy || fallback.detail_fuzzy || null,
  };
}

// =====================================================
// AMBIL DATA LAHAN
// =====================================================
async function getLahanById(lahanId) {
  const sql = `
    SELECT
      l.*,
      k.nama_kecamatan AS nama_kecamatan,
      d.nama_desa AS nama_desa
    FROM lahan l
    LEFT JOIN kecamatan k ON k.id = l.kecamatan_id
    LEFT JOIN desa d ON d.id = l.desa_id
    WHERE l.id = ?
    LIMIT 1
  `;

  const rows = await query(sql, [lahanId]);
  return rows[0] || null;
}

async function getPertumbuhanTerbaru(lahanId) {
  const rows = await safeQuery(
    `
    SELECT
      id,
      lahan_id,
      tanggal,
      tinggi_tanaman_cm,
      jumlah_anakan,
      kelembapan,
      created_at
    FROM monitoring_pertumbuhan
    WHERE lahan_id = ?
    ORDER BY tanggal DESC, id DESC
    LIMIT 1
    `,
    [lahanId],
    []
  );

  return rows[0] || null;
}

async function getLingkunganTerbaru(lahanId) {
  const rows = await safeQuery(
    `
    SELECT
      id,
      lahan_id,
      tanggal,
      suhu,
      kelembapan,
      curah_hujan,
      cuaca,
      created_at
    FROM monitoring_lingkungan
    WHERE lahan_id = ?
    ORDER BY tanggal DESC, id DESC
    LIMIT 1
    `,
    [lahanId],
    []
  );

  return rows[0] || null;
}

// =====================================================
// AUTO GENERATE DATA PERTUMBUHAN
// Dipakai agar grafik tidak kosong untuk lahan baru.
// Catatan: ini estimasi berbasis umur tanaman, bukan data sensor aktual.
// =====================================================
function hitungEstimasiPertumbuhan(hariKe, index) {
  let tinggiTanaman = 0;
  let jumlahAnakan = 0;

  if (hariKe <= 14) {
    tinggiTanaman = 6 + hariKe * 2.2;
    jumlahAnakan = 1 + hariKe * 0.55;
  } else if (hariKe <= 45) {
    tinggiTanaman = 35 + (hariKe - 14) * 1.45;
    jumlahAnakan = 8 + (hariKe - 14) * 0.75;
  } else if (hariKe <= 75) {
    tinggiTanaman = 80 + (hariKe - 45) * 0.55;
    jumlahAnakan = 30 + (hariKe - 45) * 0.25;
  } else {
    tinggiTanaman = 95 + (hariKe - 75) * 0.15;
    jumlahAnakan = 38;
  }

  tinggiTanaman = Math.min(115, Math.max(5, tinggiTanaman));
  jumlahAnakan = Math.min(45, Math.max(1, jumlahAnakan));

  const kelembapan = Math.round(68 + Math.sin(index + 1) * 7);

  return {
    tinggi_tanaman_cm: Number(tinggiTanaman.toFixed(2)),
    jumlah_anakan: Math.round(jumlahAnakan),
    kelembapan: Number(kelembapan.toFixed(2)),
  };
}

async function autoGeneratePertumbuhanIfEmpty(lahanId, lahanFromCaller = null) {
  const existingRows = await safeQuery(
    `
    SELECT id
    FROM monitoring_pertumbuhan
    WHERE lahan_id = ?
    LIMIT 1
    `,
    [lahanId],
    []
  );

  if (existingRows.length > 0) {
    return {
      generated: false,
      reason: "Data pertumbuhan sudah ada",
    };
  }

  const lahan = lahanFromCaller || (await getLahanById(lahanId));

  if (!lahan) {
    return {
      generated: false,
      reason: "Lahan tidak ditemukan",
    };
  }

  const tanggalTanam = getTanggalTanam(lahan);

  if (!tanggalTanam) {
    return {
      generated: false,
      reason: "tanggal_tanam belum tersedia",
    };
  }

  const umurTanaman = hitungUmurTanaman(lahan);

  if (!umurTanaman || umurTanaman <= 0) {
    return {
      generated: false,
      reason: "Umur tanaman belum valid",
    };
  }

  const tanggalAwal = new Date(tanggalTanam);

  if (Number.isNaN(tanggalAwal.getTime())) {
    return {
      generated: false,
      reason: "Format tanggal_tanam tidak valid",
    };
  }

  tanggalAwal.setHours(0, 0, 0, 0);

  const jumlahTitik = Math.min(6, Math.max(2, Math.ceil(umurTanaman / 3)));
  const rows = [];

  for (let i = 0; i < jumlahTitik; i++) {
    const progress = jumlahTitik === 1 ? 1 : i / Math.max(jumlahTitik - 1, 1);

    const hariKe = Math.max(
      1,
      Math.round(1 + progress * Math.max(umurTanaman - 1, 1))
    );

    const tanggal = new Date(tanggalAwal);
    tanggal.setDate(tanggalAwal.getDate() + hariKe - 1);

    const estimasi = hitungEstimasiPertumbuhan(hariKe, i);

    rows.push([
      Number(lahanId),
      formatDateSql(tanggal),
      estimasi.tinggi_tanaman_cm,
      estimasi.jumlah_anakan,
      estimasi.kelembapan,
    ]);
  }

  await query(
    `
    INSERT INTO monitoring_pertumbuhan
    (lahan_id, tanggal, tinggi_tanaman_cm, jumlah_anakan, kelembapan)
    VALUES ?
    `,
    [rows]
  );

  console.log(
    `AUTO PERTUMBUHAN OK: ${rows.length} data dibuat untuk lahan_id ${lahanId}`
  );

  return {
    generated: true,
    reason: `${rows.length} data estimasi dibuat`,
  };
}

// =====================================================
// OPEN-METEO HELPER
// Mengambil hujan saat ini dan total hujan 24 jam.
// =====================================================
async function getOpenMeteoWeather(lat, lng, pertumbuhanTerbaru = null) {
  const response = await axios.get("https://api.open-meteo.com/v1/forecast", {
    params: {
      latitude: lat,
      longitude: lng,
      current: "temperature_2m,relative_humidity_2m,precipitation,rain",
      hourly: "precipitation",
      past_days: 1,
      forecast_days: 1,
      timezone: "Asia/Jakarta",
    },
    timeout: 8000,
  });

  const current = response.data?.current || {};
  const hourly = response.data?.hourly || {};

  const suhu = toNumber(current.temperature_2m, 28);

  const kelembapan = toNumber(
    current.relative_humidity_2m,
    toNumber(pertumbuhanTerbaru?.kelembapan, 80)
  );

  const curahHujanSaatIni =
    toNumber(current.precipitation, 0) + toNumber(current.rain, 0);

  const times = Array.isArray(hourly.time) ? hourly.time : [];
  const precipitation = Array.isArray(hourly.precipitation)
    ? hourly.precipitation
    : [];

  let curahHujan24Jam = 0;

  const currentTime = current.time ? new Date(current.time) : new Date();
  const batasAwal = new Date(currentTime.getTime() - 24 * 60 * 60 * 1000);

  if (times.length > 0 && precipitation.length > 0) {
    times.forEach((time, index) => {
      const waktu = new Date(time);

      if (!Number.isNaN(waktu.getTime()) && waktu >= batasAwal && waktu <= currentTime) {
        curahHujan24Jam += toNumber(precipitation[index], 0);
      }
    });

    // Fallback jika parsing waktu gagal karena format timezone lokal.
    if (curahHujan24Jam === 0) {
      const last24 = precipitation.slice(-24);
      curahHujan24Jam = last24.reduce((total, value) => {
        return total + toNumber(value, 0);
      }, 0);
    }
  }

  curahHujan24Jam = Number(curahHujan24Jam.toFixed(2));

  return {
    suhu,
    kelembapan,

    // Untuk analisis fuzzy
    curah_hujan: curahHujan24Jam,
    curah_hujan_24_jam: curahHujan24Jam,

    // Untuk tampilan realtime
    curah_hujan_saat_ini: Number(curahHujanSaatIni.toFixed(2)),

    kondisi: getKondisiCuaca(curahHujan24Jam, curahHujanSaatIni),
    sumber: "open_meteo",
  };
}

// =====================================================
// AMBIL CUACA DINAMIS
// Prioritas:
// 1. Open-Meteo berdasarkan koordinat lahan untuk hujan 24 jam dan hujan saat ini
// 2. monitoring_lingkungan sebagai fallback jika API cuaca gagal
// 3. fallback aman dari data pertumbuhan atau default
// =====================================================
async function getCuacaDinamis(lahan, pertumbuhanTerbaru, lingkunganTerbaru) {
  const lat = toNumber(lahan?.lat ?? lahan?.latitude, NaN);
  const lng = toNumber(lahan?.lng ?? lahan?.longitude, NaN);

  let cuacaOpenMeteo = null;

  if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
    try {
      cuacaOpenMeteo = await getOpenMeteoWeather(lat, lng, pertumbuhanTerbaru);
    } catch (err) {
      console.warn("OPEN METEO ERROR:", err.message);
    }
  }

  if (lingkunganTerbaru) {
    const suhu = toNumber(
      lingkunganTerbaru.suhu,
      toNumber(cuacaOpenMeteo?.suhu, 28)
    );

    const kelembapan = toNumber(
      lingkunganTerbaru.kelembapan,
      toNumber(
        cuacaOpenMeteo?.kelembapan,
        toNumber(pertumbuhanTerbaru?.kelembapan, 80)
      )
    );

    const curahHujan24Jam = toNumber(
      cuacaOpenMeteo?.curah_hujan_24_jam ??
        cuacaOpenMeteo?.curah_hujan ??
        lingkunganTerbaru.curah_hujan,
      0
    );

    const curahHujanSaatIni = toNumber(
      cuacaOpenMeteo?.curah_hujan_saat_ini,
      0
    );

    return {
      suhu,
      kelembapan,
      curah_hujan: curahHujan24Jam,
      curah_hujan_24_jam: curahHujan24Jam,
      curah_hujan_saat_ini: curahHujanSaatIni,
      kondisi:
        cuacaOpenMeteo?.kondisi ||
        lingkunganTerbaru.cuaca ||
        getKondisiCuaca(curahHujan24Jam, curahHujanSaatIni),
      sumber: cuacaOpenMeteo ? "open_meteo" : "monitoring_lingkungan",
    };
  }

  if (cuacaOpenMeteo) {
    return cuacaOpenMeteo;
  }

  return {
    suhu: 28,
    kelembapan: toNumber(pertumbuhanTerbaru?.kelembapan, 80),
    curah_hujan: 0,
    curah_hujan_24_jam: 0,
    curah_hujan_saat_ini: 0,
    kondisi: "Default",
    sumber: "fallback",
  };
}

// =====================================================
// ANALISIS LOKAL JIKA FASTAPI MATI ATAU SEBAGAI FALLBACK
// =====================================================
function buatAnalisisLokal({ lahan, umurTanaman, cuaca, pertumbuhanTerbaru }) {
  const suhu = toNumber(cuaca.suhu, 28);
  const kelembapan = toNumber(cuaca.kelembapan, 80);
  const curahHujan = toNumber(cuaca.curah_hujan_24_jam ?? cuaca.curah_hujan, 0);
  const curahHujanSaatIni = toNumber(cuaca.curah_hujan_saat_ini, 0);
  const tinggiTanaman = toNumber(pertumbuhanTerbaru?.tinggi_tanaman_cm, 0);
  const jumlahAnakan = toNumber(pertumbuhanTerbaru?.jumlah_anakan, 0);

  let skorRisiko = 0;

  if (kelembapan >= 90) skorRisiko += 30;
  else if (kelembapan >= 75) skorRisiko += 22;
  else if (kelembapan >= 55) skorRisiko += 12;
  else skorRisiko += 18;

  if (curahHujan >= 100) skorRisiko += 30;
  else if (curahHujan >= 50) skorRisiko += 20;
  else if (curahHujan > 0) skorRisiko += 12;
  else skorRisiko += 8;

  if (umurTanaman >= 30 && umurTanaman <= 90) skorRisiko += 18;
  else if (umurTanaman > 90) skorRisiko += 12;
  else skorRisiko += 10;

  if (suhu >= 31) skorRisiko += 18;
  else if (suhu >= 26) skorRisiko += 10;
  else skorRisiko += 14;

  if (tinggiTanaman > 0 && tinggiTanaman < 20 && umurTanaman > 25) {
    skorRisiko += 8;
  }

  skorRisiko = Math.min(100, Number(skorRisiko.toFixed(2)));

  let tingkatRisiko = "Rendah";

  if (skorRisiko >= 70) tingkatRisiko = "Tinggi";
  else if (skorRisiko >= 40) tingkatRisiko = "Sedang";

  const kondisiTanaman =
    tingkatRisiko === "Tinggi"
      ? "Perlu Perhatian"
      : tingkatRisiko === "Sedang"
      ? "Waspada"
      : "Sehat";

  const risikoHama =
    tingkatRisiko === "Tinggi"
      ? "Blast Tinggi"
      : tingkatRisiko === "Sedang"
      ? "Blast Sedang"
      : "Rendah";

  const prediksiPanen =
    tingkatRisiko === "Tinggi"
      ? "Perlu pemantauan intensif"
      : tingkatRisiko === "Sedang"
      ? "Perlu pemantauan lanjutan"
      : "Potensi panen stabil";

  const rekomendasi =
    tingkatRisiko === "Tinggi"
      ? [
          "Kurangi genangan air dan pantau kelembapan lahan secara berkala.",
          "Periksa daun dan batang untuk mendeteksi gejala penyakit sejak awal.",
          "Segera konsultasikan dengan penyuluh jika gejala penyakit meluas.",
        ]
      : tingkatRisiko === "Sedang"
      ? [
          "Pantau kelembapan lahan secara berkala.",
          "Periksa kondisi daun dan batang tanaman.",
          "Pastikan air tidak menggenang terlalu lama.",
          "Lakukan konsultasi dengan penyuluh jika muncul gejala penyakit.",
        ]
      : [
          "Kondisi tanaman relatif aman.",
          "Lanjutkan monitoring pertumbuhan secara berkala.",
          "Pertahankan pengelolaan air dan pemupukan sesuai jadwal.",
        ];

  return {
    lahan_id: Number(lahan.id),
    nama_lahan: lahan.nama_lahan,
    umur_tanaman: umurTanaman,
    kondisi_tanaman: kondisiTanaman,
    risiko_hama: risikoHama,
    tingkat_risiko: tingkatRisiko,
    status_risiko: tingkatRisiko,
    skor_risiko: skorRisiko,
    risk_score: skorRisiko,
    prediksi_panen: prediksiPanen,
    prediksi_ton: null,
    cuaca: {
      suhu,
      kelembapan,
      curah_hujan: curahHujan,
      curah_hujan_24_jam: curahHujan,
      curah_hujan_saat_ini: curahHujanSaatIni,
      kondisi: cuaca.kondisi,
      sumber: cuaca.sumber,
    },
    pertumbuhan: {
      tinggi_tanaman_cm: tinggiTanaman,
      jumlah_anakan: jumlahAnakan,
      kelembapan: toNumber(pertumbuhanTerbaru?.kelembapan, kelembapan),
    },
    rekomendasi,
  };
}

// =====================================================
// ANALISIS MONITORING TANAMAN
// React -> Backend Node.js -> FastAPI Fuzzy Tsukamoto
// Jika FastAPI mati, backend tetap memberi analisis lokal agar UI tidak kosong.
// =====================================================
exports.analisisMonitoring = async (req, res) => {
  const { lahan_id } = req.body;

  if (!lahan_id) {
    return res.status(400).json({
      message: "lahan_id wajib diisi",
    });
  }

  try {
    const lahan = await getLahanById(lahan_id);

    if (!lahan) {
      return res.status(404).json({
        message: "Lahan tidak ditemukan",
      });
    }

    await autoGeneratePertumbuhanIfEmpty(lahan_id, lahan);

    const pertumbuhanTerbaru = await getPertumbuhanTerbaru(lahan_id);
    const lingkunganTerbaru = await getLingkunganTerbaru(lahan_id);

    const cuaca = await getCuacaDinamis(
      lahan,
      pertumbuhanTerbaru,
      lingkunganTerbaru
    );

    const umurTanaman = hitungUmurTanaman(lahan);
    const luasHa = getLuasHa(lahan);

    const curahHujan24Jam = toNumber(
      cuaca.curah_hujan_24_jam ?? cuaca.curah_hujan,
      0
    );

    const curahHujanSaatIni = toNumber(cuaca.curah_hujan_saat_ini, 0);

    const payload = {
      lahan_id: Number(lahan.id),
      nama_lahan: lahan.nama_lahan || "Lahan",
      desa: getNamaDesa(lahan),
      kecamatan: getNamaKecamatan(lahan),
      suhu: toNumber(cuaca.suhu, 28),
      kelembapan: toNumber(cuaca.kelembapan, 80),

      // FastAPI fuzzy memakai curah hujan 24 jam
      curah_hujan: curahHujan24Jam,

      umur_tanaman: toNumber(umurTanaman, 0),
      luas_ha: luasHa,
      varietas: lahan.varietas || lahan.nama_varietas || "-",
      tinggi_tanaman_cm: toNumber(pertumbuhanTerbaru?.tinggi_tanaman_cm, 0),
      jumlah_anakan: toNumber(pertumbuhanTerbaru?.jumlah_anakan, 0),
    };

    const fallbackAnalisis = buatAnalisisLokal({
      lahan,
      umurTanaman,
      cuaca,
      pertumbuhanTerbaru,
    });

    let analisis = fallbackAnalisis;
    let sumberAnalisis = "local_fallback";

    try {
      const fastapiRes = await axios.post(
        `${FASTAPI_URL}/monitoring/risiko`,
        payload,
        {
          timeout: 15000,
        }
      );

      analisis = normalizeFastApiResponse(fastapiRes.data, fallbackAnalisis);
      sumberAnalisis = "fastapi";
    } catch (fastapiErr) {
      console.warn(
        "FASTAPI MONITORING ERROR, PAKAI ANALISIS LOKAL:",
        fastapiErr.response?.data || fastapiErr.message
      );
    }

    // Pastikan response ke React selalu membawa 3 field hujan.
    analisis = {
      ...analisis,
      cuaca: {
        ...(analisis.cuaca || {}),
        suhu: toNumber(analisis.cuaca?.suhu ?? cuaca.suhu, 28),
        kelembapan: toNumber(
          analisis.cuaca?.kelembapan ?? cuaca.kelembapan,
          80
        ),
        curah_hujan: toNumber(
          analisis.cuaca?.curah_hujan_24_jam ??
            analisis.cuaca?.curah_hujan ??
            curahHujan24Jam,
          0
        ),
        curah_hujan_24_jam: toNumber(
          analisis.cuaca?.curah_hujan_24_jam ??
            analisis.cuaca?.curah_hujan ??
            curahHujan24Jam,
          0
        ),
        curah_hujan_saat_ini: toNumber(
          analisis.cuaca?.curah_hujan_saat_ini ?? curahHujanSaatIni,
          0
        ),
        kondisi:
          analisis.cuaca?.kondisi ||
          getKondisiCuaca(curahHujan24Jam, curahHujanSaatIni),
        sumber: analisis.cuaca?.sumber || sumberAnalisis,
      },
    };

    return res.status(200).json({
      message: "success",
      data: {
        lahan: {
          ...lahan,
          luas_ha: luasHa,
          umur_tanaman: umurTanaman,
          tanggal_tanam: getTanggalTanam(lahan),
        },
        input_fuzzy: payload,
        analisis,
        sumber_analisis: sumberAnalisis,
      },
    });
  } catch (err) {
    console.error("ERROR ANALISIS MONITORING:", err);

    return res.status(500).json({
      message: "Gagal menjalankan analisis monitoring",
      error: err.sqlMessage || err.message,
    });
  }
};

// =====================================================
// GET DATA PERTUMBUHAN TANAMAN
// Jika belum ada data, sistem otomatis membuat data estimasi.
// =====================================================
exports.getPertumbuhan = async (req, res) => {
  const { lahan_id } = req.query;

  if (!lahan_id) {
    return res.status(400).json({
      message: "lahan_id wajib diisi",
      data: [],
    });
  }

  try {
    const autoGenerate = await autoGeneratePertumbuhanIfEmpty(lahan_id);

    const rows = await query(
      `
      SELECT
        id,
        lahan_id,
        tanggal,
        DATE_FORMAT(tanggal, '%d %b') AS label,
        DATE_FORMAT(tanggal, '%d %b') AS tanggal_label,
        tinggi_tanaman_cm,
        tinggi_tanaman_cm AS tinggi,
        jumlah_anakan,
        jumlah_anakan AS anakan,
        kelembapan,
        kelembapan AS lembap,
        created_at
      FROM monitoring_pertumbuhan
      WHERE lahan_id = ?
      ORDER BY tanggal ASC, id ASC
      `,
      [lahan_id]
    );

    return res.status(200).json({
      message: "success",
      auto_generate: autoGenerate,
      data: rows || [],
    });
  } catch (err) {
    console.error("ERROR GET PERTUMBUHAN:", err);

    return res.status(500).json({
      message: "Gagal mengambil data pertumbuhan",
      error: err.sqlMessage || err.message,
      data: [],
    });
  }
};

// =====================================================
// GET DATA LINGKUNGAN TERBARU
// Dipakai frontend agar suhu, kelembapan, dan curah hujan tidak hardcode.
// =====================================================
exports.getLingkungan = async (req, res) => {
  const { lahan_id } = req.query;

  if (!lahan_id) {
    return res.status(400).json({
      message: "lahan_id wajib diisi",
      data: null,
    });
  }

  try {
    const lahan = await getLahanById(lahan_id);

    if (!lahan) {
      return res.status(404).json({
        message: "Lahan tidak ditemukan",
        data: null,
      });
    }

    await autoGeneratePertumbuhanIfEmpty(lahan_id, lahan);

    const pertumbuhanTerbaru = await getPertumbuhanTerbaru(lahan_id);
    const lingkunganTerbaru = await getLingkunganTerbaru(lahan_id);

    const cuaca = await getCuacaDinamis(
      lahan,
      pertumbuhanTerbaru,
      lingkunganTerbaru
    );

    const umurTanaman = hitungUmurTanaman(lahan);

    const curahHujan24Jam = toNumber(
      cuaca.curah_hujan_24_jam ?? cuaca.curah_hujan,
      0
    );

    const curahHujanSaatIni = toNumber(cuaca.curah_hujan_saat_ini, 0);

    return res.status(200).json({
      message: "success",
      data: {
        lahan_id: Number(lahan_id),
        umur_tanaman: umurTanaman,
        suhu: toNumber(cuaca.suhu, 28),
        kelembapan: toNumber(cuaca.kelembapan, 80),

        // Data utama untuk analisis
        curah_hujan: curahHujan24Jam,
        curah_hujan_24_jam: curahHujan24Jam,

        // Data realtime untuk tampilan
        curah_hujan_saat_ini: curahHujanSaatIni,

        cuaca: cuaca.kondisi,
        sumber: cuaca.sumber,
        pertumbuhan_terbaru: pertumbuhanTerbaru,
      },
    });
  } catch (err) {
    console.error("ERROR GET LINGKUNGAN:", err);

    return res.status(500).json({
      message: "Gagal mengambil data lingkungan",
      error: err.sqlMessage || err.message,
      data: null,
    });
  }
};

// =====================================================
// GET RIWAYAT AKTIVITAS LAHAN
// =====================================================
exports.getAktivitas = async (req, res) => {
  const { lahan_id } = req.query;

  if (!lahan_id) {
    return res.status(400).json({
      message: "lahan_id wajib diisi",
      data: [],
    });
  }

  try {
    const rows = await query(
      `
      SELECT
        id,
        lahan_id,
        jenis_aktivitas,
        keterangan,
        tanggal,
        DATE_FORMAT(tanggal, '%d %b %Y') AS tanggal_label,
        created_at
      FROM aktivitas_lahan
      WHERE lahan_id = ?
      ORDER BY tanggal DESC, id DESC
      LIMIT 20
      `,
      [lahan_id]
    );

    return res.status(200).json({
      message: "success",
      data: rows || [],
    });
  } catch (err) {
    return res.status(500).json({
      message: "Gagal mengambil data aktivitas lahan",
      error: err.sqlMessage || err.message,
      data: [],
    });
  }
};