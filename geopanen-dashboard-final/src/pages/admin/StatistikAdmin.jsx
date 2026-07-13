import { useEffect, useMemo, useState } from "react";
import api from "../../services/api";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import {
  RefreshCcw,
  Bell,
  CalendarDays,
  ChevronDown,
  Users,
  MapPinned,
  Brain,
  MapPin,
  Leaf,
  CalendarCheck,
  BarChart3,
  Info,
  Download,
  FileText,
  Printer,
  Cloud,
  UserCheck,
  PieChart,
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
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.prediksi)) return data.prediksi;
  if (Array.isArray(data?.riwayat)) return data.riwayat;
  if (Array.isArray(data?.lahan)) return data.lahan;
  if (Array.isArray(data?.petani)) return data.petani;

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

const formatPercent = (value, digit = 1) => {
  return `${formatNumber(value, digit)}%`;
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

const isDateInRange = (value, startDate, endDate) => {
  if (!startDate && !endDate) return true;
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const end = endDate ? new Date(`${endDate}T23:59:59`) : null;

  if (start && date < start) return false;
  if (end && date > end) return false;

  return true;
};

const startOfDay = (dateValue) => {
  const date = new Date(dateValue);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (dateValue) => {
  const date = new Date(dateValue);
  date.setHours(23, 59, 59, 999);
  return date;
};

const addDays = (dateValue, days) => {
  const date = new Date(dateValue);
  date.setDate(date.getDate() + days);
  return date;
};

const isBetweenDate = (value, start, end) => {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  return date >= start && date <= end;
};

const getChangePercent = (current, previous) => {
  if (previous <= 0 && current > 0) return 100;
  if (previous <= 0) return 0;

  return ((current - previous) / previous) * 100;
};

const getChangeNote = (value, label) => {
  const arrow = value < 0 ? "↓" : "↑";
  return `${arrow} ${formatPercent(Math.abs(value), 1)} ${label}`;
};

const getChangeColor = (value) => {
  return value < 0 ? "#ef4444" : "#059669";
};

const getInitial = (value) => {
  const text = String(value || "A").trim();
  return text.charAt(0).toUpperCase();
};

const getCreatedAt = (item) => {
  return item?.created_at || item?.tanggal || item?.tanggal_prediksi || null;
};

const getNamaKecamatan = (item) => {
  return item?.nama_kecamatan || item?.kecamatan || "-";
};

const getNamaDesa = (item) => {
  return item?.nama_desa || item?.desa || "-";
};

const getLuasHa = (item) => {
  const luasHa = toNumber(item?.luas_ha ?? item?.luas, 0);

  if (luasHa > 0 && luasHa <= 20) return luasHa;

  const luasM2 = toNumber(item?.luas_m2, 0);
  if (luasM2 > 0) return luasM2 / 10000;

  if (luasHa > 20) return luasHa / 10000;

  return 0;
};

const getPrediksiTon = (item) => {
  const ton = toNumber(
    item?.prediksi_ton ??
      item?.hasil_prediksi_ton ??
      item?.produksi_prediksi ??
      item?.hasil_prediksi ??
      item?.prediksi,
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

const getVarietas = (item) => {
  return (
    item?.varietas ||
    item?.varietas_prediksi ||
    item?.jenis_padi ||
    item?.komoditas ||
    "Lainnya"
  );
};

const getPeriode = (item) => {
  return item?.periode || item?.musim_tanam || item?.periode_tanam || "2026";
};

const monthKey = (dateValue) => {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return null;

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const monthLabel = (key) => {
  if (!key) return "-";

  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);

  return date.toLocaleDateString("id-ID", {
    month: "short",
    year: "numeric",
  });
};

const isThisMonth = (value) => {
  if (!value) return false;

  const date = new Date(value);
  const now = new Date();

  if (Number.isNaN(date.getTime())) return false;

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
};

const isToday = (value) => {
  if (!value) return false;

  const date = new Date(value);
  const now = new Date();

  if (Number.isNaN(date.getTime())) return false;

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
};

const escapeCsv = (value) => {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
};

export default function StatistikAdmin() {
  const currentUser = useMemo(() => getCurrentUser(), []);
  const appVersion = import.meta.env.VITE_APP_VERSION || "1.0.0";

  const [statistik, setStatistik] = useState({});
  const [prediksiList, setPrediksiList] = useState([]);
  const [petaniList, setPetaniList] = useState([]);
  const [lahanList, setLahanList] = useState([]);
  const [kecamatanList, setKecamatanList] = useState([]);
  const [cuacaList, setCuacaList] = useState([]);
  const [notifCount, setNotifCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [endDate, setEndDate] = useState(getDefaultEndDate());
  const [trendRange, setTrendRange] = useState("6");

  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalType, setModalType] = useState("");
  const [modalData, setModalData] = useState([]);

  const [showMapModal, setShowMapModal] = useState(false);

  const openModal = (title, type, data) => {
    setModalTitle(title);
    setModalType(type);
    setModalData(Array.isArray(data) ? data : []);
    setShowModal(true);
  };

  const closeModal = () => {
    setModalTitle("");
    setModalType("");
    setModalData([]);
    setShowModal(false);
  };

  const tryGet = async (paths) => {
    for (const path of paths) {
      try {
        const res = await api.get(path);
        return res.data;
      } catch {
        // lanjut ke endpoint cadangan
      }
    }

    return null;
  };

  const fetchStatistik = async () => {
    try {
      setLoading(true);

      const [
        statistikPayload,
        prediksiPayload,
        petaniPayload,
        lahanPayload,
        kecamatanPayload,
        cuacaPayload,
        notifPayload,
      ] = await Promise.all([
        tryGet(["/statistik"]),
        tryGet(["/prediksi"]),
        tryGet(["/admin/petani", "/petani"]),
        tryGet(["/admin/lahan", "/lahan"]),
        tryGet(["/admin/kecamatan", "/kecamatan"]),
        tryGet(["/admin/cuaca", "/cuaca"]),
        tryGet(["/admin/notifikasi/unread-count"]),
      ]);

      setStatistik(statistikPayload?.data || statistikPayload || {});
      setPrediksiList(normalizeApiList(prediksiPayload));
      setPetaniList(normalizeApiList(petaniPayload));
      setLahanList(normalizeApiList(lahanPayload));
      setKecamatanList(normalizeApiList(kecamatanPayload));
      setCuacaList(normalizeApiList(cuacaPayload));

      setNotifCount(
        Number(
          notifPayload?.count ||
            notifPayload?.data?.count ||
            notifPayload?.data?.total ||
            notifPayload?.total ||
            0
        )
      );
    } catch (err) {
      console.log("ERROR STATISTIK:", err.response?.data || err);
      setStatistik({});
      setPrediksiList([]);
      setPetaniList([]);
      setLahanList([]);
      setKecamatanList([]);
      setCuacaList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatistik();
  }, []);

  const enrichedPrediksi = useMemo(() => {
    return prediksiList.map((item) => ({
      ...item,
      created_at_view: getCreatedAt(item),
      nama_kecamatan_view: getNamaKecamatan(item),
      nama_desa_view: getNamaDesa(item),
      luas_ha_view: getLuasHa(item),
      prediksi_ton_view: getPrediksiTon(item),
      prediksi_kg_view: getPrediksiKg(item),
      produktivitas_view: toNumber(
        item?.produktivitas || item?.produktivitas_ton_ha,
        0
      ),
      varietas_view: getVarietas(item),
      periode_view: getPeriode(item),
      petani_id_view: item?.petani_id || item?.user_id || item?.id_petani || null,
    }));
  }, [prediksiList]);

  const enrichedLahan = useMemo(() => {
    return lahanList.map((item) => ({
      ...item,
      created_at_view: getCreatedAt(item),
      nama_kecamatan_view: getNamaKecamatan(item),
      nama_desa_view: getNamaDesa(item),
      luas_ha_view: getLuasHa(item),
      varietas_view: getVarietas(item),
      petani_id_view: item?.petani_id || item?.user_id || item?.id_petani || null,
    }));
  }, [lahanList]);

  const filteredPrediksi = useMemo(() => {
    return enrichedPrediksi.filter((item) =>
      isDateInRange(item.created_at_view, startDate, endDate)
    );
  }, [enrichedPrediksi, startDate, endDate]);

  const uniqueLahanFromPrediksi = useMemo(() => {
    const map = new Map();

    enrichedPrediksi.forEach((item) => {
      const key = item.lahan_id || item.sawah_id || item.id;
      if (!key) return;

      if (!map.has(key)) {
        map.set(key, item);
      }
    });

    return Array.from(map.values());
  }, [enrichedPrediksi]);

  const baseLahan =
    enrichedLahan.length > 0 ? enrichedLahan : uniqueLahanFromPrediksi;

  const summary = useMemo(() => {
    const totalPrediksi =
      filteredPrediksi.length || toNumber(statistik.total_prediksi, 0);

    const totalProduksi = filteredPrediksi.reduce(
      (sum, item) => sum + item.prediksi_ton_view,
      0
    );

    const totalLuasFromLahan = baseLahan.reduce(
      (sum, item) => sum + item.luas_ha_view,
      0
    );

    const totalLuas =
      totalLuasFromLahan > 0
        ? totalLuasFromLahan
        : toNumber(statistik.total_luas || statistik.total_lahan_ha, 0);

    const totalPetani =
      petaniList.length ||
      toNumber(statistik.total_petani, 0) ||
      new Set(
        [...enrichedPrediksi, ...baseLahan]
          .map((item) => item.petani_id_view)
          .filter(Boolean)
      ).size;

    const kecamatanAktif =
      new Set(
        [...filteredPrediksi, ...baseLahan]
          .map((item) => item.nama_kecamatan_view)
          .filter((item) => item && item !== "-")
      ).size ||
      kecamatanList.length ||
      toNumber(statistik.kecamatan_aktif, 0);

    const rataPanen =
      totalLuas > 0
        ? totalProduksi / totalLuas
        : toNumber(statistik.rata_rata_ton || statistik.rata_rata_panen, 0);

    const prediksiBulanIni =
      filteredPrediksi.filter((item) => isThisMonth(item.created_at_view))
        .length || toNumber(statistik.prediksi_bulan_ini, 0);

    return {
      totalPetani,
      totalLuas,
      totalPrediksi,
      kecamatanAktif,
      rataPanen,
      prediksiBulanIni,
      totalProduksi,
    };
  }, [
    filteredPrediksi,
    statistik,
    petaniList,
    enrichedPrediksi,
    baseLahan,
    kecamatanList,
  ]);

  const change = useMemo(() => {
    const now = new Date();

    const weekStart = startOfDay(addDays(now, -6));
    const weekEnd = endOfDay(now);

    const prevWeekStart = startOfDay(addDays(now, -13));
    const prevWeekEnd = endOfDay(addDays(now, -7));

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = endOfDay(now);

    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = endOfDay(
      new Date(now.getFullYear(), now.getMonth(), 0)
    );

    const countRows = (rows, start, end) => {
      return rows.filter((item) => isBetweenDate(item.created_at_view, start, end))
        .length;
    };

    const currentWeekPrediksi = countRows(enrichedPrediksi, weekStart, weekEnd);
    const prevWeekPrediksi = countRows(
      enrichedPrediksi,
      prevWeekStart,
      prevWeekEnd
    );

    const currentMonthPrediksi = countRows(
      enrichedPrediksi,
      monthStart,
      monthEnd
    );

    const prevMonthPrediksi = countRows(
      enrichedPrediksi,
      prevMonthStart,
      prevMonthEnd
    );

    const currentWeekPetani = countRows(
      petaniList.map((item) => ({
        ...item,
        created_at_view: getCreatedAt(item),
      })),
      weekStart,
      weekEnd
    );

    const prevWeekPetani = countRows(
      petaniList.map((item) => ({
        ...item,
        created_at_view: getCreatedAt(item),
      })),
      prevWeekStart,
      prevWeekEnd
    );

    const currentWeekLahan = countRows(baseLahan, weekStart, weekEnd);
    const prevWeekLahan = countRows(baseLahan, prevWeekStart, prevWeekEnd);

    return {
      petani: getChangePercent(currentWeekPetani, prevWeekPetani),
      lahan: getChangePercent(currentWeekLahan, prevWeekLahan),
      prediksi: getChangePercent(currentWeekPrediksi, prevWeekPrediksi),
      bulanIni: getChangePercent(currentMonthPrediksi, prevMonthPrediksi),
    };
  }, [enrichedPrediksi, petaniList, baseLahan]);

  const trendBulanan = useMemo(() => {
    const now = new Date();
    const totalMonth = Number(trendRange || 6);
    const map = new Map();

    for (let i = totalMonth - 1; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}`;

      map.set(key, {
        key,
        label: monthLabel(key),
        jumlah: 0,
      });
    }

    enrichedPrediksi.forEach((item) => {
      const key = monthKey(item.created_at_view);

      if (!key || !map.has(key)) return;

      const current = map.get(key);
      current.jumlah += 1;
      map.set(key, current);
    });

    return Array.from(map.values());
  }, [enrichedPrediksi, trendRange]);

  const prediksiPerKecamatan = useMemo(() => {
    const map = new Map();

    filteredPrediksi.forEach((item) => {
      const key = item.nama_kecamatan_view || "-";

      if (key === "-") return;

      if (!map.has(key)) {
        map.set(key, {
          kecamatan: key,
          jumlah: 0,
          produksi: 0,
          luas: 0,
        });
      }

      const current = map.get(key);
      current.jumlah += 1;
      current.produksi += item.prediksi_ton_view;
      current.luas += item.luas_ha_view;

      map.set(key, current);
    });

    return Array.from(map.values()).sort((a, b) => b.jumlah - a.jumlah);
  }, [filteredPrediksi]);

  const topKecamatan = useMemo(() => {
    const map = new Map();

    filteredPrediksi.forEach((item) => {
      const key = item.nama_kecamatan_view || "-";
      if (key === "-") return;

      if (!map.has(key)) {
        map.set(key, {
          kecamatan: key,
          produksi: 0,
          luas: 0,
          count: 0,
        });
      }

      const current = map.get(key);
      current.produksi += item.prediksi_ton_view;
      current.luas += item.luas_ha_view;
      current.count += 1;

      map.set(key, current);
    });

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        rata:
          item.luas > 0
            ? item.produksi / item.luas
            : item.count > 0
            ? item.produksi / item.count
            : 0,
      }))
      .sort((a, b) => b.rata - a.rata)
      .slice(0, 5);
  }, [filteredPrediksi]);

  const varietasChart = useMemo(() => {
    const map = new Map();

    baseLahan.forEach((item) => {
      const key = item.varietas_view || "Lainnya";
      const luas = item.luas_ha_view || 0;

      map.set(key, (map.get(key) || 0) + luas);
    });

    const total = Array.from(map.values()).reduce((sum, value) => sum + value, 0);

    return Array.from(map.entries())
      .map(([name, value]) => ({
        name,
        value,
        percent: total > 0 ? (value / total) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [baseLahan]);

  const periodeChart = useMemo(() => {
    const map = new Map();

    filteredPrediksi.forEach((item) => {
      const key = item.periode_view || "Tidak Ada Periode";
      map.set(key, (map.get(key) || 0) + item.prediksi_ton_view);
    });

    const total = Array.from(map.values()).reduce((sum, value) => sum + value, 0);

    return Array.from(map.entries())
      .map(([name, value]) => ({
        name,
        value,
        percent: total > 0 ? (value / total) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 4);
  }, [filteredPrediksi]);

  const sebaranLuas = useMemo(() => {
    const map = new Map();

    KECAMATAN_SUKOHARJO.forEach((item) => {
      map.set(item, 0);
    });

    baseLahan.forEach((item) => {
      const key = item.nama_kecamatan_view || "-";
      if (key === "-") return;

      map.set(key, (map.get(key) || 0) + item.luas_ha_view);
    });

    return Array.from(map.entries()).map(([name, value]) => ({
      name,
      value,
      coords: KECAMATAN_COORDS[name] || SUKOHARJO_CENTER,
    }));
  }, [baseLahan]);

  const aktivitasHariIni = useMemo(() => {
    const prediksiAiDibuat = enrichedPrediksi.filter((item) =>
      isToday(item.created_at_view)
    ).length;

    const petaniAktif =
      new Set(
        enrichedPrediksi
          .filter((item) => isToday(item.created_at_view))
          .map((item) => item.petani_id_view)
          .filter(Boolean)
      ).size || toNumber(statistik.petani_aktif_hari_ini, 0);

    const lahanBaru = baseLahan.filter((item) => isToday(item.created_at_view))
      .length;

    return [
      {
        label: "Prediksi AI Dibuat",
        value: prediksiAiDibuat,
        icon: <Brain size={15} />,
        color: "#16a34a",
      },
      {
        label: "Petani Aktif",
        value: petaniAktif,
        icon: <Users size={15} />,
        color: "#22c55e",
      },
      {
        label: "Penyuluh Login",
        value: toNumber(statistik.penyuluh_login_hari_ini, 0),
        icon: <UserCheck size={15} />,
        color: "#10b981",
      },
      {
        label: "Data Lahan Baru",
        value: lahanBaru,
        icon: <MapPinned size={15} />,
        color: "#3b82f6",
      },
      {
        label: "Cuaca Realtime",
        value: toNumber(statistik.update_cuaca_hari_ini, 0),
        icon: <Cloud size={15} />,
        color: "#60a5fa",
      },
    ];
  }, [enrichedPrediksi, statistik, baseLahan]);

  const exportCsv = () => {
    const headers = [
      "Kecamatan",
      "Jumlah Prediksi",
      "Produksi Ton",
      "Luas Ha",
      "Rata Panen Ton Ha",
    ];

    const rows = prediksiPerKecamatan.map((item) => [
      item.kecamatan,
      item.jumlah,
      item.produksi,
      item.luas,
      item.luas > 0 ? item.produksi / item.luas : 0,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(";"))
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `statistik-geopanen-${Date.now()}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const doc = new jsPDF("p", "mm", "a4");

    doc.setFontSize(16);
    doc.text("Laporan Statistik GeoPanen", 14, 16);

    doc.setFontSize(10);
    doc.text(`Periode: ${startDate || "-"} sampai ${endDate || "-"}`, 14, 24);

    autoTable(doc, {
      startY: 32,
      head: [["Ringkasan", "Nilai"]],
      body: [
        ["Total Petani", formatNumber(summary.totalPetani, 0)],
        ["Total Lahan", `${formatNumber(summary.totalLuas, 2)} Ha`],
        ["Total Prediksi AI", formatNumber(summary.totalPrediksi, 0)],
        ["Kecamatan Aktif", formatNumber(summary.kecamatanAktif, 0)],
        ["Rata-rata Panen", `${formatNumber(summary.rataPanen, 2)} Ton/Ha`],
        ["Prediksi Bulan Ini", formatNumber(summary.prediksiBulanIni, 0)],
        ["Penyuluh Login Hari Ini", statistik.penyuluh_login_hari_ini || 0],
        ["Cuaca Realtime", "Tidak disimpan di database"],
      ],
      styles: {
        fontSize: 9,
      },
      headStyles: {
        fillColor: [22, 163, 74],
      },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [["Kecamatan", "Jumlah Prediksi", "Produksi Ton", "Luas Ha", "Rata Ton/Ha"]],
      body: prediksiPerKecamatan.map((item) => [
        item.kecamatan,
        formatNumber(item.jumlah, 0),
        formatNumber(item.produksi, 2),
        formatNumber(item.luas, 2),
        formatNumber(item.luas > 0 ? item.produksi / item.luas : 0, 2),
      ]),
      styles: {
        fontSize: 8,
      },
      headStyles: {
        fillColor: [22, 163, 74],
      },
    });

    doc.save(`laporan-statistik-geopanen-${Date.now()}.pdf`);
  };

  const cetakLaporan = () => {
    window.print();
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.breadcrumb}>
            <span>Dashboard</span>
            <span>/</span>
            <strong>Statistik</strong>
          </div>

          <h1 style={styles.title}>
            <BarChart3 size={30} color="#16a34a" />
            Statistik Sistem
          </h1>

          <p style={styles.subtitle}>
            Ringkasan data dan analisis penggunaan sistem GeoPanen.
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

          <button type="button" style={styles.refreshBtn} onClick={fetchStatistik}>
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
          value={loading ? "..." : formatNumber(summary.totalPetani, 0)}
          smallText=""
          note={getChangeNote(change.petani, "dari minggu lalu")}
          noteColor={getChangeColor(change.petani)}
        />

        <StatCard
          icon={<MapPinned size={34} />}
          iconBoxStyle={styles.blueIconBox}
          label="Total Lahan"
          value={loading ? "..." : formatNumber(summary.totalLuas, 2)}
          smallText="Ha"
          note={getChangeNote(change.lahan, "dari minggu lalu")}
          noteColor={getChangeColor(change.lahan)}
        />

        <StatCard
          icon={<Brain size={34} />}
          iconBoxStyle={styles.purpleIconBox}
          label="Total Prediksi AI"
          value={loading ? "..." : formatNumber(summary.totalPrediksi, 0)}
          smallText=""
          note={getChangeNote(change.prediksi, "dari minggu lalu")}
          noteColor={getChangeColor(change.prediksi)}
        />

        <StatCard
          icon={<MapPin size={34} />}
          iconBoxStyle={styles.orangeIconBox}
          label="Kecamatan Aktif"
          value={loading ? "..." : formatNumber(summary.kecamatanAktif, 0)}
          smallText=""
          note={`dari ${kecamatanList.length || 12} kecamatan`}
          noteColor="#475569"
        />

        <StatCard
          icon={<Leaf size={34} />}
          iconBoxStyle={styles.greenIconBox}
          label="Rata-rata Panen"
          value={loading ? "..." : formatNumber(summary.rataPanen, 2)}
          smallText="Ton/Ha"
          note="Berdasarkan prediksi"
          noteColor="#475569"
        />

        <StatCard
          icon={<CalendarCheck size={34} />}
          iconBoxStyle={styles.orangeIconBox}
          label="Prediksi Bulan Ini"
          value={loading ? "..." : formatNumber(summary.prediksiBulanIni, 0)}
          smallText=""
          note={getChangeNote(change.bulanIni, "dari bulan lalu")}
          noteColor={getChangeColor(change.bulanIni)}
        />
      </section>

      <main style={styles.gridLayout}>
        <section style={styles.trendCard}>
          <div style={styles.cardTop}>
            <h3>Tren Prediksi AI ({trendRange} Bulan Terakhir)</h3>

            <select
              value={trendRange}
              onChange={(e) => setTrendRange(e.target.value)}
              style={styles.smallSelect}
            >
              <option value="6">6 Bulan Terakhir</option>
              <option value="12">12 Bulan Terakhir</option>
            </select>
          </div>

          <LineChart data={trendBulanan} />
        </section>

        <section style={styles.chartCard}>
          <div style={styles.cardTop}>
            <h3>Prediksi per Kecamatan</h3>

            <button
              type="button"
              style={styles.linkBtn}
              onClick={() =>
                openModal(
                  "Detail Prediksi per Kecamatan",
                  "prediksi_kecamatan",
                  prediksiPerKecamatan
                )
              }
            >
              Lihat Semua
            </button>
          </div>

          <HorizontalBarChart data={prediksiPerKecamatan} />
        </section>

        <aside style={styles.sideColumn}>
          <section style={styles.sideCard}>
            <div style={styles.cardTop}>
              <div>
                <h3>Top Kecamatan Produktif</h3>
                <p style={styles.smallText}>(Berdasarkan Rata-rata Panen)</p>
              </div>

              <button
                type="button"
                style={styles.linkBtn}
                onClick={() =>
                  openModal("Top Kecamatan Produktif", "top_kecamatan", topKecamatan)
                }
              >
                Lihat Semua
              </button>
            </div>

            <TopKecamatanTable data={topKecamatan} />
          </section>

          <section style={styles.sideCard}>
            <div style={styles.cardTop}>
              <h3>Aktivitas Sistem (Hari Ini)</h3>

              <button
                type="button"
                style={styles.linkBtn}
                onClick={() =>
                  openModal(
                    "Aktivitas Sistem Hari Ini",
                    "aktivitas",
                    aktivitasHariIni
                  )
                }
              >
                Lihat Semua
              </button>
            </div>

            <div style={styles.activityList}>
              {aktivitasHariIni.map((item) => (
                <div key={item.label} style={styles.activityItem}>
                  <div
                    style={{
                      ...styles.activityIcon,
                      background: `${item.color}18`,
                      color: item.color,
                    }}
                  >
                    {item.icon}
                  </div>

                  <span>{item.label}</span>
                  <strong>{formatNumber(item.value, 0)}</strong>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section style={styles.bottomCard}>
          <h3>Statistik Varietas Padi</h3>

          <DonutChart data={varietasChart} type="hectare" />

          <button
            type="button"
            style={styles.outlineBtn}
            onClick={() =>
              openModal("Detail Statistik Varietas Padi", "varietas", varietasChart)
            }
          >
            Lihat Detail →
          </button>
        </section>

        <section style={styles.bottomCard}>
          <h3>Prediksi Berdasarkan Periode Tanam</h3>

          <DonutChart data={periodeChart} type="ton" />

          <button
            type="button"
            style={styles.outlineBtn}
            onClick={() =>
              openModal(
                "Detail Prediksi Berdasarkan Periode Tanam",
                "periode",
                periodeChart
              )
            }
          >
            Lihat Detail →
          </button>
        </section>

        <section style={styles.mapCard}>
          <h3>Sebaran Luas Lahan per Kecamatan (Ha)</h3>

          <SebaranLuasMap data={sebaranLuas} />

          <button
            type="button"
            style={styles.outlineBtn}
            onClick={() => setShowMapModal(true)}
          >
            Lihat Peta Detail →
          </button>
        </section>

        <section style={styles.exportCard}>
          <h3>Export Laporan Statistik</h3>
          <p>Unduh laporan statistik dalam format berikut.</p>

          <div style={styles.exportList}>
            <button type="button" style={styles.exportAction} onClick={exportPdf}>
              <FileText size={19} color="#ef4444" />
              Export PDF
            </button>

            <button type="button" style={styles.exportAction} onClick={exportCsv}>
              <Download size={19} color="#16a34a" />
              Export Excel
            </button>

            <button type="button" style={styles.exportAction} onClick={cetakLaporan}>
              <Printer size={19} color="#2563eb" />
              Cetak Laporan
            </button>
          </div>
        </section>
      </main>

      <section style={styles.infoBox}>
        <Info size={24} />
        <div>
          <strong>Informasi</strong>
          <p>
            Data statistik diperbarui otomatis berdasarkan data terbaru yang masuk
            ke sistem GeoPanen.
          </p>
        </div>
      </section>

      {showModal && (
        <DetailModal
          title={modalTitle}
          type={modalType}
          data={modalData}
          onClose={closeModal}
        />
      )}

      {showMapModal && (
        <MapDetailModal
          data={sebaranLuas}
          onClose={() => setShowMapModal(false)}
        />
      )}

      <footer style={styles.footer}>
        <span>© 2026 GeoPanen. All rights reserved.</span>
        <span>Versi {appVersion}</span>
      </footer>

      <style>{`
        .leaflet-container {
          font-family: inherit;
        }

        @media print {
          button {
            display: none !important;
          }

          body {
            background: #ffffff !important;
          }
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

function LineChart({ data }) {
  const width = 640;
  const height = 300;
  const padding = 42;
  const maxValue = Math.max(10, ...data.map((item) => item.jumlah));
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;

  const points = data.map((item, index) => {
    const x =
      data.length === 1
        ? width / 2
        : padding + (index / (data.length - 1)) * usableWidth;

    const y = height - padding - (item.jumlah / maxValue) * usableHeight;

    return {
      ...item,
      x,
      y,
    };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${
          points[0].x
        } ${height - padding} Z`
      : "";

  return (
    <div style={styles.lineChartWrap}>
      <div style={styles.chartYAxis}>
        <span>Prediksi</span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={styles.lineSvg}
        preserveAspectRatio="none"
      >
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

        <path d={areaPath} fill="url(#greenGradient)" opacity="0.8" />
        <path d={linePath} fill="none" stroke="#15803d" strokeWidth="3" />

        <defs>
          <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {points.map((point) => (
          <g key={point.key}>
            <circle cx={point.x} cy={point.y} r="6" fill="#15803d" />
            <text
              x={point.x}
              y={point.y - 14}
              textAnchor="middle"
              fontSize="13"
              fontWeight="800"
              fill="#0f172a"
            >
              {formatNumber(point.jumlah, 0)}
            </text>
          </g>
        ))}
      </svg>

      <div
        style={{
          ...styles.lineLabels,
          gridTemplateColumns: `repeat(${Math.max(data.length, 1)}, 1fr)`,
        }}
      >
        {data.map((item) => (
          <span key={item.key}>{item.label}</span>
        ))}
      </div>
    </div>
  );
}

function HorizontalBarChart({ data }) {
  const maxValue = Math.max(1, ...data.map((item) => item.jumlah));

  if (!data.length) {
    return <div style={styles.emptyBox}>Belum ada data prediksi kecamatan.</div>;
  }

  return (
    <div style={styles.horizontalChart}>
      {data.slice(0, 10).map((item) => {
        const width = `${Math.max(5, (item.jumlah / maxValue) * 100)}%`;

        return (
          <div key={item.kecamatan} style={styles.horizontalRow}>
            <span style={styles.horizontalLabel}>{item.kecamatan}</span>

            <div style={styles.horizontalTrack}>
              <div style={{ ...styles.horizontalFill, width }} />
            </div>

            <strong>{formatNumber(item.jumlah, 0)}</strong>
          </div>
        );
      })}

      <div style={styles.axisLabel}>Jumlah Prediksi</div>
    </div>
  );
}

function TopKecamatanTable({ data }) {
  if (!data.length) {
    return <div style={styles.emptyBox}>Belum ada data kecamatan produktif.</div>;
  }

  return (
    <table style={styles.topTable}>
      <thead>
        <tr>
          <th style={styles.topTh}>#</th>
          <th style={styles.topTh}>Kecamatan</th>
          <th style={styles.topTh}>Rata-rata Panen (Ton/Ha)</th>
        </tr>
      </thead>

      <tbody>
        {data.map((item, index) => (
          <tr key={item.kecamatan}>
            <td style={styles.topTd}>{index + 1}</td>
            <td style={styles.topTd}>{item.kecamatan}</td>
            <td style={styles.topTd}>{formatNumber(item.rata, 2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DonutChart({ data, type }) {
  const colors = ["#16a34a", "#f59e0b", "#2563eb", "#7c3aed", "#94a3b8"];

  const total = data.reduce((sum, item) => sum + item.value, 0);

  const gradient = useMemo(() => {
    if (!data.length || total <= 0) {
      return "conic-gradient(#e5e7eb 0deg 360deg)";
    }

    let start = 0;

    const parts = data.map((item, index) => {
      const angle = (item.value / total) * 360;
      const end = start + angle;
      const part = `${colors[index % colors.length]} ${start}deg ${end}deg`;
      start = end;
      return part;
    });

    return `conic-gradient(${parts.join(", ")})`;
  }, [data, total]);

  return (
    <div style={styles.donutWrap}>
      <div style={{ ...styles.donut, background: gradient }}>
        <div style={styles.donutInner}>
          <PieChart size={24} color="#16a34a" />
        </div>
      </div>

      <div style={styles.donutLegend}>
        {data.length === 0 && <span>Belum ada data.</span>}

        {data.map((item, index) => (
          <div key={item.name} style={styles.legendRow}>
            <span
              style={{
                ...styles.legendDot,
                background: colors[index % colors.length],
              }}
            />

            <strong>{item.name}</strong>

            <span>{formatPercent(item.percent, 0)}</span>

            <span>
              {type === "hectare"
                ? `(${formatNumber(item.value, 2)} Ha)`
                : `(${formatNumber(item.value, 2)} Ton)`}
            </span>
          </div>
        ))}
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

function SebaranLuasMap({ data, large = false }) {
  const maxValue = Math.max(0, ...data.map((item) => item.value));

  const getMarkerColor = (value) => {
    if (value <= 0) return "#94a3b8";
    if (maxValue <= 0) return "#94a3b8";
    if (value >= maxValue * 0.7) return "#16a34a";
    if (value >= maxValue * 0.35) return "#f59e0b";
    return "#ef4444";
  };

  const getMarkerRadius = (value) => {
    if (maxValue <= 0 || value <= 0) return large ? 11 : 8;

    return Math.max(
      large ? 12 : 9,
      Math.min(large ? 30 : 22, 8 + (value / maxValue) * (large ? 24 : 16))
    );
  };

  const dataKey = data
    .map((item) => `${item.name}-${formatNumber(item.value, 4)}-${large}`)
    .join("|");

  return (
    <div style={styles.mapWrap}>
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

        {data.map((item) => {
          const color = getMarkerColor(item.value);

          return (
            <CircleMarker
              key={item.name}
              center={item.coords}
              radius={getMarkerRadius(item.value)}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.75,
                weight: 2,
              }}
            >
              <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                <strong>{item.name}</strong>
                <br />
                {formatNumber(item.value, 4)} Ha
              </Tooltip>

              <Popup>
                <div style={{ minWidth: 160 }}>
                  <strong>{item.name}</strong>
                  <p style={{ margin: "6px 0 0" }}>
                    Luas lahan: {formatNumber(item.value, 4)} Ha
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      <div style={styles.mapLegend}>
        <Legend color="#16a34a" text="Luas tinggi" />
        <Legend color="#f59e0b" text="Luas sedang" />
        <Legend color="#ef4444" text="Luas rendah" />
        <Legend color="#94a3b8" text="Belum ada data" />
      </div>
    </div>
  );
}

function Legend({ color, text }) {
  return (
    <div style={styles.mapLegendRow}>
      <span style={{ ...styles.legendDot, background: color }} />
      <span>{text}</span>
    </div>
  );
}

function DetailModal({ title, type, data, onClose }) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalBox}>
        <div style={styles.modalHeader}>
          <h3>{title}</h3>

          <button type="button" style={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div style={styles.modalBody}>
          {data.length === 0 ? (
            <div style={styles.emptyBox}>Belum ada data.</div>
          ) : (
            <table style={styles.modalTable}>
              <thead>
                <tr>
                  {type === "prediksi_kecamatan" && (
                    <>
                      <th style={styles.modalTh}>Kecamatan</th>
                      <th style={styles.modalTh}>Jumlah Prediksi</th>
                      <th style={styles.modalTh}>Produksi</th>
                      <th style={styles.modalTh}>Luas</th>
                      <th style={styles.modalTh}>Rata Ton/Ha</th>
                    </>
                  )}

                  {type === "top_kecamatan" && (
                    <>
                      <th style={styles.modalTh}>No</th>
                      <th style={styles.modalTh}>Kecamatan</th>
                      <th style={styles.modalTh}>Rata-rata Panen</th>
                    </>
                  )}

                  {type === "aktivitas" && (
                    <>
                      <th style={styles.modalTh}>Aktivitas</th>
                      <th style={styles.modalTh}>Jumlah</th>
                    </>
                  )}

                  {(type === "varietas" || type === "periode") && (
                    <>
                      <th style={styles.modalTh}>Nama</th>
                      <th style={styles.modalTh}>Persentase</th>
                      <th style={styles.modalTh}>Nilai</th>
                    </>
                  )}
                </tr>
              </thead>

              <tbody>
                {data.map((item, index) => (
                  <tr key={`${type}-${index}`}>
                    {type === "prediksi_kecamatan" && (
                      <>
                        <td style={styles.modalTd}>{item.kecamatan}</td>
                        <td style={styles.modalTd}>
                          {formatNumber(item.jumlah, 0)}
                        </td>
                        <td style={styles.modalTd}>
                          {formatNumber(item.produksi, 2)} Ton
                        </td>
                        <td style={styles.modalTd}>
                          {formatNumber(item.luas, 2)} Ha
                        </td>
                        <td style={styles.modalTd}>
                          {formatNumber(
                            item.luas > 0 ? item.produksi / item.luas : 0,
                            2
                          )}{" "}
                          Ton/Ha
                        </td>
                      </>
                    )}

                    {type === "top_kecamatan" && (
                      <>
                        <td style={styles.modalTd}>{index + 1}</td>
                        <td style={styles.modalTd}>{item.kecamatan}</td>
                        <td style={styles.modalTd}>
                          {formatNumber(item.rata, 2)} Ton/Ha
                        </td>
                      </>
                    )}

                    {type === "aktivitas" && (
                      <>
                        <td style={styles.modalTd}>{item.label}</td>
                        <td style={styles.modalTd}>
                          {formatNumber(item.value, 0)}
                        </td>
                      </>
                    )}

                    {(type === "varietas" || type === "periode") && (
                      <>
                        <td style={styles.modalTd}>{item.name}</td>
                        <td style={styles.modalTd}>
                          {formatPercent(item.percent, 1)}
                        </td>
                        <td style={styles.modalTd}>
                          {formatNumber(item.value, 2)}
                          {type === "varietas" ? " Ha" : " Ton"}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <button type="button" style={styles.outlineBtn} onClick={onClose}>
          Tutup
        </button>
      </div>
    </div>
  );
}

function MapDetailModal({ data, onClose }) {
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.mapModalBox}>
        <div style={styles.modalHeader}>
          <h3>Peta Detail Sebaran Luas Lahan</h3>

          <button type="button" style={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <SebaranLuasMap data={data} large />

        <button type="button" style={styles.outlineBtn} onClick={onClose}>
          Tutup
        </button>
      </div>
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
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 22,
    marginBottom: 28,
  },

  breadcrumb: {
    display: "flex",
    gap: 10,
    color: "#64748b",
    fontSize: 14,
    marginBottom: 10,
  },

  title: {
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 31,
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
    justifyContent: "flex-end",
    gap: 14,
    flexWrap: "wrap",
  },

  datePicker: {
    minHeight: 46,
    minWidth: 390,
    border: "1px solid #dbe3ea",
    borderRadius: 10,
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 14px",
  },

  dateInput: {
    border: "none",
    outline: "none",
    fontWeight: 800,
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
    color: "#0f172a",
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "0 16px",
    cursor: "pointer",
  },

  bellBtn: {
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
    width: 45,
    height: 45,
    borderRadius: 999,
    background: "#dcfce7",
    color: "#059669",
    fontWeight: 950,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: 14,
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

  statLabel: {
    margin: 0,
    color: "#475569",
    fontSize: 13,
    fontWeight: 850,
  },

  statValueWrap: {
    display: "flex",
    alignItems: "baseline",
    gap: 7,
  },

  statValue: {
    margin: "5px 0",
    color: "#0f172a",
    fontSize: 27,
    fontWeight: 950,
  },

  statNote: {
    fontSize: 12,
    fontWeight: 750,
  },

  gridLayout: {
    display: "grid",
    gridTemplateColumns: "1.35fr 1.05fr 1fr",
    gap: 18,
  },

  trendCard: {
    gridColumn: "span 1",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 20,
    minHeight: 390,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  chartCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 20,
    minHeight: 390,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  sideColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },

  sideCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 20,
    minHeight: 180,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  bottomCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 20,
    minHeight: 260,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  mapCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 20,
    minHeight: 260,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  exportCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 20,
    minHeight: 260,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },

  smallText: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: 12,
  },

  linkBtn: {
    border: "none",
    background: "transparent",
    color: "#059669",
    fontWeight: 850,
    cursor: "pointer",
  },

  smallSelect: {
    height: 38,
    border: "1px solid #dbe3ea",
    borderRadius: 9,
    padding: "0 12px",
    background: "#ffffff",
    fontWeight: 800,
    outline: "none",
  },

  lineChartWrap: {
    position: "relative",
    minHeight: 320,
  },

  chartYAxis: {
    color: "#475569",
    fontSize: 13,
    fontWeight: 800,
    marginBottom: 4,
  },

  lineSvg: {
    width: "100%",
    height: 270,
    display: "block",
  },

  lineLabels: {
    display: "grid",
    gap: 6,
    color: "#475569",
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },

  horizontalChart: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  horizontalRow: {
    display: "grid",
    gridTemplateColumns: "95px 1fr 54px",
    alignItems: "center",
    gap: 10,
    fontSize: 13,
  },

  horizontalLabel: {
    fontWeight: 850,
    color: "#0f172a",
  },

  horizontalTrack: {
    height: 14,
    borderRadius: 999,
    background: "#e5e7eb",
    overflow: "hidden",
  },

  horizontalFill: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #22c55e, #15803d)",
  },

  axisLabel: {
    marginTop: 12,
    textAlign: "center",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 800,
  },

  topTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  },

  topTh: {
    textAlign: "left",
    padding: "10px 8px",
    borderBottom: "1px solid #e5e7eb",
    color: "#475569",
    fontSize: 12,
  },

  topTd: {
    padding: "12px 8px",
    borderBottom: "1px solid #e5e7eb",
    color: "#0f172a",
    fontWeight: 750,
  },

  activityList: {
    display: "flex",
    flexDirection: "column",
    gap: 13,
  },

  activityItem: {
    display: "grid",
    gridTemplateColumns: "30px 1fr auto",
    alignItems: "center",
    gap: 10,
    fontSize: 14,
  },

  activityIcon: {
    width: 28,
    height: 28,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  donutWrap: {
    display: "grid",
    gridTemplateColumns: "150px 1fr",
    gap: 20,
    alignItems: "center",
    marginTop: 16,
  },

  donut: {
    width: 145,
    height: 145,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  donutInner: {
    width: 78,
    height: 78,
    borderRadius: "50%",
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  donutLegend: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    fontSize: 13,
  },

  legendRow: {
    display: "grid",
    gridTemplateColumns: "14px 1fr 45px 90px",
    alignItems: "center",
    gap: 8,
  },

  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 4,
    display: "inline-block",
  },

  mapWrap: {
    marginTop: 12,
  },

  leafletMap: {
    width: "100%",
    height: 230,
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid #e5e7eb",
  },

  leafletMapLarge: {
    width: "100%",
    height: 520,
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid #e5e7eb",
  },

  mapLegend: {
    marginTop: 12,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    fontSize: 12,
    color: "#475569",
  },

  mapLegendRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
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

  exportList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginTop: 18,
  },

  exportAction: {
    height: 44,
    border: "1px solid #dbe3ea",
    borderRadius: 10,
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 850,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 14px",
    cursor: "pointer",
  },

  infoBox: {
    marginTop: 18,
    borderRadius: 14,
    border: "1px solid #bbf7d0",
    background: "#ecfdf5",
    color: "#047857",
    padding: 16,
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  emptyBox: {
    height: 220,
    color: "#64748b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
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
    width: 820,
    maxWidth: "96vw",
    maxHeight: "90vh",
    background: "#ffffff",
    borderRadius: 18,
    padding: 22,
    boxShadow: "0 30px 90px rgba(15, 23, 42, 0.28)",
    overflow: "hidden",
  },

  mapModalBox: {
    width: 980,
    maxWidth: "96vw",
    maxHeight: "94vh",
    background: "#ffffff",
    borderRadius: 18,
    padding: 22,
    boxShadow: "0 30px 90px rgba(15, 23, 42, 0.28)",
    overflow: "hidden",
  },

  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
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
    color: "#0f172a",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  modalBody: {
    maxHeight: "62vh",
    overflowY: "auto",
    paddingRight: 4,
  },

  modalTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  },

  modalTh: {
    textAlign: "left",
    padding: "12px 10px",
    borderBottom: "1px solid #e5e7eb",
    background: "#f8fafc",
    color: "#475569",
    fontWeight: 900,
  },

  modalTd: {
    padding: "12px 10px",
    borderBottom: "1px solid #e5e7eb",
    color: "#0f172a",
    fontWeight: 700,
  },

  footer: {
    display: "flex",
    justifyContent: "space-between",
    color: "#475569",
    fontSize: 14,
    marginTop: 28,
  },
};