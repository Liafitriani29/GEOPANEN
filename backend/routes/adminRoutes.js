const express = require("express");
const router = express.Router();

const adminController = require("../controllers/adminController");
const lahanController = require("../controllers/lahanController");
const cuacaController = require("../controllers/cuacaController");
const kecamatanController = require("../controllers/kecamatanController");
const adminPrediksiController = require("../controllers/adminPrediksiController");

const safe = (fn) => (req, res, next) => {
  if (typeof fn !== "function") {
    return res.status(500).json({
      status: false,
      message: "Controller belum ter-load atau undefined",
    });
  }

  return fn(req, res, next);
};

// ================= PETANI =================
router.get("/petani/stats", safe(adminController.getPetaniStats));
router.post("/petani/import", safe(adminController.importPetani));

router.get("/petani", safe(adminController.getPetani));
router.get("/petani/:id", safe(adminController.getPetaniById));
router.post("/petani", safe(adminController.createPetani));
router.put("/petani/:id", safe(adminController.updatePetani));
router.delete("/petani/:id", safe(adminController.deletePetani));

// ================= KECAMATAN =================
router.get("/kecamatan", safe(kecamatanController.getKecamatan));
router.post("/kecamatan/import", safe(kecamatanController.importKecamatan));
router.post("/kecamatan", safe(kecamatanController.createKecamatan));
router.put("/kecamatan/:id", safe(kecamatanController.updateKecamatan));
router.delete("/kecamatan/:id", safe(kecamatanController.deleteKecamatan));

// ================= NOTIFIKASI =================
router.get(
  "/notifikasi/unread-count",
  safe(adminController.getUnreadNotificationCount)
);


// ================= LAHAN =================
router.get("/lahan/stats", safe(lahanController.getLahanStats));
router.post("/lahan/import", safe(lahanController.importLahan));

router.get("/lahan", safe(lahanController.getLahan));
router.post("/lahan", safe(lahanController.createLahan));
router.put("/lahan/:id", safe(lahanController.updateLahan));
router.delete("/lahan/:id", safe(lahanController.deleteLahan));

// ================= KECAMATAN =================
router.get("/kecamatan", safe(adminController.getKecamatan));
router.post("/kecamatan", safe(adminController.createKecamatan));
router.put("/kecamatan/:id", safe(adminController.updateKecamatan));
router.delete("/kecamatan/:id", safe(adminController.deleteKecamatan));

// ================= CUACA =================
router.get("/cuaca", safe(cuacaController.getCuaca));

// ================= PREDIKSI =================
router.post("/prediksi", safe(adminController.prediksiPanen));

router.get("/penyuluh", safe(adminController.getPenyuluh));
router.get("/desa", safe(adminController.getDesa));

router.get(
  "/prediksi/monitoring",
  adminPrediksiController.getMonitoringPrediksi
);
module.exports = router;