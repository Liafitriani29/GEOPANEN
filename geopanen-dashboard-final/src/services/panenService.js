import api from "./api";

// ================= KECAMATAN =================
export async function getKecamatan() {
  const res = await api.get("/kecamatan");
  return res.data;
}

// ================= SAWAH =================
export async function getSawahByFilter(kecamatanId) {
  const res = await api.get(`/sawah?kecamatan_id=${kecamatanId}`);
  return res.data;
}

export async function getDetailSawah(id) {
  const res = await api.get(`/sawah/${id}`);
  return res.data;
}

// ================= PREDIKSI =================
export async function getPrediksi(sawahId) {
  const res = await api.get(`/prediksi/${sawahId}`);
  return res.data;
}

// ================= JADWAL PUPUK =================
export async function getJadwalPupuk(sawahId) {
  const res = await api.get(`/jadwal-pupuk/${sawahId}`);
  return res.data;
}