import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import axios from "axios";

const API =
  import.meta.env.VITE_API_URL ||
  "http://localhost:3000/api";

// =====================================================
// HELPER USER
// =====================================================
const getCurrentUser = () => {
  try {
    return JSON.parse(
      localStorage.getItem("user") || "{}"
    );
  } catch {
    return {};
  }
};

// =====================================================
// NORMALISASI RESPONSE API
// =====================================================
const normalizeApiList = (payload) => {
  if (Array.isArray(payload)) return payload;

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.result)) {
    return payload.result;
  }

  if (Array.isArray(payload?.results)) {
    return payload.results;
  }

  if (Array.isArray(payload?.notifications)) {
    return payload.notifications;
  }

  if (
    Array.isArray(payload?.data?.notifications)
  ) {
    return payload.data.notifications;
  }

  return [];
};

// =====================================================
// CEK STATUS BELUM DIBACA
// =====================================================
const isUnread = (item) => {
  const readValue =
    item?.is_read ?? item?.isRead;

  if (
    readValue === 0 ||
    readValue === false ||
    readValue === "0" ||
    readValue === "false"
  ) {
    return true;
  }

  const status = String(
    item?.status ||
      item?.status_baca ||
      item?.read_status ||
      ""
  )
    .trim()
    .toLowerCase();

  return [
    "baru",
    "unread",
    "belum dibaca",
    "belum_dibaca",
  ].includes(status);
};

// =====================================================
// NORMALISASI ITEM NOTIFIKASI
// =====================================================
const normalizeNotification = (
  item,
  index
) => {
  return {
    ...item,

    id:
      item?.id ??
      item?.notifikasi_id ??
      item?.notification_id ??
      `notification-${index}`,

    judul:
      item?.judul ||
      item?.title ||
      item?.tipe ||
      item?.jenis ||
      "Notifikasi GeoPanen",

    pesan:
      item?.pesan ||
      item?.message ||
      item?.deskripsi ||
      item?.isi ||
      "Ada pembaruan informasi untuk Anda.",

    created_at:
      item?.created_at ||
      item?.tanggal ||
      item?.waktu ||
      item?.sent_at ||
      null,

    unread: isUnread(item),
  };
};

// =====================================================
// FORMAT TANGGAL DAN WAKTU
// =====================================================
const formatDate = (value) => {
  if (!value) return "Baru saja";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Baru saja";
  }

  const now = new Date();

  const difference =
    now.getTime() - date.getTime();

  const minutes = Math.floor(
    difference / 60000
  );

  const hours = Math.floor(
    difference / 3600000
  );

  const days = Math.floor(
    difference / 86400000
  );

  if (minutes < 1) {
    return "Baru saja";
  }

  if (minutes < 60) {
    return `${minutes} menit lalu`;
  }

  if (hours < 24) {
    return `${hours} jam lalu`;
  }

  if (days === 1) {
    return "Kemarin";
  }

  if (days < 7) {
    return `${days} hari lalu`;
  }

  return date.toLocaleDateString(
    "id-ID",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }
  );
};

// =====================================================
// COMPONENT
// =====================================================
export default function NotifikasiPetani() {
  const currentUser = getCurrentUser();

  const userId =
    currentUser?.id ||
    currentUser?.user_id ||
    currentUser?.petani_id ||
    localStorage.getItem("user_id") ||
    localStorage.getItem("petani_id") ||
    null;

  const [notifikasi, setNotifikasi] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [markingRead, setMarkingRead] =
    useState(false);

  const [error, setError] = useState("");

  // ===================================================
  // JUMLAH NOTIFIKASI
  // ===================================================
  const jumlahNotifikasi = notifikasi.length;

  const jumlahBelumDibaca = useMemo(() => {
    return notifikasi.filter(
      (item) => item.unread
    ).length;
  }, [notifikasi]);

  // ===================================================
  // REQUEST TANDAI SATU NOTIFIKASI DIBACA
  // ===================================================
  const markNotificationAsRead =
    useCallback(
      async (notificationId) => {
        if (!notificationId) {
          return false;
        }

        /*
          Endpoint utama:
          PUT /api/notifikasi/:id/read
        */
        try {
          await axios.put(
            `${API}/notifikasi/${notificationId}/read`,
            {
              user_id: userId,
              petani_id: userId,
              role: "petani",
            }
          );

          return true;
        } catch (putError) {
          const statusCode =
            putError.response?.status;

          /*
            Fallback PATCH apabila backend
            menggunakan method PATCH.
          */
          if (
            statusCode === 404 ||
            statusCode === 405
          ) {
            try {
              await axios.patch(
                `${API}/notifikasi/${notificationId}/read`,
                {
                  user_id: userId,
                  petani_id: userId,
                  role: "petani",
                }
              );

              return true;
            } catch (patchError) {
              console.log(
                "ERROR MARK READ:",
                patchError.response?.data ||
                  patchError.message
              );

              return false;
            }
          }

          console.log(
            "ERROR MARK READ:",
            putError.response?.data ||
              putError.message
          );

          return false;
        }
      },
      [userId]
    );

  // ===================================================
  // TANDAI SEMUA YANG BELUM DIBACA
  // ===================================================
  const markAllUnreadAsRead =
    useCallback(
      async (items) => {
        const unreadItems = items.filter(
          (item) =>
            item.unread && item.id
        );

        if (unreadItems.length === 0) {
          return true;
        }

        /*
          Optimistic update:
          status langsung menjadi Dibaca.
          Badge lonceng langsung hilang.
        */
        setNotifikasi((current) =>
          current.map((item) => {
            const found =
              unreadItems.some(
                (unreadItem) =>
                  String(unreadItem.id) ===
                  String(item.id)
              );

            if (!found) {
              return item;
            }

            return {
              ...item,
              unread: false,
              is_read: 1,
              isRead: true,
              status: "dibaca",
              read_at:
                new Date().toISOString(),
            };
          })
        );

        setMarkingRead(true);

        try {
          const responses =
            await Promise.allSettled(
              unreadItems.map((item) =>
                markNotificationAsRead(
                  item.id
                )
              )
            );

          const failedItems =
            unreadItems.filter(
              (_, index) => {
                const response =
                  responses[index];

                return (
                  response.status ===
                    "rejected" ||
                  response.value !== true
                );
              }
            );

          if (failedItems.length > 0) {
            setError(
              `${failedItems.length} notifikasi belum berhasil ditandai sebagai dibaca.`
            );

            return false;
          }

          /*
            Memberi tahu komponen lonceng
            bahwa notifikasi sudah dibaca.
          */
          window.dispatchEvent(
            new CustomEvent(
              "geopanen:notifikasi-dibaca",
              {
                detail: {
                  userId: String(userId),
                  notificationIds:
                    unreadItems.map(
                      (item) =>
                        String(item.id)
                    ),
                },
              }
            )
          );

          return true;
        } finally {
          setMarkingRead(false);
        }
      },
      [
        markNotificationAsRead,
        userId,
      ]
    );

  // ===================================================
  // LOAD NOTIFIKASI
  // ===================================================
  const loadNotifikasi =
    useCallback(async () => {
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
            },
          }
        );

        const data = normalizeApiList(
          response.data
        )
          .map(normalizeNotification)
          .sort((first, second) => {
            const firstTime = new Date(
              first.created_at || 0
            ).getTime();

            const secondTime = new Date(
              second.created_at || 0
            ).getTime();

            return (
              secondTime - firstTime
            );
          });

        setNotifikasi(data);

        /*
          Karena halaman Notifikasi sudah dibuka,
          semua notifikasi yang belum dibaca
          langsung ditandai sebagai dibaca.
        */
        await markAllUnreadAsRead(data);
      } catch (err) {
        console.log(
          "ERROR LOAD NOTIFIKASI:",
          err.response?.data ||
            err.message
        );

        setNotifikasi([]);

        setError(
          err.response?.data?.message ||
            "Notifikasi gagal dimuat. Pastikan backend berjalan."
        );
      } finally {
        setLoading(false);
      }
    }, [
      markAllUnreadAsRead,
      userId,
    ]);

  // ===================================================
  // LOAD SAAT HALAMAN DIBUKA
  // ===================================================
  useEffect(() => {
    loadNotifikasi();
  }, [loadNotifikasi]);

  // ===================================================
  // KLIK ITEM NOTIFIKASI
  // ===================================================
  const handleNotificationClick =
    async (item) => {
      if (item.unread) {
        setNotifikasi((current) =>
          current.map((notification) =>
            String(notification.id) ===
            String(item.id)
              ? {
                  ...notification,
                  unread: false,
                  is_read: 1,
                  status: "dibaca",
                }
              : notification
          )
        );

        await markNotificationAsRead(
          item.id
        );
      }

      const targetUrl =
        item?.url ||
        item?.link ||
        item?.target_url ||
        item?.route ||
        null;

      if (targetUrl) {
        window.location.href =
          targetUrl;
      }
    };

  return (
    <div className="notifikasi-page">
      {/* HEADER */}
      <div className="page-header">
        <div>
          <div className="title-row">
            <span className="title-icon">
              🔔
            </span>

            <div>
              <h1>Notifikasi Petani</h1>

              <p>
                Peringatan, rekomendasi,
                dan pembaruan untuk lahan
                Anda.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="refresh-button"
          onClick={loadNotifikasi}
          disabled={
            loading || markingRead
          }
        >
          {loading
            ? "Memuat..."
            : "↻ Perbarui"}
        </button>
      </div>

      {/* SUMMARY */}
      <div className="summary-row">
        <div className="summary-card">
          <span>Total notifikasi</span>
          <strong>
            {jumlahNotifikasi}
          </strong>
        </div>

        <div className="summary-card">
          <span>Belum dibaca</span>
          <strong>
            {jumlahBelumDibaca}
          </strong>
        </div>

        <div className="summary-card status-card">
          <span>Status</span>
          <strong>
            {markingRead
              ? "Memperbarui..."
              : jumlahBelumDibaca === 0
              ? "Semua dibaca"
              : "Ada notifikasi baru"}
          </strong>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="error-box">
          ⚠ {error}
        </div>
      )}

      {/* LIST */}
      <div className="notif-card">
        <div className="notif-card-header">
          <div>
            <h2>Daftar Notifikasi</h2>

            <p>
              Notifikasi otomatis dianggap
              dibaca saat halaman ini
              dibuka.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="empty-box">
            <div className="empty-icon">
              ⏳
            </div>

            <strong>
              Memuat notifikasi...
            </strong>
          </div>
        ) : notifikasi.length === 0 ? (
          <div className="empty-box">
            <div className="empty-icon">
              🔕
            </div>

            <strong>
              Belum ada notifikasi
            </strong>

            <p>
              Informasi baru akan tampil
              di halaman ini.
            </p>
          </div>
        ) : (
          <div className="notif-list">
            {notifikasi.map((item) => (
              <button
                type="button"
                className={`notif-item ${
                  item.unread
                    ? "notif-unread"
                    : ""
                }`}
                key={item.id}
                onClick={() =>
                  handleNotificationClick(
                    item
                  )
                }
              >
                <div className="notif-icon">
                  {item.unread
                    ? "🔔"
                    : "✓"}
                </div>

                <div className="notif-content">
                  <h3>
                    {item.judul}
                  </h3>

                  <p>{item.pesan}</p>

                  <small>
                    {formatDate(
                      item.created_at
                    )}
                  </small>
                </div>

                <span
                  className={`badge ${
                    item.unread
                      ? "unread"
                      : "read"
                  }`}
                >
                  {item.unread
                    ? "Baru"
                    : "Dibaca"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .notifikasi-page {
          min-height: 100vh;
          padding: 24px;
          background: #f6f8fb;
          color: #0f172a;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
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
        }

        .title-icon {
          width: 45px;
          height: 45px;
          border-radius: 14px;
          background: #ecfdf5;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 21px;
          border: 1px solid #bbf7d0;
        }

        .page-header h1 {
          margin: 0;
          color: #071225;
          font-size: 29px;
          font-weight: 900;
          letter-spacing: -0.7px;
        }

        .page-header p {
          margin: 5px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .refresh-button {
          min-width: 116px;
          height: 42px;
          padding: 0 17px;
          border: none;
          border-radius: 11px;
          background: #16a34a;
          color: #ffffff;
          font-size: 13px;
          font-weight: 850;
          cursor: pointer;
          box-shadow:
            0 8px 20px
            rgba(22, 163, 74, 0.18);
        }

        .refresh-button:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        .summary-row {
          display: grid;
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .summary-card {
          min-height: 76px;
          padding: 14px 16px;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 5px;
        }

        .summary-card span {
          color: #64748b;
          font-size: 11px;
        }

        .summary-card strong {
          color: #0f172a;
          font-size: 17px;
          font-weight: 900;
        }

        .status-card {
          border-color: #bbf7d0;
          background: #f0fdf4;
        }

        .status-card strong {
          color: #15803d;
        }

        .error-box {
          margin-bottom: 16px;
          padding: 12px 14px;
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
          box-shadow:
            0 12px 32px
            rgba(15, 23, 42, 0.06);
        }

        .notif-card-header {
          padding-bottom: 14px;
          margin-bottom: 14px;
          border-bottom:
            1px solid #e5e7eb;
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
        }

        .notif-list {
          display: grid;
          gap: 11px;
        }

        .notif-item {
          width: 100%;
          display: grid;
          grid-template-columns:
            45px minmax(0, 1fr) auto;
          align-items: flex-start;
          gap: 13px;
          padding: 15px;
          border:
            1px solid #e5e7eb;
          border-radius: 14px;
          background:
            linear-gradient(
              135deg,
              #ffffff,
              #f8fafc
            );
          text-align: left;
          cursor: pointer;
          transition:
            border-color 0.18s ease,
            transform 0.18s ease,
            box-shadow 0.18s ease;
        }

        .notif-item:hover {
          transform: translateY(-1px);
          border-color: #86efac;
          box-shadow:
            0 8px 20px
            rgba(15, 23, 42, 0.06);
        }

        .notif-item.notif-unread {
          border-color: #86efac;
          background: #f0fdf4;
        }

        .notif-icon {
          width: 45px;
          height: 45px;
          border-radius: 13px;
          background: #fef3c7;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #15803d;
          font-size: 19px;
          font-weight: 900;
        }

        .notif-content {
          min-width: 0;
        }

        .notif-content h3 {
          margin: 0 0 5px;
          color: #0f172a;
          font-size: 14px;
          font-weight: 900;
        }

        .notif-content p {
          margin: 0 0 8px;
          color: #475569;
          font-size: 12px;
          line-height: 1.5;
          overflow-wrap: anywhere;
        }

        .notif-content small {
          color: #94a3b8;
          font-size: 10px;
        }

        .badge {
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 850;
          white-space: nowrap;
        }

        .badge.unread {
          background: #dcfce7;
          color: #047857;
        }

        .badge.read {
          background: #f1f5f9;
          color: #64748b;
        }

        .empty-box {
          min-height: 210px;
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
          margin: 7px 0 0;
          color: #94a3b8;
          font-size: 11px;
        }

        .empty-icon {
          margin-bottom: 10px;
          font-size: 27px;
        }

        @media (max-width: 760px) {
          .notifikasi-page {
            padding: 16px;
          }

          .page-header {
            align-items: stretch;
            flex-direction: column;
          }

          .refresh-button {
            width: 100%;
          }

          .summary-row {
            grid-template-columns: 1fr;
          }

          .notif-item {
            grid-template-columns:
              42px minmax(0, 1fr);
          }

          .notif-item .badge {
            grid-column: 2;
            justify-self: start;
          }

          .page-header h1 {
            font-size: 24px;
          }
        }
      `}</style>
    </div>
  );
}