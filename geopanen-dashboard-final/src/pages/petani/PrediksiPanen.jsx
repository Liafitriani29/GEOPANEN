import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const BAR_COLORS = ["#16a34a", "#2563eb", "#f59e0b"];

function PdfFileIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M6.75 2.75h7.1l3.4 3.4v15.1H6.75a2 2 0 0 1-2-2V4.75a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M13.75 2.95v3.7h3.7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M8 16.8c1.55-2.35 2.5-4.5 2.85-6.45.45 1.95 1.25 3.65 2.4 5.1-1.8-.2-3.55.25-5.25 1.35Z"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExcelFileIcon({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="4"
        y="3"
        width="16"
        height="18"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M4 8h16M9.3 8v13M14.7 8v13M4 13h16M4 17h16"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <path
        d="m7.1 5.05 2.1 2.1m0-2.1-2.1 2.1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}


const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const getCurrentPetaniId = () => {
  const user = getUser();

  return (
    user?.id ||
    user?.user_id ||
    user?.petani_id ||
    localStorage.getItem("petani_id") ||
    localStorage.getItem("user_id") ||
    ""
  );
};

const normalizeApiList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

const isFilled = (value) => {
  return value !== undefined && value !== null && value !== "";
};

const pickFilled = (...values) => {
  for (const value of values) {
    if (isFilled(value)) return value;
  }

  return null;
};

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const toNullableNumber = (value) => {
  if (!isFilled(value)) return null;

  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const formatNumber = (value, digit = 2) => {
  return toNumber(value).toLocaleString("id-ID", {
    minimumFractionDigits: digit,
    maximumFractionDigits: digit,
  });
};

const capitalizeWords = (value) => {
  return String(value || "")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

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

const dateDiffInDays = (start, end) => {
  if (!start || !end) return null;

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }

  const diff = endDate.getTime() - startDate.getTime();

  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

const parseArraySafe = (value) => {
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

const stringifyArray = (value) => {
  try {
    return JSON.stringify(Array.isArray(value) ? value : []);
  } catch {
    return "[]";
  }
};

const getLuasHa = (item) => {
  if (!item) return 0;

  if (isFilled(item.luas_ha)) return toNumber(item.luas_ha);

  const luasM2 = toNumber(item.luas_m2 || item.luas);

  if (luasM2 > 20) return luasM2 / 10000;

  return luasM2;
};

const getPrediksiTon = (item) => {
  return toNumber(
    pickFilled(
      item?.prediksi_ton,
      item?.prediksi,
      item?.hasil_panen,
      item?.produksi_ton,
      item?.estimasi_ton,
      0
    )
  );
};

const getPrediksiKg = (item, prediksiTon) => {
  const kg = toNumber(item?.prediksi_kg);
  if (kg > 0) return kg;

  return Math.round(toNumber(prediksiTon) * 1000);
};

const getProduktivitas = (item, prediksiTon, luasHa) => {
  const fromBackend = toNumber(
    pickFilled(
      item?.produktivitas,
      item?.produktivitas_ton_ha,
      item?.produktivitas_sawah
    )
  );

  if (fromBackend > 0) return fromBackend;
  if (!luasHa) return 0;

  return prediksiTon / luasHa;
};

const getCuacaObject = (predictionItem, fallbackLahan) => {
  const predCuaca =
    predictionItem?.cuaca && typeof predictionItem.cuaca === "object"
      ? predictionItem.cuaca
      : {};

  const lahanCuaca =
    fallbackLahan?.cuaca && typeof fallbackLahan.cuaca === "object"
      ? fallbackLahan.cuaca
      : {};

  const suhu = toNullableNumber(
    pickFilled(
      predCuaca.suhu,
      predictionItem?.suhu,
      lahanCuaca.suhu,
      fallbackLahan?.suhu,
      fallbackLahan?.suhu_udara
    )
  );

  const curahHujan = toNullableNumber(
    pickFilled(
      predCuaca.curah_hujan,
      predictionItem?.curah_hujan,
      predictionItem?.hujan,
      lahanCuaca.curah_hujan,
      fallbackLahan?.curah_hujan,
      fallbackLahan?.hujan,
      0
    )
  );

  const kelembapan = toNullableNumber(
    pickFilled(
      predCuaca.kelembapan,
      predictionItem?.kelembapan,
      predictionItem?.humidity,
      lahanCuaca.kelembapan,
      fallbackLahan?.kelembapan,
      fallbackLahan?.humidity
    )
  );

  return {
    suhu,
    curah_hujan: curahHujan,
    kelembapan,
  };
};

const getStatusProductivity = (value) => {
  const num = toNumber(value);

  if (num <= 0) return "-";
  if (num >= 8) return "Tinggi";
  if (num >= 5) return "Sedang";

  return "Rendah";
};

const getTargetStatusPresentation = (status) => {
  const value = String(status || "").toUpperCase();

  if (value === "TERCAPAI") {
    return {
      label: "Tercapai",
      style: {
        background: "#dcfce7",
        color: "#047857",
        border: "1px solid #86efac",
      },
    };
  }

  if (value === "MENDEKATI") {
    return {
      label: "Mendekati",
      style: {
        background: "#fef3c7",
        color: "#92400e",
        border: "1px solid #fde68a",
      },
    };
  }

  if (value === "BELUM TERCAPAI") {
    return {
      label: "Belum Tercapai",
      style: {
        background: "#fee2e2",
        color: "#b91c1c",
        border: "1px solid #fecaca",
      },
    };
  }

  return {
    label: "Belum Tersedia",
    style: {
      background: "#f1f5f9",
      color: "#475569",
      border: "1px solid #cbd5e1",
    },
  };
};

const getSelectedLabel = (item) => {
  if (!item) return "Pilih lahan";

  return `${item.nama_lahan || "Lahan Tanpa Nama"} · Desa ${
    item.nama_desa || "-"
  }, Kec. ${item.nama_kecamatan || "-"}`;
};

const normalizeProjectionRow = (row, index) => {
  const targetAktif = toNumber(
    pickFilled(
      row?.targetAktif,
      row?.target_aktif,
      row?.target_aktif_ton,
      row?.targetPetani,
      row?.target_petani,
      0
    )
  );

  return {
    id: row?.id || index + 1,
    label: row?.label || row?.tanggal || row?.date || `Data ${index + 1}`,
    prediksi: toNumber(row?.prediksi),
    rataRiwayat: toNumber(row?.rataRiwayat || row?.rata_riwayat),
    targetAktif,
    // Alias lama dipertahankan agar data proyeksi lama tetap terbaca.
    targetPetani: targetAktif,
    sumberTarget: String(
      row?.sumberTarget || row?.sumber_target || "SISTEM"
    ).toUpperCase(),
  };
};

const normalizePredictionItem = (item, index, fallbackLahan = null) => {
  const sumber = {
    ...(fallbackLahan || {}),
    ...(item || {}),
  };

  const luasHa = getLuasHa(sumber);
  const prediksiTon = getPrediksiTon(sumber);
  const prediksiKg = getPrediksiKg(sumber, prediksiTon);
  const produktivitas = getProduktivitas(sumber, prediksiTon, luasHa);
  const cuaca = getCuacaObject(item || {}, fallbackLahan || {});

  const rekomendasi = parseArraySafe(
    sumber.rekomendasi_json || sumber.rekomendasi
  );

  const proyeksi = parseArraySafe(sumber.proyeksi_json || sumber.proyeksi).map(
    normalizeProjectionRow
  );

  const tanggal =
    sumber.created_at ||
    sumber.tanggal_prediksi ||
    sumber.tanggal ||
    sumber.updated_at ||
    null;

  const targetPetaniTon = toNullableNumber(sumber.target_petani_ton);
  const targetSistemTon = toNullableNumber(sumber.target_sistem_ton);

  const sumberTargetRaw = String(sumber.sumber_target || "").toUpperCase();
  const sumberTarget =
    sumberTargetRaw === "PETANI" || sumberTargetRaw === "SISTEM"
      ? sumberTargetRaw
      : targetPetaniTon !== null
      ? "PETANI"
      : "SISTEM";

  const targetAktifTon = toNullableNumber(
    pickFilled(
      sumber.target_aktif_ton,
      sumberTarget === "PETANI" ? targetPetaniTon : targetSistemTon,
      targetPetaniTon,
      targetSistemTon
    )
  );

  const persentaseTargetSistem = toNullableNumber(
    sumber.persentase_target_sistem
  );

  const selisihTargetTon = toNullableNumber(
    pickFilled(
      sumber.selisih_target_ton,
      targetAktifTon !== null ? prediksiTon - targetAktifTon : null
    )
  );

  let statusTarget = String(sumber.status_target || "").toUpperCase();

  if (!statusTarget && targetAktifTon !== null) {
    if (prediksiTon >= targetAktifTon) {
      statusTarget = "TERCAPAI";
    } else if (prediksiTon >= targetAktifTon * 0.9) {
      statusTarget = "MENDEKATI";
    } else {
      statusTarget = "BELUM TERCAPAI";
    }
  }

  if (!statusTarget) {
    statusTarget = "BELUM TERSEDIA";
  }

  return {
    id: sumber.id || `${sumber.lahan_id || sumber.sawah_id || index}-${index}`,

    petani_id:
      sumber.petani_id || sumber.user_id || fallbackLahan?.petani_id || "-",
    user_id: sumber.user_id || sumber.petani_id || fallbackLahan?.user_id || "-",

    lahan_id: sumber.lahan_id || sumber.sawah_id || fallbackLahan?.id || "-",
    sawah_id: sumber.sawah_id || sumber.lahan_id || fallbackLahan?.id || "-",

    nama_lahan:
      sumber.nama_lahan ||
      sumber.lahan ||
      sumber.nama_sawah ||
      fallbackLahan?.nama_lahan ||
      `Lahan ${sumber.sawah_id || sumber.lahan_id || "-"}`,

    nama_desa: sumber.nama_desa || fallbackLahan?.nama_desa || "-",
    nama_kecamatan:
      sumber.nama_kecamatan || fallbackLahan?.nama_kecamatan || "-",

    varietas:
      sumber.varietas ||
      sumber.varietas_prediksi ||
      fallbackLahan?.varietas ||
      "-",

    luas_ha: luasHa,
    luas_m2: sumber.luas_m2 || luasHa * 10000,

    prediksi_ton: prediksiTon,
    prediksi_kg: prediksiKg,
    produktivitas,

    model_mape: toNullableNumber(sumber.model_mape),
    model_r2: toNullableNumber(sumber.model_r2),
    model_kedekatan_sederhana: toNullableNumber(
      sumber.model_kedekatan_sederhana
    ),
    production_evaluation_score: toNullableNumber(
      sumber.production_evaluation_score ||
        sumber.risk_score ||
        sumber.skor_risiko
    ),
    production_evaluation_status:
      sumber.production_evaluation_status ||
      sumber.status_risiko ||
      sumber.status ||
      sumber.tingkat_risiko ||
      "-",

    // Dipertahankan agar tetap kompatibel dengan respons backend lama.
    risk_score: toNullableNumber(sumber.risk_score || sumber.skor_risiko),
    status_risiko:
      sumber.status_risiko || sumber.status || sumber.tingkat_risiko || "-",

    model_ai: sumber.model_ai || sumber.model || "-",

    target_petani_ton: targetPetaniTon,
    target_sistem_ton: targetSistemTon,
    target_aktif_ton: targetAktifTon,
    sumber_target: sumberTarget,
    persentase_target_sistem: persentaseTargetSistem,
    selisih_target_ton: selisihTargetTon,
    status_target: statusTarget,

    estimasi_panen: sumber.estimasi_panen || sumber.tanggal_panen || null,

    rekomendasi,
    rekomendasi_json: sumber.rekomendasi_json || stringifyArray(rekomendasi),

    proyeksi,
    proyeksi_json: sumber.proyeksi_json || stringifyArray(proyeksi),

    cuaca,
    suhu: cuaca.suhu,
    curah_hujan: cuaca.curah_hujan,
    kelembapan: cuaca.kelembapan,

    periode: sumber.periode || sumber.tahun || "-",
    created_at: tanggal,
    tanggal_tanam:
      sumber.tanggal_tanam ||
      sumber.tgl_tanam ||
      fallbackLahan?.tanggal_tanam ||
      null,
  };
};

const uniqueLatestByLahan = (rows = []) => {
  const map = new Map();

  rows.forEach((item) => {
    const key = String(item.lahan_id || item.sawah_id || "");

    if (!key || key === "-") return;

    const existing = map.get(key);

    const itemTime = new Date(item.created_at || 0).getTime();
    const existingTime = existing
      ? new Date(existing.created_at || 0).getTime()
      : -1;

    const itemId = Number(item.id || 0);
    const existingId = Number(existing?.id || 0);

    if (
      !existing ||
      itemTime > existingTime ||
      (itemTime === existingTime && itemId > existingId)
    ) {
      map.set(key, item);
    }
  });

  return Array.from(map.values());
};

const normalizeRegionalLevel = (row, fallbackName, currentProductivity) => {
  const source = row && typeof row === "object" ? row : {};

  const avgProductivity = toNumber(
    pickFilled(
      source.avg_productivity_ton_ha,
      source.rata_produktivitas_ton_ha,
      source.avg_productivity,
      source.rata_rata_produktivitas,
      source.produktivitas,
      0
    )
  );

  const differenceTonHa = isFilled(source.difference_ton_ha)
    ? toNumber(source.difference_ton_ha)
    : toNumber(currentProductivity) - avgProductivity;

  const differencePercent = isFilled(source.difference_percent)
    ? toNumber(source.difference_percent)
    : avgProductivity > 0
    ? (differenceTonHa / avgProductivity) * 100
    : 0;

  return {
    name:
      pickFilled(
        source.name,
        source.nama,
        source.nama_desa,
        source.nama_kecamatan,
        fallbackName
      ) || "-",
    avgProductivity,
    totalPrediction: toNumber(
      pickFilled(
        source.total_prediction_ton,
        source.total_prediksi_ton,
        source.total_produksi_ton,
        source.total_hasil_ton,
        0
      )
    ),
    totalArea: toNumber(
      pickFilled(
        source.total_area_ha,
        source.total_luas_ha,
        source.luas_total_ha,
        0
      )
    ),
    landCount: Math.max(
      0,
      Math.round(
        toNumber(
          pickFilled(
            source.land_count,
            source.jumlah_lahan,
            source.total_lahan,
            source.sample_count,
            0
          )
        )
      )
    ),
    differenceTonHa,
    differencePercent,
  };
};

const normalizeRegionalAnalysis = (
  payload,
  currentProductivity,
  fallbackLahan = null
) => {
  const source = payload?.data || payload?.result || payload || {};
  const villageSource = source.village || source.desa || {};
  const districtSource = source.district || source.kecamatan || {};

  return {
    period:
      pickFilled(
        source.period,
        source.periode,
        source.year,
        source.tahun,
        source.tanggal_prediksi
      ) || "-",
    village: normalizeRegionalLevel(
      villageSource,
      fallbackLahan?.nama_desa || "-",
      currentProductivity
    ),
    district: normalizeRegionalLevel(
      districtSource,
      fallbackLahan?.nama_kecamatan || "-",
      currentProductivity
    ),
  };
};

const getComparisonLabel = (differencePercent) => {
  const value = toNumber(differencePercent);

  if (value > 5) return "Di atas rata-rata";
  if (value < -5) return "Di bawah rata-rata";
  return "Setara rata-rata";
};

const getComparisonTone = (differencePercent) => {
  const value = toNumber(differencePercent);

  if (value > 5) return "good";
  if (value < -5) return "warning";
  return "neutral";
};

const getComparisonPresentation = (differencePercent) => {
  const value = toNumber(differencePercent);
  const absoluteValue = Math.abs(value);

  if (value > 5) {
    return {
      label: `${formatNumber(absoluteValue, 1)}% lebih tinggi`,
      shortLabel: "Di atas rata-rata",
      tone: "good",
      icon: "↗",
    };
  }

  if (value < -5) {
    return {
      label: `${formatNumber(absoluteValue, 1)}% lebih rendah`,
      shortLabel: "Di bawah rata-rata",
      tone: "warning",
      icon: "↘",
    };
  }

  return {
    label:
      absoluteValue < 0.05
        ? "Setara"
        : value > 0
        ? `${formatNumber(absoluteValue, 1)}% lebih tinggi`
        : `${formatNumber(absoluteValue, 1)}% lebih rendah`,
    shortLabel: "Setara rata-rata",
    tone: "neutral",
    icon: "≈",
  };
};

const buildCompactRegionalComparison = (level, areaLabel) => {
  if (!level || level.landCount <= 0 || level.avgProductivity <= 0) {
    return `belum memiliki data pembanding ${areaLabel.toLowerCase()}`;
  }

  const differencePercent = toNumber(level.differencePercent);
  const absoluteValue = Math.abs(differencePercent);

  if (absoluteValue < 0.05) {
    return `setara dengan rata-rata ${areaLabel} ${level.name}`;
  }

  if (differencePercent > 0) {
    return `${formatNumber(
      absoluteValue,
      1
    )}% lebih tinggi dari rata-rata ${areaLabel} ${level.name}`;
  }

  return `${formatNumber(
    absoluteValue,
    1
  )}% lebih rendah dari rata-rata ${areaLabel} ${level.name}`;
};

const buildRegionalSentence = (label, level, currentProductivity) => {
  if (!level || level.avgProductivity <= 0 || level.landCount <= 0) {
    return `Data pembanding ${label.toLowerCase()} belum cukup.`;
  }

  const direction =
    level.differencePercent > 5
      ? "lebih tinggi"
      : level.differencePercent < -5
      ? "lebih rendah"
      : "hampir sama";

  return `Produktivitas lahan ${formatNumber(
    currentProductivity,
    2
  )} Ton/Ha ${direction} ${formatNumber(
    Math.abs(level.differencePercent),
    1
  )}% dibanding rata-rata ${label.toLowerCase()} ${formatNumber(
    level.avgProductivity,
    2
  )} Ton/Ha dari ${level.landCount} lahan.`;
};

const getHariMenujuPanen = (estimasiPanen) => {
  if (!estimasiPanen) return "-";

  const today = new Date();
  const days = dateDiffInDays(today, estimasiPanen);

  if (days === null) return "-";

  return `${days} Hari Lagi`;
};

const getUmurTanaman = (lahan, activeResult) => {
  const fromBackend = toNullableNumber(
    activeResult?.umur_tanaman ||
      activeResult?.umur_tanam ||
      activeResult?.umur
  );

  if (fromBackend !== null) return Math.round(fromBackend);

  const tanggalTanam =
    activeResult?.tanggal_tanam ||
    activeResult?.tgl_tanam ||
    lahan?.tanggal_tanam ||
    lahan?.tgl_tanam;

  if (!tanggalTanam) return null;

  return dateDiffInDays(tanggalTanam, new Date());
};

const getFactorStatus = ({
  suhu,
  curahHujan,
  kelembapan,
  produktivitas,
}) => {
  const list = [];

  if (suhu !== null && suhu !== undefined) {
    if (toNumber(suhu) >= 24 && toNumber(suhu) <= 32) {
      list.push({
        label: "Suhu mendukung",
        value: `${formatNumber(suhu, 1)} °C`,
        type: "good",
      });
    } else {
      list.push({
        label: "Suhu perlu dipantau",
        value: `${formatNumber(suhu, 1)} °C`,
        type: "warning",
      });
    }
  }

  if (curahHujan !== null && curahHujan !== undefined) {
    if (toNumber(curahHujan) <= 5) {
      list.push({
        label: "Curah hujan rendah",
        value: `${formatNumber(curahHujan, 1)} mm`,
        type: "warning",
      });
    } else if (toNumber(curahHujan) > 30) {
      list.push({
        label: "Curah hujan tinggi",
        value: `${formatNumber(curahHujan, 1)} mm`,
        type: "warning",
      });
    } else {
      list.push({
        label: "Curah hujan cukup",
        value: `${formatNumber(curahHujan, 1)} mm`,
        type: "good",
      });
    }
  }

  if (kelembapan !== null && kelembapan !== undefined) {
    if (toNumber(kelembapan) >= 60 && toNumber(kelembapan) <= 85) {
      list.push({
        label: "Kelembapan optimal",
        value: `${formatNumber(kelembapan, 1)}%`,
        type: "good",
      });
    } else {
      list.push({
        label: "Kelembapan perlu dipantau",
        value: `${formatNumber(kelembapan, 1)}%`,
        type: "warning",
      });
    }
  }

  if (toNumber(produktivitas) > 0) {
    const statusProduktivitas = getStatusProductivity(produktivitas);

    list.push({
      label: `Produktivitas ${statusProduktivitas.toLowerCase()}`,
      value: `${formatNumber(produktivitas, 2)} Ton/Ha`,
      type:
        statusProduktivitas === "Tinggi"
          ? "good"
          : statusProduktivitas === "Rendah"
          ? "warning"
          : "good",
    });
  }

  return list.slice(0, 4);
};

const buildCompactAnalysis = ({
  sudahKlikPrediksi,
  prediksiTon,
  produktivitas,
  luasHa,
  cuacaAktif,
  umurTanaman,
  activeResult,
  avgPrediksiTonRiwayat,
  targetAktifTon,
  sumberTarget,
  statusTarget,
  selisihTargetTon,
  regionalAnalysis,
}) => {
  if (!sudahKlikPrediksi) {
    return {
      title: "Analisis belum tersedia",
      formula: "Klik Hitung Prediksi untuk melihat alasan hasil panen.",
      shortReason:
        "Sistem akan menganalisis hasil Random Forest, luas lahan, produktivitas, cuaca, umur tanaman, dan pembanding wilayah.",
      action: "Pilih lahan lalu klik Hitung Prediksi.",
      factors: [],
      details: [],
      productionEvaluation: {
        score: null,
        status: "-",
        text: "Evaluasi produksi belum tersedia.",
      },
    };
  }

  const prediksi = toNumber(prediksiTon);
  const luas = toNumber(luasHa);
  const prod = toNumber(produktivitas);
  const target = toNumber(targetAktifTon);
  const avg = toNumber(avgPrediksiTonRiwayat);
  const targetSourceLabel =
    String(sumberTarget || "").toUpperCase() === "PETANI"
      ? "target petani"
      : "target rekomendasi sistem";
  const targetDifference = toNullableNumber(selisihTargetTon);

  const productionEvaluationScore = toNullableNumber(
    activeResult?.production_evaluation_score ?? activeResult?.risk_score
  );

  const productionEvaluationStatus =
    activeResult?.production_evaluation_status ||
    activeResult?.status_risiko ||
    "-";

  const productionEvaluationText =
    productionEvaluationScore !== null
      ? `${productionEvaluationStatus} · Skor ${formatNumber(
          productionEvaluationScore,
          0
        )} · Rule-Based produksi, bukan risiko penyakit Blast`
      : `${productionEvaluationStatus} · Rule-Based produksi, bukan risiko penyakit Blast`;

  const factors = getFactorStatus({
    suhu: cuacaAktif?.suhu,
    curahHujan: cuacaAktif?.curah_hujan,
    kelembapan: cuacaAktif?.kelembapan,
    produktivitas: prod,
  });

  const shortReason = `Model Random Forest menghasilkan prediksi produksi sebesar ${formatNumber(
    prediksi,
    2
  )} Ton. Berdasarkan luas lahan ${formatNumber(
    luas,
    2
  )} Ha, hasil tersebut setara dengan produktivitas ${formatNumber(
    prod,
    2
  )} Ton/Ha.`;

  let action = "Pertahankan pemupukan, irigasi, dan monitoring rutin.";

  if (toNumber(cuacaAktif?.curah_hujan) <= 5) {
    action = "Periksa ketersediaan air dan irigasi karena curah hujan rendah.";
  } else if (toNumber(cuacaAktif?.curah_hujan) > 30) {
    action = "Periksa drainase lahan karena curah hujan tergolong tinggi.";
  }

  if (toNumber(cuacaAktif?.kelembapan) > 85) {
    action =
      "Kurangi kelembapan berlebih dan pastikan sirkulasi serta drainase lahan baik.";
  }

  if (prod > 0 && prod < 5) {
    action =
      "Evaluasi pemupukan, pengairan, varietas, dan praktik budidaya karena produktivitas masih rendah.";
  }

  const compareHistory =
    avg > 0
      ? prediksi >= avg
        ? `Lebih tinggi dari rata-rata riwayat (${formatNumber(avg, 2)} Ton).`
        : `Lebih rendah dari rata-rata riwayat (${formatNumber(avg, 2)} Ton).`
      : "Belum ada rata-rata riwayat pembanding.";

  let compareTarget = "Target aktif belum tersedia.";

  if (target > 0) {
    const differenceText =
      targetDifference === null
        ? ""
        : targetDifference >= 0
        ? ` Surplus ${formatNumber(Math.abs(targetDifference), 2)} Ton.`
        : ` Selisih kekurangan ${formatNumber(
            Math.abs(targetDifference),
            2
          )} Ton.`;

    if (String(statusTarget || "").toUpperCase() === "TERCAPAI") {
      compareTarget = `Target aktif tercapai. ${capitalizeWords(
        targetSourceLabel
      )} sebesar ${formatNumber(target, 2)} Ton.${differenceText}`;
    } else if (String(statusTarget || "").toUpperCase() === "MENDEKATI") {
      compareTarget = `Hasil prediksi mendekati ${targetSourceLabel} sebesar ${formatNumber(
        target,
        2
      )} Ton.${differenceText}`;
    } else {
      compareTarget = `Hasil prediksi masih di bawah ${targetSourceLabel} sebesar ${formatNumber(
        target,
        2
      )} Ton.${differenceText}`;
    }
  }

  const compareVillage = buildRegionalSentence(
    `Desa ${regionalAnalysis?.village?.name || "-"}`,
    regionalAnalysis?.village,
    prod
  );

  const compareDistrict = buildRegionalSentence(
    `Kecamatan ${regionalAnalysis?.district?.name || "-"}`,
    regionalAnalysis?.district,
    prod
  );

  if (
    regionalAnalysis?.district?.avgProductivity > 0 &&
    regionalAnalysis?.district?.differencePercent < -10
  ) {
    action =
      "Evaluasi pemupukan, air, varietas, dan praktik budidaya karena produktivitas berada di bawah rata-rata kecamatan.";
  }

  return {
    title: "Analisis Ringkas",
    formula: `${formatNumber(prediksi, 2)} Ton ÷ ${formatNumber(
      luas,
      2
    )} Ha = ${formatNumber(prod, 2)} Ton/Ha`,
    shortReason,
    action,
    factors,
    productionEvaluation: {
      score: productionEvaluationScore,
      status: productionEvaluationStatus,
      text: productionEvaluationText,
    },
    details: [
      `Umur tanaman saat prediksi: ${
        umurTanaman !== null ? `${umurTanaman} hari` : "-"
      }.`,
      `Suhu: ${
        cuacaAktif?.suhu !== null && cuacaAktif?.suhu !== undefined
          ? `${formatNumber(cuacaAktif.suhu, 1)} °C`
          : "-"
      }.`,
      `Curah hujan: ${
        cuacaAktif?.curah_hujan !== null &&
        cuacaAktif?.curah_hujan !== undefined
          ? `${formatNumber(cuacaAktif.curah_hujan, 1)} mm`
          : "-"
      }.`,
      `Kelembapan: ${
        cuacaAktif?.kelembapan !== null &&
        cuacaAktif?.kelembapan !== undefined
          ? `${formatNumber(cuacaAktif.kelembapan, 1)}%`
          : "-"
      }.`,
      `Evaluasi produksi: ${productionEvaluationText}.`,
      compareHistory,
      compareTarget,
      compareVillage,
      compareDistrict,
    ],
  };
};


const sanitizeFileName = (value) => {
  return String(value || "data")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
};

const getTargetSourceLabel = (item) => {
  return String(item?.sumber_target || "").toUpperCase() === "PETANI"
    ? "Target Petani"
    : `Target Sistem (+${formatNumber(
        item?.persentase_target_sistem ?? 15,
        0
      )}%)`;
};

const getPredictionExportBaseName = (item) => {
  const lahan = sanitizeFileName(item?.nama_lahan || "lahan");
  const tanggal = item?.created_at
    ? new Date(item.created_at).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  return `laporan-prediksi-${lahan}-${tanggal}`;
};

const getPredictionSummaryRows = (item) => {
  const targetSource = getTargetSourceLabel(item);

  return [
    ["ID Prediksi", item?.id ?? "-"],
    ["Tanggal Prediksi", formatTanggal(item?.created_at)],
    ["Nama Lahan", item?.nama_lahan || "-"],
    ["Desa", item?.nama_desa || "-"],
    ["Kecamatan", item?.nama_kecamatan || "-"],
    ["Varietas", item?.varietas || "-"],
    ["Luas Lahan", `${formatNumber(item?.luas_ha, 2)} Ha`],
    ["Prediksi Produksi", `${formatNumber(item?.prediksi_ton, 2)} Ton`],
    ["Prediksi Produksi", `${formatNumber(item?.prediksi_kg, 0)} Kg`],
    ["Produktivitas", `${formatNumber(item?.produktivitas, 2)} Ton/Ha`],
    [
      "MAPE Model",
      item?.model_mape === null || item?.model_mape === undefined
        ? "-"
        : `${formatNumber(item.model_mape, 2)}%`,
    ],
    [
      "R² Model",
      item?.model_r2 === null || item?.model_r2 === undefined
        ? "-"
        : formatNumber(item.model_r2, 4),
    ],
    ["Model AI", item?.model_ai || "-"],
    [
      "Evaluasi Produksi",
      item?.production_evaluation_score !== null &&
      item?.production_evaluation_score !== undefined
        ? `${item?.production_evaluation_status || "-"} · Skor ${formatNumber(
            item.production_evaluation_score,
            0
          )} · Rule-Based`
        : item?.production_evaluation_status || "-",
    ],
    [
      "Target Petani",
      item?.target_petani_ton === null ||
      item?.target_petani_ton === undefined
        ? "-"
        : `${formatNumber(item.target_petani_ton, 2)} Ton`,
    ],
    [
      `Target Sistem (+${formatNumber(
        item?.persentase_target_sistem ?? 15,
        0
      )}%)`,
      item?.target_sistem_ton === null ||
      item?.target_sistem_ton === undefined
        ? "-"
        : `${formatNumber(item.target_sistem_ton, 2)} Ton`,
    ],
    [
      "Target Aktif",
      item?.target_aktif_ton === null ||
      item?.target_aktif_ton === undefined
        ? "-"
        : `${formatNumber(item.target_aktif_ton, 2)} Ton`,
    ],
    ["Sumber Target", targetSource],
    ["Status Target", getTargetStatusPresentation(item?.status_target).label],
    [
      "Selisih Target",
      item?.selisih_target_ton === null ||
      item?.selisih_target_ton === undefined
        ? "-"
        : `${formatNumber(item.selisih_target_ton, 2)} Ton`,
    ],
    ["Estimasi Panen", formatTanggal(item?.estimasi_panen)],
    [
      "Suhu",
      item?.suhu === null || item?.suhu === undefined
        ? "-"
        : `${formatNumber(item.suhu, 1)} °C`,
    ],
    [
      "Curah Hujan",
      item?.curah_hujan === null || item?.curah_hujan === undefined
        ? "-"
        : `${formatNumber(item.curah_hujan, 1)} mm`,
    ],
    [
      "Kelembapan",
      item?.kelembapan === null || item?.kelembapan === undefined
        ? "-"
        : `${formatNumber(item.kelembapan, 1)}%`,
    ],
  ];
};

export default function PrediksiPanen() {
  const navigate = useNavigate();
  const storedUser = getUser();
  const userId = getCurrentPetaniId();

  const [lahanList, setLahanList] = useState([]);
  const [selectedLahanId, setSelectedLahanId] = useState("");
  const [tanggalPrediksi, setTanggalPrediksi] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [targetPetaniInput, setTargetPetaniInput] = useState("");

  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [regionalAnalysis, setRegionalAnalysis] = useState(null);
  const [regionalError, setRegionalError] = useState("");
  const [notifCount, setNotifCount] = useState(0);

  const [loadingLahan, setLoadingLahan] = useState(true);
  const [loadingPrediksi, setLoadingPrediksi] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingRegional, setLoadingRegional] = useState(false);
  const [error, setError] = useState("");

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState(null);

  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [regionalDetailOpen, setRegionalDetailOpen] = useState(false);

  useEffect(() => {
    setLahanList([]);
    setHistory([]);
    setResult(null);
    setRegionalAnalysis(null);
    setRegionalError("");
    setSelectedLahanId("");
    setTargetPetaniInput("");
    setNotifCount(0);
    setRegionalDetailOpen(false);
    refreshAll();
  }, [userId]);

  const latestHistory = useMemo(() => {
    return uniqueLatestByLahan(history);
  }, [history]);

  const selectedLahan = useMemo(() => {
    return (
      lahanList.find((item) => Number(item.id) === Number(selectedLahanId)) ||
      lahanList[0] ||
      null
    );
  }, [lahanList, selectedLahanId]);

  const activeResult = useMemo(() => {
    if (result && Number(result.lahan_id) === Number(selectedLahan?.id)) {
      return result;
    }

    return null;
  }, [result, selectedLahan?.id]);

  const sudahKlikPrediksi = Boolean(activeResult);

  const prediksiTon = sudahKlikPrediksi
    ? toNumber(activeResult?.prediksi_ton)
    : 0;

  const prediksiKg = sudahKlikPrediksi
    ? toNumber(activeResult?.prediksi_kg)
    : 0;

  const luasHa = activeResult?.luas_ha || getLuasHa(selectedLahan);

  const produktivitas = sudahKlikPrediksi
    ? toNumber(activeResult?.produktivitas)
    : 0;

  const modelMape = sudahKlikPrediksi
    ? toNullableNumber(activeResult?.model_mape)
    : null;

  const modelAi = sudahKlikPrediksi ? activeResult?.model_ai || "-" : "-";

  const targetPetaniTon = sudahKlikPrediksi
    ? toNullableNumber(activeResult?.target_petani_ton)
    : null;

  const targetSistemTon = sudahKlikPrediksi
    ? toNullableNumber(activeResult?.target_sistem_ton)
    : null;

  const targetAktifTon = sudahKlikPrediksi
    ? toNullableNumber(activeResult?.target_aktif_ton)
    : null;

  const sumberTarget = sudahKlikPrediksi
    ? String(activeResult?.sumber_target || "SISTEM").toUpperCase()
    : "-";

  const persentaseTargetSistem = sudahKlikPrediksi
    ? toNullableNumber(activeResult?.persentase_target_sistem)
    : null;

  const selisihTargetTon = sudahKlikPrediksi
    ? toNullableNumber(activeResult?.selisih_target_ton)
    : null;

  const statusTarget = sudahKlikPrediksi
    ? activeResult?.status_target || "BELUM TERSEDIA"
    : "BELUM TERSEDIA";

  const targetStatusPresentation = getTargetStatusPresentation(statusTarget);

  const estimasiPanen = sudahKlikPrediksi
    ? activeResult?.estimasi_panen || null
    : null;

  const hariMenujuPanen = sudahKlikPrediksi
    ? getHariMenujuPanen(estimasiPanen)
    : "-";

  const cuacaAktif = sudahKlikPrediksi
    ? activeResult?.cuaca || {
        suhu: null,
        curah_hujan: 0,
        kelembapan: null,
      }
    : {
        suhu: null,
        curah_hujan: 0,
        kelembapan: null,
      };

  const umurTanaman = getUmurTanaman(selectedLahan, activeResult);

  const projectionData = useMemo(() => {
    return sudahKlikPrediksi && Array.isArray(activeResult?.proyeksi)
      ? activeResult.proyeksi
      : [];
  }, [activeResult, sudahKlikPrediksi]);

  const rekomendasi = useMemo(() => {
    return sudahKlikPrediksi && Array.isArray(activeResult?.rekomendasi)
      ? activeResult.rekomendasi
      : [];
  }, [activeResult, sudahKlikPrediksi]);

  const avgPrediksiTonRiwayat = useMemo(() => {
    const valid = latestHistory
      .map((item) => item.prediksi_ton)
      .filter((value) => Number(value) > 0);

    if (valid.length === 0) return 0;

    return valid.reduce((sum, item) => sum + Number(item), 0) / valid.length;
  }, [latestHistory]);

  const compactAnalysis = useMemo(() => {
    return buildCompactAnalysis({
      sudahKlikPrediksi,
      prediksiTon,
      produktivitas,
      luasHa,
      cuacaAktif,
      umurTanaman,
      activeResult,
      avgPrediksiTonRiwayat,
      targetAktifTon,
      sumberTarget,
      statusTarget,
      selisihTargetTon,
      regionalAnalysis,
    });
  }, [
    sudahKlikPrediksi,
    prediksiTon,
    produktivitas,
    luasHa,
    cuacaAktif,
    umurTanaman,
    activeResult,
    avgPrediksiTonRiwayat,
    targetAktifTon,
    sumberTarget,
    statusTarget,
    selisihTargetTon,
    regionalAnalysis,
  ]);

  const comparisonData = useMemo(
    () => [
      {
        name: "Lahan Anda",
        value: Number(toNumber(produktivitas).toFixed(2)),
        totalPrediction: toNumber(prediksiTon),
        totalArea: toNumber(luasHa),
        landCount: sudahKlikPrediksi ? 1 : 0,
        location: selectedLahan?.nama_lahan || "-",
      },
      {
        name: `Desa ${regionalAnalysis?.village?.name || "-"}`,
        value: Number(
          toNumber(regionalAnalysis?.village?.avgProductivity).toFixed(2)
        ),
        totalPrediction: toNumber(
          regionalAnalysis?.village?.totalPrediction
        ),
        totalArea: toNumber(regionalAnalysis?.village?.totalArea),
        landCount: toNumber(regionalAnalysis?.village?.landCount),
        location: `${regionalAnalysis?.village?.landCount || 0} lahan terdata`,
      },
      {
        name: `Kec. ${regionalAnalysis?.district?.name || "-"}`,
        value: Number(
          toNumber(regionalAnalysis?.district?.avgProductivity).toFixed(2)
        ),
        totalPrediction: toNumber(
          regionalAnalysis?.district?.totalPrediction
        ),
        totalArea: toNumber(regionalAnalysis?.district?.totalArea),
        landCount: toNumber(regionalAnalysis?.district?.landCount),
        location: `${regionalAnalysis?.district?.landCount || 0} lahan terdata`,
      },
    ],
    [
      produktivitas,
      prediksiTon,
      luasHa,
      sudahKlikPrediksi,
      selectedLahan,
      regionalAnalysis,
    ]
  );

  const regionalSummary = useMemo(() => {
    if (!sudahKlikPrediksi) {
      return {
        title: "Belum ada hasil perbandingan",
        description:
          "Pilih lahan dan klik Hitung Prediksi untuk membandingkan produktivitas.",
        status: "Menunggu prediksi",
        tone: "neutral",
        icon: "○",
      };
    }

    if (!regionalAnalysis) {
      return {
        title: "Data wilayah belum tersedia",
        description:
          "Prediksi lahan berhasil, tetapi data pembanding desa dan kecamatan belum dapat dimuat.",
        status: "Data belum lengkap",
        tone: "warning",
        icon: "!",
      };
    }

    const village = getComparisonPresentation(
      regionalAnalysis.village?.differencePercent
    );
    const district = getComparisonPresentation(
      regionalAnalysis.district?.differencePercent
    );

    const hasVillage = regionalAnalysis.village?.landCount > 0;
    const hasDistrict = regionalAnalysis.district?.landCount > 0;

    if (!hasVillage && !hasDistrict) {
      return {
        title: "Belum cukup data pembanding",
        description:
          "Tambahkan hasil prediksi lahan lain agar sistem dapat membuat perbandingan wilayah.",
        status: "Data terbatas",
        tone: "warning",
        icon: "!",
      };
    }

    const statusTone =
      village.tone === "warning" || district.tone === "warning"
        ? "warning"
        : village.tone === "good" || district.tone === "good"
        ? "good"
        : "neutral";

    const statusText =
      statusTone === "good"
        ? "Di atas wilayah"
        : statusTone === "warning"
        ? "Perlu ditingkatkan"
        : "Kompetitif";

    const villageText = hasVillage
      ? buildCompactRegionalComparison(regionalAnalysis.village, "Desa")
      : "belum memiliki pembanding desa";

    const districtText = hasDistrict
      ? buildCompactRegionalComparison(regionalAnalysis.district, "Kecamatan")
      : "belum memiliki pembanding kecamatan";

    return {
      title: `Produktivitas ${formatNumber(produktivitas, 2)} Ton/Ha`,
      description: `Hasil lahan ${villageText} dan ${districtText}.`,
      status: statusText,
      tone: statusTone,
      icon: statusTone === "good" ? "↗" : statusTone === "warning" ? "↘" : "≈",
    };
  }, [sudahKlikPrediksi, regionalAnalysis, produktivitas]);

  const regionalConclusion = useMemo(() => {
    if (!sudahKlikPrediksi) {
      return "Klik Hitung Prediksi untuk menampilkan analisis perbandingan wilayah.";
    }

    if (!regionalAnalysis) {
      return "Data pembanding desa dan kecamatan belum tersedia.";
    }

    const villageText = buildCompactRegionalComparison(
      regionalAnalysis.village,
      "Desa"
    );

    const districtText = buildCompactRegionalComparison(
      regionalAnalysis.district,
      "Kecamatan"
    );

    const generalConclusion =
      regionalSummary.tone === "good"
        ? "Secara umum, produktivitas lahan berada di atas rata-rata wilayah."
        : regionalSummary.tone === "warning"
        ? "Secara umum, produktivitas lahan masih perlu ditingkatkan."
        : "Secara umum, produktivitas lahan masih kompetitif.";

    return `Produktivitas ${capitalizeWords(
      selectedLahan?.nama_lahan || "lahan"
    )} sebesar ${formatNumber(
      produktivitas,
      2
    )} Ton/Ha, ${villageText} dan ${districtText}. ${generalConclusion}`;
  }, [
    sudahKlikPrediksi,
    regionalAnalysis,
    regionalSummary.tone,
    selectedLahan?.nama_lahan,
    produktivitas,
  ]);

  async function refreshAll() {
    const lahanRows = await fetchLahan();
    await Promise.all([fetchHistory(lahanRows), fetchNotifCount()]);
  }

  async function fetchLahan() {
    try {
      setLoadingLahan(true);
      setError("");

      if (!userId) {
        setLahanList([]);
        setError("User login tidak ditemukan. Silakan login ulang.");
        return [];
      }

      const res = await api.get("/lahan", {
        params: {
          petani_id: userId,
          user_id: userId,
        },
      });

      const raw = normalizeApiList(res.data);

      const data = raw.filter((item) => {
        const ownerId = item.user_id || item.petani_id || item.id_petani;

        if (!ownerId) return true;

        return String(ownerId) === String(userId);
      });

      setLahanList(data);

      if (data.length > 0) {
        setSelectedLahanId((prev) => {
          const exists = data.some((item) => Number(item.id) === Number(prev));
          return exists ? prev : String(data[0].id);
        });
      } else {
        setSelectedLahanId("");
      }

      return data;
    } catch (err) {
      console.log("ERROR LOAD LAHAN:", err.response?.data || err.message);
      setLahanList([]);
      setError("Gagal memuat data lahan petani.");
      return [];
    } finally {
      setLoadingLahan(false);
    }
  }

  async function fetchHistory(lahanRowsArg = lahanList) {
    try {
      setLoadingHistory(true);

      if (!userId) {
        setHistory([]);
        return;
      }

      const ownedLahanIds = new Set(
        (lahanRowsArg || []).map((item) => String(item.id))
      );

      const res = await api.get("/prediksi", {
        params: {
          petani_id: userId,
          user_id: userId,
        },
      });

      const raw = normalizeApiList(res.data);

      const filteredRaw =
        ownedLahanIds.size > 0
          ? raw.filter((item) => {
              const lahanId = item.lahan_id || item.sawah_id;
              return ownedLahanIds.has(String(lahanId));
            })
          : raw.filter((item) => {
              const ownerId = item.user_id || item.petani_id;
              return String(ownerId) === String(userId);
            });

      const data = filteredRaw
        .map((item, index) => {
          const fallbackLahan = (lahanRowsArg || []).find(
            (lahan) =>
              String(lahan.id) === String(item.lahan_id || item.sawah_id)
          );

          return normalizePredictionItem(item, index, fallbackLahan);
        })
        .sort((a, b) => {
          const timeA = new Date(a.created_at || 0).getTime();
          const timeB = new Date(b.created_at || 0).getTime();

          if (timeB !== timeA) return timeB - timeA;

          return Number(b.id || 0) - Number(a.id || 0);
        });

      setHistory(data);
    } catch (err) {
      console.log("ERROR LOAD RIWAYAT:", err.response?.data || err.message);
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function fetchNotifCount() {
    if (!userId) {
      setNotifCount(0);
      return;
    }

    try {
      const res = await api.get("/notifikasi/count", {
        params: {
          user_id: userId,
          role: "petani",
        },
      });

      const count =
        res.data?.count ??
        res.data?.total ??
        res.data?.data?.count ??
        res.data?.data?.total ??
        res.data?.data?.unread ??
        0;

      setNotifCount(toNumber(count));
    } catch {
      try {
        const res = await api.get("/notifikasi", {
          params: {
            user_id: userId,
            role: "petani",
          },
        });

        const data = normalizeApiList(res.data);
        const unread = data.filter((item) => Number(item.is_read) === 0).length;

        setNotifCount(unread);
      } catch (err) {
        console.log("ERROR LOAD NOTIF:", err.response?.data || err.message);
        setNotifCount(0);
      }
    }
  }

  async function fetchRegionalAnalysis({
    lahanId = selectedLahan?.id,
    predictionId = null,
    predictionDate = tanggalPrediksi,
    currentProductivity = 0,
    fallbackLahan = selectedLahan,
  } = {}) {
    if (!lahanId) {
      setRegionalAnalysis(null);
      return null;
    }

    try {
      setLoadingRegional(true);
      setRegionalError("");

      const res = await api.get("/prediksi/analisis-wilayah", {
        params: {
          sawah_id: Number(lahanId),
          lahan_id: Number(lahanId),
          prediksi_id: predictionId || undefined,
          tanggal_prediksi: predictionDate,
        },
      });

      const normalized = normalizeRegionalAnalysis(
        res.data,
        currentProductivity,
        fallbackLahan
      );

      setRegionalAnalysis(normalized);
      return normalized;
    } catch (err) {
      console.log(
        "ERROR ANALISIS WILAYAH:",
        err.response?.data || err.message
      );
      setRegionalAnalysis(null);
      setRegionalError(
        "Perbandingan desa dan kecamatan belum dapat dimuat. Pastikan endpoint analisis wilayah di backend sudah dibuat."
      );
      return null;
    } finally {
      setLoadingRegional(false);
    }
  }

  async function handlePrediksi() {
    if (!selectedLahan?.id) {
      alert("Pilih lahan terlebih dahulu.");
      return;
    }

    const targetInputText = String(targetPetaniInput || "").trim();
    const targetInputNumber =
      targetInputText === "" ? null : Number(targetInputText);

    if (
      targetInputText !== "" &&
      (!Number.isFinite(targetInputNumber) || targetInputNumber <= 0)
    ) {
      const message = "Target produksi petani harus berupa angka lebih dari 0 Ton.";
      setError(message);
      alert(message);
      return;
    }

    try {
      setLoadingPrediksi(true);
      setError("");
      setRegionalDetailOpen(false);

      const res = await api.post("/prediksi", {
        sawah_id: Number(selectedLahan.id),
        lahan_id: Number(selectedLahan.id),
        petani_id: Number(userId),
        user_id: Number(userId),
        tanggal_prediksi: tanggalPrediksi,
        target_petani_ton: targetInputNumber,
      });

      const payload = res.data?.data || res.data || {};

      if (payload.prediksi_ton === undefined || payload.prediksi_ton === null) {
        alert("Prediksi berhasil dipanggil, tetapi nilai prediksi kosong.");
        setResult(null);
        return;
      }

      const normalized = normalizePredictionItem(
        {
          ...payload,
          petani_id: userId,
          user_id: userId,
          created_at: payload.created_at || new Date().toISOString(),
        },
        0,
        selectedLahan
      );

      setResult(normalized);

      await Promise.all([
        fetchHistory(lahanList),
        fetchRegionalAnalysis({
          lahanId: selectedLahan.id,
          predictionId: normalized.id,
          predictionDate: tanggalPrediksi,
          currentProductivity: normalized.produktivitas,
          fallbackLahan: selectedLahan,
        }),
      ]);
    } catch (err) {
      console.log("ERROR PREDIKSI:", err.response?.data || err.message);

      const message =
        err.response?.data?.message ||
        "Gagal menghitung prediksi. Pastikan backend Node dan FastAPI aktif.";

      setError(message);
      alert(message);
    } finally {
      setLoadingPrediksi(false);
    }
  }

  async function handleDetail(item) {
    try {
      const res = await api.get(`/prediksi/${item.id}`);
      const normalized = normalizePredictionItem(res.data?.data || item, 0);
      setDetailData(normalized);
      setDetailOpen(true);
    } catch (err) {
      console.log("ERROR DETAIL:", err.response?.data || err.message);
      setDetailData(item);
      setDetailOpen(true);
    }
  }

  function handleDownloadPdf(item) {
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const baseName = getPredictionExportBaseName(item);
      const summaryRows = getPredictionSummaryRows(item);

      doc.setFillColor(22, 163, 74);
      doc.rect(0, 0, pageWidth, 28, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("LAPORAN HASIL PREDIKSI PANEN", 14, 13);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(
        `${item?.nama_lahan || "Lahan"} · ${item?.nama_desa || "-"}, ${
          item?.nama_kecamatan || "-"
        }`,
        14,
        20
      );

      doc.setTextColor(15, 23, 42);

      autoTable(doc, {
        startY: 35,
        head: [["Informasi", "Nilai"]],
        body: summaryRows,
        theme: "grid",
        margin: {
          left: 14,
          right: 14,
        },
        headStyles: {
          fillColor: [22, 163, 74],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: [15, 23, 42],
          cellPadding: 2.5,
        },
        columnStyles: {
          0: {
            cellWidth: 62,
            fontStyle: "bold",
            fillColor: [248, 250, 252],
          },
          1: {
            cellWidth: "auto",
          },
        },
      });

      let nextY = (doc.lastAutoTable?.finalY || 35) + 8;
      const recommendations = Array.isArray(item?.rekomendasi)
        ? item.rekomendasi
        : [];

      autoTable(doc, {
        startY: nextY,
        head: [["No.", "Rekomendasi"]],
        body:
          recommendations.length > 0
            ? recommendations.map((recommendation, index) => [
                index + 1,
                recommendation,
              ])
            : [["-", "Belum ada rekomendasi."]],
        theme: "grid",
        margin: {
          left: 14,
          right: 14,
        },
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: [15, 23, 42],
          cellPadding: 2.5,
        },
        columnStyles: {
          0: {
            cellWidth: 14,
            halign: "center",
          },
          1: {
            cellWidth: "auto",
          },
        },
      });

      nextY = (doc.lastAutoTable?.finalY || nextY) + 8;
      const projection = Array.isArray(item?.proyeksi) ? item.proyeksi : [];

      if (projection.length > 0) {
        autoTable(doc, {
          startY: nextY,
          head: [
            [
              "Tanggal",
              "Prediksi (Ton)",
              "Rata-rata Riwayat (Ton)",
              "Target Aktif (Ton)",
            ],
          ],
          body: projection.map((row) => [
            row?.label || "-",
            formatNumber(row?.prediksi, 2),
            formatNumber(row?.rataRiwayat, 2),
            formatNumber(row?.targetAktif ?? row?.targetPetani, 2),
          ]),
          theme: "grid",
          margin: {
            left: 14,
            right: 14,
          },
          headStyles: {
            fillColor: [245, 158, 11],
            textColor: [255, 255, 255],
            fontStyle: "bold",
          },
          bodyStyles: {
            fontSize: 8,
            textColor: [15, 23, 42],
            cellPadding: 2.2,
          },
        });
      }

      const totalPages = doc.getNumberOfPages();

      for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, pageHeight - 15, pageWidth - 14, pageHeight - 15);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(
          `Dicetak oleh GeoPanen pada ${new Date().toLocaleString("id-ID")}`,
          14,
          pageHeight - 9
        );
        doc.text(
          `Halaman ${page} dari ${totalPages}`,
          pageWidth - 14,
          pageHeight - 9,
          {
            align: "right",
          }
        );
      }

      doc.save(`${baseName}.pdf`);
    } catch (error) {
      console.error("GAGAL UNDUH PDF:", error);
      alert(
        "Gagal membuat PDF. Pastikan paket jspdf dan jspdf-autotable sudah terpasang."
      );
    }
  }

  function handleDownloadExcel(item) {
    try {
      const workbook = XLSX.utils.book_new();
      const baseName = getPredictionExportBaseName(item);
      const summaryRows = getPredictionSummaryRows(item);

      const summaryData = [
        ["LAPORAN HASIL PREDIKSI PANEN"],
        [
          `${item?.nama_lahan || "Lahan"} · ${item?.nama_desa || "-"}, ${
            item?.nama_kecamatan || "-"
          }`,
        ],
        [],
        ["Informasi", "Nilai"],
        ...summaryRows,
      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      summarySheet["!merges"] = [
        {
          s: {
            r: 0,
            c: 0,
          },
          e: {
            r: 0,
            c: 1,
          },
        },
        {
          s: {
            r: 1,
            c: 0,
          },
          e: {
            r: 1,
            c: 1,
          },
        },
      ];
      summarySheet["!cols"] = [
        {
          wch: 30,
        },
        {
          wch: 42,
        },
      ];
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Ringkasan");

      const recommendations = Array.isArray(item?.rekomendasi)
        ? item.rekomendasi
        : [];

      const recommendationSheet = XLSX.utils.aoa_to_sheet([
        ["No.", "Rekomendasi"],
        ...(recommendations.length > 0
          ? recommendations.map((recommendation, index) => [
              index + 1,
              recommendation,
            ])
          : [["-", "Belum ada rekomendasi."]]),
      ]);
      recommendationSheet["!cols"] = [
        {
          wch: 8,
        },
        {
          wch: 90,
        },
      ];
      XLSX.utils.book_append_sheet(
        workbook,
        recommendationSheet,
        "Rekomendasi"
      );

      const projection = Array.isArray(item?.proyeksi) ? item.proyeksi : [];

      const projectionSheet = XLSX.utils.aoa_to_sheet([
        [
          "Tanggal",
          "Prediksi (Ton)",
          "Rata-rata Riwayat (Ton)",
          "Target Aktif (Ton)",
          "Sumber Target",
        ],
        ...(projection.length > 0
          ? projection.map((row) => [
              row?.label || "-",
              toNumber(row?.prediksi),
              toNumber(row?.rataRiwayat),
              toNumber(row?.targetAktif ?? row?.targetPetani),
              row?.sumberTarget || item?.sumber_target || "-",
            ])
          : [["-", 0, 0, 0, "-"]]),
      ]);
      projectionSheet["!cols"] = [
        {
          wch: 18,
        },
        {
          wch: 18,
        },
        {
          wch: 25,
        },
        {
          wch: 20,
        },
        {
          wch: 18,
        },
      ];
      XLSX.utils.book_append_sheet(workbook, projectionSheet, "Proyeksi");

      XLSX.writeFile(workbook, `${baseName}.xlsx`, {
        compression: true,
      });
    } catch (error) {
      console.error("GAGAL UNDUH EXCEL:", error);
      alert("Gagal membuat Excel. Pastikan paket xlsx sudah terpasang.");
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>♻ Prediksi Panen</h1>
          <p style={styles.subtitle}>
            AI Smart Farming Decision System untuk {storedUser?.nama || "Petani"}
          </p>
        </div>

        <div style={styles.headerActions}>
          <button style={styles.secondaryButton} onClick={refreshAll}>
            ⟳ Refresh Data
          </button>

          <button
            style={styles.historyButton}
            onClick={() => navigate("/petani/riwayat-panen")}
          >
            ▣ Riwayat Prediksi
          </button>

          <div style={styles.notification}>
            🔔
            {notifCount > 0 && (
              <span style={styles.notificationBadge}>{notifCount}</span>
            )}
          </div>
        </div>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      <section style={styles.inputPanel}>
        <div style={styles.inputGroupWide}>
          <label style={styles.label}>📍 Pilih Lahan</label>

          <div style={styles.selectBox}>
            <div style={styles.locationIcon}>📍</div>

            <select
              value={selectedLahan?.id || ""}
              onChange={(e) => {
                setSelectedLahanId(e.target.value);
                setTargetPetaniInput("");
                setResult(null);
                setRegionalAnalysis(null);
                setRegionalError("");
                setRegionalDetailOpen(false);
              }}
              style={styles.select}
              disabled={loadingLahan}
            >
              {loadingLahan ? (
                <option>Memuat lahan...</option>
              ) : lahanList.length === 0 ? (
                <option>Belum ada lahan untuk akun ini</option>
              ) : (
                lahanList.map((item) => (
                  <option key={item.id} value={item.id}>
                    {getSelectedLabel(item)}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Pilih Tanggal Prediksi</label>

          <input
            type="date"
            value={tanggalPrediksi}
            onChange={(e) => setTanggalPrediksi(e.target.value)}
            style={styles.dateInput}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Target Produksi Petani (Opsional)</label>

          <input
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={targetPetaniInput}
            onChange={(event) => setTargetPetaniInput(event.target.value)}
            placeholder="Contoh: 1.20 Ton"
            style={styles.dateInput}
          />

          <small style={styles.inputHint}>
            Kosongkan untuk memakai target rekomendasi sistem.
          </small>
        </div>

        <div style={styles.actionGroup}>
          <button
            style={{
              ...styles.predictButton,
              opacity: loadingPrediksi ? 0.75 : 1,
              cursor: loadingPrediksi ? "not-allowed" : "pointer",
            }}
            onClick={handlePrediksi}
            disabled={loadingPrediksi || loadingLahan || lahanList.length === 0}
          >
            {loadingPrediksi ? "⏳ Menghitung..." : "▣ Hitung Prediksi"}
          </button>

          <small>Data hasil prediksi disimpan sesuai akun petani login.</small>
        </div>
      </section>

      <section style={styles.resultPanel}>
        <h3 style={styles.sectionTitle}>Hasil Prediksi Panen</h3>

        <div style={styles.resultGrid}>
          <MetricCard
            icon="▣"
            title="Prediksi Hasil Panen"
            value={`${formatNumber(prediksiTon, 2)} Ton`}
            sub={`${formatNumber(prediksiKg, 0)} Kg`}
            color="#16a34a"
            bg="#ecfdf5"
          />

          <MetricCard
            icon="🌧"
            title="Produktivitas"
            value={`${formatNumber(produktivitas, 2)} Ton/Ha`}
            sub={
              sudahKlikPrediksi
                ? getStatusProductivity(produktivitas)
                : "Belum dihitung"
            }
            color="#2563eb"
            bg="#eff6ff"
          />

          <MetricCard
            icon="📊"
            title="MAPE Model"
            value={
              sudahKlikPrediksi && modelMape !== null
                ? `${formatNumber(modelMape, 2)}%`
                : "-"
            }
            sub={
              sudahKlikPrediksi
                ? "Rata-rata kesalahan prediksi"
                : "Belum dihitung"
            }
            color="#f59e0b"
            bg="#fffbeb"
          />

          <MetricCard
            icon="⏱"
            title="Estimasi Waktu Panen"
            value={hariMenujuPanen}
            sub={
              sudahKlikPrediksi ? formatTanggal(estimasiPanen) : "Belum ada estimasi"
            }
            color="#9333ea"
            bg="#faf5ff"
          />
        </div>
      </section>

      <section style={styles.analysisPanel}>
        <div style={styles.analysisHeader}>
          <div>
            <h3 style={styles.cardTitle}>Analisis Ringkas Prediksi</h3>
            <p style={styles.muted}>
              Dibuat singkat agar petani langsung paham alasan hasil prediksi.
            </p>
          </div>

          <button
            type="button"
            style={styles.analysisButton}
            onClick={() => setAnalysisOpen(true)}
            disabled={!sudahKlikPrediksi}
          >
            Lihat Analisis Detail →
          </button>
        </div>

        <div style={styles.compactAnalysisGrid}>
          <div style={styles.compactBoxGreen}>
           <span style={styles.compactLabel}>
  Konversi Hasil Prediksi
</span>
            <h3>{compactAnalysis.formula}</h3>
            <p>{compactAnalysis.shortReason}</p>
          </div>

          <div style={styles.compactBox}>
            <span style={styles.compactLabel}>Faktor Utama</span>

            {compactAnalysis.factors.length === 0 ? (
              <p style={styles.muted}>Belum ada faktor. Klik Hitung Prediksi.</p>
            ) : (
              <div style={styles.factorPills}>
                {compactAnalysis.factors.map((item, index) => (
                  <span
                    key={index}
                    style={{
                      ...styles.factorPill,
                      ...(item.type === "good"
                        ? styles.factorGood
                        : item.type === "danger"
                        ? styles.factorDanger
                        : styles.factorWarning),
                    }}
                  >
                    {item.label}: {item.value}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={styles.compactBoxYellow}>
            <span style={styles.compactLabel}>Tindakan Sistem</span>
            <h3>{compactAnalysis.action}</h3>
            <p>
              Tindakan ini disesuaikan dari cuaca, produktivitas, umur tanaman,
              dan perbandingan wilayah.
            </p>
          </div>
        </div>
      </section>

      <section style={styles.regionalPanel}>
        <div style={styles.regionalHeader}>
          <div>
            <span style={styles.sectionEyebrow}>
              ANALISIS PREDIKSI WILAYAH
            </span>
            <h3 style={styles.regionalTitle}>
              Analisis Prediksi dan Perbandingan Wilayah
            </h3>
            <p style={styles.regionalSubtitle}>
              Membandingkan produktivitas hasil prediksi lahan dengan rata-rata
              desa dan kecamatan berdasarkan satuan Ton/Ha.
            </p>
          </div>

          <div style={styles.regionalHeaderActions}>
            <span style={styles.periodBadge}>
              {regionalAnalysis?.period || tanggalPrediksi.slice(0, 4)}
            </span>

            <button
              type="button"
              style={styles.regionalDetailButton}
              onClick={() => setRegionalDetailOpen((prev) => !prev)}
              disabled={!sudahKlikPrediksi}
            >
              {regionalDetailOpen ? "Sembunyikan detail" : "Lihat detail data"}
            </button>
          </div>
        </div>

        {regionalError && <div style={styles.regionalError}>{regionalError}</div>}

        <div
          style={{
            ...styles.regionalSummaryBanner,
            ...(regionalSummary.tone === "good"
              ? styles.summaryGood
              : regionalSummary.tone === "warning"
              ? styles.summaryWarning
              : styles.summaryNeutral),
          }}
        >
          <div style={styles.summaryIcon}>{regionalSummary.icon}</div>

          <div style={styles.summaryContent}>
            <span style={styles.summaryStatus}>{regionalSummary.status}</span>
            <h3 style={styles.summaryTitle}>{regionalSummary.title}</h3>
            <p style={styles.summaryDescription}>{regionalSummary.description}</p>
          </div>

          <div style={styles.summaryQuickStats}>
            <div style={styles.summaryQuickStat}>
              <small style={styles.summaryQuickLabel}>Desa</small>
              <strong style={styles.summaryQuickValue}>
                {regionalAnalysis?.village?.landCount > 0
                  ? getComparisonPresentation(
                      regionalAnalysis.village.differencePercent
                    ).label
                  : "-"}
              </strong>
            </div>
            <div style={styles.summaryQuickStat}>
              <small style={styles.summaryQuickLabel}>Kecamatan</small>
              <strong style={styles.summaryQuickValue}>
                {regionalAnalysis?.district?.landCount > 0
                  ? getComparisonPresentation(
                      regionalAnalysis.district.differencePercent
                    ).label
                  : "-"}
              </strong>
            </div>
          </div>
        </div>

        <div style={styles.regionalMetricGrid}>
          <RegionalMetricCard
            icon="🌾"
            title="Lahan Anda"
            subtitle={selectedLahan?.nama_lahan || "-"}
            value={sudahKlikPrediksi ? produktivitas : 0}
            helperText={
              sudahKlikPrediksi
                ? `${formatNumber(prediksiTon, 2)} Ton dari ${formatNumber(
                    luasHa,
                    2
                  )} Ha`
                : "Belum dihitung"
            }
            tone="primary"
          />

          <RegionalMetricCard
            icon="🏘️"
            title={`Desa ${regionalAnalysis?.village?.name || "-"}`}
            subtitle={
  regionalAnalysis?.village?.landCount
    ? `${regionalAnalysis.village.landCount} lahan terdata`
    : "Belum ada data wilayah"
}
            value={regionalAnalysis?.village?.avgProductivity || 0}
            helperText={
              regionalAnalysis?.village?.landCount
                ? getComparisonPresentation(
                    regionalAnalysis.village.differencePercent
                  ).label
                : "Data belum tersedia"
            }
            differencePercent={
              regionalAnalysis?.village?.differencePercent || 0
            }
            tone={getComparisonTone(
              regionalAnalysis?.village?.differencePercent
            )}
          />

          <RegionalMetricCard
            icon="📍"
            title={`Kecamatan ${regionalAnalysis?.district?.name || "-"}`}
         subtitle={
  regionalAnalysis?.district?.landCount
    ? `${regionalAnalysis.district.landCount} lahan terdata`
    : "Belum ada data wilayah"
}
            value={regionalAnalysis?.district?.avgProductivity || 0}
            helperText={
              regionalAnalysis?.district?.landCount
                ? getComparisonPresentation(
                    regionalAnalysis.district.differencePercent
                  ).label
                : "Data belum tersedia"
            }
            differencePercent={
              regionalAnalysis?.district?.differencePercent || 0
            }
            tone={getComparisonTone(
              regionalAnalysis?.district?.differencePercent
            )}
          />
        </div>

        <div style={styles.regionalContentGrid}>
          <div style={styles.regionalChartBox}>
            <div style={styles.chartBoxHeader}>
              <div>
                <h4 style={styles.chartBoxTitle}>Grafik Produktivitas</h4>
                <small style={styles.muted}>
                  Arahkan kursor pada batang untuk melihat data lengkap.
                </small>
              </div>

              <span style={styles.chartUnitBadge}>Ton/Ha</span>
            </div>

            {loadingRegional ? (
              <div style={styles.emptyBox}>Memuat analisis wilayah...</div>
            ) : (
              <ResponsiveContainer width="100%" height={235}>
                <BarChart
                  data={comparisonData}
                  margin={{ top: 12, right: 8, left: -10, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                  />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    tick={{ fontSize: 11, fill: "#475569" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<RegionalChartTooltip />} />
                  <Bar dataKey="value" radius={[10, 10, 4, 4]} maxBarSize={110}>
                    {comparisonData.map((_, index) => (
                      <Cell key={index} fill={BAR_COLORS[index]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={styles.regionalInsightBox}>
            <div style={styles.insightTop}>
              <span style={styles.insightIcon}>💡</span>
              <div>
                <span style={styles.compactLabel}>KESIMPULAN</span>
                <h4 style={styles.insightTitle}>{regionalSummary.status}</h4>
              </div>
            </div>

            <p style={styles.regionalSummaryText}>
              {regionalConclusion}
            </p>

            <div style={styles.compactStatusList}>
              <CompactComparisonRow
                label="Dibanding desa"
                level={regionalAnalysis?.village}
              />
              <CompactComparisonRow
                label="Dibanding kecamatan"
                level={regionalAnalysis?.district}
              />
            </div>

            <button
              type="button"
              style={styles.insightActionButton}
              onClick={() => setRegionalDetailOpen((prev) => !prev)}
              disabled={!sudahKlikPrediksi}
            >
              {regionalDetailOpen ? "Tutup rincian" : "Buka rincian perhitungan"}
            </button>
          </div>
        </div>

        {regionalDetailOpen && (
          <div style={styles.regionalDetailPanel}>
            <div style={styles.detailPanelHeader}>
              <div>
                <span style={styles.compactLabel}>RINCIAN DATA</span>
                <h4 style={styles.detailPanelTitle}>
                  Dasar perhitungan perbandingan
                </h4>
              </div>

              <button
                type="button"
                style={styles.closeDetailButton}
                onClick={() => setRegionalDetailOpen(false)}
              >
                ×
              </button>
            </div>

            <div style={styles.regionalDetailGrid}>
              <RegionalDetailCard
                title={`Desa ${regionalAnalysis?.village?.name || "-"}`}
                totalPrediction={regionalAnalysis?.village?.totalPrediction || 0}
                totalArea={regionalAnalysis?.village?.totalArea || 0}
                landCount={regionalAnalysis?.village?.landCount || 0}
                differenceTonHa={
                  regionalAnalysis?.village?.differenceTonHa || 0
                }
                differencePercent={
                  regionalAnalysis?.village?.differencePercent || 0
                }
              />

              <RegionalDetailCard
                title={`Kecamatan ${
                  regionalAnalysis?.district?.name || "-"
                }`}
                totalPrediction={
                  regionalAnalysis?.district?.totalPrediction || 0
                }
                totalArea={regionalAnalysis?.district?.totalArea || 0}
                landCount={regionalAnalysis?.district?.landCount || 0}
                differenceTonHa={
                  regionalAnalysis?.district?.differenceTonHa || 0
                }
                differencePercent={
                  regionalAnalysis?.district?.differencePercent || 0
                }
              />

              <div style={styles.formulaCard}>
                <span style={styles.compactLabel}>RUMUS</span>
                <strong style={styles.formulaText}>
                  Total prediksi ÷ total luas
                </strong>
                <p style={styles.formulaDescription}>
                  Sistem memakai Ton/Ha agar lahan dengan luas berbeda tetap
                  dapat dibandingkan secara adil.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      <div style={styles.dashboardGrid}>
        <section style={styles.cardLarge}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Proyeksi Hasil Panen</h3>
            <small style={styles.muted}>Estimasi perkembangan hasil panen</small>
          </div>

          {projectionData.length === 0 ? (
            <div style={styles.emptyBox}>
              Belum ada data proyeksi. Klik Hitung Prediksi.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={projectionData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip
                    formatter={(value, name) => [
                      `${formatNumber(value, 2)} Ton`,
                      name,
                    ]}
                  />

                  <Line
                    type="monotone"
                    dataKey="prediksi"
                    name="Prediksi Hasil"
                    stroke="#16a34a"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />

                  <Line
                    type="monotone"
                    dataKey="rataRiwayat"
                    name="Rata-rata Riwayat"
                    stroke="#2563eb"
                    strokeDasharray="6 6"
                    strokeWidth={2}
                    dot={false}
                  />

                  <Line
                    type="monotone"
                    dataKey="targetAktif"
                    name={`Target Aktif (${sumberTarget === "PETANI" ? "Petani" : "Sistem"})`}
                    stroke="#f59e0b"
                    strokeDasharray="6 6"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>

              <div style={styles.chartLegend}>
                <Legend color="#16a34a" text="Prediksi Hasil (Ton)" />
                <Legend color="#2563eb" text="Rata-rata Riwayat" />
                <Legend
                  color="#f59e0b"
                  text={`Target Aktif (${sumberTarget === "PETANI" ? "Petani" : "Sistem"})`}
                />
              </div>
            </>
          )}
        </section>

        <section style={styles.card}>
          <h3 style={styles.cardTitle}>Faktor yang Mempengaruhi Prediksi</h3>

          <FactorRow
            icon="🌡"
            label="Suhu Rata-rata"
            value={
              cuacaAktif.suhu !== null
                ? `${formatNumber(cuacaAktif.suhu, 1)} °C`
                : "-"
            }
          />

          <FactorRow
            icon="🌧"
            label="Curah Hujan"
            value={
              cuacaAktif.curah_hujan !== null
                ? `${formatNumber(cuacaAktif.curah_hujan, 1)} mm`
                : "0,0 mm"
            }
          />

          <FactorRow
            icon="💧"
            label="Kelembapan"
            value={
              cuacaAktif.kelembapan !== null
                ? `${formatNumber(cuacaAktif.kelembapan, 1)} %`
                : "-"
            }
          />

          <FactorRow
            icon="🌱"
            label="Umur Tanaman"
            value={umurTanaman !== null ? `${umurTanaman} Hari` : "-"}
          />

          <FactorRow
            icon="🌾"
            label="Luas Lahan"
            value={`${formatNumber(luasHa, 2)} Ha`}
          />

          <FactorRow
            icon="🧬"
            label="Jenis Varietas"
            value={selectedLahan?.varietas || activeResult?.varietas || "-"}
          />

          <FactorRow
            icon="📈"
            label="Evaluasi Produksi"
            value={
              sudahKlikPrediksi &&
              compactAnalysis.productionEvaluation?.score !== null &&
              compactAnalysis.productionEvaluation?.score !== undefined
                ? `${compactAnalysis.productionEvaluation.status} · Skor ${formatNumber(
                    compactAnalysis.productionEvaluation.score,
                    0
                  )} · Rule-Based`
                : sudahKlikPrediksi
                ? `${compactAnalysis.productionEvaluation?.status || "-"} · Rule-Based`
                : "-"
            }
          />

          <FactorRow
            icon="🦠"
            label="Risiko Penyakit Blast"
            value="Lihat fitur Monitoring Tanaman"
          />
        </section>

        <section style={styles.card}>
          <h3 style={styles.cardTitle}>Rekomendasi untuk Hasil Optimal</h3>

          {rekomendasi.length === 0 ? (
            <div style={styles.emptyBox}>Belum ada rekomendasi.</div>
          ) : (
            <div style={styles.recommendationList}>
              {rekomendasi.map((item, index) => (
                <Recommendation key={index} text={item} />
              ))}
            </div>
          )}

          <button
            style={styles.detailButton}
            onClick={() => activeResult && handleDetail(activeResult)}
            disabled={!activeResult}
          >
            Lihat Detail Rekomendasi →
          </button>
        </section>

        <section style={styles.card}>
          <h3 style={styles.cardTitle}>Detail Prediksi</h3>

          <DetailRow
            label="Total Prediksi"
            value={`${formatNumber(prediksiTon, 2)} Ton`}
          />
          <DetailRow
            label="Produktivitas"
            value={`${formatNumber(produktivitas, 2)} Ton/Ha`}
          />
          <DetailRow label="Luas Lahan" value={`${formatNumber(luasHa, 2)} Ha`} />
          <DetailRow
            label="Umur Tanaman Saat Ini"
            value={umurTanaman !== null ? `${umurTanaman} Hari` : "-"}
          />
          <DetailRow
            label="Estimasi Panen"
            value={sudahKlikPrediksi ? formatTanggal(estimasiPanen) : "-"}
          />
          <DetailRow label="Model AI" value={sudahKlikPrediksi ? modelAi : "-"} />
          <DetailRow
            label="Target Petani"
            value={
              sudahKlikPrediksi
                ? targetPetaniTon !== null
                  ? `${formatNumber(targetPetaniTon, 2)} Ton`
                  : "Tidak diisi"
                : "-"
            }
          />
          <DetailRow
            label={`Target Sistem (+${formatNumber(
              persentaseTargetSistem ?? 15,
              0
            )}%)`}
            value={
              sudahKlikPrediksi && targetSistemTon !== null
                ? `${formatNumber(targetSistemTon, 2)} Ton`
                : "-"
            }
          />
          <DetailRow
            label="Target Aktif"
            value={
              sudahKlikPrediksi && targetAktifTon !== null
                ? `${formatNumber(targetAktifTon, 2)} Ton · ${
                    sumberTarget === "PETANI" ? "Petani" : "Sistem"
                  }`
                : "-"
            }
          />
          <DetailRow
            label="Status Target"
            value={
              sudahKlikPrediksi
                ? `${targetStatusPresentation.label}${
                    selisihTargetTon !== null
                      ? ` · ${
                          selisihTargetTon >= 0 ? "Surplus" : "Kurang"
                        } ${formatNumber(Math.abs(selisihTargetTon), 2)} Ton`
                      : ""
                  }`
                : "-"
            }
          />
        </section>

        <section style={styles.card}>
          <h3 style={styles.cardTitle}>Catatan</h3>

          <div style={styles.noteGreen}>
            <strong>ⓘ</strong>
            <p>
              Hasil prediksi utama akan tampil 0 sebelum tombol Hitung Prediksi
              diklik. Riwayat tetap tersedia di tabel bawah.
            </p>
          </div>

          <div style={styles.noteBlue}>
            <strong>ⓘ Tips:</strong>
            <p>
              Jika masih muncul data akun lama, logout lalu login ulang setelah
              localStorage dibersihkan.
            </p>
          </div>
        </section>
      </div>

      <section style={styles.historySection}>
        <div style={styles.historyHeader}>
          <div>
            <h3 style={styles.cardTitle}>Riwayat Prediksi Terbaru per Lahan</h3>
            <p style={styles.muted}>
              Riwayat prediksi bersifat hanya baca. Petani dapat melihat detail
              serta mengunduh laporan dalam format PDF atau Excel.
            </p>
          </div>

          <button
            style={styles.secondaryButton}
            onClick={() => fetchHistory(lahanList)}
          >
            ⟳ Refresh Riwayat
          </button>
        </div>

        {loadingHistory ? (
          <div style={styles.emptyBox}>Memuat riwayat prediksi...</div>
        ) : latestHistory.length === 0 ? (
          <div style={styles.emptyBox}>
            Belum ada riwayat prediksi untuk akun petani ini.
          </div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Tanggal Prediksi</th>
                  <th style={styles.th}>Lahan</th>
                  <th style={styles.th}>Prediksi Hasil</th>
                  <th style={styles.th}>Produktivitas</th>
                  <th style={styles.th}>MAPE Model</th>
                  <th style={styles.th}>Evaluasi Produksi</th>
                  <th style={styles.th}>Model AI</th>
                  <th style={styles.th}>Target Aktif</th>
                  <th style={styles.th}>Estimasi Panen</th>
                  <th style={styles.th}>Aksi</th>
                </tr>
              </thead>

              <tbody>
                {latestHistory.map((item) => (
                  <tr key={`${item.lahan_id}-${item.id}`}>
                    <td style={styles.td}>{formatTanggal(item.created_at)}</td>

                    <td style={styles.td}>
                      <strong>{item.nama_lahan}</strong>
                      <small style={styles.smallText}>
                        {item.nama_desa}, {item.nama_kecamatan}
                      </small>
                    </td>

                    <td style={styles.td}>
                      {formatNumber(item.prediksi_ton, 2)} Ton
                    </td>

                    <td style={styles.td}>
                      {formatNumber(item.produktivitas, 2)} Ton/Ha
                    </td>

                    <td style={styles.td}>
                      {item.model_mape === null || item.model_mape === undefined
                        ? "-"
                        : `${formatNumber(item.model_mape, 2)}%`}
                    </td>

                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.statusBadge,
                          ...getStatusStyle(item.status_risiko),
                        }}
                      >
                        {item.status_risiko || "-"}
                      </span>
                      <small style={styles.smallText}>Rule-Based produksi</small>
                    </td>

                    <td style={styles.td}>{item.model_ai || "-"}</td>

                    <td style={styles.td}>
                      {item.target_aktif_ton !== null &&
                      item.target_aktif_ton !== undefined ? (
                        <>
                          <strong>{formatNumber(item.target_aktif_ton, 2)} Ton</strong>
                          <small style={styles.smallText}>
                            {item.sumber_target === "PETANI"
                              ? "Target Petani"
                              : `Target Sistem (+${formatNumber(
                                  item.persentase_target_sistem ?? 15,
                                  0
                                )}%)`}
                          </small>
                          <span
                            style={{
                              ...styles.targetStatusBadge,
                              ...getTargetStatusPresentation(item.status_target).style,
                            }}
                          >
                            {getTargetStatusPresentation(item.status_target).label}
                          </span>
                        </>
                      ) : (
                        "-"
                      )}
                    </td>

                    <td style={styles.td}>
                      {formatTanggal(item.estimasi_panen)}
                    </td>

                    <td style={styles.td}>
                      <div style={styles.actionButtonGroup}>
                        <button
                          style={styles.iconButton}
                          onClick={() => handleDetail(item)}
                          title="Lihat detail"
                          aria-label="Lihat detail prediksi"
                        >
                          👁
                        </button>

                        <button
                          type="button"
                          style={{
                            ...styles.iconButton,
                            ...styles.pdfButton,
                          }}
                          onClick={() => handleDownloadPdf(item)}
                          title="Unduh laporan PDF"
                          aria-label="Unduh laporan PDF"
                        >
                          <PdfFileIcon size={18} />
                        </button>

                        <button
                          type="button"
                          style={{
                            ...styles.iconButton,
                            ...styles.excelButton,
                          }}
                          onClick={() => handleDownloadExcel(item)}
                          title="Unduh laporan Excel"
                          aria-label="Unduh laporan Excel"
                        >
                          <ExcelFileIcon size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={styles.tableFooter}>
              Menampilkan 1 - {latestHistory.length} dari {latestHistory.length}{" "}
              lahan.
            </div>
          </div>
        )}
      </section>

      {analysisOpen && (
        <Modal
          title="Analisis Detail Prediksi"
          subtitle="Rincian hasil Random Forest, kondisi lahan, evaluasi produksi, dan pembanding wilayah."
          size="large"
          onClose={() => setAnalysisOpen(false)}
        >
          <div style={styles.analysisDetailLayout}>
            <section style={styles.analysisHeroCard}>
              <div style={styles.analysisHeroIcon}>🌾</div>

              <div style={styles.analysisHeroContent}>
                <span style={styles.analysisEyebrow}>RINGKASAN HASIL</span>
                <h3 style={styles.analysisHeroTitle}>{compactAnalysis.title}</h3>
                <p style={styles.analysisHeroText}>{compactAnalysis.shortReason}</p>
              </div>
            </section>

            <div style={styles.analysisTopGrid}>
              <section style={styles.analysisFormulaCard}>
                <div style={styles.analysisCardHeader}>
                  <span style={styles.analysisCardIconGreen}>÷</span>

                  <div>
                    <span style={styles.analysisCardEyebrow}>
                      KONVERSI HASIL PREDIKSI
                    </span>
                    <h4 style={styles.analysisCardTitle}>Produktivitas Ekuivalen</h4>
                  </div>
                </div>

                <strong style={styles.analysisFormulaValue}>
                  {compactAnalysis.formula}
                </strong>

                <p style={styles.analysisCardDescription}>
                  Produktivitas dihitung dari prediksi produksi dibagi luas lahan.
                </p>
              </section>

              <section style={styles.analysisActionCard}>
                <div style={styles.analysisCardHeader}>
                  <span style={styles.analysisCardIconAmber}>!</span>

                  <div>
                    <span style={styles.analysisCardEyebrow}>TINDAKAN SISTEM</span>
                    <h4 style={styles.analysisCardTitle}>Rekomendasi Prioritas</h4>
                  </div>
                </div>

                <strong style={styles.analysisActionValue}>
                  {compactAnalysis.action}
                </strong>

                <p style={styles.analysisCardDescription}>
                  Tindakan ditentukan berdasarkan cuaca, produktivitas, umur tanaman,
                  dan pembanding wilayah.
                </p>
              </section>
            </div>

            <section style={styles.analysisSectionCard}>
              <div style={styles.analysisSectionHeader}>
                <div>
                  <span style={styles.analysisSectionEyebrow}>FAKTOR UTAMA</span>
                  <h4 style={styles.analysisSectionTitle}>Kondisi yang Memengaruhi Hasil</h4>
                </div>

                <span style={styles.analysisSectionBadge}>
                  {compactAnalysis.factors.length} faktor
                </span>
              </div>

              {compactAnalysis.factors.length === 0 ? (
                <div style={styles.analysisEmptyState}>
                  Belum ada faktor yang dapat ditampilkan.
                </div>
              ) : (
                <div style={styles.analysisFactorGrid}>
                  {compactAnalysis.factors.map((item, index) => (
                    <div
                      key={`${item.label}-${index}`}
                      style={{
                        ...styles.analysisFactorCard,
                        ...(item.type === "good"
                          ? styles.analysisFactorCardGood
                          : item.type === "danger"
                          ? styles.analysisFactorCardDanger
                          : styles.analysisFactorCardWarning),
                      }}
                    >
                      <span style={styles.analysisFactorDot}>
                        {item.type === "good"
                          ? "✓"
                          : item.type === "danger"
                          ? "!"
                          : "•"}
                      </span>

                      <div>
                        <small style={styles.analysisFactorLabel}>{item.label}</small>
                        <strong style={styles.analysisFactorValue}>{item.value}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={styles.analysisSectionCard}>
              <div style={styles.analysisSectionHeader}>
                <div>
                  <span style={styles.analysisSectionEyebrow}>KONDISI LAHAN</span>
                  <h4 style={styles.analysisSectionTitle}>Data Saat Prediksi</h4>
                </div>
              </div>

              <div style={styles.analysisDataGrid}>
                {[
                  {
                    icon: "🌱",
                    label: "Umur Tanaman",
                    value: compactAnalysis.details?.[0] || "-",
                  },
                  {
                    icon: "🌡️",
                    label: "Suhu Udara",
                    value: compactAnalysis.details?.[1] || "-",
                  },
                  {
                    icon: "🌧️",
                    label: "Curah Hujan",
                    value: compactAnalysis.details?.[2] || "-",
                  },
                  {
                    icon: "💧",
                    label: "Kelembapan",
                    value: compactAnalysis.details?.[3] || "-",
                  },
                  {
                    icon: "📈",
                    label: "Evaluasi Produksi",
                    value: compactAnalysis.details?.[4] || "-",
                  },
                ].map((item) => (
                  <div key={item.label} style={styles.analysisDataCard}>
                    <span style={styles.analysisDataIcon}>{item.icon}</span>

                    <div style={styles.analysisDataContent}>
                      <small style={styles.analysisDataLabel}>{item.label}</small>
                      <strong style={styles.analysisDataValue}>
                        {String(item.value)
                          .replace(/^Umur tanaman saat prediksi:\s*/i, "")
                          .replace(/^Suhu:\s*/i, "")
                          .replace(/^Curah hujan:\s*/i, "")
                          .replace(/^Kelembapan:\s*/i, "")
                          .replace(/^Evaluasi produksi:\s*/i, "")}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section style={styles.analysisSectionCard}>
              <div style={styles.analysisSectionHeader}>
                <div>
                  <span style={styles.analysisSectionEyebrow}>PERBANDINGAN</span>
                  <h4 style={styles.analysisSectionTitle}>
                    Riwayat, Target, dan Wilayah
                  </h4>
                </div>
              </div>

              <div style={styles.analysisComparisonGrid}>
                {[
                  {
                    icon: "↻",
                    label: "Rata-rata Riwayat",
                    value: compactAnalysis.details?.[5] || "-",
                  },
                  {
                    icon: "◎",
                    label: "Target Aktif",
                    value: compactAnalysis.details?.[6] || "-",
                  },
                  {
                    icon: "⌂",
                    label: "Perbandingan Desa",
                    value: compactAnalysis.details?.[7] || "-",
                  },
                  {
                    icon: "⌖",
                    label: "Perbandingan Kecamatan",
                    value: compactAnalysis.details?.[8] || "-",
                  },
                ].map((item) => (
                  <div key={item.label} style={styles.analysisComparisonCard}>
                    <div style={styles.analysisComparisonIcon}>{item.icon}</div>

                    <div style={styles.analysisComparisonContent}>
                      <small style={styles.analysisComparisonLabel}>{item.label}</small>
                      <p style={styles.analysisComparisonText}>{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div style={styles.analysisFooterNote}>
              <span style={styles.analysisFooterIcon}>i</span>
              <p style={styles.analysisFooterText}>
                MAPE 7,91% merupakan evaluasi keseluruhan model Random Forest. Skor
                evaluasi produksi berasal dari rule-based system dan bukan skor risiko
                penyakit Blast. Risiko Blast tetap dianalisis pada fitur Monitoring
                Tanaman menggunakan Fuzzy Tsukamoto.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {detailOpen && detailData && (
        <Modal title="Detail Prediksi" onClose={() => setDetailOpen(false)}>
          <div style={styles.detailModalGrid}>
            <DetailRow label="Lahan" value={detailData.nama_lahan} />
            <DetailRow
              label="Lokasi"
              value={`${detailData.nama_desa}, ${detailData.nama_kecamatan}`}
            />
            <DetailRow
              label="Prediksi"
              value={`${formatNumber(detailData.prediksi_ton, 2)} Ton`}
            />
            <DetailRow
              label="Produktivitas"
              value={`${formatNumber(detailData.produktivitas, 2)} Ton/Ha`}
            />
            <DetailRow
              label="MAPE Model"
              value={
                detailData.model_mape === null ||
                detailData.model_mape === undefined
                  ? "-"
                  : `${formatNumber(detailData.model_mape, 2)}%`
              }
            />
            <DetailRow
              label="R² Model"
              value={
                detailData.model_r2 === null ||
                detailData.model_r2 === undefined
                  ? "-"
                  : formatNumber(detailData.model_r2, 4)
              }
            />
            <DetailRow
              label="Estimasi Panen"
              value={formatTanggal(detailData.estimasi_panen)}
            />
            <DetailRow label="Model AI" value={detailData.model_ai || "-"} />
            <DetailRow
              label="Target Petani"
              value={
                detailData.target_petani_ton !== null
                  ? `${formatNumber(detailData.target_petani_ton, 2)} Ton`
                  : "Tidak diisi"
              }
            />
            <DetailRow
              label={`Target Sistem (+${formatNumber(
                detailData.persentase_target_sistem ?? 15,
                0
              )}%)`}
              value={
                detailData.target_sistem_ton !== null
                  ? `${formatNumber(detailData.target_sistem_ton, 2)} Ton`
                  : "-"
              }
            />
            <DetailRow
              label="Target Aktif"
              value={
                detailData.target_aktif_ton !== null
                  ? `${formatNumber(detailData.target_aktif_ton, 2)} Ton · ${
                      detailData.sumber_target === "PETANI" ? "Petani" : "Sistem"
                    }`
                  : "-"
              }
            />
            <DetailRow
              label="Status Target"
              value={`${getTargetStatusPresentation(detailData.status_target).label}${
                detailData.selisih_target_ton !== null
                  ? ` · ${
                      detailData.selisih_target_ton >= 0 ? "Surplus" : "Kurang"
                    } ${formatNumber(
                      Math.abs(detailData.selisih_target_ton),
                      2
                    )} Ton`
                  : ""
              }`}
            />
            <DetailRow
              label="Suhu"
              value={
                detailData.cuaca.suhu === null
                  ? "-"
                  : `${formatNumber(detailData.cuaca.suhu, 1)} °C`
              }
            />
            <DetailRow
              label="Curah Hujan"
              value={
                detailData.cuaca.curah_hujan === null
                  ? "0,0 mm"
                  : `${formatNumber(detailData.cuaca.curah_hujan, 1)} mm`
              }
            />
            <DetailRow
              label="Kelembapan"
              value={
                detailData.cuaca.kelembapan === null
                  ? "-"
                  : `${formatNumber(detailData.cuaca.kelembapan, 1)}%`
              }
            />
            <DetailRow
              label="Evaluasi Produksi (Rule-Based)"
              value={
                detailData.risk_score !== null &&
                detailData.risk_score !== undefined
                  ? `${detailData.status_risiko || "-"} · Skor ${formatNumber(
                      detailData.risk_score,
                      0
                    )} · Bukan risiko Blast`
                  : `${detailData.status_risiko || "-"} · Bukan risiko Blast`
              }
            />

            <div style={styles.modalSection}>
              <h4 style={styles.modalSectionTitle}>Rekomendasi</h4>
              {detailData.rekomendasi.length === 0 ? (
                <p style={styles.muted}>Belum ada rekomendasi.</p>
              ) : (
                <ul style={styles.recommendationModalList}>
                  {detailData.rekomendasi.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              )}
            </div>

            <div style={styles.modalSection}>
              <h4 style={styles.modalSectionTitle}>Tabel Proyeksi</h4>

              {detailData.proyeksi.length === 0 ? (
                <p style={styles.muted}>Belum ada proyeksi.</p>
              ) : (
                <div style={styles.projectionTableWrap}>
                  <table style={styles.projectionTable}>
                    <thead>
                      <tr>
                        <th style={styles.projectionTh}>Tanggal</th>
                        <th style={styles.projectionTh}>Prediksi</th>
                        <th style={styles.projectionTh}>Rata-rata Riwayat</th>
                        <th style={styles.projectionTh}>Target Aktif</th>
                      </tr>
                    </thead>

                    <tbody>
                      {detailData.proyeksi.map((row, index) => (
                        <tr key={`${row.label}-${index}`}>
                          <td style={styles.projectionTd}>
                            <strong>{row.label}</strong>
                          </td>
                          <td style={styles.projectionTd}>
                            {formatNumber(row.prediksi, 2)} Ton
                          </td>
                          <td style={styles.projectionTd}>
                            {formatNumber(row.rataRiwayat, 2)} Ton
                          </td>
                          <td style={styles.projectionTd}>
                            {formatNumber(row.targetAktif, 2)} Ton
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function MetricCard({ icon, title, value, sub, color, bg }) {
  return (
    <div
      style={{
        ...styles.metricCard,
        background: bg,
        borderColor: `${color}33`,
      }}
    >
      <div style={{ ...styles.metricIcon, color }}>{icon}</div>

      <div>
        <strong style={{ color }}>{title}</strong>
        <h2>{value}</h2>
        <small>{sub}</small>
      </div>
    </div>
  );
}

function RegionalMetricCard({
  icon,
  title,
  subtitle,
  value,
  helperText,
  differencePercent,
  tone = "neutral",
}) {
  const toneStyle =
    tone === "primary"
      ? styles.regionCardPrimary
      : tone === "good"
      ? styles.regionCardGood
      : tone === "warning"
      ? styles.regionCardWarning
      : styles.regionCardNeutral;

  const presentation = getComparisonPresentation(differencePercent);

  return (
    <div style={{ ...styles.regionMetricCard, ...toneStyle }}>
      <div style={styles.regionMetricHeader}>
        <span style={styles.regionMetricIcon}>{icon}</span>

        <div style={styles.regionMetricHeading}>
          <span style={styles.regionMetricTitle}>{title}</span>
          <small style={styles.regionMetricSubtitle}>{subtitle}</small>
        </div>
      </div>

      <div>
        <h2 style={styles.regionMetricValue}>
          {formatNumber(value, 2)}
          <small> Ton/Ha</small>
        </h2>

        <div style={styles.regionMetricBottom}>
          <span style={styles.regionMetricHelper}>{helperText}</span>

          {tone !== "primary" && (
            <span
              style={{
                ...styles.regionDifferenceBadge,
                ...(presentation.tone === "good"
                  ? styles.badgeGood
                  : presentation.tone === "warning"
                  ? styles.badgeWarning
                  : styles.badgeNeutral),
              }}
            >
              {presentation.icon} {presentation.shortLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function CompactComparisonRow({ label, level }) {
  const hasData = level?.landCount > 0;
  const presentation = getComparisonPresentation(level?.differencePercent);

  return (
    <div style={styles.compactComparisonRow}>
      <span>{label}</span>

      <strong
        style={{
          ...(presentation.tone === "good"
            ? styles.textGood
            : presentation.tone === "warning"
            ? styles.textWarning
            : styles.textNeutral),
        }}
      >
        {hasData ? presentation.label : "-"}
      </strong>
    </div>
  );
}

function RegionalDetailCard({
  title,
  totalPrediction,
  totalArea,
  landCount,
  differenceTonHa,
  differencePercent,
}) {
  return (
    <div style={styles.regionalDetailCard}>
      <h4 style={styles.regionalDetailCardTitle}>{title}</h4>

      <div style={styles.regionalDetailRows}>
        <DetailRow
          label="Total prediksi"
          value={`${formatNumber(totalPrediction, 2)} Ton`}
        />
        <DetailRow
          label="Total luas"
          value={`${formatNumber(totalArea, 2)} Ha`}
        />
        <DetailRow label="Jumlah lahan" value={`${landCount} lahan`} />
        <DetailRow
          label="Selisih"
          value={`${formatNumber(differenceTonHa, 2)} Ton/Ha (${formatNumber(
            differencePercent,
            1
          )}%)`}
        />
      </div>
    </div>
  );
}

function RegionalChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const item = payload[0]?.payload || {};

  return (
    <div style={styles.regionalTooltip}>
      <strong style={styles.tooltipTitle}>{item.name}</strong>
      <span style={styles.tooltipValue}>
        {formatNumber(item.value, 2)} Ton/Ha
      </span>
      <small>{item.location || "-"}</small>

      <div style={styles.tooltipDivider} />

      <small>Total prediksi: {formatNumber(item.totalPrediction, 2)} Ton</small>
      <small>Total luas: {formatNumber(item.totalArea, 2)} Ha</small>
      <small>Jumlah lahan: {toNumber(item.landCount)}</small>
    </div>
  );
}

function FactorRow({ icon, label, value }) {
  return (
    <div style={styles.factorRow}>
      <div style={styles.factorLeft}>
        <span>{icon}</span>
        <p>{label}</p>
      </div>

      <strong>{value}</strong>
    </div>
  );
}

function Recommendation({ text }) {
  return (
    <div style={styles.recommendationItem}>
      <span>✓</span>
      <p>{text}</p>
    </div>
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

function Legend({ color, text }) {
  return (
    <span style={styles.legendItemInline}>
      <span style={{ ...styles.legendDot, background: color }} />
      {text}
    </span>
  );
}

function Modal({
  title,
  subtitle = "",
  children,
  onClose,
  size = "default",
}) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const handleBackdropMouseDown = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      style={styles.modalBackdrop}
      onMouseDown={handleBackdropMouseDown}
      role="presentation"
    >
      <div
        style={{
          ...styles.modalBox,
          ...(size === "large" ? styles.modalBoxLarge : {}),
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div style={styles.modalHeader}>
          <div style={styles.modalTitleGroup}>
            <h3 id="modal-title" style={styles.modalTitle}>
              {title}
            </h3>

            {subtitle ? (
              <p style={styles.modalSubtitle}>{subtitle}</p>
            ) : null}
          </div>

          <button
            type="button"
            style={styles.closeButton}
            onClick={onClose}
            aria-label="Tutup modal"
            title="Tutup"
          >
            ×
          </button>
        </div>

        <div style={styles.modalBody}>{children}</div>
      </div>
    </div>
  );
}

function getStatusStyle(status) {
  const value = String(status || "").toUpperCase();

  if (value === "AMAN") {
    return {
      background: "#dcfce7",
      color: "#047857",
      border: "1px solid #86efac",
    };
  }

  if (value === "WASPADA") {
    return {
      background: "#fef3c7",
      color: "#92400e",
      border: "1px solid #fde68a",
    };
  }

  if (value === "KRITIS") {
    return {
      background: "#fee2e2",
      color: "#b91c1c",
      border: "1px solid #fecaca",
    };
  }

  return {
    background: "#f1f5f9",
    color: "#475569",
    border: "1px solid #cbd5e1",
  };
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "24px 28px",
    background: "#f8fafc",
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
    gap: 20,
  },

  title: {
    margin: 0,
    fontSize: 30,
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
    gap: 12,
  },

  historyButton: {
    background: "#16a34a",
    color: "#ffffff",
    border: "none",
    borderRadius: 10,
    padding: "13px 18px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 12px 28px rgba(22,163,74,.22)",
  },

  secondaryButton: {
    background: "#ffffff",
    color: "#047857",
    border: "1px solid #86efac",
    borderRadius: 10,
    padding: "12px 16px",
    fontWeight: 800,
    cursor: "pointer",
  },

  notification: {
    width: 48,
    height: 48,
    borderRadius: 999,
    background: "#ffffff",
    boxShadow: "0 10px 24px rgba(15,23,42,.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    fontSize: 22,
  },

  notificationBadge: {
    position: "absolute",
    top: -5,
    right: -3,
    minWidth: 20,
    height: 20,
    padding: "0 6px",
    background: "#ef4444",
    color: "#ffffff",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  inputPanel: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 12px 30px rgba(15,23,42,.06)",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 18,
    alignItems: "end",
    marginBottom: 18,
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

  selectBox: {
    minHeight: 64,
    border: "1px solid #d1d5db",
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "0 14px",
    background: "#ffffff",
  },

  locationIcon: {
    fontSize: 24,
    color: "#16a34a",
  },

  select: {
    flex: 1,
    border: "none",
    outline: "none",
    fontWeight: 800,
    background: "transparent",
    height: 56,
  },

  dateInput: {
    height: 64,
    border: "1px solid #d1d5db",
    borderRadius: 12,
    padding: "0 16px",
    fontWeight: 800,
    outline: "none",
    background: "#ffffff",
  },

  inputHint: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.4,
  },

  actionGroup: {
    display: "grid",
    gap: 8,
    textAlign: "center",
  },

  predictButton: {
    height: 56,
    border: "none",
    borderRadius: 12,
    background: "linear-gradient(135deg, #16a34a, #047857)",
    color: "#ffffff",
    fontSize: 16,
    fontWeight: 900,
  },

  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    fontWeight: 700,
  },

  resultPanel: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 12px 30px rgba(15,23,42,.06)",
    marginBottom: 18,
  },

  sectionTitle: {
    margin: "0 0 16px",
  },

  resultGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 16,
  },

  metricCard: {
    border: "1px solid",
    borderRadius: 14,
    padding: 18,
    display: "flex",
    alignItems: "center",
    gap: 14,
  },

  metricIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 28,
    flexShrink: 0,
  },

  analysisPanel: {
    background: "#ffffff",
    border: "1px solid #d1fae5",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 12px 30px rgba(15,23,42,.06)",
    marginBottom: 18,
  },

  analysisHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    marginBottom: 14,
  },

  analysisButton: {
    border: "1px solid #bbf7d0",
    background: "#ecfdf5",
    color: "#047857",
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: 900,
    cursor: "pointer",
  },

  compactAnalysisGrid: {
    display: "grid",
    gridTemplateColumns: "1.1fr 1.2fr 1fr",
    gap: 14,
  },

  compactBox: {
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
    borderRadius: 14,
    padding: 16,
  },

  compactBoxGreen: {
    border: "1px solid #bbf7d0",
    background: "#ecfdf5",
    borderRadius: 14,
    padding: 16,
    color: "#14532d",
  },

  compactBoxYellow: {
    border: "1px solid #fde68a",
    background: "#fffbeb",
    borderRadius: 14,
    padding: 16,
    color: "#78350f",
  },

  compactLabel: {
    display: "block",
    fontSize: 12,
    fontWeight: 900,
    color: "#64748b",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  factorPills: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },

  factorPill: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid",
  },

  factorGood: {
    background: "#dcfce7",
    color: "#047857",
    borderColor: "#86efac",
  },

  factorWarning: {
    background: "#fef3c7",
    color: "#92400e",
    borderColor: "#fde68a",
  },

  factorDanger: {
    background: "#fee2e2",
    color: "#b91c1c",
    borderColor: "#fecaca",
  },

  analysisModalSummary: {
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    color: "#14532d",
  },

  analysisDetailLayout: {
    display: "grid",
    gap: 16,
  },

  analysisHeroCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    padding: 18,
    borderRadius: 16,
    border: "1px solid #bbf7d0",
    background:
      "linear-gradient(135deg, rgba(236,253,245,1) 0%, rgba(240,253,250,1) 100%)",
  },

  analysisHeroIcon: {
    width: 46,
    height: 46,
    minWidth: 46,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    background: "#ffffff",
    border: "1px solid #a7f3d0",
    boxShadow: "0 8px 18px rgba(5,150,105,.12)",
    fontSize: 23,
  },

  analysisHeroContent: {
    minWidth: 0,
  },

  analysisEyebrow: {
    display: "block",
    marginBottom: 5,
    color: "#047857",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.9,
  },

  analysisHeroTitle: {
    margin: "0 0 7px",
    color: "#14532d",
    fontSize: 18,
    fontWeight: 900,
  },

  analysisHeroText: {
    margin: 0,
    color: "#166534",
    fontSize: 13,
    lineHeight: 1.65,
  },

  analysisTopGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 14,
  },

  analysisFormulaCard: {
    padding: 17,
    borderRadius: 16,
    border: "1px solid #a7f3d0",
    background: "#ecfdf5",
    minWidth: 0,
  },

  analysisActionCard: {
    padding: 17,
    borderRadius: 16,
    border: "1px solid #fde68a",
    background: "#fffbeb",
    minWidth: 0,
  },

  analysisCardHeader: {
    display: "flex",
    alignItems: "center",
    gap: 11,
    marginBottom: 13,
  },

  analysisCardIconGreen: {
    width: 34,
    height: 34,
    minWidth: 34,
    display: "grid",
    placeItems: "center",
    borderRadius: 11,
    background: "#ffffff",
    border: "1px solid #a7f3d0",
    color: "#047857",
    fontSize: 18,
    fontWeight: 900,
  },

  analysisCardIconAmber: {
    width: 34,
    height: 34,
    minWidth: 34,
    display: "grid",
    placeItems: "center",
    borderRadius: 11,
    background: "#ffffff",
    border: "1px solid #fde68a",
    color: "#b45309",
    fontSize: 18,
    fontWeight: 900,
  },

  analysisCardEyebrow: {
    display: "block",
    color: "#64748b",
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: 0.75,
    marginBottom: 2,
  },

  analysisCardTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 900,
  },

  analysisFormulaValue: {
    display: "block",
    color: "#065f46",
    fontSize: 17,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
  },

  analysisActionValue: {
    display: "block",
    color: "#92400e",
    fontSize: 15,
    lineHeight: 1.55,
    overflowWrap: "anywhere",
  },

  analysisCardDescription: {
    margin: "9px 0 0",
    color: "#64748b",
    fontSize: 11,
    lineHeight: 1.55,
  },

  analysisSectionCard: {
    padding: 17,
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
  },

  analysisSectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 13,
  },

  analysisSectionEyebrow: {
    display: "block",
    color: "#64748b",
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: 0.8,
    marginBottom: 3,
  },

  analysisSectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 900,
  },

  analysisSectionBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 28,
    padding: "5px 10px",
    borderRadius: 999,
    border: "1px solid #dbeafe",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 10,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  analysisFactorGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))",
    gap: 10,
  },

  analysisFactorCard: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 13,
    border: "1px solid",
    minWidth: 0,
  },

  analysisFactorCardGood: {
    background: "#f0fdf4",
    borderColor: "#bbf7d0",
    color: "#166534",
  },

  analysisFactorCardWarning: {
    background: "#fffbeb",
    borderColor: "#fde68a",
    color: "#92400e",
  },

  analysisFactorCardDanger: {
    background: "#fef2f2",
    borderColor: "#fecaca",
    color: "#b91c1c",
  },

  analysisFactorDot: {
    width: 28,
    height: 28,
    minWidth: 28,
    display: "grid",
    placeItems: "center",
    borderRadius: 999,
    background: "rgba(255,255,255,.78)",
    fontWeight: 900,
  },

  analysisFactorLabel: {
    display: "block",
    color: "inherit",
    opacity: 0.82,
    fontSize: 9,
    fontWeight: 800,
    marginBottom: 2,
  },

  analysisFactorValue: {
    display: "block",
    color: "inherit",
    fontSize: 12,
    fontWeight: 900,
    overflowWrap: "anywhere",
  },

  analysisDataGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 10,
  },

  analysisDataCard: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minHeight: 68,
    padding: 12,
    borderRadius: 13,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },

  analysisDataIcon: {
    width: 36,
    height: 36,
    minWidth: 36,
    display: "grid",
    placeItems: "center",
    borderRadius: 11,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    fontSize: 17,
  },

  analysisDataContent: {
    minWidth: 0,
  },

  analysisDataLabel: {
    display: "block",
    marginBottom: 3,
    color: "#64748b",
    fontSize: 9,
    fontWeight: 800,
  },

  analysisDataValue: {
    display: "block",
    color: "#0f172a",
    fontSize: 12,
    lineHeight: 1.45,
    overflowWrap: "anywhere",
  },

  analysisComparisonGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 10,
  },

  analysisComparisonCard: {
    display: "flex",
    alignItems: "flex-start",
    gap: 11,
    padding: 13,
    borderRadius: 13,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    minWidth: 0,
  },

  analysisComparisonIcon: {
    width: 34,
    height: 34,
    minWidth: 34,
    display: "grid",
    placeItems: "center",
    borderRadius: 11,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    fontSize: 16,
    fontWeight: 900,
  },

  analysisComparisonContent: {
    minWidth: 0,
  },

  analysisComparisonLabel: {
    display: "block",
    marginBottom: 4,
    color: "#64748b",
    fontSize: 9,
    fontWeight: 900,
    letterSpacing: 0.25,
  },

  analysisComparisonText: {
    margin: 0,
    color: "#334155",
    fontSize: 11,
    lineHeight: 1.55,
    overflowWrap: "anywhere",
  },

  analysisEmptyState: {
    padding: 16,
    borderRadius: 12,
    border: "1px dashed #cbd5e1",
    background: "#f8fafc",
    color: "#64748b",
    fontSize: 12,
    textAlign: "center",
  },

  analysisFooterNote: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: 13,
    borderRadius: 13,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
  },

  analysisFooterIcon: {
    width: 24,
    height: 24,
    minWidth: 24,
    display: "grid",
    placeItems: "center",
    borderRadius: 999,
    background: "#2563eb",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 900,
  },

  analysisFooterText: {
    margin: 0,
    color: "#1e3a8a",
    fontSize: 11,
    lineHeight: 1.55,
  },

  regionalPanel: {
    background: "#ffffff",
    border: "1px solid #dbeafe",
    borderRadius: 18,
    padding: 20,
    boxShadow: "0 14px 34px rgba(15,23,42,.07)",
    marginBottom: 18,
  },

  regionalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 16,
  },

  sectionEyebrow: {
    display: "block",
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.8,
    marginBottom: 5,
  },

  regionalTitle: {
    margin: 0,
    fontSize: 21,
    fontWeight: 900,
    color: "#0f172a",
  },

  regionalSubtitle: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 13,
  },

  regionalHeaderActions: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  periodBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "8px 12px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  regionalDetailButton: {
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    borderRadius: 10,
    padding: "9px 13px",
    fontSize: 12,
    fontWeight: 850,
    cursor: "pointer",
  },

  regionalError: {
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    color: "#9a3412",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    fontWeight: 700,
  },

  regionalSummaryBanner: {
    minHeight: 104,
    border: "1px solid",
    borderRadius: 16,
    padding: 16,
    display: "grid",
    gridTemplateColumns: "50px minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 14,
    marginBottom: 15,
  },

  summaryGood: {
    background: "linear-gradient(135deg, #ecfdf5, #f0fdf4)",
    borderColor: "#86efac",
    color: "#14532d",
  },

  summaryWarning: {
    background: "linear-gradient(135deg, #fffbeb, #fff7ed)",
    borderColor: "#fcd34d",
    color: "#78350f",
  },

  summaryNeutral: {
    background: "linear-gradient(135deg, #eff6ff, #f8fafc)",
    borderColor: "#bfdbfe",
    color: "#1e3a8a",
  },

  summaryIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    background: "rgba(255,255,255,.82)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
    fontWeight: 900,
    boxShadow: "0 8px 20px rgba(15,23,42,.08)",
  },

  summaryContent: {
    minWidth: 0,
  },

  summaryStatus: {
    display: "inline-flex",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    opacity: 0.8,
  },

  summaryTitle: {
    margin: "3px 0 4px",
    fontSize: 19,
    fontWeight: 900,
  },

  summaryDescription: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.5,
  },

  summaryQuickStats: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(120px, 1fr))",
    gap: 8,
  },

  summaryQuickStat: {
    minHeight: 56,
    borderRadius: 11,
    padding: "9px 11px",
    background: "rgba(255,255,255,.72)",
    border: "1px solid rgba(148,163,184,.24)",
    display: "grid",
    gap: 3,
  },

  summaryQuickLabel: {
    fontSize: 10,
    fontWeight: 800,
    opacity: 0.72,
  },

  summaryQuickValue: {
    fontSize: 12,
    lineHeight: 1.25,
  },

  regionalMetricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 15,
  },

  regionMetricCard: {
    border: "1px solid",
    borderRadius: 15,
    padding: 15,
    minHeight: 126,
    display: "grid",
    alignContent: "space-between",
    gap: 12,
    transition: "transform .2s ease, box-shadow .2s ease",
  },

  regionCardPrimary: {
    background: "#ecfdf5",
    borderColor: "#86efac",
    color: "#14532d",
    boxShadow: "0 8px 20px rgba(22,163,74,.08)",
  },

  regionCardGood: {
    background: "#f0fdf4",
    borderColor: "#86efac",
    color: "#14532d",
  },

  regionCardWarning: {
    background: "#fffbeb",
    borderColor: "#fcd34d",
    color: "#78350f",
  },

  regionCardNeutral: {
    background: "#f8fafc",
    borderColor: "#cbd5e1",
    color: "#334155",
  },

  regionMetricHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  regionMetricIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    background: "rgba(255,255,255,.82)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 19,
    flexShrink: 0,
  },

  regionMetricHeading: {
    minWidth: 0,
  },

  regionMetricTitle: {
    display: "block",
    fontWeight: 900,
    fontSize: 13,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  regionMetricSubtitle: {
    display: "block",
    opacity: 0.72,
    fontSize: 11,
    marginTop: 3,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  regionMetricValue: {
    margin: 0,
    fontSize: 25,
    letterSpacing: -0.5,
  },

  regionMetricBottom: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 7,
  },

  regionMetricHelper: {
    fontSize: 11,
    fontWeight: 750,
    opacity: 0.78,
  },

  regionDifferenceBadge: {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    borderRadius: 999,
    padding: "5px 8px",
    border: "1px solid",
    fontSize: 10,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  badgeGood: {
    background: "#dcfce7",
    color: "#047857",
    borderColor: "#86efac",
  },

  badgeWarning: {
    background: "#fef3c7",
    color: "#92400e",
    borderColor: "#fde68a",
  },

  badgeNeutral: {
    background: "#eff6ff",
    color: "#1d4ed8",
    borderColor: "#bfdbfe",
  },

  regionalContentGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.45fr) minmax(300px, .8fr)",
    gap: 14,
    alignItems: "stretch",
  },

  regionalChartBox: {
    border: "1px solid #e2e8f0",
    borderRadius: 15,
    padding: "14px 12px 4px",
    minHeight: 300,
    background: "#ffffff",
  },

  chartBoxHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    padding: "0 4px 6px",
  },

  chartBoxTitle: {
    margin: "0 0 4px",
    fontSize: 15,
    fontWeight: 900,
  },

  chartUnitBadge: {
    borderRadius: 999,
    padding: "6px 9px",
    background: "#f1f5f9",
    color: "#475569",
    fontSize: 10,
    fontWeight: 900,
  },

  regionalInsightBox: {
    border: "1px solid #d1fae5",
    background: "#f0fdf4",
    borderRadius: 15,
    padding: 16,
    display: "flex",
    flexDirection: "column",
  },

  insightTop: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },

  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
  },

  insightTitle: {
    margin: 0,
    color: "#14532d",
    fontSize: 18,
    fontWeight: 900,
  },

  regionalNarrative: {
    margin: "0 0 14px",
    lineHeight: 1.55,
    color: "#166534",
    fontWeight: 700,
    fontSize: 13,
  },

  regionalSummaryText: {
    margin: "0 0 14px",
    lineHeight: 1.65,
    color: "#166534",
    fontWeight: 600,
    fontSize: 13,
  },

  compactStatusList: {
    display: "grid",
    gap: 2,
    marginTop: "auto",
  },

  compactComparisonRow: {
    minHeight: 40,
    borderTop: "1px solid rgba(22,101,52,.12)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    fontSize: 12,
  },

  textGood: {
    color: "#047857",
  },

  textWarning: {
    color: "#b45309",
  },

  textNeutral: {
    color: "#1d4ed8",
  },

  insightActionButton: {
    width: "100%",
    minHeight: 38,
    marginTop: 12,
    border: "1px solid #86efac",
    borderRadius: 10,
    background: "#ffffff",
    color: "#047857",
    fontWeight: 900,
    cursor: "pointer",
  },

  regionalDetailPanel: {
    marginTop: 14,
    border: "1px solid #e2e8f0",
    borderRadius: 15,
    padding: 16,
    background: "#f8fafc",
  },

  detailPanelHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 13,
  },

  detailPanelTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 900,
  },

  closeDetailButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    border: "none",
    background: "#e2e8f0",
    color: "#334155",
    fontSize: 20,
    cursor: "pointer",
  },

  regionalDetailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  },

  regionalDetailCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 13,
    padding: 14,
  },

  regionalDetailCardTitle: {
    margin: "0 0 8px",
    fontSize: 14,
    fontWeight: 900,
  },

  regionalDetailRows: {
    display: "grid",
  },

  formulaCard: {
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    borderRadius: 13,
    padding: 14,
    color: "#1e3a8a",
  },

  formulaText: {
    display: "block",
    fontSize: 17,
    marginBottom: 8,
  },

  formulaDescription: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.55,
  },

  regionalTooltip: {
    minWidth: 190,
    background: "#0f172a",
    color: "#ffffff",
    borderRadius: 12,
    padding: 12,
    boxShadow: "0 16px 34px rgba(15,23,42,.26)",
    display: "grid",
    gap: 4,
  },

  tooltipTitle: {
    fontSize: 13,
  },

  tooltipValue: {
    color: "#86efac",
    fontSize: 17,
    fontWeight: 900,
  },

  tooltipDivider: {
    height: 1,
    background: "rgba(255,255,255,.16)",
    margin: "4px 0",
  },

  dashboardGrid: {
    display: "grid",
    gridTemplateColumns: "1.35fr .9fr .9fr",
    gap: 18,
    marginBottom: 18,
  },

  cardLarge: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 12px 30px rgba(15,23,42,.06)",
  },

  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 12px 30px rgba(15,23,42,.06)",
  },

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 8,
  },

  cardTitle: {
    margin: "0 0 14px",
  },

  chartLegend: {
    display: "flex",
    justifyContent: "center",
    gap: 24,
    fontSize: 13,
    color: "#475569",
    flexWrap: "wrap",
  },

  legendItemInline: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  },

  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    display: "inline-block",
  },

  factorRow: {
    minHeight: 48,
    borderBottom: "1px solid #e5e7eb",
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "center",
    gap: 12,
  },

  factorLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  recommendationList: {
    display: "grid",
    gap: 12,
    marginBottom: 18,
  },

  recommendationItem: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    color: "#166534",
  },

  detailButton: {
    width: "100%",
    height: 46,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    background: "#ffffff",
    fontWeight: 800,
    cursor: "pointer",
  },

  detailRow: {
    minHeight: 42,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottom: "1px solid #e5e7eb",
    gap: 12,
  },

  noteGreen: {
    background: "#dcfce7",
    borderRadius: 12,
    padding: 14,
    display: "flex",
    gap: 12,
    marginBottom: 12,
    color: "#166534",
  },

  noteBlue: {
    background: "#eff6ff",
    borderRadius: 12,
    padding: 14,
    color: "#1e40af",
  },

  historySection: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 12px 30px rgba(15,23,42,.06)",
  },

  historyHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    marginBottom: 14,
  },

  muted: {
    color: "#64748b",
    margin: 0,
  },

  tableWrap: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  },

  th: {
    textAlign: "left",
    borderBottom: "1px solid #e5e7eb",
    padding: "12px 10px",
    color: "#334155",
    whiteSpace: "nowrap",
  },

  td: {
    borderBottom: "1px solid #e5e7eb",
    padding: "12px 10px",
    verticalAlign: "top",
  },

  smallText: {
    display: "block",
    color: "#64748b",
    fontSize: 12,
    marginTop: 4,
  },

  tableFooter: {
    textAlign: "center",
    color: "#64748b",
    paddingTop: 16,
  },

  actionButtonGroup: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    flexWrap: "nowrap",
  },

  iconButton: {
    width: 36,
    minWidth: 36,
    height: 36,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#334155",
    borderRadius: 9,
    padding: 0,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 900,
    lineHeight: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
    transition: "transform .16s ease, box-shadow .16s ease, opacity .16s ease",
  },

  pdfButton: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
  },

  excelButton: {
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    color: "#047857",
  },

  emptyBox: {
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
    padding: 24,
    textAlign: "center",
    color: "#64748b",
    background: "#f8fafc",
  },

  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    padding: "5px 10px",
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  targetStatusBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "fit-content",
    marginTop: 6,
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 10,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,.58)",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: 16,
    boxSizing: "border-box",
  },

  modalBox: {
    width: "min(820px, calc(100vw - 32px))",
    maxHeight: "calc(100vh - 32px)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: "#ffffff",
    border: "1px solid rgba(226,232,240,.95)",
    borderRadius: 20,
    boxShadow: "0 34px 100px rgba(15,23,42,.34)",
  },

  modalBoxLarge: {
    width: "min(980px, calc(100vw - 32px))",
  },

  modalHeader: {
    position: "sticky",
    top: 0,
    zIndex: 2,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    padding: "17px 20px",
    borderBottom: "1px solid #e2e8f0",
    background: "rgba(255,255,255,.98)",
  },

  modalTitleGroup: {
    minWidth: 0,
  },

  modalTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 18,
    fontWeight: 900,
    lineHeight: 1.35,
  },

  modalSubtitle: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: 11,
    lineHeight: 1.5,
  },

  modalBody: {
    minHeight: 0,
    overflowY: "auto",
    overscrollBehavior: "contain",
    padding: 20,
  },

  closeButton: {
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#334155",
    width: 36,
    height: 36,
    minWidth: 36,
    display: "grid",
    placeItems: "center",
    borderRadius: 11,
    cursor: "pointer",
    fontSize: 22,
    lineHeight: 1,
    fontWeight: 700,
  },

  detailModalGrid: {
    display: "grid",
    gap: 8,
  },

  modalSection: {
    marginTop: 14,
  },

  modalSectionTitle: {
    margin: "0 0 10px",
  },

  recommendationModalList: {
    margin: 0,
    paddingLeft: 20,
    color: "#166534",
    lineHeight: 1.7,
  },

  projectionTableWrap: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
    background: "#ffffff",
  },

  projectionTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },

  projectionTh: {
    background: "#f8fafc",
    color: "#334155",
    textAlign: "left",
    padding: "10px 12px",
    borderBottom: "1px solid #e5e7eb",
    whiteSpace: "nowrap",
  },

  projectionTd: {
    padding: "10px 12px",
    borderBottom: "1px solid #f1f5f9",
    color: "#0f172a",
    whiteSpace: "nowrap",
  },
};