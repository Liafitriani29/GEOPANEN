const db = require("../config/db");

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function percentChange(current, previous) {
  current = num(current);
  previous = num(previous);

  if (previous === 0 && current === 0) return 0;
  if (previous === 0 && current > 0) return 100;

  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function getStatus(row) {
  const status = String(row.status_kesehatan || "").toLowerCase();
  const skor = num(row.skor_kesehatan, 91);

  if (status.includes("kritis")) return "kritis";
  if (status.includes("waspada")) return "waspada";

  if (skor < 55) return "kritis";
  if (skor < 75) return "waspada";

  return "baik";
}

function statusLabel(status) {
  if (status === "kritis") return "Kritis";
  if (status === "waspada") return "Perlu Perhatian";
  return "Baik";
}

function getDateRange(req) {
  const today = new Date();

  const defaultEnd = today.toISOString().slice(0, 10);

  const defaultStartDate = new Date(today);
  defaultStartDate.setDate(defaultStartDate.getDate() - 60);

  const defaultStart = defaultStartDate.toISOString().slice(0, 10);

  return {
    startDate: req.query.start_date || defaultStart,
    endDate: req.query.end_date || defaultEnd,
  };
}

function getPreviousRange(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);

  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - diffDays);

  return {
    prevStartDate: prevStart.toISOString().slice(0, 10),
    prevEndDate: prevEnd.toISOString().slice(0, 10),
  };
}

/* ======================================================
   DATA DETAIL ANALISIS
   AMAN UNTUK TABEL LAHAN TANPA created_at / updated_at
====================================================== */
async function fetchRows(startDate, endDate) {
  const sql = `
    SELECT
      l.id AS id,
      l.id AS lahan_id,

      COALESCE(l.user_id, l.petani_id) AS petani_id,

      COALESCE(u.nama, 'Petani') AS nama_petani,
      COALESCE(u.email, '-') AS email_petani,
      '-' AS no_hp,

      l.nama_lahan,
      COALESCE(l.varietas, '-') AS varietas,
      'Padi' AS komoditas,

      COALESCE(l.luas_ha, 0) AS luas_ha,
      COALESCE(l.lat, d.lat) AS lat,
      COALESCE(l.lng, d.lng) AS lng,

      COALESCE(d.nama_desa, '-') AS nama_desa,
      COALESCE(k.nama_kecamatan, '-') AS nama_kecamatan,

      COALESCE(rp.produksi_aktual, 0) AS produksi_aktual,
      COALESCE(rp.luas_panen_ha, l.luas_ha, 0) AS luas_panen_ha,
      rp.tanggal_terakhir_panen AS tanggal_panen,

      COALESCE(p.prediksi_ton, 0) AS prediksi_ton,
      COALESCE(p.prediksi_kg, 0) AS prediksi_kg,
      COALESCE(p.periode, '-') AS periode_prediksi,
      p.created_at AS tanggal_prediksi,

      COALESCE(mt.umur_tanam, 0) AS umur_tanaman,
      COALESCE(mt.fase_tanam, 'Vegetatif Awal') AS fase_tanaman,
      COALESCE(mt.status_kesehatan, 'sehat') AS status_kesehatan,
      COALESCE(mt.suhu, 0) AS suhu,
      COALESCE(mt.kelembapan, 0) AS kelembapan,
      COALESCE(mt.curah_hujan, 0) AS curah_hujan,

      COALESCE(rp.tanggal_terakhir_panen, p.created_at) AS tanggal_data

    FROM lahan l

    LEFT JOIN users u
      ON u.id = COALESCE(l.user_id, l.petani_id)

    LEFT JOIN desa d
      ON d.id = l.desa_id

    LEFT JOIN kecamatan k
      ON k.id = l.kecamatan_id

    LEFT JOIN (
      SELECT
        lahan_id,
        SUM(produksi_ton) AS produksi_aktual,
        SUM(COALESCE(luas_panen_ha, 0)) AS luas_panen_ha,
        MAX(tanggal_panen) AS tanggal_terakhir_panen
      FROM riwayat_panen
      WHERE tanggal_panen BETWEEN ? AND ?
      GROUP BY lahan_id
    ) rp
      ON rp.lahan_id = l.id

    LEFT JOIN (
      SELECT p1.*
      FROM prediksi p1
      INNER JOIN (
        SELECT sawah_id, MAX(id) AS max_id
        FROM prediksi
        GROUP BY sawah_id
      ) px
        ON px.max_id = p1.id
    ) p
      ON p.sawah_id = l.id

    LEFT JOIN (
      SELECT m1.*
      FROM monitoring_tanaman m1
      INNER JOIN (
        SELECT sawah_id, MAX(id) AS max_id
        FROM monitoring_tanaman
        GROUP BY sawah_id
      ) mx
        ON mx.max_id = m1.id
    ) mt
      ON mt.sawah_id = l.id

    ORDER BY l.id DESC
  `;

  return await query(sql, [startDate, endDate]);
}

function applyFilters(rows, req) {
  const kecamatan = req.query.kecamatan || "all";
  const desa = req.query.desa || "all";
  const status = req.query.status || "all";

  return rows.filter((row) => {
    const rowStatus = getStatus(row);

    const matchKecamatan =
      kecamatan === "all" || row.nama_kecamatan === kecamatan;

    const matchDesa =
      desa === "all" || row.nama_desa === desa;

    const matchStatus =
      status === "all" || rowStatus === status;

    return matchKecamatan && matchDesa && matchStatus;
  });
}

function groupPetani(rows) {
  const map = new Map();

  rows.forEach((row) => {
    const key = String(row.petani_id || row.nama_petani);

    if (!map.has(key)) {
      map.set(key, {
        petani_id: row.petani_id,
        nama_petani: row.nama_petani,
        email_petani: row.email_petani,
        no_hp: row.no_hp,
        nama_desa: row.nama_desa,
        nama_kecamatan: row.nama_kecamatan,
        komoditas: row.komoditas,
        varietas: row.varietas,
        total_lahan: 0,
        total_luas: 0,
        total_produksi: 0,
        total_prediksi: 0,
        status: "baik",
        skor_kesehatan: 91,
        lat: row.lat,
        lng: row.lng,
      });
    }

    const item = map.get(key);
    const rowStatus = getStatus(row);

    item.total_lahan += 1;
    item.total_luas += num(row.luas_ha);
    item.total_produksi += num(row.produksi_aktual);
    item.total_prediksi += num(row.prediksi_ton);

    if (rowStatus === "kritis") {
      item.status = "kritis";
      item.skor_kesehatan = 45;
    } else if (rowStatus === "waspada" && item.status !== "kritis") {
      item.status = "waspada";
      item.skor_kesehatan = 62;
    }
  });

  return Array.from(map.values()).map((item) => ({
    ...item,
    produktivitas:
      item.total_luas > 0
        ? Number((item.total_produksi / item.total_luas).toFixed(2))
        : 0,
    selisih: Number((item.total_produksi - item.total_prediksi).toFixed(2)),
    status_label: statusLabel(item.status),
  }));
}

function groupWilayah(rows) {
  const map = new Map();

  rows.forEach((row) => {
    const key = row.nama_desa || row.nama_kecamatan || "-";

    if (!map.has(key)) {
      map.set(key, {
        wilayah: key,
        desa: row.nama_desa,
        kecamatan: row.nama_kecamatan,
        total_luas: 0,
        total_produksi: 0,
        total_prediksi: 0,
        petaniSet: new Set(),
        latList: [],
        lngList: [],
      });
    }

    const item = map.get(key);

    item.total_luas += num(row.luas_ha);
    item.total_produksi += num(row.produksi_aktual);
    item.total_prediksi += num(row.prediksi_ton);
    item.petaniSet.add(row.petani_id || row.nama_petani);

    if (Number.isFinite(Number(row.lat))) item.latList.push(Number(row.lat));
    if (Number.isFinite(Number(row.lng))) item.lngList.push(Number(row.lng));
  });

  return Array.from(map.values()).map((item) => {
    const lat =
      item.latList.length > 0
        ? item.latList.reduce((a, b) => a + b, 0) / item.latList.length
        : null;

    const lng =
      item.lngList.length > 0
        ? item.lngList.reduce((a, b) => a + b, 0) / item.lngList.length
        : null;

    return {
      wilayah: item.wilayah,
      desa: item.desa,
      kecamatan: item.kecamatan,
      total_luas: Number(item.total_luas.toFixed(4)),
      total_produksi: Number(item.total_produksi.toFixed(2)),
      total_prediksi: Number(item.total_prediksi.toFixed(2)),
      total_petani: item.petaniSet.size,
      produktivitas:
        item.total_luas > 0
          ? Number((item.total_produksi / item.total_luas).toFixed(2))
          : 0,
      lat,
      lng,
    };
  });
}

function groupKomoditas(rows) {
  const map = new Map();

  rows.forEach((row) => {
    const key = row.komoditas || "Padi";

    if (!map.has(key)) {
      map.set(key, {
        name: key,
        jumlah_lahan: 0,
        luas: 0,
      });
    }

    const item = map.get(key);
    item.jumlah_lahan += 1;
    item.luas += num(row.luas_ha);
  });

  const arr = Array.from(map.values());
  const total = arr.reduce((sum, item) => sum + item.jumlah_lahan, 0);

  return arr.map((item) => ({
    ...item,
    luas: Number(item.luas.toFixed(4)),
    persentase:
      total > 0 ? Number(((item.jumlah_lahan / total) * 100).toFixed(1)) : 0,
  }));
}

function groupChart(rows, startDate) {
  const map = new Map();

  rows.forEach((row) => {
    const sourceDate = row.tanggal_data || row.tanggal_panen || row.tanggal_prediksi || startDate;
    const date = new Date(sourceDate);

    if (Number.isNaN(date.getTime())) return;

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    if (!map.has(key)) {
      map.set(key, {
        bulan: key,
        label: date.toLocaleDateString("id-ID", {
          month: "short",
          year: "numeric",
        }),
        produksi_aktual: 0,
        prediksi_produksi: 0,
      });
    }

    const item = map.get(key);

    item.produksi_aktual += num(row.produksi_aktual);
    item.prediksi_produksi += num(row.prediksi_ton);
  });

  return Array.from(map.values())
    .map((item) => ({
      ...item,
      produksi_aktual: Number(item.produksi_aktual.toFixed(2)),
      prediksi_produksi: Number(item.prediksi_produksi.toFixed(2)),
    }))
    .sort((a, b) => a.bulan.localeCompare(b.bulan));
}

function buildSummary(rows, previousRows) {
  const petani = groupPetani(rows);
  const previousPetani = groupPetani(previousRows);

  const totalProduksi = rows.reduce((sum, row) => sum + num(row.produksi_aktual), 0);
  const totalPrediksi = rows.reduce((sum, row) => sum + num(row.prediksi_ton), 0);
  const totalLuas = rows.reduce((sum, row) => sum + num(row.luas_ha), 0);

  const petaniAktif = petani.filter((item) => item.status === "baik").length;
  const petaniPerluPerhatian = petani.filter((item) =>
    ["waspada", "kritis"].includes(item.status)
  ).length;

  const produktivitas = totalLuas > 0 ? totalProduksi / totalLuas : 0;

  const prevProduksi = previousRows.reduce((sum, row) => sum + num(row.produksi_aktual), 0);
  const prevPrediksi = previousRows.reduce((sum, row) => sum + num(row.prediksi_ton), 0);
  const prevLuas = previousRows.reduce((sum, row) => sum + num(row.luas_ha), 0);

  const prevProduktivitas = prevLuas > 0 ? prevProduksi / prevLuas : 0;
  const prevPetaniAktif = previousPetani.filter((item) => item.status === "baik").length;

  return {
    total_produksi_aktual: Number(totalProduksi.toFixed(2)),
    total_prediksi_produksi: Number(totalPrediksi.toFixed(2)),
    rata_rata_produktivitas: Number(produktivitas.toFixed(2)),
    total_luas_panen: Number(totalLuas.toFixed(4)),
    jumlah_petani_aktif: petaniAktif,
    jumlah_petani_perlu_perhatian: petaniPerluPerhatian,
    total_petani: petani.length,
    total_lahan: rows.length,

    perubahan: {
      produksi_aktual: percentChange(totalProduksi, prevProduksi),
      prediksi_produksi: percentChange(totalPrediksi, prevPrediksi),
      produktivitas: percentChange(produktivitas, prevProduktivitas),
      luas_panen: percentChange(totalLuas, prevLuas),
      petani_aktif: percentChange(petaniAktif, prevPetaniAktif),
    },
  };
}

function buildRekomendasi(rows, summary) {
  const rekomendasi = [];
  const petani = groupPetani(rows);

  const perlu = petani.filter((item) =>
    ["waspada", "kritis"].includes(item.status)
  );

  const prediksiRendah = rows.filter((row) => {
    const prediksi = num(row.prediksi_ton);
    return prediksi > 0 && prediksi < 1;
  });

  if (summary.total_produksi_aktual === 0) {
    rekomendasi.push({
      icon: "📌",
      level: "warning",
      title: "Belum ada produksi aktual pada periode ini",
      desc: "Input data riwayat panen agar analisis produksi membaca hasil panen real.",
    });
  }

  if (perlu.length > 0) {
    rekomendasi.push({
      icon: "⚠️",
      level: "warning",
      title: `${perlu.length} petani perlu pendampingan`,
      desc: "Prioritaskan kunjungan lapangan untuk petani dengan status waspada atau kritis.",
    });
  }

  if (prediksiRendah.length > 0) {
    rekomendasi.push({
      icon: "📉",
      level: "danger",
      title: `${prediksiRendah.length} lahan memiliki prediksi produksi rendah`,
      desc: "Evaluasi pemupukan, irigasi, umur tanaman, dan kondisi hama.",
    });
  }

  if (rekomendasi.length === 0) {
    rekomendasi.push({
      icon: "✅",
      level: "success",
      title: "Produksi binaan dalam kondisi baik",
      desc: "Lanjutkan monitoring rutin dan validasi data panen berkala.",
    });
  }

  return rekomendasi.slice(0, 4);
}

exports.getAnalisisProduksi = async (req, res) => {
  try {
    const { startDate, endDate } = getDateRange(req);
    const { prevStartDate, prevEndDate } = getPreviousRange(startDate, endDate);

    const currentRowsRaw = await fetchRows(startDate, endDate);
    const previousRowsRaw = await fetchRows(prevStartDate, prevEndDate);

    const currentRows = applyFilters(currentRowsRaw, req);
    const previousRows = applyFilters(previousRowsRaw, req);

    const summary = buildSummary(currentRows, previousRows);
    const petani = groupPetani(currentRows);
    const wilayah = groupWilayah(currentRows);
    const komoditas = groupKomoditas(currentRows);
    const chart = groupChart(currentRows, startDate);

    const topProduktivitas = [...wilayah]
      .filter((item) => item.produktivitas > 0)
      .sort((a, b) => b.produktivitas - a.produktivitas)
      .slice(0, 5);

    const map = wilayah.filter(
      (item) =>
        Number.isFinite(Number(item.lat)) &&
        Number.isFinite(Number(item.lng))
    );

    const rekomendasi = buildRekomendasi(currentRows, summary);

    return res.json({
      status: true,
      message: "Analisis produksi dinamis berhasil diambil",
      periode: {
        start_date: startDate,
        end_date: endDate,
        previous_start_date: prevStartDate,
        previous_end_date: prevEndDate,
      },
      filters: {
        kecamatan: req.query.kecamatan || "all",
        desa: req.query.desa || "all",
        status: req.query.status || "all",
      },
      summary,
      chart,
      petani,
      rows: currentRows,
      wilayah,
      topProduktivitas,
      komoditas,
      map,
      rekomendasi,
    });
  } catch (err) {
    console.error("ERROR ANALISIS PRODUKSI:", err);

    return res.status(500).json({
      status: false,
      message: "Gagal mengambil analisis produksi",
      error: err.message,
    });
  }
};