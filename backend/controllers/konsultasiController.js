const db = require("../config/db");

// =====================
// HELPER
// =====================
const isEmpty = (value) => {
  return value === undefined || value === null || value === "";
};

// =====================
// AMBIL PENYULUH DEFAULT
// =====================
const getDefaultPenyuluh = (callback) => {
  const sql = `
    SELECT id, nama, email
    FROM users
    WHERE role = 'penyuluh'
    ORDER BY id ASC
    LIMIT 1
  `;

  db.query(sql, (err, result) => {
    if (err) return callback(err, null);

    if (!result || result.length === 0) {
      return callback(null, null);
    }

    return callback(null, result[0]);
  });
};

// =====================
// BUAT KONSULTASI BARU
// PETANI
// =====================
exports.createKonsultasi = (req, res) => {
  const { petani_id, lahan_id, pesan, judul } = req.body;

  if (isEmpty(petani_id) || isEmpty(pesan)) {
    return res.status(400).json({
      message: "petani_id dan pesan wajib diisi",
    });
  }

  getDefaultPenyuluh((penyuluhErr, penyuluh) => {
    if (penyuluhErr) {
      return res.status(500).json({
        message: "Gagal mengambil data penyuluh",
        error: penyuluhErr.sqlMessage || penyuluhErr.message,
      });
    }

    const penyuluhId = penyuluh ? penyuluh.id : null;

    const konsultasiSql = `
      INSERT INTO konsultasi
      (petani_id, penyuluh_id, lahan_id, judul, status)
      VALUES (?, ?, ?, ?, 'open')
    `;

    db.query(
      konsultasiSql,
      [
        petani_id,
        penyuluhId,
        lahan_id || null,
        judul || "Konsultasi Tanaman",
      ],
      (err, result) => {
        if (err) {
          return res.status(500).json({
            message: "Gagal membuat konsultasi",
            error: err.sqlMessage || err.message,
          });
        }

        const konsultasiId = result.insertId;

        const pesanSql = `
          INSERT INTO pesan_konsultasi
          (konsultasi_id, sender_id, sender_role, pesan)
          VALUES (?, ?, 'petani', ?)
        `;

        db.query(pesanSql, [konsultasiId, petani_id, pesan], (pesanErr) => {
          if (pesanErr) {
            return res.status(500).json({
              message: "Konsultasi dibuat, tetapi pesan gagal disimpan",
              error: pesanErr.sqlMessage || pesanErr.message,
            });
          }

          return res.status(201).json({
            message: "Konsultasi berhasil dibuat",
            data: {
              id: konsultasiId,
              petani_id,
              penyuluh_id: penyuluhId,
              lahan_id: lahan_id || null,
              judul: judul || "Konsultasi Tanaman",
              status: "open",
            },
          });
        });
      }
    );
  });
};

// =====================
// LIST KONSULTASI PETANI
// =====================
exports.getKonsultasiPetani = (req, res) => {
  const { petani_id } = req.params;

  if (isEmpty(petani_id)) {
    return res.status(400).json({
      message: "petani_id wajib diisi",
      data: [],
    });
  }

  const sql = `
    SELECT 
      k.*,
      l.nama_lahan,
      l.varietas,
      u.nama AS nama_penyuluh,
      (
        SELECT pk.pesan
        FROM pesan_konsultasi pk
        WHERE pk.konsultasi_id = k.id
        ORDER BY pk.created_at DESC
        LIMIT 1
      ) AS pesan_terakhir
    FROM konsultasi k
    LEFT JOIN lahan l ON l.id = k.lahan_id
    LEFT JOIN users u ON u.id = k.penyuluh_id
    WHERE k.petani_id = ?
    ORDER BY k.updated_at DESC
  `;

  db.query(sql, [petani_id], (err, result) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal mengambil konsultasi petani",
        error: err.sqlMessage || err.message,
        data: [],
      });
    }

    return res.json({
      message: "success",
      data: result || [],
    });
  });
};

// =====================
// LIST KONSULTASI PENYULUH
// =====================
exports.getKonsultasiPenyuluh = (req, res) => {
  const { penyuluh_id } = req.params;

  if (isEmpty(penyuluh_id)) {
    return res.status(400).json({
      message: "penyuluh_id wajib diisi",
      data: [],
    });
  }

  const sql = `
    SELECT 
      k.*,
      l.nama_lahan,
      l.varietas,
      p.nama AS nama_petani,
      p.email AS email_petani,
      (
        SELECT pk.pesan
        FROM pesan_konsultasi pk
        WHERE pk.konsultasi_id = k.id
        ORDER BY pk.created_at DESC
        LIMIT 1
      ) AS pesan_terakhir
    FROM konsultasi k
    LEFT JOIN lahan l ON l.id = k.lahan_id
    LEFT JOIN users p ON p.id = k.petani_id
    WHERE k.penyuluh_id = ? OR k.penyuluh_id IS NULL
    ORDER BY k.updated_at DESC
  `;

  db.query(sql, [penyuluh_id], (err, result) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal mengambil konsultasi penyuluh",
        error: err.sqlMessage || err.message,
        data: [],
      });
    }

    return res.json({
      message: "success",
      data: result || [],
    });
  });
};

// =====================
// AMBIL PESAN DALAM KONSULTASI
// =====================
exports.getPesanKonsultasi = (req, res) => {
  const { konsultasi_id } = req.params;

  if (isEmpty(konsultasi_id)) {
    return res.status(400).json({
      message: "konsultasi_id wajib diisi",
      data: [],
    });
  }

  const sql = `
    SELECT 
      pk.*,
      u.nama AS nama_pengirim
    FROM pesan_konsultasi pk
    LEFT JOIN users u ON u.id = pk.sender_id
    WHERE pk.konsultasi_id = ?
    ORDER BY pk.created_at ASC
  `;

  db.query(sql, [konsultasi_id], (err, result) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal mengambil pesan konsultasi",
        error: err.sqlMessage || err.message,
        data: [],
      });
    }

    return res.json({
      message: "success",
      data: result || [],
    });
  });
};

// =====================
// KIRIM PESAN
// PETANI / PENYULUH
// =====================
exports.sendPesanKonsultasi = (req, res) => {
  const { konsultasi_id } = req.params;
  const { sender_id, sender_role, pesan } = req.body;

  if (
    isEmpty(konsultasi_id) ||
    isEmpty(sender_id) ||
    isEmpty(sender_role) ||
    isEmpty(pesan)
  ) {
    return res.status(400).json({
      message: "Data pesan belum lengkap",
    });
  }

  const pesanSql = `
    INSERT INTO pesan_konsultasi
    (konsultasi_id, sender_id, sender_role, pesan)
    VALUES (?, ?, ?, ?)
  `;

  db.query(
    pesanSql,
    [konsultasi_id, sender_id, sender_role, pesan],
    (err, result) => {
      if (err) {
        return res.status(500).json({
          message: "Gagal mengirim pesan",
          error: err.sqlMessage || err.message,
        });
      }

      const statusBaru = sender_role === "penyuluh" ? "dibalas" : "open";

      const updateSql = `
        UPDATE konsultasi
        SET status = ?, updated_at = NOW()
        WHERE id = ?
      `;

      db.query(updateSql, [statusBaru, konsultasi_id], (updateErr) => {
        if (updateErr) {
          return res.status(500).json({
            message: "Pesan terkirim, tetapi status gagal diperbarui",
            error: updateErr.sqlMessage || updateErr.message,
          });
        }

        return res.status(201).json({
          message: "Pesan berhasil dikirim",
          data: {
            id: result.insertId,
            konsultasi_id,
            sender_id,
            sender_role,
            pesan,
          },
        });
      });
    }
  );
};

// =====================
// SELESAIKAN KONSULTASI
// =====================
exports.selesaikanKonsultasi = (req, res) => {
  const { konsultasi_id } = req.params;

  if (isEmpty(konsultasi_id)) {
    return res.status(400).json({
      message: "konsultasi_id wajib diisi",
    });
  }

  const sql = `
    UPDATE konsultasi
    SET status = 'selesai', updated_at = NOW()
    WHERE id = ?
  `;

  db.query(sql, [konsultasi_id], (err) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal menyelesaikan konsultasi",
        error: err.sqlMessage || err.message,
      });
    }

    return res.json({
      message: "Konsultasi berhasil diselesaikan",
    });
  });
};