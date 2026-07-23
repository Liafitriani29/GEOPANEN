import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";

const API =
  import.meta.env.VITE_API_URL ||
  "http://localhost:3000/api";

// =====================================================
// HELPER USER
// =====================================================
const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const resolveCurrentUserId = () => {
  const currentUser = getCurrentUser();

  return (
    currentUser?.id ||
    currentUser?.user_id ||
    currentUser?.petani_id ||
    localStorage.getItem("user_id") ||
    localStorage.getItem("petani_id") ||
    null
  );
};

// =====================================================
// HELPER NORMALISASI
// =====================================================
const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const normalizeApiList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.notifications)) return payload.notifications;
  if (Array.isArray(payload?.data?.notifications)) {
    return payload.data.notifications;
  }

  return [];
};

const parsePositiveInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};

const isUnread = (item) => {
  if (typeof item?.unread === "boolean") {
    return item.unread;
  }

  const readValue = item?.is_read ?? item?.isRead;

  if (
    readValue === 0 ||
    readValue === false ||
    readValue === "0" ||
    readValue === "false"
  ) {
    return true;
  }

  if (
    readValue === 1 ||
    readValue === true ||
    readValue === "1" ||
    readValue === "true"
  ) {
    return false;
  }

  const status = normalizeText(
    item?.status ||
      item?.status_baca ||
      item?.read_status
  );

  return [
    "baru",
    "unread",
    "belum dibaca",
    "belum_dibaca",
  ].includes(status);
};

const getUrlParameters = (value) => {
  if (!value) return {};

  try {
    const url = new URL(String(value), window.location.origin);

    return {
      kalender_id: parsePositiveInteger(
        url.searchParams.get("event_id")
      ),
      lahan_id: parsePositiveInteger(
        url.searchParams.get("lahan_id")
      ),
      monitoring_id: parsePositiveInteger(
        url.searchParams.get("monitoring_id")
      ),
      tanggal_kegiatan:
        url.searchParams.get("tanggal") || null,
    };
  } catch {
    return {};
  }
};

const buildCalendarTarget = ({
  kalenderId,
  lahanId,
  monitoringId,
  tanggal,
}) => {
  const params = new URLSearchParams();

  if (kalenderId) {
    params.set("event_id", String(kalenderId));
  }

  if (lahanId) {
    params.set("lahan_id", String(lahanId));
  }

  if (monitoringId) {
    params.set("monitoring_id", String(monitoringId));
  }

  if (tanggal) {
    params.set("tanggal", String(tanggal).slice(0, 10));
  }

  const query = params.toString();
  return query
    ? `/petani/kalender?${query}`
    : "/petani/kalender";
};

const containsAny = (text, keywords) =>
  keywords.some((keyword) => text.includes(keyword));

const detectNotificationType = (item) => {
  const explicitType = normalizeText(
    item?.jenis ||
      item?.notification_type ||
      item?.tipe
  );

  const title = normalizeText(item?.judul || item?.title);
  const message = normalizeText(
    item?.pesan ||
      item?.message ||
      item?.deskripsi ||
      item?.isi
  );
  const link = normalizeText(
    item?.target_url ||
      item?.link ||
      item?.url ||
      item?.route
  );

  const warningMarkers = [
    "peringatan:",
    "perlu dipantau:",
    "perlu diperhatikan",
    "kekurangan air",
    "genangan berlebih",
    "risiko hama",
    "hama atau penyakit",
    "tanaman rebah",
    "daun menguning",
  ];

  if (
    containsAny(title, warningMarkers) ||
    containsAny(message, warningMarkers)
  ) {
    return "peringatan";
  }

  if (
    title.includes("jadwal") ||
    title.includes("kalender") ||
    link.includes("/petani/kalender")
  ) {
    return "jadwal";
  }

  if (
    ["peringatan", "jadwal", "informasi"].includes(
      explicitType
    )
  ) {
    return explicitType;
  }

  return "informasi";
};

const detectNotificationPriority = (item, type) => {
  const explicitPriority = normalizeText(
    item?.tingkat ||
      item?.severity ||
      item?.prioritas ||
      item?.priority
  );

  const title = normalizeText(item?.judul || item?.title);
  const message = normalizeText(
    item?.pesan ||
      item?.message ||
      item?.deskripsi ||
      item?.isi
  );

  const highPriorityMarkers = [
    "peringatan:",
    "risiko hama",
    "hama atau penyakit",
    "kekurangan air",
    "genangan berlebih",
    "tanaman rebah",
    "terserang",
    "drainase",
    "irigasi tambahan",
  ];

  const mediumPriorityMarkers = [
    "perlu dipantau:",
    "perlu diperhatikan",
    "pantau adaptasi",
    "pantau pertumbuhan",
    "daun menguning",
    "monitoring ulang",
  ];

  if (explicitPriority === "tinggi") {
    return "tinggi";
  }

  if (
    containsAny(title, highPriorityMarkers) ||
    containsAny(message, highPriorityMarkers)
  ) {
    return "tinggi";
  }

  if (explicitPriority === "sedang") {
    return "sedang";
  }

  if (
    containsAny(title, mediumPriorityMarkers) ||
    containsAny(message, mediumPriorityMarkers)
  ) {
    return "sedang";
  }

  if (explicitPriority === "rendah") {
    return "rendah";
  }

  if (type === "peringatan") {
    return "sedang";
  }

  return "rendah";
};

const normalizeNotificationTitle = ({
  title,
  type,
  priority,
}) => {
  const cleanTitle =
    String(title || "").trim() || "Notifikasi GeoPanen";
  const normalizedTitle = normalizeText(cleanTitle);

  if (
    normalizedTitle.startsWith("peringatan:") ||
    normalizedTitle.startsWith("perlu dipantau:")
  ) {
    return cleanTitle;
  }

  const isGenericMonitoringTitle =
    normalizedTitle === "monitoring tanaman disimpan" ||
    normalizedTitle === "monitoring tanaman tersimpan";

  if (priority === "tinggi") {
    return isGenericMonitoringTitle
      ? "Peringatan: Kondisi Tanaman Perlu Diperhatikan"
      : `Peringatan: ${cleanTitle}`;
  }

  if (priority === "sedang" && type === "peringatan") {
    return isGenericMonitoringTitle
      ? "Perlu Dipantau: Kondisi Tanaman"
      : `Perlu Dipantau: ${cleanTitle}`;
  }

  return cleanTitle;
};

const normalizeNotification = (item, index) => {
  const rawTarget =
    item?.target_url ||
    item?.link ||
    item?.url ||
    item?.route ||
    null;

  const rawTitle =
    item?.judul ||
    item?.title ||
    "Notifikasi GeoPanen";

  const rawMessage =
    item?.pesan ||
    item?.message ||
    item?.deskripsi ||
    item?.isi ||
    "Ada pembaruan informasi untuk Anda.";

  const urlParameters = getUrlParameters(rawTarget);
  const type = detectNotificationType(item);
  const priority = detectNotificationPriority(item, type);
  const normalizedTitle = normalizeNotificationTitle({
    title: rawTitle,
    type,
    priority,
  });

  const kalenderId =
    parsePositiveInteger(
      item?.kalender_id || item?.calendar_id
    ) || urlParameters.kalender_id;

  const lahanId =
    parsePositiveInteger(item?.lahan_id) ||
    urlParameters.lahan_id;

  const monitoringId =
    parsePositiveInteger(item?.monitoring_id) ||
    urlParameters.monitoring_id;

  const tanggalKegiatan =
    item?.tanggal_kegiatan ||
    item?.tanggal_rekomendasi ||
    urlParameters.tanggal_kegiatan ||
    null;

  const targetUrl =
    rawTarget ||
    (kalenderId || lahanId || monitoringId || tanggalKegiatan
      ? buildCalendarTarget({
          kalenderId,
          lahanId,
          monitoringId,
          tanggal: tanggalKegiatan,
        })
      : null);

  return {
    ...item,
    id:
      item?.id ??
      item?.notifikasi_id ??
      item?.notification_id ??
      `notification-${index}`,
    judul: normalizedTitle,
    pesan: rawMessage,
    jenis: type,
    tingkat: priority,
    kalender_id: kalenderId,
    lahan_id: lahanId,
    monitoring_id: monitoringId,
    tanggal_kegiatan: tanggalKegiatan,
    target_url: targetUrl,
    created_at:
      item?.created_at ||
      item?.sent_at ||
      item?.waktu_dibuat ||
      null,
    unread: isUnread(item),
  };
};

// =====================================================
// FORMAT TANGGAL
// =====================================================
const parseDate = (value) => {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatRelativeDate = (value) => {
  const date = parseDate(value);
  if (!date) return "Baru saja";

  const difference = Date.now() - date.getTime();

  if (difference <= 0) return "Baru saja";

  const minutes = Math.floor(difference / 60000);
  const hours = Math.floor(difference / 3600000);
  const days = Math.floor(difference / 86400000);

  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  if (hours < 24) return `${hours} jam lalu`;
  if (days === 1) return "Kemarin";
  if (days < 7) return `${days} hari lalu`;

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const formatActivityDate = (value) => {
  if (!value) return null;

  const dateText = String(value).slice(0, 10);
  const date = new Date(`${dateText}T00:00:00`);

  if (Number.isNaN(date.getTime())) return dateText;

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

// =====================================================
// TAMPILAN BERDASARKAN PRIORITAS
// =====================================================
const getNotificationAppearance = (item) => {
  if (item.tingkat === "tinggi") {
    return {
      icon: "!",
      label: "Peringatan Tinggi",
      className: "danger",
    };
  }

  if (
    item.tingkat === "sedang" ||
    item.jenis === "peringatan"
  ) {
    return {
      icon: "!",
      label: "Perlu Dipantau",
      className: "warning",
    };
  }

  if (item.jenis === "jadwal") {
    return {
      icon: "▣",
      label: "Jadwal kegiatan",
      className: "schedule",
    };
  }

  return {
    icon: "i",
    label: "Informasi",
    className: "information",
  };
};

const isPersistedNotificationId = (value) =>
  parsePositiveInteger(value) !== null;

const dispatchNotificationReadEvent = ({
  userId,
  notificationIds,
}) => {
  window.dispatchEvent(
    new CustomEvent("geopanen:notifikasi-dibaca", {
      detail: {
        userId: String(userId),
        notificationIds: notificationIds.map(String),
      },
    })
  );
};

const openTargetUrl = (targetUrl) => {
  if (!targetUrl) return;

  try {
    const resolved = new URL(
      String(targetUrl),
      window.location.origin
    );

    if (resolved.origin !== window.location.origin) {
      window.location.assign("/petani/kalender");
      return;
    }

    window.location.assign(
      `${resolved.pathname}${resolved.search}${resolved.hash}`
    );
  } catch {
    window.location.assign("/petani/kalender");
  }
};

// =====================================================
// COMPONENT
// =====================================================
export default function NotifikasiPetani() {
  const userId = resolveCurrentUserId();

  const [notifikasi, setNotifikasi] = useState([]);
  const [loading, setLoading] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [openingId, setOpeningId] = useState(null);
  const [error, setError] = useState("");

  const summary = useMemo(() => {
    return notifikasi.reduce(
      (result, item) => {
        result.total += 1;

        if (item.unread) {
          result.unread += 1;
        }

        if (
          item.jenis === "peringatan" &&
          ["tinggi", "sedang"].includes(item.tingkat)
        ) {
          result.warnings += 1;
        }

        return result;
      },
      {
        total: 0,
        unread: 0,
        warnings: 0,
      }
    );
  }, [notifikasi]);

  // ===================================================
  // LOAD NOTIFIKASI
  // Tidak otomatis mengubah status menjadi dibaca.
  // ===================================================
  const loadNotifikasi = useCallback(async () => {
    if (!userId) {
      setNotifikasi([]);
      setError(
        "ID petani tidak ditemukan. Silakan login ulang."
      );
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await axios.get(
        `${API}/notifikasi`,
        {
          params: {
            user_id: userId,
            petani_id: userId,
            role: "petani",
            limit: 100,
          },
        }
      );

      const data = normalizeApiList(response.data)
        .map(normalizeNotification)
        .sort((first, second) => {
          const firstTime =
            parseDate(first.created_at)?.getTime() || 0;
          const secondTime =
            parseDate(second.created_at)?.getTime() || 0;

          if (secondTime !== firstTime) {
            return secondTime - firstTime;
          }

          return Number(second.id || 0) - Number(first.id || 0);
        });

      setNotifikasi(data);
    } catch (requestError) {
      console.error(
        "ERROR LOAD NOTIFIKASI:",
        requestError.response?.data || requestError.message
      );

      setNotifikasi([]);
      setError(
        requestError.response?.data?.message ||
          "Notifikasi gagal dimuat. Pastikan backend berjalan."
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // ===================================================
  // TANDAI SATU NOTIFIKASI DIBACA
  // ===================================================
  const markNotificationAsRead = useCallback(
    async (notificationId) => {
      if (
        !userId ||
        !isPersistedNotificationId(notificationId)
      ) {
        return false;
      }

      const payload = {
        user_id: userId,
        petani_id: userId,
        role: "petani",
      };

      try {
        await axios.put(
          `${API}/notifikasi/${notificationId}/read`,
          payload
        );

        return true;
      } catch (putError) {
        const statusCode = putError.response?.status;

        if (statusCode !== 404 && statusCode !== 405) {
          console.error(
            "ERROR MARK READ:",
            putError.response?.data || putError.message
          );
          return false;
        }

        try {
          await axios.patch(
            `${API}/notifikasi/${notificationId}/read`,
            payload
          );

          return true;
        } catch (patchError) {
          console.error(
            "ERROR MARK READ:",
            patchError.response?.data || patchError.message
          );
          return false;
        }
      }
    },
    [userId]
  );

  // ===================================================
  // TANDAI SEMUA DIBACA SECARA MANUAL
  // ===================================================
  const markAllAsRead = useCallback(async () => {
    const unreadItems = notifikasi.filter(
      (item) =>
        item.unread &&
        isPersistedNotificationId(item.id)
    );

    if (unreadItems.length === 0 || !userId) {
      return;
    }

    const unreadIds = unreadItems.map((item) => item.id);
    const previousItems = notifikasi;

    setError("");
    setMarkingAllRead(true);
    setNotifikasi((current) =>
      current.map((item) =>
        unreadIds.some(
          (id) => String(id) === String(item.id)
        )
          ? {
              ...item,
              unread: false,
              is_read: 1,
              status: "dibaca",
            }
          : item
      )
    );

    const payload = {
      user_id: userId,
      petani_id: userId,
      role: "petani",
    };

    try {
      try {
        await axios.put(
          `${API}/notifikasi/read-all`,
          payload
        );
      } catch (putError) {
        const statusCode = putError.response?.status;

        if (statusCode !== 404 && statusCode !== 405) {
          throw putError;
        }

        await axios.patch(
          `${API}/notifikasi/read-all`,
          payload
        );
      }

      dispatchNotificationReadEvent({
        userId,
        notificationIds: unreadIds,
      });
    } catch (requestError) {
      console.error(
        "ERROR MARK ALL READ:",
        requestError.response?.data || requestError.message
      );

      setNotifikasi(previousItems);
      setError(
        requestError.response?.data?.message ||
          "Semua notifikasi belum berhasil ditandai sebagai dibaca."
      );
    } finally {
      setMarkingAllRead(false);
    }
  }, [notifikasi, userId]);

  // ===================================================
  // KLIK NOTIFIKASI
  // ===================================================
  const handleNotificationClick = useCallback(
    async (item) => {
      if (openingId !== null) return;

      setOpeningId(item.id);
      setError("");

      let readSucceeded = true;

      if (
        item.unread &&
        isPersistedNotificationId(item.id)
      ) {
        setNotifikasi((current) =>
          current.map((notification) =>
            String(notification.id) === String(item.id)
              ? {
                  ...notification,
                  unread: false,
                  is_read: 1,
                  status: "dibaca",
                }
              : notification
          )
        );

        readSucceeded = await markNotificationAsRead(
          item.id
        );

        if (readSucceeded) {
          dispatchNotificationReadEvent({
            userId,
            notificationIds: [item.id],
          });
        } else {
          setNotifikasi((current) =>
            current.map((notification) =>
              String(notification.id) === String(item.id)
                ? {
                    ...notification,
                    unread: true,
                    is_read: 0,
                    status: "baru",
                  }
                : notification
            )
          );
        }
      }

      if (!readSucceeded) {
        setError(
          "Status notifikasi belum berhasil diperbarui. Kegiatan tetap dapat dibuka."
        );
      }

      const targetUrl =
        item.target_url ||
        (item.kalender_id ||
        item.lahan_id ||
        item.monitoring_id ||
        item.tanggal_kegiatan
          ? buildCalendarTarget({
              kalenderId: item.kalender_id,
              lahanId: item.lahan_id,
              monitoringId: item.monitoring_id,
              tanggal: item.tanggal_kegiatan,
            })
          : null);

      if (targetUrl) {
        openTargetUrl(targetUrl);
        return;
      }

      setOpeningId(null);
    },
    [markNotificationAsRead, openingId, userId]
  );

  // ===================================================
  // LOAD AWAL DAN REFRESH SAAT KEMBALI KE TAB
  // ===================================================
  useEffect(() => {
    loadNotifikasi();
  }, [loadNotifikasi]);

  useEffect(() => {
    const handleWindowFocus = () => {
      loadNotifikasi();
    };

    const handleNewNotification = () => {
      loadNotifikasi();
    };

    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener(
      "geopanen:notifikasi-baru",
      handleNewNotification
    );

    return () => {
      window.removeEventListener(
        "focus",
        handleWindowFocus
      );
      window.removeEventListener(
        "geopanen:notifikasi-baru",
        handleNewNotification
      );
    };
  }, [loadNotifikasi]);

  return (
    <div className="notifikasi-page">
      <div className="page-header">
        <div className="title-row">
          <span className="title-icon" aria-hidden="true">
            !
          </span>

          <div>
            <h1>Notifikasi Petani</h1>
            <p>
              Peringatan kondisi tanaman dan tindak lanjut
              yang terhubung dengan kalender budidaya.
            </p>
          </div>
        </div>

        <div className="header-actions">
          {summary.unread > 0 && (
            <button
              type="button"
              className="secondary-button"
              onClick={markAllAsRead}
              disabled={loading || markingAllRead}
            >
              {markingAllRead
                ? "Memperbarui..."
                : "Tandai semua dibaca"}
            </button>
          )}

          <button
            type="button"
            className="refresh-button"
            onClick={loadNotifikasi}
            disabled={loading || markingAllRead}
          >
            {loading ? "Memuat..." : "Perbarui"}
          </button>
        </div>
      </div>

      <div className="summary-row">
        <div className="summary-card">
          <span>Total notifikasi</span>
          <strong>{summary.total}</strong>
        </div>

        <div className="summary-card unread-summary">
          <span>Belum dibaca</span>
          <strong>{summary.unread}</strong>
        </div>

        <div className="summary-card warning-summary">
          <span>Peringatan aktif</span>
          <strong>{summary.warnings}</strong>
        </div>
      </div>

      {error && (
        <div className="error-box" role="alert">
          <strong>Terjadi kendala.</strong>
          <span>{error}</span>
        </div>
      )}

      <section className="notif-card">
        <div className="notif-card-header">
          <div>
            <h2>Daftar Notifikasi</h2>
            <p>
              Notifikasi berubah menjadi dibaca setelah Anda
              membukanya atau menekan tombol tandai semua dibaca.
            </p>
          </div>
        </div>

        {loading && notifikasi.length === 0 ? (
          <div className="empty-box">
            <div className="loading-spinner" />
            <strong>Memuat notifikasi...</strong>
          </div>
        ) : notifikasi.length === 0 ? (
          <div className="empty-box">
            <div className="empty-icon" aria-hidden="true">
              i
            </div>
            <strong>Belum ada notifikasi</strong>
            <p>
              Peringatan hasil monitoring dan jadwal tindak
              lanjut akan tampil di halaman ini.
            </p>
          </div>
        ) : (
          <div className="notif-list">
            {notifikasi.map((item) => {
              const appearance =
                getNotificationAppearance(item);
              const activityDate = formatActivityDate(
                item.tanggal_kegiatan
              );
              const isOpening =
                String(openingId) === String(item.id);

              return (
                <button
                  type="button"
                  className={`notif-item ${
                    item.unread ? "notif-unread" : ""
                  } ${appearance.className}`}
                  key={item.id}
                  onClick={() =>
                    handleNotificationClick(item)
                  }
                  disabled={isOpening}
                  aria-label={`${item.judul}. ${item.pesan}`}
                  title={
                    item.target_url
                      ? "Buka tindak lanjut di kalender"
                      : item.judul
                  }
                >
                  <span
                    className={`notif-icon ${appearance.className}`}
                    aria-hidden="true"
                  >
                    {appearance.icon}
                  </span>

                  <span className="notif-content">
                    <span className="notif-title-row">
                      <strong className="notif-title">
                        {item.judul}
                      </strong>

                      <span
                        className={`type-badge ${appearance.className}`}
                      >
                        {appearance.label}
                      </span>
                    </span>

                    <span className="notif-message">
                      {item.pesan}
                    </span>

                    {activityDate && (
                      <span className="activity-date">
                        Jadwal tindak lanjut: {activityDate}
                      </span>
                    )}

                    <span className="notif-footer">
                      <small>
                        {formatRelativeDate(item.created_at)}
                      </small>

                      {item.target_url && (
                        <span
                          className={`calendar-action ${appearance.className}`}
                        >
                          {isOpening
                            ? "Membuka kalender..."
                            : "Lihat tindak lanjut"}
                        </span>
                      )}
                    </span>
                  </span>

                  <span
                    className={`read-badge ${
                      item.unread ? "unread" : "read"
                    }`}
                  >
                    {item.unread ? "Baru" : "Dibaca"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .notifikasi-page {
          min-height: 100vh;
          padding: 24px;
          background: #f6f8fb;
          color: #0f172a;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system,
            BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 18px;
        }

        .title-row {
          display: flex;
          align-items: center;
          gap: 13px;
          min-width: 0;
        }

        .title-icon {
          width: 46px;
          height: 46px;
          flex: 0 0 46px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #fdba74;
          border-radius: 14px;
          background: #fff7ed;
          color: #c2410c;
          font-size: 24px;
          font-weight: 900;
        }

        .page-header h1 {
          margin: 0;
          color: #071225;
          font-size: 29px;
          font-weight: 900;
          letter-spacing: -0.7px;
        }

        .page-header p {
          max-width: 640px;
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
          line-height: 1.5;
        }

        .header-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          flex-wrap: wrap;
        }

        .refresh-button,
        .secondary-button {
          min-height: 42px;
          padding: 0 17px;
          border-radius: 11px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          transition: opacity 0.18s ease, transform 0.18s ease;
        }

        .refresh-button {
          border: none;
          background: #16a34a;
          color: #ffffff;
          box-shadow: 0 8px 20px rgba(22, 163, 74, 0.18);
        }

        .secondary-button {
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #334155;
        }

        .refresh-button:hover:not(:disabled),
        .secondary-button:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .refresh-button:disabled,
        .secondary-button:disabled {
          cursor: not-allowed;
          opacity: 0.62;
        }

        .summary-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .summary-card {
          min-height: 78px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 5px;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          background: #ffffff;
        }

        .summary-card span {
          color: #64748b;
          font-size: 11px;
        }

        .summary-card strong {
          color: #0f172a;
          font-size: 20px;
          font-weight: 900;
        }

        .unread-summary {
          border-color: #bbf7d0;
          background: #f0fdf4;
        }

        .unread-summary strong {
          color: #15803d;
        }

        .warning-summary {
          border-color: #fed7aa;
          background: #fff7ed;
        }

        .warning-summary strong {
          color: #c2410c;
        }

        .error-box {
          margin-bottom: 16px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 3px;
          border: 1px solid #fecaca;
          border-radius: 12px;
          background: #fff1f2;
          color: #be123c;
          font-size: 12px;
          line-height: 1.5;
        }

        .notif-card {
          padding: 18px;
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          background: #ffffff;
          box-shadow: 0 12px 32px rgba(15, 23, 42, 0.06);
        }

        .notif-card-header {
          padding-bottom: 14px;
          margin-bottom: 14px;
          border-bottom: 1px solid #e5e7eb;
        }

        .notif-card-header h2 {
          margin: 0;
          color: #0f172a;
          font-size: 17px;
          font-weight: 900;
        }

        .notif-card-header p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 11px;
          line-height: 1.5;
        }

        .notif-list {
          display: grid;
          gap: 11px;
        }

        .notif-item {
          width: 100%;
          display: grid;
          grid-template-columns: 46px minmax(0, 1fr) auto;
          align-items: flex-start;
          gap: 13px;
          padding: 15px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          background: #ffffff;
          color: inherit;
          text-align: left;
          cursor: pointer;
          transition: border-color 0.18s ease,
            transform 0.18s ease,
            box-shadow 0.18s ease;
        }

        .notif-item:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.07);
        }

        .notif-item:disabled {
          cursor: wait;
          opacity: 0.75;
        }

        .notif-item.notif-unread.danger {
          border-color: #fca5a5;
          background: #fff7f7;
        }

        .notif-item.notif-unread.warning {
          border-color: #fdba74;
          background: #fffaf0;
        }

        .notif-item.notif-unread.schedule {
          border-color: #93c5fd;
          background: #f8fbff;
        }

        .notif-item.notif-unread.information {
          border-color: #86efac;
          background: #f0fdf4;
        }

        .notif-icon {
          width: 46px;
          height: 46px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 13px;
          font-size: 20px;
          font-weight: 900;
        }

        .notif-icon.danger {
          background: #fee2e2;
          color: #b91c1c;
        }

        .notif-icon.warning {
          background: #ffedd5;
          color: #c2410c;
        }

        .notif-icon.schedule {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .notif-icon.information {
          background: #dcfce7;
          color: #15803d;
        }

        .notif-content {
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .notif-title-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 6px;
        }

        .notif-title {
          color: #0f172a;
          font-size: 14px;
          font-weight: 900;
          line-height: 1.35;
        }

        .type-badge {
          display: inline-flex;
          align-items: center;
          min-height: 22px;
          padding: 3px 8px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 850;
          white-space: nowrap;
        }

        .type-badge.danger {
          background: #fee2e2;
          color: #b91c1c;
        }

        .type-badge.warning {
          background: #ffedd5;
          color: #c2410c;
        }

        .type-badge.schedule {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .type-badge.information {
          background: #dcfce7;
          color: #15803d;
        }

        .notif-message {
          color: #475569;
          font-size: 12px;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }

        .activity-date {
          margin-top: 8px;
          color: #334155;
          font-size: 11px;
          font-weight: 750;
        }

        .notif-footer {
          margin-top: 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .notif-footer small {
          color: #94a3b8;
          font-size: 10px;
        }

        .calendar-action {
          font-size: 11px;
          font-weight: 850;
        }

        .calendar-action.danger {
          color: #b91c1c;
        }

        .calendar-action.warning {
          color: #c2410c;
        }

        .calendar-action.schedule {
          color: #1d4ed8;
        }

        .calendar-action.information {
          color: #15803d;
        }

        .read-badge {
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 850;
          white-space: nowrap;
        }

        .read-badge.unread {
          background: #dcfce7;
          color: #047857;
        }

        .read-badge.read {
          background: #f1f5f9;
          color: #64748b;
        }

        .empty-box {
          min-height: 220px;
          padding: 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: #64748b;
        }

        .empty-box strong {
          color: #334155;
          font-size: 14px;
        }

        .empty-box p {
          max-width: 420px;
          margin: 7px 0 0;
          color: #94a3b8;
          font-size: 11px;
          line-height: 1.5;
        }

        .empty-icon {
          width: 44px;
          height: 44px;
          margin-bottom: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #f1f5f9;
          color: #64748b;
          font-size: 21px;
          font-weight: 900;
        }

        .loading-spinner {
          width: 32px;
          height: 32px;
          margin-bottom: 12px;
          border: 3px solid #dcfce7;
          border-top-color: #16a34a;
          border-radius: 50%;
          animation: notification-spin 0.75s linear infinite;
        }

        @keyframes notification-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 760px) {
          .notifikasi-page {
            padding: 16px;
          }

          .page-header {
            align-items: stretch;
            flex-direction: column;
          }

          .header-actions {
            display: grid;
            grid-template-columns: 1fr;
          }

          .refresh-button,
          .secondary-button {
            width: 100%;
          }

          .summary-row {
            grid-template-columns: 1fr;
          }

          .notif-item {
            grid-template-columns: 42px minmax(0, 1fr);
          }

          .notif-icon {
            width: 42px;
            height: 42px;
          }

          .read-badge {
            grid-column: 2;
            justify-self: start;
          }

          .notif-footer {
            align-items: flex-start;
            flex-direction: column;
            gap: 6px;
          }

          .page-header h1 {
            font-size: 24px;
          }
        }
      `}</style>
    </div>
  );
}
