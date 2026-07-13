import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import PetaniNotificationBell from "../../components/PetaniNotificationBell";

const API_NODE =
  import.meta.env.VITE_API_URL || "http://localhost:3000/api";

const API_FASTAPI =
  import.meta.env.VITE_FASTAPI_URL || "http://127.0.0.1:8000";

const REKOMENDASI_ENDPOINT =
  import.meta.env.VITE_REKOMENDASI_PUPUK_URL ||
  `${API_FASTAPI.replace(/\/+$/, "")}/rekomendasi/generate`;

const FASE_TANAMAN = [
  {
    value: "vegetatif_awal",
    label: "Vegetatif Awal",
    umur: "0 - 30 Hari",
  },
  {
    value: "vegetatif_akhir",
    label: "Vegetatif Akhir",
    umur: "31 - 55 Hari",
  },
  {
    value: "generatif",
    label: "Generatif",
    umur: "56 - 95 Hari",
  },
  {
    value: "pematangan",
    label: "Pematangan",
    umur: "96 Hari ke atas",
  },
];

// Acuan pupuk tunggal tanaman padi sawah Kabupaten Sukoharjo
// Sumber: Badan Litbang Pertanian, Kementerian Pertanian (2020),
// Rekomendasi Pupuk N, P, dan K Spesifik Lokasi, Buku I Padi.
// Nilai adalah total rekomendasi satu musim dalam kg/ha, bukan dosis sekali aplikasi.
const ACUAN_PUPUK_KEMENTAN_2020_SUKOHARJO = {
  WERU: { kecamatan: "Weru", urea: 300, za: 0, sp36: 75, kcl: 50 },
  BULU: { kecamatan: "Bulu", urea: 300, za: 0, sp36: 75, kcl: 50 },
  TAWANGSARI: { kecamatan: "Tawangsari", urea: 300, za: 0, sp36: 75, kcl: 50 },
  SUKOHARJO: { kecamatan: "Sukoharjo", urea: 300, za: 0, sp36: 75, kcl: 50 },
  NGUTER: { kecamatan: "Nguter", urea: 300, za: 0, sp36: 75, kcl: 100 },
  BENDOSARI: { kecamatan: "Bendosari", urea: 300, za: 0, sp36: 75, kcl: 100 },
  POLOKARTO: { kecamatan: "Polokarto", urea: 300, za: 0, sp36: 75, kcl: 100 },
  MOJOLABAN: { kecamatan: "Mojolaban", urea: 300, za: 0, sp36: 75, kcl: 50 },
  GROGOL: { kecamatan: "Grogol", urea: 300, za: 0, sp36: 75, kcl: 50 },
  BAKI: { kecamatan: "Baki", urea: 300, za: 0, sp36: 75, kcl: 50 },
  GATAK: { kecamatan: "Gatak", urea: 300, za: 0, sp36: 75, kcl: 50 },
  KARTASURA: { kecamatan: "Kartasura", urea: 300, za: 0, sp36: 75, kcl: 50 },
};

const normalizeLocationKey = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const normalizeFertilizerKey = (value) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");

const getAcuanPupukKecamatan = (lahan) => {
  const kecamatan =
    lahan?.nama_kecamatan || lahan?.kecamatan || lahan?.district || "";
  const key = normalizeLocationKey(kecamatan);
  return ACUAN_PUPUK_KEMENTAN_2020_SUKOHARJO[key] || null;
};

const findStageDose = (dosisList, fertilizerName) => {
  const target = normalizeFertilizerKey(fertilizerName);
  const aliases = {
    SP36: ["SP36", "SP36PUPUK"],
    KCL: ["KCL", "KALIUMKLORIDA"],
    UREA: ["UREA"],
    ZA: ["ZA"],
  };
  const accepted = aliases[target] || [target];

  const found = (Array.isArray(dosisList) ? dosisList : []).find((item) => {
    const itemKey = normalizeFertilizerKey(
      item?.jenis_pupuk || item?.pupuk || item?.nama
    );
    return accepted.includes(itemKey);
  });

  if (!found) return null;

  return {
    perHa: toNumber(found.dosis_per_ha, 0),
    total: toNumber(found.dosis_total, 0),
  };
};

const buildAcuanPupukRows = (acuan, luasHa, dosisList = []) => {
  if (!acuan) return [];

  const luas = Math.max(0, toNumber(luasHa, 0));
  const definitions = [
    { key: "urea", jenis: "Urea", fungsi: "Sumber nitrogen" },
    { key: "sp36", jenis: "SP-36", fungsi: "Sumber fosfor" },
    { key: "kcl", jenis: "KCl", fungsi: "Sumber kalium" },
    { key: "za", jenis: "ZA", fungsi: "Sumber nitrogen dan sulfur" },
  ];

  return definitions.map((item) => {
    const dosisPerHa = toNumber(acuan[item.key], 0);
    const totalMusim = Number((dosisPerHa * luas).toFixed(2));
    const stage = findStageDose(dosisList, item.jenis);
    const tahapTotal = stage ? Number(stage.total.toFixed(2)) : null;
    const tahapPerHa = stage ? Number(stage.perHa.toFixed(2)) : null;
    const sisa = tahapTotal === null
      ? null
      : Number(Math.max(0, totalMusim - tahapTotal).toFixed(2));

    return {
      ...item,
      dosisPerHa,
      totalMusim,
      tahapPerHa,
      tahapTotal,
      sisa,
      diperlukan: dosisPerHa > 0,
    };
  });
};

const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const normalizeApiList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

const toNumber = (value, fallback = 0) => {
  if (value === undefined || value === null || value === "") return fallback;

  if (typeof value === "string") {
    const cleaned = value
      .replace(",", ".")
      .replace(/[^0-9.-]/g, "")
      .trim();

    const num = Number(cleaned);
    return Number.isFinite(num) ? num : fallback;
  }

  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const formatNumber = (value, digit = 2) => {
  const num = toNumber(value, 0);

  return num.toLocaleString("id-ID", {
    minimumFractionDigits: digit,
    maximumFractionDigits: digit,
  });
};

const formatOptionalNumber = (value, digit = 1, suffix = "") => {
  if (value === undefined || value === null || value === "" || value === "-") {
    return "-";
  }

  const number = toNumber(value, NaN);
  if (!Number.isFinite(number)) return String(value);

  return `${number.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digit,
  })}${suffix}`;
};

const isAvailableValue = (value) =>
  value !== undefined &&
  value !== null &&
  value !== "" &&
  String(value).trim() !== "-" &&
  String(value).trim().toLowerCase() !== "null";

const safeFileName = (value) =>
  String(value || "lahan")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "lahan";

const getMonthKey = (value) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const normalizeText = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const formatTanggal = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const formatTanggalWaktu = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getMonitoringTimestamp = (monitoring) =>
  monitoring?.updated_at ||
  monitoring?.created_at ||
  monitoring?.tanggal ||
  null;

const isSameCalendarDay = (firstDate, secondDate) =>
  firstDate.getFullYear() === secondDate.getFullYear() &&
  firstDate.getMonth() === secondDate.getMonth() &&
  firstDate.getDate() === secondDate.getDate();

const formatJamMonitoring = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date
    .toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(":", ".");
};

const formatMonitoringTerakhir = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const jam = formatJamMonitoring(value);

  if (isSameCalendarDay(date, now)) {
    return `Hari ini, pukul ${jam}`;
  }

  if (isSameCalendarDay(date, yesterday)) {
    return `Kemarin, pukul ${jam}`;
  }

  return `${formatTanggal(date)}, pukul ${jam}`;
};

const formatKesegaranMonitoring = (umurHari, timestamp = null) => {
  if (umurHari !== undefined && umurHari !== null) {
    const days = Math.max(0, Math.floor(toNumber(umurHari, 0)));

    if (days === 0) return "Hari ini";
    if (days === 1) return "Kemarin";

    return `${days} hari lalu`;
  }

  if (!timestamp) return "-";

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "-";

  const now = new Date();
  const startDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  const startNow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const days = Math.max(
    0,
    Math.floor((startNow.getTime() - startDate.getTime()) / 86400000)
  );

  if (days === 0) return "Hari ini";
  if (days === 1) return "Kemarin";

  return `${days} hari lalu`;
};

const titleCase = (value) => {
  const text = String(value || "-")
    .replace(/_/g, " ")
    .trim()
    .toLowerCase();

  if (!text || text === "-") return "-";

  return text.replace(/\b\w/g, (char) => char.toUpperCase());
};

const normalizeApplicationStatus = (value) => {
  const key = String(value || "PERLU_MONITORING")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

  if (
    [
      "DAPAT_DILAKUKAN",
      "PERLU_PEMERIKSAAN",
      "PERLU_MONITORING",
      "TUNDA",
      "SIMULASI",
    ].includes(key)
  ) {
    return key;
  }

  return "PERLU_MONITORING";
};

const getApplicationStatusMeta = (value, monitoring = null) => {
  const status = normalizeApplicationStatus(value);
  const kondisiAir = String(monitoring?.kondisi_air || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const curahHujan = toNumber(monitoring?.curah_hujan, 0);

  let tundaLabel = "Tunda Sementara";

  if (["kering", "sangat_kering", "kurang"].includes(kondisiAir)) {
    tundaLabel = "Tunda Sementara — Kondisi Air Kering";
  } else if (
    ["tergenang", "banjir", "terlalu_banyak"].includes(kondisiAir)
  ) {
    tundaLabel = "Tunda Sementara — Lahan Tergenang";
  } else if (curahHujan >= 50) {
    tundaLabel = "Tunda Sementara — Curah Hujan Tinggi";
  }

  const map = {
    DAPAT_DILAKUKAN: {
      label: "Pemupukan Dapat Dilakukan",
      icon: "✓",
      background: "#ecfdf5",
      border: "#86efac",
      color: "#166534",
    },
    PERLU_PEMERIKSAAN: {
      label: "Periksa Kondisi Lapangan",
      icon: "!",
      background: "#fffbeb",
      border: "#fcd34d",
      color: "#92400e",
    },
    PERLU_MONITORING: {
      label: "Monitoring Perlu Diperbarui",
      icon: "i",
      background: "#eff6ff",
      border: "#93c5fd",
      color: "#1d4ed8",
    },
    TUNDA: {
      label: tundaLabel,
      icon: "!",
      background: "#fff1f2",
      border: "#fda4af",
      color: "#be123c",
    },
    SIMULASI: {
      label: "Tidak Dinilai pada Mode Simulasi",
      icon: "≈",
      background: "#f5f3ff",
      border: "#c4b5fd",
      color: "#6d28d9",
    },
  };

  return {
    status,
    ...map[status],
  };
};

const getApplicationStatusDescription = (value, monitoring = null) => {
  const status = normalizeApplicationStatus(value);
  const kondisiAir = String(monitoring?.kondisi_air || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  const curahHujan = toNumber(monitoring?.curah_hujan, 0);

  if (status === "TUNDA") {
    if (["kering", "sangat_kering", "kurang"].includes(kondisiAir)) {
      return "Pupuk belum diberikan sekarang karena kondisi air masih kering.";
    }

    if (["tergenang", "banjir", "terlalu_banyak"].includes(kondisiAir)) {
      return (
        "Rekomendasi jenis dan dosis pupuk tetap berlaku. " +
        "Aplikasi ditunda sementara karena lahan tercatat tergenang."
      );
    }

    if (curahHujan >= 50) {
      return (
        "Rekomendasi jenis dan dosis pupuk tetap berlaku. " +
        "Aplikasi ditunda sementara karena curah hujan monitoring tercatat tinggi."
      );
    }

    return (
      "Rekomendasi jenis dan dosis pupuk tetap berlaku. " +
      "Aplikasi ditunda sementara berdasarkan kondisi monitoring terakhir."
    );
  }

  if (status === "DAPAT_DILAKUKAN") {
    return (
      "Monitoring terakhir tidak menunjukkan hambatan utama terhadap waktu " +
      "aplikasi. Petani tetap perlu memeriksa kondisi lahan sebelum pemupukan."
    );
  }

  if (status === "PERLU_PEMERIKSAAN") {
    return (
      "Jenis dan dosis rekomendasi tetap tersedia, tetapi kondisi tanaman " +
      "perlu diperiksa terlebih dahulu sebelum pupuk diaplikasikan."
    );
  }

  if (status === "PERLU_MONITORING") {
    return (
      "Monitoring terbaru belum tersedia atau perlu diperbarui. Periksa kondisi " +
      "lapangan sebelum menetapkan waktu pemupukan."
    );
  }

  return (
    "Hasil simulasi hanya digunakan sebagai pembanding dan tidak menentukan " +
    "kelayakan pemupukan pada kondisi aktual."
  );
};

const dateDiffDays = (start, end = new Date()) => {
  if (!start) return null;

  const a = new Date(start);
  const b = new Date(end);

  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;

  return Math.max(0, Math.ceil((b.getTime() - a.getTime()) / 86400000));
};

const getLuasHa = (lahan) => {
  if (!lahan) return 0;

  const luasHa = lahan.luas_ha ?? lahan.luasHa;

  if (luasHa !== undefined && luasHa !== null && luasHa !== "") {
    return toNumber(luasHa);
  }

  const luasM2 = toNumber(lahan.luas_m2 || lahan.luas);

  if (luasM2 > 20) return luasM2 / 10000;

  return luasM2;
};

const getFaseByUmur = (umur) => {
  const number = toNumber(umur, NaN);

  if (!Number.isFinite(number)) return "";
  if (number <= 30) return "vegetatif_awal";
  if (number <= 55) return "vegetatif_akhir";
  if (number <= 95) return "generatif";
  return "pematangan";
};

const getFaseLabel = (fase) => {
  const found = FASE_TANAMAN.find((item) => item.value === fase);
  return found ? found.label : fase || "-";
};

const getNextFase = (fase) => {
  const index = FASE_TANAMAN.findIndex((item) => item.value === fase);
  const nextIndex = index < 0 ? 0 : (index + 1) % FASE_TANAMAN.length;
  return FASE_TANAMAN[nextIndex].value;
};

const getSelectedLahanLabel = (lahan) => {
  if (!lahan) return "Pilih lahan";

  return `${lahan.nama_lahan || "Lahan"} · Desa ${
    lahan.nama_desa || "-"
  }, Kec. ${lahan.nama_kecamatan || "-"}`;
};

const getRainExplanation = (value, period) => {
  if (!isAvailableValue(value)) {
    return "Data curah hujan belum tersedia sehingga waktu aplikasi perlu diperiksa langsung di lapangan.";
  }

  const rain = toNumber(value, 0);
  const periodText = isAvailableValue(period)
    ? String(period)
    : "periode yang belum dijelaskan oleh layanan";

  if (!isAvailableValue(period)) {
    return `Layanan mengirim nilai curah hujan ${formatNumber(
      rain,
      0
    )} mm, tetapi periodenya belum dijelaskan. Nilai ini tidak digunakan untuk memberi kategori rendah, sedang, atau tinggi.`;
  }

  return `Curah hujan tercatat ${formatNumber(
    rain,
    0
  )} mm untuk ${periodText}. Pemupukan tetap perlu menunggu kondisi tanah tidak terlalu kering, tidak tergenang, dan tidak sedang mengalami hujan deras.`;
};

const getUmurRangeByFase = (fase) => {
  const key = String(fase || "").toLowerCase();

  if (key === "vegetatif_awal") {
    return {
      min: 0,
      max: 30,
      representative: 15,
      text: "0 sampai 30 hari",
    };
  }

  if (key === "vegetatif_akhir") {
    return {
      min: 31,
      max: 55,
      representative: 42,
      text: "31 sampai 55 hari",
    };
  }

  if (key === "generatif") {
    return {
      min: 56,
      max: 95,
      representative: 75,
      text: "56 sampai 95 hari",
    };
  }

  if (key === "pematangan") {
    return {
      min: 96,
      max: Infinity,
      representative: 105,
      text: "96 hari ke atas",
    };
  }

  return {
    min: 0,
    max: Infinity,
    representative: 45,
    text: "umur tanaman yang tersedia",
  };
};

const isUmurCompatibleWithFase = (fase, umur) => {
  const number = toNumber(umur, NaN);
  const range = getUmurRangeByFase(fase);

  if (!Number.isFinite(number)) return false;

  return number >= range.min && number <= range.max;
};

const getEffectiveUmurTanaman = (fase, umurAsli) => {
  const actual = toNumber(umurAsli, NaN);
  const range = getUmurRangeByFase(fase);

  if (Number.isFinite(actual) && actual >= range.min && actual <= range.max) {
    return actual;
  }

  return range.representative;
};

const getFaseAdvice = (fase) => {
  const key = String(fase || "").toLowerCase();

  if (key === "vegetatif_awal") {
    return {
      fokus: "pembentukan akar awal, daun, batang, dan anakan muda",
      pupuk: "unsur nitrogen menjadi perhatian utama karena tanaman sedang membangun massa vegetatif",
      jadwal:
        "pemupukan awal sebaiknya dilakukan bertahap agar tanaman muda tidak menerima dosis berlebihan sekaligus",
    };
  }

  if (key === "vegetatif_akhir") {
    return {
      fokus: "penguatan anakan produktif dan persiapan menuju fase pembentukan hasil",
      pupuk:
        "nitrogen masih dibutuhkan, tetapi fosfor dan kalium mulai dijaga agar tanaman lebih siap masuk fase generatif",
      jadwal:
        "pemupukan susulan perlu lebih terukur karena tanaman sudah mulai bergerak ke fase produksi",
    };
  }

  if (key === "generatif") {
    return {
      fokus: "pembentukan malai, pembungaan, dan awal pengisian bulir",
      pupuk:
        "fosfor dan kalium lebih diprioritaskan untuk membantu pembentukan hasil, sedangkan nitrogen tidak perlu terlalu agresif",
      jadwal:
        "waktu pemupukan perlu disesuaikan agar unsur hara tersedia saat pembentukan malai dan pengisian bulir",
    };
  }

  if (key === "pematangan") {
    return {
      fokus: "pengisian akhir bulir dan pematangan tanaman menjelang panen",
      pupuk:
        "kalium lebih relevan untuk mendukung ketahanan tanaman dan kualitas pengisian bulir, sementara nitrogen perlu dibatasi",
      jadwal:
        "dosis pemupukan harus lebih hati-hati karena tanaman sudah mendekati panen dan tidak membutuhkan pemupukan vegetatif berlebihan",
    };
  }

  return {
    fokus: "fase pertumbuhan yang dipilih",
    pupuk: "jenis pupuk disesuaikan dengan data unsur hara yang tersedia",
    jadwal: "jadwal pemupukan mengikuti hasil analisis lahan dan tanaman",
  };
};

const generateAlasanRekomendasi = ({
  selectedLahan,
  fase,
  umurTanaman,
  luasHa,
  result,
  dosisAcuan,
  totalUntukLahan,
  modeAnalisis,
}) => {
  if (!result) return [];

  const namaLahan = selectedLahan?.nama_lahan || "lahan terpilih";
  const desa = selectedLahan?.nama_desa || "-";
  const kecamatan = selectedLahan?.nama_kecamatan || "-";
  const varietas = selectedLahan?.varietas || result.varietas || "-";
  const faseLabel = getFaseLabel(fase);
  const umur = toNumber(
    result.umur_tanaman && result.umur_tanaman !== "-"
      ? result.umur_tanaman
      : umurTanaman,
    0
  );
  const umurRange = getUmurRangeByFase(fase);
  const luas = toNumber(luasHa, 0);
  const pupukUtama = result.pupuk_utama || result.pupuk || "pupuk utama";
  const faseAdvice = getFaseAdvice(fase);
  const acuan = getAcuanPupukKecamatan(selectedLahan);
  const acuanRows = buildAcuanPupukRows(acuan, luas, result.dosis || []);

  const curahHujan = result.informasi?.curah_hujan;
  const periodeCurahHujan = result.informasi?.periode_curah_hujan;
  const kelembapan = result.informasi?.kelembapan;

  const modeText =
    modeAnalisis === "simulasi"
      ? `Hasil ini merupakan simulasi fase ${faseLabel} dengan umur acuan ${umur} hari (${umurRange.text}), bukan kondisi aktual tanaman.`
      : `${namaLahan} di Desa ${desa}, Kecamatan ${kecamatan}, varietas ${varietas}, dianalisis berdasarkan fase aktual ${faseLabel} dan umur tanaman ${umur} hari.`;

  const luasReason = `Luas lahan ${formatNumber(
    luas,
    2
  )} ha digunakan untuk mengubah dosis per hektare menjadi jumlah pupuk yang dibutuhkan pada lahan petani.`;

  const alasan = [modeText];

  if (acuan) {
    alasan.push(
      `Total kebutuhan satu musim mengikuti acuan Kementerian Pertanian 2020 untuk Kecamatan ${acuan.kecamatan}: Urea ${formatNumber(
        acuan.urea,
        0
      )} kg/ha, SP-36 ${formatNumber(acuan.sp36, 0)} kg/ha, KCl ${formatNumber(
        acuan.kcl,
        0
      )} kg/ha, dan ZA ${formatNumber(acuan.za, 0)} kg/ha.`
    );

    const totalText = acuanRows
      .filter((item) => item.diperlukan)
      .map(
        (item) => `${item.jenis} ${formatNumber(item.totalMusim, 2)} kg`
      )
      .join(", ");

    alasan.push(
      `Setelah dikonversi untuk luas ${formatNumber(
        luas,
        2
      )} ha, total rencana satu musim adalah ${totalText}. Total ini tidak diberikan sekaligus.`
    );
  } else {
    alasan.push(
      `Acuan Kementerian Pertanian 2020 untuk Kecamatan ${kecamatan} belum tersedia di data lokal sistem. Petani perlu meminta konfirmasi dosis kepada penyuluh.`
    );
  }

  alasan.push(
    `Pada fase ${faseLabel}, fokus tanaman adalah ${faseAdvice.fokus}. GeoPanen membagi pemberian pupuk per tahap agar tidak seluruh kebutuhan satu musim diberikan sekaligus.`
  );

  alasan.push(luasReason);

  alasan.push(
    `Pemberian tahap saat ini adalah ${pupukUtama}, dengan dosis tahap ${dosisAcuan || "-"} dan jumlah ${
      totalUntukLahan || "-"
    } untuk lahan ini. Angka tahap berasal dari aturan fase GeoPanen, sedangkan total satu musim berasal dari acuan Kementerian Pertanian.`
  );

  alasan.push(getRainExplanation(curahHujan, periodeCurahHujan));

  if (isAvailableValue(kelembapan)) {
    alasan.push(
      `Kelembapan tercatat ${formatOptionalNumber(
        kelembapan,
        0,
        "%"
      )}. Waktu pemberian tetap harus menyesuaikan kondisi tanah nyata di lapangan.`
    );
  }

  if (result.monitoring_digunakan) {
    alasan.push(
      `Monitoring terakhir digunakan untuk menilai apakah pupuk dapat diberikan sekarang, perlu diperiksa, atau harus ditunda sementara.`
    );
  }

  alasan.push(
    "Rekomendasi merupakan pendukung keputusan. BWD, PUTS, hasil uji tanah, dan arahan penyuluh tetap digunakan apabila tersedia untuk penyesuaian yang lebih spesifik."
  );

  return alasan;
};


const getFertilizerIcon = (name) => {
  const pupuk = String(name || "").toUpperCase();

  if (pupuk.includes("UREA")) return "UREA";
  if (pupuk.includes("NPK")) return "NPK";
  if (pupuk.includes("KCL")) return "KCL";
  if (pupuk.includes("SP")) return "SP";
  if (pupuk.includes("ZA")) return "ZA";
  if (pupuk.includes("DOLOMIT")) return "DOL";

  return "PUPUK";
};

const normalizePupukKey = (value) =>
  String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");


const cleanKgNumber = (value) => {
  if (value === undefined || value === null || value === "") return "-";

  return String(value)
    .replace(/kg\/ha/gi, "")
    .replace(/kg per ha/gi, "")
    .replace(/kg/gi, "")
    .replace(/ha/gi, "")
    .replace(/\//g, "")
    .trim();
};

const formatDosisAcuan = (value) => {
  if (value === undefined || value === null || value === "" || value === "-") {
    return "-";
  }

  const cleaned = cleanKgNumber(value);

  if (!cleaned || cleaned === "-") return "-";

  return `${cleaned} kg/ha`;
};

const formatTotalLahan = (value) => {
  if (value === undefined || value === null || value === "" || value === "-") {
    return "-";
  }

  const cleaned = cleanKgNumber(value);

  if (!cleaned || cleaned === "-") return "-";

  return `${cleaned} kg`;
};

const parseList = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return String(value)
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }
};

const normalizeDosisItem = (item) => {
  const jenisPupuk =
    item.jenis_pupuk || item.nama || item.pupuk || item.name || "Pupuk";

  const dosisPerHa =
    item.dosis_per_ha ??
    item.dosisPerHa ??
    item.dosis ??
    item.jumlah ??
    0;

  const dosisTotal =
    item.dosis_total ?? item.dosisTotal ?? item.total ?? item.total_kg ?? 0;

  const labelPerHa = formatDosisAcuan(
    item.label_per_ha ||
      item.labelPerHa ||
      dosisPerHa
  );

  const labelTotal = formatTotalLahan(
    item.label_total ||
      item.labelTotal ||
      dosisTotal
  );

  return {
    jenis_pupuk: jenisPupuk,
    dosis_per_ha: dosisPerHa,
    dosis_total: dosisTotal,
    label_per_ha: labelPerHa,
    label_total: labelTotal,
  };
};

const normalizeJadwalItem = (item, index) => {
  const dosisPerHa =
    item.dosis_per_ha ?? item.dosisPerHa ?? item.dosis_ha ?? null;

  const dosisTotal =
    item.dosis_total ?? item.dosisTotal ?? item.total ?? null;

  return {
    label: item.label || item.waktu || `Jadwal ${index + 1}`,
    tanggal: item.tanggal || item.date || null,
    pupuk: item.pupuk || item.jenis_pupuk || item.nama || "Pupuk",
    dosis_per_ha: dosisPerHa,
    dosis_total: dosisTotal,
    label_per_ha:
      dosisPerHa !== null || item.label_per_ha || item.labelPerHa
        ? formatDosisAcuan(
            item.label_per_ha ||
              item.labelPerHa ||
              dosisPerHa
          )
        : "-",
    label_total:
      dosisTotal !== null || item.label_total || item.labelTotal
        ? formatTotalLahan(
            item.label_total ||
              item.labelTotal ||
              dosisTotal
          )
        : "-",
    color:
      item.color ||
      ["#16a34a", "#2563eb", "#f97316", "#9333ea"][index % 4],
  };
};

const normalizeResult = (payload) => {
  const raw = payload?.data || payload?.result || payload || {};

  const unsur = raw.unsur_hara || raw.kebutuhan_unsur_hara || {};
  const dampak = raw.dampak || raw.estimasi_dampak || {};
  const informasi = raw.informasi || raw.info_tambahan || {};
  const cuaca = raw.cuaca || {};
  const monitoringRaw =
    raw.monitoring_terakhir || raw.latest_monitoring || raw.monitoring || null;

  const dosisList =
    raw.dosis ||
    raw.daftar_dosis ||
    raw.dosis_rekomendasi ||
    raw.supporting ||
    [];

  const jadwalList = raw.jadwal || raw.jadwal_pemupukan || [];

  const pupuk =
    raw.pupuk_utama ||
    raw.pupuk ||
    raw.jenis_pupuk ||
    raw.rekomendasi_pupuk ||
    "-";

  const normalizedDosis = Array.isArray(dosisList)
    ? dosisList.map((item) => normalizeDosisItem(item))
    : [];

  const dosisUtama = normalizedDosis[0] || null;

  const dosisPerHa =
    raw.label_per_ha ||
    raw.dosis_per_ha ||
    dosisUtama?.label_per_ha ||
    "-";

  const dosisTotal =
    raw.label_total ||
    raw.dosis_total ||
    dosisUtama?.label_total ||
    "-";

  const skorKecocokan = toNumber(
    raw.skor_kecocokan_aturan ??
      raw.tingkat_kesesuaian ??
      raw.kesesuaian ??
      raw.confidence,
    0
  );

  const produksiSaatIniRaw =
    dampak.produksi_saat_ini ?? raw.produksi_saat_ini ?? null;

  const produksiRekomendasiRaw =
    dampak.produksi_rekomendasi ??
    raw.produksi_rekomendasi ??
    raw.estimasi_hasil ??
    null;

  const kenaikanPersenRaw =
    dampak.kenaikan_persen ?? raw.kenaikan_persen ?? null;

  const kenaikanTonRaw = dampak.kenaikan_ton ?? raw.kenaikan_ton ?? null;

  const hasDampak =
    isAvailableValue(produksiSaatIniRaw) &&
    isAvailableValue(produksiRekomendasiRaw) &&
    (toNumber(produksiSaatIniRaw, 0) > 0 ||
      toNumber(produksiRekomendasiRaw, 0) > 0);

  const phTanah = informasi.ph_tanah ?? raw.ph_tanah ?? "-";
  const kadarOrganik =
    informasi.kadar_organik ?? raw.kadar_organik ?? "-";
  const teksturTanah =
    informasi.tekstur_tanah ?? raw.tekstur_tanah ?? "-";
  const drainase = informasi.drainase ?? raw.drainase ?? "-";

  const hasSoilInfo = [phTanah, kadarOrganik, teksturTanah, drainase].some(
    isAvailableValue
  );

  const sumberTanah = String(
    informasi.sumber_data_tanah ||
      raw.sumber_data_tanah ||
      raw.sumber_tanah ||
      "simulasi"
  ).toLowerCase();

  const soilVerified = [
    "uji",
    "laboratorium",
    "lab",
    "sensor",
    "penyuluh",
    "pengukuran",
    "aktual",
  ].some((keyword) => sumberTanah.includes(keyword));

  const suhu =
    informasi.suhu ?? raw.suhu ?? cuaca.suhu ?? cuaca.temperature ?? "-";

  const curahHujan =
    informasi.curah_hujan ??
    raw.curah_hujan ??
    cuaca.curah_hujan ??
    cuaca.precipitation ??
    "-";

  const kelembapan =
    informasi.kelembapan ??
    raw.kelembapan ??
    cuaca.kelembapan ??
    cuaca.humidity ??
    "-";

  const periodeCurahHujan =
    informasi.periode_curah_hujan ||
    raw.periode_curah_hujan ||
    cuaca.periode_curah_hujan ||
    cuaca.periode ||
    "-";

  return {
    pupuk,
    pupuk_utama: pupuk,

    dosis_per_ha: formatDosisAcuan(dosisPerHa),
    dosis_total: formatTotalLahan(dosisTotal),
    dosis_total_kg: toNumber(raw.dosis_total_kg ?? dosisTotal, 0),

    skor_kecocokan_aturan: skorKecocokan,

    // Alias dipertahankan agar kompatibel dengan kode/backend lama.
    tingkat_kesesuaian: skorKecocokan,

    fase_tanaman: raw.fase_label || raw.fase_tanaman || "-",
    umur_tanaman: raw.umur_tanaman ?? "-",
    varietas: raw.varietas || raw.lahan?.varietas || "-",

    unsur_hara: {
      n: toNumber(unsur.n ?? unsur.N ?? unsur.nitrogen, 0),
      p: toNumber(unsur.p ?? unsur.P ?? unsur.fosfor, 0),
      k: toNumber(unsur.k ?? unsur.K ?? unsur.kalium, 0),
    },

    status_unsur_hara: raw.status_unsur_hara || {},
    warna_unsur_hara: raw.warna_unsur_hara || {},

    dosis: normalizedDosis,

    alasan: parseList(raw.alasan || raw.alasan_rekomendasi || raw.reason),

    jadwal: Array.isArray(jadwalList)
      ? jadwalList.map((item, index) => normalizeJadwalItem(item, index))
      : [],

    dampak: {
      tersedia: hasDampak,
      produksi_saat_ini: hasDampak
        ? toNumber(produksiSaatIniRaw, 0)
        : null,
      produksi_rekomendasi: hasDampak
        ? toNumber(produksiRekomendasiRaw, 0)
        : null,
      kenaikan_persen: hasDampak
        ? toNumber(kenaikanPersenRaw, 0)
        : null,
      kenaikan_ton: hasDampak ? toNumber(kenaikanTonRaw, 0) : null,
    },

    informasi: {
      ph_tanah: phTanah,
      kadar_organik: kadarOrganik,
      tekstur_tanah: teksturTanah,
      drainase,
      suhu,
      curah_hujan: curahHujan,
      kelembapan,
      periode_curah_hujan: periodeCurahHujan,
      sumber_cuaca:
        informasi.sumber_cuaca ||
        raw.sumber_cuaca ||
        cuaca.sumber ||
        "FastAPI",
      data_tanah_tersedia: hasSoilInfo,
      data_tanah_terverifikasi: soilVerified,
      sumber_data_tanah: sumberTanah,
    },

    mode_analisis: raw.mode_analisis || "aktual",

    monitoring_tersedia: Boolean(
      raw.monitoring_tersedia ?? monitoringRaw
    ),
    monitoring_digunakan: Boolean(raw.monitoring_digunakan),
    monitoring_valid: Boolean(raw.monitoring_valid),
    umur_data_monitoring_hari:
      raw.umur_data_monitoring_hari !== undefined &&
      raw.umur_data_monitoring_hari !== null
        ? toNumber(raw.umur_data_monitoring_hari, 0)
        : null,
    monitoring_terakhir: monitoringRaw,
    status_aplikasi: normalizeApplicationStatus(raw.status_aplikasi),
    status_aplikasi_label: getApplicationStatusMeta(
      raw.status_aplikasi,
      monitoringRaw
    ).label,
    status_aplikasi_penjelasan: getApplicationStatusDescription(
      raw.status_aplikasi,
      monitoringRaw
    ),
    alasan_monitoring: parseList(raw.alasan_monitoring),
    peringatan_monitoring: parseList(raw.peringatan_monitoring),

    tips: raw.tips || "-",
    metode: raw.metode || "Rule-Based System",
    catatan: raw.catatan || "",
  };
};


const emptyResult = {
  pupuk: "-",
  pupuk_utama: "-",
  dosis_per_ha: "-",
  dosis_total: "-",
  dosis_total_kg: 0,
  skor_kecocokan_aturan: 0,
  tingkat_kesesuaian: 0,
  fase_tanaman: "-",
  umur_tanaman: "-",
  varietas: "-",

  unsur_hara: {
    n: 0,
    p: 0,
    k: 0,
  },

  status_unsur_hara: {},
  warna_unsur_hara: {},

  dosis: [],
  alasan: [],
  jadwal: [],

  dampak: {
    tersedia: false,
    produksi_saat_ini: null,
    produksi_rekomendasi: null,
    kenaikan_persen: null,
    kenaikan_ton: null,
  },

  informasi: {
    ph_tanah: "-",
    kadar_organik: "-",
    tekstur_tanah: "-",
    drainase: "-",
    suhu: "-",
    curah_hujan: "-",
    kelembapan: "-",
    periode_curah_hujan: "-",
    sumber_cuaca: "-",
    data_tanah_tersedia: false,
    data_tanah_terverifikasi: false,
    sumber_data_tanah: "tidak tersedia",
  },

  mode_analisis: "aktual",
  monitoring_tersedia: false,
  monitoring_digunakan: false,
  monitoring_valid: false,
  umur_data_monitoring_hari: null,
  monitoring_terakhir: null,
  status_aplikasi: "PERLU_MONITORING",
  status_aplikasi_label: "Monitoring Perlu Diperbarui",
  status_aplikasi_penjelasan:
    "Monitoring terbaru belum tersedia atau perlu diperbarui.",
  alasan_monitoring: [],
  peringatan_monitoring: [],

  tips: "-",
  metode: "Rule-Based System",
  catatan: "",
};


export default function RekomendasiPupuk() {
  const navigate = useNavigate();
  const user = getUser();

  const userId =
    user?.id ||
    localStorage.getItem("user_id") ||
    localStorage.getItem("petani_id");

  const [lahanList, setLahanList] = useState([]);
  const [selectedLahanId, setSelectedLahanId] = useState("");
  const [faseSimulasi, setFaseSimulasi] = useState("vegetatif_akhir");

  const [loadingLahan, setLoadingLahan] = useState(true);
  const [loadingAnalisis, setLoadingAnalisis] = useState(false);
  const [savingKalender, setSavingKalender] = useState(false);
  const [result, setResult] = useState(null);
  const [analysisContext, setAnalysisContext] = useState(null);
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [error, setError] = useState("");

  const selectedLahan = useMemo(() => {
    return (
      lahanList.find((item) => Number(item.id) === Number(selectedLahanId)) ||
      lahanList[0] ||
      null
    );
  }, [lahanList, selectedLahanId]);

  const luasHa = getLuasHa(selectedLahan);
  const umurTanamanAsli = dateDiffDays(selectedLahan?.tanggal_tanam);
  const faseAktual = getFaseByUmur(umurTanamanAsli);

  const activeResult = result || emptyResult;
  const hasResult = Boolean(result);

  const monitoringTimestamp = getMonitoringTimestamp(
    activeResult.monitoring_terakhir
  );

  const monitoringTerakhirLabel = formatMonitoringTerakhir(
    monitoringTimestamp
  );

  const kesegaranMonitoringLabel = formatKesegaranMonitoring(
    activeResult.umur_data_monitoring_hari,
    monitoringTimestamp
  );

  const applicationStatusMeta = getApplicationStatusMeta(
    activeResult.status_aplikasi,
    activeResult.monitoring_terakhir
  );

  const applicationStatusDescription =
    activeResult.status_aplikasi_penjelasan ||
    getApplicationStatusDescription(
      activeResult.status_aplikasi,
      activeResult.monitoring_terakhir
    );

  const faseHasil = analysisContext?.fase || faseAktual || "-";
  const umurHasil =
    analysisContext?.umur ??
    (Number.isFinite(umurTanamanAsli) ? umurTanamanAsli : null);

  const isSimulationResult = analysisContext?.mode === "simulasi";

  const dosisAcuanUtama =
    activeResult.dosis?.[0]?.label_per_ha || activeResult.dosis_per_ha || "-";

  const totalUntukLahanUtama =
    activeResult.dosis?.[0]?.label_total || activeResult.dosis_total || "-";

  const skorKecocokan = toNumber(
    activeResult.skor_kecocokan_aturan ??
      activeResult.tingkat_kesesuaian,
    0
  );


  const acuanKementan = useMemo(
    () => getAcuanPupukKecamatan(selectedLahan),
    [selectedLahan]
  );

  const acuanPupukRows = useMemo(
    () =>
      buildAcuanPupukRows(
        acuanKementan,
        luasHa,
        hasResult ? activeResult.dosis : []
      ),
    [acuanKementan, luasHa, hasResult, activeResult.dosis]
  );

  const pupukUtamaAcuan = useMemo(() => {
    const key = normalizePupukKey(activeResult.pupuk);

    return (
      acuanPupukRows.find((item) => normalizePupukKey(item.jenis) === key) ||
      null
    );
  }, [acuanPupukRows, activeResult.pupuk]);

  const farmerActions = useMemo(() => {
    if (!hasResult) {
      return [
        "Pilih lahan dan jalankan analisis fase aktual.",
        "Pastikan monitoring harian sudah diisi.",
      ];
    }

    const status = normalizeApplicationStatus(activeResult.status_aplikasi);
    const kondisiAir = String(
      activeResult.monitoring_terakhir?.kondisi_air || ""
    )
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");

    if (status === "TUNDA" && ["kering", "sangat_kering", "kurang"].includes(kondisiAir)) {
      return [
        "Tambahkan air secara bertahap.",
        "Periksa kembali kondisi lahan.",
        "Perbarui monitoring harian.",
        "Jalankan analisis pupuk ulang.",
      ];
    }

    if (status === "TUNDA") {
      return [
        "Tunda pemberian pupuk hari ini.",
        "Periksa kondisi air dan cuaca.",
        "Perbarui monitoring harian.",
        "Jalankan analisis ulang.",
      ];
    }

    if (status === "PERLU_PEMERIKSAAN") {
      return [
        "Periksa daun dan pertumbuhan tanaman.",
        "Pastikan kondisi air cukup.",
        "Konsultasikan jika gejala berlanjut.",
      ];
    }

    if (status === "PERLU_MONITORING") {
      return [
        "Isi atau perbarui monitoring harian.",
        "Periksa kondisi air sebelum pemupukan.",
        "Jalankan analisis ulang.",
      ];
    }

    return [
      "Periksa kondisi lahan sebelum aplikasi.",
      "Berikan pupuk sesuai jumlah tahap.",
      "Catat kegiatan ke kalender budidaya.",
    ];
  }, [
    hasResult,
    activeResult.status_aplikasi,
    activeResult.monitoring_terakhir,
  ]);

  const alasanDinamis = useMemo(() => {
    if (!hasResult) return [];

    return generateAlasanRekomendasi({
      selectedLahan,
      fase: faseHasil,
      umurTanaman: umurHasil,
      luasHa,
      result: activeResult,
      dosisAcuan: dosisAcuanUtama,
      totalUntukLahan: totalUntukLahanUtama,
      modeAnalisis: analysisContext?.mode || "aktual",
    });
  }, [
    hasResult,
    selectedLahan,
    faseHasil,
    umurHasil,
    luasHa,
    activeResult,
    dosisAcuanUtama,
    totalUntukLahanUtama,
    analysisContext?.mode,
  ]);

  const soilRows = useMemo(
    () => [
      ["pH Tanah", activeResult.informasi.ph_tanah],
      ["Kadar Organik", activeResult.informasi.kadar_organik],
      ["Tekstur Tanah", activeResult.informasi.tekstur_tanah],
      ["Drainase", activeResult.informasi.drainase],
    ],
    [activeResult]
  );

  useEffect(() => {
    loadLahan();
  }, []);

  useEffect(() => {
    const actualPhase = getFaseByUmur(
      dateDiffDays(selectedLahan?.tanggal_tanam)
    );

    setFaseSimulasi(getNextFase(actualPhase || "vegetatif_awal"));
    setResult(null);
    setAnalysisContext(null);
    setSimulationOpen(false);
    setShowTechnicalDetails(false);
  }, [selectedLahan?.id]);

  const loadLahan = async () => {
    try {
      setLoadingLahan(true);
      setError("");

      if (!userId) {
        throw new Error("ID pengguna tidak ditemukan. Silakan login ulang.");
      }

      const res = await axios.get(`${API_NODE}/lahan`, {
        params: {
          petani_id: userId,
          user_id: userId,
        },
      });

      const data = normalizeApiList(res.data);

      setLahanList(data);

      if (data.length > 0) {
        setSelectedLahanId((current) => current || String(data[0].id));
      }
    } catch (err) {
      console.log("ERROR LOAD LAHAN:", err.response?.data || err.message);
      setLahanList([]);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Gagal memuat data lahan. Pastikan backend Node.js berjalan."
      );
    } finally {
      setLoadingLahan(false);
    }
  };

  const requestRekomendasi = async ({
    faseTarget,
    mode = "aktual",
  }) => {
    if (!selectedLahan?.id) {
      throw new Error("Pilih lahan terlebih dahulu.");
    }

    const isSimulation = mode === "simulasi";
    const actualAge = toNumber(umurTanamanAsli, NaN);

    if (!isSimulation && !Number.isFinite(actualAge)) {
      throw new Error(
        "Tanggal tanam belum tersedia. Lengkapi tanggal tanam agar fase aktual dan umur tanaman dapat dihitung."
      );
    }

    const umurTarget = isSimulation
      ? getEffectiveUmurTanaman(faseTarget, actualAge)
      : actualAge;

    const body = {
      sawah_id: Number(selectedLahan.id),
      lahan_id: Number(selectedLahan.id),
      fase_tanaman: faseTarget,
      fase_label: getFaseLabel(faseTarget),
      luas_ha: luasHa,
      varietas: selectedLahan.varietas || "-",
      umur_tanaman: umurTarget,
      mode_analisis: mode,
      gunakan_monitoring: !isSimulation,
    };

    const res = await axios.post(REKOMENDASI_ENDPOINT, body);

    if (res.data?.status && res.data.status !== "success") {
      throw new Error(res.data?.message || "Layanan rekomendasi gagal memproses data.");
    }

    return {
      result: normalizeResult(res.data),
      context: {
        mode,
        fase: faseTarget,
        umur: umurTarget,
        faseAktual,
        umurAktual: Number.isFinite(actualAge) ? actualAge : null,
        waktuAnalisis: new Date().toISOString(),
      },
    };
  };

  const runAnalisis = async () => {
    try {
      setLoadingAnalisis(true);
      setError("");
      setResult(null);
      setAnalysisContext(null);

      if (!faseAktual) {
        throw new Error(
          "Fase aktual belum dapat ditentukan karena tanggal tanam belum tersedia."
        );
      }

      const response = await requestRekomendasi({
        faseTarget: faseAktual,
        mode: "aktual",
      });

      setResult(response.result);
      setAnalysisContext(response.context);
    } catch (err) {
      console.log("ERROR REKOMENDASI:", err.response?.data || err.message);
      setResult(null);
      setAnalysisContext(null);
      setError(
        err.response?.data?.message ||
          err.message ||
          `Gagal mengambil rekomendasi dari ${REKOMENDASI_ENDPOINT}.`
      );
    } finally {
      setLoadingAnalisis(false);
    }
  };

  const runSimulasi = async () => {
    try {
      setLoadingAnalisis(true);
      setError("");
      setResult(null);
      setAnalysisContext(null);

      const response = await requestRekomendasi({
        faseTarget: faseSimulasi,
        mode: "simulasi",
      });

      setResult(response.result);
      setAnalysisContext(response.context);
      setSimulationOpen(false);
    } catch (err) {
      console.log("ERROR SIMULASI:", err.response?.data || err.message);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Gagal menjalankan simulasi fase."
      );
    } finally {
      setLoadingAnalisis(false);
    }
  };

  const readExistingCalendarEvents = async (payloads) => {
    const months = [
      ...new Map(
        payloads.map((item) => [
          getMonthKey(item.tanggal),
          item.tanggal,
        ])
      ).entries(),
    ].filter(([month]) => month);

    if (months.length === 0) return [];

    const responses = await Promise.allSettled(
      months.map(([month, sampleDate]) =>
        axios.get(`${API_NODE}/kalender/${selectedLahan.id}/overview`, {
          params: {
            tanggal: sampleDate,
            bulan: month,
            user_id: Number(userId),
          },
        })
      )
    );

    return responses.flatMap((response) => {
      if (response.status !== "fulfilled") return [];

      const payload = response.value?.data?.data || response.value?.data || {};
      return payload.month_events || payload.events || [];
    });
  };

  const simpanKeKalender = async () => {
    if (!hasResult || !selectedLahan?.id) {
      alert("Jalankan analisis fase aktual terlebih dahulu.");
      return;
    }

    if (isSimulationResult) {
      alert(
        "Hasil simulasi tidak dapat disimpan ke kalender aktual. Jalankan kembali Analisis Fase Aktual terlebih dahulu."
      );
      return;
    }

    if (activeResult.status_aplikasi === "TUNDA") {
      alert(
        "Jadwal belum dapat disimpan karena monitoring menunjukkan pemupukan perlu ditunda. Perbaiki kondisi air atau perbarui monitoring terlebih dahulu."
      );
      return;
    }

    if (!activeResult.jadwal || activeResult.jadwal.length === 0) {
      alert("Belum ada jadwal pemupukan dari hasil analisis.");
      return;
    }

    const missingDateItems = activeResult.jadwal.filter(
      (item) => !item.tanggal || Number.isNaN(new Date(item.tanggal).getTime())
    );

    if (missingDateItems.length > 0) {
      alert(
        `${missingDateItems.length} jadwal belum memiliki tanggal yang valid. Jadwal tidak disimpan agar tidak masuk ke tanggal yang salah.`
      );
      return;
    }

    try {
      setSavingKalender(true);

      const payloads = activeResult.jadwal.map((item, index) => {
        const tanggal = String(item.tanggal).slice(0, 10);
        const pupuk = item.pupuk || activeResult.pupuk || "Pupuk";

        const dosisAcuan =
          item.label_per_ha || activeResult.dosis_per_ha || "-";

        const totalUntukLahan =
          item.label_total || activeResult.dosis_total || "-";

        const sourceKey = [
          selectedLahan.id,
          tanggal,
          normalizeText(pupuk),
          normalizeText(item.label || `jadwal-${index + 1}`),
        ].join("|");

        return {
          lahan_id: Number(selectedLahan.id),
          sawah_id: Number(selectedLahan.id),
          user_id: Number(userId),

          nama_kegiatan: `Pemupukan ${pupuk}`,
          jenis: "pemupukan",
          tanggal,
          waktu: item.waktu || "08:00",

          pupuk,

          dosis_per_ha: dosisAcuan,
          dosis_total: totalUntukLahan,

          dosis_acuan_label: `Dosis Acuan: ${dosisAcuan}`,
          total_lahan_label: `Total untuk Lahan Ini: ${totalUntukLahan}`,

          deskripsi:
            `Dosis Acuan: ${dosisAcuan}\n` +
            `Total untuk Lahan Ini: ${totalUntukLahan}\n` +
            `Sumber: Rekomendasi pupuk berbasis aturan`,

          metode: activeResult.metode || "Rule-Based System",
          durasi: item.label || `Jadwal ${index + 1}`,
          sumber: "rekomendasi_pupuk",
          source_key: sourceKey,
          status: "terjadwal",
        };
      });

      let existingEvents = [];

      try {
        existingEvents = await readExistingCalendarEvents(payloads);
      } catch (checkError) {
        console.warn(
          "Pemeriksaan jadwal kalender gagal:",
          checkError.response?.data || checkError.message
        );
      }

      const newPayloads = payloads.filter((payload) => {
        return !existingEvents.some((event) => {
          const sameDate =
            String(event.tanggal || "").slice(0, 10) === payload.tanggal;

          const sameName =
            normalizeText(event.nama_kegiatan || event.judul) ===
            normalizeText(payload.nama_kegiatan);

          const samePupuk =
            !event.pupuk ||
            normalizeText(event.pupuk) === normalizeText(payload.pupuk);

          return sameDate && sameName && samePupuk;
        });
      });

      const duplicateCount = payloads.length - newPayloads.length;

      if (newPayloads.length === 0) {
        alert(
          "Semua jadwal pemupukan tersebut sudah tersedia di Kalender Budidaya."
        );
        return;
      }

      const confirmed = window.confirm(
        `${newPayloads.length} jadwal baru akan disimpan.` +
          (duplicateCount > 0
            ? ` ${duplicateCount} jadwal duplikat akan dilewati.`
            : "") +
          "\n\nLanjutkan?"
      );

      if (!confirmed) return;

      await Promise.all(
        newPayloads.map((payload) =>
          axios.post(`${API_NODE}/kalender`, payload)
        )
      );

      alert(
        `${newPayloads.length} jadwal pemupukan berhasil disimpan ke Kalender Budidaya.` +
          (duplicateCount > 0
            ? ` ${duplicateCount} jadwal duplikat tidak disimpan ulang.`
            : "")
      );

      navigate("/petani/kalender");
    } catch (err) {
      console.log("ERROR SIMPAN KALENDER:", err.response?.data || err.message);

      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Gagal menyimpan jadwal ke kalender. Pastikan route POST /api/kalender aktif.";

      alert(message);
    } finally {
      setSavingKalender(false);
    }
  };

  const buildReportSummaryRows = () => [
    ["Tanggal Analisis", formatTanggal(analysisContext?.waktuAnalisis || new Date())],
    ["Mode Analisis", isSimulationResult ? "Simulasi Fase" : "Fase Aktual"],
    ["Nama Lahan", selectedLahan?.nama_lahan || "-"],
    [
      "Lokasi",
      `Desa ${selectedLahan?.nama_desa || "-"}, Kec. ${
        selectedLahan?.nama_kecamatan || "-"
      }`,
    ],
    ["Varietas", selectedLahan?.varietas || "-"],
    ["Luas Lahan", `${formatNumber(luasHa, 2)} ha`],
    ["Fase Analisis", getFaseLabel(faseHasil)],
    ["Umur Analisis", umurHasil !== null ? `${umurHasil} hari` : "-"],
    ["Pupuk Utama", activeResult.pupuk || "-"],
    ["Dosis Tahap per Hektare", dosisAcuanUtama],
    ["Jumlah Pupuk Tahap Ini", totalUntukLahanUtama],
    ["Skor Kecocokan Aturan", `${formatNumber(skorKecocokan, 0)}/100`],
    [
      "Sumber Total Satu Musim",
      acuanKementan
        ? `Kementerian Pertanian 2020 — Kecamatan ${acuanKementan.kecamatan}`
        : "Acuan kecamatan belum tersedia",
    ],
    ["Status Aplikasi", applicationStatusMeta.label || "-"],
    ["Penjelasan Status", applicationStatusDescription],
    [
      "Monitoring Digunakan",
      activeResult.monitoring_digunakan ? "Ya" : "Tidak",
    ],
    ["Monitoring Terakhir", monitoringTerakhirLabel],
    ["Kesegaran Monitoring", kesegaranMonitoringLabel],
    [
      "Kondisi Tanaman",
      titleCase(activeResult.monitoring_terakhir?.kondisi_tanaman),
    ],
    [
      "Kondisi Daun",
      titleCase(activeResult.monitoring_terakhir?.kondisi_daun),
    ],
    [
      "Kondisi Air",
      titleCase(activeResult.monitoring_terakhir?.kondisi_air),
    ],
    ["Metode", activeResult.metode || "Rule-Based System"],
  ];

  const downloadLaporanPdf = () => {
    if (!hasResult || !selectedLahan?.id) {
      alert("Jalankan Analisis terlebih dahulu.");
      return;
    }

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("LAPORAN REKOMENDASI PUPUK GEOPANEN", pageWidth / 2, 16, {
      align: "center",
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      "Sistem rekomendasi berbasis aturan — bukan hasil uji laboratorium tanah",
      pageWidth / 2,
      22,
      { align: "center" }
    );

    autoTable(doc, {
      startY: 28,
      head: [["Informasi", "Nilai"]],
      body: buildReportSummaryRows(),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [22, 163, 74] },
      columnStyles: {
        0: { cellWidth: 52, fontStyle: "bold" },
        1: { cellWidth: 132 },
      },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6,
      head: [["Jenis Pupuk", "Dosis per ha", "Total Lahan"]],
      body:
        activeResult.dosis.length > 0
          ? activeResult.dosis.map((item) => [
              item.jenis_pupuk,
              item.label_per_ha,
              item.label_total,
            ])
          : [["-", "-", "-"]],
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [37, 99, 235] },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6,
      head: [[
        "Pupuk",
        "Acuan Buku (kg/ha)",
        "Total Satu Musim",
        "Tahap Saat Ini",
        "Sisa Rencana",
      ]],
      body:
        acuanPupukRows.length > 0
          ? acuanPupukRows.map((item) => [
              item.jenis,
              `${formatNumber(item.dosisPerHa, 0)} kg/ha`,
              item.diperlukan
                ? `${formatNumber(item.totalMusim, 2)} kg`
                : "Tidak diperlukan",
              item.tahapTotal !== null
                ? `${formatNumber(item.tahapTotal, 2)} kg`
                : "Belum dianalisis",
              item.sisa !== null
                ? `${formatNumber(item.sisa, 2)} kg`
                : "-",
            ])
          : [["Acuan kecamatan belum tersedia", "-", "-", "-", "-"]],
      styles: { fontSize: 7.4, cellPadding: 2.2 },
      headStyles: { fillColor: [249, 115, 22] },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6,
      head: [["Alasan Rekomendasi"]],
      body: alasanDinamis.map((item, index) => [`${index + 1}. ${item}`]),
      styles: { fontSize: 7.8, cellPadding: 2.5 },
      headStyles: { fillColor: [5, 150, 105] },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 6,
      head: [["Jadwal", "Tanggal", "Pupuk", "Dosis", "Total"]],
      body:
        activeResult.jadwal.length > 0
          ? activeResult.jadwal.map((item) => [
              item.label,
              formatTanggal(item.tanggal),
              item.pupuk,
              item.label_per_ha,
              item.label_total,
            ])
          : [["Belum tersedia", "-", "-", "-", "-"]],
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [124, 58, 237] },
    });

    const totalPages = doc.getNumberOfPages();

    for (let page = 1; page <= totalPages; page += 1) {
      doc.setPage(page);
      doc.setFontSize(7);
      doc.setTextColor(100);
      doc.text(
        `GeoPanen • Halaman ${page} dari ${totalPages}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 7,
        { align: "center" }
      );
    }

    doc.save(
      `rekomendasi-pupuk-${safeFileName(
        selectedLahan.nama_lahan
      )}-${String(new Date().toISOString()).slice(0, 10)}.pdf`
    );
  };

  const downloadLaporanExcel = () => {
    if (!hasResult || !selectedLahan?.id) {
      alert("Jalankan Analisis terlebih dahulu.");
      return;
    }

    const workbook = XLSX.utils.book_new();

    const ringkasanSheet = XLSX.utils.aoa_to_sheet([
      ["LAPORAN REKOMENDASI PUPUK GEOPANEN"],
      ["Catatan", "Total satu musim menggunakan acuan Kementerian Pertanian 2020; dosis tahap dibagi oleh aturan fase GeoPanen."],
      [],
      ["Informasi", "Nilai"],
      ...buildReportSummaryRows(),
    ]);

    const dosisSheet = XLSX.utils.json_to_sheet(
      activeResult.dosis.map((item) => ({
        "Jenis Pupuk": item.jenis_pupuk,
        "Dosis per Hektare": item.label_per_ha,
        "Total untuk Lahan": item.label_total,
      }))
    );

    const acuanSheet = XLSX.utils.json_to_sheet(
      acuanPupukRows.map((item) => ({
        "Jenis Pupuk": item.jenis,
        "Acuan Buku (kg/ha)": item.dosisPerHa,
        "Total Satu Musim (kg)": item.totalMusim,
        "Dosis Tahap Saat Ini (kg/ha)":
          item.tahapPerHa !== null ? item.tahapPerHa : "Belum dianalisis",
        "Jumlah Tahap Saat Ini (kg)":
          item.tahapTotal !== null ? item.tahapTotal : "Belum dianalisis",
        "Sisa Rencana Musim (kg)": item.sisa !== null ? item.sisa : "-",
        Sumber: acuanKementan
          ? `Kementerian Pertanian 2020 — Kecamatan ${acuanKementan.kecamatan}`
          : "Acuan kecamatan belum tersedia",
      }))
    );

    const jadwalSheet = XLSX.utils.json_to_sheet(
      activeResult.jadwal.map((item) => ({
        Jadwal: item.label,
        Tanggal: formatTanggal(item.tanggal),
        Pupuk: item.pupuk,
        "Dosis per Hektare": item.label_per_ha,
        "Total untuk Lahan": item.label_total,
      }))
    );

    const alasanSheet = XLSX.utils.json_to_sheet(
      alasanDinamis.map((item, index) => ({
        No: index + 1,
        "Alasan Rekomendasi": item,
      }))
    );

    const informasiSheet = XLSX.utils.aoa_to_sheet([
      ["Jenis Data", "Nilai", "Status"],
      ...soilRows.map(([label, value]) => [
        label,
        value,
        activeResult.informasi.data_tanah_terverifikasi
          ? "Terverifikasi sesuai sumber layanan"
          : "Estimasi/simulasi — bukan hasil uji tanah",
      ]),
      [
        "Suhu",
        activeResult.informasi.suhu,
        `Sumber: ${activeResult.informasi.sumber_cuaca}`,
      ],
      [
        "Curah Hujan",
        activeResult.informasi.curah_hujan,
        `Periode: ${activeResult.informasi.periode_curah_hujan}`,
      ],
      ["Kelembapan", activeResult.informasi.kelembapan, "Data lingkungan"],
    ]);

    const monitoringSheet = XLSX.utils.aoa_to_sheet([
      ["MONITORING HARIAN PENDUKUNG REKOMENDASI"],
      [],
      ["Informasi", "Nilai"],
      ["Monitoring tersedia", activeResult.monitoring_tersedia ? "Ya" : "Tidak"],
      ["Monitoring digunakan", activeResult.monitoring_digunakan ? "Ya" : "Tidak"],
      ["Status aplikasi", applicationStatusMeta.label || "-"],
      ["Penjelasan status", applicationStatusDescription],
      ["Monitoring terakhir", monitoringTerakhirLabel],
      ["Kesegaran monitoring", kesegaranMonitoringLabel],
      [
        "Kondisi tanaman",
        titleCase(activeResult.monitoring_terakhir?.kondisi_tanaman),
      ],
      [
        "Kondisi daun",
        titleCase(activeResult.monitoring_terakhir?.kondisi_daun),
      ],
      [
        "Kondisi air",
        titleCase(activeResult.monitoring_terakhir?.kondisi_air),
      ],
      [
        "Tingkat hama",
        titleCase(activeResult.monitoring_terakhir?.tingkat_hama),
      ],
      [
        "Catatan petani",
        activeResult.monitoring_terakhir?.catatan || "-",
      ],
      [],
      ["Alasan monitoring"],
      ...activeResult.alasan_monitoring.map((item, index) => [
        `${index + 1}. ${item}`,
      ]),
      [],
      ["Peringatan monitoring"],
      ...activeResult.peringatan_monitoring.map((item, index) => [
        `${index + 1}. ${item}`,
      ]),
    ]);

    XLSX.utils.book_append_sheet(workbook, ringkasanSheet, "Ringkasan");
    XLSX.utils.book_append_sheet(workbook, dosisSheet, "Dosis");
    XLSX.utils.book_append_sheet(workbook, acuanSheet, "Acuan Kementan");
    XLSX.utils.book_append_sheet(workbook, jadwalSheet, "Jadwal");
    XLSX.utils.book_append_sheet(workbook, alasanSheet, "Alasan");
    XLSX.utils.book_append_sheet(workbook, informasiSheet, "Informasi");
    XLSX.utils.book_append_sheet(workbook, monitoringSheet, "Monitoring");

    XLSX.writeFile(
      workbook,
      `rekomendasi-pupuk-${safeFileName(
        selectedLahan.nama_lahan
      )}-${String(new Date().toISOString()).slice(0, 10)}.xlsx`
    );
  };

  const bagikanKePenyuluh = () => {
    if (!hasResult || !selectedLahan?.id) {
      alert("Jalankan Analisis terlebih dahulu.");
      return;
    }

    const draft = [
      `Pak/Bu Penyuluh, saya ingin berkonsultasi tentang rekomendasi pupuk untuk lahan ${
        selectedLahan.nama_lahan || "-"
      }.`,
      "",
      `Lokasi: Desa ${selectedLahan.nama_desa || "-"}, Kec. ${
        selectedLahan.nama_kecamatan || "-"
      }.`,
      `Varietas: ${selectedLahan.varietas || "-"}.`,
      `Luas lahan: ${formatNumber(luasHa, 2)} ha.`,
      `Mode analisis: ${
        isSimulationResult ? "Simulasi fase" : "Fase aktual"
      }.`,
      `Fase analisis: ${getFaseLabel(faseHasil)}.`,
      `Umur analisis: ${umurHasil ?? "-"} hari.`,
      "",
      `Hasil sistem rekomendasi berbasis aturan:`,
      `- Pupuk utama: ${activeResult.pupuk || "-"}`,
      `- Dosis tahap per hektare: ${dosisAcuanUtama}`,
      `- Jumlah pupuk tahap ini: ${totalUntukLahanUtama}`,
      `- Skor kecocokan aturan: ${formatNumber(skorKecocokan, 0)}/100`,
      `- Status aplikasi: ${applicationStatusMeta.label || "-"}`,
      `- Monitoring digunakan: ${
        activeResult.monitoring_digunakan ? "Ya" : "Tidak"
      }`,
      `- Kondisi tanaman: ${titleCase(
        activeResult.monitoring_terakhir?.kondisi_tanaman
      )}`,
      `- Kondisi daun: ${titleCase(
        activeResult.monitoring_terakhir?.kondisi_daun
      )}`,
      `- Kondisi air: ${titleCase(
        activeResult.monitoring_terakhir?.kondisi_air
      )}`,
      "",
      `Acuan total satu musim: ${acuanKementan ? `Kementerian Pertanian 2020, Kecamatan ${acuanKementan.kecamatan}` : "belum tersedia untuk kecamatan ini"}.`,
      "",
      `Mohon arahan apakah jenis, dosis, dan waktu pemupukan tersebut sesuai dengan kondisi lapangan.`,
    ].join("\n");

    localStorage.setItem("draft_konsultasi_pupuk", draft);
    localStorage.setItem(
      "draft_konsultasi_lahan_id",
      String(selectedLahan.id)
    );

    navigate(
      `/petani/konsultasi?lahan_id=${selectedLahan.id}&source=rekomendasi-pupuk`
    );
  };


  return (
    <div style={styles.page}>
      <style>{RESPONSIVE_CSS}</style>

      <div style={styles.header} className="pupuk-header">
        <div>
          <h1 style={styles.title}>🌿 Rekomendasi Pupuk</h1>
          <p style={styles.subtitle}>
            Sistem rekomendasi pupuk berbasis aturan untuk membantu keputusan petani
          </p>
        </div>

        <div style={styles.headerActions}>
          <button
            type="button"
            style={styles.historyButton}
            onClick={() => navigate("/petani/riwayat-rekomendasi")}
          >
            ↺ Riwayat Rekomendasi
          </button>

          <PetaniNotificationBell />
        </div>
      </div>

      {error && <div style={styles.errorBox}>⚠ {error}</div>}

      {!result && !loadingAnalisis && (
        <div style={styles.infoBox}>
          Pilih lahan lalu klik <b>Analisis Fase Aktual</b>. Fase dan umur tanaman
          dihitung dari tanggal tanam. Simulasi fase tersedia sebagai fitur terpisah
          dan tidak dapat langsung disimpan ke kalender aktual.
        </div>
      )}

      <section style={styles.inputCard}>
        <div style={styles.inputTitleRow}>
          <div>
            <h2 style={styles.inputTitle}>Input Analisis Lahan</h2>
            <p style={styles.inputSubtitle}>
              Data utama berasal dari identitas lahan dan tanggal tanam.
            </p>
          </div>

          <span
            style={{
              ...styles.modeBadge,
              ...(isSimulationResult
                ? styles.modeBadgeSimulation
                : styles.modeBadgeActual),
            }}
          >
            {hasResult
              ? isSimulationResult
                ? "Mode: Simulasi"
                : "Mode: Fase Aktual"
              : "Belum dianalisis"}
          </span>
        </div>

        <div style={styles.inputGrid} className="pupuk-input-grid">
          <div style={styles.inputGroupWide}>
            <label style={styles.label}>Pilih Lahan</label>

            <div style={styles.selectWrap}>
              <span style={styles.locationIcon}>📍</span>

              <select
                value={selectedLahan?.id || ""}
                onChange={(event) => {
                  setSelectedLahanId(event.target.value);
                  setResult(null);
                  setAnalysisContext(null);
                }}
                style={styles.select}
                disabled={loadingLahan}
              >
                {loadingLahan ? (
                  <option>Memuat lahan...</option>
                ) : lahanList.length === 0 ? (
                  <option>Belum ada lahan</option>
                ) : (
                  lahanList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {getSelectedLahanLabel(item)}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Fase Aktual</label>
            <input
              value={faseAktual ? getFaseLabel(faseAktual) : "Belum tersedia"}
              readOnly
              style={styles.inputReadonly}
            />
            <small style={styles.inputHelp}>
              Dihitung otomatis dari tanggal tanam.
            </small>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Umur Tanaman Aktual</label>
            <input
              value={
                Number.isFinite(umurTanamanAsli)
                  ? `${umurTanamanAsli} hari`
                  : "Belum tersedia"
              }
              readOnly
              style={styles.inputReadonly}
            />
            <small style={styles.inputHelp}>
              Tidak diganti secara diam-diam oleh sistem.
            </small>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Varietas</label>

            <input
              value={selectedLahan?.varietas || "-"}
              readOnly
              style={styles.inputReadonly}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Luas Lahan</label>

            <input
              value={`${formatNumber(luasHa, 2)} ha`}
              readOnly
              style={styles.inputReadonly}
            />
          </div>

          <div style={styles.actionGroup}>
            <button
              type="button"
              style={{
                ...styles.analyzeButton,
                opacity: loadingAnalisis ? 0.75 : 1,
              }}
              onClick={runAnalisis}
              disabled={
                loadingAnalisis ||
                loadingLahan ||
                lahanList.length === 0 ||
                !faseAktual
              }
            >
              {loadingAnalisis
                ? "Menganalisis..."
                : "⚙ Analisis Fase Aktual"}
            </button>

            <small>
              Metode: rule-based system. Bukan jaminan hasil pemupukan.
            </small>
          </div>
        </div>

        {!faseAktual && selectedLahan && (
          <div style={styles.warningNote}>
            ⚠ Tanggal tanam belum tersedia. Lengkapi data lahan agar fase aktual dan
            umur tanaman dapat dihitung dengan benar.
          </div>
        )}

        <div style={styles.compactSourceBar}>
          <span style={styles.compactSourceChip}>
            📍 {selectedLahan?.nama_kecamatan || "-"}
          </span>
          <span style={styles.compactSourceChip}>
            🌱 {faseAktual ? getFaseLabel(faseAktual) : "Fase belum tersedia"}
          </span>
          <span style={styles.compactSourceChip}>
            📚 Acuan Kementan 2020
          </span>
          <span style={styles.compactSourceChip}>
            📝 {hasResult && activeResult.monitoring_digunakan
              ? `Monitoring ${monitoringTerakhirLabel}`
              : "Monitoring diperiksa saat analisis"}
          </span>
        </div>
      </section>

      {hasResult && isSimulationResult && (
        <div style={styles.simulationWarning}>
          <strong>🧪 Hasil simulasi fase {getFaseLabel(faseHasil)}</strong>
          <p>
            Umur acuan simulasi adalah {umurHasil} hari. Hasil ini digunakan untuk
            perbandingan dan tidak dapat disimpan ke kalender budidaya aktual.
          </p>
        </div>
      )}

      {hasResult && (
        <section style={styles.monitoringCard}>
          <div style={styles.monitoringHeader}>
            <div>
              <span style={styles.sectionEyebrow}>KONDISI HARI INI</span>
              <h3 style={styles.monitoringTitle}>Monitoring Terakhir</h3>
            </div>

            <span
              style={{
                ...styles.applicationBadge,
                background: applicationStatusMeta.background,
                borderColor: applicationStatusMeta.border,
                color: applicationStatusMeta.color,
              }}
            >
              {applicationStatusMeta.icon} {applicationStatusMeta.label}
            </span>
          </div>

          {activeResult.monitoring_tersedia ? (
            <>
              <div style={styles.monitoringCompactGrid} className="pupuk-monitoring-compact-grid">
                <InfoRow label="Waktu" value={monitoringTerakhirLabel} />
                <InfoRow
                  label="Tanaman"
                  value={titleCase(
                    activeResult.monitoring_terakhir?.kondisi_tanaman
                  )}
                />
                <InfoRow
                  label="Daun"
                  value={titleCase(
                    activeResult.monitoring_terakhir?.kondisi_daun
                  )}
                />
                <InfoRow
                  label="Air"
                  value={titleCase(
                    activeResult.monitoring_terakhir?.kondisi_air
                  )}
                />
                <InfoRow
                  label="Hama"
                  value={titleCase(
                    activeResult.monitoring_terakhir?.tingkat_hama
                  )}
                />
              </div>

              <div
                style={{
                  ...styles.compactStatusNote,
                  background: applicationStatusMeta.background,
                  borderColor: applicationStatusMeta.border,
                  color: applicationStatusMeta.color,
                }}
              >
                {applicationStatusDescription}
              </div>

              {showTechnicalDetails && (
                <div style={styles.detailSection}>
                  <div style={styles.monitoringGrid} className="pupuk-monitoring-grid">
                    <InfoRow
                      label="Kesegaran"
                      value={kesegaranMonitoringLabel}
                    />
                    <InfoRow
                      label="Suhu"
                      value={formatOptionalNumber(
                        activeResult.monitoring_terakhir?.suhu,
                        1,
                        " °C"
                      )}
                    />
                    <InfoRow
                      label="Kelembapan"
                      value={formatOptionalNumber(
                        activeResult.monitoring_terakhir?.kelembapan,
                        0,
                        "%"
                      )}
                    />
                    <InfoRow
                      label="Curah Hujan"
                      value={formatOptionalNumber(
                        activeResult.monitoring_terakhir?.curah_hujan,
                        1,
                        " mm"
                      )}
                    />
                  </div>

                  {isAvailableValue(activeResult.monitoring_terakhir?.catatan) && (
                    <div style={styles.monitoringNote}>
                      <strong>Catatan petani</strong>
                      <p style={{ margin: "4px 0 0" }}>
                        {activeResult.monitoring_terakhir.catatan}
                      </p>
                    </div>
                  )}

                  {activeResult.alasan_monitoring.length > 0 && (
                    <div style={styles.monitoringMessageList}>
                      {activeResult.alasan_monitoring.map((item, index) => (
                        <div
                          key={`monitoring-alasan-${index}`}
                          style={styles.monitoringInfoItem}
                        >
                          <span>✓</span>
                          <p style={{ margin: 0 }}>{item}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeResult.peringatan_monitoring.length > 0 && (
                    <div style={styles.monitoringMessageList}>
                      {activeResult.peringatan_monitoring.map((item, index) => (
                        <div
                          key={`monitoring-peringatan-${index}`}
                          style={styles.monitoringWarningItem}
                        >
                          <span>!</span>
                          <p style={{ margin: 0 }}>{item}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={styles.monitoringEmpty}>
              <div>
                <strong>Monitoring belum tersedia</strong>
                <p>Isi kondisi lahan sebelum menentukan waktu pemupukan.</p>
              </div>

              <button
                type="button"
                style={styles.monitoringActionButton}
                onClick={() => navigate("/petani/kalender")}
              >
                Isi Monitoring
              </button>
            </div>
          )}
        </section>
      )}

      <div style={styles.mainGrid} className="pupuk-main-grid">
        <section style={styles.cardLarge}>
          <CardTitle icon="🌾" title="Pupuk Tahap Saat Ini" />

          {!hasResult ? (
            <div style={styles.largeEmptyState}>
              <span>🌱</span>
              <strong>Belum ada hasil rekomendasi</strong>
              <p>Klik Analisis Fase Aktual.</p>
            </div>
          ) : (
            <>
              <div style={styles.currentDoseHero}>
                <div style={styles.currentDoseBag}>
                  <span>{getFertilizerIcon(activeResult.pupuk)}</span>
                </div>

                <div>
                  <span style={styles.mutedLabel}>Pupuk utama</span>
                  <h2 style={styles.pupukName}>{activeResult.pupuk}</h2>
                  <div style={styles.bigDosis}>
                    {cleanKgNumber(totalUntukLahanUtama)}
                    <span>kg</span>
                  </div>
                  <p style={styles.smallText}>Jumlah yang disiapkan pada tahap ini</p>
                </div>
              </div>

              <div style={styles.currentDoseFacts} className="pupuk-current-dose-facts">
                <div>
                  <span>Dosis tahap</span>
                  <strong>{dosisAcuanUtama}</strong>
                </div>
                <div>
                  <span>Total satu musim</span>
                  <strong>
                    {pupukUtamaAcuan
                      ? `${formatNumber(pupukUtamaAcuan.totalMusim, 2)} kg`
                      : "-"}
                  </strong>
                </div>
                <div>
                  <span>Sisa rencana</span>
                  <strong>
                    {pupukUtamaAcuan?.sisa !== null &&
                    pupukUtamaAcuan?.sisa !== undefined
                      ? `${formatNumber(pupukUtamaAcuan.sisa, 2)} kg`
                      : "-"}
                  </strong>
                </div>
              </div>

              {showTechnicalDetails && (
                <div style={styles.detailSection}>
                  <div style={styles.dosisTable}>
                    <div style={styles.tableHead}>
                      <span>Jenis Pupuk</span>
                      <span>Rincian Dosis Tahap</span>
                    </div>
                    {activeResult.dosis.map((item, index) => (
                      <div key={index} style={styles.tableRow}>
                        <span>{item.jenis_pupuk}</span>
                        <div style={styles.tableDoseText}>
                          <p>
                            <span>Dosis:</span> <b>{item.label_per_ha}</b>
                          </p>
                          <p>
                            <span>Jumlah:</span> <b>{item.label_total}</b>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={styles.technicalScore}>
                    <span>Skor kecocokan aturan</span>
                    <strong>{formatNumber(skorKecocokan, 0)}/100</strong>
                    <small>Bukan nilai akurasi model.</small>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <section style={styles.card}>
          <CardTitle icon="📚" title="Total Pupuk Satu Musim" />

          {acuanKementan ? (
            <>
              <div style={styles.compactSeasonList}>
                {acuanPupukRows.map((item) => (
                  <div
                    key={item.key}
                    style={styles.compactSeasonRow}
                    className="pupuk-compact-season-row"
                  >
                    <div style={styles.compactSeasonIdentity}>
                      <strong>{item.jenis}</strong>
                      <small>{item.fungsi}</small>
                    </div>

                    <b>
                      {item.diperlukan
                        ? `${formatNumber(item.totalMusim, 2)} kg`
                        : "Tidak diperlukan"}
                    </b>
                  </div>
                ))}
              </div>

              <div style={styles.compactBookSource}>
                Kementerian Pertanian 2020 · Kecamatan {acuanKementan.kecamatan}
              </div>

              {showTechnicalDetails && (
                <div style={styles.detailSection}>
                  <div style={styles.seasonDoseList}>
                    {acuanPupukRows.map((item) => (
                      <div key={`detail-${item.key}`} style={styles.seasonDoseItem}>
                        <div style={styles.seasonDoseHeader}>
                          <span style={styles.fertilizerMiniIcon}>
                            {getFertilizerIcon(item.jenis)}
                          </span>
                          <div style={styles.seasonDoseTitle}>
                            <strong>{item.jenis}</strong>
                            <small>{item.fungsi}</small>
                          </div>
                        </div>
                        <div style={styles.seasonDoseGrid} className="pupuk-season-dose-grid">
                          <div>
                            <span>Acuan buku</span>
                            <b>{formatNumber(item.dosisPerHa, 0)} kg/ha</b>
                          </div>
                          <div>
                            <span>Total musim</span>
                            <b>{formatNumber(item.totalMusim, 2)} kg</b>
                          </div>
                          <div>
                            <span>Tahap saat ini</span>
                            <b>
                              {item.tahapTotal !== null
                                ? `${formatNumber(item.tahapTotal, 2)} kg`
                                : "Tidak dijadwalkan"}
                            </b>
                          </div>
                          <div>
                            <span>Sisa</span>
                            <b>
                              {item.sisa !== null
                                ? `${formatNumber(item.sisa, 2)} kg`
                                : "-"}
                            </b>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={styles.unavailableSmall}>
              Acuan kecamatan belum tersedia. Konsultasikan dengan penyuluh.
            </div>
          )}
        </section>

        <section style={styles.card}>
          <CardTitle icon="✅" title="Langkah Berikutnya" />

          <div style={styles.nextStepList}>
            {farmerActions.map((item, index) => (
              <div key={index} style={styles.nextStepItem} className="pupuk-next-step-item">
                <span>{index + 1}</span>
                <p>{item}</p>
              </div>
            ))}
          </div>

          {showTechnicalDetails && alasanDinamis.length > 0 && (
            <div style={styles.detailSection}>
              <strong style={styles.detailHeading}>Alasan lengkap</strong>
              <div style={styles.reasonList}>
                {alasanDinamis.map((item, index) => (
                  <div key={index} style={styles.reasonItem}>
                    <span>{index + 1}</span>
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {showTechnicalDetails && (
          <>
        <section style={styles.card}>
          <CardTitle icon="🗓️" title="Jadwal Pemupukan" />

          {activeResult.jadwal.length === 0 ? (
            <div style={styles.emptyText}>
              Klik Analisis Fase Aktual untuk memuat jadwal.
            </div>
          ) : (
            <div style={styles.timeline}>
              {activeResult.jadwal.map((item, index) => (
                <div
                  key={`${item.tanggal || "tanpa-tanggal"}-${index}`}
                  style={styles.timelineItem}
                  className="pupuk-timeline-item"
                >
                  <div style={styles.timelineLeft}>
                    <span
                      style={{
                        ...styles.timelineDot,
                        background: item.color || "#16a34a",
                      }}
                    />

                    {index < activeResult.jadwal.length - 1 && (
                      <span style={styles.timelineLine} />
                    )}
                  </div>

                  <div style={styles.timelineContent}>
                    <strong>{item.label}</strong>
                    <small>
                      {item.tanggal
                        ? formatTanggal(item.tanggal)
                        : "Tanggal belum tersedia"}
                    </small>
                  </div>

                  <div
                    style={{
                      ...styles.timelineDose,
                      background: `${item.color || "#16a34a"}15`,
                      color: item.color || "#16a34a",
                    }}
                  >
                    <strong>{item.pupuk}</strong>

                    <span style={styles.timelineDoseText}>
                      <p>
                        <small>Dosis Acuan</small>
                        <b>{item.label_per_ha}</b>
                      </p>

                      <p>
                        <small>Total Lahan</small>
                        <b>{item.label_total}</b>
                      </p>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={styles.orangeNote}>
            ℹ Jadwal tanpa tanggal valid tidak akan disimpan. Sistem juga memeriksa
            jadwal yang sama agar tidak tersimpan dua kali.
          </div>
        </section>

        <section style={styles.card}>
          <CardTitle icon="📈" title="Estimasi Dampak Rekomendasi" />

          {!activeResult.dampak.tersedia ? (
            <div style={styles.unavailableState}>
              <span>📉</span>
              <strong>Estimasi dampak belum tersedia</strong>
              <p>
                Layanan belum mengirim produksi saat ini dan produksi setelah
                rekomendasi. Sistem tidak menampilkan angka 0 sebagai hasil.
              </p>
            </div>
          ) : (
            <>
              <div style={styles.impactBox} className="pupuk-impact-box">
                <div style={styles.impactSide}>
                  <p>Produksi Saat Ini</p>
                  <small>Dari layanan rekomendasi</small>
                  <h2>
                    {formatNumber(
                      activeResult.dampak.produksi_saat_ini,
                      2
                    )}{" "}
                    ton
                  </h2>
                </div>

                <div style={styles.donutWrap}>
                  <div
                    style={{
                      ...styles.donut,
                      background: `conic-gradient(#16a34a 0deg ${Math.min(
                        toNumber(activeResult.dampak.kenaikan_persen, 0) * 3.6,
                        360
                      )}deg, #e5e7eb ${Math.min(
                        toNumber(activeResult.dampak.kenaikan_persen, 0) * 3.6,
                        360
                      )}deg 360deg)`,
                    }}
                  >
                    <strong>
                      +{formatNumber(activeResult.dampak.kenaikan_persen, 0)}%
                    </strong>
                    <span>Potensi Kenaikan</span>
                  </div>
                </div>

                <div style={styles.impactSide}>
                  <p>Produksi Dengan Rekomendasi</p>
                  <small>Dari layanan rekomendasi</small>
                  <h2>
                    {formatNumber(
                      activeResult.dampak.produksi_rekomendasi,
                      2
                    )}{" "}
                    ton
                  </h2>
                </div>
              </div>

              <div style={styles.greenNote}>
                ⓘ Potensi produksi diperkirakan meningkat{" "}
                {formatNumber(activeResult.dampak.kenaikan_persen, 0)}% atau{" "}
                {formatNumber(activeResult.dampak.kenaikan_ton, 2)} ton. Nilai
                ini tetap perlu dijelaskan sumber model/perhitungannya.
              </div>
            </>
          )}
        </section>

        <section style={styles.card}>
          <CardTitle icon="ℹ️" title="Data Pendukung" />

          <div style={styles.dataSectionTitle}>
            <div>
              <strong>Informasi Tanah</strong>
              <span
                style={{
                  ...styles.dataStatusBadge,
                  ...(activeResult.informasi.data_tanah_terverifikasi
                    ? styles.dataVerified
                    : styles.dataEstimated),
                }}
              >
                {activeResult.informasi.data_tanah_terverifikasi
                  ? "Sumber terverifikasi"
                  : "Estimasi / simulasi"}
              </span>
            </div>

            <p>
              {!activeResult.informasi.data_tanah_terverifikasi
                ? "Nilai tanah bukan hasil uji laboratorium atau sensor dan tidak boleh dianggap sebagai pengukuran aktual."
                : `Sumber: ${activeResult.informasi.sumber_data_tanah}`}
            </p>
          </div>

          {!activeResult.informasi.data_tanah_tersedia ? (
            <div style={styles.unavailableSmall}>
              Data tanah belum tersedia. Tambahkan hasil uji tanah atau input
              penyuluh untuk rekomendasi yang lebih spesifik.
            </div>
          ) : (
            soilRows.map(([label, value]) => (
              <InfoRow key={label} label={label} value={value} />
            ))
          )}

          <div style={styles.sectionDivider} />

          <div style={styles.dataSectionTitle}>
            <div>
              <strong>Cuaca dan Lingkungan</strong>
              <span style={styles.dataStatusBadge}>
                {activeResult.informasi.sumber_cuaca || "Sumber belum tersedia"}
              </span>
            </div>
          </div>

          <InfoRow
            label="Suhu"
            value={formatOptionalNumber(
              activeResult.informasi.suhu,
              1,
              " °C"
            )}
          />
          <InfoRow
            label="Curah Hujan"
            value={formatOptionalNumber(
              activeResult.informasi.curah_hujan,
              1,
              " mm"
            )}
          />
          <InfoRow
            label="Periode Curah Hujan"
            value={activeResult.informasi.periode_curah_hujan || "-"}
          />
          <InfoRow
            label="Kelembapan"
            value={formatOptionalNumber(
              activeResult.informasi.kelembapan,
              0,
              "%"
            )}
          />

          {!isAvailableValue(
            activeResult.informasi.periode_curah_hujan
          ) && hasResult && (
            <div style={styles.warningNote}>
              ⚠ Periode curah hujan belum dijelaskan oleh layanan. Angka hujan
              tidak diberi kategori rendah, sedang, atau tinggi.
            </div>
          )}
        </section>
          </>
        )}
      </div>

      <div style={styles.detailToggleWrap}>
        <button
          type="button"
          style={styles.detailToggleButton}
          onClick={() => setShowTechnicalDetails((current) => !current)}
        >
          {showTechnicalDetails ? "Sembunyikan detail" : "Lihat detail teknis"}
        </button>
      </div>

      <div style={styles.bottomGrid} className="pupuk-bottom-grid">
        <section style={styles.quickCard}>
          <CardTitle icon="⚡" title="Aksi Cepat" />

          <div style={styles.quickActions} className="pupuk-quick-actions">
            <button
              type="button"
              style={{
                ...styles.quickGreen,
                opacity:
                  hasResult &&
                  !isSimulationResult &&
                  !savingKalender &&
                  activeResult.status_aplikasi !== "TUNDA"
                    ? 1
                    : 0.55,
                cursor:
                  hasResult &&
                  !isSimulationResult &&
                  !savingKalender &&
                  activeResult.status_aplikasi !== "TUNDA"
                    ? "pointer"
                    : "not-allowed",
              }}
              onClick={simpanKeKalender}
              disabled={
                !hasResult ||
                isSimulationResult ||
                savingKalender ||
                activeResult.status_aplikasi === "TUNDA"
              }
            >
              {activeResult.status_aplikasi === "TUNDA"
                ? "⏸ Pemupukan Ditunda"
                : savingKalender
                ? "Menyimpan..."
                : "📅 Simpan ke Kalender"}
            </button>

            <button
              type="button"
              style={{
                ...styles.iconQuickButton,
                ...styles.pdfQuickButton,
                opacity: hasResult ? 1 : 0.55,
              }}
              onClick={downloadLaporanPdf}
              disabled={!hasResult}
              title="Unduh PDF"
              aria-label="Unduh PDF"
            >
              <span>📕</span>
            </button>

            <button
              type="button"
              style={{
                ...styles.iconQuickButton,
                ...styles.excelQuickButton,
                opacity: hasResult ? 1 : 0.55,
              }}
              onClick={downloadLaporanExcel}
              disabled={!hasResult}
              title="Unduh Excel"
              aria-label="Unduh Excel"
            >
              <span>📊</span>
            </button>

            <button
              type="button"
              style={{
                ...styles.quickPurple,
                opacity: hasResult ? 1 : 0.55,
              }}
              onClick={bagikanKePenyuluh}
              disabled={!hasResult}
            >
              🔗 Konsultasikan
            </button>

            <button
              type="button"
              style={{
                ...styles.quickBlue,
                opacity:
                  selectedLahan && !loadingAnalisis ? 1 : 0.55,
              }}
              onClick={() => setSimulationOpen(true)}
              disabled={!selectedLahan || loadingAnalisis}
            >
              🧪 Simulasi Fase
            </button>
          </div>

          <div style={styles.actionHelp}>
            <span>📕 PDF</span>
            <span>📊 Excel</span>
            <span>Hasil simulasi tidak dapat disimpan ke kalender aktual.</span>
          </div>
        </section>

        <section style={styles.tipsCard}>
          <div>
            <h3 style={styles.cardTitle}>☆ Tips Sistem</h3>
            <p>
              {hasResult && activeResult.tips !== "-"
                ? activeResult.tips
                : "Periksa kondisi air dan tanaman sebelum pupuk diberikan."}
            </p>
          </div>

          <div style={styles.tractorBox}>🚜</div>
        </section>
      </div>

      {simulationOpen && (
        <div
          style={styles.modalBackdrop}
          onMouseDown={() => setSimulationOpen(false)}
        >
          <div
            style={styles.simulationModal}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <div>
                <span>Simulasi perencanaan</span>
                <h3>Pilih fase yang ingin dibandingkan</h3>
              </div>

              <button
                type="button"
                style={styles.modalClose}
                onClick={() => setSimulationOpen(false)}
                aria-label="Tutup"
              >
                ×
              </button>
            </div>

            <div style={styles.simulationNotice}>
              🧪 Simulasi menggunakan umur perwakilan fase apabila umur aktual
              tidak sesuai. Hasil tidak akan mengganti fase aktual tanaman.
            </div>

            <label style={styles.modalField}>
              <span>Fase simulasi</span>
              <select
                value={faseSimulasi}
                onChange={(event) => setFaseSimulasi(event.target.value)}
                style={styles.input}
              >
                {FASE_TANAMAN.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label} · Umur acuan {item.umur}
                  </option>
                ))}
              </select>
            </label>

            <div style={styles.simulationCompare}>
              <div>
                <span>Fase aktual</span>
                <strong>
                  {faseAktual ? getFaseLabel(faseAktual) : "Belum tersedia"}
                </strong>
                <small>
                  {Number.isFinite(umurTanamanAsli)
                    ? `${umurTanamanAsli} hari`
                    : "Tanggal tanam belum tersedia"}
                </small>
              </div>

              <div>
                <span>Fase simulasi</span>
                <strong>{getFaseLabel(faseSimulasi)}</strong>
                <small>
                  Umur acuan{" "}
                  {getEffectiveUmurTanaman(
                    faseSimulasi,
                    umurTanamanAsli
                  )}{" "}
                  hari
                </small>
              </div>
            </div>

            <div style={styles.modalActions}>
              <button
                type="button"
                style={styles.cancelButton}
                onClick={() => setSimulationOpen(false)}
              >
                Batal
              </button>

              <button
                type="button"
                style={styles.analyzeButton}
                onClick={runSimulasi}
                disabled={loadingAnalisis}
              >
                {loadingAnalisis
                  ? "Menjalankan..."
                  : "Jalankan Simulasi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CardTitle({ icon, title }) {
  return (
    <div style={styles.cardTitleRow}>
      <span>{icon}</span>
      <h3>{title}</h3>
    </div>
  );
}


function InfoRow({ label, value }) {
  return (
    <div style={styles.infoRow}>
      <span>{label}</span>
      <strong>{isAvailableValue(value) ? value : "-"}</strong>
    </div>
  );
}

const RESPONSIVE_CSS = `
  * {
    box-sizing: border-box;
  }

  .pupuk-source-summary > div,
  .pupuk-result-context > div {
    display: grid;
    gap: 4px;
    padding: 11px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    background: #f8fafc;
  }

  .pupuk-source-summary span,
  .pupuk-result-context span,
  .pupuk-data-title p,
  .pupuk-simulation-compare span,
  .pupuk-simulation-compare small {
    color: #64748b;
    font-size: 11px;
  }

  .pupuk-source-summary strong,
  .pupuk-result-context strong,
  .pupuk-simulation-compare strong {
    color: #1f2937;
    font-size: 12px;
    line-height: 1.4;
  }

  .pupuk-suitability small {
    display: block;
    margin-top: 3px;
    color: #15803d;
    font-size: 10px;
  }

  .pupuk-reason-item > span {
    display: grid;
    width: 24px;
    height: 24px;
    flex: 0 0 24px;
    place-items: center;
    border-radius: 50%;
    background: #dcfce7;
    color: #166534;
    font-size: 11px;
    font-weight: 900;
  }

  .pupuk-reason-item p,
  .pupuk-data-title p,
  .pupuk-simulation-warning p {
    margin: 0;
  }

  .pupuk-source-summary {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .pupuk-current-dose-facts > div,
  .pupuk-season-dose-grid > div {
    display: grid;
    gap: 3px;
    padding: 10px;
    border-radius: 10px;
    background: #f8fafc;
  }

  .pupuk-current-dose-facts span,
  .pupuk-season-dose-grid span,
  .pupuk-compact-season-row small {
    color: #64748b;
    font-size: 10px;
  }

  .pupuk-compact-season-row > div {
    min-width: 0;
  }

  .pupuk-compact-season-row strong,
  .pupuk-compact-season-row small {
    display: block;
  }

  .pupuk-compact-season-row strong {
    line-height: 1.25;
  }

  .pupuk-compact-season-row small {
    margin-top: 2px;
    line-height: 1.3;
  }

  .pupuk-current-dose-facts strong,
  .pupuk-season-dose-grid b,
  .pupuk-compact-season-row b {
    color: #0f172a;
    font-size: 13px;
  }

  .pupuk-next-step-item > span {
    display: grid;
    width: 24px;
    height: 24px;
    flex: 0 0 24px;
    place-items: center;
    border-radius: 50%;
    background: #dcfce7;
    color: #166534;
    font-size: 11px;
    font-weight: 900;
  }

  .pupuk-next-step-item p {
    margin: 2px 0 0;
    font-size: 12px;
    line-height: 1.4;
  }

  @media (max-width: 1380px) {
    .pupuk-input-grid {
      grid-template-columns: 1.5fr 1fr 1fr 1fr !important;
    }

    .pupuk-input-grid > div:last-child {
      grid-column: span 2;
    }

    .pupuk-main-grid {
      grid-template-columns: 1.2fr 1fr !important;
    }

    .pupuk-main-grid > section:nth-child(3n) {
      grid-column: auto;
    }

    .pupuk-rekom-grid {
      grid-template-columns: 120px 1fr !important;
    }

    .pupuk-rekom-grid > div:last-child {
      grid-column: 1 / -1;
    }
  }

  .pupuk-main-grid > section {
    min-width: 0;
  }

  @media (max-width: 1180px) {
    .pupuk-main-grid {
      grid-template-columns: 1fr 1fr !important;
    }

    .pupuk-main-grid > section:nth-child(3) {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 1050px) {
    .pupuk-header {
      align-items: flex-start !important;
      flex-direction: column;
    }

    .pupuk-input-grid,
    .pupuk-main-grid,
    .pupuk-bottom-grid {
      grid-template-columns: 1fr !important;
    }

    .pupuk-input-grid > div:last-child {
      grid-column: auto;
    }

    .pupuk-source-summary,
    .pupuk-monitoring-grid,
    .pupuk-monitoring-compact-grid {
      grid-template-columns: 1fr 1fr !important;
    }

    .pupuk-quick-actions {
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    }
  }

  @media (max-width: 760px) {
    .pupuk-rekom-grid,
    .pupuk-impact-box {
      grid-template-columns: 1fr !important;
    }

    .pupuk-timeline-item {
      grid-template-columns: 24px 1fr !important;
    }

    .pupuk-timeline-item > div:last-child {
      grid-column: 2;
    }

    .pupuk-quick-actions {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }
  }

  @media (max-width: 520px) {
    .pupuk-quick-actions,
    .pupuk-monitoring-compact-grid {
      grid-template-columns: 1fr !important;
    }
  }
`;

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: "24px 28px",
    color: "#111827",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    boxSizing: "border-box",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
    gap: 16,
  },

  title: {
    margin: 0,
    fontSize: 32,
    fontWeight: 900,
  },

  subtitle: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 16,
  },

  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },

  historyButton: {
    height: 52,
    padding: "0 22px",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(15,23,42,.06)",
  },

  notifBox: {
    width: 48,
    height: 48,
    borderRadius: 999,
    background: "#ffffff",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
  },

  notifBadge: {
    position: "absolute",
    top: -4,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 999,
    background: "#ef4444",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  errorBox: {
    background: "#fff7ed",
    border: "1px solid #fdba74",
    color: "#9a3412",
    padding: "12px 16px",
    borderRadius: 12,
    marginBottom: 16,
    fontWeight: 700,
  },

  infoBox: {
    background: "#ecfdf5",
    border: "1px solid #86efac",
    color: "#047857",
    padding: "12px 16px",
    borderRadius: 12,
    marginBottom: 16,
    fontWeight: 700,
  },

  inputCard: {
    background: "#ffffff",
    borderRadius: 18,
    border: "1px solid #e5e7eb",
    boxShadow: "0 14px 34px rgba(15,23,42,.07)",
    padding: 22,
    marginBottom: 18,
  },

  inputTitle: {
    margin: 0,
    fontSize: 20,
  },

  inputGrid: {
    display: "grid",
    gridTemplateColumns: "1.55fr 1fr 1fr .9fr .75fr 1.2fr",
    gap: 14,
    alignItems: "end",
  },

  inputGroupWide: {
    display: "grid",
    gap: 10,
  },

  inputGroup: {
    display: "grid",
    gap: 10,
  },

  label: {
    fontWeight: 800,
  },

  selectWrap: {
    minHeight: 62,
    border: "1px solid #d1d5db",
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "0 14px",
  },

  locationIcon: {
    color: "#16a34a",
    fontSize: 24,
  },

  select: {
    width: "100%",
    border: "none",
    outline: "none",
    fontWeight: 800,
    background: "transparent",
  },

  input: {
    height: 62,
    border: "1px solid #d1d5db",
    borderRadius: 12,
    padding: "0 14px",
    outline: "none",
    fontWeight: 800,
    background: "#ffffff",
  },

  inputReadonly: {
    height: 62,
    border: "1px solid #d1d5db",
    borderRadius: 12,
    padding: "0 14px",
    outline: "none",
    fontWeight: 800,
    background: "#f8fafc",
  },

  actionGroup: {
    display: "grid",
    gap: 8,
    textAlign: "center",
  },

  analyzeButton: {
    height: 56,
    border: "none",
    borderRadius: 12,
    background: "linear-gradient(135deg, #16a34a, #047857)",
    color: "#ffffff",
    fontWeight: 900,
    fontSize: 16,
    cursor: "pointer",
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1.18fr .88fr .84fr",
    gap: 18,
  },

  cardLarge: {
    background: "#ffffff",
    borderRadius: 18,
    border: "1px solid #e5e7eb",
    boxShadow: "0 14px 34px rgba(15,23,42,.07)",
    padding: 20,
  },

  card: {
    background: "#ffffff",
    borderRadius: 18,
    border: "1px solid #e5e7eb",
    boxShadow: "0 14px 34px rgba(15,23,42,.07)",
    padding: 20,
  },

  cardTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: 14,
    marginBottom: 18,
  },

  cardTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
  },

  rekomGrid: {
    display: "grid",
    gridTemplateColumns: "140px 1fr 1.3fr",
    gap: 22,
    alignItems: "center",
  },

  bagBox: {
    height: 165,
    borderRadius: 24,
    background: "linear-gradient(180deg, #86efac, #16a34a)",
    color: "#064e3b",
    display: "grid",
    placeItems: "center",
    position: "relative",
    fontWeight: 900,
    fontSize: 30,
    boxShadow: "inset 0 -12px 24px rgba(0,0,0,.12)",
  },

  bagTop: {
    background: "#dcfce7",
    borderRadius: 14,
    padding: "14px 18px",
  },

  bagLeaf: {
    position: "absolute",
    bottom: 18,
    fontSize: 28,
  },

  mutedLabel: {
    margin: 0,
    color: "#475569",
    fontWeight: 700,
  },

  pupukName: {
    margin: "4px 0",
    fontSize: 34,
    fontWeight: 950,
    letterSpacing: 1,
  },

  bigDosis: {
    fontSize: 36,
    color: "#16a34a",
    fontWeight: 950,
    display: "flex",
    alignItems: "baseline",
    gap: 8,
  },

  smallText: {
    color: "#475569",
    margin: 0,
  },

  dosisLabelBox: {
    marginTop: 12,
    display: "grid",
    gap: 8,
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
  },

  dosisTable: {
    borderRadius: 12,
    overflow: "hidden",
    border: "1px solid #e5e7eb",
  },

  tableHead: {
    display: "grid",
    gridTemplateColumns: "1fr 1.6fr",
    background: "#f8fafc",
    padding: "12px 14px",
    fontWeight: 900,
    fontSize: 13,
  },

  tableRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1.6fr",
    padding: "12px 14px",
    borderTop: "1px solid #e5e7eb",
    fontSize: 14,
    alignItems: "center",
  },

  tableDoseText: {
    display: "grid",
    gap: 6,
  },

  emptyRow: {
    padding: 14,
    color: "#64748b",
  },

  emptyText: {
    color: "#64748b",
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
    padding: 14,
  },

  suitabilityBox: {
    background: "#dcfce7",
    borderRadius: 12,
    padding: 14,
    marginTop: 18,
  },

  suitabilityTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    color: "#047857",
    fontSize: 16,
  },

  progressTrack: {
    height: 10,
    background: "#bbf7d0",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 12,
  },

  progressFill: {
    height: "100%",
    borderRadius: 999,
  },

  greenNote: {
    marginTop: 14,
    background: "#dcfce7",
    borderRadius: 12,
    padding: 14,
    color: "#166534",
    lineHeight: 1.5,
  },


  seasonDoseList: {
    display: "grid",
    gap: 12,
  },

  seasonDoseItem: {
    padding: 14,
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    background: "#ffffff",
  },

  seasonDoseHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },

  fertilizerMiniIcon: {
    minWidth: 48,
    height: 38,
    display: "grid",
    placeItems: "center",
    borderRadius: 10,
    background: "#dcfce7",
    color: "#166534",
    fontSize: 11,
    fontWeight: 900,
  },

  seasonDoseTitle: {
    minWidth: 0,
    flex: 1,
    display: "grid",
    gap: 2,
  },

  seasonDoseStatus: {
    flex: "0 0 auto",
    padding: "5px 8px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 800,
  },

  seasonDoseRequired: {
    background: "#dcfce7",
    color: "#166534",
  },

  seasonDoseNotRequired: {
    background: "#f1f5f9",
    color: "#64748b",
  },

  seasonDoseGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
  },

  bookSourceNote: {
    marginTop: 14,
    padding: 13,
    borderRadius: 12,
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1e3a8a",
    lineHeight: 1.5,
  },


  reasonList: {
    display: "grid",
    gap: 16,
  },

  reasonItem: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    color: "#166534",
    lineHeight: 1.45,
    paddingBottom: 12,
    borderBottom: "1px solid #dcfce7",
  },

  timeline: {
    display: "grid",
    gap: 0,
  },

  timelineItem: {
    display: "grid",
    gridTemplateColumns: "28px 1fr 240px",
    gap: 12,
    minHeight: 96,
  },

  timelineLeft: {
    position: "relative",
    display: "flex",
    justifyContent: "center",
  },

  timelineDot: {
    width: 18,
    height: 18,
    borderRadius: 999,
    display: "block",
    zIndex: 2,
    marginTop: 4,
  },

  timelineLine: {
    position: "absolute",
    top: 22,
    width: 3,
    height: 74,
    background: "#d1d5db",
  },

  timelineContent: {
    display: "grid",
    gap: 4,
  },

  timelineDose: {
    borderRadius: 10,
    minHeight: 64,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    fontSize: 14,
    gap: 12,
  },

  timelineDoseText: {
    display: "grid",
    gap: 6,
    textAlign: "right",
  },

  orangeNote: {
    background: "#ffedd5",
    color: "#9a3412",
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    lineHeight: 1.5,
  },

  impactBox: {
    display: "grid",
    gridTemplateColumns: "1fr 150px 1fr",
    alignItems: "center",
    gap: 18,
    textAlign: "center",
  },

  impactSide: {
    color: "#111827",
  },

  donutWrap: {
    display: "grid",
    placeItems: "center",
  },

  donut: {
    width: 130,
    height: 130,
    borderRadius: "50%",
    background:
      "conic-gradient(#16a34a 0deg 280deg, #e5e7eb 280deg 360deg)",
    display: "grid",
    placeItems: "center",
    textAlign: "center",
    position: "relative",
  },

  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    borderBottom: "1px solid #e5e7eb",
    padding: "11px 0",
    gap: 16,
  },

  compactSourceBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },

  compactSourceChip: {
    padding: "7px 10px",
    borderRadius: 999,
    background: "#f1f5f9",
    color: "#475569",
    fontSize: 11,
    fontWeight: 750,
  },

  monitoringCompactGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 10,
  },

  compactStatusNote: {
    marginTop: 12,
    padding: "10px 12px",
    border: "1px solid",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1.45,
  },

  currentDoseHero: {
    display: "flex",
    alignItems: "center",
    gap: 18,
  },

  currentDoseBag: {
    width: 100,
    height: 112,
    flex: "0 0 100px",
    display: "grid",
    placeItems: "center",
    borderRadius: 20,
    background: "linear-gradient(180deg, #86efac, #16a34a)",
    color: "#064e3b",
    fontSize: 20,
    fontWeight: 950,
    boxShadow: "inset 0 -10px 20px rgba(0,0,0,.10)",
  },

  currentDoseFacts: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
    marginTop: 16,
  },

  compactSeasonList: {
    display: "grid",
    gap: 9,
  },

  compactSeasonRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "11px 12px",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    background: "#f8fafc",
  },

  compactSeasonIdentity: {
    minWidth: 0,
    display: "grid",
    gap: 3,
    alignContent: "center",
  },

  compactBookSource: {
    marginTop: 12,
    paddingTop: 10,
    borderTop: "1px solid #e2e8f0",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 700,
  },

  nextStepList: {
    display: "grid",
    gap: 10,
  },

  nextStepItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "10px 11px",
    borderRadius: 12,
    background: "#f8fafc",
    color: "#334155",
  },

  detailSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTop: "1px solid #e2e8f0",
  },

  detailHeading: {
    display: "block",
    marginBottom: 12,
    color: "#334155",
  },

  technicalScore: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    background: "#f1f5f9",
    color: "#475569",
  },

  detailToggleWrap: {
    display: "flex",
    justifyContent: "center",
    margin: "16px 0",
  },

  detailToggleButton: {
    minWidth: 180,
    padding: "10px 16px",
    border: "1px solid #bbf7d0",
    borderRadius: 999,
    background: "#f0fdf4",
    color: "#166534",
    fontWeight: 850,
    cursor: "pointer",
  },

  bottomGrid: {
    display: "grid",
    gridTemplateColumns: "1.4fr .95fr",
    gap: 18,
    marginTop: 18,
  },

  quickCard: {
    background: "#ffffff",
    borderRadius: 18,
    border: "1px solid #e5e7eb",
    boxShadow: "0 14px 34px rgba(15,23,42,.07)",
    padding: 20,
  },

  quickActions: {
    display: "grid",
    gridTemplateColumns: "1.35fr .55fr .55fr 1fr 1fr",
    gap: 12,
  },

  quickGreen: {
    minHeight: 64,
    border: "1px solid #bbf7d0",
    borderRadius: 12,
    background: "#ecfdf5",
    color: "#047857",
    fontWeight: 900,
    cursor: "pointer",
  },

  quickBlue: {
    minHeight: 64,
    border: "1px solid #bfdbfe",
    borderRadius: 12,
    background: "#eff6ff",
    color: "#2563eb",
    fontWeight: 900,
    cursor: "pointer",
  },

  quickPurple: {
    minHeight: 64,
    border: "1px solid #ddd6fe",
    borderRadius: 12,
    background: "#f5f3ff",
    color: "#7c3aed",
    fontWeight: 900,
    cursor: "pointer",
  },

  tipsCard: {
    background: "#f0fdf4",
    borderRadius: 18,
    border: "1px solid #86efac",
    padding: 20,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 18,
  },

  tractorBox: {
    fontSize: 70,
  },

  inputTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 18,
  },

  inputSubtitle: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: 13,
  },

  modeBadge: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 32,
    padding: "0 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  modeBadgeActual: {
    background: "#dcfce7",
    color: "#166534",
    border: "1px solid #86efac",
  },

  modeBadgeSimulation: {
    background: "#ede9fe",
    color: "#6d28d9",
    border: "1px solid #c4b5fd",
  },

  inputHelp: {
    color: "#64748b",
    fontSize: 11,
    lineHeight: 1.4,
  },

  sourceSummary: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
    marginTop: 16,
    paddingTop: 16,
    borderTop: "1px solid #e5e7eb",
  },

  sourceSummaryItem: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
  },

  monitoringCard: {
    marginBottom: 18,
    padding: 18,
    borderRadius: 16,
    border: "1px solid #dbeafe",
    background: "#ffffff",
    boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
  },

  monitoringHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 14,
  },

  sectionEyebrow: {
    color: "#15803d",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.08em",
  },

  monitoringTitle: {
    margin: "4px 0 0",
    color: "#17212b",
    fontSize: 17,
  },

  applicationBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 32,
    padding: "0 12px",
    border: "1px solid",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  monitoringGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },

  monitoringNote: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderLeft: "4px solid #22c55e",
    background: "#f8fafc",
    color: "#334155",
  },

  monitoringEmpty: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    padding: 14,
    borderRadius: 12,
    border: "1px dashed #93c5fd",
    background: "#eff6ff",
    color: "#1e3a8a",
  },

  monitoringActionButton: {
    minHeight: 36,
    padding: "0 13px",
    border: "1px solid #60a5fa",
    borderRadius: 10,
    background: "#ffffff",
    color: "#1d4ed8",
    fontSize: 11,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  monitoringMessageList: {
    display: "grid",
    gap: 8,
    marginTop: 12,
  },

  monitoringInfoItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 9,
    padding: "10px 12px",
    borderRadius: 11,
    background: "#ecfdf5",
    color: "#166534",
  },

  monitoringWarningItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 9,
    padding: "10px 12px",
    borderRadius: 11,
    background: "#fff7ed",
    color: "#9a3412",
  },

  monitoringDisclaimer: {
    margin: "12px 0 0",
    color: "#64748b",
    fontSize: 11,
    lineHeight: 1.5,
  },

  applicationStatusBox: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 16,
    padding: "12px 14px",
    border: "1px solid",
    borderRadius: 13,
  },

  applicationStatusIcon: {
    display: "grid",
    width: 26,
    height: 26,
    flex: "0 0 26px",
    placeItems: "center",
    borderRadius: 999,
    background: "rgba(255,255,255,0.7)",
    fontWeight: 900,
  },

  warningNote: {
    marginTop: 14,
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #fdba74",
    background: "#fff7ed",
    color: "#9a3412",
    fontSize: 13,
    lineHeight: 1.5,
  },

  simulationWarning: {
    marginBottom: 18,
    padding: "14px 16px",
    borderRadius: 14,
    border: "1px solid #c4b5fd",
    background: "#f5f3ff",
    color: "#5b21b6",
  },

  largeEmptyState: {
    minHeight: 260,
    display: "grid",
    placeItems: "center",
    alignContent: "center",
    gap: 8,
    textAlign: "center",
    color: "#64748b",
  },

  resultContextBar: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
    marginBottom: 18,
  },

  cardDescription: {
    margin: "0 0 20px",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.5,
  },

  neutralNote: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.5,
  },

  scoreDisclaimer: {
    margin: "9px 0 0",
    color: "#166534",
    fontSize: 11,
    lineHeight: 1.45,
  },

  unavailableState: {
    minHeight: 250,
    display: "grid",
    placeItems: "center",
    alignContent: "center",
    gap: 8,
    padding: 24,
    textAlign: "center",
    color: "#64748b",
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    borderRadius: 14,
  },

  unavailableSmall: {
    padding: 14,
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    lineHeight: 1.5,
  },

  dataSectionTitle: {
    marginBottom: 10,
  },

  dataStatusBadge: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 24,
    padding: "0 9px",
    marginLeft: 8,
    borderRadius: 999,
    background: "#f1f5f9",
    color: "#475569",
    fontSize: 10,
    fontWeight: 900,
  },

  dataVerified: {
    background: "#dcfce7",
    color: "#166534",
  },

  dataEstimated: {
    background: "#fff7ed",
    color: "#9a3412",
  },

  sectionDivider: {
    height: 1,
    background: "#e5e7eb",
    margin: "18px 0",
  },

  iconQuickButton: {
    minHeight: 64,
    borderRadius: 12,
    fontSize: 25,
    fontWeight: 900,
    cursor: "pointer",
  },

  pdfQuickButton: {
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#dc2626",
  },

  excelQuickButton: {
    border: "1px solid #bbf7d0",
    background: "#ecfdf5",
    color: "#047857",
  },

  actionHelp: {
    display: "flex",
    flexWrap: "wrap",
    gap: 14,
    marginTop: 12,
    color: "#64748b",
    fontSize: 11,
  },

  modalBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    display: "grid",
    placeItems: "center",
    padding: 20,
    background: "rgba(15, 23, 42, .55)",
    backdropFilter: "blur(4px)",
  },

  simulationModal: {
    width: "min(560px, 100%)",
    maxHeight: "90vh",
    overflowY: "auto",
    padding: 22,
    borderRadius: 18,
    background: "#ffffff",
    boxShadow: "0 30px 80px rgba(15,23,42,.30)",
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    paddingBottom: 14,
    borderBottom: "1px solid #e5e7eb",
  },

  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    cursor: "pointer",
    fontSize: 22,
  },

  simulationNotice: {
    margin: "16px 0",
    padding: 12,
    borderRadius: 12,
    background: "#f5f3ff",
    color: "#5b21b6",
    border: "1px solid #c4b5fd",
    fontSize: 12,
    lineHeight: 1.5,
  },

  modalField: {
    display: "grid",
    gap: 8,
    fontWeight: 800,
  },

  simulationCompare: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginTop: 16,
  },

  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
  },

  cancelButton: {
    minHeight: 48,
    padding: "0 18px",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    color: "#475569",
    fontWeight: 800,
    cursor: "pointer",
  },
};