import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:3000/api";
const SERVER = "http://localhost:3000";

const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

const todayKey = () => {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const toDateKey = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
};

const formatDate = (value, withYear = true) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: withYear ? "numeric" : undefined,
  });
};

const formatDateShort = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatNumber = (value, digit = 2) => {
  const number = Number(value || 0);

  return number.toLocaleString("id-ID", {
    minimumFractionDigits: digit,
    maximumFractionDigits: digit,
  });
};

const normalizeStatus = (value = "") => {
  const raw = String(value || "").toLowerCase();

  if (
    raw.includes("selesai") ||
    raw.includes("closed") ||
    raw.includes("done")
  ) {
    return "Selesai";
  }

  if (
    raw.includes("dibalas") ||
    raw.includes("balas") ||
    raw.includes("sedang") ||
    raw.includes("ditangani") ||
    raw.includes("proses") ||
    raw.includes("process")
  ) {
    return "Sedang Ditangani";
  }

  return "Menunggu Dibalas";
};

const statusMeta = (status = "") => {
  const value = normalizeStatus(status);

  if (value === "Selesai") {
    return {
      label: "Selesai",
      bg: "#dcfce7",
      color: "#16a34a",
    };
  }

  if (value === "Sedang Ditangani") {
    return {
      label: "Sedang Ditangani",
      bg: "#dbeafe",
      color: "#2563eb",
    };
  }

  return {
    label: "Menunggu Dibalas",
    bg: "#ffedd5",
    color: "#f59e0b",
  };
};

const getInitials = (name = "Petani") => {
  return String(name)
    .split(" ")
    .filter(Boolean)
    .map((item) => item[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

const getAvatarColor = (name = "") => {
  const colors = ["#dcfce7", "#dbeafe", "#fee2e2", "#fef3c7", "#ede9fe"];
  const index = String(name).length % colors.length;
  return colors[index];
};

const getLastMessage = (item) => {
  return (
    item.pesan_terakhir ||
    item.last_message ||
    item.pesan ||
    item.topik ||
    item.judul ||
    "Belum ada pesan"
  );
};

const getLastMessageTime = (item) => {
  return (
    item.pesan_terakhir_at ||
    item.created_at ||
    item.tanggal ||
    item.waktu ||
    item.updated_at ||
    null
  );
};

const makeMessageKey = (item) => {
  return `${getLastMessageTime(item) || ""}|${getLastMessage(item) || ""}`;
};

const getFileHref = (url = "") => {
  if (!url) return "";
  if (String(url).startsWith("http")) return url;
  return `${SERVER}${url}`;
};

const isImageFile = (fileUrl = "", fileType = "") => {
  const lowerUrl = String(fileUrl || "").toLowerCase();
  const lowerType = String(fileType || "").toLowerCase();

  return (
    lowerType.startsWith("image/") ||
    lowerUrl.endsWith(".jpg") ||
    lowerUrl.endsWith(".jpeg") ||
    lowerUrl.endsWith(".png") ||
    lowerUrl.endsWith(".webp")
  );
};

const getReadStorageKey = (penyuluhId) => {
  return `geopanen_penyuluh_konsultasi_read_${penyuluhId || "guest"}`;
};

const readLocalReadMap = (penyuluhId) => {
  try {
    return JSON.parse(localStorage.getItem(getReadStorageKey(penyuluhId)) || "{}");
  } catch {
    return {};
  }
};

const saveLocalReadMap = (penyuluhId, data) => {
  try {
    localStorage.setItem(getReadStorageKey(penyuluhId), JSON.stringify(data || {}));
  } catch {
    // abaikan error localStorage
  }
};

const markReadOnServer = async (konsultasiId) => {
  if (!konsultasiId) return false;

  const routes = [
    { method: "patch", url: `${API}/konsultasi/${konsultasiId}/read` },
    { method: "put", url: `${API}/konsultasi/${konsultasiId}/read` },
    { method: "post", url: `${API}/konsultasi/${konsultasiId}/read` },
    { method: "patch", url: `${API}/konsultasi/${konsultasiId}/pesan/read` },
    { method: "patch", url: `${API}/konsultasi/${konsultasiId}/baca` },
  ];

  for (const route of routes) {
    try {
      await axios[route.method](route.url);
      return true;
    } catch {
      // coba route berikutnya
    }
  }

  return false;
};

const quickReplies = [
  "Rekomendasi Pupuk",
  "Pengendalian Hama",
  "Pengairan",
  "Penyakit Tanaman",
];

export default function PenyuluhKonsultasi() {
  const navigate = useNavigate();

  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  const user = getUser();

  const penyuluhId =
    localStorage.getItem("user_id") ||
    localStorage.getItem("penyuluh_id") ||
    user?.id;

  const namaPenyuluh =
    user?.nama || localStorage.getItem("nama") || "Penyuluh";

  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [pesanList, setPesanList] = useState([]);
  const [pesan, setPesan] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingPesan, setLoadingPesan] = useState(false);
  const [sending, setSending] = useState(false);

  const [activeTab, setActiveTab] = useState("Semua");
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("Semua Status");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [localReadMap, setLocalReadMap] = useState(() =>
    readLocalReadMap(penyuluhId)
  );

  const PAGE_SIZE = 8;

  useEffect(() => {
    saveLocalReadMap(penyuluhId, localReadMap);
  }, [penyuluhId, localReadMap]);

  const markRowsReadLocally = (rows = []) => {
    if (!Array.isArray(rows) || rows.length === 0) return;

    setLocalReadMap((prev) => {
      const next = { ...prev };

      rows.forEach((item) => {
        if (!item?.id) return;

        next[String(item.id)] = {
          messageKey: item.last_message_key || makeMessageKey(item),
          readAt: new Date().toISOString(),
        };
      });

      return next;
    });
  };

  const markOneReadLocally = (konsultasiId) => {
    if (!konsultasiId) return;

    const item =
      list.find((row) => String(row.id) === String(konsultasiId)) || selected;

    setLocalReadMap((prev) => ({
      ...prev,
      [String(konsultasiId)]: {
        messageKey: item ? makeMessageKey(item) : "",
        readAt: new Date().toISOString(),
      },
    }));
  };

  const loadKonsultasi = async () => {
    try {
      setLoadingList(true);

      const res = await axios.get(`${API}/konsultasi/penyuluh/${penyuluhId}`);
      const data = normalizeList(res.data);

      setList(data);

      setSelected((prev) => {
        if (prev?.id) {
          const same = data.find((item) => String(item.id) === String(prev.id));
          if (same) return same;
        }

        return data[0] || null;
      });
    } catch (err) {
      console.log("ERROR LOAD KONSULTASI:", err.response?.data || err.message);
      setList([]);
      setSelected(null);
    } finally {
      setLoadingList(false);
    }
  };

  const loadPesan = async (konsultasiId) => {
    try {
      setLoadingPesan(true);

      const res = await axios.get(`${API}/konsultasi/${konsultasiId}/pesan`);
      const data = normalizeList(res.data);

      setPesanList(data);

      const unreadFromPetani = data.filter(
        (item) =>
          String(item.sender_role || "").toLowerCase() === "petani" &&
          Number(item.is_read || 0) === 0
      );

      if (unreadFromPetani.length > 0) {
        markOneReadLocally(konsultasiId);

        const serverOk = await markReadOnServer(konsultasiId);

        if (!serverOk) {
          console.log(
            "Backend belum berhasil menandai pesan sebagai dibaca. Badge disembunyikan sementara memakai localStorage."
          );
        }

        await loadKonsultasi();
      }
    } catch (err) {
      console.log("ERROR LOAD PESAN:", err.response?.data || err.message);
      setPesanList([]);
    } finally {
      setLoadingPesan(false);
    }
  };

  useEffect(() => {
    if (!penyuluhId) return;

    loadKonsultasi();

    const interval = setInterval(() => {
      loadKonsultasi();
    }, 5000);

    return () => clearInterval(interval);
  }, [penyuluhId]);

  useEffect(() => {
    if (!selected?.id) {
      setPesanList([]);
      return;
    }

    loadPesan(selected.id);

    const interval = setInterval(() => {
      loadPesan(selected.id);
    }, 5000);

    return () => clearInterval(interval);
  }, [selected?.id]);

  const normalizedList = useMemo(() => {
    return list.map((item) => {
      const status = normalizeStatus(item.status);
      const createdAt = getLastMessageTime(item);
      const pesanTerakhir = getLastMessage(item);
      const messageKey = makeMessageKey(item);
      const rawUnread =
        Number(item.unread_count || item.jumlah_belum_dibaca || 0) || 0;

      const localRead = localReadMap[String(item.id)];
      const alreadyReadLocally =
        localRead && localRead.messageKey === messageKey;

      const finalUnread = alreadyReadLocally ? 0 : rawUnread;

      return {
        ...item,
        status_label: status,
        created_at_safe: createdAt,
        last_message_key: messageKey,
        raw_unread_count: rawUnread,
        nama_petani:
          item.nama_petani ||
          item.petani ||
          item.nama ||
          `Petani ${item.petani_id || ""}`,
        no_hp: item.no_hp || item.telepon || item.hp || "0896-xxxx-3456",
        foto_url: item.foto_url || item.foto_petani || "",
        nama_lahan: item.nama_lahan || item.lahan || "-",
        nama_desa: item.nama_desa || item.desa || "-",
        nama_kecamatan: item.nama_kecamatan || item.kecamatan || "-",
        varietas: item.varietas || "-",
        luas_ha: item.luas_ha || item.luas || 0,
        fase_tanam: item.fase_tanam || item.fase_tanaman || "Vegetatif Awal",
        umur_tanam: item.umur_tanam || item.umur_tanaman || item.umur || 0,
        unread_count: finalUnread,
        pesan_terakhir: pesanTerakhir,
      };
    });
  }, [list, localReadMap]);

  const totalKonsultasi = normalizedList.length;

  const totalMenunggu = normalizedList.filter(
    (item) => item.status_label === "Menunggu Dibalas"
  ).length;

  const totalSedang = normalizedList.filter(
    (item) => item.status_label === "Sedang Ditangani"
  ).length;

  const totalSelesai = normalizedList.filter(
    (item) => item.status_label === "Selesai"
  ).length;

  const totalHariIni = normalizedList.filter(
    (item) => toDateKey(item.created_at_safe) === todayKey()
  ).length;

  const totalUnread = normalizedList.reduce(
    (sum, item) => sum + Number(item.unread_count || 0),
    0
  );

  const unreadConsultations = useMemo(() => {
    return normalizedList.filter((item) => Number(item.unread_count || 0) > 0);
  }, [normalizedList]);

  const handleBellClick = async () => {
    if (totalUnread <= 0) {
      setShowUnreadOnly(false);
      alert("Tidak ada pesan konsultasi yang belum dibaca.");
      return;
    }

    const rowsToRead = unreadConsultations;

    if (rowsToRead.length > 0) {
      setSelected(rowsToRead[0]);
    }

    markRowsReadLocally(rowsToRead);

    setShowUnreadOnly(false);
    setActiveTab("Semua");
    setSelectedStatus("Semua Status");
    setSearch("");
    setPage(1);

    const results = await Promise.allSettled(
      rowsToRead.map((item) => markReadOnServer(item.id))
    );

    const adaYangGagal = results.some(
      (item) => item.status === "fulfilled" && item.value === false
    );

    if (adaYangGagal) {
      console.log(
        "Sebagian pesan belum berhasil ditandai dibaca di backend. Tampilan tetap disimpan di localStorage."
      );
    }

    await loadKonsultasi();
  };

  const filteredList = useMemo(() => {
    return normalizedList.filter((item) => {
      const q = search.toLowerCase();

      const matchSearch =
        !q ||
        item.nama_petani.toLowerCase().includes(q) ||
        item.nama_lahan.toLowerCase().includes(q) ||
        item.nama_desa.toLowerCase().includes(q) ||
        item.nama_kecamatan.toLowerCase().includes(q) ||
        item.pesan_terakhir.toLowerCase().includes(q);

      const matchTab =
        activeTab === "Semua" || item.status_label === activeTab;

      const matchStatus =
        selectedStatus === "Semua Status" ||
        item.status_label === selectedStatus;

      const matchUnread =
        !showUnreadOnly || Number(item.unread_count || 0) > 0;

      return matchSearch && matchTab && matchStatus && matchUnread;
    });
  }, [normalizedList, search, activeTab, selectedStatus, showUnreadOnly]);

  const totalPages = Math.max(1, Math.ceil(filteredList.length / PAGE_SIZE));

  const paginatedList = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredList.slice(start, start + PAGE_SIZE);
  }, [filteredList, page]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, search, selectedStatus, showUnreadOnly]);

  const selectedFull = useMemo(() => {
    if (!selected?.id) return null;

    return (
      normalizedList.find((item) => String(item.id) === String(selected.id)) ||
      selected
    );
  }, [selected, normalizedList]);

  const riwayatSelectedPetani = useMemo(() => {
    if (!selectedFull?.petani_id) return [];

    return normalizedList
      .filter(
        (item) => String(item.petani_id) === String(selectedFull.petani_id)
      )
      .sort(
        (a, b) =>
          new Date(b.created_at_safe || 0) - new Date(a.created_at_safe || 0)
      )
      .slice(0, 3);
  }, [normalizedList, selectedFull]);

  const statistikSelectedPetani = useMemo(() => {
    if (!selectedFull?.petani_id) {
      return {
        total: 0,
        selesai: 0,
        sedang: 0,
        menunggu: 0,
      };
    }

    const rows = normalizedList.filter(
      (item) => String(item.petani_id) === String(selectedFull.petani_id)
    );

    return {
      total: rows.length,
      selesai: rows.filter((item) => item.status_label === "Selesai").length,
      sedang: rows.filter((item) => item.status_label === "Sedang Ditangani")
        .length,
      menunggu: rows.filter((item) => item.status_label === "Menunggu Dibalas")
        .length,
    };
  }, [normalizedList, selectedFull]);

  const applyQuickReply = (type) => {
    if (!selectedFull) return;

    const petani = selectedFull.nama_petani || "Petani";
    const lahan = selectedFull.nama_lahan || "lahan";
    const varietas = selectedFull.varietas || "padi";
    const fase = selectedFull.fase_tanam || "fase saat ini";
    const umur = selectedFull.umur_tanam || 0;

    const templates = {
      "Rekomendasi Pupuk": `Baik Pak/Bu ${petani}, untuk ${lahan} varietas ${varietas} pada fase ${fase} umur ${umur} HST, saya sarankan pemupukan dilakukan bertahap sesuai kebutuhan tanaman. Pastikan tanah cukup lembap sebelum pemupukan.`,

      "Pengendalian Hama": `Baik Pak/Bu ${petani}, segera pantau kondisi daun dan batang pada ${lahan}. Jika gejala hama meningkat, lakukan pengendalian sesuai ambang kendali dan hindari penyemprotan berlebihan.`,

      Pengairan: `Baik Pak/Bu ${petani}, untuk ${lahan}, pastikan pengairan cukup dan tidak terjadi genangan berlebihan. Kondisi air perlu disesuaikan dengan fase ${fase}.`,

      "Penyakit Tanaman": `Baik Pak/Bu ${petani}, lakukan pengecekan gejala penyakit pada daun dan batang. Jika gejala menyebar, segera lakukan sanitasi lahan dan pengendalian sesuai rekomendasi.`,
    };

    setPesan(templates[type] || `${type}: `);
  };

  const handleFilePick = (e) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);

    if (fileInputRef.current) fileInputRef.current.value = "";
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const kirimPesan = async () => {
    if (!selected?.id) {
      alert("Pilih konsultasi terlebih dahulu");
      return;
    }

    if (!pesan.trim() && !selectedFile) {
      alert("Pesan atau lampiran tidak boleh kosong");
      return;
    }

    try {
      setSending(true);

      if (selectedFile) {
        const formData = new FormData();

        formData.append("sender_id", penyuluhId);
        formData.append("sender_role", "penyuluh");
        formData.append("pesan", pesan);
        formData.append("file", selectedFile);

        await axios.post(
          `${API}/konsultasi/${selected.id}/pesan/upload`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
      } else {
        await axios.post(`${API}/konsultasi/${selected.id}/pesan`, {
          sender_id: penyuluhId,
          sender_role: "penyuluh",
          pesan,
        });
      }

      setPesan("");
      clearSelectedFile();

      await loadPesan(selected.id);
      await loadKonsultasi();
    } catch (err) {
      console.log("ERROR KIRIM PESAN:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Gagal mengirim pesan");
    } finally {
      setSending(false);
    }
  };

  const selesaiKonsultasi = async () => {
    if (!selected?.id) return;

    const yakin = window.confirm("Tandai konsultasi ini selesai?");

    if (!yakin) return;

    try {
      await axios.patch(`${API}/konsultasi/${selected.id}/selesai`);
      await loadKonsultasi();
      await loadPesan(selected.id);
    } catch (err) {
      console.log("ERROR SELESAI:", err.response?.data || err.message);
      alert("Gagal menyelesaikan konsultasi");
    }
  };

  const headerDate = formatDate(new Date());

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerTitle}>
          <div style={styles.headerIcon}>👨‍🌾</div>
          <div>
            <h1>Konsultasi Petani</h1>
            <p>
              Kelola konsultasi dan berikan solusi terbaik untuk petani binaan
              Anda
            </p>
          </div>
        </div>

        <div style={styles.headerRight}>
          <div style={styles.dateChip}>📅 {headerDate}</div>

          <button
            style={styles.bellBtn}
            type="button"
            title="Tandai pesan konsultasi sebagai dibaca"
            onClick={handleBellClick}
          >
            🔔
            {totalUnread > 0 && (
              <span style={styles.bellBadge}>{totalUnread}</span>
            )}
          </button>

          <button style={styles.profileChip} type="button">
            <div style={styles.profileAvatar}>👨‍💼</div>
            <div>
              <strong>{namaPenyuluh}</strong>
              <small>Penyuluh</small>
            </div>
            <b>⌄</b>
          </button>
        </div>
      </header>

      <section style={styles.kpiGrid}>
        <KpiCard
          title="Total Konsultasi"
          value={totalKonsultasi}
          desc="Semua konsultasi"
          icon="💬"
          color="#16a34a"
          bg="#dcfce7"
        />

        <KpiCard
          title="Menunggu Dibalas"
          value={totalMenunggu}
          desc="Perlu perhatian"
          icon="⏰"
          color="#f59e0b"
          bg="#ffedd5"
        />

        <KpiCard
          title="Sedang Ditangani"
          value={totalSedang}
          desc="Dalam proses"
          icon="👥"
          color="#2563eb"
          bg="#dbeafe"
        />

        <KpiCard
          title="Selesai"
          value={totalSelesai}
          desc="Konsultasi selesai"
          icon="✅"
          color="#16a34a"
          bg="#dcfce7"
        />

        <KpiCard
          title="Konsultasi Hari Ini"
          value={totalHariIni}
          desc="Baru masuk hari ini"
          icon="🗓️"
          color="#7c3aed"
          bg="#ede9fe"
        />
      </section>

      <main style={styles.mainGrid}>
        <aside style={styles.leftPanel}>
          <div style={styles.tabs}>
            {[
              { label: "Semua", count: totalKonsultasi },
              { label: "Menunggu Dibalas", count: totalMenunggu },
              { label: "Sedang Ditangani", count: totalSedang },
              { label: "Selesai", count: totalSelesai },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setActiveTab(item.label);
                  setShowUnreadOnly(false);
                }}
                style={{
                  ...styles.tabBtn,
                  ...(activeTab === item.label ? styles.tabActive : {}),
                }}
              >
                {item.label}
                {item.label !== "Semua" && ` (${item.count})`}
              </button>
            ))}
          </div>

          <div style={styles.filterRow}>
            <div style={styles.searchBox}>
              🔍
              <input
                placeholder="Cari nama petani atau topik..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              style={styles.statusSelect}
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option>Semua Status</option>
              <option>Menunggu Dibalas</option>
              <option>Sedang Ditangani</option>
              <option>Selesai</option>
            </select>

            <button style={styles.filterIconBtn} type="button">
              ⚗️
            </button>
          </div>

          <div style={styles.konsultasiList}>
            {loadingList ? (
              <div style={styles.emptyList}>Memuat konsultasi...</div>
            ) : paginatedList.length === 0 ? (
              <div style={styles.emptyList}>Belum ada konsultasi.</div>
            ) : (
              paginatedList.map((item) => {
                const status = statusMeta(item.status_label);
                const active = String(selectedFull?.id) === String(item.id);

                return (
                  <button
                    key={item.id}
                    type="button"
                    style={{
                      ...styles.chatItem,
                      ...(active ? styles.chatItemActive : {}),
                    }}
                    onClick={() => setSelected(item)}
                  >
                    <Avatar
                      name={item.nama_petani}
                      src={item.foto_url}
                      size={42}
                    />

                    <div style={styles.chatItemBody}>
                      <div style={styles.chatItemHead}>
                        <strong>{item.nama_petani}</strong>
                        <span
                          style={{
                            ...styles.statusBadge,
                            background: status.bg,
                            color: status.color,
                          }}
                        >
                          {status.label}
                        </span>
                      </div>

                      <p>{item.pesan_terakhir}</p>

                      <small>
                        {toDateKey(item.created_at_safe) === todayKey()
                          ? `${formatTime(item.created_at_safe)} WIB`
                          : formatDateShort(item.created_at_safe)}
                      </small>
                    </div>

                    {item.unread_count > 0 && (
                      <b style={styles.unreadBadge}>{item.unread_count}</b>
                    )}

                    {item.status_label === "Selesai" && (
                      <b style={styles.doneCheck}>✓</b>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div style={styles.paginationRow}>
            <small>
              Menampilkan{" "}
              {filteredList.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} -{" "}
              {Math.min(page * PAGE_SIZE, filteredList.length)} dari{" "}
              {filteredList.length} konsultasi
            </small>

            <div style={styles.paginationBtns}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                ‹
              </button>

              {Array.from({ length: Math.min(totalPages, 3) }).map(
                (_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setPage(index + 1)}
                    style={page === index + 1 ? styles.pageActive : {}}
                  >
                    {index + 1}
                  </button>
                )
              )}

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((prev) => Math.min(totalPages, prev + 1))
                }
              >
                ›
              </button>
            </div>
          </div>
        </aside>

        <section style={styles.chatPanel}>
          {selectedFull ? (
            <>
              <div style={styles.chatHeader}>
                <div style={styles.chatHeaderLeft}>
                  <Avatar
                    name={selectedFull.nama_petani}
                    src={selectedFull.foto_url}
                    size={50}
                  />

                  <div>
                    <h2>{selectedFull.nama_petani}</h2>

                    <div style={styles.chatMetaLine}>
                      <span>{selectedFull.no_hp}</span>
                      <span>
                        📍 Ds. {selectedFull.nama_desa}, Kec.{" "}
                        {selectedFull.nama_kecamatan}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={styles.chatHeaderRight}>
                  <span
                    style={{
                      ...styles.statusBadge,
                      background: statusMeta(selectedFull.status_label).bg,
                      color: statusMeta(selectedFull.status_label).color,
                    }}
                  >
                    {selectedFull.status_label}
                  </span>

                  <small>{formatTime(selectedFull.created_at_safe)} WIB</small>
                </div>
              </div>

              <div style={styles.lahanInfoStrip}>
                <span>
                  Lahan: <b>{selectedFull.nama_lahan}</b>
                </span>
                <span>
                  Varietas: <b>{selectedFull.varietas}</b>
                </span>
                <span>
                  Luas: <b>{formatNumber(selectedFull.luas_ha, 2)} Ha</b>
                </span>
                <span>
                  Fase:{" "}
                  <b>
                    {selectedFull.fase_tanam} ({selectedFull.umur_tanam} HST)
                  </b>
                </span>
              </div>

              <div style={styles.messageArea}>
                {loadingPesan ? (
                  <div style={styles.emptyChat}>Memuat pesan...</div>
                ) : pesanList.length === 0 ? (
                  <div style={styles.emptyChat}>
                    Belum ada pesan pada konsultasi ini.
                  </div>
                ) : (
                  pesanList.map((item) => {
                    const isMe =
                      String(item.sender_role || "").toLowerCase() ===
                      "penyuluh";

                    const fileUrl =
                      item.file_url ||
                      item.lampiran_url ||
                      item.dokumen_url ||
                      "";

                    const fileHref = getFileHref(fileUrl);
                    const image = isImageFile(fileUrl, item.file_type);

                    return (
                      <div
                        key={item.id}
                        style={{
                          ...styles.messageBlock,
                          alignSelf: isMe ? "flex-end" : "flex-start",
                        }}
                      >
                        <div
                          style={{
                            ...styles.messageBubble,
                            ...(isMe
                              ? styles.messageMe
                              : styles.messageOther),
                          }}
                        >
                          <strong>
                            {isMe
                              ? "Saya"
                              : item.nama_pengirim ||
                                selectedFull.nama_petani}
                          </strong>

                          {item.pesan && <p>{item.pesan}</p>}

                          {fileUrl && image && (
                            <a
                              href={fileHref}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <img
                                src={fileHref}
                                alt={item.file_name || "Lampiran"}
                                style={styles.messageImage}
                              />
                            </a>
                          )}

                          {fileUrl && !image && (
                            <a
                              href={fileHref}
                              target="_blank"
                              rel="noreferrer"
                              style={styles.attachmentBox}
                            >
                              📎 {item.file_name || "Lampiran Konsultasi"}
                            </a>
                          )}

                          <small>
                            {formatTime(item.created_at)} WIB
                            {isMe && <span> ✓✓</span>}
                          </small>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div style={styles.quickReplyRow}>
                {quickReplies.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => applyQuickReply(item)}
                  >
                    💬 {item}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setPesan(
                      `Baik Pak/Bu ${selectedFull.nama_petani}, saya akan cek kembali kondisi ${selectedFull.nama_lahan}.`
                    )
                  }
                >
                  Lainnya ⌄
                </button>
              </div>

              {selectedFile && (
                <div style={styles.filePreview}>
                  <span>📎 {selectedFile.name}</span>
                  <button type="button" onClick={clearSelectedFile}>
                    Hapus
                  </button>
                </div>
              )}

              <div style={styles.inputRow}>
                <input
                  value={pesan}
                  onChange={(e) => setPesan(e.target.value)}
                  placeholder="Tulis balasan penyuluh..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") kirimPesan();
                  }}
                />

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  hidden
                  onChange={handleFilePick}
                />

                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleFilePick}
                />

                <button
                  style={styles.inputIconBtn}
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  📎
                </button>

                <button
                  style={styles.inputIconBtn}
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                >
                  🖼️
                </button>

                <button
                  type="button"
                  onClick={kirimPesan}
                  disabled={sending}
                  style={{
                    ...styles.sendBtn,
                    opacity: sending ? 0.7 : 1,
                    cursor: sending ? "not-allowed" : "pointer",
                  }}
                >
                  {sending ? "..." : "Kirim"}
                </button>
              </div>
            </>
          ) : (
            <div style={styles.emptyChat}>
              Pilih konsultasi masuk terlebih dahulu.
            </div>
          )}
        </section>

        <aside style={styles.rightPanel}>
          <section style={styles.sideCard}>
            <h3>Informasi Petani</h3>

            {selectedFull ? (
              <>
                <div style={styles.petaniInfo}>
                  <Avatar
                    name={selectedFull.nama_petani}
                    src={selectedFull.foto_url}
                    size={62}
                  />

                  <div>
                    <strong>{selectedFull.nama_petani}</strong>
                    <small>{selectedFull.no_hp}</small>
                    <small>
                      Ds. {selectedFull.nama_desa}, Kec.{" "}
                      {selectedFull.nama_kecamatan}
                    </small>
                  </div>
                </div>

                <button
                  style={styles.sideOutlineBtn}
                  type="button"
                  onClick={() =>
                    navigate(
                      `/penyuluh/petani-binaan?petani_id=${selectedFull.petani_id}`
                    )
                  }
                >
                  Lihat Profil Petani →
                </button>
              </>
            ) : (
              <div style={styles.emptySmall}>Belum ada data petani.</div>
            )}
          </section>

          <section style={styles.sideCard}>
            <h3>Data Lahan Terkait</h3>

            {selectedFull ? (
              <div style={styles.lahanDetailList}>
                <DetailRow
                  icon="🌾"
                  label="Lahan"
                  value={selectedFull.nama_lahan}
                />
                <DetailRow
                  icon="💠"
                  label="Varietas"
                  value={selectedFull.varietas}
                />
                <DetailRow
                  icon="📏"
                  label="Luas Lahan"
                  value={`${formatNumber(selectedFull.luas_ha, 2)} Ha`}
                />
                <DetailRow
                  icon="♻️"
                  label="Fase Tanam"
                  value={`${selectedFull.fase_tanam} (${selectedFull.umur_tanam} HST)`}
                />

                <button
                  style={styles.sideOutlineBtn}
                  type="button"
                  onClick={() => navigate("/penyuluh/peta-binaan")}
                >
                  Lihat Detail Lahan →
                </button>
              </div>
            ) : (
              <div style={styles.emptySmall}>Belum ada data lahan.</div>
            )}
          </section>

          <section style={styles.sideCard}>
            <div style={styles.sideTitleRow}>
              <h3>Riwayat Konsultasi Petani</h3>
              <button
                type="button"
                onClick={() => {
                  setSearch(selectedFull?.nama_petani || "");
                  setActiveTab("Semua");
                  setShowUnreadOnly(false);
                }}
              >
                Lihat Semua
              </button>
            </div>

            <div style={styles.historyList}>
              {riwayatSelectedPetani.length === 0 ? (
                <div style={styles.emptySmall}>Belum ada riwayat.</div>
              ) : (
                riwayatSelectedPetani.map((item) => {
                  const meta = statusMeta(item.status_label);

                  return (
                    <div key={item.id} style={styles.historyItem}>
                      <span>📋</span>

                      <div>
                        <strong>{item.pesan_terakhir}</strong>
                        <small>{formatDateShort(item.created_at_safe)}</small>
                      </div>

                      <em style={{ background: meta.bg, color: meta.color }}>
                        {meta.label}
                      </em>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section style={styles.sideCard}>
            <h3>Statistik Konsultasi Petani</h3>

            <div style={styles.statList}>
              <DetailRow
                icon="💬"
                label="Total Konsultasi"
                value={statistikSelectedPetani.total}
              />
              <DetailRow
                icon="✅"
                label="Selesai"
                value={statistikSelectedPetani.selesai}
              />
              <DetailRow
                icon="👥"
                label="Sedang Ditangani"
                value={statistikSelectedPetani.sedang}
              />
              <DetailRow
                icon="⏰"
                label="Menunggu Dibalas"
                value={statistikSelectedPetani.menunggu}
              />
            </div>

            <button
              style={styles.sideOutlineBtn}
              type="button"
              onClick={() =>
                navigate(
                  `/penyuluh/petani-binaan?petani_id=${selectedFull?.petani_id}`
                )
              }
            >
              Lihat Statistik →
            </button>
          </section>

          {selectedFull && selectedFull.status_label !== "Selesai" && (
            <button
              type="button"
              style={styles.finishBtn}
              onClick={selesaiKonsultasi}
            >
              Tandai Konsultasi Selesai
            </button>
          )}
        </aside>
      </main>
    </div>
  );
}

function Avatar({ src, name = "Petani", size = 42 }) {
  if (src) {
    return (
      <img
        src={getFileHref(src)}
        alt={name}
        style={{
          width: size,
          height: size,
          borderRadius: 999,
          objectFit: "cover",
          border: "1px solid #e5e7eb",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: getAvatarColor(name),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 950,
        color: "#0f172a",
        flexShrink: 0,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

function KpiCard({ title, value, desc, icon, color, bg }) {
  return (
    <div style={styles.kpiCard}>
      <div>
        <h4>{title}</h4>
        <strong style={{ color }}>{value}</strong>
        <small>{desc}</small>
      </div>

      <span style={{ ...styles.kpiIcon, color, background: bg }}>{icon}</span>
    </div>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <div style={styles.detailRow}>
      <span>{icon}</span>
      <small>{label}</small>
      <strong>{value || "-"}</strong>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f6f8fb",
    padding: 24,
    color: "#0f172a",
    boxSizing: "border-box",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    gap: 16,
  },

  headerTitle: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },

  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
  },

  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  dateChip: {
    height: 44,
    borderRadius: 12,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    display: "flex",
    alignItems: "center",
    padding: "0 16px",
    fontWeight: 900,
  },

  bellBtn: {
    width: 44,
    height: 44,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "#ffffff",
    position: "relative",
    cursor: "pointer",
  },

  bellBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    minWidth: 20,
    height: 20,
    padding: "0 5px",
    borderRadius: 999,
    background: "#ef4444",
    color: "#ffffff",
    fontSize: 11,
    fontWeight: 950,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  profileChip: {
    height: 48,
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 12px",
    cursor: "pointer",
  },

  profileAvatar: {
    width: 34,
    height: 34,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#dcfce7",
  },

  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 16,
    marginBottom: 18,
  },

  kpiCard: {
    minHeight: 110,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 10px 25px rgba(15,23,42,.06)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  kpiIcon: {
    width: 58,
    height: 58,
    borderRadius: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 28,
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "430px 1fr 340px",
    gap: 18,
    alignItems: "stretch",
  },

  leftPanel: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    boxShadow: "0 10px 25px rgba(15,23,42,.06)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },

  tabs: {
    display: "flex",
    gap: 12,
    padding: "0 14px",
    borderBottom: "1px solid #e5e7eb",
  },

  tabBtn: {
    height: 54,
    borderWidth: 0,
    background: "transparent",
    color: "#64748b",
    fontWeight: 900,
    cursor: "pointer",
    borderBottomWidth: 3,
    borderBottomStyle: "solid",
    borderBottomColor: "transparent",
    whiteSpace: "nowrap",
  },

  tabActive: {
    color: "#16a34a",
    borderBottomColor: "#16a34a",
  },

  filterRow: {
    display: "grid",
    gridTemplateColumns: "1fr 135px 42px",
    gap: 8,
    padding: 14,
  },

  searchBox: {
    height: 40,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 12px",
  },

  statusSelect: {
    height: 40,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    background: "#ffffff",
    padding: "0 10px",
    fontWeight: 800,
  },

  filterIconBtn: {
    height: 40,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    background: "#ffffff",
    cursor: "pointer",
  },

  konsultasiList: {
    flex: 1,
    overflowY: "auto",
    padding: "0 14px",
  },

  chatItem: {
    width: "100%",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "transparent",
    background: "#ffffff",
    padding: 12,
    display: "grid",
    gridTemplateColumns: "44px 1fr auto",
    gap: 12,
    textAlign: "left",
    cursor: "pointer",
    borderRadius: 12,
    marginBottom: 6,
    boxShadow: "inset 0 -1px 0 #f1f5f9",
  },

  chatItemActive: {
    borderColor: "#86efac",
    background: "#ecfdf5",
  },

  chatItemBody: {
    minWidth: 0,
  },

  chatItemHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "5px 10px",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  unreadBadge: {
    width: 22,
    height: 22,
    borderRadius: 999,
    background: "#ef4444",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
  },

  doneCheck: {
    color: "#16a34a",
    fontSize: 18,
  },

  paginationRow: {
    borderTop: "1px solid #e5e7eb",
    padding: 14,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },

  paginationBtns: {
    display: "flex",
    gap: 6,
  },

  pageActive: {
    background: "#dcfce7",
    color: "#16a34a",
    borderColor: "#16a34a",
  },

  chatPanel: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    boxShadow: "0 10px 25px rgba(15,23,42,.06)",
    display: "flex",
    flexDirection: "column",
    minHeight: 650,
    overflow: "hidden",
  },

  chatHeader: {
    padding: 18,
    display: "flex",
    justifyContent: "space-between",
    borderBottom: "1px solid #e5e7eb",
  },

  chatHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  chatMetaLine: {
    display: "flex",
    flexWrap: "wrap",
    gap: 16,
    color: "#64748b",
    fontSize: 13,
  },

  chatHeaderRight: {
    textAlign: "right",
    display: "grid",
    gap: 8,
    justifyItems: "end",
  },

  lahanInfoStrip: {
    margin: 14,
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    borderRadius: 10,
    padding: 12,
    display: "flex",
    flexWrap: "wrap",
    gap: 18,
    color: "#475569",
    fontSize: 13,
  },

  messageArea: {
    flex: 1,
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    overflowY: "auto",
    background: "#ffffff",
  },

  messageBlock: {
    maxWidth: "72%",
  },

  messageBubble: {
    padding: 14,
    borderRadius: 14,
    lineHeight: 1.55,
  },

  messageOther: {
    background: "#f1f5f9",
    color: "#0f172a",
  },

  messageMe: {
    background: "#d1fae5",
    color: "#064e3b",
  },

  messageImage: {
    display: "block",
    marginTop: 10,
    maxWidth: 280,
    maxHeight: 220,
    borderRadius: 10,
    objectFit: "cover",
  },

  attachmentBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    background: "rgba(255,255,255,.55)",
    display: "block",
    color: "inherit",
    textDecoration: "none",
    fontWeight: 900,
  },

  quickReplyRow: {
    padding: "12px 18px",
    borderTop: "1px solid #e5e7eb",
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },

  filePreview: {
    margin: "0 18px 10px",
    padding: 10,
    borderRadius: 10,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 13,
  },

  inputRow: {
    borderTop: "1px solid #e5e7eb",
    padding: 16,
    display: "grid",
    gridTemplateColumns: "1fr 42px 42px 80px",
    gap: 10,
  },

  inputIconBtn: {
    border: "1px solid #d1d5db",
    borderRadius: 10,
    background: "#ffffff",
    cursor: "pointer",
  },

  sendBtn: {
    border: "none",
    borderRadius: 10,
    background: "#16a34a",
    color: "#ffffff",
    fontWeight: 950,
    cursor: "pointer",
  },

  rightPanel: {
    display: "grid",
    gap: 14,
  },

  sideCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 10px 25px rgba(15,23,42,.06)",
  },

  petaniInfo: {
    display: "grid",
    gridTemplateColumns: "62px 1fr",
    gap: 12,
    alignItems: "center",
    marginBottom: 14,
  },

  sideOutlineBtn: {
    width: "100%",
    height: 40,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    borderRadius: 10,
    color: "#16a34a",
    fontWeight: 900,
    cursor: "pointer",
  },

  finishBtn: {
    height: 44,
    border: "none",
    borderRadius: 12,
    background: "#16a34a",
    color: "#ffffff",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 10px 25px rgba(22,163,74,.25)",
  },

  lahanDetailList: {
    display: "grid",
    gap: 12,
  },

  detailRow: {
    display: "grid",
    gridTemplateColumns: "28px 1fr auto",
    alignItems: "center",
    gap: 8,
    color: "#475569",
  },

  sideTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  historyList: {
    display: "grid",
    gap: 10,
  },

  historyItem: {
    display: "grid",
    gridTemplateColumns: "28px 1fr auto",
    alignItems: "center",
    gap: 8,
  },

  statList: {
    display: "grid",
    gap: 10,
    marginBottom: 12,
  },

  emptyList: {
    padding: 18,
    textAlign: "center",
    color: "#64748b",
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
  },

  emptyChat: {
    margin: "auto",
    color: "#64748b",
    fontWeight: 800,
  },

  emptySmall: {
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
    padding: 12,
    color: "#64748b",
    textAlign: "center",
  },
};