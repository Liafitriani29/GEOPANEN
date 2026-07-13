import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const API = "http://localhost:3000/api";

const FULL_MONTHS = [
  { key: "01", label: "Jan" },
  { key: "02", label: "Feb" },
  { key: "03", label: "Mar" },
  { key: "04", label: "Apr" },
  { key: "05", label: "Mei" },
  { key: "06", label: "Jun" },
];

const MONTH_NAME_TO_KEY = {
  jan: "01",
  januari: "01",
  feb: "02",
  februari: "02",
  mar: "03",
  maret: "03",
  apr: "04",
  april: "04",
  mei: "05",
  may: "05",
  jun: "06",
  juni: "06",
};

const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.petani)) return payload.petani;
  return [];
};

const safeNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const formatNumber = (value, digit = 0) => {
  return safeNumber(value).toLocaleString("id-ID", {
    minimumFractionDigits: digit,
    maximumFractionDigits: digit,
  });
};

const formatDate = (value = new Date()) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const formatDateShort = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const todayKey = () => {
  const date = new Date();
  return date.toISOString().slice(0, 10);
};

const toDateKey = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
};

const getStoredId = () => {
  const user = getUser();

  return (
    localStorage.getItem("user_id") ||
    localStorage.getItem("penyuluh_id") ||
    user?.id ||
    6
  );
};

const getStatusLahan = (item) => {
  const status = String(
    item.status_kesehatan || item.status || item.kondisi || ""
  ).toLowerCase();

  if (
    status.includes("kritis") ||
    status.includes("berisiko") ||
    status.includes("risiko") ||
    status.includes("tinggi")
  ) {
    return "Berisiko";
  }

  if (
    status.includes("waspada") ||
    status.includes("perlu") ||
    status.includes("sedang")
  ) {
    return "Perlu Perhatian";
  }

  return "Sehat";
};

const statusStyle = (status) => {
  const s = String(status || "").toLowerCase();

  if (s.includes("selesai") || s.includes("baik") || s.includes("sehat")) {
    return {
      bg: "#dcfce7",
      color: "#16a34a",
    };
  }

  if (
    s.includes("sedang") ||
    s.includes("perlu") ||
    s.includes("waspada") ||
    s.includes("menunggu") ||
    s.includes("dibalas")
  ) {
    return {
      bg: "#ffedd5",
      color: "#f97316",
    };
  }

  return {
    bg: "#fee2e2",
    color: "#ef4444",
  };
};

const getStatusLabel = (status) => {
  const s = String(status || "").toLowerCase();

  if (s.includes("selesai")) return "Selesai";
  if (s.includes("dibalas") || s.includes("sedang") || s.includes("ditangani")) {
    return "Sedang Ditangani";
  }

  return "Menunggu Dibalas";
};

const getMarkerIcon = (count, color = "#16a34a") => {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:34px;
        height:34px;
        border-radius:999px;
        background:${color};
        color:white;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:12px;
        font-weight:900;
        border:3px solid white;
        box-shadow:0 8px 18px rgba(15,23,42,.22);
      ">
        ${count}
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
};

const normalizeLahanRow = (row) => {
  return {
    id: row.id || row.lahan_id,
    lahan_id: row.lahan_id || row.id,
    petani_id: row.petani_id || row.user_id,
    nama_petani: row.nama_petani || row.petani || row.nama || "Petani",
    nama_lahan: row.nama_lahan || row.lahan || "Lahan",
    nama_desa: row.nama_desa || row.desa || "-",
    nama_kecamatan: row.nama_kecamatan || row.kecamatan || "-",
    luas_ha: safeNumber(row.luas_ha || row.luas || row.total_luas, 0),
    prediksi_ton: safeNumber(
      row.prediksi_ton || row.prediksi || row.total_prediksi,
      0
    ),
    produksi_aktual: safeNumber(
      row.produksi_aktual || row.produksi || row.total_produksi,
      0
    ),
    status_kesehatan: row.status_kesehatan || row.status || "sehat",
    varietas: row.varietas || "Padi",
    fase_tanam: row.fase_tanam || row.fase_tanaman || "Vegetatif Awal",
    umur_tanam: safeNumber(row.umur_tanam || row.umur_tanaman || 0, 0),
    lat: safeNumber(row.lat, null),
    lng: safeNumber(row.lng, null),
  };
};

const normalizeWeather = (payload) => {
  const data = payload?.data || payload || {};

  const suhu =
    data.suhu ||
    data.temperature ||
    data.temp ||
    data.current?.temperature ||
    data.current?.temp;

  const kondisi =
    data.kondisi ||
    data.condition ||
    data.cuaca ||
    data.weather ||
    data.current?.condition ||
    data.current?.weather;

  if (!suhu && !kondisi) return null;

  return {
    suhu: safeNumber(suhu, 0),
    kondisi: kondisi || "Cerah",
  };
};

const getMonthKeyFromValue = (value) => {
  if (!value) return null;

  const text = String(value).toLowerCase().trim();

  const numericMatch = text.match(/(?:\d{4}-)?(0[1-9]|1[0-2])(?:-\d{2})?/);
  if (numericMatch?.[1]) return numericMatch[1];

  const word = Object.keys(MONTH_NAME_TO_KEY).find((key) => text.includes(key));
  if (word) return MONTH_NAME_TO_KEY[word];

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return String(date.getMonth() + 1).padStart(2, "0");
  }

  return null;
};

const normalizeChartRows = (apiChart, totalPrediksi, totalProduksi) => {
  const source = Array.isArray(apiChart) ? apiChart : [];

  return FULL_MONTHS.map((month) => {
    const found = source.find((item) => {
      const key = getMonthKeyFromValue(
        item.bulan ||
          item.month ||
          item.periode ||
          item.tanggal ||
          item.tanggal_data ||
          item.created_at
      );

      return key === month.key;
    });

    return {
      bulan: month.label,
      produksi_aktual: safeNumber(
        found?.produksi_aktual ||
          found?.produksi ||
          found?.actual ||
          found?.total_produksi,
        0
      ),
      prediksi_produksi: safeNumber(
        found?.prediksi_produksi ||
          found?.prediksi ||
          found?.prediksi_ton ||
          found?.total_prediksi,
        0
      ),
    };
  }).map((item, index, arr) => {
    const hasAnyData = arr.some(
      (row) => row.produksi_aktual > 0 || row.prediksi_produksi > 0
    );

    if (hasAnyData) return item;

    return {
      ...item,
      produksi_aktual: 0,
      prediksi_produksi: index === arr.length - 1 ? safeNumber(totalPrediksi, 0) : 0,
    };
  });
};

export default function DashboardPenyuluh() {
  const navigate = useNavigate();
  const user = getUser();
  const penyuluhId = getStoredId();

  const [lahanRows, setLahanRows] = useState([]);
  const [analisis, setAnalisis] = useState(null);
  const [konsultasi, setKonsultasi] = useState([]);
  const [rekomendasi, setRekomendasi] = useState([]);
  const [catatan, setCatatan] = useState([]);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);

  const namaPenyuluh =
    user?.nama || localStorage.getItem("nama") || "Budi Santoso";

  const fetchWeather = async () => {
    try {
      const endpoints = [`${API}/weather`, `${API}/cuaca`];

      for (const endpoint of endpoints) {
        try {
          const res = await axios.get(endpoint);
          const normalized = normalizeWeather(res.data);

          if (normalized) {
            setWeather(normalized);
            return;
          }
        } catch {
          // lanjut endpoint berikutnya
        }
      }

      setWeather(null);
    } catch {
      setWeather(null);
    }
  };

  const fetchDashboard = async () => {
    try {
      setLoading(true);

      const startDate = "2026-01-01";
      const endDate = todayKey();

      const dashboardRes = await axios
        .get(`${API}/penyuluh/dashboard`, {
          params: {
            penyuluh_id: penyuluhId,
          },
        })
        .catch(() => null);

      if (dashboardRes?.data?.data) {
        const payload = dashboardRes.data.data || {};

        setLahanRows(normalizeList(payload.lahan).map(normalizeLahanRow));
        setAnalisis({
          data: {
            chart: normalizeList(payload.chart),
          },
        });
        setKonsultasi(normalizeList(payload.konsultasi));
        setRekomendasi(normalizeList(payload.rekomendasi));
        setCatatan(normalizeList(payload.catatan));

        return;
      }

      const [
        petaniBinaanRes,
        analisisRes,
        konsultasiRes,
        rekomendasiRes,
        catatanRes,
      ] = await Promise.allSettled([
        axios.get(`${API}/penyuluh/petani-binaan`),
        axios.get(`${API}/penyuluh/analisis-produksi`, {
          params: {
            start_date: startDate,
            end_date: endDate,
            kecamatan: "all",
            desa: "all",
            status: "all",
          },
        }),
        axios.get(`${API}/konsultasi/penyuluh/${penyuluhId}`),
        axios.get(`${API}/rekomendasi-ai`),
        axios.get(`${API}/penyuluh/catatan`),
      ]);

      const rawPetani =
        petaniBinaanRes.status === "fulfilled"
          ? normalizeList(petaniBinaanRes.value.data)
          : [];

      const rawAnalisis =
        analisisRes.status === "fulfilled" ? analisisRes.value.data : null;

      const rawKonsultasi =
        konsultasiRes.status === "fulfilled"
          ? normalizeList(konsultasiRes.value.data)
          : [];

      const rawRekomendasi =
        rekomendasiRes.status === "fulfilled"
          ? normalizeList(rekomendasiRes.value.data)
          : [];

      const rawCatatan =
        catatanRes.status === "fulfilled"
          ? normalizeList(catatanRes.value.data)
          : [];

      setLahanRows(rawPetani.map(normalizeLahanRow));
      setAnalisis(rawAnalisis);
      setKonsultasi(rawKonsultasi);
      setRekomendasi(rawRekomendasi);
      setCatatan(rawCatatan);
    } catch (err) {
      console.log("ERROR DASHBOARD PENYULUH:", err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetchWeather();

    const interval = setInterval(() => {
      fetchDashboard();
      fetchWeather();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const dashboard = useMemo(() => {
    const uniquePetani = new Set(
      lahanRows
        .map((item) => item.petani_id)
        .filter((item) => item !== null && item !== undefined)
    );

    const totalPetani = uniquePetani.size;

    const totalLuas = lahanRows.reduce(
      (sum, item) => sum + safeNumber(item.luas_ha),
      0
    );

    const totalPrediksi = lahanRows.reduce(
      (sum, item) => sum + safeNumber(item.prediksi_ton),
      0
    );

    const totalProduksiAktual = lahanRows.reduce(
      (sum, item) => sum + safeNumber(item.produksi_aktual),
      0
    );

    const lahanPerhatian = lahanRows.filter((item) => {
      const status = getStatusLahan(item);
      return status !== "Sehat";
    });

    const konsultasiAktif = konsultasi.filter((item) => {
      const status = String(item.status || "").toLowerCase();
      return !status.includes("selesai");
    });

    const aktivitasHariIni = catatan.filter(
      (item) => toDateKey(item.created_at) === todayKey()
    ).length;

    const sehatRows = lahanRows.filter(
      (item) => getStatusLahan(item) === "Sehat"
    );

    const perhatianRows = lahanRows.filter(
      (item) => getStatusLahan(item) === "Perlu Perhatian"
    );

    const risikoRows = lahanRows.filter(
      (item) => getStatusLahan(item) === "Berisiko"
    );

    const sehatLuas = sehatRows.reduce((sum, item) => sum + item.luas_ha, 0);

    const perhatianLuas = perhatianRows.reduce(
      (sum, item) => sum + item.luas_ha,
      0
    );

    const risikoLuas = risikoRows.reduce((sum, item) => sum + item.luas_ha, 0);

    return {
      totalPetani,
      totalLuas,
      totalPrediksi,
      totalProduksiAktual,
      lahanPerhatian: lahanPerhatian.length,
      konsultasiAktif: konsultasiAktif.length,
      aktivitasHariIni,
      sehatLuas,
      perhatianLuas,
      risikoLuas,
      lahanPerhatianRows: lahanPerhatian,
    };
  }, [lahanRows, konsultasi, catatan]);

  const mapGroups = useMemo(() => {
    const grouped = new Map();

    lahanRows
      .filter((item) => item.lat && item.lng)
      .forEach((item) => {
        const key = `${item.nama_kecamatan}-${item.nama_desa}`;

        if (!grouped.has(key)) {
          grouped.set(key, {
            key,
            nama_desa: item.nama_desa,
            nama_kecamatan: item.nama_kecamatan,
            lat: item.lat,
            lng: item.lng,
            count: 0,
            sehat: 0,
            perhatian: 0,
            risiko: 0,
          });
        }

        const current = grouped.get(key);
        current.count += 1;

        const status = getStatusLahan(item);

        if (status === "Sehat") current.sehat += 1;
        if (status === "Perlu Perhatian") current.perhatian += 1;
        if (status === "Berisiko") current.risiko += 1;
      });

    return Array.from(grouped.values());
  }, [lahanRows]);

  const statusPie = useMemo(() => {
    const raw = [
      {
        name: "Sehat",
        value: Number(dashboard.sehatLuas.toFixed(4)),
        color: "#16a34a",
      },
      {
        name: "Perlu Perhatian",
        value: Number(dashboard.perhatianLuas.toFixed(4)),
        color: "#f59e0b",
      },
      {
        name: "Berisiko",
        value: Number(dashboard.risikoLuas.toFixed(4)),
        color: "#ef4444",
      },
    ];

    const totalStatusLuas = raw.reduce((sum, item) => sum + item.value, 0);

    if (totalStatusLuas <= 0) {
      return raw.map((item) => ({
        ...item,
        value: 0,
        percent: 0,
      }));
    }

    return raw.map((item) => ({
      ...item,
      percent: (item.value / totalStatusLuas) * 100,
    }));
  }, [dashboard]);

  const chartData = useMemo(() => {
    const apiChart = analisis?.chart || analisis?.data?.chart || [];

    return normalizeChartRows(
      apiChart,
      dashboard.totalPrediksi,
      dashboard.totalProduksiAktual
    );
  }, [analisis, dashboard.totalPrediksi, dashboard.totalProduksiAktual]);

  const latestKonsultasi = useMemo(() => {
    return konsultasi.slice(0, 5).map((item) => ({
      id: item.id,
      nama_petani: item.nama_petani || "Petani",
      pesan: item.pesan_terakhir || item.pesan || "Belum ada pesan",
      waktu: item.pesan_terakhir_at || item.created_at,
      status: item.status || "Menunggu Dibalas",
      unread: safeNumber(item.unread_count, 0),
    }));
  }, [konsultasi]);

  const rekomendasiUtama = useMemo(() => {
    return rekomendasi.slice(0, 4).map((item) => ({
      id: item.id,
      title: item.jenis || item.judul || "Rekomendasi",
      desc: item.rekomendasi || item.pesan || "Rekomendasi AI tersedia",
      icon:
        String(item.jenis || "").toLowerCase().includes("hama")
          ? "🐛"
          : String(item.jenis || "").toLowerCase().includes("irigasi")
          ? "💧"
          : "🌱",
    }));
  }, [rekomendasi]);

  const aktivitasTerjadwal = useMemo(() => {
    return catatan.slice(0, 4).map((item) => ({
      id: item.id,
      title: item.judul || "Catatan Lapangan",
      desc:
        item.nama_desa && item.nama_desa !== "-"
          ? `Ds. ${item.nama_desa}, Kec. ${item.nama_kecamatan || "-"}`
          : item.isi || "Aktivitas penyuluhan",
      time: formatTime(item.created_at),
      icon: "📋",
    }));
  }, [catatan]);

  const wilayahSummary = useMemo(() => {
    const kec = new Set(
      lahanRows
        .map((item) => item.nama_kecamatan)
        .filter((item) => item && item !== "-")
    );

    const desa = new Set(
      lahanRows
        .map((item) => item.nama_desa)
        .filter((item) => item && item !== "-")
    );

    return {
      kecamatan: kec.size,
      desa: desa.size,
      kelompok: desa.size > 0 ? Math.ceil(desa.size / 2) : 0,
      gapoktan: kec.size,
    };
  }, [lahanRows]);

  const totalAktual = chartData.reduce(
    (sum, item) => sum + safeNumber(item.produksi_aktual),
    0
  );

  const lastMonthWithPrediction = [...chartData]
    .reverse()
    .find((item) => safeNumber(item.prediksi_produksi) > 0);

  const prediksiBulanIni =
    lastMonthWithPrediction?.prediksi_produksi || dashboard.totalPrediksi;

  const prediksiBulanDepan = Math.round(prediksiBulanIni * 1.08);

  const totalStatusLuas = statusPie.reduce(
    (sum, item) => sum + safeNumber(item.value),
    0
  );

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1>Selamat datang, {namaPenyuluh} 👋</h1>
          <p>Berikut ringkasan kondisi pertanian di wilayah binaan Anda hari ini.</p>
        </div>

        <div style={styles.headerRight}>
          <button style={styles.dateButton} type="button">
            📅 {formatDate(new Date())}
          </button>

          {weather && (
            <button style={styles.weatherButton} type="button">
              ☀️ {formatNumber(weather.suhu, 0)}°C
              <span>{weather.kondisi}</span>
            </button>
          )}

          <button
            style={styles.bellButton}
            type="button"
            onClick={() => navigate("/penyuluh/notifikasi")}
          >
            🔔
            {dashboard.konsultasiAktif > 0 && (
              <span>{dashboard.konsultasiAktif}</span>
            )}
          </button>

          <div style={styles.profileChip}>
            <div style={styles.avatarSmall}>👨‍💼</div>
            <div>
              <strong>{namaPenyuluh}</strong>
              <small>Penyuluh</small>
            </div>
            <b>⌄</b>
          </div>
        </div>
      </header>

      {loading && <div style={styles.loadingBar}>Memuat dashboard...</div>}

      <section style={styles.kpiGrid}>
        <KpiCard
          title="Petani Binaan"
          value={dashboard.totalPetani}
          desc="Data petani aktif"
          icon="👥"
          color="#16a34a"
          bg="#dcfce7"
        />

        <KpiCard
          title="Lahan Binaan"
          value={`${formatNumber(dashboard.totalLuas, 2)} Ha`}
          desc="Total luas lahan"
          icon="🌿"
          color="#16a34a"
          bg="#dcfce7"
        />

        <KpiCard
          title="Prediksi Produksi"
          value={`${formatNumber(dashboard.totalPrediksi, 1)} Ton`}
          desc="Estimasi panen"
          icon="📈"
          color="#7c3aed"
          bg="#ede9fe"
        />

        <KpiCard
          title="Lahan Perlu Perhatian"
          value={`${dashboard.lahanPerhatian} Lahan`}
          desc="Perlu penanganan"
          icon="⚠️"
          color="#f97316"
          bg="#ffedd5"
        />

        <KpiCard
          title="Konsultasi Aktif"
          value={dashboard.konsultasiAktif}
          desc="Sedang ditangani"
          icon="💬"
          color="#2563eb"
          bg="#dbeafe"
        />

        <KpiCard
          title="Aktivitas Hari Ini"
          value={dashboard.aktivitasHariIni}
          desc="Kegiatan tercatat"
          icon="✅"
          color="#16a34a"
          bg="#dcfce7"
        />
      </section>

      <section style={styles.dashboardGrid}>
        <div style={styles.leftColumn}>
          <div style={styles.topGrid}>
            <Card>
              <CardHeader
                title="Peta Sebaran Lahan Binaan"
                action="Lihat Peta Lengkap →"
                onClick={() => navigate("/penyuluh/peta-binaan")}
              />

              <div style={styles.mapBox}>
                <MapContainer
                  center={[-7.68, 110.84]}
                  zoom={10}
                  scrollWheelZoom={false}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                  {mapGroups.map((item, index) => {
                    const color =
                      item.risiko > 0
                        ? "#ef4444"
                        : item.perhatian > 0
                        ? "#f59e0b"
                        : "#16a34a";

                    return (
                      <Marker
                        key={item.key}
                        position={[item.lat, item.lng]}
                        icon={getMarkerIcon(item.count || index + 1, color)}
                      >
                        <Popup>
                          <div style={{ minWidth: 180 }}>
                            <strong>{item.nama_desa}</strong>
                            <p style={{ margin: "6px 0 0" }}>
                              Kecamatan: {item.nama_kecamatan}
                            </p>
                            <p style={{ margin: "4px 0 0" }}>
                              Total lahan: <b>{item.count}</b>
                            </p>
                            <p style={{ margin: "4px 0 0" }}>
                              Sehat: {item.sehat}
                            </p>
                            <p style={{ margin: "4px 0 0" }}>
                              Perhatian: {item.perhatian}
                            </p>
                            <p style={{ margin: "4px 0 0" }}>
                              Risiko: {item.risiko}
                            </p>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>

                <div style={styles.mapLegend}>
                  <span>
                    <i style={{ background: "#16a34a" }} /> Sangat Baik
                  </span>
                  <span>
                    <i style={{ background: "#2563eb" }} /> Baik
                  </span>
                  <span>
                    <i style={{ background: "#f59e0b" }} /> Perlu Perhatian
                  </span>
                  <span>
                    <i style={{ background: "#ef4444" }} /> Berisiko
                  </span>
                </div>
              </div>
            </Card>

            <Card>
              <h3>Status Kesehatan Tanaman (AI)</h3>

              {totalStatusLuas <= 0 ? (
                <Empty text="Belum ada data status kesehatan tanaman." />
              ) : (
                <>
                  <div style={styles.donutWrap}>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={statusPie.filter((item) => item.value > 0)}
                          dataKey="value"
                          innerRadius={62}
                          outerRadius={92}
                          paddingAngle={2}
                        >
                          {statusPie
                            .filter((item) => item.value > 0)
                            .map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>

                    <div style={styles.donutCenter}>
                      <small>Total</small>
                      <strong>{formatNumber(dashboard.totalLuas, 2)} Ha</strong>
                    </div>
                  </div>

                  <div style={styles.pieLegend}>
                    {statusPie.map((item) => (
                      <div key={item.name}>
                        <span>
                          <i style={{ background: item.color }} /> {item.name}
                        </span>
                        <strong>
                          {formatNumber(item.value, 2)} Ha (
                          {formatNumber(item.percent, 1)}%)
                        </strong>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <button
                style={styles.fullButton}
                type="button"
                onClick={() => navigate("/penyuluh/analisis")}
              >
                Lihat Detail →
              </button>
            </Card>
          </div>

          <div style={styles.middleGrid}>
            <Card>
              <CardHeader
                title="Daftar Konsultasi Terbaru"
                action="Lihat Semua →"
                onClick={() => navigate("/penyuluh/konsultasi")}
              />

              <div style={styles.konsultasiList}>
                {latestKonsultasi.length === 0 ? (
                  <Empty text="Belum ada konsultasi." />
                ) : (
                  latestKonsultasi.map((item) => {
                    const label = getStatusLabel(item.status);
                    const meta = statusStyle(label);

                    return (
                      <div key={item.id} style={styles.konsultasiItem}>
                        <div style={styles.personAvatar}>
                          {String(item.nama_petani || "P").charAt(0)}
                        </div>

                        <div style={styles.textBlock}>
                          <strong>{item.nama_petani}</strong>
                          <small>{item.pesan}</small>
                          <em>
                            {formatDateShort(item.waktu)} • {formatTime(item.waktu)}
                          </em>
                        </div>

                        <span
                          style={{
                            ...styles.statusBadge,
                            background: meta.bg,
                            color: meta.color,
                          }}
                        >
                          {label}
                        </span>

                        {item.unread > 0 && (
                          <b style={styles.redBubble}>{item.unread}</b>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Analisis Produksi Wilayah Binaan"
                action="6 Bulan Terakhir"
              />

              <ResponsiveContainer width="100%" height={230}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="bulan" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="produksi_aktual"
                    name="Produksi Aktual (Ton)"
                    stroke="#16a34a"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="prediksi_produksi"
                    name="Prediksi Produksi (Ton)"
                    stroke="#f59e0b"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>

              <div style={styles.productionSummary}>
                <MiniMetric
                  title="Total Produksi Aktual"
                  value={`${formatNumber(totalAktual, 0)} Ton`}
                  color="#16a34a"
                />

                <MiniMetric
                  title="Prediksi Panen Bulan Ini"
                  value={`${formatNumber(prediksiBulanIni, 0)} Ton`}
                  color="#f59e0b"
                />

                <MiniMetric
                  title="Estimasi Panen Bulan Depan"
                  value={`${formatNumber(prediksiBulanDepan, 0)} Ton`}
                  color="#16a34a"
                />
              </div>

              <button
                style={styles.fullButton}
                type="button"
                onClick={() => navigate("/penyuluh/analisis")}
              >
                Lihat Analisis Lengkap →
              </button>
            </Card>
          </div>

          <Card>
            <h3>Data Lahan Perlu Perhatian</h3>

            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Petani</th>
                  <th style={styles.th}>Lokasi</th>
                  <th style={styles.th}>Luas</th>
                  <th style={styles.th}>Masalah</th>
                  <th style={styles.th}>Tingkat Risiko</th>
                  <th style={styles.th}>Rekomendasi</th>
                  <th style={styles.th}>Aksi</th>
                </tr>
              </thead>

              <tbody>
                {dashboard.lahanPerhatianRows.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={styles.emptyCell}>
                      Belum ada lahan perlu perhatian.
                    </td>
                  </tr>
                ) : (
                  dashboard.lahanPerhatianRows.slice(0, 5).map((item) => {
                    const status = getStatusLahan(item);
                    const meta = statusStyle(status);

                    return (
                      <tr key={item.lahan_id}>
                        <td style={styles.td}>{item.nama_petani}</td>
                        <td style={styles.td}>
                          Ds. {item.nama_desa}, Kec. {item.nama_kecamatan}
                        </td>
                        <td style={styles.td}>
                          {formatNumber(item.luas_ha, 2)} Ha
                        </td>
                        <td style={styles.td}>
                          {status === "Berisiko"
                            ? "Risiko tinggi terdeteksi"
                            : "Perlu pemantauan lahan"}
                        </td>
                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.smallBadge,
                              background: meta.bg,
                              color: meta.color,
                            }}
                          >
                            {status === "Berisiko" ? "Tinggi" : "Sedang"}
                          </span>
                        </td>
                        <td style={styles.td}>
                          {status === "Berisiko"
                            ? "Pengendalian hama/penyakit"
                            : "Pemupukan dan monitoring"}
                        </td>
                        <td style={styles.td}>
                          <button
                            style={styles.eyeButton}
                            type="button"
                            onClick={() => navigate("/penyuluh/peta-binaan")}
                          >
                            👁️
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </Card>
        </div>

        <aside style={styles.sideColumn}>
          <Card>
            <h3>AI Recommendation Utama</h3>

            <div style={styles.rekomList}>
              {rekomendasiUtama.length === 0 ? (
                <Empty text="Belum ada rekomendasi AI." />
              ) : (
                rekomendasiUtama.map((item) => (
                  <div key={item.id} style={styles.rekomItem}>
                    <span style={styles.sideIcon}>{item.icon}</span>

                    <div style={styles.textBlock}>
                      <strong>{item.title}</strong>
                      <small>{item.desc}</small>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate("/penyuluh/rekomendasi")}
                    >
                      Lihat
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              style={styles.fullButton}
              type="button"
              onClick={() => navigate("/penyuluh/rekomendasi")}
            >
              Lihat Semua Rekomendasi →
            </button>
          </Card>

          <Card>
            <h3>Aktivitas Terjadwal</h3>

            <div style={styles.activityList}>
              {aktivitasTerjadwal.length === 0 ? (
                <Empty text="Belum ada aktivitas terjadwal." />
              ) : (
                aktivitasTerjadwal.map((item) => (
                  <div key={item.id} style={styles.activityItem}>
                    <span style={styles.sideIcon}>{item.icon}</span>

                    <div style={styles.textBlock}>
                      <strong>{item.title}</strong>
                      <small>{item.desc}</small>
                    </div>

                    <b>{item.time}</b>
                  </div>
                ))
              )}
            </div>

            <button
              style={styles.fullButton}
              type="button"
              onClick={() => navigate("/penyuluh/catatan")}
            >
              Lihat Semua Jadwal →
            </button>
          </Card>

          <Card>
            <h3>Pengingat Cepat</h3>

            <ReminderRow
              label="Lahan Belum Dikunjungi"
              value={`${dashboard.lahanPerhatian} lahan`}
            />

            <ReminderRow
              label="Catatan Belum Dibuat"
              value={`${Math.max(0, lahanRows.length - catatan.length)} catatan`}
            />

            <ReminderRow
              label="Konsultasi Belum Selesai"
              value={`${dashboard.konsultasiAktif} konsultasi`}
            />

            <ReminderRow
              label="Rekomendasi Belum Dikirim"
              value={`${rekomendasi.filter((item) => String(item.status_kirim).toLowerCase() !== "terkirim").length} rekomendasi`}
            />
          </Card>

          <Card>
            <h3>Ringkasan Wilayah Binaan</h3>

            <SummaryRow
              icon="📍"
              label="Kecamatan"
              value={`${wilayahSummary.kecamatan} Kecamatan`}
            />

            <SummaryRow
              icon="🏘️"
              label="Desa"
              value={`${wilayahSummary.desa} Desa`}
            />

            <SummaryRow
              icon="👥"
              label="Kelompok Tani"
              value={`${wilayahSummary.kelompok} Kelompok`}
            />

            <SummaryRow
              icon="🌾"
              label="Gapoktan"
              value={`${wilayahSummary.gapoktan} Gapoktan`}
            />
          </Card>
        </aside>
      </section>
    </main>
  );
}

function KpiCard({ title, value, desc, icon, color, bg }) {
  return (
    <div style={styles.kpiCard}>
      <div style={styles.textBlock}>
        <p>{title}</p>
        <strong style={{ color }}>{value}</strong>
        <small>{desc}</small>
      </div>

      <span style={{ ...styles.kpiIcon, color, background: bg }}>{icon}</span>
    </div>
  );
}

function Card({ children, style }) {
  return <section style={{ ...styles.card, ...style }}>{children}</section>;
}

function CardHeader({ title, action, onClick }) {
  return (
    <div style={styles.cardHeader}>
      <h3>{title}</h3>

      {action && (
        <button type="button" onClick={onClick} style={styles.headerAction}>
          {action}
        </button>
      )}
    </div>
  );
}

function MiniMetric({ title, value, color }) {
  return (
    <div style={styles.miniMetric}>
      <small>{title}</small>
      <strong style={{ color }}>{value}</strong>
    </div>
  );
}

function ReminderRow({ label, value }) {
  return (
    <div style={styles.reminderRow}>
      <span>⏱️</span>
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

function SummaryRow({ icon, label, value }) {
  return (
    <div style={styles.summaryRow}>
      <span>{icon}</span>
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

function Empty({ text }) {
  return <div style={styles.emptyBox}>{text}</div>;
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f6f8fb",
    color: "#0f172a",
    padding: 24,
    boxSizing: "border-box",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 22,
    gap: 18,
  },

  headerRight: {
    display: "flex",
    gap: 12,
    alignItems: "center",
  },

  dateButton: {
    height: 46,
    padding: "0 16px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    fontWeight: 900,
  },

  weatherButton: {
    minHeight: 46,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    fontWeight: 900,
    display: "grid",
    placeItems: "center",
    gap: 2,
  },

  bellButton: {
    width: 46,
    height: 46,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    position: "relative",
    cursor: "pointer",
  },

  profileChip: {
    height: 50,
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    padding: "0 12px",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  avatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 999,
    background: "#dcfce7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingBar: {
    background: "#ecfdf5",
    border: "1px solid #86efac",
    color: "#047857",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    fontWeight: 900,
  },

  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    gap: 16,
    marginBottom: 18,
  },

  kpiCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 104,
    boxShadow: "0 10px 25px rgba(15,23,42,.04)",
    minWidth: 0,
  },

  kpiIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  },

  dashboardGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 380px",
    gap: 18,
    alignItems: "start",
  },

  leftColumn: {
    display: "grid",
    gap: 18,
    minWidth: 0,
  },

  sideColumn: {
    display: "grid",
    gap: 18,
    minWidth: 0,
  },

  topGrid: {
    display: "grid",
    gridTemplateColumns: "1.45fr 0.9fr",
    gap: 18,
    alignItems: "stretch",
  },

  middleGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 18,
    alignItems: "stretch",
  },

  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 10px 25px rgba(15,23,42,.04)",
    minWidth: 0,
  },

  mapBox: {
    height: 320,
    position: "relative",
    borderRadius: 14,
    overflow: "hidden",
  },

  mapLegend: {
    position: "absolute",
    left: "50%",
    bottom: 14,
    transform: "translateX(-50%)",
    background: "rgba(255,255,255,.92)",
    borderRadius: 10,
    padding: "10px 14px",
    display: "flex",
    gap: 18,
    zIndex: 500,
    fontWeight: 800,
    fontSize: 12,
    whiteSpace: "nowrap",
  },

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },

  headerAction: {
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    borderRadius: 10,
    padding: "8px 12px",
    color: "#0f172a",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  donutWrap: {
    position: "relative",
    height: 220,
  },

  donutCenter: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeContent: "center",
    textAlign: "center",
    pointerEvents: "none",
  },

  pieLegend: {
    display: "grid",
    gap: 10,
    marginTop: 6,
  },

  rekomList: {
    display: "grid",
    gap: 10,
  },

  rekomItem: {
    display: "grid",
    gridTemplateColumns: "42px minmax(0, 1fr) 58px",
    gap: 10,
    alignItems: "center",
    padding: 10,
    background: "#f8fafc",
    borderRadius: 12,
  },

  activityList: {
    display: "grid",
    gap: 12,
  },

  activityItem: {
    display: "grid",
    gridTemplateColumns: "40px minmax(0, 1fr) auto",
    gap: 10,
    alignItems: "center",
  },

  sideIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    display: "grid",
    placeItems: "center",
    background: "#ecfdf5",
  },

  textBlock: {
    minWidth: 0,
    display: "grid",
    gap: 4,
  },

  konsultasiList: {
    display: "grid",
    gap: 10,
  },

  konsultasiItem: {
    display: "grid",
    gridTemplateColumns: "42px minmax(0, 1fr) auto auto",
    gap: 10,
    alignItems: "center",
    padding: 10,
    borderBottom: "1px solid #f1f5f9",
  },

  personAvatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    background: "#dcfce7",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
  },

  statusBadge: {
    borderRadius: 999,
    padding: "5px 10px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  redBubble: {
    width: 22,
    height: 22,
    borderRadius: 999,
    background: "#ef4444",
    color: "#ffffff",
    display: "grid",
    placeItems: "center",
    fontSize: 12,
  },

  productionSummary: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
    marginTop: 12,
  },

  miniMetric: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
    display: "grid",
    gap: 6,
  },

  reminderRow: {
    display: "grid",
    gridTemplateColumns: "28px 1fr auto",
    gap: 8,
    alignItems: "center",
    marginBottom: 10,
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },

  th: {
    textAlign: "left",
    padding: "12px 10px",
    borderBottom: "1px solid #e5e7eb",
    color: "#64748b",
    fontSize: 12,
  },

  td: {
    padding: "12px 10px",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "top",
  },

  emptyCell: {
    textAlign: "center",
    padding: 18,
    color: "#64748b",
  },

  smallBadge: {
    display: "inline-flex",
    padding: "5px 9px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
  },

  eyeButton: {
    width: 34,
    height: 30,
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    background: "#ffffff",
    cursor: "pointer",
  },

  summaryRow: {
    display: "grid",
    gridTemplateColumns: "34px 1fr auto",
    gap: 8,
    alignItems: "center",
    marginBottom: 12,
  },

  fullButton: {
    width: "100%",
    marginTop: 12,
    height: 42,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    borderRadius: 10,
    color: "#16a34a",
    fontWeight: 900,
    cursor: "pointer",
  },

  emptyBox: {
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
    padding: 16,
    textAlign: "center",
    color: "#64748b",
  },
};