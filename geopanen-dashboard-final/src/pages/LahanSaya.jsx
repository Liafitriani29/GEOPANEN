import { useEffect, useState } from "react";
import axios from "axios";

const API = "http://localhost:3000/api";

export default function LahanSaya() {
  const [kecamatanList, setKecamatanList] = useState([]);
  const [desaList, setDesaList] = useState([]);
  const [lahanList, setLahanList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState(null);

  const [form, setForm] = useState({
    nama_lahan: "",
    kecamatan_id: "",
    desa_id: "",
    petani_id: localStorage.getItem("user_id") || "",
    luas: "",
    varietas: "",
    foto: null,
  });

  // ================= INIT =================
  useEffect(() => {
    fetchKecamatan();
    fetchLahan();
  }, []);

  // ================= DEBUG =================
  const debugLog = () => {
    console.log("FORM:", form);
    console.log("USER_ID:", localStorage.getItem("user_id"));
  };

  // ================= FETCH KECAMATAN =================
  const fetchKecamatan = async () => {
    try {
      const res = await axios.get(`${API}/kecamatan`);
      const data = res.data?.data || res.data || [];
      setKecamatanList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.log("ERROR KECAMATAN:", err);
      setKecamatanList([]);
    }
  };

  // ================= FETCH LAHAN =================
  const fetchLahan = async () => {
    try {
      const res = await axios.get(`${API}/lahan`);
      const data = res.data?.data || res.data || [];
      setLahanList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.log("ERROR LAHAN:", err);
      setLahanList([]);
    }
  };

  // ================= DESA =================
  const handleKecamatanChange = async (e) => {
    const id = e.target.value;

    setForm((p) => ({
      ...p,
      kecamatan_id: id,
      desa_id: "",
    }));

    setDesaList([]);

    if (!id) return;

    try {
      const res = await axios.get(`${API}/desa?kecamatan_id=${id}`);
      const data = res.data?.data || res.data || [];

      const filtered = Array.isArray(data)
        ? data.filter((d) => String(d.kecamatan_id) === String(id))
        : [];

      setDesaList(filtered);
    } catch (err) {
      console.log("ERROR DESA:", err);
      setDesaList([]);
    }
  };

  // ================= INPUT =================
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  // ================= SUBMIT =================
  const handleSubmit = async () => {
    setLoading(true);

    console.log("DATA YANG DIKIRIM"); // 🔥 DEBUG 2
    debugLog(); // 🔥 DEBUG 1

    const petaniId = localStorage.getItem("user_id");

    // ================= VALIDASI =================
    if (
      !form.nama_lahan ||
      !form.kecamatan_id ||
      !form.desa_id ||
      !form.luas ||
      !petaniId
    ) {
      alert("Data belum lengkap");
      setLoading(false);
      return;
    }

    const data = new FormData();
    data.append("nama_lahan", form.nama_lahan);
    data.append("kecamatan_id", form.kecamatan_id);
    data.append("desa_id", form.desa_id);
    data.append("luas", form.luas);
    data.append("varietas", form.varietas);
    data.append("petani_id", petaniId);

    if (form.foto) data.append("foto", form.foto);

    try {
      if (editId) {
        await axios.put(`${API}/lahan/${editId}`, data);
      } else {
        await axios.post(`${API}/lahan`, data);
      }

      resetForm();
      fetchLahan();
    } catch (err) {
      console.log("ERROR FULL:", err.response); // 🔥 DEBUG 3
      alert(err.response?.data?.message || "Gagal simpan data");
    }

    setLoading(false);
  };

  // ================= EDIT =================
  const handleEdit = async (item) => {
    setEditId(item.id);

    setForm({
      nama_lahan: item.nama_lahan || "",
      kecamatan_id: item.kecamatan_id || "",
      desa_id: item.desa_id || "",
      luas: item.luas_m2 || "",
      varietas: item.varietas || "",
      foto: null,
      petani_id: localStorage.getItem("user_id") || "",
    });

    try {
      const res = await axios.get(`${API}/desa?kecamatan_id=${item.kecamatan_id}`);
      const data = res.data?.data || res.data || [];

      setDesaList(
        Array.isArray(data)
          ? data.filter((d) => String(d.kecamatan_id) === String(item.kecamatan_id))
          : []
      );
    } catch (err) {
      console.log("ERROR EDIT DESA:", err);
    }
  };

  // ================= DELETE =================
  const handleDelete = async (id) => {
    if (!confirm("Hapus data ini?")) return;

    try {
      await axios.delete(`${API}/lahan/${id}`);
      fetchLahan();
    } catch (err) {
      console.log("ERROR DELETE:", err);
    }
  };

  // ================= RESET =================
  const resetForm = () => {
    setForm({
      nama_lahan: "",
      kecamatan_id: "",
      desa_id: "",
      luas: "",
      varietas: "",
      foto: null,
      petani_id: localStorage.getItem("user_id") || "",
    });

    setEditId(null);
    setDesaList([]);
  };

  const varietasList = ["Inpari 32", "Ciherang", "IR64", "Mekongga"];

  // ================= UI =================
  return (
    <div className="page">
      <h2 className="title">🌾 GeoPanen - Lahan Petani</h2>

      {/* FORM */}
      <div className="card form">

        <input
          name="nama_lahan"
          value={form.nama_lahan}
          onChange={handleChange}
          placeholder="Nama Lahan"
        />

        <select value={form.kecamatan_id} onChange={handleKecamatanChange}>
          <option value="">Pilih Kecamatan</option>
          {kecamatanList.map((k) => (
            <option key={k.id} value={k.id}>
              {k.nama_kecamatan}
            </option>
          ))}
        </select>

        <select
          value={form.desa_id}
          onChange={(e) =>
            setForm((p) => ({ ...p, desa_id: e.target.value }))
          }
        >
          <option value="">Pilih Desa</option>
          {desaList.length === 0 ? (
            <option disabled>-- kosong --</option>
          ) : (
            desaList.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nama_desa}
              </option>
            ))
          )}
        </select>

        <input
          name="luas"
          value={form.luas}
          onChange={handleChange}
          placeholder="Luas (m²)"
        />

        <select
          value={form.varietas}
          onChange={(e) =>
            setForm((p) => ({ ...p, varietas: e.target.value }))
          }
        >
          <option value="">Varietas</option>
          {varietasList.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>

        <input
          type="file"
          onChange={(e) =>
            setForm((p) => ({ ...p, foto: e.target.files[0] }))
          }
        />

        <button className="btn" onClick={handleSubmit}>
          {loading ? "Loading..." : editId ? "Update" : "Simpan"}
        </button>
      </div>

      {/* TABLE */}
      <div className="card">
        <h3>Data Lahan</h3>

        <table className="table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Kecamatan</th>
              <th>Desa</th>
              <th>Luas m²</th>
              <th>Luas ha</th>
              <th>Foto</th>
              <th>Aksi</th>
            </tr>
          </thead>

          <tbody>
            {Array.isArray(lahanList) &&
              lahanList.map((l) => (
                <tr key={l.id}>
                  <td>{l.nama_lahan}</td>
                  <td>{l.nama_kecamatan}</td>
                  <td>{l.nama_desa}</td>
                  <td>{l.luas_m2}</td>
                  <td>{l.luas_ha}</td>

                  <td>
                    {l.foto_url ? (
                      <img src={l.foto_url} className="img" />
                    ) : (
                      "-"
                    )}
                  </td>

                  <td>
                    <button onClick={() => handleEdit(l)}>✏️</button>
                    <button onClick={() => handleDelete(l.id)}>🗑️</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* STYLE */}
      <style>{`
        .page{padding:20px;background:#f5f7fb;min-height:100vh;font-family:Arial;}
        .title{margin-bottom:15px;}
        .card{background:white;padding:15px;border-radius:12px;margin-bottom:20px;box-shadow:0 2px 10px rgba(0,0,0,0.06);}
        .form{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;}
        input,select{padding:10px;border:1px solid #ddd;border-radius:8px;}
        .btn{grid-column:span 2;padding:10px;background:#16a34a;color:white;border:none;border-radius:8px;}
        .table{width:100%;border-collapse:collapse;}
        .table th{background:#16a34a;color:white;padding:10px;}
        .table td{padding:10px;border-bottom:1px solid #eee;}
        .img{width:70px;height:50px;object-fit:cover;border-radius:6px;}
      `}</style>
    </div>
  );
}