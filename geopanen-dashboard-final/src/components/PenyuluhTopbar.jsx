import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API = "http://localhost:3000/api";

export default function PenyuluhTopbar() {
  const [weather, setWeather] = useState({
    tanggal: "-",
    suhu: 28,
    suhu_label: "28°C",
    kondisi: "Cerah",
    icon: "☀️",
  });

  const [notifCount, setNotifCount] = useState(0);

  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const nama =
    storedUser?.nama ||
    localStorage.getItem("nama") ||
    "Penyuluh";

  const userId =
    storedUser?.id ||
    localStorage.getItem("user_id") ||
    localStorage.getItem("penyuluh_id");

  const loadWeather = async () => {
    try {
      const res = await axios.get(`${API}/weather`);
      const data = res.data?.data || {};

      setWeather({
        tanggal: data.tanggal || getTanggalHariIni(),
        suhu: data.suhu || 28,
        suhu_label: data.suhu_label || `${data.suhu || 28}°C`,
        kondisi: data.kondisi || "Cerah",
        icon: data.icon || "☀️",
      });
    } catch (err) {
      console.log("ERROR LOAD WEATHER:", err.response?.data || err.message);

      setWeather({
        tanggal: getTanggalHariIni(),
        suhu: 28,
        suhu_label: "28°C",
        kondisi: "Cerah",
        icon: "☀️",
      });
    }
  };

  const loadNotifCount = async () => {
    try {
      if (!userId) return;

      const res = await axios.get(`${API}/notifikasi/count`, {
        params: {
          user_id: userId,
          role: "penyuluh",
        },
      });

      setNotifCount(res.data?.total || 0);
    } catch (err) {
      console.log("ERROR LOAD NOTIF:", err.response?.data || err.message);
      setNotifCount(0);
    }
  };

  useEffect(() => {
    loadWeather();
    loadNotifCount();

    const interval = setInterval(() => {
      loadWeather();
      loadNotifCount();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={styles.topbar}>
      <div style={styles.rightArea}>
        <div style={styles.dateBox}>
          <span style={styles.dateIcon}>📅</span>
          <strong style={styles.dateText}>{weather.tanggal}</strong>
        </div>

        <div style={styles.weatherBox}>
          <span style={styles.weatherIcon}>{weather.icon}</span>

          <div style={styles.weatherTextBox}>
            <strong style={styles.weatherTemp}>{weather.suhu_label}</strong>
            <span style={styles.weatherCondition}>{weather.kondisi}</span>
          </div>
        </div>

        <div style={styles.notifBox}>
          <span style={styles.notifIcon}>🔔</span>

          {notifCount > 0 && (
            <b style={styles.notifBadge}>{notifCount}</b>
          )}
        </div>

        <div style={styles.profileBox}>
          <div style={styles.avatar}>👨‍🌾</div>

          <div style={styles.profileTextBox}>
            <strong style={styles.profileName}>{nama}</strong>
            <span style={styles.profileRole}>Penyuluh</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function getTanggalHariIni() {
  return new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const styles = {
  topbar: {
    width: "100%",
    minHeight: 58,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 18,
    boxSizing: "border-box",
  },

  rightArea: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  },

  dateBox: {
    height: 46,
    minWidth: 150,
    padding: "0 14px",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxSizing: "border-box",
    boxShadow: "0 8px 22px rgba(15, 23, 42, 0.04)",
  },

  dateIcon: {
    fontSize: 14,
    lineHeight: 1,
  },

  dateText: {
    fontSize: 13,
    fontWeight: 800,
    color: "#0f172a",
    lineHeight: 1,
    whiteSpace: "nowrap",
  },

  weatherBox: {
    height: 46,
    minWidth: 135,
    padding: "0 12px",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    boxSizing: "border-box",
    boxShadow: "0 8px 22px rgba(15, 23, 42, 0.04)",
  },

  weatherIcon: {
    width: 26,
    height: 26,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    lineHeight: 1,
    flexShrink: 0,
  },

  weatherTextBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 3,
    lineHeight: 1,
  },

  weatherTemp: {
    margin: 0,
    padding: 0,
    fontSize: 13,
    fontWeight: 900,
    color: "#0f172a",
    lineHeight: 1,
    whiteSpace: "nowrap",
  },

  weatherCondition: {
    margin: 0,
    padding: 0,
    fontSize: 12,
    fontWeight: 500,
    color: "#334155",
    lineHeight: 1,
    whiteSpace: "nowrap",
  },

  notifBox: {
    width: 46,
    height: 46,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    boxSizing: "border-box",
    boxShadow: "0 8px 22px rgba(15, 23, 42, 0.04)",
  },

  notifIcon: {
    fontSize: 18,
    lineHeight: 1,
  },

  notifBadge: {
    position: "absolute",
    top: -7,
    right: -7,
    minWidth: 20,
    height: 20,
    borderRadius: 999,
    background: "#ef4444",
    color: "#ffffff",
    fontSize: 10,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 5px",
    lineHeight: 1,
    boxSizing: "border-box",
    border: "2px solid #ffffff",
  },

  profileBox: {
    height: 46,
    minWidth: 130,
    padding: "0 12px",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    boxSizing: "border-box",
    boxShadow: "0 8px 22px rgba(15, 23, 42, 0.04)",
  },

  avatar: {
    width: 30,
    height: 30,
    borderRadius: 999,
    background: "#dcfce7",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    lineHeight: 1,
    flexShrink: 0,
  },

  profileTextBox: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 3,
    lineHeight: 1,
  },

  profileName: {
    margin: 0,
    padding: 0,
    fontSize: 13,
    fontWeight: 900,
    color: "#0f172a",
    lineHeight: 1,
    whiteSpace: "nowrap",
  },

  profileRole: {
    margin: 0,
    padding: 0,
    fontSize: 12,
    fontWeight: 500,
    color: "#334155",
    lineHeight: 1,
    whiteSpace: "nowrap",
  },
};