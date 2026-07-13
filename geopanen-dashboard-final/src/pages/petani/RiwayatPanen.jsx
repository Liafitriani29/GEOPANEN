import { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";

const STATUS_COLOR = {
  AMAN: "#16a34a",
  WASPADA: "#f59e0b",
  KRITIS: "#ef4444",
};

const PIE_COLORS = ["#16a34a", "#f59e0b", "#ef4444"];

const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const normalizeApiList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const formatNumber = (value, digit = 2) => {
  return toNumber(value).toLocaleString("id-ID", {
    minimumFractionDigits: digit,
    maximumFractionDigits: digit,
  });
};

const formatTanggal = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const normalizeStatus = (item) => {
  const raw = String(
    item.status ||
      item.status_risiko ||
      item.tingkat_risiko ||
      item.kondisi ||
      ""
  ).toUpperCase();

  if (raw.includes("KRITIS") || raw.includes("TINGGI")) return "KRITIS";
  if (raw.includes("WASPADA") || raw.includes("SEDANG")) return "WASPADA";

  if (raw.includes("AMAN") || raw.includes("RENDAH") || raw.includes("SEHAT")) {
    return "AMAN";
  }

  const riskScore = toNumber(item.risk_score || item.skor_risiko);

  if (riskScore >= 70) return "KRITIS";
  if (riskScore >= 40) return "WASPADA";

  const prediksi = toNumber(
    item.prediksi_ton ||
      item.prediksi ||
      item.hasil_panen ||
      item.produksi_ton ||
      item.estimasi_ton
  );

  if (prediksi > 0 && prediksi < 3) return "WASPADA";
  if (prediksi >= 3 && prediksi < 5) return "WASPADA";

  return "AMAN";
};

const normalizeItem = (item, index) => {
  const lahanId =
    item.lahan_id ||
    item.sawah_id ||
    item.id_lahan ||
    item.sawahId ||
    item.lahanId ||
    "-";

  const prediksiTon = toNumber(
    item.prediksi_ton ||
      item.prediksi ||
      item.hasil_panen ||
      item.produksi_ton ||
      item.estimasi_ton
  );

  const prediksiKg = toNumber(item.prediksi_kg || prediksiTon * 1000);

  const status = normalizeStatus(item);

  return {
    id: item.id || `${lahanId}-${index}`,
    lahan_id: lahanId,
    nama_lahan:
      item.nama_lahan ||
      item.lahan ||
      item.nama_sawah ||
      item.nama ||
      `Lahan ${lahanId}`,
    varietas: item.varietas || item.varietas_prediksi || "-",
    kecamatan: item.nama_kecamatan || "-",
    desa: item.nama_desa || "-",
    periode: item.periode || item.tahun || "-",
    tanggal:
      item.created_at ||
      item.tanggal_prediksi ||
      item.tanggal ||
      item.updated_at ||
      null,
    prediksi_ton: prediksiTon,
    prediksi_kg: prediksiKg,
    status,
    risk_score: toNumber(item.risk_score || item.skor_risiko),
    rekomendasi: item.rekomendasi || item.catatan || "-",
  };
};

/* =====================================================
   FIX UTAMA:
   Ambil 1 data terbaru untuk setiap lahan_id.
   Jadi sawah barat dan sawah timur tidak dobel.
===================================================== */
const uniqueLatestByLahan = (rows = []) => {
  const map = new Map();

  rows.forEach((item) => {
    const key = String(item.lahan_id || "");

    if (!key || key === "-") return;

    const existing = map.get(key);

    const itemTime = new Date(item.tanggal || 0).getTime();
    const existingTime = existing
      ? new Date(existing.tanggal || 0).getTime()
      : -1;

    const itemId = Number(item.id || 0);
    const existingId = Number(existing?.id || 0);

    if (
      !existing ||
      itemTime > existingTime ||
      (itemTime === existingTime && itemId > existingId)
    ) {
      map.set(key, item);
    }
  });

  return Array.from(map.values());
};

export default function RiwayatPanen() {
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("-");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("SEMUA");

  const storedUser = getUser();

  const userId =
    localStorage.getItem("user_id") ||
    localStorage.getItem("petani_id") ||
    storedUser?.id;

  useEffect(() => {
    fetchData();
  }, []);

  /* =====================================================
     FIX BAGIAN DATA:
     rawData dinormalisasi dulu, lalu dibuat unik per lahan.
  ===================================================== */
  const data = useMemo(() => {
    const normalized = rawData.map(normalizeItem);
    return uniqueLatestByLahan(normalized);
  }, [rawData]);

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const keyword = search.toLowerCase().trim();

      const matchSearch =
        !keyword ||
        item.nama_lahan.toLowerCase().includes(keyword) ||
        String(item.lahan_id).toLowerCase().includes(keyword) ||
        item.varietas.toLowerCase().includes(keyword) ||
        item.kecamatan.toLowerCase().includes(keyword) ||
        item.desa.toLowerCase().includes(keyword);

      const matchStatus =
        statusFilter === "SEMUA" || item.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [data, search, statusFilter]);

  const total = data.length;
  const aman = data.filter((d) => d.status === "AMAN").length;
  const waspada = data.filter((d) => d.status === "WASPADA").length;
  const kritis = data.filter((d) => d.status === "KRITIS").length;

  const totalPrediksi = data.reduce((sum, item) => sum + item.prediksi_ton, 0);
  const rataPrediksi = total > 0 ? totalPrediksi / total : 0;

  const pieData = [
    { name: "AMAN", value: aman },
    { name: "WASPADA", value: waspada },
    { name: "KRITIS", value: kritis },
  ];

  const chartData = filteredData.map((item) => ({
    ...item,
    label:
      item.nama_lahan.length > 12
        ? `${item.nama_lahan.slice(0, 12)}...`
        : item.nama_lahan,
  }));

  async function fetchData() {
    try {
      setLoading(true);
      setError("");

      if (!userId) {
        setRawData([]);
        setError("User login tidak ditemukan. Silakan login ulang.");
        setSource("User tidak ditemukan");
        return;
      }

      const nodeRes = await api.get("/prediksi", {
        params: {
          petani_id: userId,
          user_id: userId,
        },
      });

      const nodeData = normalizeApiList(nodeRes.data);

      setRawData(nodeData);
      setSource(`Backend Node.js · Petani ID ${userId}`);
    } catch (err) {
      console.log("ERROR RIWAYAT PANEN:", err.response?.data || err.message);
      setRawData([]);
      setError("Gagal memuat riwayat panen milik petani login.");
      setSource("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>🌾 Riwayat Panen</h1>
          <p style={styles.sub}>
            Data prediksi panen terbaru berdasarkan setiap lahan milik akun petani.
          </p>
        </div>

        <div style={styles.headerActions}>
          <div style={styles.sourceBadge}>{source}</div>

          <button onClick={fetchData} style={styles.refreshButton}>
            🔄 Refresh Data
          </button>
        </div>
      </div>

      <div style={styles.kpiRow}>
        <KPI
          icon="📦"
          label="Total Lahan"
          value={total}
          sub="prediksi terbaru per lahan"
          color="#64748b"
          bg="#f8fafc"
        />

        <KPI
          icon="✅"
          label="AMAN"
          value={aman}
          sub="kondisi rendah risiko"
          color="#16a34a"
          bg="#ecfdf5"
        />

        <KPI
          icon="⚠️"
          label="WASPADA"
          value={waspada}
          sub="perlu pemantauan"
          color="#f59e0b"
          bg="#fffbeb"
        />

        <KPI
          icon="🚨"
          label="KRITIS"
          value={kritis}
          sub="perlu tindakan cepat"
          color="#ef4444"
          bg="#fef2f2"
        />
      </div>

      <div style={styles.kpiRowTwo}>
        <div style={styles.summaryWideCard}>
          <div>
            <p>Total Estimasi Produksi</p>
            <h2>{formatNumber(totalPrediksi, 2)} Ton</h2>
            <small>
              Akumulasi prediksi terbaru dari setiap lahan milik petani login.
            </small>
          </div>

          <div style={styles.bigIcon}>🌾</div>
        </div>

        <div style={styles.summaryWideCard}>
          <div>
            <p>Rata-rata Prediksi</p>
            <h2>{formatNumber(rataPrediksi, 2)} Ton</h2>
            <small>Rata-rata estimasi hasil dari lahan yang tersedia.</small>
          </div>

          <div style={styles.bigIcon}>📈</div>
        </div>
      </div>

      <div style={styles.toolbar}>
        <div>
          <h3 style={styles.toolbarTitle}>Data Riwayat Panen</h3>
          <p style={styles.toolbarSub}>
            Data sudah difilter agar hanya menampilkan prediksi terbaru per lahan.
          </p>
        </div>

        <div style={styles.toolbarActions}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={styles.select}
          >
            <option value="SEMUA">Semua Status</option>
            <option value="AMAN">AMAN</option>
            <option value="WASPADA">WASPADA</option>
            <option value="KRITIS">KRITIS</option>
          </select>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari lahan / varietas..."
            style={styles.searchInput}
          />
        </div>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      {loading ? (
        <div style={styles.loadingBox}>Memuat riwayat panen...</div>
      ) : (
        <>
          <div style={styles.grid}>
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <h3>📊 Distribusi Prediksi Panen</h3>
                  <p>Grafik estimasi produksi terbaru setiap lahan milik petani.</p>
                </div>
              </div>

              {chartData.length === 0 ? (
                <div style={styles.emptyChart}>
                  Belum ada data prediksi panen. Jalankan prediksi terlebih
                  dahulu dari menu Prediksi Panen.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => [
                        `${formatNumber(value, 2)} Ton`,
                        "Prediksi",
                      ]}
                      labelFormatter={(label) => `Lahan: ${label}`}
                    />
                    <Bar
                      dataKey="prediksi_ton"
                      fill="#16a34a"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <h3>🎯 Status Risiko Lahan</h3>
                  <p>Perbandingan status AMAN, WASPADA, dan KRITIS.</p>
                </div>
              </div>

              {total === 0 ? (
                <div style={styles.emptyChart}>
                  Status belum tersedia karena belum ada riwayat prediksi.
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={95}
                        innerRadius={55}
                        paddingAngle={5}
                        label
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>

                  <div style={styles.legendList}>
                    {pieData.map((item, index) => (
                      <div key={item.name} style={styles.legendItem}>
                        <span
                          style={{
                            ...styles.legendDot,
                            background: PIE_COLORS[index],
                          }}
                        />
                        <span>{item.name}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div style={styles.listCard}>
            <div style={styles.cardHeader}>
              <div>
                <h3>📋 Daftar Riwayat Panen</h3>
                <p>
                  Menampilkan {filteredData.length} dari {data.length} lahan.
                </p>
              </div>
            </div>

            {filteredData.length === 0 ? (
              <div style={styles.emptyBox}>
                Belum ada data riwayat panen untuk akun petani ini.
              </div>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Lahan</th>
                      <th>Lokasi</th>
                      <th>Varietas</th>
                      <th>Prediksi</th>
                      <th>Periode</th>
                      <th>Tanggal</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredData.map((item, index) => (
                      <tr key={`${item.lahan_id}-${item.id}`}>
                        <td>{index + 1}</td>

                        <td>
                          <strong>{item.nama_lahan}</strong>
                          <small>Lahan ID: {item.lahan_id}</small>
                        </td>

                        <td>
                          <strong>{item.desa}</strong>
                          <small>Kec. {item.kecamatan}</small>
                        </td>

                        <td>{item.varietas}</td>

                        <td>
                          <strong>
                            {formatNumber(item.prediksi_ton, 2)} Ton
                          </strong>
                          <small>{formatNumber(item.prediksi_kg, 0)} Kg</small>
                        </td>

                        <td>{item.periode}</td>

                        <td>{formatTanggal(item.tanggal)}</td>

                        <td>
                          <span
                            style={{
                              ...styles.statusBadge,
                              background: `${STATUS_COLOR[item.status]}22`,
                              color: STATUS_COLOR[item.status],
                              border: `1px solid ${STATUS_COLOR[item.status]}55`,
                            }}
                          >
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function KPI({ icon, label, value, sub, color, bg }) {
  return (
    <div style={{ ...styles.kpiCard, background: bg }}>
      <div style={styles.kpiIcon}>{icon}</div>

      <div>
        <p>{label}</p>
        <h2 style={{ color }}>{value}</h2>
        <small>{sub}</small>
      </div>
    </div>
  );
}

const styles = {
  page: {
    padding: "24px 28px",
    background: "#f8fafc",
    minHeight: "100vh",
    color: "#111827",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    boxSizing: "border-box",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
    marginBottom: 22,
  },

  title: {
    margin: 0,
    fontSize: 30,
    fontWeight: 900,
  },

  sub: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 15,
  },

  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  sourceBadge: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    color: "#334155",
    padding: "10px 12px",
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 13,
  },

  refreshButton: {
    background: "#047857",
    color: "#ffffff",
    border: "none",
    padding: "12px 18px",
    borderRadius: 10,
    fontWeight: 850,
    cursor: "pointer",
    boxShadow: "0 12px 28px rgba(4,120,87,.22)",
  },

  kpiRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 14,
    marginBottom: 14,
  },

  kpiRowTwo: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
    marginBottom: 18,
  },

  kpiCard: {
    borderRadius: 16,
    padding: 18,
    display: "flex",
    alignItems: "center",
    gap: 14,
    border: "1px solid #e5e7eb",
    boxShadow: "0 12px 30px rgba(15,23,42,.06)",
  },

  kpiIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
    flexShrink: 0,
  },

  summaryWideCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 12px 30px rgba(15,23,42,.06)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  bigIcon: {
    width: 70,
    height: 70,
    borderRadius: 20,
    background: "#ecfdf5",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 34,
  },

  toolbar: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 18,
    boxShadow: "0 12px 30px rgba(15,23,42,.06)",
  },

  toolbarTitle: {
    margin: 0,
    fontSize: 18,
  },

  toolbarSub: {
    margin: "6px 0 0",
    color: "#64748b",
  },

  toolbarActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  select: {
    height: 44,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "0 12px",
    background: "#ffffff",
    fontWeight: 700,
    outline: "none",
  },

  searchInput: {
    height: 44,
    width: 240,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "0 12px",
    outline: "none",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1.35fr .9fr",
    gap: 18,
    marginBottom: 18,
  },

  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 12px 30px rgba(15,23,42,.06)",
  },

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },

  legendList: {
    display: "grid",
    gap: 10,
    marginTop: 10,
  },

  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    justifyContent: "space-between",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "10px 12px",
  },

  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    display: "inline-block",
  },

  listCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 12px 30px rgba(15,23,42,.06)",
  },

  tableWrap: {
    width: "100%",
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  },

  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 850,
    whiteSpace: "nowrap",
  },

  emptyBox: {
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
    padding: 24,
    textAlign: "center",
    color: "#64748b",
    background: "#f8fafc",
  },

  emptyChart: {
    minHeight: 300,
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: 20,
    color: "#64748b",
    background: "#f8fafc",
  },

  loadingBox: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 28,
    textAlign: "center",
    color: "#64748b",
    boxShadow: "0 12px 30px rgba(15,23,42,.06)",
  },

  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    fontWeight: 700,
  },
};