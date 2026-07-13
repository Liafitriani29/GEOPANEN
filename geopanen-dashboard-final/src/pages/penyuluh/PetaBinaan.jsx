import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  CircleMarker,
  useMap,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER = [-7.68, 110.85];

// Penyuluh hanya memantau petani/lahan binaan.
// Penambahan, edit, dan hapus data master dilakukan oleh Admin atau Petani.
const CAN_MANAGE_BINAAN = false;

const STATUS_STYLE = {
  sehat: {
    label: "Sehat",
    color: "#16a34a",
    bg: "#dcfce7",
    text: "#047857",
  },
  baik: {
    label: "Baik",
    color: "#16a34a",
    bg: "#dcfce7",
    text: "#047857",
  },
  waspada: {
    label: "Waspada",
    color: "#f59e0b",
    bg: "#fef3c7",
    text: "#b45309",
  },
  perhatian: {
    label: "Perlu Perhatian",
    color: "#f59e0b",
    bg: "#fef3c7",
    text: "#b45309",
  },
  kritis: {
    label: "Kritis",
    color: "#ef4444",
    bg: "#fee2e2",
    text: "#b91c1c",
  },
  rendah: {
    label: "Rendah",
    color: "#ef4444",
    bg: "#fee2e2",
    text: "#b91c1c",
  },
  default: {
    label: "Dipantau",
    color: "#3b82f6",
    bg: "#dbeafe",
    text: "#1d4ed8",
  },
};

const REGION_COLORS = [
  "#16a34a",
  "#f59e0b",
  "#2563eb",
  "#f43f5e",
  "#8b5cf6",
  "#14b8a6",
];

const emptyForm = {
  id: "",
  petani_id: "",
  nama_petani: "",
  nama_lahan: "",
  nama_desa: "",
  nama_kecamatan: "",
  tanaman: "Padi",
  varietas: "",
  luas_ha: "",
  lat: "",
  lng: "",
  status_kesehatan: "waspada",
  tanggal_tanam: "",
};

const normalizeApiList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

const safeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const formatNumber = (value, digit = 2) => {
  const number = safeNumber(value, 0);

  return number.toLocaleString("id-ID", {
    minimumFractionDigits: digit,
    maximumFractionDigits: digit,
  });
};

const formatHa = (value) => `${formatNumber(value, 2)} Ha`;
const formatTon = (value) => `${formatNumber(value, 2)} Ton`;

const formatDate = (date = new Date()) => {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const getUmurTanaman = (item) => {
  const direct =
    item.umur_tanaman ||
    item.umur_tanam ||
    item.umur ||
    item.usia_tanaman;

  if (direct !== undefined && direct !== null && direct !== "") {
    return safeNumber(direct, 0);
  }

  if (!item.tanggal_tanam) return 0;

  const start = new Date(item.tanggal_tanam);
  const now = new Date();

  if (Number.isNaN(start.getTime())) return 0;

  const diff = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
};

const getFaseTanaman = (umur) => {
  const days = safeNumber(umur, 0);

  if (days <= 30) return "Vegetatif Awal";
  if (days <= 55) return "Vegetatif Akhir";
  if (days <= 95) return "Generatif";
  return "Siap Panen";
};

const getStatusKey = (item) => {
  const raw = String(
    item.status_kesehatan ||
      item.status_tanaman ||
      item.status_risiko ||
      item.status ||
      item.kesehatan ||
      ""
  ).toLowerCase();

  if (raw.includes("kritis")) return "kritis";
  if (raw.includes("tinggi")) return "kritis";
  if (raw.includes("rendah")) return "rendah";
  if (raw.includes("waspada")) return "waspada";
  if (raw.includes("perhatian")) return "perhatian";
  if (raw.includes("sedang")) return "waspada";
  if (raw.includes("sehat")) return "sehat";
  if (raw.includes("baik")) return "baik";

  const prediksi = safeNumber(item.prediksi_ton || item.prediksi_hasil, 0);

  if (prediksi > 0 && prediksi < 1) return "waspada";
  if (prediksi >= 1) return "sehat";

  return "default";
};

const getStatusStyle = (status) => {
  return STATUS_STYLE[status] || STATUS_STYLE.default;
};

const getLat = (item) => {
  return safeNumber(
    item.lat ??
      item.latitude ??
      item.lokasi_lat ??
      item.koordinat_lat ??
      item.desa_lat,
    null
  );
};

const getLng = (item) => {
  return safeNumber(
    item.lng ??
      item.longitude ??
      item.lokasi_lng ??
      item.koordinat_lng ??
      item.desa_lng,
    null
  );
};

const normalizeLahan = (row) => {
  const lat = getLat(row);
  const lng = getLng(row);
  const umurTanaman = getUmurTanaman(row);
  const status = getStatusKey(row);

  return {
    id: row.lahan_id || row.sawah_id || row.id,
    raw_id: row.id,

    petani_id: row.petani_id || row.user_id || row.id_petani || null,
    penyuluh_id: row.penyuluh_id || null,

    nama_petani:
      row.nama_petani ||
      row.petani_nama ||
      row.nama_user ||
      row.nama ||
      "Petani",

    nama_lahan:
      row.nama_lahan ||
      row.lahan ||
      row.nama_sawah ||
      `Lahan ${row.lahan_id || row.sawah_id || row.id || ""}`,

    nama_desa: row.nama_desa || row.desa || "-",
    nama_kecamatan: row.nama_kecamatan || row.kecamatan || "-",

    varietas: row.varietas || row.varietas_prediksi || "Padi",
    tanaman: row.tanaman || row.jenis_tanaman || "Padi",

    luas_ha: safeNumber(row.luas_ha || row.luas || row.luas_lahan, 0),
    luas_m2: safeNumber(row.luas_m2, 0),

    lat,
    lng,

    prediksi_ton: safeNumber(
      row.prediksi_ton || row.prediksi_hasil || row.total_prediksi,
      0
    ),

    prediksi_kg: safeNumber(row.prediksi_kg, 0),

    produktivitas: safeNumber(
      row.produktivitas || row.produktivitas_ton_ha,
      0
    ),

    tanggal_tanam: row.tanggal_tanam || "",
    umur_tanaman: umurTanaman,
    fase_tanaman:
      row.fase_tanam || row.fase_tanaman || getFaseTanaman(umurTanaman),

    status,
    status_label: getStatusStyle(status).label,

    updated_at: row.updated_at || row.created_at || null,
  };
};

const createMapIcon = (status, label = "") => {
  const style = getStatusStyle(status);

  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 34px;
        height: 34px;
        border-radius: 999px;
        background: ${style.color};
        border: 4px solid white;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 900;
        font-size: 12px;
        box-shadow: 0 10px 22px rgba(15,23,42,.25);
      ">
        ${label || "•"}
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
};

function MapAutoFocus({ items, selected }) {
  const map = useMap();

  useEffect(() => {
    if (selected?.displayLat && selected?.displayLng) {
      map.setView([selected.displayLat, selected.displayLng], 15, {
        animate: true,
      });
      return;
    }

    const coords = items
      .filter(
        (item) =>
          Number.isFinite(item.displayLat) &&
          Number.isFinite(item.displayLng)
      )
      .map((item) => [item.displayLat, item.displayLng]);

    if (coords.length === 1) {
      map.setView(coords[0], 15, {
        animate: true,
      });
      return;
    }

    if (coords.length > 1) {
      const bounds = L.latLngBounds(coords);

      map.fitBounds(bounds, {
        padding: [35, 35],
        maxZoom: 14,
      });
    }
  }, [items, selected, map]);

  return null;
}

export default function PetaBinaan() {
  const navigate = useNavigate();

  const storedUser = getStoredUser();

  const namaPenyuluh =
    localStorage.getItem("nama") || storedUser?.nama || "Penyuluh";

  const penyuluhId =
    localStorage.getItem("user_id") ||
    localStorage.getItem("penyuluh_id") ||
    storedUser?.id;

  const [data, setData] = useState([]);
  const [prediksiList, setPrediksiList] = useState([]);

  const [aktivitasList, setAktivitasList] = useState([]);
  const [loadingAktivitas, setLoadingAktivitas] = useState(false);
  const [aktivitasError, setAktivitasError] = useState("");

  const [selectedLahanId, setSelectedLahanId] = useState("");
  const [selectedPetaniId, setSelectedPetaniId] = useState("");

  const [search, setSearch] = useState("");
  const [wilayahFilter, setWilayahFilter] = useState("semua");
  const [statusFilter, setStatusFilter] = useState("semua");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [modalMode, setModalMode] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const canManageBinaan = CAN_MANAGE_BINAAN;

  const normalizeAktivitas = (row) => {
    return {
      id: row.id,
      title:
        row.judul ||
        row.title ||
        row.pesan ||
        row.message ||
        row.isi ||
        row.keterangan ||
        "Aktivitas baru",
      desc:
        row.pesan ||
        row.message ||
        row.isi ||
        row.keterangan ||
        row.deskripsi ||
        "",
      tipe: row.tipe || "aktivitas",
      time: row.created_at ? formatDate(row.created_at) : "Terbaru",
      rawTime: row.created_at || row.updated_at || null,
    };
  };

  const fetchAktivitas = async () => {
    try {
      setLoadingAktivitas(true);
      setAktivitasError("");

      const res = await api.get(`/notifikasi`, {
        params: {
          user_id: penyuluhId,
          role: "penyuluh",
        },
      });

      const rows = normalizeApiList(res.data);
      const normalized = rows.map(normalizeAktivitas);

      setAktivitasList(normalized);
    } catch (err) {
      console.log("ERROR AKTIVITAS:", err.response?.data || err.message);
      setAktivitasList([]);
      setAktivitasError("Gagal memuat aktivitas dari database.");
    } finally {
      setLoadingAktivitas(false);
    }
  };

  const buatAktivitas = async (pesan, tipe = "aktivitas") => {
    try {
      await api.post(`/notifikasi`, {
        user_id: penyuluhId,
        role: "penyuluh",
        tipe,
        judul: pesan,
        pesan,
      });

      await fetchAktivitas();
    } catch (err) {
      console.log("ERROR BUAT AKTIVITAS:", err.response?.data || err.message);
    }
  };

  const fetchPrediksi = async () => {
    try {
      const res = await api.get(`/prediksi`);
      const rows = normalizeApiList(res.data);

      setPrediksiList(rows);
      return rows;
    } catch (err) {
      console.log("ERROR PREDIKSI BINAAN:", err.response?.data || err.message);
      setPrediksiList([]);
      return [];
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      const [mapRes, predRows] = await Promise.all([
        api.get(`/map-binaan`),
        fetchPrediksi(),
      ]);

      let rows = normalizeApiList(mapRes.data);

      if (rows.length === 0) {
        const fallbackRes = await api.get(`/lahan`);
        rows = normalizeApiList(fallbackRes.data);
      }

      const predMap = new Map();

      predRows.forEach((item) => {
        const key = String(item.lahan_id || item.sawah_id || "");

        if (key && !predMap.has(key)) {
          predMap.set(key, item);
        }
      });

      const normalized = rows.map((row) => {
        const lahanId = row.lahan_id || row.sawah_id || row.id;
        const pred = predMap.get(String(lahanId));

        return normalizeLahan({
          ...row,
          prediksi_ton: pred?.prediksi_ton ?? row.prediksi_ton,
          prediksi_kg: pred?.prediksi_kg ?? row.prediksi_kg,
          produktivitas: pred?.produktivitas ?? row.produktivitas,
          status_risiko: pred?.status_risiko ?? row.status_risiko,
          varietas_prediksi: pred?.varietas_prediksi ?? row.varietas_prediksi,
        });
      });

      setData(normalized);

      if (normalized.length > 0) {
        setSelectedLahanId((prev) => prev || String(normalized[0].id));
        setSelectedPetaniId((prev) =>
          prev || String(normalized[0].petani_id || "")
        );
      }
    } catch (err) {
      console.log("ERROR MAP BINAAN:", err.response?.data || err.message);
      setData([]);
      setError("Gagal memuat data peta binaan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchAktivitas();
  }, []);

  const wilayahOptions = useMemo(() => {
    const set = new Set();

    data.forEach((item) => {
      if (item.nama_kecamatan && item.nama_kecamatan !== "-") {
        set.add(item.nama_kecamatan);
      }
    });

    return Array.from(set);
  }, [data]);

  const filteredData = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return data.filter((item) => {
      const matchSearch =
        !keyword ||
        item.nama_petani.toLowerCase().includes(keyword) ||
        item.nama_lahan.toLowerCase().includes(keyword) ||
        item.nama_desa.toLowerCase().includes(keyword) ||
        item.nama_kecamatan.toLowerCase().includes(keyword);

      const matchWilayah =
        wilayahFilter === "semua" || item.nama_kecamatan === wilayahFilter;

      const matchStatus =
        statusFilter === "semua" || item.status === statusFilter;

      return matchSearch && matchWilayah && matchStatus;
    });
  }, [data, search, wilayahFilter, statusFilter]);

  const mapItems = useMemo(() => {
    const validItems = filteredData.filter(
      (item) => Number.isFinite(item.lat) && Number.isFinite(item.lng)
    );

    const coordCounter = {};

    return validItems.map((item) => {
      const key = `${item.lat},${item.lng}`;
      const count = coordCounter[key] || 0;

      coordCounter[key] = count + 1;

      const offset = count * 0.00035;

      return {
        ...item,
        displayLat: item.lat + offset,
        displayLng: item.lng + offset,
        originalLat: item.lat,
        originalLng: item.lng,
      };
    });
  }, [filteredData]);

  const selectedLahan = useMemo(() => {
    return (
      mapItems.find((item) => String(item.id) === String(selectedLahanId)) ||
      filteredData.find((item) => String(item.id) === String(selectedLahanId)) ||
      mapItems[0] ||
      filteredData[0] ||
      data[0] ||
      null
    );
  }, [mapItems, filteredData, data, selectedLahanId]);

  const petaniList = useMemo(() => {
    const map = new Map();

    filteredData.forEach((item) => {
      const key = String(item.petani_id || item.nama_petani);

      if (!map.has(key)) {
        map.set(key, {
          id: key,
          nama_petani: item.nama_petani,
          nama_desa: item.nama_desa,
          nama_kecamatan: item.nama_kecamatan,
          total_lahan: 0,
          total_luas: 0,
          total_prediksi: 0,
          status: "sehat",
          lahan: [],
        });
      }

      const group = map.get(key);

      group.total_lahan += 1;
      group.total_luas += safeNumber(item.luas_ha, 0);
      group.total_prediksi += safeNumber(item.prediksi_ton, 0);
      group.lahan.push(item);

      if (item.status === "kritis" || item.status === "rendah") {
        group.status = "kritis";
      } else if (
        group.status !== "kritis" &&
        ["waspada", "perhatian"].includes(item.status)
      ) {
        group.status = "waspada";
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => b.total_lahan - a.total_lahan
    );
  }, [filteredData]);

  const activePetani = useMemo(() => {
    return (
      petaniList.find((item) => String(item.id) === String(selectedPetaniId)) ||
      petaniList[0] ||
      null
    );
  }, [petaniList, selectedPetaniId]);

  const summary = useMemo(() => {
    const petaniIds = new Set(
      data.map((item) => item.petani_id || item.nama_petani)
    );

    return {
      totalPetani: petaniIds.size,
      totalLahan: data.length,
      totalLuas: data.reduce(
        (sum, item) => sum + safeNumber(item.luas_ha, 0),
        0
      ),
      totalPrediksi: data.reduce(
        (sum, item) => sum + safeNumber(item.prediksi_ton, 0),
        0
      ),
    };
  }, [data]);

  const sebaranWilayah = useMemo(() => {
    const map = new Map();

    filteredData.forEach((item) => {
      const key = item.nama_kecamatan || "-";

      if (!map.has(key)) {
        map.set(key, {
          wilayah: key,
          petani: new Set(),
          lahan: 0,
          luas: 0,
        });
      }

      const group = map.get(key);

      group.petani.add(item.petani_id || item.nama_petani);
      group.lahan += 1;
      group.luas += safeNumber(item.luas_ha, 0);
    });

    return Array.from(map.values()).map((item, index) => ({
      ...item,
      totalPetani: item.petani.size,
      color: REGION_COLORS[index % REGION_COLORS.length],
    }));
  }, [filteredData]);

  const aktivitasTerbaru = useMemo(() => {
    return aktivitasList.slice(0, 4);
  }, [aktivitasList]);

  const lahanPerhatian = useMemo(() => {
    return data
      .filter((item) =>
        ["waspada", "perhatian", "kritis", "rendah"].includes(item.status)
      )
      .slice(0, 3);
  }, [data]);

  const mapCenter =
    selectedLahan?.displayLat && selectedLahan?.displayLng
      ? [selectedLahan.displayLat, selectedLahan.displayLng]
      : mapItems.length > 0
      ? [mapItems[0].displayLat, mapItems[0].displayLng]
      : DEFAULT_CENTER;

  const handleSelectLahan = (item) => {
    setSelectedLahanId(String(item.id));
    setSelectedPetaniId(String(item.petani_id || ""));

    setTimeout(() => {
      document.getElementById("peta-binaan-map")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 80);
  };

  const resetFilter = () => {
    setSearch("");
    setWilayahFilter("semua");
    setStatusFilter("semua");
  };

  const fillFormFromItem = (item) => {
    return {
      id: item.id || "",
      petani_id: item.petani_id || "",
      nama_petani: item.nama_petani || "",
      nama_lahan: item.nama_lahan || "",
      nama_desa: item.nama_desa || "",
      nama_kecamatan: item.nama_kecamatan || "",
      tanaman: item.tanaman || "Padi",
      varietas: item.varietas || "",
      luas_ha: item.luas_ha || "",
      lat: item.lat || "",
      lng: item.lng || "",
      status_kesehatan: item.status || "waspada",
      tanggal_tanam: item.tanggal_tanam
        ? String(item.tanggal_tanam).slice(0, 10)
        : "",
    };
  };

  const openCreateModal = () => {
    if (!canManageBinaan) {
      alert(
        "Penyuluh tidak memiliki akses menambahkan petani atau lahan. Penambahan data dilakukan oleh Admin atau Petani."
      );
      return;
    }

    setModalMode("create");

    setForm({
      ...emptyForm,
      petani_id: activePetani?.id || selectedLahan?.petani_id || "",
      nama_petani: activePetani?.nama_petani || selectedLahan?.nama_petani || "",
      nama_desa: activePetani?.nama_desa || selectedLahan?.nama_desa || "",
      nama_kecamatan:
        activePetani?.nama_kecamatan || selectedLahan?.nama_kecamatan || "",
      lat: selectedLahan?.lat || "",
      lng: selectedLahan?.lng || "",
    });

    setShowModal(true);
  };

  const openReadModal = (item) => {
    setModalMode("read");
    setForm(fillFormFromItem(item));
    setShowModal(true);
  };

  const openEditModal = (item) => {
    if (!canManageBinaan) {
      alert(
        "Penyuluh tidak memiliki akses mengedit data petani atau lahan. Perubahan data dilakukan oleh Admin atau Petani."
      );
      return;
    }

    setModalMode("edit");
    setForm(fillFormFromItem(item));
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setModalMode("");
    setForm(emptyForm);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const buildPayload = () => {
    const luasHa = safeNumber(form.luas_ha, 0);
    const luasM2 = Math.round(luasHa * 10000);

    return {
      nama_lahan: form.nama_lahan,
      tanaman: form.tanaman || "Padi",
      varietas: form.varietas || "Padi",
      luas_ha: luasHa,
      luas_m2: luasM2,
      lat: safeNumber(form.lat, null),
      lng: safeNumber(form.lng, null),
      latitude: safeNumber(form.lat, null),
      longitude: safeNumber(form.lng, null),
      petani_id: form.petani_id || null,
      user_id: form.petani_id || null,
      nama_desa: form.nama_desa,
      nama_kecamatan: form.nama_kecamatan,
      status_kesehatan: form.status_kesehatan,
      tanggal_tanam: form.tanggal_tanam || null,
    };
  };

  const submitForm = async (e) => {
    e.preventDefault();

    if (modalMode === "read") {
      closeModal();
      return;
    }

    if (!canManageBinaan) {
      alert(
        "Penyuluh hanya dapat melihat dan memantau data binaan. Simpan perubahan hanya dapat dilakukan oleh Admin atau Petani."
      );
      return;
    }

    if (!form.nama_lahan.trim()) {
      alert("Nama lahan wajib diisi.");
      return;
    }

    if (!form.petani_id) {
      alert("Petani wajib dipilih atau terisi.");
      return;
    }

    if (!form.luas_ha) {
      alert("Luas lahan wajib diisi.");
      return;
    }

    try {
      setSaving(true);

      const payload = buildPayload();

      if (modalMode === "create") {
        await api.post(`/lahan`, payload);

        await buatAktivitas(
          `Tambah lahan ${payload.nama_lahan} untuk petani ${
            form.nama_petani || form.petani_id
          }`,
          "tambah_lahan"
        );

        alert("Data lahan berhasil ditambahkan.");
      }

      if (modalMode === "edit") {
        await api.put(`/lahan/${form.id}`, payload);

        await buatAktivitas(
          `Update lahan ${payload.nama_lahan} milik ${
            form.nama_petani || form.petani_id
          }`,
          "update_lahan"
        );

        alert("Data lahan berhasil diperbarui.");
      }

      closeModal();
      await fetchData();
      await fetchAktivitas();
    } catch (err) {
      console.log("ERROR SIMPAN LAHAN:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Gagal menyimpan data lahan.");
    } finally {
      setSaving(false);
    }
  };

  const deleteLahan = async (item) => {
    if (!canManageBinaan) {
      alert(
        "Penyuluh tidak memiliki akses menghapus data petani atau lahan. Penghapusan data dilakukan oleh Admin atau Petani."
      );
      return;
    }

    const ok = window.confirm(
      `Hapus lahan "${item.nama_lahan}" milik ${item.nama_petani}?`
    );

    if (!ok) return;

    try {
      await api.delete(`/lahan/${item.id}`);

      await buatAktivitas(
        `Hapus lahan ${item.nama_lahan} milik ${item.nama_petani}`,
        "hapus_lahan"
      );

      alert("Data lahan berhasil dihapus.");

      setSelectedLahanId("");
      setSelectedPetaniId("");

      await fetchData();
      await fetchAktivitas();
    } catch (err) {
      console.log("ERROR HAPUS LAHAN:", err.response?.data || err.message);
      alert(
        err.response?.data?.message ||
          "Gagal menghapus data lahan. Cek relasi data prediksi, kalender, atau monitoring."
      );
    }
  };

  const handleBellClick = () => {
    navigate("/penyuluh/notifikasi");
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>🗺️ Peta Binaan</h1>
          <p style={styles.subtitle}>
            Pantau lahan dan kondisi petani binaan Anda
          </p>
        </div>

        <div style={styles.headerRight}>
          <div style={styles.dateBox}>📅 {formatDate(new Date())}</div>

          <div style={styles.weatherBox}>
            <span style={styles.sunIcon}>☀️</span>
            <div>
              <strong>28°C</strong>
              <small>Cerah</small>
            </div>
          </div>

          <button
            type="button"
            style={styles.notifBox}
            title="Buka halaman notifikasi penyuluh"
            onClick={handleBellClick}
          >
            🔔
            {aktivitasList.length > 0 && (
              <span style={styles.notifBadge}>
                {aktivitasList.length > 99 ? "99+" : aktivitasList.length}
              </span>
            )}
          </button>

          <div style={styles.profileBox}>
            <div style={styles.avatar}>👨‍🌾</div>
            <div>
              <strong>{namaPenyuluh}</strong>
              <small>Penyuluh</small>
            </div>
          </div>
        </div>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      <div style={styles.mainGrid}>
        <div style={styles.leftColumn}>
          <div style={styles.mapCard} id="peta-binaan-map">
            <div style={styles.filterBar}>
              <div style={styles.searchBox}>
                🔍
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari petani, desa, atau lahan..."
                  style={styles.searchInput}
                />
              </div>

              <select
                value={wilayahFilter}
                onChange={(e) => setWilayahFilter(e.target.value)}
                style={styles.select}
              >
                <option value="semua">Semua Wilayah</option>
                {wilayahOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={styles.select}
              >
                <option value="semua">Semua Status</option>
                <option value="sehat">Sehat</option>
                <option value="baik">Baik</option>
                <option value="waspada">Waspada</option>
                <option value="perhatian">Perlu Perhatian</option>
                <option value="kritis">Kritis</option>
              </select>

              <button style={styles.filterButton} onClick={resetFilter}>
                Reset Filter
              </button>
            </div>

            <div style={styles.mapWrapper}>
              {loading ? (
                <div style={styles.mapLoading}>Memuat peta binaan...</div>
              ) : (
                <MapContainer
                  center={mapCenter}
                  zoom={11}
                  scrollWheelZoom
                  style={styles.map}
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  <MapAutoFocus items={mapItems} selected={selectedLahan} />

                  {mapItems.map((item, index) => {
                    const style = getStatusStyle(item.status);

                    return (
                      <div key={item.id}>
                        <CircleMarker
                          center={[item.displayLat, item.displayLng]}
                          radius={28}
                          pathOptions={{
                            color: style.color,
                            fillColor: style.color,
                            fillOpacity: 0.16,
                            weight: 2,
                          }}
                        />

                        <Marker
                          position={[item.displayLat, item.displayLng]}
                          icon={createMapIcon(item.status, index + 1)}
                          eventHandlers={{
                            click: () => handleSelectLahan(item),
                          }}
                        >
                          <Popup>
                            <div style={{ minWidth: 190 }}>
                              <strong>{item.nama_lahan}</strong>
                              <br />
                              Petani: {item.nama_petani || "-"}
                              <br />
                              Desa: {item.nama_desa || "-"}
                              <br />
                              Kecamatan: {item.nama_kecamatan || "-"}
                              <br />
                              Luas: {formatHa(item.luas_ha)}
                              <br />
                              Status: <b>{style.label}</b>
                              <br />
                              Prediksi: {formatTon(item.prediksi_ton)}
                              <br />
                              Koordinat asli: {item.originalLat},{" "}
                              {item.originalLng}

                              <div style={styles.popupActions}>
                                <button onClick={() => openReadModal(item)}>
                                  Lihat
                                </button>

                                {canManageBinaan && (
                                  <>
                                    <button onClick={() => openEditModal(item)}>
                                      Edit
                                    </button>
                                    <button onClick={() => deleteLahan(item)}>
                                      Hapus
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </Popup>
                        </Marker>
                      </div>
                    );
                  })}
                </MapContainer>
              )}

              <div style={styles.mapControl}>
                <button>+</button>
                <button>−</button>
                <button>▣</button>
                <button>▤</button>
              </div>

              <div style={styles.legendBox}>
                <strong>Legenda</strong>
                <LegendDot color="#16a34a" label="Sehat / Baik" />
                <LegendDot color="#f59e0b" label="Waspada" />
                <LegendDot color="#ef4444" label="Kritis" />
                <LegendDot color="#3b82f6" label="Dipantau" />
              </div>

              <button
                style={styles.recenterButton}
                onClick={() => {
                  if (selectedLahan) handleSelectLahan(selectedLahan);
                }}
              >
                ⊙ Re-center
              </button>
            </div>
          </div>

          <div style={styles.bottomGrid}>
            <div style={styles.petaniCard}>
              <div style={styles.cardHeader}>
                <h3>Daftar Petani Binaan</h3>
              </div>

              <div style={styles.smallSearch}>
                🔍
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari petani..."
                />
              </div>

              <div style={styles.petaniList}>
                {petaniList.length === 0 ? (
                  <EmptyText text="Belum ada petani binaan." />
                ) : (
                  petaniList.slice(0, 6).map((petani) => {
                    const active =
                      String(activePetani?.id) === String(petani.id);
                    const style = getStatusStyle(petani.status);

                    return (
                      <button
                        key={petani.id}
                        style={{
                          ...styles.petaniItem,
                          background: active ? "#ecfdf5" : "#ffffff",
                          borderColor: active ? "#86efac" : "#eef2f7",
                        }}
                        onClick={() => {
                          setSelectedPetaniId(String(petani.id));

                          if (petani.lahan[0]) {
                            setSelectedLahanId(String(petani.lahan[0].id));
                          }
                        }}
                      >
                        <div style={styles.petaniAvatar}>👨‍🌾</div>

                        <div style={styles.petaniText}>
                          <strong>{petani.nama_petani}</strong>
                          <small>
                            Desa {petani.nama_desa}, Kec.{" "}
                            {petani.nama_kecamatan}
                          </small>
                        </div>

                        <span
                          style={{
                            ...styles.statusPill,
                            background: style.bg,
                            color: style.text,
                          }}
                        >
                          {petani.total_lahan} Lahan
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              {canManageBinaan ? (
                <button style={styles.outlineButton} onClick={openCreateModal}>
                  + Tambah Lahan
                </button>
              ) : (
                <div style={styles.roleNote}>
                  Penyuluh hanya melihat dan memantau petani binaan.
                </div>
              )}
            </div>

            <div style={styles.detailCard}>
              <div style={styles.cardHeader}>
                <h3>Detail Lahan Petani</h3>
                {canManageBinaan && (
                  <button style={styles.smallButton} onClick={openCreateModal}>
                    + Tambah
                  </button>
                )}
              </div>

              {activePetani ? (
                <>
                  <div style={styles.petaniProfile}>
                    <div style={styles.bigAvatar}>👨‍🌾</div>

                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: 0 }}>{activePetani.nama_petani}</h3>
                      <p style={styles.muted}>
                        Desa {activePetani.nama_desa}, Kec.{" "}
                        {activePetani.nama_kecamatan}
                      </p>
                    </div>

                    <MiniStat
                      value={activePetani.total_lahan}
                      label="Total Lahan"
                      color="#16a34a"
                    />
                    <MiniStat
                      value={formatHa(activePetani.total_luas)}
                      label="Total Luas"
                      color="#059669"
                    />
                    <MiniStat
                      value={formatTon(activePetani.total_prediksi)}
                      label="Prediksi Produksi"
                      color="#ea580c"
                    />
                  </div>

                  <div style={styles.tableWrap}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th>Nama Lahan</th>
                          <th>Luas</th>
                          <th>Tanaman</th>
                          <th>Fase</th>
                          <th>Kesehatan</th>
                          <th>Prediksi Panen</th>
                          <th>Aksi</th>
                        </tr>
                      </thead>

                      <tbody>
                        {activePetani.lahan.map((item) => {
                          const style = getStatusStyle(item.status);

                          return (
                            <tr key={item.id}>
                              <td>{item.nama_lahan}</td>
                              <td>{formatHa(item.luas_ha)}</td>
                              <td>{item.tanaman}</td>
                              <td>{item.fase_tanaman}</td>
                              <td>
                                <span
                                  style={{
                                    ...styles.tableStatus,
                                    color: style.text,
                                  }}
                                >
                                  ● {style.label}
                                </span>
                              </td>
                              <td>{formatTon(item.prediksi_ton)}</td>
                              <td style={styles.actionCell}>
                                <button
                                  style={styles.readButton}
                                  onClick={() => openReadModal(item)}
                                >
                                  Lihat
                                </button>

                                {canManageBinaan && (
                                  <>
                                    <button
                                      style={styles.editButton}
                                      onClick={() => openEditModal(item)}
                                    >
                                      Edit
                                    </button>

                                    <button
                                      style={styles.deleteButton}
                                      onClick={() => deleteLahan(item)}
                                    >
                                      Hapus
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <EmptyText text="Pilih petani untuk melihat detail lahan." />
              )}
            </div>
          </div>
        </div>

        <div style={styles.rightColumn}>
          <div style={styles.sideCard}>
            <div style={styles.cardHeader}>
              <h3>Ringkasan Binaan</h3>
              <button style={styles.smallButton} onClick={fetchData}>
                Refresh
              </button>
            </div>

            <div style={styles.summaryGrid}>
              <SummaryCard
                value={summary.totalPetani}
                label="Total Petani"
                color="#059669"
                bg="#ecfdf5"
              />
              <SummaryCard
                value={summary.totalLahan}
                label="Total Lahan"
                color="#2563eb"
                bg="#eff6ff"
              />
              <SummaryCard
                value={formatNumber(summary.totalLuas, 1)}
                suffix="Ha"
                label="Total Luas"
                color="#059669"
                bg="#ecfdf5"
              />
              <SummaryCard
                value={formatNumber(summary.totalPrediksi, 1)}
                suffix="Ton"
                label="Prediksi Produksi"
                color="#ea580c"
                bg="#fff7ed"
              />
            </div>
          </div>

          <div style={styles.sideCard}>
            <div style={styles.cardHeader}>
              <h3>Sebaran Binaan per Wilayah</h3>
            </div>

            {sebaranWilayah.length === 0 ? (
              <EmptyText text="Belum ada sebaran wilayah." />
            ) : (
              sebaranWilayah.slice(0, 5).map((item) => (
                <div key={item.wilayah} style={styles.regionRow}>
                  <span
                    style={{
                      ...styles.regionDot,
                      background: item.color,
                    }}
                  />
                  <strong>{item.wilayah}</strong>
                  <span>{item.totalPetani} Petani</span>
                  <span>{item.lahan} Lahan</span>
                  <span>{formatHa(item.luas)}</span>
                </div>
              ))
            )}
          </div>

          <div style={styles.sideCard}>
            <div style={styles.cardHeader}>
              <h3>Aktivitas Terbaru</h3>
              <button style={styles.smallButton} onClick={fetchAktivitas}>
                Refresh
              </button>
            </div>

            {loadingAktivitas ? (
              <EmptyText text="Memuat aktivitas dari database..." />
            ) : aktivitasError ? (
              <EmptyText text={aktivitasError} />
            ) : aktivitasTerbaru.length === 0 ? (
              <EmptyText text="Belum ada aktivitas dari database." />
            ) : (
              aktivitasTerbaru.map((item) => (
                <div key={item.id || item.title} style={styles.activityRow}>
                  <div style={styles.activityIcon}>⌁</div>
                  <span>{item.title}</span>
                  <small>{item.time}</small>
                </div>
              ))
            )}
          </div>

          <div style={styles.sideCard}>
            <div style={styles.cardHeader}>
              <h3>Informasi Lahan Terpilih</h3>
            </div>

            {selectedLahan ? (
              <>
                <div style={styles.selectedBox}>
                  <div style={styles.fieldPhoto}>🌾</div>

                  <div style={{ flex: 1 }}>
                    <div style={styles.selectedTitle}>
                      <strong>{selectedLahan.nama_lahan}</strong>

                      <span
                        style={{
                          ...styles.statusPill,
                          background: getStatusStyle(selectedLahan.status).bg,
                          color: getStatusStyle(selectedLahan.status).text,
                        }}
                      >
                        {getStatusStyle(selectedLahan.status).label}
                      </span>
                    </div>

                    <InfoRow label="Petani" value={selectedLahan.nama_petani} />
                    <InfoRow label="Desa" value={selectedLahan.nama_desa} />
                    <InfoRow
                      label="Kecamatan"
                      value={selectedLahan.nama_kecamatan}
                    />
                    <InfoRow
                      label="Luas Lahan"
                      value={formatHa(selectedLahan.luas_ha)}
                    />
                    <InfoRow label="Tanaman" value={selectedLahan.tanaman} />
                    <InfoRow label="Varietas" value={selectedLahan.varietas} />
                    <InfoRow
                      label="Umur Tanaman"
                      value={`${selectedLahan.umur_tanaman || 0} Hari`}
                    />
                    <InfoRow
                      label="Prediksi Panen"
                      value={formatTon(selectedLahan.prediksi_ton)}
                    />
                  </div>
                </div>

                <div
                  style={{
                    ...styles.actionGrid,
                    gridTemplateColumns: canManageBinaan
                      ? "1fr 1fr 1fr"
                      : "1fr",
                  }}
                >
                  <button
                    style={styles.greenButton}
                    onClick={() => openReadModal(selectedLahan)}
                  >
                    Lihat
                  </button>

                  {canManageBinaan && (
                    <>
                      <button
                        style={styles.blueButton}
                        onClick={() => openEditModal(selectedLahan)}
                      >
                        Edit
                      </button>

                      <button
                        style={styles.redButton}
                        onClick={() => deleteLahan(selectedLahan)}
                      >
                        Hapus
                      </button>
                    </>
                  )}
                </div>
              </>
            ) : (
              <EmptyText text="Pilih lahan pada peta." />
            )}
          </div>

          <div style={styles.sideCard}>
            <div style={styles.cardHeader}>
              <h3>Lahan Perlu Perhatian</h3>
            </div>

            {lahanPerhatian.length === 0 ? (
              <EmptyText text="Tidak ada lahan berisiko." />
            ) : (
              lahanPerhatian.map((item) => {
                const style = getStatusStyle(item.status);

                return (
                  <button
                    key={item.id}
                    style={styles.warningRow}
                    onClick={() => handleSelectLahan(item)}
                  >
                    <span
                      style={{
                        ...styles.warningDot,
                        background: style.color,
                      }}
                    />
                    <div>
                      <strong>{item.nama_lahan}</strong>
                      <small>
                        {item.nama_petani} • {style.label}
                      </small>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalBox}>
            <div style={styles.modalHeader}>
              <h2>
                {modalMode === "create"
                  ? "Tambah Lahan"
                  : modalMode === "edit"
                  ? "Edit Lahan"
                  : "Detail Lahan"}
              </h2>

              <button style={styles.closeButton} onClick={closeModal}>
                ×
              </button>
            </div>

            <form onSubmit={submitForm}>
              <div style={styles.formGrid}>
                <FormInput
                  label="Petani ID"
                  name="petani_id"
                  value={form.petani_id}
                  onChange={handleFormChange}
                  disabled={modalMode === "read"}
                />

                <FormInput
                  label="Nama Petani"
                  name="nama_petani"
                  value={form.nama_petani}
                  onChange={handleFormChange}
                  disabled={modalMode === "read"}
                />

                <FormInput
                  label="Nama Lahan"
                  name="nama_lahan"
                  value={form.nama_lahan}
                  onChange={handleFormChange}
                  disabled={modalMode === "read"}
                />

                <FormInput
                  label="Tanaman"
                  name="tanaman"
                  value={form.tanaman}
                  onChange={handleFormChange}
                  disabled={modalMode === "read"}
                />

                <FormInput
                  label="Varietas"
                  name="varietas"
                  value={form.varietas}
                  onChange={handleFormChange}
                  disabled={modalMode === "read"}
                />

                <FormInput
                  label="Luas Ha"
                  name="luas_ha"
                  type="number"
                  step="0.01"
                  value={form.luas_ha}
                  onChange={handleFormChange}
                  disabled={modalMode === "read"}
                />

                <FormInput
                  label="Desa"
                  name="nama_desa"
                  value={form.nama_desa}
                  onChange={handleFormChange}
                  disabled={modalMode === "read"}
                />

                <FormInput
                  label="Kecamatan"
                  name="nama_kecamatan"
                  value={form.nama_kecamatan}
                  onChange={handleFormChange}
                  disabled={modalMode === "read"}
                />

                <FormInput
                  label="Latitude"
                  name="lat"
                  type="number"
                  step="0.000001"
                  value={form.lat}
                  onChange={handleFormChange}
                  disabled={modalMode === "read"}
                />

                <FormInput
                  label="Longitude"
                  name="lng"
                  type="number"
                  step="0.000001"
                  value={form.lng}
                  onChange={handleFormChange}
                  disabled={modalMode === "read"}
                />

                <div style={styles.formGroup}>
                  <label>Status Kesehatan</label>
                  <select
                    name="status_kesehatan"
                    value={form.status_kesehatan}
                    onChange={handleFormChange}
                    disabled={modalMode === "read"}
                    style={styles.formInput}
                  >
                    <option value="sehat">Sehat</option>
                    <option value="baik">Baik</option>
                    <option value="waspada">Waspada</option>
                    <option value="perhatian">Perlu Perhatian</option>
                    <option value="kritis">Kritis</option>
                  </select>
                </div>

                <FormInput
                  label="Tanggal Tanam"
                  name="tanggal_tanam"
                  type="date"
                  value={form.tanggal_tanam}
                  onChange={handleFormChange}
                  disabled={modalMode === "read"}
                />
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.cancelButton}
                  onClick={closeModal}
                >
                  Tutup
                </button>

                {modalMode !== "read" && (
                  <button
                    type="submit"
                    style={styles.saveButton}
                    disabled={saving}
                  >
                    {saving ? "Menyimpan..." : "Simpan"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function FormInput({
  label,
  name,
  value,
  onChange,
  disabled,
  type = "text",
  step,
}) {
  return (
    <div style={styles.formGroup}>
      <label>{label}</label>
      <input
        type={type}
        step={step}
        name={name}
        value={value || ""}
        onChange={onChange}
        disabled={disabled}
        style={styles.formInput}
      />
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <div style={styles.legendRow}>
      <span style={{ ...styles.legendDot, background: color }} />
      <span>{label}</span>
    </div>
  );
}

function SummaryCard({ value, suffix, label, color, bg }) {
  return (
    <div style={{ ...styles.summaryCard, background: bg }}>
      <strong style={{ color }}>
        {value}
        {suffix ? <small> {suffix}</small> : null}
      </strong>
      <span>{label}</span>
    </div>
  );
}

function MiniStat({ value, label, color }) {
  return (
    <div style={styles.miniStat}>
      <strong style={{ color }}>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={styles.infoRow}>
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function EmptyText({ text }) {
  return <div style={styles.emptyText}>{text}</div>;
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: 24,
    boxSizing: "border-box",
    color: "#0f172a",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 20,
    alignItems: "center",
    marginBottom: 18,
  },

  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: "-0.5px",
  },

  subtitle: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 14,
  },

  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  dateBox: {
    height: 46,
    padding: "0 16px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    fontWeight: 800,
  },

  weatherBox: {
    height: 46,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  sunIcon: {
    fontSize: 24,
  },

  notifBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    cursor: "pointer",
    fontSize: 18,
    padding: 0,
  },

  notifBadge: {
    position: "absolute",
    top: -7,
    right: -5,
    minWidth: 20,
    height: 20,
    padding: "0 5px",
    borderRadius: 999,
    background: "#ef4444",
    color: "#ffffff",
    fontSize: 11,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
  },

  profileBox: {
    height: 46,
    padding: "0 14px",
    borderRadius: 12,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  avatar: {
    width: 34,
    height: 34,
    borderRadius: 999,
    background: "#dcfce7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 360px",
    gap: 18,
  },

  leftColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
    minWidth: 0,
  },

  rightColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  mapCard: {
    background: "#ffffff",
    borderRadius: 18,
    border: "1px solid #e5e7eb",
    boxShadow: "0 14px 35px rgba(15,23,42,.08)",
    overflow: "hidden",
  },

  filterBar: {
    display: "grid",
    gridTemplateColumns: "1fr 170px 170px 160px",
    gap: 12,
    padding: 14,
    borderBottom: "1px solid #e5e7eb",
    background: "#ffffff",
  },

  searchBox: {
    height: 44,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 12px",
  },

  searchInput: {
    border: "none",
    outline: "none",
    width: "100%",
    fontSize: 14,
  },

  select: {
    height: 44,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "0 12px",
    background: "#ffffff",
    fontWeight: 800,
  },

  filterButton: {
    height: 44,
    border: "none",
    borderRadius: 10,
    background: "#047857",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },

  mapWrapper: {
    height: 470,
    position: "relative",
    overflow: "hidden",
  },

  map: {
    width: "100%",
    height: "100%",
  },

  mapLoading: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    color: "#64748b",
    background: "#f8fafc",
  },

  mapControl: {
    position: "absolute",
    left: 18,
    top: 18,
    zIndex: 900,
    display: "grid",
    gap: 8,
  },

  legendBox: {
    position: "absolute",
    left: 18,
    bottom: 18,
    zIndex: 900,
    background: "rgba(255,255,255,.95)",
    borderRadius: 12,
    padding: 12,
    boxShadow: "0 14px 28px rgba(15,23,42,.16)",
    minWidth: 150,
  },

  legendRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    marginTop: 8,
  },

  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },

  recenterButton: {
    position: "absolute",
    right: 18,
    bottom: 18,
    zIndex: 900,
    height: 42,
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
    padding: "0 14px",
  },

  popupActions: {
    display: "flex",
    gap: 6,
    marginTop: 10,
  },

  bottomGrid: {
    display: "grid",
    gridTemplateColumns: "300px 1fr",
    gap: 18,
  },

  petaniCard: {
    background: "#ffffff",
    borderRadius: 18,
    border: "1px solid #e5e7eb",
    padding: 16,
    boxShadow: "0 14px 35px rgba(15,23,42,.08)",
  },

  detailCard: {
    background: "#ffffff",
    borderRadius: 18,
    border: "1px solid #e5e7eb",
    padding: 16,
    boxShadow: "0 14px 35px rgba(15,23,42,.08)",
    minWidth: 0,
  },

  sideCard: {
    background: "#ffffff",
    borderRadius: 18,
    border: "1px solid #e5e7eb",
    padding: 16,
    boxShadow: "0 14px 35px rgba(15,23,42,.07)",
  },

  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  smallButton: {
    height: 34,
    borderRadius: 9,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
    padding: "0 12px",
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },

  summaryCard: {
    borderRadius: 12,
    padding: 13,
  },

  regionRow: {
    display: "grid",
    gridTemplateColumns: "14px 1fr 70px 70px 70px",
    gap: 8,
    alignItems: "center",
    borderBottom: "1px solid #f1f5f9",
    padding: "12px 0",
    fontSize: 13,
  },

  regionDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },

  activityRow: {
    display: "grid",
    gridTemplateColumns: "28px 1fr auto",
    gap: 10,
    alignItems: "center",
    padding: "10px 0",
    borderBottom: "1px solid #f1f5f9",
    fontSize: 13,
  },

  activityIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    background: "#f1f5f9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  selectedBox: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
  },

  fieldPhoto: {
    width: 96,
    height: 96,
    borderRadius: 12,
    background: "linear-gradient(135deg, #16a34a, #84cc16, #eab308)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 34,
  },

  selectedTitle: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
    marginBottom: 8,
  },

  statusPill: {
    borderRadius: 999,
    padding: "4px 9px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  infoRow: {
    display: "grid",
    gridTemplateColumns: "110px 1fr",
    gap: 10,
    padding: "5px 0",
    fontSize: 13,
  },

  actionGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 8,
    marginTop: 14,
  },

  greenButton: {
    height: 38,
    border: "none",
    borderRadius: 10,
    background: "#059669",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },

  blueButton: {
    height: 38,
    border: "none",
    borderRadius: 10,
    background: "#dbeafe",
    color: "#1d4ed8",
    fontWeight: 900,
    cursor: "pointer",
  },

  redButton: {
    height: 38,
    border: "none",
    borderRadius: 10,
    background: "#fee2e2",
    color: "#b91c1c",
    fontWeight: 900,
    cursor: "pointer",
  },

  smallSearch: {
    height: 40,
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 10px",
    marginBottom: 12,
  },

  petaniList: {
    display: "grid",
    gap: 8,
  },

  petaniItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    border: "1px solid #eef2f7",
    borderRadius: 12,
    padding: 10,
    cursor: "pointer",
    textAlign: "left",
  },

  petaniAvatar: {
    width: 38,
    height: 38,
    borderRadius: 999,
    background: "#dbeafe",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  petaniText: {
    flex: 1,
    minWidth: 0,
    display: "grid",
    gap: 2,
  },

  outlineButton: {
    width: "100%",
    height: 40,
    borderRadius: 10,
    border: "1px solid #86efac",
    background: "#ffffff",
    color: "#047857",
    fontWeight: 900,
    cursor: "pointer",
    marginTop: 14,
  },

  roleNote: {
    marginTop: 14,
    border: "1px dashed #86efac",
    background: "#ecfdf5",
    color: "#047857",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.45,
    textAlign: "center",
  },

  petaniProfile: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "#f8fafc",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },

  bigAvatar: {
    width: 54,
    height: 54,
    borderRadius: 999,
    background: "#dcfce7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 28,
  },

  miniStat: {
    minWidth: 110,
    borderRadius: 12,
    background: "#ffffff",
    padding: 10,
    display: "grid",
    gap: 4,
    border: "1px solid #e5e7eb",
  },

  tableWrap: {
    overflowX: "auto",
    overflowY: "visible",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },

  tableStatus: {
    fontWeight: 900,
  },

  actionCell: {
    whiteSpace: "nowrap",
  },

  readButton: {
    height: 30,
    borderRadius: 8,
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontWeight: 800,
    cursor: "pointer",
    marginRight: 5,
    padding: "0 10px",
  },

  editButton: {
    height: 30,
    borderRadius: 8,
    border: "1px solid #fde68a",
    background: "#fffbeb",
    color: "#b45309",
    fontWeight: 800,
    cursor: "pointer",
    marginRight: 5,
    padding: "0 10px",
  },

  deleteButton: {
    height: 30,
    borderRadius: 8,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#b91c1c",
    fontWeight: 800,
    cursor: "pointer",
    padding: "0 10px",
  },

  warningRow: {
    width: "100%",
    display: "flex",
    gap: 10,
    alignItems: "center",
    border: "none",
    background: "#ffffff",
    cursor: "pointer",
    textAlign: "left",
    padding: "9px 0",
    borderBottom: "1px solid #f1f5f9",
  },

  warningDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    flexShrink: 0,
  },

  emptyText: {
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
    padding: 14,
    color: "#64748b",
    fontSize: 13,
    textAlign: "center",
  },

  muted: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: 13,
  },

  errorBox: {
    background: "#fef2f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    fontWeight: 800,
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,.45)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },

  modalBox: {
    width: "min(820px, 100%)",
    maxHeight: "90vh",
    overflowY: "auto",
    background: "#ffffff",
    borderRadius: 18,
    boxShadow: "0 30px 70px rgba(0,0,0,.25)",
    padding: 22,
  },

  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    cursor: "pointer",
    fontSize: 22,
    fontWeight: 900,
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },

  formGroup: {
    display: "grid",
    gap: 6,
  },

  formInput: {
    height: 42,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    padding: "0 12px",
    outline: "none",
    background: "#ffffff",
  },

  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
  },

  cancelButton: {
    height: 42,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    cursor: "pointer",
    fontWeight: 800,
    padding: "0 18px",
  },

  saveButton: {
    height: 42,
    borderRadius: 10,
    border: "none",
    background: "#16a34a",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 900,
    padding: "0 22px",
  },
};