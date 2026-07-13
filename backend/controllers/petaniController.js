const db = require("../config/db");

// ======================================================
// DASHBOARD PETANI (JWT BASED - AMAN)
// ======================================================
exports.getDashboardPetani = (req, res) => {
  try {
    const userId = req.user.id;

    // ================= USER =================
    const userQuery = `
      SELECT id, nama, email, role
      FROM users
      WHERE id = ?
      LIMIT 1
    `;

    db.query(userQuery, [userId], (err, userResult) => {
      if (err) {
        return res.status(500).json({
          message: "Error user query"
        });
      }

      if (userResult.length === 0) {
        return res.status(404).json({
          message: "User tidak ditemukan"
        });
      }

      const user = userResult[0];

      // ================= LAHAN =================
      const lahanQuery = `
        SELECT * FROM lahan
        WHERE petani_id = ?
      `;

      db.query(lahanQuery, [userId], (err, lahanResult) => {
        if (err) {
          return res.status(500).json({
            message: "Error lahan query"
          });
        }

        return res.json({
          user,
          lahan: lahanResult,
          total_lahan: lahanResult.length
        });
      });
    });

  } catch (err) {
    return res.status(500).json({
      message: "Dashboard error"
    });
  }
};


// ======================================================
// GET PETANI BY ID (UNTUK FRONTEND DASHBOARD)
// ======================================================
exports.getPetaniById = (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT id, nama, email, role
    FROM users
    WHERE id = ?
    LIMIT 1
  `;

  db.query(sql, [id], (err, result) => {
    if (err) {
      return res.status(500).json({
        message: "Gagal ambil data petani"
      });
    }

    if (result.length === 0) {
      return res.status(404).json({
        message: "Petani tidak ditemukan"
      });
    }

    return res.json({
      message: "success",
      data: result[0]
    });
  });
};