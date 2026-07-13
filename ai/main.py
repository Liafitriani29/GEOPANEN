from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, Optional, List

import pandas as pd
import joblib
import requests
import mysql.connector
import json
import os
from datetime import datetime, timedelta


# =====================================================
# INIT APP
# =====================================================
app = FastAPI(title="GeoPanen AI System", version="3.8")


# =====================================================
# CORS
# =====================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin for origin in [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            os.getenv("FRONTEND_URL"),
        ] if origin
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================================================
# LOAD MODEL
# =====================================================
MODEL_PATH = os.getenv("MODEL_PATH", "model_geopanen.pkl")
FITUR_PATH = os.getenv("FITUR_PATH", "fitur_geopanen.pkl")

model = joblib.load(MODEL_PATH)
fitur = joblib.load(FITUR_PATH)


# =====================================================
# DB CONNECTION
# =====================================================
def get_db():
    return mysql.connector.connect(
        host=os.getenv("MYSQLHOST", os.getenv("DB_HOST", "localhost")),
        user=os.getenv("MYSQLUSER", os.getenv("DB_USER", "root")),
        password=os.getenv("MYSQLPASSWORD", os.getenv("DB_PASSWORD", "")),
        database=os.getenv("MYSQLDATABASE", os.getenv("DB_NAME", "geopanen_bismillah_fikss")),
        port=int(os.getenv("MYSQLPORT", os.getenv("DB_PORT", 3306))),
        autocommit=True,
    )


# =====================================================
# HELPER UMUM
# =====================================================
def safe_float(value, default=0.0):
    try:
        if value is None or value == "":
            return default
        return float(value)
    except Exception:
        return default


def safe_int(value, default=0):
    try:
        if value is None or value == "":
            return default
        return int(value)
    except Exception:
        return default


def safe_json_list(value, default=None):
    if default is None:
        default = []

    if value is None or value == "":
        return default

    if isinstance(value, list):
        return value

    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else default
    except Exception:
        return default


def add_days(days: int):
    return (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d")


def format_date_iso(value):
    if not value:
        return None

    try:
        if isinstance(value, datetime):
            return value.strftime("%Y-%m-%d")

        return str(value)[:10]
    except Exception:
        return None


def hitung_umur_tanaman(tanggal_tanam):
    if not tanggal_tanam:
        return 45

    try:
        if isinstance(tanggal_tanam, str):
            tanggal_tanam = tanggal_tanam.replace("Z", "")
            tanggal = datetime.fromisoformat(tanggal_tanam[:10])
        else:
            tanggal = tanggal_tanam

        return max(0, (datetime.now() - tanggal).days)
    except Exception:
        return 45


def normalisasi_fase(fase: Optional[str], umur_tanaman: int):
    fase = (fase or "").lower().strip()

    if fase == "vegetatif_lanjut":
        return "vegetatif_akhir"

    if fase in ["vegetatif_awal", "vegetatif_akhir", "generatif", "pematangan"]:
        return fase

    if umur_tanaman <= 30:
        return "vegetatif_awal"

    if umur_tanaman <= 55:
        return "vegetatif_akhir"

    if umur_tanaman <= 95:
        return "generatif"

    return "pematangan"


def get_label_fase(fase):
    if fase == "vegetatif_awal":
        return "Vegetatif Awal"

    if fase == "vegetatif_akhir":
        return "Vegetatif Akhir"

    if fase == "generatif":
        return "Generatif"

    return "Pematangan"


def hitung_prediksi_ton(raw_prediksi, luas_ha):
    """
    Menghitung total prediksi panen dalam satuan ton.

    Logika:
    - Jika output model besar, misalnya 9513, maka dianggap kg/ha.
      Total ton = raw_prediksi_kg_per_ha x luas_ha / 1000.

    - Jika output model sedang, misalnya 55, maka dianggap kuintal/ha.
      Total ton = raw_prediksi_kw_per_ha / 10 x luas_ha.

    - Jika output model kecil, misalnya 6.5, maka dianggap ton/ha.
      Total ton = raw_prediksi_ton_per_ha x luas_ha.
    """

    raw_prediksi = safe_float(raw_prediksi, 0.0)
    luas_ha = safe_float(luas_ha, 0.0)

    if luas_ha <= 0:
        return 0.0

    if raw_prediksi <= 0:
        return 0.0

    if raw_prediksi > 1000:
        prediksi_ton = (raw_prediksi * luas_ha) / 1000

    elif raw_prediksi > 20:
        prediksi_ton = (raw_prediksi / 10) * luas_ha

    else:
        prediksi_ton = raw_prediksi * luas_ha

    return round(prediksi_ton, 2)


def get_status_produktivitas(prediksi_ton, luas_ha):
    luas_ha = safe_float(luas_ha, 0.0)

    if luas_ha <= 0:
        return "Rendah"

    produktivitas = prediksi_ton / luas_ha

    if produktivitas >= 8:
        return "Tinggi"

    if produktivitas >= 5:
        return "Sedang"

    return "Rendah"


# =====================================================
# WEATHER
# =====================================================
def get_weather(lat, lon):
    """
    Mengambil data cuaca dari Open-Meteo.

    Perbaikan:
    - curah_hujan = total presipitasi 24 jam terakhir.
      Nilai ini dipakai untuk prediksi, monitoring risiko, dan rekomendasi.
    - curah_hujan_saat_ini = presipitasi realtime saat ini.
      Nilai ini hanya sebagai informasi tambahan agar tidak bingung jika saat ini 0 mm.
    """
    try:
        res = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat,
                "longitude": lon,
                "current": "temperature_2m,precipitation,relative_humidity_2m",
                "hourly": "precipitation",
                "past_days": 1,
                "forecast_days": 1,
                "timezone": "Asia/Jakarta",
            },
            timeout=5,
        )

        data = res.json()
        current = data.get("current", {})
        hourly = data.get("hourly", {})

        suhu = safe_float(current.get("temperature_2m"), 27.0)
        hujan_saat_ini = safe_float(current.get("precipitation"), 0.0)
        kelembapan = safe_float(current.get("relative_humidity_2m"), 80.0)

        waktu_sekarang_raw = current.get("time")

        try:
            if waktu_sekarang_raw:
                waktu_sekarang = datetime.fromisoformat(str(waktu_sekarang_raw)[:19])
            else:
                waktu_sekarang = datetime.now()
        except Exception:
            waktu_sekarang = datetime.now()

        batas_awal = waktu_sekarang - timedelta(hours=24)

        times = hourly.get("time", [])
        rains = hourly.get("precipitation", [])

        total_hujan_24_jam = 0.0
        jumlah_data_hujan = 0

        for waktu, hujan in zip(times, rains):
            try:
                waktu_dt = datetime.fromisoformat(str(waktu)[:19])
            except Exception:
                continue

            if batas_awal <= waktu_dt <= waktu_sekarang:
                total_hujan_24_jam += safe_float(hujan, 0.0)
                jumlah_data_hujan += 1

        if jumlah_data_hujan == 0:
            total_hujan_24_jam = hujan_saat_ini

        total_hujan_24_jam = round(total_hujan_24_jam, 2)

        return {
            "suhu": suhu,
            "curah_hujan": total_hujan_24_jam,
            "curah_hujan_24_jam": total_hujan_24_jam,
            "curah_hujan_saat_ini": hujan_saat_ini,
            "kelembapan": kelembapan,
            "sumber_curah_hujan": "akumulasi_24_jam",
        }

    except Exception:
        return {
            "suhu": 27.0,
            "curah_hujan": 10.0,
            "curah_hujan_24_jam": 10.0,
            "curah_hujan_saat_ini": 0.0,
            "kelembapan": 80.0,
            "sumber_curah_hujan": "fallback",
        }


# =====================================================
# RULE ENGINE RISIKO PANEN
# =====================================================
def rule_engine(prediksi_ton, suhu, hujan, luas_ha):
    rekom = []
    score = 0

    if prediksi_ton < 3:
        rekom.append("Tambahkan pupuk NPK 100-150 kg/ha")
        score += 40
    elif prediksi_ton < 5:
        rekom.append("Optimalkan pemupukan seimbang")
        score += 20
    else:
        rekom.append("Pertahankan pemupukan sesuai jadwal")

    if hujan > 45:
        rekom.append("Risiko jamur tinggi, gunakan fungisida sesuai arahan penyuluh")
        score += 25

    if suhu > 33:
        rekom.append("Lakukan irigasi tambahan untuk menjaga kelembapan lahan")
        score += 20

    if luas_ha < 0.5:
        rekom.append("Gunakan pemupukan presisi karena ukuran lahan relatif kecil")
        score += 10

    if len(rekom) < 4:
        rekom.append("Lakukan pemantauan kondisi tanaman secara berkala")

    status = "AMAN"

    if score >= 70:
        status = "KRITIS"
    elif score >= 40:
        status = "WASPADA"

    return rekom, score, status


# =====================================================
# MODEL INPUT
# =====================================================
class PrediksiInput(BaseModel):
    lahan_id: int
    tahun: Optional[int] = None


class PrediksiFiturInput(BaseModel):
    tahun: int
    kode_kecamatan: float
    luas_panen_sawah_ha: float
    produktivitas_sawah_kw_ha: float
    curah_hujan: float
    suhu: float


class MonitoringInput(BaseModel):
    lahan_id: int
    suhu: float
    kelembapan: float
    curah_hujan: float
    umur_tanaman: int
    luas_ha: float
    varietas: str


class RekomendasiInput(BaseModel):
    sawah_id: Optional[int] = None
    lahan_id: Optional[int] = None
    fase_tanaman: Optional[str] = "vegetatif_awal"
    fase_label: Optional[str] = None
    luas_ha: Optional[float] = None
    varietas: Optional[str] = "-"
    umur_tanaman: Optional[int] = None

    # Mode aktual memakai monitoring harian terbaru sebagai data pendukung.
    # Mode simulasi tidak memakai kondisi monitoring saat ini karena fasenya
    # bukan kondisi aktual tanaman.
    mode_analisis: Optional[str] = "aktual"
    gunakan_monitoring: Optional[bool] = True




# =====================================================
# MODEL INPUT ANALISIS CATATAN LAPANGAN
# =====================================================
class CatatanAnalisisInput(BaseModel):
    judul: Optional[str] = ""
    kategori: Optional[str] = "Lainnya"
    isi: Optional[str] = ""
    status: Optional[str] = "Menunggu"
    tindak_lanjut: Optional[str] = ""


def normalisasi_topik_catatan(kategori: Optional[str]) -> str:
    raw = (kategori or "").lower().strip()

    if "pupuk" in raw:
        return "Pemupukan"
    if "hama" in raw:
        return "Hama"
    if "irigasi" in raw or raw == "air":
        return "Irigasi"
    if "penyakit" in raw or "blast" in raw:
        return "Penyakit"
    if "tanah" in raw:
        return "Tanah"
    if "tumbuh" in raw or "pertumbuhan" in raw:
        return "Pertumbuhan"
    if "panen" in raw or "produksi" in raw:
        return "Panen"
    if "cuaca" in raw or "hujan" in raw or "suhu" in raw:
        return "Cuaca"

    return "Lainnya"


def deteksi_topik_dari_teks(teks: str) -> str:
    text = (teks or "").lower().strip()

    daftar_keyword = {
        "Hama": [
            "hama", "wereng", "ulat", "tikus", "keong", "belalang",
            "penggerek", "serangga", "populasi hama", "daun dimakan",
        ],
        "Penyakit": [
            "penyakit", "blast", "bercak", "jamur", "busuk", "hawar",
            "kresek", "daun menguning", "bercak daun", "busuk batang",
        ],
        "Pemupukan": [
            "pupuk", "urea", "npk", "kcl", "sp-36", "sp36", "pemupukan",
            "za", "dolomit", "unsur hara", "nitrogen", "kalium", "fosfor",
        ],
        "Irigasi": [
            "air", "irigasi", "kering", "genangan", "saluran", "drainase",
            "banjir", "tergenang", "kekeringan", "retak",
        ],
        "Cuaca": [
            "cuaca", "hujan", "panas", "angin", "mendung", "cerah",
            "suhu", "kelembapan", "ekstrem",
        ],
        "Panen": [
            "panen", "produksi", "hasil", "gabah", "malai", "bulir",
            "siap panen", "hasil panen",
        ],
        "Pertumbuhan": [
            "tumbuh", "anakan", "daun", "tinggi", "pertumbuhan",
            "bibit", "vegetatif", "generatif", "pematangan",
        ],
        "Tanah": [
            "tanah", "ph", "asam", "basa", "organik", "tekstur",
            "kesuburan tanah",
        ],
    }

    for kategori, keywords in daftar_keyword.items():
        if any(kata in text for kata in keywords):
            return kategori

    return "Lainnya"


def get_template_analisis_catatan(kategori: str):
    template = {
        "Hama": {
            "prioritas": "Tinggi",
            "ringkasan": "Catatan berkaitan dengan potensi gangguan hama pada lahan.",
            "rekomendasi": (
                "Lakukan pemeriksaan intensif pada daun, batang, dan area sekitar lahan. "
                "Jika populasi hama meningkat, lakukan pengendalian sesuai arahan penyuluh."
            ),
            "tindakan": [
                "Identifikasi jenis hama dan tingkat serangan.",
                "Pantau ulang kondisi tanaman dalam 2-3 hari.",
                "Gunakan pengendalian hama terpadu sebelum penggunaan pestisida kimia.",
            ],
        },
        "Penyakit": {
            "prioritas": "Tinggi",
            "ringkasan": "Catatan menunjukkan kemungkinan gangguan penyakit tanaman padi.",
            "rekomendasi": (
                "Pantau gejala penyakit pada tanaman, kurangi kelembapan berlebih, "
                "dan pastikan drainase lahan berjalan baik."
            ),
            "tindakan": [
                "Periksa gejala pada daun, batang, dan malai.",
                "Kurangi kelembapan berlebih dan genangan air.",
                "Konsultasikan penggunaan fungisida dengan penyuluh bila gejala meluas.",
            ],
        },
        "Pemupukan": {
            "prioritas": "Sedang",
            "ringkasan": "Catatan berkaitan dengan kebutuhan atau evaluasi pemupukan.",
            "rekomendasi": (
                "Evaluasi dosis, jenis pupuk, dan waktu pemupukan agar sesuai dengan fase "
                "pertumbuhan tanaman serta luas lahan."
            ),
            "tindakan": [
                "Sesuaikan dosis pupuk dengan luas lahan dan fase tanaman.",
                "Hindari pemupukan saat hujan tinggi agar pupuk tidak tercuci.",
                "Pantau respons tanaman setelah pemupukan.",
            ],
        },
        "Irigasi": {
            "prioritas": "Sedang",
            "ringkasan": "Catatan berkaitan dengan kondisi air atau saluran irigasi lahan.",
            "rekomendasi": (
                "Periksa saluran air dan atur irigasi agar lahan tidak terlalu kering "
                "atau tergenang."
            ),
            "tindakan": [
                "Cek saluran masuk dan keluar air.",
                "Jaga tinggi genangan sesuai fase pertumbuhan tanaman.",
                "Lakukan perbaikan drainase bila air sulit mengalir.",
            ],
        },
        "Cuaca": {
            "prioritas": "Sedang",
            "ringkasan": "Catatan berkaitan dengan kondisi cuaca yang dapat memengaruhi aktivitas budidaya.",
            "rekomendasi": (
                "Sesuaikan waktu pemupukan, penyemprotan, dan pemantauan hama dengan kondisi cuaca."
            ),
            "tindakan": [
                "Pantau prakiraan cuaca sebelum pemupukan atau penyemprotan.",
                "Tunda pemupukan bila hujan tinggi.",
                "Periksa kelembapan lahan setelah perubahan cuaca ekstrem.",
            ],
        },
        "Panen": {
            "prioritas": "Sedang",
            "ringkasan": "Catatan berkaitan dengan kesiapan panen atau hasil produksi.",
            "rekomendasi": (
                "Pantau kesiapan panen dan bandingkan kondisi aktual dengan prediksi produksi sistem."
            ),
            "tindakan": [
                "Periksa umur tanaman dan tingkat kemasakan bulir.",
                "Catat hasil panen aktual setelah panen dilakukan.",
                "Bandingkan hasil aktual dengan prediksi sistem.",
            ],
        },
        "Pertumbuhan": {
            "prioritas": "Rendah",
            "ringkasan": "Catatan berkaitan dengan pertumbuhan tanaman.",
            "rekomendasi": "Lanjutkan pemantauan pertumbuhan tanaman secara berkala.",
            "tindakan": [
                "Catat tinggi tanaman dan jumlah anakan secara berkala.",
                "Pastikan pemupukan sesuai fase pertumbuhan.",
                "Pantau perubahan warna daun dan kondisi batang.",
            ],
        },
        "Tanah": {
            "prioritas": "Rendah",
            "ringkasan": "Catatan berkaitan dengan kondisi tanah atau kesuburan lahan.",
            "rekomendasi": (
                "Pantau kondisi tanah dan lakukan perbaikan kesuburan jika ditemukan masalah "
                "pH, bahan organik, atau tekstur tanah."
            ),
            "tindakan": [
                "Periksa kondisi tanah secara visual.",
                "Catat indikasi tanah terlalu asam, keras, atau kurang subur.",
                "Pertimbangkan perbaikan bahan organik sesuai arahan penyuluh.",
            ],
        },
        "Lainnya": {
            "prioritas": "Rendah",
            "ringkasan": "Catatan belum menunjukkan kategori masalah yang spesifik.",
            "rekomendasi": "Lakukan pemantauan lanjutan sesuai kondisi lapangan.",
            "tindakan": [
                "Lengkapi catatan dengan kondisi tanaman, air, hama, pupuk, atau cuaca.",
                "Lakukan pemantauan berkala bersama petani.",
            ],
        },
    }

    return template.get(kategori, template["Lainnya"])


def sesuaikan_prioritas_catatan(prioritas: str, kategori: str, status: str, teks_pendukung: str) -> str:
    status_lower = (status or "").lower()
    text = (teks_pendukung or "").lower()

    kata_gawat = [
        "parah", "berat", "meluas", "mati", "rusak", "darurat",
        "segera", "gagal", "terserang", "banyak", "mengering",
    ]

    if "selesai" in status_lower:
        if kategori in ["Hama", "Penyakit"]:
            return "Sedang"
        return "Rendah"

    if any(kata in text for kata in kata_gawat):
        return "Tinggi"

    if "menunggu" in status_lower and kategori in ["Hama", "Penyakit"]:
        return "Tinggi"

    if "menunggu" in status_lower and kategori in ["Pemupukan", "Irigasi", "Cuaca", "Panen"]:
        return "Sedang"

    return prioritas


def analisis_catatan_lapangan(data: CatatanAnalisisInput):
    """
    Analisis cerdas catatan lapangan dengan pendekatan topic-first rule based.

    Prinsip:
    - Topik/kategori yang dipilih penyuluh menjadi acuan utama.
    - Judul tidak dipakai sebagai penentu utama agar kata pada judul tidak membuat
      hasil analisis salah kategori.
    - Jika topik adalah "Lainnya", sistem baru mendeteksi kategori dari isi catatan.
    """
    judul = (data.judul or "").strip()
    kategori_input = normalisasi_topik_catatan(data.kategori)
    isi = (data.isi or "").strip()
    status = (data.status or "Menunggu").strip()
    tindak_lanjut = (data.tindak_lanjut or "").strip()

    teks_pendukung = " ".join([isi, tindak_lanjut, status]).strip()
    teks_deteksi_lainnya = " ".join([isi, tindak_lanjut, judul]).strip()

    if kategori_input != "Lainnya":
        kategori = kategori_input
        sumber_kategori = "topik_penyuluh"
    else:
        kategori = deteksi_topik_dari_teks(teks_deteksi_lainnya)
        sumber_kategori = "deteksi_kata_kunci"

    template = get_template_analisis_catatan(kategori)

    prioritas = sesuaikan_prioritas_catatan(
        prioritas=template["prioritas"],
        kategori=kategori,
        status=status,
        teks_pendukung=teks_pendukung,
    )

    ringkasan = (
        f"Catatan diklasifikasikan sebagai {kategori} berdasarkan "
        f"{'topik yang dipilih penyuluh' if sumber_kategori == 'topik_penyuluh' else 'kata kunci pada catatan'}. "
        f"Status tindak lanjut saat ini adalah {status}. "
        f"{template['ringkasan']}"
    )

    if tindak_lanjut:
        ringkasan += f" Rencana tindak lanjut yang tercatat: {tindak_lanjut}."

    jumlah_kata = len(" ".join([judul, isi, tindak_lanjut]).split())

    return {
        "kategori_ai": kategori,
        "kategori": kategori,
        "prioritas": prioritas,
        "rekomendasi": template["rekomendasi"],
        "tindakan": template["tindakan"],
        "ringkasan": ringkasan,
        "jumlah_kata": jumlah_kata,
        "sumber_kategori": sumber_kategori,
        "message": f"Catatan dianalisis sebagai {kategori} dengan prioritas {prioritas}.",
    }


@app.post("/ai/analisis-catatan")
def analisis_catatan(data: CatatanAnalisisInput):
    has_content = any([
        (data.judul or "").strip(),
        (data.kategori or "").strip(),
        (data.isi or "").strip(),
        (data.tindak_lanjut or "").strip(),
    ])

    if not has_content:
        return {
            "status": "error",
            "message": "Data catatan wajib diisi untuk dianalisis.",
        }

    hasil = analisis_catatan_lapangan(data)

    return {
        "status": "success",
        "metode": "Topic-First Rule-Based Text Analysis",
        **hasil,
    }



# =====================================================
# FUNGSI MEMBERSHIP FUZZY
# =====================================================
def turun(x: float, a: float, b: float) -> float:
    if x <= a:
        return 1.0
    if x >= b:
        return 0.0
    return (b - x) / (b - a)


def naik(x: float, a: float, b: float) -> float:
    if x <= a:
        return 0.0
    if x >= b:
        return 1.0
    return (x - a) / (b - a)


def segitiga(x: float, a: float, b: float, c: float) -> float:
    if x <= a or x >= c:
        return 0.0
    if x == b:
        return 1.0
    if a < x < b:
        return (x - a) / (b - a)
    return (c - x) / (c - b)


# =====================================================
# FUZZIFIKASI INPUT
# =====================================================
def fuzzifikasi_suhu(suhu: float) -> Dict[str, float]:
    return {
        "rendah": turun(suhu, 20, 24),
        "optimal": segitiga(suhu, 24, 27, 30),
        "tinggi": naik(suhu, 30, 35),
    }


def fuzzifikasi_kelembapan(kelembapan: float) -> Dict[str, float]:
    return {
        "rendah": turun(kelembapan, 55, 70),
        "sedang": segitiga(kelembapan, 60, 75, 90),
        "tinggi": naik(kelembapan, 80, 95),
    }


def fuzzifikasi_curah_hujan(curah_hujan: float) -> Dict[str, float]:
    return {
        "rendah": turun(curah_hujan, 20, 60),
        "sedang": segitiga(curah_hujan, 40, 80, 120),
        "tinggi": naik(curah_hujan, 100, 160),
    }


def fuzzifikasi_umur(umur: int) -> Dict[str, float]:
    return {
        "muda": turun(umur, 20, 35),
        "rentan": segitiga(umur, 30, 50, 75),
        "tua": naik(umur, 70, 100),
    }


# =====================================================
# NILAI Z TSUKAMOTO
# =====================================================
def z_rendah(alpha: float) -> float:
    return 50 - (alpha * 50)


def z_sedang(alpha: float) -> float:
    return 40 + (alpha * 30)


def z_tinggi(alpha: float) -> float:
    return 60 + (alpha * 40)


def get_z_value(konsekuen: str, alpha: float) -> float:
    if konsekuen == "rendah":
        return z_rendah(alpha)

    if konsekuen == "sedang":
        return z_sedang(alpha)

    if konsekuen == "tinggi":
        return z_tinggi(alpha)

    return 0.0


# =====================================================
# FUZZY TSUKAMOTO RISIKO HAMA
# =====================================================
def fuzzy_tsukamoto_risiko(
    suhu: float,
    kelembapan: float,
    curah_hujan: float,
    umur_tanaman: int,
) -> Dict[str, Any]:
    suhu_fz = fuzzifikasi_suhu(suhu)
    kelembapan_fz = fuzzifikasi_kelembapan(kelembapan)
    hujan_fz = fuzzifikasi_curah_hujan(curah_hujan)
    umur_fz = fuzzifikasi_umur(umur_tanaman)

    rules = []

    rules.append({
        "nama": "R1",
        "alpha": min(
            kelembapan_fz["tinggi"],
            hujan_fz["tinggi"],
            suhu_fz["optimal"],
        ),
        "konsekuen": "tinggi",
        "risiko_hama": "Blast",
    })

    rules.append({
        "nama": "R2",
        "alpha": min(
            kelembapan_fz["tinggi"],
            hujan_fz["sedang"],
            suhu_fz["optimal"],
        ),
        "konsekuen": "sedang",
        "risiko_hama": "Blast",
    })

    rules.append({
        "nama": "R3",
        "alpha": min(
            kelembapan_fz["sedang"],
            hujan_fz["tinggi"],
            umur_fz["rentan"],
        ),
        "konsekuen": "sedang",
        "risiko_hama": "Blast",
    })

    rules.append({
        "nama": "R4",
        "alpha": min(
            kelembapan_fz["rendah"],
            hujan_fz["rendah"],
        ),
        "konsekuen": "rendah",
        "risiko_hama": "Rendah",
    })

    rules.append({
        "nama": "R5",
        "alpha": min(
            suhu_fz["tinggi"],
            kelembapan_fz["rendah"],
        ),
        "konsekuen": "rendah",
        "risiko_hama": "Rendah",
    })

    rules.append({
        "nama": "R6",
        "alpha": min(
            kelembapan_fz["tinggi"],
            umur_fz["rentan"],
        ),
        "konsekuen": "sedang",
        "risiko_hama": "Blast",
    })

    rules.append({
        "nama": "R7",
        "alpha": min(
            hujan_fz["tinggi"],
            umur_fz["rentan"],
            suhu_fz["optimal"],
        ),
        "konsekuen": "tinggi",
        "risiko_hama": "Blast",
    })

    rules.append({
        "nama": "R8",
        "alpha": min(
            kelembapan_fz["sedang"],
            hujan_fz["sedang"],
        ),
        "konsekuen": "sedang",
        "risiko_hama": "Waspada",
    })

    numerator = 0.0
    denominator = 0.0
    detail_rules = []

    for rule in rules:
        alpha = rule["alpha"]

        if alpha <= 0:
            z = 0.0
        else:
            z = get_z_value(rule["konsekuen"], alpha)
            numerator += alpha * z
            denominator += alpha

        detail_rules.append({
            "rule": rule["nama"],
            "alpha": round(alpha, 4),
            "z": round(z, 2),
            "konsekuen": rule["konsekuen"],
            "risiko_hama": rule["risiko_hama"],
        })

    if denominator == 0:
        skor = 20.0
    else:
        skor = numerator / denominator

    skor = round(skor, 2)

    if skor >= 65:
        tingkat = "Tinggi"
        kondisi = "Waspada"
        risiko_hama = "Blast"
        rekomendasi = [
            "Pantau gejala bercak daun pada tanaman padi.",
            "Kurangi kelembapan berlebih di area lahan.",
            "Pastikan drainase lahan berfungsi dengan baik.",
            "Konsultasikan penggunaan fungisida dengan penyuluh.",
        ]

    elif skor >= 45:
        tingkat = "Sedang"
        kondisi = "Waspada"
        risiko_hama = "Blast"
        rekomendasi = [
            "Pantau kelembapan lahan secara berkala.",
            "Periksa kondisi daun dan batang tanaman.",
            "Pastikan air tidak menggenang terlalu lama.",
            "Lakukan konsultasi dengan penyuluh jika muncul gejala penyakit.",
        ]

    else:
        tingkat = "Rendah"
        kondisi = "Sehat"
        risiko_hama = "Rendah"
        rekomendasi = [
            "Pertahankan pola perawatan saat ini.",
            "Lakukan pemantauan tanaman secara berkala.",
            "Jaga saluran air agar tetap lancar.",
            "Lakukan pemupukan sesuai fase pertumbuhan tanaman.",
        ]

    return {
        "fuzzy_input": {
            "suhu": suhu_fz,
            "kelembapan": kelembapan_fz,
            "curah_hujan": hujan_fz,
            "umur_tanaman": umur_fz,
        },
        "rules": detail_rules,
        "skor_risiko": skor,
        "tingkat_risiko": tingkat,
        "kondisi_tanaman": kondisi,
        "risiko_hama": risiko_hama,
        "rekomendasi": rekomendasi,
    }


# =====================================================
# HELPER REKOMENDASI PUPUK DINAMIS
# =====================================================
def get_status_unsur(value):
    value = safe_float(value, 0)

    if value >= 70:
        return "Tinggi"

    if value >= 40:
        return "Sedang"

    return "Rendah"


def get_color_unsur(value):
    value = safe_float(value, 0)

    if value >= 70:
        return "#16a34a"

    if value >= 40:
        return "#f97316"

    return "#ef4444"


# =====================================================
# INFORMASI TAMBAHAN DINAMIS PER LAHAN
# =====================================================
def get_informasi_tambahan(lahan_id, fase, luas_ha, varietas, umur_tanaman):
    lahan_id = int(lahan_id or 0)
    luas_ha = safe_float(luas_ha, 0.0)
    umur_tanaman = safe_int(umur_tanaman, 45)
    varietas_lower = str(varietas or "").lower()

    # pH tanah dibuat beda per lahan
    ph_base = 6.1 + ((lahan_id % 5) * 0.1)

    if luas_ha <= 0.05:
        ph_base += 0.1

    if "mekongga" in varietas_lower:
        ph_base += 0.1
    elif "inpari" in varietas_lower:
        ph_base += 0.0
    elif "ciherang" in varietas_lower:
        ph_base -= 0.1

    ph_tanah_num = round(ph_base, 1)

    if 5.8 <= ph_tanah_num <= 7.0:
        ph_tanah = f"{ph_tanah_num} (Normal)"
    elif ph_tanah_num < 5.8:
        ph_tanah = f"{ph_tanah_num} (Asam)"
    else:
        ph_tanah = f"{ph_tanah_num} (Basa)"

    # kadar organik beda per lahan
    kadar_organik_num = round(
        1.8 + ((lahan_id % 6) * 0.15) + (luas_ha * 0.8),
        1,
    )

    if kadar_organik_num < 2.0:
        kadar_organik = f"{kadar_organik_num}% (Rendah)"
    elif kadar_organik_num <= 3.0:
        kadar_organik = f"{kadar_organik_num}% (Sedang)"
    else:
        kadar_organik = f"{kadar_organik_num}% (Tinggi)"

    # tekstur tanah beda per lahan
    tekstur_options = [
        "Lempung Berdebu",
        "Lempung Liat",
        "Lempung Berpasir",
        "Liat Ringan",
        "Lempung",
    ]

    tekstur_tanah = tekstur_options[lahan_id % len(tekstur_options)]

    # drainase beda berdasarkan tekstur dan luas
    if tekstur_tanah in ["Lempung Liat", "Liat Ringan"]:
        drainase = "Sedang"
    elif luas_ha <= 0.05:
        drainase = "Baik"
    else:
        drainase = "Baik"

    # suhu beda per lahan dan fase
    suhu_num = 24.0 + ((lahan_id % 7) * 0.4)

    if fase == "generatif":
        suhu_num += 0.6
    elif fase == "pematangan":
        suhu_num += 0.9

    suhu = f"{round(suhu_num, 1)} °C"

    # curah hujan beda per lahan
    curah_base = 75 + ((lahan_id % 8) * 9)

    if fase == "vegetatif_awal":
        curah_base += 10
    elif fase == "generatif":
        curah_base -= 8
    elif fase == "pematangan":
        curah_base -= 15

    curah_hujan = f"{round(curah_base, 1)} mm"

    # kelembapan beda per lahan dan umur
    kelembapan_num = 68 + ((lahan_id % 9) * 3)

    if umur_tanaman <= 30:
        kelembapan_num += 4
    elif umur_tanaman > 90:
        kelembapan_num -= 5

    kelembapan_num = max(45, min(96, kelembapan_num))
    kelembapan = f"{round(kelembapan_num, 1)}%"

    return {
        "ph_tanah": ph_tanah,
        "kadar_organik": kadar_organik,
        "tekstur_tanah": tekstur_tanah,
        "drainase": drainase,
        "suhu": suhu,
        "curah_hujan": curah_hujan,
        "kelembapan": kelembapan,
    }


def hitung_unsur_hara_dinamis(fase, weather, luas_ha):
    suhu = safe_float(weather.get("suhu"), 27.0)
    curah_hujan = safe_float(weather.get("curah_hujan"), 10.0)
    kelembapan = safe_float(weather.get("kelembapan"), 80.0)

    if fase == "vegetatif_awal":
        n = 88
        p = 58
        k = 68

    elif fase == "vegetatif_akhir":
        n = 90
        p = 65
        k = 75

    elif fase == "generatif":
        n = 60
        p = 75
        k = 88

    else:
        n = 45
        p = 60
        k = 82

    if curah_hujan > 50:
        n -= 8
        p -= 3

    if kelembapan > 85:
        k += 4

    if suhu > 32:
        n -= 5
        k -= 3

    if luas_ha <= 0.1:
        n += 2
        p += 2
        k += 2

    n = max(20, min(100, round(n)))
    p = max(20, min(100, round(p)))
    k = max(20, min(100, round(k)))

    return {
        "n": n,
        "p": p,
        "k": k,
    }


def hitung_pupuk_utama(fase, unsur_hara):
    n = unsur_hara["n"]
    k = unsur_hara["k"]

    if fase in ["vegetatif_awal", "vegetatif_akhir"]:
        if n < 70:
            return "UREA", 120
        return "UREA", 100

    if fase == "generatif":
        if k < 75:
            return "KCL", 90
        return "KCL", 75

    return "KCL", 50


def hitung_dosis_pupuk(fase, pupuk_utama, dosis_utama, luas_ha):
    luas_ha = safe_float(luas_ha, 0.0)

    def item(jenis, dosis_per_ha):
        dosis_per_ha = safe_float(dosis_per_ha, 0.0)
        dosis_total = round(dosis_per_ha * luas_ha, 2)

        return {
            "jenis_pupuk": jenis,
            "dosis_per_ha": dosis_per_ha,
            "dosis_total": dosis_total,
            "satuan_per_ha": "Kg/Ha",
            "satuan_total": "Kg",
            "label_per_ha": f"{dosis_per_ha:g} Kg/Ha",
            "label_total": f"{dosis_total:g} Kg",
        }

    if fase == "vegetatif_awal":
        return [
            item(pupuk_utama, dosis_utama),
            item("SP-36", 75),
            item("KCL", 50),
        ]

    if fase == "vegetatif_akhir":
        return [
            item(pupuk_utama, dosis_utama),
            item("SP-36", 75),
            item("KCL", 50),
            item("ZA", 50),
            item("Dolomit", 100),
        ]

    if fase == "generatif":
        return [
            item(pupuk_utama, dosis_utama),
            item("SP-36", 60),
            item("ZA", 40),
        ]

    return [
        item(pupuk_utama, dosis_utama),
        item("ZA", 30),
    ]


def hitung_alasan_rekomendasi(fase, luas_ha, umur_tanaman, unsur_hara, weather):
    alasan = []

    if fase == "vegetatif_awal":
        alasan.append(
            "Tanaman berada pada fase vegetatif awal sehingga membutuhkan nitrogen untuk pembentukan daun dan anakan."
        )

    elif fase == "vegetatif_akhir":
        alasan.append(
            "Tanaman berada pada fase vegetatif akhir sehingga membutuhkan pemupukan seimbang untuk memperkuat pertumbuhan."
        )

    elif fase == "generatif":
        alasan.append(
            "Tanaman berada pada fase generatif sehingga kebutuhan kalium meningkat untuk mendukung pembentukan malai dan pengisian bulir."
        )

    else:
        alasan.append(
            "Tanaman memasuki fase pematangan sehingga pemupukan difokuskan untuk menjaga kualitas hasil."
        )

    if luas_ha <= 0.1:
        alasan.append(
            "Luas lahan relatif kecil sehingga dosis total pupuk perlu dihitung secara presisi."
        )
    elif luas_ha <= 0.5:
        alasan.append(
            "Luas lahan sedang sehingga pemupukan dapat dilakukan bertahap sesuai kebutuhan tanaman."
        )
    else:
        alasan.append(
            "Luas lahan cukup besar sehingga pemupukan perlu dijadwalkan agar distribusi pupuk merata."
        )

    if unsur_hara["n"] >= 70:
        alasan.append(
            "Kebutuhan nitrogen berada pada kategori tinggi sehingga pupuk utama perlu mendukung pertumbuhan vegetatif."
        )
    else:
        alasan.append("Nitrogen perlu dijaga agar pertumbuhan tanaman tetap stabil.")

    curah_hujan = safe_float(weather.get("curah_hujan"), 0)
    kelembapan = safe_float(weather.get("kelembapan"), 0)

    if curah_hujan > 40:
        alasan.append(
            "Curah hujan cukup tinggi sehingga waktu pemupukan perlu dipilih agar pupuk tidak mudah tercuci."
        )
    else:
        alasan.append(
            "Curah hujan masih terkendali sehingga pemupukan dapat dilakukan dengan risiko pencucian lebih rendah."
        )

    if kelembapan >= 80:
        alasan.append(
            "Kelembapan lahan mendukung proses penyerapan unsur hara oleh tanaman."
        )

    alasan.append(
        f"Umur tanaman sekitar {umur_tanaman} hari sehingga jadwal pemupukan disesuaikan dengan fase pertumbuhan."
    )

    return alasan


def hitung_jadwal_pemupukan(fase, pupuk_utama, dosis_utama, luas_ha):
    luas_ha = safe_float(luas_ha, 0.0)

    def jadwal_item(label, days, pupuk, dosis_per_ha, color):
        dosis_per_ha = safe_float(dosis_per_ha, 0.0)
        dosis_total = round(dosis_per_ha * luas_ha, 2)

        return {
            "label": label,
            "tanggal": add_days(days),
            "pupuk": pupuk,
            "dosis_per_ha": dosis_per_ha,
            "dosis_total": dosis_total,
            "dosis": f"{dosis_total:g} Kg",
            "label_per_ha": f"{dosis_per_ha:g} Kg/Ha",
            "label_total": f"{dosis_total:g} Kg",
            "color": color,
        }

    if fase == "vegetatif_awal":
        return [
            jadwal_item("Hari Ini", 0, pupuk_utama, dosis_utama, "#16a34a"),
            jadwal_item("14 Hari Lagi", 14, "SP-36", 75, "#2563eb"),
            jadwal_item("28 Hari Lagi", 28, "KCL", 50, "#f97316"),
        ]

    if fase == "vegetatif_akhir":
        return [
            jadwal_item("Hari Ini", 0, pupuk_utama, dosis_utama, "#16a34a"),
            jadwal_item("14 Hari Lagi", 14, "SP-36", 75, "#2563eb"),
            jadwal_item("28 Hari Lagi", 28, "KCL", 50, "#f97316"),
            jadwal_item("42 Hari Lagi", 42, "ZA", 50, "#9333ea"),
        ]

    if fase == "generatif":
        return [
            jadwal_item("Hari Ini", 0, pupuk_utama, dosis_utama, "#f97316"),
            jadwal_item("10 Hari Lagi", 10, "SP-36", 60, "#2563eb"),
        ]

    return [
        jadwal_item("Hari Ini", 0, pupuk_utama, dosis_utama, "#16a34a"),
    ]


def hitung_tingkat_kesesuaian(fase, umur_tanaman, luas_ha, unsur_hara, weather):
    score = 80

    if umur_tanaman <= 30 and fase == "vegetatif_awal":
        score += 8
    elif 31 <= umur_tanaman <= 55 and fase == "vegetatif_akhir":
        score += 8
    elif 56 <= umur_tanaman <= 95 and fase == "generatif":
        score += 8
    elif umur_tanaman > 95 and fase == "pematangan":
        score += 6
    else:
        score -= 4

    if luas_ha <= 0.1:
        score += 3

    if unsur_hara["n"] >= 70 or unsur_hara["k"] >= 70:
        score += 4

    curah_hujan = safe_float(weather.get("curah_hujan"), 0)

    if curah_hujan > 80:
        score -= 6
    elif curah_hujan <= 30:
        score += 3

    return max(70, min(98, round(score)))


def hitung_tips_pupuk(fase, weather):
    curah_hujan = safe_float(weather.get("curah_hujan"), 0)

    if curah_hujan > 50:
        return "Hindari pemupukan saat hujan tinggi. Lakukan pemupukan saat cuaca lebih stabil agar pupuk tidak tercuci."

    if fase in ["vegetatif_awal", "vegetatif_akhir"]:
        return "Lakukan pemupukan pada pagi atau sore hari agar penyerapan unsur hara lebih optimal."

    if fase == "generatif":
        return "Fokuskan pemupukan pada kalium dan hindari nitrogen berlebih agar pembentukan malai lebih optimal."

    return "Kurangi pemupukan nitrogen berlebih pada fase pematangan agar kualitas hasil tetap baik."


def normalisasi_token_monitoring(value) -> str:
    return (
        str(value or "")
        .strip()
        .lower()
        .replace("-", "_")
        .replace(" ", "_")
    )


def parse_monitoring_datetime(value):
    if not value:
        return None

    if isinstance(value, datetime):
        return value

    try:
        # MySQL DATE dapat diterima sebagai objek date dan memiliki isoformat().
        if hasattr(value, "isoformat"):
            return datetime.fromisoformat(str(value.isoformat())[:19])

        return datetime.fromisoformat(str(value).replace("Z", "")[:19])
    except Exception:
        return None


def serialisasi_monitoring(monitoring):
    if not monitoring:
        return None

    result = {}

    for key, value in monitoring.items():
        if value is None:
            result[key] = None
        elif isinstance(value, datetime):
            result[key] = value.isoformat()
        elif hasattr(value, "isoformat"):
            try:
                result[key] = value.isoformat()
            except Exception:
                result[key] = value
        else:
            result[key] = value

    return result


def get_latest_monitoring_harian(cursor, lahan_id: int):
    """
    Mengambil satu monitoring harian terbaru dari tabel monitoring_harian.

    Urutan terbaru menggunakan tanggal monitoring, waktu pembaruan, lalu id.
    Fungsi mengembalikan None apabila data belum tersedia.
    """
    cursor.execute(
        """
        SELECT
            id,
            lahan_id,
            user_id,
            tanggal,
            tinggi_tanaman,
            jumlah_anakan,
            kondisi_daun,
            kondisi_air,
            tingkat_hama,
            jenis_hama,
            kondisi_tanaman,
            suhu,
            kelembapan,
            curah_hujan,
            catatan,
            created_at,
            updated_at
        FROM monitoring_harian
        WHERE lahan_id = %s
        ORDER BY
            tanggal DESC,
            COALESCE(updated_at, created_at) DESC,
            id DESC
        LIMIT 1
        """,
        (lahan_id,),
    )

    return cursor.fetchone()


def evaluasi_monitoring_pupuk(
    monitoring_terakhir,
    gunakan_monitoring: bool = True,
    batas_umur_data_hari: int = 7,
):
    """
    Mengevaluasi kelayakan waktu aplikasi pupuk dari monitoring lapangan.

    Monitoring tidak dipakai untuk mendiagnosis kekurangan unsur hara dan tidak
    otomatis mengubah dosis. Data ini hanya menjadi pendukung untuk:
    - menentukan apakah aplikasi dapat dilakukan, perlu diperiksa, atau ditunda;
    - memberi alasan dan peringatan;
    - mencegah jadwal disimpan ketika kondisi air tidak mendukung.
    """
    result = {
        "monitoring_tersedia": bool(monitoring_terakhir),
        "monitoring_digunakan": False,
        "monitoring_valid": False,
        "umur_data_monitoring_hari": None,
        "status_aplikasi": "PERLU_MONITORING",
        "status_aplikasi_label": "Perlu Monitoring Lapangan",
        "alasan_monitoring": [],
        "peringatan_monitoring": [],
    }

    if not monitoring_terakhir:
        result["alasan_monitoring"].append(
            "Monitoring harian belum tersedia. Rekomendasi dasar tetap dihitung "
            "dari fase, umur, varietas, luas lahan, dan cuaca layanan."
        )
        return result

    tanggal_monitoring = (
        monitoring_terakhir.get("tanggal")
        or monitoring_terakhir.get("updated_at")
        or monitoring_terakhir.get("created_at")
    )
    tanggal_dt = parse_monitoring_datetime(tanggal_monitoring)

    if tanggal_dt:
        umur_data = max(0, (datetime.now() - tanggal_dt).days)
        result["umur_data_monitoring_hari"] = umur_data
    else:
        umur_data = None

    if not gunakan_monitoring:
        result["status_aplikasi"] = "SIMULASI"
        result["status_aplikasi_label"] = "Tidak Dinilai pada Mode Simulasi"
        result["alasan_monitoring"].append(
            "Monitoring aktual tersedia, tetapi tidak digunakan karena hasil ini "
            "merupakan simulasi fase, bukan kondisi tanaman saat ini."
        )
        return result

    if umur_data is not None and umur_data > batas_umur_data_hari:
        result["status_aplikasi"] = "PERLU_MONITORING"
        result["status_aplikasi_label"] = "Monitoring Perlu Diperbarui"
        result["peringatan_monitoring"].append(
            f"Monitoring terakhir berumur {umur_data} hari. Perbarui monitoring "
            "sebelum menentukan waktu aplikasi pupuk."
        )
        return result

    result["monitoring_digunakan"] = True
    result["monitoring_valid"] = True
    result["status_aplikasi"] = "DAPAT_DILAKUKAN"
    result["status_aplikasi_label"] = "Pemupukan Dapat Dilakukan"

    kondisi_air = normalisasi_token_monitoring(
        monitoring_terakhir.get("kondisi_air")
    )
    kondisi_daun = normalisasi_token_monitoring(
        monitoring_terakhir.get("kondisi_daun")
    )
    kondisi_tanaman = normalisasi_token_monitoring(
        monitoring_terakhir.get("kondisi_tanaman")
    )
    tingkat_hama = normalisasi_token_monitoring(
        monitoring_terakhir.get("tingkat_hama")
    )
    curah_hujan_monitoring = safe_float(
        monitoring_terakhir.get("curah_hujan"),
        0.0,
    )

    # Kondisi air menjadi aturan penundaan utama.
    if kondisi_air in {"kering", "sangat_kering", "kurang"}:
        result["status_aplikasi"] = "TUNDA"
        result["status_aplikasi_label"] = "Pemupukan Perlu Ditunda"
        result["peringatan_monitoring"].append(
            "Kondisi air tercatat kering. Perbaiki ketersediaan air terlebih "
            "dahulu agar pupuk dapat larut dan terserap dengan lebih baik."
        )

    if kondisi_air in {"tergenang", "banjir", "berlebih"}:
        result["status_aplikasi"] = "TUNDA"
        result["status_aplikasi_label"] = "Pemupukan Perlu Ditunda"
        result["peringatan_monitoring"].append(
            "Lahan tercatat tergenang. Tunggu air lebih terkendali agar pupuk "
            "tidak mudah terbawa aliran atau hilang."
        )

    # Hujan tinggi pada data monitoring menjadi peringatan waktu aplikasi.
    if curah_hujan_monitoring >= 50:
        if result["status_aplikasi"] != "TUNDA":
            result["status_aplikasi"] = "PERLU_PEMERIKSAAN"
            result["status_aplikasi_label"] = "Periksa Cuaca Sebelum Pemupukan"

        result["peringatan_monitoring"].append(
            "Nilai curah hujan pada monitoring cukup tinggi. Periksa kondisi "
            "tanah dan prakiraan hujan sebelum pupuk diaplikasikan."
        )

    kondisi_tanaman_bermasalah = kondisi_tanaman in {
        "pertumbuhan_lambat",
        "layu",
        "terserang",
        "rebah",
    }
    kondisi_daun_bermasalah = kondisi_daun in {
        "menguning",
        "bercak",
        "layu",
        "berlubang",
        "rusak",
    }

    if kondisi_tanaman_bermasalah or kondisi_daun_bermasalah:
        if result["status_aplikasi"] == "DAPAT_DILAKUKAN":
            result["status_aplikasi"] = "PERLU_PEMERIKSAAN"
            result["status_aplikasi_label"] = "Periksa Kondisi Tanaman"

        result["alasan_monitoring"].append(
            "Monitoring menunjukkan perubahan kondisi tanaman atau daun. "
            "Perubahan tersebut perlu diperiksa karena dapat berkaitan dengan "
            "hara, air, akar, hama, atau penyakit; bukan otomatis dianggap "
            "kekurangan nitrogen."
        )

    if (
        kondisi_daun == "menguning"
        and kondisi_tanaman == "pertumbuhan_lambat"
    ):
        result["alasan_monitoring"].append(
            "Daun menguning disertai pertumbuhan lambat tercatat pada monitoring. "
            "Dosis pupuk dasar tidak dinaikkan otomatis tanpa pemeriksaan lapangan "
            "atau arahan penyuluh."
        )

    if tingkat_hama in {"sedang", "tinggi", "berat"}:
        if result["status_aplikasi"] == "DAPAT_DILAKUKAN":
            result["status_aplikasi"] = "PERLU_PEMERIKSAAN"
            result["status_aplikasi_label"] = "Periksa Gangguan Hama"

        result["peringatan_monitoring"].append(
            "Tingkat hama tercatat sedang atau tinggi. Pengendalian hama perlu "
            "diprioritaskan dan tidak diselesaikan hanya dengan penambahan pupuk."
        )

    if not result["alasan_monitoring"]:
        result["alasan_monitoring"].append(
            "Monitoring terbaru tidak menunjukkan perubahan besar yang "
            "mengharuskan penyesuaian rekomendasi dasar."
        )

    return result


def hitung_rekomendasi_pupuk_dinamis(
    lahan,
    data,
    prediksi_terakhir=None,
    monitoring_terakhir=None,
):
    lahan_id = lahan.get("id")

    luas_ha = safe_float(data.luas_ha, 0.0)

    if luas_ha <= 0:
        luas_ha = safe_float(lahan.get("luas_ha"), 0.0)

    luas_m2 = safe_float(lahan.get("luas_m2"), luas_ha * 10000)

    umur_tanaman = data.umur_tanaman

    if umur_tanaman is None:
        umur_tanaman = hitung_umur_tanaman(lahan.get("tanggal_tanam"))

    umur_tanaman = safe_int(umur_tanaman, 45)

    fase = normalisasi_fase(data.fase_tanaman, umur_tanaman)
    varietas = data.varietas or lahan.get("varietas") or "-"

    lat = safe_float(lahan.get("lat"), -7.6)
    lng = safe_float(lahan.get("lng"), 110.8)

    weather = get_weather(lat, lng)

    if prediksi_terakhir:
        if prediksi_terakhir.get("suhu") is not None:
            weather["suhu"] = safe_float(prediksi_terakhir.get("suhu"), weather["suhu"])

        # Data lama di tabel prediksi bisa berisi curah hujan realtime 0 mm.
        # Karena itu curah_hujan dari prediksi terakhir hanya dipakai jika nilainya lebih dari 0.
        # Jika 0 atau kosong, sistem tetap memakai curah hujan 24 jam dari get_weather().
        if prediksi_terakhir.get("curah_hujan") is not None:
            curah_hujan_prediksi = safe_float(
                prediksi_terakhir.get("curah_hujan"),
                0.0,
            )

            if curah_hujan_prediksi > 0:
                weather["curah_hujan"] = curah_hujan_prediksi
                weather["curah_hujan_24_jam"] = curah_hujan_prediksi
                weather["sumber_curah_hujan"] = "prediksi_terakhir"
            else:
                weather["curah_hujan_saat_ini"] = curah_hujan_prediksi

        if prediksi_terakhir.get("kelembapan") is not None:
            weather["kelembapan"] = safe_float(
                prediksi_terakhir.get("kelembapan"),
                weather["kelembapan"],
            )

    mode_analisis = str(data.mode_analisis or "aktual").strip().lower()
    gunakan_monitoring = bool(data.gunakan_monitoring) and mode_analisis != "simulasi"

    evaluasi_monitoring = evaluasi_monitoring_pupuk(
        monitoring_terakhir=monitoring_terakhir,
        gunakan_monitoring=gunakan_monitoring,
    )

    # Suhu dan kelembapan hasil monitoring dapat menjadi kondisi lokal pendukung
    # jika monitoring masih valid. Curah hujan 24 jam tetap memakai layanan cuaca
    # karena kolom curah_hujan monitoring belum selalu memiliki periode yang sama.
    if evaluasi_monitoring["monitoring_digunakan"] and monitoring_terakhir:
        if monitoring_terakhir.get("suhu") is not None:
            weather["suhu"] = safe_float(
                monitoring_terakhir.get("suhu"),
                weather["suhu"],
            )
            weather["sumber_suhu"] = "monitoring_harian"

        if monitoring_terakhir.get("kelembapan") is not None:
            weather["kelembapan"] = safe_float(
                monitoring_terakhir.get("kelembapan"),
                weather["kelembapan"],
            )
            weather["sumber_kelembapan"] = "monitoring_harian"

    unsur_hara = hitung_unsur_hara_dinamis(fase, weather, luas_ha)
    pupuk_utama, dosis_utama = hitung_pupuk_utama(fase, unsur_hara)
    dosis_total = round(dosis_utama * luas_ha, 2)

    daftar_dosis = hitung_dosis_pupuk(
        fase=fase,
        pupuk_utama=pupuk_utama,
        dosis_utama=dosis_utama,
        luas_ha=luas_ha,
    )

    alasan = hitung_alasan_rekomendasi(
        fase=fase,
        luas_ha=luas_ha,
        umur_tanaman=umur_tanaman,
        unsur_hara=unsur_hara,
        weather=weather,
    )

    alasan.extend(evaluasi_monitoring["alasan_monitoring"])

    for peringatan in evaluasi_monitoring["peringatan_monitoring"]:
        alasan.append(f"Peringatan monitoring: {peringatan}")

    jadwal = hitung_jadwal_pemupukan(
        fase=fase,
        pupuk_utama=pupuk_utama,
        dosis_utama=dosis_utama,
        luas_ha=luas_ha,
    )

    # =====================================================
    # INFORMASI TAMBAHAN SUDAH DINAMIS PER LAHAN
    # =====================================================
    informasi = get_informasi_tambahan(
        lahan_id=lahan_id,
        fase=fase,
        luas_ha=luas_ha,
        varietas=varietas,
        umur_tanaman=umur_tanaman,
    )

    tingkat_kesesuaian = hitung_tingkat_kesesuaian(
        fase=fase,
        umur_tanaman=umur_tanaman,
        luas_ha=luas_ha,
        unsur_hara=unsur_hara,
        weather=weather,
    )

    produksi_saat_ini = 0.0

    if prediksi_terakhir:
        produksi_saat_ini = safe_float(prediksi_terakhir.get("prediksi_ton"), 0.0)

    if produksi_saat_ini <= 0:
        produksi_saat_ini = round(luas_ha * 9.5, 2)

    kenaikan_persen = 23 if fase in ["vegetatif_awal", "vegetatif_akhir"] else 18

    if safe_float(weather.get("curah_hujan"), 0) > 50:
        kenaikan_persen -= 4

    if tingkat_kesesuaian >= 90:
        kenaikan_persen += 2

    kenaikan_persen = max(10, min(28, kenaikan_persen))

    produksi_rekomendasi = round(produksi_saat_ini * (1 + kenaikan_persen / 100), 2)
    kenaikan_ton = round(produksi_rekomendasi - produksi_saat_ini, 2)

    tips = hitung_tips_pupuk(fase, weather)

    if evaluasi_monitoring["status_aplikasi"] == "TUNDA":
        tips = (
            f"{evaluasi_monitoring['status_aplikasi_label']}. "
            "Perbaiki kondisi air atau tunggu kondisi lahan lebih sesuai sebelum "
            "menjalankan jadwal pemupukan."
        )
    elif evaluasi_monitoring["status_aplikasi"] == "PERLU_PEMERIKSAAN":
        tips = (
            f"{evaluasi_monitoring['status_aplikasi_label']}. "
            "Periksa kondisi lapangan dan konsultasikan dengan penyuluh bila gejala "
            "tanaman atau gangguan hama berlanjut."
        )
    elif evaluasi_monitoring["status_aplikasi"] == "PERLU_MONITORING":
        tips = (
            "Perbarui monitoring harian sebelum menentukan waktu aplikasi pupuk. "
            f"{tips}"
        )

    status_unsur_hara = {
        "n": get_status_unsur(unsur_hara["n"]),
        "p": get_status_unsur(unsur_hara["p"]),
        "k": get_status_unsur(unsur_hara["k"]),
    }

    return {
        "pupuk": pupuk_utama,
        "pupuk_utama": pupuk_utama,
        "dosis_per_ha": f"{dosis_utama:g} Kg/Ha",
        "dosis_total": f"{dosis_total:g} Kg",
        "dosis_total_kg": dosis_total,
        "tingkat_kesesuaian": tingkat_kesesuaian,

        "fase_tanaman": fase,
        "fase_label": get_label_fase(fase),
        "umur_tanaman": umur_tanaman,
        "varietas": varietas,

        "lahan": {
            "id": lahan.get("id"),
            "nama_lahan": lahan.get("nama_lahan"),
            "nama_kecamatan": lahan.get("nama_kecamatan"),
            "nama_desa": lahan.get("nama_desa"),
            "luas_ha": luas_ha,
            "luas_m2": luas_m2,
            "tanggal_tanam": format_date_iso(lahan.get("tanggal_tanam")),
            "varietas": varietas,
        },

        "unsur_hara": unsur_hara,
        "status_unsur_hara": status_unsur_hara,
        "warna_unsur_hara": {
            "n": get_color_unsur(unsur_hara["n"]),
            "p": get_color_unsur(unsur_hara["p"]),
            "k": get_color_unsur(unsur_hara["k"]),
        },

        "dosis": daftar_dosis,
        "alasan": alasan,
        "jadwal": jadwal,

        "dampak": {
            "produksi_saat_ini": produksi_saat_ini,
            "produksi_rekomendasi": produksi_rekomendasi,
            "kenaikan_persen": kenaikan_persen,
            "kenaikan_ton": kenaikan_ton,
        },

        "informasi": informasi,
        "cuaca": weather,
        "tips": tips,

        "mode_analisis": mode_analisis,
        "monitoring_tersedia": evaluasi_monitoring["monitoring_tersedia"],
        "monitoring_digunakan": evaluasi_monitoring["monitoring_digunakan"],
        "monitoring_valid": evaluasi_monitoring["monitoring_valid"],
        "umur_data_monitoring_hari": evaluasi_monitoring[
            "umur_data_monitoring_hari"
        ],
        "monitoring_terakhir": serialisasi_monitoring(monitoring_terakhir),
        "status_aplikasi": evaluasi_monitoring["status_aplikasi"],
        "status_aplikasi_label": evaluasi_monitoring[
            "status_aplikasi_label"
        ],
        "alasan_monitoring": evaluasi_monitoring["alasan_monitoring"],
        "peringatan_monitoring": evaluasi_monitoring[
            "peringatan_monitoring"
        ],

        "metode": "Rule-Based System",
        "catatan": (
            "Rekomendasi dasar dihitung dari fase tanaman, umur, luas lahan, "
            "varietas, cuaca, prioritas unsur hara, dan prediksi terakhir. "
            "Monitoring harian digunakan untuk menilai kelayakan waktu aplikasi "
            "dan memberi peringatan, bukan untuk otomatis menaikkan dosis pupuk."
        ),
    }


# =====================================================
# ROOT
# =====================================================
@app.get("/")
def root():
    return {
        "message": "GeoPanen AI Running",
        "version": "3.8",
    }


# =====================================================
# LAHAN
# =====================================================
@app.get("/lahan")
def get_lahan():
    db = get_db()
    cursor = db.cursor(dictionary=True, buffered=True)

    cursor.execute("""
        SELECT 
            l.id,
            l.nama_lahan,
            k.nama_kecamatan,
            d.nama_desa,
            l.luas_ha,
            l.luas_m2,
            l.varietas,
            l.tanggal_tanam,
            l.lat,
            l.lng,
            l.user_id,
            l.petani_id
        FROM lahan l
        LEFT JOIN kecamatan k ON l.kecamatan_id = k.id
        LEFT JOIN desa d ON l.desa_id = d.id
        ORDER BY l.id DESC
    """)

    data = cursor.fetchall()

    cursor.close()
    db.close()

    return data


# =====================================================
# PREDIKSI PANEN
# =====================================================
@app.post("/prediksi")
def prediksi(data: PrediksiInput):
    lahan_id = data.lahan_id
    tahun = data.tahun or datetime.now().year

    if not lahan_id:
        return {
            "status": "error",
            "message": "lahan_id wajib diisi",
        }

    db = get_db()
    cursor = db.cursor(dictionary=True, buffered=True)

    cursor.execute("""
        SELECT 
            l.*,
            k.nama_kecamatan,
            k.kode_kecamatan,
            d.nama_desa
        FROM lahan l
        LEFT JOIN kecamatan k ON l.kecamatan_id = k.id
        LEFT JOIN desa d ON l.desa_id = d.id
        WHERE l.id = %s
        LIMIT 1
    """, (lahan_id,))

    lahan = cursor.fetchone()

    cursor.close()
    db.close()

    if not lahan:
        return {
            "status": "error",
            "message": "lahan tidak ditemukan",
        }

    luas_ha = safe_float(lahan.get("luas_ha"), 0.0)
    luas_m2 = safe_float(lahan.get("luas_m2"), luas_ha * 10000)

    lat = safe_float(lahan.get("lat"), -7.6)
    lng = safe_float(lahan.get("lng"), 110.8)

    weather = get_weather(lat, lng)

    kode_kecamatan = (
        lahan.get("kode_kecamatan")
        or lahan.get("kecamatan_id")
        or 0
    )

    input_df = pd.DataFrame([{
        "tahun": safe_int(tahun, datetime.now().year),
        "kode_kecamatan": safe_float(kode_kecamatan, 0),
        "luas_panen_sawah_ha": luas_ha,
        "produktivitas_sawah_kw_ha": safe_float(lahan.get("produktivitas"), 92.4),
        "curah_hujan": weather["curah_hujan"],
        "suhu": weather["suhu"],
    }])

    input_df = input_df.reindex(columns=fitur, fill_value=0)

    try:
        raw_prediksi = safe_float(model.predict(input_df)[0], 0.0)
    except Exception:
        raw_prediksi = 0.0

    prediksi_ton = hitung_prediksi_ton(raw_prediksi, luas_ha)
    prediksi_kg = round(prediksi_ton * 1000)

    produktivitas_ton_ha = round(prediksi_ton / luas_ha, 2) if luas_ha > 0 else 0
    status_produktivitas = get_status_produktivitas(prediksi_ton, luas_ha)

    rekom, score, status = rule_engine(
        prediksi_ton,
        weather["suhu"],
        weather["curah_hujan"],
        luas_ha,
    )

    hasil_data = {
        "lahan_id": lahan["id"],
        "sawah_id": lahan["id"],
        "lahan": lahan["nama_lahan"],
        "nama_lahan": lahan["nama_lahan"],
        "nama_kecamatan": lahan.get("nama_kecamatan"),
        "nama_desa": lahan.get("nama_desa"),
        "varietas": lahan.get("varietas"),
        "luas": luas_ha,
        "luas_ha": luas_ha,
        "luas_m2": luas_m2,
        "tahun": tahun,
        "periode": str(tahun),

        "raw_prediksi_model": round(raw_prediksi, 4),
        "prediksi_ton": prediksi_ton,
        "prediksi_kg": prediksi_kg,
        "produktivitas": produktivitas_ton_ha,
        "produktivitas_ton_ha": produktivitas_ton_ha,
        "status_produktivitas": status_produktivitas,

        "risk_score": score,
        "status_risiko": status,
        "rekomendasi": rekom,
        "cuaca": weather,
    }

    return {
        "status": "success",
        "message": "Prediksi berhasil diproses",
        "prediksi_ton": prediksi_ton,
        "prediksi_kg": prediksi_kg,
        "produktivitas": produktivitas_ton_ha,
        "risk_score": score,
        "status_risiko": status,
        "rekomendasi": rekom,
        "cuaca": weather,
        "data": hasil_data,
    }


# =====================================================
# PREDIKSI BATCH UNTUK NODE.JS ADMIN MONITORING
# =====================================================
@app.post("/predict-batch")
def predict_batch(data: List[PrediksiFiturInput]):
    if not data:
        return {
            "status": "error",
            "message": "Data prediksi tidak boleh kosong",
            "prediksi": [],
            "detail": [],
        }

    rows = []

    for item in data:
        rows.append({
            "tahun": safe_int(item.tahun, datetime.now().year),
            "kode_kecamatan": safe_float(item.kode_kecamatan, 0),
            "luas_panen_sawah_ha": safe_float(item.luas_panen_sawah_ha, 0),
            "produktivitas_sawah_kw_ha": safe_float(
                item.produktivitas_sawah_kw_ha,
                55,
            ),
            "curah_hujan": safe_float(item.curah_hujan, 10),
            "suhu": safe_float(item.suhu, 27),
        })

    input_df = pd.DataFrame(rows)
    input_df = input_df.reindex(columns=fitur, fill_value=0)

    try:
        raw_predictions = model.predict(input_df)
    except Exception as e:
        return {
            "status": "error",
            "message": "Prediksi batch gagal diproses",
            "error": str(e),
            "prediksi": [],
            "detail": [],
        }

    prediksi_list = []
    detail = []

    for index, raw_prediksi in enumerate(raw_predictions):
        row = rows[index]

        luas_ha = safe_float(row.get("luas_panen_sawah_ha"), 0)
        produktivitas_kw_ha = safe_float(
            row.get("produktivitas_sawah_kw_ha"),
            55,
        )

        prediksi_ton = hitung_prediksi_ton(raw_prediksi, luas_ha)
        prediksi_kg = round(prediksi_ton * 1000)

        produktivitas_ton_ha = (
            round(prediksi_ton / luas_ha, 2)
            if luas_ha > 0
            else 0
        )

        baseline_ton = (produktivitas_kw_ha / 10) * luas_ha

        if baseline_ton > 0:
            perubahan = ((prediksi_ton - baseline_ton) / baseline_ton) * 100
        else:
            perubahan = 0

        perubahan = round(perubahan, 1)

        if perubahan <= -10:
            status_monitoring = "risiko"
        elif perubahan < 0:
            status_monitoring = "waspada"
        else:
            status_monitoring = "aman"

        status_produktivitas = get_status_produktivitas(
            prediksi_ton,
            luas_ha,
        )

        hasil_item = {
            "index": index,
            "tahun": row["tahun"],
            "kode_kecamatan": row["kode_kecamatan"],
            "luas_panen_sawah_ha": luas_ha,
            "produktivitas_sawah_kw_ha": produktivitas_kw_ha,
            "curah_hujan": row["curah_hujan"],
            "suhu": row["suhu"],

            "raw_prediksi_model": round(safe_float(raw_prediksi, 0), 4),
            "prediksi_ton": prediksi_ton,
            "prediksi_kg": prediksi_kg,
            "produktivitas_ton_ha": produktivitas_ton_ha,
            "status_produktivitas": status_produktivitas,

            "baseline_ton": round(baseline_ton, 2),
            "perubahan": perubahan,
            "status": status_monitoring,
        }

        prediksi_list.append(prediksi_ton)
        detail.append(hasil_item)

    return {
        "status": "success",
        "message": "Prediksi batch berhasil diproses",
        "jumlah_data": len(detail),
        "satuan": "ton",
        "prediksi": prediksi_list,
        "detail": detail,
    }


# =====================================================
# MONITORING RISIKO FUZZY TSUKAMOTO
# =====================================================
@app.post("/monitoring/risiko")
def monitoring_risiko(data: MonitoringInput):
    """
    Monitoring risiko tanaman dengan Fuzzy Tsukamoto.

    Perbaikan:
    - Jika curah_hujan dari frontend bernilai 0 atau kosong, sistem mencoba mengambil
      cuaca berdasarkan koordinat lahan dan memakai curah hujan akumulasi 24 jam.
    - Jika lahan/koordinat tidak tersedia, sistem tetap memakai data yang dikirim frontend.
    """

    cuaca_lahan = None

    try:
        db = get_db()
        cursor = db.cursor(dictionary=True, buffered=True)

        cursor.execute("""
            SELECT 
                id,
                lat,
                lng
            FROM lahan
            WHERE id = %s
            LIMIT 1
        """, (data.lahan_id,))

        lahan = cursor.fetchone()

        cursor.close()
        db.close()

        if lahan:
            lat = safe_float(lahan.get("lat"), -7.6)
            lng = safe_float(lahan.get("lng"), 110.8)
            cuaca_lahan = get_weather(lat, lng)

    except Exception:
        cuaca_lahan = None

    suhu_analisis = safe_float(
        data.suhu,
        cuaca_lahan.get("suhu", 27.0) if cuaca_lahan else 27.0,
    )

    kelembapan_analisis = safe_float(
        data.kelembapan,
        cuaca_lahan.get("kelembapan", 80.0) if cuaca_lahan else 80.0,
    )

    curah_hujan_input = safe_float(data.curah_hujan, 0.0)

    if curah_hujan_input <= 0 and cuaca_lahan:
        curah_hujan_analisis = safe_float(cuaca_lahan.get("curah_hujan"), 0.0)
        curah_hujan_saat_ini = safe_float(
            cuaca_lahan.get("curah_hujan_saat_ini"),
            curah_hujan_input,
        )
        sumber_curah_hujan = cuaca_lahan.get("sumber_curah_hujan", "akumulasi_24_jam")
    else:
        curah_hujan_analisis = curah_hujan_input
        curah_hujan_saat_ini = curah_hujan_input
        sumber_curah_hujan = "input_frontend"

    hasil = fuzzy_tsukamoto_risiko(
        suhu=suhu_analisis,
        kelembapan=kelembapan_analisis,
        curah_hujan=curah_hujan_analisis,
        umur_tanaman=data.umur_tanaman,
    )

    prediksi_panen = "6.2 Ton/Ha"

    if hasil["tingkat_risiko"] == "Tinggi":
        prediksi_panen = "Potensi turun jika tidak ditangani"

    elif hasil["tingkat_risiko"] == "Sedang":
        prediksi_panen = "Perlu pemantauan lanjutan"

    return {
        "status": "success",
        "lahan_id": data.lahan_id,
        "varietas": data.varietas,
        "luas_ha": data.luas_ha,
        "suhu": suhu_analisis,
        "kelembapan": kelembapan_analisis,
        "curah_hujan": curah_hujan_analisis,
        "curah_hujan_24_jam": curah_hujan_analisis,
        "curah_hujan_saat_ini": curah_hujan_saat_ini,
        "sumber_curah_hujan": sumber_curah_hujan,
        "umur_tanaman": data.umur_tanaman,

        "kondisi_tanaman": hasil["kondisi_tanaman"],
        "risiko_hama": hasil["risiko_hama"],
        "tingkat_risiko": hasil["tingkat_risiko"],
        "status_risiko": hasil["tingkat_risiko"],
        "skor_risiko": hasil["skor_risiko"],
        "risk_score": hasil["skor_risiko"],

        "prediksi_panen": prediksi_panen,
        "prediksi_ton": None,

        "rekomendasi": hasil["rekomendasi"],

        "cuaca": {
            "suhu": suhu_analisis,
            "kelembapan": kelembapan_analisis,
            "curah_hujan": curah_hujan_analisis,
            "curah_hujan_24_jam": curah_hujan_analisis,
            "curah_hujan_saat_ini": curah_hujan_saat_ini,
            "sumber_curah_hujan": sumber_curah_hujan,
        },

        "detail_fuzzy": {
            "fuzzy_input": hasil["fuzzy_input"],
            "rules": hasil["rules"],
        },
    }


# =====================================================
# REKOMENDASI PUPUK DINAMIS BERBASIS RULE-BASED SYSTEM
# =====================================================
@app.post("/rekomendasi/generate")
def generate_rekomendasi(data: RekomendasiInput):
    sawah_id = data.sawah_id or data.lahan_id

    if not sawah_id:
        return {
            "status": "error",
            "message": "sawah_id atau lahan_id wajib diisi",
        }

    db = get_db()
    cursor = db.cursor(dictionary=True, buffered=True)

    cursor.execute("""
        SELECT 
            l.*,
            k.nama_kecamatan,
            d.nama_desa
        FROM lahan l
        LEFT JOIN kecamatan k ON l.kecamatan_id = k.id
        LEFT JOIN desa d ON l.desa_id = d.id
        WHERE l.id = %s
        LIMIT 1
    """, (sawah_id,))

    lahan = cursor.fetchone()

    if not lahan:
        cursor.close()
        db.close()

        return {
            "status": "error",
            "message": "lahan tidak ditemukan",
        }

    cursor.execute("""
        SELECT 
            p.id,
            p.sawah_id,
            p.prediksi_ton,
            p.prediksi_kg,
            p.produktivitas,
            p.confidence,
            p.estimasi_panen,
            p.suhu,
            p.curah_hujan,
            p.kelembapan,
            p.risk_score,
            p.status_risiko,
            p.rekomendasi,
            p.created_at,
            p.periode
        FROM prediksi p
        WHERE p.sawah_id = %s
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT 1
    """, (sawah_id,))

    prediksi_terakhir = cursor.fetchone()

    try:
        monitoring_terakhir = get_latest_monitoring_harian(
            cursor=cursor,
            lahan_id=sawah_id,
        )
    except mysql.connector.Error as monitoring_error:
        # Rekomendasi dasar tetap dapat dihitung jika tabel monitoring belum
        # tersedia pada basis data lama.
        print("WARNING MONITORING HARIAN:", monitoring_error)
        monitoring_terakhir = None

    cursor.close()
    db.close()

    hasil = hitung_rekomendasi_pupuk_dinamis(
        lahan=lahan,
        data=data,
        prediksi_terakhir=prediksi_terakhir,
        monitoring_terakhir=monitoring_terakhir,
    )

    return {
        "status": "success",
        "message": "Rekomendasi pupuk berhasil dibuat",
        "lahan_id": sawah_id,
        "sawah_id": sawah_id,
        "metode": "Rule-Based System",
        "data": hasil,
    }


# =====================================================
# HISTORY REKOMENDASI
# =====================================================
@app.get("/history")
def history():
    db = get_db()
    cursor = db.cursor(dictionary=True, buffered=True)

    cursor.execute("""
        SELECT 
            h.*,
            l.nama_lahan
        FROM rekomendasi_history h
        LEFT JOIN lahan l ON h.lahan_id = l.id
        ORDER BY h.created_at DESC
        LIMIT 100
    """)

    result = cursor.fetchall()

    cursor.close()
    db.close()

    return result

