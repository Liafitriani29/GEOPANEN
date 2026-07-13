import { useLocation, useNavigate } from "react-router-dom";

export default function Sidebar({ role = "" }) {
  const navigate = useNavigate();
  const location = useLocation();

  const currentPath = location.pathname;
  const normalizedRole = String(role).toLowerCase();

  const isAdmin = normalizedRole === "admin";
  const isPetani = normalizedRole === "petani";
  const isPenyuluh = normalizedRole === "penyuluh";

  /*
  |--------------------------------------------------------------------------
  | Navigasi halaman
  |--------------------------------------------------------------------------
  */

  const goToPage = (targetPath) => {
    if (currentPath !== targetPath) {
      navigate(targetPath);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Logout pengguna
  |--------------------------------------------------------------------------
  */

  const handleLogout = () => {
    const confirmed = window.confirm(
      "Apakah Anda yakin ingin keluar dari GeoPanen?"
    );

    if (!confirmed) return;

    const authKeys = [
      "token",
      "access_token",
      "refresh_token",
      "role",
      "user",
      "user_id",
      "petani_id",
      "penyuluh_id",
      "admin_id",
      "nama",
      "email",
    ];

    authKeys.forEach((key) => {
      localStorage.removeItem(key);
    });

    sessionStorage.clear();

    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("geopanen:logout"));

    navigate("/login", {
      replace: true,
    });
  };

  /*
  |--------------------------------------------------------------------------
  | Pemeriksaan menu aktif
  |--------------------------------------------------------------------------
  |
  | Dashboard hanya aktif ketika path sama persis.
  | Menu lain tetap aktif pada halaman turunannya.
  |
  */

  const isActive = (targetPath) => {
    const dashboardPaths = ["/admin", "/petani", "/penyuluh"];

    if (dashboardPaths.includes(targetPath)) {
      return currentPath === targetPath;
    }

    return (
      currentPath === targetPath ||
      currentPath.startsWith(`${targetPath}/`)
    );
  };

  return (
    <aside style={styles.sidebar}>
      <div style={styles.sidebarInner}>
        {/* ================= HEADER ================= */}

        <div style={styles.logo}>
          <div style={styles.logoBox}>🌾</div>

          <div style={styles.logoText}>
            <div style={styles.title}>
              {isAdmin
                ? "GeoPanen Admin"
                : isPenyuluh
                ? "GeoPanen Penyuluh"
                : "GeoPanen Petani"}
            </div>

            <div style={styles.subtitle}>
              Sistem Prediksi & Monitoring Padi
            </div>
          </div>
        </div>

        {/* ================= MENU ADMIN ================= */}

        {isAdmin && (
          <>
            <Section title="DASHBOARD">
              <Item
                label="Dashboard"
                active={isActive("/admin")}
                onClick={() => goToPage("/admin")}
              />
            </Section>

            <Section title="MASTER DATA">
              <Item
                label="Petani"
                active={isActive("/admin/petani")}
                onClick={() => goToPage("/admin/petani")}
              />

              <Item
                label="Lahan"
                active={isActive("/admin/lahan")}
                onClick={() => goToPage("/admin/lahan")}
              />

              <Item
                label="Kecamatan"
                active={isActive("/admin/kecamatan")}
                onClick={() => goToPage("/admin/kecamatan")}
              />

              <Item
                label="Cuaca"
                active={isActive("/admin/cuaca")}
                onClick={() => goToPage("/admin/cuaca")}
              />
            </Section>

            <Section title="AI SYSTEM">
              <Item
                label="Monitoring Prediksi"
                active={isActive("/admin/prediksi")}
                onClick={() => goToPage("/admin/prediksi")}
              />

              <Item
                label="Riwayat"
                active={isActive("/admin/riwayat")}
                onClick={() => goToPage("/admin/riwayat")}
              />
            </Section>

            <Section title="LAPORAN">
              <Item
                label="Statistik"
                active={isActive("/admin/statistik")}
                onClick={() => goToPage("/admin/statistik")}
              />

              <Item
                label="Laporan"
                active={isActive("/admin/laporan")}
                onClick={() => goToPage("/admin/laporan")}
              />
            </Section>
          </>
        )}

        {/* ================= MENU PENYULUH ================= */}

        {isPenyuluh && (
          <>
            <Section title="DASHBOARD">
              <Item
                label="Dashboard"
                active={isActive("/penyuluh")}
                onClick={() => goToPage("/penyuluh")}
              />
            </Section>

            <Section title="BINAAN">
              <Item
                label="Peta Binaan"
                active={isActive("/penyuluh/peta")}
                onClick={() => goToPage("/penyuluh/peta")}
              />

              <Item
                label="Petani Binaan"
                active={isActive("/penyuluh/petani")}
                onClick={() => goToPage("/penyuluh/petani")}
              />

              <Item
                label="Kalender Binaan"
                active={isActive("/penyuluh/kalender")}
                onClick={() => goToPage("/penyuluh/kalender")}
              />
            </Section>

            <Section title="ANALISIS">
              <Item
                label="Analisis Produksi"
                active={isActive("/penyuluh/analisis")}
                onClick={() => goToPage("/penyuluh/analisis")}
              />

              <Item
                label="AI Recommendation"
                active={isActive("/penyuluh/rekomendasi")}
                onClick={() => goToPage("/penyuluh/rekomendasi")}
              />
            </Section>

            <Section title="LAPANGAN">
              <Item
                label="Riwayat Catatan Lapangan"
                active={isActive("/penyuluh/catatan")}
                onClick={() => goToPage("/penyuluh/catatan")}
              />

              <Item
                label="Notifikasi"
                active={isActive("/penyuluh/notifikasi")}
                onClick={() => goToPage("/penyuluh/notifikasi")}
              />

              <Item
                label="Konsultasi Petani"
                active={isActive("/penyuluh/konsultasi")}
                onClick={() => goToPage("/penyuluh/konsultasi")}
              />
            </Section>
          </>
        )}

        {/* ================= MENU PETANI ================= */}

        {isPetani && (
          <>
            <Section title="DASHBOARD">
              <Item
                label="Dashboard"
                active={isActive("/petani")}
                onClick={() => goToPage("/petani")}
              />
            </Section>

            <Section title="MONITORING">
              <Item
                label="Peta Lahan"
                active={isActive("/petani/peta-lahan")}
                onClick={() => goToPage("/petani/peta-lahan")}
              />

              <Item
                label="Lahan Saya"
                active={isActive("/petani/lahan-saya")}
                onClick={() => goToPage("/petani/lahan-saya")}
              />

              <Item
                label="Monitoring Tanaman"
                active={isActive("/petani/monitoring")}
                onClick={() => goToPage("/petani/monitoring")}
              />

              <Item
                label="Riwayat Panen"
                active={isActive("/petani/riwayat-panen")}
                onClick={() => goToPage("/petani/riwayat-panen")}
              />
            </Section>

            <Section title="AI SYSTEM">
              <Item
                label="Prediksi Panen"
                active={isActive("/petani/prediksi")}
                onClick={() => goToPage("/petani/prediksi")}
              />
            </Section>

            <Section title="REKOMENDASI">
              <Item
                label="Pupuk"
                active={isActive("/petani/rekomendasi-pupuk")}
                onClick={() => goToPage("/petani/rekomendasi-pupuk")}
              />

              <Item
                label="Kalender"
                active={isActive("/petani/kalender")}
                onClick={() => goToPage("/petani/kalender")}
              />
            </Section>
          </>
        )}

        {/* ================= FOOTER ================= */}

        <div style={styles.sidebarFooter}>
          <div style={styles.footerUserRow}>
            <div style={styles.footerAvatar}>
              {isAdmin ? "🧑‍💼" : isPenyuluh ? "👨‍🌾" : "🧑‍🌾"}
            </div>

            <div style={styles.footerText}>
              <div style={styles.footerName}>
                {isAdmin
                  ? "Admin"
                  : isPenyuluh
                  ? "Penyuluh"
                  : "Petani"}
              </div>

              <div style={styles.footerSub}>GeoPanen System</div>
            </div>
          </div>

          <button
            type="button"
            style={styles.logoutButton}
            onClick={handleLogout}
            title="Keluar dari GeoPanen"
            aria-label="Keluar dari akun GeoPanen"
          >
            <span style={styles.logoutIcon} aria-hidden="true">
              ↪
            </span>

            <span>Keluar</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

/*
|--------------------------------------------------------------------------
| Komponen item menu
|--------------------------------------------------------------------------
*/

function Item({ label, onClick, active = false }) {
  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      style={{
        ...styles.item,
        background: active ? "#16a34a" : "transparent",
        color: active ? "#ffffff" : "#d1d5db",
        boxShadow: active
          ? "0 8px 22px rgba(22, 163, 74, 0.35)"
          : "none",
      }}
    >
      {label}
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Komponen kelompok menu
|--------------------------------------------------------------------------
*/

function Section({ title, children }) {
  return (
    <div style={styles.sectionWrap}>
      <div style={styles.section}>{title}</div>

      <div>{children}</div>
    </div>
  );
}

/*
|--------------------------------------------------------------------------
| Style sidebar
|--------------------------------------------------------------------------
*/

const styles = {
  sidebar: {
    width: 260,
    minWidth: 260,
    height: "100dvh",
    minHeight: "100vh",
    background: "#0f2e1d",
    color: "#ffffff",
    position: "sticky",
    top: 0,
    left: 0,
    zIndex: 20,
    overflow: "hidden",
    flexShrink: 0,
    boxSizing: "border-box",
  },

  sidebarInner: {
    width: "100%",
    height: "100%",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    padding: 15,
    overflowY: "auto",
    overflowX: "hidden",
    scrollbarWidth: "thin",
    boxSizing: "border-box",
  },

  logo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    paddingBottom: 16,
    marginBottom: 8,
    borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
  },

  logoBox: {
    width: 40,
    height: 40,
    minWidth: 40,
    background: "linear-gradient(135deg, #22c55e, #15803d)",
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    flexShrink: 0,
  },

  logoText: {
    minWidth: 0,
  },

  title: {
    fontWeight: 850,
    fontSize: 15,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
  },

  subtitle: {
    fontSize: 11,
    opacity: 0.75,
    marginTop: 3,
    lineHeight: 1.3,
  },

  sectionWrap: {
    marginTop: 12,
  },

  section: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.5,
    opacity: 0.55,
  },

  item: {
    width: "100%",
    padding: "10px 12px",
    margin: "4px 0",
    borderRadius: 9,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.3,
    transition: "background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease",
    userSelect: "none",
    outline: "none",
    boxSizing: "border-box",
  },

  sidebarFooter: {
    width: "100%",
    marginTop: "auto",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    gap: 11,
    border: "1px solid rgba(255, 255, 255, 0.15)",
    borderRadius: 16,
    background: "rgba(255, 255, 255, 0.05)",
    boxSizing: "border-box",
  },

  footerUserRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  footerAvatar: {
    width: 38,
    height: 38,
    minWidth: 38,
    borderRadius: "50%",
    background: "#ffffff",
    color: "#111827",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    flexShrink: 0,
  },

  footerText: {
    minWidth: 0,
  },

  footerName: {
    fontSize: 13,
    fontWeight: 850,
  },

  footerSub: {
    marginTop: 2,
    fontSize: 11,
    opacity: 0.7,
  },

  logoutButton: {
    width: "100%",
    minHeight: 38,
    padding: "8px 12px",
    border: "1px solid rgba(248, 113, 113, 0.45)",
    borderRadius: 10,
    background: "rgba(239, 68, 68, 0.12)",
    color: "#fecaca",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    fontFamily: "inherit",
    fontSize: 12,
    fontWeight: 850,
    lineHeight: 1.2,
    cursor: "pointer",
    transition:
      "background 0.2s ease, border-color 0.2s ease, transform 0.2s ease",
    boxSizing: "border-box",
  },

  logoutIcon: {
    fontSize: 16,
    lineHeight: 1,
  },
};