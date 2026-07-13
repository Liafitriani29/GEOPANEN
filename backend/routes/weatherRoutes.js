const express = require("express");
const router = express.Router();
const db = require("../config/db");

// ======================================================
// HELPER
// ======================================================
const safeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const getKondisiCuaca = (suhu, curahHujan) => {
  const suhuNum = safeNumber(suhu, 28);
  const hujanNum = safeNumber(curahHujan, 0);

  if (hujanNum >= 50) return "Hujan Lebat";
  if (hujanNum >= 20) return "Hujan";
  if (hujanNum >= 5) return "Berawan";
  if (suhuNum >= 32) return "Panas";
  if (suhuNum >= 27) return "Cerah";

  return "Cerah Berawan";
};

const getIconCuaca = (kondisi) => {
  const text = String(kondisi || "").toLowerCase();

  if (text.includes("hujan")) return "🌧️";
  if (text.includes("berawan")) return "⛅";
  if (text.includes("panas")) return "🌡️";

  return "☀️";
};

const tanggalIndonesia = () => {
  return new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

// ======================================================
// GET WEATHER GLOBAL
// URL: GET /api/weather
// Optional: ?lahan_id=9 atau ?sawah_id=9
// ======================================================
router.get("/", (req, res) => {
  const lahanId = req.query.lahan_id || req.query.sawah_id || null;

  let sql = `
    SELECT
      ROUND(AVG(suhu), 1) AS suhu,
      ROUND(AVG(kelembapan), 1) AS kelembapan,
      ROUND(AVG(curah_hujan), 1) AS curah_hujan,
      MAX(updated_at) AS updated_at,
      MAX(created_at) AS created_at
    FROM monitoring_tanaman
    WHERE suhu IS NOT NULL
      AND kelembapan IS NOT NULL
      AND curah_hujan IS NOT NULL
  `;

  const params = [];

  if (lahanId) {
    sql += ` AND sawah_id = ?`;
    params.push(lahanId);
  }

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.log("ERROR WEATHER:", err);

      return res.status(500).json({
        status: false,
        message: "Gagal mengambil data cuaca",
        error: err.message,
      });
    }

    const row = rows?.[0] || {};

    let suhu = safeNumber(row.suhu, 28);
    let kelembapan = safeNumber(row.kelembapan, 78);
    let curahHujan = safeNumber(row.curah_hujan, 2);

    // Kalau database belum punya data cuaca, pakai fallback aman.
    const tidakAdaData =
      row.suhu === null &&
      row.kelembapan === null &&
      row.curah_hujan === null;

    if (tidakAdaData) {
      suhu = 28;
      kelembapan = 78;
      curahHujan = 2;
    }

    const kondisi = getKondisiCuaca(suhu, curahHujan);

    return res.json({
      status: true,
      message: tidakAdaData
        ? "Data cuaca fallback karena monitoring belum tersedia"
        : "Data cuaca berhasil diambil dari monitoring tanaman",
      source: tidakAdaData ? "fallback" : "monitoring_tanaman",
      data: {
        tanggal: tanggalIndonesia(),
        suhu,
        suhu_label: `${suhu}°C`,
        kondisi,
        icon: getIconCuaca(kondisi),
        kelembapan,
        kelembapan_label: `${kelembapan}%`,
        curah_hujan: curahHujan,
        curah_hujan_label: `${curahHujan} mm`,
        updated_at: row.updated_at || row.created_at || null,
      },
    });
  });
});

// ======================================================
// GET WEATHER BY LAHAN
// URL: GET /api/weather/:lahanId
// ======================================================
router.get("/:lahanId", (req, res) => {
  const { lahanId } = req.params;

  const sql = `
    SELECT
      sawah_id,
      suhu,
      kelembapan,
      curah_hujan,
      updated_at,
      created_at
    FROM monitoring_tanaman
    WHERE sawah_id = ?
    ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
    LIMIT 1
  `;

  db.query(sql, [lahanId], (err, rows) => {
    if (err) {
      console.log("ERROR WEATHER BY LAHAN:", err);

      return res.status(500).json({
        status: false,
        message: "Gagal mengambil data cuaca lahan",
        error: err.message,
      });
    }

    const row = rows?.[0];

    if (!row) {
      const suhu = 28;
      const kelembapan = 78;
      const curahHujan = 2;
      const kondisi = getKondisiCuaca(suhu, curahHujan);

      return res.json({
        status: true,
        message: "Belum ada data cuaca lahan, menggunakan fallback",
        source: "fallback",
        data: {
          sawah_id: Number(lahanId),
          tanggal: tanggalIndonesia(),
          suhu,
          suhu_label: `${suhu}°C`,
          kondisi,
          icon: getIconCuaca(kondisi),
          kelembapan,
          kelembapan_label: `${kelembapan}%`,
          curah_hujan: curahHujan,
          curah_hujan_label: `${curahHujan} mm`,
          updated_at: null,
        },
      });
    }

    const suhu = safeNumber(row.suhu, 28);
    const kelembapan = safeNumber(row.kelembapan, 78);
    const curahHujan = safeNumber(row.curah_hujan, 2);
    const kondisi = getKondisiCuaca(suhu, curahHujan);

    return res.json({
      status: true,
      message: "Data cuaca lahan berhasil diambil",
      source: "monitoring_tanaman",
      data: {
        sawah_id: row.sawah_id,
        tanggal: tanggalIndonesia(),
        suhu,
        suhu_label: `${suhu}°C`,
        kondisi,
        icon: getIconCuaca(kondisi),
        kelembapan,
        kelembapan_label: `${kelembapan}%`,
        curah_hujan: curahHujan,
        curah_hujan_label: `${curahHujan} mm`,
        updated_at: row.updated_at || row.created_at || null,
      },
    });
  });
});

module.exports = router;