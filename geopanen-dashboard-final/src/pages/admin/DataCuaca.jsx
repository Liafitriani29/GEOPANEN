import { useEffect, useMemo, useState } from "react";
import api from "../../services/api";

import {
  RefreshCcw,
  Bell,
  ChevronDown,
  Map as MapIcon,
  Thermometer,
  CloudRain,
  Droplets,
  Wind,
  AlertTriangle,
  Info,
  Settings,
  CalendarDays,
  Maximize2,
} from "lucide-react";

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

const UPDATE_INTERVAL_MS = 5 * 60 * 1000;
const TOTAL_KECAMATAN_SUKOHARJO = 12;

const SUKOHARJO_CENTER = [-7.676, 110.835];

const SUKOHARJO_BOUNDS = [
  [-7.86, 110.66],
  [-7.49, 111.0],
];

const KECAMATAN_SUKOHARJO = [
  "Kartasura",
  "Gatak",
  "Baki",
  "Grogol",
  "Mojolaban",
  "Polokarto",
  "Bendosari",
  "Nguter",
  "Sukoharjo",
  "Bulu",
  "Tawangsari",
  "Weru",
];

const KECAMATAN_COORDS = {
  Kartasura: [-7.551, 110.737],
  Gatak: [-7.601, 110.704],
  Baki: [-7.619, 110.772],
  Grogol: [-7.596, 110.82],
  Mojolaban: [-7.585, 110.867],
  Polokarto: [-7.621, 110.927],
  Bendosari: [-7.685, 110.834],
  Nguter: [-7.742, 110.885],
  Sukoharjo: [-7.679, 110.841],
  Bulu: [-7.754, 110.778],
  Tawangsari: [-7.739, 110.804],
  Weru: [-7.806, 110.751],
};

const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const normalizeApiList = (payload) => {
  const data = payload?.data ?? payload;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.cuaca)) return data.cuaca;
  if (Array.isArray(data?.per_kecamatan)) return data.per_kecamatan;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.results)) return data.results;

  if (data && typeof data === "object") return [data];

  return [];
};

const getInitial = (value) => {
  const text = String(value || "A").trim();
  return text.charAt(0).toUpperCase();
};

const toNumber = (value, fallback = 0) => {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : fallback;
};

const formatNumber = (value, digit = 1) => {
  return Number(value || 0).toLocaleString("id-ID", {
    minimumFractionDigits: digit,
    maximumFractionDigits: digit,
  });
};

const formatDateTime = (value) => {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const formatTime = (value) => {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) return "-";

  return `${date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  })} WIB`;
};

const formatShortDate = (value) => {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
  });
};

const seededRandom = (seed) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

const getKecamatan = (item) => {
  return (
    item?.nama_kecamatan ||
    item?.kecamatan ||
    item?.wilayah ||
    item?.area ||
    item?.nama ||
    "-"
  );
};

const getKota = (item) => {
  return item?.kota || item?.nama_kota || item?.kabupaten || "Sukoharjo";
};

const getSuhu = (item) => {
  return toNumber(item?.suhu ?? item?.temperature ?? item?.temp, 0);
};

const getCurahHujan = (item) => {
  return toNumber(
    item?.curah_hujan ??
      item?.curahHujan ??
      item?.rainfall ??
      item?.rain ??
      item?.precipitation,
    0
  );
};

const getKelembaban = (item) => {
  return toNumber(
    item?.kelembaban ??
      item?.kelembaban_udara ??
      item?.humidity ??
      item?.rh,
    0
  );
};

const getAngin = (item) => {
  return toNumber(
    item?.kecepatan_angin ??
      item?.angin ??
      item?.wind_speed ??
      item?.windSpeed,
    0
  );
};

const getJumlahPetani = (item) => {
  return toNumber(item?.jumlah_petani ?? item?.total_petani ?? item?.petani, 0);
};

const getLuasLahan = (item) => {
  return toNumber(
    item?.luas_lahan ??
      item?.total_luas ??
      item?.luas_ha ??
      item?.luas,
    0
  );
};

const getUpdatedAt = (item) => {
  return (
    item?.updated_at ||
    item?.waktu ||
    item?.timestamp ||
    item?.time ||
    item?.created_at ||
    null
  );
};

const getStatusCuaca = (item) => {
  const raw = String(
    item?.status_cuaca ||
      item?.status ||
      item?.risiko ||
      item?.level ||
      ""
  ).toLowerCase();

  const rain = getCurahHujan(item);
  const humidity = getKelembaban(item);
  const wind = getAngin(item);

  if (
    raw.includes("risiko_tinggi") ||
    raw.includes("risiko tinggi") ||
    raw.includes("tinggi") ||
    rain >= 70 ||
    humidity >= 92 ||
    wind >= 25
  ) {
    return "risiko_tinggi";
  }

  if (raw.includes("risiko") || rain >= 45 || humidity >= 88 || wind >= 18) {
    return "risiko";
  }

  if (raw.includes("waspada") || rain >= 20 || humidity >= 84 || wind >= 12) {
    return "waspada";
  }

  return "aman";
};

const getStatusLabel = (item) => {
  const status = getStatusCuaca(item);

  if (status === "risiko_tinggi") return "Risiko Tinggi";
  if (status === "risiko") return "Risiko";
  if (status === "waspada") return "Waspada";

  return "Aman";
};

const getStatusStyle = (item) => {
  const status = getStatusCuaca(item);

  if (status === "risiko_tinggi" || status === "risiko") {
    return {
      background: "#fee2e2",
      color: "#ef4444",
      border: "1px solid #fecaca",
    };
  }

  if (status === "waspada") {
    return {
      background: "#fef3c7",
      color: "#d97706",
      border: "1px solid #fde68a",
    };
  }

  return {
    background: "#dcfce7",
    color: "#059669",
    border: "1px solid #bbf7d0",
  };
};

const getRiskColor = (item) => {
  const status = getStatusCuaca(item);

  if (status === "risiko_tinggi" || status === "risiko") return "#ef4444";
  if (status === "waspada") return "#f59e0b";

  return "#16a34a";
};

const getCircleRadius = (item) => {
  const rain = getCurahHujan(item);

  if (rain >= 70) return 19;
  if (rain >= 45) return 16;
  if (rain >= 20) return 13;

  return 10;
};

const buildFrontendFallback = () => {
  const seed = Math.floor(Date.now() / (5 * 60 * 1000));

  return KECAMATAN_SUKOHARJO.map((nama, index) => {
    const r1 = seededRandom(seed + index * 17);
    const r2 = seededRandom(seed + index * 31);
    const r3 = seededRandom(seed + index * 47);

    const baseRain =
      nama === "Weru"
        ? 76
        : nama === "Nguter"
        ? 48
        : nama === "Polokarto"
        ? 39
        : nama === "Tawangsari"
        ? 31
        : 8 + index * 1.4;

    const suhu = Number((28.4 + r1 * 2.2).toFixed(1));
    const curah_hujan = Number(Math.max(0, baseRain + r2 * 12 - 4).toFixed(1));
    const kelembaban = Number(
      Math.min(96, 72 + curah_hujan / 2.5 + r3 * 5).toFixed(0)
    );
    const kecepatan_angin = Number((4 + r2 * 7).toFixed(1));

    return {
      id: index + 1,
      nama_kecamatan: nama,
      kota: "Sukoharjo",
      suhu,
      curah_hujan,
      kelembaban,
      kecepatan_angin,
      jumlah_petani: 0,
      luas_lahan: 0,
      updated_at: new Date().toISOString(),
    };
  });
};

const buildWarnings = (weatherList) => {
  const tinggi = weatherList.filter(
    (item) =>
      getStatusCuaca(item) === "risiko_tinggi" ||
      getStatusCuaca(item) === "risiko"
  );

  const waspada = weatherList.filter(
    (item) => getStatusCuaca(item) === "waspada"
  );

  const result = [];

  if (tinggi.length > 0) {
    result.push({
      type: "danger",
      title: "Hujan Lebat",
      description: `Curah hujan tinggi terdeteksi di Kecamatan ${tinggi
        .slice(0, 2)
        .map(getKecamatan)
        .join(" dan ")}.`,
      time: formatTime(getUpdatedAt(tinggi[0])),
    });
  }

  if (waspada.length > 0) {
    result.push({
      type: "warning",
      title: "Waspada Banjir",
      description: `Potensi genangan di wilayah Kec. ${waspada
        .slice(0, 2)
        .map(getKecamatan)
        .join(", ")}.`,
      time: formatTime(getUpdatedAt(waspada[0])),
    });
  }

  result.push({
    type: "info",
    title: "Informasi",
    description:
      "Data cuaca digunakan untuk mendukung prediksi panen dan rekomendasi tanam.",
    time: formatTime(new Date()),
  });

  return result;
};

export default function DataCuaca() {
  const currentUser = useMemo(() => getCurrentUser(), []);
  const appVersion = import.meta.env.VITE_APP_VERSION || "1.0.0";

  const [data, setData] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedWilayah, setSelectedWilayah] = useState("Kabupaten Sukoharjo");
  const [notifCount, setNotifCount] = useState(0);
  const [sourceStatus, setSourceStatus] = useState("Memuat");
  const [sourceName, setSourceName] = useState("GeoPanen Weather Service");

  const fetchNotifCount = async () => {
    try {
      const res = await api.get("/admin/notifikasi/unread-count");
      setNotifCount(Number(res.data?.count || 0));
    } catch {
      setNotifCount(0);
    }
  };

  const normalizeWeather = (list) => {
    return list.map((item, index) => ({
      ...item,
      id: item?.id || index + 1,
      nama_kecamatan:
        getKecamatan(item) === "-"
          ? KECAMATAN_SUKOHARJO[index] || `Wilayah ${index + 1}`
          : getKecamatan(item),
      kota: getKota(item),
      suhu: getSuhu(item),
      curah_hujan: getCurahHujan(item),
      kelembaban: getKelembaban(item),
      kecepatan_angin: getAngin(item),
      status_cuaca: getStatusCuaca(item),
      updated_at: getUpdatedAt(item) || new Date().toISOString(),
    }));
  };

  const updateHistory = (weatherList, date = new Date()) => {
    setHistory((prev) => {
      const next = [
        ...prev,
        {
          time: date.toISOString(),
          label: formatShortDate(date),
          items: weatherList.map((item) => ({
            kecamatan: getKecamatan(item),
            curah_hujan: getCurahHujan(item),
          })),
        },
      ];

      return next.slice(-7);
    });
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      const res = await api.get("/admin/cuaca");
      const list = normalizeApiList(res.data);
      const normalized = normalizeWeather(list);

      if (normalized.length === 0) {
        const fallback = normalizeWeather(buildFrontendFallback());
        const now = new Date();

        setData(fallback);
        setSourceStatus("Fallback");
        setSourceName("GeoPanen Local Fallback");
        setLastUpdated(now);
        updateHistory(fallback, now);
      } else {
        const now = new Date(res.data?.updated_at || new Date());

        setData(normalized);
        setSourceStatus("Terhubung");
        setSourceName(res.data?.source || "GeoPanen Weather Service");
        setLastUpdated(now);
        updateHistory(normalized, now);
      }

      await fetchNotifCount();
    } catch (err) {
      console.log("FETCH CUACA ERROR:", err.response?.data || err.message);

      const fallback = normalizeWeather(buildFrontendFallback());
      const now = new Date();

      setData(fallback);
      setLastUpdated(now);
      setSourceStatus("Fallback");
      setSourceName("GeoPanen Local Fallback");
      updateHistory(fallback, now);

      await fetchNotifCount();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!autoUpdate) return undefined;

    const interval = setInterval(() => {
      fetchData();
    }, UPDATE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [autoUpdate]);

  const displayData = useMemo(() => {
    if (selectedWilayah === "Kabupaten Sukoharjo") return data;

    return data.filter(
      (item) =>
        String(getKecamatan(item)).toLowerCase() ===
        String(selectedWilayah).toLowerCase()
    );
  }, [data, selectedWilayah]);

  const stats = useMemo(() => {
    const total = displayData.length;
    const safeTotal = total || 1;

    const avgTemp =
      displayData.reduce((sum, item) => sum + getSuhu(item), 0) / safeTotal;

    const avgRain =
      displayData.reduce((sum, item) => sum + getCurahHujan(item), 0) /
      safeTotal;

    const avgHumidity =
      displayData.reduce((sum, item) => sum + getKelembaban(item), 0) /
      safeTotal;

    const avgWind =
      displayData.reduce((sum, item) => sum + getAngin(item), 0) / safeTotal;

    const risikoTinggi = displayData.filter(
      (item) =>
        getStatusCuaca(item) === "risiko_tinggi" ||
        getStatusCuaca(item) === "risiko"
    ).length;

    const aman = displayData.filter(
      (item) => getStatusCuaca(item) === "aman"
    ).length;

    const waspada = displayData.filter(
      (item) => getStatusCuaca(item) === "waspada"
    ).length;

    return {
      total,
      avgTemp,
      avgRain,
      avgHumidity,
      avgWind,
      risikoTinggi,
      waspada,
      aman,
      monitored: total,
      target:
        selectedWilayah === "Kabupaten Sukoharjo"
          ? Math.max(TOTAL_KECAMATAN_SUKOHARJO, total)
          : 1,
    };
  }, [displayData, selectedWilayah]);

  const warnings = useMemo(() => buildWarnings(displayData), [displayData]);

  const impact = useMemo(() => {
    const groups = {
      risiko: {
        label: "Risiko Tinggi",
        count: 0,
        petani: 0,
        luas: 0,
        color: "#ef4444",
        bg: "#fef2f2",
      },
      waspada: {
        label: "Waspada",
        count: 0,
        petani: 0,
        luas: 0,
        color: "#d97706",
        bg: "#fffbeb",
      },
      aman: {
        label: "Aman",
        count: 0,
        petani: 0,
        luas: 0,
        color: "#059669",
        bg: "#f0fdf4",
      },
    };

    displayData.forEach((item) => {
      const status = getStatusCuaca(item);
      const key =
        status === "risiko_tinggi" || status === "risiko"
          ? "risiko"
          : status === "waspada"
          ? "waspada"
          : "aman";

      groups[key].count += 1;
      groups[key].petani += getJumlahPetani(item);
      groups[key].luas += getLuasLahan(item);
    });

    return groups;
  }, [displayData]);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Monitoring Cuaca (Realtime)</h1>
          <p style={styles.subtitle}>
            Pantau kondisi cuaca terkini di seluruh kecamatan secara realtime
            untuk mendukung prediksi panen dan rekomendasi.
          </p>
        </div>

        <div style={styles.headerRight}>
          <select
            value={selectedWilayah}
            onChange={(e) => setSelectedWilayah(e.target.value)}
            style={styles.locationSelect}
          >
            <option value="Kabupaten Sukoharjo">Kabupaten Sukoharjo</option>

            {KECAMATAN_SUKOHARJO.map((item) => (
              <option key={item} value={item}>
                Kecamatan {item}
              </option>
            ))}
          </select>

          <button
            type="button"
            style={styles.autoUpdateBtn}
            onClick={() => setAutoUpdate((prev) => !prev)}
          >
            <RefreshCcw size={18} />

            <div>
              <strong>Auto Update</strong>
              <span>{autoUpdate ? "5 menit sekali" : "Nonaktif"}</span>
            </div>

            <span
              style={{
                ...styles.onlineDot,
                background: autoUpdate ? "#16a34a" : "#94a3b8",
              }}
            />
          </button>

          <button type="button" style={styles.iconBell}>
            <Bell size={21} />
            {notifCount > 0 && <span style={styles.bellBadge}>{notifCount}</span>}
          </button>

          <div style={styles.adminProfile}>
            <div style={styles.adminAvatar}>
              {getInitial(currentUser?.nama || "A")}
            </div>

            <div>
              <strong>{currentUser?.nama || "Admin"}</strong>
              <span>{currentUser?.role || "Super Admin"}</span>
            </div>

            <ChevronDown size={16} color="#64748b" />
          </div>

          <div style={styles.dateBox}>
            <CalendarDays size={18} />

            <div>
              <strong>{formatDateTime(lastUpdated)}</strong>
              <span>{formatTime(lastUpdated)}</span>
            </div>
          </div>
        </div>
      </header>

      <section style={styles.statsGrid}>
        <StatCard
          icon={<Thermometer size={34} />}
          iconBoxStyle={styles.redIconBox}
          label="Rata-rata Suhu"
          value={`${formatNumber(stats.avgTemp, 1)} °C`}
          note="Data realtime"
          noteColor="#ef4444"
        />

        <StatCard
          icon={<CloudRain size={34} />}
          iconBoxStyle={styles.blueIconBox}
          label="Curah Hujan Hari Ini"
          value={`${formatNumber(stats.avgRain, 1)} mm`}
          note="Rata-rata wilayah"
          noteColor="#2563eb"
        />

        <StatCard
          icon={<Droplets size={34} />}
          iconBoxStyle={styles.cyanIconBox}
          label="Kelembaban Udara"
          value={`${formatNumber(stats.avgHumidity, 0)} %`}
          note="Rata-rata wilayah"
          noteColor="#059669"
        />

        <StatCard
          icon={<Wind size={34} />}
          iconBoxStyle={styles.purpleIconBox}
          label="Kecepatan Angin"
          value={`${formatNumber(stats.avgWind, 1)} km/jam`}
          note="Rata-rata wilayah"
          noteColor="#ef4444"
        />

        <StatCard
          icon={<AlertTriangle size={34} />}
          iconBoxStyle={styles.orangeIconBox}
          label="Kecamatan Risiko Tinggi"
          value={stats.risikoTinggi}
          note="Perlu perhatian khusus"
          noteColor="#475569"
        />

        <StatCard
          icon={<MapIcon size={34} />}
          iconBoxStyle={styles.greenIconBox}
          label="Kecamatan Terpantau"
          value={`${stats.monitored} / ${stats.target}`}
          note={`${
            stats.target > 0
              ? ((stats.monitored / stats.target) * 100).toFixed(0)
              : 0
          }% wilayah terpantau`}
          noteColor="#059669"
        />
      </section>

      <main style={styles.mainGrid}>
        <section style={styles.mapCard}>
          <CardHeader
            title="Peta Sebaran Cuaca per Kecamatan"
            rightIcon={<Maximize2 size={18} />}
          />

          <WeatherMap
            data={displayData.length ? displayData : data}
            loading={loading}
          />

          <div style={styles.legend}>
            <LegendItem
              color="#16a34a"
              title="Aman"
              desc="Curah hujan rendah"
            />
            <LegendItem
              color="#f59e0b"
              title="Waspada"
              desc="Curah hujan sedang"
            />
            <LegendItem
              color="#ef4444"
              title="Risiko Tinggi"
              desc="Curah hujan tinggi"
            />
          </div>
        </section>

        <section style={styles.tableCard}>
          <CardHeader title="Data Cuaca per Kecamatan (Hari Ini)" />

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Kecamatan</th>
                  <th style={styles.th}>Suhu (°C)</th>
                  <th style={styles.th}>Curah Hujan (mm)</th>
                  <th style={styles.th}>Kelembaban (%)</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={5} style={styles.emptyCell}>
                      Loading data cuaca...
                    </td>
                  </tr>
                )}

                {!loading && displayData.length === 0 && (
                  <tr>
                    <td colSpan={5} style={styles.emptyCell}>
                      Data cuaca tidak tersedia.
                    </td>
                  </tr>
                )}

                {!loading &&
                  displayData.slice(0, 8).map((item, index) => (
                    <tr key={item.id || index} style={styles.tr}>
                      <td style={styles.td}>{getKecamatan(item)}</td>
                      <td style={styles.td}>{formatNumber(getSuhu(item), 1)}</td>
                      <td style={styles.td}>
                        <strong>{formatNumber(getCurahHujan(item), 1)}</strong>
                      </td>
                      <td style={styles.td}>
                        {formatNumber(getKelembaban(item), 0)}
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.statusPill,
                            ...getStatusStyle(item),
                          }}
                        >
                          {getStatusLabel(item)}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <button type="button" style={styles.fullButton} onClick={fetchData}>
            Lihat Semua Kecamatan →
          </button>
        </section>

        <aside style={styles.warningCard}>
          <CardHeader
            title="Peringatan Dini"
            titleIcon={<AlertTriangle size={18} color="#f97316" />}
          />

          <div style={styles.warningList}>
            {warnings.map((item, index) => (
              <WarningItem key={index} item={item} />
            ))}
          </div>

          <button type="button" style={styles.fullButton}>
            Lihat Semua Peringatan →
          </button>
        </aside>

        <section style={styles.chartCard}>
          <CardHeader
            title="Grafik Tren Curah Hujan (7 Update Terakhir)"
            rightIcon={<Maximize2 size={18} />}
          />

          <RainTrendChart history={history} data={displayData} />
        </section>

        <section style={styles.impactCard}>
          <CardHeader title="Dampak Cuaca ke Pertanian" />

          <div style={styles.impactGrid}>
            <ImpactBox item={impact.risiko} />
            <ImpactBox item={impact.waspada} />
            <ImpactBox item={impact.aman} />
          </div>

          <button type="button" style={styles.fullButton}>
            Lihat Analisis Lengkap →
          </button>
        </section>

        <aside style={styles.sourceCard}>
          <CardHeader title="Sumber Data Cuaca" titleIcon={<Info size={18} />} />

          <div style={styles.sourceRows}>
            <SourceRow label="Sumber" value={sourceName} />
            <SourceRow label="Update Terakhir" value={formatTime(lastUpdated)} />
            <SourceRow
              label="Status"
              value={sourceStatus}
              badge={sourceStatus === "Terhubung"}
            />
            <SourceRow label="Interval Update" value="5 menit" />
          </div>

          <button type="button" style={styles.settingsBtn} onClick={fetchData}>
            <Settings size={17} />
            Refresh Sumber Data
          </button>
        </aside>
      </main>

      <div style={styles.infoBanner}>
        <Info size={18} />
        <span>
          Data cuaca digunakan untuk AI Prediksi Panen, Rekomendasi Tanam, dan
          Analisis Risiko. Jika API luar gagal, sistem memakai fallback internal
          agar dashboard tetap berjalan.
        </span>
      </div>

      <footer style={styles.footer}>
        <span>© 2026 GeoPanen. All rights reserved.</span>
        <span>Versi {appVersion}</span>
      </footer>
    </div>
  );
}

function StatCard({ icon, iconBoxStyle, label, value, note, noteColor }) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statIcon, ...iconBoxStyle }}>{icon}</div>

      <div>
        <p style={styles.statLabel}>{label}</p>
        <h2 style={styles.statValue}>{value}</h2>
        <span style={{ ...styles.statNote, color: noteColor }}>{note}</span>
      </div>
    </div>
  );
}

function CardHeader({ title, titleIcon, rightIcon }) {
  return (
    <div style={styles.cardHeader}>
      <div style={styles.cardTitleWrap}>
        {titleIcon}
        <h3>{title}</h3>
        <Info size={15} color="#94a3b8" />
      </div>

      {rightIcon && (
        <button type="button" style={styles.cardIconBtn}>
          {rightIcon}
        </button>
      )}
    </div>
  );
}

function MapResizeWatcher({ dataKey }) {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 120);

    return () => clearTimeout(timer);
  }, [map, dataKey]);

  return null;
}

function WeatherMap({ data, loading }) {
  const itemMap = new globalThis.Map();

  data.forEach((item) => {
    itemMap.set(String(getKecamatan(item)).toLowerCase(), item);
  });

  const points = KECAMATAN_SUKOHARJO.map((nama) => {
    const item =
      itemMap.get(String(nama).toLowerCase()) || {
        nama_kecamatan: nama,
        curah_hujan: 0,
        suhu: 0,
        kelembaban: 0,
        kecepatan_angin: 0,
        status_cuaca: "aman",
      };

    return {
      nama,
      item,
      position: KECAMATAN_COORDS[nama],
    };
  });

  return (
    <div style={styles.mapArea}>
      {loading ? (
        <div style={styles.mapLoading}>Memuat peta cuaca...</div>
      ) : (
        <MapContainer
          center={SUKOHARJO_CENTER}
          zoom={11}
          minZoom={10}
          maxZoom={16}
          maxBounds={SUKOHARJO_BOUNDS}
          style={styles.leafletMap}
          scrollWheelZoom
        >
          <MapResizeWatcher dataKey={points.length} />

          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {points.map(({ nama, item, position }) => {
            const color = getRiskColor(item);
            const radius = getCircleRadius(item);

            return (
              <CircleMarker
                key={nama}
                center={position}
                radius={radius}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.72,
                  weight: 3,
                }}
              >
                <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                  <strong>{nama}</strong>
                </Tooltip>

                <Popup>
                  <div style={{ minWidth: 170 }}>
                    <strong>Kecamatan {nama}</strong>
                    <br />
                    Status: <b>{getStatusLabel(item)}</b>
                    <br />
                    Suhu: {formatNumber(getSuhu(item), 1)} °C
                    <br />
                    Curah hujan: {formatNumber(getCurahHujan(item), 1)} mm
                    <br />
                    Kelembaban: {formatNumber(getKelembaban(item), 0)}%
                    <br />
                    Angin: {formatNumber(getAngin(item), 1)} km/jam
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      )}
    </div>
  );
}

function LegendItem({ color, title, desc }) {
  return (
    <div style={styles.legendItem}>
      <span style={{ ...styles.legendDot, background: color }} />
      <div>
        <strong>{title}</strong>
        <p>{desc}</p>
      </div>
    </div>
  );
}

function WarningItem({ item }) {
  const config = {
    danger: {
      bg: "#fef2f2",
      border: "#fecaca",
      color: "#ef4444",
      icon: <AlertTriangle size={17} />,
    },
    warning: {
      bg: "#fffbeb",
      border: "#fde68a",
      color: "#d97706",
      icon: <AlertTriangle size={17} />,
    },
    info: {
      bg: "#eff6ff",
      border: "#bfdbfe",
      color: "#2563eb",
      icon: <Info size={17} />,
    },
  };

  const style = config[item.type] || config.info;

  return (
    <div
      style={{
        ...styles.warningItem,
        background: style.bg,
        borderColor: style.border,
      }}
    >
      <div style={{ ...styles.warningTitle, color: style.color }}>
        {style.icon}
        <strong>{item.title}</strong>
      </div>

      <p>{item.description}</p>
      <span>{item.time}</span>
    </div>
  );
}

function RainTrendChart({ history, data }) {
  const labels =
    history.length > 0
      ? history.map((item) => item.label)
      : [formatShortDate(new Date())];

  const kecamatanList =
    data.length > 0
      ? data.slice(0, 5).map((item) => getKecamatan(item))
      : KECAMATAN_SUKOHARJO.slice(0, 5);

  const series = kecamatanList.map((nama, index) => {
    const values =
      history.length > 0
        ? history.map((record) => {
            const found = record.items.find(
              (item) =>
                String(item.kecamatan).toLowerCase() ===
                String(nama).toLowerCase()
            );

            return found ? Number(found.curah_hujan || 0) : 0;
          })
        : [data[index] ? getCurahHujan(data[index]) : 0];

    return {
      name: nama,
      values,
      color: ["#ef4444", "#f97316", "#eab308", "#16a34a", "#2563eb"][index],
    };
  });

  const maxValue = Math.max(
    10,
    ...series.flatMap((item) => item.values.map((value) => Number(value || 0)))
  );

  const width = 620;
  const height = 210;
  const padding = 34;

  const getX = (idx, total) => {
    if (total <= 1) return padding;
    return padding + (idx / (total - 1)) * (width - padding * 2);
  };

  const getY = (value) => {
    return (
      height -
      padding -
      (Number(value || 0) / maxValue) * (height - padding * 2)
    );
  };

  return (
    <div style={styles.chartWrap}>
      <svg viewBox={`0 0 ${width} ${height}`} style={styles.chartSvg}>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
          const y = padding + ratio * (height - padding * 2);

          return (
            <g key={index}>
              <line
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="#e5e7eb"
              />
              <text x={4} y={y + 4} fill="#64748b" fontSize="11">
                {Math.round(maxValue * (1 - ratio))}
              </text>
            </g>
          );
        })}

        {series.map((line) => {
          const points = line.values
            .map((value, idx) => `${getX(idx, line.values.length)},${getY(value)}`)
            .join(" ");

          return (
            <g key={line.name}>
              <polyline
                points={points}
                fill="none"
                stroke={line.color}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {line.values.map((value, idx) => (
                <circle
                  key={idx}
                  cx={getX(idx, line.values.length)}
                  cy={getY(value)}
                  r="4"
                  fill={line.color}
                />
              ))}
            </g>
          );
        })}

        {labels.map((label, idx) => (
          <text
            key={idx}
            x={getX(idx, labels.length)}
            y={height - 6}
            textAnchor="middle"
            fill="#64748b"
            fontSize="11"
          >
            {label}
          </text>
        ))}
      </svg>

      <div style={styles.chartLegend}>
        {series.map((line) => (
          <span key={line.name}>
            <i
              style={{
                background: line.color,
                width: 8,
                height: 8,
                borderRadius: 999,
                display: "inline-block",
              }}
            />
            {line.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function ImpactBox({ item }) {
  return (
    <div
      style={{
        ...styles.impactBox,
        background: item.bg,
        borderColor: `${item.color}33`,
      }}
    >
      <strong style={{ color: item.color }}>{item.label}</strong>
      <h2 style={{ color: item.color }}>{item.count}</h2>
      <p>Kecamatan</p>

      <div style={styles.impactMeta}>
        <span>{formatNumber(item.petani, 0)} Petani</span>
        <span>{formatNumber(item.luas, 1)} Ha Lahan</span>
      </div>
    </div>
  );
}

function SourceRow({ label, value, badge }) {
  return (
    <div style={styles.sourceRow}>
      <span>{label}</span>

      {badge ? (
        <strong style={styles.sourceBadge}>{value}</strong>
      ) : (
        <strong>{value}</strong>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "30px 34px 18px",
    background: "#f8fafc",
    color: "#0f172a",
    boxSizing: "border-box",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 24,
    alignItems: "flex-start",
    marginBottom: 26,
  },

  title: {
    margin: 0,
    fontSize: 30,
    fontWeight: 950,
    color: "#0f172a",
  },

  subtitle: {
    margin: "10px 0 0",
    color: "#475569",
    fontSize: 15,
  },

  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  locationSelect: {
    height: 48,
    minWidth: 230,
    border: "1px solid #dbe3ea",
    borderRadius: 12,
    background: "#ffffff",
    padding: "0 14px",
    color: "#0f172a",
    fontWeight: 750,
    outline: "none",
  },

  autoUpdateBtn: {
    height: 48,
    border: "1px solid #dbe3ea",
    borderRadius: 12,
    background: "#ffffff",
    color: "#0f172a",
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 14px",
    cursor: "pointer",
  },

  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },

  iconBell: {
    width: 42,
    height: 42,
    border: "none",
    background: "transparent",
    position: "relative",
    color: "#0f172a",
    cursor: "pointer",
  },

  bellBadge: {
    position: "absolute",
    top: 0,
    right: 1,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    background: "#ef4444",
    color: "#ffffff",
    fontSize: 11,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    padding: "0 5px",
  },

  adminProfile: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  adminAvatar: {
    width: 46,
    height: 46,
    borderRadius: 999,
    background: "#dcfce7",
    color: "#059669",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    fontWeight: 950,
  },

  dateBox: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 170,
    color: "#0f172a",
    fontSize: 13,
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: 14,
    marginBottom: 24,
  },

  statCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    minHeight: 112,
    padding: 20,
    display: "flex",
    alignItems: "center",
    gap: 16,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  statIcon: {
    width: 58,
    height: 58,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  redIconBox: {
    background: "#fee2e2",
    color: "#ef4444",
  },

  blueIconBox: {
    background: "#dbeafe",
    color: "#2563eb",
  },

  cyanIconBox: {
    background: "#e0f2fe",
    color: "#0284c7",
  },

  purpleIconBox: {
    background: "#f3e8ff",
    color: "#9333ea",
  },

  orangeIconBox: {
    background: "#ffedd5",
    color: "#f97316",
  },

  greenIconBox: {
    background: "#dcfce7",
    color: "#16a34a",
  },

  statLabel: {
    margin: 0,
    color: "#475569",
    fontSize: 13,
    fontWeight: 850,
  },

  statValue: {
    margin: "5px 0",
    color: "#0f172a",
    fontSize: 28,
    fontWeight: 950,
  },

  statNote: {
    fontSize: 12,
    fontWeight: 700,
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1.35fr 1.45fr 0.9fr",
    gap: 22,
  },

  mapCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 20,
    minHeight: 430,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
    position: "relative",
  },

  tableCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 20,
    minHeight: 430,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  warningCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  chartCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 20,
    minHeight: 300,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  impactCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 20,
    minHeight: 300,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  sourceCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 20,
    minHeight: 300,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  cardTitleWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  cardIconBtn: {
    border: "none",
    background: "#f8fafc",
    borderRadius: 8,
    width: 34,
    height: 34,
    cursor: "pointer",
    color: "#475569",
  },

  mapArea: {
    height: 330,
    position: "relative",
    background: "#eef2f7",
    borderRadius: 14,
    overflow: "hidden",
  },

  leafletMap: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
    zIndex: 1,
  },

  mapLoading: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748b",
    background: "#f8fafc",
  },

  legend: {
    position: "absolute",
    left: 22,
    bottom: 20,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    boxShadow: "0 10px 28px rgba(15, 23, 42, 0.08)",
    zIndex: 2,
  },

  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  legendDot: {
    width: 16,
    height: 16,
    borderRadius: 999,
  },

  tableWrapper: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  th: {
    textAlign: "left",
    padding: "13px 10px",
    borderBottom: "1px solid #e5e7eb",
    fontSize: 13,
    color: "#0f172a",
    fontWeight: 900,
  },

  tr: {
    borderBottom: "1px solid #e5e7eb",
  },

  td: {
    padding: "13px 10px",
    fontSize: 14,
    color: "#0f172a",
  },

  emptyCell: {
    textAlign: "center",
    padding: 26,
    color: "#64748b",
  },

  statusPill: {
    borderRadius: 999,
    padding: "6px 11px",
    fontSize: 12,
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },

  fullButton: {
    width: "100%",
    height: 44,
    marginTop: 18,
    border: "1px solid #16a34a",
    color: "#059669",
    background: "#ffffff",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 900,
  },

  warningList: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  warningItem: {
    border: "1px solid",
    borderRadius: 12,
    padding: 16,
  },

  warningTitle: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },

  chartWrap: {
    width: "100%",
  },

  chartSvg: {
    width: "100%",
    height: 220,
  },

  chartLegend: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 18,
    flexWrap: "wrap",
    fontSize: 12,
    color: "#475569",
  },

  impactGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 14,
  },

  impactBox: {
    border: "1px solid",
    borderRadius: 12,
    padding: 18,
  },

  impactMeta: {
    marginTop: 16,
    paddingTop: 12,
    borderTop: "1px solid rgba(15,23,42,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontWeight: 800,
  },

  sourceRows: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
    marginTop: 16,
  },

  sourceRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    color: "#475569",
  },

  sourceBadge: {
    background: "#dcfce7",
    color: "#059669",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 12,
  },

  settingsBtn: {
    width: "100%",
    height: 44,
    marginTop: 28,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 850,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  infoBanner: {
    marginTop: 22,
    borderRadius: 12,
    background: "#ecfdf5",
    color: "#047857",
    padding: 16,
    display: "flex",
    alignItems: "center",
    gap: 10,
    border: "1px solid #bbf7d0",
  },

  footer: {
    display: "flex",
    justifyContent: "space-between",
    color: "#475569",
    fontSize: 14,
    marginTop: 28,
  },
};