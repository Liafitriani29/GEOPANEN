"use strict";

const express = require("express");

const router = express.Router();

const kalenderController = require("../controllers/kalenderController");
const monitoringFaseController = require("../controllers/monitoringFaseController");

// =====================================================
// KALENDER PETANI
// Route statis harus ditempatkan sebelum /kalender/:lahan_id.
// =====================================================
router.get("/kalender", kalenderController.getKalenderByPetani);
router.get("/kalender/petani", kalenderController.getKalenderByPetani);

// =====================================================
// OVERVIEW HARIAN MODEL FLO
// GET /api/kalender/:lahan_id/overview?tanggal=2026-07-04&bulan=2026-07
// =====================================================
router.get(
  "/kalender/:lahan_id/overview",
  kalenderController.getKalenderOverview
);

// =====================================================
// CUACA OTOMATIS BERDASARKAN KOORDINAT LAHAN
// GET /api/kalender/:lahan_id/cuaca?user_id=7
// =====================================================
router.get(
  "/kalender/:lahan_id/cuaca",
  kalenderController.getCuacaLahan
);

// =====================================================
// MONITORING HARIAN
// GET  /api/kalender/:lahan_id/monitoring-harian?tanggal=2026-07-04
// POST /api/kalender/:lahan_id/monitoring-harian
// =====================================================
router.get(
  "/kalender/:lahan_id/monitoring-harian",
  kalenderController.getMonitoringKalender
);

router.post(
  "/kalender/:lahan_id/monitoring-harian",
  kalenderController.createMonitoringKalender
);

// Alias lama jika nanti masih dipakai oleh frontend lain.
router.get(
  "/kalender/:lahan_id/monitoring",
  kalenderController.getMonitoringKalender
);

router.post(
  "/kalender/:lahan_id/monitoring",
  kalenderController.createMonitoringKalender
);

// =====================================================
// MONITORING FASE TANAMAN
// HST 30, 60, 90, dan 110.
// =====================================================
router.get(
  "/kalender/:lahan_id/monitoring-fase",
  monitoringFaseController.listMonitoringFase
);

router.get(
  "/kalender/:lahan_id/monitoring-fase/:hst_target",
  monitoringFaseController.getMonitoringFase
);

router.post(
  "/kalender/:lahan_id/monitoring-fase",
  monitoringFaseController.saveMonitoringFase
);

// =====================================================
// LAPORAN MASALAH
// =====================================================
router.post(
  "/kalender/:lahan_id/laporan-masalah",
  monitoringFaseController.createProblemReport
);

// =====================================================
// GENERATE / REFRESH JADWAL
// =====================================================
router.post(
  "/kalender/:lahan_id/generate",
  kalenderController.generateKalenderByLahan
);

// Alias yang lebih jelas untuk frontend baru.
router.post(
  "/kalender/:lahan_id/regenerate",
  kalenderController.generateKalenderByLahan
);

// =====================================================
// CREATE JADWAL MANUAL
// Harus sebelum GET /kalender/:lahan_id, tetapi tidak konflik karena method POST.
// =====================================================
router.post("/kalender", kalenderController.createKalender);

// =====================================================
// AKSI KEGIATAN KALENDER
// =====================================================
router.patch(
  "/kalender/:id/reschedule",
  kalenderController.rescheduleKalender
);

router.patch(
  "/kalender/:id/status",
  kalenderController.updateStatusKalender
);

router.put(
  "/kalender/:id/selesai",
  kalenderController.selesaiKalender
);

router.delete("/kalender/:id", kalenderController.deleteKalender);

// =====================================================
// GET KALENDER BERDASARKAN LAHAN
// Route dinamis ini wajib diletakkan paling bawah.
// =====================================================
router.get("/kalender/:lahan_id", kalenderController.getKalenderByLahan);

module.exports = router;
