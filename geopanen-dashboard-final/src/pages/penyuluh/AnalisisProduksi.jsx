import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../../services/api";
import { useNavigate } from "react-router-dom";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER = [-7.68, 110.85];

const MAP_COLORS = ["#16a34a", "#f59e0b", "#2563eb", "#ef4444", "#8b5cf6"];
const PIE_COLORS = ["#16a34a", "#f59e0b", "#2563eb", "#ef4444", "#8b5cf6"];

function safeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatNumber(value, digit = 2) {
  return safeNumber(value, 0).toLocaleString("id-ID", {
    minimumFractionDigits: digit,
    maximumFractionDigits: digit,
  });
}

function formatTon(value) {
  return `${formatNumber(value, 2)} Ton`;
}

function formatHa(value) {
  return `${formatNumber(value, 2)} Ha`;
}

function getTodayInput() {
  const date = new Date();

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function getDateBeforeInput(days = 60) {
  const date = new Date();
  date.setDate(date.getDate() - days);

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function formatFullDate(date = new Date()) {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
}

function normalizeStatus(value) {
  const raw = String(value || "").toLowerCase();

  if (raw.includes("kritis")) return "kritis";
  if (raw.includes("rendah")) return "kritis";
  if (raw.includes("waspada")) return "waspada";
  if (raw.includes("perhatian")) return "waspada";
  if (raw.includes("sedang")) return "waspada";
  if (raw.includes("sehat")) return "baik";
  if (raw.includes("baik")) return "baik";
  if (raw.includes("aktif")) return "baik";

  return "baik";
}

function statusLabel(status) {
  const key = normalizeStatus(status);

  if (key === "kritis") return "Kritis";
  if (key === "waspada") return "Perlu Perhatian";

  return "Baik";
}

function statusBadge(status) {
  const key = normalizeStatus(status);

  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  };

  if (key === "kritis") {
    return {
      ...base,
      color: "#b91c1c",
      background: "#fee2e2",
      border: "1px solid #fecaca",
    };
  }

  if (key === "waspada") {
    return {
      ...base,
      color: "#b45309",
      background: "#fffbeb",
      border: "1px solid #fde68a",
    };
  }

  return {
    ...base,
    color: "#047857",
    background: "#dcfce7",
    border: "1px solid #86efac",
  };
}

function formatChange(value) {
  const number = safeNumber(value, 0);
  const sign = number >= 0 ? "↑" : "↓";

  const label = Math.abs(number).toLocaleString("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return `${sign} ${label}% dari periode lalu`;
}

function getChangeColor(value) {
  return safeNumber(value, 0) >= 0 ? "#059669" : "#dc2626";
}

function normalizePetani(row) {
  const status = normalizeStatus(row.status || row.status_label);

  return {
    id: row.id || row.petani_id || row.nama_petani,
    petani_id: row.petani_id || row.id,
    nama_petani: row.nama_petani || row.petani || row.nama || "Petani",
    no_hp: row.no_hp || row.telepon || row.phone || "08xx-xxxx-xxxx",
    nama_desa: row.nama_desa || row.desa || "-",
    nama_kecamatan: row.nama_kecamatan || row.kecamatan || "-",
    komoditas: row.komoditas || "Padi",
    varietas: row.varietas || "Inpari 32",

    total_lahan: safeNumber(row.total_lahan || row.jumlah_lahan, 0),
    total_luas: safeNumber(row.total_luas || row.luas_ha || row.luas, 0),

    total_produksi: safeNumber(
      row.total_produksi || row.produksi_aktual || row.produksi,
      0
    ),

    total_prediksi: safeNumber(
      row.total_prediksi || row.prediksi_ton || row.prediksi,
      0
    ),

    produktivitas: safeNumber(row.produktivitas, 0),
    selisih: safeNumber(row.selisih, 0),

    status,

    skor_kesehatan: safeNumber(
      row.skor_kesehatan,
      status === "waspada" ? 62 : 91
    ),

    lat: safeNumber(row.lat, null),
    lng: safeNumber(row.lng, null),
  };
}

function normalizeWilayah(row) {
  return {
    wilayah:
      row.wilayah || row.nama_desa || row.desa || row.nama_kecamatan || "-",
    desa: row.desa || row.nama_desa || row.wilayah || "-",
    kecamatan: row.kecamatan || row.nama_kecamatan || "-",
    total_luas: safeNumber(row.total_luas || row.luas, 0),
    total_produksi: safeNumber(row.total_produksi || row.produksi, 0),
    total_prediksi: safeNumber(row.total_prediksi || row.prediksi, 0),
    total_petani: safeNumber(row.total_petani || row.petani, 0),
    produktivitas: safeNumber(row.produktivitas, 0),
    lat: safeNumber(row.lat, null),
    lng: safeNumber(row.lng, null),
  };
}

function normalizeChart(row) {
  return {
    name: row.label || row.name || row.bulan || "-",
    bulan: row.bulan || row.name || row.label || "-",
    produksi: safeNumber(row.produksi_aktual || row.produksi, 0),
    prediksi: safeNumber(row.prediksi_produksi || row.prediksi, 0),
  };
}

function normalizeKomoditas(row) {
  return {
    name: row.name || row.komoditas || "Padi",
    value: safeNumber(row.value || row.jumlah_lahan || row.total, 0),
    luas: safeNumber(row.luas || row.total_luas, 0),
    persentase: safeNumber(row.persentase, 0),
  };
}

function normalizeMap(row) {
  const produksi = safeNumber(row.total_produksi || row.produksi, 0);

  const prediksi = safeNumber(
    row.total_prediksi ||
      row.prediksi ||
      row.prediksi_ton ||
      row.prediksi_produksi,
    0
  );

  const produktivitas = safeNumber(row.produktivitas, 0);

  return {
    wilayah: row.wilayah || row.nama_desa || row.desa || "-",
    kecamatan: row.kecamatan || row.nama_kecamatan || "-",
    produksi,
    prediksi,
    produktivitas,
    lat: safeNumber(row.lat, null),
    lng: safeNumber(row.lng, null),
  };
}

function normalizeInsight(row) {
  return {
    icon: row.icon || "ℹ️",
    level: row.level || "info",
    title: row.title || row.judul || "Insight",
    desc: row.desc || row.pesan || row.message || "",
  };
}

function createFallbackCoordinate(index = 0) {
  const offset = index * 0.0025;

  return {
    lat: DEFAULT_CENTER[0] + offset,
    lng: DEFAULT_CENTER[1] + offset,
  };
}

function getMarkerMetric(item) {
  const produktivitas = safeNumber(item.produktivitas, 0);
  const prediksi = safeNumber(item.prediksi, 0);
  const produksi = safeNumber(item.produksi, 0);

  if (produktivitas > 0) {
    return {
      label: formatNumber(produktivitas, 1),
      title: "Produktivitas",
      desc: `${formatNumber(produktivitas, 2)} Ton/Ha`,
    };
  }

  if (prediksi > 0) {
    return {
      label: formatNumber(prediksi, 1),
      title: "Prediksi",
      desc: `${formatNumber(prediksi, 2)} Ton`,
    };
  }

  if (produksi > 0) {
    return {
      label: formatNumber(produksi, 1),
      title: "Produksi Aktual",
      desc: `${formatNumber(produksi, 2)} Ton`,
    };
  }

  return {
    label: "0",
    title: "Belum Ada Data",
    desc: "Belum ada produksi/prediksi",
  };
}

function createMapIcon(value, color = "#16a34a") {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 42px;
        height: 42px;
        border-radius: 999px 999px 999px 4px;
        transform: rotate(-45deg);
        background: ${color};
        border: 3px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 12px 24px rgba(15,23,42,.25);
      ">
        <span style="
          transform: rotate(45deg);
          color: white;
          font-size: 12px;
          font-weight: 900;
        ">
          ${value}
        </span>
      </div>
    `,
    iconSize: [42, 42],
    iconAnchor: [21, 42],
    popupAnchor: [0, -38],
  });
}

function MapFocus({ items }) {
  const map = useMap();

  useEffect(() => {
    const coords = items
      .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
      .map((item) => [item.lat, item.lng]);

    if (coords.length === 1) {
      map.setView(coords[0], 11);
      return;
    }

    if (coords.length > 1) {
      map.fitBounds(L.latLngBounds(coords), {
        padding: [25, 25],
        maxZoom: 11,
      });
    }
  }, [items, map]);

  return null;
}

export default function AnalisisProduksi() {
  const navigate = useNavigate();

  const detailTableRef = useRef(null);
  const komoditasRef = useRef(null);
  const topProduktivitasRef = useRef(null);

  const storedUser = getStoredUser();

  const penyuluhId =
    storedUser?.id ||
    localStorage.getItem("user_id") ||
    localStorage.getItem("penyuluh_id");

  const namaPenyuluh =
    storedUser?.nama || localStorage.getItem("nama") || "Penyuluh";

  const [summary, setSummary] = useState({});
  const [chartData, setChartData] = useState([]);
  const [petaniRows, setPetaniRows] = useState([]);
  const [wilayahRows, setWilayahRows] = useState([]);
  const [topProduktivitas, setTopProduktivitas] = useState([]);
  const [komoditasData, setKomoditasData] = useState([]);
  const [mapItems, setMapItems] = useState([]);
  const [insightList, setInsightList] = useState([]);
  const [kecamatanList, setKecamatanList] = useState([]);
  const [notifCount, setNotifCount] = useState(0);

  const [selectedKec, setSelectedKec] = useState("all");
  const [selectedDesa, setSelectedDesa] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const [startDate, setStartDate] = useState(getDateBeforeInput(60));
  const [endDate, setEndDate] = useState(getTodayInput());

  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const handleBellClick = () => {
    navigate("/penyuluh/notifikasi");
  };

  const scrollToDetailTable = () => {
    detailTableRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const scrollToKomoditas = () => {
    komoditasRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  const scrollToTopProduktivitas = () => {
    topProduktivitasRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  const fetchNotifCount = useCallback(async () => {
    try {
      const res = await api.get(`/notifikasi`, {
        params: {
          user_id: penyuluhId,
          penyuluh_id: penyuluhId,
          role: "penyuluh",
        },
      });

      const rows = safeList(res.data);

      const hasReadFlag = rows.some(
        (item) =>
          item.is_read !== undefined ||
          item.dibaca !== undefined ||
          item.read_at !== undefined
      );

      if (hasReadFlag) {
        const unread = rows.filter((item) => {
          if (item.read_at) return false;

          const readValue = item.is_read ?? item.dibaca ?? 0;

          return Number(readValue) === 0;
        }).length;

        setNotifCount(unread);
      } else {
        setNotifCount(rows.length);
      }
    } catch (err) {
      console.log("ERROR NOTIF COUNT:", err.response?.data || err.message);
      setNotifCount(0);
    }
  }, [penyuluhId]);

  const fetchKecamatan = useCallback(async () => {
    try {
      const res = await api.get(`/kecamatan`);
      setKecamatanList(safeList(res.data));
    } catch (err) {
      console.log("ERROR KECAMATAN:", err.response?.data || err.message);
      setKecamatanList([]);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorText("");

      const res = await api.get(`/penyuluh/analisis-produksi`, {
        params: {
          start_date: startDate,
          end_date: endDate,
          kecamatan: selectedKec,
          desa: selectedDesa,
          status: selectedStatus,
        },
      });

      const result = res.data || {};

      setSummary(result.summary || {});
      setChartData(safeList(result.chart).map(normalizeChart));
      setPetaniRows(safeList(result.petani).map(normalizePetani));
      setWilayahRows(safeList(result.wilayah).map(normalizeWilayah));
      setTopProduktivitas(
        safeList(result.topProduktivitas).map(normalizeWilayah)
      );
      setKomoditasData(safeList(result.komoditas).map(normalizeKomoditas));
      setMapItems(safeList(result.map).map(normalizeMap));
      setInsightList(safeList(result.rekomendasi).map(normalizeInsight));
    } catch (err) {
      console.log("ERROR ANALISIS PRODUKSI:", err.response?.data || err.message);

      setSummary({});
      setChartData([]);
      setPetaniRows([]);
      setWilayahRows([]);
      setTopProduktivitas([]);
      setKomoditasData([]);
      setMapItems([]);
      setInsightList([]);

      setErrorText(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Gagal memuat analisis produksi."
      );
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedKec, selectedDesa, selectedStatus]);

  useEffect(() => {
    fetchKecamatan();
  }, [fetchKecamatan]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchNotifCount();

    const interval = setInterval(() => {
      fetchNotifCount();
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchNotifCount]);

  const kecamatanOptions = useMemo(() => {
    const fromApi = kecamatanList
      .map((item) => item.nama_kecamatan || item.nama || item.kecamatan)
      .filter(Boolean);

    const fromWilayah = wilayahRows
      .map((item) => item.kecamatan)
      .filter((item) => item && item !== "-");

    const fromPetani = petaniRows
      .map((item) => item.nama_kecamatan)
      .filter((item) => item && item !== "-");

    return Array.from(new Set([...fromApi, ...fromWilayah, ...fromPetani]));
  }, [kecamatanList, wilayahRows, petaniRows]);

  const desaOptions = useMemo(() => {
    const fromWilayah = wilayahRows
      .filter((item) => {
        if (selectedKec === "all") return true;
        return item.kecamatan === selectedKec;
      })
      .map((item) => item.desa || item.wilayah)
      .filter((item) => item && item !== "-");

    const fromPetani = petaniRows
      .filter((item) => {
        if (selectedKec === "all") return true;
        return item.nama_kecamatan === selectedKec;
      })
      .map((item) => item.nama_desa)
      .filter((item) => item && item !== "-");

    return Array.from(new Set([...fromWilayah, ...fromPetani]));
  }, [wilayahRows, petaniRows, selectedKec]);

  const displayMapItems = useMemo(() => {
    const coordCounter = {};

    return mapItems.map((item, index) => {
      const hasValidCoordinate =
        Number.isFinite(item.lat) && Number.isFinite(item.lng);

      const fallback = createFallbackCoordinate(index);

      const baseLat = hasValidCoordinate ? item.lat : fallback.lat;
      const baseLng = hasValidCoordinate ? item.lng : fallback.lng;

      const key = `${baseLat.toFixed(5)},${baseLng.toFixed(5)}`;
      const count = coordCounter[key] || 0;

      coordCounter[key] = count + 1;

      const offset = count * 0.00035;

      return {
        ...item,
        lat: baseLat + offset,
        lng: baseLng + offset,
        isFallbackCoordinate: !hasValidCoordinate,
      };
    });
  }, [mapItems]);

  const perubahan = summary?.perubahan || {};

  const totalProduksiAktual = safeNumber(summary.total_produksi_aktual, 0);
  const totalPrediksiProduksi = safeNumber(summary.total_prediksi_produksi, 0);
  const rataProduktivitas = safeNumber(summary.rata_rata_produktivitas, 0);
  const totalLuasPanen = safeNumber(summary.total_luas_panen, 0);
  const jumlahPetaniAktif = safeNumber(summary.jumlah_petani_aktif, 0);

  const showCatatanProduksi =
    totalPrediksiProduksi > 0 &&
    totalProduksiAktual >= 0 &&
    totalProduksiAktual < totalPrediksiProduksi * 0.5;

  const exportCsv = () => {
    const header = [
      "Petani",
      "Desa",
      "Kecamatan",
      "Luas Ha",
      "Komoditas",
      "Produksi Aktual",
      "Prediksi",
      "Produktivitas",
      "Selisih",
      "Status",
    ];

    const rows = petaniRows.map((item) => [
      item.nama_petani,
      item.nama_desa,
      item.nama_kecamatan,
      item.total_luas,
      item.komoditas,
      item.total_produksi,
      item.total_prediksi,
      item.produktivitas,
      item.selisih,
      statusLabel(item.status),
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `analisis-produksi-${startDate}-sd-${endDate}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div style={styles.page}>
      <div style={styles.topbar}>
        <div style={styles.topbarSpacer} />

        <div style={styles.topbarRight}>
          <div style={styles.dateChip}>📅 {formatFullDate(new Date())}</div>

          <div style={styles.weatherChip}>
            <span>☀️</span>
            <div>
              <strong>27.5°C</strong>
              <small>Cerah</small>
            </div>
          </div>

          <button
            type="button"
            style={styles.notifButton}
            title="Buka notifikasi penyuluh"
            onClick={handleBellClick}
          >
            🔔
            {notifCount > 0 && (
              <span style={styles.notifBadge}>
                {notifCount > 99 ? "99+" : notifCount}
              </span>
            )}
          </button>

          <button type="button" style={styles.profileChip}>
            <div style={styles.profileAvatar}>👨‍🌾</div>
            <div>
              <strong>{namaPenyuluh}</strong>
              <small>Penyuluh</small>
            </div>
          </button>
        </div>
      </div>

      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.headerIcon}>📊</div>

          <div>
            <h1 style={styles.title}>Analisis Produksi & Prediksi</h1>
            <p style={styles.subtitle}>
              Monitoring dan analisis produksi padi pada petani binaan secara
              menyeluruh
            </p>
          </div>
        </div>
      </div>

      <div style={styles.filterRow}>
        <select
          value={selectedKec}
          onChange={(e) => {
            setSelectedKec(e.target.value);
            setSelectedDesa("all");
          }}
          style={styles.select}
        >
          <option value="all">Semua Kecamatan</option>
          {kecamatanOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select
          value={selectedDesa}
          onChange={(e) => setSelectedDesa(e.target.value)}
          style={styles.select}
        >
          <option value="all">Semua Desa</option>
          {desaOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          style={styles.select}
        >
          <option value="all">Semua Status</option>
          <option value="baik">Baik</option>
          <option value="waspada">Perlu Perhatian</option>
          <option value="kritis">Kritis</option>
        </select>

        <div style={styles.periodBox}>
          <span>📅</span>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={styles.dateInput}
          />

          <span style={styles.dateSeparator}>s/d</span>

          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={styles.dateInput}
          />
        </div>

        <button style={styles.exportBtn} onClick={exportCsv}>
          ⬇ Export Laporan
        </button>
      </div>

      {errorText && <div style={styles.errorBox}>{errorText}</div>}

      <div style={styles.kpiGrid}>
        <KpiCard
          title="Total Produksi Aktual Tercatat"
          value={formatNumber(totalProduksiAktual, 2)}
          unit="Ton"
          desc={formatChange(perubahan.produksi_aktual)}
          descColor={getChangeColor(perubahan.produksi_aktual)}
          icon="🧪"
          color="#059669"
          bg="#dcfce7"
        />

        <KpiCard
          title="Total Prediksi Produksi"
          value={formatNumber(totalPrediksiProduksi, 2)}
          unit="Ton"
          desc={formatChange(perubahan.prediksi_produksi)}
          descColor={getChangeColor(perubahan.prediksi_produksi)}
          icon="📈"
          color="#2563eb"
          bg="#dbeafe"
        />

        <KpiCard
          title="Rata-rata Produktivitas"
          value={formatNumber(rataProduktivitas, 2)}
          unit="Ton/Ha"
          desc={formatChange(perubahan.produktivitas)}
          descColor={getChangeColor(perubahan.produktivitas)}
          icon="🧭"
          color="#7c3aed"
          bg="#ede9fe"
        />

        <KpiCard
          title="Total Luas Panen"
          value={formatNumber(totalLuasPanen, 2)}
          unit="Ha"
          desc={formatChange(perubahan.luas_panen)}
          descColor={getChangeColor(perubahan.luas_panen)}
          icon="📊"
          color="#b45309"
          bg="#ffedd5"
        />

        <KpiCard
          title="Jumlah Petani Aktif"
          value={jumlahPetaniAktif}
          unit="Petani"
          desc={formatChange(perubahan.petani_aktif)}
          descColor={getChangeColor(perubahan.petani_aktif)}
          icon="👥"
          color="#059669"
          bg="#dcfce7"
        />
      </div>

      {showCatatanProduksi && (
        <div style={styles.infoBox}>
          ℹ️ Produksi aktual tercatat masih jauh lebih kecil dibandingkan
          prediksi karena produksi aktual hanya berasal dari data panen yang
          sudah tercatat pada sistem, sedangkan prediksi produksi berasal dari
          hasil estimasi model.
        </div>
      )}

      <div style={styles.mainGrid}>
        <div style={styles.leftColumn}>
          <div style={styles.chartCard}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>
                Perbandingan Produksi Aktual & Prediksi
              </h3>

              <select style={styles.smallSelect} disabled>
                <option>Per Bulan</option>
              </select>
            </div>

            <div style={styles.chartBox}>
              {loading ? (
                <div style={styles.emptyBox}>Memuat grafik produksi...</div>
              ) : chartData.length === 0 ? (
                <div style={styles.emptyBox}>
                  Belum ada data grafik pada periode ini.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient
                        id="actualGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#16a34a"
                          stopOpacity={0.28}
                        />
                        <stop
                          offset="95%"
                          stopColor="#16a34a"
                          stopOpacity={0.03}
                        />
                      </linearGradient>

                      <linearGradient
                        id="predictionGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#f59e0b"
                          stopOpacity={0.28}
                        />
                        <stop
                          offset="95%"
                          stopColor="#f59e0b"
                          stopOpacity={0.03}
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />

                    <Area
                      type="monotone"
                      dataKey="produksi"
                      name="Produksi Aktual (Ton)"
                      stroke="#16a34a"
                      fill="url(#actualGradient)"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />

                    <Area
                      type="monotone"
                      dataKey="prediksi"
                      name="Prediksi Produksi (Ton)"
                      stroke="#f59e0b"
                      fill="url(#predictionGradient)"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div style={styles.tableCard} ref={detailTableRef}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>
                Detail Produksi per Petani Binaan
              </h3>

              <button style={styles.refreshBtn} onClick={fetchData}>
                Refresh
              </button>
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Petani</th>
                    <th style={styles.th}>Desa</th>
                    <th style={styles.th}>Kecamatan</th>
                    <th style={styles.th}>Luas (Ha)</th>
                    <th style={styles.th}>Komoditas</th>
                    <th style={styles.th}>Produksi Aktual</th>
                    <th style={styles.th}>Prediksi</th>
                    <th style={styles.th}>Produktivitas</th>
                    <th style={styles.th}>Selisih</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Aksi</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="11" style={styles.emptyCell}>
                        Memuat data analisis produksi...
                      </td>
                    </tr>
                  ) : petaniRows.length === 0 ? (
                    <tr>
                      <td colSpan="11" style={styles.emptyCell}>
                        Belum ada data produksi.
                      </td>
                    </tr>
                  ) : (
                    petaniRows.map((item) => (
                      <tr key={item.id}>
                        <td style={styles.td}>
                          <div style={styles.petaniCell}>
                            <div style={styles.avatar}>👨‍🌾</div>

                            <div>
                              <strong>{item.nama_petani}</strong>
                              <small style={styles.smallText}>
                                {item.no_hp}
                              </small>
                            </div>
                          </div>
                        </td>

                        <td style={styles.td}>{item.nama_desa}</td>
                        <td style={styles.td}>{item.nama_kecamatan}</td>
                        <td style={styles.td}>
                          {formatNumber(item.total_luas, 2)}
                        </td>
                        <td style={styles.td}>{item.komoditas}</td>
                        <td style={styles.td}>
                          {formatNumber(item.total_produksi, 2)}
                        </td>
                        <td style={styles.td}>
                          {formatNumber(item.total_prediksi, 2)}
                        </td>
                        <td style={styles.td}>
                          {formatNumber(item.produktivitas, 2)}
                        </td>
                        <td style={styles.td}>
                          {formatNumber(item.selisih, 2)}
                        </td>

                        <td style={styles.td}>
                          <span style={statusBadge(item.status)}>
                            {statusLabel(item.status)}
                          </span>
                        </td>

                        <td style={styles.td}>
                          <div style={styles.actionGroup}>
                            <button
                              style={styles.iconBtn}
                              onClick={() => navigate("/penyuluh/peta")}
                              title="Lihat di peta"
                            >
                              👁️
                            </button>

                            <button
                              style={styles.iconBtn}
                              onClick={() =>
                                navigate("/penyuluh/rekomendasi")
                              }
                              title="Analisis rekomendasi"
                            >
                              📈
                            </button>

                            <button
                              style={styles.iconBtn}
                              onClick={() => navigate("/penyuluh/catatan")}
                              title="Catatan"
                            >
                              ⋮
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <button style={styles.fullWidthBtn} onClick={fetchData}>
              Refresh Data
            </button>
          </div>
        </div>

        <div style={styles.rightColumn}>
          <div style={styles.sideCard}>
            <h3 style={styles.cardTitle}>Peta Sebaran Produksi</h3>

            <div style={styles.mapBox}>
              <MapContainer
                center={DEFAULT_CENTER}
                zoom={10}
                scrollWheelZoom={false}
                style={styles.map}
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <MapFocus items={displayMapItems} />

                {displayMapItems.map((item, index) => {
                  const markerMetric = getMarkerMetric(item);

                  return (
                    <Marker
                      key={`${item.wilayah}-${index}`}
                      position={[item.lat, item.lng]}
                      icon={createMapIcon(
                        markerMetric.label,
                        MAP_COLORS[index % MAP_COLORS.length]
                      )}
                    >
                      <Popup>
                        <strong>{item.wilayah}</strong>
                        <br />
                        Kecamatan: {item.kecamatan}
                        <br />
                        Marker: {markerMetric.title} ({markerMetric.desc})
                        <br />
                        Produktivitas: {formatNumber(item.produktivitas, 2)}{" "}
                        Ton/Ha
                        <br />
                        Produksi Aktual: {formatTon(item.produksi)}
                        <br />
                        Prediksi: {formatTon(item.prediksi)}
                        <br />
                        {item.isFallbackCoordinate && (
                          <em>Koordinat asli belum tersedia.</em>
                        )}
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>

              <button
                style={styles.mapDetailBtn}
                onClick={() => navigate("/penyuluh/peta")}
              >
                Lihat Detail di Peta →
              </button>
            </div>
          </div>

          <div style={styles.sideCard} ref={topProduktivitasRef}>
            <h3 style={styles.cardTitle}>Top 5 Produktivitas (Ton/Ha)</h3>

            <div style={styles.rankList}>
              {topProduktivitas.length === 0 ? (
                <div style={styles.emptyBox}>Belum ada data produktivitas.</div>
              ) : (
                topProduktivitas.map((item, index) => (
                  <RankRow
                    key={`${item.wilayah}-${index}`}
                    index={index}
                    name={`Desa ${item.wilayah}`}
                    value={item.produktivitas}
                  />
                ))
              )}
            </div>

            <button
              style={styles.fullWidthBtnSmall}
              onClick={scrollToDetailTable}
            >
              Lihat Semua →
            </button>
          </div>

          <div style={styles.sideCard} ref={komoditasRef}>
            <h3 style={styles.cardTitle}>Komoditas yang Ditanam</h3>

            <div style={styles.pieContent}>
              <div style={styles.pieBox}>
                {komoditasData.length === 0 ? (
                  <div style={styles.emptyBox}>Kosong</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={komoditasData}
                        innerRadius={38}
                        outerRadius={64}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {komoditasData.map((entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div style={styles.pieLegend}>
                {komoditasData.length === 0 ? (
                  <span style={styles.smallText}>Belum ada komoditas.</span>
                ) : (
                  komoditasData.map((item, index) => {
                    const total = komoditasData.reduce(
                      (sum, row) => sum + row.value,
                      0
                    );

                    const percent =
                      item.persentase ||
                      (total > 0 ? Math.round((item.value / total) * 100) : 0);

                    return (
                      <div key={item.name} style={styles.legendItem}>
                        <span
                          style={{
                            ...styles.legendDot,
                            background: PIE_COLORS[index % PIE_COLORS.length],
                          }}
                        />

                        <strong>{item.name}</strong>
                        <span>{percent}%</span>
                        <small>({formatHa(item.luas)})</small>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <button
              style={styles.fullWidthBtnSmall}
              onClick={scrollToDetailTable}
            >
              Lihat Detail →
            </button>
          </div>

          <div style={styles.sideCard}>
            <h3 style={styles.cardTitle}>Insights & Rekomendasi AI</h3>

            <div style={styles.insightList}>
              {insightList.length === 0 ? (
                <div style={styles.emptyBox}>Belum ada insight.</div>
              ) : (
                insightList.map((item, index) => (
                  <InsightRow key={index} item={item} />
                ))
              )}
            </div>

            <button
              style={styles.fullWidthBtnSmall}
              onClick={() => navigate("/penyuluh/rekomendasi")}
            >
              Lihat Semua Rekomendasi →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, unit, desc, descColor, icon, color, bg }) {
  return (
    <div style={styles.kpiCard}>
      <div>
        <h3 style={styles.kpiTitle}>{title}</h3>

        <div style={styles.kpiValue}>
          <strong style={{ color }}>{value}</strong>
          <span style={{ color }}>{unit}</span>
        </div>

        <p style={{ ...styles.kpiDesc, color: descColor || "#059669" }}>
          {desc}
        </p>
      </div>

      <div style={{ ...styles.kpiIcon, background: bg, color }}>{icon}</div>
    </div>
  );
}

function RankRow({ index, name, value }) {
  const width = Math.min(100, Math.max(5, safeNumber(value, 0)));
  const colors = ["#f59e0b", "#f59e0b", "#a16207", "#9ca3af", "#9ca3af"];

  return (
    <div style={styles.rankRow}>
      <div style={styles.rankHead}>
        <span
          style={{
            ...styles.rankNumber,
            background: colors[index] || "#9ca3af",
          }}
        >
          {index + 1}
        </span>

        <strong>{name}</strong>

        <b>{formatNumber(value, 2)} Ton/Ha</b>
      </div>

      <div style={styles.progressBg}>
        <div
          style={{
            ...styles.progressFill,
            width: `${width}%`,
          }}
        />
      </div>
    </div>
  );
}

function InsightRow({ item }) {
  const color =
    item.level === "warning"
      ? "#f59e0b"
      : item.level === "danger"
      ? "#ef4444"
      : item.level === "info"
      ? "#2563eb"
      : "#16a34a";

  const bg =
    item.level === "warning"
      ? "#fffbeb"
      : item.level === "danger"
      ? "#fee2e2"
      : item.level === "info"
      ? "#dbeafe"
      : "#dcfce7";

  return (
    <div style={styles.insightRow}>
      <div style={{ ...styles.insightIcon, background: bg, color }}>
        {item.icon}
      </div>

      <div>
        <strong>{item.title}</strong>
        <p>{item.desc}</p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f6f8fb",
    padding: 24,
    boxSizing: "border-box",
    color: "#0f172a",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  topbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },

  topbarSpacer: {
    flex: 1,
  },

  topbarRight: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  dateChip: {
    height: 46,
    padding: "0 16px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    fontWeight: 900,
    boxShadow: "0 8px 20px rgba(15,23,42,.04)",
  },

  weatherChip: {
    height: 46,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    gap: 10,
    boxShadow: "0 8px 20px rgba(15,23,42,.04)",
  },

  notifButton: {
    width: 46,
    height: 46,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    cursor: "pointer",
    fontSize: 18,
    padding: 0,
    boxShadow: "0 8px 20px rgba(15,23,42,.04)",
  },

  notifBadge: {
    position: "absolute",
    top: -7,
    right: -6,
    minWidth: 20,
    height: 20,
    padding: "0 5px",
    borderRadius: 999,
    background: "#ef4444",
    color: "#ffffff",
    fontSize: 11,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  profileChip: {
    height: 46,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    padding: "0 12px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(15,23,42,.04)",
  },

  profileAvatar: {
    width: 34,
    height: 34,
    borderRadius: 999,
    background: "#dcfce7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },

  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },

  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    background: "#dcfce7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
  },

  title: {
    margin: 0,
    fontSize: 26,
    fontWeight: 950,
    letterSpacing: "-0.5px",
  },

  subtitle: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 14,
  },

  filterRow: {
    display: "grid",
    gridTemplateColumns: "220px 190px 190px 360px 150px",
    gap: 14,
    marginBottom: 24,
  },

  select: {
    height: 44,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    background: "#ffffff",
    padding: "0 14px",
    fontWeight: 800,
    color: "#0f172a",
  },

  periodBox: {
    height: 44,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 12px",
  },

  dateInput: {
    border: "none",
    outline: "none",
    fontWeight: 800,
    color: "#0f172a",
    background: "transparent",
    width: 126,
  },

  dateSeparator: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 800,
  },

  exportBtn: {
    height: 44,
    border: "none",
    borderRadius: 10,
    background: "#059669",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },

  refreshBtn: {
    height: 34,
    border: "1px solid #d1d5db",
    borderRadius: 9,
    background: "#ffffff",
    color: "#047857",
    fontWeight: 900,
    cursor: "pointer",
    padding: "0 14px",
  },

  errorBox: {
    background: "#fee2e2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    borderRadius: 12,
    padding: 14,
    fontWeight: 800,
    marginBottom: 18,
  },

  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 16,
    marginBottom: 22,
  },

  kpiCard: {
    minHeight: 112,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 12px 30px rgba(15,23,42,.06)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
  },

  kpiTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 900,
  },

  kpiValue: {
    display: "flex",
    alignItems: "baseline",
    gap: 7,
    marginTop: 12,
  },

  kpiDesc: {
    margin: "8px 0 0",
    fontSize: 13,
    fontWeight: 700,
  },

  kpiIcon: {
    width: 60,
    height: 60,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 28,
    flexShrink: 0,
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 405px",
    gap: 18,
  },

  leftColumn: {
    display: "grid",
    gap: 18,
    minWidth: 0,
  },

  rightColumn: {
    display: "grid",
    gap: 18,
    alignContent: "start",
  },

  chartCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 12px 30px rgba(15,23,42,.06)",
  },

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  cardTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 950,
  },

  smallSelect: {
    height: 36,
    border: "1px solid #e5e7eb",
    borderRadius: 9,
    background: "#ffffff",
    padding: "0 10px",
    fontWeight: 800,
  },

  chartBox: {
    width: "100%",
    height: 330,
  },

  tableCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 12px 30px rgba(15,23,42,.06)",
    scrollMarginTop: 20,
  },

  tableWrap: {
    overflowX: "auto",
    marginTop: 12,
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },

  th: {
    textAlign: "left",
    color: "#475569",
    fontSize: 12,
    fontWeight: 950,
    padding: "12px 10px",
    borderBottom: "1px solid #e5e7eb",
    whiteSpace: "nowrap",
  },

  td: {
    padding: "13px 10px",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },

  petaniCell: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    background: "#dbeafe",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  smallText: {
    display: "block",
    fontSize: 12,
    color: "#64748b",
    marginTop: 3,
  },

  actionGroup: {
    display: "flex",
    gap: 7,
  },

  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    cursor: "pointer",
  },

  emptyCell: {
    textAlign: "center",
    color: "#64748b",
    padding: 24,
  },

  fullWidthBtn: {
    width: "100%",
    height: 42,
    borderRadius: 10,
    border: "1px solid #bbf7d0",
    background: "#ffffff",
    color: "#059669",
    fontWeight: 900,
    cursor: "pointer",
    marginTop: 16,
  },

  fullWidthBtnSmall: {
    width: "100%",
    height: 38,
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#059669",
    fontWeight: 900,
    cursor: "pointer",
    marginTop: 12,
  },

  sideCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 12px 30px rgba(15,23,42,.06)",
    scrollMarginTop: 20,
  },

  mapBox: {
    position: "relative",
    height: 245,
    marginTop: 12,
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid #e5e7eb",
  },

  map: {
    width: "100%",
    height: "100%",
  },

  mapDetailBtn: {
    position: "absolute",
    right: 12,
    bottom: 12,
    zIndex: 900,
    height: 36,
    padding: "0 14px",
    border: "none",
    borderRadius: 10,
    background: "rgba(255,255,255,.94)",
    color: "#059669",
    fontWeight: 900,
    cursor: "pointer",
  },

  rankList: {
    display: "grid",
    gap: 14,
    marginTop: 14,
  },

  rankRow: {
    display: "grid",
    gap: 8,
  },

  rankHead: {
    display: "grid",
    gridTemplateColumns: "28px 1fr auto",
    gap: 10,
    alignItems: "center",
    fontSize: 13,
  },

  rankNumber: {
    width: 24,
    height: 24,
    borderRadius: 999,
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
  },

  progressBg: {
    height: 8,
    background: "#e5e7eb",
    borderRadius: 999,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 999,
    background: "#16a34a",
  },

  pieContent: {
    display: "grid",
    gridTemplateColumns: "150px 1fr",
    gap: 10,
    alignItems: "center",
    marginTop: 10,
  },

  pieBox: {
    height: 150,
  },

  pieLegend: {
    display: "grid",
    gap: 10,
  },

  legendItem: {
    display: "grid",
    gridTemplateColumns: "12px 1fr auto auto",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
  },

  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },

  insightList: {
    display: "grid",
    gap: 12,
    marginTop: 14,
  },

  insightRow: {
    display: "grid",
    gridTemplateColumns: "42px 1fr",
    gap: 12,
    alignItems: "flex-start",
    paddingBottom: 12,
    borderBottom: "1px solid #f1f5f9",
  },

  insightIcon: {
    width: 38,
    height: 38,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 19,
  },

  infoBox: {
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1e40af",
    borderRadius: 12,
    padding: 14,
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.5,
    marginBottom: 18,
  },

  emptyBox: {
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
    padding: 14,
    color: "#64748b",
    textAlign: "center",
    fontSize: 13,
  },
};