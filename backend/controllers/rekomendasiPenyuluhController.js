const axios = require("axios");

const FASTAPI = "http://127.0.0.1:8000";

exports.getRekomendasiPenyuluh = async (req, res) => {
  try {
    const { id } = req.params;

    const response = await axios.get(
      `${FASTAPI}/penyuluh/rekomendasi/${id}`
    );

    return res.json(response.data);

  } catch (error) {
    console.log("FastAPI error:", error.message);

    return res.status(500).json({
      status: "error",
      message: "Gagal mengambil rekomendasi dari AI"
    });
  }
};