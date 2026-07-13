import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const EMPTY_FORM = {
  type: "rekomendasi",
  title: "Rekomendasi Penyuluh",
  date: "",
  time: "08:00",
  description: "",
};

const EVENT_META = {
  pemupukan: {
    label: "Pemupukan",
    icon: "🌱",
    background: "#eefbf3",
    color: "#18794e",
    border: "#a7e2bf",
  },
  irigasi: {
    label: "Irigasi",
    icon: "💧",
    background: "#edf7ff",
    color: "#1769aa",
    border: "#add8f4",
  },
  penyemprotan: {
    label: "Penyemprotan",
    icon: "🧪",
    background: "#f5f0ff",
    color: "#7047a8",
    border: "#d8c5f0",
  },
  pengendalian_hama: {
    label: "Pengendalian Hama",
    icon: "🛡️",
    background: "#fff3ec",
    color: "#b75322",
    border: "#f5c5aa",
  },
  pengamatan: {
    label: "Pengamatan",
    icon: "🌿",
    background: "#f5fae9",
    color: "#5c7f21",
    border: "#d7e7ab",
  },
  panen: {
    label: "Panen",
    icon: "🌾",
    background: "#fff9df",
    color: "#9b7416",
    border: "#eed98c",
  },
  rekomendasi_penyuluh: {
    label: "Saran Penyuluh",
    icon: "💬",
    background: "#f4efff",
    color: "#6541a5",
    border: "#d9cdf3",
  },
  kunjungan_penyuluh: {
    label: "Kunjungan",
    icon: "📍",
    background: "#fff4e8",
    color: "#9c5a14",
    border: "#f0d1ac",
  },
  manual: {
    label: "Kegiatan",
    icon: "📌",
    background: "#f5f6f8",
    color: "#596174",
    border: "#d8dce4",
  },
};

const pad2 = (value) => String(value).padStart(2, "0");

const parseDate = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  const text = String(value).slice(0, 10);

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toDateKey = (value) => {
  const date = parseDate(value);
  if (!date) return "";

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;
};

const toMonthKey = (value) => {
  const date = parseDate(value);
  if (!date) return "";

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
};

const firstDayOfMonth = (value) => {
  const date = parseDate(value) || new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const formatLongDate = (value) => {
  const date = parseDate(value);
  if (!date) return "-";

  return date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatShortDate = (value) => {
  const date = parseDate(value);
  if (!date) return "Belum tersedia";

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (value) => String(value || "08:00").slice(0, 5);

const titleCase = (value) =>
  String(value || "-")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.petani)) return payload.petani;
  if (Array.isArray(payload?.petani_binaan)) return payload.petani_binaan;
  if (Array.isArray(payload?.data?.petani)) return payload.data.petani;
  if (Array.isArray(payload?.data?.petani_binaan)) {
    return payload.data.petani_binaan;
  }
  return [];
};

const getToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("accessToken") ||
  localStorage.getItem("authToken") ||
  "";

const getAxiosConfig = (params = {}) => {
  const token = getToken();

  return {
    params,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  };
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const normalizePetani = (item) => ({
  // petani_id harus diprioritaskan. item.id dapat berupa ID relasi binaan.
  id:
    item?.petani_id ||
    item?.user_id ||
    item?.id_petani ||
    item?.id_user ||
    item?.id ||
    "",
  name:
    item?.nama_petani ||
    item?.nama ||
    item?.name ||
    item?.nama_lengkap ||
    item?.full_name ||
    "Petani",
  village:
    item?.nama_desa ||
    item?.desa ||
    item?.village ||
    item?.nama_kecamatan ||
    item?.kecamatan ||
    "",
});

const normalizeEvent = (event, index = 0) => ({
  ...event,
  id: event?.id || event?.kalender_id || `event-${index}`,
  tanggal: toDateKey(event?.tanggal || event?.event_date),
  waktu: formatTime(event?.waktu || event?.jam),
  nama_kegiatan:
    event?.nama_kegiatan || event?.judul || event?.title || "Kegiatan Budidaya",
  jenis: String(event?.jenis || event?.kategori || "manual").toLowerCase(),
  status: event?.status || "terjadwal",
  prioritas: event?.prioritas || "sedang",
  catatan:
    event?.catatan ||
    event?.metode ||
    event?.deskripsi ||
    event?.description ||
    "",
});

const buildMonthCells = (monthValue) => {
  const month = firstDayOfMonth(monthValue);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekDay = new Date(year, monthIndex, 1).getDay();
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  const previousMonthDays = new Date(year, monthIndex, 0).getDate();
  const cells = [];

  for (let offset = firstWeekDay - 1; offset >= 0; offset -= 1) {
    const day = previousMonthDays - offset;
    const date = new Date(year, monthIndex - 1, day);
    cells.push({
      date,
      key: toDateKey(date),
      day,
      currentMonth: false,
    });
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(year, monthIndex, day);
    cells.push({
      date,
      key: toDateKey(date),
      day,
      currentMonth: true,
    });
  }

  while (cells.length < 42) {
    const day = cells.length - firstWeekDay - totalDays + 1;
    const date = new Date(year, monthIndex + 1, day);
    cells.push({
      date,
      key: toDateKey(date),
      day,
      currentMonth: false,
    });
  }

  return cells;
};

const getEventMeta = (event) => {
  const source = [
    event?.jenis,
    event?.nama_kegiatan,
    event?.pupuk,
    event?.metode,
    event?.catatan,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (source.includes("kunjungan") && source.includes("penyuluh")) {
    return EVENT_META.kunjungan_penyuluh;
  }

  if (source.includes("rekomendasi") && source.includes("penyuluh")) {
    return EVENT_META.rekomendasi_penyuluh;
  }

  if (source.includes("panen")) return EVENT_META.panen;

  if (
    source.includes("irigasi") ||
    source.includes("air") ||
    source.includes("drainase")
  ) {
    return EVENT_META.irigasi;
  }

  if (
    source.includes("semprot") ||
    source.includes("pestisida") ||
    source.includes("fungisida")
  ) {
    return EVENT_META.penyemprotan;
  }

  if (
    source.includes("hama") ||
    source.includes("penyakit") ||
    source.includes("wereng")
  ) {
    return EVENT_META.pengendalian_hama;
  }

  if (
    source.includes("pupuk") ||
    source.includes("urea") ||
    source.includes("sp-36") ||
    source.includes("kcl") ||
    source.includes("za")
  ) {
    return EVENT_META.pemupukan;
  }

  if (source.includes("pengamatan") || source.includes("monitoring")) {
    return EVENT_META.pengamatan;
  }

  return EVENT_META.manual;
};

export default function KalenderPenyuluh() {
  const todayKey = toDateKey(new Date());

  const [petaniList, setPetaniList] = useState([]);
  const [lahanList, setLahanList] = useState([]);
  const [selectedPetaniId, setSelectedPetaniId] = useState("");
  const [selectedLahanId, setSelectedLahanId] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [currentMonth, setCurrentMonth] = useState(firstDayOfMonth(new Date()));
  const [overview, setOverview] = useState(null);

  const [loadingPetani, setLoadingPetani] = useState(true);
  const [loadingLahan, setLoadingLahan] = useState(false);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    date: todayKey,
  });

  const data = overview?.data || null;
  const cycle = data?.cycle || null;
  const selectedDay = data?.selected_day || null;
  const overviewLahan = data?.lahan || null;
  const monitoring = selectedDay?.monitoring_harian || null;
  const insight = selectedDay?.insight || null;
  const recommendation = selectedDay?.recommendation || insight || null;

  const selectedPetani = useMemo(
    () =>
      petaniList.find(
        (item) => String(item.id) === String(selectedPetaniId),
      ) || null,
    [petaniList, selectedPetaniId],
  );

  const selectedLahan = useMemo(() => {
    if (overviewLahan) return overviewLahan;

    return (
      lahanList.find(
        (item) => String(item.id) === String(selectedLahanId),
      ) || null
    );
  }, [overviewLahan, lahanList, selectedLahanId]);

  const monthEvents = useMemo(
    () => (data?.month_events || []).map(normalizeEvent),
    [data?.month_events],
  );

  const selectedActivities = useMemo(
    () => (selectedDay?.activities || []).map(normalizeEvent),
    [selectedDay?.activities],
  );

  const upcomingActivities = useMemo(
    () => (data?.upcoming_activities || []).map(normalizeEvent),
    [data?.upcoming_activities],
  );

  const eventMap = useMemo(() => {
    const map = {};

    monthEvents.forEach((event) => {
      if (!event.tanggal) return;
      if (!map[event.tanggal]) map[event.tanggal] = [];
      map[event.tanggal].push(event);
    });

    Object.keys(map).forEach((key) => {
      map[key].sort((left, right) => left.waktu.localeCompare(right.waktu));
    });

    return map;
  }, [monthEvents]);

  const monthCells = useMemo(
    () => buildMonthCells(currentMonth),
    [currentMonth],
  );

  const completedCount = useMemo(
    () =>
      monthEvents.filter((item) =>
        ["selesai", "completed", "done"].includes(
          String(item.status).toLowerCase(),
        ),
      ).length,
    [monthEvents],
  );

  const lateCount = useMemo(
    () =>
      monthEvents.filter((item) => {
        const status = String(item.status).toLowerCase();
        const completed = ["selesai", "completed", "done"].includes(status);
        return !completed && item.tanggal && item.tanggal < todayKey;
      }).length,
    [monthEvents, todayKey],
  );

  const progress = Math.max(
    0,
    Math.min(100, Number(cycle?.progress_percent || 0)),
  );

  const progressDegree = progress * 3.6;

  const loadPetaniBinaan = async () => {
    try {
      setLoadingPetani(true);
      setError("");

      const response = await axios.get(
        `${API}/penyuluh/petani-binaan`,
        getAxiosConfig(),
      );

      const normalized = normalizeList(response.data)
        .map(normalizePetani)
        .filter((item) => item.id);

      const unique = Array.from(
        new Map(normalized.map((item) => [String(item.id), item])).values(),
      );

      setPetaniList(unique);

      if (unique.length > 0) {
        setSelectedPetaniId((current) => {
          const stillExists = unique.some(
            (item) => String(item.id) === String(current),
          );

          return stillExists ? current : String(unique[0].id);
        });
      } else {
        setSelectedPetaniId("");
        setLahanList([]);
        setSelectedLahanId("");
        setOverview(null);
      }
    } catch (requestError) {
      setPetaniList([]);
      setSelectedPetaniId("");
      setError(
        getErrorMessage(requestError, "Gagal mengambil daftar petani binaan."),
      );
    } finally {
      setLoadingPetani(false);
    }
  };

  const loadLahanPetani = async (petaniId) => {
    if (!petaniId) {
      setLahanList([]);
      setSelectedLahanId("");
      setOverview(null);
      return;
    }

    try {
      setLoadingLahan(true);
      setError("");
      setSuccess("");
      setLahanList([]);
      setSelectedLahanId("");
      setOverview(null);

      // Sama persis dengan cara Kalender Petani mengambil lahan.
      const response = await axios.get(
        `${API}/lahan`,
        getAxiosConfig({
          user_id: petaniId,
          petani_id: petaniId,
        }),
      );

      const list = normalizeList(response.data).filter(
        (item) =>
          !["dihapus", "deleted"].includes(
            String(item?.status_lahan || "").toLowerCase(),
          ),
      );

      setLahanList(list);

      if (list.length > 0) {
        setSelectedLahanId(String(list[0].id));
      } else {
        setError(
          `Petani ${selectedPetani?.name || "yang dipilih"} belum memiliki lahan.`,
        );
      }
    } catch (requestError) {
      setLahanList([]);
      setSelectedLahanId("");
      setOverview(null);
      setError(getErrorMessage(requestError, "Gagal memuat lahan petani."));
    } finally {
      setLoadingLahan(false);
    }
  };

  const loadOverview = async () => {
    if (!selectedPetaniId || !selectedLahanId || !selectedDate) {
      setOverview(null);
      return null;
    }

    try {
      setLoadingOverview(true);
      setError("");

      // Endpoint dan bentuk data sama dengan Kalender Petani.
      const response = await axios.get(
        `${API}/kalender/${selectedLahanId}/overview`,
        getAxiosConfig({
          tanggal: selectedDate,
          bulan: toMonthKey(currentMonth),
          user_id: selectedPetaniId,
          petani_id: selectedPetaniId,
        }),
      );

      setOverview(response.data);
      return response.data;
    } catch (requestError) {
      setOverview(null);
      setError(
        getErrorMessage(
          requestError,
          "Gagal memuat kalender budidaya petani binaan.",
        ),
      );
      return null;
    } finally {
      setLoadingOverview(false);
    }
  };

  useEffect(() => {
    loadPetaniBinaan();
  }, []);

  useEffect(() => {
    loadLahanPetani(selectedPetaniId);
  }, [selectedPetaniId]);

  useEffect(() => {
    loadOverview();
  }, [selectedPetaniId, selectedLahanId, selectedDate, currentMonth]);

  const chooseDate = (dateValue) => {
    const key = toDateKey(dateValue);
    if (!key) return;

    setSelectedDate(key);

    const date = parseDate(key);
    if (
      date &&
      (date.getFullYear() !== currentMonth.getFullYear() ||
        date.getMonth() !== currentMonth.getMonth())
    ) {
      setCurrentMonth(firstDayOfMonth(date));
    }
  };

  const moveMonth = (direction) => {
    const nextMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + direction,
      1,
    );

    setCurrentMonth(nextMonth);
    setSelectedDate(toDateKey(nextMonth));
  };

  const goToday = () => {
    setSelectedDate(todayKey);
    setCurrentMonth(firstDayOfMonth(new Date()));
  };

  const refreshCalendar = async () => {
    if (!selectedPetaniId || !selectedLahanId) return;

    try {
      setGenerating(true);
      setError("");
      setSuccess("");

      await axios.post(
        `${API}/kalender/${selectedLahanId}/generate`,
        {
          user_id: Number(selectedPetaniId),
          petani_id: Number(selectedPetaniId),
        },
        getAxiosConfig(),
      );

      await loadOverview();
      setSuccess("Kalender petani berhasil diperbarui.");
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, "Kalender petani gagal diperbarui."),
      );
    } finally {
      setGenerating(false);
    }
  };

  const openModal = (type) => {
    if (!selectedPetaniId || !selectedLahanId) {
      setError("Pilih petani dan lahan terlebih dahulu.");
      return;
    }

    setError("");
    setSuccess("");
    setForm({
      type,
      title:
        type === "kunjungan"
          ? "Kunjungan Lapangan"
          : "Rekomendasi Penyuluh",
      date: selectedDate || todayKey,
      time: "08:00",
      description: "",
    });
    setModalOpen(true);
  };

  const submitAgenda = async (event) => {
    event.preventDefault();

    if (!form.title.trim() || !form.date || !form.description.trim()) {
      setError("Judul, tanggal, dan catatan wajib diisi.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const jenis =
        form.type === "kunjungan"
          ? "kunjungan_penyuluh"
          : "rekomendasi_penyuluh";

      // Tersimpan pada tabel kalender_budidaya yang sama dengan Kalender Petani.
      await axios.post(
        `${API}/kalender`,
        {
          lahan_id: Number(selectedLahanId),
          sawah_id: Number(selectedLahanId),
          user_id: Number(selectedPetaniId),
          nama_kegiatan: form.title.trim(),
          jenis,
          tanggal: form.date,
          waktu: form.time || "08:00",
          metode: form.description.trim(),
          catatan: form.description.trim(),
          durasi:
            form.type === "kunjungan" ? "Kunjungan penyuluh" : null,
        },
        getAxiosConfig(),
      );

      setModalOpen(false);
      setSuccess(
        form.type === "kunjungan"
          ? "Kunjungan berhasil ditambahkan ke kalender petani."
          : "Rekomendasi berhasil ditambahkan ke kalender petani.",
      );

      await loadOverview();
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Agenda gagal disimpan."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <style>{CSS}</style>

      <main className="kp-page">
        <header className="kp-header">
          <div>
            <div className="kp-brand-row">
              <div className="kp-brand-icon">🌾</div>
              <div>
                <span className="kp-eyebrow">GEOPANEN PENYULUH</span>
                <h1>Kalender Binaan</h1>
              </div>
            </div>
            <p>
              Kalender ini membaca lahan dan jadwal yang sama dengan Kalender
              Petani.
            </p>
          </div>

          <div className="kp-header-actions">
            <button
              type="button"
              className="kp-button kp-button-outline"
              disabled={!selectedLahanId}
              onClick={() => openModal("rekomendasi")}
            >
              + Beri Rekomendasi
            </button>

            <button
              type="button"
              className="kp-button kp-button-primary"
              disabled={!selectedLahanId}
              onClick={() => openModal("kunjungan")}
            >
              + Jadwalkan Kunjungan
            </button>
          </div>
        </header>

        {error && (
          <div className="kp-alert kp-alert-error">
            <span>!</span>
            <div>
              <strong>Terjadi kendala</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="kp-alert kp-alert-success">
            <span>✓</span>
            <div>
              <strong>Berhasil</strong>
              <p>{success}</p>
            </div>
          </div>
        )}

        <section className="kp-filter-card">
          <label>
            <span>PETANI BINAAN</span>
            <select
              value={selectedPetaniId}
              disabled={loadingPetani}
              onChange={(event) => setSelectedPetaniId(event.target.value)}
            >
              <option value="">
                {loadingPetani ? "Memuat petani..." : "Pilih petani binaan"}
              </option>

              {petaniList.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.village ? ` - ${item.village}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>LAHAN PETANI</span>
            <select
              value={selectedLahanId}
              disabled={!selectedPetaniId || loadingLahan}
              onChange={(event) => setSelectedLahanId(event.target.value)}
            >
              <option value="">
                {loadingLahan ? "Memuat lahan..." : "Pilih lahan"}
              </option>

              {lahanList.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nama_lahan || `Lahan ${item.id}`}
                </option>
              ))}
            </select>
          </label>

          <div className="kp-active-data">
            <span className="kp-pin">📍</span>
            <div>
              <small>DATA AKTIF</small>
              <strong>{selectedPetani?.name || "Belum memilih petani"}</strong>
              <span>
                {selectedLahan?.nama_lahan || "Belum memilih lahan"}
              </span>
            </div>
          </div>
        </section>

        <section className="kp-summary-grid">
          <div className="kp-plant-card">
            <div className="kp-plant-copy">
              <span className="kp-phase">
                {cycle?.fase_label || "Fase tanaman belum tersedia"}
              </span>

              <h2>HST {cycle?.hst ?? 0}</h2>

              <p>
                {selectedLahan?.varietas || "Varietas belum diisi"} · Desa{" "}
                {selectedLahan?.nama_desa || "-"}, Kec. {" "}
                {selectedLahan?.nama_kecamatan || "-"}
              </p>

              <div className="kp-plant-meta">
                <Meta
                  label="Mulai tanam"
                  value={formatShortDate(selectedLahan?.tanggal_tanam)}
                />
                <Meta
                  label="Estimasi panen"
                  value={formatShortDate(cycle?.estimasi_panen)}
                />
                <Meta
                  label="Luas lahan"
                  value={
                    selectedLahan?.luas_ha
                      ? `${selectedLahan.luas_ha} Ha`
                      : "Belum tersedia"
                  }
                />
              </div>
            </div>

            <div
              className="kp-progress-ring"
              style={{
                background: `conic-gradient(#8ae1ae ${progressDegree}deg, rgba(255,255,255,.25) ${progressDegree}deg)`,
              }}
            >
              <div>
                <strong>{Math.round(progress)}%</strong>
                <span>progres</span>
              </div>
            </div>
          </div>

          <div className="kp-stats-card">
            <div className="kp-stats-heading">
              <div>
                <small>RINGKASAN JADWAL</small>
                <strong>
                  {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </strong>
              </div>
              <button
                type="button"
                title="Perbarui kalender petani"
                onClick={refreshCalendar}
                disabled={!selectedLahanId || generating}
              >
                <span className={generating ? "kp-spin" : ""}>↻</span>
              </button>
            </div>

            <div className="kp-stat-grid">
              <Stat label="Bulan ini" value={monthEvents.length} />
              <Stat label="Hari terpilih" value={selectedActivities.length} />
              <Stat label="Selesai" value={completedCount} />
              <Stat label="Terlambat" value={lateCount} danger />
            </div>
          </div>
        </section>

        <section className="kp-note">
          <span className="kp-note-icon">i</span>
          <div>
            <small>TERHUBUNG DENGAN KALENDER PETANI</small>
            <strong>Kalender Budidaya Petani Binaan</strong>
            <p>
              Lahan diambil dari endpoint yang sama dengan role petani. Jadwal,
              fase, HST, monitoring, dan kegiatan bulanan dibaca dari overview
              kalender petani.
            </p>
          </div>
          <span className="kp-note-status">AKTIF</span>
        </section>

        <section className="kp-calendar-layout">
          <div className="kp-calendar-card">
            <div className="kp-calendar-toolbar">
              <div>
                <small>KALENDER BULANAN</small>
                <h3>
                  {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </h3>
              </div>

              <div className="kp-calendar-nav">
                <button type="button" onClick={() => moveMonth(-1)}>
                  ‹
                </button>
                <button type="button" className="kp-today" onClick={goToday}>
                  Hari ini
                </button>
                <button type="button" onClick={() => moveMonth(1)}>
                  ›
                </button>
              </div>
            </div>

            {loadingOverview ? (
              <div className="kp-loading">
                <span className="kp-loader" />
                <p>Memuat kalender petani...</p>
              </div>
            ) : (
              <>
                <div className="kp-weekdays">
                  {DAYS.map((day) => (
                    <div key={day}>{day}</div>
                  ))}
                </div>

                <div className="kp-calendar-grid">
                  {monthCells.map((cell) => {
                    const events = eventMap[cell.key] || [];
                    const active = cell.key === selectedDate;
                    const today = cell.key === todayKey;

                    return (
                      <button
                        type="button"
                        key={cell.key}
                        className={[
                          "kp-calendar-cell",
                          active ? "is-active" : "",
                          today ? "is-today" : "",
                          !cell.currentMonth ? "is-outside" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => chooseDate(cell.key)}
                      >
                        <div className="kp-cell-head">
                          <span>{cell.day}</span>
                          {events.length > 0 && <small>{events.length}</small>}
                        </div>

                        <div className="kp-cell-events">
                          {events.slice(0, 2).map((item) => {
                            const meta = getEventMeta(item);

                            return (
                              <span
                                key={item.id}
                                style={{
                                  background: meta.background,
                                  color: meta.color,
                                  borderColor: meta.border,
                                }}
                                title={item.nama_kegiatan}
                              >
                                <i style={{ background: meta.color }} />
                                {item.nama_kegiatan}
                              </span>
                            );
                          })}

                          {events.length > 2 && (
                            <em>+{events.length - 2} kegiatan</em>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="kp-legend">
              {Object.entries(EVENT_META)
                .filter(([key]) => key !== "manual")
                .map(([key, meta]) => (
                  <span key={key}>
                    <i style={{ background: meta.color }} />
                    {meta.label}
                  </span>
                ))}
            </div>
          </div>

          <aside className="kp-side-column">
            <section className="kp-panel">
              <div className="kp-panel-heading">
                <div>
                  <small>HARI TERPILIH</small>
                  <h3>{formatLongDate(selectedDate)}</h3>
                </div>
                <span>{selectedActivities.length}</span>
              </div>

              {selectedActivities.length > 0 ? (
                <div className="kp-activity-list">
                  {selectedActivities.map((item) => {
                    const meta = getEventMeta(item);

                    return (
                      <article key={item.id} className="kp-activity-row">
                        <span
                          className="kp-activity-icon"
                          style={{
                            background: meta.background,
                            color: meta.color,
                            borderColor: meta.border,
                          }}
                        >
                          {meta.icon}
                        </span>

                        <div>
                          <span>
                            {formatTime(item.waktu)} · {meta.label}
                          </span>
                          <strong>{item.nama_kegiatan}</strong>
                          {item.catatan && <p>{item.catatan}</p>}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon="📅"
                  title="Belum ada kegiatan"
                  text="Belum ada agenda pada tanggal yang dipilih."
                />
              )}

              <div className="kp-side-actions">
                <button
                  type="button"
                  disabled={!selectedLahanId}
                  onClick={() => openModal("rekomendasi")}
                >
                  + Tambah Rekomendasi
                </button>
                <button
                  type="button"
                  disabled={!selectedLahanId}
                  onClick={() => openModal("kunjungan")}
                >
                  + Jadwalkan Kunjungan
                </button>
              </div>
            </section>

            <section className="kp-panel">
              <div className="kp-panel-heading">
                <div>
                  <small>KONDISI LAPANGAN</small>
                  <h3>Monitoring Petani</h3>
                </div>
              </div>

              {monitoring ? (
                <div className="kp-monitoring-grid">
                  <MonitoringItem
                    label="Tanaman"
                    value={titleCase(monitoring.kondisi_tanaman)}
                  />
                  <MonitoringItem
                    label="Daun"
                    value={titleCase(monitoring.kondisi_daun)}
                  />
                  <MonitoringItem
                    label="Air"
                    value={titleCase(monitoring.kondisi_air)}
                  />
                  <MonitoringItem
                    label="Hama"
                    value={titleCase(monitoring.tingkat_hama)}
                  />
                </div>
              ) : (
                <EmptyState
                  icon="📝"
                  title="Belum ada monitoring"
                  text="Petani belum mencatat kondisi lapangan pada tanggal ini."
                />
              )}
            </section>

            <section className="kp-panel">
              <div className="kp-panel-heading">
                <div>
                  <small>REKOMENDASI HARI INI</small>
                  <h3>{insight?.judul || "Belum ada analisis"}</h3>
                </div>
              </div>

              <div className="kp-recommendation">
                <p>
                  {recommendation?.rekomendasi ||
                    insight?.ringkasan ||
                    "Lanjutkan pemantauan sesuai jadwal budidaya."}
                </p>
              </div>
            </section>

            <section className="kp-panel">
              <div className="kp-panel-heading">
                <div>
                  <small>AGENDA BERIKUTNYA</small>
                  <h3>Kegiatan Mendatang</h3>
                </div>
              </div>

              {upcomingActivities.length > 0 ? (
                <div className="kp-upcoming-list">
                  {upcomingActivities.slice(0, 4).map((item) => {
                    const meta = getEventMeta(item);

                    return (
                      <div key={item.id} className="kp-upcoming-row">
                        <div className="kp-upcoming-date">
                          <strong>{parseDate(item.tanggal)?.getDate()}</strong>
                          <span>
                            {MONTHS[parseDate(item.tanggal)?.getMonth()]?.slice(
                              0,
                              3,
                            )}
                          </span>
                        </div>
                        <span
                          className="kp-upcoming-icon"
                          style={{
                            background: meta.background,
                            color: meta.color,
                            borderColor: meta.border,
                          }}
                        >
                          {meta.icon}
                        </span>
                        <div>
                          <span>{formatTime(item.waktu)}</span>
                          <strong>{item.nama_kegiatan}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon="🌿"
                  title="Belum ada agenda"
                  text="Belum ada kegiatan mendatang pada kalender petani."
                />
              )}
            </section>
          </aside>
        </section>

        {modalOpen && (
          <div
            className="kp-overlay"
            onMouseDown={() => !saving && setModalOpen(false)}
          >
            <div
              className="kp-modal"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="kp-modal-heading">
                <div>
                  <small>
                    {form.type === "kunjungan"
                      ? "AGENDA LAPANGAN"
                      : "PENDAMPINGAN PETANI"}
                  </small>
                  <h3>
                    {form.type === "kunjungan"
                      ? "Jadwalkan Kunjungan"
                      : "Tambah Rekomendasi"}
                  </h3>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setModalOpen(false)}
                >
                  ×
                </button>
              </div>

              <form className="kp-form" onSubmit={submitAgenda}>
                <div className="kp-modal-info">
                  <p>
                    <b>Petani:</b> {selectedPetani?.name || "-"}
                  </p>
                  <p>
                    <b>Lahan:</b> {selectedLahan?.nama_lahan || "-"}
                  </p>
                </div>

                <label>
                  <span>Judul kegiatan</span>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                  />
                </label>

                <div className="kp-form-row">
                  <label>
                    <span>Tanggal</span>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          date: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label>
                    <span>Jam</span>
                    <input
                      type="time"
                      value={form.time}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          time: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                <label>
                  <span>Catatan</span>
                  <textarea
                    rows={5}
                    value={form.description}
                    placeholder={
                      form.type === "kunjungan"
                        ? "Tuliskan tujuan kunjungan lapangan"
                        : "Tuliskan rekomendasi untuk petani"
                    }
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                  />
                </label>

                <div className="kp-modal-actions">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setModalOpen(false)}
                  >
                    Batal
                  </button>
                  <button type="submit" className="kp-save" disabled={saving}>
                    {saving ? "Menyimpan..." : "Simpan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function Meta({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Stat({ label, value, danger = false }) {
  return (
    <div>
      <span>{label}</span>
      <strong className={danger ? "kp-danger" : ""}>{value}</strong>
    </div>
  );
}

function MonitoringItem({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function EmptyState({ icon, title, text }) {
  return (
    <div className="kp-empty">
      <span>{icon}</span>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

const CSS = `
  * { box-sizing: border-box; }

  .kp-page {
    min-height: 100vh;
    width: 100%;
    padding: 24px;
    color: #13251a;
    background:
      radial-gradient(circle at top right, rgba(37, 180, 97, .09), transparent 30%),
      #f4f7f5;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .kp-header,
  .kp-brand-row,
  .kp-header-actions,
  .kp-active-data,
  .kp-stats-heading,
  .kp-calendar-toolbar,
  .kp-panel-heading,
  .kp-modal-heading,
  .kp-modal-actions {
    display: flex;
    align-items: center;
  }

  .kp-header {
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
    margin-bottom: 20px;
  }

  .kp-brand-row { gap: 12px; }

  .kp-brand-icon {
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border-radius: 13px;
    background: linear-gradient(135deg, #27bd69, #158445);
    box-shadow: 0 9px 21px rgba(22, 145, 76, .22);
  }

  .kp-eyebrow,
  .kp-filter-card label > span,
  .kp-note small,
  .kp-calendar-toolbar small,
  .kp-panel-heading small,
  .kp-modal-heading small {
    display: block;
    color: #168447;
    font-size: 9px;
    font-weight: 850;
    letter-spacing: .9px;
  }

  .kp-header h1 {
    margin: 2px 0 0;
    font-size: 28px;
    line-height: 1.1;
  }

  .kp-header p {
    max-width: 650px;
    margin: 10px 0 0;
    color: #68776e;
    font-size: 13px;
    line-height: 1.55;
  }

  .kp-header-actions {
    gap: 9px;
    flex-wrap: wrap;
  }

  .kp-button {
    min-height: 42px;
    padding: 0 15px;
    border-radius: 11px;
    font-size: 12px;
    font-weight: 750;
    cursor: pointer;
    transition: .18s ease;
  }

  .kp-button:hover:not(:disabled) { transform: translateY(-1px); }

  .kp-button:disabled,
  .kp-side-actions button:disabled {
    opacity: .45;
    cursor: not-allowed;
  }

  .kp-button-outline {
    color: #168447;
    background: #fff;
    border: 1px solid #b9dfc8;
  }

  .kp-button-primary {
    color: #fff;
    background: #16984f;
    border: 1px solid #16984f;
  }

  .kp-alert {
    margin-bottom: 16px;
    padding: 13px 15px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    border-radius: 13px;
    font-size: 12px;
  }

  .kp-alert > span {
    width: 25px;
    height: 25px;
    flex: 0 0 25px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: #fff;
    font-weight: 850;
  }

  .kp-alert strong,
  .kp-alert p { display: block; margin: 0; }
  .kp-alert p { margin-top: 3px; line-height: 1.5; }

  .kp-alert-error {
    color: #a52e2e;
    background: #fff0f0;
    border: 1px solid #f0c1c1;
  }

  .kp-alert-error > span { background: #d83d3d; }

  .kp-alert-success {
    color: #126a39;
    background: #ecfaf1;
    border: 1px solid #bee6cc;
  }

  .kp-alert-success > span { background: #16984f; }

  .kp-filter-card {
    margin-bottom: 16px;
    padding: 15px;
    display: grid;
    grid-template-columns: 1fr 1fr .9fr;
    gap: 13px;
    background: #fff;
    border: 1px solid #dfe8e2;
    border-radius: 17px;
    box-shadow: 0 6px 20px rgba(27, 59, 40, .04);
  }

  .kp-filter-card label > span {
    margin-bottom: 7px;
    color: #718078;
  }

  .kp-filter-card select {
    width: 100%;
    height: 44px;
    padding: 0 12px;
    border: 1px solid #d9e4dc;
    border-radius: 11px;
    background: #fff;
    color: #26362d;
    font-size: 12px;
    font-weight: 650;
    outline: none;
  }

  .kp-filter-card select:focus {
    border-color: #19a255;
    box-shadow: 0 0 0 3px rgba(25, 162, 85, .12);
  }

  .kp-filter-card select:disabled {
    background: #f1f4f2;
    color: #9aa7a0;
  }

  .kp-active-data {
    gap: 10px;
    padding: 10px 13px;
    border-radius: 13px;
    background: #effaf3;
  }

  .kp-pin {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border-radius: 11px;
    background: #d8f4e2;
  }

  .kp-active-data small,
  .kp-active-data strong,
  .kp-active-data div > span { display: block; }

  .kp-active-data small {
    color: #168447;
    font-size: 9px;
    font-weight: 850;
  }

  .kp-active-data strong {
    margin-top: 2px;
    font-size: 12px;
  }

  .kp-active-data div > span {
    margin-top: 2px;
    color: #76847b;
    font-size: 10px;
  }

  .kp-summary-grid {
    margin-bottom: 16px;
    display: grid;
    grid-template-columns: minmax(0, 1.7fr) minmax(300px, .8fr);
    gap: 15px;
  }

  .kp-plant-card {
    min-height: 220px;
    padding: 23px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    color: #fff;
    border-radius: 20px;
    background:
      radial-gradient(circle at 85% 17%, rgba(255,255,255,.14), transparent 25%),
      linear-gradient(135deg,#2fa565,#197b49);
    box-shadow: 0 10px 24px rgba(26, 119, 71, .16);
  }

  .kp-plant-copy { min-width: 0; }

  .kp-phase {
    display: inline-flex;
    padding: 6px 10px;
    border-radius: 20px;
    background: rgba(255,255,255,.15);
    border: 1px solid rgba(255,255,255,.23);
    font-size: 9px;
    font-weight: 800;
  }

  .kp-plant-card h2 {
    margin: 17px 0 5px;
    font-size: 31px;
  }

  .kp-plant-card p {
    margin: 0;
    color: #e8fff1;
    font-size: 12px;
  }

  .kp-plant-meta {
    margin-top: 22px;
    display: grid;
    grid-template-columns: repeat(3, minmax(100px, 1fr));
    gap: 20px;
  }

  .kp-plant-meta span,
  .kp-plant-meta strong { display: block; }

  .kp-plant-meta span {
    margin-bottom: 4px;
    color: #cdebd8;
    font-size: 9px;
  }

  .kp-plant-meta strong { font-size: 11px; }

  .kp-progress-ring {
    width: 105px;
    height: 105px;
    flex: 0 0 105px;
    padding: 9px;
    border-radius: 50%;
  }

  .kp-progress-ring > div {
    width: 100%;
    height: 100%;
    display: grid;
    place-content: center;
    text-align: center;
    border-radius: 50%;
    background: rgba(15,91,54,.92);
  }

  .kp-progress-ring strong {
    display: block;
    font-size: 23px;
  }

  .kp-progress-ring span {
    color: #d7f4e2;
    font-size: 9px;
  }

  .kp-stats-card,
  .kp-calendar-card,
  .kp-panel {
    background: #fff;
    border: 1px solid #dfe8e2;
    border-radius: 19px;
    box-shadow: 0 6px 20px rgba(27,59,40,.04);
  }

  .kp-stats-card { padding: 17px; }

  .kp-stats-heading {
    justify-content: space-between;
    padding-bottom: 12px;
    border-bottom: 1px solid #edf1ee;
  }

  .kp-stats-heading small,
  .kp-stats-heading strong { display: block; }

  .kp-stats-heading small {
    color: #819087;
    font-size: 9px;
    font-weight: 850;
  }

  .kp-stats-heading strong {
    margin-top: 4px;
    font-size: 13px;
  }

  .kp-stats-heading button {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 11px;
    background: #e9f8ef;
    color: #168447;
    cursor: pointer;
    font-size: 17px;
  }

  .kp-stats-heading button:disabled {
    opacity: .5;
    cursor: not-allowed;
  }

  .kp-stat-grid {
    margin-top: 12px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .kp-stat-grid > div {
    padding: 12px;
    border-radius: 11px;
    background: #f8faf9;
    border: 1px solid #edf1ee;
  }

  .kp-stat-grid span,
  .kp-stat-grid strong { display: block; }

  .kp-stat-grid span {
    color: #77857d;
    font-size: 9px;
  }

  .kp-stat-grid strong {
    margin-top: 5px;
    font-size: 19px;
  }

  .kp-danger { color: #d03939; }

  .kp-note {
    margin-bottom: 16px;
    padding: 14px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    border-radius: 15px;
    background: #fff9e9;
    border: 1px solid #f0d894;
  }

  .kp-note-icon {
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    color: #936400;
    background: #fff;
    border: 1px solid #e8cd80;
    font-weight: 850;
  }

  .kp-note > div { flex: 1; }

  .kp-note strong {
    display: block;
    margin-top: 4px;
    font-size: 13px;
  }

  .kp-note p {
    margin: 5px 0 0;
    color: #766a51;
    font-size: 10px;
    line-height: 1.55;
  }

  .kp-note-status {
    padding: 5px 8px;
    border-radius: 12px;
    color: #7f642e;
    background: #fff;
    font-size: 8px;
    font-weight: 850;
  }

  .kp-calendar-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    gap: 15px;
    align-items: start;
  }

  .kp-calendar-card { overflow: hidden; }

  .kp-calendar-toolbar {
    justify-content: space-between;
    min-height: 70px;
    padding: 14px 16px;
    border-bottom: 1px solid #edf1ee;
  }

  .kp-calendar-toolbar h3 {
    margin: 4px 0 0;
    font-size: 16px;
  }

  .kp-calendar-nav {
    display: flex;
    gap: 6px;
  }

  .kp-calendar-nav button {
    height: 35px;
    min-width: 35px;
    padding: 0 10px;
    border-radius: 9px;
    border: 1px solid #dfe7e1;
    background: #fff;
    color: #526159;
    cursor: pointer;
  }

  .kp-calendar-nav .kp-today {
    font-size: 10px;
    font-weight: 750;
  }

  .kp-weekdays,
  .kp-calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }

  .kp-weekdays {
    background: #f8faf9;
    border-bottom: 1px solid #edf1ee;
  }

  .kp-weekdays div {
    padding: 10px 4px;
    text-align: center;
    color: #78877e;
    font-size: 9px;
    font-weight: 750;
  }

  .kp-calendar-cell {
    min-width: 0;
    min-height: 112px;
    padding: 7px;
    text-align: left;
    border: 0;
    border-right: 1px solid #edf1ee;
    border-bottom: 1px solid #edf1ee;
    background: #fff;
    cursor: pointer;
  }

  .kp-calendar-cell:hover { background: #f6fbf8; }

  .kp-calendar-cell.is-outside {
    color: #b8c1bb;
    background: #fafcfb;
  }

  .kp-calendar-cell.is-active {
    background: #edfaf2;
    box-shadow: inset 0 0 0 2px #20a65a;
  }

  .kp-cell-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }

  .kp-cell-head > span {
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    font-size: 9px;
    font-weight: 800;
  }

  .kp-calendar-cell.is-today .kp-cell-head > span {
    color: #fff;
    background: #16984f;
  }

  .kp-cell-head small {
    min-width: 19px;
    height: 19px;
    padding: 0 5px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    color: #12743c;
    background: #dff5e8;
    font-size: 8px;
    font-weight: 850;
  }

  .kp-cell-events > span {
    width: 100%;
    margin-bottom: 4px;
    padding: 4px 5px;
    display: flex;
    align-items: center;
    gap: 4px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    border: 1px solid transparent;
    border-radius: 6px;
    font-size: 7px;
    font-weight: 750;
  }

  .kp-cell-events > span i {
    width: 5px;
    height: 5px;
    flex: 0 0 5px;
    border-radius: 50%;
  }

  .kp-cell-events em {
    color: #7a8980;
    font-size: 7px;
    font-style: normal;
  }

  .kp-legend {
    padding: 12px 16px;
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
  }

  .kp-legend > span {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #6f7e75;
    font-size: 8px;
  }

  .kp-legend i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .kp-loading {
    min-height: 470px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: #728077;
    font-size: 11px;
  }

  .kp-loader {
    width: 34px;
    height: 34px;
    border: 4px solid #e4ebe6;
    border-top-color: #16984f;
    border-radius: 50%;
    animation: kp-spin .8s linear infinite;
  }

  .kp-spin { display: inline-block; animation: kp-spin .8s linear infinite; }

  @keyframes kp-spin {
    to { transform: rotate(360deg); }
  }

  .kp-side-column {
    display: grid;
    gap: 15px;
  }

  .kp-panel { padding: 15px; }

  .kp-panel-heading {
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
    padding-bottom: 12px;
    border-bottom: 1px solid #edf1ee;
  }

  .kp-panel-heading h3 {
    margin: 4px 0 0;
    font-size: 14px;
    line-height: 1.4;
  }

  .kp-panel-heading > span {
    width: 27px;
    height: 27px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: #167a40;
    background: #e6f7ed;
    font-size: 9px;
    font-weight: 850;
  }

  .kp-activity-list,
  .kp-upcoming-list {
    margin-top: 12px;
    display: grid;
    gap: 8px;
  }

  .kp-activity-row {
    padding: 10px;
    display: flex;
    align-items: flex-start;
    gap: 9px;
    border: 1px solid #e1e8e3;
    border-radius: 12px;
  }

  .kp-activity-icon,
  .kp-upcoming-icon {
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    display: grid;
    place-items: center;
    border: 1px solid transparent;
    border-radius: 10px;
  }

  .kp-activity-row > div { min-width: 0; }

  .kp-activity-row > div > span {
    display: block;
    color: #8c9890;
    font-size: 8px;
  }

  .kp-activity-row strong {
    display: block;
    margin-top: 3px;
    font-size: 11px;
  }

  .kp-activity-row p {
    margin: 5px 0 0;
    color: #718078;
    font-size: 9px;
    line-height: 1.45;
  }

  .kp-empty {
    margin-top: 12px;
    padding: 30px 13px;
    text-align: center;
    border-radius: 12px;
    background: #f8faf9;
  }

  .kp-empty > span { font-size: 26px; }

  .kp-empty strong {
    display: block;
    margin-top: 9px;
    font-size: 12px;
  }

  .kp-empty p {
    margin: 5px 0 0;
    color: #87938c;
    font-size: 9px;
    line-height: 1.5;
  }

  .kp-side-actions {
    margin-top: 12px;
    display: grid;
    gap: 7px;
  }

  .kp-side-actions button {
    min-height: 38px;
    border-radius: 9px;
    color: #167a40;
    background: #effaf3;
    border: 1px solid #bce5cb;
    font-size: 10px;
    font-weight: 750;
    cursor: pointer;
  }

  .kp-side-actions button:last-child {
    color: #985914;
    background: #fff5e9;
    border-color: #efd1ad;
  }

  .kp-monitoring-grid {
    margin-top: 12px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .kp-monitoring-grid > div {
    padding: 10px;
    border-radius: 10px;
    background: #f7faf8;
    border: 1px solid #e7eee9;
  }

  .kp-monitoring-grid span,
  .kp-monitoring-grid strong { display: block; }

  .kp-monitoring-grid span {
    color: #7b8981;
    font-size: 8px;
  }

  .kp-monitoring-grid strong {
    margin-top: 4px;
    font-size: 10px;
  }

  .kp-recommendation {
    margin-top: 12px;
    padding: 12px;
    border-radius: 11px;
    background: #fff9e9;
    border: 1px solid #f0d894;
  }

  .kp-recommendation p {
    margin: 0;
    color: #6f6249;
    font-size: 10px;
    line-height: 1.55;
  }

  .kp-upcoming-row {
    display: grid;
    grid-template-columns: 38px 34px minmax(0, 1fr);
    align-items: center;
    gap: 8px;
  }

  .kp-upcoming-date {
    text-align: center;
  }

  .kp-upcoming-date strong,
  .kp-upcoming-date span { display: block; }

  .kp-upcoming-date strong { font-size: 14px; }

  .kp-upcoming-date span {
    color: #7b8981;
    font-size: 8px;
  }

  .kp-upcoming-row > div:last-child { min-width: 0; }

  .kp-upcoming-row > div:last-child span,
  .kp-upcoming-row > div:last-child strong { display: block; }

  .kp-upcoming-row > div:last-child span {
    color: #8c9890;
    font-size: 8px;
  }

  .kp-upcoming-row > div:last-child strong {
    margin-top: 3px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 10px;
  }

  .kp-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    padding: 20px;
    display: grid;
    place-items: center;
    background: rgba(7,24,15,.56);
    backdrop-filter: blur(3px);
  }

  .kp-modal {
    width: min(510px, 100%);
    overflow: hidden;
    border-radius: 17px;
    background: #fff;
    box-shadow: 0 24px 70px rgba(4,23,12,.25);
  }

  .kp-modal-heading {
    justify-content: space-between;
    padding: 16px 18px;
    border-bottom: 1px solid #e8eeea;
  }

  .kp-modal-heading h3 {
    margin: 4px 0 0;
    font-size: 17px;
  }

  .kp-modal-heading button {
    width: 33px;
    height: 33px;
    border: 0;
    border-radius: 50%;
    background: #f0f4f1;
    color: #58675e;
    font-size: 20px;
    cursor: pointer;
  }

  .kp-form { padding: 18px; }

  .kp-modal-info {
    margin-bottom: 14px;
    padding: 10px 12px;
    border-radius: 10px;
    background: #f4f8f5;
  }

  .kp-modal-info p {
    margin: 3px 0;
    color: #617068;
    font-size: 10px;
  }

  .kp-form > label,
  .kp-form-row label {
    display: block;
    margin-bottom: 13px;
  }

  .kp-form label > span {
    display: block;
    margin-bottom: 6px;
    color: #39483f;
    font-size: 10px;
    font-weight: 750;
  }

  .kp-form input,
  .kp-form textarea {
    width: 100%;
    padding: 10px 11px;
    border: 1px solid #dce5df;
    border-radius: 9px;
    font: inherit;
    font-size: 11px;
    outline: none;
  }

  .kp-form input:focus,
  .kp-form textarea:focus {
    border-color: #1ba356;
    box-shadow: 0 0 0 3px rgba(27,163,86,.12);
  }

  .kp-form textarea { resize: vertical; }

  .kp-form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 11px;
  }

  .kp-modal-actions {
    justify-content: flex-end;
    gap: 8px;
    padding-top: 13px;
    border-top: 1px solid #edf1ee;
  }

  .kp-modal-actions button {
    min-height: 38px;
    padding: 0 16px;
    border-radius: 9px;
    border: 1px solid #dbe4de;
    background: #fff;
    color: #526159;
    font-size: 10px;
    font-weight: 750;
    cursor: pointer;
  }

  .kp-modal-actions .kp-save {
    color: #fff;
    background: #16984f;
    border-color: #16984f;
  }

  @media (max-width: 1180px) {
    .kp-summary-grid,
    .kp-calendar-layout { grid-template-columns: 1fr; }
  }

  @media (max-width: 820px) {
    .kp-page { padding: 16px; }
    .kp-header { flex-direction: column; }
    .kp-filter-card { grid-template-columns: 1fr; }
    .kp-plant-meta { grid-template-columns: 1fr 1fr; }
    .kp-calendar-cell { min-height: 92px; padding: 5px; }
  }

  @media (max-width: 580px) {
    .kp-header h1 { font-size: 23px; }
    .kp-header-actions { width: 100%; display: grid; grid-template-columns: 1fr; }
    .kp-plant-card { align-items: flex-start; flex-direction: column; }
    .kp-plant-meta,
    .kp-form-row { grid-template-columns: 1fr; }
    .kp-calendar-cell { min-height: 72px; padding: 4px; }
    .kp-cell-events > span { padding: 3px; font-size: 6px; }
  }
`;
