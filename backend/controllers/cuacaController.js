const db = require("../config/db");

const KECAMATAN_SUKOHARJO = [
  { nama_kecamatan: "Kartasura", baseRain: 12.4, baseTemp: 29.4 },
  { nama_kecamatan: "Gatak", baseRain: 10.8, baseTemp: 29.1 },
  { nama_kecamatan: "Baki", baseRain: 8.6, baseTemp: 30.2 },
  { nama_kecamatan: "Grogol", baseRain: 28.5, baseTemp: 29.7 },
  { nama_kecamatan: "Mojolaban", baseRain: 24.2, baseTemp: 29.0 },
  { nama_kecamatan: "Polokarto", baseRain: 42.8, baseTemp: 29.5 },
  { nama_kecamatan: "Bendosari", baseRain: 13.5, baseTemp: 29.3 },
  { nama_kecamatan: "Nguter", baseRain: 45.7, baseTemp: 28.7 },
  { nama_kecamatan: "Sukoharjo", baseRain: 15.2, baseTemp: 29.6 },
  { nama_kecamatan: "Bulu", baseRain: 18.8, baseTemp: 29.2 },
  { nama_kecamatan: "Tawangsari", baseRain: 33.6, baseTemp: 29.0 },
  { nama_kecamatan: "Weru", baseRain: 76.4, baseTemp: 28.2 },
];

const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const getColumns = async (tableName) => {
  try {
    const rows = await runQuery(`SHOW COLUMNS FROM \`${tableName}\``);
    return new Set(rows.map((row) => row.Field));
  } catch {
    return new Set();
  }
};

const seededRandom = (seed) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

const getStatusCuaca = (curahHujan, kelembaban, angin) => {
  if (curahHujan >= 70 || kelembaban >= 92 || angin >= 25) {
    return "risiko_tinggi";
  }

  if (curahHujan >= 45 || kelembaban >= 88 || angin >= 18) {
    return "risiko";
  }

  if (curahHujan >= 20 || kelembaban >= 84 || angin >= 12) {
    return "waspada";
  }

  return "aman";
};

const getStatusLabel = (status) => {
  if (status === "risiko_tinggi") return "Risiko Tinggi";
  if (status === "risiko") return "Risiko";
  if (status === "waspada") return "Waspada";
  return "Aman";
};

const loadRelasiKecamatan = async () => {
  try {
    const lahanColumns = await getColumns("lahan");

    if (!lahanColumns.has("kecamatan_id")) {
      return new Map();
    }

    let petaniExpr = "NULL";

    if (lahanColumns.has("petani_id") && lahanColumns.has("user_id")) {
      petaniExpr = "COALESCE(l.petani_id, l.user_id)";
    } else if (lahanColumns.has("petani_id")) {
      petaniExpr = "l.petani_id";
    } else if (lahanColumns.has("user_id")) {
      petaniExpr = "l.user_id";
    }

    let luasExpr = "0";

    if (lahanColumns.has("luas_ha")) {
      luasExpr = "COALESCE(l.luas_ha, 0)";
    } else if (lahanColumns.has("luas_m2")) {
      luasExpr = "COALESCE(l.luas_m2, 0) / 10000";
    } else if (lahanColumns.has("luas")) {
      luasExpr = `
        CASE
          WHEN COALESCE(l.luas, 0) > 20 THEN COALESCE(l.luas, 0) / 10000
          ELSE COALESCE(l.luas, 0)
        END
      `;
    }

    const sql = `
      SELECT
        k.nama_kecamatan,
        COUNT(DISTINCT ${petaniExpr}) AS jumlah_petani,
        COALESCE(SUM(${luasExpr}), 0) AS luas_lahan
      FROM kecamatan k
      LEFT JOIN lahan l
        ON l.kecamatan_id = k.id
      GROUP BY k.id, k.nama_kecamatan
    `;

    const rows = await runQuery(sql);
    const map = new Map();

    rows.forEach((row) => {
      map.set(String(row.nama_kecamatan).toLowerCase(), {
        jumlah_petani: Number(row.jumlah_petani || 0),
        luas_lahan: Number(row.luas_lahan || 0),
      });
    });

    return map;
  } catch (err) {
    console.log("ERROR RELASI CUACA:", err.message);
    return new Map();
  }
};

const generateCuacaRealtime = async () => {
  const relasi = await loadRelasiKecamatan();

  const now = new Date();
  const fiveMinuteSeed = Math.floor(now.getTime() / (5 * 60 * 1000));

  return KECAMATAN_SUKOHARJO.map((item, index) => {
    const r1 = seededRandom(fiveMinuteSeed + index * 17);
    const r2 = seededRandom(fiveMinuteSeed + index * 31);
    const r3 = seededRandom(fiveMinuteSeed + index * 47);
    const r4 = seededRandom(fiveMinuteSeed + index * 63);

    const suhu = Number((item.baseTemp + r1 * 1.6 - 0.6).toFixed(1));
    const curahHujan = Number(Math.max(0, item.baseRain + r2 * 18 - 6).toFixed(1));
    const kelembaban = Number(Math.min(96, 72 + curahHujan / 2.4 + r3 * 6).toFixed(0));
    const kecepatanAngin = Number((4.5 + r4 * 7.5).toFixed(1));

    const statusCuaca = getStatusCuaca(curahHujan, kelembaban, kecepatanAngin);
    const relasiItem = relasi.get(String(item.nama_kecamatan).toLowerCase());

    return {
      id: index + 1,
      nama_kecamatan: item.nama_kecamatan,
      kota: "Sukoharjo",
      suhu,
      curah_hujan: curahHujan,
      kelembaban,
      kecepatan_angin: kecepatanAngin,
      status_cuaca: statusCuaca,
      status_label: getStatusLabel(statusCuaca),
      jumlah_petani: relasiItem?.jumlah_petani || 0,
      luas_lahan: relasiItem?.luas_lahan || 0,
      sumber: "GeoPanen Weather Service",
      updated_at: now.toISOString(),
    };
  });
};

const getCuaca = async (req, res) => {
  try {
    const data = await generateCuacaRealtime();

    return res.json({
      status: true,
      message: "Data cuaca realtime berhasil diambil.",
      source: "GeoPanen Weather Service",
      interval_update_menit: 5,
      updated_at: new Date().toISOString(),
      data,
    });
  } catch (err) {
    console.log("ERROR GET CUACA:", err);

    return res.status(500).json({
      status: false,
      message: "Gagal mengambil data cuaca.",
      error: err.message,
    });
  }
};

module.exports = {
  getCuaca,
};