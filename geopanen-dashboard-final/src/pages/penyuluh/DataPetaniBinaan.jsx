import { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import { useNavigate } from "react-router-dom";

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

const REGION_COLORS = [
  "#16a34a",
  "#f59e0b",
  "#2563eb",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
];

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

function formatHa(value) {
  return `${formatNumber(value, 2)} Ha`;
}

function formatTon(value) {
  return `${formatNumber(value, 2)} Ton`;
}

function formatDate(date = new Date()) {
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
  if (raw.includes("tinggi")) return "kritis";
  if (raw.includes("rendah")) return "kritis";
  if (raw.includes("waspada")) return "waspada";
  if (raw.includes("perhatian")) return "waspada";
  if (raw.includes("sedang")) return "waspada";
  if (raw.includes("aktif")) return "aktif";
  if (raw.includes("sehat")) return "aktif";
  if (raw.includes("baik")) return "aktif";

  return "aktif";
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
    fontWeight: 800,
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

function statusLabel(status) {
  const key = normalizeStatus(status);

  if (key === "kritis") return "Kritis";
  if (key === "waspada") return "Perlu Perhatian";
  return "Aktif";
}

function healthLabel(status) {
  const key = normalizeStatus(status);

  if (key === "kritis") return "Kritis";
  if (key === "waspada") return "Perlu Perhatian";
  return "Sehat";
}

function healthColor(status) {
  const key = normalizeStatus(status);

  if (key === "kritis") return "#ef4444";
  if (key === "waspada") return "#f59e0b";
  return "#16a34a";
}

function getLat(row) {
  return safeNumber(
    row.lat ??
      row.latitude ??
      row.lokasi_lat ??
      row.koordinat_lat ??
      row.desa_lat,
    null
  );
}

function getLng(row) {
  return safeNumber(
    row.lng ??
      row.longitude ??
      row.lokasi_lng ??
      row.koordinat_lng ??
      row.desa_lng,
    null
  );
}

function getHealthPercent(status, prediksiTon, skor) {
  if (Number.isFinite(Number(skor))) return Number(skor);

  const key = normalizeStatus(status);

  if (key === "kritis") return 45;
  if (key === "waspada") return 62;
  if (safeNumber(prediksiTon, 0) >= 1) return 91;

  return 82;
}

function normalizeRawRow(row) {
  const petaniId =
    row.petani_id ||
    row.user_id ||
    row.id_petani ||
    row.petaniId ||
    row.userId ||
    "";

  const lahanId = row.lahan_id || row.id || row.sawah_id;

  const namaPetani =
    row.nama_petani ||
    row.petani_nama ||
    row.nama_user ||
    row.nama ||
    "Petani";

  const statusSource =
    row.status_kesehatan ||
    row.kesehatan ||
    row.status_tanaman ||
    row.status_risiko ||
    row.status;

  const status = normalizeStatus(statusSource);

  const prediksiTon = safeNumber(
    row.prediksi_ton ||
      row.prediksi_produksi ||
      row.total_prediksi ||
      row.prediksi_hasil,
    0
  );

  const skorKesehatan = getHealthPercent(
    status,
    prediksiTon,
    row.skor_kesehatan
  );

  return {
    raw_id: row.id,
    id: lahanId,
    lahan_id: lahanId,
    sawah_id: row.sawah_id || lahanId,

    petani_id: petaniId,
    user_id: row.user_id || petaniId,
    nama_petani: namaPetani,

    no_hp: row.no_hp || row.telepon || row.phone || row.nomor_hp || "-",

    nama_desa: row.nama_desa || row.desa || "-",
    nama_kecamatan: row.nama_kecamatan || row.kecamatan || "-",

    desa_id: row.desa_id || "",
    kecamatan_id: row.kecamatan_id || "",

    nama_lahan:
      row.nama_lahan || row.lahan || row.nama_sawah || "Lahan Petani",

    komoditas: row.komoditas || row.tanaman || row.jenis_tanaman || "Padi",
    varietas: row.varietas || row.varietas_padi || "Padi",

    luas_m2: safeNumber(row.luas_m2, safeNumber(row.luas_ha, 0) * 10000),
    luas_ha: safeNumber(row.luas_ha || row.luas || row.total_luas, 0),

    prediksi_ton: prediksiTon,
    prediksi_kg: safeNumber(row.prediksi_kg, prediksiTon * 1000),

    status,
    status_kesehatan: row.status_kesehatan || status,
    skor_kesehatan: skorKesehatan,

    umur_tanaman: safeNumber(row.umur_tanaman || row.umur_tanam, 0),
    fase_tanaman: row.fase_tanaman || row.fase_tanam || "Vegetatif Awal",

    lat: getLat(row),
    lng: getLng(row),

    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

function groupPetani(rows) {
  const map = new Map();

  rows.forEach((raw) => {
    const row = normalizeRawRow(raw);
    const key = String(row.petani_id || row.nama_petani);

    if (!map.has(key)) {
      map.set(key, {
        id: key,
        petani_id: row.petani_id,
        user_id: row.user_id,
        nama_petani: row.nama_petani,
        no_hp: row.no_hp,
        nama_desa: row.nama_desa,
        nama_kecamatan: row.nama_kecamatan,
        komoditas: row.komoditas,
        varietas: row.varietas,
        status: row.status,
        total_lahan: 0,
        total_luas: 0,
        total_prediksi: 0,
        healthScores: [],
        latList: [],
        lngList: [],
        lahan: [],
      });
    }

    const group = map.get(key);

    group.lahan.push(row);
    group.total_lahan += 1;
    group.total_luas += safeNumber(row.luas_ha, 0);
    group.total_prediksi += safeNumber(row.prediksi_ton, 0);
    group.healthScores.push(safeNumber(row.skor_kesehatan, 82));

    if (Number.isFinite(row.lat)) group.latList.push(row.lat);
    if (Number.isFinite(row.lng)) group.lngList.push(row.lng);

    if (row.status === "kritis") {
      group.status = "kritis";
    } else if (group.status !== "kritis" && row.status === "waspada") {
      group.status = "waspada";
    }
  });

  return Array.from(map.values()).map((item) => {
    const lat =
      item.latList.length > 0
        ? item.latList.reduce((a, b) => a + b, 0) / item.latList.length
        : null;

    const lng =
      item.lngList.length > 0
        ? item.lngList.reduce((a, b) => a + b, 0) / item.lngList.length
        : null;

    const avgHealth =
      item.healthScores.length > 0
        ? Math.round(
            item.healthScores.reduce((a, b) => a + b, 0) /
              item.healthScores.length
          )
        : getHealthPercent(item.status, item.total_prediksi);

    return {
      ...item,
      lat,
      lng,
      kesehatan_percent: avgHealth,
    };
  });
}

function createFallbackCoordinate(index = 0) {
  const offset = index * 0.0025;

  return {
    lat: DEFAULT_CENTER[0] + offset,
    lng: DEFAULT_CENTER[1] + offset,
  };
}

function createPetaniIcon(status, label, colorIndex = 0) {
  const key = normalizeStatus(status);

  const color =
    key === "kritis"
      ? "#ef4444"
      : key === "waspada"
      ? "#f59e0b"
      : REGION_COLORS[colorIndex % REGION_COLORS.length];

  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 30px;
        height: 30px;
        border-radius: 999px;
        background: ${color};
        border: 3px solid white;
        color: white;
        font-weight: 900;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 8px 18px rgba(15,23,42,.25);
      ">
        ${label}
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
  });
}

function MapFocus({ items }) {
  const map = useMap();

  useEffect(() => {
    const coords = items
      .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
      .map((item) => [item.lat, item.lng]);

    if (coords.length === 1) {
      map.setView(coords[0], 12);
      return;
    }

    if (coords.length > 1) {
      map.fitBounds(L.latLngBounds(coords), {
        padding: [25, 25],
        maxZoom: 12,
      });
    }
  }, [items, map]);

  return null;
}

export default function DataPetaniBinaan() {
  const navigate = useNavigate();

  const [rawData, setRawData] = useState([]);
  const [aktivitas, setAktivitas] = useState([]);

  const [search, setSearch] = useState("");
  const [filterKecamatan, setFilterKecamatan] = useState("all");
  const [filterDesa, setFilterDesa] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [loading, setLoading] = useState(false);
  const [modalMode, setModalMode] = useState(null);
  const [selectedPetani, setSelectedPetani] = useState(null);

  const storedUser = getStoredUser();

  const penyuluhId =
    storedUser?.id ||
    localStorage.getItem("user_id") ||
    localStorage.getItem("penyuluh_id");

  const namaPenyuluh =
    storedUser?.nama || localStorage.getItem("nama") || "Penyuluh";

  useEffect(() => {
    fetchData();
    fetchAktivitas();

    const interval = setInterval(() => {
      fetchData();
      fetchAktivitas();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      let rows = [];

      try {
        const res = await api.get(`/penyuluh/petani-binaan`, {
          params: {
            penyuluh_id: penyuluhId,
          },
        });

        rows = safeList(res.data);
      } catch (err) {
        console.log("Endpoint petani-binaan gagal, fallback map-binaan.");
      }

      if (rows.length === 0) {
        const fallback = await api.get(`/map-binaan`, {
          params: {
            penyuluh_id: penyuluhId,
          },
        });

        rows = safeList(fallback.data);
      }

      setRawData(rows);
    } catch (err) {
      console.log("ERROR DATA PETANI BINAAN:", err.response?.data || err);
      setRawData([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAktivitas = async () => {
    try {
      const res = await api.get(`/notifikasi`, {
        params: {
          user_id: penyuluhId,
          role: "penyuluh",
        },
      });

      setAktivitas(safeList(res.data));
    } catch (err) {
      console.log("ERROR AKTIVITAS:", err.response?.data || err.message);
      setAktivitas([]);
    }
  };

  const handleBellClick = () => {
    navigate("/penyuluh/notifikasi");
  };

  const petaniList = useMemo(() => {
    return groupPetani(rawData);
  }, [rawData]);

  const kecamatanFilterOptions = useMemo(() => {
    return Array.from(
      new Set(
        petaniList
          .map((item) => item.nama_kecamatan)
          .filter((item) => item && item !== "-")
      )
    );
  }, [petaniList]);

  const desaFilterOptions = useMemo(() => {
    return Array.from(
      new Set(
        petaniList
          .map((item) => item.nama_desa)
          .filter((item) => item && item !== "-")
      )
    );
  }, [petaniList]);

  const filteredData = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return petaniList.filter((item) => {
      const matchSearch =
        !keyword ||
        item.nama_petani.toLowerCase().includes(keyword) ||
        item.nama_desa.toLowerCase().includes(keyword) ||
        item.nama_kecamatan.toLowerCase().includes(keyword);

      const matchKecamatan =
        filterKecamatan === "all" || item.nama_kecamatan === filterKecamatan;

      const matchDesa = filterDesa === "all" || item.nama_desa === filterDesa;

      const matchStatus =
        filterStatus === "all" || item.status === filterStatus;

      return matchSearch && matchKecamatan && matchDesa && matchStatus;
    });
  }, [petaniList, search, filterKecamatan, filterDesa, filterStatus]);

  const summary = useMemo(() => {
    const totalPetani = petaniList.length;

    const petaniAktif = petaniList.filter(
      (item) => item.status === "aktif"
    ).length;

    const perluPerhatian = petaniList.filter((item) =>
      ["waspada", "kritis"].includes(item.status)
    ).length;

    const totalLahan = petaniList.reduce(
      (sum, item) => sum + item.total_lahan,
      0
    );

    const totalLuas = petaniList.reduce(
      (sum, item) => sum + item.total_luas,
      0
    );

    const totalPrediksi = petaniList.reduce(
      (sum, item) => sum + item.total_prediksi,
      0
    );

    return {
      totalPetani,
      petaniAktif,
      perluPerhatian,
      totalLahan,
      totalLuas,
      totalPrediksi,
    };
  }, [petaniList]);

  const wilayahSummary = useMemo(() => {
    const map = new Map();

    petaniList.forEach((item) => {
      const key = item.nama_kecamatan || "-";

      if (!map.has(key)) {
        map.set(key, {
          wilayah: key,
          petani: 0,
          luas: 0,
          prediksi: 0,
        });
      }

      const row = map.get(key);

      row.petani += 1;
      row.luas += item.total_luas;
      row.prediksi += item.total_prediksi;
    });

    return Array.from(map.values()).slice(0, 4);
  }, [petaniList]);

  const rekomendasiPenyuluh = useMemo(() => {
    const rekomendasi = [];

    const petaniPerluPerhatian = petaniList.filter((item) =>
      ["waspada", "kritis"].includes(item.status)
    );

    const semuaLahan = rawData.map(normalizeRawRow);

    const lahanWaspada = semuaLahan.filter((item) =>
      ["waspada", "kritis"].includes(item.status)
    );

    const lahanPrediksiRendah = semuaLahan.filter((item) => {
      const prediksi = safeNumber(item.prediksi_ton, 0);
      return prediksi > 0 && prediksi < 1;
    });

    const wilayahMasalahMap = new Map();

    petaniPerluPerhatian.forEach((item) => {
      const wilayah = item.nama_kecamatan || "-";

      if (!wilayahMasalahMap.has(wilayah)) {
        wilayahMasalahMap.set(wilayah, {
          wilayah,
          total: 0,
        });
      }

      wilayahMasalahMap.get(wilayah).total += 1;
    });

    const wilayahPrioritas = Array.from(wilayahMasalahMap.values()).sort(
      (a, b) => b.total - a.total
    )[0];

    if (petaniPerluPerhatian.length > 0) {
      rekomendasi.push({
        icon: "⚠️",
        level: "warning",
        text: `Kunjungi ${petaniPerluPerhatian.length} petani dengan status perlu perhatian.`,
      });
    }

    if (wilayahPrioritas) {
      rekomendasi.push({
        icon: "📍",
        level: "warning",
        text: `Prioritaskan pendampingan di Kecamatan ${wilayahPrioritas.wilayah}.`,
      });
    }

    if (lahanWaspada.length > 0) {
      rekomendasi.push({
        icon: "🌾",
        level: "warning",
        text: `Pantau ${lahanWaspada.length} lahan dengan kondisi tanaman waspada atau kritis.`,
      });
    }

    if (lahanPrediksiRendah.length > 0) {
      rekomendasi.push({
        icon: "📉",
        level: "danger",
        text: `Cek ${lahanPrediksiRendah.length} lahan dengan prediksi produksi rendah.`,
      });
    }

    if (summary.totalPrediksi > 0 && summary.totalPrediksi < 5) {
      rekomendasi.push({
        icon: "🧪",
        level: "info",
        text: "Evaluasi pemupukan karena total prediksi produksi masih rendah.",
      });
    }

    if (petaniPerluPerhatian.length === 0 && semuaLahan.length > 0) {
      rekomendasi.push({
        icon: "✅",
        level: "success",
        text: "Seluruh petani binaan dalam kondisi baik. Lanjutkan monitoring rutin.",
      });
    }

    if (semuaLahan.length === 0) {
      rekomendasi.push({
        icon: "ℹ️",
        level: "info",
        text: "Belum ada data lahan binaan. Hubungi admin jika data petani atau lahan belum tersedia.",
      });
    }

    return rekomendasi.slice(0, 4);
  }, [petaniList, rawData, summary.totalPrediksi]);

  const mapItems = useMemo(() => {
    const coordCounter = {};

    return filteredData.map((item, index) => {
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
        originalLat: item.lat,
        originalLng: item.lng,
        isFallbackCoordinate: !hasValidCoordinate,
      };
    });
  }, [filteredData]);

  const aktivitasTerbaru = useMemo(() => {
    return aktivitas.slice(0, 5).map((item) => ({
      title:
        item.judul ||
        item.pesan ||
        item.message ||
        item.keterangan ||
        "Aktivitas penyuluh",
      time: item.created_at ? formatDate(item.created_at) : "Terbaru",
    }));
  }, [aktivitas]);

  const openViewModal = (petani) => {
    setSelectedPetani(petani);
    setModalMode("view");
  };

  const closeModal = () => {
    setSelectedPetani(null);
    setModalMode(null);
  };

  const exportCsv = () => {
    const header = [
      "Nama Petani",
      "No HP",
      "Kecamatan",
      "Desa",
      "Total Lahan",
      "Total Luas",
      "Komoditas",
      "Varietas",
      "Status",
      "Prediksi Produksi",
    ];

    const rows = filteredData.map((item) => [
      item.nama_petani,
      item.no_hp,
      item.nama_kecamatan,
      item.nama_desa,
      item.total_lahan,
      item.total_luas,
      item.komoditas,
      item.varietas,
      statusLabel(item.status),
      item.total_prediksi,
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
    link.download = "petani-binaan.csv";
    link.click();

    URL.revokeObjectURL(url);
  };

  const notifCount = aktivitas.length;

  return (
    <div style={styles.page}>
      <div style={styles.topbar}>
        <div style={styles.topbarSpacer} />

        <div style={styles.topbarRight}>
          <div style={styles.dateChip}>📅 {formatDate(new Date())}</div>

          <div style={styles.weatherChip}>
            <span>☀️</span>
            <div>
              <strong>28°C</strong>
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
            <span>⌄</span>
          </button>
        </div>
      </div>

      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.headerIcon}>👨‍🌾</div>

          <div>
            <h1 style={styles.title}>Petani Binaan</h1>
            <p style={styles.subtitle}>
              Pantau petani binaan, kondisi lahan, dan potensi produksi dalam
              wilayah Anda.
            </p>
          </div>
        </div>
      </div>

      <div style={styles.kpiGrid}>
        <KpiCard
          title="Total Petani Binaan"
          value={summary.totalPetani}
          suffix="Petani"
          icon="👥"
          color="#059669"
          bg="#dcfce7"
        />

        <KpiCard
          title="Petani Aktif"
          value={summary.petaniAktif}
          suffix={
            summary.totalPetani > 0
              ? `${Math.round(
                  (summary.petaniAktif / summary.totalPetani) * 100
                )}% dari total`
              : "0% dari total"
          }
          icon="✅"
          color="#16a34a"
          bg="#dcfce7"
        />

        <KpiCard
          title="Petani Perlu Perhatian"
          value={summary.perluPerhatian}
          suffix={
            summary.totalPetani > 0
              ? `${Math.round(
                  (summary.perluPerhatian / summary.totalPetani) * 100
                )}% dari total`
              : "0% dari total"
          }
          icon="⚠️"
          color="#ea580c"
          bg="#ffedd5"
        />

        <KpiCard
          title="Total Lahan"
          value={formatNumber(summary.totalLuas, 2)}
          suffix="Total luas lahan"
          unit="Ha"
          icon="📈"
          color="#2563eb"
          bg="#dbeafe"
        />

        <KpiCard
          title="Prediksi Produksi"
          value={formatNumber(summary.totalPrediksi, 1)}
          suffix="Total prediksi panen"
          unit="Ton"
          icon="📊"
          color="#7c3aed"
          bg="#ede9fe"
        />
      </div>

      <div style={styles.contentGrid}>
        <div style={styles.mainColumn}>
          <div style={styles.tableCard}>
            <div style={styles.filterBar}>
              <div style={styles.searchBox}>
                🔍
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari petani, desa, kecamatan..."
                  style={styles.searchInput}
                />
              </div>

              <select
                value={filterKecamatan}
                onChange={(e) => setFilterKecamatan(e.target.value)}
                style={styles.select}
              >
                <option value="all">Semua Kecamatan</option>
                {kecamatanFilterOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                value={filterDesa}
                onChange={(e) => setFilterDesa(e.target.value)}
                style={styles.select}
              >
                <option value="all">Semua Desa</option>
                {desaFilterOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={styles.select}
              >
                <option value="all">Semua Status</option>
                <option value="aktif">Aktif</option>
                <option value="waspada">Perlu Perhatian</option>
                <option value="kritis">Kritis</option>
              </select>

              <button style={styles.exportButton} onClick={exportCsv}>
                ⬇ Export
              </button>
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Petani</th>
                    <th style={styles.th}>Lokasi</th>
                    <th style={styles.th}>Lahan</th>
                    <th style={styles.th}>Komoditas</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Kesehatan Tanaman</th>
                    <th style={styles.th}>Prediksi Produksi</th>
                    <th style={styles.th}>Aksi</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" style={styles.emptyCell}>
                        Memuat data petani binaan...
                      </td>
                    </tr>
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={styles.emptyCell}>
                        Belum ada data petani binaan. Hubungi admin jika data
                        belum muncul.
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((item) => (
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

                        <td style={styles.td}>
                          <strong>{item.nama_kecamatan}</strong>
                          <small style={styles.smallText}>
                            Desa {item.nama_desa}
                          </small>
                        </td>

                        <td style={styles.td}>
                          <strong>{formatHa(item.total_luas)}</strong>
                          <small style={styles.smallText}>
                            {item.total_lahan} Lahan
                          </small>
                        </td>

                        <td style={styles.td}>
                          <strong>{item.komoditas}</strong>
                          <small style={styles.smallText}>
                            {item.varietas}
                          </small>
                        </td>

                        <td style={styles.td}>
                          <span style={statusBadge(item.status)}>
                            {statusLabel(item.status)}
                          </span>
                        </td>

                        <td style={styles.td}>
                          <div style={styles.healthCell}>
                            <span
                              style={{
                                ...styles.healthDot,
                                background: healthColor(item.status),
                              }}
                            />
                            <div>
                              <strong>{healthLabel(item.status)}</strong>
                              <small style={styles.smallText}>
                                {item.kesehatan_percent}%
                              </small>
                            </div>
                          </div>
                        </td>

                        <td style={styles.td}>
                          <strong>{formatTon(item.total_prediksi)}</strong>
                          <button
                            style={styles.linkButton}
                            onClick={() => navigate("/penyuluh/analisis")}
                          >
                            Estimasi
                          </button>
                        </td>

                        <td style={styles.td}>
                          <button
                            style={styles.viewBtn}
                            onClick={() => openViewModal(item)}
                          >
                            Lihat
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={styles.tableFooter}>
              <span>
                Menampilkan {filteredData.length > 0 ? 1 : 0} -{" "}
                {filteredData.length} dari {petaniList.length} petani binaan
              </span>

              <div style={styles.pagination}>
                <button style={styles.pageBtn}>‹</button>
                <button style={{ ...styles.pageBtn, ...styles.pageActive }}>
                  1
                </button>
                <button style={styles.pageBtn}>›</button>
              </div>
            </div>
          </div>

          <div style={styles.regionCard}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Ringkasan Wilayah Binaan</h3>

              <button
                style={styles.smallBtn}
                onClick={() =>
                  navigate("/penyuluh/analisis", {
                    state: {
                      from: "petani-binaan",
                      wilayahSummary,
                    },
                  })
                }
              >
                Lihat Laporan →
              </button>
            </div>

            <div style={styles.regionGrid}>
              {wilayahSummary.length === 0 ? (
                <div style={styles.emptyBox}>Belum ada ringkasan wilayah.</div>
              ) : (
                wilayahSummary.map((item, index) => (
                  <RegionCard
                    key={item.wilayah}
                    title={`Kecamatan ${item.wilayah}`}
                    petani={`${item.petani} Petani`}
                    luas={formatHa(item.luas)}
                    prediksi={formatTon(item.prediksi)}
                    color={REGION_COLORS[index % REGION_COLORS.length]}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <div style={styles.rightColumn}>
          <div style={styles.sideCard}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Peta Sebaran Petani Binaan</h3>
            </div>

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

                <MapFocus items={mapItems} />

                {mapItems.map((item, index) => (
                  <Marker
                    key={item.id}
                    position={[item.lat, item.lng]}
                    icon={createPetaniIcon(item.status, index + 1, index)}
                  >
                    <Popup>
                      <strong>{item.nama_petani}</strong>
                      <br />
                      Desa: {item.nama_desa}
                      <br />
                      Kec: {item.nama_kecamatan}
                      <br />
                      Lahan: {item.total_lahan}
                      <br />
                      Luas: {formatHa(item.total_luas)}
                      <br />
                      {item.isFallbackCoordinate && (
                        <em>Koordinat asli belum tersedia.</em>
                      )}
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>

              <button
                style={styles.mapFullBtn}
                onClick={() => navigate("/penyuluh/peta")}
              >
                Lihat Peta Lengkap →
              </button>
            </div>
          </div>

          <div style={styles.sideCard}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Aktivitas Terbaru</h3>

              <button style={styles.smallBtn} onClick={fetchAktivitas}>
                Refresh
              </button>
            </div>

            {aktivitasTerbaru.length === 0 ? (
              <div style={styles.emptyBox}>Belum ada aktivitas terbaru.</div>
            ) : (
              aktivitasTerbaru.map((item, index) => (
                <ActivityRow
                  key={index}
                  icon={["🟢", "🟠", "🟣", "🔵", "🟩"][index % 5]}
                  title={item.title}
                  time={item.time}
                />
              ))
            )}
          </div>

          <div style={styles.sideCard}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Rekomendasi untuk Penyuluh</h3>

              <button style={styles.smallBtn} onClick={fetchData}>
                Refresh
              </button>
            </div>

            {rekomendasiPenyuluh.length === 0 ? (
              <div style={styles.emptyBox}>
                Belum ada rekomendasi dari data binaan.
              </div>
            ) : (
              <div style={styles.recommendList}>
                {rekomendasiPenyuluh.map((item, index) => (
                  <RecommendationRow key={index} item={item} />
                ))}
              </div>
            )}

            <div style={styles.plantArt}>🌱</div>
          </div>
        </div>
      </div>

      {modalMode === "view" && selectedPetani && (
        <DetailPetaniModal
          selectedPetani={selectedPetani}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

function DetailPetaniModal({ selectedPetani, onClose }) {
  return (
    <div style={styles.modalBackdrop}>
      <div style={styles.modalCard}>
        <div style={styles.modalHeader}>
          <div>
            <h2 style={styles.modalTitle}>Detail Petani Binaan</h2>
            <p style={styles.modalSubtitle}>
              Penyuluh hanya dapat melihat data petani dan daftar lahan binaan.
            </p>
          </div>

          <button style={styles.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>

        <div style={styles.detailHead}>
          <div style={styles.avatarLarge}>👨‍🌾</div>

          <div>
            <h3 style={{ margin: 0 }}>{selectedPetani.nama_petani}</h3>
            <p style={{ margin: "5px 0", color: "#64748b" }}>
              Desa {selectedPetani.nama_desa}, Kec.{" "}
              {selectedPetani.nama_kecamatan}
            </p>

            <span style={statusBadge(selectedPetani.status)}>
              {statusLabel(selectedPetani.status)}
            </span>
          </div>
        </div>

        <div style={styles.modalStats}>
          <MiniStat label="Total Lahan" value={selectedPetani.total_lahan} />
          <MiniStat
            label="Total Luas"
            value={formatHa(selectedPetani.total_luas)}
          />
          <MiniStat
            label="Prediksi"
            value={formatTon(selectedPetani.total_prediksi)}
          />
        </div>

        <h3 style={styles.sectionModalTitle}>Daftar Lahan</h3>

        <div style={styles.modalTableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Nama Lahan</th>
                <th style={styles.th}>Luas</th>
                <th style={styles.th}>Varietas</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Prediksi</th>
              </tr>
            </thead>

            <tbody>
              {selectedPetani.lahan.length === 0 ? (
                <tr>
                  <td colSpan="5" style={styles.emptyCell}>
                    Belum ada data lahan.
                  </td>
                </tr>
              ) : (
                selectedPetani.lahan.map((lahan) => (
                  <tr key={lahan.lahan_id}>
                    <td style={styles.td}>{lahan.nama_lahan}</td>
                    <td style={styles.td}>{formatHa(lahan.luas_ha)}</td>
                    <td style={styles.td}>{lahan.varietas}</td>
                    <td style={styles.td}>
                      <span style={statusBadge(lahan.status)}>
                        {statusLabel(lahan.status)}
                      </span>
                    </td>
                    <td style={styles.td}>{formatTon(lahan.prediksi_ton)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={styles.modalActions}>
          <button type="button" style={styles.cancelBtn} onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, suffix, unit, icon, color, bg }) {
  return (
    <div style={styles.kpiCard}>
      <div>
        <h3 style={styles.kpiTitle}>{title}</h3>

        <div style={styles.kpiValue}>
          <strong style={{ color }}>{value}</strong>
          {unit && <span style={{ color }}>{unit}</span>}
        </div>

        <p style={styles.kpiDesc}>{suffix}</p>

        <button style={styles.detailLink}>Lihat Detail →</button>
      </div>

      <div style={{ ...styles.kpiIcon, background: bg, color }}>{icon}</div>
    </div>
  );
}

function RegionCard({ title, petani, luas, prediksi, color }) {
  return (
    <div style={styles.regionItem}>
      <h4 style={styles.regionTitle}>{title}</h4>

      <div style={styles.regionMeta}>
        <span>{petani}</span>
        <span>{luas}</span>
        <span>{prediksi}</span>
      </div>

      <div style={styles.progressBg}>
        <div
          style={{
            ...styles.progressFill,
            width: "65%",
            background: color,
          }}
        />
      </div>
    </div>
  );
}

function ActivityRow({ icon, title, time }) {
  return (
    <div style={styles.activityRow}>
      <div style={styles.activityIcon}>{icon}</div>

      <div>
        <strong>{title}</strong>
        <small style={styles.smallText}>Update data binaan</small>
      </div>

      <span style={styles.activityTime}>{time}</span>
    </div>
  );
}

function RecommendationRow({ item }) {
  const color =
    item.level === "danger"
      ? "#dc2626"
      : item.level === "warning"
      ? "#d97706"
      : item.level === "success"
      ? "#059669"
      : "#2563eb";

  const background =
    item.level === "danger"
      ? "#fee2e2"
      : item.level === "warning"
      ? "#fffbeb"
      : item.level === "success"
      ? "#dcfce7"
      : "#dbeafe";

  return (
    <div style={styles.recommendRow}>
      <div
        style={{
          ...styles.recommendIcon,
          color,
          background,
        }}
      >
        {item.icon}
      </div>

      <p style={styles.recommendText}>{item.text}</p>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={styles.miniStat}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: 24,
    background: "#f6f8fb",
    color: "#0f172a",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    boxSizing: "border-box",
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
    marginBottom: 22,
    gap: 18,
  },

  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },

  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    background: "#dcfce7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
  },

  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: "-0.6px",
  },

  subtitle: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 14,
  },

  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 16,
    marginBottom: 22,
  },

  kpiCard: {
    minHeight: 142,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    boxShadow: "0 12px 30px rgba(15,23,42,.06)",
  },

  kpiTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 900,
  },

  kpiValue: {
    display: "flex",
    alignItems: "baseline",
    gap: 6,
    marginTop: 12,
  },

  kpiDesc: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 13,
  },

  kpiIcon: {
    width: 56,
    height: 56,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 28,
    flexShrink: 0,
    alignSelf: "center",
  },

  detailLink: {
    marginTop: 15,
    border: "none",
    background: "transparent",
    color: "#059669",
    fontWeight: 900,
    cursor: "pointer",
    padding: 0,
  },

  contentGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 390px",
    gap: 18,
  },

  mainColumn: {
    display: "grid",
    gap: 18,
    minWidth: 0,
  },

  rightColumn: {
    display: "grid",
    gap: 18,
    alignContent: "start",
  },

  tableCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 12px 30px rgba(15,23,42,.06)",
  },

  filterBar: {
    display: "grid",
    gridTemplateColumns: "1fr 170px 170px 160px 100px",
    gap: 12,
    marginBottom: 14,
  },

  searchBox: {
    height: 44,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 12px",
  },

  searchInput: {
    width: "100%",
    border: "none",
    outline: "none",
    fontSize: 14,
  },

  select: {
    height: 44,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    padding: "0 12px",
    fontWeight: 800,
  },

  exportButton: {
    height: 44,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },

  tableWrap: {
    overflowX: "auto",
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
    color: "#475569",
    fontSize: 12,
    fontWeight: 900,
  },

  td: {
    padding: "13px 10px",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "middle",
  },

  petaniCell: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  avatar: {
    width: 38,
    height: 38,
    borderRadius: 999,
    background: "#dbeafe",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 21,
  },

  smallText: {
    display: "block",
    color: "#64748b",
    fontSize: 12,
    marginTop: 3,
  },

  healthCell: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  healthDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },

  linkButton: {
    display: "block",
    border: "none",
    background: "transparent",
    color: "#2563eb",
    fontWeight: 800,
    padding: "4px 0 0",
    cursor: "pointer",
  },

  viewBtn: {
    height: 28,
    padding: "0 10px",
    borderRadius: 7,
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#2563eb",
    fontWeight: 900,
    cursor: "pointer",
  },

  tableFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#64748b",
    fontSize: 13,
    marginTop: 14,
  },

  pagination: {
    display: "flex",
    gap: 6,
  },

  pageBtn: {
    minWidth: 28,
    height: 28,
    borderRadius: 7,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    cursor: "pointer",
  },

  pageActive: {
    background: "#dcfce7",
    color: "#047857",
    borderColor: "#86efac",
  },

  regionCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 16,
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
    fontWeight: 900,
  },

  smallBtn: {
    height: 34,
    padding: "0 12px",
    borderRadius: 9,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
  },

  regionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 14,
  },

  regionItem: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 14,
  },

  regionTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 900,
  },

  regionMeta: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    fontSize: 12,
    color: "#334155",
    margin: "12px 0",
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
  },

  sideCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 12px 30px rgba(15,23,42,.06)",
  },

  mapBox: {
    height: 240,
    position: "relative",
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid #e5e7eb",
  },

  map: {
    width: "100%",
    height: "100%",
  },

  mapFullBtn: {
    position: "absolute",
    right: 14,
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

  activityRow: {
    display: "grid",
    gridTemplateColumns: "36px 1fr auto",
    gap: 10,
    alignItems: "center",
    padding: "11px 0",
    borderBottom: "1px solid #f1f5f9",
  },

  activityIcon: {
    width: 34,
    height: 34,
    borderRadius: 999,
    background: "#f1f5f9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  activityTime: {
    color: "#64748b",
    fontSize: 12,
  },

  recommendList: {
    display: "grid",
    gap: 4,
    fontSize: 14,
    color: "#334155",
  },

  recommendRow: {
    display: "grid",
    gridTemplateColumns: "32px 1fr",
    gap: 10,
    alignItems: "flex-start",
    padding: "9px 0",
    borderBottom: "1px solid #f1f5f9",
  },

  recommendIcon: {
    width: 28,
    height: 28,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 15,
    flexShrink: 0,
  },

  recommendText: {
    margin: 0,
    color: "#334155",
    fontSize: 13,
    lineHeight: 1.5,
    fontWeight: 700,
  },

  plantArt: {
    marginTop: 18,
    fontSize: 72,
    textAlign: "right",
    opacity: 0.85,
  },

  emptyCell: {
    textAlign: "center",
    color: "#64748b",
    padding: 22,
  },

  emptyBox: {
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
    padding: 16,
    textAlign: "center",
    color: "#64748b",
    fontSize: 13,
  },

  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,.45)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  modalCard: {
    width: "min(920px, 100%)",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#ffffff",
    borderRadius: 18,
    border: "1px solid #e5e7eb",
    boxShadow: "0 30px 80px rgba(15,23,42,.25)",
    padding: 22,
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 18,
  },

  modalTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 900,
  },

  modalSubtitle: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 13,
  },

  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    fontSize: 22,
    cursor: "pointer",
  },

  detailHead: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    background: "#f8fafc",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },

  avatarLarge: {
    width: 54,
    height: 54,
    borderRadius: 999,
    background: "#dcfce7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 28,
  },

  modalStats: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
    marginBottom: 16,
  },

  miniStat: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 14,
    display: "grid",
    gap: 4,
  },

  sectionModalTitle: {
    margin: "10px 0 8px",
    fontSize: 16,
    fontWeight: 900,
  },

  modalTableWrap: {
    overflowX: "auto",
  },

  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
  },

  cancelBtn: {
    height: 42,
    padding: "0 18px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },
};