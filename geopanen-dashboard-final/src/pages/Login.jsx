import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [selectedRole, setSelectedRole] = useState("penyuluh");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const navigate = useNavigate();

  useEffect(() => {
    setEmail("");
    setPassword("");
    setRememberMe(false);
    setShowPassword(false);

    const clearAutofill = () => {
      setEmail("");
      setPassword("");

      if (emailRef.current) {
        emailRef.current.value = "";
      }

      if (passwordRef.current) {
        passwordRef.current.value = "";
      }
    };

    clearAutofill();

    const timer1 = setTimeout(clearAutofill, 100);
    const timer2 = setTimeout(clearAutofill, 400);
    const timer3 = setTimeout(clearAutofill, 900);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  const roleOptions = [
    {
      key: "penyuluh",
      label: "Penyuluh",
      icon: "👨‍🌾",
    },
    {
      key: "petani",
      label: "Petani",
      icon: "🧑‍🌾",
    },
    {
      key: "admin",
      label: "Admin",
      icon: "🛡️",
    },
  ];

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      alert("Email dan password wajib diisi.");
      return;
    }

    try {
      setLoading(true);

      const res = await api.post("/auth/login", {
        email: email.trim(),
        password,
      });

      const token = res.data?.token;
      const user = res.data?.user;

      if (!token || !user) {
        throw new Error("Response login tidak valid.");
      }

      const role = String(user.role || "").toLowerCase();

      if (!["admin", "petani", "penyuluh"].includes(role)) {
        throw new Error("Role user tidak valid. Cek kolom role di database.");
      }

      if (role !== selectedRole) {
        throw new Error(
          `Akun ini terdaftar sebagai ${role}, bukan ${selectedRole}. Silakan pilih peran yang sesuai.`
        );
      }

      const normalizedUser = {
        ...user,
        role,
      };

      localStorage.clear();

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(normalizedUser));
      localStorage.setItem("user_id", String(user.id));
      localStorage.setItem("nama", user.nama || "");
      localStorage.setItem("email", user.email || "");
      localStorage.setItem("role", role);

      if (rememberMe) {
        localStorage.setItem("rememberMe", "true");
      }

      if (role === "petani") {
        localStorage.setItem("petani_id", String(user.id));
      }

      if (role === "penyuluh") {
        localStorage.setItem("penyuluh_id", String(user.id));
      }

      if (role === "admin") {
        localStorage.setItem("admin_id", String(user.id));
      }

      window.dispatchEvent(new Event("storage"));

      if (role === "admin") {
        navigate("/admin", { replace: true });
        return;
      }

      if (role === "penyuluh") {
        navigate("/penyuluh", { replace: true });
        return;
      }

      if (role === "petani") {
        navigate("/petani", { replace: true });
        return;
      }
    } catch (err) {
      console.log("LOGIN ERROR:", err.response?.data || err.message);
      alert(err.response?.data?.message || err.message || "Login gagal.");
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

        .login-page {
          width: 100%;
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1.15fr 1fr;
          background: #ffffff;
          overflow: hidden;
        }

        .login-left {
          position: relative;
          min-height: 100vh;
          padding: 70px 64px 42px;
          background:
            linear-gradient(
              180deg,
              rgba(236, 253, 245, 0.96) 0%,
              rgba(236, 253, 245, 0.66) 35%,
              rgba(255, 255, 255, 0.06) 68%
            ),
            url("/geopanen-hero.jpg");
          background-size: cover;
          background-position: center bottom;
          overflow: hidden;
        }

        .login-left::after {
          content: "";
          position: absolute;
          top: -8%;
          right: -20%;
          width: 48%;
          height: 116%;
          background: #ffffff;
          border-top-left-radius: 55% 50%;
          border-bottom-left-radius: 55% 50%;
          z-index: 1;
        }

        .brand-area {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 54px;
        }

        .brand-logo {
          width: 58px;
          height: 58px;
          border-radius: 16px;
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
          font-weight: 900;
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
          color: #065f46;
          font-size: 34px;
          line-height: 1.35;
          font-weight: 950;
          letter-spacing: -0.6px;
        }

        .hero-desc {
          margin: 18px 0 46px;
          max-width: 560px;
          color: #334155;
          font-size: 18px;
          line-height: 1.65;
          font-weight: 500;
        }

        .feature-row {
          position: relative;
          z-index: 2;
          display: grid;
          grid-template-columns: repeat(4, minmax(110px, 1fr));
          gap: 24px;
          max-width: 650px;
        }

        .feature-item {
          text-align: center;
        }

        .feature-icon {
          width: 72px;
          height: 72px;
          margin: 0 auto 13px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.72);
          color: #16a34a;
          font-size: 30px;
          box-shadow: 0 14px 32px rgba(15, 23, 42, 0.08);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.75);
        }

        .feature-title {
          margin: 0 0 8px;
          color: #0f172a;
          font-size: 13px;
          font-weight: 900;
        }

        .feature-text {
          margin: 0;
          color: #64748b;
          font-size: 12px;
          line-height: 1.45;
          font-weight: 500;
        }

        .copyright-badge {
          position: absolute;
          left: 64px;
          bottom: 38px;
          z-index: 2;
          padding: 9px 14px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.72);
          color: #475569;
          font-size: 12px;
          font-weight: 600;
          box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
          backdrop-filter: blur(8px);
        }

        .login-right {
          min-height: 100vh;
          padding: 42px 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            radial-gradient(circle at 85% 15%, rgba(220, 252, 231, 0.65) 0%, rgba(255,255,255,0) 26%),
            radial-gradient(circle at 8% 90%, rgba(240, 253, 244, 0.9) 0%, rgba(255,255,255,0) 25%),
            #ffffff;
        }

        .login-panel-wrap {
          width: 100%;
          max-width: 540px;
        }

        .login-card {
          width: 100%;
          padding: 30px 34px 32px;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.94);
          border: 1px solid #e5e7eb;
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.10);
        }

        .login-head {
          text-align: center;
          margin-bottom: 26px;
        }

        .login-logo {
          width: 70px;
          height: 70px;
          margin: 0 auto 16px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #dcfce7;
          color: #16a34a;
          font-size: 35px;
        }

        .login-title {
          margin: 0;
          color: #0f172a;
          font-size: 28px;
          line-height: 1.2;
          font-weight: 950;
          letter-spacing: -0.5px;
        }

        .login-subtitle {
          margin: 10px 0 0;
          color: #64748b;
          font-size: 14px;
          font-weight: 500;
        }

        .form-label {
          display: block;
          margin-bottom: 9px;
          color: #0f172a;
          font-size: 13px;
          font-weight: 900;
        }

        .role-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }

        .role-btn {
          height: 48px;
          border-radius: 9px;
          border: 1px solid #dbe3ea;
          background: #ffffff;
          color: #334155;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 800;
          transition: 0.2s ease;
        }

        .role-btn:hover {
          border-color: #22c55e;
          background: #f0fdf4;
        }

        .role-btn.active {
          border-color: #22c55e;
          background: #f0fdf4;
          color: #047857;
          box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.12);
        }

        .role-icon {
          font-size: 20px;
        }

        .form-group {
          margin-bottom: 18px;
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

        .form-extra {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin: -2px 0 22px;
        }

        .remember {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #64748b;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          user-select: none;
        }

        .remember input {
          width: 15px;
          height: 15px;
          accent-color: #16a34a;
        }

        .forgot-btn {
          border: none;
          background: transparent;
          color: #059669;
          font-size: 13px;
          font-weight: 900;
          cursor: pointer;
          padding: 0;
        }

        .login-btn {
          width: 100%;
          height: 48px;
          border: none;
          border-radius: 10px;
          background: linear-gradient(135deg, #16a34a, #059669);
          color: #ffffff;
          font-size: 15px;
          font-weight: 950;
          cursor: pointer;
          box-shadow: 0 15px 28px rgba(22, 163, 74, 0.24);
          transition: 0.2s ease;
        }

        .login-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 18px 34px rgba(22, 163, 74, 0.30);
        }

        .login-btn:disabled {
          cursor: not-allowed;
          opacity: 0.7;
          transform: none;
        }

        .divider {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 14px;
          margin: 22px 0;
          color: #64748b;
          font-size: 13px;
          font-weight: 700;
        }

        .divider::before,
        .divider::after {
          content: "";
          height: 1px;
          background: #e5e7eb;
        }

        .google-btn {
          width: 100%;
          height: 46px;
          border: 1px solid #dbe3ea;
          border-radius: 10px;
          background: #ffffff;
          color: #334155;
          font-size: 14px;
          font-weight: 850;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: 0.2s ease;
        }

        .google-btn:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .google-icon {
          color: #ea4335;
          font-size: 19px;
          font-weight: 950;
        }

        .bottom-actions {
          margin-top: 20px;
          text-align: center;
        }

        .register-text {
          margin: 0 0 12px;
          color: #64748b;
          font-size: 14px;
          font-weight: 500;
        }

        .text-btn {
          border: none;
          background: transparent;
          color: #059669;
          font-weight: 950;
          cursor: pointer;
          padding: 0;
          font-size: 14px;
        }

        .back-link {
          border: none;
          background: transparent;
          color: #059669;
          font-weight: 900;
          cursor: pointer;
          font-size: 14px;
        }

        .secure-badge {
          margin-top: 22px;
          width: 100%;
          min-height: 52px;
          padding: 14px 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border-radius: 11px;
          border: 1px solid #bbf7d0;
          background: #dcfce7;
          color: #047857;
          font-size: 13px;
          font-weight: 750;
          text-align: center;
        }

        .secure-icon {
          font-size: 18px;
        }

        @media (max-width: 1100px) {
          .login-page {
            grid-template-columns: 1fr;
          }

          .login-left {
            display: none;
          }

          .login-right {
            padding: 30px 18px;
          }
        }

        @media (max-width: 560px) {
          .login-card {
            padding: 26px 20px;
            border-radius: 18px;
          }

          .role-grid {
            grid-template-columns: 1fr;
          }

          .login-title {
            font-size: 24px;
          }

          .form-extra {
            align-items: flex-start;
            flex-direction: column;
          }
        }
      `}</style>

      <main className="login-page">
        <section className="login-left">
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
              Kelola data, pantau pertanian,
              <br />
              wujudkan panen yang lebih baik.
            </h2>

            <p className="hero-desc">
              Platform terintegrasi untuk penyuluh dan petani dalam monitoring
              lahan, prediksi produksi, dan rekomendasi cerdas.
            </p>

            <div className="feature-row">
              <div className="feature-item">
                <div className="feature-icon">📍</div>
                <h3 className="feature-title">Monitoring Lahan</h3>
                <p className="feature-text">
                  Pantau kondisi lahan secara real-time
                </p>
              </div>

              <div className="feature-item">
                <div className="feature-icon">📊</div>
                <h3 className="feature-title">Prediksi Akurat</h3>
                <p className="feature-text">
                  AI memprediksi hasil panen lebih akurat
                </p>
              </div>

              <div className="feature-item">
                <div className="feature-icon">👥</div>
                <h3 className="feature-title">Kolaborasi Mudah</h3>
                <p className="feature-text">
                  Penyuluh & petani terhubung langsung
                </p>
              </div>

              <div className="feature-item">
                <div className="feature-icon">🌿</div>
                <h3 className="feature-title">Rekomendasi Cerdas</h3>
                <p className="feature-text">
                  Saran terbaik sesuai kondisi lahan
                </p>
              </div>
            </div>
          </div>

          <div className="copyright-badge">
            © 2026 GeoPanen. All rights reserved.
          </div>
        </section>

        <section className="login-right">
          <div className="login-panel-wrap">
            <div className="login-card">
              <div className="login-head">
                <div className="login-logo">🌾</div>
                <h2 className="login-title">Login GeoPanen</h2>
                <p className="login-subtitle">
                  Masuk untuk mengakses dashboard sesuai peran Anda.
                </p>
              </div>

              <form
                onSubmit={handleLogin}
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
              >
                <div className="form-group">
                  <label className="form-label">Pilih Peran</label>

                  <div className="role-grid">
                    {roleOptions.map((role) => (
                      <button
                        key={role.key}
                        type="button"
                        className={
                          selectedRole === role.key
                            ? "role-btn active"
                            : "role-btn"
                        }
                        onClick={() => setSelectedRole(role.key)}
                      >
                        <span className="role-icon">{role.icon}</span>
                        <span>{role.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Email</label>

                  <div className="input-wrap">
                    <span className="input-icon">✉️</span>

                    <input
                      ref={emailRef}
                      type="text"
                      name="geopanen_login_email_empty"
                      placeholder="Masukkan email Anda"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="form-input"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck="false"
                      inputMode="email"
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
                      name="geopanen_login_password_empty"
                      placeholder="Masukkan password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="form-input"
                      autoComplete="new-password"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck="false"
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

                <div className="form-extra">
                  <label className="remember">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>Ingat saya</span>
                  </label>

                  <button
                    type="button"
                    className="forgot-btn"
                    onClick={() => alert("Fitur lupa password belum tersedia.")}
                  >
                    Lupa password?
                  </button>
                </div>

                <button type="submit" className="login-btn" disabled={loading}>
                  {loading ? "Memproses..." : "↪ Login"}
                </button>
              </form>

              <div className="divider">atau masuk dengan</div>

              <button
                type="button"
                className="google-btn"
                onClick={() => alert("Login Google belum dihubungkan.")}
              >
                <span className="google-icon">G</span>
                <span>Login dengan Google</span>
              </button>

              <div className="bottom-actions">
                <p className="register-text">
                  Belum punya akun?{" "}
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() => navigate("/register")}
                  >
                    Daftar sebagai petani
                  </button>
                </p>

                <button
                  type="button"
                  className="back-link"
                  onClick={() => navigate("/landing")}
                >
                  Kembali ke landing page
                </button>
              </div>
            </div>

            <div className="secure-badge">
              <span className="secure-icon">🛡️</span>
              <span>
                Aman & Terpercaya. Data Anda terlindungi dengan enkripsi
                tingkat tinggi.
              </span>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}