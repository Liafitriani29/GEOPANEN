const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  try {
    // ================= AMBIL TOKEN =================
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "Token tidak ditemukan"
      });
    }

    // ================= CEK FORMAT =================
    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({
        message: "Format token salah (Bearer <token>)"
      });
    }

    const token = parts[1];

    // ================= VERIFY TOKEN =================
    const secret = process.env.JWT_SECRET || "geopanen_secret";

    const decoded = jwt.verify(token, secret);

    // ================= SIMPAN USER =================
    req.user = decoded;

    next();

  } catch (err) {
    return res.status(401).json({
      message: "Token tidak valid atau sudah expired"
    });
  }
};