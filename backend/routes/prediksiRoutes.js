const express = require("express");

const router = express.Router();

const prediksiController = require(
  "../controllers/prediksiController"
);

const analisisWilayahController = require(
  "../controllers/analisisWilayahController"
);

/*
|--------------------------------------------------------------------------
| MENJALANKAN PREDIKSI
|--------------------------------------------------------------------------
|
| POST /api/prediksi
|
*/

router.post(
  "/",
  prediksiController.prediksiPanen
);

/*
|--------------------------------------------------------------------------
| ROUTE STATIS
|--------------------------------------------------------------------------
|
| Semua route statis wajib berada sebelum route /:id.
|
*/

/*
|--------------------------------------------------------------------------
| RIWAYAT PREDIKSI
|--------------------------------------------------------------------------
|
| GET /api/prediksi/riwayat
|
*/

router.get(
  "/riwayat",
  prediksiController.getRiwayatPanen
);

/*
|--------------------------------------------------------------------------
| ANALISIS PERBANDINGAN WILAYAH
|--------------------------------------------------------------------------
|
| GET /api/prediksi/analisis-wilayah
|
| Contoh:
|
| /api/prediksi/analisis-wilayah
| ?sawah_id=1
| &prediksi_id=12
| &tanggal_prediksi=2026-07-04
|
*/

router.get(
  "/analisis-wilayah",
  analisisWilayahController
    .getAnalisisWilayah
);

/*
|--------------------------------------------------------------------------
| SEMUA DATA PREDIKSI
|--------------------------------------------------------------------------
|
| GET /api/prediksi
| GET /api/prediksi?petani_id=7
|
*/

router.get(
  "/",
  prediksiController.getPrediksi
);

/*
|--------------------------------------------------------------------------
| ROUTE DINAMIS
|--------------------------------------------------------------------------
|
| Route ini harus berada paling bawah.
|
*/

/*
|--------------------------------------------------------------------------
| DETAIL PREDIKSI
|--------------------------------------------------------------------------
|
| GET /api/prediksi/:id
|
*/

router.get(
  "/:id",
  prediksiController.getPrediksiById
);

/*
|--------------------------------------------------------------------------
| UPDATE PREDIKSI
|--------------------------------------------------------------------------
|
| PUT /api/prediksi/:id
|
*/

router.put(
  "/:id",
  prediksiController.updatePrediksi
);

/*
|--------------------------------------------------------------------------
| DELETE PREDIKSI
|--------------------------------------------------------------------------
|
| DELETE /api/prediksi/:id
|
*/

router.delete(
  "/:id",
  prediksiController.deletePrediksi
);

module.exports = router;