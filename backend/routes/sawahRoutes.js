const express = require("express");
const router = express.Router();

const {
  tambahSawah,
  getSawah,
  getSawahById,
  updateSawah,
  deleteSawah,
} = require("../controllers/sawahController");

router.post("/", tambahSawah);
router.get("/", getSawah);
router.get("/:id", getSawahById);
router.put("/:id", updateSawah);
router.delete("/:id", deleteSawah);

module.exports = router;