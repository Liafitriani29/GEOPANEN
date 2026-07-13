import { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const JENIS_OPTIONS = [
  "Rekomendasi",
  "Peringatan",
  "Informasi",
  "Pengingat",
  "Lainnya",
];

const STATUS_OPTIONS = [
  "Semua Status",
  "Belum Dibaca",
  "Terkirim",
  "Dibaca",
  "Dijadwalkan",
  "Draft",
];

const INITIAL_FORM = {
  user_id: "",
  role: "petani",
  tipe: "rekomendasi",
  judul: "",
  pesan: "",
  status: "terkirim",
  jadwal_kirim: "",
  lahan_id: "",
};

const INITIAL_TEMPLATE_FORM = {
  id: "",
  judul: "",
  pesan: "",
  jenis: "informasi",
};

const INITIAL_WEATHER = {
  suhu: 28,
  kondisi: "Cerah",
  kelembapan: 78,
  curah_hujan: 2,
};

function safeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
}

function todayText() {
  return new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateInput(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function getTodayInput() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function getDateBeforeInput(days = 60) {
  const date = new Date();
  date.setDate(date.getDate() - days);

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function toDateTimeInput(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");

  return `${y}-${m}-${d}T${h}:${min}`;
}

function normalizeJenis(value = "", pesan = "") {
  const raw = `${value} ${pesan}`.toLowerCase();

  if (raw.includes("rekomendasi") || raw.includes("pupuk")) {
    return "Rekomendasi";
  }

  if (
    raw.includes("peringatan") ||
    raw.includes("hama") ||
    raw.includes("penyakit") ||
    raw.includes("kritis") ||
    raw.includes("waspada")
  ) {
    return "Peringatan";
  }

  if (raw.includes("pengingat") || raw.includes("jadwal")) {
    return "Pengingat";
  }

  if (raw.includes("informasi") || raw.includes("update")) {
    return "Informasi";
  }

  return "Lainnya";
}

function jenisMeta(jenis = "") {
  const raw = String(jenis).toLowerCase();

  if (raw.includes("rekomendasi")) {
    return {
      label: "Rekomendasi",
      icon: "🧪",
      color: "#16a34a",
      bg: "#dcfce7",
    };
  }

  if (raw.includes("peringatan")) {
    return {
      label: "Peringatan",
      icon: "🔔",
      color: "#ef4444",
      bg: "#fee2e2",
    };
  }

  if (raw.includes("informasi")) {
    return {
      label: "Informasi",
      icon: "🛡️",
      color: "#2563eb",
      bg: "#dbeafe",
    };
  }

  if (raw.includes("pengingat")) {
    return {
      label: "Pengingat",
      icon: "⏰",
      color: "#f59e0b",
      bg: "#ffedd5",
    };
  }

  return {
    label: "Lainnya",
    icon: "📄",
    color: "#64748b",
    bg: "#f1f5f9",
  };
}

function normalizeStatus(item) {
  const rawStatus = String(item.status || "").toLowerCase();
  const statusKirim = String(item.status_kirim || "").toLowerCase();

  if (rawStatus.includes("draft")) return "Draft";
  if (rawStatus.includes("jadwal")) return "Dijadwalkan";

  // Status "Dibaca" hanya boleh berasal dari aksi petani membuka notifikasi.
  // Penyuluh tidak lagi bisa menandai notifikasi sebagai dibaca dari halaman ini.
  if (Number(item.is_read) === 1) return "Dibaca";

  if (
    statusKirim === "terkirim" ||
    rawStatus.includes("terkirim") ||
    rawStatus.includes("dibaca")
  ) {
    return "Terkirim";
  }

  return "Belum Dibaca";
}

function statusMeta(status = "") {
  const raw = String(status).toLowerCase();

  if (raw.includes("dibaca")) {
    return {
      label: "Dibaca",
      color: "#2563eb",
      bg: "#dbeafe",
    };
  }

  if (raw.includes("terkirim")) {
    return {
      label: "Terkirim",
      color: "#16a34a",
      bg: "#dcfce7",
    };
  }

  if (raw.includes("jadwal")) {
    return {
      label: "Dijadwalkan",
      color: "#f59e0b",
      bg: "#ffedd5",
    };
  }

  if (raw.includes("draft")) {
    return {
      label: "Draft",
      color: "#64748b",
      bg: "#f1f5f9",
    };
  }

  return {
    label: "Belum Dibaca",
    color: "#ef4444",
    bg: "#fee2e2",
  };
}

function getTitle(item) {
  const judul = String(item.judul || "").trim();
  const pesan = String(item.pesan || item.message || "").trim();

  if (judul) return judul;

  const jenis = normalizeJenis(item.tipe, pesan);

  if (jenis === "Rekomendasi") return "Rekomendasi untuk Petani";
  if (jenis === "Peringatan") return "Peringatan Kondisi Lahan";
  if (jenis === "Pengingat") return "Pengingat Kegiatan";
  if (jenis === "Informasi") return "Informasi Sistem";

  return "Notifikasi";
}

function shorten(text = "", max = 90) {
  const str = String(text || "");

  if (str.length <= max) return str;

  return `${str.slice(0, max)}...`;
}

export default function NotifikasiPenyuluh() {
  const currentUser = getStoredUser();

  const penyuluhId =
    currentUser?.id ||
    localStorage.getItem("user_id") ||
    localStorage.getItem("penyuluh_id") ||
    null;

  const [notif, setNotif] = useState([]);
  const [lahan, setLahan] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [weather, setWeather] = useState(INITIAL_WEATHER);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const [activeTab, setActiveTab] = useState("Semua Notifikasi");
  const [search, setSearch] = useState("");
  const [selectedJenis, setSelectedJenis] = useState("Semua Jenis");
  const [selectedStatus, setSelectedStatus] = useState("Semua Status");
  const [selectedPetani, setSelectedPetani] = useState("Semua Petani");
  const [startDate, setStartDate] = useState(() => getDateBeforeInput(60));
  const [endDate, setEndDate] = useState(() => getTodayInput());

  const [modalMode, setModalMode] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);

  const [templateModal, setTemplateModal] = useState(false);
  const [templateForm, setTemplateForm] = useState(INITIAL_TEMPLATE_FORM);

  const fetchNotif = async () => {
    try {
      setLoading(true);

      const res = await api.get(`/notifikasi`, {
        params: {
          role: "petani",
          penyuluh_id: penyuluhId,
        },
      });

      const data = safeList(res.data);
      setNotif(data);
    } catch (err) {
      console.log("GET NOTIF ERROR:", err.response?.data || err.message);
      setNotif([]);
    } finally {
      setLoading(false);
    }
  };

  const normalizeLahanBinaan = (rows) => {
    return safeList(rows)
      .map((item) => {
        const petaniId =
          item.petani_id || item.user_id || item.id_petani || item.petaniId;

        const lahanId =
          item.lahan_id || item.sawah_id || item.id_lahan || item.id;

        return {
          ...item,
          id: lahanId,
          lahan_id: lahanId,
          petani_id: petaniId,
          user_id: item.user_id || petaniId,
          nama_lahan:
            item.nama_lahan ||
            item.lahan ||
            item.nama_sawah ||
            item.nama ||
            "Lahan Binaan",
          nama_petani:
            item.nama_petani ||
            item.petani ||
            item.nama_user ||
            item.nama_pemilik ||
            `Petani ${petaniId || ""}`.trim(),
          nama_desa: item.nama_desa || item.desa || "-",
          nama_kecamatan: item.nama_kecamatan || item.kecamatan || "-",
        };
      })
      .filter((item) => item.id && item.petani_id);
  };

  const fetchLahan = async () => {
    try {
      let rows = [];

      try {
        const res = await api.get(`/penyuluh/petani-binaan`, {
          params: {
            penyuluh_id: penyuluhId,
          },
        });

        rows = normalizeLahanBinaan(safeList(res.data));
      } catch (err) {
        console.log(
          "GET PETANI BINAAN ERROR, COBA MAP BINAAN:",
          err.response?.data || err.message
        );
      }

      if (rows.length === 0) {
        try {
          const resMap = await api.get(`/map-binaan`, {
            params: {
              penyuluh_id: penyuluhId,
            },
          });

          rows = normalizeLahanBinaan(safeList(resMap.data));
        } catch (err) {
          console.log("GET MAP BINAAN ERROR:", err.response?.data || err.message);
        }
      }

      setLahan(rows);
    } catch (err) {
      console.log("GET LAHAN BINAAN ERROR:", err.response?.data || err.message);
      setLahan([]);
    }
  };

  const fetchWeather = async () => {
    try {
      const res = await api.get(`/cuaca`);
      setWeather(res.data?.data || INITIAL_WEATHER);
    } catch (err) {
      console.log("GET CUACA ERROR:", err.response?.data || err.message);
      setWeather(INITIAL_WEATHER);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await api.get(`/notifikasi-template`);
      setTemplates(safeList(res.data));
    } catch (err) {
      console.log("GET TEMPLATE ERROR:", err.response?.data || err.message);
      setTemplates([]);
    }
  };

  useEffect(() => {
    fetchNotif();
    fetchLahan();
    fetchWeather();
    fetchTemplates();
  }, [penyuluhId]);

  const petaniOptions = useMemo(() => {
    const map = new Map();

    lahan.forEach((item) => {
      const petaniId = item.petani_id || item.user_id;

      if (!petaniId) return;

      if (!map.has(String(petaniId))) {
        map.set(String(petaniId), {
          id: petaniId,
          nama_petani:
            item.nama_petani ||
            item.nama ||
            item.petani ||
            `Petani ${petaniId}`,
          nama_desa: item.nama_desa || item.desa || "-",
          nama_kecamatan: item.nama_kecamatan || item.kecamatan || "-",
        });
      }
    });

    return Array.from(map.values());
  }, [lahan]);

  const petaniMap = useMemo(() => {
    const map = new Map();

    petaniOptions.forEach((item) => {
      map.set(String(item.id), item);
    });

    return map;
  }, [petaniOptions]);

  const binaanPetaniIds = useMemo(() => {
    return new Set(petaniOptions.map((item) => String(item.id)));
  }, [petaniOptions]);

  const normalizedNotif = useMemo(() => {
    return notif
      .map((item) => {
        const pesan = item.pesan || item.message || "";
        const jenis = normalizeJenis(item.tipe || item.jenis, pesan);
        const status = normalizeStatus(item);
        const petani = petaniMap.get(String(item.user_id));
        const isRead = Number(item.is_read || 0);

        return {
          id: item.id,
          user_id: item.user_id,
          role: item.role || "petani",
          tipe: item.tipe || item.jenis || jenis.toLowerCase(),
          jenis,
          judul: getTitle(item),
          pesan,
          penerima:
            item.nama_petani ||
            item.penerima ||
            petani?.nama_petani ||
            (item.user_id ? `Petani ${item.user_id}` : "-"),
          nama_lahan: item.nama_lahan || petani?.nama_lahan || "-",
          nama_desa: item.nama_desa || petani?.nama_desa || "-",
          nama_kecamatan: item.nama_kecamatan || petani?.nama_kecamatan || "-",
          dikirim_oleh: item.dikirim_oleh || currentUser?.nama || "Penyuluh",
          status,
          is_read: isRead,
          status_kirim: item.status_kirim || "",
          jadwal_kirim: item.jadwal_kirim || null,
          lahan_id: item.lahan_id || "",
          created_at: item.created_at || item.tanggal || null,
        };
      })
      .filter((item) => {
        if (binaanPetaniIds.size === 0) return true;
        return binaanPetaniIds.has(String(item.user_id));
      });
  }, [notif, petaniMap, currentUser?.nama, binaanPetaniIds]);

  const filteredNotif = useMemo(() => {
    return normalizedNotif.filter((item) => {
      const q = search.toLowerCase();
      const createdKey = toDateInput(item.created_at);

      const matchSearch =
        !q ||
        item.judul.toLowerCase().includes(q) ||
        item.pesan.toLowerCase().includes(q) ||
        item.penerima.toLowerCase().includes(q);

      const matchJenis =
        selectedJenis === "Semua Jenis" || item.jenis === selectedJenis;

      let matchStatus = true;

      if (selectedStatus !== "Semua Status") {
        if (selectedStatus === "Belum Dibaca") {
          matchStatus = Number(item.is_read) === 0;
        } else {
          matchStatus = item.status === selectedStatus;
        }
      }

      const matchPetani =
        selectedPetani === "Semua Petani" ||
        String(item.user_id) === String(selectedPetani);

      const matchDate =
        !createdKey ||
        ((!startDate || createdKey >= startDate) &&
          (!endDate || createdKey <= endDate));

      const matchTab =
        activeTab === "Semua Notifikasi" ||
        (activeTab === "Belum Dibaca" && Number(item.is_read) === 0) ||
        (activeTab === "Terkirim" && item.status === "Terkirim") ||
        (activeTab === "Dijadwalkan" && item.status === "Dijadwalkan") ||
        (activeTab === "Draft" && item.status === "Draft");

      return (
        matchSearch &&
        matchJenis &&
        matchStatus &&
        matchPetani &&
        matchDate &&
        matchTab
      );
    });
  }, [
    normalizedNotif,
    search,
    selectedJenis,
    selectedStatus,
    selectedPetani,
    startDate,
    endDate,
    activeTab,
  ]);

  const todayKey = toDateInput(new Date());

  const totalNotif = normalizedNotif.length;

  const belumDibaca = normalizedNotif.filter(
    (item) =>
      Number(item.is_read) === 0 &&
      item.status !== "Draft" &&
      item.status !== "Dijadwalkan"
  ).length;

  const terkirimHariIni = normalizedNotif.filter(
    (item) =>
      item.status === "Terkirim" && toDateInput(item.created_at) === todayKey
  ).length;

  const notifikasiTerkirim = normalizedNotif.filter(
    (item) => !["Draft", "Dijadwalkan"].includes(item.status)
  );

  const dibacaPetani = notifikasiTerkirim.filter(
    (item) => Number(item.is_read) === 1
  ).length;

  const dijadwalkan = normalizedNotif.filter(
    (item) => item.status === "Dijadwalkan"
  ).length;

  const draft = normalizedNotif.filter((item) => item.status === "Draft").length;

  const readRate =
    notifikasiTerkirim.length > 0
      ? Math.round((dibacaPetani / notifikasiTerkirim.length) * 100)
      : 0;

  const jenisChart = useMemo(() => {
    const map = new Map();

    normalizedNotif.forEach((item) => {
      const meta = jenisMeta(item.jenis);

      if (!map.has(meta.label)) {
        map.set(meta.label, {
          name: meta.label,
          value: 0,
          color: meta.color,
        });
      }

      map.get(meta.label).value += 1;
    });

    return Array.from(map.values());
  }, [normalizedNotif]);

  const unreadCountLabel = `Belum Dibaca (${belumDibaca})`;

  const latestActivity = useMemo(() => {
    return [...normalizedNotif]
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 4);
  }, [normalizedNotif]);

  const resetFilterTanggal = () => {
    setStartDate("");
    setEndDate("");
  };

  const setFilterTerbaru = () => {
    setStartDate(getDateBeforeInput(60));
    setEndDate(getTodayInput());
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
  };

  const openCreate = (prefill = {}) => {
    setSelectedItem(null);
    setForm({
      ...INITIAL_FORM,
      ...prefill,
    });
    setModalMode("create");
  };

  const openDetail = (item) => {
    setSelectedItem(item);
    setModalMode("detail");
  };

  const openEdit = (item) => {
    setSelectedItem(item);

    setForm({
      user_id: item.user_id || "",
      role: item.role || "petani",
      tipe: String(item.tipe || item.jenis || "informasi").toLowerCase(),
      judul: item.judul || "",
      pesan: item.pesan || "",
      status: String(item.status || "terkirim").toLowerCase(),
      jadwal_kirim: item.jadwal_kirim ? toDateTimeInput(item.jadwal_kirim) : "",
      lahan_id: item.lahan_id || "",
    });

    setModalMode("edit");
  };

  const closeModal = () => {
    if (saving) return;

    setSelectedItem(null);
    setModalMode("");
    resetForm();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const buildPayload = () => ({
    user_id: form.user_id ? Number(form.user_id) : null,
    role: form.role || "petani",
    tipe: form.tipe || "informasi",
    judul: form.judul || "Notifikasi Baru",
    pesan: form.pesan || form.judul || "Notifikasi baru",
    message: form.pesan || form.judul || "Notifikasi baru",
    status: form.status || "terkirim",
    jadwal_kirim: form.status === "dijadwalkan" ? form.jadwal_kirim : null,
    dikirim_oleh: currentUser?.nama || "Penyuluh",
    penyuluh_id: penyuluhId,
    lahan_id: form.lahan_id || null,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.user_id) {
      alert("Penerima wajib dipilih.");
      return;
    }

    if (!form.judul.trim()) {
      alert("Judul notifikasi wajib diisi.");
      return;
    }

    if (!form.pesan.trim()) {
      alert("Isi notifikasi wajib diisi.");
      return;
    }

    if (form.status === "dijadwalkan" && !form.jadwal_kirim) {
      alert("Tanggal/jam jadwal kirim wajib diisi.");
      return;
    }

    try {
      setSaving(true);

      const payload = buildPayload();

      if (modalMode === "create") {
        await api.post(`/notifikasi`, payload);
        setEndDate(getTodayInput());
        alert("Notifikasi berhasil dibuat.");
      }

      if (modalMode === "edit" && selectedItem?.id) {
        await api.put(`/notifikasi/${selectedItem.id}`, payload);
        setEndDate(getTodayInput());
        alert("Notifikasi berhasil diperbarui.");
      }

      closeModal();
      fetchNotif();
    } catch (err) {
      console.log("SAVE NOTIF ERROR:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Gagal menyimpan notifikasi.");
    } finally {
      setSaving(false);
    }
  };

  const quickCreate = (jenis) => {
    const jenisKey = String(jenis || "").toLowerCase();

    const found = templates.find((item) =>
      String(item.jenis || "").toLowerCase().includes(jenisKey)
    );

    if (found) {
      openCreate({
        tipe: found.jenis || jenisKey,
        judul: found.judul,
        pesan: found.pesan,
      });

      return;
    }

    if (jenis === "Rekomendasi") {
      openCreate({
        tipe: "rekomendasi",
        judul: "Rekomendasi Pemupukan",
        pesan: "Lakukan pemupukan sesuai kebutuhan tanaman pada fase saat ini.",
      });
      return;
    }

    if (jenis === "Peringatan") {
      openCreate({
        tipe: "peringatan",
        judul: "Peringatan Hama/Penyakit",
        pesan:
          "Segera periksa kondisi lahan karena ada potensi gangguan hama atau penyakit.",
      });
      return;
    }

    if (jenis === "Pengingat") {
      openCreate({
        tipe: "pengingat",
        judul: "Pengingat Kegiatan",
        pesan: "Jangan lupa melakukan pengecekan lahan sesuai jadwal.",
      });
      return;
    }

    openCreate({
      tipe: "informasi",
      judul: "Informasi Umum",
      pesan: "Ada informasi baru dari penyuluh untuk petani.",
    });
  };

  const resetTemplateForm = () => {
    setTemplateForm(INITIAL_TEMPLATE_FORM);
  };

  const editTemplate = (item) => {
    setTemplateForm({
      id: item.id,
      judul: item.judul || "",
      pesan: item.pesan || "",
      jenis: item.jenis || "informasi",
    });
  };

  const saveTemplate = async (e) => {
    e.preventDefault();

    if (!templateForm.judul.trim()) {
      alert("Judul template wajib diisi.");
      return;
    }

    if (!templateForm.pesan.trim()) {
      alert("Pesan template wajib diisi.");
      return;
    }

    try {
      setSavingTemplate(true);

      const payload = {
        judul: templateForm.judul,
        pesan: templateForm.pesan,
        jenis: templateForm.jenis,
      };

      if (templateForm.id) {
        await api.put(`/notifikasi-template/${templateForm.id}`, payload);
        alert("Template berhasil diperbarui.");
      } else {
        await api.post(`/notifikasi-template`, payload);
        alert("Template berhasil dibuat.");
      }

      resetTemplateForm();
      fetchTemplates();
    } catch (err) {
      console.log("SAVE TEMPLATE ERROR:", err.response?.data || err.message);
      alert("Gagal menyimpan template.");
    } finally {
      setSavingTemplate(false);
    }
  };

  const deleteTemplate = async (id) => {
    const yakin = window.confirm("Hapus template ini?");

    if (!yakin) return;

    try {
      await api.delete(`/notifikasi-template/${id}`);
      fetchTemplates();
    } catch (err) {
      console.log("DELETE TEMPLATE ERROR:", err.response?.data || err.message);
      alert("Gagal hapus template.");
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>🔔 Notifikasi Penyuluh</h1>
          <p style={styles.subtitle}>
            Kelola notifikasi, kirim pengumuman, dan pantau aktivitas sistem
          </p>
        </div>

        <div style={styles.headerRight}>
          <div style={styles.dateBox}>📅 {todayText()}</div>

          <div style={styles.weatherBox}>
            <span>{weather.kondisi === "Hujan" ? "🌧️" : "☀️"}</span>
            <div>
              <strong>{weather.suhu}°C</strong>
              <small>{weather.kondisi}</small>
            </div>
          </div>

          <button style={styles.bellBtn} type="button">
            🔔
            {belumDibaca > 0 && (
              <span style={styles.bellBadge}>{belumDibaca}</span>
            )}
          </button>

          <button style={styles.userBox} type="button">
            👨‍🌾 <strong>{currentUser?.nama || "Penyuluh"}</strong>
          </button>
        </div>
      </div>

      <div style={styles.kpiGrid}>
        <KpiCard
          title="Total Notifikasi"
          value={totalNotif}
          desc="Semua notifikasi"
          icon="📄"
          color="#16a34a"
          bg="#dcfce7"
        />

        <KpiCard
          title="Belum Dibaca"
          value={belumDibaca}
          desc="Perlu perhatian"
          icon="🔔"
          color="#ef4444"
          bg="#fee2e2"
        />

        <KpiCard
          title="Terkirim Hari Ini"
          value={terkirimHariIni}
          desc="Notifikasi terkirim"
          icon="✈️"
          color="#2563eb"
          bg="#dbeafe"
        />

        <KpiCard
          title="Dibaca Petani"
          value={`${readRate}%`}
          desc="Berdasarkan petani membuka"
          icon="👁️"
          color="#7c3aed"
          bg="#ede9fe"
        />

        <KpiCard
          title="Dijadwalkan"
          value={dijadwalkan}
          desc="Akan dikirim"
          icon="🕘"
          color="#f59e0b"
          bg="#ffedd5"
        />

        <KpiCard
          title="Draft"
          value={draft}
          desc="Draft tersimpan"
          icon="📋"
          color="#64748b"
          bg="#f1f5f9"
        />
      </div>

      <div style={styles.contentGrid}>
        <main style={styles.mainCard}>
          <div style={styles.tabs}>
            {[
              "Semua Notifikasi",
              unreadCountLabel,
              "Terkirim",
              "Dijadwalkan",
              "Draft",
            ].map((tab) => {
              const cleanTab = tab.startsWith("Belum Dibaca")
                ? "Belum Dibaca"
                : tab;

              return (
                <button
                  key={tab}
                  style={{
                    ...styles.tabBtn,
                    ...(activeTab === cleanTab ? styles.tabActive : {}),
                  }}
                  onClick={() => setActiveTab(cleanTab)}
                  type="button"
                >
                  {tab}
                </button>
              );
            })}
          </div>

          <div style={styles.filterRow}>
            <div style={styles.searchBox}>
              🔍
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari judul atau isi notifikasi..."
              />
            </div>

            <select
              style={styles.select}
              value={selectedJenis}
              onChange={(e) => setSelectedJenis(e.target.value)}
            >
              <option>Semua Jenis</option>
              {JENIS_OPTIONS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>

            <select
              style={styles.select}
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>

            <select
              style={styles.select}
              value={selectedPetani}
              onChange={(e) => setSelectedPetani(e.target.value)}
            >
              <option>Semua Petani</option>
              {petaniOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nama_petani}
                </option>
              ))}
            </select>

            <div style={styles.dateRange}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span>-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <button
              style={styles.filterBtn}
              type="button"
              onClick={setFilterTerbaru}
            >
              Terbaru
            </button>

            <button
              style={styles.filterBtn}
              type="button"
              onClick={resetFilterTanggal}
            >
              Semua Data
            </button>

            <button style={styles.createBtn} onClick={() => openCreate()}>
              + Buat Notifikasi
            </button>
          </div>

          <section style={styles.tableCard}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Judul Notifikasi</th>
                  <th style={styles.th}>Jenis</th>
                  <th style={styles.th}>Penerima</th>
                  <th style={styles.th}>Dikirim Oleh</th>
                  <th style={styles.th}>Waktu</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Aksi</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td style={styles.emptyTd} colSpan="7">
                      Memuat notifikasi...
                    </td>
                  </tr>
                ) : filteredNotif.length === 0 ? (
                  <tr>
                    <td style={styles.emptyTd} colSpan="7">
                      Tidak ada notifikasi sesuai filter.
                    </td>
                  </tr>
                ) : (
                  filteredNotif.slice(0, 8).map((item) => {
                    const jenis = jenisMeta(item.jenis);
                    const status = statusMeta(item.status);

                    return (
                      <tr key={item.id}>
                        <td style={styles.td}>
                          <div style={styles.titleCell}>
                            <span
                              style={{
                                ...styles.rowIcon,
                                color: jenis.color,
                                background: jenis.bg,
                              }}
                            >
                              {jenis.icon}
                            </span>

                            <div>
                              <strong>{item.judul}</strong>
                              <small>{shorten(item.pesan, 92)}</small>
                            </div>
                          </div>
                        </td>

                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.badge,
                              color: jenis.color,
                              background: jenis.bg,
                            }}
                          >
                            {jenis.label}
                          </span>
                        </td>

                        <td style={styles.td}>
                          <strong>{item.penerima}</strong>
                          <small style={styles.subText}>
                            {item.nama_desa}, Kec. {item.nama_kecamatan}
                          </small>
                        </td>

                        <td style={styles.td}>
                          <strong>{item.dikirim_oleh}</strong>
                          <small style={styles.subText}>Penyuluh</small>
                        </td>

                        <td style={styles.td}>
                          <strong>{formatDate(item.created_at)}</strong>
                          <small style={styles.subText}>
                            {formatTime(item.created_at)} WIB
                          </small>
                        </td>

                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.badge,
                              color: status.color,
                              background: status.bg,
                            }}
                          >
                            {status.label}
                          </span>
                        </td>

                        <td style={styles.td}>
                          <div style={styles.actionGroup}>
                            <button
                              style={styles.iconBtn}
                              type="button"
                              title="Lihat"
                              onClick={() => openDetail(item)}
                            >
                              👁️
                            </button>

                            <button
                              style={styles.iconBtn}
                              type="button"
                              title="Edit"
                              onClick={() => openEdit(item)}
                            >
                              ✏️
                            </button>


                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            <div style={styles.tableFooter}>
              Menampilkan 1 - {Math.min(filteredNotif.length, 8)} dari{" "}
              {filteredNotif.length} notifikasi
            </div>
          </section>
        </main>

        <aside style={styles.rightPanel}>
          <section style={styles.sideCard}>
            <h3 style={styles.sideTitle}>Ringkasan Notifikasi</h3>

            <div style={styles.pieArea}>
              <ResponsiveContainer width="48%" height={190}>
                <PieChart>
                  <Pie
                    data={jenisChart}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={2}
                  >
                    {jenisChart.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>

              <div style={styles.legendList}>
                {jenisChart.map((item) => (
                  <div key={item.name} style={styles.legendItem}>
                    <span style={{ background: item.color }}></span>
                    <strong>{item.name}</strong>
                    <small>
                      {item.value} (
                      {totalNotif > 0
                        ? Math.round((item.value / totalNotif) * 100)
                        : 0}
                      %)
                    </small>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section style={styles.sideCard}>
            <h3 style={styles.sideTitle}>Kirim Notifikasi Cepat</h3>

            <div style={styles.quickList}>
              <button style={styles.quickBtn} onClick={() => quickCreate("Rekomendasi")}>
                🧪 Rekomendasi Pemupukan
              </button>

              <button style={styles.quickBtn} onClick={() => quickCreate("Peringatan")}>
                🔔 Peringatan Hama/Penyakit
              </button>

              <button style={styles.quickBtn} onClick={() => quickCreate("Informasi")}>
                🛡️ Informasi Umum
              </button>

              <button style={styles.quickBtn} onClick={() => quickCreate("Pengingat")}>
                ⏰ Pengingat Kegiatan
              </button>
            </div>
          </section>

          <section style={styles.sideCard}>
            <div style={styles.sideHeader}>
              <h3 style={styles.sideTitle}>Aktivitas Terakhir</h3>
              <button style={styles.smallBtn}>Lihat Semua</button>
            </div>

            <div style={styles.activityList}>
              {latestActivity.length === 0 ? (
                <div style={styles.emptyBox}>Belum ada aktivitas.</div>
              ) : (
                latestActivity.map((item) => {
                  const meta = jenisMeta(item.jenis);

                  return (
                    <div key={item.id} style={styles.activityItem}>
                      <span
                        style={{
                          ...styles.activityIcon,
                          color: meta.color,
                          background: meta.bg,
                        }}
                      >
                        {meta.icon}
                      </span>

                      <div>
                        <strong>{shorten(item.judul, 32)}</strong>
                        <small>
                          {formatDate(item.created_at)},{" "}
                          {formatTime(item.created_at)}
                        </small>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section style={styles.sideCard}>
            <h3 style={styles.sideTitle}>Pengaturan Notifikasi</h3>
            <p style={styles.mutedText}>
              Kelola template dan preferensi notifikasi
            </p>

            <button
              style={styles.templateBtn}
              type="button"
              onClick={() => setTemplateModal(true)}
            >
              ⚙️ Kelola Template
            </button>
          </section>
        </aside>
      </div>

      {modalMode && (
        <NotifModal
          mode={modalMode}
          form={form}
          item={selectedItem}
          petaniOptions={petaniOptions}
          saving={saving}
          onChange={handleChange}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      )}

      {templateModal && (
        <TemplateModal
          templates={templates}
          templateForm={templateForm}
          savingTemplate={savingTemplate}
          setTemplateForm={setTemplateForm}
          resetTemplateForm={resetTemplateForm}
          editTemplate={editTemplate}
          saveTemplate={saveTemplate}
          deleteTemplate={deleteTemplate}
          close={() => {
            setTemplateModal(false);
            resetTemplateForm();
          }}
        />
      )}
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

function NotifModal({
  mode,
  form,
  item,
  petaniOptions,
  saving,
  onChange,
  onClose,
  onSubmit,
}) {
  const isDetail = mode === "detail";

  return (
    <div style={styles.modalBackdrop}>
      <div style={styles.modalCard}>
        <div style={styles.modalHeader}>
          <h2>
            {mode === "create"
              ? "Buat Notifikasi"
              : mode === "edit"
              ? "Edit Notifikasi"
              : "Detail Notifikasi"}
          </h2>

          <button style={styles.modalClose} type="button" onClick={onClose}>
            ×
          </button>
        </div>

        {isDetail ? (
          <>
            <div style={styles.detailBox}>
              <strong>Judul</strong>
              <p>{item?.judul}</p>
            </div>

            <div style={styles.detailBox}>
              <strong>Penerima</strong>
              <p>{item?.penerima}</p>
            </div>

            <div style={styles.detailBox}>
              <strong>Isi Notifikasi</strong>
              <p>{item?.pesan}</p>
            </div>

            {item?.jadwal_kirim && (
              <div style={styles.detailBox}>
                <strong>Jadwal Kirim</strong>
                <p>
                  {formatDate(item.jadwal_kirim)} {formatTime(item.jadwal_kirim)}
                </p>
              </div>
            )}

            <div style={styles.modalActions}>
              <button style={styles.lightBtn} type="button" onClick={onClose}>
                Tutup
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            <div style={styles.formGrid}>
              <label style={styles.formGroup}>
                Penerima
                <select
                  name="user_id"
                  value={form.user_id}
                  onChange={onChange}
                  style={styles.input}
                >
                  <option value="">Pilih Petani</option>
                  {safeList(petaniOptions).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nama_petani}
                    </option>
                  ))}
                </select>
              </label>

              <label style={styles.formGroup}>
                Jenis
                <select
                  name="tipe"
                  value={form.tipe}
                  onChange={onChange}
                  style={styles.input}
                >
                  <option value="rekomendasi">Rekomendasi</option>
                  <option value="peringatan">Peringatan</option>
                  <option value="informasi">Informasi</option>
                  <option value="pengingat">Pengingat</option>
                  <option value="lainnya">Lainnya</option>
                </select>
              </label>

              <label style={styles.formGroup}>
                Status
                <select
                  name="status"
                  value={form.status}
                  onChange={onChange}
                  style={styles.input}
                >
                  <option value="terkirim">Terkirim</option>
                  <option value="dijadwalkan">Dijadwalkan</option>
                  <option value="draft">Draft</option>
                </select>
              </label>

              {form.status === "dijadwalkan" && (
                <label style={styles.formGroup}>
                  Jadwal Kirim
                  <input
                    type="datetime-local"
                    name="jadwal_kirim"
                    value={form.jadwal_kirim || ""}
                    onChange={onChange}
                    style={styles.input}
                  />
                </label>
              )}
            </div>

            <label style={styles.formGroup}>
              Judul Notifikasi
              <input
                name="judul"
                value={form.judul}
                onChange={onChange}
                style={styles.input}
                placeholder="Contoh: Rekomendasi Pemupukan"
              />
            </label>

            <label style={styles.formGroup}>
              Isi Notifikasi
              <textarea
                name="pesan"
                value={form.pesan}
                onChange={onChange}
                style={styles.textarea}
                placeholder="Tulis isi notifikasi untuk petani..."
              />
            </label>

            <div style={styles.modalActions}>
              <button style={styles.greenBtn} disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan Notifikasi"}
              </button>

              <button type="button" style={styles.lightBtn} onClick={onClose}>
                Batal
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function TemplateModal({
  templates,
  templateForm,
  savingTemplate,
  setTemplateForm,
  resetTemplateForm,
  editTemplate,
  saveTemplate,
  deleteTemplate,
  close,
}) {
  return (
    <div style={styles.modalBackdrop}>
      <div style={styles.modalCard}>
        <div style={styles.modalHeader}>
          <h2>Kelola Template Notifikasi</h2>

          <button style={styles.modalClose} type="button" onClick={close}>
            ×
          </button>
        </div>

        <form onSubmit={saveTemplate}>
          <div style={styles.formGrid}>
            <label style={styles.formGroup}>
              Jenis
              <select
                value={templateForm.jenis}
                onChange={(e) =>
                  setTemplateForm((prev) => ({
                    ...prev,
                    jenis: e.target.value,
                  }))
                }
                style={styles.input}
              >
                <option value="rekomendasi">Rekomendasi</option>
                <option value="peringatan">Peringatan</option>
                <option value="informasi">Informasi</option>
                <option value="pengingat">Pengingat</option>
                <option value="lainnya">Lainnya</option>
              </select>
            </label>

            <label style={styles.formGroup}>
              Judul
              <input
                value={templateForm.judul}
                onChange={(e) =>
                  setTemplateForm((prev) => ({
                    ...prev,
                    judul: e.target.value,
                  }))
                }
                style={styles.input}
                placeholder="Judul template"
              />
            </label>
          </div>

          <label style={styles.formGroup}>
            Pesan
            <textarea
              value={templateForm.pesan}
              onChange={(e) =>
                setTemplateForm((prev) => ({
                  ...prev,
                  pesan: e.target.value,
                }))
              }
              style={styles.textarea}
              placeholder="Isi template notifikasi"
            />
          </label>

          <div style={styles.modalActions}>
            <button style={styles.greenBtn} disabled={savingTemplate}>
              {savingTemplate
                ? "Menyimpan..."
                : templateForm.id
                ? "Update Template"
                : "Tambah Template"}
            </button>

            <button
              type="button"
              style={styles.lightBtn}
              onClick={resetTemplateForm}
            >
              Reset
            </button>
          </div>
        </form>

        <div style={styles.templateList}>
          {templates.length === 0 ? (
            <div style={styles.emptyBox}>Belum ada template.</div>
          ) : (
            templates.map((item) => (
              <div key={item.id} style={styles.templateItem}>
                <div>
                  <strong>{item.judul}</strong>
                  <small style={styles.subText}>
                    {item.jenis} • {shorten(item.pesan, 80)}
                  </small>
                </div>

                <div style={styles.actionGroup}>
                  <button
                    type="button"
                    style={styles.iconBtn}
                    onClick={() => editTemplate(item)}
                  >
                    ✏️
                  </button>

                  <button
                    type="button"
                    style={styles.iconBtnDanger}
                    onClick={() => deleteTemplate(item.id)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
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
    gap: 16,
    marginBottom: 24,
  },

  title: {
    margin: 0,
    fontSize: 30,
    fontWeight: 950,
  },

  subtitle: {
    margin: "6px 0 0",
    color: "#64748b",
  },

  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  dateBox: {
    height: 44,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "0 16px",
    display: "flex",
    alignItems: "center",
    fontWeight: 900,
  },

  weatherBox: {
    height: 44,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "0 14px",
    display: "flex",
    alignItems: "center",
    gap: 9,
  },

  bellBtn: {
    position: "relative",
    width: 44,
    height: 44,
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    fontSize: 18,
    cursor: "pointer",
  },

  bellBadge: {
    position: "absolute",
    top: -7,
    right: -7,
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    background: "#ef4444",
    color: "#ffffff",
    fontSize: 11,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 5px",
  },

  userBox: {
    height: 44,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "0 14px",
    display: "flex",
    alignItems: "center",
    gap: 9,
    fontWeight: 900,
  },

  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
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

  contentGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 410px",
    gap: 18,
  },

  mainCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    overflow: "hidden",
    boxShadow: "0 10px 25px rgba(15,23,42,.06)",
  },

  tabs: {
    display: "flex",
    gap: 18,
    padding: "0 18px",
    borderBottom: "1px solid #e5e7eb",
  },

  tabBtn: {
    height: 54,
    border: "none",
    background: "transparent",
    fontWeight: 900,
    color: "#64748b",
    cursor: "pointer",
    borderBottom: "3px solid transparent",
  },

  tabActive: {
    color: "#16a34a",
    borderBottom: "3px solid #16a34a",
  },

  filterRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    padding: 18,
    alignItems: "center",
  },

  searchBox: {
    width: 260,
    height: 42,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 12px",
  },

  select: {
    width: 150,
    height: 42,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    background: "#ffffff",
    padding: "0 12px",
    fontWeight: 800,
  },

  dateRange: {
    width: 250,
    height: 42,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "0 8px",
  },

  filterBtn: {
    height: 42,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 900,
    padding: "0 12px",
    cursor: "pointer",
  },

  createBtn: {
    minWidth: 150,
    height: 42,
    border: "none",
    borderRadius: 10,
    background: "#16a34a",
    color: "#ffffff",
    fontWeight: 950,
    cursor: "pointer",
    padding: "0 14px",
  },

  tableCard: {
    padding: "0 18px 18px",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },

  th: {
    textAlign: "left",
    padding: "14px 10px",
    borderBottom: "1px solid #e5e7eb",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  td: {
    padding: "14px 10px",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "middle",
  },

  titleCell: {
    display: "grid",
    gridTemplateColumns: "42px 1fr",
    alignItems: "center",
    gap: 12,
  },

  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 999,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 900,
  },

  subText: {
    display: "block",
    color: "#64748b",
    fontSize: 12,
    marginTop: 4,
  },

  actionGroup: {
    display: "flex",
    gap: 8,
  },

  iconBtn: {
    width: 34,
    height: 34,
    border: "1px solid #e5e7eb",
    borderRadius: 9,
    background: "#ffffff",
    cursor: "pointer",
  },

  iconBtnDanger: {
    width: 34,
    height: 34,
    border: "1px solid #fecaca",
    borderRadius: 9,
    background: "#ffffff",
    cursor: "pointer",
  },

  emptyTd: {
    textAlign: "center",
    color: "#64748b",
    padding: 28,
    fontWeight: 900,
  },

  tableFooter: {
    padding: "14px 0 0",
    color: "#64748b",
    fontSize: 13,
  },

  rightPanel: {
    display: "grid",
    gap: 18,
  },

  sideCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 10px 25px rgba(15,23,42,.06)",
  },

  sideTitle: {
    margin: "0 0 14px",
    fontSize: 18,
    fontWeight: 950,
  },

  sideHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  pieArea: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },

  legendList: {
    flex: 1,
    display: "grid",
    gap: 9,
  },

  legendItem: {
    display: "grid",
    gridTemplateColumns: "12px 1fr auto",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
  },

  quickList: {
    display: "grid",
    gap: 10,
  },

  quickBtn: {
    height: 40,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    background: "#ffffff",
    fontWeight: 900,
    textAlign: "left",
    padding: "0 12px",
    cursor: "pointer",
  },

  activityList: {
    display: "grid",
    gap: 12,
  },

  activityItem: {
    display: "grid",
    gridTemplateColumns: "38px 1fr",
    gap: 10,
    alignItems: "center",
  },

  activityIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  smallBtn: {
    height: 32,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    borderRadius: 9,
    padding: "0 12px",
    fontWeight: 900,
    cursor: "pointer",
  },

  mutedText: {
    color: "#64748b",
    marginTop: -6,
  },

  templateBtn: {
    width: "100%",
    height: 44,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    borderRadius: 10,
    fontWeight: 900,
    textAlign: "left",
    padding: "0 14px",
    cursor: "pointer",
  },

  templateList: {
    marginTop: 18,
    display: "grid",
    gap: 10,
    maxHeight: 260,
    overflowY: "auto",
  },

  templateItem: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 12,
    alignItems: "center",
  },

  emptyBox: {
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
    padding: 14,
    color: "#64748b",
    fontWeight: 700,
    textAlign: "center",
  },

  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,.45)",
    zIndex: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  modalCard: {
    width: "min(720px, 100%)",
    background: "#ffffff",
    borderRadius: 18,
    padding: 22,
    boxShadow: "0 30px 70px rgba(15,23,42,.28)",
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },

  modalClose: {
    width: 36,
    height: 36,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    background: "#ffffff",
    fontSize: 24,
    cursor: "pointer",
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
  },

  formGroup: {
    display: "grid",
    gap: 7,
    marginBottom: 12,
    fontWeight: 900,
    fontSize: 13,
  },

  input: {
    height: 44,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "0 12px",
    outline: "none",
  },

  textarea: {
    minHeight: 130,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: 12,
    resize: "vertical",
    fontFamily: "inherit",
    outline: "none",
  },

  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
  },

  greenBtn: {
    height: 42,
    border: "none",
    borderRadius: 10,
    background: "#16a34a",
    color: "#ffffff",
    fontWeight: 900,
    padding: "0 16px",
    cursor: "pointer",
  },

  lightBtn: {
    height: 42,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 900,
    padding: "0 16px",
    cursor: "pointer",
  },

  detailBox: {
    marginTop: 14,
    background: "#f8fafc",
    borderRadius: 12,
    padding: 14,
    lineHeight: 1.6,
  },
};