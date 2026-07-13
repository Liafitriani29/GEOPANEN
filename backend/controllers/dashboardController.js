const db = require("../config/db");

// ===============================
// DASHBOARD ADMIN - STATISTIK UTAMA
// Endpoint: GET /api/dashboard
// ===============================
exports.getDashboard = (req, res) => {
  const sql = `
    SELECT
      (SELECT COUNT(*) FROM users) AS totalPetani,
      (SELECT COUNT(*) FROM lahan) AS totalLahan,
      (SELECT COALESCE(SUM(luas_ha), 0) FROM lahan) AS totalLuasHa,
      (SELECT COUNT(*) FROM prediksi) AS totalPrediksi,
      (SELECT COALESCE(SUM(prediksi_ton), 0) FROM prediksi) AS totalProduksi
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.log("ERROR DASHBOARD:", err);
      return res.status(500).json({
        message: "Gagal mengambil data dashboard",
        error: err.sqlMessage || err.message,
      });
    }

    const data = result[0] || {};

    return res.json({
      totalPetani: Number(data.totalPetani || 0),
      totalLahan: Number(data.totalLahan || 0),
      totalLuasHa: Number(data.totalLuasHa || 0).toFixed(2),
      totalPrediksi: Number(data.totalPrediksi || 0),
      totalProduksi: Number(data.totalProduksi || 0).toFixed(2),
    });
  });
};

// ===============================
// GRAFIK PRODUKSI PADI - BAR CHART
// Endpoint: GET /api/grafik-produksi
// ===============================
exports.getGrafikProduksi = (req, res) => {
  const sql = `
    SELECT 
      DATE(created_at) as tanggal,
      COALESCE(SUM(prediksi_ton),0) as total
    FROM prediksi
    WHERE created_at IS NOT NULL
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at) ASC
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.log("GRAFIK ERROR:", err);
      return res.status(500).json({
        message: "Error grafik produksi",
        error: err.sqlMessage
      });
    }

    const data = result.map(r => ({
      tanggal: r.tanggal,
      total: Number(r.total)
    }));

    return res.json(data);
  });
};

// ===============================
// PETA SEBARAN LAHAN ADMIN
// Endpoint: GET /api/map-lahan
// ===============================
exports.getMapLahan = (req, res) => {
  const sql = `
    SELECT 
      l.id,
      l.nama_lahan,
      l.luas_m2,
      l.luas_ha,
      l.varietas,
      l.lat AS latitude,
      l.lng AS longitude,
      k.nama_kecamatan,
      d.nama_desa
    FROM lahan l
    LEFT JOIN kecamatan k ON k.id = l.kecamatan_id
    LEFT JOIN desa d ON d.id = l.desa_id
    WHERE 
      l.lat IS NOT NULL 
      AND l.lng IS NOT NULL
      AND l.lat != ''
      AND l.lng != ''
    ORDER BY l.id DESC
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.log("ERROR MAP LAHAN:", err);
      return res.status(500).json({
        message: "Gagal mengambil data peta lahan",
        error: err.sqlMessage || err.message,
      });
    }

    const mapData = (result || []).map((item) => ({
      id: item.id,
      nama_lahan: item.nama_lahan || "-",
      nama_kecamatan: item.nama_kecamatan || "-",
      nama_desa: item.nama_desa || "-",
      luas_m2: Number(item.luas_m2 || 0),
      luas_ha: Number(item.luas_ha || 0),
      varietas: item.varietas || "-",
      latitude: Number(item.latitude),
      longitude: Number(item.longitude),
    }));

    return res.json(mapData);
  });
};

// ===============================
// RINGKASAN PRODUKSI PER KECAMATAN
// Opsional untuk dashboard admin
// Endpoint: GET /api/produksi-kecamatan
// ===============================
exports.getProduksiKecamatan = (req, res) => {
  const sql = `
    SELECT 
      k.nama_kecamatan,
      COUNT(p.id) AS jumlah_prediksi,
      COALESCE(SUM(p.prediksi_ton), 0) AS total_ton,
      COALESCE(AVG(p.prediksi_ton), 0) AS rata_rata_ton
    FROM prediksi p
    LEFT JOIN lahan l ON l.id = p.sawah_id
    LEFT JOIN kecamatan k ON k.id = l.kecamatan_id
    GROUP BY k.id, k.nama_kecamatan
    ORDER BY total_ton DESC
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.log("ERROR PRODUKSI KECAMATAN:", err);
      return res.status(500).json({
        message: "Gagal mengambil produksi per kecamatan",
        error: err.sqlMessage || err.message,
      });
    }

    const data = (result || []).map((item) => ({
      nama_kecamatan: item.nama_kecamatan || "-",
      jumlah_prediksi: Number(item.jumlah_prediksi || 0),
      total_ton: Number(item.total_ton || 0),
      rata_rata_ton: Number(item.rata_rata_ton || 0),
    }));

    return res.json(data);
  });
};