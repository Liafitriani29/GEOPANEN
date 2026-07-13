import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import LandingPage from "./pages/LandingPage";

// LAYOUT
import AdminLayout from "./layout/AdminLayout";
import PetaniLayout from "./layout/PetaniLayout";
import PenyuluhLayout from "./layout/PenyuluhLayout";

// ADMIN
import DashboardAdmin from "./pages/admin/DashboardAdmin";
import DataPetani from "./pages/admin/DataPetani";
import DataLahan from "./pages/admin/DataLahan";
import DataKecamatan from "./pages/admin/DataKecamatan";
import DataCuaca from "./pages/admin/DataCuaca";
import PrediksiAdmin from "./pages/admin/PrediksiAdmin";
import DatasetAI from "./pages/admin/DatasetAI";
import RiwayatPrediksiAdmin from "./pages/admin/RiwayatPrediksiAdmin";
import StatistikAdmin from "./pages/admin/StatistikAdmin";
import LaporanPanenAdmin from "./pages/admin/LaporanPanenAdmin";

// PENYULUH
import DashboardPenyuluh from "./pages/penyuluh/DashboardPenyuluh";
import PetaBinaan from "./pages/penyuluh/PetaBinaan";
import DataPetaniBinaan from "./pages/penyuluh/DataPetaniBinaan";
import AnalisisProduksi from "./pages/penyuluh/AnalisisProduksi";
import AIRecommendation from "./pages/penyuluh/AIRecommendation";
import CatatanLapangan from "./pages/penyuluh/CatatanLapangan";
import NotifikasiPenyuluh from "./pages/penyuluh/NotifikasiPenyuluh";
import PenyuluhKonsultasi from "./pages/penyuluh/PenyuluhKonsultasi";
import KalenderPenyuluh from "./pages/penyuluh/KalenderPenyuluh";

// PETANI
import DashboardPetani from "./pages/petani/DashboardPetani";
import LahanSaya from "./pages/petani/LahanSaya";
import PetaLahan from "./pages/petani/PetaLahan";
import MonitoringTanaman from "./pages/petani/MonitoringTanaman";
import RiwayatPanen from "./pages/petani/RiwayatPanen";
import RekomendasiPupuk from "./pages/petani/RekomendasiPupuk";
import KalenderBudidaya from "./pages/petani/KalenderBudidaya";
import PrediksiPanen from "./pages/petani/PrediksiPanen";
import TambahLahan from "./pages/petani/TambahLahan";
import PetaniKonsultasi from "./pages/petani/PetaniKonsultasi";
import NotifikasiPetani from "./pages/petani/NotifikasiPetani";

// ===============================
// SESSION HELPER
// ===============================
const getSession = () => {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  return {
    token,
    role,
  };
};

// ===============================
// REDIRECT SESUAI ROLE
// ===============================
function RoleRedirect() {
  const { token, role } = getSession();

  if (!token || !role) {
    return <Navigate to="/login" replace />;
  }

  if (role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  if (role === "penyuluh") {
    return <Navigate to="/penyuluh" replace />;
  }

  if (role === "petani") {
    return <Navigate to="/petani" replace />;
  }

  localStorage.clear();
  sessionStorage.clear();

  return <Navigate to="/login" replace />;
}

// ===============================
// PROTECTED ROUTE
// ===============================
function ProtectedRoute({ role, children }) {
  const session = getSession();

  if (!session.token || !session.role) {
    return <Navigate to="/login" replace />;
  }

  if (session.role !== role) {
    return <RoleRedirect />;
  }

  return children;
}

// ===============================
// APP ROUTES
// ===============================
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ROOT PERTAMA KALI BUKA WEBSITE */}
        <Route path="/" element={<LandingPage />} />

        {/* LANDING PAGE */}
        <Route path="/landing" element={<LandingPage />} />

        {/* AUTH */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* AUTO REDIRECT SETELAH LOGIN */}
        <Route path="/home" element={<RoleRedirect />} />

        {/* ================= ADMIN ================= */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
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
        </Route>

        {/* ================= PENYULUH ================= */}
        <Route
          path="/penyuluh"
          element={
            <ProtectedRoute role="penyuluh">
              <PenyuluhLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPenyuluh />} />
          <Route path="peta" element={<PetaBinaan />} />
          <Route path="petani" element={<DataPetaniBinaan />} />
          <Route path="analisis" element={<AnalisisProduksi />} />
          <Route path="rekomendasi" element={<AIRecommendation />} />
          <Route path="catatan" element={<CatatanLapangan />} />
          <Route path="notifikasi" element={<NotifikasiPenyuluh />} />
          <Route path="konsultasi" element={<PenyuluhKonsultasi />} />
          <Route
  path="/penyuluh/kalender"
  element={<KalenderPenyuluh />}
/>
        </Route>

        {/* ================= PETANI ================= */}
        <Route
          path="/petani"
          element={
            <ProtectedRoute role="petani">
              <PetaniLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPetani />} />
          <Route path="peta-lahan" element={<PetaLahan />} />
          <Route path="lahan-saya" element={<LahanSaya />} />
          <Route path="monitoring" element={<MonitoringTanaman />} />
          <Route path="riwayat-panen" element={<RiwayatPanen />} />
          <Route path="rekomendasi-pupuk" element={<RekomendasiPupuk />} />
          <Route path="kalender" element={<KalenderBudidaya />} />
          <Route path="prediksi" element={<PrediksiPanen />} />
          <Route path="tambah-lahan" element={<TambahLahan />} />
          <Route path="konsultasi" element={<PetaniKonsultasi />} />
          <Route path="notifikasi" element={<NotifikasiPetani />} />
        </Route>

        {/* ROUTE LAMA PETANI */}
        <Route
          path="/petani/Dashboard-petani"
          element={<Navigate to="/petani" replace />}
        />

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}