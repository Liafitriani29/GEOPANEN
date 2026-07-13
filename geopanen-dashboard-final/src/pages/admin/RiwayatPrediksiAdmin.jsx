import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

import {
  RefreshCcw,
  Bell,
  CalendarDays,
  ChevronDown,
  Search,
  Filter,
  Download,
  Eye,
  TrendingUp,
  ClipboardCheck,
  CalendarCheck,
  Leaf,
  Wheat,
  BarChart3,
  Info,
  CheckCircle2,
  X,
} from "lucide-react";

const API = "http://localhost:3000/api";

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

const formatDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
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

const formatShortDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const toInputDate = (date) => {
  return date.toISOString().slice(0, 10);
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

const countByDateRange = (rows, start, end) => {
  return rows.filter((item) => isBetweenDate(item.created_at_view, start, end))
    .length;
};

const sumProduksiByDateRange = (rows, start, end) => {
  return rows
    .filter((item) => isBetweenDate(item.created_at_view, start, end))
    .reduce((sum, item) => sum + toNumber(item.prediksi_ton_view, 0), 0);
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

const getIdPrediksi = (item) => {
  if (item?.id_prediksi) return item.id_prediksi;
  if (item?.kode_prediksi) return item.kode_prediksi;

  const id = item?.id || item?.prediksi_id || 0;
  const date = item?.created_at ? new Date(item.created_at) : new Date();

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return `PRD-${yyyy}${mm}${dd}-${String(id).padStart(3, "0")}`;
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
    item?.user_name ||
    "-"
  );
};

const getEmailPetani = (item) => {
  return item?.email_petani || item?.email || "-";
};

const getKecamatan = (item) => {
  return item?.nama_kecamatan || item?.kecamatan || "-";
};

const getDesa = (item) => {
  return item?.nama_desa || item?.desa || "-";
};

const getLokasi = (item) => {
  const desa = getDesa(item);
  const kecamatan = getKecamatan(item);

  if (desa === "-" && kecamatan === "-") return "-";
  if (desa === "-") return kecamatan;
  if (kecamatan === "-") return desa;

  return `${desa}, ${kecamatan}`;
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

const getPeriode = (item) => {
  return item?.periode || item?.musim_tanam || item?.periode_tanam || "MT I 2026";
};

const getStatus = (item) => {
  const text = String(
    item?.status || item?.status_prediksi || item?.status_risiko || "berhasil"
  ).toLowerCase();

  if (
    text.includes("gagal") ||
    text.includes("error") ||
    text.includes("kritis")
  ) {
    return "gagal";
  }

  if (text.includes("proses") || text.includes("pending")) {
    return "proses";
  }

  return "berhasil";
};

const getStatusLabel = (status) => {
  if (status === "gagal") return "Gagal";
  if (status === "proses") return "Proses";
  return "Berhasil";
};

const getStatusStyle = (status) => {
  if (status === "gagal") {
    return {
      background: "#fee2e2",
      color: "#ef4444",
      border: "1px solid #fecaca",
    };
  }

  if (status === "proses") {
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

const isToday = (value) => {
  if (!value) return false;

  const date = new Date(value);
  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
};

const escapeCsv = (value) => {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
};

export default function RiwayatPrediksiAdmin() {
  const currentUser = useMemo(() => getCurrentUser(), []);
  const appVersion = import.meta.env.VITE_APP_VERSION || "1.0.0";
  const tableRef = useRef(null);

  const [data, setData] = useState([]);
  const [notifCount, setNotifCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [selectedKecamatan, setSelectedKecamatan] = useState("");
  const [selectedDesa, setSelectedDesa] = useState("");
  const [selectedPeriode, setSelectedPeriode] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [endDate, setEndDate] = useState(getDefaultEndDate());

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(8);
  const [selectedDetail, setSelectedDetail] = useState(null);

  const scrollToTable = () => {
    setTimeout(() => {
      tableRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  };

  const fetchRiwayat = async () => {
    try {
      setLoading(true);

      const [riwayatRes, notifRes] = await Promise.allSettled([
        axios.get(`${API}/prediksi`),
        axios.get(`${API}/admin/notifikasi/unread-count`),
      ]);

      if (riwayatRes.status === "fulfilled") {
        const rows = normalizeApiList(riwayatRes.value.data);
        setData(rows);
        console.log("RIWAYAT RESPONSE:", riwayatRes.value.data);
      } else {
        console.log(
          "ERROR RIWAYAT:",
          riwayatRes.reason?.response?.data || riwayatRes.reason
        );
        setData([]);
      }

      if (notifRes.status === "fulfilled") {
        setNotifCount(
          Number(
            notifRes.value.data?.count ||
              notifRes.value.data?.data?.count ||
              notifRes.value.data?.total ||
              0
          )
        );
      }
    } catch (err) {
      console.log("ERROR RIWAYAT:", err.response?.data || err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiwayat();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    selectedKecamatan,
    selectedDesa,
    selectedPeriode,
    selectedStatus,
    startDate,
    endDate,
  ]);

  const kecamatanOptions = useMemo(() => {
    return Array.from(
      new Set(data.map(getKecamatan).filter((item) => item !== "-"))
    ).sort();
  }, [data]);

  const desaOptions = useMemo(() => {
    return Array.from(
      new Set(data.map(getDesa).filter((item) => item !== "-"))
    ).sort();
  }, [data]);

  const periodeOptions = useMemo(() => {
    return Array.from(new Set(data.map(getPeriode).filter(Boolean))).sort();
  }, [data]);

  const enrichedData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      id_prediksi_view: getIdPrediksi(item),
      nama_lahan_view: getNamaLahan(item),
      nama_petani_view: getNamaPetani(item),
      email_petani_view: getEmailPetani(item),
      kecamatan_view: getKecamatan(item),
      desa_view: getDesa(item),
      lokasi_view: getLokasi(item),
      luas_ha_view: getLuasHa(item),
      prediksi_ton_view: getPrediksiTon(item),
      prediksi_kg_view: getPrediksiKg(item),
      periode_view: getPeriode(item),
      status_view: getStatus(item),
      created_at_view:
        item?.created_at || item?.tanggal_prediksi || item?.tanggal || null,
    }));
  }, [data]);

  const filteredData = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return enrichedData.filter((item) => {
      const searchable = [
        item.id_prediksi_view,
        item.nama_lahan_view,
        item.nama_petani_view,
        item.email_petani_view,
        item.kecamatan_view,
        item.desa_view,
        item.lokasi_view,
        item.periode_view,
        item.status_view,
      ]
        .join(" ")
        .toLowerCase();

      const matchSearch = keyword ? searchable.includes(keyword) : true;

      const matchKecamatan = selectedKecamatan
        ? item.kecamatan_view === selectedKecamatan
        : true;

      const matchDesa = selectedDesa ? item.desa_view === selectedDesa : true;

      const matchPeriode = selectedPeriode
        ? item.periode_view === selectedPeriode
        : true;

      const matchStatus = selectedStatus
        ? item.status_view === selectedStatus
        : true;

      const matchDate = isDateInRange(
        item.created_at_view,
        startDate,
        endDate
      );

      return (
        matchSearch &&
        matchKecamatan &&
        matchDesa &&
        matchPeriode &&
        matchStatus &&
        matchDate
      );
    });
  }, [
    enrichedData,
    search,
    selectedKecamatan,
    selectedDesa,
    selectedPeriode,
    selectedStatus,
    startDate,
    endDate,
  ]);

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      const dateA = new Date(a.created_at_view || 0).getTime();
      const dateB = new Date(b.created_at_view || 0).getTime();

      return dateB - dateA;
    });
  }, [filteredData]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / perPage));

  const paginatedData = useMemo(() => {
    const start = (page - 1) * perPage;
    return sortedData.slice(start, start + perPage);
  }, [sortedData, page, perPage]);

  const stats = useMemo(() => {
    const total = filteredData.length;

    const berhasil = filteredData.filter(
      (item) => item.status_view === "berhasil"
    ).length;

    const hariIni = filteredData.filter((item) =>
      isToday(item.created_at_view)
    ).length;

    const totalProduksi = filteredData.reduce(
      (sum, item) => sum + item.prediksi_ton_view,
      0
    );

    const totalLuas = filteredData.reduce(
      (sum, item) => sum + item.luas_ha_view,
      0
    );

    const rataProduksi =
      totalLuas > 0
        ? totalProduksi / totalLuas
        : total > 0
        ? totalProduksi / total
        : 0;

    const persenBerhasil = total > 0 ? (berhasil / total) * 100 : 0;

    const today = new Date();

    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    const yesterdayStart = startOfDay(addDays(today, -1));
    const yesterdayEnd = endOfDay(addDays(today, -1));

    const weekStart = startOfDay(addDays(today, -6));
    const weekEnd = endOfDay(today);

    const previousWeekStart = startOfDay(addDays(today, -13));
    const previousWeekEnd = endOfDay(addDays(today, -7));

    const totalMingguIni = countByDateRange(
      enrichedData,
      weekStart,
      weekEnd
    );

    const totalMingguLalu = countByDateRange(
      enrichedData,
      previousWeekStart,
      previousWeekEnd
    );

    const prediksiHariIni = countByDateRange(
      enrichedData,
      todayStart,
      todayEnd
    );

    const prediksiKemarin = countByDateRange(
      enrichedData,
      yesterdayStart,
      yesterdayEnd
    );

    const produksiMingguIni = sumProduksiByDateRange(
      enrichedData,
      weekStart,
      weekEnd
    );

    const produksiMingguLalu = sumProduksiByDateRange(
      enrichedData,
      previousWeekStart,
      previousWeekEnd
    );

    const totalChange = getChangePercent(totalMingguIni, totalMingguLalu);
    const todayChange = getChangePercent(prediksiHariIni, prediksiKemarin);
    const produksiChange = getChangePercent(
      produksiMingguIni,
      produksiMingguLalu
    );

    return {
      total,
      berhasil,
      hariIni,
      totalProduksi,
      totalLuas,
      rataProduksi,
      persenBerhasil,
      totalChange,
      todayChange,
      produksiChange,
    };
  }, [filteredData, enrichedData]);

  const latestData = useMemo(() => {
    return sortedData.slice(0, 3);
  }, [sortedData]);

  const kecamatanChart = useMemo(() => {
    const map = new Map();

    filteredData.forEach((item) => {
      const key = item.kecamatan_view || "-";
      map.set(key, (map.get(key) || 0) + item.prediksi_ton_view);
    });

    return Array.from(map.entries())
      .map(([name, ton]) => ({
        name,
        ton,
      }))
      .sort((a, b) => b.ton - a.ton)
      .slice(0, 7);
  }, [filteredData]);

  const periodeChart = useMemo(() => {
    const map = new Map();

    filteredData.forEach((item) => {
      const key = item.periode_view || "Tidak Ada Periode";
      map.set(key, (map.get(key) || 0) + item.prediksi_ton_view);
    });

    return Array.from(map.entries())
      .map(([name, ton]) => ({
        name,
        ton,
        percent:
          stats.totalProduksi > 0 ? (ton / stats.totalProduksi) * 100 : 0,
      }))
      .sort((a, b) => b.ton - a.ton);
  }, [filteredData, stats.totalProduksi]);

  const exportExcel = () => {
    const headers = [
      "ID Prediksi",
      "Lahan",
      "Petani",
      "Email Petani",
      "Lokasi",
      "Luas Ha",
      "Prediksi Ton",
      "Prediksi Kg",
      "Periode",
      "Tanggal",
      "Status",
    ];

    const rows = sortedData.map((item) => [
      item.id_prediksi_view,
      item.nama_lahan_view,
      item.nama_petani_view,
      item.email_petani_view,
      item.lokasi_view,
      item.luas_ha_view,
      item.prediksi_ton_view,
      item.prediksi_kg_view,
      item.periode_view,
      `${formatDate(item.created_at_view)} ${formatTime(item.created_at_view)}`,
      getStatusLabel(item.status_view),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(";"))
      .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `riwayat-prediksi-geopanen-${Date.now()}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

  const resetFilter = () => {
    setSearch("");
    setSelectedKecamatan("");
    setSelectedDesa("");
    setSelectedPeriode("");
    setSelectedStatus("");
    setStartDate(getDefaultStartDate());
    setEndDate(getDefaultEndDate());
    setPage(1);
  };

  const showAllData = () => {
    setSearch("");
    setSelectedKecamatan("");
    setSelectedDesa("");
    setSelectedPeriode("");
    setSelectedStatus("");
    setStartDate("");
    setEndDate("");
    setPerPage(20);
    setPage(1);
    scrollToTable();
  };

  const showAnalisisLengkap = () => {
    setPerPage(20);
    setPage(1);
    scrollToTable();
  };

  const showTopKecamatan = () => {
    if (!kecamatanChart.length) return;

    setSelectedKecamatan(kecamatanChart[0].name);
    setPage(1);
    scrollToTable();
  };

  const showTopPeriode = () => {
    if (!periodeChart.length) return;

    setSelectedPeriode(periodeChart[0].name);
    setPage(1);
    scrollToTable();
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.breadcrumb}>
            <span>Dashboard</span>
            <span>/</span>
            <strong>Riwayat Prediksi</strong>
          </div>

          <h1 style={styles.title}>Riwayat Prediksi</h1>

          <p style={styles.subtitle}>
            Riwayat seluruh prediksi panen yang telah dibuat oleh sistem AI
            berdasarkan data lahan petani.
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

          <button type="button" style={styles.refreshBtn} onClick={fetchRiwayat}>
            <RefreshCcw size={18} />
            Refresh
          </button>

          <button type="button" style={styles.bellBtn}>
            <Bell size={21} />
            {notifCount > 0 && (
              <span style={styles.bellBadge}>{notifCount}</span>
            )}
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
          icon={<TrendingUp size={34} />}
          iconBoxStyle={styles.greenIconBox}
          label="Total Prediksi"
          value={formatNumber(stats.total, 0)}
          smallText="Prediksi"
          note={getChangeNote(stats.totalChange, "dari minggu lalu")}
          noteColor={getChangeColor(stats.totalChange)}
        />

        <StatCard
          icon={<ClipboardCheck size={34} />}
          iconBoxStyle={styles.blueIconBox}
          label="Prediksi Berhasil"
          value={formatNumber(stats.berhasil, 0)}
          smallText="Prediksi"
          note={`${formatPercent(stats.persenBerhasil, 0)} dari total`}
          noteColor="#059669"
        />

        <StatCard
          icon={<CalendarCheck size={34} />}
          iconBoxStyle={styles.purpleIconBox}
          label="Prediksi Hari Ini"
          value={formatNumber(stats.hariIni, 0)}
          smallText="Prediksi"
          note={getChangeNote(stats.todayChange, "dari kemarin")}
          noteColor={getChangeColor(stats.todayChange)}
        />

        <StatCard
          icon={<Leaf size={34} />}
          iconBoxStyle={styles.greenIconBox}
          label="Rata-rata Produksi"
          value={formatNumber(stats.rataProduksi, 2)}
          smallText="Ton/Ha"
          note="Berdasarkan data terfilter"
          noteColor="#475569"
        />

        <StatCard
          icon={<Wheat size={34} />}
          iconBoxStyle={styles.orangeIconBox}
          label="Total Produksi Prediksi"
          value={formatNumber(stats.totalProduksi, 2)}
          smallText="Ton"
          note={getChangeNote(stats.produksiChange, "dari minggu lalu")}
          noteColor={getChangeColor(stats.produksiChange)}
        />
      </section>

      <section style={styles.filterCard}>
        <div style={styles.searchBox}>
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari lahan, petani, desa, atau kecamatan..."
            style={styles.searchInput}
          />
        </div>

        <select
          value={selectedKecamatan}
          onChange={(e) => setSelectedKecamatan(e.target.value)}
          style={styles.select}
        >
          <option value="">Semua Kecamatan</option>
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
          <option value="">Semua Desa</option>
          {desaOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select
          value={selectedPeriode}
          onChange={(e) => setSelectedPeriode(e.target.value)}
          style={styles.select}
        >
          <option value="">Semua Periode</option>
          {periodeOptions.map((item) => (
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
          <option value="">Semua Status</option>
          <option value="berhasil">Berhasil</option>
          <option value="proses">Proses</option>
          <option value="gagal">Gagal</option>
        </select>

        <button type="button" style={styles.filterBtn} onClick={resetFilter}>
          <Filter size={17} />
          Reset Filter
        </button>

        <button type="button" style={styles.exportBtn} onClick={exportExcel}>
          <Download size={17} />
          Export Excel
        </button>
      </section>

      <main style={styles.mainGrid}>
        <section style={styles.tableCard} ref={tableRef}>
          <CardHeader title="Data Riwayat Prediksi" />

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID Prediksi</th>
                  <th style={styles.th}>Lahan</th>
                  <th style={styles.th}>Petani</th>
                  <th style={styles.th}>Lokasi</th>
                  <th style={styles.th}>Luas (Ha)</th>
                  <th style={styles.th}>Prediksi Produksi</th>
                  <th style={styles.th}>Periode</th>
                  <th style={styles.th}>Tanggal Prediksi</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Aksi</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={10} style={styles.emptyCell}>
                      Memuat data riwayat prediksi...
                    </td>
                  </tr>
                )}

                {!loading && paginatedData.length === 0 && (
                  <tr>
                    <td colSpan={10} style={styles.emptyCell}>
                      Belum ada data prediksi.
                    </td>
                  </tr>
                )}

                {!loading &&
                  paginatedData.map((item) => (
                    <tr
                      key={`${item.id_prediksi_view}-${item.id}`}
                      style={styles.tr}
                    >
                      <td style={styles.td}>
                        <strong>{item.id_prediksi_view}</strong>
                      </td>

                      <td style={styles.td}>{item.nama_lahan_view}</td>

                      <td style={styles.td}>
                        <strong>{item.nama_petani_view}</strong>
                        <br />
                        <span style={styles.subText}>
                          {item.email_petani_view}
                        </span>
                      </td>

                      <td style={styles.td}>{item.lokasi_view}</td>

                      <td style={styles.td}>
                        {formatNumber(item.luas_ha_view, 2)}
                      </td>

                      <td style={styles.td}>
                        <strong>
                          {formatNumber(item.prediksi_ton_view, 2)} Ton
                        </strong>
                        <br />
                        <span style={styles.subText}>
                          ({formatNumber(item.prediksi_kg_view, 0)} Kg)
                        </span>
                      </td>

                      <td style={styles.td}>{item.periode_view}</td>

                      <td style={styles.td}>
                        <strong>{formatDate(item.created_at_view)}</strong>
                        <br />
                        <span style={styles.subText}>
                          {formatTime(item.created_at_view)} WIB
                        </span>
                      </td>

                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.statusPill,
                            ...getStatusStyle(item.status_view),
                          }}
                        >
                          {getStatusLabel(item.status_view)}
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
              {sortedData.length === 0 ? 0 : (page - 1) * perPage + 1} -{" "}
              {Math.min(page * perPage, sortedData.length)} dari{" "}
              {formatNumber(sortedData.length, 0)} data prediksi
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
                      ...(page === item ? styles.activePageBtn : {}),
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
                    ...(page === totalPages ? styles.activePageBtn : {}),
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

              <select
                value={perPage}
                onChange={(e) => setPerPage(Number(e.target.value))}
                style={styles.perPageSelect}
              >
                <option value={8}>8 / halaman</option>
                <option value={10}>10 / halaman</option>
                <option value={20}>20 / halaman</option>
              </select>
            </div>
          </div>
        </section>

        <aside style={styles.sideColumn}>
          <section style={styles.sideCard}>
            <CardHeader title="Ringkasan Prediksi" />

            <div style={styles.summaryContent}>
              <DonutStatus value={stats.persenBerhasil} />

              <div style={styles.summaryLegend}>
                <span style={styles.greenSquare} />
                <div>
                  <strong>Berhasil</strong>
                  <p>
                    {formatNumber(stats.berhasil, 0)} (
                    {formatPercent(stats.persenBerhasil, 0)})
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              style={styles.outlineBtn}
              onClick={showAnalisisLengkap}
            >
              Lihat Analisis Lengkap →
            </button>
          </section>

          <section style={styles.sideCard}>
            <CardHeader title="Prediksi Produksi Terbaru" />

            <div style={styles.latestList}>
              {latestData.length === 0 && (
                <div style={styles.emptySmall}>Belum ada prediksi terbaru.</div>
              )}

              {latestData.map((item) => (
                <div
                  key={`${item.id_prediksi_view}-latest`}
                  style={styles.latestItem}
                >
                  <div style={styles.latestIcon}>
                    <BarChart3 size={18} />
                  </div>

                  <div style={styles.latestMiddle}>
                    <strong>
                      {item.nama_lahan_view} - {item.nama_petani_view}
                    </strong>
                    <span>{item.lokasi_view}</span>
                  </div>

                  <div style={styles.latestRight}>
                    <strong>{formatNumber(item.prediksi_ton_view, 2)} Ton</strong>
                    <span>{formatShortDate(item.created_at_view)}</span>
                  </div>
                </div>
              ))}
            </div>

            <button type="button" style={styles.outlineBtn} onClick={showAllData}>
              Lihat Semua →
            </button>
          </section>
        </aside>

        <section style={styles.chartCard}>
          <CardHeader title="Prediksi Produksi per Kecamatan" />

          <BarChart data={kecamatanChart} />

          <button
            type="button"
            style={styles.outlineBtn}
            onClick={showTopKecamatan}
          >
            Lihat Detail →
          </button>
        </section>

        <section style={styles.chartCard}>
          <CardHeader title="Prediksi Produksi per Periode Tanam" />

          <PeriodChart data={periodeChart} total={stats.totalProduksi} />

          <button
            type="button"
            style={styles.outlineBtn}
            onClick={showTopPeriode}
          >
            Lihat Detail →
          </button>
        </section>

        <section style={styles.infoCard}>
          <CardHeader title="Informasi" />

          <InfoBox text="Riwayat prediksi diperbarui otomatis setiap kali sistem AI menghasilkan prediksi baru." />
          <InfoBox text="Data yang ditampilkan berdasarkan tanggal dan filter yang Anda pilih." />
          <InfoBox text="Klik tombol Detail untuk melihat informasi lengkap prediksi." />
        </section>
      </main>

      {selectedDetail && (
        <DetailModal
          item={selectedDetail}
          onClose={() => setSelectedDetail(null)}
        />
      )}

      <footer style={styles.footer}>
        <span>© 2026 GeoPanen. All rights reserved.</span>
        <span>Versi {appVersion}</span>
      </footer>
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

function CardHeader({ title }) {
  return (
    <div style={styles.cardHeader}>
      <div style={styles.cardTitleWrap}>
        <h3>{title}</h3>
        <Info size={15} color="#94a3b8" />
      </div>
    </div>
  );
}

function DonutStatus({ value }) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));
  const angle = safeValue * 3.6;

  return (
    <div
      style={{
        ...styles.summaryDonut,
        background: `conic-gradient(#16a34a 0deg ${angle}deg, #e5e7eb ${angle}deg 360deg)`,
      }}
    >
      <div style={styles.summaryDonutInner}>
        <CheckCircle2 size={26} color="#16a34a" />
      </div>
    </div>
  );
}

function BarChart({ data }) {
  const maxValue = Math.max(1, ...data.map((item) => item.ton));

  if (!data.length) {
    return <div style={styles.emptyChart}>Belum ada data grafik.</div>;
  }

  return (
    <div style={styles.barChart}>
      <div style={styles.barArea}>
        {data.map((item) => {
          const height = Math.max(12, (item.ton / maxValue) * 150);

          return (
            <div key={item.name} style={styles.barItem}>
              <span style={styles.barValue}>{formatNumber(item.ton, 2)}</span>

              <div style={styles.barTrack}>
                <div style={{ ...styles.barFill, height }} />
              </div>

              <span style={styles.barLabel}>{item.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PeriodChart({ data, total }) {
  const colors = ["#16a34a", "#f59e0b", "#0ea5e9", "#9333ea", "#ef4444"];

  const gradient = useMemo(() => {
    if (!data.length || total <= 0) {
      return "conic-gradient(#16a34a 0deg 360deg)";
    }

    let start = 0;

    const parts = data.map((item, index) => {
      const angle = (item.ton / total) * 360;
      const end = start + angle;
      const part = `${colors[index % colors.length]} ${start}deg ${end}deg`;
      start = end;
      return part;
    });

    return `conic-gradient(${parts.join(", ")})`;
  }, [data, total]);

  return (
    <div style={styles.periodWrap}>
      <div style={{ ...styles.periodDonut, background: gradient }}>
        <div style={styles.periodDonutInner} />
      </div>

      <div style={styles.periodList}>
        {data.length === 0 && (
          <div style={styles.emptySmall}>Belum ada data periode.</div>
        )}

        {data.slice(0, 4).map((item, index) => (
          <div key={item.name} style={styles.periodItem}>
            <span
              style={{
                ...styles.periodDot,
                background: colors[index % colors.length],
              }}
            />

            <strong>{item.name}</strong>

            <span>{formatNumber(item.ton, 2)} Ton</span>
            <span>({formatPercent(item.percent, 1)})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoBox({ text }) {
  return (
    <div style={styles.infoBox}>
      <div style={styles.infoIcon}>
        <Info size={16} />
      </div>
      <span>{text}</span>
    </div>
  );
}

function DetailModal({ item, onClose }) {
  const rekomendasi = Array.isArray(item.rekomendasi) ? item.rekomendasi : [];
  const proyeksi = Array.isArray(item.proyeksi) ? item.proyeksi : [];

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalBox}>
        <div style={styles.modalHeader}>
          <div>
            <h3>Detail Prediksi</h3>
            <p>{item.id_prediksi_view}</p>
          </div>

          <button type="button" style={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div style={styles.modalBody}>
          <div style={styles.detailGrid}>
            <DetailRow label="Nama Lahan" value={item.nama_lahan_view} />
            <DetailRow label="Petani" value={item.nama_petani_view} />
            <DetailRow label="Email Petani" value={item.email_petani_view} />
            <DetailRow label="Lokasi" value={item.lokasi_view} />
            <DetailRow
              label="Luas Lahan"
              value={`${formatNumber(item.luas_ha_view, 2)} Ha`}
            />
            <DetailRow
              label="Prediksi Produksi"
              value={`${formatNumber(item.prediksi_ton_view, 2)} Ton`}
            />
            <DetailRow
              label="Prediksi Kg"
              value={`${formatNumber(item.prediksi_kg_view, 0)} Kg`}
            />
            <DetailRow label="Produktivitas" value={item.produktivitas || "-"} />
            <DetailRow label="Periode" value={item.periode_view} />
            <DetailRow label="Model AI" value={item.model_ai || "-"} />
            <DetailRow
              label="Tanggal Prediksi"
              value={formatDate(item.created_at_view)}
            />
            <DetailRow
              label="Jam Prediksi"
              value={`${formatTime(item.created_at_view)} WIB`}
            />
            <DetailRow label="Suhu" value={item.suhu ? `${item.suhu} °C` : "-"} />
            <DetailRow
              label="Curah Hujan"
              value={item.curah_hujan ? `${item.curah_hujan} mm` : "-"}
            />
            <DetailRow
              label="Kelembapan"
              value={item.kelembapan ? `${item.kelembapan}%` : "-"}
            />
            <DetailRow
              label="Status"
              value={getStatusLabel(item.status_view)}
            />
          </div>

          <div style={styles.modalSection}>
            <h4>Rekomendasi</h4>

            {rekomendasi.length === 0 ? (
              <p style={styles.modalMuted}>Belum ada rekomendasi.</p>
            ) : (
              <ul style={styles.rekomList}>
                {rekomendasi.map((text, index) => (
                  <li key={`${text}-${index}`}>{text}</li>
                ))}
              </ul>
            )}
          </div>

          <div style={styles.modalSection}>
            <h4>Proyeksi Produksi</h4>

            {proyeksi.length === 0 ? (
              <p style={styles.modalMuted}>Belum ada proyeksi.</p>
            ) : (
              <div style={styles.proyeksiGrid}>
                {proyeksi.map((row, index) => (
                  <div key={`${row.label}-${index}`} style={styles.proyeksiItem}>
                    <strong>{row.label}</strong>
                    <span>{formatNumber(row.prediksi, 2)} Ton</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

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
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 22,
    marginBottom: 26,
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
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 16,
    marginBottom: 22,
  },

  statCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    minHeight: 118,
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
    color: "#9333ea",
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
    gap: 8,
  },

  statValue: {
    margin: "5px 0",
    color: "#0f172a",
    fontSize: 28,
    fontWeight: 950,
  },

  statNote: {
    fontSize: 12,
    fontWeight: 750,
  },

  filterCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 16,
    display: "grid",
    gridTemplateColumns: "1.7fr 1fr 1fr 1fr 1fr auto auto",
    gap: 12,
    marginBottom: 18,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.05)",
  },

  searchBox: {
    height: 42,
    border: "1px solid #dbe3ea",
    borderRadius: 9,
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "0 12px",
    background: "#ffffff",
  },

  searchInput: {
    border: "none",
    outline: "none",
    width: "100%",
    fontWeight: 700,
    color: "#0f172a",
  },

  select: {
    height: 42,
    border: "1px solid #dbe3ea",
    borderRadius: 9,
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 800,
    padding: "0 12px",
    outline: "none",
  },

  filterBtn: {
    height: 42,
    border: "1px solid #dbe3ea",
    borderRadius: 9,
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 850,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 14px",
    cursor: "pointer",
  },

  exportBtn: {
    height: 42,
    border: "1px solid #16a34a",
    borderRadius: 9,
    background: "#ffffff",
    color: "#059669",
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 16px",
    cursor: "pointer",
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "2.15fr 0.85fr",
    gap: 18,
  },

  tableCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 20,
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
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  chartCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 20,
    minHeight: 280,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  infoCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 20,
    minHeight: 280,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 18,
  },

  cardTitleWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
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
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  tr: {
    borderBottom: "1px solid #e5e7eb",
  },

  td: {
    padding: "13px 10px",
    fontSize: 14,
    color: "#0f172a",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },

  subText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
  },

  emptyCell: {
    textAlign: "center",
    padding: 30,
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
    whiteSpace: "nowrap",
  },

  detailBtn: {
    height: 34,
    border: "1px solid #dbe3ea",
    borderRadius: 8,
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 850,
    display: "flex",
    alignItems: "center",
    gap: 7,
    padding: "0 12px",
    cursor: "pointer",
  },

  paginationWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginTop: 18,
    color: "#475569",
    fontSize: 14,
  },

  pagination: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  pageBtn: {
    minWidth: 34,
    height: 34,
    border: "1px solid #dbe3ea",
    borderRadius: 8,
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 900,
    cursor: "pointer",
  },

  activePageBtn: {
    background: "#16a34a",
    color: "#ffffff",
    borderColor: "#16a34a",
  },

  pageDots: {
    color: "#64748b",
    fontWeight: 900,
  },

  perPageSelect: {
    height: 34,
    border: "1px solid #dbe3ea",
    borderRadius: 8,
    padding: "0 10px",
    fontWeight: 800,
    outline: "none",
  },

  summaryContent: {
    display: "grid",
    gridTemplateColumns: "150px 1fr",
    alignItems: "center",
    gap: 18,
    marginBottom: 16,
  },

  summaryDonut: {
    width: 145,
    height: 145,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  summaryDonutInner: {
    width: 86,
    height: 86,
    borderRadius: "50%",
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  summaryLegend: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  greenSquare: {
    width: 16,
    height: 16,
    borderRadius: 4,
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

  latestList: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  latestItem: {
    display: "grid",
    gridTemplateColumns: "34px 1fr auto",
    gap: 12,
    alignItems: "center",
  },

  latestIcon: {
    width: 34,
    height: 34,
    borderRadius: 999,
    background: "#dcfce7",
    color: "#16a34a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  latestMiddle: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },

  latestRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 4,
  },

  emptySmall: {
    color: "#64748b",
    fontSize: 14,
    padding: 10,
  },

  barChart: {
    minHeight: 190,
  },

  barArea: {
    height: 210,
    display: "flex",
    alignItems: "flex-end",
    gap: 24,
    padding: "8px 10px 0",
    borderBottom: "1px solid #e5e7eb",
  },

  barItem: {
    flex: 1,
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },

  barTrack: {
    width: 42,
    height: 150,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },

  barFill: {
    width: 42,
    background: "linear-gradient(180deg, #22c55e 0%, #15803d 100%)",
    borderRadius: "8px 8px 0 0",
  },

  barValue: {
    fontSize: 12,
    fontWeight: 900,
    color: "#0f172a",
  },

  barLabel: {
    fontSize: 12,
    fontWeight: 850,
    color: "#475569",
  },

  emptyChart: {
    height: 210,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748b",
  },

  periodWrap: {
    display: "grid",
    gridTemplateColumns: "180px 1fr",
    gap: 24,
    alignItems: "center",
    minHeight: 210,
  },

  periodDonut: {
    width: 160,
    height: 160,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  periodDonutInner: {
    width: 86,
    height: 86,
    borderRadius: "50%",
    background: "#ffffff",
  },

  periodList: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  periodItem: {
    display: "grid",
    gridTemplateColumns: "16px 1fr 95px 80px",
    gap: 10,
    alignItems: "center",
    fontSize: 14,
  },

  periodDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
  },

  infoBox: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 14,
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1e3a8a",
    fontSize: 14,
  },

  infoIcon: {
    width: 30,
    height: 30,
    borderRadius: 999,
    background: "#dbeafe",
    color: "#2563eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.46)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: 20,
  },

  modalBox: {
    width: 760,
    maxWidth: "96vw",
    maxHeight: "92vh",
    background: "#ffffff",
    borderRadius: 18,
    padding: 22,
    boxShadow: "0 30px 90px rgba(15, 23, 42, 0.28)",
    overflow: "hidden",
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
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
    maxHeight: "64vh",
    overflowY: "auto",
    paddingRight: 4,
  },

  detailGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },

  detailRow: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    color: "#64748b",
    background: "#ffffff",
  },

  modalSection: {
    marginTop: 18,
    borderTop: "1px solid #e5e7eb",
    paddingTop: 14,
  },

  modalMuted: {
    color: "#64748b",
    margin: 0,
  },

  rekomList: {
    margin: 0,
    paddingLeft: 20,
    color: "#0f172a",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  proyeksiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
  },

  proyeksiItem: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    background: "#f8fafc",
  },

  footer: {
    display: "flex",
    justifyContent: "space-between",
    color: "#475569",
    fontSize: 14,
    marginTop: 28,
  },
};