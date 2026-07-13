const axios = require("axios");
const db = require("../config/db");

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

const DEFAULT_CUACA = {
  Kartasura: { curah_hujan: 12.4, suhu: 29.4 },
  Gatak: { curah_hujan: 10.8, suhu: 29.1 },
  Baki: { curah_hujan: 8.6, suhu: 30.2 },
  Grogol: { curah_hujan: 28.5, suhu: 29.7 },
  Mojolaban: { curah_hujan: 24.2, suhu: 29.0 },
  Polokarto: { curah_hujan: 42.8, suhu: 29.5 },
  Bendosari: { curah_hujan: 13.5, suhu: 29.3 },
  Nguter: { curah_hujan: 45.7, suhu: 28.7 },
  Sukoharjo: { curah_hujan: 15.2, suhu: 29.6 },
  Bulu: { curah_hujan: 18.8, suhu: 29.2 },
  Tawangsari: { curah_hujan: 33.6, suhu: 29.0 },
  Weru: { curah_hujan: 76.4, suhu: 28.2 },
};

const DEFAULT_KODE_KECAMATAN = {
  Kartasura: 331201,
  Gatak: 331202,
  Baki: 331203,
  Grogol: 331204,
  Mojolaban: 331205,
  Polokarto: 331206,
  Bendosari: 331207,
  Nguter: 331208,
  Sukoharjo: 331209,
  Bulu: 331210,
  Tawangsari: 331211,
  Weru: 331212,
};

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

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeText = (value) => {
  return String(value || "").trim();
};

const getStatusFromPerubahan = (perubahan) => {
  if (perubahan <= -10) return "risiko";
  if (perubahan < 0) return "waspada";
  return "aman";
};

const buildLahanQuery = async () => {
  const lahanCols = await getColumns("lahan");
  const kecamatanCols = await getColumns("kecamatan");

  if (!lahanCols.size) {
    throw new Error("Tabel lahan tidak ditemukan atau tidak bisa dibaca");
  }

  const hasKecamatanJoin = lahanCols.has("kecamatan_id") && kecamatanCols.has("id");

  const namaLahanExpr = lahanCols.has("nama_lahan")
    ? "l.nama_lahan"
    : "CONCAT('Lahan ', l.id)";

  const luasHaExpr = lahanCols.has("luas_ha")
    ? "COALESCE(l.luas_ha, 0)"
    : lahanCols.has("luas_m2")
    ? "COALESCE(l.luas_m2, 0) / 10000"
    : lahanCols.has("luas")
    ? `
      CASE
        WHEN COALESCE(l.luas, 0) > 20 THEN COALESCE(l.luas, 0) / 10000
        ELSE COALESCE(l.luas, 0)
      END
    `
    : "0";

  const luasM2Expr = lahanCols.has("luas_m2")
    ? "COALESCE(l.luas_m2, 0)"
    : `(${luasHaExpr}) * 10000`;

  const varietasExpr = lahanCols.has("varietas")
    ? "COALESCE(l.varietas, '-')"
    : "'-'";

  const namaKecamatanExpr =
    hasKecamatanJoin && kecamatanCols.has("nama_kecamatan")
      ? "k.nama_kecamatan"
      : lahanCols.has("nama_kecamatan")
      ? "l.nama_kecamatan"
      : lahanCols.has("kecamatan")
      ? "l.kecamatan"
      : "'Sukoharjo'";

  const kodeKecamatanExpr =
    hasKecamatanJoin && kecamatanCols.has("kode_kecamatan")
      ? "k.kode_kecamatan"
      : lahanCols.has("kode_kecamatan")
      ? "l.kode_kecamatan"
      : "NULL";

  const produktivitasExpr = lahanCols.has("produktivitas_sawah_kw_ha")
    ? "COALESCE(l.produktivitas_sawah_kw_ha, 55)"
    : lahanCols.has("produktivitas")
    ? "COALESCE(l.produktivitas, 55)"
    : "55";

  const joinKecamatan = hasKecamatanJoin
    ? "LEFT JOIN kecamatan k ON l.kecamatan_id = k.id"
    : "";

  return `
    SELECT
      l.id AS lahan_id,
      ${namaLahanExpr} AS nama_lahan,
      ${luasHaExpr} AS luas_ha,
      ${luasM2Expr} AS luas_m2,
      ${varietasExpr} AS varietas,
      ${namaKecamatanExpr} AS nama_kecamatan,
      ${kodeKecamatanExpr} AS kode_kecamatan,
      ${produktivitasExpr} AS produktivitas_sawah_kw_ha
    FROM lahan l
    ${joinKecamatan}
    ORDER BY l.id DESC
  `;
};

const getLahanData = async () => {
  const sql = await buildLahanQuery();
  return await runQuery(sql);
};

const getMonitoringPrediksi = async (req, res) => {
  try {
    const tahun = new Date().getFullYear();
    const lahanRows = await getLahanData();

    if (!lahanRows.length) {
      return res.json({
        status: true,
        message: "Data lahan kosong",
        data: {
          stats: {
            total_prediksi: 0,
            total_luas: 0,
            total_produksi: 0,
            risiko_tinggi: 0,
            akurasi_model: 92.4,
          },
          per_kecamatan: [],
          detail_lahan: [],
          model: {
            nama_model: "Random Forest GeoPanen",
            akurasi: 92.4,
            total_dataset: 0,
            sumber: "FastAPI model_geopanen.pkl",
          },
        },
      });
    }

    const fiturBatch = lahanRows.map((row) => {
      const namaKecamatan = normalizeText(row.nama_kecamatan) || "Sukoharjo";
      const cuaca = DEFAULT_CUACA[namaKecamatan] || DEFAULT_CUACA.Sukoharjo;

      const luasHa = toNumber(row.luas_ha, 0);

      return {
        tahun,
        kode_kecamatan:
          toNumber(row.kode_kecamatan, 0) ||
          DEFAULT_KODE_KECAMATAN[namaKecamatan] ||
          331209,
        luas_panen_sawah_ha: luasHa,
        produktivitas_sawah_kw_ha: toNumber(
          row.produktivitas_sawah_kw_ha,
          55
        ),
        curah_hujan: cuaca.curah_hujan,
        suhu: cuaca.suhu,
      };
    });

    const fastapiRes = await axios.post(
      `${FASTAPI_URL}/predict-batch`,
      fiturBatch,
      { timeout: 30000 }
    );

    const detailFastapi = fastapiRes.data?.detail || [];

    const detailLahan = lahanRows.map((row, index) => {
      const hasil = detailFastapi[index] || {};
      const namaKecamatan = normalizeText(row.nama_kecamatan) || "Sukoharjo";
      const luasHa = toNumber(row.luas_ha, 0);

      return {
        lahan_id: row.lahan_id,
        nama_lahan: row.nama_lahan,
        nama_kecamatan: namaKecamatan,
        kode_kecamatan:
          row.kode_kecamatan || DEFAULT_KODE_KECAMATAN[namaKecamatan],
        luas_ha: Number(luasHa.toFixed(2)),
        luas_m2: toNumber(row.luas_m2, luasHa * 10000),
        varietas: row.varietas || "-",

        prediksi_ton: toNumber(hasil.prediksi_ton, 0),
        prediksi_kg: toNumber(hasil.prediksi_kg, 0),
        produktivitas_ton_ha: toNumber(hasil.produktivitas_ton_ha, 0),
        status_produktivitas: hasil.status_produktivitas || "-",
        perubahan: toNumber(hasil.perubahan, 0),
        status: hasil.status || "aman",
      };
    });

    const grouped = {};

    detailLahan.forEach((item) => {
      const kecamatan = item.nama_kecamatan || "Sukoharjo";

      if (!grouped[kecamatan]) {
        grouped[kecamatan] = {
          kecamatan,
          luas_ha: 0,
          produksi_prediksi: 0,
          total_lahan: 0,
          perubahan_total: 0,
          perubahan_count: 0,
          status_list: [],
        };
      }

      grouped[kecamatan].luas_ha += item.luas_ha;
      grouped[kecamatan].produksi_prediksi += item.prediksi_ton;
      grouped[kecamatan].total_lahan += 1;
      grouped[kecamatan].perubahan_total += item.perubahan;
      grouped[kecamatan].perubahan_count += 1;
      grouped[kecamatan].status_list.push(item.status);
    });

    const perKecamatan = Object.values(grouped).map((item, index) => {
      const perubahan =
        item.perubahan_count > 0
          ? item.perubahan_total / item.perubahan_count
          : 0;

      const status = item.status_list.includes("risiko")
        ? "risiko"
        : item.status_list.includes("waspada")
        ? "waspada"
        : getStatusFromPerubahan(perubahan);

      return {
        id: index + 1,
        kecamatan: item.kecamatan,
        luas_ha: Number(item.luas_ha.toFixed(2)),
        produksi_prediksi: Number(item.produksi_prediksi.toFixed(2)),
        total_lahan: item.total_lahan,
        perubahan: Number(perubahan.toFixed(1)),
        status,
      };
    });

    const totalLuas = perKecamatan.reduce(
      (sum, item) => sum + item.luas_ha,
      0
    );

    const totalProduksi = perKecamatan.reduce(
      (sum, item) => sum + item.produksi_prediksi,
      0
    );

    const risikoTinggi = perKecamatan.filter(
      (item) => item.status === "risiko"
    ).length;

    return res.json({
      status: true,
      message: "Monitoring prediksi berhasil diambil dari FastAPI",
      data: {
        stats: {
          total_prediksi: detailLahan.length,
          total_luas: Number(totalLuas.toFixed(2)),
          total_produksi: Number(totalProduksi.toFixed(2)),
          risiko_tinggi: risikoTinggi,
          akurasi_model: 92.4,
        },
        per_kecamatan: perKecamatan,
        detail_lahan: detailLahan,
        model: {
          nama_model: "Random Forest GeoPanen",
          akurasi: 92.4,
          total_dataset: detailLahan.length,
          sumber: "FastAPI model_geopanen.pkl",
          endpoint: `${FASTAPI_URL}/predict-batch`,
          fitur: [
            "tahun",
            "kode_kecamatan",
            "luas_panen_sawah_ha",
            "produktivitas_sawah_kw_ha",
            "curah_hujan",
            "suhu",
          ],
        },
      },
    });
  } catch (err) {
    console.log("ERROR ADMIN MONITORING PREDIKSI:", err);

    return res.status(500).json({
      status: false,
      message: "Gagal mengambil monitoring prediksi",
      error: err.message,
    });
  }
};

module.exports = {
  getMonitoringPrediksi,
};