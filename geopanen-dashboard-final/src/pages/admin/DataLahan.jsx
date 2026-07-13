import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../services/api";

import {
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
  Users,
  ShieldCheck,
  PauseCircle,
  UserRound,
  TrendingUp,
  Sprout,
  MapPin,
  MoreVertical,
  CalendarDays,
} from "lucide-react";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import iconUrl from "leaflet/dist/images/marker-icon.png";

import * as XLSX from "xlsx";

const markerIcon = new L.Icon({
  iconUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const initialForm = {
  nama_lahan: "",
  petani_id: "",
  nama_petani: "",
  kecamatan_id: "",
  desa_id: "",
  nama_kecamatan: "",
  nama_desa: "",
  luas_ha: "",
  luas_m2: "",
  varietas: "",
  komoditas: "Padi",
  status_lahan: "aktif",
  penyuluh_id: "",
  penyuluh: "",
  deskripsi: "",
  lat: "",
  lng: "",
};

const VARIETAS_PADI = [
  "Ciherang",
  "Mekongga",
  "Inpari 32",
  "Inpari 42",
  "IR64",
  "Situ Bagendit",
  "Cibogo",
];

const normalizeApiList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.lahan)) return payload.lahan;
  if (Array.isArray(payload?.petani)) return payload.petani;
  if (Array.isArray(payload?.penyuluh)) return payload.penyuluh;
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
  const text = String(value || "?").trim();
  return text.charAt(0).toUpperCase();
};

const formatNumber = (value, digit = 2) => {
  const number = Number(value || 0);

  return number.toLocaleString("id-ID", {
    minimumFractionDigits: digit,
    maximumFractionDigits: digit,
  });
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

const getStatusType = (item) => {
  const raw = String(
    item?.status_lahan ||
      item?.status ||
      item?.aktif ||
      item?.is_active ||
      ""
  ).toLowerCase();

  if (
    raw === "0" ||
    raw.includes("nonaktif") ||
    raw.includes("tidak") ||
    raw.includes("inactive")
  ) {
    return "tidak_aktif";
  }

  return "aktif";
};

const getStatusLabel = (item) => {
  return getStatusType(item) === "aktif" ? "Aktif" : "Tidak Aktif";
};

const getStatusStyle = (item) => {
  const type = getStatusType(item);

  if (type === "aktif") {
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

const getNamaLahan = (item) => {
  return item?.nama_lahan || item?.nama || "-";
};

const getKodeLahan = (item) => {
  return (
    item?.kode_lahan ||
    item?.kode ||
    `LH-${String(item?.id || 1).padStart(4, "0")}`
  );
};

const getNamaPetani = (item) => {
  return item?.nama_petani || item?.petani || item?.nama_user || "-";
};

const getPetaniId = (item) => {
  return item?.petani_id || item?.user_id || item?.id_petani || "-";
};

const getNamaKecamatan = (item) => {
  return item?.nama_kecamatan || item?.kecamatan || item?.nama_kec || "-";
};

const getNamaDesa = (item) => {
  return item?.nama_desa || item?.desa || item?.kelurahan || "-";
};

const getKomoditas = (item) => {
  return item?.komoditas || item?.tanaman || item?.jenis_tanaman || "Padi";
};

const getVarietas = (item) => {
  return item?.varietas || "-";
};

const getPenyuluh = (item) => {
  const value =
    item?.nama_penyuluh || item?.penyuluh || item?.penyuluh_binaan || "";

  return value ? value : "Belum ditugaskan";
};

const getPenyuluhId = (item) => {
  if (item?.kode_penyuluh) return item.kode_penyuluh;
  if (item?.penyuluh_id) {
    return `PYN-${String(item.penyuluh_id).padStart(3, "0")}`;
  }
  if (item?.id_penyuluh) {
    return `PYN-${String(item.id_penyuluh).padStart(3, "0")}`;
  }

  return "Belum ada ID";
};

const getLuasHa = (item) => {
  const value =
    item?.luas_ha ??
    item?.total_luas ??
    item?.luas_lahan ??
    item?.luas ??
    0;

  const number = Number(value || 0);

  if (number > 20) return number / 10000;

  return number;
};

const getLuasM2 = (item) => {
  const luasM2 = Number(item?.luas_m2 || 0);
  if (luasM2 > 0) return luasM2;

  return getLuasHa(item) * 10000;
};

const getLat = (item) => {
  return item?.lat || item?.latitude || "-";
};

const getLng = (item) => {
  return item?.lng || item?.longitude || "-";
};

const getDeskripsi = (item) => {
  return item?.deskripsi || item?.keterangan || "Belum ada deskripsi lahan.";
};

const getDesaKecamatanId = (item) => {
  return item?.kecamatan_id || item?.id_kecamatan || item?.kec_id || "";
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

export default function DataLahan() {
  const importInputRef = useRef(null);

  const currentUser = useMemo(() => getCurrentUser(), []);
  const appVersion = import.meta.env.VITE_APP_VERSION || "1.0.0";

  const [data, setData] = useState([]);
  const [petaniList, setPetaniList] = useState([]);
  const [kecamatanList, setKecamatanList] = useState([]);
  const [desaList, setDesaList] = useState([]);
  const [penyuluhList, setPenyuluhList] = useState([]);

  const [serverStats, setServerStats] = useState(null);
  const [notifCount, setNotifCount] = useState(0);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openImportModal, setOpenImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);

  const [selectedData, setSelectedData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const [openForm, setOpenForm] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [activeTab, setActiveTab] = useState("semua");
  const [activeDetailTab, setActiveDetailTab] = useState("informasi");

  const [search, setSearch] = useState("");
  const [filterKecamatan, setFilterKecamatan] = useState("");
  const [filterDesa, setFilterDesa] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [page, setPage] = useState(1);
  const perPage = 10;

  const [form, setForm] = useState(initialForm);

  const fetchData = async () => {
    try {
      setLoading(true);

      const res = await api.get("/admin/lahan");
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
      console.log("ERROR GET LAHAN:", err.response?.data || err.message);
      setData([]);
      setSelectedData(null);
    } finally {
      setLoading(false);
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

  const fetchKecamatan = async () => {
    try {
      const res = await api.get("/admin/kecamatan");
      setKecamatanList(normalizeApiList(res.data));
    } catch (err) {
      console.log("ERROR GET KECAMATAN:", err.response?.data || err.message);
      setKecamatanList([]);
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

  const fetchPenyuluh = async () => {
    try {
      const res = await api.get("/admin/penyuluh");
      setPenyuluhList(normalizeApiList(res.data));
    } catch (err) {
      console.log("ERROR GET PENYULUH:", err.response?.data || err.message);
      setPenyuluhList([]);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get("/admin/lahan/stats");
      setServerStats(res.data?.data || null);
    } catch (err) {
      console.log("ERROR STATS LAHAN:", err.response?.data || err.message);
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
    await Promise.allSettled([
      fetchData(),
      fetchPetani(),
      fetchKecamatan(),
      fetchDesa(),
      fetchPenyuluh(),
      fetchStats(),
      fetchNotifCount(),
    ]);
  };

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, activeTab, filterKecamatan, filterDesa, filterStatus]);

  const kecamatanOptions = useMemo(() => {
    const fromData = data
      .map((item) => getNamaKecamatan(item))
      .filter((item) => item && item !== "-");

    const fromApi = kecamatanList
      .map((item) => item.nama_kecamatan || item.kecamatan)
      .filter(Boolean);

    return [...new Set([...fromData, ...fromApi])];
  }, [data, kecamatanList]);

  const desaOptions = useMemo(() => {
    const fromData = data
      .map((item) => getNamaDesa(item))
      .filter((item) => item && item !== "-");

    const fromApi = desaList
      .map((item) => item.nama_desa || item.desa)
      .filter(Boolean);

    return [...new Set([...fromData, ...fromApi])];
  }, [data, desaList]);

  const stats = useMemo(() => {
    const totalLuas = data.reduce((total, item) => total + getLuasHa(item), 0);

    const lahanAktif = data
      .filter((item) => getStatusType(item) === "aktif")
      .reduce((total, item) => total + getLuasHa(item), 0);

    const lahanTidakAktif = data
      .filter((item) => getStatusType(item) === "tidak_aktif")
      .reduce((total, item) => total + getLuasHa(item), 0);

    const petaniIds = data
      .map((item) => getPetaniId(item))
      .filter((item) => item && item !== "-");

    const penyuluhIds = data
      .map((item) => getPenyuluhId(item))
      .filter((item) => item && item !== "-" && item !== "Belum ada ID");

    return {
      total_lahan: data.length,
      total_luas: totalLuas,
      lahan_aktif: lahanAktif,
      lahan_tidak_aktif: lahanTidakAktif,
      jumlah_petani: [...new Set(petaniIds)].length,
      jumlah_penyuluh: [...new Set(penyuluhIds)].length,
      rata_rata: data.length > 0 ? totalLuas / data.length : 0,
      selisih_luas: 0,
    };
  }, [data]);

  const finalStats = {
    ...stats,
    ...(serverStats || {}),
  };

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();

    return data.filter((item) => {
      const statusType = getStatusType(item);

      const matchTab =
        activeTab === "semua" ||
        (activeTab === "aktif" && statusType === "aktif") ||
        (activeTab === "tidak_aktif" && statusType === "tidak_aktif");

      const text = [
        getNamaLahan(item),
        getKodeLahan(item),
        getNamaPetani(item),
        getNamaKecamatan(item),
        getNamaDesa(item),
        getKomoditas(item),
        getVarietas(item),
        getPenyuluh(item),
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

  const closeModal = () => {
    setOpenForm(false);
    setEditMode(false);
    setSelectedId(null);
    setForm(initialForm);
  };

  const openCreate = () => {
    resetFilter();
    setEditMode(false);
    setSelectedId(null);
    setForm(initialForm);
    setOpenForm(true);
  };

  const handleView = (item) => {
    setSelectedData(item);
    setActiveDetailTab("informasi");
  };

  const handleEdit = (item) => {
    resetFilter();

    setEditMode(true);
    setSelectedId(item.id);
    setSelectedData(item);
    setActiveDetailTab("informasi");

    setForm({
      nama_lahan: getNamaLahan(item) === "-" ? "" : getNamaLahan(item),

      petani_id: getPetaniId(item) === "-" ? "" : String(getPetaniId(item)),
      nama_petani: getNamaPetani(item) === "-" ? "" : getNamaPetani(item),

      kecamatan_id: item?.kecamatan_id || "",
      desa_id: item?.desa_id || "",
      nama_kecamatan: getNamaKecamatan(item) === "-" ? "" : getNamaKecamatan(item),
      nama_desa: getNamaDesa(item) === "-" ? "" : getNamaDesa(item),

      luas_ha: getLuasHa(item) || "",
      luas_m2: getLuasM2(item) || "",

      varietas: getVarietas(item) === "-" ? "" : getVarietas(item),
      komoditas: getKomoditas(item),
      status_lahan: getStatusType(item),

      penyuluh_id: item?.penyuluh_id || item?.id_penyuluh || "",
      penyuluh:
        getPenyuluh(item) === "Belum ditugaskan" ? "" : getPenyuluh(item),

      deskripsi:
        getDeskripsi(item) === "Belum ada deskripsi lahan."
          ? ""
          : getDeskripsi(item),

      lat: getLat(item) === "-" ? "" : getLat(item),
      lng: getLng(item) === "-" ? "" : getLng(item),
    });

    setOpenForm(true);
  };

  const validateForm = () => {
    if (!form.nama_lahan.trim()) {
      alert("Nama lahan wajib diisi.");
      return false;
    }

    if (!form.petani_id) {
      alert("Petani pemilik wajib dipilih.");
      return false;
    }

    if (!form.kecamatan_id) {
      alert("Kecamatan wajib dipilih.");
      return false;
    }

    if (!form.desa_id) {
      alert("Desa wajib dipilih.");
      return false;
    }

    if (!form.luas_ha && !form.luas_m2) {
      alert("Luas lahan wajib diisi.");
      return false;
    }

    if (!form.varietas.trim()) {
      alert("Varietas wajib diisi.");
      return false;
    }

    return true;
  };

  const buildPayload = () => {
    const luasHa = Number(form.luas_ha || 0);
    const luasM2 = Number(form.luas_m2 || 0);

    return {
      nama_lahan: form.nama_lahan.trim(),

      petani_id: form.petani_id || null,
      user_id: form.petani_id || null,

      penyuluh_id: form.penyuluh_id || null,

      kecamatan_id: form.kecamatan_id || null,
      desa_id: form.desa_id || null,

      luas_ha: luasHa > 0 ? luasHa : luasM2 / 10000,
      luas_m2: luasM2 > 0 ? luasM2 : luasHa * 10000,

      varietas: form.varietas.trim(),
      komoditas: form.komoditas || "Padi",
      tanaman: form.komoditas || "Padi",

      status_lahan: form.status_lahan,
      deskripsi: form.deskripsi || null,

      lat: form.lat || null,
      lng: form.lng || null,
    };
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);

      await api.post("/admin/lahan", buildPayload());

      closeModal();
      await refreshAll();
      alert("Lahan berhasil ditambahkan.");
    } catch (err) {
      console.log("ERROR CREATE LAHAN:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Gagal menambah lahan.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedId) {
      alert("Data lahan belum dipilih.");
      return;
    }

    if (!validateForm()) return;

    try {
      setSaving(true);

      const payload = buildPayload();

      await api.put(`/admin/lahan/${selectedId}`, payload);

      setData((prev) =>
        prev.map((item) =>
          Number(item.id) === Number(selectedId)
            ? {
                ...item,
                ...payload,
                nama_petani: form.nama_petani,
                nama_kecamatan: form.nama_kecamatan,
                nama_desa: form.nama_desa,
                nama_penyuluh: form.penyuluh || "Belum ditugaskan",
              }
            : item
        )
      );

      setSelectedData((prev) =>
        prev && Number(prev.id) === Number(selectedId)
          ? {
              ...prev,
              ...payload,
              nama_petani: form.nama_petani,
              nama_kecamatan: form.nama_kecamatan,
              nama_desa: form.nama_desa,
              nama_penyuluh: form.penyuluh || "Belum ditugaskan",
            }
          : prev
      );

      closeModal();
      await refreshAll();
      alert("Lahan berhasil diperbarui.");
    } catch (err) {
      console.log("ERROR UPDATE LAHAN:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Gagal memperbarui lahan.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const ok = confirm("Hapus data lahan ini?");
    if (!ok) return;

    try {
      await api.delete(`/admin/lahan/${id}`);

      setData((prev) => prev.filter((item) => Number(item.id) !== Number(id)));

      if (Number(selectedData?.id) === Number(id)) {
        setSelectedData(null);
      }

      await refreshAll();
      alert("Lahan berhasil dihapus.");
    } catch (err) {
      console.log("ERROR DELETE LAHAN:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Gagal menghapus lahan.");
    }
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "nama_lahan",
      "petani_id",
      "penyuluh_id",
      "kecamatan_id",
      "desa_id",
      "luas_ha",
      "luas_m2",
      "varietas",
      "komoditas",
      "status_lahan",
      "deskripsi",
      "lat",
      "lng",
    ];

    const columnWidths = [
      { wch: 24 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 18 },
      { wch: 14 },
      { wch: 16 },
      { wch: 36 },
      { wch: 16 },
      { wch: 16 },
    ];

    const importSheet = XLSX.utils.aoa_to_sheet([headers]);
    importSheet["!cols"] = columnWidths;

    const contohRows = [
      headers,
      [
        "Sawah Selatan",
        "4",
        "6",
        "1",
        "1",
        "0.10",
        "1000",
        "Pajajaran",
        "Padi",
        "aktif",
        "Lahan sawah aktif milik petani",
        "-7.62",
        "110.78",
      ],
      [
        "Sawah Timur",
        "7",
        "6",
        "2",
        "3",
        "0.25",
        "2500",
        "Ciherang",
        "Padi",
        "aktif",
        "Contoh data lahan kedua",
        "-7.63",
        "110.79",
      ],
    ];

    const contohSheet = XLSX.utils.aoa_to_sheet(contohRows);
    contohSheet["!cols"] = columnWidths;

    const petaniSheet = XLSX.utils.aoa_to_sheet([
      ["petani_id", "nama_petani", "email"],
      ...petaniList.map((item) => [
        item.id || "",
        item.nama || "",
        item.email || "",
      ]),
    ]);

    petaniSheet["!cols"] = [{ wch: 12 }, { wch: 28 }, { wch: 34 }];

    const penyuluhSheet = XLSX.utils.aoa_to_sheet([
      ["penyuluh_id", "nama_penyuluh", "email"],
      ...penyuluhList.map((item) => [
        item.id || "",
        item.nama || "",
        item.email || "",
      ]),
    ]);

    penyuluhSheet["!cols"] = [{ wch: 14 }, { wch: 28 }, { wch: 34 }];

    const kecamatanSheet = XLSX.utils.aoa_to_sheet([
      ["kecamatan_id", "nama_kecamatan"],
      ...kecamatanList.map((item) => [
        item.id || "",
        item.nama_kecamatan || item.kecamatan || "",
      ]),
    ]);

    kecamatanSheet["!cols"] = [{ wch: 14 }, { wch: 28 }];

    const desaSheet = XLSX.utils.aoa_to_sheet([
      ["desa_id", "nama_desa", "kecamatan_id"],
      ...desaList.map((item) => [
        item.id || "",
        item.nama_desa || item.desa || "",
        item.kecamatan_id || item.id_kecamatan || "",
      ]),
    ]);

    desaSheet["!cols"] = [{ wch: 12 }, { wch: 28 }, { wch: 14 }];

    const petunjukSheet = XLSX.utils.aoa_to_sheet([
      ["PETUNJUK IMPORT DATA LAHAN GEOPANEN"],
      [""],
      ["1", "Isi data pada sheet Import Lahan mulai baris ke-2."],
      ["2", "Jangan mengubah nama kolom/header."],
      ["3", "petani_id wajib diisi sesuai sheet Referensi Petani."],
      ["4", "penyuluh_id boleh kosong kalau belum ditugaskan."],
      ["5", "kecamatan_id dan desa_id isi sesuai sheet referensi."],
      ["6", "status_lahan gunakan aktif atau tidak_aktif."],
      ["7", "luas_ha boleh diisi. luas_m2 boleh dikosongkan jika tidak diperlukan."],
      ["8", "Backend akan membaca sheet pertama, yaitu Import Lahan."],
      ["9", "Setelah selesai mengisi, upload file ini melalui tombol Import Lahan."],
    ]);

    petunjukSheet["!cols"] = [{ wch: 8 }, { wch: 90 }];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, importSheet, "Import Lahan");
    XLSX.utils.book_append_sheet(workbook, contohSheet, "Contoh Pengisian");
    XLSX.utils.book_append_sheet(workbook, petaniSheet, "Referensi Petani");
    XLSX.utils.book_append_sheet(workbook, penyuluhSheet, "Referensi Penyuluh");
    XLSX.utils.book_append_sheet(workbook, kecamatanSheet, "Referensi Kecamatan");
    XLSX.utils.book_append_sheet(workbook, desaSheet, "Referensi Desa");
    XLSX.utils.book_append_sheet(workbook, petunjukSheet, "Petunjuk");

    XLSX.writeFile(workbook, "template-import-lahan-geopanen.xlsx");
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

      await api.post("/admin/lahan/import", formData, {
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

      alert("Import lahan berhasil.");
    } catch (err) {
      console.log("ERROR IMPORT LAHAN:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Import lahan gagal.");
    } finally {
      setImporting(false);
    }
  };

  const handleExport = () => {
    const headers = [
      "Nama Lahan",
      "Kode Lahan",
      "Petani",
      "Kecamatan",
      "Desa",
      "Luas Ha",
      "Komoditas",
      "Varietas",
      "Status",
      "Penyuluh",
      "Latitude",
      "Longitude",
    ];

    const rows = filteredData.map((item) => [
      getNamaLahan(item),
      getKodeLahan(item),
      getNamaPetani(item),
      getNamaKecamatan(item),
      getNamaDesa(item),
      formatNumber(getLuasHa(item), 2),
      getKomoditas(item),
      getVarietas(item),
      getStatusLabel(item),
      getPenyuluh(item),
      getLat(item),
      getLng(item),
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "data-lahan-geopanen.csv";
    link.click();

    URL.revokeObjectURL(url);
  };

  const renderDetailContent = () => {
    if (!selectedData) {
      return (
        <div style={styles.emptyDetail}>
          <Sprout size={42} />
          <p>Pilih salah satu lahan untuk melihat detail.</p>
        </div>
      );
    }

    if (activeDetailTab === "peta") {
      const lat = Number(getLat(selectedData));
      const lng = Number(getLng(selectedData));

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return (
          <div style={styles.mapBox}>
            <MapPin size={38} />
            <h4>Koordinat belum tersedia</h4>
            <p>Data lahan ini belum memiliki latitude dan longitude yang valid.</p>
          </div>
        );
      }

      return (
        <div style={styles.realMapBox}>
          <MapContainer
            key={`${selectedData.id}-${lat}-${lng}`}
            center={[lat, lng]}
            zoom={15}
            style={{ width: "100%", height: "100%", borderRadius: 14 }}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <Marker position={[lat, lng]} icon={markerIcon}>
              <Popup>
                <strong>{getNamaLahan(selectedData)}</strong>
                <br />
                {getNamaDesa(selectedData)}, {getNamaKecamatan(selectedData)}
              </Popup>
            </Marker>
          </MapContainer>
        </div>
      );
    }

    if (activeDetailTab === "riwayat") {
      return (
        <div style={styles.timeline}>
          <TimelineItem
            title="Data lahan masuk sistem"
            description={`${getNamaLahan(selectedData)} tercatat pada master data lahan.`}
            date={formatTanggal(selectedData.created_at)}
          />

          <TimelineItem
            title="Status lahan"
            description={`Status saat ini: ${getStatusLabel(selectedData)}.`}
            date="Data terbaru"
          />

          <TimelineItem
            title="Komoditas"
            description={`Komoditas ${getKomoditas(selectedData)} dengan varietas ${getVarietas(selectedData)}.`}
            date="Data budidaya"
          />
        </div>
      );
    }

    if (activeDetailTab === "aktivitas") {
      return (
        <div style={styles.timeline}>
          <TimelineItem
            title="Siap dipantau"
            description="Data lahan dapat digunakan untuk monitoring, prediksi, dan laporan."
            date="GeoPanen"
          />

          <TimelineItem
            title="Terhubung dengan petani"
            description={`Pemilik lahan: ${getNamaPetani(selectedData)}.`}
            date="Relasi data"
          />

          <TimelineItem
            title="Penyuluh binaan"
            description={`Penyuluh: ${getPenyuluh(selectedData)}.`}
            date="Pendampingan"
          />
        </div>
      );
    }

    return (
      <>
        <DetailSection title="Informasi Lahan">
          <DetailRow label="Nama Lahan" value={getNamaLahan(selectedData)} />
          <DetailRow label="Kode Lahan" value={getKodeLahan(selectedData)} />
          <DetailRow
            label="Luas"
            value={`${formatNumber(getLuasHa(selectedData), 2)} Ha`}
          />
          <DetailRow label="Komoditas" value={getKomoditas(selectedData)} />
          <DetailRow label="Varietas" value={getVarietas(selectedData)} />
          <DetailRow label="Status" value={getStatusLabel(selectedData)} />
          <DetailRow label="Tgl. Input" value={formatTanggal(selectedData.created_at)} />
          <DetailRow label="Deskripsi" value={getDeskripsi(selectedData)} />
        </DetailSection>

        <DetailSection title="Informasi Lokasi">
          <DetailRow label="Kecamatan" value={getNamaKecamatan(selectedData)} />
          <DetailRow label="Desa / Kelurahan" value={getNamaDesa(selectedData)} />
          <DetailRow
            label="Koordinat"
            value={`${getLat(selectedData)}, ${getLng(selectedData)}`}
          />
          <DetailRow
            label="Luas m²"
            value={`${formatNumber(getLuasM2(selectedData), 0)} m²`}
          />
        </DetailSection>

        <DetailSection title="Pemilik Lahan">
          <div style={styles.ownerBox}>
            <div style={{ ...styles.ownerAvatar, ...createAvatarStyle(1) }}>
              {getInitial(getNamaPetani(selectedData))}
            </div>

            <div>
              <strong>{getNamaPetani(selectedData)}</strong>
              <p>ID Petani: PT-{String(getPetaniId(selectedData)).padStart(4, "0")}</p>
            </div>
          </div>
        </DetailSection>

        <DetailSection title="Penyuluh Binaan">
          <div style={styles.ownerBox}>
            <div style={{ ...styles.ownerAvatar, ...createAvatarStyle(2) }}>
              {getInitial(getPenyuluh(selectedData))}
            </div>

            <div>
              <strong>{getPenyuluh(selectedData)}</strong>
              <p>ID Penyuluh: {getPenyuluhId(selectedData)}</p>
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
            <span style={styles.breadcrumbIcon}>⌘</span>
            <span>Master Data</span>
            <span>/</span>
            <strong>Lahan</strong>
          </div>

          <h1 style={styles.title}>Master Data Lahan</h1>

          <p style={styles.subtitle}>
            Kelola seluruh data lahan yang terdaftar dalam sistem. Data lahan
            terhubung dengan petani dan penyuluh binaan.
          </p>
        </div>

        <div style={styles.topActions}>
          <div style={styles.globalSearch}>
            <Search size={18} color="#64748b" />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari lahan, petani, lokasi, atau varietas..."
              style={styles.globalSearchInput}
              autoComplete="off"
            />

            {search && (
              <button
                type="button"
                style={styles.clearSearchBtn}
                onClick={() => setSearch("")}
              >
                <X size={16} />
              </button>
            )}
          </div>

          <button type="button" style={styles.iconBell}>
            <Bell size={21} />
            {notifCount > 0 && (
              <span style={styles.bellBadge}>{notifCount}</span>
            )}
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
            Import Lahan
          </button>

          <button type="button" style={styles.exportBtn} onClick={handleExport}>
            <Download size={17} />
            Export
          </button>

          <button type="button" style={styles.addBtn} onClick={openCreate}>
            <Plus size={18} />
            Tambah Lahan
          </button>
        </div>
      </div>

      <section style={styles.statsGrid}>
        <StatCard
          icon={<Users size={32} />}
          iconBoxStyle={styles.greenIconBox}
          label="Total Lahan"
          value={`${formatNumber(finalStats.total_luas, 2)} Ha`}
          note={`${
            Number(finalStats.selisih_luas || 0) >= 0 ? "↑" : "↓"
          } ${formatNumber(
            Math.abs(Number(finalStats.selisih_luas || 0)),
            2
          )} Ha dari bulan lalu`}
          noteColor={
            Number(finalStats.selisih_luas || 0) >= 0 ? "#059669" : "#ef4444"
          }
        />

        <StatCard
          icon={<ShieldCheck size={32} />}
          iconBoxStyle={styles.blueIconBox}
          label="Lahan Aktif"
          value={`${formatNumber(finalStats.lahan_aktif, 2)} Ha`}
          note={`${
            finalStats.total_luas > 0
              ? ((finalStats.lahan_aktif / finalStats.total_luas) * 100).toFixed(1)
              : "0.0"
          }% dari total`}
          noteColor="#475569"
        />

        <StatCard
          icon={<PauseCircle size={32} />}
          iconBoxStyle={styles.yellowIconBox}
          label="Lahan Tidak Aktif"
          value={`${formatNumber(finalStats.lahan_tidak_aktif, 2)} Ha`}
          note={`${
            finalStats.total_luas > 0
              ? (
                  (finalStats.lahan_tidak_aktif / finalStats.total_luas) *
                  100
                ).toFixed(1)
              : "0.0"
          }% dari total`}
          noteColor="#475569"
        />

        <StatCard
          icon={<UserRound size={32} />}
          iconBoxStyle={styles.purpleIconBox}
          label="Jumlah Petani"
          value={finalStats.jumlah_petani || 0}
          note="Pemilik lahan"
          noteColor="#475569"
        />

        <StatCard
          icon={<TrendingUp size={32} />}
          iconBoxStyle={styles.greenIconBox}
          label="Rata-rata Luas"
          value={`${formatNumber(finalStats.rata_rata, 2)} Ha`}
          note="Per lahan"
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
                { key: "tidak_aktif", label: "Tidak Aktif" },
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
                placeholder="Cari lahan, lokasi, atau petani..."
                style={styles.searchInput}
                autoComplete="off"
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
              <option value="tidak_aktif">Tidak Aktif</option>
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
                  <th style={styles.th}>Nama Lahan</th>
                  <th style={styles.th}>Petani</th>
                  <th style={styles.th}>Lokasi</th>
                  <th style={styles.th}>Luas (Ha)</th>
                  <th style={styles.th}>Komoditas</th>
                  <th style={styles.th}>Varietas</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Penyuluh</th>
                  <th style={{ ...styles.th, textAlign: "center" }}>Aksi</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={10} style={styles.emptyCell}>
                      Memuat data lahan...
                    </td>
                  </tr>
                )}

                {!loading && paginatedData.length === 0 && (
                  <tr>
                    <td colSpan={10} style={styles.emptyCell}>
                      Data lahan tidak ditemukan.
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
                          <strong>{getNamaLahan(item)}</strong>
                          <span style={styles.smallMuted}>
                            Kode: {getKodeLahan(item)}
                          </span>
                        </td>

                        <td style={styles.td}>
                          <div style={styles.petaniCell}>
                            <div
                              style={{
                                ...styles.avatarLetter,
                                ...createAvatarStyle(index),
                              }}
                            >
                              {getInitial(getNamaPetani(item))}
                            </div>

                            <div>
                              <strong>{getNamaPetani(item)}</strong>
                              <span style={styles.smallMuted}>
                                ID: PT-{String(getPetaniId(item)).padStart(4, "0")}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td style={styles.td}>
                          <strong>{getNamaKecamatan(item)}</strong>
                          <span style={styles.smallMuted}>{getNamaDesa(item)}</span>
                        </td>

                        <td style={styles.td}>
                          <strong>{formatNumber(getLuasHa(item), 2)}</strong>
                          <span style={styles.smallMuted}>Ha</span>
                        </td>

                        <td style={styles.td}>
                          <span style={styles.commodityPill}>
                            <Sprout size={14} />
                            {getKomoditas(item)}
                          </span>
                        </td>

                        <td style={styles.td}>{getVarietas(item)}</td>

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

                        <td style={styles.td}>
                          <strong>{getPenyuluh(item)}</strong>
                          <span style={styles.smallMuted}>
                            {getPenyuluhId(item)}
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
                              title="Lihat"
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
                              title="Edit"
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
                              title="Hapus"
                            >
                              <Trash2 size={15} />
                            </button>

                            <button type="button" style={styles.moreBtn}>
                              <MoreVertical size={15} />
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
              {filteredData.length} lahan
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

          <div style={styles.connectionBox}>
            <div>
              <strong>Keterhubungan Data</strong>
              <p>
                Data lahan terhubung dengan data petani sebagai pemilik lahan dan
                penyuluh sebagai pembina wilayah.
              </p>
            </div>

            <div style={styles.connectionStats}>
              <span>
                <Users size={20} /> {finalStats.jumlah_petani || 0} Petani Terhubung
              </span>

              <span>
                <UserRound size={20} /> {finalStats.jumlah_penyuluh || 0} Penyuluh Terhubung
              </span>
            </div>
          </div>
        </section>

        <aside style={styles.detailPanel}>
          <div style={styles.detailHeader}>
            <h3>Detail Lahan</h3>

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
                <div style={{ ...styles.profileAvatar, ...createAvatarStyle(1) }}>
                  <Sprout size={24} />
                </div>

                <div>
                  <div style={styles.detailNameRow}>
                    <h2>{getNamaLahan(selectedData)}</h2>

                    <span
                      style={{
                        ...styles.statusPill,
                        ...getStatusStyle(selectedData),
                      }}
                    >
                      ● {getStatusLabel(selectedData)}
                    </span>
                  </div>

                  <p>Kode Lahan: {getKodeLahan(selectedData)}</p>
                </div>
              </div>

              <div style={styles.detailTabs}>
                {[
                  { key: "informasi", label: "Informasi" },
                  { key: "peta", label: "Peta" },
                  { key: "riwayat", label: "Riwayat" },
                  { key: "aktivitas", label: "Aktivitas" },
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
                <h3>Import Data Lahan</h3>
                <p>
                  Unduh template Excel terlebih dahulu, isi data pada sheet
                  Import Lahan, lalu upload kembali ke sistem.
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
              <strong>Template sudah berbentuk Excel asli.</strong>
              <p>
                Kolom akan terpisah rapi. Isi data pada sheet <b>Import Lahan</b>.
                Sheet lain hanya untuk contoh dan referensi ID.
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
                  <p>
                    Download file .xlsx berisi kolom import, contoh pengisian,
                    dan referensi ID.
                  </p>
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
                Isi <b>petani_id</b> sesuai sheet Referensi Petani. Isi{" "}
                <b>penyuluh_id</b> sesuai sheet Referensi Penyuluh jika lahan
                sudah ingin langsung ditugaskan. Kalau belum ada penyuluh,
                kolom penyuluh_id boleh dikosongkan.
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
                <h3>{editMode ? "Edit Lahan" : "Tambah Lahan"}</h3>
                <p>
                  {editMode
                    ? "Perbarui data lahan pertanian."
                    : "Tambahkan data lahan baru ke sistem GeoPanen."}
                </p>
              </div>

              <button type="button" style={styles.modalClose} onClick={closeModal}>
                <X size={20} />
              </button>
            </div>

            <div style={styles.formGrid}>
              <FormInput
                label="Nama Lahan"
                value={form.nama_lahan}
                placeholder="Contoh: Lahan Sawah Selatan"
                onChange={(value) => setForm({ ...form, nama_lahan: value })}
              />

              <div style={styles.inputGroup}>
                <label>Petani Pemilik</label>
                <select
                  value={form.petani_id}
                  onChange={(e) => {
                    const selected = petaniList.find(
                      (item) => String(item.id) === String(e.target.value)
                    );

                    setForm({
                      ...form,
                      petani_id: e.target.value,
                      nama_petani: selected?.nama || "",
                    });
                  }}
                  style={styles.input}
                >
                  <option value="">Pilih petani</option>

                  {petaniList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nama} - {item.email}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.inputGroup}>
                <label>Kecamatan</label>
                <select
                  value={form.kecamatan_id}
                  onChange={(e) => {
                    const selected = kecamatanList.find(
                      (item) => String(item.id) === String(e.target.value)
                    );

                    setForm({
                      ...form,
                      kecamatan_id: e.target.value,
                      nama_kecamatan: selected?.nama_kecamatan || "",
                      desa_id: "",
                      nama_desa: "",
                    });
                  }}
                  style={styles.input}
                >
                  <option value="">Pilih kecamatan</option>

                  {kecamatanList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nama_kecamatan}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.inputGroup}>
                <label>Desa / Kelurahan</label>
                <select
                  value={form.desa_id}
                  onChange={(e) => {
                    const selected = desaList.find(
                      (item) => String(item.id) === String(e.target.value)
                    );

                    setForm({
                      ...form,
                      desa_id: e.target.value,
                      nama_desa: selected?.nama_desa || "",
                    });
                  }}
                  style={styles.input}
                >
                  <option value="">Pilih desa</option>

                  {desaList
                    .filter((item) => {
                      if (!form.kecamatan_id) return true;
                      return String(getDesaKecamatanId(item)) === String(form.kecamatan_id);
                    })
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nama_desa}
                      </option>
                    ))}
                </select>
              </div>

              <FormInput
                label="Luas Ha"
                type="number"
                value={form.luas_ha}
                placeholder="Contoh: 0.50"
                onChange={(value) =>
                  setForm({
                    ...form,
                    luas_ha: value,
                    luas_m2: value ? Number(value) * 10000 : "",
                  })
                }
              />

              <FormInput
                label="Luas m²"
                type="number"
                value={form.luas_m2}
                placeholder="Otomatis dari hektar"
                onChange={(value) =>
                  setForm({
                    ...form,
                    luas_m2: value,
                    luas_ha: value ? Number(value) / 10000 : "",
                  })
                }
              />

              <div style={styles.inputGroup}>
                <label>Komoditas</label>

                <select
                  value={form.komoditas}
                  onChange={(e) =>
                    setForm({ ...form, komoditas: e.target.value })
                  }
                  style={styles.input}
                >
                  <option value="Padi">Padi</option>
                  <option value="Jagung">Jagung</option>
                  <option value="Kedelai">Kedelai</option>
                </select>
              </div>

              <div style={styles.inputGroup}>
                <label>Varietas</label>

                <select
                  value={form.varietas}
                  onChange={(e) => setForm({ ...form, varietas: e.target.value })}
                  style={styles.input}
                >
                  <option value="">Pilih varietas</option>

                  {VARIETAS_PADI.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}

                  <option value="Bisi 18">Bisi 18</option>
                  <option value="Anjasmoro">Anjasmoro</option>
                  <option value="Pajajaran">Pajajaran</option>
                </select>
              </div>

              <div style={styles.inputGroup}>
                <label>Penyuluh Binaan</label>

                <select
                  value={form.penyuluh_id}
                  onChange={(e) => {
                    const selected = penyuluhList.find(
                      (item) => String(item.id) === String(e.target.value)
                    );

                    setForm({
                      ...form,
                      penyuluh_id: e.target.value,
                      penyuluh: selected?.nama || "",
                    });
                  }}
                  style={styles.input}
                >
                  <option value="">Belum ditugaskan</option>

                  {penyuluhList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nama} -{" "}
                      {item.kode_penyuluh ||
                        `PYN-${String(item.id).padStart(3, "0")}`}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.inputGroup}>
                <label>Status Lahan</label>

                <select
                  value={form.status_lahan}
                  onChange={(e) =>
                    setForm({ ...form, status_lahan: e.target.value })
                  }
                  style={styles.input}
                >
                  <option value="aktif">Aktif</option>
                  <option value="tidak_aktif">Tidak Aktif</option>
                </select>
              </div>

              <FormInput
                label="Latitude"
                type="number"
                value={form.lat}
                placeholder="Contoh: -7.621234"
                onChange={(value) => setForm({ ...form, lat: value })}
              />

              <FormInput
                label="Longitude"
                type="number"
                value={form.lng}
                placeholder="Contoh: 110.789123"
                onChange={(value) => setForm({ ...form, lng: value })}
              />

              <div style={{ ...styles.inputGroup, gridColumn: "1 / -1" }}>
                <label>Deskripsi</label>

                <textarea
                  value={form.deskripsi}
                  onChange={(e) =>
                    setForm({ ...form, deskripsi: e.target.value })
                  }
                  placeholder="Deskripsi singkat lahan"
                  style={styles.textarea}
                />
              </div>
            </div>

            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.cancelBtn}
                onClick={closeModal}
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

function TimelineItem({ title, description, date }) {
  return (
    <div style={styles.timelineItem}>
      <div style={styles.timelineIcon}>
        <CalendarDays size={16} />
      </div>

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
    maxWidth: 850,
  },

  topActions: {
    display: "flex",
    alignItems: "center",
    gap: 18,
  },

  globalSearch: {
    width: 370,
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

  clearSearchBtn: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    color: "#64748b",
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
    minWidth: 1180,
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

  petaniCell: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  avatarLetter: {
    width: 38,
    height: 38,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 950,
  },

  smallMuted: {
    display: "block",
    marginTop: 4,
    color: "#64748b",
    fontSize: 13,
  },

  commodityPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontWeight: 800,
    color: "#0f172a",
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

  moreBtn: {
    width: 32,
    height: 32,
    border: "none",
    borderRadius: 7,
    background: "#f8fafc",
    color: "#64748b",
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

  connectionBox: {
    marginTop: 22,
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
    borderRadius: 12,
    padding: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },

  connectionStats: {
    display: "flex",
    gap: 22,
    fontWeight: 850,
    color: "#047857",
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
    gridTemplateColumns: "repeat(4, 1fr)",
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

  mapBox: {
    minHeight: 240,
    border: "1px solid #dbe3ea",
    borderRadius: 14,
    background: "#f8fafc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    textAlign: "center",
    padding: 24,
    color: "#047857",
  },

  realMapBox: {
    height: 280,
    border: "1px solid #dbe3ea",
    borderRadius: 14,
    overflow: "hidden",
    background: "#f8fafc",
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
    width: 760,
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

  importModal: {
    width: 680,
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#ffffff",
    borderRadius: 18,
    padding: 24,
    boxShadow: "0 28px 80px rgba(15, 23, 42, 0.28)",
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