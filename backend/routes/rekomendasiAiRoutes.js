const express = require("express");
const router = express.Router();
const db = require("../config/db");

const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const getColumns = async (tableName) => {
  const rows = await query(`SHOW COLUMNS FROM \`${tableName}\``);
  return rows.map((row) => row.Field);
};

const hasColumn = (columns, name) => columns.includes(name);

const pickColumn = (columns, names) => {
  return names.find((name) => columns.includes(name)) || null;
};

const col = (name) => `\`${name}\``;

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeStatusKesehatan(value) {
  const raw = String(value || "").toLowerCase();

  if (raw.includes("kritis")) return "kritis";
  if (raw.includes("waspada")) return "waspada";
  if (raw.includes("perhatian")) return "waspada";
  if (raw.includes("rendah")) return "kritis";
  if (raw.includes("sehat")) return "sehat";
  if (raw.includes("baik")) return "sehat";

  return "sehat";
}

function buildGeneratedRecommendation(row) {
  const status = normalizeStatusKesehatan(row.status_kesehatan);
  const prediksi = safeNumber(row.prediksi_ton, 0);
  const skor = safeNumber(row.skor_kesehatan, 91);
  const curah = safeNumber(row.curah_hujan, 0);
  const umur = safeNumber(row.umur_tanam, 0);
  const fase = String(row.fase_tanam || "").toLowerCase();
  const varietas = row.varietas || "padi";

  let jenis = "Pemupukan";
  let prioritas = "Rendah";
  let rekomendasi = `Berikan pupuk sesuai kebutuhan tanaman pada ${row.fase_tanam || "fase vegetatif"}.`;

  if (status === "kritis") {
    jenis = "Pengendalian Penyakit";
    prioritas = "Tinggi";
    rekomendasi =
      "Cek gejala penyakit daun dan gunakan fungisida sesuai rekomendasi penyuluh.";
  } else if (status === "waspada") {
    jenis = "Pengendalian Hama";
    prioritas = "Tinggi";
    rekomendasi =
      "Pantau gejala hama dan lakukan pengendalian bila populasi meningkat.";
  } else if (curah < 5 && curah !== 0) {
    jenis = "Irigasi";
    prioritas = "Sedang";
    rekomendasi =
      "Tingkatkan pengairan karena kondisi lahan berpotensi mulai kering.";
  } else if (umur >= 90) {
    jenis = "Panen";
    prioritas = "Sedang";
    rekomendasi =
      "Siapkan panen dan validasi estimasi hasil sebelum tanggal panen.";
  } else if (prediksi > 0 && prediksi < 1) {
    jenis = "Pemupukan";
    prioritas = "Sedang";
    rekomendasi =
      "Evaluasi dosis pupuk NPK dan Urea karena prediksi produksi masih rendah.";
  } else if (fase.includes("generatif")) {
    jenis = "Pemupukan";
    prioritas = "Sedang";
    rekomendasi = `Berikan pemupukan korektif untuk ${varietas} dan pantau ulang dalam 3 hari.`;
  }

  if (skor < 55) prioritas = "Tinggi";
  else if (skor < 75 && prioritas !== "Tinggi") prioritas = "Sedang";

  return {
    jenis,
    prioritas,
    rekomendasi,
  };
}

async function insertNotifikasi({ user_id, role, tipe, judul, pesan }) {
  const columns = await getColumns("notifikasi");

  const pesanCol = pickColumn(columns, [
    "pesan",
    "message",
    "isi",
    "keterangan",
    "deskripsi",
  ]);

  const fields = [];
  const values = [];
  const params = [];

  if (hasColumn(columns, "user_id")) {
    fields.push("user_id");
    values.push("?");
    params.push(user_id);
  }

  if (hasColumn(columns, "role")) {
    fields.push("role");
    values.push("?");
    params.push(role || null);
  }

  if (hasColumn(columns, "tipe")) {
    fields.push("tipe");
    values.push("?");
    params.push(tipe || "aktivitas");
  }

  if (hasColumn(columns, "judul")) {
    fields.push("judul");
    values.push("?");
    params.push(judul || "Notifikasi Baru");
  }

  if (pesanCol) {
    fields.push(pesanCol);
    values.push("?");
    params.push(pesan || judul || "Aktivitas baru");
  }

  if (hasColumn(columns, "status")) {
    fields.push("status");
    values.push("?");
    params.push("baru");
  }

  if (hasColumn(columns, "status_kirim")) {
    fields.push("status_kirim");
    values.push("?");
    params.push("terkirim");
  }

  if (hasColumn(columns, "is_read")) {
    fields.push("is_read");
    values.push("?");
    params.push(0);
  }

  if (hasColumn(columns, "created_at")) {
    fields.push("created_at");
    values.push("NOW()");
  }

  if (hasColumn(columns, "updated_at")) {
    fields.push("updated_at");
    values.push("NOW()");
  }

  if (fields.length === 0) return null;

  const sql = `
    INSERT INTO notifikasi (${fields.map(col).join(", ")})
    VALUES (${values.join(", ")})
  `;

  return query(sql, params);
}

/* =====================================================
   GET LIST REKOMENDASI AI
   GET /api/rekomendasi-ai
===================================================== */
router.get("/", async (req, res) => {
  try {
    const {
      petani_id,
      penyuluh_id,
      status,
      status_kirim,
      jenis,
      kecamatan,
      desa,
      search,
      limit = 100,
    } = req.query;

    const where = [];
    const params = [];

    if (petani_id) {
      where.push("r.petani_id = ?");
      params.push(petani_id);
    }

    if (penyuluh_id) {
      where.push("r.penyuluh_id = ?");
      params.push(penyuluh_id);
    }

    if (status && status !== "all") {
      where.push("r.status = ?");
      params.push(status);
    }

    if (status_kirim && status_kirim !== "all") {
      where.push("r.status_kirim = ?");
      params.push(status_kirim);
    }

    if (jenis && jenis !== "all") {
      where.push("r.jenis = ?");
      params.push(jenis);
    }

    if (kecamatan && kecamatan !== "all") {
      where.push("k.nama_kecamatan = ?");
      params.push(kecamatan);
    }

    if (desa && desa !== "all") {
      where.push("d.nama_desa = ?");
      params.push(desa);
    }

    if (search) {
      where.push(`
        (
          u.nama LIKE ?
          OR l.nama_lahan LIKE ?
          OR r.jenis LIKE ?
          OR r.rekomendasi LIKE ?
        )
      `);

      const keyword = `%${search}%`;
      params.push(keyword, keyword, keyword, keyword);
    }

    let sql = `
      SELECT
        r.id,
        r.petani_id,
        r.lahan_id,
        r.penyuluh_id,
        r.jenis,
        r.rekomendasi,
        r.prioritas,
        r.status,
        r.status_kirim,
        r.tanggal_kirim,
        r.tanggal_diterapkan,
        r.created_at,
        r.updated_at,

        COALESCE(u.nama, 'Petani') AS nama_petani,
        COALESCE(u.email, '-') AS email_petani,

        COALESCE(l.nama_lahan, 'Lahan Binaan') AS nama_lahan,
        COALESCE(l.luas_ha, 0) AS luas_ha,
        COALESCE(l.varietas, 'Padi') AS varietas,

        COALESCE(d.nama_desa, '-') AS nama_desa,
        COALESCE(k.nama_kecamatan, '-') AS nama_kecamatan
      FROM rekomendasi_ai r
      LEFT JOIN users u ON u.id = r.petani_id
      LEFT JOIN lahan l ON l.id = r.lahan_id
      LEFT JOIN desa d ON d.id = l.desa_id
      LEFT JOIN kecamatan k ON k.id = l.kecamatan_id
    `;

    if (where.length > 0) {
      sql += ` WHERE ${where.join(" AND ")}`;
    }

    sql += `
      ORDER BY 
        FIELD(r.prioritas, 'Tinggi', 'Sedang', 'Rendah'),
        r.created_at DESC
      LIMIT ?
    `;

    params.push(Number(limit) || 100);

    const rows = await query(sql, params);

    res.json({
      status: true,
      message: "Rekomendasi AI berhasil diambil",
      data: rows,
    });
  } catch (err) {
    console.log("ERROR GET REKOMENDASI AI:", err);
    res.status(500).json({
      status: false,
      message: "Gagal mengambil rekomendasi AI",
      error: err.message,
    });
  }
});

/* =====================================================
   GENERATE REKOMENDASI DARI DATA LAHAN
   POST /api/rekomendasi-ai/generate
===================================================== */
router.post("/generate", async (req, res) => {
  try {
    const { penyuluh_id = null } = req.body || {};

    const rows = await query(`
      SELECT
        l.id AS lahan_id,
        COALESCE(l.user_id, l.petani_id) AS petani_id,
        COALESCE(l.nama_lahan, 'Lahan Binaan') AS nama_lahan,
        COALESCE(l.luas_ha, 0) AS luas_ha,
        COALESCE(l.varietas, 'Padi') AS varietas,

        COALESCE(mt.status_kesehatan, 'sehat') AS status_kesehatan,
        COALESCE(mt.umur_tanam, 0) AS umur_tanam,
        COALESCE(mt.fase_tanam, 'Vegetatif Awal') AS fase_tanam,
        COALESCE(mt.curah_hujan, 0) AS curah_hujan,

        COALESCE(p.prediksi_ton, 0) AS prediksi_ton,
        COALESCE(p.prediksi_kg, 0) AS prediksi_kg,

        CASE
          WHEN LOWER(COALESCE(mt.status_kesehatan, 'sehat')) = 'kritis' THEN 45
          WHEN LOWER(COALESCE(mt.status_kesehatan, 'sehat')) = 'waspada' THEN 62
          ELSE 91
        END AS skor_kesehatan
      FROM lahan l
      LEFT JOIN (
        SELECT m1.*
        FROM monitoring_tanaman m1
        INNER JOIN (
          SELECT sawah_id, MAX(id) AS max_id
          FROM monitoring_tanaman
          GROUP BY sawah_id
        ) mx ON mx.max_id = m1.id
      ) mt ON mt.sawah_id = l.id
      LEFT JOIN (
        SELECT p1.*
        FROM prediksi p1
        INNER JOIN (
          SELECT sawah_id, MAX(id) AS max_id
          FROM prediksi
          GROUP BY sawah_id
        ) px ON px.max_id = p1.id
      ) p ON p.sawah_id = l.id
      WHERE COALESCE(l.user_id, l.petani_id) IS NOT NULL
    `);

    let created = 0;
    let skipped = 0;

    for (const row of rows) {
      const petaniId = row.petani_id;
      const lahanId = row.lahan_id;

      if (!petaniId || !lahanId) {
        skipped += 1;
        continue;
      }

      const rec = buildGeneratedRecommendation(row);

      const existing = await query(
        `
        SELECT id
        FROM rekomendasi_ai
        WHERE petani_id = ?
          AND lahan_id = ?
          AND jenis = ?
          AND status IN ('Pending', 'Dikirim')
        LIMIT 1
        `,
        [petaniId, lahanId, rec.jenis]
      );

      if (existing.length > 0) {
        skipped += 1;
        continue;
      }

      await query(
        `
        INSERT INTO rekomendasi_ai
          (
            petani_id,
            lahan_id,
            penyuluh_id,
            jenis,
            rekomendasi,
            prioritas,
            status,
            status_kirim
          )
        VALUES
          (?, ?, ?, ?, ?, ?, 'Pending', 'pending')
        `,
        [
          petaniId,
          lahanId,
          penyuluh_id || null,
          rec.jenis,
          rec.rekomendasi,
          rec.prioritas,
        ]
      );

      created += 1;
    }

    res.json({
      status: true,
      message: "Generate rekomendasi selesai",
      data: {
        created,
        skipped,
        total_source: rows.length,
      },
    });
  } catch (err) {
    console.log("ERROR GENERATE REKOMENDASI:", err);
    res.status(500).json({
      status: false,
      message: "Gagal generate rekomendasi",
      error: err.message,
    });
  }
});

/* =====================================================
   CREATE REKOMENDASI MANUAL
   POST /api/rekomendasi-ai
===================================================== */
router.post("/", async (req, res) => {
  try {
    const {
      petani_id,
      lahan_id = null,
      penyuluh_id = null,
      jenis,
      rekomendasi,
      prioritas = "Sedang",
      status = "Pending",
    } = req.body;

    if (!petani_id) {
      return res.status(400).json({
        status: false,
        message: "petani_id wajib dikirim",
      });
    }

    if (!jenis) {
      return res.status(400).json({
        status: false,
        message: "jenis rekomendasi wajib dikirim",
      });
    }

    if (!rekomendasi) {
      return res.status(400).json({
        status: false,
        message: "isi rekomendasi wajib dikirim",
      });
    }

    const allowedPrioritas = ["Rendah", "Sedang", "Tinggi"];
    const finalPrioritas = allowedPrioritas.includes(prioritas)
      ? prioritas
      : "Sedang";

    const allowedStatus = ["Pending", "Dikirim", "Diterapkan"];
    const finalStatus = allowedStatus.includes(status) ? status : "Pending";

    const result = await query(
      `
      INSERT INTO rekomendasi_ai
        (
          petani_id,
          lahan_id,
          penyuluh_id,
          jenis,
          rekomendasi,
          prioritas,
          status,
          status_kirim,
          tanggal_kirim,
          tanggal_diterapkan
        )
      VALUES
        (
          ?, ?, ?, ?, ?, ?, ?,
          ?,
          ${finalStatus === "Dikirim" ? "NOW()" : "NULL"},
          ${finalStatus === "Diterapkan" ? "NOW()" : "NULL"}
        )
      `,
      [
        petani_id,
        lahan_id || null,
        penyuluh_id || null,
        jenis,
        rekomendasi,
        finalPrioritas,
        finalStatus,
        finalStatus === "Dikirim" ? "terkirim" : "pending",
      ]
    );

    if (finalStatus === "Dikirim") {
      await insertNotifikasi({
        user_id: petani_id,
        role: "petani",
        tipe: "rekomendasi_ai",
        judul: "Rekomendasi Baru",
        pesan: `${jenis}: ${rekomendasi}`,
      });
    }

    res.status(201).json({
      status: true,
      message: "Rekomendasi AI berhasil dibuat",
      data: {
        id: result.insertId,
        petani_id,
        lahan_id,
        penyuluh_id,
        jenis,
        rekomendasi,
        prioritas: finalPrioritas,
        status: finalStatus,
        status_kirim: finalStatus === "Dikirim" ? "terkirim" : "pending",
      },
    });
  } catch (err) {
    console.log("ERROR CREATE REKOMENDASI AI:", err);
    res.status(500).json({
      status: false,
      message: "Gagal membuat rekomendasi AI",
      error: err.message,
    });
  }
});

/* =====================================================
   UPDATE REKOMENDASI
   PUT /api/rekomendasi-ai/:id
===================================================== */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      jenis,
      rekomendasi,
      prioritas,
      status,
      petani_id,
      lahan_id,
      penyuluh_id,
    } = req.body;

    const sets = [];
    const params = [];

    if (petani_id !== undefined) {
      sets.push("petani_id = ?");
      params.push(petani_id || null);
    }

    if (lahan_id !== undefined) {
      sets.push("lahan_id = ?");
      params.push(lahan_id || null);
    }

    if (penyuluh_id !== undefined) {
      sets.push("penyuluh_id = ?");
      params.push(penyuluh_id || null);
    }

    if (jenis !== undefined) {
      sets.push("jenis = ?");
      params.push(jenis);
    }

    if (rekomendasi !== undefined) {
      sets.push("rekomendasi = ?");
      params.push(rekomendasi);
    }

    if (prioritas !== undefined) {
      sets.push("prioritas = ?");
      params.push(prioritas);
    }

    if (status !== undefined) {
      sets.push("status = ?");
      params.push(status);
    }

    sets.push("updated_at = NOW()");

    if (sets.length === 1) {
      return res.status(400).json({
        status: false,
        message: "Tidak ada data yang diupdate",
      });
    }

    params.push(id);

    await query(
      `
      UPDATE rekomendasi_ai
      SET ${sets.join(", ")}
      WHERE id = ?
      `,
      params
    );

    res.json({
      status: true,
      message: "Rekomendasi AI berhasil diperbarui",
    });
  } catch (err) {
    console.log("ERROR UPDATE REKOMENDASI AI:", err);
    res.status(500).json({
      status: false,
      message: "Gagal update rekomendasi AI",
      error: err.message,
    });
  }
});

/* =====================================================
   KIRIM KE PETANI
   PUT /api/rekomendasi-ai/:id/kirim
===================================================== */
router.put("/:id/kirim", async (req, res) => {
  try {
    const { id } = req.params;

    const rows = await query(
      `
      SELECT
        r.*,
        COALESCE(l.nama_lahan, 'Lahan Binaan') AS nama_lahan
      FROM rekomendasi_ai r
      LEFT JOIN lahan l ON l.id = r.lahan_id
      WHERE r.id = ?
      LIMIT 1
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        status: false,
        message: "Rekomendasi tidak ditemukan",
      });
    }

    const r = rows[0];

    if (r.status === "Dikirim" && r.status_kirim === "terkirim") {
      return res.json({
        status: true,
        message: "Rekomendasi sudah pernah dikirim",
        data: r,
      });
    }

    await query(
      `
      UPDATE rekomendasi_ai
      SET status = 'Dikirim',
          status_kirim = 'terkirim',
          tanggal_kirim = NOW(),
          updated_at = NOW()
      WHERE id = ?
      `,
      [id]
    );

    await insertNotifikasi({
      user_id: r.petani_id,
      role: "petani",
      tipe: "rekomendasi_ai",
      judul: "Rekomendasi Baru",
      pesan: `${r.jenis} untuk ${r.nama_lahan}: ${r.rekomendasi}`,
    });

    res.json({
      status: true,
      message: "Rekomendasi berhasil dikirim ke petani",
      data: {
        id,
        petani_id: r.petani_id,
        status: "Dikirim",
        status_kirim: "terkirim",
      },
    });
  } catch (err) {
    console.log("ERROR KIRIM REKOMENDASI:", err);
    res.status(500).json({
      status: false,
      message: "Gagal mengirim rekomendasi",
      error: err.message,
    });
  }
});

/* =====================================================
   TANDAI DITERAPKAN
   PUT /api/rekomendasi-ai/:id/terapkan
===================================================== */
router.put("/:id/terapkan", async (req, res) => {
  try {
    const { id } = req.params;

    await query(
      `
      UPDATE rekomendasi_ai
      SET status = 'Diterapkan',
          tanggal_diterapkan = NOW(),
          updated_at = NOW()
      WHERE id = ?
      `,
      [id]
    );

    res.json({
      status: true,
      message: "Rekomendasi berhasil ditandai diterapkan",
      data: {
        id,
        status: "Diterapkan",
      },
    });
  } catch (err) {
    console.log("ERROR TERAPKAN REKOMENDASI:", err);
    res.status(500).json({
      status: false,
      message: "Gagal menandai rekomendasi diterapkan",
      error: err.message,
    });
  }
});

/* =====================================================
   HAPUS REKOMENDASI
   DELETE /api/rekomendasi-ai/:id
===================================================== */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    await query("DELETE FROM rekomendasi_ai WHERE id = ?", [id]);

    res.json({
      status: true,
      message: "Rekomendasi berhasil dihapus",
    });
  } catch (err) {
    console.log("ERROR DELETE REKOMENDASI AI:", err);
    res.status(500).json({
      status: false,
      message: "Gagal menghapus rekomendasi AI",
      error: err.message,
    });
  }
});

module.exports = router;