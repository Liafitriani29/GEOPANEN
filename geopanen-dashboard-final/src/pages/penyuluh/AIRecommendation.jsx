import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import PenyuluhTopbar from "../../components/PenyuluhTopbar";

const API = "http://localhost:3000/api";

function safeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatNumber(value, digit = 2) {
  return safeNumber(value, 0).toLocaleString("id-ID", {
    minimumFractionDigits: digit,
    maximumFractionDigits: digit,
  });
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
}

function normalizeStatus(row) {
  const status = String(row.status || "").toLowerCase();
  const statusKirim = String(row.status_kirim || "").toLowerCase();

  if (status === "diterapkan") return "Diterapkan";
  if (status === "dikirim" || statusKirim === "terkirim") return "Dikirim";
  return "Pending";
}

function normalizePriority(value) {
  const raw = String(value || "").toLowerCase();

  if (raw === "tinggi") return "Tinggi";
  if (raw === "rendah") return "Rendah";
  return "Sedang";
}

function normalizeRecommendation(row) {
  return {
    id: row.id,
    petani_id: row.petani_id,
    lahan_id: row.lahan_id,
    penyuluh_id: row.penyuluh_id,

    nama_petani: row.nama_petani || row.petani || row.nama || "Petani",
    email_petani: row.email_petani || "-",
    no_hp: row.no_hp || row.telepon || "-",

    nama_lahan: row.nama_lahan || "Lahan Binaan",
    nama_desa: row.nama_desa || row.desa || "-",
    nama_kecamatan: row.nama_kecamatan || row.kecamatan || "-",

    luas_ha: safeNumber(row.luas_ha, 0),
    varietas: row.varietas || "Padi",

    jenis: row.jenis || "Pemupukan",
    rekomendasi: row.rekomendasi || "-",
    prioritas: normalizePriority(row.prioritas),
    status: normalizeStatus(row),
    status_kirim: row.status_kirim || "pending",

    tanggal_kirim: row.tanggal_kirim || null,
    tanggal_diterapkan: row.tanggal_diterapkan || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,

    tanggal:
      formatDateTime(row.tanggal_kirim) !== "-"
        ? formatDateTime(row.tanggal_kirim)
        : formatDateTime(row.created_at),
  };
}

function priorityStyle(value) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  };

  if (value === "Tinggi") {
    return {
      ...base,
      color: "#dc2626",
      background: "#fee2e2",
    };
  }

  if (value === "Sedang") {
    return {
      ...base,
      color: "#d97706",
      background: "#ffedd5",
    };
  }

  return {
    ...base,
    color: "#059669",
    background: "#dcfce7",
  };
}

function statusStyle(value) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  };

  if (value === "Dikirim") {
    return {
      ...base,
      color: "#047857",
      background: "#dcfce7",
    };
  }

  if (value === "Diterapkan") {
    return {
      ...base,
      color: "#2563eb",
      background: "#dbeafe",
    };
  }

  return {
    ...base,
    color: "#d97706",
    background: "#ffedd5",
  };
}

function typeIcon(type) {
  if (type === "Pemupukan") return "🧪";
  if (type === "Pengendalian Hama") return "🐛";
  if (type === "Pengendalian Penyakit") return "🛡️";
  if (type === "Irigasi") return "💧";
  if (type === "Panen") return "🌾";
  if (type === "Pemeliharaan Tanaman") return "🌿";
  return "🤖";
}

function getStatusLabel(value) {
  if (value === "Dikirim") return "📨 Dikirim";
  if (value === "Diterapkan") return "✅ Diterapkan";
  return "⏳ Pending";
}

export default function AIRecommendation() {
  const navigate = useNavigate();

  const [recommendations, setRecommendations] = useState([]);
  const [lahanOptions, setLahanOptions] = useState([]);

  const [selectedKec, setSelectedKec] = useState("all");
  const [selectedDesa, setSelectedDesa] = useState("all");
  const [selectedJenis, setSelectedJenis] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState("");

  const [openActionId, setOpenActionId] = useState(null);
  const [modalMode, setModalMode] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);

  const [form, setForm] = useState({
    id: "",
    petani_id: "",
    lahan_id: "",
    penyuluh_id: "",
    nama_petani: "",
    nama_lahan: "",
    jenis: "Pemupukan",
    rekomendasi: "",
    prioritas: "Sedang",
    status: "Pending",
  });

  const currentUser = useMemo(() => getStoredUser(), []);
  const penyuluhId =
    currentUser?.id ||
    localStorage.getItem("user_id") ||
    localStorage.getItem("penyuluh_id") ||
    null;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorText("");

      const res = await axios.get(`${API}/rekomendasi-ai`, {
        params: {
          limit: 200,
        },
      });

      const rows = safeList(res.data).map(normalizeRecommendation);
      setRecommendations(rows);
    } catch (err) {
      console.log("ERROR GET REKOMENDASI AI:", err.response?.data || err.message);
      setRecommendations([]);
      setErrorText(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Gagal mengambil data rekomendasi AI."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReference = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/penyuluh/petani-binaan`);
      const rows = safeList(res.data);

      const mapped = rows
        .map((item) => ({
          petani_id: item.petani_id,
          nama_petani: item.nama_petani || "Petani",
          lahan_id: item.lahan_id || item.id,
          nama_lahan: item.nama_lahan || "Lahan Binaan",
          luas_ha: safeNumber(item.luas_ha, 0),
          nama_desa: item.nama_desa || "-",
          nama_kecamatan: item.nama_kecamatan || "-",
        }))
        .filter((item) => item.petani_id);

      setLahanOptions(mapped);
    } catch (err) {
      console.log("ERROR LOAD PETANI BINAAN:", err.response?.data || err.message);
      setLahanOptions([]);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchReference();
  }, [fetchData, fetchReference]);

  const mergedLahanOptions = useMemo(() => {
    const map = new Map();

    lahanOptions.forEach((item) => {
      const key = `${item.petani_id}-${item.lahan_id || "x"}`;
      map.set(key, item);
    });

    recommendations.forEach((item) => {
      const key = `${item.petani_id}-${item.lahan_id || "x"}`;

      if (!map.has(key)) {
        map.set(key, {
          petani_id: item.petani_id,
          nama_petani: item.nama_petani,
          lahan_id: item.lahan_id,
          nama_lahan: item.nama_lahan,
          luas_ha: item.luas_ha,
          nama_desa: item.nama_desa,
          nama_kecamatan: item.nama_kecamatan,
        });
      }
    });

    return Array.from(map.values());
  }, [lahanOptions, recommendations]);

  const petaniOptions = useMemo(() => {
    const map = new Map();

    mergedLahanOptions.forEach((item) => {
      if (!item.petani_id) return;

      if (!map.has(String(item.petani_id))) {
        map.set(String(item.petani_id), {
          id: item.petani_id,
          nama_petani: item.nama_petani,
        });
      }
    });

    return Array.from(map.values());
  }, [mergedLahanOptions]);

  const kecamatanOptions = useMemo(() => {
    const values = recommendations
      .map((item) => item.nama_kecamatan)
      .filter((item) => item && item !== "-");

    return Array.from(new Set(values));
  }, [recommendations]);

  const desaOptions = useMemo(() => {
    const values = recommendations
      .filter((item) => {
        if (selectedKec === "all") return true;
        return item.nama_kecamatan === selectedKec;
      })
      .map((item) => item.nama_desa)
      .filter((item) => item && item !== "-");

    return Array.from(new Set(values));
  }, [recommendations, selectedKec]);

  const jenisOptions = useMemo(() => {
    const values = recommendations.map((item) => item.jenis).filter(Boolean);
    return Array.from(new Set(values));
  }, [recommendations]);

  const filteredRecommendations = useMemo(() => {
    const keyword = search.toLowerCase();

    return recommendations.filter((item) => {
      const matchKec =
        selectedKec === "all" || item.nama_kecamatan === selectedKec;

      const matchDesa =
        selectedDesa === "all" || item.nama_desa === selectedDesa;

      const matchJenis =
        selectedJenis === "all" || item.jenis === selectedJenis;

      const matchStatus =
        selectedStatus === "all" || item.status === selectedStatus;

      const matchSearch =
        !keyword ||
        String(item.nama_petani).toLowerCase().includes(keyword) ||
        String(item.nama_lahan).toLowerCase().includes(keyword) ||
        String(item.rekomendasi).toLowerCase().includes(keyword) ||
        String(item.jenis).toLowerCase().includes(keyword);

      return matchKec && matchDesa && matchJenis && matchStatus && matchSearch;
    });
  }, [
    recommendations,
    selectedKec,
    selectedDesa,
    selectedJenis,
    selectedStatus,
    search,
  ]);

  const priorityHigh = useMemo(() => {
    return filteredRecommendations
      .filter((item) => item.prioritas === "Tinggi")
      .slice(0, 4);
  }, [filteredRecommendations]);

  const popularTypes = useMemo(() => {
    const map = new Map();

    recommendations.forEach((item) => {
      if (!map.has(item.jenis)) {
        map.set(item.jenis, {
          jenis: item.jenis,
          total: 0,
        });
      }

      map.get(item.jenis).total += 1;
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [recommendations]);

  const petaniCount = useMemo(() => {
    const set = new Set(recommendations.map((item) => item.petani_id));
    return set.size;
  }, [recommendations]);

  const diterapkanCount = recommendations.filter(
    (item) => item.status === "Diterapkan"
  ).length;

  const dikirimCount = recommendations.filter(
    (item) => item.status === "Dikirim"
  ).length;

  const aktifCount = recommendations.filter(
    (item) => item.status !== "Diterapkan"
  ).length;

  const dampakPercent = recommendations.length
    ? Math.min(
        100,
        ((dikirimCount + diterapkanCount) / recommendations.length) * 100
      )
    : 0;

  const tambahanProduksi = recommendations.reduce((total, item) => {
    if (item.status === "Dikirim" || item.status === "Diterapkan") {
      return total + safeNumber(item.luas_ha, 0) * 1.2;
    }

    return total;
  }, 0);

  const insightList = useMemo(() => {
    const highCount = recommendations.filter(
      (item) => item.prioritas === "Tinggi"
    ).length;

    const pupukCount = recommendations.filter(
      (item) => item.jenis === "Pemupukan"
    ).length;

    const hamaCount = recommendations.filter((item) =>
      item.jenis.includes("Hama")
    ).length;

    const insights = [];

    if (highCount > 0) {
      insights.push({
        icon: "⚠️",
        title: `${highCount} rekomendasi prioritas tinggi`,
        desc: "Perlu ditindaklanjuti lebih dahulu oleh penyuluh.",
      });
    }

    if (pupukCount > 0) {
      insights.push({
        icon: "🧪",
        title: "Pemupukan menjadi rekomendasi dominan",
        desc: `${pupukCount} lahan membutuhkan penguatan pemupukan.`,
      });
    }

    if (hamaCount > 0) {
      insights.push({
        icon: "🐛",
        title: "Potensi gangguan hama perlu dipantau",
        desc: "Pantau kondisi daun, batang, dan kelembapan lahan.",
      });
    }

    insights.push({
      icon: "📈",
      title: `Progress rekomendasi ${formatNumber(dampakPercent, 1)}%`,
      desc: "Persentase dihitung dari rekomendasi yang sudah dikirim atau diterapkan.",
    });

    return insights.slice(0, 4);
  }, [recommendations, dampakPercent]);

  const resetForm = () => {
    setForm({
      id: "",
      petani_id: "",
      lahan_id: "",
      penyuluh_id: penyuluhId || "",
      nama_petani: "",
      nama_lahan: "",
      jenis: "Pemupukan",
      rekomendasi: "",
      prioritas: "Sedang",
      status: "Pending",
    });
  };

  const closeModal = () => {
    if (saving) return;

    setModalMode("");
    setSelectedItem(null);
    resetForm();
  };

  const openCreateModal = () => {
    const first = mergedLahanOptions[0] || {};

    setSelectedItem(null);
    setForm({
      id: "",
      petani_id: first.petani_id || "",
      lahan_id: first.lahan_id || "",
      penyuluh_id: penyuluhId || "",
      nama_petani: first.nama_petani || "",
      nama_lahan: first.nama_lahan || "",
      jenis: "Pemupukan",
      rekomendasi: "",
      prioritas: "Sedang",
      status: "Pending",
    });
    setModalMode("create");
    setOpenActionId(null);
  };

  const openDetailModal = (item) => {
    setSelectedItem(item);
    setModalMode("detail");
    setOpenActionId(null);
  };

  const openEditModal = (item) => {
    setSelectedItem(item);
    setForm({
      id: item.id,
      petani_id: item.petani_id || "",
      lahan_id: item.lahan_id || "",
      penyuluh_id: item.penyuluh_id || penyuluhId || "",
      nama_petani: item.nama_petani || "",
      nama_lahan: item.nama_lahan || "",
      jenis: item.jenis || "Pemupukan",
      rekomendasi: item.rekomendasi || "",
      prioritas: item.prioritas || "Sedang",
      status: item.status || "Pending",
    });
    setModalMode("edit");
    setOpenActionId(null);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;

    if (name === "petani_id") {
      const selectedPetani = petaniOptions.find(
        (item) => String(item.id) === String(value)
      );

      const firstLahan = mergedLahanOptions.find(
        (item) => String(item.petani_id) === String(value)
      );

      setForm((prev) => ({
        ...prev,
        petani_id: value,
        nama_petani: selectedPetani?.nama_petani || "",
        lahan_id: firstLahan?.lahan_id || "",
        nama_lahan: firstLahan?.nama_lahan || "",
      }));

      return;
    }

    if (name === "lahan_id") {
      const selectedLahan = mergedLahanOptions.find(
        (item) => String(item.lahan_id) === String(value)
      );

      setForm((prev) => ({
        ...prev,
        lahan_id: value,
        petani_id: selectedLahan?.petani_id || prev.petani_id,
        nama_petani: selectedLahan?.nama_petani || prev.nama_petani,
        nama_lahan: selectedLahan?.nama_lahan || prev.nama_lahan,
      }));

      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const generateRecommendations = async () => {
    try {
      setGenerating(true);

      await axios.post(`${API}/rekomendasi-ai/generate`, {
        penyuluh_id: penyuluhId || null,
      });

      await fetchData();
      alert("Generate rekomendasi selesai.");
    } catch (err) {
      console.log("ERROR GENERATE:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Gagal generate rekomendasi.");
    } finally {
      setGenerating(false);
    }
  };

  const submitForm = async (e) => {
    e.preventDefault();

    if (!form.petani_id) {
      alert("Petani wajib dipilih.");
      return;
    }

    if (!form.jenis) {
      alert("Jenis rekomendasi wajib dipilih.");
      return;
    }

    if (!form.rekomendasi.trim()) {
      alert("Isi rekomendasi wajib diisi.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        petani_id: form.petani_id,
        lahan_id: form.lahan_id || null,
        penyuluh_id: form.penyuluh_id || penyuluhId || null,
        jenis: form.jenis,
        rekomendasi: form.rekomendasi,
        prioritas: form.prioritas,
        status: form.status,
      };

      if (modalMode === "create") {
        await axios.post(`${API}/rekomendasi-ai`, payload);
        alert("Rekomendasi penyuluh berhasil dibuat.");
      }

      if (modalMode === "edit" && selectedItem?.id) {
        await axios.put(`${API}/rekomendasi-ai/${selectedItem.id}`, payload);

        if (form.status === "Dikirim" && selectedItem.status !== "Dikirim") {
          await axios.put(`${API}/rekomendasi-ai/${selectedItem.id}/kirim`);
        }

        if (
          form.status === "Diterapkan" &&
          selectedItem.status !== "Diterapkan"
        ) {
          await axios.put(`${API}/rekomendasi-ai/${selectedItem.id}/terapkan`);
        }

        alert("Rekomendasi berhasil diperbarui.");
      }

      closeModal();
      await fetchData();
    } catch (err) {
      console.log("ERROR SIMPAN REKOMENDASI:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Gagal menyimpan rekomendasi.");
    } finally {
      setSaving(false);
    }
  };

  const sendToPetani = async (item) => {
    if (!item?.id) {
      alert("ID rekomendasi tidak ditemukan.");
      return;
    }

    try {
      await axios.put(`${API}/rekomendasi-ai/${item.id}/kirim`);
      setOpenActionId(null);
      await fetchData();
      alert("Rekomendasi berhasil dikirim ke petani.");
    } catch (err) {
      console.log("ERROR KIRIM:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Gagal mengirim rekomendasi.");
    }
  };

  const markAsApplied = async (item) => {
    if (!item?.id) {
      alert("ID rekomendasi tidak ditemukan.");
      return;
    }

    try {
      await axios.put(`${API}/rekomendasi-ai/${item.id}/terapkan`);
      setOpenActionId(null);
      await fetchData();
      alert("Rekomendasi berhasil ditandai diterapkan.");
    } catch (err) {
      console.log("ERROR TERAPKAN:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Gagal menandai diterapkan.");
    }
  };

  const handleMenuToggle = (item) => {
    setOpenActionId((prev) =>
      String(prev) === String(item.id) ? null : item.id
    );
  };

  return (
    <div style={styles.page}>
      <PenyuluhTopbar />

      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.headerIcon}>🤖</div>

          <div>
            <h1 style={styles.title}>Rekomendasi AI Penyuluh</h1>
            <p style={styles.subtitle}>
              Rekomendasi cerdas berbasis AI untuk petani binaan Anda
            </p>
          </div>
        </div>
      </div>

      {errorText && <div style={styles.errorBox}>{errorText}</div>}

      <div style={styles.kpiGrid}>
        <KpiCard
          title="Total Rekomendasi Hari Ini"
          value={recommendations.length}
          desc="Rekomendasi dari database"
          icon="🤖"
          color="#16a34a"
          bg="#dcfce7"
        />

        <KpiCard
          title="Petani Binaan"
          value={petaniCount}
          desc="Petani menerima rekomendasi"
          icon="👥"
          color="#2563eb"
          bg="#dbeafe"
        />

        <KpiCard
          title="Rekomendasi Diterapkan"
          value={diterapkanCount}
          desc={`${
            recommendations.length > 0
              ? Math.round((diterapkanCount / recommendations.length) * 100)
              : 0
          }% dari total rekomendasi`}
          icon="✅"
          color="#7c3aed"
          bg="#ede9fe"
        />

        <KpiCard
          title="Progress Rekomendasi"
          value={`+${formatNumber(dampakPercent, 1)}%`}
          desc="Progress rekomendasi aktif"
          icon="📈"
          color="#d97706"
          bg="#ffedd5"
        />

        <KpiCard
          title="Rekomendasi Aktif"
          value={aktifCount}
          desc="Masih perlu ditindaklanjuti"
          icon="🌿"
          color="#059669"
          bg="#dcfce7"
        />
      </div>

      <div style={styles.contentGrid}>
        <div style={styles.leftColumn}>
          <div style={styles.tableCard}>
            <div style={styles.filterRow}>
              <select
                style={styles.select}
                value={selectedKec}
                onChange={(e) => {
                  setSelectedKec(e.target.value);
                  setSelectedDesa("all");
                }}
              >
                <option value="all">Semua Kecamatan</option>
                {kecamatanOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                style={styles.select}
                value={selectedDesa}
                onChange={(e) => setSelectedDesa(e.target.value)}
              >
                <option value="all">Semua Desa</option>
                {desaOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                style={styles.select}
                value={selectedJenis}
                onChange={(e) => setSelectedJenis(e.target.value)}
              >
                <option value="all">Semua Jenis Rekomendasi</option>
                {jenisOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                style={styles.select}
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="all">Semua Status</option>
                <option value="Pending">Pending</option>
                <option value="Dikirim">Dikirim</option>
                <option value="Diterapkan">Diterapkan</option>
              </select>

              <div style={styles.searchBox}>
                <span>🔍</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari petani atau rekomendasi..."
                  style={styles.searchInput}
                />
              </div>
            </div>

            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>
                Daftar Rekomendasi untuk Petani Binaan
              </h3>

              <div style={styles.headerActions}>
                <button
                  style={styles.generateBtn}
                  onClick={generateRecommendations}
                  disabled={generating}
                >
                  {generating ? "Generate..." : "+ Generate AI"}
                </button>

                <button style={styles.smallBtn} onClick={fetchData}>
                  Refresh
                </button>
              </div>
            </div>

            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Petani</th>
                    <th style={styles.th}>Lahan</th>
                    <th style={styles.th}>Jenis Rekomendasi</th>
                    <th style={styles.th}>Rekomendasi AI</th>
                    <th style={styles.th}>Prioritas</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Tanggal</th>
                    <th style={styles.th}>Aksi</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" style={styles.emptyCell}>
                        Memuat rekomendasi AI...
                      </td>
                    </tr>
                  ) : filteredRecommendations.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={styles.emptyCell}>
                        Belum ada rekomendasi. Klik Generate AI atau Buat
                        Rekomendasi Penyuluh.
                      </td>
                    </tr>
                  ) : (
                    filteredRecommendations.map((item) => (
                      <tr key={item.id}>
                        <td style={styles.td}>
                          <div style={styles.petaniCell}>
                            <div style={styles.avatar}>👨‍🌾</div>

                            <div>
                              <strong>{item.nama_petani}</strong>
                              <small style={styles.smallText}>
                                {item.email_petani || item.no_hp}
                              </small>
                            </div>
                          </div>
                        </td>

                        <td style={styles.td}>
                          <strong>{formatNumber(item.luas_ha, 2)} Ha</strong>
                          <small style={styles.smallText}>
                            {item.nama_lahan}
                          </small>
                        </td>

                        <td style={styles.td}>{item.jenis}</td>

                        <td style={styles.td}>
                          <div style={styles.rekomText}>
                            {item.rekomendasi}
                          </div>
                        </td>

                        <td style={styles.td}>
                          <span style={priorityStyle(item.prioritas)}>
                            {item.prioritas}
                          </span>
                        </td>

                        <td style={styles.td}>
                          <span style={statusStyle(item.status)}>
                            {getStatusLabel(item.status)}
                          </span>
                        </td>

                        <td style={styles.td}>
                          <strong>{item.tanggal}</strong>
                          <small style={styles.smallText}>
                            {item.status_kirim === "terkirim"
                              ? "Terkirim"
                              : "Database"}
                          </small>
                        </td>

                        <td style={styles.td}>
                          <div style={styles.actionGroup}>
                            <button
                              style={styles.iconBtn}
                              onClick={() => openDetailModal(item)}
                              title="Lihat"
                            >
                              👁️
                            </button>

                            <button
                              style={styles.iconBtn}
                              onClick={() => openEditModal(item)}
                              title="Edit"
                            >
                              ✏️
                            </button>

                            <button
                              style={styles.iconBtn}
                              onClick={() => handleMenuToggle(item)}
                              title="Lainnya"
                            >
                              ⋮
                            </button>

                            {String(openActionId) === String(item.id) && (
                              <div style={styles.actionMenu}>
                                <button
                                  style={styles.menuBtn}
                                  onClick={() => sendToPetani(item)}
                                >
                                  📨 Kirim ke Petani
                                </button>

                                <button
                                  style={styles.menuBtn}
                                  onClick={() => markAsApplied(item)}
                                >
                                  ✅ Tandai Diterapkan
                                </button>

                                <button
                                  style={styles.menuBtn}
                                  onClick={() =>
                                    navigate(
                                      `/penyuluh/analisis?lahan_id=${
                                        item.lahan_id || ""
                                      }`
                                    )
                                  }
                                >
                                  📊 Buka Analisis
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div style={styles.tableFooter}>
              <span>
                Menampilkan {filteredRecommendations.length} dari{" "}
                {recommendations.length} rekomendasi
              </span>

              <div style={styles.pagination}>
                <button style={styles.pageBtn}>‹</button>
                <button style={{ ...styles.pageBtn, ...styles.activePage }}>
                  1
                </button>
                <button style={styles.pageBtn}>2</button>
                <button style={styles.pageBtn}>›</button>
              </div>
            </div>
          </div>

          <div style={styles.popularCard}>
            <h3 style={styles.cardTitle}>Jenis Rekomendasi Populer</h3>

            <div style={styles.popularGrid}>
              {popularTypes.length === 0 ? (
                <div style={styles.emptyBox}>Belum ada data rekomendasi.</div>
              ) : (
                popularTypes.map((item) => (
                  <PopularTypeCard key={item.jenis} item={item} />
                ))
              )}
            </div>
          </div>
        </div>

        <div style={styles.rightColumn}>
          <div style={styles.sideCard}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Rekomendasi Prioritas Tinggi</h3>

              <button
                style={styles.smallBtn}
                onClick={() => {
                  setSelectedStatus("all");
                  setSelectedJenis("all");
                }}
              >
                Lihat Semua
              </button>
            </div>

            <div style={styles.priorityList}>
              {priorityHigh.length === 0 ? (
                <div style={styles.emptyBox}>
                  Tidak ada rekomendasi prioritas tinggi.
                </div>
              ) : (
                priorityHigh.map((item) => (
                  <PriorityRow
                    key={item.id}
                    item={item}
                    onClick={() => openDetailModal(item)}
                  />
                ))
              )}
            </div>
          </div>

          <div style={styles.sideCard}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Insight AI</h3>

              <button
                style={styles.smallBtn}
                onClick={() =>
                  alert(
                    "Insight dihitung dari data rekomendasi_ai di database."
                  )
                }
              >
                Lihat Detail
              </button>
            </div>

            <div style={styles.insightList}>
              {insightList.length === 0 ? (
                <div style={styles.emptyBox}>Belum ada insight AI.</div>
              ) : (
                insightList.map((item, index) => (
                  <InsightRow key={index} item={item} />
                ))
              )}
            </div>
          </div>

          <div style={styles.sideCard}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Dampak Rekomendasi</h3>

              <button
                style={styles.smallBtn}
                onClick={() => navigate("/penyuluh/analisis")}
              >
                Lihat Laporan
              </button>
            </div>

            <div style={styles.impactGrid}>
              <ImpactBox
                value={`+${formatNumber(dampakPercent, 1)}%`}
                label="Progress Rekomendasi"
              />

              <ImpactBox
                value={`+${formatNumber(tambahanProduksi, 2)} Ton`}
                label="Estimasi Dampak Produksi"
              />

              <ImpactBox
                value={`${dikirimCount}`}
                label="Sudah Dikirim"
              />
            </div>
          </div>
        </div>
      </div>

      <button style={styles.floatingBtn} onClick={openCreateModal}>
        + Buat Rekomendasi Penyuluh
      </button>

      {modalMode && (
        <RecommendationModal
          mode={modalMode}
          item={selectedItem}
          form={form}
          petaniOptions={petaniOptions}
          lahanOptions={mergedLahanOptions}
          saving={saving}
          onChange={handleFormChange}
          onClose={closeModal}
          onSubmit={submitForm}
          onSend={() => selectedItem && sendToPetani(selectedItem)}
          onApplied={() => selectedItem && markAsApplied(selectedItem)}
        />
      )}
    </div>
  );
}

function RecommendationModal({
  mode,
  item,
  form,
  petaniOptions,
  lahanOptions,
  saving,
  onChange,
  onClose,
  onSubmit,
  onSend,
  onApplied,
}) {
  const isDetail = mode === "detail";
  const isCreate = mode === "create";

  const filteredLahanOptions = lahanOptions.filter((lahan) => {
    if (!form.petani_id) return true;
    return String(lahan.petani_id) === String(form.petani_id);
  });

  const title =
    mode === "detail"
      ? "Detail Rekomendasi"
      : mode === "edit"
      ? "Edit Rekomendasi"
      : "Buat Rekomendasi Penyuluh";

  return (
    <div style={styles.modalBackdrop}>
      <div style={styles.modalCard}>
        <div style={styles.modalHeader}>
          <h2>{title}</h2>

          <button style={styles.modalClose} onClick={onClose}>
            ×
          </button>
        </div>

        {isDetail ? (
          <>
            <div style={styles.detailGrid}>
              <Info label="Petani" value={item?.nama_petani} />
              <Info label="Lahan" value={item?.nama_lahan} />
              <Info label="Jenis" value={item?.jenis} />
              <Info label="Prioritas" value={item?.prioritas} />
              <Info label="Status" value={item?.status} />
              <Info label="Status Kirim" value={item?.status_kirim} />
              <Info label="Tanggal" value={item?.tanggal} />
              <Info label="Desa" value={item?.nama_desa} />
              <Info label="Kecamatan" value={item?.nama_kecamatan} />
            </div>

            <div style={styles.detailBox}>
              <strong>Rekomendasi AI</strong>
              <p>{item?.rekomendasi}</p>
            </div>

            <div style={styles.modalActions}>
              <button style={styles.greenBtn} onClick={onSend}>
                Kirim ke Petani
              </button>

              <button style={styles.blueBtn} onClick={onApplied}>
                Tandai Diterapkan
              </button>

              <button style={styles.lightBtn} onClick={onClose}>
                Tutup
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            <div style={styles.formGrid}>
              <label style={styles.formGroup}>
                Petani
                {petaniOptions.length > 0 ? (
                  <select
                    name="petani_id"
                    value={form.petani_id}
                    onChange={onChange}
                    style={styles.input}
                    disabled={!isCreate}
                  >
                    <option value="">Pilih petani</option>
                    {petaniOptions.map((petani) => (
                      <option key={petani.id} value={petani.id}>
                        {petani.nama_petani}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    name="petani_id"
                    value={form.petani_id}
                    onChange={onChange}
                    style={styles.input}
                    placeholder="ID petani"
                    disabled={!isCreate}
                  />
                )}
              </label>

              <label style={styles.formGroup}>
                Lahan
                <select
                  name="lahan_id"
                  value={form.lahan_id || ""}
                  onChange={onChange}
                  style={styles.input}
                >
                  <option value="">Tanpa lahan spesifik</option>
                  {filteredLahanOptions.map((lahan) => (
                    <option
                      key={`${lahan.petani_id}-${lahan.lahan_id}`}
                      value={lahan.lahan_id || ""}
                    >
                      {lahan.nama_lahan} - {lahan.nama_petani}
                    </option>
                  ))}
                </select>
              </label>

              <label style={styles.formGroup}>
                Jenis Rekomendasi
                <select
                  name="jenis"
                  value={form.jenis}
                  onChange={onChange}
                  style={styles.input}
                >
                  <option value="Pemupukan">Pemupukan</option>
                  <option value="Pengendalian Hama">Pengendalian Hama</option>
                  <option value="Pengendalian Penyakit">
                    Pengendalian Penyakit
                  </option>
                  <option value="Irigasi">Irigasi</option>
                  <option value="Panen">Panen</option>
                  <option value="Pemeliharaan Tanaman">
                    Pemeliharaan Tanaman
                  </option>
                </select>
              </label>

              <label style={styles.formGroup}>
                Prioritas
                <select
                  name="prioritas"
                  value={form.prioritas}
                  onChange={onChange}
                  style={styles.input}
                >
                  <option value="Tinggi">Tinggi</option>
                  <option value="Sedang">Sedang</option>
                  <option value="Rendah">Rendah</option>
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
                  <option value="Pending">Pending</option>
                  <option value="Dikirim">Dikirim</option>
                  <option value="Diterapkan">Diterapkan</option>
                </select>
              </label>
            </div>

            <label style={styles.formGroup}>
              Isi Rekomendasi
              <textarea
                name="rekomendasi"
                value={form.rekomendasi}
                onChange={onChange}
                style={styles.textarea}
                placeholder="Tulis rekomendasi untuk petani..."
              />
            </label>

            <div style={styles.modalActions}>
              <button style={styles.greenBtn} disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan"}
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

function KpiCard({ title, value, desc, icon, color, bg }) {
  return (
    <div style={styles.kpiCard}>
      <div>
        <h3 style={styles.kpiTitle}>{title}</h3>

        <div style={styles.kpiValue}>
          <strong style={{ color }}>{value}</strong>
        </div>

        <p style={styles.kpiDesc}>{desc}</p>
      </div>

      <div style={{ ...styles.kpiIcon, color, background: bg }}>{icon}</div>
    </div>
  );
}

function PriorityRow({ item, onClick }) {
  return (
    <button style={styles.priorityRow} onClick={onClick}>
      <div style={styles.avatarSmall}>👨‍🌾</div>

      <div>
        <strong>{item.nama_petani}</strong>
        <p>{item.jenis}</p>
      </div>

      <span style={styles.needAction}>Perlu Tindakan</span>
    </button>
  );
}

function InsightRow({ item }) {
  return (
    <div style={styles.insightRow}>
      <div style={styles.insightIcon}>{item.icon}</div>

      <div>
        <strong>{item.title}</strong>
        <p>{item.desc}</p>
      </div>
    </div>
  );
}

function ImpactBox({ value, label }) {
  return (
    <div style={styles.impactBox}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function PopularTypeCard({ item }) {
  return (
    <div style={styles.popularItem}>
      <div style={styles.popularIcon}>{typeIcon(item.jenis)}</div>

      <div>
        <strong>{item.jenis}</strong>
        <span>{item.total} rekomendasi</span>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div style={styles.infoRow}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f6f8fb",
    padding: 24,
    paddingBottom: 95,
    boxSizing: "border-box",
    color: "#0f172a",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  header: {
    marginBottom: 22,
  },

  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },

  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    background: "#eef2ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
  },

  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 950,
    letterSpacing: "-0.6px",
  },

  subtitle: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 14,
  },

  errorBox: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    padding: 14,
    borderRadius: 12,
    fontWeight: 800,
    marginBottom: 16,
  },

  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 16,
    marginBottom: 22,
  },

  kpiCard: {
    minHeight: 118,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 12px 30px rgba(15,23,42,.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },

  kpiTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 900,
  },

  kpiValue: {
    marginTop: 12,
    fontSize: 30,
    lineHeight: 1,
    fontWeight: 950,
  },

  kpiDesc: {
    margin: "12px 0 0",
    color: "#64748b",
    fontSize: 14,
  },

  kpiIcon: {
    width: 62,
    height: 62,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 27,
    flexShrink: 0,
  },

  contentGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 410px",
    gap: 20,
  },

  leftColumn: {
    display: "grid",
    gap: 20,
    minWidth: 0,
  },

  rightColumn: {
    display: "grid",
    gap: 20,
    alignContent: "start",
  },

  tableCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 12px 30px rgba(15,23,42,.06)",
  },

  filterRow: {
    display: "grid",
    gridTemplateColumns: "170px 170px 230px 160px 1fr",
    gap: 12,
    marginBottom: 18,
  },

  select: {
    height: 44,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    background: "#ffffff",
    padding: "0 12px",
    fontWeight: 800,
    color: "#0f172a",
  },

  searchBox: {
    height: 44,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 12px",
  },

  searchInput: {
    border: "none",
    outline: "none",
    width: "100%",
    fontWeight: 700,
    color: "#0f172a",
  },

  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  headerActions: {
    display: "flex",
    gap: 8,
  },

  cardTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 950,
  },

  smallBtn: {
    height: 34,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 9,
    padding: "0 13px",
    fontWeight: 900,
    cursor: "pointer",
  },

  generateBtn: {
    height: 34,
    border: "none",
    background: "#16a34a",
    color: "#ffffff",
    borderRadius: 9,
    padding: "0 13px",
    fontWeight: 900,
    cursor: "pointer",
  },

  tableWrap: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },

  th: {
    textAlign: "left",
    padding: "13px 10px",
    color: "#475569",
    fontSize: 12,
    fontWeight: 950,
    borderBottom: "1px solid #e5e7eb",
    whiteSpace: "nowrap",
  },

  td: {
    padding: "13px 10px",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "middle",
  },

  petaniCell: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    background: "#dbeafe",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  avatarSmall: {
    width: 38,
    height: 38,
    borderRadius: 999,
    background: "#e0f2fe",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  smallText: {
    display: "block",
    color: "#64748b",
    fontSize: 12,
    marginTop: 3,
  },

  rekomText: {
    maxWidth: 290,
    lineHeight: 1.45,
    fontWeight: 700,
  },

  actionGroup: {
    display: "flex",
    gap: 7,
    position: "relative",
  },

  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    cursor: "pointer",
  },

  actionMenu: {
    position: "absolute",
    top: 38,
    right: 0,
    width: 190,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    boxShadow: "0 20px 40px rgba(15,23,42,.18)",
    zIndex: 100,
    padding: 8,
    display: "grid",
    gap: 4,
  },

  menuBtn: {
    width: "100%",
    border: "none",
    background: "transparent",
    textAlign: "left",
    padding: "9px 10px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 800,
    color: "#0f172a",
  },

  emptyCell: {
    textAlign: "center",
    padding: 26,
    color: "#64748b",
    fontWeight: 700,
  },

  tableFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#64748b",
    fontSize: 13,
    padding: "15px 0 0",
  },

  pagination: {
    display: "flex",
    gap: 7,
  },

  pageBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    cursor: "pointer",
    fontWeight: 800,
  },

  activePage: {
    background: "#dcfce7",
    borderColor: "#86efac",
    color: "#047857",
  },

  popularCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 12px 30px rgba(15,23,42,.06)",
  },

  popularGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 14,
    marginTop: 14,
  },

  popularItem: {
    background: "#f8fafc",
    borderRadius: 14,
    padding: 14,
    display: "flex",
    alignItems: "center",
    gap: 12,
    minHeight: 74,
  },

  popularIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: "#dcfce7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
  },

  sideCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 12px 30px rgba(15,23,42,.06)",
  },

  priorityList: {
    display: "grid",
    gap: 14,
  },

  priorityRow: {
    width: "100%",
    border: "none",
    background: "transparent",
    textAlign: "left",
    cursor: "pointer",
    display: "grid",
    gridTemplateColumns: "42px 1fr auto",
    alignItems: "center",
    gap: 12,
    padding: "0 0 12px",
    borderBottom: "1px solid #f1f5f9",
  },

  needAction: {
    color: "#dc2626",
    background: "#fee2e2",
    padding: "5px 9px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
  },

  insightList: {
    display: "grid",
    gap: 13,
  },

  insightRow: {
    display: "grid",
    gridTemplateColumns: "40px 1fr",
    gap: 12,
    alignItems: "flex-start",
    paddingBottom: 12,
    borderBottom: "1px solid #f1f5f9",
  },

  insightIcon: {
    width: 36,
    height: 36,
    borderRadius: 999,
    background: "#eef2ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  impactGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
  },

  impactBox: {
    background: "#f8fafc",
    borderRadius: 14,
    padding: 14,
  },

  emptyBox: {
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
    padding: 14,
    color: "#64748b",
    fontWeight: 700,
    textAlign: "center",
  },

  floatingBtn: {
    position: "fixed",
    right: 34,
    bottom: 34,
    zIndex: 20,
    height: 54,
    padding: "0 24px",
    border: "none",
    borderRadius: 12,
    background: "#16a34a",
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 18px 35px rgba(22,163,74,.28)",
  },

  modalBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 999,
    background: "rgba(15, 23, 42, .45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  modalCard: {
    width: "min(760px, 100%)",
    background: "#ffffff",
    borderRadius: 18,
    padding: 22,
    boxShadow: "0 30px 70px rgba(15,23,42,.3)",
  },

  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    fontSize: 24,
    cursor: "pointer",
  },

  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
  },

  infoRow: {
    background: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    display: "grid",
    gap: 5,
  },

  detailBox: {
    marginTop: 14,
    background: "#f8fafc",
    borderRadius: 12,
    padding: 14,
    lineHeight: 1.6,
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
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
    minHeight: 120,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: 12,
    outline: "none",
    resize: "vertical",
    fontFamily: "inherit",
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

  blueBtn: {
    height: 42,
    border: "none",
    borderRadius: 10,
    background: "#2563eb",
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
};