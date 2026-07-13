import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../services/api";
import {
  Trash2,
  Pencil,
  Eye,
  Plus,
  X,
  Search,
  Filter,
  Upload,
  RefreshCw,
  Users,
  UserCheck,
  UserX,
  Sprout,
  TrendingUp,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  MapPin,
  Activity,
  Phone,
  Mail,
} from "lucide-react";

const initialForm = {
  nama: "",
  email: "",
  password: "",
  no_hp: "",
  status: "aktif",
};

const normalizeApiList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.users)) return payload.users;
  if (Array.isArray(payload?.petani)) return payload.petani;
  return [];
};

const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const getStatusType = (item) => {
  const raw = String(
    item?.status || item?.status_akun || item?.is_active || item?.aktif || ""
  ).toLowerCase();

  if (
    raw === "0" ||
    raw.includes("nonaktif") ||
    raw.includes("inactive") ||
    raw.includes("tidak")
  ) {
    return "nonaktif";
  }

  if (
    raw.includes("verifikasi") ||
    raw.includes("pending") ||
    raw.includes("menunggu")
  ) {
    return "verifikasi";
  }

  return "aktif";
};

const getStatusLabel = (item) => {
  const type = getStatusType(item);

  if (type === "nonaktif") return "Nonaktif";
  if (type === "verifikasi") return "Perlu Verifikasi";
  return "Aktif";
};

const getStatusStyle = (item) => {
  const type = getStatusType(item);

  if (type === "nonaktif") {
    return {
      background: "#f1f5f9",
      color: "#64748b",
      border: "1px solid #e2e8f0",
    };
  }

  if (type === "verifikasi") {
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

const getInitial = (nama) => {
  const text = String(nama || "P").trim();
  return text.charAt(0).toUpperCase();
};

const formatNumber = (value, digit = 2) => {
  const number = Number(value || 0);

  return number.toLocaleString("id-ID", {
    minimumFractionDigits: digit,
    maximumFractionDigits: digit,
  });
};

const formatDiff = (value, suffix = "") => {
  const number = Number(value || 0);
  const arrow = number >= 0 ? "↑" : "↓";

  return `${arrow} ${formatNumber(Math.abs(number), suffix ? 2 : 0)}${suffix} dari bulan lalu`;
};

const formatTanggal = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getNoHp = (item) => {
  return item?.no_hp || item?.nomor_hp || item?.hp || item?.phone || "-";
};

const getNamaDesa = (item) => {
  return item?.nama_desa || item?.desa || item?.kelurahan || "-";
};

const getNamaKecamatan = (item) => {
  return item?.nama_kecamatan || item?.kecamatan || item?.nama_kec || "-";
};

const getKomoditas = (item) => {
  return item?.komoditas || item?.komoditas_utama || item?.tanaman || "Padi";
};

const getTotalLahanPetani = (item) => {
  return Number(item?.total_lahan || item?.jumlah_lahan || item?.lahan_count || 0);
};

const getTotalLuasPetani = (item) => {
  const value =
    item?.total_luas ??
    item?.luas_lahan ??
    item?.luas_ha ??
    item?.luas_m2 ??
    0;

  const number = Number(value || 0);

  if (number > 20) return number / 10000;

  return number;
};

const getFotoPetani = (item) => {
  return item?.foto_url || item?.foto || item?.avatar || item?.image || "";
};

const splitList = (value) => {
  const text = String(value || "").trim();

  if (!text || text === "-") return [];

  return text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const createAvatarStyle = (index) => {
  const palettes = [
    ["#dcfce7", "#059669"],
    ["#dbeafe", "#2563eb"],
    ["#fef3c7", "#d97706"],
    ["#f3e8ff", "#9333ea"],
    ["#fee2e2", "#dc2626"],
  ];

  const selected = palettes[index % palettes.length];

  return {
    background: selected[0],
    color: selected[1],
  };
};

export default function DataPetani() {
  const importInputRef = useRef(null);

  const currentUser = useMemo(() => getCurrentUser(), []);
  const appVersion = import.meta.env.VITE_APP_VERSION || "1.0.0";

  const [data, setData] = useState([]);
  const [serverStats, setServerStats] = useState(null);
  const [notifCount, setNotifCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [openForm, setOpenForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedData, setSelectedData] = useState(null);

  const [form, setForm] = useState(initialForm);

  const [activeTab, setActiveTab] = useState("semua");
  const [activeDetailTab, setActiveDetailTab] = useState("informasi");

  const [search, setSearch] = useState("");
  const [filterKecamatan, setFilterKecamatan] = useState("");
  const [filterDesa, setFilterDesa] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [page, setPage] = useState(1);
  const perPage = 8;

  const fetchData = async () => {
    try {
      setLoading(true);

      const res = await api.get("/admin/petani");
      const list = normalizeApiList(res.data);

      setData(list);

      setSelectedData((prev) => {
        if (!list.length) return null;
        if (!prev) return list[0];

        const stillExist = list.find(
          (item) => Number(item.id) === Number(prev.id)
        );

        return stillExist || list[0];
      });
    } catch (err) {
      console.log("ERROR GET PETANI:", err.response?.data || err.message);
      setData([]);
      setSelectedData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get("/admin/petani/stats");
      setServerStats(res.data?.data || null);
    } catch (err) {
      console.log("ERROR STATS:", err.response?.data || err.message);
      setServerStats(null);
    }
  };

  const fetchNotifCount = async () => {
    try {
      const res = await api.get("/admin/notifikasi/unread-count");
      setNotifCount(Number(res.data?.count || 0));
    } catch (err) {
      console.log("ERROR NOTIF:", err.response?.data || err.message);
      setNotifCount(0);
    }
  };

  const refreshAll = async () => {
    await Promise.allSettled([fetchData(), fetchStats(), fetchNotifCount()]);
  };

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, activeTab, filterKecamatan, filterDesa, filterStatus]);

  const kecamatanOptions = useMemo(() => {
    const values = data
      .map((item) => getNamaKecamatan(item))
      .filter((item) => item && item !== "-");

    return [...new Set(values)];
  }, [data]);

  const desaOptions = useMemo(() => {
    const values = data
      .map((item) => getNamaDesa(item))
      .filter((item) => item && item !== "-");

    return [...new Set(values)];
  }, [data]);

  const computedStats = useMemo(() => {
    const totalPetani = data.length;

    const petaniAktif = data.filter(
      (item) => getStatusType(item) === "aktif"
    ).length;

    const petaniNonaktif = data.filter(
      (item) => getStatusType(item) === "nonaktif"
    ).length;

    const petaniVerifikasi = data.filter(
      (item) => getStatusType(item) === "verifikasi"
    ).length;

    const totalLuas = data.reduce((total, item) => {
      return total + getTotalLuasPetani(item);
    }, 0);

    return {
      total_petani: totalPetani,
      petani_aktif: petaniAktif,
      petani_nonaktif: petaniNonaktif,
      petani_verifikasi: petaniVerifikasi,
      total_luas: totalLuas,
      rata_rata_luas: totalPetani > 0 ? totalLuas / totalPetani : 0,
      selisih_petani: 0,
      selisih_luas: 0,
    };
  }, [data]);

  const stats = serverStats || computedStats;

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();

    return data.filter((item) => {
      const statusType = getStatusType(item);

      const matchTab =
        activeTab === "semua" ||
        (activeTab === "aktif" && statusType === "aktif") ||
        (activeTab === "nonaktif" && statusType === "nonaktif") ||
        (activeTab === "verifikasi" && statusType === "verifikasi");

      const text = [
        item?.nama,
        item?.email,
        getNoHp(item),
        getNamaDesa(item),
        getNamaKecamatan(item),
        getKomoditas(item),
      ]
        .join(" ")
        .toLowerCase();

      const matchSearch = !q || text.includes(q);
      const matchKecamatan =
        !filterKecamatan || getNamaKecamatan(item) === filterKecamatan;
      const matchDesa = !filterDesa || getNamaDesa(item) === filterDesa;
      const matchStatus = !filterStatus || statusType === filterStatus;

      return matchTab && matchSearch && matchKecamatan && matchDesa && matchStatus;
    });
  }, [data, search, activeTab, filterKecamatan, filterDesa, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / perPage));

  const paginatedData = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredData.slice(start, start + perPage);
  }, [filteredData, page]);

  const resetFilter = () => {
    setSearch("");
    setFilterKecamatan("");
    setFilterDesa("");
    setFilterStatus("");
    setActiveTab("semua");
  };

 const closeForm = () => {
  setOpenForm(false);
  setEditMode(false);
  setSelectedId(null);

  setTimeout(() => {
    setForm({
      nama: "",
      email: "",
      password: "",
      no_hp: "",
      status: "aktif",
    });
  }, 150);
};

 const openCreate = () => {
  setEditMode(false);
  setSelectedId(null);

  setOpenForm(false); // IMPORTANT: force unmount dulu

  setTimeout(() => {
    setForm({
      nama: "",
      email: "",
      password: "",
      no_hp: "",
      status: "aktif",
    });

    setOpenForm(true);
  }, 0);
};

  const handleView = (item) => {
    setSelectedData(item);
    setActiveDetailTab("informasi");
  };

 const handleEdit = (item) => {
  resetFilter();

  setSelectedData(item);
  setActiveDetailTab("informasi");
  setEditMode(true);
  setSelectedId(item.id);

  setForm({
    nama: item.nama || "",
    email: item.email || "",
    password: "",
    no_hp: getNoHp(item) === "-" ? "" : getNoHp(item),
    status: getStatusType(item),
  });

  setOpenForm(true);
};

  const handleCreate = async () => {
    if (!form.nama.trim() || !form.email.trim()) {
      alert("Nama dan email wajib diisi.");
      return;
    }

    if (!form.password.trim()) {
      alert("Password wajib diisi untuk petani baru.");
      return;
    }

    try {
      setSaving(true);

      await api.post("/admin/petani", {
        nama: form.nama.trim(),
        email: form.email.trim(),
        password: form.password,
        no_hp: form.no_hp.trim(),
        status: form.status,
      });

      resetFilter();
      closeForm();
      await refreshAll();
      alert("Petani berhasil ditambahkan.");
    } catch (err) {
      console.log("ERROR CREATE PETANI:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Gagal menambah petani.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedId) {
      alert("Data petani belum dipilih.");
      return;
    }

    if (!form.nama.trim() || !form.email.trim()) {
      alert("Nama dan email wajib diisi.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        nama: form.nama.trim(),
        email: form.email.trim(),
        no_hp: form.no_hp.trim(),
        status: form.status,
      };

      if (form.password.trim()) {
        payload.password = form.password;
      }

      await api.put(`/admin/petani/${selectedId}`, payload);

      setData((prev) =>
        prev.map((item) =>
          Number(item.id) === Number(selectedId)
            ? {
                ...item,
                nama: payload.nama,
                email: payload.email,
                no_hp: payload.no_hp,
                status: payload.status,
              }
            : item
        )
      );

      setSelectedData((prev) =>
        prev && Number(prev.id) === Number(selectedId)
          ? {
              ...prev,
              nama: payload.nama,
              email: payload.email,
              no_hp: payload.no_hp,
              status: payload.status,
            }
          : prev
      );

      resetFilter();
      closeForm();
      await refreshAll();
      alert("Petani berhasil diperbarui.");
    } catch (err) {
      console.log("ERROR UPDATE PETANI:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Gagal memperbarui petani.");
    } finally {
      setSaving(false);
    }
  };

const handleDelete = async (id) => {
  const ok = confirm("Hapus data petani ini dari daftar?");
  if (!ok) return;

  try {
    await api.delete(`/admin/petani/${id}`);

    setData((prev) => prev.filter((item) => Number(item.id) !== Number(id)));

    if (Number(selectedData?.id) === Number(id)) {
      setSelectedData(null);
    }

    resetFilter();
    await refreshAll();
    alert("Petani berhasil dihapus dari daftar.");
  } catch (err) {
    console.log("ERROR DELETE PETANI:", err.response?.data || err.message);
    alert(err.response?.data?.message || "Gagal menghapus petani.");
  }
};

  const handleImportPetani = async (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    try {
      const formData = new FormData();
      formData.append("file", file);

      await api.post("/admin/petani/import", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      resetFilter();
      await refreshAll();
      alert("Import petani berhasil.");
    } catch (err) {
      console.log("ERROR IMPORT:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Import petani gagal.");
    } finally {
      e.target.value = "";
    }
  };

  const renderDetailContent = () => {
    if (!selectedData) {
      return (
        <div style={styles.emptyDetail}>
          <Users size={42} />
          <p>Pilih salah satu petani untuk melihat detail.</p>
        </div>
      );
    }

    if (activeDetailTab === "lahan") {
      const desaList = splitList(getNamaDesa(selectedData));
      const kecamatanList = splitList(getNamaKecamatan(selectedData));

      return (
        <>
          <DetailSection title="Ringkasan Lahan">
            <DetailRow
              label="Total Lahan"
              value={`${getTotalLahanPetani(selectedData)} lahan`}
            />
            <DetailRow
              label="Total Luas"
              value={`${formatNumber(getTotalLuasPetani(selectedData), 2)} Ha`}
            />
            <DetailRow label="Komoditas Utama" value={getKomoditas(selectedData)} />
            <DetailRow label="Status Akun" value={getStatusLabel(selectedData)} />
          </DetailSection>

          <div style={styles.lahanCard}>
            <div style={styles.lahanCardHeader}>
              <MapPin size={18} />
              <strong>Lokasi Lahan</strong>
            </div>

            <div style={styles.locationGroup}>
              <span>Desa / Kelurahan</span>

              <div style={styles.chipWrap}>
                {desaList.length > 0 ? (
                  desaList.map((desa) => (
                    <span key={desa} style={styles.locationChip}>
                      {desa}
                    </span>
                  ))
                ) : (
                  <strong>-</strong>
                )}
              </div>
            </div>

            <div style={styles.locationGroup}>
              <span>Kecamatan</span>

              <div style={styles.chipWrap}>
                {kecamatanList.length > 0 ? (
                  kecamatanList.map((kecamatan) => (
                    <span key={kecamatan} style={styles.locationChip}>
                      {kecamatan}
                    </span>
                  ))
                ) : (
                  <strong>-</strong>
                )}
              </div>
            </div>
          </div>

          <button type="button" style={styles.profileBtn}>
            Lihat Data Lahan Petani
          </button>
        </>
      );
    }

    if (activeDetailTab === "aktivitas") {
      return (
        <div style={styles.timeline}>
          <TimelineItem
            icon={<Users size={16} />}
            title="Akun petani terdaftar"
            description={`${selectedData.nama || "-"} terdaftar sebagai petani.`}
            date={formatTanggal(selectedData.created_at)}
          />

          <TimelineItem
            icon={<CheckCircle2 size={16} />}
            title={`Status akun ${getStatusLabel(selectedData)}`}
            description={`Status akun saat ini adalah ${getStatusLabel(selectedData)}.`}
            date="Saat ini"
          />

          <TimelineItem
            icon={<Sprout size={16} />}
            title={`${getTotalLahanPetani(selectedData)} lahan tercatat`}
            description={`Total luas lahan ${formatNumber(
              getTotalLuasPetani(selectedData),
              2
            )} Ha dengan komoditas ${getKomoditas(selectedData)}.`}
            date="Data terbaru"
          />

          <TimelineItem
            icon={<Activity size={16} />}
            title="Data siap dipantau"
            description="Data petani dapat digunakan untuk monitoring, prediksi, dan laporan."
            date="Sistem GeoPanen"
          />
        </div>
      );
    }

    return (
      <>
        <DetailSection title="Informasi Akun">
          <DetailRow label="Email" value={selectedData.email || "-"} />
          <DetailRow label="No. HP" value={getNoHp(selectedData)} />
          <DetailRow label="Role" value={selectedData.role || "petani"} />
          <DetailRow label="Status Akun" value={getStatusLabel(selectedData)} />
        </DetailSection>

        <DetailSection title="Informasi Lahan">
          <DetailRow label="Desa / Kelurahan" value={getNamaDesa(selectedData)} />
          <DetailRow label="Kecamatan" value={getNamaKecamatan(selectedData)} />
          <DetailRow
            label="Total Lahan"
            value={`${getTotalLahanPetani(selectedData)} lahan`}
          />
          <DetailRow
            label="Total Luas"
            value={`${formatNumber(getTotalLuasPetani(selectedData), 2)} Ha`}
          />
        </DetailSection>

        <DetailSection title="Ringkasan Data">
          <DetailRow label="Komoditas Utama" value={getKomoditas(selectedData)} />
          <DetailRow
            label="Tanggal Terdaftar"
            value={formatTanggal(selectedData.created_at)}
          />
        </DetailSection>

        <button
          type="button"
          style={styles.profileBtn}
          onClick={() => setActiveDetailTab("lahan")}
        >
          Lihat Detail Lahan
        </button>
      </>
    );
  };

  return (
    <div style={styles.page}>
      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleImportPetani}
        style={{ display: "none" }}
      />

      <header style={styles.topbar}>
        <div>
          <div style={styles.breadcrumb}>
            <span style={styles.breadcrumbIcon}>⌘</span>
            <span>Master Data</span>
            <span>/</span>
            <strong>Petani</strong>
          </div>

          <h1 style={styles.title}>Master Data Petani</h1>
          <p style={styles.subtitle}>
            Kelola seluruh data petani yang terdaftar dalam sistem GeoPanen.
          </p>
        </div>

        <div style={styles.topActions}>
          <div style={styles.globalSearch}>
            <Search size={17} color="#64748b" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari petani, email, atau desa..."
              style={styles.globalSearchInput}
            />
          </div>

          <button style={styles.iconBell} type="button">
            <Bell size={20} />
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

            <ChevronDown size={16} color="#64748b" />
          </div>
        </div>
      </header>

      <div style={styles.actionRow}>
        <div />

        <div style={styles.actionButtons}>
          <button
            type="button"
            style={styles.importBtn}
            onClick={() => importInputRef.current?.click()}
          >
            <Upload size={17} />
            Import Petani
          </button>

          <button type="button" style={styles.addBtn} onClick={openCreate}>
            <Plus size={18} />
            Tambah Petani
          </button>
        </div>
      </div>

      <section style={styles.statsGrid}>
        <StatCard
          icon={<Users size={32} />}
          iconBoxStyle={styles.greenIconBox}
          label="Total Petani"
          value={stats.total_petani || 0}
          note={formatDiff(stats.selisih_petani || 0)}
          noteColor={
            Number(stats.selisih_petani || 0) >= 0 ? "#059669" : "#ef4444"
          }
        />

        <StatCard
          icon={<UserCheck size={32} />}
          iconBoxStyle={styles.blueIconBox}
          label="Petani Aktif"
          value={stats.petani_aktif || 0}
          note={`${
            stats.total_petani
              ? (
                  (Number(stats.petani_aktif || 0) /
                    Number(stats.total_petani)) *
                  100
                ).toFixed(1)
              : "0.0"
          }% dari total`}
          noteColor="#475569"
        />

        <StatCard
          icon={<UserX size={32} />}
          iconBoxStyle={styles.yellowIconBox}
          label="Petani Nonaktif"
          value={stats.petani_nonaktif || 0}
          note={`${
            stats.total_petani
              ? (
                  (Number(stats.petani_nonaktif || 0) /
                    Number(stats.total_petani)) *
                  100
                ).toFixed(1)
              : "0.0"
          }% dari total`}
          noteColor="#475569"
        />

        <StatCard
          icon={<Sprout size={32} />}
          iconBoxStyle={styles.purpleIconBox}
          label="Total Luas Lahan"
          value={`${formatNumber(stats.total_luas || 0, 2)} Ha`}
          note={formatDiff(stats.selisih_luas || 0, " Ha")}
          noteColor={
            Number(stats.selisih_luas || 0) >= 0 ? "#059669" : "#ef4444"
          }
        />

        <StatCard
          icon={<TrendingUp size={32} />}
          iconBoxStyle={styles.greenIconBox}
          label="Rata-rata Lahan"
          value={`${formatNumber(stats.rata_rata_luas || 0, 2)} Ha`}
          note="Per petani"
          noteColor="#475569"
        />
      </section>

      <main style={styles.contentGrid}>
        <section style={styles.tableCard}>
          <div style={styles.tableTop}>
            <div style={styles.tabs}>
              {[
                { key: "semua", label: "Semua" },
                { key: "aktif", label: "Aktif" },
                { key: "nonaktif", label: "Nonaktif" },
                { key: "verifikasi", label: "Perlu Verifikasi" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  style={{
                    ...styles.tabBtn,
                    ...(activeTab === tab.key ? styles.tabBtnActive : {}),
                  }}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button type="button" style={styles.refreshBtn} onClick={refreshAll}>
              <RefreshCw size={17} />
            </button>
          </div>

          <div style={styles.filterRow}>
            <div style={styles.searchBox}>
              <Search size={17} color="#64748b" />

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari petani, email, atau desa..."
                style={styles.searchInput}
              />
            </div>

            <select
              value={filterKecamatan}
              onChange={(e) => setFilterKecamatan(e.target.value)}
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
              value={filterDesa}
              onChange={(e) => setFilterDesa(e.target.value)}
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
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={styles.select}
            >
              <option value="">Semua Status</option>
              <option value="aktif">Aktif</option>
              <option value="nonaktif">Nonaktif</option>
              <option value="verifikasi">Perlu Verifikasi</option>
            </select>

            <button type="button" style={styles.filterBtn} onClick={resetFilter}>
              <Filter size={17} />
              Reset
            </button>
          </div>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>No</th>
                  <th style={styles.th}>Petani</th>
                  <th style={styles.th}>Kontak</th>
                  <th style={styles.th}>Lokasi Lahan</th>
                  <th style={styles.th}>Total Lahan</th>
                  <th style={styles.th}>Total Luas</th>
                  <th style={styles.th}>Komoditas</th>
                  <th style={styles.th}>Status</th>
                  <th style={{ ...styles.th, textAlign: "center" }}>Aksi</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={9} style={styles.emptyCell}>
                      Memuat data petani...
                    </td>
                  </tr>
                )}

                {!loading && paginatedData.length === 0 && (
                  <tr>
                    <td colSpan={9} style={styles.emptyCell}>
                      Data petani tidak ditemukan. Tekan Reset untuk menghapus
                      filter pencarian.
                    </td>
                  </tr>
                )}

                {!loading &&
                  paginatedData.map((item, index) => {
                    const globalIndex = (page - 1) * perPage + index + 1;
                    const active = selectedData?.id === item.id;

                    return (
                      <tr
                        key={item.id}
                        style={{
                          ...styles.tr,
                          ...(active ? styles.trActive : {}),
                        }}
                        onClick={() => handleView(item)}
                      >
                        <td style={styles.td}>{globalIndex}</td>

                        <td style={styles.td}>
                          <div style={styles.petaniCell}>
                            {getFotoPetani(item) ? (
                              <img
                                src={getFotoPetani(item)}
                                alt={item.nama}
                                style={styles.avatarImg}
                              />
                            ) : (
                              <div
                                style={{
                                  ...styles.avatarLetter,
                                  ...createAvatarStyle(index),
                                }}
                              >
                                {getInitial(item.nama)}
                              </div>
                            )}

                            <div>
                              <div style={styles.nameRow}>
                                <strong>{item.nama || "-"}</strong>
                                {getStatusType(item) === "aktif" && (
                                  <CheckCircle2 size={15} color="#16a34a" />
                                )}
                              </div>

                              <span style={styles.smallMuted}>
                                Terdaftar: {formatTanggal(item.created_at)}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td style={styles.td}>
                          <div>{item.email || "-"}</div>
                          <span style={styles.smallMuted}>{getNoHp(item)}</span>
                        </td>

                        <td style={styles.td}>
                          <div>{getNamaDesa(item)}</div>
                          <span style={styles.smallMuted}>
                            Kec. {getNamaKecamatan(item)}
                          </span>
                        </td>

                        <td style={styles.td}>{getTotalLahanPetani(item)} lahan</td>

                        <td style={styles.td}>
                          {formatNumber(getTotalLuasPetani(item), 2)} Ha
                        </td>

                        <td style={styles.td}>{getKomoditas(item)}</td>

                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.statusPill,
                              ...getStatusStyle(item),
                            }}
                          >
                            ● {getStatusLabel(item)}
                          </span>
                        </td>

                        <td style={{ ...styles.td, textAlign: "center" }}>
                          <div style={styles.actionCell}>
                            <button
                              type="button"
                              title="Lihat"
                              style={styles.viewBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleView(item);
                              }}
                            >
                              <Eye size={16} />
                            </button>

                            <button
                              type="button"
                              title="Edit"
                              style={styles.editBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(item);
                              }}
                            >
                              <Pencil size={16} />
                            </button>

                            <button
                              type="button"
                              title="Hapus"
                              style={styles.deleteBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(item.id);
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div style={styles.paginationRow}>
            <span>
              Menampilkan{" "}
              {filteredData.length === 0 ? 0 : (page - 1) * perPage + 1} -{" "}
              {Math.min(page * perPage, filteredData.length)} dari{" "}
              {filteredData.length} petani
            </span>

            <div style={styles.pagination}>
              <button
                type="button"
                style={styles.pageBtn}
                disabled={page === 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                <ChevronLeft size={17} />
              </button>

              {[...Array(Math.min(totalPages, 3))].map((_, idx) => {
                const number = idx + 1;

                return (
                  <button
                    key={number}
                    type="button"
                    style={{
                      ...styles.pageNumber,
                      ...(page === number ? styles.pageNumberActive : {}),
                    }}
                    onClick={() => setPage(number)}
                  >
                    {number}
                  </button>
                );
              })}

              {totalPages > 4 && <span style={styles.pageDots}>...</span>}

              {totalPages > 3 && (
                <button
                  type="button"
                  style={{
                    ...styles.pageNumber,
                    ...(page === totalPages ? styles.pageNumberActive : {}),
                  }}
                  onClick={() => setPage(totalPages)}
                >
                  {totalPages}
                </button>
              )}

              <button
                type="button"
                style={styles.pageBtn}
                disabled={page === totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                <ChevronRight size={17} />
              </button>

              <select style={styles.pageSelect} value={perPage} disabled>
                <option>{perPage} / halaman</option>
              </select>
            </div>
          </div>
        </section>

        <aside style={styles.detailPanel}>
          <div style={styles.detailHeader}>
            <h3>Detail Petani</h3>

            <button
              type="button"
              style={styles.closeDetailBtn}
              onClick={() => setSelectedData(null)}
            >
              <X size={20} />
            </button>
          </div>

          {selectedData ? (
            <>
              <div style={styles.profileBox}>
                {getFotoPetani(selectedData) ? (
                  <img
                    src={getFotoPetani(selectedData)}
                    alt={selectedData.nama}
                    style={styles.profileImage}
                  />
                ) : (
                  <div
                    style={{
                      ...styles.profileLetter,
                      ...createAvatarStyle(2),
                    }}
                  >
                    {getInitial(selectedData.nama)}
                  </div>
                )}

                <div>
                  <div style={styles.profileNameRow}>
                    <h2>{selectedData.nama || "-"}</h2>

                    <span
                      style={{
                        ...styles.statusPill,
                        ...getStatusStyle(selectedData),
                      }}
                    >
                      ● {getStatusLabel(selectedData)}
                    </span>
                  </div>

                  <p>ID Petani: PTN-{String(selectedData.id || 1).padStart(4, "0")}</p>
                  <p>Terdaftar: {formatTanggal(selectedData.created_at)}</p>
                </div>
              </div>

              <div style={styles.detailTabs}>
                <button
                  type="button"
                  style={{
                    ...styles.detailTab,
                    ...(activeDetailTab === "informasi"
                      ? styles.detailTabActive
                      : {}),
                  }}
                  onClick={() => setActiveDetailTab("informasi")}
                >
                  Informasi
                </button>

                <button
                  type="button"
                  style={{
                    ...styles.detailTab,
                    ...(activeDetailTab === "lahan" ? styles.detailTabActive : {}),
                  }}
                  onClick={() => setActiveDetailTab("lahan")}
                >
                  Lahan ({getTotalLahanPetani(selectedData)})
                </button>

                <button
                  type="button"
                  style={{
                    ...styles.detailTab,
                    ...(activeDetailTab === "aktivitas"
                      ? styles.detailTabActive
                      : {}),
                  }}
                  onClick={() => setActiveDetailTab("aktivitas")}
                >
                  Aktivitas
                </button>
              </div>

              {renderDetailContent()}
            </>
          ) : (
            renderDetailContent()
          )}
        </aside>
      </main>

      <footer style={styles.footer}>
        <span>© 2026 GeoPanen. All rights reserved.</span>
        <span>Versi {appVersion}</span>
      </footer>

      {openForm && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h3>{editMode ? "Edit Petani" : "Tambah Petani"}</h3>
                <p>
                  {editMode
                    ? "Perbarui data akun petani."
                    : "Tambahkan akun petani baru ke sistem GeoPanen."}
                </p>
              </div>

              <button type="button" style={styles.modalClose} onClick={closeForm}>
                <X size={20} />
              </button>
            </div>

            <div style={styles.formGrid}>
              <FormInput
                label="Nama Lengkap"
                value={form.nama}
                placeholder="Nama petani"
                onChange={(value) => setForm({ ...form, nama: value })}
              />

              <FormInput
                label="Email"
                value={form.email}
                placeholder="Email petani"
                onChange={(value) => setForm({ ...form, email: value })}
              />

              <FormInput
                label={editMode ? "Password Baru (Opsional)" : "Password"}
                type="password"
                value={form.password}
                placeholder={editMode ? "Kosongkan jika tidak diganti" : "Password"}
                onChange={(value) => setForm({ ...form, password: value })}
              />

              <FormInput
                label="No. HP"
                value={form.no_hp}
                placeholder="Nomor HP"
                onChange={(value) => setForm({ ...form, no_hp: value })}
              />

              <div style={styles.inputGroup}>
                <label>Status Akun</label>

                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  style={styles.input}
                >
                  <option value="aktif">Aktif</option>
                  <option value="nonaktif">Nonaktif</option>
                  <option value="verifikasi">Perlu Verifikasi</option>
                </select>
              </div>
            </div>

            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.cancelBtn}
                onClick={closeForm}
                disabled={saving}
              >
                Batal
              </button>

              <button
                type="button"
                style={styles.saveBtn}
                onClick={editMode ? handleUpdate : handleCreate}
                disabled={saving}
              >
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, iconBoxStyle, label, value, note, noteColor }) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statIcon, ...iconBoxStyle }}>{icon}</div>

      <div>
        <p style={styles.statLabel}>{label}</p>
        <h2 style={styles.statValue}>{value}</h2>
        <span style={{ ...styles.statNote, color: noteColor }}>{note}</span>
      </div>
    </div>
  );
}

function DetailSection({ title, children }) {
  return (
    <section style={styles.detailSection}>
      <h4>{title}</h4>
      <div style={styles.detailGrid}>{children}</div>
    </section>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={styles.detailRow}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TimelineItem({ icon, title, description, date }) {
  return (
    <div style={styles.timelineItem}>
      <div style={styles.timelineIcon}>{icon}</div>

      <div>
        <strong>{title}</strong>
        <p>{description}</p>
        <span>{date}</span>
      </div>
    </div>
  );
}

function FormInput({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div style={styles.inputGroup}>
      <label>{label}</label>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={styles.input}
      />
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "28px 32px 18px",
    background: "#f8fafc",
    color: "#0f172a",
    boxSizing: "border-box",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  topbar: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 24,
  },

  breadcrumb: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    color: "#475569",
    fontSize: 14,
    marginBottom: 14,
  },

  breadcrumbIcon: {
    color: "#16a34a",
    fontWeight: 900,
  },

  title: {
    margin: 0,
    fontSize: 32,
    fontWeight: 950,
    letterSpacing: "-0.6px",
    color: "#0f172a",
  },

  subtitle: {
    margin: "10px 0 0",
    fontSize: 15,
    color: "#64748b",
  },

  topActions: {
    display: "flex",
    alignItems: "center",
    gap: 18,
  },

  globalSearch: {
    width: 340,
    height: 46,
    border: "1px solid #dbe3ea",
    borderRadius: 12,
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 14px",
  },

  globalSearchInput: {
    width: "100%",
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: 14,
    color: "#0f172a",
  },

  iconBell: {
    width: 42,
    height: 42,
    border: "none",
    background: "transparent",
    position: "relative",
    color: "#059669",
    cursor: "pointer",
  },

  bellBadge: {
    position: "absolute",
    top: 0,
    right: 2,
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
    width: 46,
    height: 46,
    borderRadius: 999,
    background: "#dcfce7",
    color: "#059669",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    fontWeight: 950,
  },

  actionRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    marginBottom: 22,
  },

  actionButtons: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  importBtn: {
    height: 44,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    borderRadius: 10,
    padding: "0 18px",
    display: "flex",
    alignItems: "center",
    gap: 9,
    fontWeight: 850,
    cursor: "pointer",
  },

  addBtn: {
    height: 44,
    border: "none",
    background: "#16a34a",
    color: "#ffffff",
    borderRadius: 10,
    padding: "0 20px",
    display: "flex",
    alignItems: "center",
    gap: 9,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 12px 26px rgba(22, 163, 74, 0.24)",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 22,
    marginBottom: 26,
  },

  statCard: {
    minHeight: 112,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
    display: "flex",
    alignItems: "center",
    gap: 20,
    padding: 22,
  },

  statIcon: {
    width: 66,
    height: 66,
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

  yellowIconBox: {
    background: "#fef3c7",
    color: "#f59e0b",
  },

  purpleIconBox: {
    background: "#f3e8ff",
    color: "#a855f7",
  },

  statLabel: {
    margin: 0,
    color: "#64748b",
    fontSize: 14,
  },

  statValue: {
    margin: "6px 0",
    color: "#065f46",
    fontSize: 28,
    fontWeight: 950,
  },

  statNote: {
    fontSize: 13,
    fontWeight: 650,
  },

  contentGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 410px",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.07)",
    overflow: "hidden",
  },

  tableCard: {
    padding: 18,
    minWidth: 0,
  },

  tableTop: {
    height: 46,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid #e5e7eb",
  },

  tabs: {
    display: "flex",
    alignItems: "center",
    gap: 22,
  },

  tabBtn: {
    height: 46,
    border: "none",
    background: "transparent",
    color: "#64748b",
    fontWeight: 850,
    cursor: "pointer",
    borderBottom: "2px solid transparent",
    padding: "0 4px",
  },

  tabBtnActive: {
    color: "#059669",
    borderBottom: "2px solid #16a34a",
  },

  refreshBtn: {
    width: 42,
    height: 42,
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    background: "#ffffff",
    cursor: "pointer",
    color: "#475569",
  },

  filterRow: {
    display: "grid",
    gridTemplateColumns: "1.5fr 1fr 1fr 1fr auto",
    gap: 14,
    margin: "24px 0",
  },

  searchBox: {
    height: 44,
    border: "1px solid #dbe3ea",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 14px",
    background: "#ffffff",
  },

  searchInput: {
    width: "100%",
    border: "none",
    outline: "none",
    fontSize: 14,
    background: "transparent",
  },

  select: {
    height: 44,
    border: "1px solid #dbe3ea",
    borderRadius: 10,
    background: "#ffffff",
    padding: "0 14px",
    color: "#475569",
    fontWeight: 650,
    outline: "none",
  },

  filterBtn: {
    height: 44,
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    background: "#ffffff",
    color: "#0f172a",
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "0 18px",
    fontWeight: 850,
    cursor: "pointer",
  },

  tableWrapper: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 1050,
  },

  th: {
    padding: "14px 12px",
    textAlign: "left",
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 900,
    borderBottom: "1px solid #e5e7eb",
  },

  tr: {
    borderBottom: "1px solid #e5e7eb",
    cursor: "pointer",
    transition: "0.16s ease",
  },

  trActive: {
    background: "linear-gradient(90deg, #ecfdf5, #ffffff)",
  },

  td: {
    padding: "15px 12px",
    fontSize: 14,
    color: "#0f172a",
    verticalAlign: "middle",
  },

  petaniCell: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  avatarImg: {
    width: 42,
    height: 42,
    borderRadius: 999,
    objectFit: "cover",
  },

  avatarLetter: {
    width: 42,
    height: 42,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 950,
  },

  nameRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },

  smallMuted: {
    display: "block",
    marginTop: 4,
    color: "#64748b",
    fontSize: 13,
  },

  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    padding: "5px 10px",
    fontSize: 12,
    fontWeight: 850,
    whiteSpace: "nowrap",
  },

  actionCell: {
    display: "flex",
    justifyContent: "center",
    gap: 8,
  },

  viewBtn: {
    width: 34,
    height: 34,
    border: "none",
    borderRadius: 8,
    background: "#2563eb",
    color: "#ffffff",
    cursor: "pointer",
  },

  editBtn: {
    width: 34,
    height: 34,
    border: "none",
    borderRadius: 8,
    background: "#f59e0b",
    color: "#ffffff",
    cursor: "pointer",
  },

  deleteBtn: {
    width: 34,
    height: 34,
    border: "none",
    borderRadius: 8,
    background: "#ef4444",
    color: "#ffffff",
    cursor: "pointer",
  },

  emptyCell: {
    padding: 28,
    textAlign: "center",
    color: "#64748b",
  },

  paginationRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 22,
    color: "#475569",
    fontSize: 14,
  },

  pagination: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  pageBtn: {
    width: 38,
    height: 38,
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    background: "#ffffff",
    cursor: "pointer",
  },

  pageNumber: {
    width: 38,
    height: 38,
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    background: "#ffffff",
    cursor: "pointer",
    fontWeight: 800,
  },

  pageNumberActive: {
    borderColor: "#16a34a",
    color: "#059669",
    background: "#f0fdf4",
  },

  pageDots: {
    padding: "0 6px",
    color: "#64748b",
  },

  pageSelect: {
    height: 38,
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    background: "#ffffff",
    padding: "0 12px",
    color: "#0f172a",
  },

  detailPanel: {
    borderLeft: "1px solid #e5e7eb",
    padding: 24,
    background: "#ffffff",
  },

  detailHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },

  closeDetailBtn: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    color: "#64748b",
  },

  profileBox: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 22,
  },

  profileImage: {
    width: 72,
    height: 72,
    borderRadius: 999,
    objectFit: "cover",
  },

  profileLetter: {
    width: 72,
    height: 72,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 30,
    fontWeight: 950,
  },

  profileNameRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  detailTabs: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    borderBottom: "1px solid #e5e7eb",
    marginBottom: 20,
  },

  detailTab: {
    height: 44,
    border: "none",
    borderBottom: "2px solid transparent",
    background: "transparent",
    color: "#64748b",
    fontWeight: 800,
    cursor: "pointer",
  },

  detailTabActive: {
    borderBottom: "2px solid #16a34a",
    color: "#059669",
    fontWeight: 900,
  },

  detailSection: {
    marginBottom: 24,
  },

  detailGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "14px 18px",
  },

  detailRow: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 14,
  },

  lahanCard: {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
    background: "#f8fafc",
  },

  lahanCardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    color: "#065f46",
    marginBottom: 16,
  },

  locationGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: 14,
    fontSize: 14,
  },

  chipWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },

  locationChip: {
    background: "#dcfce7",
    color: "#047857",
    borderRadius: 999,
    padding: "6px 10px",
    fontWeight: 800,
    fontSize: 12,
  },

  timeline: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  timelineItem: {
    display: "grid",
    gridTemplateColumns: "34px 1fr",
    gap: 12,
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: 14,
  },

  timelineIcon: {
    width: 34,
    height: 34,
    borderRadius: 999,
    background: "#dcfce7",
    color: "#059669",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  profileBtn: {
    width: "100%",
    height: 44,
    border: "1px solid #16a34a",
    borderRadius: 8,
    background: "#ffffff",
    color: "#059669",
    fontWeight: 900,
    cursor: "pointer",
  },

  emptyDetail: {
    minHeight: 260,
    color: "#64748b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: 12,
    textAlign: "center",
  },

  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 24,
    color: "#475569",
    fontSize: 14,
  },

  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: 20,
  },

  modal: {
    width: 560,
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#ffffff",
    borderRadius: 18,
    padding: 24,
    boxShadow: "0 28px 80px rgba(15, 23, 42, 0.28)",
  },

  modalHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  modalClose: {
    width: 36,
    height: 36,
    border: "none",
    borderRadius: 8,
    background: "#f8fafc",
    cursor: "pointer",
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },

  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  input: {
    height: 44,
    border: "1px solid #dbe3ea",
    borderRadius: 10,
    padding: "0 12px",
    outline: "none",
    fontSize: 14,
    background: "#ffffff",
  },

  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 24,
  },

  cancelBtn: {
    height: 42,
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    background: "#ffffff",
    padding: "0 18px",
    fontWeight: 800,
    cursor: "pointer",
  },

  saveBtn: {
    height: 42,
    border: "none",
    borderRadius: 9,
    background: "#16a34a",
    color: "#ffffff",
    padding: "0 20px",
    fontWeight: 900,
    cursor: "pointer",
  },
};