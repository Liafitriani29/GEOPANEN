import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import PetaniNotificationBell from "../../components/PetaniNotificationBell";

const API = "http://localhost:3000/api";
const BASE_NODE_URL = API.replace(/\/api\/?$/, "");

// =====================================================
// PLACEHOLDER AMAN
// =====================================================
const createSvgPlaceholder = (title, subtitle, bg = "#064e3b") => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="900" height="520" viewBox="0 0 900 520">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${bg}"/>
          <stop offset="100%" stop-color="#16a34a"/>
        </linearGradient>
      </defs>
      <rect width="900" height="520" fill="url(#g)"/>
      <path d="M0 380 C140 320 220 420 360 360 C520 290 610 400 900 310 L900 520 L0 520 Z" fill="rgba(255,255,255,.18)"/>
      <path d="M0 430 C170 370 280 460 430 405 C590 345 690 455 900 370 L900 520 L0 520 Z" fill="rgba(255,255,255,.16)"/>
      <circle cx="720" cy="105" r="42" fill="rgba(255,255,255,.25)"/>
      <text x="52" y="260" font-family="Arial, sans-serif" font-size="44" font-weight="800" fill="#ffffff">${title}</text>
      <text x="55" y="310" font-family="Arial, sans-serif" font-size="22" fill="rgba(255,255,255,.9)">${subtitle}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const createMapPreviewSvg = (lat = null, lng = null, title = "Preview Peta") => {
  const hasCoordinate =
    lat !== null &&
    lat !== undefined &&
    lng !== null &&
    lng !== undefined &&
    !Number.isNaN(Number(lat)) &&
    !Number.isNaN(Number(lng));

  const coordinateText = hasCoordinate
    ? `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`
    : "Koordinat belum tersedia";

  const subtitle = hasCoordinate
    ? "Koordinat lahan tersimpan"
    : "Preview lokasi lahan";

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="520" height="360" viewBox="0 0 520 360">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#dcfce7"/>
          <stop offset="48%" stop-color="#86efac"/>
          <stop offset="100%" stop-color="#15803d"/>
        </linearGradient>
        <linearGradient id="river" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stop-color="#bae6fd"/>
          <stop offset="100%" stop-color="#38bdf8"/>
        </linearGradient>
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="10" stdDeviation="8" flood-color="#064e3b" flood-opacity=".28"/>
        </filter>
      </defs>

      <rect width="520" height="360" rx="26" fill="url(#bg)"/>

      <path d="M-30 95 C80 70 120 132 210 102 C305 70 352 92 424 58 C470 36 510 36 555 48"
            fill="none" stroke="url(#river)" stroke-width="26" opacity=".7"/>

      <g opacity=".42">
        <path d="M0 58 H520" stroke="#ffffff" stroke-width="2"/>
        <path d="M0 128 H520" stroke="#ffffff" stroke-width="2"/>
        <path d="M0 208 H520" stroke="#ffffff" stroke-width="2"/>
        <path d="M0 288 H520" stroke="#ffffff" stroke-width="2"/>
        <path d="M88 0 V360" stroke="#ffffff" stroke-width="2"/>
        <path d="M188 0 V360" stroke="#ffffff" stroke-width="2"/>
        <path d="M300 0 V360" stroke="#ffffff" stroke-width="2"/>
        <path d="M420 0 V360" stroke="#ffffff" stroke-width="2"/>
      </g>

      <g filter="url(#shadow)">
        <path d="M68 160 L190 124 L250 225 L96 250 Z" fill="#22c55e" opacity=".74" stroke="#ffffff" stroke-width="4"/>
        <path d="M220 105 L376 72 L444 174 L264 208 Z" fill="#eab308" opacity=".62" stroke="#ffffff" stroke-width="4"/>
        <path d="M222 226 L410 184 L472 286 L290 326 Z" fill="#16a34a" opacity=".7" stroke="#ffffff" stroke-width="4"/>
        <path d="M62 260 L204 232 L250 330 L94 342 Z" fill="#4ade80" opacity=".58" stroke="#ffffff" stroke-width="4"/>
      </g>

      <g filter="url(#shadow)">
        <circle cx="270" cy="178" r="25" fill="#ffffff"/>
        <circle cx="270" cy="178" r="17" fill="#f59e0b"/>
      </g>

      <g transform="translate(22 22)">
        <rect width="236" height="78" rx="16" fill="rgba(255,255,255,.88)"/>
        <text x="18" y="31" font-family="Arial, sans-serif" font-size="18" font-weight="800" fill="#064e3b">${title}</text>
        <text x="18" y="54" font-family="Arial, sans-serif" font-size="13" font-weight="600" fill="#047857">${subtitle}</text>
      </g>

      <g transform="translate(22 288)">
        <rect width="278" height="46" rx="14" fill="rgba(6,78,59,.84)"/>
        <text x="18" y="29" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#ffffff">${coordinateText}</text>
      </g>

      <g transform="translate(410 26)">
        <rect width="78" height="32" rx="16" fill="rgba(255,255,255,.84)"/>
        <circle cx="18" cy="16" r="6" fill="#16a34a"/>
        <text x="31" y="21" font-family="Arial, sans-serif" font-size="12" font-weight="800" fill="#065f46">Lahan</text>
      </g>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const FALLBACK_IMAGE = createSvgPlaceholder(
  "Lahan Pertanian",
  "Foto lahan belum tersedia"
);

const MAP_FALLBACK = createMapPreviewSvg(null, null, "Preview Peta");

// =====================================================
// HELPER
// =====================================================
const normalizeApiList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const isFilled = (value) => {
  return value !== null && value !== undefined && value !== "";
};

const firstFilled = (...values) => {
  return values.find((value) => isFilled(value));
};

const formatMetric = (value, digit = 1, fallback = "-") => {
  const number = Number(value);

  if (!Number.isFinite(number)) return fallback;

  return number.toLocaleString("id-ID", {
    minimumFractionDigits: Number.isInteger(number) ? 0 : digit,
    maximumFractionDigits: digit,
  });
};

const getTanggalTanam = (item) => {
  return firstFilled(
    item?.tanggal_tanam,
    item?.tgl_tanam,
    item?.tanggalTanam,
    item?.tanggal_mulai_tanam,
    item?.tanggal_awal_tanam,
    item?.planting_date,
    item?.day_of_planting
  );
};

const calculateUmurTanaman = (item) => {
  const directAge = firstFilled(
    item?.umur_tanaman,
    item?.umur_tanam,
    item?.umur_hari,
    item?.umur
  );

  if (isFilled(directAge)) {
    const number = Number(directAge);

    if (Number.isFinite(number) && number >= 0) {
      return Math.floor(number);
    }
  }

  const tanggalTanam = getTanggalTanam(item);

  if (!tanggalTanam) return null;

  const startDate = new Date(tanggalTanam);
  const today = new Date();

  if (Number.isNaN(startDate.getTime())) return null;

  startDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const diffMs = today.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays >= 0 ? diffDays : null;
};

const formatUmurTanaman = (umur) => {
  const number = Number(umur);

  if (!Number.isFinite(number)) return "-";

  return `${Math.floor(number)} Hari`;
};

const getKelembapanDesc = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) return "Belum ada data";
  if (number >= 85) return "Tinggi";
  if (number >= 55) return "Normal";

  return "Rendah";
};

const getCurahHujanDesc = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) return "Belum ada data";
  if (number >= 100) return "Tinggi";
  if (number >= 50) return "Sedang";
  if (number > 0) return "Rendah";

  return "Tidak Hujan";
};

const getCurahHujan24Jam = (ai, lingkungan) => {
  return firstFilled(
    ai?.cuaca?.curah_hujan_24_jam,
    ai?.cuaca?.curah_hujan_24h,
    ai?.cuaca?.hujan_24_jam,
    ai?.cuaca?.rain_24h,
    ai?.curah_hujan_24_jam,
    ai?.curah_hujan_24h,
    lingkungan?.curah_hujan_24_jam,
    lingkungan?.curah_hujan_24h,
    lingkungan?.hujan_24_jam,
    ai?.cuaca?.curah_hujan,
    ai?.curah_hujan,
    lingkungan?.curah_hujan,
    null
  );
};

const getCurahHujanSaatIni = (ai, lingkungan) => {
  return firstFilled(
    ai?.cuaca?.curah_hujan_saat_ini,
    ai?.cuaca?.hujan_saat_ini,
    ai?.cuaca?.precipitation_now,
    ai?.curah_hujan_saat_ini,
    lingkungan?.curah_hujan_saat_ini,
    lingkungan?.hujan_saat_ini,
    null
  );
};

const getCuacaText = (
  curahHujan24Jam,
  cuacaText = "",
  curahHujanSaatIni = null
) => {
  if (cuacaText && cuacaText !== "-") return cuacaText;

  const hujanSaatIni = Number(curahHujanSaatIni);

  if (Number.isFinite(hujanSaatIni) && hujanSaatIni > 0) {
    return "Hujan";
  }

  const total24Jam = Number(curahHujan24Jam);

  if (!Number.isFinite(total24Jam)) return "-";
  if (total24Jam >= 100) return "Basah";
  if (total24Jam > 0) return "Berawan";

  return "Cerah";
};

const formatNumber = (value, digit = 2) => {
  const number = Number(value || 0);

  return number.toLocaleString("id-ID", {
    minimumFractionDigits: digit,
    maximumFractionDigits: digit,
  });
};

const getLuasHa = (item) => {
  const luasHa = item?.luas_ha ?? item?.luasHa;

  if (isFilled(luasHa)) return Number(luasHa);

  const luasM2 = Number(item?.luas_m2 || item?.luas || 0);

  if (luasM2 > 20) return luasM2 / 10000;

  return luasM2;
};

const getOwnerId = (item) => {
  return (
    item?.user_id ||
    item?.petani_id ||
    item?.petaniId ||
    item?.id_petani ||
    item?.owner_id ||
    ""
  );
};

const normalizeLahanRow = (item) => {
  return {
    ...item,
    id: item.id || item.lahan_id,
    nama_lahan: item.nama_lahan || item.nama || item.nama_sawah || "Lahan",
    user_id: item.user_id || item.petani_id || item.petaniId || item.id_petani,
    petani_id: item.petani_id || item.user_id || item.petaniId || item.id_petani,
    nama_desa: item.nama_desa || item.desa || "-",
    nama_kecamatan: item.nama_kecamatan || item.kecamatan || "-",
    varietas: item.varietas || item.nama_varietas || "-",
    luas_ha: item.luas_ha ?? item.luasHa ?? item.luas ?? 0,
    lat: item.lat ?? item.latitude,
    lng: item.lng ?? item.longitude,
    tanggal_tanam: getTanggalTanam(item) || null,
    umur_tanaman: firstFilled(
      item.umur_tanaman,
      item.umur_tanam,
      item.umur_hari,
      item.umur
    ),
  };
};

const uniqueById = (rows) => {
  const map = new Map();

  rows.forEach((item) => {
    const normalized = normalizeLahanRow(item);

    if (!normalized.id) return;

    map.set(String(normalized.id), normalized);
  });

  return Array.from(map.values());
};

const getImagePath = (item) => {
  return (
    item?.foto_url ||
    item?.foto ||
    item?.gambar ||
    item?.image ||
    item?.foto_lahan ||
    item?.dokumentasi ||
    item?.thumbnail ||
    ""
  );
};

const getImageUrl = (itemOrValue, fallback = FALLBACK_IMAGE) => {
  const raw =
    typeof itemOrValue === "string" ? itemOrValue : getImagePath(itemOrValue);

  if (!raw) return fallback;

  const text = String(raw).trim().replaceAll("\\", "/");

  if (!text || text === "null" || text === "undefined" || text === "-") {
    return fallback;
  }

  if (
    text.startsWith("http://") ||
    text.startsWith("https://") ||
    text.startsWith("data:image") ||
    text.startsWith("blob:")
  ) {
    return text;
  }

  if (text.startsWith("/uploads")) {
    return `${BASE_NODE_URL}${text}`;
  }

  if (text.startsWith("uploads")) {
    return `${BASE_NODE_URL}/${text}`;
  }

  if (text.startsWith("/")) {
    return `${BASE_NODE_URL}${text}`;
  }

  return `${BASE_NODE_URL}/uploads/${text}`;
};

const getStaticMapImage = (item) => {
  const lat = item?.lat ?? item?.latitude;
  const lng = item?.lng ?? item?.longitude;

  if (!isFilled(lat) || !isFilled(lng)) {
    return MAP_FALLBACK;
  }

  const latNum = Number(lat);
  const lngNum = Number(lng);

  if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
    return MAP_FALLBACK;
  }

  return createMapPreviewSvg(latNum, lngNum, "Lokasi Lahan");
};

const getStatusTanaman = (item, ai) => {
  const raw = String(
    ai?.tingkat_risiko ||
      ai?.status_risiko ||
      ai?.kondisi_tanaman ||
      item?.status ||
      item?.status_lahan ||
      item?.kondisi_tanaman ||
      item?.status_kesehatan ||
      ""
  ).toLowerCase();

  if (
    raw.includes("tinggi") ||
    raw.includes("kritis") ||
    raw.includes("bahaya") ||
    raw.includes("sakit")
  ) {
    return {
      label: "Perlu Perhatian",
      color: "#dc2626",
      bg: "#fee2e2",
    };
  }

  if (raw.includes("sedang") || raw.includes("waspada")) {
    return {
      label: "Waspada",
      color: "#f59e0b",
      bg: "#fef3c7",
    };
  }

  return {
    label: "Sehat",
    color: "#16a34a",
    bg: "#dcfce7",
  };
};

const getRiskColor = (tingkatRisiko) => {
  if (tingkatRisiko === "Tinggi") return "#dc2626";
  if (tingkatRisiko === "Sedang") return "#f59e0b";
  return "#16a34a";
};

const getRiskBg = (tingkatRisiko) => {
  if (tingkatRisiko === "Tinggi") {
    return "linear-gradient(135deg, #fee2e2, #fef2f2)";
  }

  if (tingkatRisiko === "Sedang") {
    return "linear-gradient(135deg, #fef3c7, #fffbeb)";
  }

  return "linear-gradient(135deg, #dcfce7, #f0fdf4)";
};

const getRiskTextColor = (tingkatRisiko) => {
  if (tingkatRisiko === "Tinggi") return "#991b1b";
  if (tingkatRisiko === "Sedang") return "#92400e";
  return "#166534";
};

const getAktivitasIcon = (jenis = "") => {
  const text = String(jenis).toLowerCase();

  if (text.includes("pupuk")) return "♻";
  if (text.includes("semprot")) return "🧴";
  if (text.includes("irigasi")) return "💧";
  if (text.includes("tanam")) return "🌱";

  return "📌";
};

const getAktivitasIconStyle = (jenis = "") => {
  const text = String(jenis).toLowerCase();

  if (text.includes("irigasi")) return styles.historyIconBlue;

  return styles.historyIconGreen;
};

// =====================================================
// GRAFIK PERTUMBUHAN
// =====================================================
function MiniGrowthChart({ data = [] }) {
  const chartData =
    data.length > 0
      ? data.map((item) => ({
          label: item.label || item.tanggal_label || item.tanggal || "-",
          tinggi: Number(
            item.tinggi ||
              item.tinggi_tanaman ||
              item.tinggi_tanaman_cm ||
              0
          ),
          anakan: Number(item.anakan || item.jumlah_anakan || 0),
          lembap: Number(item.lembap || item.kelembapan || 0),
        }))
      : [{ label: "-", tinggi: 0, anakan: 0, lembap: 0 }];

  const width = 680;
  const height = 260;
  const padding = 34;
  const maxY = 100;

  const points = chartData.map((item, index) => {
    const x =
      padding +
      (index / Math.max(chartData.length - 1, 1)) * (width - padding * 2);

    return {
      x,
      tinggiY:
        height -
        padding -
        (Number(item.tinggi || 0) / maxY) * (height - padding * 2),
      anakanY:
        height -
        padding -
        (Number(item.anakan || 0) / maxY) * (height - padding * 2),
      lembapY:
        height -
        padding -
        (Number(item.lembap || 0) / maxY) * (height - padding * 2),
      label: item.label,
    };
  });

  const line = (key) =>
    points.map((point) => `${point.x},${point[key]}`).join(" ");

  return (
    <div style={styles.chartWrap}>
      <div style={styles.chartLegend}>
        <span style={styles.chartLegendItem}>
          <i style={{ ...styles.legendDot, background: "#16a34a" }} />
          Tinggi Tanaman
        </span>

        <span style={styles.chartLegendItem}>
          <i style={{ ...styles.legendDot, background: "#2563eb" }} />
          Jumlah Anakan
        </span>

        <span style={styles.chartLegendItem}>
          <i style={{ ...styles.legendDot, background: "#f59e0b" }} />
          Kelembapan
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={styles.chartSvg}
      >
        {[0, 25, 50, 75, 100].map((value) => {
          const y = height - padding - (value / maxY) * (height - padding * 2);

          return (
            <g key={value}>
              <line
                x1={padding}
                x2={width - padding}
                y1={y}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
              <text x="4" y={y + 4} fontSize="11" fill="#64748b">
                {value}
              </text>
              <text x={width - 30} y={y + 4} fontSize="11" fill="#64748b">
                {value}%
              </text>
            </g>
          );
        })}

        {points.map((point, index) => (
          <line
            key={index}
            x1={point.x}
            x2={point.x}
            y1={padding}
            y2={height - padding}
            stroke="#f1f5f9"
            strokeWidth="1"
          />
        ))}

        <polyline
          points={line("tinggiY")}
          fill="none"
          stroke="#16a34a"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <polyline
          points={line("anakanY")}
          fill="none"
          stroke="#2563eb"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <polyline
          points={line("lembapY")}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((point, index) => (
          <g key={index}>
            <circle cx={point.x} cy={point.tinggiY} r="4" fill="#16a34a" />
            <circle cx={point.x} cy={point.anakanY} r="4" fill="#2563eb" />
            <circle cx={point.x} cy={point.lembapY} r="4" fill="#f59e0b" />

            {index % 2 === 0 && (
              <text
                x={point.x - 16}
                y={height - 8}
                fontSize="11"
                fill="#475569"
              >
                {point.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

// =====================================================
// COMPONENT UTAMA
// =====================================================
export default function MonitoringTanaman() {
  const navigate = useNavigate();

  const [lahan, setLahan] = useState([]);
  const [selectedLahanId, setSelectedLahanId] = useState("");
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState({});

  const [growthData, setGrowthData] = useState([]);
  const [aktivitasData, setAktivitasData] = useState([]);
  const [lingkunganData, setLingkunganData] = useState({});

  const storedUser = getStoredUser();

  const userId =
    storedUser?.id ||
    localStorage.getItem("user_id") ||
    localStorage.getItem("petani_id");

  useEffect(() => {
    loadLahan();
  }, []);

  const selectedLahan = useMemo(() => {
    return (
      lahan.find((item) => Number(item.id) === Number(selectedLahanId)) ||
      lahan[0] ||
      null
    );
  }, [lahan, selectedLahanId]);

  useEffect(() => {
    if (selectedLahan?.id) {
      loadMonitoringDetail(selectedLahan.id);
    }
  }, [selectedLahan?.id]);

  const selectedAi = selectedLahan ? aiResult[selectedLahan.id] : null;
  const selectedLingkungan = selectedLahan
    ? lingkunganData[selectedLahan.id] || null
    : null;

  const statusTanaman = getStatusTanaman(selectedLahan, selectedAi);

  const heroImage = getImageUrl(selectedLahan, FALLBACK_IMAGE);
  const mapPreviewImage = getStaticMapImage(selectedLahan);

  const umurTanamanDariLahan = calculateUmurTanaman(selectedLahan);
  const umurTanaman =
    umurTanamanDariLahan ??
    selectedAi?.umur_tanaman ??
    selectedLingkungan?.umur_tanaman ??
    null;

  const kondisiTanaman = selectedAi?.kondisi_tanaman || statusTanaman.label;
  const risikoHama = selectedAi?.risiko_hama || "Belum dianalisis";
  const tingkatRisiko = selectedAi?.tingkat_risiko || "-";
  const skorRisiko = selectedAi?.skor_risiko ?? "-";
  const prediksiPanen = selectedAi?.prediksi_panen || "Klik Analisis AI";

  const suhu = selectedAi?.cuaca?.suhu ?? selectedLingkungan?.suhu ?? null;
  const kelembapan =
    selectedAi?.cuaca?.kelembapan ?? selectedLingkungan?.kelembapan ?? null;
  const curahHujan = getCurahHujan24Jam(selectedAi, selectedLingkungan);
  const curahHujanSaatIni = getCurahHujanSaatIni(
    selectedAi,
    selectedLingkungan
  );
  const cuacaText = getCuacaText(
    curahHujan,
    selectedAi?.cuaca?.kondisi || selectedLingkungan?.cuaca,
    curahHujanSaatIni
  );

  const rekomendasiAi =
    selectedAi?.rekomendasi?.length > 0
      ? selectedAi.rekomendasi
      : [
          "Klik Jalankan Analisis AI untuk mendapatkan rekomendasi.",
          "Data akan dihitung berdasarkan suhu, kelembapan, curah hujan 24 jam, umur tanaman, dan kondisi lahan.",
        ];

  const riskColor = getRiskColor(tingkatRisiko);
  const riskBg = getRiskBg(tingkatRisiko);
  const riskTextColor = getRiskTextColor(tingkatRisiko);

  const aiBoxMessage = selectedAi
    ? `Risiko ${risikoHama} berada pada tingkat ${tingkatRisiko} dengan skor ${skorRisiko}.`
    : "Jalankan analisis AI untuk melihat hasil Fuzzy Tsukamoto.";

  const handleRefreshData = async () => {
    await loadLahan();

    if (selectedLahan?.id) {
      await loadMonitoringDetail(selectedLahan.id);
    }
  };

  // =====================================================
  // LOAD SEMUA LAHAN PETANI
  // =====================================================
  async function loadLahan() {
    try {
      setLoading(true);

      const results = await Promise.allSettled([
        axios.get(`${API}/lahan`, {
          params: {
            petani_id: userId,
            user_id: userId,
          },
        }),

        axios.get(`${API}/lahan`),
      ]);

      const rawRows = results.flatMap((result) => {
        if (result.status !== "fulfilled") return [];
        return normalizeApiList(result.value.data);
      });

      const mergedRows = uniqueById(rawRows);

      const mineRows = mergedRows.filter((item) => {
        const ownerId = getOwnerId(item);

        if (!ownerId) return false;

        return String(ownerId) === String(userId);
      });

      const sortedRows = mineRows.sort((a, b) => Number(a.id) - Number(b.id));

      console.log("MONITORING LAHAN FINAL:", sortedRows);

      setLahan(sortedRows);

      if (sortedRows.length > 0) {
        setSelectedLahanId((prev) => {
          const stillExists = sortedRows.some(
            (item) => String(item.id) === String(prev)
          );

          return stillExists ? prev : String(sortedRows[0].id);
        });
      } else {
        setSelectedLahanId("");
      }
    } catch (err) {
      console.log("ERROR LOAD LAHAN:", err.response?.data || err.message);
      setLahan([]);
      setSelectedLahanId("");
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // LOAD MONITORING DETAIL
  // =====================================================
  async function loadMonitoringDetail(lahanId) {
    if (!lahanId) return;

    try {
      setGrowthData([]);
      setAktivitasData([]);

      const [pertumbuhanRes, aktivitasRes, lingkunganRes] =
        await Promise.allSettled([
          axios.get(`${API}/monitoring/pertumbuhan`, {
            params: { lahan_id: lahanId },
          }),
          axios.get(`${API}/monitoring/aktivitas`, {
            params: { lahan_id: lahanId },
          }),
          axios.get(`${API}/monitoring/lingkungan`, {
            params: { lahan_id: lahanId },
          }),
        ]);

      if (pertumbuhanRes.status === "fulfilled") {
        setGrowthData(normalizeApiList(pertumbuhanRes.value.data));
      } else {
        setGrowthData([]);
      }

      if (aktivitasRes.status === "fulfilled") {
        setAktivitasData(normalizeApiList(aktivitasRes.value.data));
      } else {
        setAktivitasData([]);
      }

      if (lingkunganRes.status === "fulfilled") {
        const payload = lingkunganRes.value.data?.data || null;

        setLingkunganData((prev) => ({
          ...prev,
          [lahanId]: payload,
        }));
      } else {
        setLingkunganData((prev) => ({
          ...prev,
          [lahanId]: null,
        }));
      }
    } catch (err) {
      console.log(
        "ERROR LOAD MONITORING DETAIL:",
        err.response?.data || err.message
      );
      setGrowthData([]);
      setAktivitasData([]);
      setLingkunganData((prev) => ({
        ...prev,
        [lahanId]: null,
      }));
    }
  }

  // =====================================================
  // ANALISIS AI
  // =====================================================
  const runAI = async (lahanId) => {
    if (!lahanId) return;

    try {
      setAiLoading(true);

      const res = await axios.post(`${API}/monitoring/analisis`, {
        lahan_id: lahanId,
      });

      const result = res.data?.data?.analisis;

      if (!result) {
        console.log("HASIL ANALISIS KOSONG:", res.data);
        return;
      }

      setAiResult((prev) => ({
        ...prev,
        [lahanId]: result,
      }));

      setLingkunganData((prev) => ({
        ...prev,
        [lahanId]: {
          ...(prev[lahanId] || {}),
          umur_tanaman: result.umur_tanaman,
          suhu: result.cuaca?.suhu,
          kelembapan: result.cuaca?.kelembapan,
          curah_hujan: getCurahHujan24Jam(result, prev[lahanId] || {}),
          curah_hujan_24_jam: getCurahHujan24Jam(result, prev[lahanId] || {}),
          curah_hujan_saat_ini: getCurahHujanSaatIni(
            result,
            prev[lahanId] || {}
          ),
          cuaca: result.cuaca?.kondisi,
          sumber: "analisis_ai",
        },
      }));
    } catch (err) {
      console.log("AI ERROR:", err.response?.data || err.message);
      alert("Gagal menjalankan analisis AI. Pastikan backend dan FastAPI aktif.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleChatPenyuluh = () => {
    if (!selectedLahan?.id) {
      alert("Pilih lahan terlebih dahulu sebelum konsultasi.");
      return;
    }

    navigate(`/petani/konsultasi?lahan_id=${selectedLahan.id}`);
  };

  if (loading) {
    return (
      <div style={styles.loadingPage}>
        <h3>Memuat monitoring tanaman...</h3>
      </div>
    );
  }

  if (lahan.length === 0) {
    return (
      <div style={styles.page}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>🌱 Monitoring Tanaman</h1>
            <p style={styles.subtitle}>AI + Cuaca + Lahan + Penyuluh System</p>
          </div>

          <button onClick={handleRefreshData} style={styles.refreshButton}>
            🔄 Refresh Data
          </button>
        </div>

        <div style={styles.emptyCard}>
          <h2>Belum ada lahan untuk dimonitor</h2>
          <p>
            Tambahkan data lahan terlebih dahulu agar fitur monitoring tanaman
            bisa menampilkan kondisi lahan berdasarkan akun petani yang login.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>🌱 Monitoring Tanaman (AI Smart Farming)</h1>
          <p style={styles.subtitle}>
            Menampilkan {lahan.length} lahan milik petani yang sedang login.
          </p>
        </div>

        <div style={styles.headerActions}>
          <select
            value={selectedLahan?.id || ""}
            onChange={(e) => setSelectedLahanId(e.target.value)}
            style={styles.selectLahan}
          >
            {lahan.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nama_lahan || `Lahan ${item.id}`}
              </option>
            ))}
          </select>

          <button onClick={handleRefreshData} style={styles.refreshButton}>
            🔄 Refresh Data
          </button>

          <PetaniNotificationBell />
        </div>
      </div>

      <div style={styles.lahanSwitcher}>
        {lahan.map((item) => {
          const active = String(item.id) === String(selectedLahan?.id);

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedLahanId(String(item.id))}
              style={{
                ...styles.lahanChip,
                ...(active ? styles.lahanChipActive : {}),
              }}
            >
              <strong>{item.nama_lahan || `Lahan ${item.id}`}</strong>
              <small>
                {formatNumber(getLuasHa(item), 2)} Ha · {item.varietas || "-"}
              </small>
            </button>
          );
        })}
      </div>

      <div style={styles.layout}>
        <main style={styles.mainContent}>
          <section
            style={{
              ...styles.heroCard,
              backgroundImage: `linear-gradient(90deg, rgba(4,47,46,.94), rgba(4,47,46,.62), rgba(4,47,46,.22)), url("${heroImage}")`,
            }}
          >
            <div style={styles.heroContent}>
              <div style={styles.heroTop}>
                <h2 style={styles.heroTitle}>
                  {selectedLahan?.nama_lahan || "Lahan Tanpa Nama"}
                </h2>

                <span
                  style={{
                    ...styles.healthBadge,
                    background: statusTanaman.bg,
                    color: statusTanaman.color,
                  }}
                >
                  ● {statusTanaman.label}
                </span>
              </div>

              <div style={styles.heroInfo}>
                <div style={styles.heroInfoRow}>
                  <span>📍</span>
                  <p>
                    Desa {selectedLahan?.nama_desa || "-"}, Kec.{" "}
                    {selectedLahan?.nama_kecamatan || "-"}
                  </p>
                </div>

                <div style={styles.heroInfoRow}>
                  <span>🧪</span>
                  <p>Luas Lahan</p>
                  <strong>{formatNumber(getLuasHa(selectedLahan), 3)} Ha</strong>
                </div>

                <div style={styles.heroInfoRow}>
                  <span>🌾</span>
                  <p>Varietas</p>
                  <strong>{selectedLahan?.varietas || "-"}</strong>
                </div>

                <div style={styles.heroInfoRow}>
                  <span>♻</span>
                  <p>Umur Tanaman</p>
                  <strong>{formatUmurTanaman(umurTanaman)}</strong>
                </div>

                <div style={styles.heroInfoRow}>
                  <span>🧠</span>
                  <p>Metode</p>
                  <strong>Fuzzy Tsukamoto</strong>
                </div>
              </div>
            </div>

            <div style={styles.mapPreview}>
              <img
                src={mapPreviewImage}
                alt="Peta lahan"
                style={styles.mapImage}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = MAP_FALLBACK;
                }}
              />

              <button
                type="button"
                style={styles.mapButton}
                onClick={() => navigate("/petani/peta-lahan")}
              >
                🗺 Lihat di Peta
              </button>
            </div>
          </section>

          <section style={styles.weatherSection}>
            <h3 style={styles.sectionTitle}>Kondisi Cuaca & Lingkungan</h3>

            <div style={styles.weatherGrid}>
              <InfoMetric
                icon="🌡"
                title="Suhu"
                value={`${formatMetric(suhu)}°C`}
                desc="Data Monitoring"
              />

              <InfoMetric
                icon="💧"
                title="Kelembapan"
                value={`${formatMetric(kelembapan, 0)}%`}
                desc={getKelembapanDesc(kelembapan)}
              />

              <InfoMetric
                icon="🌧"
                title="Curah Hujan 24 Jam"
                value={`${formatMetric(curahHujan, 1)} mm`}
                desc={getCurahHujanDesc(curahHujan)}
              />

              <InfoMetric
                icon="🌦"
                title="Hujan Saat Ini"
                value={
                  curahHujanSaatIni === null || curahHujanSaatIni === undefined
                    ? "-"
                    : `${formatMetric(curahHujanSaatIni, 1)} mm`
                }
                desc="Realtime"
              />

              <InfoMetric
                icon="☀"
                title="Cuaca"
                value={cuacaText}
                desc="Hari Ini"
                yellow
              />

              <InfoMetric
                icon="🧠"
                title="Skor Risiko"
                value={skorRisiko === "-" ? "-" : skorRisiko}
                desc="Fuzzy Tsukamoto"
              />
            </div>
          </section>

          <div style={styles.middleGrid}>
            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <h3>Grafik Pertumbuhan Tanaman</h3>

                <select style={styles.smallSelect}>
                  <option>
                    {selectedLahan?.nama_lahan || "Data Pertumbuhan"}
                  </option>
                </select>
              </div>

              <MiniGrowthChart data={growthData} />

              <div style={styles.successNote}>
                ✅ Data pertumbuhan ditampilkan berdasarkan lahan yang dipilih.
              </div>
            </section>

            <section style={styles.card}>
              <h3>🛡 Risiko Hama & Penyakit</h3>

              <div style={styles.detectionStatus}>
                <div
                  style={{
                    ...styles.checkCircle,
                    background:
                      tingkatRisiko === "Tinggi"
                        ? "#dc2626"
                        : tingkatRisiko === "Sedang"
                        ? "#f59e0b"
                        : "#16a34a",
                  }}
                >
                  {tingkatRisiko === "Tinggi" ? "!" : "✓"}
                </div>

                <h4>
                  {selectedAi
                    ? `${risikoHama} ${tingkatRisiko}`
                    : "Belum dianalisis"}
                </h4>

                <p>
                  {selectedAi
                    ? "berdasarkan suhu, kelembapan, curah hujan 24 jam, dan umur tanaman"
                    : "klik Jalankan Analisis AI terlebih dahulu"}
                </p>
              </div>
            </section>
          </div>

          <section style={styles.card}>
            <div style={styles.cardHeader}>
              <h3>Riwayat Aktivitas Lahan</h3>
              <button style={styles.linkButton}>Lihat Semua →</button>
            </div>

            <div style={styles.historyGrid}>
              {aktivitasData.length === 0 ? (
                <div style={styles.emptyHistory}>
                  Belum ada aktivitas untuk{" "}
                  {selectedLahan?.nama_lahan || "lahan ini"}.
                </div>
              ) : (
                aktivitasData.map((item) => (
                  <div key={item.id} style={styles.historyItem}>
                    <div style={getAktivitasIconStyle(item.jenis_aktivitas)}>
                      {getAktivitasIcon(item.jenis_aktivitas)}
                    </div>

                    <div>
                      <strong>{item.jenis_aktivitas}</strong>
                      <p>{item.keterangan || "-"}</p>
                      <small>{item.tanggal_label || "-"}</small>
                    </div>

                    <span>›</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </main>

        <aside style={styles.sidePanel}>
          <section style={styles.sideCard}>
            <h3>⚙️ Analisis AI</h3>

            <div style={styles.aiRows}>
              <div style={styles.aiRow}>
                <span>🌱 Kondisi Tanaman</span>
                <strong style={{ color: riskColor }}>{kondisiTanaman}</strong>
              </div>

              <div style={styles.aiRow}>
                <span>🐛 Risiko Hama</span>
                <strong style={{ color: riskColor }}>
                  {risikoHama}
                  {tingkatRisiko !== "-" ? ` (${tingkatRisiko})` : ""}
                </strong>
              </div>

              <div style={styles.aiRow}>
                <span>📊 Skor Risiko</span>
                <strong style={{ color: riskColor }}>
                  {skorRisiko === "-" ? "-" : skorRisiko}
                </strong>
              </div>

              <div style={styles.aiRow}>
                <span>🌾 Prediksi Panen</span>
                <strong style={{ color: riskColor }}>{prediksiPanen}</strong>
              </div>
            </div>

            <div
              style={{
                ...styles.aiSuccessBox,
                background: riskBg,
                color: riskTextColor,
              }}
            >
              <strong>{tingkatRisiko === "Tinggi" ? "!" : "✓"}</strong>
              <p>{aiBoxMessage}</p>
            </div>

            <button
              type="button"
              style={{
                ...styles.aiButton,
                opacity: aiLoading ? 0.75 : 1,
                cursor: aiLoading ? "not-allowed" : "pointer",
              }}
              onClick={() => runAI(selectedLahan?.id)}
              disabled={aiLoading}
            >
              {aiLoading ? "Menganalisis..." : "Jalankan Analisis AI"}
            </button>
          </section>

          <section style={styles.sideCard}>
            <h3>💡 Rekomendasi AI</h3>

            <div style={styles.recommendationList}>
              {rekomendasiAi.map((item, index) => (
                <div key={index} style={styles.recommendationItem}>
                  <span>✓</span>
                  <p>{item}</p>
                </div>
              ))}
            </div>
          </section>

          <section style={styles.sideCard}>
            <h3>👨‍🌾 Konsultasi Penyuluh</h3>

            <div style={styles.consultantBox}>
              <div style={styles.consultantAvatar}>👨‍🌾</div>

              <div>
                <strong>Pak Budi Santoso</strong>
                <p>Penyuluh Lapangan</p>
                <small>● Online</small>
              </div>
            </div>

            <div style={styles.consultantActions}>
              <button style={styles.chatButton} onClick={handleChatPenyuluh}>
                💬 Chat Penyuluh
              </button>

              <button style={styles.callButton} onClick={handleChatPenyuluh}>
                📞 Hubungi
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function InfoMetric({ icon, title, value, desc, yellow = false }) {
  return (
    <div style={styles.weatherCard}>
      <div style={yellow ? styles.weatherIconYellow : styles.weatherIconBlue}>
        {icon}
      </div>
      <div>
        <p>{title}</p>
        <h3>{value}</h3>
        <small>{desc}</small>
      </div>
    </div>
  );
}

// =====================================================
// STYLE
// =====================================================
const styles = {
  page: {
    minHeight: "100vh",
    padding: "24px 28px",
    background: "#f8fafc",
    color: "#111827",
    boxSizing: "border-box",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  loadingPage: {
    padding: 28,
    minHeight: "100vh",
    background: "#f8fafc",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 18,
    marginBottom: 14,
  },

  title: {
    margin: 0,
    fontSize: 30,
    fontWeight: 900,
  },

  subtitle: {
    margin: "6px 0 0",
    fontSize: 15,
    color: "#374151",
  },

  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  selectLahan: {
    height: 46,
    minWidth: 190,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    background: "#ffffff",
    padding: "0 12px",
    fontWeight: 700,
    outline: "none",
  },

  refreshButton: {
    height: 50,
    border: "none",
    borderRadius: 10,
    background: "#047857",
    color: "#ffffff",
    fontWeight: 850,
    padding: "0 20px",
    cursor: "pointer",
    boxShadow: "0 12px 28px rgba(4,120,87,.24)",
  },

  notification: {
    width: 48,
    height: 48,
    borderRadius: 999,
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    boxShadow: "0 8px 24px rgba(15,23,42,.08)",
    fontSize: 22,
  },

  notificationBadge: {
    position: "absolute",
    top: -5,
    right: -3,
    width: 20,
    height: 20,
    borderRadius: 999,
    background: "#ef4444",
    color: "#ffffff",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
  },

  lahanSwitcher: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 18,
  },

  lahanChip: {
    border: "1px solid #d1d5db",
    background: "#ffffff",
    borderRadius: 12,
    padding: "10px 14px",
    display: "grid",
    gap: 3,
    textAlign: "left",
    cursor: "pointer",
    minWidth: 180,
  },

  lahanChipActive: {
    border: "1px solid #16a34a",
    background: "#ecfdf5",
    color: "#047857",
  },

  layout: {
    display: "grid",
    gridTemplateColumns: "1fr 380px",
    gap: 18,
  },

  mainContent: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  sidePanel: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  heroCard: {
    minHeight: 280,
    borderRadius: 14,
    backgroundSize: "cover",
    backgroundPosition: "center",
    overflow: "hidden",
    position: "relative",
    display: "flex",
    justifyContent: "space-between",
    padding: 26,
    boxSizing: "border-box",
    color: "#ffffff",
    boxShadow: "0 14px 32px rgba(15,23,42,.12)",
  },

  heroContent: {
    maxWidth: 560,
    position: "relative",
    zIndex: 2,
  },

  heroTitle: {
    margin: 0,
    fontSize: 30,
    fontWeight: 900,
  },

  heroTop: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
  },

  healthBadge: {
    borderRadius: 999,
    padding: "8px 12px",
    fontWeight: 850,
    fontSize: 13,
  },

  heroInfo: {
    display: "grid",
    gap: 13,
  },

  heroInfoRow: {
    display: "grid",
    gridTemplateColumns: "24px 110px 1fr",
    alignItems: "center",
    gap: 8,
  },

  mapPreview: {
    width: 250,
    height: 168,
    borderRadius: 18,
    border: "2px solid rgba(255,255,255,.82)",
    overflow: "hidden",
    alignSelf: "flex-end",
    position: "relative",
    zIndex: 2,
    background: "#064e3b",
    boxShadow: "0 18px 38px rgba(0,0,0,.26)",
    flexShrink: 0,
  },

  mapImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },

  mapButton: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    height: 38,
    border: "1px solid rgba(255,255,255,.34)",
    borderRadius: 12,
    background:
      "linear-gradient(135deg, rgba(4,120,87,.94), rgba(6,78,59,.94))",
    color: "#ffffff",
    fontWeight: 850,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(0,0,0,.22)",
  },

  weatherSection: {
    background: "#ffffff",
    borderRadius: 14,
    padding: 18,
    boxShadow: "0 12px 30px rgba(15,23,42,.08)",
    border: "1px solid #edf2f7",
  },

  sectionTitle: {
    margin: "0 0 16px",
    fontSize: 16,
    fontWeight: 850,
  },

  weatherGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: 12,
  },

  weatherCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 14,
    display: "flex",
    alignItems: "center",
    gap: 12,
    boxShadow: "0 8px 18px rgba(15,23,42,.06)",
  },

  weatherIconBlue: {
    width: 48,
    height: 48,
    borderRadius: 999,
    background: "#eff6ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 28,
    flexShrink: 0,
  },

  weatherIconYellow: {
    width: 48,
    height: 48,
    borderRadius: 999,
    background: "#fffbeb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 28,
    flexShrink: 0,
  },

  middleGrid: {
    display: "grid",
    gridTemplateColumns: "1.7fr .8fr",
    gap: 16,
  },

  card: {
    background: "#ffffff",
    borderRadius: 14,
    padding: 18,
    boxShadow: "0 12px 30px rgba(15,23,42,.08)",
    border: "1px solid #edf2f7",
  },

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },

  smallSelect: {
    height: 38,
    border: "1px solid #d1d5db",
    borderRadius: 8,
    background: "#ffffff",
    padding: "0 10px",
  },

  chartWrap: {
    marginTop: 10,
  },

  chartLegend: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    fontSize: 12,
    marginBottom: 8,
    flexWrap: "wrap",
  },

  chartLegendItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },

  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    display: "inline-block",
  },

  chartSvg: {
    width: "100%",
    height: 260,
  },

  successNote: {
    background: "#ecfdf5",
    color: "#047857",
    padding: "12px 14px",
    borderRadius: 10,
    marginTop: 12,
  },

  detectionStatus: {
    textAlign: "center",
    padding: "20px 0 14px",
  },

  checkCircle: {
    width: 54,
    height: 54,
    borderRadius: 999,
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 32,
    margin: "0 auto 12px",
    fontWeight: 900,
  },

  historyGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
  },

  historyItem: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    boxShadow: "0 8px 18px rgba(15,23,42,.05)",
  },

  historyIconGreen: {
    width: 48,
    height: 48,
    borderRadius: 10,
    background: "#dcfce7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
    flexShrink: 0,
  },

  historyIconBlue: {
    width: 48,
    height: 48,
    borderRadius: 10,
    background: "#dbeafe",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
    flexShrink: 0,
  },

  emptyHistory: {
    gridColumn: "1 / -1",
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
    padding: 20,
    textAlign: "center",
    color: "#64748b",
    background: "#f8fafc",
  },

  linkButton: {
    border: "none",
    background: "transparent",
    color: "#047857",
    fontWeight: 800,
    cursor: "pointer",
  },

  sideCard: {
    background: "#ffffff",
    borderRadius: 14,
    padding: 20,
    boxShadow: "0 12px 30px rgba(15,23,42,.08)",
    border: "1px solid #edf2f7",
  },

  aiRows: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 16,
  },

  aiRow: {
    minHeight: 52,
    padding: "0 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid #e5e7eb",
    gap: 12,
  },

  aiSuccessBox: {
    borderRadius: 12,
    padding: 16,
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
  },

  aiButton: {
    width: "100%",
    height: 44,
    border: "none",
    borderRadius: 10,
    background: "#047857",
    color: "#ffffff",
    fontWeight: 850,
    marginTop: 16,
  },

  recommendationList: {
    display: "grid",
    gap: 0,
    marginTop: 12,
  },

  recommendationItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "12px 0",
    borderBottom: "1px solid #e5e7eb",
  },

  consultantBox: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    marginTop: 18,
  },

  consultantAvatar: {
    width: 72,
    height: 72,
    borderRadius: 999,
    background: "#dcfce7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 34,
    flexShrink: 0,
  },

  consultantActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginTop: 18,
  },

  chatButton: {
    height: 44,
    border: "none",
    borderRadius: 8,
    background: "#047857",
    color: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
  },

  callButton: {
    height: 44,
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    background: "#ffffff",
    color: "#334155",
    fontWeight: 800,
    cursor: "pointer",
  },

  emptyCard: {
    background: "#ffffff",
    borderRadius: 16,
    padding: 28,
    border: "1px solid #e5e7eb",
    boxShadow: "0 12px 30px rgba(15,23,42,.08)",
  },
};