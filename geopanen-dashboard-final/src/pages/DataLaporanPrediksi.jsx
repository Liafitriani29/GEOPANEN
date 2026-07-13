import { useEffect, useState } from "react";
import axios from "axios";

export default function DataLaporanPrediksi() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [sawahId, setSawahId] = useState(1);

  useEffect(() => {
    fetchData();
  }, [sawahId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `http://localhost:3000/api/prediksi?sawah_id=${sawahId}`
      );
      setData(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.log(err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const totalPanen = data.reduce(
    (acc, item) => acc + Number(item.prediksi_ton || 0),
    0
  );

  const avgPanen = data.length ? totalPanen / data.length : 0;

  const getStatus = (ton) => {
    if (ton >= 12) return { label: "High Yield", color: "#16a34a" };
    if (ton >= 8) return { label: "Normal", color: "#f59e0b" };
    return { label: "Low Yield", color: "#ef4444" };
  };

  return (
    <div style={styles.page}>

      {/* HEADER */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>🌾 Prediksi Panen AI</h2>
          <p style={styles.sub}>
            Analisis produktivitas lahan berbasis machine learning
          </p>
        </div>

        <button onClick={fetchData} style={styles.btn}>
          🔄 Refresh
        </button>
      </div>

      {/* FILTER */}
      <div style={styles.filter}>
        <label>Pilih Sawah:</label>
        <select
          value={sawahId}
          onChange={(e) => setSawahId(e.target.value)}
          style={styles.select}
        >
          <option value={1}>Sawah 1</option>
          <option value={2}>Sawah 2</option>
        </select>
      </div>

      {/* KPI SECTION */}
      <div style={styles.kpiGrid}>

        <div style={styles.kpiCard}>
          <p>Total Produksi</p>
          <h1>{totalPanen.toFixed(2)} Ton</h1>
        </div>

        <div style={styles.kpiCard}>
          <p>Rata-rata Panen</p>
          <h1>{avgPanen.toFixed(2)} Ton</h1>
        </div>

        <div style={styles.kpiCard}>
          <p>Total Dataset</p>
          <h1>{data.length}</h1>
        </div>

      </div>

      {/* CONTENT */}
      {loading ? (
        <div style={styles.loading}>Loading AI analysis...</div>
      ) : data.length === 0 ? (
        <div style={styles.loading}>Tidak ada data</div>
      ) : (
        <div style={styles.grid}>
          {data.map((item) => {
            const status = getStatus(item.prediksi_ton);

            return (
              <div
                key={item.id}
                style={styles.card}
                onClick={() => setSelected(item)}
              >

                {/* TOP */}
                <div style={styles.cardTop}>
                  <div>
                    <b>🌾 {item.nama_kecamatan}</b>
                    <p style={styles.small}>{item.varietas}</p>
                  </div>

                  <span
                    style={{
                      ...styles.badge,
                      background: status.color
                    }}
                  >
                    {status.label}
                  </span>
                </div>

                {/* HERO NUMBER */}
                <div style={styles.hero}>
                  {item.prediksi_ton} <span>Ton</span>
                </div>

                <div style={styles.meta}>
                  📏 {item.luas_m2} m² • 📍 {item.periode}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* INSIGHT PANEL */}
      <div style={styles.insight}>
        💡 <b>AI Insight:</b>{" "}
        {avgPanen > 10
          ? "Produktivitas lahan tergolong tinggi dan stabil"
          : "Produktivitas masih bisa ditingkatkan dengan optimasi pupuk"}
      </div>

      {/* MODAL */}
      {selected && (
        <div style={styles.modal}>
          <div style={styles.modalBox}>
            <h3>📌 Detail Analisis</h3>

            <p>🌾 Sawah: {selected.sawah_id}</p>
            <p>📍 Kecamatan: {selected.nama_kecamatan}</p>
            <p>🌱 Varietas: {selected.varietas}</p>
            <p>📏 Luas: {selected.luas_m2} m²</p>
            <p>📅 Periode: {selected.periode}</p>

            <hr />

            <h2 style={{ color: "#16a34a" }}>
              🎯 {selected.prediksi_ton} Ton
            </h2>

            <button
              onClick={() => setSelected(null)}
              style={styles.close}
            >
              Tutup
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

/* ================= STYLE (TA PREMIUM DASHBOARD) ================= */

const styles = {
  page: {
    padding: 28,
    background: "linear-gradient(135deg,#f5f7fb,#eef2ff)",
    minHeight: "100vh",
    fontFamily: "sans-serif"
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },

  title: {
    margin: 0,
    fontSize: 26,
    fontWeight: 800
  },

  sub: {
    margin: 0,
    color: "#6b7280",
    fontSize: 13
  },

  btn: {
    background: "linear-gradient(135deg,#16a34a,#22c55e)",
    border: "none",
    padding: "10px 16px",
    color: "white",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 600
  },

  filter: {
    marginTop: 15,
    marginBottom: 20
  },

  select: {
    marginLeft: 10,
    padding: 8,
    borderRadius: 8
  },

  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    gap: 12,
    marginBottom: 25
  },

  kpiCard: {
    background: "white",
    padding: 16,
    borderRadius: 16,
    boxShadow: "0 10px 25px rgba(0,0,0,0.05)"
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
    gap: 14
  },

  card: {
    background: "white",
    borderRadius: 18,
    padding: 18,
    cursor: "pointer",
    boxShadow: "0 12px 30px rgba(0,0,0,0.06)",
    transition: "0.2s"
  },

  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "start"
  },

  small: {
    fontSize: 12,
    color: "#6b7280",
    margin: 0
  },

  badge: {
    padding: "5px 10px",
    borderRadius: 999,
    color: "white",
    fontSize: 11
  },

  hero: {
    fontSize: 34,
    fontWeight: 900,
    marginTop: 10
  },

  meta: {
    fontSize: 12,
    color: "#6b7280"
  },

  loading: {
    padding: 20,
    background: "white",
    borderRadius: 12
  },

  insight: {
    marginTop: 20,
    background: "#ecfeff",
    padding: 14,
    borderRadius: 12
  },

  modal: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center"
  },

  modalBox: {
    background: "white",
    padding: 22,
    borderRadius: 16,
    width: 420
  },

  close: {
    marginTop: 10,
    background: "#ef4444",
    color: "white",
    border: "none",
    padding: "8px 12px",
    borderRadius: 10,
    cursor: "pointer"
  }
};