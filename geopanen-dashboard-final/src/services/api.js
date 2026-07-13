import axios from "axios";

// ================= BASE CONFIG =================

// Production Railway Backend
const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://geopanen-production.up.railway.app/api";

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});


// ================= AUTH INTERCEPTOR =================
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    console.log(
      "REQUEST API:",
      config.method?.toUpperCase(),
      config.baseURL + config.url
    );

    return config;
  },

  (error) => {
    return Promise.reject(error);
  }
);


// ================= RESPONSE INTERCEPTOR =================
api.interceptors.response.use(
  (response) => {
    return response;
  },

  (error) => {
    console.error(
      "API ERROR:",
      error.response?.data || error.message
    );

    return Promise.reject(error);
  }
);


export default api;