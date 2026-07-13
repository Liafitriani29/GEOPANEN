import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://localhost:3000/api";
const AI_API = "http://127.0.0.1:8000";

export default function DatasetAI() {
  const [lahanList, setLahanList] = useState([]);
  const [hasilPrediksi, setHasilPrediksi] = useState([]);
  const [processingId, setProcessingId] = useState(null);

  // ================= FETCH DATA =================
  useEffect(() => {
    fetchLahan();
    fetchHasilPrediksi();
  }, []);

  const unwrap = (res) => {
    const data = res.data?.data || res.data;
    return Array.isArray(data) ? data : [];
  };

  const fetchLahan = async () => {
    try {
      const res = await axios.get(`${API}/lahan`);
      setLahanList(unwrap(res));
    } catch (err) {
      console.log("ERROR LAHAN:", err);
    }
  };

  const fetchHasilPrediksi = async () => {
    try {
      const res = await axios.get(`${API}/prediksi`);
      setHasilPrediksi(unwrap(res));
    } catch (err) {
      console.log("ERROR HASIL:", err);
    }
  };

  // ================= RUN AI (FIXED FULL FLOW) =================
  const handleRunAI = async (lahan) => {
    if (!lahan?.id) {
      alert("ID lahan tidak ditemukan");
      return;
    }

    const ok = confirm(`Jalankan AI untuk ${lahan.nama_lahan}?`);
    if (!ok) return;

    setProcessingId(lahan.id);

    try {
      console.log("RUN AI:", lahan);

      // 1. HIT NODE (INI YANG SUDAH BENAR)
      const res = await axios.post(`${API}/prediksi`, {
        sawah_id: lahan.id,
      });

      console.log("HASIL NODE + AI:", res.data);

      // 2. REFRESH DATA SETELAH SAVE OTOMATIS DI BACKEND
      await fetchHasilPrediksi();
      await fetchLahan();

    } catch (err) {
      console.log("ERROR RUN AI:", err.response?.data || err);
      alert(err.response?.data?.message || "Gagal menjalankan AI");
    }

    setProcessingId(null);
  };

  // ================= FORMAT =================
  const formatTon = (val) =>
    isNaN(Number(val)) ? "-" : Number(val).toFixed(2);

  const formatNumber = (val) =>
    isNaN(Number(val)) ? "-" : Number(val).toLocaleString("id-ID");

  // ================= UI =================
  return (
    <div style={styles.page}>
      <h2>🤖 Dataset AI Admin</h2>

      {/* ================= TABLE LAHAN ================= */}
      <div style={styles.card}>
        <h3>📍 Daftar Lahan Input AI</h3>

        <table style={styles.table}>
          <thead>
            <tr>
              <th>Nama</th>
              <th>Kecamatan</th>
              <th>Desa</th>
              <th>Luas</th>
              <th>Aksi</th>
            </tr>
          </thead>

          <tbody>
            {lahanList.map((l) => (
              <tr key={l.id}>
                <td>{l.nama_lahan}</td>
                <td>{l.nama_kecamatan}</td>
                <td>{l.nama_desa}</td>
                <td>{l.luas_m2}</td>
                <td>
                  <button
                    style={styles.button}
                    onClick={() => handleRunAI(l)}
                    disabled={processingId === l.id}
                  >
                    {processingId === l.id ? "Running..." : "Run AI"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ================= TABLE HASIL ================= */}
      <div style={styles.card}>
        <h3>📊 Hasil Prediksi Panen</h3>

        <table style={styles.table}>
          <thead>
            <tr>
              <th>Lahan</th>
              <th>Ton</th>
              <th>Kg</th>
              <th>Periode</th>
            </tr>
          </thead>

          <tbody>
            {hasilPrediksi.map((h, i) => (
              <tr key={i}>
                <td>{h.nama_lahan || "-"}</td>
                <td>{formatTon(h.prediksi_ton)}</td>
                <td>{formatNumber(h.prediksi_kg)}</td>
                <td>{h.periode || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ================= STYLE FIX ================= */}
      <style>{`
        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        th, td {
          padding: 10px;
          border-bottom: 1px solid #eee;
          text-align: left;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        th {
          background: #16a34a;
          color: white;
        }
      `}</style>
    </div>
  );
}

/* ================= STYLE ================= */
const styles = {
  page: {
    padding: 20,
    fontFamily: "Arial",
    background: "#f5f7fb",
  },

  card: {
    background: "white",
    padding: 15,
    marginBottom: 20,
    borderRadius: 10,
    boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
  },

  table: {
    width: "100%",
  },

  button: {
    padding: "6px 10px",
    background: "#0f766e",
    color: "white",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
  },
};