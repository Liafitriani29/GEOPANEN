import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import api from "../../services/api";
import {
  Cell,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const BACKEND_HOST = String(
  import.meta.env.VITE_BACKEND_URL || api.defaults.baseURL || ""
)
  .replace(/\/api\/?$/, "")
  .replace(/\/$/, "");

const FASTAPI = String(
  import.meta.env.VITE_FASTAPI_URL || ""
).replace(/\/+$/, "");
const DEFAULT_CENTER = [-7.6686, 110.8382];

const TOPIK_OPTIONS = [
  "Pemupukan",
  "Hama",
  "Irigasi",
  "Penyakit",
  "Tanah",
  "Pertumbuhan",
  "Panen",
  "Cuaca",
  "Lainnya",
];

const STATUS_OPTIONS = ["Menunggu", "Ditindaklanjuti", "Selesai"];

const INITIAL_FORM = {
  judul: "",
  isi: "",
  kategori: "Pemupukan",
  petani_id: "",
  lahan_id: "",
  status: "Menunggu",
  tindak_lanjut: "",
  tanggal_tindak_lanjut: "",
  foto_url: "",
  kirim_notifikasi: false,
};

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

function getFileUrl(fileUrl) {
  if (!fileUrl) return "";
  if (String(fileUrl).startsWith("http")) return fileUrl;
  return `${BACKEND_HOST}${fileUrl}`;
}

function topicMeta(topic = "") {
  const raw = String(topic).toLowerCase();

  if (raw.includes("pupuk")) {
    return {
      label: "Pemupukan",
      color: "#16a34a",
      bg: "#dcfce7",
      icon: "🧪",
    };
  }

  if (raw.includes("hama")) {
    return {
      label: "Hama",
      color: "#f59e0b",
      bg: "#ffedd5",
      icon: "🐛",
    };
  }

  if (raw.includes("irigasi") || raw.includes("air")) {
    return {
      label: "Irigasi",
      color: "#2563eb",
      bg: "#dbeafe",
      icon: "💧",
    };
  }

  if (raw.includes("penyakit") || raw.includes("blast")) {
    return {
      label: "Penyakit",
      color: "#ef4444",
      bg: "#fee2e2",
      icon: "🧬",
    };
  }

  if (raw.includes("tanah")) {
    return {
      label: "Tanah",
      color: "#92400e",
      bg: "#fef3c7",
      icon: "🌱",
    };
  }

  if (raw.includes("tumbuh")) {
    return {
      label: "Pertumbuhan",
      color: "#059669",
      bg: "#d1fae5",
      icon: "🌿",
    };
  }

  if (raw.includes("panen")) {
    return {
      label: "Panen",
      color: "#7c3aed",
      bg: "#ede9fe",
      icon: "🌾",
    };
  }

  if (raw.includes("cuaca")) {
    return {
      label: "Cuaca",
      color: "#0ea5e9",
      bg: "#e0f2fe",
      icon: "🌦️",
    };
  }

  return {
    label: topic || "Lainnya",
    color: "#64748b",
    bg: "#f1f5f9",
    icon: "📌",
  };
}

function statusMeta(status = "") {
  const raw = String(status).toLowerCase();

  if (raw.includes("selesai")) {
    return {
      label: "Selesai",
      color: "#2563eb",
      bg: "#dbeafe",
    };
  }

  if (raw.includes("ditindak")) {
    return {
      label: "Ditindaklanjuti",
      color: "#059669",
      bg: "#dcfce7",
    };
  }

  return {
    label: "Menunggu",
    color: "#d97706",
    bg: "#ffedd5",
  };
}

function makeMarkerIcon(color = "#16a34a", number = "") {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 34px;
        height: 34px;
        border-radius: 999px;
        background: ${color};
        color: white;
        border: 4px solid white;
        box-shadow: 0 12px 24px rgba(15,23,42,.25);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 900;
        font-size: 12px;
      ">
        ${number}
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -16],
  });
}

function FitMapBounds({ items }) {
  const map = useMap();

  useEffect(() => {
    const points = items
      .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
      .map((item) => [item.lat, item.lng]);

    if (points.length === 0) return;

    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }

    map.fitBounds(points, {
      padding: [30, 30],
      maxZoom: 14,
    });
  }, [items, map]);

  return null;
}

export default function CatatanLapangan() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const currentUser = getStoredUser();

  const penyuluhId =
    currentUser?.id ||
    localStorage.getItem("user_id") ||
    localStorage.getItem("penyuluh_id") ||
    null;

  const [catatan, setCatatan] = useState([]);
  const [lahan, setLahan] = useState([]);

  const [weather, setWeather] = useState({
    suhu: 28,
    kelembapan: 78,
    curah_hujan: 2,
    kondisi: "Cerah",
  });

  const [selectedKec, setSelectedKec] = useState("all");
  const [selectedDesa, setSelectedDesa] = useState("all");
  const [selectedPetani, setSelectedPetani] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [startDate, setStartDate] = useState(() => getDateBeforeInput(60));
  const [endDate, setEndDate] = useState(() => getTodayInput());

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [modalMode, setModalMode] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);

  const [form, setForm] = useState(INITIAL_FORM);

  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);

      const res = await api.get("/penyuluh/catatan", {
        params: {
          penyuluh_id: penyuluhId,
        },
      });

      setCatatan(safeList(res.data));
    } catch (err) {
      console.log("GET CATATAN ERROR:", err.response?.data || err.message);
      setCatatan([]);
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
          lat: safeNumber(
            item.lat || item.latitude || item.lokasi_lat || item.koordinat_lat,
            NaN
          ),
          lng: safeNumber(
            item.lng || item.longitude || item.lokasi_lng || item.koordinat_lng,
            NaN
          ),
        };
      })
      .filter((item) => item.id && item.petani_id);
  };

  const fetchLahan = async () => {
    try {
      let rows = [];

      try {
        const res = await api.get("/penyuluh/petani-binaan", {
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
          const resMap = await api.get("/map-binaan", {
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
      const res = await api.get("/penyuluh/catatan/cuaca/latest");
      setWeather(res.data?.data || weather);
    } catch (err) {
      console.log("GET CUACA ERROR:", err.response?.data || err.message);
    }
  };

  useEffect(() => {
    fetchData();
    fetchLahan();
    fetchWeather();
  }, []);

 const lahanMap = useMemo(() => {
  const map = new Map();

  lahan.forEach((item) => {
    map.set(String(item.id), item);
    map.set(Number(item.id), item);
  });

  return map;
}, [lahan]);

  const petaniFromLahanOptions = useMemo(() => {
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
        });
      }
    });

    return Array.from(map.values());
  }, [lahan]);

  const normalizedData = useMemo(() => {
    return catatan.map((item) => {
  const lahanItem =
  lahanMap.get(String(item.lahan_id)) ||
  lahanMap.get(Number(item.lahan_id)) ||
  {};

      return {
        id: item.id,
        judul: item.judul || item.kategori || "Catatan",
        isi: item.isi || "",
        kategori: item.kategori || "Lainnya",
        status: item.status || "Menunggu",

        lahan_id: item.lahan_id || null,
        nama_lahan: item.nama_lahan || lahanItem.nama_lahan || "-",

        petani_id:
          item.petani_id || lahanItem.petani_id || lahanItem.user_id || null,

        nama_petani:
          item.nama_petani ||
          lahanItem.nama_petani ||
          lahanItem.nama ||
          "Petani",

        nama_desa: item.nama_desa || lahanItem.nama_desa || "-",
        nama_kecamatan:
          item.nama_kecamatan || lahanItem.nama_kecamatan || "-",

        lat: safeNumber(item.lat || lahanItem.lat, NaN),
        lng: safeNumber(item.lng || lahanItem.lng, NaN),

        tindak_lanjut: item.tindak_lanjut || "",
        tanggal_tindak_lanjut: item.tanggal_tindak_lanjut || "",
        foto_url: item.foto_url || "",

        created_at: item.created_at || null,
        updated_at: item.updated_at || null,
      };
    });
  }, [catatan, lahanMap]);

  const filteredData = useMemo(() => {
    return normalizedData.filter((item) => {
      const createdKey = toDateInput(item.created_at);

      const matchKec =
        selectedKec === "all" || item.nama_kecamatan === selectedKec;

      const matchDesa =
        selectedDesa === "all" || item.nama_desa === selectedDesa;

      const matchPetani =
        selectedPetani === "all" ||
        String(item.petani_id) === String(selectedPetani);

      const matchStatus =
        selectedStatus === "all" ||
        statusMeta(item.status).label === selectedStatus;

      const matchDate =
        !createdKey ||
        ((!startDate || createdKey >= startDate) &&
          (!endDate || createdKey <= endDate));

      return matchKec && matchDesa && matchPetani && matchStatus && matchDate;
    });
  }, [
    normalizedData,
    selectedKec,
    selectedDesa,
    selectedPetani,
    selectedStatus,
    startDate,
    endDate,
  ]);

  const kecamatanOptions = useMemo(() => {
    const fromCatatan = normalizedData
      .map((item) => item.nama_kecamatan)
      .filter((item) => item && item !== "-");

    const fromLahan = lahan
      .map((item) => item.nama_kecamatan || item.kecamatan)
      .filter((item) => item && item !== "-");

    return Array.from(new Set([...fromCatatan, ...fromLahan]));
  }, [normalizedData, lahan]);

  const desaOptions = useMemo(() => {
    const fromCatatan = normalizedData
      .filter((item) =>
        selectedKec === "all" ? true : item.nama_kecamatan === selectedKec
      )
      .map((item) => item.nama_desa)
      .filter((item) => item && item !== "-");

    const fromLahan = lahan
      .filter((item) => {
        if (selectedKec === "all") return true;
        return (item.nama_kecamatan || item.kecamatan) === selectedKec;
      })
      .map((item) => item.nama_desa || item.desa)
      .filter((item) => item && item !== "-");

    return Array.from(new Set([...fromCatatan, ...fromLahan]));
  }, [normalizedData, lahan, selectedKec]);

  const petaniOptions = useMemo(() => {
    const map = new Map();

    petaniFromLahanOptions.forEach((item) => {
      if (!item.id) return;

      if (!map.has(String(item.id))) {
        map.set(String(item.id), {
          id: item.id,
          nama_petani: item.nama_petani,
        });
      }
    });

    normalizedData.forEach((item) => {
      if (!item.petani_id) return;

      if (!map.has(String(item.petani_id))) {
        map.set(String(item.petani_id), {
          id: item.petani_id,
          nama_petani: item.nama_petani,
        });
      }
    });

    return Array.from(map.values());
  }, [normalizedData, petaniFromLahanOptions]);

  const topicData = useMemo(() => {
    const map = new Map();

    filteredData.forEach((item) => {
      const meta = topicMeta(item.kategori);

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
  }, [filteredData]);

  const trendData = useMemo(() => {
    const months = [
      { key: "2026-01", label: "Jan 2026" },
      { key: "2026-02", label: "Feb 2026" },
      { key: "2026-03", label: "Mar 2026" },
      { key: "2026-04", label: "Apr 2026" },
      { key: "2026-05", label: "Mei 2026" },
      { key: "2026-06", label: "Jun 2026" },
    ];

    return months.map((month) => ({
      bulan: month.label,
      jumlah: normalizedData.filter((item) =>
        toDateInput(item.created_at).startsWith(month.key)
      ).length,
    }));
  }, [normalizedData]);

  const latestNotes = useMemo(() => {
    return [...normalizedData]
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 5);
  }, [normalizedData]);

 const mapItems = useMemo(() => {
  return filteredData
    .map((item, index) => {
      // ambil lahan dari map
      const lahanItem =
        lahanMap.get(String(item.lahan_id)) ||
        lahanMap.get(Number(item.lahan_id));

      const lat = safeNumber(
        item.lat ||
        lahanItem?.lat ||
        NaN
      );

      const lng = safeNumber(
        item.lng ||
        lahanItem?.lng ||
        NaN
      );

      // kalau tidak ada koordinat, skip
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
      }

      return {
        ...item,
        lat,
        lng,
        markerNumber: index + 1,
      };
    })
    .filter(Boolean);
}, [filteredData, lahanMap]);

  const mapCenter =
    mapItems.length > 0 ? [mapItems[0].lat, mapItems[0].lng] : DEFAULT_CENTER;

  const totalCatatan = filteredData.length;

  const kunjunganLapangan = filteredData.filter(
    (item) => item.lahan_id
  ).length;

  const tindakLanjut = filteredData.filter((item) =>
    ["Ditindaklanjuti", "Selesai"].includes(statusMeta(item.status).label)
  ).length;

  const menunggu = filteredData.filter(
    (item) => statusMeta(item.status).label === "Menunggu"
  ).length;

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
    setAnalysisResult(null);
    setForm({
      ...INITIAL_FORM,
      ...prefill,
    });
    setModalMode("create");
  };

  const openDetail = (item) => {
    setSelectedItem(item);
    setAnalysisResult(null);
    setModalMode("detail");
  };

  const openEdit = (item) => {
    setSelectedItem(item);
    setAnalysisResult(null);

    setForm({
      judul: item.judul || "",
      isi: item.isi || "",
      kategori: topicMeta(item.kategori).label,
      petani_id: item.petani_id || "",
      lahan_id: item.lahan_id || "",
      status: statusMeta(item.status).label,
      tindak_lanjut: item.tindak_lanjut || "",
      tanggal_tindak_lanjut: toDateInput(item.tanggal_tindak_lanjut),
      foto_url: item.foto_url || "",
      kirim_notifikasi: false,
    });

    setModalMode("edit");
  };

  const closeModal = () => {
    if (saving || uploading) return;

    setSelectedItem(null);
    setAnalysisResult(null);
    setModalMode("");
    resetForm();
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === "checkbox") {
      setForm((prev) => ({
        ...prev,
        [name]: checked,
      }));

      return;
    }

    if (name === "petani_id") {
      setForm((prev) => ({
        ...prev,
        petani_id: value,
        lahan_id: "",
      }));

      return;
    }

    if (name === "lahan_id") {
      const selectedLahan = lahan.find(
        (item) => String(item.id) === String(value)
      );

      setForm((prev) => ({
        ...prev,
        lahan_id: value,
        petani_id:
          selectedLahan?.petani_id ||
          selectedLahan?.user_id ||
          prev.petani_id,
      }));

      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await api.post(
      "/penyuluh/catatan/upload",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return res.data?.data?.file_url || "";
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    try {
      setUploading(true);

      const fileUrl = await uploadFile(file);

      if (!fileUrl) {
        alert("Upload berhasil, tetapi file_url tidak diterima dari backend.");
        return;
      }

      if (!modalMode) {
        openCreate({
          judul: "Dokumentasi lapangan",
          foto_url: fileUrl,
        });
      } else {
        setForm((prev) => ({
          ...prev,
          foto_url: fileUrl,
        }));
      }

      alert("Dokumentasi berhasil diupload. Simpan catatan agar foto tersimpan.");
    } catch (err) {
      console.log("UPLOAD ERROR:", err.response?.data || err.message);
      alert("Gagal upload dokumentasi.");
    } finally {
      setUploading(false);

      if (e.target) {
        e.target.value = "";
      }
    }
  };

  const buildPayload = () => ({
    judul: form.judul,
    isi: form.isi,
    kategori: form.kategori,
    petani_id: form.petani_id || null,
    lahan_id: form.lahan_id ? Number(form.lahan_id) : null,
    status: form.status,
    tindak_lanjut: form.tindak_lanjut || null,
    tanggal_tindak_lanjut: form.tanggal_tindak_lanjut || null,
    foto_url: form.foto_url || null,
    kirim_notifikasi: Boolean(form.kirim_notifikasi),
    dikirim_oleh: currentUser?.nama || "Penyuluh",
    penyuluh_id: currentUser?.id || localStorage.getItem("user_id") || null,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.judul.trim()) {
      alert("Judul catatan wajib diisi.");
      return;
    }

    if (!form.petani_id) {
      alert("Petani wajib dipilih.");
      return;
    }

    if (!form.lahan_id) {
      alert("Lahan wajib dipilih agar lokasi dan marker peta muncul.");
      return;
    }

    if (!form.isi.trim()) {
      alert("Isi catatan wajib diisi.");
      return;
    }

    try {
      setSaving(true);

      const payload = buildPayload();

      if (modalMode === "create") {
        await api.post("/penyuluh/catatan", payload);
        setEndDate(getTodayInput());
        alert("Catatan berhasil ditambahkan.");
      }

      if (modalMode === "edit" && selectedItem?.id) {
        await api.put(
          `/penyuluh/catatan/${selectedItem.id}`,
          payload
        );
        setEndDate(getTodayInput());
        alert("Catatan berhasil diperbarui.");
      }

      closeModal();
      fetchData();
    } catch (err) {
      console.log("SAVE CATATAN ERROR:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Gagal menyimpan catatan.");
    } finally {
      setSaving(false);
    }
  };

  const handleAI = async (item) => {
    try {
      if (!item) {
        setAnalysisResult({
          status: "error",
          kategori: "Tidak tersedia",
          prioritas: "-",
          ringkasan: "Data catatan tidak ditemukan.",
          rekomendasi: "Pilih catatan yang valid terlebih dahulu.",
          tindakan: [],
          metode: "Tidak tersedia",
        });
        return;
      }

      setAnalysisLoading(true);
      setAnalysisResult(null);

      const payloadCatatan = {
        judul: item?.judul || "",
        kategori: topicMeta(item?.kategori).label || item?.kategori || "Lainnya",
        isi: item?.isi || "",
        status: statusMeta(item?.status).label || item?.status || "Menunggu",
        tindak_lanjut: item?.tindak_lanjut || "",
      };

      const hasContent = [
        payloadCatatan.judul,
        payloadCatatan.kategori,
        payloadCatatan.isi,
        payloadCatatan.tindak_lanjut,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      if (!hasContent) {
        setAnalysisResult({
          status: "error",
          kategori: "Tidak tersedia",
          prioritas: "-",
          ringkasan: "Catatan belum memiliki teks untuk dianalisis.",
          rekomendasi: "Lengkapi judul, topik, isi catatan, atau tindak lanjut.",
          tindakan: [],
          metode: "Tidak tersedia",
        });
        return;
      }

      if (!FASTAPI) {
        throw new Error(
          "Layanan FastAPI belum dikonfigurasi. Isi VITE_FASTAPI_URL setelah FastAPI di-deploy."
        );
      }

      const res = await axios.post(
        `${FASTAPI}/ai/analisis-catatan`,
        payloadCatatan
      );

      const payload = res.data || {};

      setAnalysisResult({
        status: payload.status || "success",
        kategori: payload.kategori_ai || payload.kategori || "Lainnya",
        prioritas: payload.prioritas || "Rendah",
        ringkasan:
          payload.ringkasan ||
          payload.message ||
          "Catatan berhasil dianalisis oleh sistem.",
        rekomendasi:
          payload.rekomendasi ||
          "Lakukan pemantauan lanjutan sesuai kondisi lapangan.",
        tindakan: Array.isArray(payload.tindakan) ? payload.tindakan : [],
        sumberKategori: payload.sumber_kategori || "-",
        metode: payload.metode || "Topic-First Rule-Based Text Analysis",
      });
    } catch (err) {
      console.log("ANALISIS CATATAN ERROR:", err.response?.data || err.message);

      setAnalysisResult({
        status: "error",
        kategori: "Tidak tersedia",
        prioritas: "-",
        ringkasan:
          "Analisis catatan belum dapat dijalankan karena FastAPI belum aktif atau endpoint /ai/analisis-catatan belum tersedia.",
        rekomendasi:
          "Pastikan VITE_FASTAPI_URL telah diisi dan endpoint /ai/analisis-catatan tersedia.",
        tindakan: [],
        metode: "Tidak tersedia",
      });
    } finally {
      setAnalysisLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>📝 Riwayat Catatan Lapangan</h1>
          <p style={styles.subtitle}>
            Dokumentasi dan analisis kondisi lahan serta aktivitas penyuluhan
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

          <button style={styles.userBox}>
            👨‍🌾 <strong>{currentUser?.nama || "Penyuluh"}</strong>
          </button>
        </div>
      </div>

      <div style={styles.filterCard}>
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
          value={selectedPetani}
          onChange={(e) => setSelectedPetani(e.target.value)}
        >
          <option value="all">Semua Petani</option>
          {petaniOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.nama_petani}
            </option>
          ))}
        </select>

        <select
          style={styles.select}
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        >
          <option value="all">Semua Status</option>
          {STATUS_OPTIONS.map((item) => (
            <option key={item} value={item}>
              {item}
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
          type="button"
          style={styles.filterBtn}
          onClick={setFilterTerbaru}
        >
          Terbaru
        </button>

        <button
          type="button"
          style={styles.filterBtn}
          onClick={resetFilterTanggal}
        >
          Semua Data
        </button>

        <button style={styles.addBtn} onClick={() => openCreate()}>
          + Tambah Catatan
        </button>
      </div>

      <div style={styles.contentGrid}>
        <div style={styles.leftStack}>
        <div style={styles.kpiGrid}>
          <KpiCard
            title="Total Catatan"
            value={totalCatatan}
            desc="Catatan"
            icon="📋"
            color="#16a34a"
            bg="#dcfce7"
          />

          <KpiCard
            title="Kunjungan Lapangan"
            value={kunjunganLapangan}
            desc="Catatan yang terhubung ke lahan"
            icon="📍"
            color="#2563eb"
            bg="#dbeafe"
          />

          <KpiCard
            title="Tindak Lanjut"
            value={tindakLanjut}
            desc="Ditindaklanjuti / selesai"
            icon="🗓️"
            color="#f97316"
            bg="#ffedd5"
          />

          <KpiCard
            title="Menunggu Tindak Lanjut"
            value={menunggu}
            desc="Perlu perhatian"
            icon="🕘"
            color="#d97706"
            bg="#fef3c7"
          />
        </div>

        <section style={styles.tableCard}>
          <h3 style={styles.cardTitle}>Daftar Catatan Lapangan</h3>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Tanggal</th>
                  <th style={styles.th}>Petani</th>
                  <th style={styles.th}>Lokasi</th>
                  <th style={styles.th}>Topik</th>
                  <th style={styles.th}>Ringkasan Catatan</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Tindak Lanjut</th>
                  <th style={styles.th}>Dok</th>
                  <th style={styles.th}>Aksi</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="9" style={styles.emptyTd}>
                      Memuat catatan lapangan...
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={styles.emptyTd}>
                      Belum ada catatan sesuai filter.
                    </td>
                  </tr>
                ) : (
                  filteredData.slice(0, 8).map((item) => {
                    const meta = topicMeta(item.kategori);
                    const status = statusMeta(item.status);

                    return (
                      <tr key={item.id}>
                        <td style={styles.td}>
                          <div style={styles.dateCell}>
                            <span style={{ background: meta.color }}></span>
                            <div>
                              <strong>{formatDate(item.created_at)}</strong>
                              <small>{formatTime(item.created_at)}</small>
                            </div>
                          </div>
                        </td>

                        <td style={styles.td}>
                          <strong>{item.nama_petani}</strong>
                          <small style={styles.smallText}>
                            {item.petani_id ? `ID ${item.petani_id}` : "-"}
                          </small>
                        </td>

                        <td style={styles.td}>
                          <strong>{item.nama_desa}</strong>
                          <small style={styles.smallText}>
                            Kec. {item.nama_kecamatan}
                          </small>
                        </td>

                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.topicBadge,
                              color: meta.color,
                              background: meta.bg,
                            }}
                          >
                            {meta.label}
                          </span>
                        </td>

                        <td style={styles.td}>
                          <div style={styles.noteText}>{item.isi}</div>
                        </td>

                        <td style={styles.td}>
                          <span
                            style={{
                              ...styles.statusBadge,
                              color: status.color,
                              background: status.bg,
                            }}
                          >
                            {status.label}
                          </span>
                        </td>

                        <td style={styles.td}>
                          {item.tanggal_tindak_lanjut ? (
                            <strong>
                              {formatDate(item.tanggal_tindak_lanjut)}
                            </strong>
                          ) : item.tindak_lanjut ? (
                            <small>{item.tindak_lanjut}</small>
                          ) : (
                            "-"
                          )}
                        </td>

                        <td style={styles.td}>
                          {item.foto_url ? (
                            <span style={styles.docBadge}>📷 Ada</span>
                          ) : (
                            "-"
                          )}
                        </td>

                        <td style={styles.td}>
                          <div style={styles.actionGroup}>
                            <button
                              style={styles.iconBtn}
                              onClick={() => openDetail(item)}
                              title="Lihat"
                            >
                              👁️
                            </button>

                            <button
                              style={styles.iconBtn}
                              onClick={() => openEdit(item)}
                              title="Edit"
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
          </div>

          <div style={styles.tableFooter}>
            Menampilkan {filteredData.length > 0 ? 1 : 0} - {Math.min(filteredData.length, 8)} dari{" "}
            {filteredData.length} catatan
          </div>
        </section>

        <div style={styles.chartGrid}>
          <section style={styles.chartCard}>
            <h3 style={styles.cardTitle}>Rekapitulasi Topik Catatan</h3>

            <div style={styles.pieWrap}>
              <ResponsiveContainer width="45%" height={230}>
                <PieChart>
                  <Pie
                    data={topicData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {topicData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>

              <div style={styles.legendList}>
                {topicData.length === 0 ? (
                  <div style={styles.emptyBox}>Belum ada data topik.</div>
                ) : (
                  topicData.map((item) => (
                    <div key={item.name} style={styles.legendItem}>
                      <span style={{ background: item.color }}></span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.value} (
                        {totalCatatan > 0
                          ? ((item.value / totalCatatan) * 100).toFixed(1)
                          : 0}
                        %)
                      </small>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section style={styles.chartCard}>
            <h3 style={styles.cardTitle}>Tren Catatan (6 Bulan Terakhir)</h3>

            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bulan" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="jumlah"
                  stroke="#16a34a"
                  strokeWidth={3}
                  dot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </section>
        </div>

        </div>

        <aside style={styles.rightStack}>
        <section style={styles.mapCard}>
          <h3 style={styles.cardTitle}>Lokasi Catatan (Peta)</h3>

          <div style={styles.mapBox}>
            <MapContainer center={mapCenter} zoom={10} style={styles.map}>
              <FitMapBounds items={mapItems} />

              <TileLayer
                attribution="© OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {mapItems.map((item) => {
                const meta = topicMeta(item.kategori);

                return (
                  <Marker
                    key={item.id}
                    position={[item.lat, item.lng]}
                    icon={makeMarkerIcon(meta.color, item.markerNumber)}
                  >
                    <Popup>
                      <div style={{ minWidth: 180 }}>
                        <strong>{item.nama_lahan || item.judul}</strong>

                        <p style={{ margin: "6px 0 0" }}>
                          👨‍🌾 {item.nama_petani}
                        </p>

                        <p style={{ margin: "4px 0 0" }}>
                          📍 {item.nama_desa}, {item.nama_kecamatan}
                        </p>

                        <p style={{ margin: "4px 0 0" }}>
                          📝 {item.judul}
                        </p>

                        <p style={{ margin: "4px 0 0" }}>
                          Topik: <b>{topicMeta(item.kategori).label}</b>
                        </p>

                        <p style={{ margin: "4px 0 0" }}>
                          Status: <b>{statusMeta(item.status).label}</b>
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>

            {mapItems.length === 0 && (
              <div style={styles.mapEmpty}>
                Belum ada marker. Pilih lahan saat membuat catatan atau pastikan
                data lat/lng lahan sudah ada.
              </div>
            )}

            <button style={styles.mapBtn} onClick={() => navigate("/penyuluh/peta")}>
              Lihat Peta Lengkap →
            </button>
          </div>
        </section>

          <section style={styles.sideCard}>
            <div style={styles.cardTitleRow}>
              <h3 style={styles.cardTitle}>Catatan Terbaru</h3>
              <button style={styles.smallBtn}>Lihat Semua</button>
            </div>

            <div style={styles.latestList}>
              {latestNotes.length === 0 ? (
                <div style={styles.emptyBox}>Belum ada catatan terbaru.</div>
              ) : (
                latestNotes.map((item) => {
                  const meta = topicMeta(item.kategori);

                  return (
                    <div key={item.id} style={styles.latestItem}>
                      <span
                        style={{
                          ...styles.latestIcon,
                          color: meta.color,
                          background: meta.bg,
                        }}
                      >
                        {meta.icon}
                      </span>

                      <div style={{ minWidth: 0 }}>
                        <strong style={styles.latestTitle}>
                          {item.judul}
                        </strong>

                        <small style={styles.latestMeta}>
                          {item.nama_petani} •{" "}
                          {formatTime(item.created_at) ||
                            formatDate(item.created_at)}
                        </small>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section style={styles.sideCard}>
            <h3 style={styles.cardTitle}>Upload Dokumentasi</h3>

            <div
              style={styles.uploadBox}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleUpload}
              />

              <div style={styles.uploadIcon}>☁️</div>

              <strong>
                {uploading ? "Mengupload..." : "Drag & drop foto di sini"}
              </strong>

              <small>
                Foto akan masuk ke form catatan, lalu muncul di detail catatan
                setelah disimpan
              </small>

              <button style={styles.uploadBtn} disabled={uploading}>
                {uploading ? "Upload..." : "Pilih File"}
              </button>
            </div>
          </section>
        </aside>
      </div>


      {modalMode && (
        <CatatanModal
          mode={modalMode}
          form={form}
          item={selectedItem}
          lahan={lahan}
          petaniOptions={petaniFromLahanOptions}
          saving={saving}
          uploading={uploading}
          analysisResult={analysisResult}
          analysisLoading={analysisLoading}
          onChange={handleChange}
          onClose={closeModal}
          onSubmit={handleSubmit}
          onAI={handleAI}
          onUpload={handleUpload}
        />
      )}
    </div>
  );
}

function CatatanModal({
  mode,
  form,
  item,
  lahan,
  petaniOptions,
  saving,
  uploading,
  analysisResult,
  analysisLoading,
  onChange,
  onClose,
  onSubmit,
  onAI,
  onUpload,
}) {
  const isDetail = mode === "detail";

  const filteredLahanOptions = safeList(lahan).filter((item) => {
    if (!form.petani_id) return false;

    const petaniId = item.petani_id || item.user_id;

    return String(petaniId) === String(form.petani_id);
  });

  return (
    <div style={styles.modalBackdrop}>
      <div style={styles.modalCard}>
        <div style={styles.modalHeader}>
          <h2>
            {mode === "create"
              ? "Tambah Catatan Lapangan"
              : mode === "edit"
              ? "Edit Catatan Lapangan"
              : "Detail Catatan Lapangan"}
          </h2>

          <button style={styles.modalClose} onClick={onClose}>
            ×
          </button>
        </div>

        {isDetail ? (
          <>
            <div style={styles.detailGrid}>
              <Info label="Judul" value={item?.judul} />
              <Info label="Topik" value={topicMeta(item?.kategori).label} />
              <Info label="Petani" value={item?.nama_petani} />
              <Info label="Lahan" value={item?.nama_lahan} />
              <Info label="Desa" value={item?.nama_desa} />
              <Info label="Kecamatan" value={item?.nama_kecamatan} />
              <Info label="Status" value={statusMeta(item?.status).label} />
              <Info label="Tanggal" value={formatDate(item?.created_at)} />
            </div>

            <div style={styles.detailBox}>
              <strong>Isi Catatan</strong>
              <p>{item?.isi}</p>
            </div>

            {item?.tindak_lanjut && (
              <div style={styles.detailBox}>
                <strong>Rencana Tindak Lanjut</strong>
                <p>{item.tindak_lanjut}</p>
              </div>
            )}

            {item?.foto_url && (
              <div style={styles.detailBox}>
                <strong>Dokumentasi</strong>

                <img
                  src={getFileUrl(item.foto_url)}
                  alt="Dokumentasi catatan"
                  style={styles.detailImage}
                />
              </div>
            )}

            {analysisResult && (
              <div style={styles.analysisCard}>
                <div style={styles.analysisHeader}>
                  <div>
                    <strong>Hasil Analisis Catatan</strong>
                    <small>{analysisResult.metode || "Rule-Based Text Analysis"}</small>
                  </div>

                  <span
                    style={{
                      ...styles.analysisBadge,
                      background:
                        analysisResult.prioritas === "Tinggi"
                          ? "#fee2e2"
                          : analysisResult.prioritas === "Sedang"
                          ? "#ffedd5"
                          : "#dcfce7",
                      color:
                        analysisResult.prioritas === "Tinggi"
                          ? "#b91c1c"
                          : analysisResult.prioritas === "Sedang"
                          ? "#c2410c"
                          : "#047857",
                    }}
                  >
                    {analysisResult.prioritas}
                  </span>
                </div>

                <div style={styles.analysisGrid}>
                  <Info label="Kategori" value={analysisResult.kategori} />
                  <Info label="Prioritas" value={analysisResult.prioritas} />
                </div>

                <div style={styles.analysisText}>
                  <strong>Ringkasan</strong>
                  <p>{analysisResult.ringkasan}</p>
                </div>

                <div style={styles.analysisText}>
                  <strong>Rekomendasi Awal</strong>
                  <p>{analysisResult.rekomendasi}</p>
                </div>

                {Array.isArray(analysisResult.tindakan) &&
                  analysisResult.tindakan.length > 0 && (
                    <div style={styles.analysisText}>
                      <strong>Langkah Tindak Lanjut</strong>
                      <ul style={styles.analysisList}>
                        {analysisResult.tindakan.map((step, index) => (
                          <li key={`${step}-${index}`}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            )}

            <div style={styles.modalActions}>
              <button
                style={styles.aiBtn}
                onClick={() => onAI(item)}
                disabled={analysisLoading}
              >
                {analysisLoading ? "Menganalisis..." : "Analisis Catatan"}
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
                Judul
                <input
                  name="judul"
                  value={form.judul}
                  onChange={onChange}
                  style={styles.input}
                  placeholder="Contoh: Pemupukan Urea untuk sawah timur"
                />
              </label>

              <label style={styles.formGroup}>
                Petani
                <select
                  name="petani_id"
                  value={form.petani_id}
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
                Lahan
                <select
                  name="lahan_id"
                  value={form.lahan_id}
                  onChange={onChange}
                  style={styles.input}
                  disabled={!form.petani_id}
                >
                  <option value="">
                    {form.petani_id ? "Pilih Lahan" : "Pilih petani dulu"}
                  </option>

                  {filteredLahanOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nama_lahan || `Lahan ${item.id}`}
                    </option>
                  ))}
                </select>
              </label>

              <label style={styles.formGroup}>
                Topik
                <select
                  name="kategori"
                  value={form.kategori}
                  onChange={onChange}
                  style={styles.input}
                >
                  {TOPIK_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
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
                  {STATUS_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label style={styles.formGroup}>
                Tanggal Tindak Lanjut
                <input
                  type="date"
                  name="tanggal_tindak_lanjut"
                  value={form.tanggal_tindak_lanjut}
                  onChange={onChange}
                  style={styles.input}
                />
              </label>

              <label style={styles.checkboxGroup}>
                <input
                  type="checkbox"
                  name="kirim_notifikasi"
                  checked={Boolean(form.kirim_notifikasi)}
                  onChange={onChange}
                />

                <span>
                  <strong>Kirim notifikasi ke petani</strong>
                  <small>
                    Jika dicentang, catatan ini juga dikirim sebagai notifikasi
                    kepada petani terkait.
                  </small>
                </span>
              </label>

              <label style={styles.formGroup}>
                Dokumentasi
                <input
                  type="file"
                  accept="image/*"
                  onChange={onUpload}
                  disabled={uploading}
                />
              </label>
            </div>

            {form.foto_url && (
              <div style={styles.previewBox}>
                <strong>Preview Dokumentasi</strong>

                <img
                  src={getFileUrl(form.foto_url)}
                  alt="Preview dokumentasi"
                  style={styles.previewImage}
                />

                <small>Foto ini akan tersimpan setelah catatan disimpan.</small>
              </div>
            )}

            <label style={styles.formGroup}>
              Isi Catatan
              <textarea
                name="isi"
                value={form.isi}
                onChange={onChange}
                style={styles.textarea}
                placeholder="Tulis kondisi lahan, rekomendasi, hama, pupuk, atau hasil monitoring..."
              />
            </label>

            <label style={styles.formGroup}>
              Rencana Tindak Lanjut
              <textarea
                name="tindak_lanjut"
                value={form.tindak_lanjut}
                onChange={onChange}
                style={styles.textareaSmall}
                placeholder="Contoh: Jadwalkan kunjungan ulang 3 hari lagi."
              />
            </label>

            <div style={styles.modalActions}>
              <button style={styles.greenBtn} disabled={saving || uploading}>
                {saving ? "Menyimpan..." : "Simpan Catatan"}
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
        <h4>{title}</h4>
        <strong style={{ color }}>{value}</strong>
        <small>{desc}</small>
      </div>

      <span style={{ ...styles.kpiIcon, color, background: bg }}>{icon}</span>
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
    fontSize: 28,
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
    height: 42,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "0 16px",
    display: "flex",
    alignItems: "center",
    fontWeight: 900,
  },

  weatherBox: {
    height: 42,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "0 14px",
    display: "flex",
    alignItems: "center",
    gap: 9,
  },

  userBox: {
    height: 42,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "0 14px",
    display: "flex",
    alignItems: "center",
    gap: 9,
    fontWeight: 900,
  },

  filterCard: {
    display: "grid",
    gridTemplateColumns: "160px 160px 160px 160px 240px 110px 120px 150px",
    gap: 12,
    marginBottom: 22,
    alignItems: "center",
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

  dateRange: {
    height: 44,
    background: "#ffffff",
    border: "1px solid #d1d5db",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "0 10px",
  },

  addBtn: {
    height: 44,
    border: "none",
    borderRadius: 10,
    background: "#16a34a",
    color: "#ffffff",
    fontWeight: 950,
    cursor: "pointer",
  },

  filterBtn: {
    height: 44,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 900,
    cursor: "pointer",
  },

  contentGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 420px",
    gap: 18,
    marginBottom: 18,
    alignItems: "start",
  },

  leftStack: {
    display: "grid",
    gap: 18,
    minWidth: 0,
    alignContent: "start",
  },

  rightStack: {
    display: "grid",
    gap: 18,
    minWidth: 0,
    alignContent: "start",
  },

  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 16,
    alignSelf: "start",
    alignItems: "start",
  },

  kpiCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    minHeight: 112,
    boxShadow: "0 10px 25px rgba(15,23,42,.06)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  kpiIcon: {
    width: 58,
    height: 58,
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 28,
  },

  mapCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 10px 25px rgba(15,23,42,.06)",
  },

  mapBox: {
    height: 260,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    border: "1px solid #e5e7eb",
  },

  map: {
    width: "100%",
    height: "100%",
  },

  mapEmpty: {
    position: "absolute",
    inset: 0,
    zIndex: 450,
    background: "rgba(255,255,255,.78)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    textAlign: "center",
    fontWeight: 900,
    color: "#475569",
  },

  mapBtn: {
    position: "absolute",
    right: 16,
    bottom: 16,
    zIndex: 500,
    height: 34,
    border: "none",
    borderRadius: 9,
    background: "#ffffff",
    color: "#047857",
    fontWeight: 900,
    padding: "0 14px",
    cursor: "pointer",
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 420px",
    gap: 18,
  },

  tableCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 10px 25px rgba(15,23,42,.06)",
  },

  sideStack: {
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

  cardTitle: {
    margin: "0 0 14px",
    fontSize: 18,
    fontWeight: 950,
  },

  cardTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
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
    padding: "12px 10px",
    borderBottom: "1px solid #e5e7eb",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  td: {
    padding: "12px 10px",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "middle",
  },

  dateCell: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  smallText: {
    display: "block",
    color: "#64748b",
    fontSize: 12,
    marginTop: 3,
  },

  topicBadge: {
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
  },

  statusBadge: {
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
  },

  docBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "5px 8px",
    borderRadius: 999,
    background: "#e0f2fe",
    color: "#0369a1",
    fontSize: 12,
    fontWeight: 900,
  },

  noteText: {
    maxWidth: 320,
    lineHeight: 1.45,
  },

  actionGroup: {
    display: "flex",
    gap: 8,
  },

  iconBtn: {
    width: 32,
    height: 32,
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    background: "#ffffff",
    cursor: "pointer",
  },

  iconBtnDanger: {
    width: 32,
    height: 32,
    border: "1px solid #fecaca",
    borderRadius: 8,
    background: "#ffffff",
    cursor: "pointer",
  },

  emptyTd: {
    textAlign: "center",
    padding: 26,
    color: "#64748b",
    fontWeight: 800,
  },

  tableFooter: {
    paddingTop: 14,
    color: "#64748b",
    fontSize: 13,
  },

  latestList: {
    display: "grid",
    gap: 14,
  },

  latestItem: {
    display: "grid",
    gridTemplateColumns: "38px 1fr",
    gap: 12,
    alignItems: "center",
  },

  latestIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  latestTitle: {
    display: "block",
    fontSize: 13,
    fontWeight: 900,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  latestMeta: {
    display: "block",
    marginTop: 4,
    color: "#64748b",
    fontSize: 12,
  },

  uploadBox: {
    minHeight: 170,
    border: "1px dashed #cbd5e1",
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    textAlign: "center",
    padding: 18,
    cursor: "pointer",
  },

  uploadIcon: {
    fontSize: 34,
  },

  uploadBtn: {
    marginTop: 10,
    border: "none",
    background: "#16a34a",
    color: "#ffffff",
    borderRadius: 9,
    height: 36,
    padding: "0 16px",
    fontWeight: 900,
    cursor: "pointer",
  },

  chartGrid: {
    display: "grid",
    gridTemplateColumns: "360px minmax(0, 1fr)",
    gap: 18,
    marginTop: 0,
    alignItems: "stretch",
  },

  chartCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 10px 25px rgba(15,23,42,.06)",
    minHeight: 300,
  },

  pieWrap: {
    display: "flex",
    alignItems: "center",
    gap: 20,
  },

  legendList: {
    flex: 1,
    display: "grid",
    gap: 10,
  },

  legendItem: {
    display: "grid",
    gridTemplateColumns: "14px 1fr auto",
    gap: 8,
    alignItems: "center",
    fontSize: 13,
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
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    overflow: "hidden",
  },

  modalCard: {
    width: "min(760px, 100%)",
    maxHeight: "calc(100vh - 56px)",
    background: "#ffffff",
    borderRadius: 18,
    padding: 22,
    boxShadow: "0 30px 70px rgba(15,23,42,.28)",
    overflowY: "auto",
    overflowX: "hidden",
    position: "relative",
  },

  modalHeader: {
    position: "sticky",
    top: -22,
    zIndex: 20,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
    padding: "22px 0 14px",
    background: "#ffffff",
    borderBottom: "1px solid #f1f5f9",
  },

  modalClose: {
    width: 36,
    height: 36,
    minWidth: 36,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    background: "#ffffff",
    fontSize: 24,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 8px 18px rgba(15,23,42,.08)",
  },

  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
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

  detailImage: {
    width: "100%",
    maxHeight: 240,
    objectFit: "contain",
    borderRadius: 12,
    marginTop: 10,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
  },

  analysisCard: {
    marginTop: 14,
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    borderRadius: 14,
    padding: 14,
    display: "grid",
    gap: 12,
  },

  analysisHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },

  analysisBadge: {
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  analysisGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 12,
  },

  analysisText: {
    background: "#ffffff",
    border: "1px solid #dbeafe",
    borderRadius: 12,
    padding: 12,
    lineHeight: 1.55,
  },

  analysisList: {
    margin: "8px 0 0",
    paddingLeft: 18,
    display: "grid",
    gap: 6,
  },

  previewBox: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    display: "grid",
    gap: 8,
  },

  previewImage: {
    width: "100%",
    maxHeight: 220,
    objectFit: "contain",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
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

  checkboxGroup: {
    minHeight: 44,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "10px 12px",
    display: "grid",
    gridTemplateColumns: "18px 1fr",
    alignItems: "start",
    gap: 10,
    fontWeight: 900,
    fontSize: 13,
    background: "#ffffff",
    cursor: "pointer",
  },

  checkboxText: {
    display: "grid",
    gap: 4,
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
    resize: "vertical",
    fontFamily: "inherit",
    outline: "none",
  },

  textareaSmall: {
    minHeight: 80,
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

  aiBtn: {
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