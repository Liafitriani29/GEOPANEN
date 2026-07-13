import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API = "http://localhost:3000/api";

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
}

export default function PetaniNotificationBell() {
  const navigate = useNavigate();
  const [count, setCount] = useState(0);

  const fetchCount = async () => {
    try {
      const user = getUser();

      const userId =
        user?.id ||
        localStorage.getItem("user_id") ||
        localStorage.getItem("petani_id");

      if (!userId) {
        setCount(0);
        return;
      }

      const res = await axios.get(`${API}/notifikasi/count`, {
        params: {
          user_id: userId,
          role: "petani",
        },
      });

      setCount(Number(res.data?.total || 0));
    } catch (err) {
      console.log("ERROR COUNT NOTIFIKASI PETANI:", err.response?.data || err.message);
      setCount(0);
    }
  };

  useEffect(() => {
    fetchCount();

    const interval = setInterval(fetchCount, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <button
      type="button"
      onClick={() => navigate("/petani/notifikasi")}
      style={styles.bellBtn}
      title="Notifikasi"
    >
      🔔

      {count > 0 && (
        <span style={styles.badge}>
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

const styles = {
  bellBtn: {
    position: "relative",
    width: 48,
    height: 48,
    border: "none",
    borderRadius: 14,
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 22,
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(15,23,42,.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  badge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    borderRadius: 999,
    background: "#ef4444",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 6px",
    border: "2px solid #ffffff",
  },
};