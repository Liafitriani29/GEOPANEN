const db = require("../config/db");
const util = require("util");

const query = util.promisify(db.query).bind(db);

const ALLOWED_HST = [30, 60, 90, 110];

const isEmpty = (value) =>
  value === undefined || value === null || value === "";

const safeNumber = (value, fallback = null) => {
  if (isEmpty(value)) return fallback;

  const number = Number(value);

  return Number.isFinite(number) ? number : fallback;
};

const pad2 = (value) => String(value).padStart(2, "0");

const toDateKey = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return `${date.getFullYear()}-${pad2(
    date.getMonth() + 1
  )}-${pad2(date.getDate())}`;
};

const addDays = (value, totalDays) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + Number(totalDays || 0));

  return toDateKey(date);
};

const getLahanById = async (lahanId) => {
  const rows = await query(
    `
      SELECT
        l.*,
        k.nama_kecamatan,
        d.nama_desa
      FROM lahan l
      LEFT JOIN kecamatan k
        ON k.id = l.kecamatan_id
      LEFT JOIN desa d
        ON d.id = l.desa_id
      WHERE l.id = ?
      LIMIT 1
    `,
    [lahanId]
  );

  return rows[0] || null;
};

const buildInsight = (payload) => {
  const hst = Number(payload.hst_target);

  const notes = [];
  const recommendations = [];

  const growth = String(
    payload.kondisi_pertumbuhan || ""
  ).toLowerCase();

  const tillerDensity = String(
    payload.kepadatan_anakan || ""
  ).toLowerCase();

  const productiveDensity = String(
    payload.kepadatan_anakan_produktif || ""
  ).toLowerCase();

  const leaf = String(
    payload.kondisi_daun || ""
  ).toLowerCase();

  const water = String(
    payload.kondisi_air || ""
  ).toLowerCase();

  const pest = String(
    payload.tingkat_hama || ""
  ).toLowerCase();

  // ==================================================
  // MONITORING HST 30
  // ==================================================
  if (hst === 30) {
    if (
      [
        "lambat",
        "tidak_merata",
        "banyak_mati",
      ].includes(growth)
    ) {
      notes.push(
        "Pertumbuhan tanaman pada fase vegetatif memerlukan perhatian."
      );

      recommendations.push(
        "Periksa kondisi air, daun, dan pemerataan pertumbuhan pada beberapa bagian lahan."
      );
    }

    if (
      ["sedikit", "tidak_merata"].includes(
        tillerDensity
      )
    ) {
      notes.push(
        "Kepadatan anakan dinilai belum merata atau masih sedikit."
      );

      recommendations.push(
        "Lakukan pengamatan ulang pada beberapa rumpun dan konsultasikan dengan penyuluh."
      );
    }

    /*
     * Data angka hanya dianalisis jika petani atau
     * penyuluh benar-benar mengisinya.
     */
    const height = safeNumber(
      payload.tinggi_tanaman
    );

    const tillers = safeNumber(
      payload.jumlah_anakan
    );

    if (height !== null && height < 30) {
      notes.push(
        "Hasil pengukuran tambahan menunjukkan tinggi tanaman relatif rendah."
      );

      recommendations.push(
        "Gunakan hasil pengukuran sebagai bahan pemeriksaan lanjutan, bukan sebagai dasar tunggal penambahan pupuk."
      );
    }

    if (tillers !== null && tillers < 8) {
      notes.push(
        "Hasil penghitungan tambahan menunjukkan jumlah anakan relatif sedikit."
      );

      recommendations.push(
        "Verifikasi pada rumpun sampel lain sebelum menentukan tindakan budidaya."
      );
    }
  }

  // ==================================================
  // MONITORING HST 60
  // ==================================================
  if (hst === 60) {
    if (
      ["sedikit", "tidak_merata"].includes(
        productiveDensity
      )
    ) {
      notes.push(
        "Kepadatan anakan produktif dinilai belum optimal."
      );

      recommendations.push(
        "Pantau pembentukan malai dan lakukan pemeriksaan pada beberapa bagian lahan."
      );
    }

    const panicle = String(
      payload.kondisi_malai || ""
    ).toLowerCase();

    if (
      [
        "lambat",
        "tidak_merata",
        "rusak",
      ].includes(panicle)
    ) {
      notes.push(
        "Pembentukan malai memerlukan perhatian."
      );

      recommendations.push(
        "Periksa kondisi tanaman dan konsultasikan dengan penyuluh jika masalah meluas."
      );
    }

    const productiveTillers = safeNumber(
      payload.jumlah_anakan_produktif
    );

    if (
      productiveTillers !== null &&
      productiveTillers < 8
    ) {
      notes.push(
        "Hasil penghitungan tambahan menunjukkan anakan produktif relatif sedikit."
      );

      recommendations.push(
        "Gunakan hasil hitung sebagai bahan verifikasi lapangan bersama penyuluh."
      );
    }
  }

  // ==================================================
  // MONITORING HST 90
  // ==================================================
  if (hst === 90) {
    if (
      payload.tanaman_rebah &&
      payload.tanaman_rebah !== "tidak"
    ) {
      notes.push(
        "Sebagian tanaman tercatat rebah."
      );

      recommendations.push(
        "Prioritaskan pemeriksaan lahan dan siapkan penanganan sebelum panen."
      );
    }

    if (payload.kesiapan_panen === "siap") {
      notes.push(
        "Tanaman dinilai siap memasuki masa panen."
      );

      recommendations.push(
        "Siapkan tenaga, alat, dan jadwal panen dengan mempertimbangkan cuaca."
      );
    }

    if (payload.kondisi_bulir === "rusak") {
      notes.push(
        "Kondisi bulir dilaporkan rusak."
      );

      recommendations.push(
        "Periksa penyebab kerusakan dan konsultasikan penanganannya."
      );
    }
  }

  // ==================================================
  // HASIL PANEN HST 110
  // ==================================================
  if (hst === 110) {
    const harvest = safeNumber(
      payload.hasil_panen_kg
    );

    if (harvest !== null) {
      notes.push(
        `Hasil panen aktual tercatat ${harvest} kg.`
      );

      recommendations.push(
        "Bandingkan hasil aktual dengan hasil prediksi pada menu Riwayat Panen."
      );
    }
  }

  // ==================================================
  // KONDISI DAUN
  // ==================================================
  if (
    [
      "menguning",
      "bercak",
      "menggulung",
      "kering",
    ].includes(leaf)
  ) {
    notes.push(
      `Kondisi daun tercatat ${leaf.replace(
        /_/g,
        " "
      )}.`
    );

    recommendations.push(
      "Periksa sebaran gejala dan konsultasikan dengan penyuluh jika gejala meluas."
    );
  }

  // ==================================================
  // HAMA DAN PENYAKIT
  // ==================================================
  if (["sedang", "tinggi"].includes(pest)) {
    notes.push(
      "Terdapat risiko hama atau penyakit yang perlu diperhatikan."
    );

    recommendations.push(
      "Lakukan identifikasi lapangan dan terapkan pengendalian hama terpadu."
    );
  }

  // ==================================================
  // KONDISI AIR
  // ==================================================
  if (water === "kering") {
    notes.push(
      "Kondisi air tercatat kering."
    );

    recommendations.push(
      "Periksa saluran irigasi dan tambahkan air secara bertahap."
    );
  }

  if (water === "tergenang") {
    notes.push(
      "Kondisi air tercatat tergenang."
    );

    recommendations.push(
      "Periksa drainase agar genangan tidak menghambat pertumbuhan."
    );
  }

  if (notes.length === 0) {
    return {
      status: "normal",
      ringkasan:
        "Monitoring menunjukkan kondisi tanaman masih sesuai fase.",
      rekomendasi:
        "Lanjutkan kegiatan budidaya sesuai jadwal.",
    };
  }

  return {
    status: "perlu_perhatian",
    ringkasan: notes.join(" "),
    rekomendasi: recommendations.join(" "),
  };
};

const insertNotification = async ({
  userId,
  title,
  message,
}) => {
  if (!userId) return;

  try {
    await query(
      `
        INSERT INTO notifikasi
        (
          user_id,
          role,
          judul,
          pesan,
          link,
          is_read
        )
        VALUES (
          ?,
          'petani',
          ?,
          ?,
          '/petani/kalender',
          0
        )
      `,
      [userId, title, message]
    );
  } catch (error) {
    console.log(
      "Notifikasi dilewati:",
      error.message
    );
  }
};

// ==================================================
// LIST SEMUA MONITORING FASE
// ==================================================
exports.listMonitoringFase = async (
  req,
  res
) => {
  try {
    const rows = await query(
      `
        SELECT *
        FROM monitoring_fase
        WHERE lahan_id = ?
        ORDER BY hst_target ASC
      `,
      [req.params.lahan_id]
    );

    return res.json({
      status: true,
      data: rows,
    });
  } catch (error) {
    console.log(
      "ERROR LIST MONITORING FASE:",
      error.message
    );

    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// ==================================================
// GET SATU MONITORING FASE
// ==================================================
exports.getMonitoringFase = async (
  req,
  res
) => {
  try {
    const rows = await query(
      `
        SELECT *
        FROM monitoring_fase
        WHERE lahan_id = ?
          AND hst_target = ?
        LIMIT 1
      `,
      [
        req.params.lahan_id,
        req.params.hst_target,
      ]
    );

    return res.json({
      status: true,
      data: rows[0] || null,
    });
  } catch (error) {
    console.log(
      "ERROR GET MONITORING FASE:",
      error.message
    );

    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// ==================================================
// SIMPAN ATAU PERBARUI MONITORING FASE
// ==================================================
exports.saveMonitoringFase = async (
  req,
  res
) => {
  try {
    const { lahan_id } = req.params;

    const payload = req.body || {};

    const userId =
      payload.user_id ||
      payload.petani_id ||
      null;

    const hstTarget = Number(
      payload.hst_target
    );

    if (!ALLOWED_HST.includes(hstTarget)) {
      return res.status(400).json({
        status: false,
        message:
          "HST monitoring hanya boleh 30, 60, 90, atau 110.",
      });
    }

    const lahan = await getLahanById(
      lahan_id
    );

    if (!lahan) {
      return res.status(404).json({
        status: false,
        message: "Lahan tidak ditemukan.",
      });
    }

    if (!lahan.tanggal_tanam) {
      return res.status(400).json({
        status: false,
        message:
          "Tanggal tanam belum tersedia.",
      });
    }

    const tanggalMonitoring = addDays(
      lahan.tanggal_tanam,
      hstTarget
    );

    const insight = buildInsight(payload);

    await query(
      `
        INSERT INTO monitoring_fase
        (
          lahan_id,
          user_id,
          hst_target,
          tahap,
          tanggal_monitoring,

          kondisi_pertumbuhan,
          kepadatan_anakan,

          tinggi_tanaman,
          jumlah_anakan,

          kondisi_daun,
          kondisi_air,
          jenis_hama,
          tingkat_hama,

          jumlah_anakan_produktif,
          kepadatan_anakan_produktif,

          kondisi_malai,
          warna_malai,
          kondisi_bulir,
          tanaman_rebah,
          kesiapan_panen,

          tanggal_panen_aktual,
          hasil_panen_kg,
          luas_panen_ha,
          kualitas_gabah,

          catatan,
          status_analisis,
          ringkasan_analisis,
          rekomendasi
        )
        VALUES (
          ?, ?, ?, ?, ?,
          ?, ?,
          ?, ?,
          ?, ?, ?, ?,
          ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?
        )

        ON DUPLICATE KEY UPDATE
          user_id =
            VALUES(user_id),

          tahap =
            VALUES(tahap),

          tanggal_monitoring =
            VALUES(tanggal_monitoring),

          kondisi_pertumbuhan =
            VALUES(kondisi_pertumbuhan),

          kepadatan_anakan =
            VALUES(kepadatan_anakan),

          tinggi_tanaman =
            VALUES(tinggi_tanaman),

          jumlah_anakan =
            VALUES(jumlah_anakan),

          kondisi_daun =
            VALUES(kondisi_daun),

          kondisi_air =
            VALUES(kondisi_air),

          jenis_hama =
            VALUES(jenis_hama),

          tingkat_hama =
            VALUES(tingkat_hama),

          jumlah_anakan_produktif =
            VALUES(jumlah_anakan_produktif),

          kepadatan_anakan_produktif =
            VALUES(
              kepadatan_anakan_produktif
            ),

          kondisi_malai =
            VALUES(kondisi_malai),

          warna_malai =
            VALUES(warna_malai),

          kondisi_bulir =
            VALUES(kondisi_bulir),

          tanaman_rebah =
            VALUES(tanaman_rebah),

          kesiapan_panen =
            VALUES(kesiapan_panen),

          tanggal_panen_aktual =
            VALUES(tanggal_panen_aktual),

          hasil_panen_kg =
            VALUES(hasil_panen_kg),

          luas_panen_ha =
            VALUES(luas_panen_ha),

          kualitas_gabah =
            VALUES(kualitas_gabah),

          catatan =
            VALUES(catatan),

          status_analisis =
            VALUES(status_analisis),

          ringkasan_analisis =
            VALUES(ringkasan_analisis),

          rekomendasi =
            VALUES(rekomendasi),

          updated_at =
            CURRENT_TIMESTAMP
      `,
      [
        lahan_id,
        userId,
        hstTarget,
        payload.tahap || null,
        tanggalMonitoring,

        payload.kondisi_pertumbuhan ||
          null,

        payload.kepadatan_anakan ||
          null,

        safeNumber(
          payload.tinggi_tanaman
        ),

        safeNumber(
          payload.jumlah_anakan
        ),

        payload.kondisi_daun || null,
        payload.kondisi_air || null,
        payload.jenis_hama || null,
        payload.tingkat_hama || null,

        safeNumber(
          payload.jumlah_anakan_produktif
        ),

        payload
          .kepadatan_anakan_produktif ||
          null,

        payload.kondisi_malai || null,
        payload.warna_malai || null,
        payload.kondisi_bulir || null,
        payload.tanaman_rebah || null,
        payload.kesiapan_panen || null,

        payload.tanggal_panen_aktual ||
          null,

        safeNumber(
          payload.hasil_panen_kg
        ),

        safeNumber(
          payload.luas_panen_ha
        ),

        payload.kualitas_gabah || null,
        payload.catatan || null,

        insight.status,
        insight.ringkasan,
        insight.rekomendasi,
      ]
    );

    await insertNotification({
      userId,
      title: `Monitoring HST ${hstTarget} Disimpan`,
      message: insight.ringkasan,
    });

    const rows = await query(
      `
        SELECT *
        FROM monitoring_fase
        WHERE lahan_id = ?
          AND hst_target = ?
        LIMIT 1
      `,
      [lahan_id, hstTarget]
    );

    return res.json({
      status: true,
      message:
        `Monitoring HST ${hstTarget} berhasil disimpan.`,
      data: rows[0] || null,
      insight,
    });
  } catch (error) {
    console.log(
      "ERROR SAVE MONITORING FASE:",
      error.message
    );

    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// ==================================================
// LAPORAN MASALAH LAHAN
// ==================================================
exports.createProblemReport = async (
  req,
  res
) => {
  try {
    const { lahan_id } = req.params;

    const {
      user_id,
      tanggal,
      hst,
      jenis_masalah,
      tingkat_keparahan,
      catatan,
    } = req.body || {};

    if (
      !tanggal ||
      !jenis_masalah ||
      !catatan
    ) {
      return res.status(400).json({
        status: false,
        message:
          "Tanggal, jenis masalah, dan catatan wajib diisi.",
      });
    }

    const lahan = await getLahanById(
      lahan_id
    );

    if (!lahan) {
      return res.status(404).json({
        status: false,
        message: "Lahan tidak ditemukan.",
      });
    }

    const result = await query(
      `
        INSERT INTO laporan_masalah_lahan
        (
          lahan_id,
          user_id,
          tanggal,
          hst,
          jenis_masalah,
          tingkat_keparahan,
          catatan,
          status
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          'dilaporkan'
        )
      `,
      [
        lahan_id,
        user_id || null,
        tanggal,
        safeNumber(hst, 0),
        jenis_masalah,
        tingkat_keparahan || "sedang",
        catatan,
      ]
    );

    const eventType = [
      "hama",
      "penyakit",
    ].includes(jenis_masalah)
      ? "pengendalian_hama"
      : "pengamatan";

    await query(
      `
        INSERT INTO kalender_budidaya
        (
          lahan_id,
          user_id,
          nama_kegiatan,
          jenis,
          tanggal,
          hari_ke,
          fase_tanaman,
          waktu,
          metode,
          catatan,
          status,
          sumber,
          prioritas
        )
        VALUES (
          ?, ?, ?, ?, ?, ?,
          NULL,
          '08:00',
          ?, ?,
          'terjadwal',
          'laporan_petani',
          ?
        )
      `,
      [
        lahan_id,
        user_id || null,

        `Tindak Lanjut ${String(
          jenis_masalah
        ).replace(/_/g, " ")}`,

        eventType,
        tanggal,
        safeNumber(hst, 0),

        "Lakukan pemeriksaan lapangan dan tindak lanjut sesuai kondisi.",

        catatan,

        tingkat_keparahan === "tinggi"
          ? "tinggi"
          : "sedang",
      ]
    );

    await insertNotification({
      userId: user_id,
      title:
        "Laporan Masalah Lahan Disimpan",
      message:
        `Masalah ${jenis_masalah} telah masuk ke kalender tindak lanjut.`,
    });

    return res.json({
      status: true,
      message:
        "Laporan kondisi lahan berhasil disimpan.",
      id: result.insertId,
    });
  } catch (error) {
    console.log(
      "ERROR CREATE PROBLEM REPORT:",
      error.message
    );

    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};