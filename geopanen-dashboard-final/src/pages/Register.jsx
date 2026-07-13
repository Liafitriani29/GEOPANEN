import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:3000/api";

const initialForm = {
  nama: "",
  email: "",
  nomor_hp: "",
  password: "",
  konfirmasi_password: "",
};

export default function Register() {
  const [form, setForm] = useState(initialForm);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("");

  const namaRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  const navigate = useNavigate();

  useEffect(() => {
    const resetForm = () => {
      setForm(initialForm);
      setShowPassword(false);
      setShowConfirmPassword(false);

      if (namaRef.current) namaRef.current.value = "";
      if (emailRef.current) emailRef.current.value = "";
      if (passwordRef.current) passwordRef.current.value = "";
      if (confirmPasswordRef.current) confirmPasswordRef.current.value = "";
    };

    resetForm();

    const timer1 = setTimeout(resetForm, 100);
    const timer2 = setTimeout(resetForm, 400);
    const timer3 = setTimeout(resetForm, 900);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setMsg("");
    setMsgType("");

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = () => {
    if (!form.nama.trim()) {
      setMsg("Nama lengkap wajib diisi.");
      setMsgType("error");
      return false;
    }

    if (!form.email.trim()) {
      setMsg("Email wajib diisi.");
      setMsgType("error");
      return false;
    }

    if (!form.nomor_hp.trim()) {
      setMsg("Nomor HP wajib diisi.");
      setMsgType("error");
      return false;
    }

    if (!form.password.trim()) {
      setMsg("Password wajib diisi.");
      setMsgType("error");
      return false;
    }

    if (form.password.length < 6) {
      setMsg("Password minimal 6 karakter.");
      setMsgType("error");
      return false;
    }

    if (!form.konfirmasi_password.trim()) {
      setMsg("Konfirmasi password wajib diisi.");
      setMsgType("error");
      return false;
    }

    if (form.password !== form.konfirmasi_password) {
      setMsg("Konfirmasi password tidak sama.");
      setMsgType("error");
      return false;
    }

    return true;
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setLoading(true);
      setMsg("");
      setMsgType("");

     const payload = {
  nama: form.nama.trim(),
  email: form.email.trim(),
  password: form.password,
  role: "petani",
  no_hp: form.nomor_hp.trim(),
  nomor_hp: form.nomor_hp.trim(),
  komoditas: "Padi",
};

      const res = await axios.post(`${API}/auth/register`, payload);

      setMsg(res.data?.message || "Register berhasil. Silakan login.");
      setMsgType("success");

      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1000);
    } catch (err) {
      console.log("REGISTER ERROR:", err.response?.data || err.message);
      setMsg(err.response?.data?.message || "Register gagal.");
      setMsgType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          width: 100%;
          min-height: 100%;
        }

        body {
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px #ffffff inset !important;
          -webkit-text-fill-color: #0f172a !important;
          transition: background-color 9999s ease-in-out 0s;
        }

        .register-page {
          width: 100%;
          min-height: 100vh;
          display: grid;
          grid-template-columns: 0.88fr 1.12fr;
          background: #ffffff;
          overflow: hidden;
        }

        .register-left {
          position: relative;
          min-height: 100vh;
          padding: 72px 58px 44px;
          background:
            linear-gradient(
              180deg,
              rgba(240, 253, 244, 0.98) 0%,
              rgba(240, 253, 244, 0.72) 42%,
              rgba(255, 255, 255, 0.08) 72%
            ),
            url("/geopanen-hero.jpg");
          background-size: cover;
          background-position: center bottom;
          overflow: hidden;
        }

        .register-left::after {
          content: "";
          position: absolute;
          top: -8%;
          right: -23%;
          width: 52%;
          height: 116%;
          background: #ffffff;
          border-top-left-radius: 58% 50%;
          border-bottom-left-radius: 58% 50%;
          z-index: 1;
        }

        .brand-area {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 62px;
        }

        .brand-logo {
          width: 58px;
          height: 58px;
          border-radius: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #059669, #047857);
          color: #fde047;
          font-size: 30px;
          box-shadow: 0 14px 30px rgba(5, 150, 105, 0.25);
        }

        .brand-title {
          margin: 0;
          color: #064e3b;
          font-size: 36px;
          font-weight: 950;
          line-height: 1;
          letter-spacing: -1px;
        }

        .brand-subtitle {
          margin: 7px 0 0;
          color: #475569;
          font-size: 15px;
          font-weight: 500;
        }

        .hero-content {
          position: relative;
          z-index: 2;
          max-width: 620px;
        }

        .hero-title {
          margin: 0;
          color: #064e3b;
          font-size: 34px;
          line-height: 1.35;
          font-weight: 950;
          letter-spacing: -0.7px;
        }

        .hero-desc {
          margin: 24px 0 48px;
          max-width: 575px;
          color: #334155;
          font-size: 18px;
          line-height: 1.65;
          font-weight: 500;
        }

        .feature-row {
          position: relative;
          z-index: 2;
          display: grid;
          grid-template-columns: repeat(4, minmax(100px, 1fr));
          gap: 26px;
          max-width: 620px;
        }

        .feature-item {
          text-align: center;
        }

        .feature-icon {
          width: 76px;
          height: 76px;
          margin: 0 auto 14px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.78);
          color: #047857;
          font-size: 31px;
          box-shadow: 0 15px 32px rgba(15, 23, 42, 0.08);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.78);
        }

        .feature-title {
          margin: 0 0 8px;
          color: #0f172a;
          font-size: 13px;
          font-weight: 950;
        }

        .feature-text {
          margin: 0;
          color: #334155;
          font-size: 12px;
          line-height: 1.5;
          font-weight: 500;
        }

        .secure-left-badge {
          position: absolute;
          left: 58px;
          bottom: 42px;
          z-index: 2;
          max-width: 510px;
          padding: 12px 18px;
          border-radius: 9px;
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(240, 253, 244, 0.86);
          border: 1px solid #bbf7d0;
          color: #047857;
          font-size: 13px;
          font-weight: 750;
          box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
          backdrop-filter: blur(8px);
        }

        .register-right {
          min-height: 100vh;
          padding: 44px 58px;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            radial-gradient(circle at 88% 12%, rgba(220, 252, 231, 0.68) 0%, rgba(255, 255, 255, 0) 27%),
            radial-gradient(circle at 7% 92%, rgba(240, 253, 244, 0.9) 0%, rgba(255, 255, 255, 0) 25%),
            #ffffff;
        }

        .register-card {
          width: 100%;
          max-width: 760px;
          padding: 34px 34px 30px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid #e5e7eb;
          box-shadow: 0 26px 75px rgba(15, 23, 42, 0.12);
        }

        .register-head {
          text-align: center;
          margin-bottom: 30px;
        }

        .register-logo {
          width: 66px;
          height: 66px;
          margin: 0 auto 16px;
          border-radius: 17px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #dcfce7;
          color: #047857;
          font-size: 32px;
        }

        .register-title {
          margin: 0;
          color: #064e3b;
          font-size: 31px;
          line-height: 1.2;
          font-weight: 950;
          letter-spacing: -0.7px;
        }

        .register-subtitle {
          margin: 10px 0 0;
          color: #475569;
          font-size: 15px;
          font-weight: 500;
        }

        .section-title {
          margin: 0 0 16px;
          color: #047857;
          font-size: 14px;
          font-weight: 950;
        }

        .form-section {
          padding-bottom: 0;
          margin-bottom: 0;
          border-bottom: none;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 18px;
        }

        .form-group {
          width: 100%;
        }

        .full-row {
          grid-column: 1 / -1;
        }

        .form-label {
          display: block;
          margin-bottom: 9px;
          color: #0f172a;
          font-size: 13px;
          font-weight: 900;
        }

        .input-wrap {
          position: relative;
        }

        .input-icon {
          position: absolute;
          left: 15px;
          top: 50%;
          transform: translateY(-50%);
          color: #64748b;
          font-size: 17px;
          line-height: 1;
          z-index: 2;
        }

        .form-input {
          width: 100%;
          height: 48px;
          padding: 0 46px 0 44px;
          border: 1px solid #dbe3ea;
          border-radius: 10px;
          outline: none;
          background: #ffffff;
          color: #0f172a;
          font-size: 14px;
          font-weight: 600;
          transition: 0.2s ease;
        }

        .form-input::placeholder {
          color: #94a3b8;
          font-weight: 500;
        }

        .form-input:focus {
          border-color: #22c55e;
          box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.13);
        }

        .toggle-password {
          position: absolute;
          right: 13px;
          top: 50%;
          transform: translateY(-50%);
          border: none;
          background: transparent;
          color: #64748b;
          cursor: pointer;
          font-size: 17px;
          padding: 4px;
          z-index: 2;
        }

        .info-box {
          margin-top: 22px;
          padding: 17px 18px;
          border-radius: 10px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          background: #ecfdf5;
          border: 1px solid #bbf7d0;
          color: #065f46;
          font-size: 14px;
          line-height: 1.55;
          font-weight: 650;
        }

        .submit-btn {
          width: 100%;
          height: 52px;
          margin-top: 24px;
          border: none;
          border-radius: 10px;
          background: linear-gradient(135deg, #16a34a, #059669);
          color: #ffffff;
          font-size: 15px;
          font-weight: 950;
          cursor: pointer;
          box-shadow: 0 16px 30px rgba(22, 163, 74, 0.26);
          transition: 0.2s ease;
        }

        .submit-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 19px 36px rgba(22, 163, 74, 0.32);
        }

        .submit-btn:disabled {
          cursor: not-allowed;
          opacity: 0.72;
          transform: none;
        }

        .message {
          margin: 16px 0 0;
          padding: 12px 14px;
          border-radius: 10px;
          text-align: center;
          font-size: 14px;
          font-weight: 800;
        }

        .message.success {
          background: #dcfce7;
          border: 1px solid #86efac;
          color: #047857;
        }

        .message.error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
        }

        .login-link-wrap {
          margin-top: 20px;
          text-align: center;
          color: #64748b;
          font-size: 15px;
          font-weight: 500;
        }

        .login-link {
          border: none;
          background: transparent;
          color: #059669;
          font-size: 15px;
          font-weight: 950;
          cursor: pointer;
          padding: 0 0 0 6px;
        }

        @media (max-width: 1180px) {
          .register-page {
            grid-template-columns: 1fr;
          }

          .register-left {
            display: none;
          }

          .register-right {
            padding: 32px 18px;
          }

          .register-card {
            max-width: 760px;
          }
        }

        @media (max-width: 720px) {
          .register-card {
            padding: 28px 20px;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .full-row {
            grid-column: auto;
          }

          .register-title {
            font-size: 26px;
          }
        }
      `}</style>

      <main className="register-page">
        <section className="register-left">
          <div className="brand-area">
            <div className="brand-logo">🌾</div>

            <div>
              <h1 className="brand-title">GeoPanen</h1>
              <p className="brand-subtitle">
                Sistem Prediksi & Monitoring Padi
              </p>
            </div>
          </div>

          <div className="hero-content">
            <h2 className="hero-title">
              Bergabunglah bersama petani Sukoharjo untuk pertanian padi yang
              lebih cerdas dan produktif.
            </h2>

            <p className="hero-desc">
              Daftar sekarang sebagai petani dan dapatkan akses ke fitur
              monitoring lahan, prediksi produksi padi, rekomendasi AI, dan
              konsultasi dengan penyuluh.
            </p>

            <div className="feature-row">
              <div className="feature-item">
                <div className="feature-icon">🌿</div>
                <h3 className="feature-title">Monitoring Lahan</h3>
                <p className="feature-text">
                  Pantau kondisi lahan secara real-time
                </p>
              </div>

              <div className="feature-item">
                <div className="feature-icon">📊</div>
                <h3 className="feature-title">Prediksi Akurat</h3>
                <p className="feature-text">
                  AI memprediksi hasil panen padi lebih akurat
                </p>
              </div>

              <div className="feature-item">
                <div className="feature-icon">💬</div>
                <h3 className="feature-title">Rekomendasi AI</h3>
                <p className="feature-text">
                  Dapatkan saran terbaik sesuai kondisi lahan
                </p>
              </div>

              <div className="feature-item">
                <div className="feature-icon">👨‍🌾</div>
                <h3 className="feature-title">Konsultasi Penyuluh</h3>
                <p className="feature-text">
                  Terhubung langsung dengan penyuluh
                </p>
              </div>
            </div>
          </div>

          <div className="secure-left-badge">
            <span>🛡️</span>
            <span>
              Aman & Terpercaya. Data Anda terlindungi dengan enkripsi tingkat
              tinggi.
            </span>
          </div>
        </section>

        <section className="register-right">
          <div className="register-card">
            <div className="register-head">
              <div className="register-logo">👤</div>

              <h2 className="register-title">Daftar Petani</h2>
              <p className="register-subtitle">
                Buat akun baru untuk mulai menggunakan GeoPanen
              </p>
            </div>

            <form
              onSubmit={handleRegister}
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
            >
              <div className="form-section">
                <h3 className="section-title">Informasi Akun</h3>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Nama Lengkap</label>

                    <div className="input-wrap">
                      <span className="input-icon">👤</span>
                      <input
                        ref={namaRef}
                        type="text"
                        name="nama"
                        placeholder="Masukkan nama lengkap Anda"
                        value={form.nama}
                        onChange={handleChange}
                        className="form-input"
                        autoComplete="off"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email</label>

                    <div className="input-wrap">
                      <span className="input-icon">✉️</span>
                      <input
                        ref={emailRef}
                        type="text"
                        name="email"
                        placeholder="Masukkan email Anda"
                        value={form.email}
                        onChange={handleChange}
                        className="form-input"
                        autoComplete="off"
                        autoCapitalize="none"
                        inputMode="email"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Nomor HP</label>

                    <div className="input-wrap">
                      <span className="input-icon">📞</span>
                      <input
                        type="text"
                        name="nomor_hp"
                        placeholder="Masukkan nomor HP"
                        value={form.nomor_hp}
                        onChange={handleChange}
                        className="form-input"
                        autoComplete="off"
                        inputMode="tel"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Password</label>

                    <div className="input-wrap">
                      <span className="input-icon">🔒</span>
                      <input
                        ref={passwordRef}
                        type={showPassword ? "text" : "password"}
                        name="password"
                        placeholder="Buat password"
                        value={form.password}
                        onChange={handleChange}
                        className="form-input"
                        autoComplete="new-password"
                        required
                      />

                      <button
                        type="button"
                        className="toggle-password"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label="Tampilkan atau sembunyikan password"
                      >
                        {showPassword ? "🙈" : "👁️"}
                      </button>
                    </div>
                  </div>

                  <div className="form-group full-row">
                    <label className="form-label">Konfirmasi Password</label>

                    <div className="input-wrap">
                      <span className="input-icon">🔒</span>
                      <input
                        ref={confirmPasswordRef}
                        type={showConfirmPassword ? "text" : "password"}
                        name="konfirmasi_password"
                        placeholder="Ulangi password Anda"
                        value={form.konfirmasi_password}
                        onChange={handleChange}
                        className="form-input"
                        autoComplete="new-password"
                        required
                      />

                      <button
                        type="button"
                        className="toggle-password"
                        onClick={() =>
                          setShowConfirmPassword((prev) => !prev)
                        }
                        aria-label="Tampilkan atau sembunyikan konfirmasi password"
                      >
                        {showConfirmPassword ? "🙈" : "👁️"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="info-box">
                  <span>ⓘ</span>
                  <span>
                    Setelah akun berhasil dibuat, Anda dapat melengkapi data
                    lahan pada menu Lahan Saya setelah login.
                  </span>
                </div>

                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading ? "Mendaftarkan..." : "👤 Daftar Sekarang"}
                </button>

                {msg && <p className={`message ${msgType}`}>{msg}</p>}

                <div className="login-link-wrap">
                  Sudah punya akun?
                  <button
                    type="button"
                    className="login-link"
                    onClick={() => navigate("/login")}
                  >
                    Login di sini
                  </button>
                </div>
              </div>
            </form>
          </div>
        </section>
      </main>
    </>
  );
}