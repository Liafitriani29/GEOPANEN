import Sidebar from "../components/Sidebar";
import { Outlet } from "react-router-dom";

export default function PetaniLayout() {
  return (
    <div style={{ display: "flex" }}>
      <Sidebar role="petani" />

      <div style={{ flex: 1, padding: 20 }}>
        <Outlet />
      </div>
    </div>
  );
}