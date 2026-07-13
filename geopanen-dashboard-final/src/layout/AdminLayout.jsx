import Sidebar from "../components/Sidebar";
import { Routes, Route } from "react-router-dom";

// pages admin
import DashboardAdmin from "../pages/admin/DashboardAdmin";
import DataPetani from "../pages/admin/DataPetani";
import DataLahan from "../pages/admin/DataLahan";
import DataKecamatan from "../pages/admin/DataKecamatan";
import DataCuaca from "../pages/admin/DataCuaca";
import PrediksiAdmin from "../pages/admin/PrediksiAdmin";
import DatasetAI from "../pages/admin/DatasetAI";
import RiwayatPrediksiAdmin from "../pages/admin/RiwayatPrediksiAdmin";
import StatistikAdmin from "../pages/admin/StatistikAdmin";
import LaporanPanenAdmin from "../pages/admin/LaporanPanenAdmin";

export default function AdminLayout() {
  return (
    <div style={styles.wrapper}>
      <Sidebar role="admin" />

      <div style={styles.content}>
        <Routes>

          {/* 🔥 FIX INI: HARUS INDEX BUKAN "/" */}
          <Route index element={<DashboardAdmin />} />

          <Route path="petani" element={<DataPetani />} />
          <Route path="lahan" element={<DataLahan />} />
          <Route path="kecamatan" element={<DataKecamatan />} />
          <Route path="cuaca" element={<DataCuaca />} />
          <Route path="prediksi" element={<PrediksiAdmin />} />
          <Route path="dataset" element={<DatasetAI />} />
          <Route path="riwayat" element={<RiwayatPrediksiAdmin />} />
          <Route path="statistik" element={<StatistikAdmin />} />
          <Route path="laporan" element={<LaporanPanenAdmin />} />

        </Routes>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    minHeight: "100vh",
    background: "#f5f6fa",
  },
  content: {
    flex: 1,
    padding: 20,
    overflow: "auto",
  },
};