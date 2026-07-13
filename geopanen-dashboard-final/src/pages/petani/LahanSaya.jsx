import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
  useMap,
} from "react-leaflet";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import L from "leaflet";

import "leaflet/dist/leaflet.css";
import PetaniNotificationBell from "../../components/PetaniNotificationBell";

// =====================
// API CONFIG
// =====================
const RAW_API_NODE = import.meta.env.VITE_API_URL || "http://localhost:3000";
const API_NODE = RAW_API_NODE.replace(/\/api\/?$/, "").replace(/\/$/, "");

// =====================
// IMAGE CONFIG
// =====================
const DEFAULT_LAHAN_IMAGE =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="700" height="420" viewBox="0 0 700 420">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#ecfdf5"/>
          <stop offset="100%" stop-color="#bbf7d0"/>
        </linearGradient>
      </defs>
      <rect width="700" height="420" fill="url(#g)"/>
      <circle cx="350" cy="160" r="56" fill="#059669" opacity="0.16"/>
      <path d="M305 245 C330 205, 370 205, 395 245" fill="none" stroke="#047857" stroke-width="12" stroke-linecap="round"/>
      <path d="M350 115 L350 245" stroke="#047857" stroke-width="12" stroke-linecap="round"/>
      <path d="M350 165 C315 150, 295 130, 285 100" fill="none" stroke="#16a34a" stroke-width="10" stroke-linecap="round"/>
      <path d="M350 175 C385 155, 410 135, 420 105" fill="none" stroke="#16a34a" stroke-width="10" stroke-linecap="round"/>
      <text x="350" y="320" text-anchor="middle" font-family="Arial" font-size="26" font-weight="700" fill="#065f46">
        Foto lahan belum tersedia
      </text>
    </svg>
  `);

const isEmptyImageValue = (value) => {
  const text = String(value || "").trim();

  return (
    !text ||
    text === "null" ||
    text === "undefined" ||
    text === "-" ||
    text === "0"
  );
};

const uniqueArray = (items) => {
  return Array.from(new Set(items.filter(Boolean)));
};

const extractImageValue = (item) => {
  if (!item) return "";

  return (
    item?.foto_url ||
    item?.fotoUrl ||
    item?.foto ||
    item?.gambar ||
    item?.gambar_lahan ||
    item?.image ||
    item?.image_url ||
    item?.imageUrl ||
    item?.photo ||
    item?.photo_url ||
    item?.thumbnail ||
    item?.foto_lahan ||
    item?.foto_lahan_url ||
    item?.foto_path ||
    item?.path_foto ||
    item?.file_foto ||
    item?.nama_file_foto ||
    item?.dokumentasi ||
    item?.url_foto ||
    item?.path ||
    ""
  );
};

const buildImageCandidates = (value) => {
  if (isEmptyImageValue(value)) {
    return [DEFAULT_LAHAN_IMAGE];
  }

  const text = String(value).trim().replaceAll("\\", "/");

  if (
    text.startsWith("http://") ||
    text.startsWith("https://") ||
    text.startsWith("data:image") ||
    text.startsWith("blob:")
  ) {
    return [text, DEFAULT_LAHAN_IMAGE];
  }

  const cleaned = text.replace(/^\.\//, "");
  const withoutQuery = cleaned.split("?")[0];
  const fileName = withoutQuery.split("/").filter(Boolean).pop();

  const candidates = [];

  if (cleaned.startsWith("/uploads/")) {
    candidates.push(`${API_NODE}${cleaned}`);
  }

  if (cleaned.startsWith("uploads/")) {
    candidates.push(`${API_NODE}/${cleaned}`);
  }

  if (cleaned.startsWith("/lahan/")) {
    candidates.push(`${API_NODE}/uploads${cleaned}`);
    candidates.push(`${API_NODE}${cleaned}`);
  }

  if (cleaned.startsWith("lahan/")) {
    candidates.push(`${API_NODE}/uploads/${cleaned}`);
    candidates.push(`${API_NODE}/${cleaned}`);
  }

  if (cleaned.startsWith("/")) {
    candidates.push(`${API_NODE}${cleaned}`);
    candidates.push(cleaned);
  }

  if (fileName) {
    candidates.push(`${API_NODE}/uploads/lahan/${fileName}`);
    candidates.push(`${API_NODE}/uploads/${fileName}`);
    candidates.push(`${API_NODE}/api/uploads/lahan/${fileName}`);
    candidates.push(`${API_NODE}/api/uploads/${fileName}`);
    candidates.push(`/uploads/lahan/${fileName}`);
    candidates.push(`/uploads/${fileName}`);
  }

  candidates.push(DEFAULT_LAHAN_IMAGE);

  return uniqueArray(candidates);
};

const getImageUrl = (value) => {
  return buildImageCandidates(value)[0] || DEFAULT_LAHAN_IMAGE;
};

const getLahanImageCandidates = (item) => {
  return buildImageCandidates(extractImageValue(item));
};

const getLahanImage = (item) => {
  return getLahanImageCandidates(item)[0] || DEFAULT_LAHAN_IMAGE;
};

const handleImageError = (e) => {
  const img = e.currentTarget;
  const candidates = String(img.dataset.imageCandidates || "")
    .split("||")
    .filter(Boolean);

  const currentIndex = Number(img.dataset.imageIndex || 0);
  const nextIndex = currentIndex + 1;
  const nextSrc = candidates[nextIndex];

  if (nextSrc) {
    img.dataset.imageIndex = String(nextIndex);
    img.src = nextSrc;
    return;
  }

  img.onerror = null;
  img.src = DEFAULT_LAHAN_IMAGE;
};

// =====================
// MAP CONFIG
// =====================
const SUKOHARJO_CENTER = [-7.6686, 110.8382];
const SUKOHARJO_ZOOM = 12;

const SUKOHARJO_BOUNDS = [
  [-7.8, 110.7],
  [-7.5, 110.95],
];

// =====================
// STATUS CONFIG
// =====================
const STATUS_CONFIG = {
  active: {
    label: "Aktif",
    color: "#059669",
    light: "#dcfce7",
    border: "#86efac",
  },
  ready: {
    label: "Siap Panen",
    color: "#f59e0b",
    light: "#fef3c7",
    border: "#fde68a",
  },
  warning: {
    label: "Perlu Perhatian",
    color: "#ef4444",
    light: "#fee2e2",
    border: "#fecaca",
  },
  inactive: {
    label: "Tidak Aktif",
    color: "#94a3b8",
    light: "#f1f5f9",
    border: "#cbd5e1",
  },
};

// =====================
// HELPERS
// =====================
const isFilled = (value) => {
  return value !== null && value !== undefined && value !== "";
};

const formatNumber = (value, digit = 2) => {
  const number = Number(value || 0);

  return number.toLocaleString("id-ID", {
    minimumFractionDigits: digit,
    maximumFractionDigits: digit,
  });
};

const normalizeApiList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.prediksi)) return payload.prediksi;
  return [];
};

const normalizeText = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
};

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const getRawLat = (item) => {
  return item?.lat ?? item?.latitude ?? item?.lokasi_lat ?? null;
};

const getRawLng = (item) => {
  return item?.lng ?? item?.longitude ?? item?.lokasi_lng ?? null;
};

const getLat = (item) => {
  return item?.display_lat ?? getRawLat(item);
};

const getLng = (item) => {
  return item?.display_lng ?? getRawLng(item);
};

const hasOriginalCoordinate = (item) => {
  const lat = getRawLat(item);
  const lng = getRawLng(item);

  if (!isFilled(lat) || !isFilled(lng)) return false;

  return !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));
};

const hasCoordinate = (item) => {
  const lat = getLat(item);
  const lng = getLng(item);

  if (!isFilled(lat) || !isFilled(lng)) return false;

  return !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng));
};

const isInsideSukoharjoBounds = (lat, lng) => {
  const latNumber = Number(lat);
  const lngNumber = Number(lng);

  if (Number.isNaN(latNumber) || Number.isNaN(lngNumber)) return false;

  return (
    latNumber >= SUKOHARJO_BOUNDS[0][0] &&
    latNumber <= SUKOHARJO_BOUNDS[1][0] &&
    lngNumber >= SUKOHARJO_BOUNDS[0][1] &&
    lngNumber <= SUKOHARJO_BOUNDS[1][1]
  );
};

const getFallbackCoordinate = (index = 0) => {
  const radius = 0.006 + Math.floor(index / 8) * 0.003;
  const angle = (index % 8) * (Math.PI / 4);

  return {
    lat: SUKOHARJO_CENTER[0] + Math.sin(angle) * radius,
    lng: SUKOHARJO_CENTER[1] + Math.cos(angle) * radius,
  };
};

const offsetDuplicateCoordinate = (lat, lng, duplicateIndex = 0) => {
  if (duplicateIndex <= 0) {
    return {
      lat,
      lng,
    };
  }

  const angle = duplicateIndex * 0.9;
  const radius = 0.0012 + duplicateIndex * 0.00025;

  return {
    lat: lat + Math.sin(angle) * radius,
    lng: lng + Math.cos(angle) * radius,
  };
};

const coordinateKey = (lat, lng) => {
  return `${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;
};

const prepareMapLahan = (rows = []) => {
  const coordinateCount = {};

  return rows.map((item, index) => {
    let lat = Number(getRawLat(item));
    let lng = Number(getRawLng(item));
    let coordinateSource = "database";

    const originalValid =
      hasOriginalCoordinate(item) && isInsideSukoharjoBounds(lat, lng);

    if (!originalValid) {
      const fallback = getFallbackCoordinate(index);
      lat = fallback.lat;
      lng = fallback.lng;
      coordinateSource = "fallback";
    }

    const key = coordinateKey(lat, lng);
    const duplicateIndex = coordinateCount[key] || 0;
    coordinateCount[key] = duplicateIndex + 1;

    const shifted = offsetDuplicateCoordinate(lat, lng, duplicateIndex);

    return {
      ...item,
      display_lat: shifted.lat,
      display_lng: shifted.lng,
      coordinate_source: coordinateSource,
      is_coordinate_fallback: coordinateSource === "fallback",
      is_coordinate_shifted: duplicateIndex > 0,
    };
  });
};

const getLuasHa = (item) => {
  const luasHa = item?.luas_ha ?? item?.luasHa;

  if (isFilled(luasHa)) return Number(luasHa);

  const luasM2 = Number(item?.luas_m2 || item?.luas || 0);

  if (luasM2 > 20) return luasM2 / 10000;

  return luasM2;
};

const getTanaman = (item) => {
  return item?.tanaman || item?.jenis_tanaman || item?.komoditas || "Padi";
};

const getVarietas = (item) => {
  return item?.varietas || item?.nama_varietas || "Ciherang";
};

const hitungUmurDariTanggalTanam = (tanggalTanam) => {
  if (!tanggalTanam) return "-";

  const tanggal = new Date(tanggalTanam);

  if (Number.isNaN(tanggal.getTime())) return "-";

  const hariIni = new Date();

  tanggal.setHours(0, 0, 0, 0);
  hariIni.setHours(0, 0, 0, 0);

  const selisihMs = hariIni.getTime() - tanggal.getTime();
  const selisihHari = Math.floor(selisihMs / (1000 * 60 * 60 * 24));

  return selisihHari >= 0 ? selisihHari : "-";
};

const getUmurTanaman = (item) => {
  const umurLangsung =
    item?.umur_tanaman ??
    item?.umur_tanam ??
    item?.umur ??
    item?.umur_hari;

  if (isFilled(umurLangsung)) {
    const umurNumber = Number(umurLangsung);

    if (Number.isFinite(umurNumber)) {
      return umurNumber;
    }
  }

  return hitungUmurDariTanggalTanam(
    item?.tanggal_tanam ||
      item?.tgl_tanam ||
      item?.tanggalTanam ||
      item?.planting_date
  );
};

const getStatusType = (item) => {
  const raw = String(
    item?.status_lahan ||
      item?.status ||
      item?.fase_tanam ||
      item?.keterangan ||
      ""
  ).toLowerCase();

  if (
    raw.includes("panen") ||
    raw.includes("siap") ||
    raw.includes("generatif")
  ) {
    return "ready";
  }

  if (
    raw.includes("perhatian") ||
    raw.includes("waspada") ||
    raw.includes("kritis") ||
    raw.includes("rusak")
  ) {
    return "warning";
  }

  if (raw.includes("tidak") || raw.includes("inactive") || raw.includes("non")) {
    return "inactive";
  }

  return "active";
};

const getPrediksiTon = (item) => {
  return (
    item?.prediksi_ton ??
    item?.hasil_prediksi_ton ??
    item?.hasil_prediksi ??
    item?.prediksi ??
    null
  );
};

const getPrediksiKg = (item) => {
  return item?.prediksi_kg ?? item?.hasil_prediksi_kg ?? null;
};

const formatPrediksiTon = (item) => {
  const value = getPrediksiTon(item);

  if (!isFilled(value)) return "-";

  return formatNumber(value, 2);
};

const getUpdatedAt = (item) => {
  const value =
    item?.updated_at ||
    item?.terakhir_diperbarui ||
    item?.prediksi_created_at ||
    item?.created_at ||
    new Date().toISOString();

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const findPrediksiForLahan = (prediksiList, lahanItem) => {
  const lahanId = Number(lahanItem?.id);

  const byId = prediksiList.find((prediksi) => {
    return (
      Number(prediksi?.sawah_id) === lahanId ||
      Number(prediksi?.lahan_id) === lahanId ||
      Number(prediksi?.id_lahan) === lahanId
    );
  });

  if (byId) return byId;

  const namaLahan = normalizeText(lahanItem?.nama_lahan);

  if (!namaLahan) return null;

  const byName = prediksiList.find((prediksi) => {
    return normalizeText(prediksi?.nama_lahan) === namaLahan;
  });

  return byName || null;
};

const mergeLahanWithPrediksi = (lahanList, prediksiList) => {
  return lahanList.map((item) => {
    const prediksi = findPrediksiForLahan(prediksiList, item);

    if (!prediksi) {
      return {
        ...item,
        prediksi_ton: getPrediksiTon(item),
        prediksi_kg: getPrediksiKg(item),
      };
    }

    return {
      ...item,
      prediksi_id: prediksi?.id ?? item?.prediksi_id,
      prediksi_ton: getPrediksiTon(prediksi),
      prediksi_kg: getPrediksiKg(prediksi),
      prediksi_period: prediksi?.periode ?? item?.prediksi_period,
      prediksi_created_at: prediksi?.created_at ?? item?.prediksi_created_at,
    };
  });
};

const createFallbackPolygon = (item) => {
  const latValue = getLat(item);
  const lngValue = getLng(item);

  if (!isFilled(latValue) || !isFilled(lngValue)) return [];

  const lat = Number(latValue);
  const lng = Number(lngValue);

  if (Number.isNaN(lat) || Number.isNaN(lng)) return [];

  const luas = Math.max(getLuasHa(item), 0.05);
  const size = Math.min(Math.max(Math.sqrt(luas) * 0.002, 0.0012), 0.0045);

  return [
    [lat + size * 1.2, lng - size],
    [lat + size * 0.8, lng + size * 1.3],
    [lat - size * 0.4, lng + size * 1.4],
    [lat - size * 1.2, lng + size * 0.2],
    [lat - size * 0.8, lng - size * 1.2],
    [lat + size * 0.3, lng - size * 1.5],
  ];
};

const normalizePolygon = (polygon) => {
  if (!Array.isArray(polygon)) return [];

  return polygon
    .map((point) => {
      if (!Array.isArray(point)) return null;

      const lat = Number(point[0]);
      const lng = Number(point[1]);

      if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

      return [lat, lng];
    })
    .filter(Boolean);
};

const parsePolygon = (item) => {
  const source =
    item?.polygon ||
    item?.polygon_json ||
    item?.koordinat_polygon ||
    item?.coordinates;

  if (Array.isArray(source)) {
    return normalizePolygon(source);
  }

  if (typeof source === "string") {
    try {
      const parsed = JSON.parse(source);

      if (Array.isArray(parsed)) {
        return normalizePolygon(parsed);
      }

      if (parsed?.coordinates?.[0]) {
        return normalizePolygon(
          parsed.coordinates[0].map((point) => [point[1], point[0]])
        );
      }
    } catch {
      return createFallbackPolygon(item);
    }
  }

  return createFallbackPolygon(item);
};

const createStatusIcon = (statusType) => {
  const status = STATUS_CONFIG[statusType] || STATUS_CONFIG.active;

  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 36px;
        height: 36px;
        border-radius: 999px;
        background: ${status.color};
        border: 4px solid #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 12px 24px rgba(15,23,42,.25);
      ">
        <div style="
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #ffffff;
        "></div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
};

const userMarkerIcon = L.divIcon({
  className: "",
  html: `
    <div style="
      width: 34px;
      height: 34px;
      border-radius: 999px;
      background: #0ea5e9;
      border: 4px solid #ffffff;
      box-shadow: 0 12px 24px rgba(15,23,42,.25);
    "></div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
});

// =====================
// MAP COMPONENTS
// =====================
function ResetView() {
  const map = useMap();

  useEffect(() => {
    map.setView(SUKOHARJO_CENTER, SUKOHARJO_ZOOM);
    map.setMaxBounds(SUKOHARJO_BOUNDS);
  }, [map]);

  return null;
}

function FlyToSelected({ selectedLahan }) {
  const map = useMap();

  useEffect(() => {
    if (!hasCoordinate(selectedLahan)) return;

    map.flyTo(
      [Number(getLat(selectedLahan)), Number(getLng(selectedLahan))],
      14,
      {
        duration: 0.8,
      }
    );
  }, [map, selectedLahan]);

  return null;
}

function MapControls() {
  const map = useMap();

  return (
    <div style={styles.mapControls}>
      <button
        style={styles.mapControlButton}
        type="button"
        onClick={() => map.zoomIn()}
      >
        +
      </button>

      <button
        style={styles.mapControlButton}
        type="button"
        onClick={() => map.zoomOut()}
      >
        −
      </button>

      <button
        style={{ ...styles.mapControlButton, marginTop: 14 }}
        type="button"
        onClick={() => map.setView(SUKOHARJO_CENTER, SUKOHARJO_ZOOM)}
      >
        ⦿
      </button>

      <button
        style={styles.mapControlButton}
        type="button"
        onClick={() => map.setZoom(12)}
      >
        ▤
      </button>
    </div>
  );
}

// =====================
// MAIN PAGE
// =====================
export default function LahanSaya() {
  const navigate = useNavigate();

  const [lahan, setLahan] = useState([]);
  const [selectedLahan, setSelectedLahan] = useState(null);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);

  const storedUser = getStoredUser();

  const userId =
    localStorage.getItem("user_id") ||
    localStorage.getItem("petani_id") ||
    storedUser?.id;

  useEffect(() => {
    fetchLahan();
  }, []);

  const fetchLahan = async () => {
    try {
      setLoading(true);

      const [lahanResult, prediksiResult] = await Promise.allSettled([
        axios.get(`${API_NODE}/api/lahan`, {
          params: {
            petani_id: userId,
            user_id: userId,
          },
        }),
        axios.get(`${API_NODE}/api/prediksi`),
      ]);

      if (lahanResult.status !== "fulfilled") {
        throw lahanResult.reason;
      }

      const dataLahan = normalizeApiList(lahanResult.value.data);

      const dataPrediksi =
        prediksiResult.status === "fulfilled"
          ? normalizeApiList(prediksiResult.value.data)
          : [];

      const mergedData = prepareMapLahan(
        mergeLahanWithPrediksi(dataLahan, dataPrediksi)
      );

      setLahan(mergedData);

      setSelectedLahan(mergedData[0] || null);
    } catch (err) {
      console.log("ERROR LAHAN:", err.response?.data || err.message);
      setLahan([]);
      setSelectedLahan(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectLahan = (item) => {
    setSelectedLahan(item);
  };

  const handleDeleteLahan = async (id) => {
    const confirmDelete = window.confirm("Yakin ingin menghapus lahan ini?");

    if (!confirmDelete) return;

    try {
      await axios.delete(`${API_NODE}/api/lahan/${id}`);

      setLahan((prev) => {
        const remaining = prepareMapLahan(
          prev.filter((item) => Number(item.id) !== Number(id))
        );

        setSelectedLahan((current) => {
          if (Number(current?.id) === Number(id)) {
            return remaining[0] || null;
          }

          return current;
        });

        return remaining;
      });
    } catch (err) {
      alert(err.response?.data?.message || "Gagal menghapus lahan");
    }
  };

  const filteredLahan = useMemo(() => {
    const value = keyword.trim().toLowerCase();

    if (!value) return lahan;

    return lahan.filter((item) => {
      const text = [
        item?.nama_lahan,
        item?.nama_desa,
        item?.nama_kecamatan,
        item?.varietas,
        item?.tanaman,
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(value);
    });
  }, [keyword, lahan]);

  const summary = useMemo(() => {
    const totalLahan = lahan.length;

    const totalLuas = lahan.reduce((total, item) => {
      return total + getLuasHa(item);
    }, 0);

    const lahanAktif = lahan.filter((item) => getStatusType(item) === "active")
      .length;

    const siapPanen = lahan.filter((item) => getStatusType(item) === "ready")
      .length;

    return {
      totalLahan,
      totalLuas,
      lahanAktif,
      siapPanen,
    };
  }, [lahan]);

  const selectedStatusType = getStatusType(selectedLahan);
  const selectedStatus =
    STATUS_CONFIG[selectedStatusType] || STATUS_CONFIG.active;

  const selectedUmurTanaman = getUmurTanaman(selectedLahan);

  const selectedLahanImageItem = useMemo(() => {
    if (!selectedLahan) return null;

    const selectedImageValue = extractImageValue(selectedLahan);

    if (!isEmptyImageValue(selectedImageValue)) {
      return selectedLahan;
    }

    const sameLahanWithImage = lahan.find((item) => {
      const sameId = Number(item?.id) === Number(selectedLahan?.id);
      const sameName =
        normalizeText(item?.nama_lahan) === normalizeText(selectedLahan?.nama_lahan);

      return (sameId || sameName) && !isEmptyImageValue(extractImageValue(item));
    });

    return sameLahanWithImage || selectedLahan;
  }, [selectedLahan, lahan]);

  const selectedLahanImageKey = `${selectedLahan?.id || "empty"}-${
    extractImageValue(selectedLahanImageItem) || "fallback"
  }`;

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <button
            style={styles.backButton}
            type="button"
            onClick={() => navigate(-1)}
          >
            ←
          </button>

          <div>
            <h1 style={styles.pageTitle}>Lahan Saya</h1>
            <p style={styles.pageSubtitle}>
              Kelola dan pantau lahan pertanian Anda
            </p>
          </div>
        </div>

        <div style={styles.headerRight}>
          <div style={styles.weatherMini}>
            <span style={styles.sunIcon}>☀</span>
            <div>
              <strong>28°C</strong>
              <small>Cerah</small>
            </div>
          </div>
<PetaniNotificationBell />

          <div style={styles.avatar}>👨🏽‍🌾</div>
        </div>
      </header>

      <main style={styles.content}>
        <section style={styles.mapPanel}>
          <MapContainer
            center={SUKOHARJO_CENTER}
            zoom={SUKOHARJO_ZOOM}
            minZoom={10}
            maxZoom={18}
            maxBounds={SUKOHARJO_BOUNDS}
            maxBoundsViscosity={1}
            zoomControl={false}
            style={styles.map}
          >
            <TileLayer
              attribution="Leaflet | Tiles © OpenStreetMap"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <ResetView />
            <FlyToSelected selectedLahan={selectedLahan} />
            <MapControls />

            <Marker icon={userMarkerIcon} position={SUKOHARJO_CENTER}>
              <Popup>Lokasi Saya</Popup>
            </Marker>

            {filteredLahan.map((item) => {
              if (!hasCoordinate(item)) return null;

              const statusType = getStatusType(item);
              const status = STATUS_CONFIG[statusType];
              const polygon = parsePolygon(item);
              const coordinateInfo = item.is_coordinate_fallback
                ? "Koordinat asli belum diisi, marker ditampilkan sementara."
                : item.is_coordinate_shifted
                ? "Marker digeser sedikit agar tidak bertumpuk dengan lahan lain."
                : "";

              return (
                <Fragment key={item.id}>
                  {polygon.length > 0 && (
                    <Polygon
                      positions={polygon}
                      pathOptions={{
                        color: status.color,
                        fillColor: status.color,
                        fillOpacity: statusType === "ready" ? 0.24 : 0.26,
                        weight: 2.5,
                      }}
                      eventHandlers={{
                        click: () => handleSelectLahan(item),
                      }}
                    />
                  )}

                  <Marker
                    icon={createStatusIcon(statusType)}
                    position={[Number(getLat(item)), Number(getLng(item))]}
                    eventHandlers={{
                      click: () => handleSelectLahan(item),
                    }}
                  >
                    <Popup>
                      <div style={styles.popupCard}>
                        <img
                          src={getLahanImage(item)}
                          data-image-candidates={getLahanImageCandidates(item).join("||")}
                          alt={item.nama_lahan || "Lahan"}
                          style={styles.popupImage}
                          onError={handleImageError}
                        />

                        <strong>{item.nama_lahan || "Lahan Tanpa Nama"}</strong>
                        <p>{item.nama_desa || "Desa belum diisi"}</p>
                        <p>{item.nama_kecamatan || "Kecamatan belum diisi"}</p>
                        <p>{formatNumber(getLuasHa(item), 2)} Ha</p>
                        <p>{getTanaman(item)}</p>

                        {coordinateInfo && (
                          <p style={styles.popupWarning}>{coordinateInfo}</p>
                        )}

                        <p style={styles.popupPrediksi}>
                          Prediksi: {formatPrediksiTon(item)} Ton
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                </Fragment>
              );
            })}
          </MapContainer>

          <div style={styles.searchPanel}>
            <span style={styles.searchIcon}>⌕</span>

            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Cari lahan, desa, atau kecamatan..."
              style={styles.searchInput}
            />

            <button style={styles.filterBtn} type="button">
              ⎇ Filter⌄
            </button>

            <button
              style={styles.addBtn}
              type="button"
              onClick={() => navigate("/petani/tambah-lahan")}
            >
              + Tambah Lahan
            </button>
          </div>

          <div style={styles.legendCard}>
            <h3 style={styles.legendTitle}>Legenda</h3>

            <div style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: "#059669" }} />
              Lahan Aktif
            </div>

            <div style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: "#f59e0b" }} />
              Siap Panen
            </div>

            <div style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: "#ef4444" }} />
              Perlu Perhatian
            </div>

            <div style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: "#0ea5e9" }} />
              Lokasi Saya
            </div>
          </div>
        </section>

        <aside style={styles.rightPanel}>
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Ringkasan Lahan</h3>

            <div style={styles.summaryGrid}>
              <div style={styles.summaryItem}>
                <strong>{summary.totalLahan}</strong>
                <span>Total Lahan</span>
              </div>

              <div style={styles.summaryItemGreen}>
                <strong>
                  {formatNumber(summary.totalLuas, 2)}
                  <small> Ha</small>
                </strong>
                <span>Total Luas</span>
              </div>

              <div style={styles.summaryItemBlue}>
                <strong>{summary.lahanAktif}</strong>
                <span>Lahan Aktif</span>
              </div>

              <div style={styles.summaryItemYellow}>
                <strong>{summary.siapPanen}</strong>
                <span>Siap Panen</span>
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Daftar Lahan</h3>

            <div style={styles.listBody}>
              {loading && <p style={styles.emptyText}>Memuat data lahan...</p>}

              {!loading && filteredLahan.length === 0 && (
                <p style={styles.emptyText}>Belum ada lahan.</p>
              )}

              {!loading &&
                filteredLahan.slice(0, 4).map((item) => {
                  const statusType = getStatusType(item);
                  const status = STATUS_CONFIG[statusType];

                  return (
                    <button
                      key={item.id}
                      type="button"
                      style={{
                        ...styles.lahanItem,
                        background:
                          Number(selectedLahan?.id) === Number(item.id)
                            ? "#f8fafc"
                            : "transparent",
                      }}
                      onClick={() => handleSelectLahan(item)}
                    >
                      <span
                        style={{
                          ...styles.pinDot,
                          background: status.color,
                        }}
                      />

                      <div style={styles.lahanText}>
                        <div style={styles.lahanRow}>
                          <strong>{item.nama_lahan || "Lahan Tanpa Nama"}</strong>

                          <span
                            style={{
                              ...styles.statusPill,
                              background: status.light,
                              color: status.color,
                              borderColor: status.border,
                            }}
                          >
                            {status.label}
                          </span>
                        </div>

                        <small>
                          {formatNumber(getLuasHa(item), 2)} Ha ·{" "}
                          {getTanaman(item)} ·{" "}
                          {statusType === "ready"
                            ? "Siap Panen"
                            : item?.fase_tanam || "Vegetatif"}
                        </small>
                      </div>

                      <span style={styles.moreBtn}>›</span>
                    </button>
                  );
                })}
            </div>

            <button
              type="button"
              style={styles.seeAllBtn}
              onClick={() => navigate("/petani/lahan-saya")}
            >
              Lihat Semua Lahan →
            </button>
          </div>

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Informasi Lahan Terpilih</h3>

            {selectedLahan ? (
              <>
                <div style={styles.detailHeader}>
                  <img
                    key={selectedLahanImageKey}
                    src={getLahanImage(selectedLahanImageItem)}
                    data-image-index="0"
                    data-image-candidates={getLahanImageCandidates(
                      selectedLahanImageItem
                    ).join("||")}
                    alt={selectedLahan?.nama_lahan || "Lahan"}
                    style={styles.detailImg}
                    onError={handleImageError}
                  />

                  <div style={{ flex: 1 }}>
                    <div style={styles.detailTitleRow}>
                      <strong>
                        {selectedLahan?.nama_lahan || "Lahan Tanpa Nama"}
                      </strong>

                      <span
                        style={{
                          ...styles.statusPill,
                          background: selectedStatus.light,
                          color: selectedStatus.color,
                          borderColor: selectedStatus.border,
                        }}
                      >
                        {selectedStatus.label}
                      </span>
                    </div>

                    <div style={styles.detailRows}>
                      <div style={styles.detailRow}>
                        <span>Luas Lahan</span>
                        <strong>
                          {formatNumber(getLuasHa(selectedLahan), 2)} Ha
                        </strong>
                      </div>

                      <div style={styles.detailRow}>
                        <span>Tanaman</span>
                        <strong>{getTanaman(selectedLahan)}</strong>
                      </div>

                      <div style={styles.detailRow}>
                        <span>Varietas</span>
                        <strong>{getVarietas(selectedLahan)}</strong>
                      </div>

                      <div style={styles.detailRow}>
                        <span>Umur Tanaman</span>
                        <strong>
                          {selectedUmurTanaman !== "-"
                            ? `${selectedUmurTanaman} Hari`
                            : "-"}
                        </strong>
                      </div>

                      <div style={styles.detailRow}>
                        <span>Prediksi Panen</span>
                        <strong>
                          {selectedLahan?.prediksi_period
                            ? selectedLahan.prediksi_period
                            : "-"}
                        </strong>
                      </div>

                      <div style={styles.detailRow}>
                        <span>Prediksi Hasil</span>
                        <strong>{formatPrediksiTon(selectedLahan)} Ton</strong>
                      </div>

                      <div style={styles.detailRow}>
                        <span>Koordinat</span>
                        <strong>
                          {selectedLahan?.is_coordinate_fallback
                            ? "Belum diisi"
                            : selectedLahan?.is_coordinate_shifted
                            ? "Digeser agar tidak bertumpuk"
                            : "Valid"}
                        </strong>
                      </div>

                      <div style={styles.detailRow}>
                        <span>Terakhir Diperbarui</span>
                        <strong>{getUpdatedAt(selectedLahan)}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={styles.detailActions}>
                  <button
                    type="button"
                    style={styles.editBtn}
                    onClick={() => {
                      navigate(`/petani/edit-lahan/${selectedLahan.id}`);
                    }}
                  >
                    ✎ Edit
                  </button>

                  <button type="button" style={styles.sensorBtn}>
                    ⚙ Pasang Sensor
                  </button>

                  <button
                    type="button"
                    style={styles.deleteBtn}
                    onClick={() => handleDeleteLahan(selectedLahan.id)}
                  >
                    🗑 Hapus
                  </button>
                </div>
              </>
            ) : (
              <p style={styles.emptyText}>Pilih lahan pada peta.</p>
            )}
          </div>
        </aside>
      </main>

      <section style={styles.bottomInfo}>
        <div style={styles.infoCardBlue}>
          <div style={styles.infoIcon}>🌤</div>
          <div>
            <strong>Cuaca Hari Ini</strong>
            <h2>28°C</h2>
            <p>Cerah · Kelembapan 65%</p>
          </div>
        </div>

        <div style={styles.infoCard}>
          <div style={styles.infoIcon}>💧</div>
          <div>
            <strong>Kelembapan Tanah</strong>
            <h2>65%</h2>
            <p style={styles.greenText}>Optimal</p>
          </div>
        </div>

        <div style={styles.infoCard}>
          <div style={styles.infoIcon}>🌧</div>
          <div>
            <strong>Curah Hujan</strong>
            <h2>12 mm</h2>
            <p>Rendah</p>
          </div>
        </div>

        <div style={styles.infoCardWide}>
          <div style={styles.infoIcon}>🌱</div>
          <div>
            <strong>Rekomendasi Pupuk</strong>
            <p>Urea 100 kg/ha</p>
            <p>SP-36 75 kg/ha</p>
          </div>

          <button style={styles.detailBtn} type="button">
            Lihat Detail →
          </button>
        </div>
      </section>

      <button
        style={styles.floatingAdd}
        type="button"
        onClick={() => navigate("/petani/tambah-lahan")}
      >
        +
      </button>
    </div>
  );
}

// =====================
// STYLES
// =====================
const styles = {
  page: {
    minHeight: "100vh",
    background: "#ffffff",
    color: "#111827",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: "0 24px 24px",
    boxSizing: "border-box",
    position: "relative",
  },

  header: {
    height: 96,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid #eef2f7",
  },

  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },

  backButton: {
    width: 36,
    height: 36,
    border: "none",
    background: "#ffffff",
    fontSize: 26,
    cursor: "pointer",
  },

  pageTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 850,
  },

  pageSubtitle: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 14,
  },

  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 18,
  },

  weatherMini: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    paddingRight: 14,
    borderRight: "1px solid #e5e7eb",
  },

  sunIcon: {
    fontSize: 30,
    color: "#f59e0b",
  },

  notifButton: {
    width: 38,
    height: 38,
    border: "none",
    background: "#ffffff",
    position: "relative",
    cursor: "pointer",
    fontSize: 20,
  },

  notifBadge: {
    position: "absolute",
    top: -3,
    right: -2,
    background: "#ef4444",
    color: "#ffffff",
    borderRadius: 999,
    fontSize: 11,
    minWidth: 18,
    height: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
  },

  avatar: {
    width: 46,
    height: 46,
    borderRadius: 999,
    background: "#dbeafe",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
  },

  content: {
    display: "grid",
    gridTemplateColumns: "1fr 370px",
    gap: 18,
    marginTop: 16,
  },

  mapPanel: {
    height: "720px",
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    border: "1px solid #e5e7eb",
  },

  map: {
    width: "100%",
    height: "100%",
  },

  searchPanel: {
    position: "absolute",
    top: 18,
    left: 18,
    zIndex: 1000,
    width: 690,
    height: 56,
    background: "#ffffff",
    borderRadius: 10,
    boxShadow: "0 10px 26px rgba(15,23,42,.12)",
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 14px",
    boxSizing: "border-box",
  },

  searchIcon: {
    color: "#64748b",
    fontSize: 22,
  },

  searchInput: {
    flex: 1,
    border: "none",
    outline: "none",
    height: 42,
    fontSize: 14,
    color: "#111827",
  },

  filterBtn: {
    height: 40,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    borderRadius: 8,
    padding: "0 14px",
    fontWeight: 700,
    cursor: "pointer",
  },

  addBtn: {
    height: 42,
    border: "none",
    background: "#059669",
    color: "#ffffff",
    borderRadius: 8,
    padding: "0 18px",
    fontWeight: 800,
    cursor: "pointer",
  },

  mapControls: {
    position: "absolute",
    top: 96,
    left: 18,
    zIndex: 1000,
    display: "flex",
    flexDirection: "column",
  },

  mapControlButton: {
    width: 44,
    height: 44,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    fontSize: 24,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(15,23,42,.12)",
  },

  legendCard: {
    position: "absolute",
    left: 18,
    bottom: 32,
    zIndex: 1000,
    width: 170,
    background: "#ffffff",
    borderRadius: 14,
    padding: 18,
    boxShadow: "0 16px 36px rgba(15,23,42,.14)",
  },

  legendTitle: {
    margin: "0 0 16px",
    fontSize: 16,
    fontWeight: 850,
  },

  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
    color: "#374151",
    fontSize: 14,
  },

  legendDot: {
    width: 15,
    height: 15,
    borderRadius: 999,
    display: "inline-block",
  },

  rightPanel: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  card: {
    background: "#ffffff",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 12px 32px rgba(15,23,42,.08)",
    border: "1px solid #edf2f7",
  },

  cardTitle: {
    margin: "0 0 16px",
    fontSize: 17,
    fontWeight: 850,
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },

  summaryItem: {
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 16,
    background: "#ffffff",
  },

  summaryItemGreen: {
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: 16,
    background: "linear-gradient(135deg, #ffffff, #ecfdf5)",
  },

  summaryItemBlue: {
    border: "1px solid #dbeafe",
    borderRadius: 10,
    padding: 16,
    background: "linear-gradient(135deg, #ffffff, #eff6ff)",
  },

  summaryItemYellow: {
    border: "1px solid #fde68a",
    borderRadius: 10,
    padding: 16,
    background: "linear-gradient(135deg, #ffffff, #fffbeb)",
  },

  listBody: {
    maxHeight: 250,
    overflowY: "auto",
  },

  lahanItem: {
    width: "100%",
    border: "none",
    borderBottom: "1px solid #eef2f7",
    padding: "13px 0",
    display: "flex",
    alignItems: "center",
    gap: 12,
    textAlign: "left",
    cursor: "pointer",
  },

  pinDot: {
    width: 18,
    height: 18,
    borderRadius: 999,
    display: "inline-block",
    flexShrink: 0,
  },

  lahanText: {
    flex: 1,
    minWidth: 0,
  },

  lahanRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },

  statusPill: {
    border: "1px solid",
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  moreBtn: {
    fontSize: 24,
    color: "#111827",
  },

  seeAllBtn: {
    width: "100%",
    height: 42,
    marginTop: 12,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    background: "#ffffff",
    fontWeight: 800,
    color: "#0f172a",
    cursor: "pointer",
  },

  detailHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
  },

  detailImg: {
    width: 104,
    height: 104,
    borderRadius: 10,
    objectFit: "cover",
    flexShrink: 0,
    background: "#f1f5f9",
    border: "1px solid #e5e7eb",
  },

  detailTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "center",
    marginBottom: 10,
  },

  detailRows: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  detailRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    color: "#64748b",
    fontSize: 13,
  },

  detailActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1.6fr 1fr",
    gap: 10,
    marginTop: 18,
  },

  editBtn: {
    height: 42,
    border: "1px solid #86efac",
    background: "#ffffff",
    color: "#059669",
    borderRadius: 8,
    fontWeight: 800,
    cursor: "pointer",
  },

  sensorBtn: {
    height: 42,
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#059669",
    borderRadius: 8,
    fontWeight: 800,
    cursor: "pointer",
  },

  deleteBtn: {
    height: 42,
    border: "1px solid #fecaca",
    background: "#ffffff",
    color: "#ef4444",
    borderRadius: 8,
    fontWeight: 800,
    cursor: "pointer",
  },

  emptyText: {
    color: "#64748b",
    fontSize: 14,
  },

  popupCard: {
    width: 210,
    display: "grid",
    gap: 6,
  },

  popupImage: {
    width: "100%",
    height: 110,
    objectFit: "cover",
    borderRadius: 10,
    background: "#f1f5f9",
    border: "1px solid #e5e7eb",
  },

  popupWarning: {
    margin: 0,
    padding: "7px 8px",
    borderRadius: 8,
    background: "#fffbeb",
    color: "#b45309",
    fontSize: 12,
    lineHeight: 1.35,
  },

  popupPrediksi: {
    color: "#047857",
    fontWeight: 800,
  },

  bottomInfo: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr 1.6fr",
    gap: 12,
    marginTop: 18,
  },

  infoCard: {
    minHeight: 104,
    borderRadius: 14,
    background: "#ffffff",
    border: "1px solid #eef2f7",
    boxShadow: "0 10px 28px rgba(15,23,42,.06)",
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: 18,
  },

  infoCardBlue: {
    minHeight: 104,
    borderRadius: 14,
    background: "linear-gradient(135deg, #eff6ff, #ffffff)",
    border: "1px solid #dbeafe",
    boxShadow: "0 10px 28px rgba(15,23,42,.06)",
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: 18,
  },

  infoCardWide: {
    minHeight: 104,
    borderRadius: 14,
    background: "linear-gradient(135deg, #f0fdf4, #ffffff)",
    border: "1px solid #dcfce7",
    boxShadow: "0 10px 28px rgba(15,23,42,.06)",
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: 18,
  },

  infoIcon: {
    fontSize: 34,
  },

  greenText: {
    color: "#059669",
  },

  detailBtn: {
    marginLeft: "auto",
    height: 38,
    border: "1px solid #bbf7d0",
    background: "#ffffff",
    color: "#047857",
    borderRadius: 8,
    fontWeight: 800,
    padding: "0 14px",
    cursor: "pointer",
  },

  floatingAdd: {
    position: "fixed",
    right: 30,
    bottom: 26,
    width: 56,
    height: 56,
    borderRadius: 999,
    border: "none",
    background: "#059669",
    color: "#ffffff",
    fontSize: 34,
    boxShadow: "0 18px 40px rgba(5,150,105,.35)",
    cursor: "pointer",
    zIndex: 2000,
  },
};