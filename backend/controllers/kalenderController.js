"use strict";

const db = require("../config/db");
const util = require("util");
const axios = require("axios");

const query = util.promisify(db.query).bind(db);

// =====================================================
// UTILITAS DASAR
// =====================================================
const isEmpty = (value) =>
  value === undefined || value === null || String(value).trim() === "";

const pad2 = (value) => String(value).padStart(2, "0");

const parseDateOnly = (value) => {
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
  const date = parseDateOnly(value);
  if (!date) return null;

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate()
  )}`;
};

const addDaysFromDate = (value, totalDays) => {
  const date = parseDateOnly(value);
  if (!date) return null;

  date.setDate(date.getDate() + Number(totalDays || 0));
  return toDateKey(date);
};

const diffDays = (startValue, endValue) => {
  const start = parseDateOnly(startValue);
  const end = parseDateOnly(endValue);

  if (!start || !end) return null;

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return Math.round((end.getTime() - start.getTime()) / 86400000);
};

const safeNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === "") return fallback;

  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : fallback;
};

const normalizeText = (value) => String(value || "").trim().toLowerCase();

const normalizeToken = (value) =>
  normalizeText(value)
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");

const normalizeDateField = (value) => {
  if (value === undefined || value === null || value === "") return null;
  return toDateKey(value);
};

const serializeMonitoring = (row) => {
  if (!row) return null;

  return {
    ...row,
    tanggal: normalizeDateField(row.tanggal),
  };
};

const serializeCalendarRow = (row) => {
  if (!row) return null;

  return {
    ...row,
    tanggal: normalizeDateField(row.tanggal),
    tanggal_awal: normalizeDateField(row.tanggal_awal),
    tanggal_rekomendasi: normalizeDateField(row.tanggal_rekomendasi),
    tanggal_aktual: normalizeDateField(row.tanggal_aktual),
    tanggal_tanam: normalizeDateField(row.tanggal_tanam),
  };
};

const serializeCalendarRows = (rows) =>
  (Array.isArray(rows) ? rows : []).map(serializeCalendarRow);

const normalizeMonth = (value, fallbackDate) => {
  const text = String(value || "").trim();

  if (/^\d{4}-\d{2}$/.test(text)) return text;

  const fallback = parseDateOnly(fallbackDate) || new Date();
  return `${fallback.getFullYear()}-${pad2(fallback.getMonth() + 1)}`;
};

const getMonthRange = (monthValue, fallbackDate) => {
  const month = normalizeMonth(monthValue, fallbackDate);
  const [year, monthNumber] = month.split("-").map(Number);
  const start = `${year}-${pad2(monthNumber)}-01`;
  const endDate = new Date(year, monthNumber, 0);
  const end = toDateKey(endDate);

  return { month, start, end };
};

const resolveUserId = (req) =>
  req.user?.id ||
  req.user?.user_id ||
  req.user?.petani_id ||
  req.body?.user_id ||
  req.body?.petani_id ||
  req.query?.user_id ||
  req.query?.petani_id ||
  req.query?.id_user ||
  null;

const sameId = (left, right) => String(left) === String(right);

const getOwnerId = (lahan) => lahan?.user_id || lahan?.petani_id || null;

const formatKgHa = (value) => {
  if (isEmpty(value)) return null;
  return `${Number(safeNumber(value).toFixed(2))} Kg/Ha`;
};

const formatTotalKg = (dosePerHa, areaHa) => {
  if (isEmpty(dosePerHa) || isEmpty(areaHa)) return null;

  const total = safeNumber(dosePerHa) * safeNumber(areaHa);
  return `${Number(total.toFixed(2))} Kg`;
};

const getFaseTanaman = (hariKe, harvestAge = 110) => {
  const day = Number(hariKe);
  const safeHarvestAge = Math.max(90, safeNumber(harvestAge, 110));

  if (!Number.isFinite(day) || day < 0) return null;
  if (day >= safeHarvestAge) return "panen";
  if (day <= 21) return "vegetatif_awal";
  if (day <= 55) return "vegetatif_akhir";
  if (day <= 90) return "generatif";
  return "pematangan";
};

const getLabelFase = (phase) => {
  const labels = {
    vegetatif_awal: "Vegetatif Awal",
    vegetatif_akhir: "Vegetatif Akhir",
    generatif: "Generatif",
    pematangan: "Pematangan",
    panen: "Panen",
  };

  return labels[phase] || "-";
};

const getExpectedHeight = (age) => {
  const day = Number(age);

  if (!Number.isFinite(day) || day < 0) return null;
  if (day <= 7) return 10;
  if (day <= 14) return 18;
  if (day <= 21) return 28;
  if (day <= 30) return 40;
  if (day <= 45) return 60;
  if (day <= 60) return 78;
  if (day <= 80) return 92;
  if (day <= 100) return 100;
  return 105;
};

const getLahanAreaHa = (lahan) =>
  safeNumber(lahan?.luas_ha, safeNumber(lahan?.luas_m2) / 10000);

const getHarvestAge = (lahan) =>
  Math.max(90, safeNumber(lahan?.umur_panen_hari || lahan?.umur_panen, 110));

const getCycleProgress = (hst, harvestAge) => {
  if (!Number.isFinite(Number(hst)) || Number(hst) < 0) return 0;
  if (!Number.isFinite(Number(harvestAge)) || Number(harvestAge) <= 0) return 0;

  return Number(Math.min(100, (Number(hst) / Number(harvestAge)) * 100).toFixed(2));
};

const sendError = (res, statusCode, message, error = null) => {
  if (error) console.error(message, error);

  return res.status(statusCode).json({
    status: false,
    message,
  });
};


// =====================================================
// UTILITAS CUACA OPEN-METEO
// =====================================================
const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_TIMEOUT_MS = 10000;

const isValidLatitude = (value) =>
  Number.isFinite(Number(value)) &&
  Number(value) >= -90 &&
  Number(value) <= 90;

const isValidLongitude = (value) =>
  Number.isFinite(Number(value)) &&
  Number(value) >= -180 &&
  Number(value) <= 180;

const getWeatherConditionLabel = (weatherCode, precipitation = 0) => {
  const code = Number(weatherCode);
  const rain = safeNumber(precipitation, 0);

  if (code === 0) return "Cerah";
  if ([1, 2].includes(code)) return "Cerah berawan";
  if (code === 3) return "Berawan";
  if ([45, 48].includes(code)) return "Berkabut";
  if ([51, 53, 55].includes(code)) return "Gerimis";
  if ([56, 57].includes(code)) return "Gerimis beku";
  if ([61, 63].includes(code)) return "Hujan ringan";
  if (code === 65) return "Hujan lebat";
  if ([66, 67].includes(code)) return "Hujan beku";
  if ([71, 73].includes(code)) return "Salju ringan";
  if (code === 75) return "Salju lebat";
  if (code === 77) return "Butiran salju";
  if ([80, 81].includes(code)) return "Hujan lokal";
  if (code === 82) return "Hujan lokal lebat";
  if ([85, 86].includes(code)) return "Hujan salju";
  if (code === 95) return "Badai petir";
  if ([96, 99].includes(code)) return "Badai petir disertai hujan es";

  if (rain > 0 && rain < 2.5) return "Hujan ringan";
  if (rain >= 2.5 && rain < 7.6) return "Hujan sedang";
  if (rain >= 7.6) return "Hujan lebat";

  return "Kondisi cuaca tidak diketahui";
};

const formatUtcOffset = (offsetSeconds) => {
  const seconds = Number(offsetSeconds);

  if (!Number.isFinite(seconds)) return "+07:00";

  const sign = seconds >= 0 ? "+" : "-";
  const absolute = Math.abs(seconds);
  const hours = Math.floor(absolute / 3600);
  const minutes = Math.floor((absolute % 3600) / 60);

  return `${sign}${pad2(hours)}:${pad2(minutes)}`;
};

const formatWeatherTime = (value, offsetSeconds) => {
  if (!value) return null;

  let text = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) {
    text = `${text}:00`;
  }

  if (/[zZ]$/.test(text) || /[+-]\d{2}:\d{2}$/.test(text)) {
    return text;
  }

  return `${text}${formatUtcOffset(offsetSeconds)}`;
};

const unavailableWeatherPayload = (message = "Data cuaca belum tersedia") => ({
  status: true,
  message,
  data: {
    suhu: null,
    kelembapan: null,
    curah_hujan: null,
    kondisi: "Data cuaca belum tersedia",
    sumber: "unavailable",
  },
});

// =====================================================
// NOTIFIKASI
// =====================================================
const formatTanggalIndonesia = (value) => {
  const date = parseDateOnly(value);
  if (!date) return "tanggal yang dipilih";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const buildCalendarLink = ({
  calendarId = null,
  lahanId = null,
  date = null,
  monitoringId = null,
}) => {
  const params = new URLSearchParams();

  if (calendarId) params.set("event_id", String(calendarId));
  if (lahanId) params.set("lahan_id", String(lahanId));
  if (date) params.set("tanggal", toDateKey(date) || String(date).slice(0, 10));
  if (monitoringId) params.set("monitoring_id", String(monitoringId));

  const queryString = params.toString();
  return queryString
    ? `/petani/kalender?${queryString}`
    : "/petani/kalender";
};

const normalizePriority = (value, fallback = "rendah") => {
  const priority = normalizeText(value);
  return ["tinggi", "sedang", "rendah"].includes(priority)
    ? priority
    : fallback;
};

const getNotificationTitle = (title, priority) => {
  const cleanTitle = String(title || "Kondisi Tanaman").trim();

  if (priority === "tinggi") {
    return `Peringatan: ${cleanTitle}`;
  }

  if (priority === "sedang") {
    return `Perlu Dipantau: ${cleanTitle}`;
  }

  return cleanTitle;
};

const insertNotification = async ({
  userId,
  calendarId = null,
  monitoringId = null,
  lahanId = null,
  title,
  message,
  type = "informasi",
  priority = "rendah",
  targetUrl = "/petani/kalender",
  role = "petani",
  refreshExisting = false,
}) => {
  if (!userId || !title) return null;

  const normalizedType = normalizeText(type) || "informasi";
  const normalizedPriority = normalizePriority(priority);
  const finalTargetUrl = targetUrl || "/petani/kalender";

  const existingRows = await query(
    `
      SELECT id
      FROM notifikasi
      WHERE user_id = ?
        AND role = ?
        AND judul = ?
        AND COALESCE(target_url, link, '') = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [userId, role, title, finalTargetUrl]
  );

  const existing = existingRows[0] || null;

  if (existing) {
    if (refreshExisting) {
      await query(
        `
          UPDATE notifikasi
          SET
            kalender_id = ?,
            monitoring_id = ?,
            lahan_id = ?,
            pesan = ?,
            jenis = ?,
            tingkat = ?,
            link = ?,
            target_url = ?,
            is_read = 0,
            read_at = NULL,
            created_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [
          calendarId,
          monitoringId,
          lahanId,
          message || "",
          normalizedType,
          normalizedPriority,
          finalTargetUrl,
          finalTargetUrl,
          existing.id,
        ]
      );
    }

    return {
      id: Number(existing.id),
      created: false,
      refreshed: Boolean(refreshExisting),
    };
  }

  const result = await query(
    `
      INSERT INTO notifikasi
      (
        user_id,
        kalender_id,
        monitoring_id,
        lahan_id,
        role,
        judul,
        pesan,
        jenis,
        tingkat,
        link,
        target_url,
        is_read,
        read_at,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, CURRENT_TIMESTAMP)
    `,
    [
      userId,
      calendarId,
      monitoringId,
      lahanId,
      role,
      title,
      message || "",
      normalizedType,
      normalizedPriority,
      finalTargetUrl,
      finalTargetUrl,
    ]
  );

  return {
    id: Number(result.insertId),
    created: true,
    refreshed: false,
  };
};

const deleteNotificationsByMonitoringId = async ({ userId, monitoringId }) => {
  if (!userId || !monitoringId) return 0;

  const result = await query(
    `
      DELETE FROM notifikasi
      WHERE user_id = ?
        AND role = 'petani'
        AND monitoring_id = ?
    `,
    [userId, monitoringId]
  );

  return Number(result.affectedRows || 0);
};

const deleteNotificationsByCalendarIds = async ({ userId, calendarIds }) => {
  const ids = (Array.isArray(calendarIds) ? calendarIds : [])
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  if (!userId || ids.length === 0) return 0;

  const placeholders = ids.map(() => "?").join(",");
  const result = await query(
    `
      DELETE FROM notifikasi
      WHERE user_id = ?
        AND role = 'petani'
        AND kalender_id IN (${placeholders})
    `,
    [userId, ...ids]
  );

  return Number(result.affectedRows || 0);
};

const createInsightNotification = async ({
  userId,
  lahan,
  insight,
  date,
  monitoringId = null,
  calendarId = null,
  refreshExisting = false,
}) => {
  if (!userId || !lahan || !insight) return null;

  const priority = normalizePriority(insight.prioritas, "rendah");
  const type = ["tinggi", "sedang"].includes(priority)
    ? "peringatan"
    : "informasi";
  const title = getNotificationTitle(insight.judul, priority);
  const message = [
    insight.ringkasan,
    insight.rekomendasi
      ? `Tindak lanjut: ${insight.rekomendasi}`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
  const targetUrl = buildCalendarLink({
    calendarId,
    lahanId: lahan.id,
    date,
    monitoringId,
  });

  return insertNotification({
    userId,
    calendarId,
    monitoringId,
    lahanId: lahan.id,
    title,
    message,
    type,
    priority,
    targetUrl,
    refreshExisting,
  });
};

const createAdaptiveActivityNotifications = async ({
  userId,
  lahan,
  monitoring,
  insight,
  activities,
  refreshExisting = false,
}) => {
  if (!userId || !lahan || !monitoring) return [];

  const uniqueActivities = Array.from(
    new Map(
      (Array.isArray(activities) ? activities : [])
        .filter((item) => item?.id)
        .map((item) => [String(item.id), item])
    ).values()
  );

  const notifications = [];

  for (const activity of uniqueActivities) {
    const priority = normalizePriority(activity.prioritas, "sedang");
    const type = ["tinggi", "sedang"].includes(priority)
      ? "peringatan"
      : "jadwal";
    const title = getNotificationTitle(activity.nama_kegiatan, priority);
    const dateLabel = formatTanggalIndonesia(activity.tanggal);
    const timeLabel = String(activity.waktu || "08:00").slice(0, 5);
    const condition =
      insight?.ringkasan ||
      activity.catatan ||
      "Hasil monitoring menunjukkan kondisi yang perlu ditindaklanjuti.";
    const action =
      activity.metode || "Laksanakan kegiatan sesuai kondisi lahan.";
    const message = `${condition} Jadwal tindak lanjut pada ${dateLabel} pukul ${timeLabel}. ${action}`;
    const targetUrl = buildCalendarLink({
      calendarId: activity.id,
      lahanId: lahan.id,
      date: activity.tanggal,
      monitoringId: monitoring.id,
    });

    const notification = await insertNotification({
      userId,
      calendarId: activity.id,
      monitoringId: monitoring.id,
      lahanId: lahan.id,
      title,
      message,
      type,
      priority,
      targetUrl,
      refreshExisting,
    });

    if (notification) {
      notifications.push({
        ...notification,
        kalender_id: Number(activity.id),
        monitoring_id: Number(monitoring.id),
      });
    }
  }

  return notifications;
};

// =====================================================
// DATA LAHAN, KEGIATAN, DAN MONITORING
// =====================================================
const getLahanById = async (lahanId, userId = null) => {
  const rows = await query(
    `
      SELECT
        l.*,
        DATE_FORMAT(l.tanggal_tanam, '%Y-%m-%d') AS tanggal_tanam,
        k.nama_kecamatan,
        d.nama_desa
      FROM lahan l
      LEFT JOIN kecamatan k ON k.id = l.kecamatan_id
      LEFT JOIN desa d ON d.id = l.desa_id
      WHERE l.id = ?
      LIMIT 1
    `,
    [lahanId]
  );

  const lahan = rows[0] || null;
  if (!lahan) return null;

  if (userId) {
    const ownerIds = [lahan?.user_id, lahan?.petani_id].filter(Boolean);

    if (
      ownerIds.length === 0 ||
      !ownerIds.some((value) => sameId(value, userId))
    ) {
      return null;
    }
  }

  return lahan;
};

const getCalendarItemById = async (id, userId = null) => {
  const rows = await query(
    `
      SELECT
        kb.*,
        DATE_FORMAT(kb.tanggal, '%Y-%m-%d') AS tanggal,
        DATE_FORMAT(kb.tanggal_awal, '%Y-%m-%d') AS tanggal_awal,
        DATE_FORMAT(kb.tanggal_rekomendasi, '%Y-%m-%d') AS tanggal_rekomendasi,
        DATE_FORMAT(kb.tanggal_aktual, '%Y-%m-%d') AS tanggal_aktual,
        DATE_FORMAT(l.tanggal_tanam, '%Y-%m-%d') AS tanggal_tanam,
        l.user_id AS lahan_user_id,
        l.petani_id AS lahan_petani_id
      FROM kalender_budidaya kb
      INNER JOIN lahan l ON l.id = kb.lahan_id
      WHERE kb.id = ?
      LIMIT 1
    `,
    [id]
  );

  const item = rows[0] || null;
  if (!item) return null;

  if (userId) {
    const permitted = [
      item.user_id,
      item.lahan_user_id,
      item.lahan_petani_id,
    ]
      .filter(Boolean)
      .some((value) => sameId(value, userId));

    if (!permitted) return null;
  }

  return serializeCalendarRow(item);
};

const getMonitoringByDate = async (lahanId, date) => {
  if (!date) return null;

  const rows = await query(
    `
      SELECT
        mh.*,
        DATE_FORMAT(mh.tanggal, '%Y-%m-%d') AS tanggal
      FROM monitoring_harian mh
      WHERE mh.lahan_id = ?
        AND mh.tanggal = ?
      ORDER BY mh.id DESC
      LIMIT 1
    `,
    [lahanId, date]
  );

  return serializeMonitoring(rows[0] || null);
};

const getLatestMonitoring = async (lahanId, untilDate = null) => {
  const params = [lahanId];
  let dateClause = "";

  if (untilDate) {
    dateClause = "AND mh.tanggal <= ?";
    params.push(untilDate);
  }

  const rows = await query(
    `
      SELECT
        mh.*,
        DATE_FORMAT(mh.tanggal, '%Y-%m-%d') AS tanggal
      FROM monitoring_harian mh
      WHERE mh.lahan_id = ?
      ${dateClause}
      ORDER BY mh.tanggal DESC, mh.id DESC
      LIMIT 1
    `,
    params
  );

  return serializeMonitoring(rows[0] || null);
};

const getCalendarRowsByLahan = async (
  lahanId,
  startDate = null,
  endDate = null
) => {
  const params = [lahanId];
  let dateClause = "";

  if (startDate && endDate) {
    dateClause = "AND kb.tanggal BETWEEN ? AND ?";
    params.push(startDate, endDate);
  }

  const rows = await query(
    `
      SELECT
        kb.*,
        DATE_FORMAT(kb.tanggal, '%Y-%m-%d') AS tanggal,
        DATE_FORMAT(kb.tanggal_awal, '%Y-%m-%d') AS tanggal_awal,
        DATE_FORMAT(kb.tanggal_rekomendasi, '%Y-%m-%d') AS tanggal_rekomendasi,
        DATE_FORMAT(kb.tanggal_aktual, '%Y-%m-%d') AS tanggal_aktual,
        DATE_FORMAT(l.tanggal_tanam, '%Y-%m-%d') AS tanggal_tanam,
        l.nama_lahan,
        l.varietas,
        l.luas_ha,
        l.luas_m2,
        l.lat,
        l.lng,
        k.nama_kecamatan,
        d.nama_desa
      FROM kalender_budidaya kb
      LEFT JOIN lahan l ON l.id = kb.lahan_id
      LEFT JOIN kecamatan k ON k.id = l.kecamatan_id
      LEFT JOIN desa d ON d.id = l.desa_id
      WHERE kb.lahan_id = ?
      ${dateClause}
      ORDER BY kb.tanggal ASC, kb.waktu ASC, kb.hari_ke ASC, kb.id ASC
    `,
    params
  );

  return serializeCalendarRows(rows);
};

// =====================================================
// INSIGHT DAN REKOMENDASI HARIAN
// =====================================================
const buildPhaseInsight = (lahan, selectedDate) => {
  const hst = diffDays(lahan?.tanggal_tanam, selectedDate || new Date());
  const harvestAge = getHarvestAge(lahan);
  const phase = getFaseTanaman(hst, harvestAge);
  const phaseLabel = getLabelFase(phase);

  if (hst === null) {
    return {
      status: "gagal",
      prioritas: "rendah",
      judul: "Tanggal Tanam Belum Tersedia",
      hst: null,
      fase: null,
      fase_label: "-",
      ringkasan: "Sistem belum dapat menghitung umur tanaman.",
      rekomendasi: "Lengkapi tanggal tanam pada data lahan.",
    };
  }

  if (hst < 0) {
    return {
      status: "sebelum_tanam",
      prioritas: "rendah",
      judul: "Belum Memasuki Masa Tanam",
      hst,
      fase: null,
      fase_label: "Belum Tanam",
      ringkasan: "Tanggal yang dipilih berada sebelum tanggal tanam.",
      rekomendasi: "Pilih tanggal setelah penanaman untuk melihat arahan budidaya.",
    };
  }

  if (hst >= harvestAge) {
    return {
      status: "panen",
      prioritas: "tinggi",
      judul: "Catat Hasil Panen Aktual",
      hst,
      fase: "panen",
      fase_label: getLabelFase("panen"),
      ringkasan: `Tanaman telah mencapai HST ${hst} dan memasuki periode panen atau pascapanen.`,
      rekomendasi:
        "Catat tanggal panen, hasil panen aktual, luas panen, kualitas gabah, dan kendala panen.",
    };
  }

  if (hst <= 14) {
    return {
      status: "rekomendasi_dasar",
      prioritas: "sedang",
      judul: "Pantau Adaptasi Tanaman",
      hst,
      fase: phase,
      fase_label: phaseLabel,
      ringkasan: `Tanaman berada pada HST ${hst} dan sedang beradaptasi setelah tanam.`,
      rekomendasi:
        "Periksa bibit mati, perubahan warna daun, kondisi air, dan tanda awal serangan hama.",
    };
  }

  if (hst <= 30) {
    return {
      status: "rekomendasi_dasar",
      prioritas: "sedang",
      judul: "Pantau Pembentukan Anakan",
      hst,
      fase: phase,
      fase_label: phaseLabel,
      ringkasan: `Tanaman berada pada HST ${hst} dan sedang membentuk anakan.`,
      rekomendasi:
        "Periksa pemerataan pertumbuhan, kepadatan anakan, warna daun, gulma, dan ketersediaan air.",
    };
  }

  if (hst <= 55) {
    return {
      status: "rekomendasi_dasar",
      prioritas: "sedang",
      judul: "Jaga Pertumbuhan Vegetatif",
      hst,
      fase: phase,
      fase_label: phaseLabel,
      ringkasan: `Tanaman berada pada HST ${hst} fase ${phaseLabel}.`,
      rekomendasi:
        "Pantau anakan, gulma, kondisi air, warna daun, dan tanda kekurangan unsur hara.",
    };
  }

  if (hst <= 90) {
    return {
      status: "rekomendasi_dasar",
      prioritas: "sedang",
      judul: "Pantau Pembentukan Malai",
      hst,
      fase: phase,
      fase_label: phaseLabel,
      ringkasan: `Tanaman berada pada HST ${hst} dan memasuki pembentukan malai serta pengisian bulir.`,
      rekomendasi:
        "Periksa malai, anakan produktif, kondisi air, kesehatan daun, serta hama dan penyakit.",
    };
  }

  return {
    status: "rekomendasi_dasar",
    prioritas: "tinggi",
    judul: "Persiapkan Masa Panen",
    hst,
    fase: phase,
    fase_label: phaseLabel,
    ringkasan: `Tanaman berada pada HST ${hst} dan memasuki tahap pematangan.`,
    rekomendasi:
      "Periksa warna malai, kemasakan bulir, tanaman rebah, cuaca, dan kesiapan alat panen.",
  };
};

const buildDailyInsight = (lahan, monitoring, selectedDate) => {
  if (!lahan) {
    return {
      status: "gagal",
      prioritas: "rendah",
      judul: "Data Lahan Tidak Ditemukan",
      ringkasan: "Data lahan tidak ditemukan.",
      rekomendasi: "Periksa kembali data lahan.",
    };
  }

  const baseInsight = buildPhaseInsight(lahan, selectedDate);

  if (!monitoring) {
    return {
      ...baseInsight,
      sumber: "fase_tanaman",
      memiliki_monitoring: false,
    };
  }

  const hst = diffDays(lahan.tanggal_tanam, selectedDate || monitoring.tanggal);
  const harvestAge = getHarvestAge(lahan);
  const phase = getFaseTanaman(hst, harvestAge);
  const notes = [];
  const recommendations = [];
  const expectedHeight = getExpectedHeight(hst);
  const actualHeight = safeNumber(monitoring.tinggi_tanaman, 0);
  const waterCondition = normalizeToken(monitoring.kondisi_air);
  const pestRisk = normalizeToken(monitoring.tingkat_hama);
  const leafCondition = normalizeToken(monitoring.kondisi_daun);
  const plantCondition = normalizeToken(monitoring.kondisi_tanaman);
  const rain = safeNumber(monitoring.curah_hujan, 0);
  const humidity = safeNumber(monitoring.kelembapan, 0);
  const temperature = safeNumber(monitoring.suhu, 0);

  const hasPestRisk =
    ["sedang", "tinggi", "ada", "terdeteksi"].includes(pestRisk) ||
    humidity >= 85 ||
    leafCondition.includes("bercak") ||
    plantCondition.includes("terserang");

  if (
    actualHeight > 0 &&
    expectedHeight &&
    actualHeight < expectedHeight * 0.8 &&
    hst <= 60
  ) {
    notes.push(
      `Tinggi tanaman ${actualHeight} cm berada di bawah acuan sekitar ${expectedHeight} cm pada HST ${hst}.`
    );
    recommendations.push(
      "Periksa kondisi air, warna daun, jumlah anakan, dan ketepatan pemupukan."
    );
  }

  if (waterCondition.includes("kering") || (temperature >= 33 && rain <= 5)) {
    notes.push("Lahan berisiko mengalami kekurangan air.");
    recommendations.push(
      "Periksa saluran irigasi dan tambahkan air secara bertahap sesuai kebutuhan."
    );
  }

  if (waterCondition.includes("tergenang") || rain >= 60) {
    notes.push("Lahan berisiko mengalami genangan berlebih.");
    recommendations.push("Periksa dan buka saluran drainase agar air dapat keluar.");
  }

  if (hasPestRisk) {
    notes.push("Terdapat indikasi peningkatan risiko hama atau penyakit.");
    recommendations.push(
      "Periksa daun, batang, pangkal tanaman, dan lakukan pengendalian hama terpadu bila diperlukan."
    );
  }

  if (leafCondition.includes("kuning")) {
    notes.push("Daun tercatat menguning.");
    recommendations.push(
      "Periksa pola menguning, kondisi akar, ketersediaan air, dan kecukupan unsur hara."
    );
  }

  if (plantCondition.includes("rebah")) {
    notes.push("Tanaman tercatat mengalami rebah.");
    recommendations.push(
      "Periksa kondisi batang, genangan, angin, dan tingkat kemasakan tanaman."
    );
  }

  const uniqueRecommendations = [...new Set(recommendations)];

  if (notes.length === 0) {
    return {
      status: "normal",
      prioritas: "rendah",
      judul: "Kondisi Tanaman Normal",
      hst,
      fase: phase,
      fase_label: getLabelFase(phase),
      ringkasan: "Data monitoring menunjukkan kondisi tanaman masih normal.",
      rekomendasi: baseInsight.rekomendasi,
      sumber: "monitoring_harian",
      memiliki_monitoring: true,
    };
  }

  return {
    status: "perlu_perhatian",
    prioritas: "tinggi",
    judul: "Kondisi Tanaman Perlu Diperhatikan",
    hst,
    fase: phase,
    fase_label: getLabelFase(phase),
    ringkasan: notes.join(" "),
    rekomendasi: uniqueRecommendations.join(" "),
    sumber: "monitoring_harian",
    memiliki_monitoring: true,
  };
};

const buildPrimaryRecommendation = ({ activities, insight }) => {
  const unfinished = (activities || []).filter(
    (item) => !["selesai", "dilewati"].includes(normalizeText(item.status))
  );

  const priorityWeight = { tinggi: 3, sedang: 2, rendah: 1 };
  unfinished.sort((left, right) => {
    const priorityDifference =
      (priorityWeight[normalizeText(right.prioritas)] || 0) -
      (priorityWeight[normalizeText(left.prioritas)] || 0);

    if (priorityDifference !== 0) return priorityDifference;
    return String(left.waktu || "08:00").localeCompare(String(right.waktu || "08:00"));
  });

  const activity = unfinished[0] || null;
  const activityWeight = priorityWeight[normalizeText(activity?.prioritas)] || 0;
  const insightWeight = priorityWeight[normalizeText(insight?.prioritas)] || 0;
  const insightNeedsAttention =
    normalizeText(insight?.status) === "perlu_perhatian" && insightWeight >= activityWeight;

  if (insightNeedsAttention) {
    return {
      sumber: insight?.sumber || "monitoring_harian",
      judul: insight?.judul || "Kondisi Tanaman Perlu Diperhatikan",
      prioritas: insight?.prioritas || "tinggi",
      status: insight?.status || "perlu_perhatian",
      ringkasan: insight?.ringkasan || "Terdapat kondisi yang perlu diperiksa.",
      rekomendasi: insight?.rekomendasi || "Lakukan pemeriksaan kondisi tanaman.",
      activity: null,
    };
  }

  if (activity) {
    return {
      sumber: "kegiatan",
      judul: activity.nama_kegiatan,
      prioritas: activity.prioritas || "sedang",
      status: activity.status || "terjadwal",
      ringkasan:
        activity.catatan ||
        `Kegiatan dijadwalkan pada HST ${activity.hari_ke ?? "-"}.`,
      rekomendasi: activity.metode || "Laksanakan kegiatan sesuai kondisi lahan.",
      activity,
    };
  }

  return {
    sumber: insight?.sumber || "fase_tanaman",
    judul: insight?.judul || "Arahan Budidaya",
    prioritas: insight?.prioritas || "rendah",
    status: insight?.status || "informasi",
    ringkasan: insight?.ringkasan || "Belum ada arahan untuk tanggal ini.",
    rekomendasi: insight?.rekomendasi || "Lanjutkan pemantauan tanaman.",
    activity: null,
  };
};

// =====================================================
// TEMPLATE JADWAL DASAR
// =====================================================
const buildBaseSchedule = (lahan) => {
  const harvestAge = getHarvestAge(lahan);

  return [
    {
      hari_ke: 0,
      jenis: "pengamatan",
      nama_kegiatan: "Penanaman Padi",
      metode: "Pastikan bibit ditanam merata dan jarak tanam sesuai.",
      catatan: "Awal siklus budidaya padi.",
    },
    {
      hari_ke: 1,
      jenis: "irigasi",
      nama_kegiatan: "Irigasi Awal",
      metode: "Jaga kondisi lahan tetap lembap setelah tanam.",
      catatan: "Air membantu adaptasi bibit setelah pindah tanam.",
    },
    {
      hari_ke: 7,
      jenis: "pengamatan",
      nama_kegiatan: "Pengamatan Pertumbuhan Awal",
      metode: "Periksa bibit mati, warna daun, dan kondisi air.",
      catatan: "Lakukan penyulaman jika terdapat bibit mati.",
    },
    {
      hari_ke: 10,
      jenis: "pemupukan",
      nama_kegiatan: "Pemupukan Dasar UREA",
      pupuk: "UREA",
      dosis_angka: 100,
      metode: "Sebarkan merata pada kondisi tanah lembap.",
      catatan: "Mendukung pertumbuhan daun dan anakan awal.",
    },
    {
      hari_ke: 14,
      jenis: "pengamatan",
      nama_kegiatan: "Pengamatan Hama dan Penyakit Awal",
      metode:
        "Periksa gejala wereng, keong mas, bercak daun, daun menguning, dan gangguan awal lainnya.",
      catatan:
        "Lakukan penyemprotan hanya jika ditemukan gejala atau populasi hama meningkat.",
    },
    {
      hari_ke: 21,
      jenis: "pengamatan",
      nama_kegiatan: "Penyiangan Gulma",
      metode: "Bersihkan gulma agar tidak bersaing dengan tanaman padi.",
      catatan: "Gulma dapat menghambat penyerapan air dan unsur hara.",
    },
    {
      hari_ke: 28,
      jenis: "pemupukan",
      nama_kegiatan: "Pemupukan SP-36",
      pupuk: "SP-36",
      dosis_angka: 75,
      metode: "Sebarkan merata sesuai dosis lahan.",
      catatan: "Mendukung perkembangan akar dan pembentukan energi tanaman.",
    },
    {
      hari_ke: 35,
      jenis: "pemupukan",
      nama_kegiatan: "Pemupukan KCL",
      pupuk: "KCL",
      dosis_angka: 50,
      metode: "Sebarkan merata pada pagi atau sore hari.",
      catatan: "Meningkatkan kekuatan batang dan ketahanan tanaman.",
    },
    {
      hari_ke: 42,
      jenis: "pemupukan",
      nama_kegiatan: "Pemupukan Susulan ZA",
      pupuk: "ZA",
      dosis_angka: 50,
      metode: "Berikan sesuai kebutuhan tanaman dan kondisi lahan.",
      catatan: "Mendukung pertumbuhan vegetatif lanjutan.",
    },
    {
      hari_ke: 50,
      jenis: "pengamatan",
      nama_kegiatan: "Pengamatan Tinggi dan Anakan",
      metode: "Catat tinggi tanaman, jumlah anakan, warna daun, dan kondisi batang.",
      catatan: "Data monitoring digunakan untuk menilai perkembangan tanaman.",
    },
    {
      hari_ke: 60,
      jenis: "irigasi",
      nama_kegiatan: "Pengaturan Irigasi",
      metode: "Jaga ketersediaan air agar tanaman tidak mengalami stres.",
      catatan: "Sesuaikan tinggi air dengan kondisi lahan dan fase tanaman.",
    },
    {
      hari_ke: 70,
      jenis: "pengamatan",
      nama_kegiatan: "Pengamatan Pembentukan Malai",
      metode: "Periksa kondisi malai, daun bendera, dan gejala penyakit.",
      catatan: "Pengamatan ini membantu menilai potensi hasil panen.",
    },
    {
      hari_ke: 80,
      jenis: "pengendalian_hama",
      nama_kegiatan: "Pengendalian Hama Terpadu",
      metode: "Pantau wereng, tikus, penggerek batang, dan penyakit daun.",
      catatan: "Gunakan pestisida hanya jika diperlukan dan sesuai arahan penyuluh.",
    },
    {
      hari_ke: Math.max(85, harvestAge - 15),
      jenis: "irigasi",
      nama_kegiatan: "Pengurangan Air Menjelang Panen",
      metode: "Kurangi genangan secara bertahap agar lahan siap dipanen.",
      catatan: "Pengeringan lahan membantu pematangan gabah.",
    },
    {
      hari_ke: Math.max(90, harvestAge - 5),
      jenis: "pengamatan",
      nama_kegiatan: "Pemeriksaan Kesiapan Panen",
      metode: "Periksa warna malai dan tingkat kemasakan bulir.",
      catatan: "Panen dilakukan saat mayoritas gabah telah menguning.",
    },
    {
      hari_ke: harvestAge,
      jenis: "panen",
      nama_kegiatan: "Panen",
      metode: "Lakukan panen saat tanaman memasuki kemasakan optimal.",
      catatan: "Akhir siklus budidaya.",
    },
  ];
};

// =====================================================
// JADWAL ADAPTIF DARI MONITORING TERBARU
// =====================================================
const buildAdaptiveSchedule = (lahan, monitoring) => {
  if (!monitoring || !lahan?.tanggal_tanam) return [];

  const monitoringDate = toDateKey(monitoring.tanggal);
  const currentHst = diffDays(lahan.tanggal_tanam, monitoringDate);

  if (currentHst === null || currentHst < 0) return [];

  const additions = [];
  const expectedHeight = getExpectedHeight(currentHst);
  const actualHeight = safeNumber(monitoring.tinggi_tanaman, 0);
  const waterCondition = normalizeToken(monitoring.kondisi_air);
  const pestRisk = normalizeToken(monitoring.tingkat_hama);
  const leafCondition = normalizeToken(monitoring.kondisi_daun);
  const plantCondition = normalizeToken(monitoring.kondisi_tanaman);
  const temperature = safeNumber(monitoring.suhu, 0);
  const humidity = safeNumber(monitoring.kelembapan, 0);
  const rain = safeNumber(monitoring.curah_hujan, 0);

  const hasPestRisk =
    ["sedang", "tinggi", "ada", "terdeteksi"].includes(pestRisk) ||
    humidity >= 85 ||
    leafCondition.includes("bercak") ||
    plantCondition.includes("terserang");

  if (
    actualHeight > 0 &&
    expectedHeight &&
    actualHeight < expectedHeight * 0.8 &&
    currentHst <= 60
  ) {
    additions.push({
      hari_ke: currentHst + 2,
      jenis: "pengamatan",
      nama_kegiatan: "Monitoring Ulang Pertumbuhan Tanaman",
      metode:
        "Ukur kembali tinggi tanaman, periksa kondisi air, warna daun, dan jumlah anakan.",
      catatan: `Tinggi aktual ${actualHeight} cm berada di bawah acuan sekitar ${expectedHeight} cm pada HST ${currentHst}.`,
      prioritas: "tinggi",
      adaptive_key: `growth-${monitoring.id}`,
    });
  }

  if (waterCondition.includes("kering") || (temperature >= 33 && rain <= 5)) {
    additions.push({
      hari_ke: currentHst + 1,
      jenis: "irigasi",
      nama_kegiatan: "Irigasi Tambahan",
      metode:
        "Tambahkan air secara bertahap dan pastikan distribusi air merata pada lahan.",
      catatan: `Kondisi air ${monitoring.kondisi_air || "-"}, suhu ${
        temperature || "-"
      }°C, dan curah hujan ${rain || 0} mm.`,
      prioritas: "tinggi",
      adaptive_key: `irrigation-${monitoring.id}`,
    });
  }

  if (waterCondition.includes("tergenang") || rain >= 60) {
    additions.push({
      hari_ke: currentHst + 1,
      jenis: "irigasi",
      nama_kegiatan: "Pemeriksaan dan Perbaikan Drainase",
      metode: "Pastikan saluran keluar air terbuka dan tidak tersumbat.",
      catatan: `Kondisi air ${monitoring.kondisi_air || "-"} dengan curah hujan ${
        rain || 0
      } mm berisiko menimbulkan genangan.`,
      prioritas: "tinggi",
      adaptive_key: `drainage-${monitoring.id}`,
    });
  }

  if (hasPestRisk) {
    additions.push({
      hari_ke: currentHst + 1,
      jenis: "pengendalian_hama",
      nama_kegiatan: "Pemeriksaan Risiko Hama dan Penyakit",
      metode:
        "Periksa daun, batang, pangkal tanaman, dan area sekitar. Tentukan tindakan berdasarkan hasil identifikasi.",
      catatan: `Risiko hama ${monitoring.tingkat_hama || "-"}, kondisi daun ${
        monitoring.kondisi_daun || "-"
      }, dan kelembapan ${humidity || "-"}%.`,
      prioritas: "tinggi",
      adaptive_key: `pest-${monitoring.id}`,
    });
  }

  if (leafCondition.includes("kuning")) {
    additions.push({
      hari_ke: currentHst + 2,
      jenis: "pengamatan",
      nama_kegiatan: "Pemeriksaan Daun Menguning",
      metode:
        "Amati pola daun menguning, kondisi air, akar, dan gejala kekurangan unsur hara.",
      catatan: "Monitoring mencatat kondisi daun menguning.",
      prioritas: "sedang",
      adaptive_key: `leaf-${monitoring.id}`,
    });
  }

  if (plantCondition.includes("rebah")) {
    additions.push({
      hari_ke: currentHst + 1,
      jenis: "pengamatan",
      nama_kegiatan: "Pemeriksaan Tanaman Rebah",
      metode:
        "Periksa luas tanaman rebah, kondisi batang, genangan, dan kemasakan bulir.",
      catatan: "Monitoring mencatat tanaman mengalami rebah.",
      prioritas: "tinggi",
      adaptive_key: `lodging-${monitoring.id}`,
    });
  }

  return additions;
};

const prepareSchedule = (lahan, monitoring) => {
  const areaHa = getLahanAreaHa(lahan);
  const harvestAge = getHarvestAge(lahan);
  const rawSchedule = [
    ...buildBaseSchedule(lahan),
    ...buildAdaptiveSchedule(lahan, monitoring),
  ];

  return rawSchedule
    .filter((item) => Number(item.hari_ke) >= 0)
    .map((item) => {
      const phase =
        normalizeText(item.jenis) === "panen"
          ? "panen"
          : getFaseTanaman(item.hari_ke, harvestAge);

      return {
        ...item,
        tanggal: addDaysFromDate(lahan.tanggal_tanam, item.hari_ke),
        waktu: item.waktu || "08:00",
        fase_tanaman: phase,
        fase_label: getLabelFase(phase),
        dosis_per_ha: item.dosis_angka ? formatKgHa(item.dosis_angka) : null,
        dosis_total: item.dosis_angka
          ? formatTotalKg(item.dosis_angka, areaHa)
          : null,
        sumber: item.adaptive_key ? "adaptif" : "sistem",
        prioritas: item.prioritas || "sedang",
        monitoring_id: item.adaptive_key
          ? Number(monitoring?.id || 0) || null
          : null,
      };
    });
};

// =====================================================
// SIMPAN ATAU PERBARUI JADWAL SISTEM
// =====================================================
const getScheduleKey = (item) =>
  `${normalizeText(item.nama_kegiatan)}|${item.hari_ke}|${normalizeText(
    item.sumber
  )}`;

const isProtectedGeneratedRow = (row) =>
  Number(row.diubah_pengguna) === 1 ||
  ["selesai", "dilewati"].includes(normalizeText(row.status)) ||
  Boolean(row.tanggal_aktual);

const deleteGeneratedRowsByIds = async (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) return 0;

  const placeholders = ids.map(() => "?").join(",");
  const result = await query(
    `
      DELETE FROM kalender_budidaya
      WHERE id IN (${placeholders})
        AND sumber IN ('sistem', 'adaptif')
        AND diubah_pengguna = 0
        AND tanggal_aktual IS NULL
        AND status IN ('terjadwal', 'terlambat')
    `,
    ids
  );

  return Number(result.affectedRows || 0);
};

const saveSystemSchedule = async ({ lahan, userId, monitoring = null }) => {
  if (!lahan) throw new Error("Lahan tidak ditemukan");
  if (!lahan.tanggal_tanam) throw new Error("Tanggal tanam belum diisi");

  const ownerId = userId || getOwnerId(lahan);
  const activeMonitoring = monitoring || (await getLatestMonitoring(lahan.id));
  const schedule = prepareSchedule(lahan, activeMonitoring);
  const existingRows = await query(
    `
      SELECT
        id,
        monitoring_id,
        nama_kegiatan,
        hari_ke,
        sumber,
        status,
        diubah_pengguna,
        tanggal_aktual
      FROM kalender_budidaya
      WHERE lahan_id = ?
        AND sumber IN ('sistem', 'adaptif')
      ORDER BY id DESC
    `,
    [lahan.id]
  );

  const existingGroups = new Map();

  existingRows.forEach((row) => {
    const key = getScheduleKey(row);
    const group = existingGroups.get(key) || [];
    group.push(row);
    existingGroups.set(key, group);
  });

  const keepIds = new Set();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of schedule) {
    const key = getScheduleKey(item);
    const group = existingGroups.get(key) || [];
    const current =
      group.find((row) => isProtectedGeneratedRow(row)) ||
      group.sort((left, right) => Number(right.id) - Number(left.id))[0] ||
      null;

    if (current) {
      keepIds.add(Number(current.id));

      if (isProtectedGeneratedRow(current)) {
        skipped += 1;
        continue;
      }

      await query(
        `
          UPDATE kalender_budidaya
          SET
            user_id = COALESCE(user_id, ?),
            monitoring_id = ?,
            tanggal_rekomendasi = ?,
            tanggal = ?,
            jenis = ?,
            fase_tanaman = ?,
            waktu = ?,
            pupuk = ?,
            dosis_per_ha = ?,
            dosis_total = ?,
            metode = ?,
            catatan = ?,
            prioritas = ?,
            status = CASE
              WHEN status = 'terlambat' AND ? >= CURDATE() THEN 'terjadwal'
              ELSE status
            END,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [
          ownerId || null,
          item.monitoring_id,
          item.tanggal,
          item.tanggal,
          item.jenis,
          item.fase_tanaman,
          item.waktu,
          item.pupuk || null,
          item.dosis_per_ha,
          item.dosis_total,
          item.metode || null,
          item.catatan || null,
          item.prioritas,
          item.tanggal,
          current.id,
        ]
      );

      updated += 1;
      continue;
    }

    const result = await query(
      `
        INSERT INTO kalender_budidaya
        (
          lahan_id,
          user_id,
          monitoring_id,
          nama_kegiatan,
          jenis,
          tanggal,
          tanggal_awal,
          tanggal_rekomendasi,
          hari_ke,
          fase_tanaman,
          waktu,
          pupuk,
          dosis_per_ha,
          dosis_total,
          metode,
          catatan,
          durasi,
          status,
          sumber,
          prioritas,
          diubah_pengguna
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'terjadwal', ?, ?, 0)
      `,
      [
        lahan.id,
        ownerId || null,
        item.monitoring_id,
        item.nama_kegiatan,
        item.jenis,
        item.tanggal,
        item.tanggal,
        item.tanggal,
        item.hari_ke,
        item.fase_tanaman,
        item.waktu,
        item.pupuk || null,
        item.dosis_per_ha,
        item.dosis_total,
        item.metode || null,
        item.catatan || null,
        item.durasi || null,
        item.sumber,
        item.prioritas,
      ]
    );

    keepIds.add(Number(result.insertId));
    inserted += 1;
  }

  const removableIds = existingRows
    .filter((row) => {
      const id = Number(row.id);

      return (
        !keepIds.has(id) &&
        !isProtectedGeneratedRow(row) &&
        ["terjadwal", "terlambat"].includes(normalizeText(row.status))
      );
    })
    .map((row) => Number(row.id));

  const removedNotifications = await deleteNotificationsByCalendarIds({
    userId: ownerId,
    calendarIds: removableIds,
  });
  const removed = await deleteGeneratedRowsByIds(removableIds);

  let adaptiveActivities = [];

  if (activeMonitoring?.id) {
    adaptiveActivities = await query(
      `
        SELECT
          kb.*,
          DATE_FORMAT(kb.tanggal, '%Y-%m-%d') AS tanggal
        FROM kalender_budidaya kb
        WHERE kb.lahan_id = ?
          AND kb.monitoring_id = ?
          AND kb.sumber = 'adaptif'
          AND kb.status IN ('terjadwal', 'terlambat')
        ORDER BY
          CASE kb.prioritas
            WHEN 'tinggi' THEN 1
            WHEN 'sedang' THEN 2
            ELSE 3
          END,
          kb.tanggal ASC,
          kb.waktu ASC,
          kb.id ASC
      `,
      [lahan.id, activeMonitoring.id]
    );

    adaptiveActivities = serializeCalendarRows(adaptiveActivities);
  }

  return {
    inserted,
    updated,
    skipped,
    removed,
    removed_ids: removableIds,
    removed_notifications: removedNotifications,
    total: schedule.length,
    monitoring_id: activeMonitoring?.id
      ? Number(activeMonitoring.id)
      : null,
    adaptive_activities: adaptiveActivities,
  };
};

// =====================================================
// GET CUACA OTOMATIS BERDASARKAN KOORDINAT LAHAN
// GET /api/kalender/:lahan_id/cuaca?user_id=...
// =====================================================
exports.getCuacaLahan = async (req, res) => {
  try {
    const { lahan_id: lahanId } = req.params;
    const userId = resolveUserId(req);

    if (!userId) {
      return sendError(res, 400, "ID pengguna wajib disertakan");
    }

    const lahan = await getLahanById(lahanId, userId);

    if (!lahan) {
      return sendError(
        res,
        404,
        "Lahan tidak ditemukan atau bukan milik pengguna"
      );
    }

    const latitude = Number(
      lahan.lat ?? lahan.latitude ?? lahan.lokasi_lat
    );
    const longitude = Number(
      lahan.lng ?? lahan.longitude ?? lahan.lokasi_lng
    );

    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
      return res.json(
        unavailableWeatherPayload(
          "Koordinat lahan belum tersedia atau tidak valid"
        )
      );
    }

    try {
      const response = await axios.get(OPEN_METEO_URL, {
        params: {
          latitude,
          longitude,
          current:
            "temperature_2m,relative_humidity_2m,precipitation,rain,weather_code",
          timezone: "Asia/Jakarta",
          forecast_days: 1,
        },
        timeout: OPEN_METEO_TIMEOUT_MS,
      });

      const current = response.data?.current || {};
      const temperature = current.temperature_2m;
      const humidity = current.relative_humidity_2m;
      const precipitation =
        current.precipitation ?? current.rain ?? null;
      const weatherCode = current.weather_code;

      const hasTemperature = Number.isFinite(Number(temperature));
      const hasHumidity = Number.isFinite(Number(humidity));
      const hasPrecipitation = Number.isFinite(Number(precipitation));

      if (!hasTemperature && !hasHumidity && !hasPrecipitation) {
        return res.json(
          unavailableWeatherPayload(
            "Open-Meteo belum mengembalikan data cuaca untuk lokasi lahan"
          )
        );
      }

      return res.json({
        status: true,
        message: "Data cuaca lahan berhasil dimuat",
        data: {
          suhu: hasTemperature ? Number(temperature) : null,
          kelembapan: hasHumidity ? Number(humidity) : null,
          curah_hujan: hasPrecipitation ? Number(precipitation) : null,
          kondisi: getWeatherConditionLabel(
            weatherCode,
            hasPrecipitation ? Number(precipitation) : 0
          ),
          sumber: "open_meteo",
          waktu: formatWeatherTime(
            current.time,
            response.data?.utc_offset_seconds
          ),
        },
      });
    } catch (weatherError) {
      console.error(
        "ERROR OPEN-METEO:",
        weatherError.response?.data || weatherError.message
      );

      return res.json(
        unavailableWeatherPayload(
          "Layanan cuaca sedang tidak dapat diakses"
        )
      );
    }
  } catch (error) {
    console.error("ERROR GET CUACA LAHAN:", error);
    return sendError(
      res,
      500,
      error.message || "Gagal memuat data cuaca lahan"
    );
  }
};

// =====================================================
// OVERVIEW HARIAN MODEL FLO
// =====================================================
exports.getKalenderOverview = async (req, res) => {
  try {
    const { lahan_id: lahanId } = req.params;
    const userId = resolveUserId(req);
    const selectedDate = toDateKey(req.query.tanggal || new Date());

    if (!selectedDate) {
      return sendError(res, 400, "Tanggal tidak valid");
    }

    const lahan = await getLahanById(lahanId, userId);

    if (!lahan) {
      return sendError(res, 404, "Lahan tidak ditemukan atau bukan milik pengguna");
    }

    if (!lahan.tanggal_tanam) {
      return sendError(res, 400, "Tanggal tanam pada lahan belum diisi");
    }

    const monthRange = getMonthRange(req.query.bulan, selectedDate);
    const today = toDateKey(new Date());
    const todayHst = diffDays(lahan.tanggal_tanam, today);
    const selectedHst = diffDays(lahan.tanggal_tanam, selectedDate);
    const harvestAge = getHarvestAge(lahan);
    const upcomingEnd = addDaysFromDate(selectedDate, 6);

    const [
      monthEvents,
      selectedActivities,
      dailyMonitoring,
      latestMonitoring,
      upcomingActivities,
    ] = await Promise.all([
      getCalendarRowsByLahan(lahanId, monthRange.start, monthRange.end),
      getCalendarRowsByLahan(lahanId, selectedDate, selectedDate),
      getMonitoringByDate(lahanId, selectedDate),
      getLatestMonitoring(lahanId, selectedDate),
      getCalendarRowsByLahan(lahanId, selectedDate, upcomingEnd),
    ]);

    const insight = buildDailyInsight(lahan, dailyMonitoring, selectedDate);
    const primaryRecommendation = buildPrimaryRecommendation({
      activities: selectedActivities,
      insight,
    });

    const activeUpcoming = upcomingActivities.filter(
      (item) => !["selesai", "dilewati"].includes(normalizeText(item.status))
    );

    return res.json({
      status: true,
      message: "success",
      data: {
        lahan: {
          id: lahan.id,
          nama_lahan: lahan.nama_lahan,
          varietas: lahan.varietas,
          tanggal_tanam: toDateKey(lahan.tanggal_tanam),
          luas_ha: lahan.luas_ha,
          luas_m2: lahan.luas_m2,
          nama_desa: lahan.nama_desa,
          nama_kecamatan: lahan.nama_kecamatan,
        },
        cycle: {
          today,
          hst: todayHst,
          fase: getFaseTanaman(todayHst, harvestAge),
          fase_label: getLabelFase(
            getFaseTanaman(todayHst, harvestAge)
          ),
          umur_panen_hari: harvestAge,
          progress_percent: getCycleProgress(todayHst, harvestAge),
          estimasi_panen: addDaysFromDate(lahan.tanggal_tanam, harvestAge),
          estimasi_panen_mulai: addDaysFromDate(
            lahan.tanggal_tanam,
            harvestAge - 5
          ),
          estimasi_panen_selesai: addDaysFromDate(
            lahan.tanggal_tanam,
            harvestAge + 5
          ),
        },
        selected_day: {
          tanggal: selectedDate,
          hst: selectedHst,
          fase: getFaseTanaman(selectedHst, harvestAge),
          fase_label: getLabelFase(
            getFaseTanaman(selectedHst, harvestAge)
          ),
          monitoring_harian: dailyMonitoring,
          insight,
          recommendation: primaryRecommendation,
          activities: selectedActivities,
        },
        latest_monitoring: latestMonitoring,
        upcoming_activities: activeUpcoming,
        month: monthRange.month,
        month_events: monthEvents,
      },
    });
  } catch (error) {
    console.error("ERROR GET KALENDER OVERVIEW:", error);
    return sendError(res, 500, error.message || "Gagal memuat overview kalender");
  }
};

// =====================================================
// GET KALENDER PER LAHAN
// GET hanya membaca data, tidak menjalankan generate.
// =====================================================
exports.getKalenderByLahan = async (req, res) => {
  try {
    const { lahan_id: lahanId } = req.params;
    const userId = resolveUserId(req);
    const lahan = await getLahanById(lahanId, userId);

    if (!lahan) {
      return sendError(res, 404, "Lahan tidak ditemukan atau bukan milik pengguna");
    }

    const rows = await getCalendarRowsByLahan(lahanId);
    const latestMonitoring = await getLatestMonitoring(lahanId);

    return res.json({
      status: true,
      message: "success",
      data: rows,
      meta: {
        latest_monitoring: latestMonitoring,
        insight_hari_ini: buildDailyInsight(
          lahan,
          latestMonitoring && toDateKey(latestMonitoring.tanggal) === toDateKey(new Date())
            ? latestMonitoring
            : null,
          new Date()
        ),
      },
    });
  } catch (error) {
    console.error("ERROR GET KALENDER:", error);
    return sendError(res, 500, error.message || "Gagal memuat kalender");
  }
};

// =====================================================
// GENERATE ATAU REFRESH JADWAL
// =====================================================
exports.generateKalenderByLahan = async (req, res) => {
  try {
    const { lahan_id: lahanId } = req.params;
    const userId = resolveUserId(req);
    const lahan = await getLahanById(lahanId, userId);

    if (!lahan) {
      return sendError(res, 404, "Lahan tidak ditemukan atau bukan milik pengguna");
    }

    const notificationUserId = userId || getOwnerId(lahan);
    const latestMonitoring = await getLatestMonitoring(lahanId);
    const result = await saveSystemSchedule({
      lahan,
      userId: notificationUserId,
      monitoring: latestMonitoring,
    });

    const today = toDateKey(new Date());
    const todayMonitoring = await getMonitoringByDate(lahanId, today);
    const todayInsight = buildDailyInsight(lahan, todayMonitoring, today);
    const phaseInsight = buildPhaseInsight(lahan, today);
    let notifications = [];

    const adaptiveForToday = result.adaptive_activities.filter(
      (item) =>
        todayMonitoring?.id &&
        sameId(item.monitoring_id, todayMonitoring.id)
    );

    if (
      todayMonitoring &&
      normalizeText(todayInsight.status) === "perlu_perhatian" &&
      adaptiveForToday.length > 0
    ) {
      notifications = await createAdaptiveActivityNotifications({
        userId: notificationUserId,
        lahan,
        monitoring: todayMonitoring,
        insight: todayInsight,
        activities: adaptiveForToday,
        refreshExisting: false,
      });
    } else {
      const notification = await createInsightNotification({
        userId: notificationUserId,
        lahan,
        insight:
          normalizeText(todayInsight.status) === "perlu_perhatian"
            ? todayInsight
            : phaseInsight,
        date: today,
        monitoringId: todayMonitoring?.id || null,
        refreshExisting: false,
      });

      if (notification) notifications = [notification];
    }

    return res.json({
      status: true,
      message: "Kalender berhasil diperbarui tanpa menghapus riwayat kegiatan.",
      data: {
        ...result,
        notification_count: notifications.length,
      },
    });
  } catch (error) {
    console.error("ERROR GENERATE KALENDER:", error);
    return sendError(res, 500, error.message || "Kalender gagal diperbarui");
  }
};

// =====================================================
// GET MONITORING HARIAN BERDASARKAN TANGGAL
// =====================================================
exports.getMonitoringKalender = async (req, res) => {
  try {
    const { lahan_id: lahanId } = req.params;
    const userId = resolveUserId(req);
    const date = toDateKey(req.query.tanggal || new Date());

    if (!date) {
      return sendError(res, 400, "Tanggal wajib diisi dengan format yang benar");
    }

    const lahan = await getLahanById(lahanId, userId);

    if (!lahan) {
      return sendError(res, 404, "Lahan tidak ditemukan atau bukan milik pengguna");
    }

    const monitoring = await getMonitoringByDate(lahanId, date);
    const insight = buildDailyInsight(lahan, monitoring, date);

    return res.json({
      status: true,
      message: "success",
      data: monitoring,
      insight,
    });
  } catch (error) {
    console.error("ERROR GET MONITORING HARIAN:", error);
    return sendError(res, 500, error.message || "Gagal memuat monitoring harian");
  }
};

// =====================================================
// SIMPAN ATAU UPDATE MONITORING HARIAN
// =====================================================
exports.createMonitoringKalender = async (req, res) => {
  try {
    const { lahan_id: lahanId } = req.params;
    const userId = resolveUserId(req);
    const {
      tanggal,
      tinggi_tanaman: height,
      jumlah_anakan: tillerCount,
      kondisi_daun: leafCondition,
      kondisi_air: waterCondition,
      tingkat_hama: pestLevel,
      jenis_hama: pestType,
      kondisi_tanaman: plantCondition,
      suhu: temperature,
      kelembapan: humidity,
      curah_hujan: rainfall,
      catatan: note,
    } = req.body || {};

    const date = toDateKey(tanggal || new Date());

    if (!userId || !date) {
      return sendError(res, 400, "Pengguna dan tanggal wajib diisi");
    }

    const lahan = await getLahanById(lahanId, userId);

    if (!lahan) {
      return sendError(res, 404, "Lahan tidak ditemukan atau bukan milik pengguna");
    }

    if (!lahan.tanggal_tanam) {
      return sendError(res, 400, "Tanggal tanam pada lahan belum diisi");
    }

    const hst = diffDays(lahan.tanggal_tanam, date);

    if (hst !== null && hst < 0) {
      return sendError(res, 400, "Monitoring tidak dapat dicatat sebelum tanggal tanam");
    }

    const existing = await getMonitoringByDate(lahanId, date);
    let monitoringId = existing?.id || null;

    const values = [
      userId,
      isEmpty(height) ? null : safeNumber(height),
      isEmpty(tillerCount) ? null : safeNumber(tillerCount),
      isEmpty(leafCondition) ? null : normalizeToken(leafCondition),
      isEmpty(waterCondition) ? null : normalizeToken(waterCondition),
      isEmpty(pestLevel) ? null : normalizeToken(pestLevel),
      isEmpty(pestType) ? null : String(pestType).trim(),
      isEmpty(plantCondition) ? null : normalizeToken(plantCondition),
      isEmpty(temperature) ? null : safeNumber(temperature),
      isEmpty(humidity) ? null : safeNumber(humidity),
      isEmpty(rainfall) ? null : safeNumber(rainfall),
      isEmpty(note) ? null : String(note).trim(),
    ];

    if (existing) {
      await query(
        `
          UPDATE monitoring_harian
          SET
            user_id = ?,
            tinggi_tanaman = ?,
            jumlah_anakan = ?,
            kondisi_daun = ?,
            kondisi_air = ?,
            tingkat_hama = ?,
            jenis_hama = ?,
            kondisi_tanaman = ?,
            suhu = ?,
            kelembapan = ?,
            curah_hujan = ?,
            catatan = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [...values, existing.id]
      );
    } else {
      const result = await query(
        `
          INSERT INTO monitoring_harian
          (
            lahan_id,
            user_id,
            tanggal,
            tinggi_tanaman,
            jumlah_anakan,
            kondisi_daun,
            kondisi_air,
            tingkat_hama,
            jenis_hama,
            kondisi_tanaman,
            suhu,
            kelembapan,
            curah_hujan,
            catatan
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [lahanId, userId, date, ...values.slice(1)]
      );

      monitoringId = result.insertId;
    }

    const savedMonitoring = await getMonitoringByDate(lahanId, date);
    const monitoringInsight = buildDailyInsight(lahan, savedMonitoring, date);
    const phaseInsight = buildPhaseInsight(lahan, date);
    const latestMonitoring = await getLatestMonitoring(lahanId);
    const scheduleResult = await saveSystemSchedule({
      lahan,
      userId,
      monitoring: latestMonitoring,
    });

    await deleteNotificationsByMonitoringId({
      userId,
      monitoringId,
    });

    const savedIsLatest =
      savedMonitoring?.id &&
      latestMonitoring?.id &&
      sameId(savedMonitoring.id, latestMonitoring.id);
    let notifications = [];

    if (
      savedIsLatest &&
      normalizeText(monitoringInsight.status) === "perlu_perhatian" &&
      scheduleResult.adaptive_activities.length > 0
    ) {
      notifications = await createAdaptiveActivityNotifications({
        userId,
        lahan,
        monitoring: savedMonitoring,
        insight: monitoringInsight,
        activities: scheduleResult.adaptive_activities,
        refreshExisting: true,
      });
    } else {
      const notification = await createInsightNotification({
        userId,
        lahan,
        insight:
          normalizeText(monitoringInsight.status) === "perlu_perhatian"
            ? monitoringInsight
            : phaseInsight,
        date,
        monitoringId,
        refreshExisting: true,
      });

      if (notification) notifications = [notification];
    }

    return res.json({
      status: true,
      message: existing
        ? "Monitoring harian berhasil diperbarui"
        : "Monitoring harian berhasil disimpan",
      id: monitoringId,
      data: savedMonitoring,
      insight: monitoringInsight,
      calendar_update: scheduleResult,
      notifications,
    });
  } catch (error) {
    console.error("ERROR SAVE MONITORING HARIAN:", error);
    return sendError(res, 500, error.message || "Monitoring harian gagal disimpan");
  }
};

// =====================================================
// JADWAL ULANG
// =====================================================
exports.rescheduleKalender = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = resolveUserId(req);
    const newDate = toDateKey(req.body?.tanggal_baru);
    const reason = String(req.body?.alasan || "").trim();

    if (!newDate || !reason) {
      return sendError(res, 400, "Tanggal baru dan alasan perubahan wajib diisi");
    }

    const item = await getCalendarItemById(id, userId);

    if (!item) {
      return sendError(res, 404, "Kegiatan tidak ditemukan atau bukan milik pengguna");
    }

    const newHst = diffDays(item.tanggal_tanam, newDate);

    if (newHst === null || newHst < 0) {
      return sendError(res, 400, "Tanggal baru tidak boleh sebelum tanggal tanam");
    }

    const itemLahan = await getLahanById(item.lahan_id, userId);
    const harvestAge = getHarvestAge(itemLahan || {});
    const newPhase =
      normalizeText(item.jenis) === "panen"
        ? "panen"
        : getFaseTanaman(newHst, harvestAge);

    await query(
      `
        UPDATE kalender_budidaya
        SET
          tanggal_awal = COALESCE(tanggal_awal, tanggal),
          tanggal = ?,
          tanggal_rekomendasi = ?,
          hari_ke = ?,
          fase_tanaman = ?,
          alasan_perubahan = ?,
          status = 'terjadwal',
          diubah_pengguna = 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [newDate, newDate, newHst, newPhase, reason, id]
    );

    return res.json({
      status: true,
      message: "Jadwal berhasil diubah",
      data: {
        id: Number(id),
        tanggal: newDate,
        hari_ke: newHst,
        fase_tanaman: newPhase,
      },
    });
  } catch (error) {
    console.error("ERROR RESCHEDULE:", error);
    return sendError(res, 500, error.message || "Jadwal gagal diubah");
  }
};

// =====================================================
// UPDATE STATUS KEGIATAN
// =====================================================
exports.updateStatusKalender = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = resolveUserId(req);
    const status = normalizeText(req.body?.status);
    const actualNote = isEmpty(req.body?.catatan_aktual)
      ? null
      : String(req.body.catatan_aktual).trim();
    const allowedStatuses = [
      "terjadwal",
      "selesai",
      "dilewati",
      "terlambat",
      "dijadwalkan_ulang",
    ];

    if (!allowedStatuses.includes(status)) {
      return sendError(res, 400, "Status tidak valid");
    }

    const item = await getCalendarItemById(id, userId);

    if (!item) {
      return sendError(res, 404, "Kegiatan tidak ditemukan atau bukan milik pengguna");
    }

    const result = await query(
      `
        UPDATE kalender_budidaya
        SET
          status = ?,
          catatan_aktual = ?,
          tanggal_aktual = CASE
            WHEN ? = 'selesai' THEN CURDATE()
            WHEN ? <> 'selesai' THEN NULL
            ELSE tanggal_aktual
          END,
          diubah_pengguna = CASE
            WHEN ? IN ('dilewati', 'dijadwalkan_ulang') THEN 1
            ELSE diubah_pengguna
          END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [status, actualNote, status, status, status, id]
    );

    if (result.affectedRows === 0) {
      return sendError(res, 404, "Kegiatan tidak ditemukan");
    }

    if (["selesai", "dilewati"].includes(status)) {
      await query(
        `
          UPDATE notifikasi
          SET
            is_read = 1,
            read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
          WHERE kalender_id = ?
            AND user_id = ?
            AND role = 'petani'
        `,
        [id, userId]
      );
    }

    return res.json({
      status: true,
      message: "Status kegiatan berhasil diperbarui",
    });
  } catch (error) {
    console.error("ERROR UPDATE STATUS:", error);
    return sendError(res, 500, error.message || "Status kegiatan gagal diperbarui");
  }
};

// Endpoint lama tetap didukung.
exports.selesaiKalender = async (req, res) => {
  req.body = { ...(req.body || {}), status: "selesai" };
  return exports.updateStatusKalender(req, res);
};

// =====================================================
// GET KALENDER PER PETANI
// =====================================================
exports.getKalenderByPetani = async (req, res) => {
  try {
    const farmerId = resolveUserId(req);

    if (!farmerId) {
      return sendError(res, 400, "petani_id atau user_id wajib dikirim");
    }

    const rows = await query(
      `
        SELECT
          kb.*,
          DATE_FORMAT(kb.tanggal, '%Y-%m-%d') AS tanggal,
          DATE_FORMAT(kb.tanggal_awal, '%Y-%m-%d') AS tanggal_awal,
          DATE_FORMAT(kb.tanggal_rekomendasi, '%Y-%m-%d') AS tanggal_rekomendasi,
          DATE_FORMAT(kb.tanggal_aktual, '%Y-%m-%d') AS tanggal_aktual,
          DATE_FORMAT(l.tanggal_tanam, '%Y-%m-%d') AS tanggal_tanam,
          l.nama_lahan,
          l.varietas,
          l.luas_ha,
          l.luas_m2,
          l.lat,
          l.lng,
          k.nama_kecamatan,
          d.nama_desa
        FROM kalender_budidaya kb
        LEFT JOIN lahan l ON l.id = kb.lahan_id
        LEFT JOIN kecamatan k ON k.id = l.kecamatan_id
        LEFT JOIN desa d ON d.id = l.desa_id
        WHERE kb.user_id = ?
           OR l.user_id = ?
           OR l.petani_id = ?
        ORDER BY kb.tanggal ASC, kb.waktu ASC, kb.hari_ke ASC, kb.id ASC
      `,
      [farmerId, farmerId, farmerId]
    );

    return res.json({
      status: true,
      message: "success",
      data: serializeCalendarRows(rows),
    });
  } catch (error) {
    console.error("ERROR GET KALENDER PETANI:", error);
    return sendError(res, 500, error.message || "Gagal memuat kalender petani");
  }
};

// =====================================================
// CREATE JADWAL MANUAL
// =====================================================
exports.createKalender = async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const {
      lahan_id: lahanId,
      nama_kegiatan: activityName,
      jenis: type,
      tanggal: dateValue,
      hari_ke: inputHst,
      fase_tanaman: inputPhase,
      waktu: time,
      pupuk: fertilizer,
      dosis_per_ha: dosePerHa,
      dosis_total: totalDose,
      metode: method,
      catatan: note,
      durasi: duration,
    } = req.body || {};

    const date = toDateKey(dateValue);

    if (!lahanId || !userId || !activityName || !date) {
      return sendError(res, 400, "Lahan, pengguna, nama kegiatan, dan tanggal wajib diisi");
    }

    const lahan = await getLahanById(lahanId, userId);

    if (!lahan) {
      return sendError(res, 404, "Lahan tidak ditemukan atau bukan milik pengguna");
    }

    const calculatedHst = diffDays(lahan.tanggal_tanam, date);
    const hst = inputHst ?? calculatedHst;

    if (hst !== null && Number(hst) < 0) {
      return sendError(res, 400, "Tanggal kegiatan tidak boleh sebelum tanggal tanam");
    }

    const phase =
      inputPhase ||
      (normalizeText(type) === "panen"
        ? "panen"
        : getFaseTanaman(hst, getHarvestAge(lahan)));

    const result = await query(
      `
        INSERT INTO kalender_budidaya
        (
          lahan_id,
          user_id,
          nama_kegiatan,
          jenis,
          tanggal,
          tanggal_awal,
          tanggal_rekomendasi,
          hari_ke,
          fase_tanaman,
          waktu,
          pupuk,
          dosis_per_ha,
          dosis_total,
          metode,
          catatan,
          durasi,
          status,
          sumber,
          prioritas,
          diubah_pengguna
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'terjadwal', 'manual', 'sedang', 1)
      `,
      [
        lahanId,
        userId,
        String(activityName).trim(),
        type || "pengamatan",
        date,
        date,
        date,
        hst ?? null,
        phase,
        time || "08:00",
        fertilizer || null,
        dosePerHa || null,
        totalDose || null,
        method || null,
        note || null,
        duration || null,
      ]
    );

    const targetUrl = buildCalendarLink({
      calendarId: result.insertId,
      lahanId,
      date,
    });

    await insertNotification({
      userId,
      calendarId: result.insertId,
      lahanId,
      title: `Jadwal Budidaya Baru: ${String(activityName).trim()}`,
      message: `${String(activityName).trim()} dijadwalkan pada ${formatTanggalIndonesia(
        date
      )} pukul ${String(time || "08:00").slice(0, 5)}.`,
      type: "jadwal",
      priority: "sedang",
      targetUrl,
    });

    return res.status(201).json({
      status: true,
      message: "Kegiatan berhasil ditambahkan",
      id: result.insertId,
    });
  } catch (error) {
    console.error("ERROR CREATE KALENDER:", error);
    return sendError(res, 500, error.message || "Kegiatan gagal ditambahkan");
  }
};

// =====================================================
// HAPUS / BATALKAN JADWAL
// Kegiatan manual dihapus. Kegiatan sistem/adaptif ditandai dilewati.
// =====================================================
exports.deleteKalender = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = resolveUserId(req);
    const item = await getCalendarItemById(id, userId);

    if (!item) {
      return sendError(res, 404, "Kegiatan tidak ditemukan atau bukan milik pengguna");
    }

    if (normalizeText(item.sumber) === "manual") {
      await deleteNotificationsByCalendarIds({
        userId,
        calendarIds: [id],
      });
      await query("DELETE FROM kalender_budidaya WHERE id = ?", [id]);

      return res.json({
        status: true,
        message: "Kegiatan manual berhasil dihapus",
      });
    }

    await query(
      `
        UPDATE kalender_budidaya
        SET
          status = 'dilewati',
          catatan_aktual = COALESCE(catatan_aktual, 'Dibatalkan oleh pengguna'),
          diubah_pengguna = 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [id]
    );

    return res.json({
      status: true,
      message: "Kegiatan sistem berhasil dibatalkan dan riwayat tetap disimpan",
    });
  } catch (error) {
    console.error("ERROR DELETE KALENDER:", error);
    return sendError(res, 500, error.message || "Kegiatan gagal dihapus");
  }
};

// =====================================================
// EKSPOR INTERNAL UNTUK PENGUJIAN, OPSIONAL
// =====================================================
exports._internal = {
  toDateKey,
  diffDays,
  getFaseTanaman,
  getLabelFase,
  buildDailyInsight,
  buildBaseSchedule,
  buildAdaptiveSchedule,
  prepareSchedule,
};
