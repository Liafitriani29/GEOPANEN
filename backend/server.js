require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

/*
|--------------------------------------------------------------------------
| KONFIGURASI DASAR
|--------------------------------------------------------------------------
*/

app.disable("x-powered-by");

const PORT = Number(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";

/*
|--------------------------------------------------------------------------
| KONFIGURASI CORS
|--------------------------------------------------------------------------
*/

// Mendukung satu atau beberapa URL dari file .env.
// Beberapa URL dapat dipisahkan menggunakan koma.
const envOrigins = (
  process.env.FRONTEND_URLS ||
  process.env.FRONTEND_URL ||
  ""
)
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

const allowedOrigins = new Set([
  ...envOrigins,

  // Frontend Vite
  "http://localhost:5173",
  "http://127.0.0.1:5173",

  // Backend atau frontend yang berjalan di port 3000
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const corsOptions = {
  origin(origin, callback) {
    /*
     * Request tanpa origin berasal dari Postman, Thunder Client,
     * aplikasi mobile, curl, atau komunikasi server.
     */
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.replace(/\/$/, "");

    if (allowedOrigins.has(normalizedOrigin)) {
      return callback(null, true);
    }

    /*
     * Saat development, izinkan localhost dan 127.0.0.1
     * dengan port lokal apa pun.
     */
    const isLocalDevelopmentOrigin =
      NODE_ENV !== "production" &&
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(
        normalizedOrigin
      );

    if (isLocalDevelopmentOrigin) {
      return callback(null, true);
    }

    const corsError = new Error(
      `Origin ${origin} tidak diizinkan oleh konfigurasi CORS`
    );

    corsError.status = 403;

    return callback(corsError);
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Accept",
    "Origin",
    "X-Requested-With",
  ],

  exposedHeaders: ["Authorization"],

  optionsSuccessStatus: 204,
};

/*
|--------------------------------------------------------------------------
| MIDDLEWARE GLOBAL
|--------------------------------------------------------------------------
*/

app.use(cors(corsOptions));

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

/*
|--------------------------------------------------------------------------
| STATIC FILE
|--------------------------------------------------------------------------
*/

app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);

/*
|--------------------------------------------------------------------------
| DATABASE CONNECTION
|--------------------------------------------------------------------------
*/

require("./config/db");

/*
|--------------------------------------------------------------------------
| IMPORT ROUTES
|--------------------------------------------------------------------------
*/

// Auth dan pengguna
const authRoutes = require("./routes/authRoutes");
const petaniRoutes = require("./routes/petaniRoutes");
const adminRoutes = require("./routes/adminRoutes");

// Data utama
const lahanRoutes = require("./routes/lahanRoutes");
const sawahRoutes = require("./routes/sawahRoutes");
const kecamatanRoutes = require("./routes/kecamatanRoutes");
const desaRoutes = require("./routes/desaRoutes");

// Prediksi dan rekomendasi
const prediksiRoutes = require(
  "./routes/prediksiRoutes"
);
const rekomendasiRoutes = require("./routes/rekomendasiRoutes");
const rekomendasiPupukRoutes = require(
  "./routes/rekomendasiPupukRoutes"
);
const kalenderRoutes = require("./routes/kalenderRoutes");
const rekomendasiAiRoutes = require(
  "./routes/rekomendasiAiRoutes"
);

// Monitoring dan cuaca
const monitoringRoutes = require("./routes/monitoringRoutes");
const weatherRoutes = require("./routes/weatherRoutes");
const cuacaRoutes = require("./routes/cuacaRoutes");

// Dashboard dan laporan
const statistikRoutes = require("./routes/statistikRoutes");
const laporanRoutes = require("./routes/laporanRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

// Penyuluh
const mapBinaanRoutes = require("./routes/mapBinaanRoutes");
const petaniBinaanRoutes = require(
  "./routes/petaniBinaanRoutes"
);
const penyuluhRoutes = require("./routes/penyuluhRoutes");

const rekomendasiPenyuluhRoutes = require(
  "./routes/rekomendasiPenyuluhRoutes"
);

const catatanRoutes = require(
  "./routes/catatanRoutesPenyuluh"
);

const analisisProduksiRoutes = require(
  "./routes/analisisProduksiRoutes"
);

// Notifikasi dan konsultasi
const notifikasiRoutes = require(
  "./routes/notifikasiRoutes"
);

const templateNotifikasiRoutes = require(
  "./routes/templateNotifikasiRoutes"
);

const konsultasiRoutes = require(
  "./routes/konsultasiRoutes"
);

/*
|--------------------------------------------------------------------------
| HEALTH CHECK
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,
    status: "OK",
    message: "GeoPanen Backend Running Properly",
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: NODE_ENV,
  });
});

app.get("/api/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "GeoPanen API aktif",
    timestamp: new Date().toISOString(),
  });
});

/*
|--------------------------------------------------------------------------
| AUTH DAN USER
|--------------------------------------------------------------------------
*/

app.use("/api/auth", authRoutes);
app.use("/api/petani", petaniRoutes);
app.use("/api/admin", adminRoutes);

/*
|--------------------------------------------------------------------------
| DATA UTAMA
|--------------------------------------------------------------------------
*/

app.use("/api/lahan", lahanRoutes);
app.use("/api/sawah", sawahRoutes);
app.use("/api/kecamatan", kecamatanRoutes);
app.use("/api/desa", desaRoutes);

/*
|--------------------------------------------------------------------------
| PREDIKSI DAN REKOMENDASI
|--------------------------------------------------------------------------
*/

app.use(
  "/api/prediksi",
  prediksiRoutes
);
app.use("/api/pupuk", rekomendasiPupukRoutes);
app.use("/api/rekomendasi-ai", rekomendasiAiRoutes);

/*
|--------------------------------------------------------------------------
| KALENDER
|--------------------------------------------------------------------------
|
| Konfigurasi ini digunakan apabila kalenderRoutes berisi:
|
| router.get("/kalender", ...)
|
| Dengan demikian, endpoint akhirnya menjadi:
| GET /api/kalender
|
*/

app.use("/api", kalenderRoutes);

/*
|--------------------------------------------------------------------------
| MONITORING DAN CUACA
|--------------------------------------------------------------------------
*/

app.use("/api/monitoring", monitoringRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/cuaca", cuacaRoutes);

/*
|--------------------------------------------------------------------------
| DASHBOARD DAN LAPORAN
|--------------------------------------------------------------------------
*/

app.use("/api/statistik", statistikRoutes);
app.use("/api/laporan", laporanRoutes);

/*
|--------------------------------------------------------------------------
| PENYULUH
|--------------------------------------------------------------------------
*/

app.use("/api/map-binaan", mapBinaanRoutes);
app.use("/api/penyuluh/catatan", catatanRoutes);

app.use("/api/penyuluh", petaniBinaanRoutes);
app.use("/api/penyuluh", penyuluhRoutes);
app.use("/api/penyuluh", rekomendasiPenyuluhRoutes);
app.use("/api/penyuluh", analisisProduksiRoutes);

/*
|--------------------------------------------------------------------------
| NOTIFIKASI DAN KONSULTASI
|--------------------------------------------------------------------------
*/

app.use("/api/notifikasi", notifikasiRoutes);

app.use(
  "/api/notifikasi-template",
  templateNotifikasiRoutes
);

app.use("/api/konsultasi", konsultasiRoutes);

/*
|--------------------------------------------------------------------------
| ROUTE UMUM
|--------------------------------------------------------------------------
|
| Route yang dipasang langsung pada /api ditempatkan setelah
| route yang lebih spesifik.
|
*/

app.use("/api", rekomendasiRoutes);
app.use("/api", dashboardRoutes);

/*
|--------------------------------------------------------------------------
| 404 HANDLER
|--------------------------------------------------------------------------
*/

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "Endpoint tidak ditemukan",
    method: req.method,
    path: req.originalUrl,
  });
});

/*
|--------------------------------------------------------------------------
| GLOBAL ERROR HANDLER
|--------------------------------------------------------------------------
*/

app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);

  if (
    err.message?.includes(
      "tidak diizinkan oleh konfigurasi CORS"
    )
  ) {
    return res.status(403).json({
      success: false,
      message: "Akses ditolak oleh konfigurasi CORS",
      error: err.message,
    });
  }

  if (
    err instanceof SyntaxError &&
    err.status === 400 &&
    "body" in err
  ) {
    return res.status(400).json({
      success: false,
      message: "Format JSON tidak valid",
    });
  }

  return res.status(err.status || 500).json({
    success: false,
    message:
      err.message || "Terjadi kesalahan pada server",

    error:
      NODE_ENV === "development"
        ? err.stack
        : undefined,
  });
});

/*
|--------------------------------------------------------------------------
| START SERVER
|--------------------------------------------------------------------------
*/

const server = app.listen(PORT, () => {
  console.log("============================================");
  console.log(`GeoPanen Backend berjalan di port ${PORT}`);
  console.log(`Server: http://localhost:${PORT}`);
  console.log(
    `Health: http://localhost:${PORT}/api/health`
  );
  console.log(
    `Prediksi: http://localhost:${PORT}/api/prediksi`
  );
  console.log(
    `Environment: ${NODE_ENV}`
  );
  console.log(
    "CORS frontend: http://localhost:5173"
  );
  console.log("============================================");
});

/*
|--------------------------------------------------------------------------
| PENANGANAN ERROR SERVER
|--------------------------------------------------------------------------
*/

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} sedang digunakan aplikasi lain.`
    );

    process.exit(1);
  }

  console.error("SERVER LISTEN ERROR:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION:", error);
  process.exit(1);
});

module.exports = app;