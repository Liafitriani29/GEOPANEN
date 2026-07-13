const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const catatanController = require("../controllers/catatanController");

const uploadDir = path.join(__dirname, "../uploads/catatan");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => {
    cb(null, uploadDir);
  },
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `catatan-${Date.now()}${ext}`);
  },
});

const upload = multer({ storage });

router.get("/", catatanController.getAll);

router.get("/cuaca/latest", catatanController.getLatestWeather);

router.post("/upload", upload.single("file"), catatanController.uploadDokumentasi);

router.get("/:id", catatanController.getDetail);

router.post("/", catatanController.create);

router.put("/:id", catatanController.update);

router.delete("/:id", catatanController.delete);

module.exports = router;