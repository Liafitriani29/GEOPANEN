import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../services/api";
import * as XLSX from "xlsx";

import {
  Building2,
  Users,
  UserRound,
  ShieldCheck,
  Eye,
  Pencil,
  Trash2,
  Plus,
  X,
  Search,
  Filter,
  Upload,
  Download,
  RefreshCw,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MapPin,
  CalendarDays,
} from "lucide-react";

const initialForm = {
  nama_kecamatan: "",
  kode_kecamatan: "",
  kabupaten: "Sukoharjo",
  status: "aktif",
  deskripsi: "",
};

const normalizeApiList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.kecamatan)) return payload.kecamatan;
  return [];
};

const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const getInitial = (value) => {
  const text = String(value || "A").trim();
  return text.charAt(0).toUpperCase();
};

const formatNumber = (value) => {
  return Number(value || 0).toLocaleString("id-ID");
};

const getNamaKecamatan = (item) => {
  return item?.nama_kecamatan || item?.kecamatan || item?.nama || "-";
};

const getKodeKecamatan = (item) => {
  return item?.kode_kecamatan || item?.kode || item?.kode_wilayah || "-";
};

const getKabupaten = (item) => {
  return item?.kabupaten || item?.nama_kabupaten || "Sukoharjo";
};

const getStatusType = (item) => {
  const raw = String(
    item?.status || item?.status_kecamatan || item?.aktif || item?.is_active || "aktif"
  ).toLowerCase();

  if (
    raw === "0" ||
    raw.includes("nonaktif") ||
    raw.includes("tidak") ||
    raw.includes("inactive")
  ) {
    return "nonaktif";
  }

  return "aktif";
};

const getStatusLabel = (item) => {
  return getStatusType(item) === "aktif" ? "Aktif" : "Nonaktif";
};

const getStatusStyle = (item) => {
  if (getStatusType(item) === "aktif") {
    return {
      background: "#dcfce7",
      color: "#059669",
      border: "1px solid #bbf7d0",
    };
  }

  return {
    background: "#fee2e2",
    color: "#ef4444",
    border: "1px solid #fecaca",
  };
};

const getJumlahDesa = (item) => {
  return Number(
    item?.jumlah_desa ||
      item?.total_desa ||
      item?.desa_count ||
      item?.total_kelurahan ||
      0
  );
};

const getJumlahPetani = (item) => {
  return Number(
    item?.jumlah_petani ||
      item?.total_petani ||
      item?.petani_count ||
      0
  );
};

const getJumlahPenyuluh = (item) => {
  return Number(
    item?.jumlah_penyuluh ||
      item?.total_penyuluh ||
      item?.penyuluh_count ||
      0
  );
};

const getDeskripsi = (item) => {
  return (
    item?.deskripsi ||
    item?.keterangan ||
    `Kecamatan ${getNamaKecamatan(item)} merupakan wilayah pertanian padi dalam sistem GeoPanen.`
  );
};

const getCurrentDate = () => {
  return new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

export default function DataKecamatan() {
  const importInputRef = useRef(null);

  const currentUser = useMemo(() => getCurrentUser(), []);
  const appVersion = import.meta.env.VITE_APP_VERSION || "1.0.0";

  const [data, setData] = useState([]);
  const [desaList, setDesaList] = useState([]);
  const [petaniList, setPetaniList] = useState([]);
  const [penyuluhList, setPenyuluhList] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedData, setSelectedData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const [openForm, setOpenForm] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [openImportModal, setOpenImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);

  const [search, setSearch] = useState("");
  const [filterKabupaten, setFilterKabupaten] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [activeTab, setActiveTab] = useState("semua");
  const [activeDetailTab, setActiveDetailTab] = useState("informasi");

  const [notifCount, setNotifCount] = useState(0);

  const [page, setPage] = useState(1);
  const perPage = 10;

  const [form, setForm] = useState(initialForm);

  const fetchData = async () => {
    try {
      setLoading(true);

      const res = await api.get("/admin/kecamatan");
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
      console.log("ERROR GET KECAMATAN:", err.response?.data || err.message);
      setData([]);
      setSelectedData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchDesa = async () => {
    try {
      const res = await api.get("/admin/desa");
      setDesaList(normalizeApiList(res.data));
    } catch (err) {
      console.log("ERROR GET DESA:", err.response?.data || err.message);
      setDesaList([]);
    }
  };

  const fetchPetani = async () => {
    try {
      const res = await api.get("/admin/petani");
      setPetaniList(normalizeApiList(res.data));
    } catch (err) {
      console.log("ERROR GET PETANI:", err.response?.data || err.message);
      setPetaniList([]);
    }
  };

  const fetchPenyuluh = async () => {
    try {
      const res = await api.get("/admin/penyuluh");
      setPenyuluhList(normalizeApiList(res.data));
    } catch (err) {
      console.log("ERROR GET PENYULUH:", err.response?.data || err.message);
      setPenyuluhList([]);
    }
  };

  const fetchNotifCount = async () => {
    try {
      const res = await api.get("/admin/notifikasi/unread-count");
      setNotifCount(Number(res.data?.count || 0));
    } catch {
      setNotifCount(0);
    }
  };

  const refreshAll = async () => {
    await Promise.allSettled([
      fetchData(),
      fetchDesa(),
      fetchPetani(),
      fetchPenyuluh(),
      fetchNotifCount(),
    ]);
  };

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, filterKabupaten, filterStatus, activeTab]);

  const enrichedData = useMemo(() => {
    return data.map((item) => {
      const nama = getNamaKecamatan(item);
      const id = item?.id;

      const totalDesa = desaList.filter((desa) => {
        const namaKecDesa =
          desa?.nama_kecamatan || desa?.kecamatan || desa?.nama_kec || "";
        const kecId = desa?.kecamatan_id || desa?.id_kecamatan;

        return (
          String(kecId) === String(id) ||
          String(namaKecDesa).toLowerCase() === String(nama).toLowerCase()
        );
      }).length;

      const totalPetani = petaniList.filter((petani) => {
        const namaKecPetani =
          petani?.nama_kecamatan || petani?.kecamatan || petani?.nama_kec || "";
        const kecId = petani?.kecamatan_id || petani?.id_kecamatan;

        return (
          String(kecId) === String(id) ||
          String(namaKecPetani).toLowerCase() === String(nama).toLowerCase()
        );
      }).length;

      const totalPenyuluh = penyuluhList.filter((penyuluh) => {
        const namaKecPenyuluh =
          penyuluh?.nama_kecamatan ||
          penyuluh?.kecamatan ||
          penyuluh?.wilayah_binaan ||
          "";
        const kecId = penyuluh?.kecamatan_id || penyuluh?.id_kecamatan;

        return (
          String(kecId) === String(id) ||
          String(namaKecPenyuluh).toLowerCase() === String(nama).toLowerCase()
        );
      }).length;

      return {
        ...item,
        jumlah_desa: getJumlahDesa(item) || totalDesa,
        jumlah_petani: getJumlahPetani(item) || totalPetani,
        jumlah_penyuluh: getJumlahPenyuluh(item) || totalPenyuluh,
      };
    });
  }, [data, desaList, petaniList, penyuluhList]);

  const stats = useMemo(() => {
    const total = enrichedData.length;
    const aktif = enrichedData.filter((item) => getStatusType(item) === "aktif").length;
    const nonaktif = enrichedData.filter((item) => getStatusType(item) === "nonaktif").length;
    const totalPetani = enrichedData.reduce(
      (sum, item) => sum + getJumlahPetani(item),
      0
    );
    const totalPenyuluh = enrichedData.reduce(
      (sum, item) => sum + getJumlahPenyuluh(item),
      0
    );

    return {
      total,
      aktif,
      nonaktif,
      totalPetani,
      totalPenyuluh,
    };
  }, [enrichedData]);

  const kabupatenOptions = useMemo(() => {
    return [
      ...new Set(
        enrichedData
          .map((item) => getKabupaten(item))
          .filter((item) => item && item !== "-")
      ),
    ];
  }, [enrichedData]);

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();

    return enrichedData.filter((item) => {
      const statusType = getStatusType(item);

      const matchTab =
        activeTab === "semua" ||
        (activeTab === "aktif" && statusType === "aktif") ||
        (activeTab === "nonaktif" && statusType === "nonaktif");

      const text = [
        getNamaKecamatan(item),
        getKodeKecamatan(item),
        getKabupaten(item),
        getStatusLabel(item),
      ]
        .join(" ")
        .toLowerCase();

      const matchSearch = !q || text.includes(q);
      const matchKabupaten =
        !filterKabupaten || getKabupaten(item) === filterKabupaten;
      const matchStatus = !filterStatus || statusType === filterStatus;

      return matchTab && matchSearch && matchKabupaten && matchStatus;
    });
  }, [enrichedData, search, activeTab, filterKabupaten, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / perPage));

  const paginatedData = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredData.slice(start, start + perPage);
  }, [filteredData, page]);

  const resetFilter = () => {
    setSearch("");
    setFilterKabupaten("");
    setFilterStatus("");
    setActiveTab("semua");
  };

  const openCreate = () => {
    setEditMode(false);
    setSelectedId(null);
    setForm(initialForm);
    setOpenForm(true);
  };

  const closeForm = () => {
    setOpenForm(false);
    setEditMode(false);
    setSelectedId(null);
    setForm(initialForm);
  };

  const handleView = (item) => {
    setSelectedData(item);
    setActiveDetailTab("informasi");
  };

  const handleEdit = (item) => {
    setEditMode(true);
    setSelectedId(item.id);
    setSelectedData(item);
    setActiveDetailTab("informasi");

    setForm({
      nama_kecamatan: getNamaKecamatan(item) === "-" ? "" : getNamaKecamatan(item),
      kode_kecamatan: getKodeKecamatan(item) === "-" ? "" : getKodeKecamatan(item),
      kabupaten: getKabupaten(item) === "-" ? "Sukoharjo" : getKabupaten(item),
      status: getStatusType(item),
      deskripsi:
        getDeskripsi(item) ===
        `Kecamatan ${getNamaKecamatan(item)} merupakan wilayah pertanian padi dalam sistem GeoPanen.`
          ? ""
          : getDeskripsi(item),
    });

    setOpenForm(true);
  };

  const validateForm = () => {
    if (!form.nama_kecamatan.trim()) {
      alert("Nama kecamatan wajib diisi.");
      return false;
    }

    return true;
  };

  const buildPayload = () => {
    return {
      nama_kecamatan: form.nama_kecamatan.trim(),
      kode_kecamatan: form.kode_kecamatan.trim() || null,
      kabupaten: form.kabupaten.trim() || "Sukoharjo",
      status: form.status || "aktif",
      deskripsi: form.deskripsi || null,
    };
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);

      await api.post("/admin/kecamatan", buildPayload());

      closeForm();
      await refreshAll();
      alert("Kecamatan berhasil ditambahkan.");
    } catch (err) {
      console.log("ERROR CREATE KECAMATAN:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Gagal menambah kecamatan.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedId) {
      alert("Data kecamatan belum dipilih.");
      return;
    }

    if (!validateForm()) return;

    try {
      setSaving(true);

      await api.put(`/admin/kecamatan/${selectedId}`, buildPayload());

      closeForm();
      await refreshAll();
      alert("Kecamatan berhasil diperbarui.");
    } catch (err) {
      console.log("ERROR UPDATE KECAMATAN:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Gagal memperbarui kecamatan.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const ok = confirm("Hapus kecamatan ini?");
    if (!ok) return;

    try {
      await api.delete(`/admin/kecamatan/${id}`);

      if (Number(selectedData?.id) === Number(id)) {
        setSelectedData(null);
      }

      await refreshAll();
      alert("Kecamatan berhasil dihapus.");
    } catch (err) {
      console.log("ERROR DELETE KECAMATAN:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Gagal menghapus kecamatan.");
    }
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "nama_kecamatan",
      "kode_kecamatan",
      "kabupaten",
      "status",
      "deskripsi",
    ];

    const templateSheet = XLSX.utils.aoa_to_sheet([headers]);

    templateSheet["!cols"] = [
      { wch: 24 },
      { wch: 16 },
      { wch: 20 },
      { wch: 14 },
      { wch: 46 },
    ];

    const contohRows = [
      headers,
      [
        "Bulu",
        "3312",
        "Sukoharjo",
        "aktif",
        "Wilayah pertanian padi dengan lahan aktif.",
      ],
      [
        "Nguter",
        "3314",
        "Sukoharjo",
        "aktif",
        "Wilayah binaan petani padi.",
      ],
    ];

    const contohSheet = XLSX.utils.aoa_to_sheet(contohRows);
    contohSheet["!cols"] = templateSheet["!cols"];

    const petunjukSheet = XLSX.utils.aoa_to_sheet([
      ["PETUNJUK IMPORT DATA KECAMATAN GEOPANEN"],
      [""],
      ["1", "Isi data pada sheet Import Kecamatan mulai baris ke-2."],
      ["2", "Jangan mengubah nama kolom/header."],
      ["3", "Kolom nama_kecamatan wajib diisi."],
      ["4", "status gunakan aktif atau nonaktif."],
      ["5", "Setelah selesai, upload file ini lewat tombol Import Data."],
    ]);

    petunjukSheet["!cols"] = [{ wch: 8 }, { wch: 80 }];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, templateSheet, "Import Kecamatan");
    XLSX.utils.book_append_sheet(workbook, contohSheet, "Contoh Pengisian");
    XLSX.utils.book_append_sheet(workbook, petunjukSheet, "Petunjuk");

    XLSX.writeFile(workbook, "template-import-kecamatan-geopanen.xlsx");
  };

  const handleSelectImportFile = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    const allowedExtensions = [".xlsx", ".xls", ".csv"];
    const fileName = file.name.toLowerCase();
    const isValid = allowedExtensions.some((ext) => fileName.endsWith(ext));

    if (!isValid) {
      alert("Format file harus .xlsx, .xls, atau .csv");
      e.target.value = "";
      setImportFile(null);
      return;
    }

    setImportFile(file);
  };

  const handleUploadImport = async () => {
    if (!importFile) {
      alert("Pilih file import terlebih dahulu.");
      return;
    }

    try {
      setImporting(true);

      const formData = new FormData();
      formData.append("file", importFile);

      await api.post("/admin/kecamatan/import", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setOpenImportModal(false);
      setImportFile(null);

      if (importInputRef.current) {
        importInputRef.current.value = "";
      }

      await refreshAll();
      alert("Import kecamatan berhasil.");
    } catch (err) {
      console.log("ERROR IMPORT KECAMATAN:", err.response?.data || err.message);
      alert(
        err.response?.data?.message ||
          "Import kecamatan gagal. Pastikan backend /admin/kecamatan/import sudah dibuat."
      );
    } finally {
      setImporting(false);
    }
  };

  const handleExport = () => {
    const headers = [
      "Nama Kecamatan",
      "Kode Kecamatan",
      "Kabupaten",
      "Jumlah Desa",
      "Jumlah Petani",
      "Jumlah Penyuluh",
      "Status",
      "Deskripsi",
    ];

    const rows = filteredData.map((item) => [
      getNamaKecamatan(item),
      getKodeKecamatan(item),
      getKabupaten(item),
      getJumlahDesa(item),
      getJumlahPetani(item),
      getJumlahPenyuluh(item),
      getStatusLabel(item),
      getDeskripsi(item),
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    worksheet["!cols"] = [
      { wch: 24 },
      { wch: 16 },
      { wch: 20 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 12 },
      { wch: 48 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Kecamatan");
    XLSX.writeFile(workbook, "data-kecamatan-geopanen.xlsx");
  };

  const renderDetailContent = () => {
    if (!selectedData) {
      return (
        <div style={styles.emptyDetail}>
          <Building2 size={42} />
          <p>Pilih salah satu kecamatan untuk melihat detail.</p>
        </div>
      );
    }

    if (activeDetailTab === "wilayah") {
      const wilayahPenyuluh =
        Array.isArray(selectedData?.penyuluh_binaan) &&
        selectedData.penyuluh_binaan.length > 0
          ? selectedData.penyuluh_binaan
          : penyuluhList.filter((item) => {
              const namaKec =
                item?.nama_kecamatan ||
                item?.kecamatan ||
                item?.wilayah_binaan ||
                "";
              const kecId = item?.kecamatan_id || item?.id_kecamatan;

              return (
                String(kecId) === String(selectedData.id) ||
                String(namaKec).toLowerCase() ===
                  String(getNamaKecamatan(selectedData)).toLowerCase()
              );
            });

      return (
        <section style={styles.detailSection}>
          <h4>Wilayah Binaan</h4>

          {wilayahPenyuluh.length === 0 ? (
            <div style={styles.emptyMiniBox}>
              Belum ada penyuluh yang terhubung dengan kecamatan ini.
            </div>
          ) : (
            <div style={styles.penyuluhList}>
              {wilayahPenyuluh.map((item, index) => (
                <div key={item.id || index} style={styles.penyuluhItem}>
                  <div style={{ ...styles.ownerAvatar, ...createAvatarStyle(index) }}>
                    {getInitial(item.nama)}
                  </div>

                  <div>
                    <strong>{item.nama || "-"}</strong>
                    <p>
                      Penyuluh{" "}
                      {item.kode_penyuluh ||
                        `PYN-${String(item.id || index + 1).padStart(3, "0")}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      );
    }

    return (
      <>
        <DetailSection title="Informasi Kecamatan">
          <DetailRow label="Nama Kecamatan" value={getNamaKecamatan(selectedData)} />
          <DetailRow label="Kode Kecamatan" value={getKodeKecamatan(selectedData)} />
          <DetailRow label="Kabupaten" value={getKabupaten(selectedData)} />
          <DetailRow
            label="Jumlah Desa"
            value={`${formatNumber(getJumlahDesa(selectedData))} Desa`}
          />
          <DetailRow
            label="Jumlah Petani"
            value={`${formatNumber(getJumlahPetani(selectedData))} Petani`}
          />
          <DetailRow
            label="Jumlah Penyuluh"
            value={`${formatNumber(getJumlahPenyuluh(selectedData))} Penyuluh`}
          />
          <DetailRow label="Status" value={getStatusLabel(selectedData)} />
          <DetailRow label="Deskripsi" value={getDeskripsi(selectedData)} />
        </DetailSection>

        <DetailSection title="Wilayah Binaan">
          <div style={styles.ownerBox}>
            <div style={{ ...styles.ownerAvatar, ...createAvatarStyle(1) }}>
              <MapPin size={20} />
            </div>

            <div>
              <strong>{getJumlahDesa(selectedData)} Desa Terhubung</strong>
              <p>
                Wilayah ini memiliki {getJumlahPetani(selectedData)} petani dan{" "}
                {getJumlahPenyuluh(selectedData)} penyuluh.
              </p>
            </div>
          </div>
        </DetailSection>

        <div style={styles.detailActions}>
          <button
            type="button"
            style={styles.detailEditBtn}
            onClick={() => handleEdit(selectedData)}
          >
            <Pencil size={16} />
            Edit Data
          </button>

          <button
            type="button"
            style={styles.detailDeleteBtn}
            onClick={() => handleDelete(selectedData.id)}
          >
            <Trash2 size={16} />
            Hapus Data
          </button>
        </div>
      </>
    );
  };

  return (
    <div style={styles.page}>
      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleSelectImportFile}
        style={{ display: "none" }}
      />

      <header style={styles.topbar}>
        <div>
          <div style={styles.breadcrumb}>
            <span style={styles.backArrow}>←</span>
            <span>Master Data</span>
            <span>/</span>
            <strong>Kecamatan</strong>
          </div>

          <h1 style={styles.title}>Data Kecamatan</h1>

          <p style={styles.subtitle}>
            Kelola data kecamatan yang digunakan untuk memetakan wilayah binaan
            penyuluh dan lokasi lahan petani.
          </p>
        </div>

        <div style={styles.topActions}>
          <div style={styles.globalSearch}>
            <Search size={18} color="#64748b" />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kecamatan atau kode..."
              style={styles.globalSearchInput}
              autoComplete="off"
            />

            <ChevronDown size={16} color="#64748b" />
          </div>

          <button type="button" style={styles.iconBell}>
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
            onClick={() => {
              setImportFile(null);
              setOpenImportModal(true);

              if (importInputRef.current) {
                importInputRef.current.value = "";
              }
            }}
          >
            <Upload size={17} />
            Import Data
          </button>

          <button type="button" style={styles.exportBtn} onClick={handleExport}>
            <Download size={17} />
            Export Data
          </button>

          <button type="button" style={styles.addBtn} onClick={openCreate}>
            <Plus size={18} />
            Tambah Kecamatan
          </button>
        </div>
      </div>

      <section style={styles.statsGrid}>
        <StatCard
          icon={<Building2 size={34} />}
          iconBoxStyle={styles.greenIconBox}
          label="Total Kecamatan"
          value={formatNumber(stats.total)}
          note="Kecamatan terdaftar"
        />

        <StatCard
          icon={<Users size={34} />}
          iconBoxStyle={styles.blueIconBox}
          label="Kecamatan Aktif"
          value={formatNumber(stats.aktif)}
          note={`${stats.total > 0 ? ((stats.aktif / stats.total) * 100).toFixed(0) : 0}% dari total`}
        />

        <StatCard
          icon={<UserRound size={34} />}
          iconBoxStyle={styles.orangeIconBox}
          label="Total Petani"
          value={formatNumber(stats.totalPetani)}
          note={`Tersebar di ${formatNumber(stats.total)} kecamatan`}
        />

        <StatCard
          icon={<ShieldCheck size={34} />}
          iconBoxStyle={styles.purpleIconBox}
          label="Total Penyuluh"
          value={formatNumber(stats.totalPenyuluh)}
          note={`Bertugas di ${formatNumber(stats.total)} kecamatan`}
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
                placeholder="Cari kecamatan atau kode..."
                style={styles.searchInput}
                autoComplete="off"
              />
            </div>

            <select
              value={filterKabupaten}
              onChange={(e) => setFilterKabupaten(e.target.value)}
              style={styles.select}
            >
              <option value="">Semua Kabupaten</option>

              {kabupatenOptions.map((item) => (
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
              <option value="">Status</option>
              <option value="aktif">Aktif</option>
              <option value="nonaktif">Nonaktif</option>
            </select>

            <button type="button" style={styles.filterBtn} onClick={resetFilter}>
              <Filter size={17} />
              Filter
            </button>
          </div>

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>No</th>
                  <th style={styles.th}>Nama Kecamatan</th>
                  <th style={styles.th}>Kode</th>
                  <th style={styles.th}>Kabupaten</th>
                  <th style={styles.th}>Jumlah Desa</th>
                  <th style={styles.th}>Petani</th>
                  <th style={styles.th}>Penyuluh</th>
                  <th style={styles.th}>Status</th>
                  <th style={{ ...styles.th, textAlign: "center" }}>Aksi</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={9} style={styles.emptyCell}>
                      Memuat data kecamatan...
                    </td>
                  </tr>
                )}

                {!loading && paginatedData.length === 0 && (
                  <tr>
                    <td colSpan={9} style={styles.emptyCell}>
                      Data kecamatan tidak ditemukan.
                    </td>
                  </tr>
                )}

                {!loading &&
                  paginatedData.map((item, index) => {
                    const active = selectedData?.id === item.id;
                    const globalIndex = (page - 1) * perPage + index + 1;

                    return (
                      <tr
                        key={item.id || index}
                        style={{
                          ...styles.tr,
                          ...(active ? styles.trActive : {}),
                        }}
                        onClick={() => handleView(item)}
                      >
                        <td style={styles.td}>{globalIndex}</td>
                        <td style={styles.td}>
                          <strong>{getNamaKecamatan(item)}</strong>
                        </td>
                        <td style={styles.td}>{getKodeKecamatan(item)}</td>
                        <td style={styles.td}>{getKabupaten(item)}</td>
                        <td style={styles.td}>{formatNumber(getJumlahDesa(item))}</td>
                        <td style={styles.td}>{formatNumber(getJumlahPetani(item))}</td>
                        <td style={styles.td}>{formatNumber(getJumlahPenyuluh(item))}</td>
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
                              style={styles.viewBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleView(item);
                              }}
                            >
                              <Eye size={15} />
                            </button>

                            <button
                              type="button"
                              style={styles.editBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(item);
                              }}
                            >
                              <Pencil size={15} />
                            </button>

                            <button
                              type="button"
                              style={styles.deleteBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(item.id);
                              }}
                            >
                              <Trash2 size={15} />
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
              {filteredData.length} kecamatan
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

              {[...Array(Math.min(totalPages, 4))].map((_, idx) => {
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

              {totalPages > 4 && (
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
            <h3>Detail Kecamatan</h3>

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
              <div style={styles.detailTitleBox}>
                <div style={{ ...styles.profileAvatar, ...createAvatarStyle(0) }}>
                  <Building2 size={26} />
                </div>

                <div>
                  <div style={styles.detailNameRow}>
                    <h2>{getNamaKecamatan(selectedData)}</h2>

                    <span
                      style={{
                        ...styles.statusPill,
                        ...getStatusStyle(selectedData),
                      }}
                    >
                      ● {getStatusLabel(selectedData)}
                    </span>
                  </div>

                  <p>Kode: {getKodeKecamatan(selectedData)}</p>
                </div>
              </div>

              <div style={styles.detailTabs}>
                {[
                  { key: "informasi", label: "Informasi" },
                  { key: "wilayah", label: "Wilayah Binaan" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    style={{
                      ...styles.detailTab,
                      ...(activeDetailTab === tab.key
                        ? styles.detailTabActive
                        : {}),
                    }}
                    onClick={() => setActiveDetailTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
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

      {openImportModal && (
        <div style={styles.overlay}>
          <div style={styles.importModal}>
            <div style={styles.modalHeader}>
              <div>
                <h3>Import Data Kecamatan</h3>
                <p>
                  Unduh template Excel, isi data pada sheet Import Kecamatan,
                  lalu upload kembali ke sistem.
                </p>
              </div>

              <button
                type="button"
                style={styles.modalClose}
                onClick={() => {
                  setOpenImportModal(false);
                  setImportFile(null);

                  if (importInputRef.current) {
                    importInputRef.current.value = "";
                  }
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={styles.importInfoBox}>
              <strong>Template Excel sudah disiapkan.</strong>
              <p>
                Kolom akan terpisah rapi. Jangan mengubah nama kolom agar proses
                import tidak gagal.
              </p>
            </div>

            <div style={styles.importChoiceGrid}>
              <button
                type="button"
                style={styles.templateCard}
                onClick={handleDownloadTemplate}
              >
                <div style={styles.templateIconBox}>
                  <Download size={28} />
                </div>

                <div>
                  <strong>Unduh Template Excel</strong>
                  <p>Download file .xlsx berisi kolom dan contoh pengisian.</p>
                </div>
              </button>

              <button
                type="button"
                style={styles.uploadCard}
                onClick={() => importInputRef.current?.click()}
              >
                <div style={styles.uploadIconBox}>
                  <Upload size={28} />
                </div>

                <div>
                  <strong>Pilih File Import</strong>
                  <p>Upload file .xlsx, .xls, atau .csv yang sudah diisi.</p>
                </div>
              </button>
            </div>

            <div style={styles.selectedFileBox}>
              <span>File dipilih:</span>
              <strong>{importFile ? importFile.name : "Belum ada file"}</strong>
            </div>

            <div style={styles.importNote}>
              <strong>Catatan:</strong>
              <p>
                Kolom wajib adalah <b>nama_kecamatan</b>. Status gunakan{" "}
                <b>aktif</b> atau <b>nonaktif</b>.
              </p>
            </div>

            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.cancelBtn}
                onClick={() => {
                  setOpenImportModal(false);
                  setImportFile(null);

                  if (importInputRef.current) {
                    importInputRef.current.value = "";
                  }
                }}
                disabled={importing}
              >
                Batal
              </button>

              <button
                type="button"
                style={{
                  ...styles.saveBtn,
                  opacity: importFile ? 1 : 0.55,
                  cursor: importFile ? "pointer" : "not-allowed",
                }}
                onClick={handleUploadImport}
                disabled={!importFile || importing}
              >
                {importing ? "Mengimport..." : "Upload & Import"}
              </button>
            </div>
          </div>
        </div>
      )}

      {openForm && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h3>{editMode ? "Edit Kecamatan" : "Tambah Kecamatan"}</h3>
                <p>
                  {editMode
                    ? "Perbarui data kecamatan."
                    : "Tambahkan data kecamatan baru ke sistem GeoPanen."}
                </p>
              </div>

              <button type="button" style={styles.modalClose} onClick={closeForm}>
                <X size={20} />
              </button>
            </div>

            <div style={styles.formGrid}>
              <FormInput
                label="Nama Kecamatan"
                value={form.nama_kecamatan}
                placeholder="Contoh: Nguter"
                onChange={(value) =>
                  setForm({ ...form, nama_kecamatan: value })
                }
              />

              <FormInput
                label="Kode Kecamatan"
                value={form.kode_kecamatan}
                placeholder="Contoh: 3314"
                onChange={(value) =>
                  setForm({ ...form, kode_kecamatan: value })
                }
              />

              <FormInput
                label="Kabupaten"
                value={form.kabupaten}
                placeholder="Contoh: Sukoharjo"
                onChange={(value) => setForm({ ...form, kabupaten: value })}
              />

              <div style={styles.inputGroup}>
                <label>Status</label>

                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  style={styles.input}
                >
                  <option value="aktif">Aktif</option>
                  <option value="nonaktif">Nonaktif</option>
                </select>
              </div>

              <div style={{ ...styles.inputGroup, gridColumn: "1 / -1" }}>
                <label>Deskripsi</label>

                <textarea
                  value={form.deskripsi}
                  onChange={(e) =>
                    setForm({ ...form, deskripsi: e.target.value })
                  }
                  placeholder="Deskripsi singkat kecamatan"
                  style={styles.textarea}
                />
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

function StatCard({ icon, iconBoxStyle, label, value, note }) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statIcon, ...iconBoxStyle }}>{icon}</div>

      <div>
        <p style={styles.statLabel}>{label}</p>
        <h2 style={styles.statValue}>{value}</h2>
        <span style={styles.statNote}>{note}</span>
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
    color: "#059669",
    fontSize: 14,
    marginBottom: 14,
    fontWeight: 800,
  },

  backArrow: {
    color: "#059669",
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
    color: "#475569",
    maxWidth: 860,
  },

  topActions: {
    display: "flex",
    alignItems: "center",
    gap: 18,
  },

  globalSearch: {
    width: 330,
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
    color: "#0f172a",
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
    justifyContent: "space-between",
    marginTop: 8,
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

  exportBtn: {
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
    gridTemplateColumns: "repeat(4, 1fr)",
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

  orangeIconBox: {
    background: "#ffedd5",
    color: "#f97316",
  },

  purpleIconBox: {
    background: "#f3e8ff",
    color: "#9333ea",
  },

  statLabel: {
    margin: 0,
    color: "#64748b",
    fontSize: 14,
    fontWeight: 800,
  },

  statValue: {
    margin: "6px 0",
    color: "#0f172a",
    fontSize: 28,
    fontWeight: 950,
  },

  statNote: {
    fontSize: 13,
    color: "#475569",
    fontWeight: 650,
  },

  contentGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 430px",
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
    gridTemplateColumns: "1.4fr 1fr 0.75fr auto",
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
    minWidth: 980,
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

  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "5px 10px",
    fontSize: 12,
    fontWeight: 850,
    whiteSpace: "nowrap",
  },

  actionCell: {
    display: "flex",
    justifyContent: "center",
    gap: 7,
  },

  viewBtn: {
    width: 32,
    height: 32,
    border: "none",
    borderRadius: 7,
    background: "#2563eb",
    color: "#ffffff",
    cursor: "pointer",
  },

  editBtn: {
    width: 32,
    height: 32,
    border: "none",
    borderRadius: 7,
    background: "#f59e0b",
    color: "#ffffff",
    cursor: "pointer",
  },

  deleteBtn: {
    width: 32,
    height: 32,
    border: "none",
    borderRadius: 7,
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

  detailTitleBox: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 22,
  },

  profileAvatar: {
    width: 66,
    height: 66,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  detailNameRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  detailTabs: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
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

  ownerBox: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
  },

  ownerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 950,
  },

  detailActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },

  detailEditBtn: {
    height: 44,
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 850,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  detailDeleteBtn: {
    height: 44,
    border: "1px solid #fecaca",
    borderRadius: 9,
    background: "#ffffff",
    color: "#ef4444",
    fontWeight: 850,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
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

  emptyMiniBox: {
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
    padding: 16,
    color: "#64748b",
    background: "#f8fafc",
  },

  penyuluhList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  penyuluhItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
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
    width: 660,
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#ffffff",
    borderRadius: 18,
    padding: 24,
    boxShadow: "0 28px 80px rgba(15, 23, 42, 0.28)",
  },

  importModal: {
    width: 680,
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

  textarea: {
    minHeight: 90,
    border: "1px solid #dbe3ea",
    borderRadius: 10,
    padding: 12,
    outline: "none",
    fontSize: 14,
    resize: "vertical",
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

  importInfoBox: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    color: "#065f46",
    fontSize: 14,
  },

  importChoiceGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    marginBottom: 16,
  },

  templateCard: {
    border: "1px solid #dbe3ea",
    background: "#ffffff",
    borderRadius: 14,
    padding: 18,
    textAlign: "left",
    display: "flex",
    gap: 14,
    cursor: "pointer",
    color: "#0f172a",
  },

  uploadCard: {
    border: "1px solid #bbf7d0",
    background: "#ecfdf5",
    borderRadius: 14,
    padding: 18,
    textAlign: "left",
    display: "flex",
    gap: 14,
    cursor: "pointer",
    color: "#0f172a",
  },

  templateIconBox: {
    width: 50,
    height: 50,
    borderRadius: 12,
    background: "#dbeafe",
    color: "#2563eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  uploadIconBox: {
    width: 50,
    height: 50,
    borderRadius: 12,
    background: "#dcfce7",
    color: "#16a34a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  selectedFileBox: {
    border: "1px dashed #94a3b8",
    borderRadius: 12,
    padding: 14,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
    color: "#475569",
    background: "#f8fafc",
  },

  importNote: {
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
  },
};