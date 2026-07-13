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
const SUKOHARJO_ZOOM = 15;

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
    color: "#16a34a",
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
    color: "#9ca3af",
    light: "#f3f4f6",
    border: "#d1d5db",
  },
};

// =====================
// HELPER
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

const formatTanggal = (value) => {
  if (!value || value === "-") return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const toDateKey = (value) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
};

const normalizeText = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
};

const normalizeApiList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.prediksi)) return payload.prediksi;

  if (payload?.data && typeof payload.data === "object") {
    return [payload.data];
  }

  if (payload && typeof payload === "object") {
    return [payload];
  }

  return [];
};

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const getLat = (item) => {
  return item?.lat ?? item?.latitude ?? item?.lokasi_lat ?? null;
};

const getLng = (item) => {
  return item?.lng ?? item?.longitude ?? item?.lokasi_lng ?? null;
};

const isInsideSukoharjoBounds = (lat, lng) => {
  const latNumber = Number(lat);
  const lngNumber = Number(lng);

  if (Number.isNaN(latNumber) || Number.isNaN(lngNumber)) return false;

  const [[minLat, minLng], [maxLat, maxLng]] = SUKOHARJO_BOUNDS;

  return (
    latNumber >= minLat &&
    latNumber <= maxLat &&
    lngNumber >= minLng &&
    lngNumber <= maxLng
  );
};

const hasValidCoordinate = (item) => {
  const lat = getLat(item);
  const lng = getLng(item);

  if (!isFilled(lat) || !isFilled(lng)) return false;

  const latNumber = Number(lat);
  const lngNumber = Number(lng);

  return (
    !Number.isNaN(latNumber) &&
    !Number.isNaN(lngNumber) &&
    isInsideSukoharjoBounds(latNumber, lngNumber)
  );
};

const getMapLat = (item) => {
  return item?.__map_lat ?? getLat(item);
};

const getMapLng = (item) => {
  return item?.__map_lng ?? getLng(item);
};

const hasValidMapCoordinate = (item) => {
  const lat = getMapLat(item);
  const lng = getMapLng(item);

  if (!isFilled(lat) || !isFilled(lng)) return false;

  const latNumber = Number(lat);
  const lngNumber = Number(lng);

  return !Number.isNaN(latNumber) && !Number.isNaN(lngNumber);
};

const getCoordinateSignature = (lat, lng) => {
  return `${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;
};

const getFallbackCoordinate = (index = 0) => {
  const fallbackPoints = [
    [-7.6712, 110.8378],
    [-7.6698, 110.8402],
    [-7.6677, 110.8364],
    [-7.6665, 110.8417],
    [-7.6728, 110.8411],
    [-7.6653, 110.8348],
  ];

  return fallbackPoints[index % fallbackPoints.length];
};

const buildLahanMapItems = (rows = []) => {
  const coordinateCounter = new Map();

  return rows.map((item, index) => {
    const latRaw = getLat(item);
    const lngRaw = getLng(item);

    let lat = Number(latRaw);
    let lng = Number(lngRaw);

    const coordinateIsValid =
      isFilled(latRaw) &&
      isFilled(lngRaw) &&
      !Number.isNaN(lat) &&
      !Number.isNaN(lng) &&
      isInsideSukoharjoBounds(lat, lng);

    let coordinateSource = "database";

    if (!coordinateIsValid) {
      const fallback = getFallbackCoordinate(index);
      lat = fallback[0];
      lng = fallback[1];
      coordinateSource = "fallback";
    }

    const signature = getCoordinateSignature(lat, lng);
    const duplicateIndex = coordinateCounter.get(signature) || 0;

    coordinateCounter.set(signature, duplicateIndex + 1);

    if (duplicateIndex > 0) {
      const angle = ((duplicateIndex * 70) % 360) * (Math.PI / 180);
      const radius = 0.00045 + duplicateIndex * 0.00008;

      lat = lat + Math.sin(angle) * radius;
      lng = lng + Math.cos(angle) * radius;
    }

    return {
      ...item,
      __map_lat: lat,
      __map_lng: lng,
      __coordinate_source: coordinateSource,
      __duplicate_index: duplicateIndex,
    };
  });
};

const getLuasHa = (item) => {
  const luasHa = item?.luas_ha ?? item?.luasHa;

  if (luasHa !== undefined && luasHa !== null && luasHa !== "") {
    return Number(luasHa);
  }

  const luas = Number(item?.luas || item?.luas_m2 || 0);

  if (luas > 20) {
    return luas / 10000;
  }

  return luas;
};

const getLuasM2 = (item) => {
  const luasM2 = item?.luas_m2 ?? item?.luas_meter ?? item?.luas_sawah_m2;

  if (isFilled(luasM2)) {
    return Number(luasM2);
  }

  const luasHa = getLuasHa(item);

  if (Number.isFinite(luasHa)) {
    return luasHa * 10000;
  }

  return 0;
};

const getKoordinatText = (item) => {
  const lat = getMapLat(item);
  const lng = getMapLng(item);

  return {
    lat: isFilled(lat) ? Number(lat).toFixed(6) : "-",
    lng: isFilled(lng) ? Number(lng).toFixed(6) : "-",
  };
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

  if (raw.includes("tidak") || raw.includes("non") || raw.includes("inactive")) {
    return "inactive";
  }

  return "active";
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

const getUpdatedAt = (item) => {
  const value =
    item?.updated_at ||
    item?.terakhir_diperbarui ||
    item?.created_at ||
    item?.prediksi_created_at ||
    new Date().toISOString();

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

const findPrediksiForLahan = (prediksiList, lahanItem) => {
  if (!Array.isArray(prediksiList) || !lahanItem) return null;

  const lahanId = Number(lahanItem.id);

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
      prediksi_created_at: prediksi?.created_at ?? item?.prediksi_created_at,
      prediksi_period: prediksi?.periode ?? item?.prediksi_period,
    };
  });
};

// =====================
// PUPUK FROM KALENDER
// =====================
const isPemupukanEvent = (item) => {
  const text = [
    item?.jenis,
    item?.nama_kegiatan,
    item?.pupuk,
    item?.keterangan,
    item?.metode,
  ]
    .join(" ")
    .toLowerCase();

  return text.includes("pupuk") || text.includes("pemupukan");
};

const normalizePupukEvent = (item) => {
  return {
    id: item?.id,
    tanggal: item?.tanggal_final || item?.tanggal || "",
    nama:
      item?.pupuk ||
      item?.jenis_pupuk ||
      item?.nama_pupuk ||
      item?.nama_kegiatan ||
      "Belum ada rekomendasi",
    kegiatan: item?.nama_kegiatan || "Pemupukan",
    dosisHa:
      item?.dosis_per_ha ||
      item?.dosis_acuan ||
      item?.dosis ||
      item?.dosis_pupuk_per_ha ||
      "-",
    dosisTotal:
      item?.dosis_total ||
      item?.total_lahan ||
      item?.total ||
      item?.dosis_pupuk_total ||
      "-",
    status: item?.status || "terjadwal",
  };
};

const getFallbackPupukFromLahan = (item) => {
  return {
    nama:
      item?.pupuk_rekomendasi ||
      item?.rekomendasi_pupuk ||
      item?.next_pupuk ||
      item?.pupuk_terdekat ||
      item?.nama_pupuk ||
      item?.jenis_pupuk ||
      item?.pupuk ||
      "Belum ada rekomendasi",
    dosisHa:
      item?.dosis_pupuk_per_ha ||
      item?.dosis_per_ha ||
      item?.dosis_acuan ||
      item?.dosis ||
      "-",
    dosisTotal:
      item?.dosis_pupuk_total ||
      item?.dosis_total ||
      item?.total_pupuk ||
      "-",
    tanggal:
      item?.tanggal_pemupukan ||
      item?.tanggal_pupuk ||
      item?.next_tanggal_pupuk ||
      "-",
    kegiatan: item?.nama_kegiatan_pupuk || "Rekomendasi Pupuk",
  };
};

const pilihPupukTerdekat = (events) => {
  const todayKey = toDateKey(new Date());

  const pupukEvents = normalizeApiList(events)
    .filter(isPemupukanEvent)
    .filter((item) => String(item?.status || "").toLowerCase() !== "selesai")
    .map(normalizePupukEvent)
    .filter((item) => item.tanggal);

  if (pupukEvents.length === 0) return null;

  const upcoming = pupukEvents
    .filter((item) => toDateKey(item.tanggal) >= todayKey)
    .sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

  if (upcoming.length > 0) return upcoming[0];

  const latestPast = pupukEvents.sort(
    (a, b) => new Date(b.tanggal) - new Date(a.tanggal)
  );

  return latestPast[0] || null;
};

const fetchPupukForLahan = async (lahanItem, userId) => {
  if (!lahanItem?.id) {
    return {
      ...lahanItem,
      pupuk_rekomendasi: "Belum ada rekomendasi",
      dosis_pupuk_per_ha: "-",
      dosis_pupuk_total: "-",
      tanggal_pemupukan: "-",
    };
  }

  try {
    const res = await axios.get(`${API_NODE}/api/kalender/${lahanItem.id}`, {
      params: {
        user_id: userId,
        petani_id: userId,
        auto: 1,
      },
    });

    const dataKalender = normalizeApiList(res.data);
    const selectedPupuk = pilihPupukTerdekat(dataKalender);

    if (!selectedPupuk) {
      const fallback = getFallbackPupukFromLahan(lahanItem);

      return {
        ...lahanItem,
        pupuk_rekomendasi: fallback.nama,
        dosis_pupuk_per_ha: fallback.dosisHa,
        dosis_pupuk_total: fallback.dosisTotal,
        tanggal_pemupukan: fallback.tanggal,
        nama_kegiatan_pupuk: fallback.kegiatan,
      };
    }

    return {
      ...lahanItem,
      pupuk_rekomendasi: selectedPupuk.nama,
      dosis_pupuk_per_ha: selectedPupuk.dosisHa,
      dosis_pupuk_total: selectedPupuk.dosisTotal,
      tanggal_pemupukan: selectedPupuk.tanggal,
      nama_kegiatan_pupuk: selectedPupuk.kegiatan,
    };
  } catch (err) {
    console.warn(
      "Gagal mengambil kalender pupuk lahan:",
      lahanItem?.id,
      err.response?.data || err.message
    );

    const fallback = getFallbackPupukFromLahan(lahanItem);

    return {
      ...lahanItem,
      pupuk_rekomendasi: fallback.nama,
      dosis_pupuk_per_ha: fallback.dosisHa,
      dosis_pupuk_total: fallback.dosisTotal,
      tanggal_pemupukan: fallback.tanggal,
      nama_kegiatan_pupuk: fallback.kegiatan,
    };
  }
};

const getRekomendasiPupuk = (item) => {
  return {
    nama: item?.pupuk_rekomendasi || "Belum ada rekomendasi",
    dosisHa: item?.dosis_pupuk_per_ha || "-",
    dosisTotal: item?.dosis_pupuk_total || "-",
    tanggal: item?.tanggal_pemupukan || "-",
    kegiatan: item?.nama_kegiatan_pupuk || "Rekomendasi Pupuk",
  };
};

// =====================
// POLYGON
// =====================
const createFallbackPolygon = (item) => {
  const latValue = getMapLat(item);
  const lngValue = getMapLng(item);

  if (!isFilled(latValue) || !isFilled(lngValue)) return [];

  const lat = Number(latValue);
  const lng = Number(lngValue);

  if (Number.isNaN(lat) || Number.isNaN(lng)) return [];

  const luas = Math.max(getLuasHa(item), 0.1);
  const size = Math.min(Math.max(Math.sqrt(luas) * 0.0017, 0.0012), 0.0045);

  return [
    [lat + size * 1.1, lng - size * 0.9],
    [lat + size * 0.8, lng + size * 1.1],
    [lat - size * 0.2, lng + size * 1.4],
    [lat - size * 1.1, lng + size * 0.4],
    [lat - size * 0.8, lng - size * 1.2],
    [lat + size * 0.2, lng - size * 1.5],
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

// =====================
// ICON
// =====================
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
        box-shadow: 0 10px 24px rgba(0,0,0,.25);
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
      width: 30px;
      height: 30px;
      border-radius: 999px;
      background: #0ea5e9;
      border: 4px solid #ffffff;
      box-shadow: 0 10px 24px rgba(0,0,0,.25);
    "></div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
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
    const lat = getMapLat(selectedLahan);
    const lng = getMapLng(selectedLahan);

    if (!isFilled(lat) || !isFilled(lng)) return;

    const latNumber = Number(lat);
    const lngNumber = Number(lng);

    if (Number.isNaN(latNumber) || Number.isNaN(lngNumber)) return;

    map.flyTo([latNumber, lngNumber], 16, {
      duration: 0.8,
    });
  }, [map, selectedLahan]);

  return null;
}

function MapControls() {
  const map = useMap();

  return (
    <div style={styles.mapControls}>
      <button
        style={styles.mapControlButton}
        onClick={() => map.zoomIn()}
        type="button"
      >
        +
      </button>

      <button
        style={styles.mapControlButton}
        onClick={() => map.zoomOut()}
        type="button"
      >
        −
      </button>

      <button
        style={{ ...styles.mapControlButton, marginTop: 14 }}
        onClick={() => map.setView(SUKOHARJO_CENTER, SUKOHARJO_ZOOM)}
        type="button"
      >
        ⦿
      </button>

      <button
        style={styles.mapControlButton}
        onClick={() => map.setZoom(15)}
        type="button"
      >
        ▤
      </button>
    </div>
  );
}

// =====================
// MAIN PAGE
// =====================
export default function PetaLahan() {
  const navigate = useNavigate();

  const [lahan, setLahan] = useState([]);
  const [selectedLahan, setSelectedLahan] = useState(null);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);

  const storedUser = getStoredUser();

  const userId =
    localStorage.getItem("user_id") ||
    localStorage.getItem("id") ||
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

      const mergedData = mergeLahanWithPrediksi(dataLahan, dataPrediksi);
      const mapReadyData = buildLahanMapItems(mergedData);

      const withPupuk = await Promise.all(
        mapReadyData.map((item) => fetchPupukForLahan(item, userId))
      );

      setLahan(withPupuk);

      if (withPupuk.length > 0) {
        const firstWithCoordinate = withPupuk.find(hasValidMapCoordinate);
        setSelectedLahan(firstWithCoordinate || withPupuk[0]);
      } else {
        setSelectedLahan(null);
      }
    } catch (err) {
      console.error("Gagal mengambil data lahan:", err.response?.data || err);
      setLahan([]);
      setSelectedLahan(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePredict = async (item) => {
    if (!item?.id) return;

    try {
      const res = await axios.get(`${API_NODE}/api/prediksi`);
      const dataPrediksi = normalizeApiList(res.data);

      const prediksi = findPrediksiForLahan(dataPrediksi, item);

      if (!prediksi) {
        setSelectedLahan(item);
        return;
      }

      const updatedItem = {
        ...item,
        prediksi_id: prediksi?.id ?? item?.prediksi_id,
        prediksi_ton: getPrediksiTon(prediksi),
        prediksi_kg: getPrediksiKg(prediksi),
        prediksi_created_at: prediksi?.created_at ?? item?.prediksi_created_at,
        prediksi_period: prediksi?.periode ?? item?.prediksi_period,
      };

      setLahan((prev) =>
        prev.map((row) =>
          Number(row.id) === Number(item.id) ? updatedItem : row
        )
      );

      setSelectedLahan(updatedItem);
    } catch (err) {
      console.error("Gagal mengambil prediksi:", err.response?.data || err);
      setSelectedLahan(item);
    }
  };

  const handleSelectLahan = (item) => {
    setSelectedLahan(item);
    handlePredict(item);
  };

  const filteredLahan = useMemo(() => {
    const value = keyword.trim().toLowerCase();

    if (!value) return lahan;

    return lahan.filter((item) => {
      const text = [
        item?.nama_lahan,
        item?.nama_desa,
        item?.nama_kecamatan,
        item?.tanaman,
        item?.jenis_tanaman,
        item?.komoditas,
        item?.varietas,
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

    const lahanAktif = lahan.filter(
      (item) => getStatusType(item) === "active"
    ).length;

    const siapPanen = lahan.filter(
      (item) => getStatusType(item) === "ready"
    ).length;

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
  const selectedKoordinat = getKoordinatText(selectedLahan);
  const selectedPupuk = getRekomendasiPupuk(selectedLahan);

  return (
    <div style={styles.page}>
      <main style={styles.main}>
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <button
              style={styles.menuButton}
              type="button"
              onClick={() => navigate("/petani")}
            >
              ←
            </button>

            <div>
              <h1 style={styles.pageTitle}>Peta Lahan Saya</h1>
              <p style={styles.pageSubtitle}>
                Kelola dan pantau lokasi lahan Anda
              </p>
            </div>
          </div>

          <div style={styles.headerRight}>
            <div style={styles.weatherBox}>
              <div style={styles.sunIcon}>☀</div>
              <div>
                <div style={styles.weatherTemp}>28°C</div>
                <div style={styles.weatherText}>Cerah</div>
              </div>
            </div>

            <PetaniNotificationBell />

            <div style={styles.headerAvatar}>👨🏽‍🌾</div>
          </div>
        </header>

        <section style={styles.mapSection}>
          <MapContainer
            center={SUKOHARJO_CENTER}
            zoom={SUKOHARJO_ZOOM}
            minZoom={11}
            maxZoom={18}
            maxBounds={SUKOHARJO_BOUNDS}
            maxBoundsViscosity={1}
            zoomControl={false}
            style={styles.map}
          >
            <TileLayer
              attribution="Tiles © Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />

            <ResetView />
            <FlyToSelected selectedLahan={selectedLahan} />
            <MapControls />

            <Marker icon={userMarkerIcon} position={SUKOHARJO_CENTER}>
              <Popup>Lokasi Anda</Popup>
            </Marker>

            {filteredLahan.map((item) => {
              const lat = getMapLat(item);
              const lng = getMapLng(item);

              if (!isFilled(lat) || !isFilled(lng)) return null;

              const latNumber = Number(lat);
              const lngNumber = Number(lng);

              if (Number.isNaN(latNumber) || Number.isNaN(lngNumber)) {
                return null;
              }

              const statusType = getStatusType(item);
              const status = STATUS_CONFIG[statusType];
              const polygon = parsePolygon(item);
              const koordinat = getKoordinatText(item);
              const rekomendasiPupuk = getRekomendasiPupuk(item);

              return (
                <Fragment
                  key={`${item.id || item.nama_lahan}-${latNumber}-${lngNumber}`}
                >
                  {polygon.length > 0 && (
                    <Polygon
                      positions={polygon}
                      pathOptions={{
                        color: status.color,
                        fillColor: status.color,
                        fillOpacity: statusType === "ready" ? 0.22 : 0.28,
                        weight: 3,
                      }}
                      eventHandlers={{
                        click: () => handleSelectLahan(item),
                      }}
                    />
                  )}

                  <Marker
                    icon={createStatusIcon(statusType)}
                    position={[latNumber, lngNumber]}
                    eventHandlers={{
                      click: () => handleSelectLahan(item),
                    }}
                  >
                    <Popup maxWidth={360}>
                      <div style={styles.popupCard}>
                        <div style={styles.popupImageWrap}>
                          <img
                            src={getLahanImage(item)}
                            data-image-candidates={getLahanImageCandidates(
                              item
                            ).join("||")}
                            alt={item?.nama_lahan || "Lahan"}
                            style={styles.popupImage}
                            onError={handleImageError}
                          />
                        </div>

                        <h4 style={styles.popupTitle}>
                          {item?.nama_lahan || "Lahan Tanpa Nama"}
                        </h4>

                        <p style={styles.popupText}>
                          {item?.nama_desa || "Desa belum diisi"}
                        </p>

                        <p style={styles.popupText}>
                          {item?.nama_kecamatan || "Kecamatan belum diisi"}
                        </p>

                        {item?.__coordinate_source === "fallback" && (
                          <p style={styles.popupWarning}>
                            Koordinat belum diisi, marker ditampilkan sementara.
                          </p>
                        )}

                        {item?.__duplicate_index > 0 && (
                          <p style={styles.popupWarning}>
                            Koordinat sama dengan lahan lain, marker digeser
                            sedikit.
                          </p>
                        )}

                        <div style={styles.popupInfoGrid}>
                          <div style={styles.popupInfoBox}>
                            <span>Latitude</span>
                            <strong>{koordinat.lat}</strong>
                          </div>

                          <div style={styles.popupInfoBox}>
                            <span>Longitude</span>
                            <strong>{koordinat.lng}</strong>
                          </div>

                          <div style={styles.popupInfoBox}>
                            <span>Luas</span>
                            <strong>{formatNumber(getLuasHa(item), 2)} Ha</strong>
                          </div>

                          <div style={styles.popupInfoBox}>
                            <span>Luas m²</span>
                            <strong>{formatNumber(getLuasM2(item), 0)} m²</strong>
                          </div>
                        </div>

                        <div style={styles.popupPupukBox}>
                          <div style={styles.popupPupukTitle}>
                            🌱 Rekomendasi Pupuk
                          </div>

                          <div style={styles.popupPupukRow}>
                            <span>Pupuk</span>
                            <strong>{rekomendasiPupuk.nama}</strong>
                          </div>

                          <div style={styles.popupPupukRow}>
                            <span>Dosis/Ha</span>
                            <strong>{rekomendasiPupuk.dosisHa}</strong>
                          </div>

                          <div style={styles.popupPupukRow}>
                            <span>Total Lahan</span>
                            <strong>{rekomendasiPupuk.dosisTotal}</strong>
                          </div>

                          <div style={styles.popupPupukRow}>
                            <span>Tanggal</span>
                            <strong>{formatTanggal(rekomendasiPupuk.tanggal)}</strong>
                          </div>
                        </div>

                        <p style={styles.popupText}>
                          Umur:{" "}
                          {getUmurTanaman(item) !== "-"
                            ? `${getUmurTanaman(item)} Hari`
                            : "-"}
                        </p>

                        <p style={styles.popupPrediction}>
                          Prediksi: {formatPrediksiTon(item)} Ton
                        </p>

                        {isFilled(item?.prediksi_kg) && (
                          <p style={styles.popupPredictionKg}>
                            {formatNumber(item.prediksi_kg, 0)} Kg
                          </p>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                </Fragment>
              );
            })}
          </MapContainer>

          <div style={styles.searchPanel}>
            <div style={styles.searchIcon}>⌕</div>

            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Cari lokasi lahan..."
              style={styles.searchInput}
            />

            <button style={styles.filterButton} type="button">
              ⌄ Filter
            </button>

            <button
              style={styles.addButton}
              type="button"
              onClick={() => navigate("/petani/tambah-lahan")}
            >
              + Tambah Lahan
            </button>
          </div>

          <div style={styles.summaryCard}>
            <h3 style={styles.cardTitle}>Ringkasan Lahan</h3>

            <div style={styles.summaryGrid}>
              <div style={styles.summaryItem}>
                <div style={styles.summaryNumber}>{summary.totalLahan}</div>
                <div style={styles.summaryLabel}>Total Lahan</div>
              </div>

              <div style={styles.summaryItem}>
                <div style={styles.summaryNumber}>
                  {formatNumber(summary.totalLuas, 2)}
                  <span style={styles.unit}> Ha</span>
                </div>
                <div style={styles.summaryLabel}>Total Luas</div>
              </div>

              <div style={styles.summaryItemGreen}>
                <div style={styles.summaryNumber}>{summary.lahanAktif}</div>
                <div style={styles.summaryLabel}>Lahan Aktif</div>
              </div>

              <div style={styles.summaryItemYellow}>
                <div style={styles.summaryNumberYellow}>
                  {summary.siapPanen}
                </div>
                <div style={styles.summaryLabel}>Siap Panen</div>
              </div>
            </div>
          </div>

          <div style={styles.listCard}>
            <h3 style={styles.cardTitle}>Daftar Lahan</h3>

            <div style={styles.listBody}>
              {loading && (
                <div style={styles.emptyText}>Memuat data lahan...</div>
              )}

              {!loading && filteredLahan.length === 0 && (
                <div style={styles.emptyText}>Belum ada data lahan.</div>
              )}

              {!loading &&
                filteredLahan.map((item) => {
                  const statusType = getStatusType(item);
                  const status = STATUS_CONFIG[statusType];
                  const umurTanaman = getUmurTanaman(item);

                  return (
                    <button
                      key={item.id}
                      style={{
                        ...styles.lahanItem,
                        background:
                          selectedLahan?.id === item.id
                            ? "#f8fafc"
                            : "transparent",
                      }}
                      onClick={() => handleSelectLahan(item)}
                      type="button"
                    >
                      <div
                        style={{
                          ...styles.listPin,
                          color: status.color,
                        }}
                      >
                        ●
                      </div>

                      <div style={styles.lahanInfo}>
                        <div style={styles.lahanTop}>
                          <strong style={styles.lahanName}>
                            {item?.nama_lahan || "Lahan Tanpa Nama"}
                          </strong>

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

                        <div style={styles.lahanMeta}>
                          {formatNumber(getLuasHa(item), 2)} Ha ·{" "}
                          {getTanaman(item)} ·{" "}
                          {umurTanaman !== "-"
                            ? `${umurTanaman} Hari`
                            : "Umur -"}{" "}
                          · Prediksi {formatPrediksiTon(item)} Ton
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>

            <button
              style={styles.seeAllButton}
              type="button"
              onClick={() => navigate("/petani/lahan-saya")}
            >
              Lihat Semua Lahan →
            </button>
          </div>

          <div style={styles.detailCard}>
            <h3 style={styles.cardTitle}>Informasi Lahan Terpilih</h3>

            {selectedLahan ? (
              <>
                <div style={styles.detailHeader}>
                  <div
                    style={{
                      ...styles.detailPin,
                      color: selectedStatus.color,
                    }}
                  >
                    ●
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={styles.detailTitleRow}>
                      <strong style={styles.detailName}>
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
                  </div>
                </div>

                <div style={styles.detailRows}>
                  <div style={styles.detailRow}>
                    <span>Latitude</span>
                    <strong>{selectedKoordinat.lat}</strong>
                  </div>

                  <div style={styles.detailRow}>
                    <span>Longitude</span>
                    <strong>{selectedKoordinat.lng}</strong>
                  </div>

                  <div style={styles.detailRow}>
                    <span>Luas</span>
                    <strong>
                      {formatNumber(getLuasHa(selectedLahan), 2)} Ha
                    </strong>
                  </div>

                  <div style={styles.detailRow}>
                    <span>Luas m²</span>
                    <strong>
                      {formatNumber(getLuasM2(selectedLahan), 0)} m²
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
                    <span>Pupuk</span>
                    <strong>{selectedPupuk.nama}</strong>
                  </div>

                  <div style={styles.detailRow}>
                    <span>Dosis/Ha</span>
                    <strong>{selectedPupuk.dosisHa}</strong>
                  </div>

                  <div style={styles.detailRow}>
                    <span>Total Pupuk</span>
                    <strong>{selectedPupuk.dosisTotal}</strong>
                  </div>

                  <div style={styles.detailRow}>
                    <span>Tanggal Pupuk</span>
                    <strong>{formatTanggal(selectedPupuk.tanggal)}</strong>
                  </div>

                  <div style={styles.detailRow}>
                    <span>Prediksi Panen</span>
                    <strong>{formatPrediksiTon(selectedLahan)} Ton</strong>
                  </div>

                  <div style={styles.detailRow}>
                    <span>Prediksi Kg</span>
                    <strong>
                      {isFilled(selectedLahan?.prediksi_kg)
                        ? `${formatNumber(selectedLahan.prediksi_kg, 0)} Kg`
                        : "-"}
                    </strong>
                  </div>

                  <div style={styles.detailRow}>
                    <span>Periode</span>
                    <strong>{selectedLahan?.prediksi_period || "-"}</strong>
                  </div>

                  <div style={styles.detailRow}>
                    <span>Terakhir Diperbarui</span>
                    <strong>{getUpdatedAt(selectedLahan)}</strong>
                  </div>
                </div>
              </>
            ) : (
              <div style={styles.emptyText}>Pilih lahan pada peta.</div>
            )}
          </div>

          <div style={styles.legendCard}>
            <h3 style={styles.legendTitle}>Legenda</h3>

            <div style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: "#16a34a" }} />
              Lahan Aktif
            </div>

            <div style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: "#fbbf24" }} />
              Siap Panen
            </div>

            <div style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: "#ef4444" }} />
              Perlu Perhatian
            </div>

            <div style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: "#9ca3af" }} />
              Tidak Aktif
            </div>
          </div>

          <div style={styles.bottomBar}>
            <div style={styles.bottomItem}>
              <div style={styles.bottomIconYellow}>💡</div>
              <div>
                <div style={styles.bottomTitle}>Tips Hari Ini</div>
                <div style={styles.bottomText}>
                  Lakukan pemupukan sesuai jadwal kalender budidaya otomatis.
                </div>
              </div>
            </div>

            <div style={styles.bottomDivider} />

            <div style={styles.bottomItemSmall}>
              <div style={styles.bottomIconBlue}>💧</div>
              <div>
                <div style={styles.bottomTitle}>Kelembapan Tanah</div>
                <div style={styles.bigValue}>65%</div>
                <div style={styles.greenText}>Optimal</div>
              </div>
            </div>

            <div style={styles.bottomDivider} />

            <div style={styles.bottomItemSmall}>
              <div style={styles.bottomIconGray}>☁</div>
              <div>
                <div style={styles.bottomTitle}>Curah Hujan</div>
                <div style={styles.bigValue}>12 mm</div>
                <div style={styles.greenText}>Rendah</div>
              </div>
            </div>

            <div style={styles.bottomDivider} />

            <div style={styles.bottomItemSmall}>
              <div style={styles.bottomIconGreen}>🌱</div>
              <div>
                <div style={styles.bottomTitle}>Rekomendasi Pupuk</div>
                <div style={styles.bottomTextStrong}>
                  {selectedPupuk.nama || "Belum ada rekomendasi"}
                </div>
                <div style={styles.bottomTextStrong}>
                  {selectedPupuk.dosisHa !== "-"
                    ? selectedPupuk.dosisHa
                    : "Dosis belum tersedia"}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

// =====================
// STYLES
// =====================
const styles = {
  page: {
    width: "100%",
    minHeight: "100vh",
    display: "flex",
    background: "#f8fafc",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: "#111827",
    overflow: "hidden",
  },

  main: {
    width: "100%",
    minWidth: 0,
    height: "100vh",
    display: "flex",
    flexDirection: "column",
  },

  header: {
    height: 92,
    minHeight: 92,
    background: "rgba(255,255,255,.96)",
    borderBottom: "1px solid rgba(226,232,240,.9)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    boxSizing: "border-box",
    zIndex: 15,
  },

  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },

  menuButton: {
    width: 44,
    height: 44,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "#f8fafc",
    fontSize: 22,
    cursor: "pointer",
  },

  pageTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 850,
    color: "#111827",
  },

  pageSubtitle: {
    margin: "5px 0 0",
    fontSize: 14,
    color: "#6b7280",
  },

  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },

  weatherBox: {
    height: 48,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 14px",
    background: "#ffffff",
  },

  sunIcon: {
    fontSize: 27,
    color: "#f59e0b",
  },

  weatherTemp: {
    fontWeight: 800,
    fontSize: 15,
  },

  weatherText: {
    fontSize: 12,
    color: "#6b7280",
  },

  headerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 999,
    background: "#dbeafe",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
  },

  mapSection: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },

  map: {
    width: "100%",
    height: "100%",
  },

  searchPanel: {
    position: "absolute",
    top: 24,
    left: 24,
    zIndex: 1000,
    width: 650,
    height: 60,
    background: "#ffffff",
    borderRadius: 14,
    boxShadow: "0 14px 35px rgba(15,23,42,.14)",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "0 14px",
    boxSizing: "border-box",
  },

  searchIcon: {
    fontSize: 23,
    color: "#6b7280",
  },

  searchInput: {
    flex: 1,
    height: 42,
    border: "none",
    outline: "none",
    fontSize: 15,
    color: "#111827",
  },

  filterButton: {
    height: 40,
    padding: "0 18px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#111827",
    fontWeight: 700,
    cursor: "pointer",
  },

  addButton: {
    height: 42,
    padding: "0 20px",
    borderRadius: 10,
    border: "none",
    background: "#ecfdf5",
    color: "#047857",
    fontWeight: 800,
    cursor: "pointer",
  },

  mapControls: {
    position: "absolute",
    top: 100,
    left: 24,
    zIndex: 1000,
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },

  mapControlButton: {
    width: 44,
    height: 44,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    fontSize: 22,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "0 12px 28px rgba(15,23,42,.13)",
  },

  summaryCard: {
    position: "absolute",
    top: 24,
    right: 24,
    zIndex: 1000,
    width: 318,
    background: "rgba(255,255,255,.96)",
    borderRadius: 14,
    padding: 18,
    boxShadow: "0 14px 35px rgba(15,23,42,.14)",
    boxSizing: "border-box",
  },

  cardTitle: {
    margin: "0 0 14px",
    fontSize: 16,
    fontWeight: 850,
    color: "#111827",
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },

  summaryItem: {
    border: "1px solid #e5e7eb",
    borderRadius: 9,
    padding: "14px 12px",
    background: "#ffffff",
  },

  summaryItemGreen: {
    border: "1px solid #d1fae5",
    borderRadius: 9,
    padding: "14px 12px",
    background: "#f0fdf4",
  },

  summaryItemYellow: {
    border: "1px solid #fde68a",
    borderRadius: 9,
    padding: "14px 12px",
    background: "#fffbeb",
  },

  summaryNumber: {
    fontSize: 22,
    fontWeight: 900,
    color: "#047857",
  },

  summaryNumberYellow: {
    fontSize: 22,
    fontWeight: 900,
    color: "#f59e0b",
  },

  unit: {
    fontSize: 13,
    fontWeight: 800,
  },

  summaryLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 5,
  },

  listCard: {
    position: "absolute",
    top: 246,
    right: 24,
    zIndex: 1000,
    width: 318,
    background: "rgba(255,255,255,.96)",
    borderRadius: 14,
    padding: 18,
    boxShadow: "0 14px 35px rgba(15,23,42,.14)",
    boxSizing: "border-box",
  },

  listBody: {
    maxHeight: 190,
    overflowY: "auto",
  },

  lahanItem: {
    width: "100%",
    display: "flex",
    gap: 12,
    padding: "12px 0",
    border: "none",
    borderBottom: "1px solid #e5e7eb",
    cursor: "pointer",
    textAlign: "left",
  },

  listPin: {
    fontSize: 22,
    lineHeight: "22px",
    marginTop: 2,
  },

  lahanInfo: {
    flex: 1,
    minWidth: 0,
  },

  lahanTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "center",
  },

  lahanName: {
    fontSize: 14,
    color: "#111827",
  },

  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    height: 24,
    padding: "0 9px",
    borderRadius: 8,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  lahanMeta: {
    marginTop: 6,
    fontSize: 12,
    color: "#4b5563",
  },

  seeAllButton: {
    width: "100%",
    height: 36,
    marginTop: 12,
    border: "1px solid #e5e7eb",
    borderRadius: 9,
    background: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
  },

  detailCard: {
    position: "absolute",
    right: 24,
    bottom: 170,
    zIndex: 1000,
    width: 318,
    background: "rgba(255,255,255,.96)",
    borderRadius: 14,
    padding: 18,
    boxShadow: "0 14px 35px rgba(15,23,42,.14)",
    boxSizing: "border-box",
  },

  detailHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },

  detailPin: {
    fontSize: 23,
  },

  detailTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },

  detailName: {
    fontSize: 15,
  },

  detailRows: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  detailRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    fontSize: 13,
    color: "#6b7280",
  },

  legendCard: {
    position: "absolute",
    left: 22,
    bottom: 170,
    zIndex: 1000,
    width: 162,
    background: "rgba(255,255,255,.96)",
    borderRadius: 14,
    padding: 18,
    boxShadow: "0 14px 35px rgba(15,23,42,.14)",
    boxSizing: "border-box",
  },

  legendTitle: {
    margin: "0 0 14px",
    fontSize: 15,
    fontWeight: 850,
  },

  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
    color: "#374151",
    marginBottom: 14,
  },

  legendDot: {
    width: 13,
    height: 13,
    borderRadius: 999,
    display: "inline-block",
  },

  bottomBar: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 22,
    zIndex: 1000,
    minHeight: 112,
    border: "1px solid #d1fae5",
    borderRadius: 12,
    background: "rgba(255,255,255,.94)",
    boxShadow: "0 14px 35px rgba(15,23,42,.12)",
    display: "grid",
    gridTemplateColumns: "2fr 1px 1.2fr 1px 1.2fr 1px 1.8fr",
    alignItems: "center",
    padding: "18px 26px",
    boxSizing: "border-box",
  },

  bottomItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
  },

  bottomItemSmall: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    paddingLeft: 28,
  },

  bottomDivider: {
    width: 1,
    height: 58,
    background: "#d1fae5",
  },

  bottomIconYellow: {
    fontSize: 22,
    color: "#f59e0b",
  },

  bottomIconBlue: {
    fontSize: 24,
    color: "#0ea5e9",
  },

  bottomIconGray: {
    fontSize: 24,
    color: "#94a3b8",
  },

  bottomIconGreen: {
    fontSize: 24,
    color: "#16a34a",
  },

  bottomTitle: {
    fontSize: 14,
    fontWeight: 800,
    marginBottom: 8,
  },

  bottomText: {
    fontSize: 13,
    color: "#374151",
    lineHeight: 1.5,
    maxWidth: 260,
  },

  bottomTextStrong: {
    fontSize: 14,
    color: "#111827",
    lineHeight: 1.55,
  },

  bigValue: {
    fontSize: 22,
    fontWeight: 850,
    marginBottom: 3,
  },

  greenText: {
    fontSize: 13,
    color: "#059669",
  },

  popupCard: {
    width: 300,
  },

  popupImageWrap: {
    width: "100%",
    height: 120,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 10,
    background: "#f1f5f9",
  },

  popupImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },

  popupTitle: {
    margin: "0 0 6px",
    fontSize: 15,
  },

  popupText: {
    margin: "0 0 5px",
    color: "#4b5563",
    fontSize: 13,
  },

  popupPrediction: {
    margin: "8px 0 0",
    color: "#047857",
    fontWeight: 850,
    fontSize: 13,
  },

  popupPredictionKg: {
    margin: "4px 0 0",
    color: "#047857",
    fontWeight: 700,
    fontSize: 12,
  },

  popupWarning: {
    margin: "6px 0",
    color: "#b45309",
    fontWeight: 700,
    fontSize: 12,
    lineHeight: 1.35,
  },

  popupInfoGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginTop: 10,
    marginBottom: 10,
  },

  popupInfoBox: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: "8px 9px",
    display: "grid",
    gap: 3,
    fontSize: 11,
    color: "#64748b",
  },

  popupPupukBox: {
    marginTop: 10,
    marginBottom: 10,
    padding: 10,
    borderRadius: 10,
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
  },

  popupPupukTitle: {
    fontWeight: 850,
    color: "#047857",
    marginBottom: 8,
    fontSize: 13,
  },

  popupPupukRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    fontSize: 12,
    color: "#065f46",
    marginBottom: 5,
  },

  emptyText: {
    fontSize: 13,
    color: "#6b7280",
    padding: "10px 0",
  },
};