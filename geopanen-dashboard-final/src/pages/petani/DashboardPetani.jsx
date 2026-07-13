import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import PetaniNotificationBell from "../../components/PetaniNotificationBell";
import api from "../../services/api";
const DEFAULT_CENTER = [-7.681, 110.832];

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const getCurrentUser = () => {
  const storedUser = getStoredUser();

  return {
    id:
      storedUser?.id ||
      localStorage.getItem("user_id") ||
      localStorage.getItem("petani_id") ||
      null,
    nama: storedUser?.nama || localStorage.getItem("nama") || "Petani",
    email: storedUser?.email || localStorage.getItem("email") || "",
    role: storedUser?.role || localStorage.getItem("role") || "petani",
  };
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

const formatNumber = (value, digit = 2) => {
  return safeNumber(value).toLocaleString("id-ID", {
    minimumFractionDigits: digit,
    maximumFractionDigits: digit,
  });
};

const formatDate = (value, withYear = true) => {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: withYear ? "numeric" : undefined,
  });
};

const formatTime = (value) => {
  if (!value) return "08:00 WIB";

  const text = String(value);

  if (/^\d{2}:\d{2}/.test(text)) {
    return `${text.slice(0, 5)} WIB`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "08:00 WIB";

  return `${date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  })} WIB`;
};

const toDateKey = (value) => {
  if (!value) return "";

  let date;

  if (value instanceof Date) {
    date = value;
  } else if (String(value).includes("T")) {
    date = new Date(value);
  } else {
    date = new Date(`${value}T00:00:00`);
  }

  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const todayKey = () => {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getUmurTanaman = (item) => {
  if (item?.umur_tanaman) return Number(item.umur_tanaman);
  if (item?.umur_tanam) return Number(item.umur_tanam);

  if (!item?.tanggal_tanam) return 45;

  const tanam = new Date(item.tanggal_tanam);
  const now = new Date();

  if (Number.isNaN(tanam.getTime())) return 45;

  const diff = Math.floor((now - tanam) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 1;
};

const getRiskStatus = (prediksi) => {
  const status = String(prediksi?.status_risiko || "").toUpperCase();
  const risk = Number(prediksi?.risk_score || 0);

  if (status === "KRITIS" || risk >= 70) {
    return {
      label: "Buruk",
      color: "#ef4444",
      bg: "#fee2e2",
      text: "#b91c1c",
    };
  }

  if (status === "WASPADA" || risk >= 40) {
    return {
      label: "Sedang",
      color: "#eab308",
      bg: "#fef3c7",
      text: "#b45309",
    };
  }

  return {
    label: "Baik",
    color: "#16a34a",
    bg: "#dcfce7",
    text: "#047857",
  };
};

const makeMarkerIcon = (color = "#16a34a") => {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 28px;
        height: 28px;
        border-radius: 999px;
        background: ${color};
        border: 4px solid white;
        box-shadow: 0 10px 22px rgba(0,0,0,.35);
      "></div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -12],
  });
};

function FitMapBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length === 0) return;

    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 15);
      return;
    }

    const bounds = L.latLngBounds(points.map((item) => [item.lat, item.lng]));

    map.fitBounds(bounds, {
      padding: [40, 40],
      maxZoom: 15,
    });
  }, [map, points]);

  return null;
}

export default function DashboardPetani() {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(getCurrentUser);
  const [user, setUser] = useState(null);

  const [lahanList, setLahanList] = useState([]);
  const [prediksiList, setPrediksiList] = useState([]);
  const [kalenderList, setKalenderList] = useState([]);
  const [notifikasiList, setNotifikasiList] = useState([]);
  const [konsultasiList, setKonsultasiList] = useState([]);
  const [weather, setWeather] = useState(null);

  const [selectedMapLahan, setSelectedMapLahan] = useState(null);
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem("token");
  const userId = currentUser?.id;
  const namaPetani = user?.nama || currentUser?.nama || "Petani";

  useEffect(() => {
    const sessionUser = getCurrentUser();

    setCurrentUser(sessionUser);

    if (!token || !sessionUser.id) {
      navigate("/login", { replace: true });
      return;
    }

    if (sessionUser.role !== "petani") {
      if (sessionUser.role === "admin") {
        navigate("/admin", { replace: true });
        return;
      }

      if (sessionUser.role === "penyuluh") {
        navigate("/penyuluh", { replace: true });
        return;
      }
    }

    loadDashboard(sessionUser.id);
  }, []);

  const loadDashboard = async (id) => {
    try {
      setLoading(true);

      const lahanData = await loadLahan(id);

      await Promise.all([
        loadUser(id),
        loadPrediksi(id),
        loadKalender(id, lahanData),
        loadNotifikasi(id),
        loadKonsultasi(id),
        loadWeather(),
      ]);
    } catch (err) {
      console.log("ERROR LOAD DASHBOARD:", err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadUser = async (id) => {
    try {
      const res = await api.get(`/petani/${id}`);

      const data = res.data?.data || res.data?.user || res.data || null;

      if (data && typeof data === "object") {
        setUser(data);

        const updatedUser = {
          ...currentUser,
          ...data,
          id: data.id || id,
          role: data.role || "petani",
        };

        localStorage.setItem("user", JSON.stringify(updatedUser));
        localStorage.setItem("user_id", String(updatedUser.id));
        localStorage.setItem("petani_id", String(updatedUser.id));
        localStorage.setItem("nama", updatedUser.nama || "Petani");
        localStorage.setItem("role", updatedUser.role || "petani");

        setCurrentUser(updatedUser);
      }
    } catch (err) {
      console.log("ERROR USER:", err.response?.data || err.message);
      setUser(currentUser);
    }
  };

  const loadLahan = async (id) => {
    try {
      const res = await api.get("/lahan", {
        params: {
          petani_id: id,
          user_id: id,
        },
      });

      const data = normalizeApiList(res.data);
      setLahanList(data);
      return data;
    } catch (err) {
      console.log("ERROR LAHAN:", err.response?.data || err.message);
      setLahanList([]);
      return [];
    }
  };

  const loadPrediksi = async (id) => {
    try {
      const res = await api.get("/prediksi", {
        params: {
          petani_id: id,
          user_id: id,
        },
      });

      setPrediksiList(normalizeApiList(res.data));
    } catch (err) {
      console.log("ERROR PREDIKSI:", err.response?.data || err.message);
      setPrediksiList([]);
    }
  };

  const loadKalender = async (id, lahanData = []) => {
    try {
      const res = await api.get("/kalender/petani", {
        params: {
          petani_id: id,
          user_id: id,
        },
      });

      const data = normalizeApiList(res.data);

      if (data.length > 0) {
        setKalenderList(data);
        return;
      }

      const requests = await Promise.allSettled(
        lahanData.map((item) => api.get(`/kalender/${item.id}`))
      );

      const merged = requests.flatMap((item) => {
        if (item.status !== "fulfilled") return [];
        return normalizeApiList(item.value.data);
      });

      setKalenderList(merged);
    } catch (err) {
      console.log("ERROR KALENDER:", err.response?.data || err.message);

      const requests = await Promise.allSettled(
        lahanData.map((item) => api.get(`/kalender/${item.id}`))
      );

      const merged = requests.flatMap((item) => {
        if (item.status !== "fulfilled") return [];
        return normalizeApiList(item.value.data);
      });

      setKalenderList(merged);
    }
  };

  const loadNotifikasi = async (id) => {
    try {
      const res = await api.get("/notifikasi", {
        params: {
          user_id: id,
          role: "petani",
        },
      });

      const data = normalizeApiList(res.data);
      setNotifikasiList(data);

      const unreadItems = data.filter((item) => Number(item.is_read) === 0);

      if (unreadItems.length > 0) {
        await Promise.all(
          unreadItems.map((item) =>
            api.put(`/notifikasi/${item.id}/read`)
          )
        );

        setNotifikasiList((prev) =>
          prev.map((item) =>
            unreadItems.some((unread) => String(unread.id) === String(item.id))
              ? {
                  ...item,
                  is_read: 1,
                  status: "dibaca",
                  status_kirim: "terkirim",
                  read_at: new Date().toISOString(),
                }
              : item
          )
        );
      }
    } catch (err) {
      console.log("ERROR NOTIFIKASI:", err.response?.data || err.message);
      setNotifikasiList([]);
    }
  };

  const loadKonsultasi = async (id) => {
    try {
      const res = await api.get(`/konsultasi/petani/${id}`);
      setKonsultasiList(normalizeApiList(res.data));
    } catch (err) {
      console.log("ERROR KONSULTASI:", err.response?.data || err.message);
      setKonsultasiList([]);
    }
  };

  const loadWeather = async () => {
    try {
      const endpoints = ["/cuaca", "/weather"];

      for (const endpoint of endpoints) {
        try {
          const res = await api.get(endpoint);
          const data = res.data?.data || res.data || {};

          const suhu =
            data.suhu ||
            data.temperature ||
            data.temp ||
            data.current?.temperature ||
            25;

          const kondisi =
            data.kondisi ||
            data.condition ||
            data.cuaca ||
            data.weather ||
            data.current?.condition ||
            "Cerah Berawan";

          const kelembapan =
            data.kelembapan ||
            data.humidity ||
            data.current?.humidity ||
            78;

          const curahHujan =
            data.curah_hujan ||
            data.rain ||
            data.precipitation ||
            data.current?.rain ||
            2;

          setWeather({
            suhu,
            kondisi,
            kelembapan,
            curahHujan,
          });

          return;
        } catch {
          // lanjut endpoint berikutnya
        }
      }

      setWeather({
        suhu: 25,
        kondisi: "Cerah Berawan",
        kelembapan: 78,
        curahHujan: 2,
      });
    } catch {
      setWeather({
        suhu: 25,
        kondisi: "Cerah Berawan",
        kelembapan: 78,
        curahHujan: 2,
      });
    }
  };

  const latestPrediksiByLahan = useMemo(() => {
    const map = new Map();

    [...prediksiList]
      .sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      })
      .forEach((item) => {
        const key = String(item.sawah_id || item.lahan_id);

        if (!map.has(key)) {
          map.set(key, item);
        }
      });

    return map;
  }, [prediksiList]);

  const mapLahanList = useMemo(() => {
    return lahanList
      .map((item) => {
        const lat = Number(item.lat || item.latitude || item.lokasi_lat);
        const lng = Number(item.lng || item.longitude || item.lokasi_lng);

        return {
          ...item,
          lat,
          lng,
        };
      })
      .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
  }, [lahanList]);

  useEffect(() => {
    if (!selectedMapLahan && mapLahanList.length > 0) {
      setSelectedMapLahan(mapLahanList[0]);
    }
  }, [selectedMapLahan, mapLahanList]);

  const mapCenter = useMemo(() => {
    if (mapLahanList.length > 0) {
      return [mapLahanList[0].lat, mapLahanList[0].lng];
    }

    return DEFAULT_CENTER;
  }, [mapLahanList]);

  const totalLahan = lahanList.length;

  const totalLuas = useMemo(() => {
    return lahanList.reduce((total, item) => {
      return total + Number(item.luas_ha || item.luas || 0);
    }, 0);
  }, [lahanList]);

  const totalPrediksi = useMemo(() => {
    return Array.from(latestPrediksiByLahan.values()).reduce((total, item) => {
      return total + Number(item.prediksi_ton || 0);
    }, 0);
  }, [latestPrediksiByLahan]);

  const todayEvents = useMemo(() => {
    const nowKey = todayKey();

    return kalenderList.filter((item) => toDateKey(item.tanggal) === nowKey);
  }, [kalenderList]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return kalenderList
      .filter((item) => {
        const date = new Date(toDateKey(item.tanggal));
        return date >= now && item.status !== "selesai";
      })
      .sort((a, b) => {
        const dateA = new Date(
          `${toDateKey(a.tanggal)}T${String(a.waktu || "08:00").slice(0, 5)}`
        );
        const dateB = new Date(
          `${toDateKey(b.tanggal)}T${String(b.waktu || "08:00").slice(0, 5)}`
        );

        return dateA - dateB;
      })
      .slice(0, 4);
  }, [kalenderList]);

  const avgRiskScore = useMemo(() => {
    const valid = Array.from(latestPrediksiByLahan.values()).filter(
      (item) => item.risk_score !== null && item.risk_score !== undefined
    );

    if (valid.length === 0) return 50;

    const total = valid.reduce(
      (sum, item) => sum + Number(item.risk_score || 0),
      0
    );

    return total / valid.length;
  }, [latestPrediksiByLahan]);

  const skorKesehatan = Math.max(0, Math.min(100, 100 - avgRiskScore));

  const activeRekomendasiCount = useMemo(() => {
    const pupukEvents = kalenderList.filter((item) =>
      String(item.jenis || "").toLowerCase().includes("pupuk")
    );

    if (pupukEvents.length > 0) return pupukEvents.length;

    return lahanList.length;
  }, [kalenderList, lahanList]);

  const mainLahan = selectedMapLahan || mapLahanList[0] || lahanList[0] || null;
  const mainPrediksi = latestPrediksiByLahan.get(String(mainLahan?.id));
  const mainStatus = getRiskStatus(mainPrediksi);

  const notificationData = useMemo(() => {
    if (notifikasiList.length > 0) {
      return notifikasiList.slice(0, 3).map((item) => ({
        icon: "🔔",
        title: item.judul || item.title || "Notifikasi",
        desc: item.pesan || item.message || "Ada pembaruan sistem.",
        time: item.created_at ? formatDate(item.created_at, false) : "Baru",
      }));
    }

    const items = [];

    const waspada = Array.from(latestPrediksiByLahan.values()).find(
      (item) =>
        String(item.status_risiko || "").toUpperCase() === "WASPADA" ||
        Number(item.risk_score || 0) >= 40
    );

    if (waspada) {
      items.push({
        icon: "⚠️",
        title: "Risiko Lahan Perlu Dipantau",
        desc: `${waspada.nama_lahan || "Lahan"} memiliki status ${
          waspada.status_risiko || "waspada"
        }.`,
        time: "Hari ini",
      });
    }

    if (upcomingEvents[0]) {
      items.push({
        icon: "📅",
        title: upcomingEvents[0].nama_kegiatan || "Kegiatan Terjadwal",
        desc: `${formatDate(upcomingEvents[0].tanggal, false)} pukul ${formatTime(
          upcomingEvents[0].waktu
        )}`,
        time: "Mendatang",
      });
    }

    items.push({
      icon: "🌱",
      title: "Pemupukan",
      desc: "Pastikan pemupukan mengikuti jadwal kalender budidaya.",
      time: "Tips",
    });

    return items.slice(0, 3);
  }, [notifikasiList, latestPrediksiByLahan, upcomingEvents]);

  const latestKonsultasi = konsultasiList[0] || null;

  return (
    <div className="dashboard-page">
      <div className="dash-header">
        <div>
          <h1>🌿 Dashboard Petani</h1>
          <p>
            Selamat datang, <b>{namaPetani}</b>. Kelola lahan dan pantau
            pertanian Anda dengan AI.
          </p>
        </div>

        <div className="header-right">
          <div className="weather-chip">
            <span className="sun">☀️</span>
            <div>
              <strong>{formatNumber(weather?.suhu || 25, 0)}°C</strong>
              <small>{weather?.kondisi || "Cerah Berawan"}</small>
              <small>
                {mainLahan?.nama_kecamatan || "-"},{" "}
                {mainLahan?.nama_desa || "-"}
              </small>
            </div>
          </div>

          <PetaniNotificationBell />

          <button
            className="profile-chip"
            type="button"
            onClick={() => navigate("/petani/lahan-saya")}
          >
            <span>👨‍🌾</span>
            <div>
              <b>{namaPetani}</b>
              <small>{mainLahan?.nama_desa || "-"}</small>
            </div>
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <KpiCard
          icon="🌿"
          title="Total Lahan"
          value={totalLahan}
          suffix=""
          desc="Total Lahan Saya"
          button="Lihat Lahan"
          onClick={() => navigate("/petani/lahan-saya")}
        />

        <KpiCard
          icon="🗺️"
          title="Total Luas"
          value={formatNumber(totalLuas, 2)}
          suffix="Ha"
          desc="Total Luas Lahan"
          button="Detail Lahan"
          onClick={() => navigate("/petani/lahan-saya")}
        />

        <KpiCard
          icon="📊"
          title="Prediksi Panen"
          value={formatNumber(totalPrediksi, 2)}
          suffix="Ton"
          desc="Estimasi Hasil Panen"
          button="Lihat Prediksi"
          onClick={() => navigate("/petani/prediksi")}
        />

        <KpiCard
          icon="🧪"
          title="Rekomendasi Pupuk"
          value={activeRekomendasiCount}
          suffix=""
          desc="Rekomendasi Aktif"
          button="Lihat Rekomendasi"
          onClick={() => navigate("/petani/rekomendasi-pupuk")}
        />

        <KpiCard
          icon="📅"
          title="Kegiatan Hari Ini"
          value={todayEvents.length}
          suffix=""
          desc="Jadwal Hari Ini"
          button="Lihat Kalender"
          onClick={() => navigate("/petani/kalender")}
        />

        <KpiCard
          icon="💚"
          title="Skor Kesehatan"
          value={formatNumber(skorKesehatan, 1)}
          suffix="%"
          desc="Kesehatan Lahan"
          button="Detail AI"
          onClick={() => navigate("/petani/monitoring")}
        />
      </div>

      <div className="content-layout">
        <main className="main-stack">
          <section className="card map-card">
            <div className="card-title-row">
              <h3>🌾 Peta Monitoring Lahan</h3>

              <button
                className="small-map-btn"
                type="button"
                onClick={() => navigate("/petani/peta-lahan")}
              >
                Buka Peta Lengkap
              </button>
            </div>

            <div className="real-map-box">
              <MapContainer
                center={mapCenter}
                zoom={14}
                scrollWheelZoom={true}
                className="dashboard-leaflet"
                zoomControl={true}
              >
                <FitMapBounds points={mapLahanList} />

                <TileLayer
                  attribution="Tiles © Esri"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />

                <TileLayer
                  attribution="Labels © Esri"
                  url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                />

                {mapLahanList.map((item) => {
                  const pred = latestPrediksiByLahan.get(String(item.id));
                  const status = getRiskStatus(pred);

                  return (
                    <Marker
                      key={item.id}
                      position={[item.lat, item.lng]}
                      icon={makeMarkerIcon(status.color)}
                      eventHandlers={{
                        click: () => setSelectedMapLahan(item),
                      }}
                    >
                      <Popup>
                        <div className="popup-content">
                          <b>{item.nama_lahan || "Lahan Tanpa Nama"}</b>
                          <p>
                            {item.nama_desa || "-"},{" "}
                            {item.nama_kecamatan || "-"}
                          </p>
                          <p>
                            Luas:{" "}
                            {formatNumber(item.luas_ha || item.luas || 0, 2)} Ha
                          </p>
                          <p>Status: {status.label}</p>
                          <p>
                            Prediksi: {formatNumber(pred?.prediksi_ton || 0, 2)}{" "}
                            Ton
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>

              <div className="map-search-box">
                <span>🔍</span>
                <input placeholder="Cari lokasi lahan..." readOnly />
                <button type="button" onClick={() => navigate("/petani/peta-lahan")}>
                  ↗ Filter
                </button>
                <button type="button" onClick={() => navigate("/petani/tambah-lahan")}>
                  + Tambah Lahan
                </button>
              </div>

              <div className="legend-box">
                <LegendItem color="#16a34a" text="Lahan Aktif" />
                <LegendItem color="#facc15" text="Siap Panen" />
                <LegendItem color="#ef4444" text="Perlu Perhatian" />
                <LegendItem color="#9ca3af" text="Tidak Aktif" />
              </div>

              <div className="map-info">
                <div className="map-info-head">
                  <span style={{ background: mainStatus.color }}></span>
                  <h4>{mainLahan?.nama_lahan || "Lahan Saya"}</h4>
                  <em style={{ background: mainStatus.bg, color: mainStatus.text }}>
                    {mainStatus.label}
                  </em>
                </div>

                <InfoRow
                  label="Luas"
                  value={`${formatNumber(
                    mainLahan?.luas_ha || mainLahan?.luas || 0,
                    2
                  )} Ha`}
                />
                <InfoRow label="Tanaman" value="Padi" />
                <InfoRow label="Varietas" value={mainLahan?.varietas || "-"} />
                <InfoRow
                  label="Umur Tanaman"
                  value={`${getUmurTanaman(mainLahan)} Hari`}
                />
                <InfoRow
                  label="Prediksi Panen"
                  value={`${formatNumber(mainPrediksi?.prediksi_ton || 0, 2)} Ton`}
                />
                <InfoRow
                  label="Prediksi Kg"
                  value={`${formatNumber(mainPrediksi?.prediksi_kg || 0, 0)} Kg`}
                />

                <button type="button" onClick={() => navigate("/petani/peta-lahan")}>
                  Lihat Detail
                </button>
              </div>

              <div className="map-bottom-strip">
                <StripItem
                  icon="💡"
                  title="Tips Hari Ini"
                  desc="Lakukan pemupukan susulan untuk fase vegetatif tanaman padi."
                />
                <StripItem
                  icon="💧"
                  title={`${formatNumber(weather?.kelembapan || 78, 0)}%`}
                  desc="Kelembapan Tanah"
                />
                <StripItem
                  icon="🌧️"
                  title={`${formatNumber(weather?.curahHujan || 2, 0)} mm`}
                  desc="Curah Hujan"
                />
                <StripItem
                  icon="🌱"
                  title="Rekomendasi Pupuk"
                  desc="Urea 100 kg/ha, SP-36 75 kg/ha"
                />
              </div>

              {mapLahanList.length === 0 && (
                <div className="map-empty">
                  Belum ada data koordinat lahan. Pastikan tabel lahan punya
                  kolom lat dan lng.
                </div>
              )}
            </div>
          </section>

          <section className="card quick-section">
            <h3>Aksi Cepat</h3>

            <div className="quick-grid">
              <QuickAction
                icon="➕"
                title="Tambah Lahan"
                desc="Tambah lahan baru"
                onClick={() => navigate("/petani/tambah-lahan")}
              />

              <QuickAction
                icon="🌱"
                title="Monitoring Tanaman"
                desc="Lihat kondisi tanaman"
                onClick={() => navigate("/petani/monitoring")}
              />

              <QuickAction
                icon="📊"
                title="Prediksi Panen"
                desc="Lihat estimasi panen"
                onClick={() => navigate("/petani/prediksi")}
              />

              <QuickAction
                icon="🧪"
                title="Rekomendasi Pupuk"
                desc="Dapatkan rekomendasi"
                onClick={() => navigate("/petani/rekomendasi-pupuk")}
              />

              <QuickAction
                icon="🛡️"
                title="Deteksi Hama"
                desc="Cek hama & penyakit"
                onClick={() => navigate("/petani/monitoring")}
              />
            </div>
          </section>
        </main>

        <aside className="side-stack">
          <section className="card ringkasan-card">
            <div className="card-title-row">
              <h3>Ringkasan Lahan Saya</h3>
            </div>

            <div className="lahan-summary-list">
              {lahanList.length === 0 ? (
                <div className="empty-box">Belum ada lahan.</div>
              ) : (
                lahanList.slice(0, 4).map((item) => {
                  const pred = latestPrediksiByLahan.get(String(item.id));
                  const status = getRiskStatus(pred);

                  return (
                    <button
                      key={item.id}
                      className="lahan-summary-item"
                      type="button"
                      onClick={() => {
                        const mapItem = mapLahanList.find(
                          (lahan) => String(lahan.id) === String(item.id)
                        );

                        if (mapItem) {
                          setSelectedMapLahan(mapItem);
                        }
                      }}
                    >
                      <span
                        className="dot"
                        style={{ background: status.color }}
                      ></span>

                      <div>
                        <b>{item.nama_lahan || "Lahan Tanpa Nama"}</b>
                        <small>
                          {formatNumber(item.luas_ha || item.luas || 0, 2)} Ha •
                          Padi ({getUmurTanaman(item)} Hari)
                        </small>
                      </div>

                      <em style={{ background: status.bg, color: status.text }}>
                        {status.label}
                      </em>

                      <strong>›</strong>
                    </button>
                  );
                })
              )}
            </div>

            <button
              className="outline-full"
              type="button"
              onClick={() => navigate("/petani/lahan-saya")}
            >
              Kelola Lahan
            </button>
          </section>

          <section className="card weather-card">
            <h3>Cuaca Hari Ini</h3>

            <div className="weather-main">
              <span>🌤️</span>
              <div>
                <b>{formatNumber(weather?.suhu || 25, 0)}°C</b>
                <small>{weather?.kondisi || "Cerah Berawan"}</small>
              </div>
            </div>

            <div className="weather-row">
              <div>
                <small>Kelembapan</small>
                <b>{formatNumber(weather?.kelembapan || 78, 0)}%</b>
              </div>

              <div>
                <small>Curah Hujan</small>
                <b>{formatNumber(weather?.curahHujan || 2, 0)} mm</b>
              </div>
            </div>

            <button type="button" onClick={() => navigate("/petani/monitoring")}>
              Lihat Prakiraan Cuaca
            </button>
          </section>

          <section className="card notif-card">
            <h3>Peringatan & Notifikasi</h3>

            <div className="notif-list">
              {notificationData.map((item, index) => (
                <div className="notif-item" key={index}>
                  <span>{item.icon}</span>
                  <div>
                    <b>{item.title}</b>
                    <p>{item.desc}</p>
                    <small>{item.time}</small>
                  </div>
                </div>
              ))}
            </div>

            <button type="button" onClick={() => navigate("/petani/notifikasi")}>
              Lihat Semua Notifikasi
            </button>
          </section>

          <section className="card consult-card">
            <h3>Konsultasi Penyuluh</h3>

            <div className="consult-row">
              <div className="avatar">👨‍🌾</div>
              <div>
                <b>{latestKonsultasi?.nama_penyuluh || "Rudi"}</b>
                <small>Penyuluh Pertanian</small>
              </div>
              <span>● Online</span>
            </div>

            <div className="consult-actions">
              <button type="button" onClick={() => navigate("/petani/konsultasi")}>
                Chat Sekarang
              </button>
              <button type="button" onClick={() => navigate("/petani/konsultasi")}>
                Telepon
              </button>
            </div>
          </section>
        </aside>
      </div>

      {loading && <div className="loading-soft">Memuat data dashboard...</div>}

      <style>{`
        .dashboard-page {
          min-height: 100vh;
          background: #f6f8fb;
          padding: 24px;
          box-sizing: border-box;
          color: #0f172a;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .dash-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 18px;
          margin-bottom: 22px;
        }

        .dash-header h1 {
          margin: 0;
          font-size: 30px;
          font-weight: 900;
          color: #071225;
          letter-spacing: -0.8px;
        }

        .dash-header p {
          margin: 8px 0 0;
          color: #475569;
          font-size: 14px;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .weather-chip {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 16px;
          background: #ffffff;
          box-shadow: 0 10px 30px rgba(15, 23, 42, .07);
          border: 1px solid #e5e7eb;
          min-height: 58px;
        }

        .weather-chip .sun {
          font-size: 28px;
        }

        .weather-chip strong {
          font-size: 22px;
          display: block;
          line-height: 1;
        }

        .weather-chip small {
          display: block;
          font-size: 11px;
          color: #475569;
          line-height: 1.3;
        }

        .profile-chip {
          border: none;
          background: #fff;
          border-radius: 16px;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 9px 13px;
          cursor: pointer;
          box-shadow: 0 10px 30px rgba(15, 23, 42, .07);
          min-height: 58px;
        }

        .profile-chip span {
          font-size: 25px;
        }

        .profile-chip b {
          display: block;
          font-size: 13px;
          text-align: left;
        }

        .profile-chip small {
          display: block;
          color: #475569;
          font-size: 11px;
          text-align: left;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .kpi-card,
        .card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          box-shadow: 0 12px 32px rgba(15, 23, 42, .06);
        }

        .kpi-card {
          padding: 18px;
          min-width: 0;
        }

        .kpi-top {
          display: flex;
          align-items: center;
          gap: 13px;
          min-height: 74px;
        }

        .kpi-icon {
          width: 54px;
          height: 54px;
          border-radius: 14px;
          background: #ecfdf5;
          color: #047857;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 25px;
          flex-shrink: 0;
        }

        .kpi-card h4 {
          margin: 0 0 5px;
          font-size: 13px;
          color: #0f172a;
        }

        .kpi-card .value {
          font-size: 25px;
          font-weight: 900;
          color: #020617;
          display: flex;
          align-items: baseline;
          gap: 5px;
          line-height: 1;
        }

        .kpi-card .value small {
          font-size: 15px;
          font-weight: 800;
        }

        .kpi-card p {
          margin: 7px 0 0;
          font-size: 12px;
          color: #475569;
        }

        .kpi-card button {
          width: 100%;
          height: 39px;
          margin-top: 14px;
          border: 1px solid #d1d5db;
          border-radius: 10px;
          background: #fff;
          color: #047857;
          font-weight: 850;
          cursor: pointer;
        }

        .content-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 360px;
          gap: 18px;
          align-items: start;
        }

        .main-stack {
          display: grid;
          gap: 18px;
          min-width: 0;
        }

        .side-stack {
          display: grid;
          gap: 18px;
          min-width: 0;
        }

        .card {
          padding: 18px;
          box-sizing: border-box;
          min-width: 0;
        }

        .card h3 {
          margin: 0 0 16px;
          font-size: 18px;
          font-weight: 900;
          color: #111827;
        }

        .card-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .small-map-btn {
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #047857;
          height: 34px;
          border-radius: 9px;
          padding: 0 12px;
          font-weight: 850;
          cursor: pointer;
          white-space: nowrap;
        }

        .real-map-box {
          position: relative;
          height: 520px;
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid #d1fae5;
          background: #0f172a;
        }

        .dashboard-leaflet {
          width: 100%;
          height: 100%;
          z-index: 1;
        }

        .map-search-box {
          position: absolute;
          top: 18px;
          left: 18px;
          right: 18px;
          max-width: 520px;
          height: 46px;
          background: rgba(255,255,255,.96);
          border-radius: 14px;
          box-shadow: 0 12px 28px rgba(15,23,42,.18);
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 10px;
          z-index: 10;
        }

        .map-search-box input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 13px;
          background: transparent;
          color: #334155;
        }

        .map-search-box button {
          border: none;
          height: 32px;
          padding: 0 11px;
          border-radius: 8px;
          background: #ecfdf5;
          color: #047857;
          font-weight: 850;
          cursor: pointer;
          font-size: 12px;
          white-space: nowrap;
        }

        .legend-box {
          position: absolute;
          left: 18px;
          bottom: 95px;
          background: rgba(255,255,255,.94);
          padding: 12px;
          border-radius: 12px;
          z-index: 10;
          box-shadow: 0 10px 20px rgba(0,0,0,.14);
          min-width: 135px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          margin: 8px 0;
          color: #111827;
        }

        .legend-item i {
          width: 13px;
          height: 13px;
          display: inline-block;
          border-radius: 999px;
        }

        .map-info {
          position: absolute;
          right: 18px;
          top: 85px;
          width: 250px;
          background: rgba(255,255,255,.95);
          border-radius: 16px;
          padding: 16px;
          z-index: 10;
          box-shadow: 0 14px 30px rgba(15,23,42,.24);
        }

        .map-info-head {
          display: grid;
          grid-template-columns: 10px 1fr auto;
          align-items: center;
          gap: 9px;
          margin-bottom: 12px;
        }

        .map-info-head span {
          width: 10px;
          height: 10px;
          border-radius: 999px;
        }

        .map-info-head h4 {
          margin: 0;
          font-size: 15px;
          font-weight: 900;
        }

        .map-info-head em {
          padding: 5px 9px;
          border-radius: 8px;
          font-size: 11px;
          font-style: normal;
          font-weight: 900;
        }

        .map-info-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 6px 0;
          border-bottom: 1px solid #f1f5f9;
        }

        .map-info-row small {
          color: #64748b;
          font-size: 11px;
        }

        .map-info-row b {
          font-size: 12px;
          text-align: right;
        }

        .map-info button {
          width: 100%;
          margin-top: 12px;
          height: 36px;
          border: none;
          border-radius: 9px;
          background: #16a34a;
          color: #fff;
          font-weight: 850;
          cursor: pointer;
        }

        .map-bottom-strip {
          position: absolute;
          left: 18px;
          right: 18px;
          bottom: 18px;
          min-height: 58px;
          background: rgba(255,255,255,.94);
          border-radius: 14px;
          z-index: 10;
          box-shadow: 0 12px 26px rgba(15,23,42,.16);
          display: grid;
          grid-template-columns: 1.6fr 1fr 1fr 1.5fr;
          overflow: hidden;
        }

        .map-bottom-strip > div {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 12px 16px;
          border-right: 1px solid #e5e7eb;
          min-width: 0;
        }

        .map-bottom-strip > div:last-child {
          border-right: none;
        }

        .map-bottom-strip span {
          font-size: 22px;
          flex-shrink: 0;
        }

        .map-bottom-strip b {
          display: block;
          font-size: 13px;
        }

        .map-bottom-strip small {
          display: block;
          color: #64748b;
          font-size: 11px;
          margin-top: 3px;
          line-height: 1.35;
        }

        .map-empty {
          position: absolute;
          inset: 0;
          background: rgba(15,23,42,.68);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 20;
          font-weight: 800;
          text-align: center;
          padding: 24px;
        }

        .popup-content p {
          margin: 5px 0;
          font-size: 12px;
        }

        .lahan-summary-list {
          display: grid;
          gap: 4px;
        }

        .lahan-summary-item {
          width: 100%;
          display: grid;
          grid-template-columns: 14px minmax(0, 1fr) auto 16px;
          align-items: center;
          gap: 12px;
          border: none;
          background: transparent;
          padding: 13px 0;
          cursor: pointer;
          text-align: left;
          border-bottom: 1px solid #f1f5f9;
        }

        .lahan-summary-item:last-child {
          border-bottom: none;
        }

        .lahan-summary-item .dot {
          width: 14px;
          height: 14px;
          border-radius: 999px;
        }

        .lahan-summary-item b {
          display: block;
          font-size: 14px;
        }

        .lahan-summary-item small {
          display: block;
          color: #64748b;
          margin-top: 5px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .lahan-summary-item em {
          padding: 6px 12px;
          border-radius: 8px;
          font-style: normal;
          font-weight: 850;
          font-size: 12px;
          white-space: nowrap;
        }

        .outline-full {
          width: 100%;
          height: 43px;
          border: 1px solid #d1d5db;
          border-radius: 10px;
          background: #fff;
          color: #047857;
          font-weight: 850;
          cursor: pointer;
          margin-top: 10px;
        }

        .weather-main {
          display: flex;
          align-items: center;
          gap: 18px;
          margin: 14px 0 18px;
        }

        .weather-main span {
          width: 64px;
          height: 64px;
          border-radius: 18px;
          background: #eff6ff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 34px;
        }

        .weather-main b {
          display: block;
          font-size: 28px;
        }

        .weather-main small {
          color: #475569;
        }

        .weather-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          border-top: 1px solid #e5e7eb;
          border-bottom: 1px solid #e5e7eb;
          margin: 10px 0;
        }

        .weather-row div {
          padding: 13px 0;
        }

        .weather-row div + div {
          border-left: 1px solid #e5e7eb;
          padding-left: 14px;
        }

        .weather-row small {
          display: block;
          color: #64748b;
          margin-bottom: 5px;
        }

        .weather-card button,
        .notif-card button {
          width: 100%;
          height: 38px;
          border: none;
          background: #fff;
          color: #047857;
          font-weight: 850;
          cursor: pointer;
          border-radius: 9px;
        }

        .notif-list {
          display: grid;
          gap: 15px;
        }

        .notif-item {
          display: flex;
          gap: 13px;
          align-items: flex-start;
        }

        .notif-item > span {
          width: 42px;
          height: 42px;
          border-radius: 13px;
          background: #fef3c7;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .notif-item b {
          font-size: 13px;
        }

        .notif-item p {
          margin: 4px 0;
          font-size: 12px;
          color: #334155;
          line-height: 1.35;
        }

        .notif-item small {
          color: #94a3b8;
          font-size: 11px;
        }

        .consult-row {
          display: grid;
          grid-template-columns: 48px minmax(0, 1fr) auto;
          gap: 11px;
          align-items: center;
          margin-bottom: 18px;
        }

        .avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: #dcfce7;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 25px;
        }

        .consult-row b,
        .consult-row small {
          display: block;
        }

        .consult-row small {
          color: #64748b;
          margin-top: 4px;
        }

        .consult-row span {
          color: #16a34a;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .consult-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 4px;
        }

        .consult-actions button {
          height: 42px;
          border-radius: 10px;
          border: 1px solid #d1d5db;
          background: #fff;
          font-weight: 850;
          cursor: pointer;
        }

        .consult-actions button:first-child {
          background: #16a34a;
          color: #fff;
          border-color: #16a34a;
        }

        .quick-section {
          margin-top: 0;
        }

        .quick-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
        }

        .quick-card {
          border: 1px solid #e5e7eb;
          background: linear-gradient(135deg, #ffffff, #f8fafc);
          border-radius: 14px;
          padding: 15px;
          display: flex;
          align-items: center;
          gap: 13px;
          cursor: pointer;
          text-align: left;
        }

        .quick-card span {
          width: 42px;
          height: 42px;
          border-radius: 13px;
          background: #dcfce7;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          flex-shrink: 0;
        }

        .quick-card b {
          display: block;
          color: #047857;
          font-size: 14px;
        }

        .quick-card small {
          color: #475569;
          margin-top: 3px;
          display: block;
        }

        .empty-box {
          border: 1px dashed #cbd5e1;
          border-radius: 12px;
          padding: 16px;
          color: #64748b;
          font-size: 13px;
          background: #f8fafc;
        }

        .loading-soft {
          position: fixed;
          right: 24px;
          bottom: 24px;
          background: #064e3b;
          color: #fff;
          padding: 12px 16px;
          border-radius: 12px;
          box-shadow: 0 12px 26px rgba(0,0,0,.18);
          font-weight: 800;
          z-index: 50;
        }

        @media (max-width: 1450px) {
          .kpi-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .content-layout {
            grid-template-columns: 1fr;
          }

          .side-stack {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 980px) {
          .dashboard-page {
            padding: 16px;
          }

          .dash-header,
          .header-right {
            flex-direction: column;
            align-items: flex-start;
          }

          .kpi-grid,
          .quick-grid,
          .side-stack {
            grid-template-columns: 1fr;
          }

          .real-map-box {
            height: 620px;
          }

          .map-search-box {
            max-width: none;
            flex-wrap: wrap;
            height: auto;
            min-height: 46px;
            padding: 10px;
          }

          .map-info {
            left: 18px;
            right: 18px;
            top: auto;
            bottom: 170px;
            width: auto;
          }

          .map-bottom-strip {
            grid-template-columns: 1fr;
            max-height: 145px;
            overflow: auto;
          }

          .legend-box {
            bottom: 320px;
          }
        }
      `}</style>
    </div>
  );
}

function KpiCard({ icon, title, value, suffix, desc, button, onClick }) {
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <div className="kpi-icon">{icon}</div>

        <div>
          <h4>{title}</h4>
          <div className="value">
            {value}
            {suffix && <small>{suffix}</small>}
          </div>
          <p>{desc}</p>
        </div>
      </div>

      <button type="button" onClick={onClick}>
        {button}
      </button>
    </div>
  );
}

function LegendItem({ color, text }) {
  return (
    <div className="legend-item">
      <i style={{ background: color }}></i>
      {text}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="map-info-row">
      <small>{label}</small>
      <b>{value}</b>
    </div>
  );
}

function StripItem({ icon, title, desc }) {
  return (
    <div>
      <span>{icon}</span>
      <div>
        <b>{title}</b>
        <small>{desc}</small>
      </div>
    </div>
  );
}

function QuickAction({ icon, title, desc, onClick }) {
  return (
    <button className="quick-card" type="button" onClick={onClick}>
      <span>{icon}</span>

      <div>
        <b>{title}</b>
        <small>{desc}</small>
      </div>
    </button>
  );
}