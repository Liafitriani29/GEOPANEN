import { useNavigate } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Marker,
  Popup,
  ZoomControl,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const markerIcon = new L.Icon({
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const heroCenter = [-7.6818, 110.8175];

const sampleFields = [
  {
    name: "Sawah Timur",
    status: "Tinggi",
    color: "#22c55e",
    positions: [
      [-7.6798, 110.8145],
      [-7.6784, 110.8176],
      [-7.6811, 110.8191],
      [-7.6825, 110.8158],
    ],
  },
  {
    name: "Sawah Barat",
    status: "Sedang",
    color: "#eab308",
    positions: [
      [-7.6787, 110.8181],
      [-7.6776, 110.8214],
      [-7.6804, 110.8227],
      [-7.6812, 110.8193],
    ],
  },
  {
    name: "Sawah Selatan",
    status: "Rendah",
    color: "#f97316",
    positions: [
      [-7.6814, 110.8197],
      [-7.6807, 110.8228],
      [-7.6837, 110.8236],
      [-7.6846, 110.8204],
    ],
  },
  {
    name: "Sawah Utara",
    status: "Sangat Tinggi",
    color: "#16a34a",
    positions: [
      [-7.6818, 110.8152],
      [-7.6811, 110.8189],
      [-7.6842, 110.8195],
      [-7.6849, 110.8161],
    ],
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  const goLogin = () => navigate("/login");
  const goRegister = () => navigate("/register");

  return (
    <div className="landing-page">
      {/* NAVBAR */}
      <header className="navbar">
        <div className="nav-container">
          <button className="brand" onClick={() => navigate("/")}>
            <div className="brand-icon">🌱</div>
            <div>
              <h1>GeoPanen</h1>
              <p>AI Smart Farming</p>
            </div>
          </button>

          <nav className="nav-menu">
            <a href="#beranda" className="active">
              Beranda
            </a>
            <a href="#fitur">Fitur</a>
            <a href="#akurasi">Akurasi & Data</a>
            <a href="#cara-kerja">Cara Kerja</a>
            <a href="#tentang">Tentang</a>
            <a href="#kontak">Kontak</a>
          </nav>

          <div className="nav-actions">
            <button className="btn btn-outline" onClick={goLogin}>
              Login
            </button>
            <button className="btn btn-green" onClick={goRegister}>
              Daftar Petani
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="hero" id="beranda">
        <div className="hero-container">
          <div className="hero-content">
            <span className="hero-label">GeoPanen</span>

            <h2>
              Prediksi Panen Akurat,
              <br />
              Berdasarkan <span>Data Nyata</span>
            </h2>

            <p>
              GeoPanen menggunakan data resmi BPS, cuaca BMKG, dan teknologi AI
              untuk memberikan prediksi panen yang akurat, objektif, dan dapat
              diandalkan.
            </p>

            <div className="hero-actions">
              <button className="hero-btn primary" onClick={goLogin}>
                ⟳ Mulai Sekarang
              </button>

              <button
                className="hero-btn secondary"
                onClick={() =>
                  window.scrollTo({
                    top: 720,
                    behavior: "smooth",
                  })
                }
              >
                ▶ Lihat Demo
              </button>
            </div>

            <div className="hero-benefits">
              <div className="benefit-item">
                <span className="benefit-icon">🛡️</span>
                <div className="benefit-text">
                  <strong>Akurat</strong>
                  <small>Prediksi berbasis data nyata & AI</small>
                </div>
              </div>

              <div className="benefit-item">
                <span className="benefit-icon">🏛️</span>
                <div className="benefit-text">
                  <strong>Terpercaya</strong>
                  <small>Sumber data resmi BPS & BMKG</small>
                </div>
              </div>

              <div className="benefit-item">
                <span className="benefit-icon">🧭</span>
                <div className="benefit-text">
                  <strong>Mudah Digunakan</strong>
                  <small>Dashboard sederhana untuk petani</small>
                </div>
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="stats-panel">
              <InfoMini title="Prediksi Panen" value="6.78 Ton/Ha" icon="📊" />
              <InfoMini title="Akurasi Model AI" value="92.4%" />
              <InfoMini
                title="Produksi Kabupaten Magetan 2023 (BPS)"
                value="315.208 Ton"
              />
              <InfoMini
                title="Produktivitas Rata-rata Kab. Magetan (BPS)"
                value="5.62 Ton/Ha"
              />
              <InfoMini title="Data Terakhir Diperbarui" value="23 Juni 2026" />
            </div>

            <HeroSatelliteMap />
          </div>
        </div>
      </section>

      {/* AKURASI */}
      <section className="accuracy-section" id="akurasi">
        <div className="accuracy-card">
          <div className="accuracy-left">
            <h3>
              Mengapa <span>GeoPanen Akurat?</span>
            </h3>

            <p>
              Kami memastikan setiap prediksi didukung oleh data resmi dan model
              AI terbaik.
            </p>

            <div className="accuracy-number">
              92.4% <small>Akurasi Model AI</small>
            </div>

            <p className="muted">
              Diuji menggunakan data panen aktual 3 tahun terakhir dari BPS.
            </p>
          </div>

          <div className="source-data">
            <h3>Sumber Data Resmi</h3>

            <div className="source-grid">
              <SourceCard
                logo="📊"
                title="BPS"
                desc="Badan Pusat Statistik"
                sub="Data Produksi & Luas Panen"
              />

              <SourceCard
                logo="🌦️"
                title="BMKG"
                desc="Badan Meteorologi, Klimatologi, dan Geofisika"
                sub="Data Cuaca"
              />

              <SourceCard
                logo="🌐"
                title="BIG"
                desc="Badan Informasi Geospasial"
                sub="Data Peta & Lahan"
              />
            </div>
          </div>

          <div className="used-data">
            <h3>Data yang Digunakan</h3>

            <ul>
              <li>Produksi Padi per Kabupaten (BPS)</li>
              <li>Luas Panen per Kecamatan (BPS)</li>
              <li>Produktivitas Padi (Ton/Ha) (BPS)</li>
              <li>Curah Hujan Harian (BMKG)</li>
              <li>Suhu & Kelembapan (BMKG)</li>
              <li>Peta Lahan & Tutupan Lahan (BIG)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* FITUR */}
      <section className="features-section" id="fitur">
        <SectionTitle title="Fitur Utama" green="GeoPanen" />

        <div className="feature-grid">
          <FeatureCard
            icon="🛰️"
            title="GIS Monitoring Lahan"
            desc="Pantau kondisi lahan melalui peta interaktif berbasis GIS secara real-time."
          />

          <FeatureCard
            icon="📈"
            title="Prediksi Panen AI"
            desc="Prediksi hasil panen akurat berdasarkan data BPS, cuaca, dan riwayat lahan."
          />

          <FeatureCard
            icon="🧪"
            title="Rekomendasi Pupuk"
            desc="Rekomendasi pemupukan berdasarkan fase tanaman dan kondisi tanah."
          />

          <FeatureCard
            icon="📅"
            title="Kalender Budidaya"
            desc="Kelola jadwal kegiatan pertanian mulai dari tanam hingga panen."
          />

          <FeatureCard
            icon="☀️"
            title="Deteksi Risiko Hama"
            desc="Analisis risiko hama berdasarkan cuaca dan kondisi lahan."
          />

          <FeatureCard
            icon="👨‍🌾"
            title="Konsultasi Penyuluh"
            desc="Konsultasi langsung dengan penyuluh pertanian berpengalaman."
          />
        </div>
      </section>

      {/* CARA KERJA */}
      <section className="workflow-section" id="cara-kerja">
        <SectionTitle title="Cara Kerja" green="GeoPanen" />

        <div className="workflow">
          <Step
            icon="🌾"
            no="1"
            title="Input & Data Lahan"
            desc="Petani mendaftarkan lahan dan data awal tanaman."
          />
          <Arrow />
          <Step
            icon="🔗"
            no="2"
            title="Pengambilan Data"
            desc="Sistem mengambil data dari BPS, BMKG, dan BIG secara otomatis."
          />
          <Arrow />
          <Step
            icon="🧠"
            no="3"
            title="Analisis AI"
            desc="AI menganalisis data historis, kondisi lahan, cuaca, dan pola produksi."
          />
          <Arrow />
          <Step
            icon="📋"
            no="4"
            title="Prediksi & Rekomendasi"
            desc="Petani menerima prediksi panen serta rekomendasi budidaya yang tepat."
          />
          <Arrow />
          <Step
            icon="🌱"
            no="5"
            title="Panen Optimal"
            desc="Hasil panen meningkat berdasarkan keputusan berbasis data."
          />
        </div>
      </section>

      {/* DEMO DASHBOARD */}
      <section className="demo-section" id="tentang">
        <div className="demo-grid">
          <div className="demo-card">
            <h3>Bukti Akurasi</h3>
            <p>Perbandingan Prediksi AI vs Data Aktual (BPS)</p>

            <div className="bar-chart">
              <Bar year="2021" ai="5.21" bps="5.18" h1={62} h2={60} />
              <Bar year="2022" ai="5.63" bps="5.58" h1={75} h2={72} />
              <Bar year="2023" ai="5.79" bps="5.62" h1={82} h2={76} />
            </div>
          </div>

          <div className="dashboard-preview-card">
            <h3>
              Intip <span>Dashboard Petani</span>
            </h3>

            <DashboardPreview />
          </div>

          <div className="bps-card">
            <h3>
              Menggunakan Data <span>BPS</span>
            </h3>

            <ul>
              <li>Data produksi padi per tahun</li>
              <li>Data luas panen per kecamatan</li>
              <li>Produktivitas padi (Ton/Ha)</li>
              <li>Data historis 3 tahun terakhir</li>
              <li>Diperbarui setiap tahun</li>
            </ul>

            <div className="bps-logo">📊 BADAN PUSAT STATISTIK</div>
          </div>
        </div>
      </section>

      {/* TESTIMONI */}
      <section className="testimoni-section">
        <SectionTitle title="Apa Kata" green="Petani?" />

        <div className="testimoni-grid">
          <Testimoni
            name="Budi Santoso"
            place="Petani Padi, Baki"
            text="Prediksi panen GeoPanen sangat membantu saya merencanakan penjualan dan kebutuhan pupuk."
          />

          <Testimoni
            name="Slamet Widodo"
            place="Petani Padi, Sukoharjo"
            text="Data dari BPS bikin hasil prediksi lebih akurat dan bisa dipercaya."
          />

          <Testimoni
            name="Siti Aminah"
            place="Petani Padi, Grogol"
            text="Aplikasi ini mudah digunakan dan informasinya sangat lengkap."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="cta-content">
          <div className="farmer-illustration">👨‍🌾📱</div>

          <div>
            <h2>Gunakan Data Nyata, Panen Lebih Pasti</h2>
            <p>
              Bergabung dengan ratusan petani yang sudah merasakan manfaat
              GeoPanen.
            </p>
          </div>

          <div className="cta-actions">
            <button className="btn-white" onClick={goLogin}>
              Login
            </button>

            <button className="btn-bright" onClick={goRegister}>
              Daftar Sekarang
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer" id="kontak">
        <div className="footer-grid">
          <div>
            <div className="footer-brand">
              <div className="brand-icon">🌱</div>
              <div>
                <h3>GeoPanen</h3>
                <p>AI Smart Farming</p>
              </div>
            </div>

            <p className="footer-desc">
              Platform pertanian cerdas berbasis GIS & AI yang menggunakan data
              resmi BPS dan BMKG untuk prediksi panen yang akurat.
            </p>

            <div className="socials">
              <span>●</span>
              <span>◎</span>
              <span>▣</span>
            </div>
          </div>

          <FooterCol
            title="Menu"
            items={[
              "Beranda",
              "Fitur",
              "Akurasi & Data",
              "Cara Kerja",
              "Tentang",
              "Kontak",
            ]}
          />

          <FooterCol
            title="Fitur"
            items={[
              "Peta Lahan",
              "Prediksi Panen",
              "Rekomendasi Pupuk",
              "Deteksi Hama",
              "Kalender Budidaya",
              "Konsultasi Penyuluh",
            ]}
          />

          <FooterCol
            title="Sumber Data"
            items={[
              "BPS (Badan Pusat Statistik)",
              "BMKG (Cuaca)",
              "BIG (Peta & Lahan)",
            ]}
          />

          <div>
            <h4>Hubungi Kami</h4>
            <p>📞 +62 812-3456-7890</p>
            <p>✉️ info@geopanen.id</p>
            <p>📍 Sukoharjo, Jawa Tengah, Indonesia</p>
          </div>
        </div>

        <div className="copyright">© 2026 GeoPanen. All rights reserved.</div>
      </footer>

      <style>{`
        * {
          box-sizing: border-box;
        }

        html {
          scroll-behavior: smooth;
        }

        body {
          margin: 0;
        }

        .landing-page {
          width: 100%;
          min-height: 100vh;
          background: #f8fafc;
          color: #0f172a;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .navbar {
          position: sticky;
          top: 0;
          z-index: 1000;
          background: rgba(255, 255, 255, 0.94);
          backdrop-filter: blur(16px);
          border-bottom: 1px solid #e5e7eb;
        }

        .nav-container {
          width: min(1440px, calc(100% - 64px));
          margin: 0 auto;
          height: 78px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 28px;
        }

        .brand {
          border: none;
          background: transparent;
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          padding: 0;
        }

        .brand-icon {
          width: 48px;
          height: 48px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          background: #dcfce7;
          color: #047857;
        }

        .brand h1,
        .footer-brand h3 {
          margin: 0;
          font-size: 25px;
          font-weight: 900;
          color: #0f3f2e;
          letter-spacing: -0.6px;
        }

        .brand p,
        .footer-brand p {
          margin: 2px 0 0;
          color: #64748b;
          font-size: 13px;
          text-align: left;
        }

        .nav-menu {
          display: flex;
          align-items: center;
          gap: 42px;
        }

        .nav-menu a {
          color: #0f172a;
          text-decoration: none;
          font-weight: 800;
          font-size: 14px;
        }

        .nav-menu a.active,
        .nav-menu a:hover {
          color: #16a34a;
        }

        .nav-actions {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .btn {
          height: 42px;
          border-radius: 8px;
          padding: 0 26px;
          font-weight: 800;
          cursor: pointer;
          border: 1px solid #cbd5e1;
          background: #ffffff;
        }

        .btn-green {
          background: #059669;
          color: #ffffff;
          border-color: #059669;
        }

        .btn-outline {
          color: #0f172a;
        }

        .hero {
          position: relative;
          min-height: 555px;
          background:
            linear-gradient(90deg, rgba(4, 47, 46, .96), rgba(6, 78, 59, .8), rgba(75, 124, 46, .42)),
            radial-gradient(circle at 80% 20%, rgba(132,204,22,.24), transparent 35%),
            linear-gradient(135deg, #064e3b, #0f766e 42%, #84cc16);
          overflow: hidden;
        }

        .hero::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(135deg, rgba(255,255,255,.08) 25%, transparent 25%),
            linear-gradient(225deg, rgba(255,255,255,.06) 25%, transparent 25%);
          background-size: 72px 72px;
          opacity: .45;
        }

        .hero-container {
          position: relative;
          z-index: 2;
          width: min(1440px, calc(100% - 64px));
          min-height: 555px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 1.18fr;
          align-items: center;
          gap: 56px;
          padding: 48px 0;
        }

        .hero-label {
          color: white;
          font-size: 33px;
          font-weight: 900;
          display: block;
          margin-bottom: 12px;
        }

        .hero-content h2 {
          margin: 0;
          color: white;
          font-size: clamp(40px, 4vw, 62px);
          line-height: 1.07;
          font-weight: 950;
          letter-spacing: -1.4px;
        }

        .hero-content h2 span {
          color: #4ade80;
        }

        .hero-content p {
          color: #f0fdf4;
          font-size: 18px;
          line-height: 1.6;
          max-width: 680px;
          margin: 22px 0 0;
        }

        .hero-actions {
          display: flex;
          gap: 18px;
          margin-top: 28px;
        }

        .hero-btn {
          height: 52px;
          border-radius: 12px;
          padding: 0 32px;
          border: none;
          font-weight: 900;
          font-size: 15px;
          cursor: pointer;
        }

        .hero-btn.primary {
          background: #16a34a;
          color: #ffffff;
          box-shadow: 0 20px 35px rgba(22, 163, 74, .28);
        }

        .hero-btn.secondary {
          background: #ffffff;
          color: #047857;
        }

        .hero-benefits {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-top: 34px;
          max-width: 760px;
        }

        .benefit-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          min-height: 72px;
          padding: 12px 14px;
          color: #ffffff;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.11);
          border: 1px solid rgba(255, 255, 255, 0.18);
          box-shadow: 0 14px 28px rgba(0, 0, 0, 0.12);
          backdrop-filter: blur(10px);
        }

        .benefit-icon {
          flex: 0 0 34px;
          width: 34px;
          height: 34px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.16);
          font-size: 17px;
          line-height: 1;
        }

        .benefit-text {
          min-width: 0;
        }

        .benefit-text strong {
          display: block;
          margin: 0 0 4px;
          font-size: 14px;
          line-height: 1.2;
          font-weight: 900;
          color: #ffffff;
          white-space: nowrap;
        }

        .benefit-text small {
          display: block;
          margin: 0;
          font-size: 11.5px;
          opacity: .92;
          line-height: 1.35;
          color: #ecfdf5;
        }

        .hero-visual {
          height: 410px;
          position: relative;
          border-radius: 22px;
          background: rgba(255,255,255,.78);
          padding: 10px;
          box-shadow: 0 28px 75px rgba(0,0,0,.34);
          display: grid;
          grid-template-columns: 230px 1fr;
          gap: 10px;
        }

        .stats-panel {
          display: grid;
          gap: 12px;
        }

        .info-mini {
          background: rgba(255,255,255,.9);
          border: 1px solid rgba(255,255,255,.65);
          border-radius: 14px;
          padding: 14px;
          box-shadow: 0 8px 20px rgba(15,23,42,.06);
        }

        .info-mini span {
          font-size: 26px;
        }

        .info-mini small {
          display: block;
          color: #64748b;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .info-mini b {
          font-size: 17px;
          color: #0f172a;
        }

        .map-demo {
          position: relative;
          overflow: hidden;
          border-radius: 16px;
          background: #052e16;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.4);
        }

        .map-demo .leaflet-container {
          width: 100%;
          height: 100%;
          min-height: 390px;
          border-radius: 16px;
          background: #052e16;
        }

        .map-demo .leaflet-control-attribution {
          font-size: 9px;
          background: rgba(255,255,255,.75);
        }

        .map-demo .leaflet-control-zoom {
          border: none;
          box-shadow: 0 10px 24px rgba(15,23,42,.25);
        }

        .map-demo .leaflet-control-zoom a {
          width: 32px;
          height: 32px;
          line-height: 32px;
          color: #0f172a;
          font-weight: 900;
        }

        .satellite-overlay {
          position: absolute;
          inset: 0;
          z-index: 450;
          pointer-events: none;
          background:
            linear-gradient(90deg, rgba(5,46,22,.12), transparent 45%, rgba(250,204,21,.05)),
            radial-gradient(circle at 50% 45%, transparent 0 35%, rgba(0,0,0,.08) 100%);
        }

        .map-legend {
          position: absolute;
          left: 18px;
          bottom: 22px;
          z-index: 500;
          background: rgba(255,255,255,.94);
          border-radius: 12px;
          padding: 13px 16px;
          box-shadow: 0 12px 28px rgba(15,23,42,.22);
          backdrop-filter: blur(8px);
        }

        .map-legend b {
          font-size: 12px;
          display: block;
          margin-bottom: 9px;
        }

        .legend-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 6px 0;
          font-size: 12px;
        }

        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
        }

        .map-card {
          position: absolute;
          right: 58px;
          top: 145px;
          z-index: 500;
          background: rgba(255,255,255,.95);
          border-radius: 12px;
          padding: 14px;
          width: 155px;
          box-shadow: 0 12px 26px rgba(15,23,42,.25);
          backdrop-filter: blur(8px);
        }

        .map-card h4 {
          margin: 0 0 9px;
          font-size: 14px;
          color: #0f172a;
        }

        .map-card p {
          margin: 5px 0;
          font-size: 12px;
          color: #334155;
        }

        .map-card button {
          border: none;
          background: transparent;
          color: #047857;
          font-weight: 900;
          cursor: pointer;
          padding: 4px 0 0;
        }

        .accuracy-section,
        .features-section,
        .workflow-section,
        .demo-section,
        .testimoni-section,
        .cta-section {
          width: min(1440px, calc(100% - 64px));
          margin: 0 auto;
        }

        .accuracy-section {
          padding: 28px 0 18px;
        }

        .accuracy-card {
          display: grid;
          grid-template-columns: 1fr 1.35fr 1fr;
          gap: 34px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 18px;
          box-shadow: 0 14px 35px rgba(15,23,42,.07);
          padding: 30px;
        }

        .accuracy-card h3,
        .source-data h3,
        .used-data h3 {
          margin: 0 0 14px;
          font-size: 21px;
        }

        .accuracy-card h3 span,
        .section-title span,
        .dashboard-preview-card h3 span,
        .bps-card h3 span {
          color: #059669;
        }

        .accuracy-card p {
          color: #64748b;
          line-height: 1.5;
          margin: 0;
        }

        .accuracy-number {
          color: #059669;
          font-size: 48px;
          font-weight: 950;
          margin: 25px 0 10px;
        }

        .accuracy-number small {
          color: #0f172a;
          font-size: 15px;
          margin-left: 8px;
        }

        .source-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }

        .source-card {
          text-align: center;
          padding: 15px;
        }

        .source-card .logo {
          font-size: 42px;
          margin-bottom: 8px;
        }

        .source-card b {
          display: block;
          font-size: 18px;
          margin-bottom: 5px;
        }

        .source-card p {
          font-size: 12px;
          color: #334155;
        }

        .source-card small {
          color: #64748b;
          font-size: 11px;
        }

        .used-data {
          border-left: 1px solid #e5e7eb;
          padding-left: 30px;
        }

        .used-data ul,
        .bps-card ul {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 12px;
        }

        .used-data li,
        .bps-card li {
          font-size: 14px;
          color: #334155;
        }

        .used-data li::before,
        .bps-card li::before {
          content: "✓";
          color: #059669;
          font-weight: 900;
          margin-right: 9px;
        }

        .features-section,
        .workflow-section,
        .demo-section,
        .testimoni-section {
          padding: 20px 0;
        }

        .section-title {
          text-align: center;
          margin: 0 0 25px;
          font-size: 28px;
          font-weight: 950;
        }

        .feature-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 18px;
        }

        .feature-card,
        .demo-card,
        .dashboard-preview-card,
        .bps-card,
        .testimoni-card {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          box-shadow: 0 12px 32px rgba(15,23,42,.06);
        }

        .feature-card {
          padding: 28px 20px;
          text-align: center;
        }

        .feature-icon {
          width: 72px;
          height: 72px;
          border-radius: 999px;
          background: #dcfce7;
          color: #047857;
          margin: 0 auto 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 35px;
        }

        .feature-card h3 {
          margin: 0 0 12px;
          font-size: 15px;
        }

        .feature-card p {
          color: #475569;
          font-size: 13px;
          line-height: 1.55;
          margin: 0;
        }

        .workflow {
          display: grid;
          grid-template-columns: 1fr 44px 1fr 44px 1fr 44px 1fr 44px 1fr;
          align-items: start;
          gap: 12px;
        }

        .step {
          text-align: center;
        }

        .step-icon {
          width: 76px;
          height: 76px;
          border-radius: 999px;
          background: #dcfce7;
          color: #047857;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 36px;
          margin: 0 auto 13px;
        }

        .step h3 {
          margin: 0 0 7px;
          font-size: 15px;
        }

        .step p {
          margin: 0;
          color: #475569;
          font-size: 13px;
          line-height: 1.5;
        }

        .arrow {
          color: #cbd5e1;
          font-size: 45px;
          padding-top: 18px;
          text-align: center;
        }

        .demo-grid {
          display: grid;
          grid-template-columns: 1fr 1.55fr 1fr;
          gap: 18px;
          align-items: stretch;
        }

        .demo-card,
        .dashboard-preview-card,
        .bps-card {
          padding: 24px;
        }

        .demo-card h3,
        .dashboard-preview-card h3,
        .bps-card h3 {
          margin: 0 0 14px;
          font-size: 22px;
        }

        .demo-card p {
          color: #475569;
          font-size: 13px;
          margin-bottom: 18px;
        }

        .bar-chart {
          height: 245px;
          display: flex;
          align-items: end;
          justify-content: center;
          gap: 34px;
          border-left: 1px solid #e5e7eb;
          border-bottom: 1px solid #e5e7eb;
          padding-left: 20px;
        }

        .bar-group {
          display: flex;
          align-items: end;
          gap: 9px;
          position: relative;
        }

        .bar {
          width: 30px;
          border-radius: 6px 6px 0 0;
        }

        .bar.ai {
          background: #16a34a;
        }

        .bar.bps {
          background: #d1d5db;
        }

        .bar-label {
          position: absolute;
          top: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          font-size: 12px;
          color: #475569;
        }

        .dashboard-preview-card {
          text-align: center;
          padding-bottom: 10px;
        }

        .dashboard-device {
          width: 100%;
          max-width: 620px;
          margin: 10px auto 0;
        }

        .dashboard-laptop-frame {
          background: #111827;
          border-radius: 18px;
          padding: 10px;
          box-shadow: 0 24px 45px rgba(15, 23, 42, 0.28);
        }

        .dashboard-screen {
          height: 275px;
          border-radius: 12px;
          overflow: hidden;
          background: #f1f5f9;
          display: grid;
          grid-template-columns: 92px 1fr;
        }

        .dash-sidebar {
          background: linear-gradient(180deg, #064e3b, #052e16);
          padding: 10px 8px;
          color: #ffffff;
          text-align: left;
        }

        .dash-logo {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 9px;
          font-weight: 900;
          margin-bottom: 14px;
        }

        .dash-logo-icon {
          width: 20px;
          height: 20px;
          border-radius: 7px;
          background: #16a34a;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
        }

        .dash-menu {
          display: grid;
          gap: 7px;
        }

        .dash-menu-item {
          height: 14px;
          border-radius: 5px;
          background: rgba(255, 255, 255, 0.13);
        }

        .dash-menu-item.active {
          background: #16a34a;
        }

        .dash-profile {
          margin-top: 56px;
          height: 28px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.12);
        }

        .dash-main {
          padding: 12px;
          text-align: left;
          overflow: hidden;
        }

        .dash-topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .dash-title h4 {
          margin: 0;
          font-size: 12px;
          font-weight: 950;
          color: #0f172a;
        }

        .dash-title p {
          margin: 3px 0 0;
          font-size: 6px;
          color: #64748b;
        }

        .dash-weather {
          width: 70px;
          height: 24px;
          border-radius: 7px;
          background: #ffffff;
          box-shadow: 0 4px 10px rgba(15,23,42,.08);
        }

        .dash-kpi-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 6px;
          margin-bottom: 9px;
        }

        .dash-kpi {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 6px;
          min-height: 39px;
        }

        .dash-kpi-icon {
          width: 14px;
          height: 14px;
          border-radius: 5px;
          background: #dcfce7;
          color: #16a34a;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 8px;
          margin-bottom: 4px;
        }

        .dash-kpi b {
          display: block;
          font-size: 9px;
          line-height: 1;
          color: #0f172a;
        }

        .dash-kpi span {
          display: block;
          margin-top: 3px;
          font-size: 5.5px;
          color: #64748b;
        }

        .dash-content-grid {
          display: grid;
          grid-template-columns: 1.55fr .9fr .8fr;
          gap: 8px;
        }

        .dash-map-card,
        .dash-list-card,
        .dash-side-card,
        .dash-chart-card,
        .dash-nutrient-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
          padding: 7px;
          box-shadow: 0 5px 12px rgba(15,23,42,.04);
        }

        .dash-map-card {
          height: 120px;
          position: relative;
          overflow: hidden;
        }

        .dash-mini-map {
          position: absolute;
          inset: 22px 7px 7px;
          border-radius: 8px;
          overflow: hidden;
          background:
            linear-gradient(rgba(0,0,0,.05), rgba(0,0,0,.05)),
            linear-gradient(135deg, #166534, #84cc16 35%, #eab308 60%, #f97316);
        }

        .dash-mini-map::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(45deg, rgba(255,255,255,.18) 25%, transparent 25%),
            linear-gradient(135deg, rgba(255,255,255,.12) 25%, transparent 25%);
          background-size: 18px 18px;
          opacity: .55;
        }

        .dash-field {
          position: absolute;
          border: 1px solid rgba(255,255,255,.8);
          transform: rotate(8deg);
          opacity: .85;
        }

        .dash-field.one {
          width: 96px;
          height: 38px;
          left: 35px;
          top: 11px;
          background: rgba(34,197,94,.7);
        }

        .dash-field.two {
          width: 95px;
          height: 42px;
          left: 122px;
          top: 16px;
          background: rgba(234,179,8,.65);
        }

        .dash-field.three {
          width: 105px;
          height: 45px;
          left: 71px;
          top: 58px;
          background: rgba(22,163,74,.66);
        }

        .dash-field.four {
          width: 105px;
          height: 45px;
          left: 178px;
          top: 60px;
          background: rgba(249,115,22,.72);
        }

        .dash-pin {
          position: absolute;
          left: 174px;
          top: 57px;
          width: 15px;
          height: 15px;
          border-radius: 999px;
          background: #eab308;
          border: 2px solid #ffffff;
          box-shadow: 0 3px 10px rgba(0,0,0,.25);
          z-index: 4;
        }

        .dash-map-info {
          position: absolute;
          right: 8px;
          top: 31px;
          width: 72px;
          background: rgba(255,255,255,.92);
          border-radius: 8px;
          padding: 6px;
          z-index: 5;
          box-shadow: 0 5px 14px rgba(15,23,42,.16);
        }

        .dash-map-info b {
          font-size: 7px;
        }

        .dash-map-info p {
          margin: 3px 0;
          font-size: 5.4px;
          color: #334155;
        }

        .dash-list-card {
          height: 120px;
        }

        .dash-card-title {
          margin: 0 0 7px;
          font-size: 8px;
          font-weight: 900;
          color: #0f172a;
        }

        .dash-land-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 5px;
          padding: 6px 0;
          border-bottom: 1px solid #f1f5f9;
        }

        .dash-land-left {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .dash-dot {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: #eab308;
        }

        .dash-land-row b {
          display: block;
          font-size: 6.5px;
        }

        .dash-land-row small {
          display: block;
          font-size: 5.2px;
          color: #64748b;
        }

        .dash-badge {
          border-radius: 999px;
          background: #fef3c7;
          color: #b45309;
          padding: 2px 5px;
          font-size: 5px;
          font-weight: 900;
        }

        .dash-side-card {
          height: 120px;
        }

        .dash-weather-big {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 3px 0 7px;
        }

        .dash-weather-icon {
          width: 30px;
          height: 30px;
          border-radius: 9px;
          background: #eff6ff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
        }

        .dash-weather-big b {
          display: block;
          font-size: 15px;
        }

        .dash-weather-big small {
          color: #64748b;
          font-size: 5.5px;
        }

        .dash-weather-line {
          border-top: 1px solid #e5e7eb;
          padding-top: 6px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 5px;
          font-size: 6px;
          color: #64748b;
        }

        .dash-weather-line b {
          display: block;
          color: #0f172a;
          font-size: 8px;
          margin-top: 2px;
        }

        .dash-bottom-grid {
          grid-column: 1 / -1;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 8px;
          margin-top: 8px;
        }

        .dash-chart-card,
        .dash-nutrient-card {
          height: 72px;
          overflow: hidden;
        }

        .dash-line-chart {
          height: 38px;
          margin-top: 8px;
          background:
            linear-gradient(to top, rgba(22,163,74,.12), transparent),
            linear-gradient(160deg, transparent 45%, #16a34a 46%, #16a34a 48%, transparent 49%);
          border-left: 1px solid #e5e7eb;
          border-bottom: 1px solid #e5e7eb;
        }

        .dash-nutrient-row {
          margin: 5px 0;
        }

        .dash-nutrient-row span {
          display: block;
          font-size: 5.5px;
          margin-bottom: 2px;
        }

        .dash-progress {
          height: 4px;
          background: #e5e7eb;
          border-radius: 999px;
          overflow: hidden;
        }

        .dash-progress i {
          display: block;
          height: 100%;
          border-radius: 999px;
        }

        .dash-progress.green i {
          width: 90%;
          background: #16a34a;
        }

        .dash-progress.orange i {
          width: 60%;
          background: #f97316;
        }

        .dash-progress.blue i {
          width: 75%;
          background: #2563eb;
        }

        .dash-activity-card {
          height: 72px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 9px;
          padding: 7px;
        }

        .dash-activity-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 5.7px;
          padding: 4px 0;
          border-bottom: 1px solid #f1f5f9;
        }

        .dash-activity-row b {
          font-size: 6.2px;
        }

        .dashboard-base {
          width: 78%;
          height: 17px;
          margin: 0 auto;
          background: linear-gradient(#cbd5e1, #94a3b8);
          border-radius: 0 0 22px 22px;
          box-shadow: 0 12px 24px rgba(15,23,42,.17);
        }

        .dashboard-shadow {
          width: 62%;
          height: 13px;
          margin: -2px auto 0;
          background: rgba(15, 23, 42, 0.09);
          filter: blur(8px);
          border-radius: 999px;
        }

        .bps-card {
          background: #f0fdf4;
        }

        .bps-logo {
          margin-top: 24px;
          font-size: 22px;
          color: #0369a1;
          font-weight: 900;
        }

        .testimoni-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
        }

        .testimoni-card {
          padding: 24px;
        }

        .stars {
          color: #facc15;
          font-size: 18px;
          margin-bottom: 10px;
        }

        .testimoni-card blockquote {
          margin: 0 0 20px;
          color: #475569;
          font-style: italic;
          line-height: 1.55;
        }

        .person {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .person-avatar {
          width: 45px;
          height: 45px;
          border-radius: 999px;
          background: #dcfce7;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 25px;
        }

        .person b,
        .person small {
          display: block;
        }

        .person small {
          color: #64748b;
        }

        .cta-section {
          padding: 0 0 28px;
        }

        .cta-content {
          background: linear-gradient(135deg, #047857, #065f46, #064e3b);
          color: white;
          border-radius: 18px;
          min-height: 120px;
          display: grid;
          grid-template-columns: 230px 1fr auto;
          gap: 28px;
          align-items: center;
          padding: 22px 34px;
          overflow: hidden;
        }

        .farmer-illustration {
          font-size: 70px;
        }

        .cta-content h2 {
          margin: 0 0 8px;
          font-size: 33px;
          font-weight: 950;
        }

        .cta-content p {
          margin: 0;
          color: #dcfce7;
          font-size: 17px;
        }

        .cta-actions {
          display: flex;
          gap: 18px;
        }

        .btn-white,
        .btn-bright {
          height: 52px;
          border: none;
          border-radius: 10px;
          padding: 0 44px;
          font-weight: 900;
          cursor: pointer;
          font-size: 15px;
        }

        .btn-white {
          background: white;
          color: #047857;
        }

        .btn-bright {
          background: #22c55e;
          color: white;
        }

        .footer {
          background: #064e3b;
          color: white;
          padding: 34px 0 14px;
        }

        .footer-grid {
          width: min(1440px, calc(100% - 64px));
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1.5fr .7fr .9fr .9fr 1.1fr;
          gap: 40px;
        }

        .footer-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .footer-brand h3 {
          color: white;
        }

        .footer-brand p {
          color: #bbf7d0;
        }

        .footer-desc {
          color: #d1fae5;
          line-height: 1.55;
          max-width: 360px;
          margin: 18px 0;
        }

        .socials {
          display: flex;
          gap: 14px;
        }

        .footer h4 {
          margin: 0 0 15px;
          font-size: 16px;
        }

        .footer a,
        .footer p {
          display: block;
          color: #d1fae5;
          text-decoration: none;
          margin: 8px 0;
          font-size: 14px;
        }

        .copyright {
          width: min(1440px, calc(100% - 64px));
          margin: 24px auto 0;
          border-top: 1px solid rgba(255,255,255,.15);
          padding-top: 14px;
          text-align: center;
          color: #bbf7d0;
          font-size: 13px;
        }

        @media (max-width: 1200px) {
          .nav-menu {
            display: none;
          }

          .hero-container {
            grid-template-columns: 1fr;
          }

          .hero-visual {
            max-width: 900px;
          }

          .feature-grid {
            grid-template-columns: repeat(3, 1fr);
          }

          .workflow {
            grid-template-columns: 1fr;
          }

          .arrow {
            display: none;
          }

          .demo-grid,
          .accuracy-card,
          .footer-grid {
            grid-template-columns: 1fr;
          }

          .used-data {
            border-left: none;
            padding-left: 0;
            border-top: 1px solid #e5e7eb;
            padding-top: 20px;
          }

          .dashboard-preview-card {
            max-width: 760px;
            margin: 0 auto;
            width: 100%;
          }
        }

        @media (max-width: 768px) {
          .nav-container,
          .hero-container,
          .accuracy-section,
          .features-section,
          .workflow-section,
          .demo-section,
          .testimoni-section,
          .cta-section,
          .footer-grid,
          .copyright {
            width: min(100% - 28px, 1440px);
          }

          .nav-actions {
            display: none;
          }

          .hero-content h2 {
            font-size: 38px;
          }

          .hero-benefits,
          .source-grid,
          .feature-grid,
          .testimoni-grid,
          .cta-content {
            grid-template-columns: 1fr;
          }

          .hero-visual {
            grid-template-columns: 1fr;
            height: auto;
          }

          .map-demo {
            min-height: 360px;
          }

          .map-demo .leaflet-container {
            min-height: 360px;
          }

          .stats-panel {
            grid-template-columns: 1fr;
          }

          .cta-actions,
          .hero-actions {
            flex-direction: column;
          }

          .dashboard-screen {
            grid-template-columns: 72px 1fr;
            height: 250px;
          }

          .dash-content-grid {
            grid-template-columns: 1fr;
          }

          .dash-list-card,
          .dash-side-card,
          .dash-bottom-grid {
            display: none;
          }

          .dash-map-card {
            height: 150px;
          }
        }
      `}</style>
    </div>
  );
}

// =====================
// HERO SATELLITE MAP
// =====================
function HeroSatelliteMap() {
  return (
    <div className="map-demo">
      <MapContainer
        center={heroCenter}
        zoom={16}
        minZoom={14}
        maxZoom={19}
        zoomControl={false}
        attributionControl={true}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        touchZoom={false}
      >
        <TileLayer
          attribution="Tiles © Esri"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />

        <ZoomControl position="bottomright" />

        {sampleFields.map((field) => (
          <Polygon
            key={field.name}
            positions={field.positions}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: field.color,
              fillOpacity: 0.55,
            }}
          >
            <Popup>
              <b>{field.name}</b>
              <br />
              Status: {field.status}
            </Popup>
          </Polygon>
        ))}

        <Marker position={[-7.6812, 110.8191]} icon={markerIcon}>
          <Popup>Sawah Timur</Popup>
        </Marker>
      </MapContainer>

      <div className="satellite-overlay"></div>

      <div className="map-legend">
        <b>Potensi Hasil (Ton/Ha)</b>
        <Legend color="#15803d" text="Sangat Tinggi (> 7)" />
        <Legend color="#22c55e" text="Tinggi (6 - 7)" />
        <Legend color="#eab308" text="Sedang (5 - 6)" />
        <Legend color="#f97316" text="Rendah (4 - 5)" />
        <Legend color="#dc2626" text="Sangat Rendah (< 4)" />
      </div>

      <div className="map-card">
        <h4>Sawah Timur</h4>
        <p>Luas: 0.50 Ha</p>
        <p>Prediksi: 6.78 Ton/Ha</p>
        <p>Tingkat: Tinggi</p>
        <button type="button">Lihat Detail</button>
      </div>
    </div>
  );
}

// =====================
// DASHBOARD PREVIEW
// =====================
function DashboardPreview() {
  return (
    <div className="dashboard-device">
      <div className="dashboard-laptop-frame">
        <div className="dashboard-screen">
          <aside className="dash-sidebar">
            <div className="dash-logo">
              <div className="dash-logo-icon">🌾</div>
              <span>GeoPanen Petani</span>
            </div>

            <div className="dash-menu">
              <div className="dash-menu-item active"></div>
              <div className="dash-menu-item"></div>
              <div className="dash-menu-item"></div>
              <div className="dash-menu-item"></div>
              <div className="dash-menu-item"></div>
              <div className="dash-menu-item"></div>
            </div>

            <div className="dash-profile"></div>
          </aside>

          <main className="dash-main">
            <div className="dash-topbar">
              <div className="dash-title">
                <h4>🌿 Dashboard Petani</h4>
                <p>Kelola lahan dan pantau pertanian dengan AI.</p>
              </div>

              <div className="dash-weather"></div>
            </div>

            <div className="dash-kpi-grid">
              <DashKpi icon="🌾" value="2" label="Total Lahan" />
              <DashKpi icon="🗺️" value="1.00 Ha" label="Total Luas" />
              <DashKpi icon="📊" value="6.78 Ton" label="Prediksi Panen" />
              <DashKpi icon="🧪" value="3" label="Rekomendasi" />
              <DashKpi icon="💚" value="92.4%" label="Skor AI" />
            </div>

            <div className="dash-content-grid">
              <div className="dash-map-card">
                <h5 className="dash-card-title">🛰️ Peta Monitoring Lahan</h5>

                <div className="dash-mini-map">
                  <div className="dash-field one"></div>
                  <div className="dash-field two"></div>
                  <div className="dash-field three"></div>
                  <div className="dash-field four"></div>
                  <div className="dash-pin"></div>
                </div>

                <div className="dash-map-info">
                  <b>Sawah Timur</b>
                  <p>Luas: 0.50 Ha</p>
                  <p>Status: Baik</p>
                  <p>Prediksi: 6.78 Ton</p>
                </div>
              </div>

              <div className="dash-list-card">
                <h5 className="dash-card-title">Ringkasan Lahan Saya</h5>

                <DashLand name="Sawah Timur" luas="0.50 Ha" status="Baik" />
                <DashLand name="Sawah Barat" luas="0.50 Ha" status="Sedang" />
              </div>

              <div className="dash-side-card">
                <h5 className="dash-card-title">Cuaca Hari Ini</h5>

                <div className="dash-weather-big">
                  <div className="dash-weather-icon">🌤️</div>
                  <div>
                    <b>25°C</b>
                    <small>Cerah Berawan</small>
                  </div>
                </div>

                <div className="dash-weather-line">
                  <span>
                    Kelembapan <b>78%</b>
                  </span>
                  <span>
                    Curah Hujan <b>2 mm</b>
                  </span>
                </div>
              </div>

              <div className="dash-bottom-grid">
                <div className="dash-chart-card">
                  <h5 className="dash-card-title">Prediksi Hasil Panen</h5>
                  <div className="dash-line-chart"></div>
                </div>

                <div className="dash-nutrient-card">
                  <h5 className="dash-card-title">Kebutuhan Unsur Hara</h5>

                  <div className="dash-nutrient-row">
                    <span>Nitrogen 90%</span>
                    <div className="dash-progress green">
                      <i></i>
                    </div>
                  </div>

                  <div className="dash-nutrient-row">
                    <span>Fosfor 60%</span>
                    <div className="dash-progress orange">
                      <i></i>
                    </div>
                  </div>

                  <div className="dash-nutrient-row">
                    <span>Kalium 75%</span>
                    <div className="dash-progress blue">
                      <i></i>
                    </div>
                  </div>
                </div>

                <div className="dash-activity-card">
                  <h5 className="dash-card-title">Aktivitas Mendatang</h5>

                  <div className="dash-activity-row">
                    <b>Pemupukan Urea</b>
                    <span>08:00</span>
                  </div>

                  <div className="dash-activity-row">
                    <b>Irigasi</b>
                    <span>07:00</span>
                  </div>

                  <div className="dash-activity-row">
                    <b>Penyemprotan</b>
                    <span>07:30</span>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      <div className="dashboard-base"></div>
      <div className="dashboard-shadow"></div>
    </div>
  );
}

function DashKpi({ icon, value, label }) {
  return (
    <div className="dash-kpi">
      <div className="dash-kpi-icon">{icon}</div>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

function DashLand({ name, luas, status }) {
  return (
    <div className="dash-land-row">
      <div className="dash-land-left">
        <i className="dash-dot"></i>
        <div>
          <b>{name}</b>
          <small>{luas} · Padi</small>
        </div>
      </div>

      <span className="dash-badge">{status}</span>
    </div>
  );
}

// =====================
// KOMPONEN KECIL
// =====================
function InfoMini({ title, value, icon }) {
  return (
    <div className="info-mini">
      {icon && <span>{icon}</span>}
      <small>{title}</small>
      <b>{value}</b>
    </div>
  );
}

function Legend({ color, text }) {
  return (
    <div className="legend-row">
      <i className="legend-dot" style={{ background: color }}></i>
      {text}
    </div>
  );
}

function SourceCard({ logo, title, desc, sub }) {
  return (
    <div className="source-card">
      <div className="logo">{logo}</div>
      <b>{title}</b>
      <p>{desc}</p>
      <small>{sub}</small>
    </div>
  );
}

function SectionTitle({ title, green }) {
  return (
    <h2 className="section-title">
      {title} <span>{green}</span>
    </h2>
  );
}

function FeatureCard({ icon, title, desc }) {
  return (
    <div className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  );
}

function Step({ icon, no, title, desc }) {
  return (
    <div className="step">
      <div className="step-icon">{icon}</div>
      <h3>
        {no}. {title}
      </h3>
      <p>{desc}</p>
    </div>
  );
}

function Arrow() {
  return <div className="arrow">→</div>;
}

function Bar({ year, ai, bps, h1, h2 }) {
  return (
    <div className="bar-group">
      <div>
        <small>{ai}</small>
        <div className="bar ai" style={{ height: h1 }}></div>
      </div>

      <div>
        <small>{bps}</small>
        <div className="bar bps" style={{ height: h2 }}></div>
      </div>

      <span className="bar-label">{year}</span>
    </div>
  );
}

function Testimoni({ name, place, text }) {
  return (
    <div className="testimoni-card">
      <div className="stars">★★★★★</div>
      <blockquote>“{text}”</blockquote>

      <div className="person">
        <div className="person-avatar">👨‍🌾</div>
        <div>
          <b>{name}</b>
          <small>{place}</small>
        </div>
      </div>
    </div>
  );
}

function FooterCol({ title, items }) {
  return (
    <div>
      <h4>{title}</h4>

      {items.map((item) => (
        <a key={item} href="#beranda">
          {item}
        </a>
      ))}
    </div>
  );
}