import axios from "axios";

// ================= BASE CONFIG =================
const api = axios.create({
  baseURL: "http://localhost:3000/api",
});

// ================= AUTH INTERCEPTOR =================
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;