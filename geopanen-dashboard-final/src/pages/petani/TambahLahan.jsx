import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:3000/api";

const VARIETAS_PADI = [
  "Ciherang",
  "IR64",
  "Inpari 32",
  "Inpari 33",
  "Inpari 42",
  "Inpari 43",
  "Inpari 48 Blas",
  "Inpari 49 Jembar",
  "Inpari 50 Marem",
  "Inpari IR Nutri Zinc",
  "Mekongga",
  "Cibogo",
  "Situ Bagendit",
  "Memberamo",
  "Sintanur",
  "Padjadjaran",
];

const MAX_FILE_SIZE = 3 * 1024 * 1024;

const normalizeApiList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const getTodayDate = () => {
  return new Date().toISOString().slice(0, 10);
};

const hitungLuasHa = (luasM2) => {
  const m2 = Number(luasM2);

  if (!m2 || m2 <= 0) return "";

  const ha = m2 / 10000;

  return Number.isInteger(ha)
    ? String(ha)
    : ha.toFixed(2).replace(/\.?0+$/, "");
};

const initialForm = {
  nama_lahan: "",
  varietas: "",
  luas_m2: "",
  luas_ha: "",
  tanggal_tanam: "",
  kecamatan_id: "",
  desa_id: "",
  lat: "",
  lng: "",
  foto: null,
};

export default function TambahLahan() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const storedUser = getStoredUser();

  const userId =
    localStorage.getItem("user_id") ||
    localStorage.getItem("petani_id") ||
    storedUser?.id;

  const [loading, setLoading] = useState(false);
  const [loadingKecamatan, setLoadingKecamatan] = useState(false);
  const [loadingDesa, setLoadingDesa] = useState(false);

  const [kecamatanList, setKecamatanList] = useState([]);
  const [desaList, setDesaList] = useState([]);

  const [form, setForm] = useState(initialForm);
  const [fotoPreview, setFotoPreview] = useState("");

  useEffect(() => {
    fetchKecamatan();
  }, []);

  useEffect(() => {
    if (form.kecamatan_id) {
      fetchDesaByKecamatan(form.kecamatan_id);
    } else {
      setDesaList([]);
      setForm((prev) => ({
        ...prev,
        desa_id: "",
        lat: "",
        lng: "",
      }));
    }
  }, [form.kecamatan_id]);

  useEffect(() => {
    return () => {
      if (fotoPreview) {
        URL.revokeObjectURL(fotoPreview);
      }
    };
  }, [fotoPreview]);

  const selectedKecamatan = useMemo(() => {
    return kecamatanList.find(
      (item) => Number(item.id) === Number(form.kecamatan_id)
    );
  }, [kecamatanList, form.kecamatan_id]);

  const selectedDesa = useMemo(() => {
    return desaList.find((item) => Number(item.id) === Number(form.desa_id));
  }, [desaList, form.desa_id]);

  const fetchKecamatan = async () => {
    try {
      setLoadingKecamatan(true);

      const res = await axios.get(`${API}/kecamatan`);
      const data = normalizeApiList(res.data);

      setKecamatanList(data);
    } catch (err) {
      console.log("ERROR KECAMATAN:", err.response?.data || err.message);
      setKecamatanList([]);
      alert("Gagal mengambil data kecamatan.");
    } finally {
      setLoadingKecamatan(false);
    }
  };

  const fetchDesaByKecamatan = async (kecamatanId) => {
    try {
      setLoadingDesa(true);

      const res = await axios.get(`${API}/desa`, {
        params: {
          kecamatan_id: kecamatanId,
        },
      });

      const data = normalizeApiList(res.data);

      setDesaList(data);
    } catch (err) {
      console.log("ERROR DESA:", err.response?.data || err.message);
      setDesaList([]);
      alert("Gagal mengambil data desa.");
    } finally {
      setLoadingDesa(false);
    }
  };

  const handleLuasM2Change = (e) => {
    const luasM2 = e.target.value;
    const luasHa = hitungLuasHa(luasM2);

    setForm((prev) => ({
      ...prev,
      luas_m2: luasM2,
      luas_ha: luasHa,
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "luas_m2") {
      handleLuasM2Change(e);
      return;
    }

    if (name === "kecamatan_id") {
      setForm((prev) => ({
        ...prev,
        kecamatan_id: value,
        desa_id: "",
        lat: "",
        lng: "",
      }));

      return;
    }

    if (name === "desa_id") {
      const desa = desaList.find((item) => Number(item.id) === Number(value));

      const lat = desa?.lat ?? desa?.latitude ?? "";
      const lng = desa?.lng ?? desa?.longitude ?? "";

      setForm((prev) => ({
        ...prev,
        desa_id: value,
        lat,
        lng,
      }));

      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const clearFoto = () => {
    if (fotoPreview) {
      URL.revokeObjectURL(fotoPreview);
    }

    setFotoPreview("");

    setForm((prev) => ({
      ...prev,
      foto: null,
    }));

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;

    if (!file) {
      clearFoto();
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("File harus berupa gambar.");
      clearFoto();
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert("Ukuran foto maksimal 3 MB.");
      clearFoto();
      return;
    }

    if (fotoPreview) {
      URL.revokeObjectURL(fotoPreview);
    }

    setForm((prev) => ({
      ...prev,
      foto: file,
    }));

    setFotoPreview(URL.createObjectURL(file));
  };

  const resetForm = () => {
    setForm(initialForm);
    setDesaList([]);
    clearFoto();
  };

  const validateForm = () => {
    if (!userId) {
      alert("User belum login. Silakan login ulang.");
      navigate("/login");
      return false;
    }

    if (!form.nama_lahan.trim()) {
      alert("Nama lahan wajib diisi.");
      return false;
    }

    if (!form.varietas) {
      alert("Varietas padi wajib dipilih.");
      return false;
    }

    if (!form.luas_m2) {
      alert("Luas lahan wajib diisi.");
      return false;
    }

    if (Number(form.luas_m2) <= 0) {
      alert("Luas lahan harus lebih dari 0.");
      return false;
    }

    if (!form.luas_ha) {
      alert("Luas lahan dalam hektar belum terhitung.");
      return false;
    }

    if (!form.tanggal_tanam) {
      alert("Tanggal tanam wajib diisi.");
      return false;
    }

    if (form.tanggal_tanam > getTodayDate()) {
      alert("Tanggal tanam tidak boleh lebih dari hari ini.");
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

    if (form.lat === "" || form.lng === "") {
      alert("Koordinat desa belum tersedia. Cek data lat/lng pada tabel desa.");
      return false;
    }

    if (!form.foto) {
      alert("Foto lahan wajib diupload.");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setLoading(true);

      const formData = new FormData();

      formData.append("nama_lahan", form.nama_lahan.trim());
      formData.append("varietas", form.varietas);
      formData.append("tanaman", "Padi");
      formData.append("jenis_tanaman", "Padi");

      formData.append("luas_m2", Number(form.luas_m2));
      formData.append("luas_ha", Number(form.luas_ha));
      formData.append("tanggal_tanam", form.tanggal_tanam);

      formData.append("kecamatan_id", form.kecamatan_id);
      formData.append("desa_id", form.desa_id);

      formData.append(
        "nama_kecamatan",
        selectedKecamatan?.nama_kecamatan || ""
      );
      formData.append("nama_desa", selectedDesa?.nama_desa || "");

      formData.append("lat", form.lat);
      formData.append("lng", form.lng);

      formData.append("user_id", userId);
      formData.append("petani_id", userId);

      formData.append("status_lahan", "active");
      formData.append("fase_tanam", "Vegetatif");

      formData.append("foto", form.foto);

      await axios.post(`${API}/lahan`, formData);

      alert("Lahan berhasil ditambahkan.");
      resetForm();
      navigate("/petani/lahan-saya", { replace: true });
    } catch (err) {
      console.log("ERROR TAMBAH LAHAN:", err.response?.data || err);
      alert(err.response?.data?.message || "Gagal menambah lahan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button
          type="button"
          style={styles.backButton}
          onClick={() => navigate("/petani/lahan-saya")}
        >
          ←
        </button>

        <div>
          <h1 style={styles.title}>Tambah Lahan</h1>
          <p style={styles.subtitle}>
            Tambahkan data lahan baru berdasarkan kecamatan, desa, tanggal tanam,
            luas lahan, varietas padi, dan foto lahan.
          </p>
        </div>
      </div>

      <div style={styles.wrapper}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Form Data Lahan</h2>

          <form onSubmit={handleSubmit}>
            <div style={styles.grid}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Nama Lahan</label>
                <input
                  name="nama_lahan"
                  value={form.nama_lahan}
                  onChange={handleChange}
                  placeholder="Contoh: Sawah Utara"
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Varietas Padi</label>
                <select
                  name="varietas"
                  value={form.varietas}
                  onChange={handleChange}
                  style={styles.input}
                  required
                >
                  <option value="">Pilih varietas padi</option>

                  {VARIETAS_PADI.map((varietas) => (
                    <option key={varietas} value={varietas}>
                      {varietas}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Luas Lahan M²</label>
                <input
                  name="luas_m2"
                  type="number"
                  min="1"
                  value={form.luas_m2}
                  onChange={handleChange}
                  placeholder="Contoh: 900"
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Luas Lahan Ha</label>
                <input
                  type="text"
                  value={form.luas_ha ? `${form.luas_ha} Ha` : ""}
                  placeholder="Otomatis dari luas m²"
                  style={{
                    ...styles.input,
                    background: "#f8fafc",
                    cursor: "not-allowed",
                    color: "#065f46",
                    fontWeight: 800,
                  }}
                  readOnly
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Tanggal Tanam</label>
                <input
                  type="date"
                  name="tanggal_tanam"
                  value={form.tanggal_tanam}
                  onChange={handleChange}
                  max={getTodayDate()}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Kecamatan</label>
                <select
                  name="kecamatan_id"
                  value={form.kecamatan_id}
                  onChange={handleChange}
                  style={styles.input}
                  required
                >
                  <option value="">
                    {loadingKecamatan
                      ? "Memuat kecamatan..."
                      : "Pilih kecamatan"}
                  </option>

                  {kecamatanList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nama_kecamatan}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Desa</label>
                <select
                  name="desa_id"
                  value={form.desa_id}
                  onChange={handleChange}
                  style={styles.input}
                  disabled={!form.kecamatan_id || loadingDesa}
                  required
                >
                  <option value="">
                    {!form.kecamatan_id
                      ? "Pilih kecamatan dulu"
                      : loadingDesa
                      ? "Memuat desa..."
                      : "Pilih desa"}
                  </option>

                  {desaList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nama_desa}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Foto Lahan</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleFileChange}
                  style={styles.fileInput}
                  required
                />
              </div>
            </div>

            <div style={styles.photoBox}>
              <div>
                <strong>Preview Foto Lahan</strong>
                <p>
                  Foto ini akan dikirim ke backend, disimpan di folder uploads,
                  lalu path fotonya disimpan ke database.
                </p>
              </div>

              {fotoPreview ? (
                <div style={styles.photoPreviewWrap}>
                  <img
                    src={fotoPreview}
                    alt="Preview lahan"
                    style={styles.photoPreview}
                  />

                  <button
                    type="button"
                    style={styles.removePhotoButton}
                    onClick={clearFoto}
                    disabled={loading}
                  >
                    Hapus Foto
                  </button>
                </div>
              ) : (
                <div style={styles.photoPlaceholder}>Belum ada foto</div>
              )}
            </div>

            <div style={styles.coordinateBox}>
              <div>
                <strong>Koordinat Otomatis</strong>

                {selectedDesa ? (
                  <p>
                    Kecamatan:{" "}
                    <b>{selectedKecamatan?.nama_kecamatan || "-"}</b> · Desa:{" "}
                    <b>{selectedDesa?.nama_desa || "-"}</b>
                    <br />
                    Lat: <b>{form.lat || "-"}</b> · Lng:{" "}
                    <b>{form.lng || "-"}</b>
                  </p>
                ) : (
                  <p>
                    Koordinat akan otomatis terisi setelah desa dipilih. Petani
                    tidak perlu input latitude dan longitude manual.
                  </p>
                )}
              </div>

              <div style={styles.coordinateBadge}>
                {selectedDesa ? "Siap Disimpan" : "Belum Pilih Desa"}
              </div>
            </div>

            <div style={styles.summaryBox}>
              <strong>Ringkasan Lahan</strong>

              <div style={styles.summaryGrid}>
                <span>Nama Lahan</span>
                <b>{form.nama_lahan || "-"}</b>

                <span>Varietas</span>
                <b>{form.varietas || "-"}</b>

                <span>Luas</span>
                <b>
                  {form.luas_m2 || "-"} m² /{" "}
                  {form.luas_ha ? `${form.luas_ha} Ha` : "-"}
                </b>

                <span>Tanggal Tanam</span>
                <b>{form.tanggal_tanam || "-"}</b>

                <span>Lokasi</span>
                <b>
                  {selectedDesa?.nama_desa || "-"},{" "}
                  {selectedKecamatan?.nama_kecamatan || "-"}
                </b>

                <span>Foto</span>
                <b>{form.foto?.name || "-"}</b>
              </div>
            </div>

            <div style={styles.actions}>
              <button
                type="button"
                style={styles.cancelButton}
                onClick={() => navigate("/petani/lahan-saya")}
                disabled={loading}
              >
                Batal
              </button>

              <button type="submit" style={styles.submitButton} disabled={loading}>
                {loading ? "Menyimpan..." : "Simpan Lahan"}
              </button>
            </div>
          </form>
        </div>

        <div style={styles.sideCard}>
          <h3 style={styles.sideTitle}>Petunjuk</h3>

          <div style={styles.tipItem}>
            <strong>1. Nama lahan</strong>
            <p>Gunakan nama yang mudah dikenali, misalnya Sawah Utara.</p>
          </div>

          <div style={styles.tipItem}>
            <strong>2. Varietas padi</strong>
            <p>Pilih varietas dari dropdown agar penulisan data tetap seragam.</p>
          </div>

          <div style={styles.tipItem}>
            <strong>3. Luas lahan</strong>
            <p>
              Masukkan luas dalam meter persegi. Sistem otomatis menghitung
              hektar.
            </p>
          </div>

          <div style={styles.tipItem}>
            <strong>4. Tanggal tanam</strong>
            <p>
              Data ini dipakai untuk menghitung umur tanaman dan estimasi panen.
            </p>
          </div>

          <div style={styles.tipItem}>
            <strong>5. Kecamatan dan desa</strong>
            <p>Daftar desa akan muncul sesuai kecamatan yang dipilih.</p>
          </div>

          <div style={styles.tipItem}>
            <strong>6. Koordinat</strong>
            <p>Latitude dan longitude otomatis diambil dari tabel desa.</p>
          </div>

          <div style={styles.tipItem}>
            <strong>7. Foto lahan</strong>
            <p>
              Foto diupload lewat form, disimpan di backend, lalu ditampilkan di
              halaman Lahan Saya.
            </p>
          </div>

          <div style={styles.tipItem}>
            <strong>8. Akun petani</strong>
            <p>Lahan otomatis tersimpan untuk akun petani yang sedang login.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    padding: "24px",
    boxSizing: "border-box",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: "#111827",
  },

  header: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 22,
  },

  backButton: {
    width: 42,
    height: 42,
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    background: "#ffffff",
    fontSize: 24,
    cursor: "pointer",
  },

  title: {
    margin: 0,
    fontSize: 26,
    fontWeight: 850,
    color: "#064e3b",
  },

  subtitle: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 14,
  },

  wrapper: {
    display: "grid",
    gridTemplateColumns: "1fr 340px",
    gap: 20,
  },

  card: {
    background: "#ffffff",
    borderRadius: 18,
    padding: 24,
    boxShadow: "0 18px 45px rgba(15,23,42,.08)",
    border: "1px solid #e5e7eb",
  },

  cardTitle: {
    margin: "0 0 20px",
    fontSize: 20,
    fontWeight: 850,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },

  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: 16,
  },

  label: {
    fontSize: 14,
    fontWeight: 750,
    color: "#374151",
  },

  input: {
    width: "100%",
    height: 44,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "0 12px",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    background: "#ffffff",
  },

  fileInput: {
    height: 44,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 14,
    boxSizing: "border-box",
    background: "#ffffff",
  },

  photoBox: {
    margin: "4px 0 16px",
    padding: 16,
    borderRadius: 14,
    border: "1px solid #dbeafe",
    background: "#eff6ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
  },

  photoPreviewWrap: {
    width: 210,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  photoPreview: {
    width: "100%",
    height: 120,
    borderRadius: 12,
    objectFit: "cover",
    border: "1px solid #bfdbfe",
    background: "#ffffff",
  },

  photoPlaceholder: {
    width: 210,
    height: 120,
    borderRadius: 12,
    border: "1px dashed #93c5fd",
    background: "#ffffff",
    color: "#64748b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 13,
  },

  removePhotoButton: {
    height: 34,
    border: "1px solid #fecaca",
    borderRadius: 8,
    background: "#ffffff",
    color: "#ef4444",
    fontWeight: 800,
    cursor: "pointer",
  },

  coordinateBox: {
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
    borderRadius: 14,
    padding: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    margin: "4px 0 16px",
  },

  coordinateBadge: {
    minWidth: 130,
    height: 38,
    borderRadius: 999,
    border: "1px solid #86efac",
    background: "#ffffff",
    color: "#047857",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: 13,
    padding: "0 14px",
    whiteSpace: "nowrap",
  },

  summaryBox: {
    background: "#f8fafc",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "160px 1fr",
    gap: "10px 14px",
    marginTop: 12,
    fontSize: 14,
  },

  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 24,
  },

  cancelButton: {
    height: 44,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    background: "#ffffff",
    color: "#374151",
    fontWeight: 800,
    cursor: "pointer",
    padding: "0 20px",
  },

  submitButton: {
    height: 44,
    border: "none",
    borderRadius: 10,
    background: "#059669",
    color: "#ffffff",
    fontWeight: 850,
    cursor: "pointer",
    padding: "0 24px",
  },

  sideCard: {
    background: "#ffffff",
    borderRadius: 18,
    padding: 20,
    boxShadow: "0 18px 45px rgba(15,23,42,.08)",
    border: "1px solid #e5e7eb",
    alignSelf: "start",
  },

  sideTitle: {
    margin: "0 0 16px",
    fontSize: 18,
    fontWeight: 850,
    color: "#064e3b",
  },

  tipItem: {
    borderBottom: "1px solid #f1f5f9",
    paddingBottom: 14,
    marginBottom: 14,
  },
};