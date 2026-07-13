import { useEffect, useMemo, useState } from "react";
import api from "../../services/api";

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
const SHORT_DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const EVENT_META = {
  pemupukan: {
    label: "Pemupukan",
    icon: "🧴",
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
  manual: {
    label: "Kegiatan",
    icon: "📌",
    background: "#f5f6f8",
    color: "#596174",
    border: "#d8dce4",
  },
};

const TONE_META = {
  normal: {
    icon: "✓",
    label: "Normal",
    background: "#ecfbf2",
    border: "#b9e8cc",
    color: "#17633c",
  },
  rendah: {
    icon: "✓",
    label: "Prioritas rendah",
    background: "#ecfbf2",
    border: "#b9e8cc",
    color: "#17633c",
  },
  sedang: {
    icon: "i",
    label: "Perlu dipantau",
    background: "#fff9e8",
    border: "#ecd99b",
    color: "#7f6414",
  },
  tinggi: {
    icon: "!",
    label: "Perlu perhatian",
    background: "#fff0ed",
    border: "#f3beb3",
    color: "#a53b2d",
  },
};

const EVENT_STATUS_META = {
  terjadwal: {
    key: "terjadwal",
    label: "Terjadwal",
    shortLabel: "Jadwal",
    icon: "○",
    background: "#eef4ff",
    color: "#315f9c",
    border: "#c9d9f1",
  },
  selesai: {
    key: "selesai",
    label: "Selesai",
    shortLabel: "Selesai",
    icon: "✓",
    background: "#eaf8f0",
    color: "#23784d",
    border: "#b8e1c9",
  },
  terlambat: {
    key: "terlambat",
    label: "Terlambat",
    shortLabel: "Telat",
    icon: "!",
    background: "#fff0ed",
    color: "#a33f32",
    border: "#f0bbb0",
  },
  dilewati: {
    key: "dilewati",
    label: "Dilewati",
    shortLabel: "Lewat",
    icon: "–",
    background: "#f4f5f6",
    color: "#66716a",
    border: "#d9ddda",
  },
  dibatalkan: {
    key: "dibatalkan",
    label: "Dibatalkan",
    shortLabel: "Batal",
    icon: "×",
    background: "#f7f2f2",
    color: "#865555",
    border: "#e5d2d2",
  },
};

const EVENT_SOURCE_META = {
  utama: {
    key: "utama",
    label: "Jadwal Utama",
    shortLabel: "Utama",
    icon: "📅",
    background: "#f3f6f4",
    color: "#506158",
    border: "#dce3de",
  },
  adaptif: {
    key: "adaptif",
    label: "Rekomendasi Adaptif",
    shortLabel: "Adaptif",
    icon: "⚡",
    background: "#fff8e5",
    color: "#8a6815",
    border: "#ead79a",
  },
  manual: {
    key: "manual",
    label: "Ditambahkan Petani",
    shortLabel: "Manual",
    icon: "✍",
    background: "#f3efff",
    color: "#654b9b",
    border: "#d8cdf0",
  },
};

const EMPTY_MONITORING = {
  tinggi_tanaman: "",
  jumlah_anakan: "",
  kondisi_daun: "normal",
  kondisi_air: "cukup",
  tingkat_hama: "tidak_ada",
  jenis_hama: "",
  kondisi_tanaman: "normal",
  catatan: "",
};

const MONITORING_EXAMPLES = [
  {
    id: "sehat",
    icon: "✅",
    title: "Tanaman terlihat sehat",
    description:
      "Pilih ketika tanaman tampak hijau, tegak, air cukup, dan tidak terlihat hama.",
    values: {
      kondisi_tanaman: "normal",
      kondisi_daun: "normal",
      kondisi_air: "cukup",
      tingkat_hama: "tidak_ada",
      jenis_hama: "",
      catatan:
        "Tanaman tampak hijau dan tegak. Air cukup dan tidak terlihat hama.",
    },
  },
  {
    id: "daun_menguning",
    icon: "🍂",
    title: "Sebagian daun menguning",
    description:
      "Pilih ketika daun bawah mulai kuning, tetapi tanaman masih berdiri dan belum terlihat hama.",
    values: {
      kondisi_tanaman: "pertumbuhan_lambat",
      kondisi_daun: "menguning",
      kondisi_air: "cukup",
      tingkat_hama: "tidak_ada",
      jenis_hama: "",
      catatan:
        "Sebagian daun bagian bawah terlihat menguning. Tanaman masih tegak dan tidak terlihat hama.",
    },
  },
  {
    id: "kekurangan_air",
    icon: "☀️",
    title: "Lahan kering dan tanaman layu",
    description:
      "Pilih ketika air sawah berkurang, tanah mulai kering, atau daun terlihat lemas.",
    values: {
      kondisi_tanaman: "layu",
      kondisi_daun: "layu",
      kondisi_air: "kering",
      tingkat_hama: "tidak_ada",
      jenis_hama: "",
      catatan:
        "Tanaman terlihat layu pada siang hari dan permukaan tanah mulai kering.",
    },
  },
  {
    id: "ada_hama",
    icon: "🐛",
    title: "Terlihat hama atau kerusakan",
    description:
      "Pilih ketika hama terlihat di beberapa rumpun atau daun mulai berlubang.",
    values: {
      kondisi_tanaman: "terserang",
      kondisi_daun: "berlubang",
      kondisi_air: "cukup",
      tingkat_hama: "sedang",
      jenis_hama: "Keong mas",
      catatan:
        "Terlihat keong mas di beberapa bagian lahan dan beberapa daun mengalami kerusakan.",
    },
  },
];

const EMPTY_WEATHER = {
  suhu: null,
  kelembapan: null,
  curah_hujan: null,
  kondisi: "Data cuaca belum tersedia",
  sumber: "unavailable",
  waktu: null,
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

  const result = new Date(value);
  return Number.isNaN(result.getTime()) ? null : result;
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

const addDays = (value, amount) => {
  const date = parseDate(value);
  if (!date) return null;
  date.setDate(date.getDate() + Number(amount || 0));
  return date;
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
  if (!date) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
};

const formatTime = (value) => String(value || "08:00").slice(0, 5);

const titleCase = (value) =>
  String(value || "-")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const formatMeasurement = (value, maximumFractionDigits = 1) => {
  if (value === null || value === undefined || value === "") return "-";

  const number = Number(value);
  if (!Number.isFinite(number)) return "-";

  return number.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
};

const formatRecordedTime = (value) => {
  if (!value) return "-";

  const raw = String(value);
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return raw;

  const hasClock = /[T\s]\d{1,2}:\d{2}/.test(raw);

  if (!hasClock) {
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  return date.toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const getEventSourceKey = (event) => {
  const source = [
    event?.sumber,
    event?.source,
    event?.jenis_sumber,
    event?.asal_jadwal,
    event?.tipe_jadwal,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    source.includes("adaptif") ||
    source.includes("monitoring") ||
    source.includes("rekomendasi")
  ) {
    return "adaptif";
  }

  if (
    source.includes("manual") ||
    source.includes("petani") ||
    source.includes("pengguna")
  ) {
    return "manual";
  }

  return "utama";
};

const getEventSourceMeta = (event) =>
  EVENT_SOURCE_META[getEventSourceKey(event)] || EVENT_SOURCE_META.utama;

const getEventStatusKey = (event, referenceDate = new Date()) => {
  const rawStatus = String(event?.status || "terjadwal")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_");

  if (["selesai", "completed", "done"].includes(rawStatus)) return "selesai";
  if (["dilewati", "skip", "skipped"].includes(rawStatus)) return "dilewati";
  if (["dibatalkan", "batal", "cancelled", "canceled"].includes(rawStatus)) {
    return "dibatalkan";
  }

  const eventDate = parseDate(event?.tanggal);
  const today = parseDate(toDateKey(referenceDate));

  if (eventDate && today && eventDate.getTime() < today.getTime()) {
    return "terlambat";
  }

  return "terjadwal";
};

const getEventStatusMeta = (event, referenceDate = new Date()) => {
  const key = getEventStatusKey(event, referenceDate);
  return EVENT_STATUS_META[key] || EVENT_STATUS_META.terjadwal;
};

const getMonitoringRecordedAt = (monitoring) =>
  monitoring?.updated_at ||
  monitoring?.created_at ||
  monitoring?.waktu_pencatatan ||
  monitoring?.waktu ||
  monitoring?.tanggal ||
  null;

const buildRecommendationReasons = (monitoring) => {
  if (!monitoring) return [];

  const reasons = [];
  const addReason = (message) => {
    if (message && !reasons.includes(message)) reasons.push(message);
  };

  const plant = String(monitoring.kondisi_tanaman || "").toLowerCase();
  const leaf = String(monitoring.kondisi_daun || "").toLowerCase();
  const water = String(monitoring.kondisi_air || "").toLowerCase();
  const pest = String(monitoring.tingkat_hama || "").toLowerCase();

  const plantMessages = {
    pertumbuhan_lambat: "Pertumbuhan tanaman tercatat lebih lambat.",
    layu: "Tanaman tercatat dalam kondisi layu.",
    terserang: "Terdapat tanda serangan hama atau penyakit.",
    rebah: "Sebagian tanaman tercatat mengalami rebah.",
  };

  const leafMessages = {
    menguning: "Daun yang paling banyak terlihat mulai menguning.",
    bercak: "Terdapat bercak pada daun.",
    layu: "Daun tercatat layu atau menggulung.",
    berlubang: "Daun berlubang atau menunjukkan bekas gigitan.",
  };

  const waterMessages = {
    kering: "Kondisi air lahan tercatat kering.",
    tergenang: "Lahan tercatat tergenang berlebihan.",
  };

  const pestMessages = {
    rendah: "Hama terlihat pada beberapa rumpun.",
    sedang: "Hama terlihat di banyak bagian lahan.",
    tinggi: "Kerusakan akibat hama terlihat cukup luas.",
  };

  addReason(plantMessages[plant]);
  addReason(leafMessages[leaf]);
  addReason(waterMessages[water]);
  addReason(pestMessages[pest]);

  if (
    monitoring.curah_hujan !== null &&
    monitoring.curah_hujan !== undefined &&
    Number(monitoring.curah_hujan) <= 0.5
  ) {
    addReason(
      `Curah hujan tercatat ${formatMeasurement(
        monitoring.curah_hujan,
        1,
      )} mm.`,
    );
  }

  if (reasons.length === 0) {
    addReason("Kondisi tanaman yang dicatat masih berada dalam kategori normal.");
  }

  return reasons.slice(0, 4);
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

const getUserId = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return (
      user.id ||
      user.user_id ||
      user.petani_id ||
      localStorage.getItem("user_id") ||
      localStorage.getItem("petani_id") ||
      ""
    );
  } catch {
    return (
      localStorage.getItem("user_id") || localStorage.getItem("petani_id") || ""
    );
  }
};

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

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

const normalizeEvent = (event, index = 0) => ({
  ...event,
  id: event?.id || `event-${index}`,
  tanggal: toDateKey(event?.tanggal),
  waktu: formatTime(event?.waktu),
  nama_kegiatan: event?.nama_kegiatan || event?.judul || "Kegiatan Budidaya",
  status: event?.status || "terjadwal",
  prioritas: event?.prioritas || "sedang",
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

const buildMonitoringForm = (monitoring) => ({
  tinggi_tanaman: monitoring?.tinggi_tanaman ?? "",
  jumlah_anakan: monitoring?.jumlah_anakan ?? "",
  kondisi_daun: monitoring?.kondisi_daun || "normal",
  kondisi_air: monitoring?.kondisi_air || "cukup",
  tingkat_hama: monitoring?.tingkat_hama || "tidak_ada",
  jenis_hama: monitoring?.jenis_hama || "",
  kondisi_tanaman: monitoring?.kondisi_tanaman || "normal",
  catatan: monitoring?.catatan || "",
});

const toOptionalNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const hasMeasurementValue = (value) =>
  value !== "" && value !== null && value !== undefined;

const formatWeatherTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const buildDetectedProblems = (monitoring, insight) => {
  const problems = [];
  const plantCondition = String(
    monitoring?.kondisi_tanaman || "",
  ).toLowerCase();
  const leafCondition = String(monitoring?.kondisi_daun || "").toLowerCase();
  const waterCondition = String(monitoring?.kondisi_air || "").toLowerCase();
  const pestLevel = String(monitoring?.tingkat_hama || "").toLowerCase();

  const addProblem = (message) => {
    if (message && !problems.includes(message)) problems.push(message);
  };

  if (plantCondition.includes("pertumbuhan_lambat")) {
    addProblem(
      "Pertumbuhan tanaman terlihat lebih lambat dari kondisi yang diharapkan.",
    );
  }
  if (plantCondition.includes("layu")) {
    addProblem("Tanaman terlihat layu dan perlu segera diperiksa.");
  }
  if (plantCondition.includes("terserang")) {
    addProblem("Tanaman menunjukkan tanda serangan hama atau penyakit.");
  }
  if (plantCondition.includes("rebah")) {
    addProblem("Sebagian tanaman mengalami rebah.");
  }

  if (leafCondition.includes("menguning")) {
    addProblem("Daun tanaman terlihat menguning.");
  }
  if (leafCondition.includes("bercak")) {
    addProblem("Daun tanaman menunjukkan bercak.");
  }
  if (leafCondition.includes("layu")) {
    addProblem("Daun tanaman terlihat layu.");
  }
  if (leafCondition.includes("berlubang")) {
    addProblem("Daun tanaman berlubang atau mengalami kerusakan.");
  }

  if (waterCondition.includes("kering")) {
    addProblem("Kondisi lahan terlalu kering atau kekurangan air.");
  }
  if (waterCondition.includes("tergenang")) {
    addProblem("Kondisi lahan tergenang berlebihan.");
  }

  const pestMessages = {
    rendah: "Ditemukan hama dalam jumlah sedikit.",
    sedang: "Ditemukan hama dalam jumlah cukup banyak.",
    tinggi: "Terdapat serangan hama yang berat.",
    ada: "Terdapat tanda keberadaan hama.",
    terdeteksi: "Terdapat tanda keberadaan hama.",
  };

  if (pestMessages[pestLevel]) addProblem(pestMessages[pestLevel]);

  if (
    problems.length === 0 &&
    insight?.status !== "normal" &&
    insight?.ringkasan
  ) {
    String(insight.ringkasan)
      .split(/(?<=[.!?])\s+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach(addProblem);
  }

  return problems;
};

export default function KalenderBudidaya() {
  const userId = getUserId();
  const todayKey = toDateKey(new Date());

  const [lahanList, setLahanList] = useState([]);
  const [selectedLahanId, setSelectedLahanId] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [currentMonth, setCurrentMonth] = useState(firstDayOfMonth(new Date()));
  const [overview, setOverview] = useState(null);

  const [loadingLahan, setLoadingLahan] = useState(true);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [monitoringOpen, setMonitoringOpen] = useState(false);
  const [monitoringForm, setMonitoringForm] = useState(EMPTY_MONITORING);
  const [selectedMonitoringExample, setSelectedMonitoringExample] = useState("");
  const [weather, setWeather] = useState(EMPTY_WEATHER);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState("");
  const [monitoringResultOpen, setMonitoringResultOpen] = useState(false);
  const [monitoringResult, setMonitoringResult] = useState(null);
  const [eventModal, setEventModal] = useState(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleForm, setRescheduleForm] = useState({
    tanggal_baru: "",
    alasan: "",
  });

  const data = overview?.data || null;
  const selectedDay = data?.selected_day || null;
  const cycle = data?.cycle || null;
  const overviewLahan = data?.lahan || null;

  const selectedLahan = useMemo(() => {
    if (overviewLahan) return overviewLahan;

    return (
      lahanList.find((item) => String(item.id) === String(selectedLahanId)) ||
      null
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
      if (!map[event.tanggal]) map[event.tanggal] = [];
      map[event.tanggal].push(event);
    });

    Object.keys(map).forEach((key) => {
      map[key].sort((left, right) => left.waktu.localeCompare(right.waktu));
    });

    return map;
  }, [monthEvents]);

  const weekDays = useMemo(() => {
    const center = parseDate(selectedDate) || new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(center, index - 3);
      return {
        date,
        key: toDateKey(date),
        label: SHORT_DAYS[date.getDay()],
        day: date.getDate(),
      };
    });
  }, [selectedDate]);

  const monthCells = useMemo(
    () => buildMonthCells(currentMonth),
    [currentMonth],
  );

  const insight = selectedDay?.insight || null;
  const recommendation = selectedDay?.recommendation || insight || null;
  const monitoring = selectedDay?.monitoring_harian || null;
  const progress = clamp(Number(cycle?.progress_percent || 0), 0, 100);
  const progressDegree = progress * 3.6;
  const selectedMonthLabel = `${MONTHS[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
  const tone =
    TONE_META[insight?.prioritas] ||
    TONE_META[insight?.status] ||
    TONE_META.sedang;

  const completedMonthCount = useMemo(
    () =>
      monthEvents.filter(
        (item) => getEventStatusKey(item, new Date()) === "selesai",
      ).length,
    [monthEvents],
  );

  const overdueMonthCount = useMemo(
    () =>
      monthEvents.filter(
        (item) => getEventStatusKey(item, new Date()) === "terlambat",
      ).length,
    [monthEvents],
  );

  const recommendationReasons = useMemo(
    () => buildRecommendationReasons(monitoring),
    [monitoring],
  );

  const monitoringRecordedAt = getMonitoringRecordedAt(monitoring);

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  const loadLahan = async () => {
    try {
      setLoadingLahan(true);
      setError("");

      if (!userId) {
        throw new Error("ID pengguna tidak ditemukan. Silakan login ulang.");
      }

      const response = await api.get("/lahan", {
        params: {
          user_id: userId,
          petani_id: userId,
        },
      });

      const list = normalizeList(response.data).filter(
        (item) =>
          !["dihapus", "deleted"].includes(
            String(item.status_lahan || "").toLowerCase(),
          ),
      );

      setLahanList(list);

      if (list.length > 0) {
        setSelectedLahanId((current) => current || String(list[0].id));
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Gagal memuat daftar lahan."));
    } finally {
      setLoadingLahan(false);
    }
  };

  const loadOverview = async () => {
    if (!selectedLahanId || !selectedDate) return null;

    try {
      setLoadingOverview(true);
      setError("");

      const response = await api.get(
        `/kalender/${selectedLahanId}/overview`,
        {
          params: {
            tanggal: selectedDate,
            bulan: toMonthKey(currentMonth),
            user_id: userId,
          },
        },
      );

      setOverview(response.data);
      return response.data;
    } catch (requestError) {
      setOverview(null);
      setError(
        getErrorMessage(requestError, "Gagal memuat kalender budidaya."),
      );
      return null;
    } finally {
      setLoadingOverview(false);
    }
  };

  useEffect(() => {
    loadLahan();
  }, []);

  useEffect(() => {
    loadOverview();
  }, [selectedLahanId, selectedDate, currentMonth]);

  const chooseDate = (dateValue) => {
    const key = toDateKey(dateValue);
    if (!key) return;

    setSelectedDate(key);

    const selected = parseDate(key);
    if (
      selected.getFullYear() !== currentMonth.getFullYear() ||
      selected.getMonth() !== currentMonth.getMonth()
    ) {
      setCurrentMonth(firstDayOfMonth(selected));
    }
  };

  const moveMonth = (direction) => {
    const nextMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + direction,
      1,
    );

    setCurrentMonth(nextMonth);
  };

  const moveSelectedWeek = (direction) => {
    chooseDate(addDays(selectedDate, direction * 7));
  };

  const goToday = () => {
    setSelectedDate(todayKey);
    setCurrentMonth(firstDayOfMonth(new Date()));
  };

  const refreshCalendar = async () => {
    if (!selectedLahanId) return;

    try {
      setGenerating(true);
      setError("");

      await api.post(`/kalender/${selectedLahanId}/generate`, {
        user_id: Number(userId),
      });

      await loadOverview();
      showToast("Kalender berhasil diperbarui.");
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Kalender gagal diperbarui."));
    } finally {
      setGenerating(false);
    }
  };

  const loadWeather = async () => {
    if (!selectedLahanId || !userId) return;

    try {
      setLoadingWeather(true);
      setWeatherError("");
      setWeather(EMPTY_WEATHER);

      const response = await api.get(
        `/kalender/${selectedLahanId}/cuaca`,
        {
          params: {
            user_id: Number(userId),
          },
        },
      );

      const weatherData = response.data?.data || {};

      const nextWeather = {
        suhu: weatherData.suhu ?? null,
        kelembapan: weatherData.kelembapan ?? null,
        curah_hujan: weatherData.curah_hujan ?? null,
        kondisi: weatherData.kondisi || "Data cuaca belum tersedia",
        sumber: weatherData.sumber || "unavailable",
        waktu: weatherData.waktu || null,
      };

      setWeather(nextWeather);

      if (nextWeather.sumber === "unavailable") {
        setWeatherError(
          response.data?.message ||
            "Data cuaca belum tersedia. Monitoring tetap dapat disimpan.",
        );
      }
    } catch (requestError) {
      setWeather(EMPTY_WEATHER);
      setWeatherError(
        getErrorMessage(
          requestError,
          "Data cuaca belum tersedia. Monitoring tetap dapat disimpan.",
        ),
      );
    } finally {
      setLoadingWeather(false);
    }
  };

  const openMonitoring = async () => {
    setMonitoringForm(buildMonitoringForm(monitoring));
    setSelectedMonitoringExample("");
    setMonitoringOpen(true);
    await loadWeather();
  };

  const applyMonitoringExample = (example) => {
    if (!example?.values) return;

    setMonitoringForm((current) => ({
      ...current,
      ...example.values,

      // Data pengukuran tidak diubah karena hanya boleh berasal dari
      // pengukuran petani atau penyuluh di lapangan.
      tinggi_tanaman: current.tinggi_tanaman,
      jumlah_anakan: current.jumlah_anakan,
    }));

    setSelectedMonitoringExample(example.id);
  };

  const resetMonitoringExample = () => {
    setMonitoringForm((current) => ({
      ...EMPTY_MONITORING,
      tinggi_tanaman: current.tinggi_tanaman,
      jumlah_anakan: current.jumlah_anakan,
    }));

    setSelectedMonitoringExample("");
  };

  const saveMonitoring = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");

      const payload = {
        ...monitoringForm,
        user_id: Number(userId),
        tanggal: selectedDate,
        tinggi_tanaman: toOptionalNumber(monitoringForm.tinggi_tanaman),
        jumlah_anakan: toOptionalNumber(monitoringForm.jumlah_anakan),
        jenis_hama:
          monitoringForm.tingkat_hama === "tidak_ada"
            ? null
            : monitoringForm.jenis_hama.trim() || null,
        suhu: weather.suhu ?? null,
        kelembapan: weather.kelembapan ?? null,
        curah_hujan: weather.curah_hujan ?? null,
      };

      const response = await api.post(
        `/kalender/${selectedLahanId}/monitoring-harian`,
        payload,
      );

      const refreshedOverview = await loadOverview();
      const savedMonitoring = response.data?.data || null;
      const savedInsight = response.data?.insight || null;
      const overviewUpcoming =
        refreshedOverview?.data?.upcoming_activities || [];

      const adaptiveActivities = overviewUpcoming
        .map(normalizeEvent)
        .filter((item) => {
          const source = String(item.sumber || "").toLowerCase();
          const status = String(item.status || "").toLowerCase();

          return (
            source === "adaptif" && !["selesai", "dilewati"].includes(status)
          );
        })
        .slice(0, 4);

      setMonitoringResult({
        tanggal: savedMonitoring?.tanggal || selectedDate,
        monitoring: savedMonitoring,
        insight: savedInsight,
        calendarUpdate: response.data?.calendar_update || null,
        problems: buildDetectedProblems(savedMonitoring, savedInsight),
        followUpActivities: adaptiveActivities,
      });

      setMonitoringOpen(false);
      setMonitoringResultOpen(true);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Monitoring gagal disimpan."));
    } finally {
      setSaving(false);
    }
  };

  const handlePrintCalendar = () => {
    if (!selectedLahan) {
      showToast("Pilih lahan sebelum mencetak kalender.");
      return;
    }

    const printWindow = window.open(
      "",
      "_blank",
      "width=1100,height=850,noopener,noreferrer",
    );

    if (!printWindow) {
      showToast("Izinkan pop-up browser untuk mencetak kalender.");
      return;
    }

    const sortedEvents = [...monthEvents].sort((left, right) => {
      const dateCompare = String(left.tanggal || "").localeCompare(
        String(right.tanggal || ""),
      );

      if (dateCompare !== 0) return dateCompare;
      return String(left.waktu || "").localeCompare(String(right.waktu || ""));
    });

    const eventRows =
      sortedEvents.length > 0
        ? sortedEvents
            .map((item, index) => {
              const statusMeta = getEventStatusMeta(item);
              const sourceMeta = getEventSourceMeta(item);

              return `
                <tr>
                  <td>${index + 1}</td>
                  <td>${escapeHtml(formatLongDate(item.tanggal))}</td>
                  <td>${escapeHtml(formatTime(item.waktu))}</td>
                  <td>${escapeHtml(item.nama_kegiatan)}</td>
                  <td>${escapeHtml(titleCase(item.jenis || "-"))}</td>
                  <td>${escapeHtml(statusMeta.label)}</td>
                  <td>${escapeHtml(sourceMeta.label)}</td>
                </tr>
              `;
            })
            .join("")
        : `
          <tr>
            <td colspan="7" class="empty">Belum ada kegiatan pada bulan ini.</td>
          </tr>
        `;

    const reasonRows = recommendationReasons
      .map((reason) => `<li>${escapeHtml(reason)}</li>`)
      .join("");

    const monitoringHtml = monitoring
      ? `
        <section class="card">
          <h2>Monitoring terakhir</h2>
          <p class="muted">Dicatat: ${escapeHtml(
            formatRecordedTime(monitoringRecordedAt),
          )}</p>
          <div class="monitoring-grid">
            <div><span>Tanaman</span><strong>${escapeHtml(
              titleCase(monitoring.kondisi_tanaman),
            )}</strong></div>
            <div><span>Daun</span><strong>${escapeHtml(
              titleCase(monitoring.kondisi_daun),
            )}</strong></div>
            <div><span>Air</span><strong>${escapeHtml(
              titleCase(monitoring.kondisi_air),
            )}</strong></div>
            <div><span>Hama</span><strong>${escapeHtml(
              titleCase(monitoring.tingkat_hama),
            )}</strong></div>
            <div><span>Suhu</span><strong>${escapeHtml(
              formatMeasurement(monitoring.suhu, 1),
            )} °C</strong></div>
            <div><span>Kelembapan</span><strong>${escapeHtml(
              formatMeasurement(monitoring.kelembapan, 0),
            )}%</strong></div>
            <div><span>Curah hujan</span><strong>${escapeHtml(
              formatMeasurement(monitoring.curah_hujan, 1),
            )} mm</strong></div>
          </div>
          ${
            monitoring.catatan
              ? `<p class="note"><strong>Catatan:</strong> ${escapeHtml(
                  monitoring.catatan,
                )}</p>`
              : ""
          }
        </section>
      `
      : `
        <section class="card">
          <h2>Monitoring terakhir</h2>
          <p class="muted">Belum ada monitoring pada tanggal terpilih.</p>
        </section>
      `;

    printWindow.document.write(`
      <!doctype html>
      <html lang="id">
        <head>
          <meta charset="utf-8" />
          <title>Kalender GeoPanen - ${escapeHtml(
            selectedLahan.nama_lahan || "Lahan",
          )}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 30px;
              color: #1f2d25;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 12px;
              line-height: 1.5;
            }
            header {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 20px;
              padding-bottom: 18px;
              border-bottom: 3px solid #2f9d68;
            }
            h1, h2, p { margin-top: 0; }
            h1 { margin-bottom: 5px; font-size: 24px; }
            h2 { margin-bottom: 10px; font-size: 15px; }
            .brand { color: #237d52; font-weight: 800; letter-spacing: .08em; }
            .muted { color: #6c776f; }
            .summary {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin: 18px 0;
            }
            .summary div, .monitoring-grid div {
              padding: 11px;
              border: 1px solid #dfe7e1;
              border-radius: 9px;
              background: #f8fbf9;
            }
            .summary span, .monitoring-grid span {
              display: block;
              color: #718078;
              font-size: 10px;
              text-transform: uppercase;
            }
            .summary strong, .monitoring-grid strong {
              display: block;
              margin-top: 4px;
            }
            .card {
              margin-top: 14px;
              padding: 15px;
              border: 1px solid #dfe7e1;
              border-radius: 12px;
            }
            .monitoring-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
            }
            .recommendation {
              background: #f1faf5;
              border-color: #bfe2cc;
            }
            .reason-list { margin: 8px 0 0 18px; padding: 0; }
            .note {
              margin: 10px 0 0;
              padding: 10px;
              border-left: 3px solid #2f9d68;
              background: #f7faf8;
            }
            table {
              width: 100%;
              margin-top: 10px;
              border-collapse: collapse;
            }
            th, td {
              padding: 8px;
              border: 1px solid #dfe5e1;
              text-align: left;
              vertical-align: top;
            }
            th { background: #eaf7f0; color: #285b40; }
            .empty { color: #718078; text-align: center; }
            footer {
              margin-top: 18px;
              padding-top: 10px;
              border-top: 1px solid #dfe5e1;
              color: #7a847e;
              font-size: 10px;
              text-align: right;
            }
            @page { size: A4 landscape; margin: 12mm; }
            @media print {
              body { padding: 0; }
              .card, table { break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <header>
            <div>
              <div class="brand">GEOPANEN</div>
              <h1>Kalender Budidaya ${escapeHtml(selectedMonthLabel)}</h1>
              <p class="muted">
                ${escapeHtml(selectedLahan.nama_lahan || "-")} · Desa
                ${escapeHtml(selectedLahan.nama_desa || "-")}, Kec.
                ${escapeHtml(selectedLahan.nama_kecamatan || "-")}
              </p>
            </div>
            <div>
              <strong>Dicetak</strong><br />
              ${escapeHtml(formatRecordedTime(new Date().toISOString()))}
            </div>
          </header>

          <section class="summary">
            <div><span>Varietas</span><strong>${escapeHtml(
              selectedLahan.varietas || "-",
            )}</strong></div>
            <div><span>Fase</span><strong>${escapeHtml(
              cycle?.fase_label || "-",
            )}</strong></div>
            <div><span>HST</span><strong>${escapeHtml(
              cycle?.hst ?? "-",
            )}</strong></div>
            <div><span>Progres musim tanam</span><strong>${escapeHtml(
              Math.round(progress),
            )}%</strong></div>
            <div><span>Mulai tanam</span><strong>${escapeHtml(
              formatShortDate(selectedLahan.tanggal_tanam),
            )}</strong></div>
            <div><span>Estimasi panen</span><strong>${escapeHtml(
              formatShortDate(cycle?.estimasi_panen),
            )}</strong></div>
            <div><span>Kegiatan selesai</span><strong>${completedMonthCount} dari ${
              monthEvents.length
            }</strong></div>
            <div><span>Kegiatan terlambat</span><strong>${overdueMonthCount}</strong></div>
          </section>

          <section class="card recommendation">
            <h2>Rekomendasi hari ini</h2>
            <p>${escapeHtml(
              recommendation?.rekomendasi ||
                "Lanjutkan pemantauan tanaman sesuai jadwal.",
            )}</p>
            <strong>Dasar rekomendasi</strong>
            <ul class="reason-list">
              ${reasonRows || "<li>Belum ada data dasar rekomendasi.</li>"}
            </ul>
          </section>

          ${monitoringHtml}

          <section class="card">
            <h2>Jadwal kegiatan bulan ${escapeHtml(selectedMonthLabel)}</h2>
            <table>
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Tanggal</th>
                  <th>Waktu</th>
                  <th>Kegiatan</th>
                  <th>Jenis</th>
                  <th>Status</th>
                  <th>Sumber</th>
                </tr>
              </thead>
              <tbody>${eventRows}</tbody>
            </table>
          </section>

          <footer>
            Laporan kalender budidaya adaptif GeoPanen.
          </footer>

          <script>
            window.addEventListener("load", function () {
              window.setTimeout(function () {
                window.print();
              }, 250);
            });
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  const updateStatus = async (item, status) => {
    try {
      setSaving(true);
      setError("");

      await api.patch(`/kalender/${item.id}/status`, {
        user_id: Number(userId),
        status,
      });

      await loadOverview();
      setEventModal(null);
      showToast(
        status === "selesai"
          ? "Kegiatan ditandai selesai."
          : "Status kegiatan berhasil diperbarui.",
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Status kegiatan gagal diubah."));
    } finally {
      setSaving(false);
    }
  };

  const openReschedule = (item) => {
    setEventModal(item);
    setRescheduleForm({
      tanggal_baru: item?.tanggal || selectedDate,
      alasan: "",
    });
    setRescheduleOpen(true);
  };

  const saveReschedule = async (event) => {
    event.preventDefault();

    if (!eventModal?.id) return;

    try {
      setSaving(true);
      setError("");

      await api.patch(`/kalender/${eventModal.id}/reschedule`, {
        ...rescheduleForm,
        user_id: Number(userId),
      });

      await loadOverview();
      setRescheduleOpen(false);
      setEventModal(null);
      showToast("Jadwal kegiatan berhasil dipindahkan.");
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Jadwal gagal dipindahkan."));
    } finally {
      setSaving(false);
    }
  };

  if (loadingLahan) {
    return (
      <div className="flo-loading-page">
        <style>{CSS}</style>
        <div className="flo-loader" />
        <p>Memuat kalender budidaya...</p>
      </div>
    );
  }

  return (
    <div className="flo-page">
      <style>{CSS}</style>

      {toast && <div className="flo-toast">{toast}</div>}

      <div className="flo-shell flo-shell-desktop">
        <header className="flo-topbar">
          <div className="flo-brand">
            <div className="flo-brand-mark">🌾</div>
            <div>
              <span className="flo-kicker">GEOPANEN</span>
              <h1>Kalender Tanam</h1>
            </div>
          </div>

          <div className="flo-topbar-actions">
            <div className="flo-topbar-copy">
              <span>Kalender budidaya adaptif</span>
              <strong>{formatLongDate(todayKey)}</strong>
            </div>

            <button
              type="button"
              className="flo-icon-button"
              onClick={handlePrintCalendar}
              disabled={!selectedLahanId}
              title="Cetak atau simpan kalender sebagai PDF"
              aria-label="Cetak atau simpan kalender sebagai PDF"
            >
              🖨️
            </button>

            <button
              type="button"
              className="flo-icon-button"
              onClick={refreshCalendar}
              disabled={generating || !selectedLahanId}
              title="Perbarui kalender"
              aria-label="Perbarui kalender"
            >
              <span className={generating ? "flo-spin" : ""}>↻</span>
            </button>
          </div>
        </header>

        {error && (
          <div className="flo-error">
            <span>!</span>
            <div>
              <strong>Terjadi kendala</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        <section className="flo-farm-select-card">
          <div className="flo-farm-select-copy">
            <span>📍</span>
            <div>
              <small>Lahan aktif</small>
              <strong>{selectedLahan?.nama_lahan || "Pilih lahan"}</strong>
            </div>
          </div>

          <div className="flo-farm-toolbar">
            <div className="flo-farm-location">
              <span>Lokasi</span>
              <strong>
                Desa {selectedLahan?.nama_desa || "-"}, Kec.{" "}
                {selectedLahan?.nama_kecamatan || "-"}
              </strong>
            </div>

            <select
              value={selectedLahanId}
              onChange={(event) => setSelectedLahanId(event.target.value)}
              aria-label="Pilih lahan"
            >
              {lahanList.length === 0 && (
                <option value="">Belum ada lahan</option>
              )}
              {lahanList.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nama_lahan || `Lahan ${item.id}`}
                </option>
              ))}
            </select>
          </div>
        </section>

        {selectedLahanId && (
          <>
            <div className="flo-desktop-overview">
              <section className="flo-hero-card">
                <div className="flo-hero-content">
                  <div className="flo-phase-pill">
                    {cycle?.fase_label || "Belum ada fase"}
                  </div>

                  <h2>
                    HST <span>{cycle?.hst ?? "-"}</span>
                  </h2>

                  <p>
                    {selectedLahan?.varietas || "Varietas belum diisi"} · Desa{" "}
                    {selectedLahan?.nama_desa || "-"}, Kec.{" "}
                    {selectedLahan?.nama_kecamatan || "-"}
                  </p>

                  <div className="flo-hero-stats">
                    <div>
                      <span>Mulai tanam</span>
                      <strong>
                        {formatShortDate(selectedLahan?.tanggal_tanam)}
                      </strong>
                    </div>
                    <div>
                      <span>Estimasi panen</span>
                      <strong>{formatShortDate(cycle?.estimasi_panen)}</strong>
                    </div>
                    <div>
                      <span>Rentang panen</span>
                      <strong>
                        {formatShortDate(cycle?.estimasi_panen_mulai)} -{" "}
                        {formatShortDate(cycle?.estimasi_panen_selesai)}
                      </strong>
                    </div>
                  </div>
                </div>

                <div
                  className="flo-progress-ring"
                  style={{
                    background: `conic-gradient(#7de0aa ${progressDegree}deg, rgba(255,255,255,.25) ${progressDegree}deg)`,
                  }}
                >
                  <div>
                    <strong>{Math.round(progress)}%</strong>
                    <span>musim tanam</span>
                  </div>
                </div>
              </section>

              <aside className="flo-overview-side">
                <section className="flo-date-section">
                  <div className="flo-section-heading flo-date-heading">
                    <div>
                      <span>Jadwal harian</span>
                      <h3>{formatLongDate(selectedDate)}</h3>
                    </div>

                    <button
                      type="button"
                      onClick={goToday}
                      className="flo-text-button"
                    >
                      Hari ini
                    </button>
                  </div>

                  <div className="flo-week-control">
                    <button
                      type="button"
                      className="flo-week-arrow"
                      onClick={() => moveSelectedWeek(-1)}
                      aria-label="Minggu sebelumnya"
                    >
                      ‹
                    </button>

                    <div className="flo-week-strip">
                      {weekDays.map((day) => {
                        const active = day.key === selectedDate;
                        const hasEvent = Boolean(eventMap[day.key]?.length);
                        const hasMonitoring =
                          monitoring &&
                          toDateKey(monitoring.tanggal) === day.key;

                        return (
                          <button
                            type="button"
                            key={day.key}
                            className={`flo-day-button ${active ? "is-active" : ""}`}
                            onClick={() => chooseDate(day.key)}
                          >
                            <span>{day.label}</span>
                            <strong>{day.day}</strong>
                            <i
                              className={
                                hasMonitoring
                                  ? "has-monitoring"
                                  : hasEvent
                                    ? "has-event"
                                    : ""
                              }
                            />
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      className="flo-week-arrow"
                      onClick={() => moveSelectedWeek(1)}
                      aria-label="Minggu berikutnya"
                    >
                      ›
                    </button>
                  </div>
                </section>

                <section className="flo-cycle-summary">
                  <div>
                    <span>Fase tanaman</span>
                    <strong>{cycle?.fase_label || "-"}</strong>
                  </div>
                  <div>
                    <span>HST terpilih</span>
                    <strong>{selectedDay?.hst ?? "-"}</strong>
                  </div>
                  <div>
                    <span>Kegiatan selesai</span>
                    <strong>
                      {completedMonthCount} dari {monthEvents.length}
                    </strong>
                  </div>
                  <div className={overdueMonthCount > 0 ? "has-overdue" : ""}>
                    <span>Kegiatan terlambat</span>
                    <strong>{overdueMonthCount}</strong>
                  </div>
                </section>
              </aside>
            </div>

            {loadingOverview ? (
              <div className="flo-inline-loading">
                <div className="flo-loader" />
                <span>Memuat data tanggal terpilih...</span>
              </div>
            ) : (
              <div className="flo-desktop-workspace">
                <main className="flo-desktop-primary">
                  <section
                    className="flo-insight-card"
                    style={{
                      "--tone-bg": tone.background,
                      "--tone-border": tone.border,
                      "--tone-color": tone.color,
                    }}
                  >
                    <div className="flo-insight-icon">{tone.icon}</div>

                    <div className="flo-insight-copy">
                      <div className="flo-insight-title-row">
                        <div>
                          <span>{tone.label}</span>
                          <h3>{insight?.judul || "Belum ada analisis"}</h3>
                        </div>

                        <span className="flo-priority-pill">
                          {titleCase(insight?.prioritas || "sedang")}
                        </span>
                      </div>

                      <p>
                        {insight?.ringkasan ||
                          "Belum ada data kondisi tanaman."}
                      </p>

                      <div className="flo-recommendation-box">
                        <span>Rekomendasi hari ini</span>
                        <strong>
                          {recommendation?.rekomendasi ||
                            "Lanjutkan pemantauan tanaman sesuai jadwal."}
                        </strong>

                        <div className="flo-recommendation-reasons">
                          <small>Dasar rekomendasi</small>
                          <ul>
                            {recommendationReasons.map((reason) => (
                              <li key={reason}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="flo-month-card flo-month-card-desktop">
                    <div className="flo-month-header">
                      <button
                        type="button"
                        onClick={() => moveMonth(-1)}
                        aria-label="Bulan sebelumnya"
                      >
                        ‹
                      </button>

                      <div>
                        <span>Kalender bulanan</span>
                        <h3>{selectedMonthLabel}</h3>
                      </div>

                      <button
                        type="button"
                        onClick={() => moveMonth(1)}
                        aria-label="Bulan berikutnya"
                      >
                        ›
                      </button>
                    </div>

                    <div className="flo-calendar-weekdays">
                      {DAYS.map((day) => (
                        <span key={day}>{day}</span>
                      ))}
                    </div>

                    <div className="flo-calendar-grid flo-calendar-grid-desktop">
                      {monthCells.map((cell) => {
                        const events = eventMap[cell.key] || [];
                        const active = cell.key === selectedDate;
                        const today = cell.key === todayKey;

                        return (
                          <button
                            type="button"
                            key={cell.key}
                            className={[
                              "flo-calendar-cell flo-calendar-cell-desktop",
                              active ? "is-active" : "",
                              today ? "is-today" : "",
                              !cell.currentMonth ? "is-outside" : "",
                            ].join(" ")}
                            onClick={() => chooseDate(cell.key)}
                          >
                            <div className="flo-cell-head">
                              <span>{cell.day}</span>
                              {events.length > 0 && (
                                <small>{events.length}</small>
                              )}
                            </div>

                            <div className="flo-cell-event-list">
                              {events.slice(0, 2).map((item) => {
                                const meta = getEventMeta(item);
                                const statusMeta = getEventStatusMeta(item);
                                const sourceMeta = getEventSourceMeta(item);

                                return (
                                  <span
                                    key={item.id}
                                    className={[
                                      "flo-calendar-event",
                                      `is-${statusMeta.key}`,
                                      `source-${sourceMeta.key}`,
                                    ].join(" ")}
                                    style={{
                                      background: meta.background,
                                      color: meta.color,
                                      borderColor: meta.border,
                                    }}
                                    title={`${item.nama_kegiatan} · ${statusMeta.label} · ${sourceMeta.label}`}
                                  >
                                    <i style={{ background: meta.color }} />
                                    <b>{item.nama_kegiatan}</b>
                                    <small
                                      style={{
                                        background: statusMeta.background,
                                        color: statusMeta.color,
                                        borderColor: statusMeta.border,
                                      }}
                                      aria-label={statusMeta.label}
                                    >
                                      {statusMeta.icon}
                                    </small>
                                  </span>
                                );
                              })}

                              {events.length > 2 && (
                                <em>+{events.length - 2} kegiatan lain</em>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flo-calendar-legend">
                      <div className="flo-legend-group">
                        <strong>Jenis kegiatan</strong>
                        <div>
                          {Object.entries(EVENT_META)
                            .filter(([key]) => key !== "manual")
                            .map(([key, meta]) => (
                              <span key={key}>
                                <b>{meta.icon}</b>
                                {meta.label}
                              </span>
                            ))}
                        </div>
                      </div>

                      <div className="flo-legend-group">
                        <strong>Status kegiatan</strong>
                        <div>
                          {[
                            EVENT_STATUS_META.terjadwal,
                            EVENT_STATUS_META.selesai,
                            EVENT_STATUS_META.terlambat,
                          ].map((meta) => (
                            <span key={meta.key}>
                              <i
                                style={{
                                  background: meta.background,
                                  borderColor: meta.border,
                                  color: meta.color,
                                }}
                              >
                                {meta.icon}
                              </i>
                              {meta.label}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="flo-legend-group">
                        <strong>Sumber jadwal</strong>
                        <div>
                          <span>
                            <b>{EVENT_SOURCE_META.utama.icon}</b>
                            {EVENT_SOURCE_META.utama.label}
                          </span>
                          <span>
                            <b>{EVENT_SOURCE_META.adaptif.icon}</b>
                            {EVENT_SOURCE_META.adaptif.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  </section>
                </main>

                <aside className="flo-desktop-aside">
                  <section className="flo-panel">
                    <div className="flo-panel-heading">
                      <div>
                        <span>Hari terpilih</span>
                        <h3>Kegiatan</h3>
                      </div>

                      <span className="flo-count-pill">
                        {selectedActivities.length}
                      </span>
                    </div>

                    {selectedActivities.length > 0 ? (
                      <div className="flo-activity-list">
                        {selectedActivities.map((item) => {
                          const meta = getEventMeta(item);
                          const statusMeta = getEventStatusMeta(item);
                          const sourceMeta = getEventSourceMeta(item);
                          const completed = statusMeta.key === "selesai";

                          return (
                            <button
                              type="button"
                              className={`flo-activity-row ${
                                completed ? "is-complete" : ""
                              } ${
                                statusMeta.key === "terlambat"
                                  ? "is-overdue"
                                  : ""
                              }`}
                              key={item.id}
                              onClick={() => setEventModal(item)}
                            >
                              <span
                                className="flo-activity-icon"
                                style={{
                                  background: meta.background,
                                  color: meta.color,
                                  borderColor: meta.border,
                                }}
                              >
                                {completed ? "✓" : meta.icon}
                              </span>

                              <div className="flo-activity-copy">
                                <span>
                                  {formatTime(item.waktu)} · {meta.label}
                                </span>
                                <strong>{item.nama_kegiatan}</strong>

                                <div className="flo-event-badges">
                                  <small
                                    style={{
                                      background: statusMeta.background,
                                      color: statusMeta.color,
                                      borderColor: statusMeta.border,
                                    }}
                                  >
                                    {statusMeta.icon} {statusMeta.label}
                                  </small>

                                  <small
                                    style={{
                                      background: sourceMeta.background,
                                      color: sourceMeta.color,
                                      borderColor: sourceMeta.border,
                                    }}
                                  >
                                    {sourceMeta.icon} {sourceMeta.label}
                                  </small>
                                </div>
                              </div>

                              <span className="flo-chevron">›</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flo-empty-state compact">
                        <div>🌿</div>
                        <strong>Tidak ada kegiatan khusus</strong>
                        <p>Gunakan hari ini untuk memantau kondisi tanaman.</p>
                      </div>
                    )}
                  </section>

                  <section className="flo-panel flo-monitoring-panel">
                    <div className="flo-panel-heading">
                      <div>
                        <span>Kondisi lapangan</span>
                        <h3>Monitoring harian</h3>
                      </div>

                      <button
                        type="button"
                        className="flo-small-button"
                        onClick={openMonitoring}
                      >
                        {monitoring ? "Ubah" : "+ Catat"}
                      </button>
                    </div>

                    {monitoring ? (
                      <>
                        <div className="flo-monitoring-time">
                          <span>🕒</span>
                          <p>
                            Dicatat{" "}
                            <strong>
                              {formatRecordedTime(monitoringRecordedAt)}
                            </strong>
                          </p>
                        </div>

                        <div className="flo-monitoring-grid">
                          {hasMeasurementValue(monitoring.tinggi_tanaman) && (
                            <div>
                              <span>Tinggi</span>
                              <strong>
                                {formatMeasurement(
                                  monitoring.tinggi_tanaman,
                                  1,
                                )}{" "}
                                cm
                              </strong>
                            </div>
                          )}
                          {hasMeasurementValue(monitoring.jumlah_anakan) && (
                            <div>
                              <span>Anakan</span>
                              <strong>
                                {formatMeasurement(
                                  monitoring.jumlah_anakan,
                                  0,
                                )}
                              </strong>
                            </div>
                          )}
                          <div>
                            <span>Tanaman</span>
                            <strong>
                              {titleCase(monitoring.kondisi_tanaman)}
                            </strong>
                          </div>
                          <div>
                            <span>Daun</span>
                            <strong>{titleCase(monitoring.kondisi_daun)}</strong>
                          </div>
                          <div>
                            <span>Air</span>
                            <strong>{titleCase(monitoring.kondisi_air)}</strong>
                          </div>
                          <div>
                            <span>Hama</span>
                            <strong>{titleCase(monitoring.tingkat_hama)}</strong>
                          </div>
                          <div>
                            <span>Suhu</span>
                            <strong>
                              {formatMeasurement(monitoring.suhu, 1)}
                              {monitoring.suhu !== null &&
                              monitoring.suhu !== undefined
                                ? " °C"
                                : ""}
                            </strong>
                          </div>
                          <div>
                            <span>Kelembapan</span>
                            <strong>
                              {formatMeasurement(monitoring.kelembapan, 0)}
                              {monitoring.kelembapan !== null &&
                              monitoring.kelembapan !== undefined
                                ? "%"
                                : ""}
                            </strong>
                          </div>
                          <div>
                            <span>Curah hujan</span>
                            <strong>
                              {formatMeasurement(monitoring.curah_hujan, 1)}
                              {monitoring.curah_hujan !== null &&
                              monitoring.curah_hujan !== undefined
                                ? " mm"
                                : ""}
                            </strong>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flo-empty-state compact">
                        <div>📝</div>
                        <strong>Belum ada monitoring</strong>
                        <p>
                          Catat kondisi tanaman untuk memperoleh rekomendasi
                          lebih akurat.
                        </p>
                        <button type="button" onClick={openMonitoring}>
                          Catat kondisi sekarang
                        </button>
                      </div>
                    )}

                    {monitoring?.catatan && (
                      <div className="flo-note">
                        <span>Catatan</span>
                        <p>{monitoring.catatan}</p>
                      </div>
                    )}
                  </section>

                  <section className="flo-panel flo-upcoming-panel">
                    <div className="flo-panel-heading">
                      <div>
                        <span>Agenda berikutnya</span>
                        <h3>Kegiatan mendatang</h3>
                      </div>
                    </div>

                    {upcomingActivities.length > 0 ? (
                      <div className="flo-upcoming-list flo-upcoming-list-sidebar">
                        {upcomingActivities.slice(0, 5).map((item) => {
                          const meta = getEventMeta(item);
                          const statusMeta = getEventStatusMeta(item);
                          const sourceMeta = getEventSourceMeta(item);

                          return (
                            <button
                              type="button"
                              key={item.id}
                              className={`flo-upcoming-row ${
                                statusMeta.key === "terlambat"
                                  ? "is-overdue"
                                  : ""
                              }`}
                              onClick={() => setEventModal(item)}
                            >
                              <div className="flo-upcoming-date">
                                <span>
                                  {parseDate(item.tanggal)?.getDate()}
                                </span>
                                <small>
                                  {MONTHS[
                                    parseDate(item.tanggal)?.getMonth()
                                  ]?.slice(0, 3)}
                                </small>
                              </div>

                              <span
                                className="flo-upcoming-icon"
                                style={{
                                  background: meta.background,
                                  color: meta.color,
                                  borderColor: meta.border,
                                }}
                              >
                                {meta.icon}
                              </span>

                              <div className="flo-upcoming-copy">
                                <span>
                                  HST {item.hari_ke ?? "-"} ·{" "}
                                  {formatTime(item.waktu)}
                                </span>
                                <strong>{item.nama_kegiatan}</strong>

                                <div className="flo-event-badges compact">
                                  <small
                                    style={{
                                      background: statusMeta.background,
                                      color: statusMeta.color,
                                      borderColor: statusMeta.border,
                                    }}
                                  >
                                    {statusMeta.label}
                                  </small>

                                  <small
                                    style={{
                                      background: sourceMeta.background,
                                      color: sourceMeta.color,
                                      borderColor: sourceMeta.border,
                                    }}
                                  >
                                    {sourceMeta.shortLabel}
                                  </small>
                                </div>
                              </div>

                              <span className="flo-chevron">›</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flo-empty-state compact">
                        <div>📅</div>
                        <strong>Belum ada kegiatan mendatang</strong>
                        <p>Tekan tombol perbarui untuk membuat ulang jadwal.</p>
                      </div>
                    )}
                  </section>
                </aside>
              </div>
            )}
          </>
        )}
      </div>

      {monitoringOpen && (
        <div
          className="flo-modal-backdrop"
          onMouseDown={() => setMonitoringOpen(false)}
        >
          <div
            className="flo-modal wide"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flo-modal-header">
              <div>
                <span>Monitoring harian</span>
                <h3>{formatLongDate(selectedDate)}</h3>
              </div>

              <button type="button" onClick={() => setMonitoringOpen(false)}>
                ×
              </button>
            </div>

            <form onSubmit={saveMonitoring}>
              <div className="flo-form-grid">
                <div className="flo-monitoring-intro flo-full-field">
                  <div className="flo-monitoring-intro-icon">🌾</div>
                  <div>
                    <strong>Bagaimana kondisi lahan hari ini?</strong>
                    <p>
                      Tidak perlu memakai istilah pertanian yang sulit. Lihat
                      kondisi yang paling banyak tampak di lahan, lalu pilih
                      jawaban yang paling mendekati.
                    </p>
                  </div>
                </div>

                <section className="flo-beginner-guide flo-full-field">
                  <div className="flo-beginner-guide-head">
                    <span className="flo-guide-number">?</span>
                    <div>
                      <strong>Cara mengisi untuk petani</strong>
                      <p>Ikuti langkah sederhana berikut sebelum memilih jawaban.</p>
                    </div>
                  </div>

                  <div className="flo-guide-steps">
                    <div>
                      <span>1</span>
                      <p>
                        Lihat beberapa bagian lahan, jangan hanya melihat satu
                        rumpun tanaman.
                      </p>
                    </div>

                    <div>
                      <span>2</span>
                      <p>
                        Pilih kondisi yang paling sering terlihat. Jika ragu,
                        pilih yang paling mendekati.
                      </p>
                    </div>

                    <div>
                      <span>3</span>
                      <p>
                        Tulis penjelasan singkat pada bagian catatan apabila
                        kondisi lahan berbeda-beda.
                      </p>
                    </div>

                    <div>
                      <span>4</span>
                      <p>
                        Suhu dan hujan diisi otomatis. Tinggi tanaman dan jumlah
                        anakan boleh dikosongkan.
                      </p>
                    </div>
                  </div>
                </section>

                <section className="flo-example-section flo-full-field">
                  <div className="flo-example-header">
                    <div>
                      <strong>Belum yakin? Pilih contoh yang paling mirip</strong>
                      <p>
                        Tekan salah satu contoh. Form akan terisi otomatis dan
                        masih dapat diubah sesuai keadaan sebenarnya.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="flo-example-reset"
                      onClick={resetMonitoringExample}
                    >
                      Isi manual
                    </button>
                  </div>

                  <div className="flo-example-grid">
                    {MONITORING_EXAMPLES.map((example) => {
                      const active =
                        selectedMonitoringExample === example.id;

                      return (
                        <button
                          type="button"
                          key={example.id}
                          className={`flo-example-card ${
                            active ? "is-active" : ""
                          }`}
                          onClick={() => applyMonitoringExample(example)}
                          aria-pressed={active}
                        >
                          <span className="flo-example-icon">{example.icon}</span>

                          <div>
                            <strong>{example.title}</strong>
                            <p>{example.description}</p>
                          </div>

                          <span className="flo-example-check">
                            {active ? "✓" : "›"}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedMonitoringExample && (
                    <div className="flo-example-applied">
                      <span>✓</span>
                      <p>
                        Contoh sudah diterapkan. Periksa kembali semua pilihan
                        dan ubah apabila kondisi lahan Anda berbeda.
                      </p>
                    </div>
                  )}

                  <p className="flo-example-disclaimer">
                    Contoh hanya membantu pengisian. Data yang disimpan harus
                    tetap sesuai kondisi nyata di lahan.
                  </p>
                </section>

                <label className="flo-guided-field">
                  <span>Kondisi tanaman secara umum</span>
                  <select
                    value={monitoringForm.kondisi_tanaman}
                    onChange={(event) => {
                      setSelectedMonitoringExample("");
                      setMonitoringForm((current) => ({
                        ...current,
                        kondisi_tanaman: event.target.value,
                      }));
                    }}
                  >
                    <option value="normal">
                      Normal — tanaman hijau dan tegak
                    </option>
                    <option value="pertumbuhan_lambat">
                      Pertumbuhan lambat — tanaman lebih kecil
                    </option>
                    <option value="layu">
                      Layu — daun atau batang lemas
                    </option>
                    <option value="terserang">
                      Terserang — ada hama atau penyakit
                    </option>
                    <option value="rebah">
                      Rebah — batang roboh atau miring
                    </option>
                  </select>
                  <small className="flo-field-help">
                    Lihat keadaan sebagian besar tanaman, bukan hanya satu
                    tanaman yang berbeda.
                  </small>
                </label>

                <label className="flo-guided-field">
                  <span>Kondisi daun yang paling banyak terlihat</span>
                  <select
                    value={monitoringForm.kondisi_daun}
                    onChange={(event) => {
                      setSelectedMonitoringExample("");
                      setMonitoringForm((current) => ({
                        ...current,
                        kondisi_daun: event.target.value,
                      }));
                    }}
                  >
                    <option value="normal">
                      Normal — hijau dan tidak rusak
                    </option>
                    <option value="menguning">
                      Menguning — daun berubah kuning
                    </option>
                    <option value="bercak">
                      Bercak — ada bintik pada daun
                    </option>
                    <option value="layu">
                      Layu — daun menggulung atau lemas
                    </option>
                    <option value="berlubang">
                      Berlubang — ada bekas gigitan
                    </option>
                  </select>
                  <small className="flo-field-help">
                    Periksa daun pada beberapa rumpun. Pilih kondisi yang paling
                    sering ditemukan.
                  </small>
                </label>

                <label className="flo-guided-field">
                  <span>Kondisi air di lahan</span>
                  <select
                    value={monitoringForm.kondisi_air}
                    onChange={(event) => {
                      setSelectedMonitoringExample("");
                      setMonitoringForm((current) => ({
                        ...current,
                        kondisi_air: event.target.value,
                      }));
                    }}
                  >
                    <option value="cukup">
                      Cukup — air dalam kondisi normal
                    </option>
                    <option value="kering">
                      Kering — air berkurang
                    </option>
                    <option value="tergenang">
                      Tergenang — air terlalu tinggi
                    </option>
                  </select>
                  <small className="flo-field-help">
                    Pilih berdasarkan keadaan permukaan sawah saat diperiksa.
                  </small>
                </label>

                <label className="flo-guided-field">
                  <span>Banyaknya hama yang terlihat</span>
                  <select
                    value={monitoringForm.tingkat_hama}
                    onChange={(event) => {
                      const nextLevel = event.target.value;

                      setSelectedMonitoringExample("");
                      setMonitoringForm((current) => ({
                        ...current,
                        tingkat_hama: nextLevel,
                        jenis_hama:
                          nextLevel === "tidak_ada" ? "" : current.jenis_hama,
                      }));
                    }}
                  >
                    <option value="tidak_ada">
                      Tidak ada — hama tidak terlihat
                    </option>
                    <option value="rendah">
                      Sedikit — hanya beberapa rumpun
                    </option>
                    <option value="sedang">
                      Cukup banyak — banyak bagian lahan
                    </option>
                    <option value="tinggi">
                      Berat — kerusakan terlihat luas
                    </option>
                  </select>
                  <small className="flo-field-help">
                    Hama termasuk serangga, keong, tikus, atau tanda kerusakan
                    yang terlihat jelas.
                  </small>
                </label>

                <label className="flo-full-field flo-guided-field">
                  <span>Nama hama yang terlihat</span>
                  <input
                    type="text"
                    placeholder={
                      monitoringForm.tingkat_hama === "tidak_ada"
                        ? "Tidak perlu diisi karena tidak terlihat hama"
                        : "Contoh: wereng, keong mas, tikus, penggerek batang"
                    }
                    value={monitoringForm.jenis_hama}
                    disabled={monitoringForm.tingkat_hama === "tidak_ada"}
                    onChange={(event) => {
                      setSelectedMonitoringExample("");
                      setMonitoringForm((current) => ({
                        ...current,
                        jenis_hama: event.target.value,
                      }));
                    }}
                  />
                  <small className="flo-field-help">
                    Tidak mengetahui nama hamanya? Isi dengan ciri yang terlihat,
                    misalnya “serangga kecil berwarna cokelat”.
                  </small>
                </label>

                <section className="flo-weather-card flo-full-field">
                  <div className="flo-weather-card-header">
                    <div>
                      <span className="flo-weather-eyebrow">
                        Cuaca otomatis dari lokasi lahan
                      </span>
                      <h4>{weather.kondisi || "Data cuaca belum tersedia"}</h4>
                    </div>

                    <button
                      type="button"
                      className="flo-weather-refresh"
                      onClick={loadWeather}
                      disabled={loadingWeather}
                    >
                      <span className={loadingWeather ? "flo-spin" : ""}>
                        ↻
                      </span>
                      {loadingWeather ? "Memuat..." : "Perbarui"}
                    </button>
                  </div>

                  {loadingWeather ? (
                    <div className="flo-weather-loading">
                      <div className="flo-loader small" />
                      <span>Mengambil data cuaca lokasi lahan...</span>
                    </div>
                  ) : (
                    <>
                      <div className="flo-weather-grid">
                        <div>
                          <span>🌡️ Suhu</span>
                          <strong>
                            {formatMeasurement(weather.suhu, 1)}
                            {weather.suhu !== null ? " °C" : ""}
                          </strong>
                        </div>

                        <div>
                          <span>💧 Kelembapan</span>
                          <strong>
                            {formatMeasurement(weather.kelembapan, 0)}
                            {weather.kelembapan !== null ? "%" : ""}
                          </strong>
                        </div>

                        <div>
                          <span>🌧️ Curah hujan</span>
                          <strong>
                            {formatMeasurement(weather.curah_hujan, 1)}
                            {weather.curah_hujan !== null ? " mm" : ""}
                          </strong>
                        </div>
                      </div>

                      <div className="flo-weather-meta">
                        <span>
                          Sumber:{" "}
                          <strong>
                            {weather.sumber === "open_meteo"
                              ? "Open-Meteo"
                              : "Belum tersedia"}
                          </strong>
                        </span>
                        <span>
                          Diperbarui:{" "}
                          <strong>{formatWeatherTime(weather.waktu)}</strong>
                        </span>
                      </div>
                    </>
                  )}

                  {weatherError && (
                    <div className="flo-weather-warning">
                      <span>i</span>
                      <p>{weatherError}</p>
                    </div>
                  )}

                  <p className="flo-weather-help">
                    Suhu, kelembapan, dan curah hujan diisi otomatis oleh
                    sistem. Petani tidak perlu mengukur atau mengetik data
                    cuaca.
                  </p>
                </section>

                <label className="flo-full-field flo-guided-field">
                  <span>Ceritakan kondisi yang terlihat</span>
                  <textarea
                    rows="4"
                    placeholder="Contoh: daun bagian bawah mulai menguning sejak dua hari lalu, tetapi tanaman masih tegak dan air sawah cukup."
                    value={monitoringForm.catatan}
                    onChange={(event) => {
                      setSelectedMonitoringExample("");
                      setMonitoringForm((current) => ({
                        ...current,
                        catatan: event.target.value,
                      }));
                    }}
                  />
                  <small className="flo-field-help">
                    Tulis dengan bahasa sehari-hari. Sebutkan bagian lahan yang
                    terdampak, kapan mulai terlihat, dan apakah kondisinya
                    bertambah parah.
                  </small>

                  <div className="flo-note-examples">
                    <span>Contoh kalimat:</span>
                    <p>
                      “Daun bawah menguning”, “air di sisi timur mulai kering”,
                      atau “terlihat keong mas pada beberapa rumpun”.
                    </p>
                  </div>
                </label>

                <details className="flo-optional-section flo-full-field">
                  <summary>
                    <div className="flo-optional-summary-copy">
                      <strong>Data pengukuran tambahan</strong>
                      <span>
                        Opsional. Isi hanya apabila petani atau penyuluh sudah
                        melakukan pengukuran.
                      </span>
                    </div>
                    <span className="flo-optional-chevron">⌄</span>
                  </summary>

                  <div className="flo-optional-grid">
                    <label>
                      <span>Tinggi tanaman (cm)</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Boleh dikosongkan"
                        value={monitoringForm.tinggi_tanaman}
                        onChange={(event) =>
                          setMonitoringForm((current) => ({
                            ...current,
                            tinggi_tanaman: event.target.value,
                          }))
                        }
                      />
                      <small className="flo-field-help">
                        Ukur 3 rumpun dari pangkal sampai ujung daun tertinggi,
                        lalu masukkan nilai rata-ratanya. Kosongkan jika belum
                        mengukur.
                      </small>
                    </label>

                    <label>
                      <span>Jumlah anakan per rumpun</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="Boleh dikosongkan"
                        value={monitoringForm.jumlah_anakan}
                        onChange={(event) =>
                          setMonitoringForm((current) => ({
                            ...current,
                            jumlah_anakan: event.target.value,
                          }))
                        }
                      />
                      <small className="flo-field-help">
                        Hitung batang pada 3 rumpun, lalu masukkan jumlah
                        rata-ratanya. Kosongkan jika belum menghitung.
                      </small>
                    </label>
                  </div>
                </details>
              </div>

              <div className="flo-save-reminder">
                <span>✓</span>
                <div>
                  <strong>Sebelum disimpan</strong>
                  <p>
                    Pastikan pilihan sudah sesuai keadaan lahan hari ini. Data
                    cuaca diisi otomatis dan data pengukuran boleh kosong.
                  </p>
                </div>
              </div>

              <div className="flo-modal-actions">
                <button
                  type="button"
                  className="flo-button secondary"
                  onClick={() => setMonitoringOpen(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flo-button primary"
                  disabled={saving}
                >
                  {saving ? "Menyimpan..." : "Simpan monitoring"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {monitoringResultOpen && monitoringResult && (
        <div
          className="flo-modal-backdrop"
          onMouseDown={() => setMonitoringResultOpen(false)}
        >
          <div
            className="flo-modal flo-result-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flo-modal-header">
              <div>
                <span>Hasil monitoring hari ini</span>
                <h3>
                  {formatLongDate(monitoringResult.tanggal || selectedDate)}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setMonitoringResultOpen(false)}
              >
                ×
              </button>
            </div>

            <div
              className={[
                "flo-result-status",
                monitoringResult.insight?.status === "normal"
                  ? "is-normal"
                  : "is-warning",
              ].join(" ")}
            >
              <div className="flo-result-status-icon">
                {monitoringResult.insight?.status === "normal" ? "✓" : "!"}
              </div>

              <div className="flo-result-status-copy">
                <span>Kondisi tanaman</span>
                <h4>
                  {monitoringResult.insight?.judul ||
                    "Hasil analisis belum tersedia"}
                </h4>
                <p>
                  {monitoringResult.insight?.ringkasan ||
                    "Monitoring berhasil disimpan."}
                </p>
              </div>

              <strong className="flo-result-priority">
                Prioritas{" "}
                {titleCase(monitoringResult.insight?.prioritas || "rendah")}
              </strong>
            </div>

            <section className="flo-result-section">
              <span className="flo-result-label">Masalah yang ditemukan</span>

              {monitoringResult.problems?.length > 0 ? (
                <ul className="flo-result-problem-list">
                  {monitoringResult.problems.map((problem) => (
                    <li key={problem}>
                      <span>!</span>
                      <p>{problem}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flo-result-empty is-compact">
                  <span>✓</span>
                  <div>
                    <strong>Tidak ditemukan masalah utama</strong>
                    <p>
                      Kondisi yang dicatat masih berada dalam kategori normal.
                    </p>
                  </div>
                </div>
              )}
            </section>

            <section className="flo-result-section">
              <span className="flo-result-label">Tindakan yang disarankan</span>

              <div className="flo-result-recommendation">
                <span>💡</span>
                <p>
                  {monitoringResult.insight?.rekomendasi ||
                    "Lanjutkan pemantauan tanaman sesuai jadwal."}
                </p>
              </div>
            </section>

            <section className="flo-result-section">
              <div className="flo-result-section-heading">
                <div>
                  <span className="flo-result-label">
                    Jadwal tindak lanjut otomatis
                  </span>
                  <p>Jadwal dibuat berdasarkan kondisi yang baru dicatat.</p>
                </div>

                <strong>
                  {monitoringResult.followUpActivities?.length || 0}
                </strong>
              </div>

              {monitoringResult.followUpActivities?.length > 0 ? (
                <div className="flo-result-schedule-list">
                  {monitoringResult.followUpActivities.map((item) => {
                    const meta = getEventMeta(item);
                    const activityDate = parseDate(item.tanggal);

                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => {
                          setMonitoringResultOpen(false);
                          chooseDate(item.tanggal);
                          setEventModal(item);
                        }}
                      >
                        <div className="flo-result-schedule-date">
                          <strong>{activityDate?.getDate() || "-"}</strong>
                          <span>
                            {activityDate
                              ? MONTHS[activityDate.getMonth()]?.slice(0, 3)
                              : "-"}
                          </span>
                        </div>

                        <span
                          className="flo-result-schedule-icon"
                          style={{
                            background: meta.background,
                            color: meta.color,
                            borderColor: meta.border,
                          }}
                        >
                          {meta.icon}
                        </span>

                        <div className="flo-result-schedule-copy">
                          <span>
                            HST {item.hari_ke ?? "-"} · {formatTime(item.waktu)}
                          </span>
                          <strong>{item.nama_kegiatan}</strong>
                          <div className="flo-event-badges compact">
                            <small
                              style={{
                                background:
                                  EVENT_SOURCE_META.adaptif.background,
                                color: EVENT_SOURCE_META.adaptif.color,
                                borderColor:
                                  EVENT_SOURCE_META.adaptif.border,
                              }}
                            >
                              ⚡ Rekomendasi Adaptif
                            </small>
                          </div>
                        </div>

                        <span className="flo-chevron">›</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flo-result-empty">
                  <span>✓</span>
                  <div>
                    <strong>Tidak ada tindakan tambahan</strong>
                    <p>
                      Kondisi tanaman belum membutuhkan jadwal adaptif baru.
                    </p>
                  </div>
                </div>
              )}
            </section>

            <div className="flo-modal-actions split">
              <button
                type="button"
                className="flo-button secondary"
                onClick={() => {
                  setMonitoringResultOpen(false);

                  const firstFollowUp =
                    monitoringResult.followUpActivities?.[0];

                  if (firstFollowUp?.tanggal) {
                    chooseDate(firstFollowUp.tanggal);
                  }

                  window.requestAnimationFrame(() => {
                    document
                      .querySelector(".flo-month-card")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  });
                }}
              >
                Lihat jadwal
              </button>

              <button
                type="button"
                className="flo-button primary"
                onClick={() => setMonitoringResultOpen(false)}
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {eventModal && !rescheduleOpen && (
        <div
          className="flo-modal-backdrop"
          onMouseDown={() => setEventModal(null)}
        >
          <div
            className="flo-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flo-modal-header">
              <div>
                <span>Detail kegiatan</span>
                <h3>{eventModal.nama_kegiatan}</h3>
              </div>

              <button type="button" onClick={() => setEventModal(null)}>
                ×
              </button>
            </div>

            <div className="flo-event-detail">
              <div>
                <span>Tanggal</span>
                <strong>{formatLongDate(eventModal.tanggal)}</strong>
              </div>
              <div>
                <span>Waktu</span>
                <strong>{formatTime(eventModal.waktu)}</strong>
              </div>
              <div>
                <span>HST</span>
                <strong>{eventModal.hari_ke ?? "-"}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{getEventStatusMeta(eventModal).label}</strong>
              </div>
              <div>
                <span>Sumber jadwal</span>
                <strong>{getEventSourceMeta(eventModal).label}</strong>
              </div>
              <div>
                <span>Jenis kegiatan</span>
                <strong>{getEventMeta(eventModal).label}</strong>
              </div>
            </div>

            {eventModal.pupuk && (
              <div className="flo-detail-block">
                <span>Pupuk dan dosis</span>
                <strong>{eventModal.pupuk}</strong>
                <p>
                  {eventModal.dosis_per_ha || "-"} · Total lahan{" "}
                  {eventModal.dosis_total || "-"}
                </p>
              </div>
            )}

            <div className="flo-detail-block">
              <span>Petunjuk</span>
              <p>{eventModal.metode || "Laksanakan sesuai kondisi lahan."}</p>
            </div>

            {eventModal.catatan && (
              <div className="flo-detail-block">
                <span>Catatan</span>
                <p>{eventModal.catatan}</p>
              </div>
            )}

            <div className="flo-modal-actions split">
              <button
                type="button"
                className="flo-button secondary"
                onClick={() => openReschedule(eventModal)}
                disabled={saving}
              >
                Jadwal ulang
              </button>

              {String(eventModal.status).toLowerCase() !== "selesai" ? (
                <button
                  type="button"
                  className="flo-button primary"
                  onClick={() => updateStatus(eventModal, "selesai")}
                  disabled={saving}
                >
                  {saving ? "Memproses..." : "Tandai selesai"}
                </button>
              ) : (
                <button
                  type="button"
                  className="flo-button primary"
                  onClick={() => updateStatus(eventModal, "terjadwal")}
                  disabled={saving}
                >
                  Batalkan selesai
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {rescheduleOpen && eventModal && (
        <div
          className="flo-modal-backdrop"
          onMouseDown={() => setRescheduleOpen(false)}
        >
          <div
            className="flo-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flo-modal-header">
              <div>
                <span>Jadwal ulang</span>
                <h3>{eventModal.nama_kegiatan}</h3>
              </div>

              <button type="button" onClick={() => setRescheduleOpen(false)}>
                ×
              </button>
            </div>

            <form onSubmit={saveReschedule}>
              <div className="flo-form-grid one-column">
                <label>
                  <span>Tanggal baru</span>
                  <input
                    type="date"
                    required
                    value={rescheduleForm.tanggal_baru}
                    onChange={(event) =>
                      setRescheduleForm((current) => ({
                        ...current,
                        tanggal_baru: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  <span>Alasan perubahan</span>
                  <textarea
                    rows="4"
                    required
                    placeholder="Contoh: menyesuaikan kondisi hujan"
                    value={rescheduleForm.alasan}
                    onChange={(event) =>
                      setRescheduleForm((current) => ({
                        ...current,
                        alasan: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <div className="flo-modal-actions">
                <button
                  type="button"
                  className="flo-button secondary"
                  onClick={() => setRescheduleOpen(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flo-button primary"
                  disabled={saving}
                >
                  {saving ? "Menyimpan..." : "Simpan perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
  :root {
    --flo-bg: #f6f8f5;
    --flo-card: #ffffff;
    --flo-text: #1e2b24;
    --flo-muted: #768078;
    --flo-line: #e5e9e5;
    --flo-green: #2f9d68;
    --flo-green-dark: #237d52;
    --flo-green-soft: #eaf7f0;
    --flo-shadow: 0 18px 45px rgba(50, 74, 61, 0.09);
  }

  * {
    box-sizing: border-box;
  }

  button,
  input,
  select,
  textarea {
    font: inherit;
  }

  button {
    cursor: pointer;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.62;
  }

  .flo-page {
    min-height: 100vh;
    padding: 22px;
    background:
      radial-gradient(circle at top right, rgba(191, 231, 208, 0.36), transparent 32%),
      var(--flo-bg);
    color: var(--flo-text);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .flo-shell {
    width: min(1120px, 100%);
    margin: 0 auto;
  }

  .flo-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 18px;
  }

  .flo-brand {
    display: flex;
    align-items: center;
    gap: 13px;
  }

  .flo-brand-mark {
    display: grid;
    width: 50px;
    height: 50px;
    place-items: center;
    border-radius: 18px;
    background: linear-gradient(145deg, #3aae77, #237f55);
    box-shadow: 0 12px 28px rgba(47, 157, 104, 0.25);
    font-size: 24px;
  }

  .flo-kicker,
  .flo-section-heading span,
  .flo-panel-heading > div > span,
  .flo-month-header > div > span,
  .flo-modal-header span,
  .flo-insight-title-row span,
  .flo-recommendation-box > span,
  .flo-note > span,
  .flo-detail-block > span,
  .flo-event-detail span {
    display: block;
    color: var(--flo-muted);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .flo-brand h1,
  .flo-section-heading h3,
  .flo-panel-heading h3,
  .flo-month-header h3,
  .flo-modal-header h3,
  .flo-insight-title-row h3 {
    margin: 3px 0 0;
  }

  .flo-brand h1 {
    font-size: 24px;
  }

  .flo-icon-button {
    display: grid;
    width: 46px;
    height: 46px;
    place-items: center;
    border: 1px solid var(--flo-line);
    border-radius: 16px;
    background: #fff;
    color: var(--flo-green-dark);
    box-shadow: 0 8px 22px rgba(50, 74, 61, 0.07);
    font-size: 25px;
  }

  .flo-spin {
    display: inline-block;
    animation: floSpin 0.9s linear infinite;
  }

  .flo-farm-select-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 16px;
    padding: 15px 18px;
    border: 1px solid var(--flo-line);
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 10px 30px rgba(50, 74, 61, 0.06);
  }

  .flo-farm-select-copy {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .flo-farm-select-copy > span {
    display: grid;
    width: 38px;
    height: 38px;
    place-items: center;
    border-radius: 13px;
    background: var(--flo-green-soft);
  }

  .flo-farm-select-copy small,
  .flo-farm-select-copy strong {
    display: block;
  }

  .flo-farm-select-copy small {
    margin-bottom: 2px;
    color: var(--flo-muted);
  }

  .flo-farm-select-card select {
    min-width: 230px;
    padding: 11px 38px 11px 13px;
    border: 1px solid var(--flo-line);
    border-radius: 13px;
    background: #fbfcfb;
    color: var(--flo-text);
    font-weight: 700;
    outline: none;
  }

  .flo-hero-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 18px;
    padding: 28px;
    overflow: hidden;
    border-radius: 28px;
    background:
      radial-gradient(circle at 80% 10%, rgba(255,255,255,.26), transparent 26%),
      linear-gradient(135deg, #2d9e68, #1f7650);
    color: #fff;
    box-shadow: 0 22px 50px rgba(35, 125, 82, 0.25);
  }

  .flo-phase-pill {
    display: inline-flex;
    padding: 7px 11px;
    border: 1px solid rgba(255,255,255,.28);
    border-radius: 999px;
    background: rgba(255,255,255,.15);
    font-size: 12px;
    font-weight: 800;
  }

  .flo-hero-content h2 {
    margin: 13px 0 5px;
    font-size: 25px;
    font-weight: 650;
  }

  .flo-hero-content h2 span {
    font-size: 42px;
    font-weight: 850;
  }

  .flo-hero-content > p {
    max-width: 600px;
    margin: 0;
    color: rgba(255,255,255,.82);
  }

  .flo-hero-stats {
    display: flex;
    gap: 30px;
    margin-top: 22px;
  }

  .flo-hero-stats span,
  .flo-hero-stats strong {
    display: block;
  }

  .flo-hero-stats span {
    margin-bottom: 4px;
    color: rgba(255,255,255,.7);
    font-size: 12px;
  }

  .flo-progress-ring {
    display: grid;
    flex: 0 0 130px;
    width: 130px;
    height: 130px;
    place-items: center;
    border-radius: 50%;
  }

  .flo-progress-ring > div {
    display: grid;
    width: 100px;
    height: 100px;
    place-items: center;
    align-content: center;
    border-radius: 50%;
    background: rgba(27, 103, 69, 0.95);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.12);
  }

  .flo-progress-ring strong,
  .flo-progress-ring span {
    display: block;
  }

  .flo-progress-ring strong {
    font-size: 25px;
  }

  .flo-progress-ring span {
    color: rgba(255,255,255,.7);
    font-size: 11px;
  }

  .flo-date-section,
  .flo-panel,
  .flo-month-card {
    border: 1px solid var(--flo-line);
    background: rgba(255,255,255,.94);
    box-shadow: var(--flo-shadow);
  }

  .flo-date-section {
    margin-bottom: 16px;
    padding: 20px;
    border-radius: 24px;
  }

  .flo-section-heading,
  .flo-panel-heading,
  .flo-month-header,
  .flo-modal-header,
  .flo-insight-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .flo-date-heading {
    margin-bottom: 15px;
  }

  .flo-text-button,
  .flo-small-button {
    border: 0;
    border-radius: 999px;
    background: var(--flo-green-soft);
    color: var(--flo-green-dark);
    font-weight: 800;
  }

  .flo-text-button {
    padding: 9px 13px;
  }

  .flo-small-button {
    padding: 8px 12px;
  }

  .flo-week-control {
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr) 38px;
    align-items: center;
    gap: 10px;
  }

  .flo-week-arrow {
    display: grid;
    width: 38px;
    height: 38px;
    place-items: center;
    border: 1px solid var(--flo-line);
    border-radius: 50%;
    background: #fff;
    color: var(--flo-text);
    font-size: 24px;
  }

  .flo-week-strip {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 8px;
  }

  .flo-day-button {
    display: grid;
    min-height: 76px;
    place-items: center;
    align-content: center;
    gap: 4px;
    border: 1px solid transparent;
    border-radius: 18px;
    background: transparent;
    color: #7c847e;
    transition: 0.2s ease;
  }

  .flo-day-button:hover {
    background: #f5f8f5;
  }

  .flo-day-button span {
    font-size: 11px;
    font-weight: 800;
  }

  .flo-day-button strong {
    font-size: 19px;
  }

  .flo-day-button i {
    width: 5px;
    height: 5px;
    border-radius: 50%;
  }

  .flo-day-button i.has-event {
    background: #f4b23e;
  }

  .flo-day-button i.has-monitoring {
    background: #2f9d68;
  }

  .flo-day-button.is-active {
    border-color: #2f9d68;
    background: #2f9d68;
    color: #fff;
    box-shadow: 0 10px 24px rgba(47, 157, 104, 0.23);
  }

  .flo-day-button.is-active i {
    background: #fff;
  }

  .flo-insight-card {
    display: grid;
    grid-template-columns: 54px minmax(0, 1fr);
    gap: 17px;
    margin-bottom: 16px;
    padding: 21px;
    border: 1px solid var(--tone-border);
    border-radius: 24px;
    background: var(--tone-bg);
    color: var(--tone-color);
  }

  .flo-insight-icon {
    display: grid;
    width: 54px;
    height: 54px;
    place-items: center;
    border: 1px solid var(--tone-border);
    border-radius: 18px;
    background: rgba(255,255,255,.72);
    font-size: 25px;
    font-weight: 900;
  }

  .flo-insight-title-row h3 {
    color: var(--flo-text);
    font-size: 20px;
  }

  .flo-priority-pill,
  .flo-count-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 850;
  }

  .flo-priority-pill {
    padding: 7px 10px;
    background: rgba(255,255,255,.68);
  }

  .flo-insight-copy > p {
    margin: 10px 0 0;
    color: #536058;
    line-height: 1.65;
  }

  .flo-recommendation-box {
    margin-top: 15px;
    padding: 14px 15px;
    border-radius: 16px;
    background: rgba(255,255,255,.78);
  }

  .flo-recommendation-box strong {
    display: block;
    margin-top: 4px;
    color: var(--flo-text);
    line-height: 1.55;
  }

  .flo-recommendation-reasons {
    margin-top: 12px;
    padding-top: 11px;
    border-top: 1px dashed #cddbd2;
  }

  .flo-recommendation-reasons > small {
    display: block;
    color: #577063;
    font-size: 10px;
    font-weight: 850;
    letter-spacing: .06em;
    text-transform: uppercase;
  }

  .flo-recommendation-reasons ul {
    display: grid;
    gap: 5px;
    margin: 8px 0 0;
    padding-left: 18px;
    color: #546159;
  }

  .flo-recommendation-reasons li {
    line-height: 1.45;
  }

  .flo-two-column {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 16px;
  }

  .flo-panel {
    padding: 20px;
    border-radius: 24px;
  }

  .flo-panel-heading {
    margin-bottom: 15px;
  }

  .flo-count-pill {
    min-width: 31px;
    height: 31px;
    background: var(--flo-green-soft);
    color: var(--flo-green-dark);
  }

  .flo-monitoring-time {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 11px;
    padding: 9px 11px;
    border: 1px solid #e2ebe5;
    border-radius: 12px;
    background: #f7faf8;
    color: #617067;
  }

  .flo-monitoring-time p {
    margin: 0;
    font-size: 11px;
  }

  .flo-monitoring-time strong {
    color: #34483c;
  }

  .flo-monitoring-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .flo-monitoring-grid > div {
    padding: 12px;
    border: 1px solid #edf0ed;
    border-radius: 15px;
    background: #fafcfb;
  }

  .flo-monitoring-grid span,
  .flo-monitoring-grid strong {
    display: block;
  }

  .flo-monitoring-grid span {
    margin-bottom: 4px;
    color: var(--flo-muted);
    font-size: 11px;
  }

  .flo-monitoring-grid strong {
    font-size: 13px;
  }

  .flo-note {
    margin-top: 12px;
    padding: 13px;
    border-left: 3px solid #91caaa;
    border-radius: 0 12px 12px 0;
    background: #f7faf8;
  }

  .flo-note p {
    margin: 4px 0 0;
    color: #5d675f;
    line-height: 1.55;
  }

  .flo-activity-list,
  .flo-upcoming-list {
    display: grid;
    gap: 9px;
  }

  .flo-activity-row,
  .flo-upcoming-row {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 12px;
    padding: 11px;
    border: 1px solid #edf0ed;
    border-radius: 16px;
    background: #fff;
    color: var(--flo-text);
    text-align: left;
    transition: 0.2s ease;
  }

  .flo-activity-row:hover,
  .flo-upcoming-row:hover {
    transform: translateY(-1px);
    border-color: #cfe2d6;
    box-shadow: 0 8px 22px rgba(50,74,61,.06);
  }

  .flo-activity-row.is-complete {
    opacity: 0.62;
  }

  .flo-activity-icon,
  .flo-upcoming-icon {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    border: 1px solid;
    border-radius: 14px;
  }

  .flo-activity-icon {
    width: 43px;
    height: 43px;
  }

  .flo-upcoming-icon {
    width: 40px;
    height: 40px;
  }

  .flo-activity-row > div,
  .flo-upcoming-copy {
    min-width: 0;
    flex: 1;
  }

  .flo-activity-row span,
  .flo-upcoming-copy span {
    display: block;
    margin-bottom: 3px;
    color: var(--flo-muted);
    font-size: 11px;
  }

  .flo-activity-row strong,
  .flo-upcoming-copy strong {
    display: -webkit-box;
    overflow: hidden;
    font-size: 14px;
    line-height: 1.35;
    white-space: normal;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .flo-event-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 7px;
  }

  .flo-event-badges small {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin: 0;
    padding: 4px 7px;
    border: 1px solid;
    border-radius: 999px;
    font-size: 9px;
    font-weight: 800;
    line-height: 1.1;
  }

  .flo-event-badges.compact {
    margin-top: 5px;
  }

  .flo-activity-row.is-overdue,
  .flo-upcoming-row.is-overdue {
    border-color: #efc1b8;
    background: #fffafa;
  }

  .flo-chevron {
    color: #a2aaa4;
    font-size: 23px;
  }

  .flo-upcoming-panel {
    margin-bottom: 16px;
  }

  .flo-upcoming-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .flo-upcoming-date {
    display: grid;
    width: 44px;
    flex: 0 0 44px;
    place-items: center;
    align-content: center;
    border-radius: 13px;
    background: #f3f6f3;
  }

  .flo-upcoming-date span {
    font-size: 17px;
    font-weight: 850;
  }

  .flo-upcoming-date small {
    color: var(--flo-muted);
    font-size: 10px;
    text-transform: uppercase;
  }

  .flo-month-card {
    padding: 20px;
    border-radius: 24px;
  }

  .flo-month-header {
    margin-bottom: 18px;
  }

  .flo-month-header > button {
    display: grid;
    width: 40px;
    height: 40px;
    place-items: center;
    border: 1px solid var(--flo-line);
    border-radius: 50%;
    background: #fff;
    color: var(--flo-text);
    font-size: 25px;
  }

  .flo-month-header > div {
    text-align: center;
  }

  .flo-calendar-weekdays,
  .flo-calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }

  .flo-calendar-weekdays {
    margin-bottom: 7px;
  }

  .flo-calendar-weekdays span {
    padding: 7px;
    color: var(--flo-muted);
    font-size: 11px;
    font-weight: 800;
    text-align: center;
  }

  .flo-calendar-grid {
    gap: 6px;
  }

  .flo-calendar-cell {
    position: relative;
    display: grid;
    min-height: 70px;
    place-items: center;
    align-content: center;
    gap: 8px;
    border: 1px solid transparent;
    border-radius: 16px;
    background: #fafcfb;
    color: #4f5a53;
  }

  .flo-calendar-cell:hover {
    border-color: #cfe2d6;
  }

  .flo-calendar-cell.is-outside {
    opacity: 0.35;
  }

  .flo-calendar-cell.is-today {
    border-color: #97c8aa;
  }

  .flo-calendar-cell.is-active {
    background: #2f9d68;
    color: #fff;
    box-shadow: 0 9px 22px rgba(47, 157, 104, 0.2);
  }

  .flo-calendar-cell > span {
    font-size: 14px;
    font-weight: 800;
  }

  .flo-cell-dots {
    display: flex;
    min-height: 5px;
    gap: 3px;
  }

  .flo-cell-dots i {
    display: block;
    width: 5px;
    height: 5px;
    border-radius: 50%;
  }

  .flo-calendar-cell.is-active .flo-cell-dots i {
    background: #fff !important;
  }

  .flo-calendar-legend {
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr;
    gap: 14px;
    margin-top: 18px;
    padding-top: 15px;
    border-top: 1px solid var(--flo-line);
  }

  .flo-legend-group {
    min-width: 0;
  }

  .flo-legend-group > strong {
    display: block;
    margin-bottom: 8px;
    color: #4e6156;
    font-size: 10px;
    letter-spacing: .06em;
    text-transform: uppercase;
  }

  .flo-legend-group > div {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .flo-legend-group span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border: 1px solid #e4e9e5;
    border-radius: 999px;
    background: #fafcfb;
    color: #657169;
    font-size: 10px;
    font-weight: 700;
  }

  .flo-legend-group span > b {
    font-size: 13px;
    line-height: 1;
  }

  .flo-legend-group span > i {
    display: grid;
    width: 19px;
    height: 19px;
    place-items: center;
    border: 1px solid;
    border-radius: 50%;
    font-size: 10px;
    font-style: normal;
    font-weight: 900;
  }

  .flo-empty-state {
    display: grid;
    place-items: center;
    text-align: center;
  }

  .flo-empty-state.compact {
    min-height: 168px;
    padding: 20px;
  }

  .flo-empty-state > div {
    margin-bottom: 8px;
    font-size: 28px;
  }

  .flo-empty-state p {
    max-width: 350px;
    margin: 6px 0 0;
    color: var(--flo-muted);
    line-height: 1.5;
  }

  .flo-empty-state button {
    margin-top: 13px;
    padding: 9px 13px;
    border: 0;
    border-radius: 999px;
    background: var(--flo-green-soft);
    color: var(--flo-green-dark);
    font-weight: 800;
  }

  .flo-error {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 15px;
    padding: 14px;
    border: 1px solid #f1c0b7;
    border-radius: 16px;
    background: #fff2ef;
    color: #9f3e31;
  }

  .flo-error > span {
    display: grid;
    width: 28px;
    height: 28px;
    flex: 0 0 28px;
    place-items: center;
    border-radius: 50%;
    background: #e05b49;
    color: #fff;
    font-weight: 900;
  }

  .flo-error strong,
  .flo-error p {
    display: block;
    margin: 0;
  }

  .flo-error p {
    margin-top: 2px;
    line-height: 1.5;
  }

  .flo-inline-loading,
  .flo-loading-page {
    display: grid;
    place-items: center;
    color: var(--flo-muted);
  }

  .flo-inline-loading {
    min-height: 160px;
    margin-bottom: 16px;
    border: 1px solid var(--flo-line);
    border-radius: 22px;
    background: #fff;
  }

  .flo-loading-page {
    min-height: 70vh;
    align-content: center;
    gap: 13px;
    background: var(--flo-bg);
  }

  .flo-loader {
    width: 31px;
    height: 31px;
    border: 3px solid #dce9e1;
    border-top-color: var(--flo-green);
    border-radius: 50%;
    animation: floSpin 0.8s linear infinite;
  }

  .flo-toast {
    position: fixed;
    z-index: 1000;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 18px;
    border-radius: 999px;
    background: #1e3328;
    color: #fff;
    box-shadow: 0 12px 32px rgba(0,0,0,.18);
    font-weight: 700;
  }

  .flo-modal-backdrop {
    position: fixed;
    z-index: 900;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 18px;
    background: rgba(23, 34, 28, 0.48);
    backdrop-filter: blur(4px);
  }

  .flo-modal {
    width: min(520px, 100%);
    max-height: calc(100vh - 36px);
    overflow-y: auto;
    padding: 22px;
    border-radius: 25px;
    background: #fff;
    box-shadow: 0 30px 80px rgba(0,0,0,.23);
  }

  .flo-modal.wide {
    width: min(760px, 100%);
  }

  .flo-modal-header {
    margin-bottom: 18px;
  }

  .flo-modal-header > button {
    display: grid;
    width: 38px;
    height: 38px;
    place-items: center;
    border: 1px solid var(--flo-line);
    border-radius: 50%;
    background: #fff;
    color: #667068;
    font-size: 24px;
  }

  .flo-form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .flo-form-grid.one-column {
    grid-template-columns: 1fr;
  }

  .flo-form-grid label {
    display: grid;
    gap: 7px;
  }

  .flo-form-grid label > span {
    color: #59645c;
    font-size: 12px;
    font-weight: 750;
  }

  .flo-form-grid input,
  .flo-form-grid select,
  .flo-form-grid textarea {
    width: 100%;
    padding: 11px 12px;
    border: 1px solid #dfe5e0;
    border-radius: 12px;
    background: #fbfcfb;
    color: var(--flo-text);
    outline: none;
  }

  .flo-form-grid select {
    min-height: 44px;
    padding-right: 46px;
    overflow: hidden;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    background-color: #fbfcfb;
    background-image:
      linear-gradient(45deg, transparent 50%, #526158 50%),
      linear-gradient(135deg, #526158 50%, transparent 50%);
    background-position:
      calc(100% - 18px) 18px,
      calc(100% - 13px) 18px;
    background-size: 5px 5px, 5px 5px;
    background-repeat: no-repeat;
    font-size: 12px;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .flo-form-grid select::-ms-expand {
    display: none;
  }

  .flo-form-grid input:focus,
  .flo-form-grid select:focus,
  .flo-form-grid textarea:focus {
    border-color: #73b591;
    box-shadow: 0 0 0 3px rgba(47,157,104,.11);
  }

  .flo-full-field {
    grid-column: 1 / -1;
  }

  .flo-monitoring-intro {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 15px;
    border: 1px solid #d7e9de;
    border-radius: 16px;
    background: #f6fbf8;
  }

  .flo-monitoring-intro-icon {
    display: grid;
    width: 38px;
    height: 38px;
    flex: 0 0 38px;
    place-items: center;
    border-radius: 12px;
    background: var(--flo-green-soft);
    font-size: 19px;
  }

  .flo-monitoring-intro strong,
  .flo-monitoring-intro p {
    display: block;
    margin: 0;
  }

  .flo-monitoring-intro strong {
    color: #234c35;
    font-size: 14px;
  }

  .flo-monitoring-intro p {
    margin-top: 4px;
    color: #68736b;
    font-size: 12px;
    line-height: 1.5;
  }

  .flo-field-help {
    display: block;
    color: #7a847d;
    font-size: 11px;
    font-weight: 500;
    line-height: 1.45;
  }

  .flo-guided-field {
    min-width: 0;
    align-content: start;
    padding: 12px;
    border: 1px solid #e5ebe7;
    border-radius: 15px;
    background: #fcfdfc;
  }

  .flo-guided-field select {
    max-width: 100%;
  }

  .flo-beginner-guide {
    padding: 15px;
    border: 1px solid #cfe3d6;
    border-radius: 17px;
    background: linear-gradient(145deg, #f9fcfa, #f1f8f4);
  }

  .flo-beginner-guide-head {
    display: flex;
    align-items: flex-start;
    gap: 11px;
  }

  .flo-guide-number {
    display: grid;
    width: 32px;
    height: 32px;
    flex: 0 0 32px;
    place-items: center;
    border-radius: 50%;
    background: #dff4e7;
    color: #1c7048;
    font-size: 15px;
    font-weight: 900;
  }

  .flo-beginner-guide-head strong,
  .flo-beginner-guide-head p {
    display: block;
    margin: 0;
  }

  .flo-beginner-guide-head strong {
    color: #234c35;
    font-size: 14px;
  }

  .flo-beginner-guide-head p {
    margin-top: 3px;
    color: #6d776f;
    font-size: 11px;
  }

  .flo-guide-steps {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 9px;
    margin-top: 13px;
  }

  .flo-guide-steps > div {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    padding: 10px;
    border: 1px solid #e2ece6;
    border-radius: 13px;
    background: rgba(255, 255, 255, 0.82);
  }

  .flo-guide-steps span {
    display: grid;
    width: 23px;
    height: 23px;
    flex: 0 0 23px;
    place-items: center;
    border-radius: 8px;
    background: #2f9d68;
    color: #fff;
    font-size: 11px;
    font-weight: 900;
  }

  .flo-guide-steps p {
    margin: 0;
    color: #59665d;
    font-size: 11px;
    line-height: 1.45;
  }

  .flo-example-section {
    padding: 15px;
    border: 1px solid #dce7e0;
    border-radius: 17px;
    background: #fbfdfc;
  }

  .flo-example-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
  }

  .flo-example-header strong,
  .flo-example-header p {
    display: block;
    margin: 0;
  }

  .flo-example-header strong {
    color: #263e30;
    font-size: 14px;
  }

  .flo-example-header p {
    margin-top: 4px;
    max-width: 530px;
    color: #758078;
    font-size: 11px;
    line-height: 1.45;
  }

  .flo-example-reset {
    flex: 0 0 auto;
    padding: 8px 11px;
    border: 1px solid #cddbd2;
    border-radius: 10px;
    background: #fff;
    color: #4c6656;
    font-size: 11px;
    font-weight: 800;
  }

  .flo-example-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 9px;
    margin-top: 13px;
  }

  .flo-example-card {
    display: grid;
    grid-template-columns: 37px minmax(0, 1fr) 23px;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 11px;
    border: 1px solid #e1e8e3;
    border-radius: 14px;
    background: #fff;
    color: #2d3d33;
    text-align: left;
    transition: .18s ease;
  }

  .flo-example-card:hover {
    border-color: #9fcab0;
    background: #f8fcf9;
    transform: translateY(-1px);
  }

  .flo-example-card.is-active {
    border-color: #4dad7b;
    background: #effaf4;
    box-shadow: 0 0 0 2px rgba(47, 157, 104, 0.10);
  }

  .flo-example-icon {
    display: grid;
    width: 37px;
    height: 37px;
    place-items: center;
    border-radius: 12px;
    background: #f0f6f2;
    font-size: 18px;
  }

  .flo-example-card strong,
  .flo-example-card p {
    display: block;
    margin: 0;
  }

  .flo-example-card strong {
    font-size: 12px;
  }

  .flo-example-card p {
    margin-top: 3px;
    color: #758078;
    font-size: 10px;
    line-height: 1.4;
  }

  .flo-example-check {
    display: grid;
    width: 23px;
    height: 23px;
    place-items: center;
    border-radius: 50%;
    background: #f1f5f2;
    color: #6f7a72;
    font-size: 14px;
    font-weight: 900;
  }

  .flo-example-card.is-active .flo-example-check {
    background: #2f9d68;
    color: #fff;
  }

  .flo-example-applied {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-top: 11px;
    padding: 9px 11px;
    border-radius: 11px;
    background: #eaf8f0;
    color: #23633f;
  }

  .flo-example-applied > span {
    font-weight: 900;
  }

  .flo-example-applied p,
  .flo-example-disclaimer {
    margin: 0;
    font-size: 10px;
    line-height: 1.45;
  }

  .flo-example-disclaimer {
    margin-top: 10px;
    color: #7c867f;
  }

  .flo-note-examples {
    padding: 10px 11px;
    border-left: 3px solid #8fcaa8;
    border-radius: 0 11px 11px 0;
    background: #f5faf7;
  }

  .flo-note-examples span,
  .flo-note-examples p {
    display: block;
    margin: 0;
  }

  .flo-note-examples span {
    color: #356047;
    font-size: 10px;
    font-weight: 850;
  }

  .flo-note-examples p {
    margin-top: 3px;
    color: #6c776f;
    font-size: 10px;
    line-height: 1.45;
  }

  .flo-save-reminder {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-top: 17px;
    padding: 12px 14px;
    border: 1px solid #cfe7d8;
    border-radius: 14px;
    background: #f2fbf6;
  }

  .flo-save-reminder > span {
    display: grid;
    width: 25px;
    height: 25px;
    flex: 0 0 25px;
    place-items: center;
    border-radius: 50%;
    background: #d9f2e3;
    color: #1f754c;
    font-weight: 900;
  }

  .flo-save-reminder strong,
  .flo-save-reminder p {
    display: block;
    margin: 0;
  }

  .flo-save-reminder strong {
    color: #2d503a;
    font-size: 12px;
  }

  .flo-save-reminder p {
    margin-top: 3px;
    color: #6b776e;
    font-size: 10px;
    line-height: 1.45;
  }

  .flo-form-grid input:disabled {
    cursor: not-allowed;
    background: #f2f4f2;
    color: #909891;
  }

  .flo-optional-section {
    overflow: hidden;
    border: 1px solid #dfe8e2;
    border-radius: 16px;
    background: #fafcfb;
  }

  .flo-optional-section summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 15px 16px;
    cursor: pointer;
    list-style: none;
    user-select: none;
  }

  .flo-optional-section summary::-webkit-details-marker {
    display: none;
  }

  .flo-optional-summary-copy strong,
  .flo-optional-summary-copy span {
    display: block;
  }

  .flo-optional-summary-copy strong {
    color: #244c35;
    font-size: 14px;
  }

  .flo-optional-summary-copy span {
    margin-top: 3px;
    color: #768078;
    font-size: 11px;
    line-height: 1.4;
  }

  .flo-optional-chevron {
    display: grid;
    width: 30px;
    height: 30px;
    flex: 0 0 30px;
    place-items: center;
    border-radius: 10px;
    background: var(--flo-green-soft);
    color: var(--flo-green-dark);
    font-size: 18px;
    font-weight: 900;
    transition: transform .2s ease;
  }

  .flo-optional-section[open] .flo-optional-chevron {
    transform: rotate(180deg);
  }

  .flo-optional-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    padding: 0 16px 16px;
    border-top: 1px solid #edf1ee;
    padding-top: 16px;
  }

  .flo-optional-grid label {
    display: grid;
    gap: 7px;
  }

  .flo-optional-grid label > span {
    color: #59645c;
    font-size: 12px;
    font-weight: 750;
  }

  .flo-weather-card {
    padding: 16px;
    border: 1px solid #cde6d8;
    border-radius: 18px;
    background:
      radial-gradient(circle at top right, rgba(119, 201, 158, 0.18), transparent 34%),
      linear-gradient(145deg, #f7fcf9, #eef8f2);
  }

  .flo-weather-card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .flo-weather-eyebrow {
    display: block;
    color: var(--flo-green-dark);
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  .flo-weather-card h4 {
    margin: 5px 0 0;
    color: var(--flo-text);
    font-size: 17px;
  }

  .flo-weather-refresh {
    display: inline-flex;
    min-height: 36px;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 8px 12px;
    border: 1px solid #b9dcc8;
    border-radius: 11px;
    background: #ffffff;
    color: var(--flo-green-dark);
    font-size: 12px;
    font-weight: 850;
  }

  .flo-weather-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-top: 14px;
  }

  .flo-weather-grid > div {
    padding: 13px;
    border: 1px solid rgba(173, 213, 190, 0.74);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.86);
  }

  .flo-weather-grid span,
  .flo-weather-grid strong {
    display: block;
  }

  .flo-weather-grid span {
    color: #66726a;
    font-size: 11px;
    font-weight: 750;
  }

  .flo-weather-grid strong {
    margin-top: 5px;
    color: #1d5135;
    font-size: 18px;
  }

  .flo-weather-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-top: 12px;
    color: #68736b;
    font-size: 11px;
  }

  .flo-weather-meta strong {
    color: #344b3d;
  }

  .flo-weather-loading {
    display: flex;
    min-height: 82px;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin-top: 12px;
    border: 1px dashed #bfdbc9;
    border-radius: 14px;
    color: #5f7165;
    background: rgba(255, 255, 255, 0.64);
    font-size: 12px;
    font-weight: 700;
  }

  .flo-loader.small {
    width: 22px;
    height: 22px;
    border-width: 2px;
  }

  .flo-weather-warning {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    margin-top: 12px;
    padding: 10px 12px;
    border: 1px solid #ead9a3;
    border-radius: 12px;
    background: #fff9e8;
    color: #725b16;
  }

  .flo-weather-warning > span {
    display: grid;
    width: 21px;
    height: 21px;
    flex: 0 0 21px;
    place-items: center;
    border-radius: 50%;
    background: #f1d773;
    color: #624b09;
    font-size: 11px;
    font-weight: 900;
  }

  .flo-weather-warning p,
  .flo-weather-help {
    margin: 0;
    line-height: 1.5;
  }

  .flo-weather-warning p {
    font-size: 12px;
  }

  .flo-weather-help {
    margin-top: 12px;
    color: #68736b;
    font-size: 11px;
  }

  .flo-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
  }

  .flo-modal-actions.split {
    justify-content: space-between;
  }

  .flo-button {
    padding: 11px 16px;
    border-radius: 13px;
    font-weight: 800;
  }

  .flo-button.primary {
    border: 1px solid var(--flo-green);
    background: var(--flo-green);
    color: #fff;
  }

  .flo-button.secondary {
    border: 1px solid var(--flo-line);
    background: #fff;
    color: #556158;
  }

  .flo-event-detail {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 14px;
  }

  .flo-event-detail > div,
  .flo-detail-block {
    padding: 13px;
    border: 1px solid var(--flo-line);
    border-radius: 14px;
    background: #fafcfb;
  }

  .flo-event-detail strong {
    display: block;
    margin-top: 4px;
    font-size: 13px;
  }

  .flo-detail-block {
    margin-top: 10px;
  }

  .flo-detail-block strong,
  .flo-detail-block p {
    display: block;
    margin: 5px 0 0;
  }

  .flo-detail-block p {
    color: #5f6962;
    line-height: 1.58;
  }

  @keyframes floSpin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 900px) {
    .flo-two-column,
    .flo-upcoming-list {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 820px) {
    .flo-form-grid {
      grid-template-columns: 1fr;
    }

    .flo-full-field {
      grid-column: 1;
    }
  }

  @media (max-width: 700px) {
    .flo-page {
      padding: 12px;
    }

    .flo-brand h1 {
      font-size: 20px;
    }

    .flo-topbar {
      align-items: flex-start;
      gap: 12px;
    }

    .flo-topbar-copy {
      display: none;
    }

    .flo-topbar-actions {
      gap: 7px;
    }

    .flo-icon-button {
      width: 40px;
      height: 40px;
      border-radius: 13px;
      font-size: 20px;
    }

    .flo-farm-select-card,
    .flo-hero-card {
      align-items: stretch;
      flex-direction: column;
    }

    .flo-farm-select-card select {
      width: 100%;
      min-width: 0;
    }

    .flo-hero-card {
      padding: 22px;
    }

    .flo-progress-ring {
      align-self: center;
    }

    .flo-hero-stats {
      gap: 20px;
    }

    .flo-date-section,
    .flo-panel,
    .flo-month-card {
      padding: 16px;
      border-radius: 20px;
    }

    .flo-date-heading {
      align-items: flex-start;
    }

    .flo-date-heading h3 {
      font-size: 16px;
    }

    .flo-week-control {
      grid-template-columns: 30px minmax(0, 1fr) 30px;
      gap: 5px;
    }

    .flo-week-arrow {
      width: 30px;
      height: 30px;
      font-size: 20px;
    }

    .flo-week-strip {
      gap: 3px;
    }

    .flo-day-button {
      min-height: 66px;
      padding: 4px 2px;
      border-radius: 14px;
    }

    .flo-day-button strong {
      font-size: 16px;
    }

    .flo-insight-card {
      grid-template-columns: 42px minmax(0,1fr);
      padding: 16px;
    }

    .flo-insight-icon {
      width: 42px;
      height: 42px;
      border-radius: 14px;
      font-size: 20px;
    }

    .flo-insight-title-row {
      align-items: flex-start;
      flex-direction: column;
    }

    .flo-monitoring-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .flo-calendar-cell {
      min-height: 55px;
      border-radius: 12px;
    }

    .flo-calendar-legend {
      grid-template-columns: 1fr;
    }

    .flo-form-grid,
    .flo-event-detail,
    .flo-weather-grid,
    .flo-optional-grid,
    .flo-guide-steps,
    .flo-example-grid {
      grid-template-columns: 1fr;
    }

    .flo-example-header {
      align-items: stretch;
      flex-direction: column;
    }

    .flo-example-reset {
      width: 100%;
    }

    .flo-weather-card-header,
    .flo-weather-meta {
      align-items: stretch;
      flex-direction: column;
    }

    .flo-weather-refresh {
      width: 100%;
    }

    .flo-full-field {
      grid-column: auto;
    }

    .flo-modal-actions,
    .flo-modal-actions.split {
      flex-direction: column-reverse;
    }

    .flo-button {
      width: 100%;
    }
  }

  @media (max-width: 430px) {
    .flo-page {
      padding: 8px;
    }

    .flo-week-strip {
      overflow-x: auto;
      grid-template-columns: repeat(7, 48px);
      scrollbar-width: none;
    }

    .flo-week-strip::-webkit-scrollbar {
      display: none;
    }

    .flo-hero-content h2 span {
      font-size: 36px;
    }

    .flo-hero-stats {
      flex-direction: column;
      gap: 10px;
    }
  }

  /* =====================================================
     WEB DESKTOP OVERRIDE
     Mengisi seluruh area setelah sidebar PetaniLayout.
  ===================================================== */
  .flo-page {
    width: 100%;
    min-width: 0;
    padding: 24px 28px 56px;
    overflow-x: hidden;
  }

  .flo-shell.flo-shell-desktop {
    width: 100%;
    max-width: none;
    margin: 0;
  }

  .flo-topbar-actions {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .flo-topbar-copy {
    text-align: right;
  }

  .flo-topbar-copy span,
  .flo-topbar-copy strong {
    display: block;
  }

  .flo-topbar-copy span {
    color: var(--flo-muted);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .06em;
    text-transform: uppercase;
  }

  .flo-topbar-copy strong {
    margin-top: 3px;
    color: var(--flo-text);
    font-size: 13px;
  }

  .flo-farm-toolbar {
    display: flex;
    align-items: center;
    gap: 22px;
  }

  .flo-farm-location span,
  .flo-farm-location strong {
    display: block;
  }

  .flo-farm-location span {
    color: var(--flo-muted);
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .flo-farm-location strong {
    margin-top: 3px;
    font-size: 13px;
  }

  .flo-desktop-overview {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(430px, .85fr);
    gap: 20px;
    align-items: stretch;
    margin-bottom: 20px;
  }

  .flo-desktop-overview .flo-hero-card,
  .flo-desktop-overview .flo-date-section {
    height: 100%;
    margin-bottom: 0;
  }

  .flo-overview-side {
    display: grid;
    grid-template-rows: auto 1fr;
    gap: 16px;
    min-width: 0;
  }

  .flo-cycle-summary {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    padding: 16px;
    border: 1px solid var(--flo-line);
    border-radius: 22px;
    background: rgba(255,255,255,.94);
    box-shadow: var(--flo-shadow);
  }

  .flo-cycle-summary > div {
    padding: 13px;
    border: 1px solid #edf0ed;
    border-radius: 15px;
    background: #fafcfb;
  }

  .flo-cycle-summary span,
  .flo-cycle-summary strong {
    display: block;
  }

  .flo-cycle-summary span {
    color: var(--flo-muted);
    font-size: 11px;
    font-weight: 750;
  }

  .flo-cycle-summary strong {
    margin-top: 5px;
    font-size: 16px;
  }

  .flo-cycle-summary > div.has-overdue {
    border-color: #efc0b7;
    background: #fff5f2;
  }

  .flo-cycle-summary > div.has-overdue strong {
    color: #a33f32;
  }

  .flo-desktop-workspace {
    display: grid;
    grid-template-columns: minmax(0, 1.62fr) minmax(380px, .78fr);
    gap: 20px;
    align-items: start;
  }

  .flo-desktop-primary,
  .flo-desktop-aside {
    display: grid;
    gap: 20px;
    min-width: 0;
  }

  .flo-desktop-primary .flo-insight-card,
  .flo-desktop-primary .flo-month-card,
  .flo-desktop-aside .flo-panel {
    margin-bottom: 0;
  }

  .flo-desktop-aside {
    position: sticky;
    top: 20px;
  }

  .flo-month-card-desktop {
    padding: 22px;
  }

  .flo-calendar-grid-desktop {
    gap: 8px;
  }

  .flo-calendar-cell.flo-calendar-cell-desktop {
    display: flex;
    min-height: 126px;
    padding: 10px;
    align-items: stretch;
    justify-content: flex-start;
    flex-direction: column;
    gap: 8px;
    text-align: left;
  }

  .flo-cell-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .flo-cell-head > span {
    font-size: 14px;
    font-weight: 900;
  }

  .flo-cell-head > small {
    display: grid;
    width: 22px;
    height: 22px;
    place-items: center;
    border-radius: 999px;
    background: var(--flo-green-soft);
    color: var(--flo-green-dark);
    font-size: 10px;
    font-weight: 900;
  }

  .flo-calendar-cell.is-active .flo-cell-head > small {
    background: rgba(255,255,255,.2);
    color: #fff;
  }

  .flo-cell-event-list {
    display: grid;
    gap: 5px;
    min-width: 0;
  }

  .flo-cell-event-list > span {
    display: grid;
    grid-template-columns: 6px minmax(0, 1fr) 19px;
    min-width: 0;
    align-items: center;
    gap: 6px;
    min-height: 33px;
    padding: 5px 6px;
    overflow: hidden;
    border: 1px solid;
    border-radius: 9px;
    font-size: 10px;
    font-weight: 750;
    line-height: 1.2;
  }

  .flo-cell-event-list > span.source-adaptif {
    box-shadow: inset 3px 0 #e0aa2d;
  }

  .flo-cell-event-list > span.is-selesai {
    opacity: .67;
  }

  .flo-cell-event-list > span.is-terlambat {
    box-shadow: inset 3px 0 #cf5c4d;
  }

  .flo-cell-event-list > span > i {
    width: 6px;
    height: 6px;
    flex: 0 0 6px;
    border-radius: 999px;
  }

  .flo-cell-event-list > span > b {
    display: -webkit-box;
    min-width: 0;
    overflow: hidden;
    font-size: 10px;
    font-weight: 780;
    line-height: 1.25;
    white-space: normal;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .flo-cell-event-list > span > small {
    display: grid;
    width: 19px;
    height: 19px;
    place-items: center;
    border: 1px solid;
    border-radius: 50%;
    font-size: 9px;
    font-weight: 900;
  }

  .flo-calendar-cell.is-active .flo-cell-event-list > span {
    border-color: rgba(255,255,255,.28) !important;
    background: rgba(255,255,255,.14) !important;
    color: #fff !important;
  }

  .flo-calendar-cell.is-active .flo-cell-event-list > span i {
    background: #fff !important;
  }

  .flo-calendar-cell.is-active .flo-cell-event-list > span > small {
    border-color: rgba(255,255,255,.4) !important;
    background: rgba(255,255,255,.16) !important;
    color: #fff !important;
  }

  .flo-cell-event-list > em {
    color: var(--flo-muted);
    font-size: 10px;
    font-style: normal;
    font-weight: 700;
  }

  .flo-calendar-cell.is-active .flo-cell-event-list > em {
    color: rgba(255,255,255,.78);
  }

  .flo-upcoming-list-sidebar {
    grid-template-columns: 1fr;
  }

  .flo-result-modal {
    width: min(700px, 100%);
  }

  .flo-result-status {
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr) auto;
    gap: 14px;
    align-items: flex-start;
    margin-bottom: 18px;
    padding: 18px;
    border: 1px solid;
    border-radius: 18px;
  }

  .flo-result-status.is-normal {
    border-color: #b8e6ca;
    background: #effbf4;
    color: #17633c;
  }

  .flo-result-status.is-warning {
    border-color: #f2bdb4;
    background: #fff1ee;
    color: #98382d;
  }

  .flo-result-status-icon {
    display: grid;
    width: 48px;
    height: 48px;
    place-items: center;
    border-radius: 15px;
    background: rgba(255, 255, 255, 0.82);
    font-size: 24px;
    font-weight: 900;
  }

  .flo-result-status-copy {
    min-width: 0;
  }

  .flo-result-status-copy > span {
    display: block;
    margin-bottom: 4px;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .flo-result-status-copy h4 {
    margin: 0 0 7px;
    color: currentColor;
    font-size: 18px;
  }

  .flo-result-status-copy p {
    margin: 0;
    color: #56625b;
    font-size: 13px;
    line-height: 1.6;
  }

  .flo-result-priority {
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.82);
    font-size: 10px;
    white-space: nowrap;
    text-transform: uppercase;
  }

  .flo-result-section {
    margin-bottom: 18px;
  }

  .flo-result-label {
    display: block;
    margin-bottom: 9px;
    color: #6f7972;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .08em;
    text-transform: uppercase;
  }

  .flo-result-problem-list {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .flo-result-problem-list li {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 11px 12px;
    border: 1px solid #f0d1ca;
    border-radius: 13px;
    background: #fff8f6;
  }

  .flo-result-problem-list li > span {
    display: grid;
    width: 24px;
    height: 24px;
    flex: 0 0 24px;
    place-items: center;
    border-radius: 50%;
    background: #f6d8d2;
    color: #9b392d;
    font-size: 11px;
    font-weight: 900;
  }

  .flo-result-problem-list p {
    margin: 2px 0 0;
    color: #4e5952;
    font-size: 12px;
    line-height: 1.5;
  }

  .flo-result-recommendation {
    display: flex;
    gap: 12px;
    padding: 15px;
    border: 1px solid #dce8df;
    border-radius: 15px;
    background: #f8fbf9;
  }

  .flo-result-recommendation > span {
    font-size: 20px;
  }

  .flo-result-recommendation p {
    margin: 0;
    color: #304139;
    font-size: 13px;
    font-weight: 650;
    line-height: 1.65;
  }

  .flo-result-section-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 10px;
  }

  .flo-result-section-heading .flo-result-label {
    margin-bottom: 0;
  }

  .flo-result-section-heading p {
    margin: 3px 0 0;
    color: #7a847d;
    font-size: 12px;
  }

  .flo-result-section-heading > strong {
    display: grid;
    min-width: 30px;
    height: 30px;
    place-items: center;
    border-radius: 50%;
    background: #eaf7f0;
    color: #237d52;
  }

  .flo-result-schedule-list {
    display: grid;
    gap: 9px;
  }

  .flo-result-schedule-list > button {
    display: grid;
    grid-template-columns: 43px 42px minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    width: 100%;
    padding: 10px;
    border: 1px solid #e3e8e4;
    border-radius: 14px;
    background: #fff;
    text-align: left;
  }

  .flo-result-schedule-list > button:hover {
    border-color: #b9d9c6;
    background: #fbfefc;
  }

  .flo-result-schedule-date {
    display: grid;
    min-height: 43px;
    place-items: center;
    border-radius: 11px;
    background: #f4f7f5;
  }

  .flo-result-schedule-date strong {
    font-size: 15px;
  }

  .flo-result-schedule-date span {
    color: #7b857e;
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .flo-result-schedule-icon {
    display: grid;
    width: 40px;
    height: 40px;
    place-items: center;
    border: 1px solid;
    border-radius: 12px;
  }

  .flo-result-schedule-copy {
    min-width: 0;
  }

  .flo-result-schedule-copy span,
  .flo-result-schedule-copy strong {
    display: block;
  }

  .flo-result-schedule-copy span {
    margin-bottom: 3px;
    color: #8a938d;
    font-size: 10px;
  }

  .flo-result-schedule-copy strong {
    overflow: hidden;
    color: #26352d;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .flo-result-empty {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 15px;
    border: 1px solid #bde4cb;
    border-radius: 14px;
    background: #effbf4;
  }

  .flo-result-empty.is-compact {
    padding: 12px;
  }

  .flo-result-empty > span {
    display: grid;
    width: 38px;
    height: 38px;
    flex: 0 0 38px;
    place-items: center;
    border-radius: 50%;
    background: #d9f2e3;
    color: #237d52;
    font-weight: 900;
  }

  .flo-result-empty strong,
  .flo-result-empty p {
    display: block;
    margin: 0;
  }

  .flo-result-empty p {
    margin-top: 3px;
    color: #68736c;
    font-size: 12px;
  }

  @media (max-width: 1280px) {
    .flo-desktop-overview,
    .flo-desktop-workspace {
      grid-template-columns: 1fr;
    }

    .flo-overview-side {
      grid-template-columns: 1.4fr .8fr;
      grid-template-rows: none;
    }

    .flo-desktop-aside {
      position: static;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .flo-desktop-aside .flo-upcoming-panel {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 900px) {
    .flo-result-status {
      grid-template-columns: 44px minmax(0, 1fr);
    }

    .flo-result-priority {
      grid-column: 1 / -1;
      justify-self: flex-start;
    }

    .flo-result-schedule-list > button {
      grid-template-columns: 40px 38px minmax(0, 1fr) auto;
    }

    .flo-page {
      padding: 16px;
    }

    .flo-overview-side,
    .flo-desktop-aside,
    .flo-farm-toolbar {
      grid-template-columns: 1fr;
      flex-direction: column;
      align-items: stretch;
    }

    .flo-farm-location {
      display: none;
    }

    .flo-calendar-cell.flo-calendar-cell-desktop {
      min-height: 74px;
      padding: 7px;
    }

    .flo-cell-event-list > span,
    .flo-cell-event-list > em {
      display: none;
    }
  }

`;
