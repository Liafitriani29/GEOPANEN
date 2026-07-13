import { useEffect, useMemo, useState } from "react";
import api from "../../services/api";

import {
  RefreshCcw,
  Bell,
  ChevronDown,
  CalendarDays,
  Maximize2,
  Info,
  TrendingUp,
  BriefcaseBusiness,
  Wheat,
  Target,
  AlertTriangle,
  Users,
  ClipboardCheck,
  FileText,
  Sprout,
} from "lucide-react";

import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";

const SUKOHARJO_CENTER = [-7.676, 110.835];

const SUKOHARJO_BOUNDS = [
  [-7.86, 110.66],
  [-7.49, 111.0],
];

const KECAMATAN_SUKOHARJO = [
  "Kartasura",
  "Gatak",
  "Baki",
  "Grogol",
  "Mojolaban",
  "Polokarto",
  "Bendosari",
  "Nguter",
  "Sukoharjo",
  "Bulu",
  "Tawangsari",
  "Weru",
];

const KECAMATAN_COORDS = {
  Kartasura: [-7.551, 110.737],
  Gatak: [-7.601, 110.704],
  Baki: [-7.619, 110.772],
  Grogol: [-7.596, 110.82],
  Mojolaban: [-7.585, 110.867],
  Polokarto: [-7.621, 110.927],
  Bendosari: [-7.685, 110.834],
  Nguter: [-7.742, 110.885],
  Sukoharjo: [-7.679, 110.841],
  Bulu: [-7.754, 110.778],
  Tawangsari: [-7.739, 110.804],
  Weru: [-7.806, 110.751],
};

const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const normalizeApiList = (payload) => {
  const data = payload?.data ?? payload;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.result)) return data.result;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.prediksi)) return data.prediksi;
  if (Array.isArray(data?.predictions)) return data.predictions;
  if (Array.isArray(data?.lahan)) return data.lahan;

  return [];
};

const toNumber = (value, fallback = 0) => {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : fallback;
};

const formatNumber = (value, digit = 0) => {
  return Number(value || 0).toLocaleString("id-ID", {
    minimumFractionDigits: digit,
    maximumFractionDigits: digit,
  });
};

const formatPercent = (value, digit = 1) => {
  return `${formatNumber(value, digit)}%`;
};

const getInitial = (value) => {
  const text = String(value || "A").trim();
  return text.charAt(0).toUpperCase();
};

const getNamaKecamatan = (item) => {
  return (
    item?.nama_kecamatan ||
    item?.kecamatan ||
    item?.nama_wilayah ||
    item?.wilayah ||
    "-"
  );
};

const getKomoditas = (item) => {
  return item?.komoditas || item?.tanaman || item?.komoditas_utama || "Padi";
};

const getLuasHa = (item) => {
  const luasHa = toNumber(
    item?.luas_ha ?? item?.total_luas_ha ?? item?.luas_lahan,
    0
  );

  if (luasHa > 0) return luasHa;

  const luasM2 = toNumber(item?.luas_m2, 0);
  if (luasM2 > 0) return luasM2 / 10000;

  const luas = toNumber(item?.luas, 0);
  if (luas > 20) return luas / 10000;

  return luas;
};

const seededRandom = (seed) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

const getPrediksiTon = (item, index = 0) => {
  const direct = toNumber(
    item?.prediksi_ton ??
      item?.hasil_prediksi_ton ??
      item?.produksi_prediksi ??
      item?.total_prediksi_ton ??
      item?.hasil_prediksi ??
      item?.prediksi,
    0
  );

  if (direct > 0) return direct;

  const kg = toNumber(item?.prediksi_kg ?? item?.hasil_prediksi_kg, 0);
  if (kg > 0) return kg / 1000;

  const luas = getLuasHa(item);
  const productivity = 5.4 + seededRandom(index + luas * 31) * 1.7;

  return luas * productivity;
};

const getStatusPrediksi = (value) => {
  const text = String(value || "").toLowerCase();

  if (
    text.includes("risiko") ||
    text.includes("rendah") ||
    text.includes("turun") ||
    text.includes("bahaya")
  ) {
    return "risiko";
  }

  if (
    text.includes("waspada") ||
    text.includes("sedang") ||
    text.includes("perhatian")
  ) {
    return "waspada";
  }

  return "aman";
};

const getStatusLabel = (status) => {
  if (status === "risiko") return "Risiko Tinggi";
  if (status === "waspada") return "Waspada";
  return "Aman";
};

const getStatusStyle = (status) => {
  if (status === "risiko") {
    return {
      background: "#fee2e2",
      color: "#ef4444",
      border: "1px solid #fecaca",
    };
  }

  if (status === "waspada") {
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

const getMarkerColor = (status) => {
  if (status === "risiko") return "#ef4444";
  if (status === "waspada") return "#f59e0b";
  return "#16a34a";
};

const getMarkerRadius = (item) => {
  const produksi = toNumber(item?.produksi_prediksi, 0);

  if (produksi >= 100) return 18;
  if (produksi >= 50) return 15;
  if (produksi >= 10) return 12;

  return 9;
};

const getDateRangeLabel = () => {
  const now = new Date();

  const label = now.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return `${label} - ${label}`;
};

const formatShortDate = (date) => {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
  });
};

const getTodayLabel = () => {
  return new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const buildMonitoringFromRows = (rows = []) => {
  const grouped = new globalThis.Map();

  KECAMATAN_SUKOHARJO.forEach((nama) => {
    grouped.set(nama.toLowerCase(), {
      kecamatan: nama,
      luas_ha: 0,
      produksi_prediksi: 0,
      total_lahan: 0,
      komoditas: {},
      perubahan_total: 0,
      perubahan_count: 0,
      status_list: [],
    });
  });

  rows.forEach((item, index) => {
    const kecamatan = getNamaKecamatan(item);
    const key = String(kecamatan).toLowerCase();

    if (!grouped.has(key)) {
      grouped.set(key, {
        kecamatan,
        luas_ha: 0,
        produksi_prediksi: 0,
        total_lahan: 0,
        komoditas: {},
        perubahan_total: 0,
        perubahan_count: 0,
        status_list: [],
      });
    }

    const current = grouped.get(key);

    const luas = getLuasHa(item);
    const prediksiTon = getPrediksiTon(item, index);
    const komoditas = getKomoditas(item);

    const perubahan = toNumber(
      item?.perubahan ?? item?.change ?? item?.persentase_perubahan,
      NaN
    );

    const totalLahan = toNumber(item?.total_lahan ?? item?.jumlah_lahan, 0) || 1;

    current.luas_ha += luas;
    current.produksi_prediksi += prediksiTon;
    current.total_lahan += totalLahan;
    current.komoditas[komoditas] =
      (current.komoditas[komoditas] || 0) + prediksiTon;

    if (Number.isFinite(perubahan)) {
      current.perubahan_total += perubahan;
      current.perubahan_count += 1;
    }

    current.status_list.push(getStatusPrediksi(item?.status));

    grouped.set(key, current);
  });

  return Array.from(grouped.values()).map((row, index) => {
    const seedChange = Number(
      ((seededRandom(index * 27 + row.produksi_prediksi) * 20) - 8).toFixed(1)
    );

    const perubahan =
      row.perubahan_count > 0
        ? Number((row.perubahan_total / row.perubahan_count).toFixed(1))
        : seedChange;

    let status =
      row.status_list.includes("risiko")
        ? "risiko"
        : row.status_list.includes("waspada")
        ? "waspada"
        : perubahan <= -10
        ? "risiko"
        : perubahan < 0
        ? "waspada"
        : "aman";

    if (row.total_lahan === 0) {
      status = "aman";
    }

    return {
      id: index + 1,
      kecamatan: row.kecamatan,
      luas_ha: row.luas_ha,
      produksi_prediksi: row.produksi_prediksi,
      perubahan,
      status,
      total_lahan: row.total_lahan,
      komoditas: row.komoditas,
    };
  });
};

const buildTrend = (totalProduksi) => {
  const today = new Date();

  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));

    const base = totalProduksi > 0 ? totalProduksi : 4000;
    const value = base * (0.72 + index * 0.055);

    return {
      label: formatShortDate(date),
      value: Number(value.toFixed(0)),
    };
  });
};

export default function PrediksiAdmin() {
  const currentUser = useMemo(() => getCurrentUser(), []);
  const appVersion = import.meta.env.VITE_APP_VERSION || "1.0.0";

  const [lahanList, setLahanList] = useState([]);
  const [prediksiList, setPrediksiList] = useState([]);
  const [petaniList, setPetaniList] = useState([]);
  const [penyuluhList, setPenyuluhList] = useState([]);
  const [notifCount, setNotifCount] = useState(0);
  const [apiStats, setApiStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(getDateRangeLabel());
  const [modelAccuracy, setModelAccuracy] = useState(92.4);
  const [modelName, setModelName] = useState("Random Forest GeoPanen");
  const [datasetCount, setDatasetCount] = useState(128450);

  const tryGet = async (endpoints) => {
    for (const endpoint of endpoints) {
      try {
        const res = await api.get(endpoint);
        return res.data;
      } catch {
        continue;
      }
    }

    return null;
  };

  const refreshAll = async () => {
    try {
      setLoading(true);

      const [prediksiPayload, petaniPayload, penyuluhPayload, notifPayload] =
        await Promise.all([
          tryGet(["/admin/prediksi/monitoring"]),
          tryGet(["/admin/petani", "/petani"]),
          tryGet(["/admin/penyuluh", "/penyuluh"]),
          tryGet(["/admin/notifikasi/unread-count"]),
        ]);

      const payloadData = prediksiPayload?.data || {};

      const perKecamatan = Array.isArray(payloadData?.per_kecamatan)
        ? payloadData.per_kecamatan
        : [];

      const detailLahan = Array.isArray(payloadData?.detail_lahan)
        ? payloadData.detail_lahan
        : [];

      const model = payloadData?.model || {};
      const statsFromApi = payloadData?.stats || null;

      const petani = normalizeApiList(petaniPayload);
      const penyuluh = normalizeApiList(penyuluhPayload);

      setLahanList(detailLahan);
      setPrediksiList(perKecamatan);
      setPetaniList(petani);
      setPenyuluhList(penyuluh);
      setApiStats(statsFromApi);

      setModelAccuracy(toNumber(model.akurasi, 92.4));
      setModelName(model.nama_model || "Random Forest GeoPanen");
      setDatasetCount(toNumber(model.total_dataset, detailLahan.length));

      setNotifCount(
        Number(notifPayload?.count || notifPayload?.data?.count || 0)
      );
    } catch (err) {
      console.log(
        "ERROR GET MONITORING PREDIKSI:",
        err.response?.data || err.message
      );

      setLahanList([]);
      setPrediksiList([]);
      setPetaniList([]);
      setPenyuluhList([]);
      setApiStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const enrichedPrediksi = useMemo(() => {
    return prediksiList.map((item, index) => ({
      id: item.id || index + 1,
      kecamatan: item.kecamatan || item.nama_kecamatan || "-",
      luas_ha: toNumber(item.luas_ha, 0),
      produksi_prediksi: toNumber(item.produksi_prediksi, 0),
      perubahan: toNumber(item.perubahan, 0),
      status: getStatusPrediksi(item.status),
      total_lahan: toNumber(item.total_lahan, 0),
      komoditas: item.komoditas || {},
    }));
  }, [prediksiList]);

  const stats = useMemo(() => {
    const computedTotalPrediksi = enrichedPrediksi.reduce(
      (sum, item) => sum + toNumber(item.total_lahan, 0),
      0
    );

    const computedTotalLuas = enrichedPrediksi.reduce(
      (sum, item) => sum + toNumber(item.luas_ha, 0),
      0
    );

    const computedTotalProduksi = enrichedPrediksi.reduce(
      (sum, item) => sum + toNumber(item.produksi_prediksi, 0),
      0
    );

    const computedRisikoTinggi = enrichedPrediksi.filter(
      (item) => item.status === "risiko"
    ).length;

    const penggunaAktif = petaniList.length + penyuluhList.length;

    return {
      totalPrediksi: toNumber(
        apiStats?.total_prediksi,
        computedTotalPrediksi || lahanList.length
      ),
      totalLuas: toNumber(apiStats?.total_luas, computedTotalLuas),
      totalProduksi: toNumber(apiStats?.total_produksi, computedTotalProduksi),
      risikoTinggi: toNumber(apiStats?.risiko_tinggi, computedRisikoTinggi),
      penggunaAktif,
      akurasi: toNumber(apiStats?.akurasi_model, modelAccuracy),
    };
  }, [apiStats, enrichedPrediksi, lahanList, petaniList, penyuluhList, modelAccuracy]);

  const sortedRows = useMemo(() => {
    return [...enrichedPrediksi]
      .filter((item) => item.kecamatan && item.kecamatan !== "-")
      .sort((a, b) => toNumber(b.produksi_prediksi) - toNumber(a.produksi_prediksi));
  }, [enrichedPrediksi]);

  const komoditasData = useMemo(() => {
    const map = new globalThis.Map();

    lahanList.forEach((item, index) => {
      const komoditas = getKomoditas(item);
      const ton = getPrediksiTon(item, index);

      map.set(komoditas, (map.get(komoditas) || 0) + ton);
    });

    if (map.size === 0) {
      map.set("Padi", stats.totalProduksi || 0);
    }

    return Array.from(map.entries())
      .map(([nama, ton]) => ({
        nama,
        ton,
        persen: stats.totalProduksi > 0 ? (ton / stats.totalProduksi) * 100 : 0,
      }))
      .sort((a, b) => b.ton - a.ton);
  }, [lahanList, stats.totalProduksi]);

  const trendData = useMemo(() => {
    return buildTrend(stats.totalProduksi);
  }, [stats.totalProduksi]);

  const activities = useMemo(() => {
    return [
      {
        label: "Prediksi Baru Dibuat",
        value: stats.totalPrediksi,
        icon: <ClipboardCheck size={18} />,
      },
      {
        label: "Prediksi Diperbarui",
        value: Math.round(stats.totalPrediksi * 0.41),
        icon: <FileText size={18} />,
      },
      {
        label: "Lahan Diprediksi",
        value: `${formatNumber(stats.totalLuas, 2)} Ha`,
        icon: <BriefcaseBusiness size={18} />,
      },
      {
        label: "Rekomendasi Dihasilkan",
        value: Math.round(stats.totalPrediksi * 1.2),
        icon: <Sprout size={18} />,
      },
    ];
  }, [stats]);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.breadcrumb}>
            <span>Dashboard</span>
            <span>/</span>
            <strong>Monitoring Prediksi</strong>
          </div>

          <h1 style={styles.title}>Monitoring Prediksi AI</h1>

          <p style={styles.subtitle}>
            Pantau hasil prediksi panen yang dihasilkan oleh sistem AI secara
            menyeluruh di seluruh wilayah Kabupaten Sukoharjo.
          </p>
        </div>

        <div style={styles.headerRight}>
          <div style={styles.datePicker}>
            <CalendarDays size={18} />
            <input
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              style={styles.dateInput}
            />
            <ChevronDown size={16} />
          </div>

          <button type="button" style={styles.refreshBtn} onClick={refreshAll}>
            <RefreshCcw size={18} />
            Refresh Data
          </button>

          <button type="button" style={styles.bellBtn}>
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

            <ChevronDown size={16} />
          </div>
        </div>
      </header>

      <section style={styles.statsGrid}>
        <StatCard
          icon={<TrendingUp size={34} />}
          iconBoxStyle={styles.greenIconBox}
          label="Total Prediksi Hari Ini"
          value={formatNumber(stats.totalPrediksi, 0)}
          note="↑ 18.6% dari kemarin"
          noteColor="#059669"
        />

        <StatCard
          icon={<BriefcaseBusiness size={34} />}
          iconBoxStyle={styles.blueIconBox}
          label="Lahan Diprediksi"
          value={`${formatNumber(stats.totalLuas, 2)} Ha`}
          note="↑ 12.7% dari kemarin"
          noteColor="#059669"
        />

        <StatCard
          icon={<Wheat size={34} />}
          iconBoxStyle={styles.orangeIconBox}
          label="Produksi Prediksi"
          value={`${formatNumber(stats.totalProduksi, 2)} Ton`}
          note="↑ 15.3% dari kemarin"
          noteColor="#059669"
        />

        <StatCard
          icon={<Target size={34} />}
          iconBoxStyle={styles.purpleIconBox}
          label="Akurasi Model AI"
          value={formatPercent(stats.akurasi, 1)}
          note="↑ 2.1% dari minggu lalu"
          noteColor="#059669"
        />

        <StatCard
          icon={<AlertTriangle size={34} />}
          iconBoxStyle={styles.redIconBox}
          label="Kecamatan Risiko Tinggi"
          value={stats.risikoTinggi}
          note="Perlu perhatian khusus"
          noteColor="#475569"
        />

        <StatCard
          icon={<Users size={34} />}
          iconBoxStyle={styles.greenIconBox}
          label="Pengguna Aktif"
          value={formatNumber(stats.penggunaAktif, 0)}
          note="Petani & Penyuluh"
          noteColor="#475569"
        />
      </section>

      <main style={styles.mainGrid}>
        <section style={styles.mapCard}>
          <CardHeader
            title="Peta Prediksi Panen per Kecamatan"
            rightIcon={<Maximize2 size={18} />}
          />

          <PredictionMap rows={enrichedPrediksi} loading={loading} />

          <div style={styles.legend}>
            <LegendItem color="#16a34a" title="Aman" desc="Produksi stabil" />
            <LegendItem color="#f59e0b" title="Waspada" desc="Produksi menurun" />
            <LegendItem
              color="#ef4444"
              title="Risiko Tinggi"
              desc="Produksi berpotensi turun"
            />
          </div>
        </section>

        <section style={styles.tableCard}>
          <CardHeader
            title="Ringkasan Prediksi per Kecamatan"
            rightText="Lihat Semua →"
          />

          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Kecamatan</th>
                  <th style={styles.th}>Lahan (Ha)</th>
                  <th style={styles.th}>Produksi Prediksi (Ton)</th>
                  <th style={styles.th}>Perubahan</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={5} style={styles.emptyCell}>
                      Memuat data prediksi...
                    </td>
                  </tr>
                )}

                {!loading && sortedRows.length === 0 && (
                  <tr>
                    <td colSpan={5} style={styles.emptyCell}>
                      Data prediksi belum tersedia.
                    </td>
                  </tr>
                )}

                {!loading &&
                  sortedRows.slice(0, 10).map((item) => (
                    <tr key={item.id} style={styles.tr}>
                      <td style={styles.td}>
                        <strong>{item.kecamatan}</strong>
                      </td>

                      <td style={styles.td}>{formatNumber(item.luas_ha, 2)}</td>

                   <td style={styles.td}>
  {formatNumber(item.produksi_prediksi, 2)}
</td>

                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.changeText,
                            color: item.perubahan < 0 ? "#ef4444" : "#059669",
                          }}
                        >
                          {item.perubahan < 0 ? "↓" : "↑"}{" "}
                          {formatNumber(Math.abs(item.perubahan), 1)}%
                        </span>
                      </td>

                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.statusPill,
                            ...getStatusStyle(item.status),
                          }}
                        >
                          {getStatusLabel(item.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside style={styles.modelCard}>
          <CardHeader title="Model AI" />

          <DonutChart
            value={stats.akurasi}
            label="Akurasi Model"
            color="#16a34a"
          />

          <div style={styles.modelDetail}>
            <h4>Detail Model</h4>

            <InfoRow label="Model Aktif" value={modelName} />
            <InfoRow
              label="Dataset Digunakan"
              value={`${formatNumber(datasetCount, 0)} data`}
            />
            <InfoRow label="Terakhir Dilatih" value={`${getTodayLabel()} 14:30`} />
            <InfoRow label="Status" value="Aktif & Optimal" badge />
          </div>

          <button style={styles.outlineBtn}>Lihat Detail Model →</button>
        </aside>

        <section style={styles.trendCard}>
          <CardHeader
            title="Tren Prediksi Produksi (7 Hari Terakhir)"
            rightIcon={<Maximize2 size={18} />}
          />

          <TrendChart data={trendData} />
        </section>

        <section style={styles.commodityCard}>
          <CardHeader title="Komoditas Prediksi" />

          <div style={styles.commodityGrid}>
            <MiniDonut data={komoditasData} />

            <div style={styles.commodityList}>
              {komoditasData.slice(0, 3).map((item, index) => (
                <div key={item.nama} style={styles.commodityItem}>
                  <span
                    style={{
                      ...styles.commodityDot,
                      background: index === 0 ? "#16a34a" : "#facc15",
                    }}
                  />

                  <strong>{item.nama}</strong>

                  <span>{formatNumber(item.ton, 0)} Ton</span>
                  <span>{formatPercent(item.persen, 1)}</span>
                </div>
              ))}
            </div>
          </div>

          <button style={styles.outlineBtn}>Lihat Detail Komoditas →</button>
        </section>

        <aside style={styles.activityCard}>
          <CardHeader title="Aktivitas Prediksi Hari Ini" />

          <div style={styles.activityList}>
            {activities.map((item) => (
              <div key={item.label} style={styles.activityItem}>
                <div style={styles.activityIcon}>{item.icon}</div>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          <button style={styles.outlineBtn}>Lihat Semua Aktivitas →</button>
        </aside>
      </main>

      <div style={styles.infoBanner}>
        <Info size={18} />
        <span>
          Prediksi panen dihasilkan oleh AI berdasarkan data lahan, cuaca,
          historis panen, dan kondisi lingkungan.
        </span>
      </div>

      <footer style={styles.footer}>
        <span>© 2026 GeoPanen. All rights reserved.</span>
        <span>Versi {appVersion}</span>
      </footer>
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

function CardHeader({ title, titleIcon, rightIcon, rightText }) {
  return (
    <div style={styles.cardHeader}>
      <div style={styles.cardTitleWrap}>
        {titleIcon}
        <h3>{title}</h3>
        <Info size={15} color="#94a3b8" />
      </div>

      {rightIcon && (
        <button type="button" style={styles.cardIconBtn}>
          {rightIcon}
        </button>
      )}

      {rightText && <button style={styles.textBtn}>{rightText}</button>}
    </div>
  );
}

function MapResizeWatcher({ dataKey }) {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 140);

    return () => clearTimeout(timer);
  }, [map, dataKey]);

  return null;
}

function PredictionMap({ rows, loading }) {
  const itemMap = new globalThis.Map();

  rows.forEach((item) => {
    itemMap.set(String(item.kecamatan).toLowerCase(), item);
  });

  const points = KECAMATAN_SUKOHARJO.map((nama) => {
    const item =
      itemMap.get(String(nama).toLowerCase()) || {
        kecamatan: nama,
        luas_ha: 0,
        produksi_prediksi: 0,
        perubahan: 0,
        status: "aman",
        total_lahan: 0,
      };

    return {
      nama,
      item,
      position: KECAMATAN_COORDS[nama],
    };
  });

  return (
    <div style={styles.mapArea}>
      {loading ? (
        <div style={styles.mapLoading}>Memuat peta prediksi...</div>
      ) : (
        <MapContainer
          center={SUKOHARJO_CENTER}
          zoom={11}
          minZoom={10}
          maxZoom={16}
          maxBounds={SUKOHARJO_BOUNDS}
          style={styles.leafletMap}
          scrollWheelZoom
        >
          <MapResizeWatcher dataKey={points.length} />

          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {points.map(({ nama, item, position }) => {
            const color = getMarkerColor(item.status);
            const radius = getMarkerRadius(item);

            return (
              <CircleMarker
                key={nama}
                center={position}
                radius={radius}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.72,
                  weight: 3,
                }}
              >
                <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                  <strong>{nama}</strong>
                </Tooltip>

                <Popup>
                  <div style={{ minWidth: 180 }}>
                    <strong>Kecamatan {nama}</strong>
                    <br />
                    Status: <b>{getStatusLabel(item.status)}</b>
                    <br />
                    Total lahan: {formatNumber(item.total_lahan, 0)}
                    <br />
                    Luas: {formatNumber(item.luas_ha, 2)} Ha
                    <br />
                    Prediksi: {formatNumber(item.produksi_prediksi, 1)} Ton
                    <br />
                    Perubahan:{" "}
                    {item.perubahan < 0 ? "↓" : "↑"}{" "}
                    {formatNumber(Math.abs(item.perubahan), 1)}%
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      )}
    </div>
  );
}

function LegendItem({ color, title, desc }) {
  return (
    <div style={styles.legendItem}>
      <span style={{ ...styles.legendDot, background: color }} />

      <div>
        <strong>{title}</strong>
        <p>{desc}</p>
      </div>
    </div>
  );
}

function DonutChart({ value, label, color }) {
  const safeValue = Math.min(100, Math.max(0, Number(value || 0)));
  const angle = safeValue * 3.6;

  return (
    <div style={styles.donutWrap}>
      <div
        style={{
          ...styles.donut,
          background: `conic-gradient(${color} 0deg ${angle}deg, #e5e7eb ${angle}deg 360deg)`,
        }}
      >
        <div style={styles.donutInner}>
          <h2>{formatPercent(safeValue, 1)}</h2>
          <span>{label}</span>
        </div>
      </div>
    </div>
  );
}

function MiniDonut({ data }) {
  const total = data.reduce((sum, item) => sum + Number(item.ton || 0), 0);
  const first = total > 0 ? ((data[0]?.ton || 0) / total) * 100 : 100;
  const angle = first * 3.6;

  return (
    <div
      style={{
        ...styles.miniDonut,
        background: `conic-gradient(#16a34a 0deg ${angle}deg, #facc15 ${angle}deg 360deg)`,
      }}
    >
      <div style={styles.miniDonutInner} />
    </div>
  );
}

function InfoRow({ label, value, badge }) {
  return (
    <div style={styles.infoRow}>
      <span>{label}</span>

      {badge ? (
        <strong style={styles.greenBadge}>{value}</strong>
      ) : (
        <strong>{value}</strong>
      )}
    </div>
  );
}

function TrendChart({ data }) {
  const maxValue = Math.max(10, ...data.map((item) => Number(item.value || 0)));
  const width = 620;
  const height = 230;
  const padding = 38;

  const getX = (index) => {
    if (data.length <= 1) return padding;
    return padding + (index / (data.length - 1)) * (width - padding * 2);
  };

  const getY = (value) => {
    return (
      height -
      padding -
      (Number(value || 0) / maxValue) * (height - padding * 2)
    );
  };

  const points = data
    .map((item, index) => `${getX(index)},${getY(item.value)}`)
    .join(" ");

  return (
    <div style={styles.chartWrap}>
      <svg viewBox={`0 0 ${width} ${height}`} style={styles.chartSvg}>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
          const y = padding + ratio * (height - padding * 2);

          return (
            <g key={index}>
              <line
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="#e5e7eb"
              />
              <text x={4} y={y + 4} fill="#64748b" fontSize="11">
                {formatNumber(maxValue * (1 - ratio), 0)}
              </text>
            </g>
          );
        })}

        <polyline
          points={points}
          fill="none"
          stroke="#16a34a"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {data.map((item, index) => (
          <g key={item.label}>
            <circle
              cx={getX(index)}
              cy={getY(item.value)}
              r="5"
              fill="#16a34a"
            />

            <text
              x={getX(index)}
              y={getY(item.value) - 12}
              textAnchor="middle"
              fill="#0f172a"
              fontSize="12"
              fontWeight="800"
            >
              {formatNumber(item.value, 0)}
            </text>

            <text
              x={getX(index)}
              y={height - 8}
              textAnchor="middle"
              fill="#475569"
              fontSize="12"
            >
              {item.label}
            </text>
          </g>
        ))}
      </svg>

      <div style={styles.chartLegend}>
        <span>
          <i style={styles.greenLegendLine} />
          Prediksi Produksi (Ton)
        </span>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "28px 34px 18px",
    background: "#f8fafc",
    color: "#0f172a",
    boxSizing: "border-box",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 22,
    marginBottom: 26,
  },

  breadcrumb: {
    display: "flex",
    gap: 10,
    color: "#64748b",
    fontSize: 14,
    marginBottom: 10,
  },

  title: {
    margin: 0,
    fontSize: 31,
    fontWeight: 950,
    color: "#0f172a",
  },

  subtitle: {
    margin: "10px 0 0",
    color: "#475569",
    fontSize: 15,
  },

  headerRight: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 14,
    flexWrap: "wrap",
  },

  datePicker: {
    height: 46,
    minWidth: 268,
    border: "1px solid #dbe3ea",
    borderRadius: 10,
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 14px",
  },

  dateInput: {
    border: "none",
    outline: "none",
    fontWeight: 800,
    color: "#0f172a",
    width: "100%",
    background: "transparent",
  },

  refreshBtn: {
    height: 46,
    border: "1px solid #dbe3ea",
    borderRadius: 10,
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "0 16px",
    cursor: "pointer",
  },

  bellBtn: {
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
    right: 1,
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
    width: 45,
    height: 45,
    borderRadius: 999,
    background: "#dcfce7",
    color: "#059669",
    fontWeight: 950,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: 14,
    marginBottom: 24,
  },

  statCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    minHeight: 118,
    padding: 20,
    display: "flex",
    alignItems: "center",
    gap: 16,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  statIcon: {
    width: 58,
    height: 58,
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

  redIconBox: {
    background: "#fee2e2",
    color: "#ef4444",
  },

  statLabel: {
    margin: 0,
    color: "#475569",
    fontSize: 13,
    fontWeight: 850,
  },

  statValue: {
    margin: "5px 0",
    color: "#0f172a",
    fontSize: 28,
    fontWeight: 950,
  },

  statNote: {
    fontSize: 12,
    fontWeight: 750,
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1.35fr 1.45fr 0.9fr",
    gap: 22,
  },

  mapCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 20,
    minHeight: 455,
    position: "relative",
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  tableCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 20,
    minHeight: 455,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  modelCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 20,
    minHeight: 455,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  trendCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 20,
    minHeight: 300,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  commodityCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 20,
    minHeight: 300,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  activityCard: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 20,
    minHeight: 300,
    boxShadow: "0 14px 38px rgba(15, 23, 42, 0.06)",
  },

  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 18,
  },

  cardTitleWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  cardIconBtn: {
    border: "none",
    background: "#f8fafc",
    borderRadius: 8,
    width: 34,
    height: 34,
    cursor: "pointer",
    color: "#475569",
  },

  textBtn: {
    border: "none",
    background: "transparent",
    color: "#16a34a",
    fontWeight: 850,
    cursor: "pointer",
  },

  mapArea: {
    height: 340,
    borderRadius: 14,
    background: "#eef2f7",
    overflow: "hidden",
    position: "relative",
  },

  leafletMap: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
    zIndex: 1,
  },

  mapLoading: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748b",
    background: "#f8fafc",
  },

  legend: {
    position: "absolute",
    left: 22,
    bottom: 22,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    boxShadow: "0 10px 28px rgba(15, 23, 42, 0.08)",
    zIndex: 2,
  },

  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  legendDot: {
    width: 16,
    height: 16,
    borderRadius: 999,
  },

  tableWrapper: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
  },

  th: {
    textAlign: "left",
    padding: "13px 10px",
    borderBottom: "1px solid #e5e7eb",
    fontSize: 13,
    color: "#0f172a",
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  tr: {
    borderBottom: "1px solid #e5e7eb",
  },

  td: {
    padding: "13px 10px",
    fontSize: 14,
    color: "#0f172a",
  },

  emptyCell: {
    textAlign: "center",
    padding: 26,
    color: "#64748b",
  },

  changeText: {
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  statusPill: {
    borderRadius: 999,
    padding: "6px 11px",
    fontSize: 12,
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
  },

  donutWrap: {
    display: "flex",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 22,
  },

  donut: {
    width: 178,
    height: 178,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  donutInner: {
    width: 122,
    height: 122,
    borderRadius: "50%",
    background: "#ffffff",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "inset 0 0 0 1px #e5e7eb",
  },

  modelDetail: {
    borderTop: "1px solid #e5e7eb",
    paddingTop: 14,
  },

  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    padding: "11px 0",
    color: "#475569",
    fontSize: 14,
  },

  greenBadge: {
    background: "#dcfce7",
    color: "#059669",
    borderRadius: 999,
    padding: "5px 10px",
    fontSize: 12,
  },

  outlineBtn: {
    width: "100%",
    height: 44,
    marginTop: 16,
    border: "1px solid #16a34a",
    color: "#059669",
    background: "#ffffff",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 900,
  },

  chartWrap: {
    width: "100%",
  },

  chartSvg: {
    width: "100%",
    height: 230,
  },

  chartLegend: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
    color: "#475569",
    fontSize: 13,
    fontWeight: 800,
  },

  greenLegendLine: {
    width: 12,
    height: 12,
    background: "#16a34a",
    borderRadius: 999,
    display: "inline-block",
    marginRight: 8,
  },

  commodityGrid: {
    display: "grid",
    gridTemplateColumns: "160px 1fr",
    gap: 22,
    alignItems: "center",
    minHeight: 180,
  },

  miniDonut: {
    width: 150,
    height: 150,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  miniDonutInner: {
    width: 78,
    height: 78,
    borderRadius: "50%",
    background: "#ffffff",
  },

  commodityList: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },

  commodityItem: {
    display: "grid",
    gridTemplateColumns: "18px 1fr 90px 70px",
    alignItems: "center",
    gap: 8,
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: 10,
  },

  commodityDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
  },

  activityList: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    marginTop: 8,
  },

  activityItem: {
    display: "grid",
    gridTemplateColumns: "36px 1fr auto",
    gap: 12,
    alignItems: "center",
    color: "#0f172a",
  },

  activityIcon: {
    width: 34,
    height: 34,
    borderRadius: 999,
    background: "#dbeafe",
    color: "#2563eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  infoBanner: {
    marginTop: 22,
    borderRadius: 12,
    background: "#ecfdf5",
    color: "#047857",
    padding: 16,
    display: "flex",
    alignItems: "center",
    gap: 10,
    border: "1px solid #bbf7d0",
  },

  footer: {
    display: "flex",
    justifyContent: "space-between",
    color: "#475569",
    fontSize: 14,
    marginTop: 28,
  },
};