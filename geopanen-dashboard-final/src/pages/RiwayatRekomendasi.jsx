import { useEffect, useState } from "react";
import axios from "axios";

export default function RiwayatRekomendasi() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const sawahId = 1;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `http://localhost:3000/api/rekomendasi/riwayat?sawah_id=${sawahId}`
      );

      setData(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.log(err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h2>📜 Riwayat Rekomendasi</h2>

        <button onClick={fetchData} style={styles.btn}>
          🔄 Refresh
        </button>
      </div>

      {loading ? (
        <div style={styles.loading}>Loading...</div>
      ) : data.length === 0 ? (
        <div style={styles.empty}>Belum ada rekomendasi</div>
      ) : (
        <div style={styles.grid}>
          {data.map((item) => (
            <div key={item.id} style={styles.card}>
              <div style={styles.top}>
                🌱 <b>{item.pupuk}</b>
                <span style={styles.badge}>{item.status}</span>
              </div>

              <p>💊 Dosis: {item.dosis} kg/ha</p>
              <p>📌 Alasan: {item.alasan}</p>
              <p>📅 Tanggal: {item.tanggal}</p>

              <button style={styles.actionBtn}>
                📌 Gunakan
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================= STYLE ================= */

const styles = {
  page: {
    padding: 20,
    background: "#f6f8fb",
    minHeight: "100vh"
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 20
  },

  btn: {
    background: "#16a34a",
    color: "white",
    border: "none",
    padding: "8px 12px",
    borderRadius: 8,
    cursor: "pointer"
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 15
  },

  card: {
    background: "white",
    padding: 15,
    borderRadius: 12,
    boxShadow: "0 6px 15px rgba(0,0,0,0.05)"
  },

  top: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 10
  },

  badge: {
    background: "#dcfce7",
    padding: "2px 8px",
    borderRadius: 8,
    fontSize: 12
  },

  actionBtn: {
    marginTop: 10,
    background: "#2563eb",
    color: "white",
    border: "none",
    padding: "6px 10px",
    borderRadius: 8,
    cursor: "pointer"
  },

  loading: {
    padding: 20
  },

  empty: {
    padding: 20,
    background: "white",
    borderRadius: 10
  }
};