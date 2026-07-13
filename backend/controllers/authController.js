const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "geopanen_secret";

// =====================
// LOGIN
// =====================
exports.login = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email dan password wajib diisi",
    });
  }

  const emailFinal = String(email).trim().toLowerCase();

  db.query(
    `
      SELECT 
        id, 
        nama, 
        email, 
        password, 
        role, 
        no_hp, 
        status
      FROM users 
      WHERE email = ? 
      LIMIT 1
    `,
    [emailFinal],
    async (err, result) => {
      if (err) {
        return res.status(500).json({
          success: false,
          message: "Terjadi kesalahan server",
          error: err.message,
        });
      }

      if (result.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User tidak ditemukan",
        });
      }

      const user = result[0];

      if (user.status && String(user.status).toLowerCase() !== "aktif") {
        return res.status(403).json({
          success: false,
          message: "Akun tidak aktif",
        });
      }

      const match = await bcrypt.compare(password, user.password);

      if (!match) {
        return res.status(400).json({
          success: false,
          message: "Password salah",
        });
      }

      const token = jwt.sign(
        {
          id: user.id,
          role: user.role || "petani",
        },
        JWT_SECRET,
        {
          expiresIn: "1d",
        }
      );

      const safeUser = {
        id: user.id,
        nama: user.nama,
        email: user.email,
        role: user.role || "petani",
        no_hp: user.no_hp || null,
        status: user.status || "aktif",
      };

      // Update last_login agar statistik penyuluh login hari ini bisa dinamis
      db.query(
        "UPDATE users SET last_login = NOW() WHERE id = ?",
        [user.id],
        (updateErr) => {
          if (updateErr) {
            console.log("GAGAL UPDATE LAST LOGIN:", updateErr.message);
          }

          return res.json({
            success: true,
            message: "Login berhasil",
            token,
            user: safeUser,
          });
        }
      );
    }
  );
};

// =====================
// REGISTER PETANI
// =====================
exports.register = (req, res) => {
  const {
    nama,
    email,
    password,
    no_hp,
    nomor_hp,
  } = req.body;

  const namaFinal = String(nama || "").trim();
  const emailFinal = String(email || "").trim().toLowerCase();
  const passwordFinal = String(password || "");
  const noHpFinal = String(no_hp || nomor_hp || "").trim() || null;

  if (!namaFinal || !emailFinal || !passwordFinal) {
    return res.status(400).json({
      success: false,
      message: "Nama, email, dan password wajib diisi",
    });
  }

  if (passwordFinal.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Password minimal 6 karakter",
    });
  }

  // Register umum wajib menjadi petani.
  // Jangan ambil role dari frontend agar user baru tidak masuk sebagai admin.
  const role = "petani";
  const status = "aktif";

  db.query(
    "SELECT id FROM users WHERE email = ? LIMIT 1",
    [emailFinal],
    (checkErr, checkResult) => {
      if (checkErr) {
        return res.status(500).json({
          success: false,
          message: "Gagal mengecek email",
          error: checkErr.message,
        });
      }

      if (checkResult.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Email sudah terdaftar",
        });
      }

      bcrypt.hash(passwordFinal, 10, (hashErr, hash) => {
        if (hashErr) {
          return res.status(500).json({
            success: false,
            message: "Gagal mengenkripsi password",
            error: hashErr.message,
          });
        }

        db.query(
          `
            INSERT INTO users 
            (nama, email, password, role, no_hp, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
          `,
          [namaFinal, emailFinal, hash, role, noHpFinal, status],
          (insertErr, result) => {
            if (insertErr) {
              return res.status(500).json({
                success: false,
                message: "Register gagal",
                error: insertErr.message,
              });
            }

            return res.status(201).json({
              success: true,
              message: "Register berhasil. Silakan login.",
              user: {
                id: result.insertId,
                nama: namaFinal,
                email: emailFinal,
                role,
                no_hp: noHpFinal,
                status,
              },
            });
          }
        );
      });
    }
  );
};