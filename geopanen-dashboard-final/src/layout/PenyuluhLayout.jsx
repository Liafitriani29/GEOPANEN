import Sidebar from "../components/Sidebar";
import { Outlet } from "react-router-dom";

export default function PenyuluhLayout() {
  return (
    <div style={styles.wrapper}>
      <Sidebar role="penyuluh" />

      <div style={styles.content}>
        <Outlet />
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    minHeight: "100vh",
    background: "#f5f6fa"
  },
  content: {
    flex: 1,
    padding: 20,
    overflow: "auto"
  }
};