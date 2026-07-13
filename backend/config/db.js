const mysql = require("mysql2");

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "geopanen_bimillah_fikss",
  port: Number(process.env.DB_PORT) || 3306,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

db.getConnection((err, connection) => {
  if (err) {
    console.error("Database gagal terkoneksi");
    console.error("Pesan error:", err.message);
    console.error("Kode error:", err.code);
    return;
  }

  console.log("Database berhasil terkoneksi");
  console.log("Database:", process.env.DB_NAME);

  connection.release();
});

module.exports = db;