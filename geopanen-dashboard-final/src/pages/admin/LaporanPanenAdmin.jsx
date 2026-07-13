import { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import {
  Home,
  CalendarDays,
  ChevronDown,
  Filter,
  FileText,
  Download,
  Printer,
  Bell,
  Users,
  Sprout,
  BarChart3,
  Scale,
  CalendarCheck,
  Info,
} from "lucide-react";

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
  if (Array.isArray(data?.laporan)) return data.laporan;
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

const toInputDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
};

const getDefaultStartDate = () => {
  const date = new Date();
  date.setDate(1);
  return toInputDate(date);
};

const getDefaultEndDate = () => {
  return toInputDate(new Date());
};

const formatDateSlash = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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

const getDaysBetween = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;

  const start = getDateFromInput(startDate);
  const end = getDateFromInput(endDate, true);

  if (!start || !end) return 0;

  const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  return Math.max(diff, 1);
};

const addDaysToInputDate = (dateValue, days) => {
  const date = getDateFromInput(dateValue);
  if (!date) return "";

  date.setDate(date.getDate() + days);
  return toInputDate(date);
};

const getPreviousPeriodRange = (startDate, endDate) => {
  const days = getDaysBetween(startDate, endDate);

  if (!startDate || !endDate || days <= 0) {
    return {
      previousStart: "",
      previousEnd: "",
    };
  }

  const previousEnd = addDaysToInputDate(startDate, -1);
  const previousStart = addDaysToInputDate(previousEnd, -(days - 1));

  return {
    previousStart,
    previousEnd,
  };
};

const getChangePercent = (current, previous) => {
  if (previous <= 0 && current > 0) return 100;
  if (previous <= 0) return 0;

  return ((current - previous) / previous) * 100;
};

const getChangeNote = (value, label = "dari periode lalu") => {
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

const getDesa = (item) => {
  return item?.nama_desa || item?.desa || "-";
};

const getVarietas = (item) => {
  return item?.varietas || item?.varietas_prediksi || item?.jenis_padi || "-";
};

const getLuasHa = (item) => {
  const luasHa = toNumber(item?.luas_ha ?? item?.luas_lahan_ha ?? item?.luas, 0);

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
    item?.status || item?.status_prediksi || item?.status_risiko || "selesai"
  ).toLowerCase();

  if (
    raw.includes("gagal") ||
    raw.includes("error") ||
    raw.includes("kritis")
  ) {
    return "gagal";
  }

  if (raw.includes("proses") || raw.includes("pending")) {
    return "proses";
  }

  return "selesai";
};

const getStatusLabel = (status) => {
  if (status === "gagal") return "Gagal";
  if (status === "proses") return "Proses";
  return "Selesai";
};

const getStatusStyle = (status) => {
  if (status === "gagal") {
    return {
      background: "#fee2e2",
      color: "#dc2626",
    };
  }

  if (status === "proses") {
    return {
      background: "#fef3c7",
      color: "#d97706",
    };
  }

  return {
    background: "#dcfce7",
    color: "#059669",
  };
};

const getSummaryFromRows = (rows) => {
  const totalLuas = rows.reduce((sum, item) => sum + item.luas_ha_view, 0);

  const totalProduksi = rows.reduce(
    (sum, item) => sum + item.prediksi_ton_view,
    0
  );

  const uniquePetani = new Set(
    rows
      .map((item) => item.nama_petani_view)
      .filter((item) => item && item !== "-")
  ).size;

  const rataProduksi = totalLuas > 0 ? totalProduksi / totalLuas : 0;

  return {
    totalLuas,
    totalProduksi,
    uniquePetani,
    rataProduksi,
  };
};

const escapeCsv = (value) => {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
};

export default function LaporanPanenAdmin() {
  const currentUser = useMemo(() => getCurrentUser(), []);
  const appVersion = import.meta.env.VITE_APP_VERSION || "1.0.0";

  const [data, setData] = useState([]);
  const [notifCount, setNotifCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const [startDate, setStartDate] = useState(getDefaultStartDate());
  const [endDate, setEndDate] = useState(getDefaultEndDate());

  const [selectedKecamatan, setSelectedKecamatan] = useState("");
  const [selectedDesa, setSelectedDesa] = useState("");
  const [selectedPetani, setSelectedPetani] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  const [draftStartDate, setDraftStartDate] = useState(startDate);
  const [draftEndDate, setDraftEndDate] = useState(endDate);
  const [draftKecamatan, setDraftKecamatan] = useState("");
  const [draftDesa, setDraftDesa] = useState("");
  const [draftPetani, setDraftPetani] = useState("");
  const [draftStatus, setDraftStatus] = useState("");

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const tryGet = async (paths) => {
    for (const path of paths) {
      try {
        const res = await api.get(path);
        return res.data;
      } catch (error) {
        console.log(
          `Endpoint ${path} gagal:`,
          error.response?.data || error.message
        );
      }
    }

    return null;
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      const [laporanPayload, notifPayload] = await Promise.allSettled([
        tryGet(["/laporan", "/prediksi"]),
        tryGet(["/admin/notifikasi/unread-count"]),
      ]);

      if (laporanPayload.status === "fulfilled") {
        setData(normalizeApiList(laporanPayload.value));
      } else {
        console.log(
          "ERROR FETCH LAPORAN:",
          laporanPayload.reason?.response?.data || laporanPayload.reason
        );
        setData([]);
      }

      if (notifPayload.status === "fulfilled") {
        setNotifCount(
          Number(
            notifPayload.value?.count ||
              notifPayload.value?.data?.count ||
              notifPayload.value?.data?.total ||
              notifPayload.value?.total ||
              0
          )
        );
      }
    } catch (err) {
      console.log("ERROR FETCH:", err.response?.data || err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [
    startDate,
    endDate,
    selectedKecamatan,
    selectedDesa,
    selectedPetani,
    selectedStatus,
  ]);

  const enrichedData = useMemo(() => {
    return data.map((item) => {
      const luasHa = getLuasHa(item);
      const prediksiTon = getPrediksiTon(item);
      const prediksiKg = getPrediksiKg(item);
      const rataTonHa =
        luasHa > 0
          ? prediksiTon / luasHa
          : toNumber(item?.produktivitas || item?.rata_rata_ton_ha, prediksiTon);

      return {
        ...item,
        created_at_view: getCreatedAt(item),
        nama_lahan_view: getNamaLahan(item),
        nama_petani_view: getNamaPetani(item),
        kecamatan_view: getKecamatan(item),
        desa_view: getDesa(item),
        varietas_view: getVarietas(item),
        luas_ha_view: luasHa,
        prediksi_ton_view: prediksiTon,
        prediksi_kg_view: prediksiKg,
        rata_ton_ha_view: rataTonHa,
        periode_view: getPeriode(item),
        status_view: getStatus(item),
      };
    });
  }, [data]);

  const kecamatanOptions = useMemo(() => {
    return Array.from(
      new Set(
        enrichedData
          .map((item) => item.kecamatan_view)
          .filter((item) => item !== "-")
      )
    ).sort();
  }, [enrichedData]);

  const desaOptions = useMemo(() => {
    return Array.from(
      new Set(
        enrichedData.map((item) => item.desa_view).filter((item) => item !== "-")
      )
    ).sort();
  }, [enrichedData]);

  const petaniOptions = useMemo(() => {
    return Array.from(
      new Set(
        enrichedData
          .map((item) => item.nama_petani_view)
          .filter((item) => item !== "-")
      )
    ).sort();
  }, [enrichedData]);

  const filteredData = useMemo(() => {
    return enrichedData.filter((item) => {
      const matchDate = isDateInRange(item.created_at_view, startDate, endDate);

      const matchKecamatan = selectedKecamatan
        ? item.kecamatan_view === selectedKecamatan
        : true;

      const matchDesa = selectedDesa ? item.desa_view === selectedDesa : true;

      const matchPetani = selectedPetani
        ? item.nama_petani_view === selectedPetani
        : true;

      const matchStatus = selectedStatus
        ? item.status_view === selectedStatus
        : true;

      return (
        matchDate &&
        matchKecamatan &&
        matchDesa &&
        matchPetani &&
        matchStatus
      );
    });
  }, [
    enrichedData,
    startDate,
    endDate,
    selectedKecamatan,
    selectedDesa,
    selectedPetani,
    selectedStatus,
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

  const summary = useMemo(() => {
    const currentSummary = getSummaryFromRows(filteredData);

    const { previousStart, previousEnd } = getPreviousPeriodRange(
      startDate,
      endDate
    );

    const previousRows = enrichedData.filter((item) => {
      const matchDate = isDateInRange(
        item.created_at_view,
        previousStart,
        previousEnd
      );

      const matchKecamatan = selectedKecamatan
        ? item.kecamatan_view === selectedKecamatan
        : true;

      const matchDesa = selectedDesa ? item.desa_view === selectedDesa : true;

      const matchPetani = selectedPetani
        ? item.nama_petani_view === selectedPetani
        : true;

      const matchStatus = selectedStatus
        ? item.status_view === selectedStatus
        : true;

      return (
        matchDate &&
        matchKecamatan &&
        matchDesa &&
        matchPetani &&
        matchStatus
      );
    });

    const previousSummary = getSummaryFromRows(previousRows);

    return {
      ...currentSummary,
      periodeHari: getDaysBetween(startDate, endDate),

      changeLuas: getChangePercent(
        currentSummary.totalLuas,
        previousSummary.totalLuas
      ),

      changePetani: getChangePercent(
        currentSummary.uniquePetani,
        previousSummary.uniquePetani
      ),

      changeProduksi: getChangePercent(
        currentSummary.totalProduksi,
        previousSummary.totalProduksi
      ),

      changeRata: getChangePercent(
        currentSummary.rataProduksi,
        previousSummary.rataProduksi
      ),
    };
  }, [
    filteredData,
    enrichedData,
    startDate,
    endDate,
    selectedKecamatan,
    selectedDesa,
    selectedPetani,
    selectedStatus,
  ]);

  const applyFilter = () => {
    setStartDate(draftStartDate);
    setEndDate(draftEndDate);
    setSelectedKecamatan(draftKecamatan);
    setSelectedDesa(draftDesa);
    setSelectedPetani(draftPetani);
    setSelectedStatus(draftStatus);
    setPage(1);
  };

  const resetFilter = () => {
    const defaultStart = getDefaultStartDate();
    const defaultEnd = getDefaultEndDate();

    setDraftStartDate(defaultStart);
    setDraftEndDate(defaultEnd);
    setDraftKecamatan("");
    setDraftDesa("");
    setDraftPetani("");
    setDraftStatus("");

    setStartDate(defaultStart);
    setEndDate(defaultEnd);
    setSelectedKecamatan("");
    setSelectedDesa("");
    setSelectedPetani("");
    setSelectedStatus("");
    setPage(1);
  };

  const exportPdf = () => {
    const doc = new jsPDF("l", "mm", "a4");

    doc.setFontSize(16);
    doc.text("Laporan Panen GeoPanen", 14, 14);

    doc.setFontSize(9);
    doc.text(
      `Periode: ${formatDateSlash(startDate)} - ${formatDateSlash(endDate)}`,
      14,
      22
    );

    autoTable(doc, {
      startY: 29,
      head: [
        [
          "No",
          "Lahan",
          "Petani",
          "Kecamatan",
          "Desa",
          "Varietas",
          "Luas (Ha)",
          "Prediksi (Ton)",
          "Rata Ton/Ha",
          "Periode",
          "Tanggal",
          "Status",
        ],
      ],
      body: sortedData.map((item, index) => [
        index + 1,
        item.nama_lahan_view,
        item.nama_petani_view,
        item.kecamatan_view,
        item.desa_view,
        item.varietas_view,
        formatNumber(item.luas_ha_view, 2),
        formatNumber(item.prediksi_ton_view, 2),
        formatNumber(item.rata_ton_ha_view, 2),
        item.periode_view,
        formatDateSlash(item.created_at_view),
        getStatusLabel(item.status_view),
      ]),
      theme: "grid",
      headStyles: {
        fillColor: [22, 163, 74],
        textColor: 255,
        fontSize: 8,
      },
      styles: {
        fontSize: 7,
        cellPadding: 2,
      },
    });

    doc.save(`laporan-panen-geopanen-${Date.now()}.pdf`);
  };

  const exportExcel = () => {
    const headers = [
      "No",
      "Lahan",
      "Petani",
      "Kecamatan",
      "Desa",
      "Varietas",
      "Luas Ha",
      "Prediksi Ton",
      "Prediksi Kg",
      "Rata Ton Ha",
      "Total Produksi Ton",
      "Periode",
      "Tanggal Prediksi",
      "Status",
    ];

    const rows = sortedData.map((item, index) => [
      index + 1,
      item.nama_lahan_view,
      item.nama_petani_view,
      item.kecamatan_view,
      item.desa_view,
      item.varietas_view,
      item.luas_ha_view,
      item.prediksi_ton_view,
      item.prediksi_kg_view,
      item.rata_ton_ha_view,
      item.prediksi_ton_view,
      item.periode_view,
      formatDateSlash(item.created_at_view),
      getStatusLabel(item.status_view),
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
    link.download = `laporan-panen-geopanen-${Date.now()}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

  const cetakLaporan = () => {
    window.print();
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.breadcrumb}>
            <Home size={17} />
            <span>Dashboard</span>
            <span>/</span>
            <span>Laporan</span>
            <span>/</span>
            <strong>Laporan Panen</strong>
          </div>

          <h1 style={styles.title}>Laporan Panen</h1>

          <p style={styles.subtitle}>
            Laporan hasil prediksi panen berdasarkan data lahan dan periode yang
            dipilih.
          </p>
        </div>

        <div style={styles.headerRight}>
          <div style={styles.datePicker}>
            <CalendarDays size={18} />
            <input
              type="date"
              value={draftStartDate}
              onChange={(e) => setDraftStartDate(e.target.value)}
              style={styles.dateInput}
            />
            <span style={styles.dateSeparator}>-</span>
            <input
              type="date"
              value={draftEndDate}
              onChange={(e) => setDraftEndDate(e.target.value)}
              style={styles.dateInput}
            />
            <ChevronDown size={16} />
          </div>

          <button type="button" style={styles.filterTopBtn} onClick={applyFilter}>
            <Filter size={17} />
            Filter
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

      <section style={styles.exportRow}>
        <button type="button" style={styles.pdfBtn} onClick={exportPdf}>
          <FileText size={18} />
          Export PDF
        </button>

        <button type="button" style={styles.excelBtn} onClick={exportExcel}>
          <Download size={18} />
          Export Excel
        </button>

        <button type="button" style={styles.printBtn} onClick={cetakLaporan}>
          <Printer size={18} />
          Cetak
        </button>
      </section>

      <section style={styles.statsGrid}>
        <StatCard
          icon={<Sprout size={34} />}
          iconBoxStyle={styles.greenIconBox}
          label="Total Luas Lahan"
          value={loading ? "..." : formatNumber(summary.totalLuas, 2)}
          smallText="Ha"
          note={getChangeNote(summary.changeLuas)}
          noteColor={getChangeColor(summary.changeLuas)}
        />

        <StatCard
          icon={<Users size={34} />}
          iconBoxStyle={styles.purpleIconBox}
          label="Total Petani"
          value={loading ? "..." : formatNumber(summary.uniquePetani, 0)}
          smallText="Orang"
          note={getChangeNote(summary.changePetani)}
          noteColor={getChangeColor(summary.changePetani)}
        />

        <StatCard
          icon={<BarChart3 size={34} />}
          iconBoxStyle={styles.blueIconBox}
          label="Total Produksi (Prediksi)"
          value={loading ? "..." : formatNumber(summary.totalProduksi, 2)}
          smallText="Ton"
          note={getChangeNote(summary.changeProduksi)}
          noteColor={getChangeColor(summary.changeProduksi)}
        />

        <StatCard
          icon={<Scale size={34} />}
          iconBoxStyle={styles.orangeIconBox}
          label="Rata-rata Produksi"
          value={loading ? "..." : formatNumber(summary.rataProduksi, 2)}
          smallText="Ton/Ha"
          note={getChangeNote(summary.changeRata)}
          noteColor={getChangeColor(summary.changeRata)}
        />

        <StatCard
          icon={<CalendarCheck size={34} />}
          iconBoxStyle={styles.greenIconBox}
          label="Periode Laporan"
          value={`${formatDateSlash(startDate)} - ${formatDateSlash(endDate)}`}
          smallText=""
          note={`${summary.periodeHari} Hari`}
          noteColor="#475569"
          compact
        />
      </section>

      <section style={styles.filterCard}>
        <div style={styles.filterGroup}>
          <label>Periode</label>
          <div style={styles.inlineDate}>
            <input
              type="date"
              value={draftStartDate}
              onChange={(e) => setDraftStartDate(e.target.value)}
              style={styles.filterInput}
            />
            <input
              type="date"
              value={draftEndDate}
              onChange={(e) => setDraftEndDate(e.target.value)}
              style={styles.filterInput}
            />
          </div>
        </div>

        <div style={styles.filterGroup}>
          <label>Kecamatan</label>
          <select
            value={draftKecamatan}
            onChange={(e) => setDraftKecamatan(e.target.value)}
            style={styles.select}
          >
            <option value="">Semua Kecamatan</option>
            {kecamatanOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label>Desa</label>
          <select
            value={draftDesa}
            onChange={(e) => setDraftDesa(e.target.value)}
            style={styles.select}
          >
            <option value="">Semua Desa</option>
            {desaOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label>Petani</label>
          <select
            value={draftPetani}
            onChange={(e) => setDraftPetani(e.target.value)}
            style={styles.select}
          >
            <option value="">Semua Petani</option>
            {petaniOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label>Status Prediksi</label>
          <select
            value={draftStatus}
            onChange={(e) => setDraftStatus(e.target.value)}
            style={styles.select}
          >
            <option value="">Semua Status</option>
            <option value="selesai">Selesai</option>
            <option value="proses">Proses</option>
            <option value="gagal">Gagal</option>
          </select>
        </div>

        <div style={styles.filterAction}>
          <button type="button" style={styles.resetBtn} onClick={resetFilter}>
            Reset
          </button>

          <button type="button" style={styles.applyBtn} onClick={applyFilter}>
            Terapkan
          </button>
        </div>
      </section>

      <section style={styles.tableCard}>
        <h3 style={styles.cardTitle}>Data Laporan Panen</h3>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>No</th>
                <th style={styles.th}>Lahan</th>
                <th style={styles.th}>Petani</th>
                <th style={styles.th}>Kecamatan</th>
                <th style={styles.th}>Desa</th>
                <th style={styles.th}>Varietas</th>
                <th style={styles.th}>Luas (Ha)</th>
                <th style={styles.th}>Prediksi Produksi</th>
                <th style={styles.th}>Rata-rata (Ton/Ha)</th>
                <th style={styles.th}>Total Produksi (Ton)</th>
                <th style={styles.th}>Periode</th>
                <th style={styles.th}>Tanggal Prediksi</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={13} style={styles.emptyCell}>
                    Memuat data laporan...
                  </td>
                </tr>
              )}

              {!loading && paginatedData.length === 0 && (
                <tr>
                  <td colSpan={13} style={styles.emptyCell}>
                    Tidak ada data laporan.
                  </td>
                </tr>
              )}

              {!loading &&
                paginatedData.map((item, index) => (
                  <tr
                    key={`${item.id || index}-${item.created_at_view}`}
                    style={styles.tr}
                  >
                    <td style={styles.td}>
                      {(page - 1) * perPage + index + 1}
                    </td>
                    <td style={styles.td}>{item.nama_lahan_view}</td>
                    <td style={styles.td}>{item.nama_petani_view}</td>
                    <td style={styles.td}>{item.kecamatan_view}</td>
                    <td style={styles.td}>{item.desa_view}</td>
                    <td style={styles.td}>{item.varietas_view}</td>
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
                    <td style={styles.td}>
                      {formatNumber(item.rata_ton_ha_view, 2)}
                    </td>
                    <td style={styles.td}>
                      {formatNumber(item.prediksi_ton_view, 2)}
                    </td>
                    <td style={styles.td}>{item.periode_view}</td>
                    <td style={styles.td}>
                      {formatDateSlash(item.created_at_view)}
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
            {formatNumber(sortedData.length, 0)} data
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

            {[1, 2, 3, 4, 5].map((item) => {
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

            {totalPages > 6 && <span style={styles.pageDots}>...</span>}

            {totalPages > 5 && (
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
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              ›
            </button>

            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(1);
              }}
              style={styles.perPageSelect}
            >
              <option value={10}>10 / halaman</option>
              <option value={25}>25 / halaman</option>
              <option value={50}>50 / halaman</option>
            </select>
          </div>
        </div>
      </section>

      <section style={styles.infoBox}>
        <Info size={24} />
        <div>
          <strong>Informasi</strong>
          <p>
            Laporan ini menampilkan data prediksi panen berdasarkan filter yang
            dipilih. Data dapat diunduh dalam format PDF atau Excel.
          </p>
        </div>
      </section>

      <footer style={styles.footer}>
        <span>© 2026 GeoPanen. All rights reserved.</span>
        <span>Versi {appVersion}</span>
      </footer>

      <style>{`
        @media print {
          button,
          select,
          input {
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
  compact = false,
}) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statIcon, ...iconBoxStyle }}>{icon}</div>

      <div>
        <p style={styles.statLabel}>{label}</p>

        <div style={styles.statValueWrap}>
          <h2
            style={{
              ...styles.statValue,
              fontSize: compact ? 22 : 29,
            }}
          >
            {value}
          </h2>
          {smallText && <span>{smallText}</span>}
        </div>

        <span style={{ ...styles.statNote, color: noteColor }}>{note}</span>
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
    marginBottom: 12,
  },

  breadcrumb: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "#64748b",
    fontSize: 14,
    marginBottom: 16,
  },

  title: {
    margin: 0,
    fontSize: 32,
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
    minWidth: 330,
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
    fontWeight: 800,
    color: "#0f172a",
    width: "100%",
    background: "transparent",
  },

  dateSeparator: {
    color: "#94a3b8",
    fontWeight: 900,
  },

  filterTopBtn: {
    height: 46,
    border: "1px solid #dbe3ea",
    borderRadius: 10,
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 850,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 18px",
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

  exportRow: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 14,
    marginBottom: 18,
  },

  pdfBtn: {
    height: 46,
    border: "1px solid #dbe3ea",
    borderRadius: 10,
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "0 20px",
    cursor: "pointer",
  },

  excelBtn: {
    height: 46,
    border: "1px solid #dbe3ea",
    borderRadius: 10,
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "0 20px",
    cursor: "pointer",
  },

  printBtn: {
    height: 46,
    border: "1px solid #dbe3ea",
    borderRadius: 10,
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "0 20px",
    cursor: "pointer",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 16,
    marginBottom: 20,
  },

  statCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    minHeight: 125,
    padding: 20,
    display: "flex",
    alignItems: "center",
    gap: 16,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  statIcon: {
    width: 62,
    height: 62,
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

  purpleIconBox: {
    background: "#ede9fe",
    color: "#6d28d9",
  },

  blueIconBox: {
    background: "#dbeafe",
    color: "#2563eb",
  },

  orangeIconBox: {
    background: "#ffedd5",
    color: "#f59e0b",
  },

  statLabel: {
    margin: 0,
    color: "#334155",
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
    fontSize: 29,
    fontWeight: 950,
  },

  statNote: {
    fontSize: 12,
    fontWeight: 800,
  },

  filterCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 20,
    display: "grid",
    gridTemplateColumns: "1.15fr 1fr 1fr 1fr 1fr auto",
    gap: 22,
    marginBottom: 0,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.05)",
  },

  filterGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  inlineDate: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },

  filterInput: {
    height: 42,
    border: "1px solid #dbe3ea",
    borderRadius: 9,
    padding: "0 12px",
    outline: "none",
    fontWeight: 800,
    background: "#ffffff",
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

  filterAction: {
    display: "flex",
    alignItems: "flex-end",
    gap: 12,
  },

  resetBtn: {
    height: 42,
    minWidth: 86,
    border: "1px solid #0f172a",
    borderRadius: 9,
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 900,
    cursor: "pointer",
  },

  applyBtn: {
    height: 42,
    minWidth: 100,
    border: "none",
    borderRadius: 9,
    background: "#16a34a",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },

  tableCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "0 0 16px 16px",
    padding: 14,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  cardTitle: {
    margin: "12px 10px 18px",
    fontSize: 18,
    fontWeight: 950,
  },

  tableWrapper: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 1280,
  },

  th: {
    textAlign: "left",
    padding: "12px 12px",
    background: "#16a34a",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  tr: {
    borderBottom: "1px solid #e5e7eb",
  },

  td: {
    padding: "13px 12px",
    fontSize: 14,
    color: "#0f172a",
    verticalAlign: "middle",
    whiteSpace: "nowrap",
  },

  subText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 750,
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

  paginationWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginTop: 18,
    padding: "0 8px 8px",
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
    height: 38,
    border: "1px solid #dbe3ea",
    borderRadius: 8,
    padding: "0 12px",
    fontWeight: 800,
    outline: "none",
  },

  infoBox: {
    marginTop: 18,
    borderRadius: 14,
    border: "1px solid #bbf7d0",
    background: "#ecfdf5",
    color: "#047857",
    padding: 18,
    display: "flex",
    alignItems: "center",
    gap: 14,
  },

  footer: {
    display: "flex",
    justifyContent: "space-between",
    color: "#475569",
    fontSize: 14,
    marginTop: 28,
  },
};
