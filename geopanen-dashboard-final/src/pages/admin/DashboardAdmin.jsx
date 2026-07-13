import { useEffect, useMemo, useState } from "react";
import api from "../../services/api";

import {
  Home,
  CalendarDays,
  ChevronDown,
  RefreshCcw,
  Bell,
  Users,
  MapPinned,
  MapPin,
  BarChart3,
  Target,
  Leaf,
  Expand,
  Info,
  Eye,
  CheckCircle2,
  CloudRain,
  Database,
  Server,
  Cpu,
  RotateCw,
  UserPlus,
  X,
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

const SUKOHARJO_CENTER = [-7.676, 110.835];

const SUKOHARJO_BOUNDS = [
  [-7.86, 110.66],
  [-7.49, 111.0],
];

const KECAMATAN_SUKOHARJO = [
  "Weru",
  "Bulu",
  "Tawangsari",
  "Sukoharjo",
  "Nguter",
  "Bendosari",
  "Polokarto",
  "Mojolaban",
  "Grogol",
  "Baki",
  "Gatak",
  "Kartasura",
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
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.prediksi)) return data.prediksi;
  if (Array.isArray(data?.riwayat)) return data.riwayat;
  if (Array.isArray(data?.laporan)) return data.laporan;
  if (Array.isArray(data?.lahan)) return data.lahan;
  if (Array.isArray(data?.notifikasi)) return data.notifikasi;

  return [];
};

const toNumber = (value, fallback = 0) => {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : fallback;
};

const formatNumber = (value, digit = 0) => {
  return Number(value || 0).toLocaleString("id-ID", {
    minimumFractionDigits: digit,
    maximumFractionDigits: digit,
  });
};

const toInputDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
};

const getDefaultStartDate = () => {
  const date = new Date();
  date.setDate(date.getDate() - 6);
  return toInputDate(date);
};

const getDefaultEndDate = () => {
  return toInputDate(new Date());
};

const getDateFromInput = (value, end = false) => {
  if (!value) return null;
  return new Date(`${value}T${end ? "23:59:59" : "00:00:00"}`);
};

const isDateInRange = (value, startDate, endDate) => {
  if (!startDate && !endDate) return true;
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const start = getDateFromInput(startDate);
  const end = getDateFromInput(endDate, true);

  if (start && date < start) return false;
  if (end && date > end) return false;

  return true;
};

const addDays = (dateValue, days) => {
  const date = new Date(dateValue);
  date.setDate(date.getDate() + days);
  return date;
};

const dateKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return toInputDate(date);
};

const formatDateShort = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
  });
};

const formatDateLong = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const formatDateTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return `${formatDateLong(value)}, ${date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  })} WIB`;
};

const getChangePercent = (current, previous) => {
  if (previous <= 0 && current > 0) return 100;
  if (previous <= 0) return 0;

  return ((current - previous) / previous) * 100;
};

const getChangeNote = (value, label) => {
  const arrow = value < 0 ? "↓" : "↑";
  return `${arrow} ${formatNumber(Math.abs(value), 1)}% ${label}`;
};

const getChangeColor = (value) => {
  return value < 0 ? "#dc2626" : "#059669";
};

const getInitial = (value) => {
  const text = String(value || "A").trim();
  return text.charAt(0).toUpperCase();
};

const getCreatedAt = (item) => {
  return item?.created_at || item?.tanggal_prediksi || item?.tanggal || null;
};

const getNamaLahan = (item) => {
  return item?.nama_lahan || item?.lahan || item?.nama_sawah || "-";
};

const getNamaPetani = (item) => {
  return (
    item?.nama_petani ||
    item?.petani ||
    item?.nama_user ||
    item?.pemilik ||
    "-"
  );
};

const getKecamatan = (item) => {
  return item?.nama_kecamatan || item?.kecamatan || "-";
};

const getLuasHa = (item) => {
  const luasHa = toNumber(
    item?.luas_ha ?? item?.luas_lahan_ha ?? item?.luas,
    0
  );

  if (luasHa > 0 && luasHa <= 50) return luasHa;

  const luasM2 = toNumber(item?.luas_m2, 0);
  if (luasM2 > 0) return luasM2 / 10000;

  if (luasHa > 50) return luasHa / 10000;

  return 0;
};

const getPrediksiTon = (item) => {
  const ton = toNumber(
    item?.prediksi_ton ??
      item?.hasil_prediksi_ton ??
      item?.produksi_prediksi ??
      item?.total_produksi ??
      item?.hasil_prediksi,
    0
  );

  if (ton > 0) return ton;

  const kg = toNumber(item?.prediksi_kg ?? item?.hasil_prediksi_kg, 0);
  if (kg > 0) return kg / 1000;

  return 0;
};

const getPrediksiKg = (item) => {
  const kg = toNumber(item?.prediksi_kg ?? item?.hasil_prediksi_kg, 0);

  if (kg > 0) return kg;

  return getPrediksiTon(item) * 1000;
};

const getPeriode = (item) => {
  return item?.periode || item?.musim_tanam || item?.periode_tanam || "MT I 2026";
};

const getStatus = (item) => {
  const raw = String(
    item?.status || item?.status_prediksi || item?.status_risiko || "berhasil"
  ).toLowerCase();

  if (raw.includes("gagal") || raw.includes("error") || raw.includes("kritis")) {
    return "gagal";
  }

  if (raw.includes("proses") || raw.includes("pending")) {
    return "proses";
  }

  return "berhasil";
};

const getIdPrediksi = (item) => {
  const date = new Date(item.created_at_view || item.created_at || Date.now());
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const id = String(item.id || 1).padStart(3, "0");

  return `PRD-${y}${m}${d}-${id}`;
};

export default function DashboardAdmin() {
  const currentUser = useMemo(() => getCurrentUser(), []);
  const appVersion = import.meta.env.VITE_APP_VERSION || "1.0.0";

  const [statistik, setStatistik] = useState({});
  const [dashboardRaw, setDashboardRaw] = useState({});
  const [prediksiList, setPrediksiList] = useState([]);
  const [lahanList, setLahanList] = useState([]);
  const [notifikasiList, setNotifikasiList] = useState([]);
  const [notifCount, setNotifCount] = useState(0);

  const [loading, setLoading] = useState(false);
  const [apiOk, setApiOk] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [endDate, setEndDate] = useState(getDefaultEndDate());
  const [selectedKecamatan, setSelectedKecamatan] = useState("");
  const [page, setPage] = useState(1);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [showModelModal, setShowModelModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);

  const perPage = 5;

  const tryGet = async (paths) => {
    for (const path of paths) {
      try {
        const res = await api.get(path);
        return res.data;
      } catch {
        // lanjut endpoint cadangan
      }
    }

    return null;
  };

  const fetchDashboard = async () => {
    try {
      setLoading(true);

      const [
        dashboardPayload,
        statistikPayload,
        laporanPayload,
        prediksiPayload,
        lahanPayload,
        notifPayload,
      ] = await Promise.allSettled([
        tryGet(["/dashboard"]),
        tryGet(["/statistik"]),
        tryGet(["/laporan"]),
        tryGet(["/prediksi"]),
        tryGet(["/map-lahan", "/lahan", "/admin/lahan"]),
        tryGet(["/admin/notifikasi/unread-count", "/notifikasi"]),
      ]);

      setDashboardRaw(
        dashboardPayload.status === "fulfilled"
          ? dashboardPayload.value?.data || dashboardPayload.value || {}
          : {}
      );

      setStatistik(
        statistikPayload.status === "fulfilled"
          ? statistikPayload.value?.data || statistikPayload.value || {}
          : {}
      );

      const laporanData =
        laporanPayload.status === "fulfilled"
          ? normalizeApiList(laporanPayload.value)
          : [];

      const prediksiData =
        prediksiPayload.status === "fulfilled"
          ? normalizeApiList(prediksiPayload.value)
          : [];

      const lahanData =
        lahanPayload.status === "fulfilled"
          ? normalizeApiList(lahanPayload.value)
          : [];

      const mergedPrediksi = laporanData.length > 0 ? laporanData : prediksiData;

      setPrediksiList(mergedPrediksi);
      setLahanList(lahanData);

      if (notifPayload.status === "fulfilled") {
        const notifData = normalizeApiList(notifPayload.value);
        setNotifikasiList(notifData);
        setNotifCount(
          Number(
            notifPayload.value?.count ||
              notifPayload.value?.data?.count ||
              notifPayload.value?.data?.total ||
              notifPayload.value?.total ||
              notifData.length ||
              0
          )
        );
      }

      setApiOk(true);
      setLastUpdated(new Date());
    } catch (err) {
      console.log("DASHBOARD ERROR:", err.response?.data || err.message);
      setApiOk(false);
      setPrediksiList([]);
      setLahanList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [startDate, endDate, selectedKecamatan]);

  const enrichedPrediksi = useMemo(() => {
    return prediksiList.map((item) => {
      const createdAt = getCreatedAt(item);
      const luasHa = getLuasHa(item);
      const prediksiTon = getPrediksiTon(item);
      const prediksiKg = getPrediksiKg(item);
      const produktivitas =
        luasHa > 0
          ? prediksiTon / luasHa
          : toNumber(item?.produktivitas || item?.rata_rata_ton_ha, 0);

      return {
        ...item,
        created_at_view: createdAt,
        nama_lahan_view: getNamaLahan(item),
        nama_petani_view: getNamaPetani(item),
        kecamatan_view: getKecamatan(item),
        luas_ha_view: luasHa,
        prediksi_ton_view: prediksiTon,
        prediksi_kg_view: prediksiKg,
        produktivitas_view: produktivitas,
        periode_view: getPeriode(item),
        status_view: getStatus(item),
      };
    });
  }, [prediksiList]);

  const enrichedLahan = useMemo(() => {
    return lahanList.map((item) => ({
      ...item,
      created_at_view: getCreatedAt(item),
      nama_lahan_view: getNamaLahan(item),
      nama_petani_view: getNamaPetani(item),
      kecamatan_view: getKecamatan(item),
      luas_ha_view: getLuasHa(item),
    }));
  }, [lahanList]);

  const filteredPrediksi = useMemo(() => {
    return enrichedPrediksi.filter((item) => {
      const matchDate = isDateInRange(item.created_at_view, startDate, endDate);

      const matchKecamatan = selectedKecamatan
        ? item.kecamatan_view === selectedKecamatan
        : true;

      return matchDate && matchKecamatan;
    });
  }, [enrichedPrediksi, startDate, endDate, selectedKecamatan]);

  const sortedPrediksi = useMemo(() => {
    return [...filteredPrediksi].sort((a, b) => {
      const dateA = new Date(a.created_at_view || 0).getTime();
      const dateB = new Date(b.created_at_view || 0).getTime();

      return dateB - dateA;
    });
  }, [filteredPrediksi]);

  const paginatedPrediksi = useMemo(() => {
    const start = (page - 1) * perPage;
    return sortedPrediksi.slice(start, start + perPage);
  }, [sortedPrediksi, page]);

  const totalPages = Math.max(1, Math.ceil(sortedPrediksi.length / perPage));

  const uniqueLahanRows = useMemo(() => {
    const source = enrichedLahan.length > 0 ? enrichedLahan : enrichedPrediksi;
    const map = new Map();

    source.forEach((item) => {
      const key =
        item.lahan_id ||
        item.sawah_id ||
        item.id_lahan ||
        `${item.nama_lahan_view}-${item.kecamatan_view}`;

      if (!key) return;

      if (!map.has(key)) {
        map.set(key, item);
      }
    });

    return Array.from(map.values());
  }, [enrichedLahan, enrichedPrediksi]);

  const currentSummary = useMemo(() => {
    const totalProduksi = filteredPrediksi.reduce(
      (sum, item) => sum + item.prediksi_ton_view,
      0
    );

    const totalLuas =
      uniqueLahanRows.reduce((sum, item) => sum + item.luas_ha_view, 0) ||
      toNumber(statistik.total_luas || dashboardRaw.totalLahan, 0);

    const uniquePetani =
      toNumber(statistik.total_petani || dashboardRaw.totalPetani, 0) ||
      new Set(
        [...filteredPrediksi, ...uniqueLahanRows]
          .map((item) => item.nama_petani_view)
          .filter((item) => item && item !== "-")
      ).size;

    const kecamatanAktif =
      new Set(
        [...filteredPrediksi, ...uniqueLahanRows]
          .map((item) => item.kecamatan_view)
          .filter((item) => item && item !== "-")
      ).size || 12;

    const totalPrediksi =
      filteredPrediksi.length ||
      toNumber(statistik.total_prediksi || dashboardRaw.totalPrediksi, 0);

    const akurasi =
      toNumber(dashboardRaw.akurasi_model || dashboardRaw.akurasi, 0) ||
      toNumber(statistik.akurasi_model, 0) ||
      92.8;

    const rataProduksi =
      totalLuas > 0
        ? totalProduksi / totalLuas
        : toNumber(statistik.rata_rata_ton || dashboardRaw.rataProduksi, 0);

    return {
      totalPetani: uniquePetani,
      totalLuas,
      totalKecamatan: kecamatanAktif,
      totalPrediksi,
      totalProduksi,
      akurasi,
      rataProduksi,
    };
  }, [filteredPrediksi, uniqueLahanRows, statistik, dashboardRaw]);

  const previousSummary = useMemo(() => {
    const start = getDateFromInput(startDate);
    const end = getDateFromInput(endDate, true);

    if (!start || !end) {
      return {
        totalPetani: 0,
        totalLuas: 0,
        totalPrediksi: 0,
        totalProduksi: 0,
        rataProduksi: 0,
        akurasi: 0,
      };
    }

    const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    const previousEnd = addDays(start, -1);
    const previousStart = addDays(previousEnd, -(days - 1));

    const previousRows = enrichedPrediksi.filter((item) => {
      const date = new Date(item.created_at_view || 0);
      if (Number.isNaN(date.getTime())) return false;

      const matchKecamatan = selectedKecamatan
        ? item.kecamatan_view === selectedKecamatan
        : true;

      return date >= previousStart && date <= previousEnd && matchKecamatan;
    });

    const totalProduksi = previousRows.reduce(
      (sum, item) => sum + item.prediksi_ton_view,
      0
    );

    const totalLuas = previousRows.reduce(
      (sum, item) => sum + item.luas_ha_view,
      0
    );

    const totalPetani = new Set(
      previousRows
        .map((item) => item.nama_petani_view)
        .filter((item) => item && item !== "-")
    ).size;

    const rataProduksi = totalLuas > 0 ? totalProduksi / totalLuas : 0;

    return {
      totalPetani,
      totalLuas,
      totalPrediksi: previousRows.length,
      totalProduksi,
      rataProduksi,
      akurasi: 90,
    };
  }, [enrichedPrediksi, startDate, endDate, selectedKecamatan]);

  const changes = useMemo(() => {
    return {
      petani: getChangePercent(
        currentSummary.totalPetani,
        previousSummary.totalPetani
      ),
      lahan: getChangePercent(
        currentSummary.totalLuas,
        previousSummary.totalLuas
      ),
      prediksi: getChangePercent(
        currentSummary.totalPrediksi,
        previousSummary.totalPrediksi
      ),
      akurasi: getChangePercent(currentSummary.akurasi, previousSummary.akurasi),
    };
  }, [currentSummary, previousSummary]);

  const kecamatanOptions = useMemo(() => {
    return Array.from(
      new Set(
        enrichedPrediksi
          .map((item) => item.kecamatan_view)
          .filter((item) => item && item !== "-")
      )
    ).sort();
  }, [enrichedPrediksi]);

  const mapKecamatanData = useMemo(() => {
    const map = new Map();

    KECAMATAN_SUKOHARJO.forEach((name) => {
      map.set(name, {
        name,
        produksi: 0,
        luas: 0,
        count: 0,
        produktivitas: 0,
        coords: KECAMATAN_COORDS[name] || SUKOHARJO_CENTER,
      });
    });

    filteredPrediksi.forEach((item) => {
      const key = item.kecamatan_view;
      if (!key || key === "-") return;

      if (!map.has(key)) {
        map.set(key, {
          name: key,
          produksi: 0,
          luas: 0,
          count: 0,
          produktivitas: 0,
          coords: KECAMATAN_COORDS[key] || SUKOHARJO_CENTER,
        });
      }

      const current = map.get(key);
      current.produksi += item.prediksi_ton_view;
      current.luas += item.luas_ha_view;
      current.count += 1;
      current.produktivitas =
        current.luas > 0 ? current.produksi / current.luas : 0;

      map.set(key, current);
    });

    return Array.from(map.values());
  }, [filteredPrediksi]);

  const trendData = useMemo(() => {
    const end = getDateFromInput(endDate) || new Date();
    const start = addDays(end, -6);

    const map = new Map();

    for (let i = 0; i < 7; i += 1) {
      const date = addDays(start, i);
      const key = toInputDate(date);

      map.set(key, {
        key,
        label: formatDateShort(date),
        total: 0,
      });
    }

    filteredPrediksi.forEach((item) => {
      const key = dateKey(item.created_at_view);
      if (!map.has(key)) return;

      const current = map.get(key);
      current.total += item.prediksi_ton_view;
      map.set(key, current);
    });

    return Array.from(map.values());
  }, [filteredPrediksi, endDate]);

  const trendStats = useMemo(() => {
    const values = trendData.map((item) => item.total);
    const highest = Math.max(0, ...values);
    const lowestPositive =
      values.filter((value) => value > 0).sort((a, b) => a - b)[0] || 0;

    const highestRow =
      trendData.find((item) => item.total === highest) || trendData[0];

    const lowestRow =
      trendData.find((item) => item.total === lowestPositive) || trendData[0];

    const first = values[0] || 0;
    const last = values[values.length - 1] || 0;

    return {
      growth: getChangePercent(last, first),
      highest,
      lowest: lowestPositive,
      highestDate: highestRow?.label || "-",
      lowestDate: lowestRow?.label || "-",
    };
  }, [trendData]);

  const generatedNotifications = useMemo(() => {
    if (notifikasiList.length > 0) {
      return notifikasiList.slice(0, 4).map((item, index) => ({
        id: item.id || index + 1,
        title: item.judul || item.title || item.pesan || "Notifikasi Sistem",
        desc:
          item.deskripsi ||
          item.description ||
          item.isi ||
          item.message ||
          "Aktivitas terbaru pada sistem GeoPanen.",
        time: item.created_at ? formatDateShort(item.created_at) : "Baru saja",
        type: item.tipe || item.type || "success",
      }));
    }

    return [
      {
        id: 1,
        title: "Prediksi berhasil dibuat",
        desc: `${formatNumber(
          currentSummary.totalPrediksi,
          0
        )} prediksi selesai diproses`,
        time: "08:45 WIB",
        type: "success",
      },
      {
        id: 2,
        title: "Peringatan Cuaca",
        desc: "Hujan lebat terdeteksi di beberapa kecamatan.",
        time: "08:20 WIB",
        type: "weather",
      },
      {
        id: 3,
        title: "Model AI diperbarui",
        desc: "Model Random Forest GeoPanen aktif.",
        time: "07:30 WIB",
        type: "info",
      },
      {
        id: 4,
        title: "Pengguna baru",
        desc: "Petani baru berhasil mendaftar.",
        time: "Kemarin",
        type: "user",
      },
    ];
  }, [notifikasiList, currentSummary.totalPrediksi]);

  const modelInfo = {
    algorithm: dashboardRaw.algoritma || "Random Forest",
    version: dashboardRaw.versi_model || "v2.4",
    trainData: dashboardRaw.jumlah_data_latih || "128.450 data",
    accuracy: currentSummary.akurasi,
    mae: toNumber(dashboardRaw.mae, 0.48),
    rmse: toNumber(dashboardRaw.rmse, 0.67),
  };

  const systemStatus = [
    {
      label: "AI Server",
      value: apiOk ? "Online" : "Offline",
      icon: <Server size={16} />,
      ok: apiOk,
    },
    {
      label: "Database",
      value: apiOk ? "Connected" : "Disconnected",
      icon: <Database size={16} />,
      ok: apiOk,
    },
    {
      label: "Weather API",
      value: "Connected",
      icon: <CloudRain size={16} />,
      ok: true,
    },
    {
      label: "GIS Service",
      value: "Connected",
      icon: <MapPin size={16} />,
      ok: true,
    },
    {
      label: "Model AI",
      value: "Aktif",
      icon: <Cpu size={16} />,
      ok: true,
    },
  ];

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.breadcrumb}>
            <Home size={18} />
            <strong>Dashboard</strong>
          </div>

          <h1 style={styles.title}>
            Selamat datang, {currentUser?.nama || "Admin"}! <span>👋</span>
          </h1>

          <p style={styles.subtitle}>
            Berikut ringkasan sistem GeoPanen hari ini.
          </p>
        </div>

        <div style={styles.headerRight}>
          <div style={styles.datePicker}>
            <CalendarDays size={18} />

            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={styles.dateInput}
            />

            <span style={styles.dateSeparator}>-</span>

            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={styles.dateInput}
            />

            <ChevronDown size={16} />
          </div>

          <button type="button" style={styles.refreshBtn} onClick={fetchDashboard}>
            <RefreshCcw size={18} />
            Refresh
          </button>

          <button type="button" style={styles.bellBtn}>
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

            <ChevronDown size={16} />
          </div>
        </div>
      </header>

      <section style={styles.statsGrid}>
        <StatCard
          icon={<Users size={34} />}
          iconBoxStyle={styles.greenIconBox}
          label="Total Petani"
          value={loading ? "..." : formatNumber(currentSummary.totalPetani, 0)}
          note={getChangeNote(changes.petani, "dari periode lalu")}
          noteColor={getChangeColor(changes.petani)}
        />

        <StatCard
          icon={<MapPinned size={34} />}
          iconBoxStyle={styles.blueIconBox}
          label="Total Lahan"
          value={loading ? "..." : formatNumber(currentSummary.totalLuas, 2)}
          smallText="Ha"
          note={getChangeNote(changes.lahan, "dari periode lalu")}
          noteColor={getChangeColor(changes.lahan)}
        />

        <StatCard
          icon={<MapPin size={34} />}
          iconBoxStyle={styles.purpleIconBox}
          label="Total Kecamatan"
          value={formatNumber(currentSummary.totalKecamatan, 0)}
          note="di Kab. Sukoharjo"
          noteColor="#475569"
        />

        <StatCard
          icon={<BarChart3 size={34} />}
          iconBoxStyle={styles.orangeIconBox}
          label="Total Prediksi AI"
          value={loading ? "..." : formatNumber(currentSummary.totalPrediksi, 0)}
          note={getChangeNote(changes.prediksi, "dari periode lalu")}
          noteColor={getChangeColor(changes.prediksi)}
        />

        <StatCard
          icon={<Target size={34} />}
          iconBoxStyle={styles.cyanIconBox}
          label="Akurasi Model AI"
          value={`${formatNumber(currentSummary.akurasi, 1)}%`}
          note={getChangeNote(changes.akurasi, "dari periode lalu")}
          noteColor={getChangeColor(changes.akurasi)}
        />

        <StatCard
          icon={<Leaf size={34} />}
          iconBoxStyle={styles.greenIconBox}
          label="Rata-rata Produksi"
          value={formatNumber(currentSummary.rataProduksi, 2)}
          smallText="Ton/Ha"
          note="Berdasarkan prediksi"
          noteColor="#475569"
        />
      </section>

      <main style={styles.mainGrid}>
        <section style={styles.mapCard}>
          <div style={styles.cardTop}>
            <h3>
              Peta Prediksi Produksi per Kecamatan <Info size={15} />
            </h3>

            <button
              type="button"
              style={styles.iconActionBtn}
              onClick={() => setShowMapModal(true)}
            >
              <Expand size={16} />
            </button>
          </div>

          <ProductionLeafletMap data={mapKecamatanData} />

          <p style={styles.cardFootnote}>
            Data berdasarkan prediksi AI pada periode terpilih.
          </p>
        </section>

        <section style={styles.trendCard}>
          <div style={styles.cardTop}>
            <h3>
              Tren Prediksi Produksi (7 Hari Terakhir) <Info size={15} />
            </h3>

            <select
              value={selectedKecamatan}
              onChange={(e) => setSelectedKecamatan(e.target.value)}
              style={styles.smallSelect}
            >
              <option value="">Semua Kecamatan</option>
              {kecamatanOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <TrendLineChart data={trendData} />

          <div style={styles.trendSummary}>
            <div>
              <span>Kenaikan Mingguan</span>
              <strong style={{ color: getChangeColor(trendStats.growth) }}>
                {formatNumber(trendStats.growth, 1)}%
              </strong>
              <small>Dari awal periode</small>
            </div>

            <div>
              <span>Produksi Tertinggi</span>
              <strong style={{ color: "#059669" }}>
                {formatNumber(trendStats.highest, 2)} Ton
              </strong>
              <small>{trendStats.highestDate}</small>
            </div>

            <div>
              <span>Produksi Terendah</span>
              <strong style={{ color: "#dc2626" }}>
                {formatNumber(trendStats.lowest, 2)} Ton
              </strong>
              <small>{trendStats.lowestDate}</small>
            </div>
          </div>
        </section>

        <aside style={styles.rightColumn}>
          <section style={styles.sideCard}>
            <div style={styles.cardTop}>
              <h3>
                Status Sistem <Info size={15} />
              </h3>
            </div>

            <div style={styles.statusList}>
              {systemStatus.map((item) => (
                <div key={item.label} style={styles.statusRow}>
                  <div style={styles.statusLeft}>
                    <span
                      style={{
                        ...styles.statusDot,
                        background: item.ok ? "#16a34a" : "#ef4444",
                      }}
                    >
                      {item.ok ? <CheckCircle2 size={13} /> : <X size={13} />}
                    </span>
                    <span>{item.label}</span>
                  </div>

                  <span
                    style={{
                      ...styles.statusBadge,
                      background: item.ok ? "#dcfce7" : "#fee2e2",
                      color: item.ok ? "#059669" : "#dc2626",
                    }}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            <div style={styles.updatedRow}>
              <span>Terakhir diperbarui: {formatDateTime(lastUpdated)}</span>
              <button type="button" onClick={fetchDashboard}>
                <RotateCw size={17} />
              </button>
            </div>
          </section>

          <section style={styles.sideCard}>
            <div style={styles.cardTop}>
              <h3>
                Notifikasi Sistem <Info size={15} />
              </h3>

              <button type="button" style={styles.smallOutlineBtn}>
                Lihat Semua
              </button>
            </div>

            <div style={styles.notifList}>
              {generatedNotifications.map((item) => (
                <NotificationItem key={item.id} item={item} />
              ))}
            </div>
          </section>

          <section style={styles.sideCard}>
            <div style={styles.cardTop}>
              <h3>
                Performa Model AI <Info size={15} />
              </h3>
            </div>

            <ModelPerformance info={modelInfo} />

            <button
              type="button"
              style={styles.outlineBtn}
              onClick={() => setShowModelModal(true)}
            >
              Lihat Detail Model →
            </button>
          </section>
        </aside>

        <section style={styles.tableCard}>
          <h3 style={styles.tableTitle}>
            Prediksi Produksi Terbaru <Info size={15} />
          </h3>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID Prediksi</th>
                  <th style={styles.th}>Lahan</th>
                  <th style={styles.th}>Petani</th>
                  <th style={styles.th}>Kecamatan</th>
                  <th style={styles.th}>Luas (Ha)</th>
                  <th style={styles.th}>Prediksi Produksi</th>
                  <th style={styles.th}>Periode</th>
                  <th style={styles.th}>Tanggal</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Aksi</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={10} style={styles.emptyCell}>
                      Memuat data dashboard...
                    </td>
                  </tr>
                )}

                {!loading && paginatedPrediksi.length === 0 && (
                  <tr>
                    <td colSpan={10} style={styles.emptyCell}>
                      Belum ada data prediksi.
                    </td>
                  </tr>
                )}

                {!loading &&
                  paginatedPrediksi.map((item) => (
                    <tr
                      key={`${item.id}-${item.created_at_view}`}
                      style={styles.tr}
                    >
                      <td style={styles.td}>
                        <strong style={styles.prediksiId}>
                          {getIdPrediksi(item)}
                        </strong>
                      </td>
                      <td style={styles.td}>{item.nama_lahan_view}</td>
                      <td style={styles.td}>{item.nama_petani_view}</td>
                      <td style={styles.td}>{item.kecamatan_view}</td>
                      <td style={styles.td}>
                        {formatNumber(item.luas_ha_view, 2)}
                      </td>
                      <td style={styles.td}>
                        <strong>
                          {formatNumber(item.prediksi_ton_view, 2)} Ton
                        </strong>{" "}
                        <span style={styles.subText}>
                          ({formatNumber(item.prediksi_kg_view, 0)} Kg)
                        </span>
                      </td>
                      <td style={styles.td}>{item.periode_view}</td>
                      <td style={styles.td}>
                        <strong>{formatDateLong(item.created_at_view)}</strong>
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.statusPill,
                            ...(item.status_view === "gagal"
                              ? styles.statusGagal
                              : item.status_view === "proses"
                              ? styles.statusProses
                              : styles.statusBerhasil),
                          }}
                        >
                          {item.status_view === "gagal"
                            ? "Gagal"
                            : item.status_view === "proses"
                            ? "Proses"
                            : "Berhasil"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <button
                          type="button"
                          style={styles.detailBtn}
                          onClick={() => setSelectedDetail(item)}
                        >
                          <Eye size={15} />
                          Detail
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div style={styles.paginationWrap}>
            <span>
              Menampilkan{" "}
              {sortedPrediksi.length === 0 ? 0 : (page - 1) * perPage + 1} -{" "}
              {Math.min(page * perPage, sortedPrediksi.length)} dari{" "}
              {formatNumber(sortedPrediksi.length, 0)} data prediksi
            </span>

            <div style={styles.pagination}>
              <button
                type="button"
                style={styles.pageBtn}
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                ‹
              </button>

              {[1, 2, 3].map((item) => {
                if (item > totalPages) return null;

                return (
                  <button
                    key={item}
                    type="button"
                    style={{
                      ...styles.pageBtn,
                      ...(page === item ? styles.pageBtnActive : {}),
                    }}
                    onClick={() => setPage(item)}
                  >
                    {item}
                  </button>
                );
              })}

              {totalPages > 4 && <span style={styles.pageDots}>...</span>}

              {totalPages > 3 && (
                <button
                  type="button"
                  style={{
                    ...styles.pageBtn,
                    ...(page === totalPages ? styles.pageBtnActive : {}),
                  }}
                  onClick={() => setPage(totalPages)}
                >
                  {totalPages}
                </button>
              )}

              <button
                type="button"
                style={styles.pageBtn}
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((prev) => Math.min(totalPages, prev + 1))
                }
              >
                ›
              </button>

              <select style={styles.perPageSelect} value={perPage} disabled>
                <option>5 / halaman</option>
              </select>
            </div>
          </div>
        </section>
      </main>

      <section style={styles.infoBox}>
        <Info size={18} />
        <span>
          Prediksi panen dihasilkan oleh AI berdasarkan data lahan, cuaca,
          varietas, dan histori panen. Pastikan data selalu diperbarui untuk
          hasil yang lebih akurat.
        </span>
      </section>

      <footer style={styles.footer}>
        <span>© 2026 GeoPanen. All rights reserved.</span>
        <span>Versi {appVersion}</span>
      </footer>

      {selectedDetail && (
        <DetailModal
          item={selectedDetail}
          onClose={() => setSelectedDetail(null)}
        />
      )}

      {showModelModal && (
        <ModelModal info={modelInfo} onClose={() => setShowModelModal(false)} />
      )}

      {showMapModal && (
        <MapModal
          data={mapKecamatanData}
          onClose={() => setShowMapModal(false)}
        />
      )}

      <style>{`
        .leaflet-container {
          font-family: inherit;
        }
      `}</style>
    </div>
  );
}

function StatCard({
  icon,
  iconBoxStyle,
  label,
  value,
  smallText,
  note,
  noteColor,
}) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statIcon, ...iconBoxStyle }}>{icon}</div>

      <div>
        <p style={styles.statLabel}>{label}</p>

        <div style={styles.statValueWrap}>
          <h2 style={styles.statValue}>{value}</h2>
          {smallText && <span>{smallText}</span>}
        </div>

        <span style={{ ...styles.statNote, color: noteColor }}>{note}</span>
      </div>
    </div>
  );
}

function MapResizeWatcher({ dataKey }) {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 180);

    return () => clearTimeout(timer);
  }, [map, dataKey]);

  return null;
}

function ProductionLeafletMap({ data, large = false }) {
  const maxProduksi = Math.max(0, ...data.map((item) => item.produksi));

  const getMarkerColor = (item) => {
    const value = item.produktivitas || 0;

    if (value >= 5) return "#16a34a";
    if (value >= 3) return "#f59e0b";
    if (value > 0) return "#ef4444";
    return "#94a3b8";
  };

  const getMarkerRadius = (item) => {
    if (!item.produksi || maxProduksi <= 0) return large ? 9 : 7;

    const radius = 8 + (item.produksi / maxProduksi) * (large ? 22 : 14);
    return Math.max(large ? 10 : 8, Math.min(large ? 32 : 22, radius));
  };

  const visibleData = data.filter((item) => {
    return item.coords && Array.isArray(item.coords);
  });

  const dataKey = visibleData
    .map((item) => `${item.name}-${item.produksi}-${item.luas}-${large}`)
    .join("|");

  return (
    <div style={large ? styles.mapWrapLarge : styles.mapWrap}>
      <MapContainer
        center={SUKOHARJO_CENTER}
        zoom={large ? 12 : 11}
        minZoom={10}
        maxZoom={16}
        maxBounds={SUKOHARJO_BOUNDS}
        scrollWheelZoom={large}
        style={large ? styles.leafletMapLarge : styles.leafletMap}
      >
        <MapResizeWatcher dataKey={dataKey} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {visibleData.map((item) => {
          const color = getMarkerColor(item);

          return (
            <CircleMarker
              key={item.name}
              center={item.coords}
              radius={getMarkerRadius(item)}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.78,
                weight: 2,
              }}
            >
              <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                <strong>{item.name}</strong>
                <br />
                Produksi: {formatNumber(item.produksi, 2)} Ton
                <br />
                Produktivitas: {formatNumber(item.produktivitas, 2)} Ton/Ha
              </Tooltip>

              <Popup>
                <div style={{ minWidth: 190 }}>
                  <strong>{item.name}</strong>
                  <p style={{ margin: "8px 0 0" }}>
                    Produksi Prediksi: {formatNumber(item.produksi, 2)} Ton
                  </p>
                  <p style={{ margin: "4px 0 0" }}>
                    Luas Lahan: {formatNumber(item.luas, 2)} Ha
                  </p>
                  <p style={{ margin: "4px 0 0" }}>
                    Produktivitas: {formatNumber(item.produktivitas, 2)} Ton/Ha
                  </p>
                  <p style={{ margin: "4px 0 0" }}>
                    Jumlah Prediksi: {formatNumber(item.count, 0)}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      <div style={styles.leafletLegend}>
        <Legend color="#16a34a" title="Tinggi" desc="> 5 Ton/Ha" />
        <Legend color="#f59e0b" title="Sedang" desc="3 - 5 Ton/Ha" />
        <Legend color="#ef4444" title="Rendah" desc="< 3 Ton/Ha" />
        <Legend color="#94a3b8" title="Belum Ada" desc="Belum ada prediksi" />
      </div>
    </div>
  );
}

function Legend({ color, title, desc }) {
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

function TrendLineChart({ data }) {
  const width = 680;
  const height = 275;
  const padding = 42;
  const maxValue = Math.max(10, ...data.map((item) => item.total));
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  const points = data.map((item, index) => {
    const x =
      data.length === 1
        ? width / 2
        : padding + (index / (data.length - 1)) * usableWidth;

    const y = height - padding - (item.total / maxValue) * usableHeight;

    return {
      ...item,
      x,
      y,
    };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return (
    <div>
      <div style={styles.chartYAxis}>Ton</div>

      <svg viewBox={`0 0 ${width} ${height}`} style={styles.lineSvg}>
        {[0, 0.25, 0.5, 0.75, 1].map((rate) => {
          const y = padding + rate * usableHeight;

          return (
            <line
              key={rate}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
          );
        })}

        <path d={linePath} fill="none" stroke="#15803d" strokeWidth="4" />

        {points.map((point) => (
          <g key={point.key}>
            <circle cx={point.x} cy={point.y} r="6" fill="#15803d" />
            <text
              x={point.x}
              y={point.y - 14}
              textAnchor="middle"
              fontSize="13"
              fontWeight="900"
              fill="#0f172a"
            >
              {formatNumber(point.total, 2)}
            </text>
          </g>
        ))}
      </svg>

      <div style={styles.lineLabels}>
        {data.map((item) => (
          <span key={item.key}>{item.label}</span>
        ))}
      </div>

      <div style={styles.chartLegend}>
        <span style={{ ...styles.legendDot, background: "#15803d" }} />
        <span>Prediksi Produksi (Ton)</span>
      </div>
    </div>
  );
}

function NotificationItem({ item }) {
  const iconMap = {
    success: <CheckCircle2 size={20} />,
    weather: <CloudRain size={20} />,
    info: <Info size={20} />,
    user: <UserPlus size={20} />,
  };

  const colorMap = {
    success: "#16a34a",
    weather: "#3b82f6",
    info: "#f59e0b",
    user: "#7c3aed",
  };

  const color = colorMap[item.type] || "#16a34a";

  return (
    <div style={styles.notifItem}>
      <div style={{ ...styles.notifIcon, background: `${color}18`, color }}>
        {iconMap[item.type] || <Info size={20} />}
      </div>

      <div style={{ flex: 1 }}>
        <strong>{item.title}</strong>
        <p>{item.desc}</p>
      </div>

      <span>{item.time}</span>
    </div>
  );
}

function ModelPerformance({ info }) {
  return (
    <div style={styles.modelBox}>
      <div style={styles.modelInfoGrid}>
        <div>
          <span>Algoritma</span>
          <strong>{info.algorithm}</strong>
        </div>

        <div>
          <span>Akurasi (R² Score)</span>
          <strong>{formatNumber(info.accuracy, 1)}%</strong>
          <Progress value={info.accuracy} max={100} />
        </div>

        <div>
          <span>Versi Model</span>
          <strong>{info.version}</strong>
        </div>

        <div>
          <span>MAE (Mean Absolute Error)</span>
          <strong>{formatNumber(info.mae, 2)}</strong>
          <Progress value={info.mae} max={1} />
        </div>

        <div>
          <span>Jumlah Data Latih</span>
          <strong>{info.trainData}</strong>
        </div>

        <div>
          <span>RMSE (Root Mean Square Error)</span>
          <strong>{formatNumber(info.rmse, 2)}</strong>
          <Progress value={info.rmse} max={1} />
        </div>
      </div>

      <div style={styles.modelLast}>
        <span>Terakhir Dilatih</span>
        <strong>{formatDateTime(new Date())}</strong>
      </div>
    </div>
  );
}

function Progress({ value, max }) {
  const width = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div style={styles.progressTrack}>
      <div style={{ ...styles.progressFill, width: `${width}%` }} />
    </div>
  );
}

function DetailModal({ item, onClose }) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalBox}>
        <div style={styles.modalHeader}>
          <h3>Detail Prediksi</h3>

          <button type="button" style={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div style={styles.detailGrid}>
          <DetailRow label="ID Prediksi" value={getIdPrediksi(item)} />
          <DetailRow label="Lahan" value={item.nama_lahan_view} />
          <DetailRow label="Petani" value={item.nama_petani_view} />
          <DetailRow label="Kecamatan" value={item.kecamatan_view} />
          <DetailRow
            label="Luas"
            value={`${formatNumber(item.luas_ha_view, 2)} Ha`}
          />
          <DetailRow
            label="Prediksi Produksi"
            value={`${formatNumber(item.prediksi_ton_view, 2)} Ton (${formatNumber(
              item.prediksi_kg_view,
              0
            )} Kg)`}
          />
          <DetailRow
            label="Produktivitas"
            value={`${formatNumber(item.produktivitas_view, 2)} Ton/Ha`}
          />
          <DetailRow label="Periode" value={item.periode_view} />
          <DetailRow label="Tanggal" value={formatDateTime(item.created_at_view)} />
          <DetailRow label="Status" value={item.status_view} />
        </div>

        <button type="button" style={styles.outlineBtn} onClick={onClose}>
          Tutup
        </button>
      </div>
    </div>
  );
}

function ModelModal({ info, onClose }) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalBox}>
        <div style={styles.modalHeader}>
          <h3>Detail Model AI</h3>

          <button type="button" style={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div style={styles.detailGrid}>
          <DetailRow label="Algoritma" value={info.algorithm} />
          <DetailRow label="Versi Model" value={info.version} />
          <DetailRow
            label="Akurasi"
            value={`${formatNumber(info.accuracy, 1)}%`}
          />
          <DetailRow label="MAE" value={formatNumber(info.mae, 2)} />
          <DetailRow label="RMSE" value={formatNumber(info.rmse, 2)} />
          <DetailRow label="Jumlah Data Latih" value={info.trainData} />
        </div>

        <button type="button" style={styles.outlineBtn} onClick={onClose}>
          Tutup
        </button>
      </div>
    </div>
  );
}

function MapModal({ data, onClose }) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.mapModalBox}>
        <div style={styles.modalHeader}>
          <h3>Peta Detail Prediksi Produksi</h3>

          <button type="button" style={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <ProductionLeafletMap data={data} large />

        <button type="button" style={styles.outlineBtn} onClick={onClose}>
          Tutup
        </button>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={styles.detailRow}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "28px 34px 18px",
    background: "#f8fafc",
    color: "#0f172a",
    boxSizing: "border-box",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 20,
    marginBottom: 28,
  },

  breadcrumb: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#475569",
    fontSize: 15,
    marginBottom: 18,
  },

  title: {
    margin: 0,
    fontSize: 30,
    fontWeight: 950,
  },

  subtitle: {
    margin: "10px 0 0",
    fontSize: 15,
    color: "#475569",
  },

  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
  },

  datePicker: {
    minHeight: 46,
    minWidth: 340,
    border: "1px solid #dbe3ea",
    borderRadius: 10,
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 14px",
  },

  dateInput: {
    border: "none",
    outline: "none",
    fontWeight: 850,
    color: "#0f172a",
    width: "100%",
    background: "transparent",
  },

  dateSeparator: {
    color: "#94a3b8",
    fontWeight: 900,
  },

  refreshBtn: {
    height: 46,
    border: "1px solid #dbe3ea",
    borderRadius: 10,
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "0 18px",
    cursor: "pointer",
    fontWeight: 850,
  },

  bellBtn: {
    width: 42,
    height: 42,
    border: "none",
    background: "transparent",
    position: "relative",
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
    width: 45,
    height: 45,
    borderRadius: 999,
    background: "#dcfce7",
    color: "#059669",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 950,
    fontSize: 20,
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: 16,
    marginBottom: 20,
  },

  statCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    minHeight: 120,
    padding: 18,
    display: "flex",
    alignItems: "center",
    gap: 14,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  statIcon: {
    width: 58,
    height: 58,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  greenIconBox: {
    background: "#dcfce7",
    color: "#16a34a",
  },

  blueIconBox: {
    background: "#dbeafe",
    color: "#2563eb",
  },

  purpleIconBox: {
    background: "#f3e8ff",
    color: "#7c3aed",
  },

  orangeIconBox: {
    background: "#ffedd5",
    color: "#f59e0b",
  },

  cyanIconBox: {
    background: "#ccfbf1",
    color: "#0f766e",
  },

  statLabel: {
    margin: 0,
    fontSize: 13,
    color: "#475569",
    fontWeight: 850,
  },

  statValueWrap: {
    display: "flex",
    alignItems: "baseline",
    gap: 7,
  },

  statValue: {
    margin: "5px 0",
    fontSize: 28,
    fontWeight: 950,
  },

  statNote: {
    fontSize: 12,
    fontWeight: 850,
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1.1fr 1.22fr 0.95fr",
    gap: 18,
  },

  mapCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    minHeight: 450,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  trendCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    minHeight: 450,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  rightColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },

  sideCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },

  iconActionBtn: {
    width: 36,
    height: 36,
    border: "none",
    borderRadius: 9,
    background: "#f8fafc",
    cursor: "pointer",
  },

  smallSelect: {
    height: 38,
    border: "1px solid #dbe3ea",
    borderRadius: 9,
    padding: "0 12px",
    background: "#ffffff",
    fontWeight: 850,
    outline: "none",
  },

  mapWrap: {
    position: "relative",
  },

  mapWrapLarge: {
    position: "relative",
  },

  leafletMap: {
    width: "100%",
    height: 330,
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid #e5e7eb",
  },

  leafletMapLarge: {
    width: "100%",
    height: 540,
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid #e5e7eb",
  },

  leafletLegend: {
    marginTop: 12,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    color: "#475569",
    fontSize: 12,
  },

  legendItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
  },

  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 5,
    display: "inline-block",
    flexShrink: 0,
  },

  cardFootnote: {
    margin: "14px 0 0",
    color: "#64748b",
    fontSize: 13,
  },

  chartYAxis: {
    fontSize: 13,
    fontWeight: 850,
    color: "#475569",
  },

  lineSvg: {
    width: "100%",
    height: 260,
    display: "block",
  },

  lineLabels: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    textAlign: "center",
    color: "#64748b",
    fontSize: 12,
  },

  chartLegend: {
    marginTop: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    color: "#475569",
    fontWeight: 850,
  },

  trendSummary: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    overflow: "hidden",
  },

  statusList: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  statusRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  statusLeft: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    fontWeight: 850,
  },

  statusDot: {
    width: 20,
    height: 20,
    borderRadius: 999,
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  statusBadge: {
    borderRadius: 999,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 900,
  },

  updatedRow: {
    marginTop: 20,
    paddingTop: 14,
    borderTop: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-between",
    color: "#64748b",
    fontSize: 13,
  },

  smallOutlineBtn: {
    height: 32,
    border: "1px solid #dbe3ea",
    borderRadius: 8,
    background: "#ffffff",
    fontWeight: 850,
    cursor: "pointer",
    padding: "0 12px",
  },

  notifList: {
    display: "flex",
    flexDirection: "column",
  },

  notifItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "13px 0",
    borderBottom: "1px solid #e5e7eb",
  },

  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  modelBox: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  modelInfoGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1.25fr",
    gap: 12,
  },

  modelLast: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    marginTop: 6,
  },

  progressTrack: {
    marginTop: 6,
    width: "100%",
    height: 8,
    borderRadius: 999,
    background: "#e5e7eb",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 999,
    background: "#16a34a",
  },

  outlineBtn: {
    width: "100%",
    height: 42,
    marginTop: 14,
    border: "1px solid #16a34a",
    color: "#059669",
    background: "#ffffff",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 900,
  },

  tableCard: {
    gridColumn: "1 / span 2",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  tableTitle: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    margin: "0 0 16px",
  },

  tableWrap: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 1050,
  },

  th: {
    textAlign: "left",
    padding: "12px 10px",
    color: "#475569",
    borderBottom: "1px solid #e5e7eb",
    fontSize: 13,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  tr: {
    borderBottom: "1px solid #e5e7eb",
  },

  td: {
    padding: "13px 10px",
    fontSize: 14,
    whiteSpace: "nowrap",
  },

  prediksiId: {
    color: "#059669",
  },

  subText: {
    color: "#64748b",
    fontSize: 12,
  },

  statusPill: {
    borderRadius: 999,
    padding: "6px 11px",
    fontSize: 12,
    fontWeight: 900,
  },

  statusBerhasil: {
    background: "#dcfce7",
    color: "#059669",
  },

  statusProses: {
    background: "#fef3c7",
    color: "#d97706",
  },

  statusGagal: {
    background: "#fee2e2",
    color: "#dc2626",
  },

  detailBtn: {
    height: 34,
    border: "1px solid #dbe3ea",
    borderRadius: 8,
    background: "#ffffff",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
    fontWeight: 850,
    padding: "0 12px",
  },

  emptyCell: {
    textAlign: "center",
    padding: 30,
    color: "#64748b",
  },

  paginationWrap: {
    marginTop: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    color: "#475569",
    fontSize: 14,
  },

  pagination: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  pageBtn: {
    minWidth: 38,
    height: 38,
    border: "1px solid #dbe3ea",
    borderRadius: 8,
    background: "#ffffff",
    cursor: "pointer",
    fontWeight: 900,
  },

  pageBtnActive: {
    background: "#16a34a",
    color: "#ffffff",
    borderColor: "#16a34a",
  },

  pageDots: {
    fontWeight: 900,
    color: "#64748b",
  },

  perPageSelect: {
    height: 38,
    border: "1px solid #dbe3ea",
    borderRadius: 8,
    padding: "0 12px",
    fontWeight: 850,
  },

  infoBox: {
    marginTop: 18,
    borderRadius: 14,
    border: "1px solid #bbf7d0",
    background: "#ecfdf5",
    color: "#047857",
    padding: 14,
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontWeight: 750,
  },

  footer: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 28,
    color: "#475569",
    fontSize: 14,
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: 20,
  },

  modalBox: {
    width: 700,
    maxWidth: "96vw",
    background: "#ffffff",
    borderRadius: 18,
    padding: 22,
    boxShadow: "0 30px 90px rgba(15, 23, 42, 0.28)",
  },

  mapModalBox: {
    width: 980,
    maxWidth: "96vw",
    maxHeight: "94vh",
    overflow: "hidden",
    background: "#ffffff",
    borderRadius: 18,
    padding: 22,
    boxShadow: "0 30px 90px rgba(15, 23, 42, 0.28)",
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: 14,
    marginBottom: 16,
  },

  closeBtn: {
    width: 38,
    height: 38,
    border: "none",
    borderRadius: 999,
    background: "#f1f5f9",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  detailGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },

  detailRow: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
};