import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";

const API = "http://localhost:3000/api";
const SERVER = "http://localhost:3000";

const DEFAULT_PENYULUH_ID = 6;

const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

const normalizeStatus = (status = "") => {
  const raw = String(status || "").toLowerCase();

  if (raw.includes("selesai") || raw.includes("closed") || raw.includes("done")) {
    return "selesai";
  }

  if (
    raw.includes("dibalas") ||
    raw.includes("balas") ||
    raw.includes("sedang") ||
    raw.includes("ditangani") ||
    raw.includes("proses") ||
    raw.includes("process")
  ) {
    return "dibalas";
  }

  return "menunggu";
};

const hasReply = (item) => {
  const status = normalizeStatus(item?.status);

  return Boolean(
    item?.pesan_terakhir && (status === "dibalas" || status === "selesai")
  );
};

const isSelesai = (item) => normalizeStatus(item?.status) === "selesai";

const getStatusLabel = (item) => {
  if (isSelesai(item)) return "Selesai";
  if (hasReply(item)) return "Ada Balasan";
  return "Menunggu Balasan";
};

const getStatusStyle = (item) => {
  if (isSelesai(item)) {
    return {
      background: "#e5e7eb",
      color: "#374151",
      border: "1px solid #d1d5db",
    };
  }

  if (hasReply(item)) {
    return {
      background: "#dcfce7",
      color: "#047857",
      border: "1px solid #86efac",
    };
  }

  return {
    background: "#fef3c7",
    color: "#92400e",
    border: "1px solid #fde68a",
  };
};

const getMessageName = (item) => {
  const role = String(item?.sender_role || "").toLowerCase();

  if (role === "petani") return "Saya";
  if (role === "penyuluh") return item?.nama_pengirim || "Penyuluh";

  return item?.nama_pengirim || "Pengirim";
};

const getFileUrl = (url = "") => {
  if (!url) return "";
  if (String(url).startsWith("http")) return url;
  return `${SERVER}${url}`;
};

const isImageFile = (fileUrl = "", fileType = "") => {
  const lower = String(fileUrl).toLowerCase();

  return (
    String(fileType).startsWith("image/") ||
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp")
  );
};

const formatDateTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("id-ID");
};

export default function PetaniKonsultasi() {
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef(null);

  const user = getUser();

  const petaniId =
    user?.id ||
    localStorage.getItem("user_id") ||
    localStorage.getItem("petani_id");

  const penyuluhId =
    localStorage.getItem("penyuluh_id") ||
    user?.penyuluh_id ||
    DEFAULT_PENYULUH_ID;

  const lahanId = searchParams.get("lahan_id");
  const source = searchParams.get("source");

  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(null);
  const [pesanList, setPesanList] = useState([]);

  const [pesan, setPesan] = useState("");
  const [pesanAwal, setPesanAwal] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  const loadKonsultasi = async (preferredSelectedId = null) => {
    if (!petaniId) return;

    try {
      const res = await axios.get(`${API}/konsultasi/petani/${petaniId}`);
      const data = normalizeList(res.data);

      setList(data);

      if (data.length === 0) {
        setSelected(null);
        return;
      }

      const draft = localStorage.getItem("draft_konsultasi_pupuk");
      const targetId = preferredSelectedId || selected?.id;

      const selectedById = targetId
        ? data.find((item) => Number(item.id) === Number(targetId))
        : null;

      const selectedByLahan = lahanId
        ? data.find((item) => Number(item.lahan_id) === Number(lahanId))
        : null;

      if (selectedById) {
        setSelected(selectedById);
        return;
      }

      if (selectedByLahan) {
        setSelected(selectedByLahan);
        return;
      }

      if (draft && source === "rekomendasi-pupuk") {
        setSelected(null);
        return;
      }

      setSelected(data[0]);
    } catch (err) {
      console.log("ERROR LOAD KONSULTASI:", err.response?.data || err.message);
      setList([]);
      setSelected(null);
    }
  };

  const loadPesan = async (konsultasiId) => {
    if (!konsultasiId) return;

    try {
      const res = await axios.get(`${API}/konsultasi/${konsultasiId}/pesan`);
      setPesanList(normalizeList(res.data));
    } catch (err) {
      console.log("ERROR LOAD PESAN:", err.response?.data || err.message);
      setPesanList([]);
    }
  };

  useEffect(() => {
    if (!petaniId) return;

    loadKonsultasi();

    const interval = setInterval(() => {
      loadKonsultasi(selected?.id);
    }, 5000);

    return () => clearInterval(interval);
  }, [petaniId, lahanId, selected?.id]);

  useEffect(() => {
    if (!selected?.id) {
      setPesanList([]);
      return;
    }

    loadPesan(selected.id);

    const interval = setInterval(() => {
      loadPesan(selected.id);
    }, 5000);

    return () => clearInterval(interval);
  }, [selected?.id]);

  useEffect(() => {
    if (draftLoaded) return;

    const draft = localStorage.getItem("draft_konsultasi_pupuk");
    const draftLahanId = localStorage.getItem("draft_konsultasi_lahan_id");

    const isSameLahan =
      !draftLahanId || !lahanId || String(draftLahanId) === String(lahanId);

    if (draft && isSameLahan) {
      setPesanAwal(draft);
      setDraftLoaded(true);
    }
  }, [draftLoaded, lahanId]);

  const buatKonsultasi = async () => {
    if (!petaniId) {
      alert("User petani belum terbaca. Silakan login ulang.");
      return;
    }

    if (!penyuluhId) {
      alert("Penyuluh tujuan belum terbaca.");
      return;
    }

    if (!pesanAwal.trim()) {
      alert("Isi pesan konsultasi terlebih dahulu");
      return;
    }

    try {
      setLoading(true);

      const draftLahanId = localStorage.getItem("draft_konsultasi_lahan_id");
      const finalLahanId = draftLahanId || lahanId || selected?.lahan_id || null;

      const res = await axios.post(`${API}/konsultasi`, {
        petani_id: petaniId,
        penyuluh_id: penyuluhId,
        lahan_id: finalLahanId,
        pesan: pesanAwal,
      });

      setPesanAwal("");

      localStorage.removeItem("draft_konsultasi_pupuk");
      localStorage.removeItem("draft_konsultasi_lahan_id");

      const newKonsultasi = res.data?.data;

      await loadKonsultasi(newKonsultasi?.id);

      if (newKonsultasi?.id) {
        await loadPesan(newKonsultasi.id);
      }
    } catch (err) {
      console.log("ERROR BUAT KONSULTASI:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Gagal membuat konsultasi");
    } finally {
      setLoading(false);
    }
  };

  const kirimPesan = async () => {
    if (!selected?.id) {
      alert("Pilih konsultasi terlebih dahulu");
      return;
    }

    if (!pesan.trim() && !selectedFile) {
      alert("Pesan atau lampiran tidak boleh kosong");
      return;
    }

    try {
      setSending(true);

      if (selectedFile) {
        const formData = new FormData();

        formData.append("sender_id", petaniId);
        formData.append("sender_role", "petani");
        formData.append("pesan", pesan);
        formData.append("file", selectedFile);

        await axios.post(
          `${API}/konsultasi/${selected.id}/pesan/upload`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );
      } else {
        await axios.post(`${API}/konsultasi/${selected.id}/pesan`, {
          sender_id: petaniId,
          sender_role: "petani",
          pesan,
        });
      }

      setPesan("");
      setSelectedFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await loadPesan(selected.id);
      await loadKonsultasi(selected.id);
    } catch (err) {
      console.log("ERROR KIRIM PESAN:", err.response?.data || err.message);
      alert(err.response?.data?.message || "Gagal mengirim pesan");
    } finally {
      setSending(false);
    }
  };

  const refreshKonsultasi = async () => {
    await loadKonsultasi(selected?.id);

    if (selected?.id) {
      await loadPesan(selected.id);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1>👨‍🌾 Konsultasi Penyuluh</h1>
          <p>
            Kirim pertanyaan terkait kondisi tanaman, pupuk, hama, atau hasil
            monitoring.
          </p>
        </div>

        <button onClick={refreshKonsultasi} style={styles.refreshButton}>
          🔄 Refresh
        </button>
      </div>

      <div style={styles.layout}>
        <aside style={styles.leftPanel}>
          <h3>Daftar Konsultasi</h3>

          <div style={styles.newBox}>
            <textarea
              value={pesanAwal}
              onChange={(e) => setPesanAwal(e.target.value)}
              placeholder="Contoh: Pak, tanaman saya berisiko Blast tinggi. Apa tindakan yang harus dilakukan?"
              style={styles.textarea}
            />

            <button
              onClick={buatKonsultasi}
              disabled={loading}
              style={{
                ...styles.primaryButton,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Membuat..." : "Buat Konsultasi"}
            </button>
          </div>

          <div style={styles.listBox}>
            {list.length === 0 ? (
              <p style={styles.muted}>Belum ada konsultasi.</p>
            ) : (
              list.map((item) => {
                const reply = hasReply(item);
                const active = Number(selected?.id) === Number(item.id);

                return (
                  <button
                    key={item.id}
                    onClick={() => setSelected(item)}
                    style={{
                      ...styles.chatItem,
                      borderColor: active ? "#16a34a" : "#e5e7eb",
                      background: active ? "#ecfdf5" : "#ffffff",
                    }}
                  >
                    <div style={styles.chatItemTop}>
                      <strong>{item.nama_lahan || "Konsultasi Tanaman"}</strong>

                      <span
                        style={{
                          ...styles.statusBadge,
                          ...getStatusStyle(item),
                        }}
                      >
                        {reply ? "● " : ""}
                        {getStatusLabel(item)}
                      </span>
                    </div>

                    <small style={styles.lastMessage}>
                      {item.pesan_terakhir || "Belum ada pesan"}
                    </small>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <main style={styles.chatPanel}>
          {selected ? (
            <>
              <div style={styles.chatHeader}>
                <div>
                  <h3>{selected.nama_lahan || "Konsultasi Tanaman"}</h3>
                  <p>
                    Penyuluh: {selected.nama_penyuluh || "Penyuluh"} · Status:{" "}
                    <span
                      style={{
                        ...styles.statusBadge,
                        ...getStatusStyle(selected),
                      }}
                    >
                      {getStatusLabel(selected)}
                    </span>
                  </p>
                </div>
              </div>

              {hasReply(selected) && (
                <div style={styles.replyNotice}>
                  ✅ Penyuluh sudah membalas konsultasi ini. Silakan baca
                  balasan di ruang chat.
                </div>
              )}

              <div style={styles.messageArea}>
                {pesanList.length === 0 ? (
                  <div style={styles.emptyMessage}>
                    Belum ada pesan dalam konsultasi ini.
                  </div>
                ) : (
                  pesanList.map((item) => {
                    const isMe =
                      String(item.sender_role || "").toLowerCase() ===
                      "petani";

                    const fileUrl = item.file_url || "";
                    const finalFileUrl = getFileUrl(fileUrl);
                    const isImage = isImageFile(fileUrl, item.file_type);

                    return (
                      <div
                        key={item.id}
                        style={{
                          ...styles.messageBubble,
                          alignSelf: isMe ? "flex-end" : "flex-start",
                          background: isMe ? "#047857" : "#f1f5f9",
                          color: isMe ? "#ffffff" : "#111827",
                        }}
                      >
                        <strong>{getMessageName(item)}</strong>

                        {item.pesan && <p>{item.pesan}</p>}

                        {fileUrl && isImage && (
                          <a
                            href={finalFileUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <img
                              src={finalFileUrl}
                              alt={item.file_name || "Lampiran"}
                              style={styles.chatImage}
                            />
                          </a>
                        )}

                        {fileUrl && !isImage && (
                          <a
                            href={finalFileUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              ...styles.fileLink,
                              color: isMe ? "#ffffff" : "#047857",
                              background: isMe
                                ? "rgba(255,255,255,.14)"
                                : "#ffffff",
                            }}
                          >
                            📎 {item.file_name || "Lampiran Konsultasi"}
                          </a>
                        )}

                        <small>{formatDateTime(item.created_at)}</small>
                      </div>
                    );
                  })
                )}
              </div>

              {selectedFile && (
                <div style={styles.filePreview}>
                  <span>📎 {selectedFile.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    ×
                  </button>
                </div>
              )}

              <div style={styles.inputRow}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setSelectedFile(file);
                  }}
                />

                <button
                  type="button"
                  style={styles.attachButton}
                  onClick={() => fileInputRef.current?.click()}
                >
                  📎
                </button>

                <input
                  value={pesan}
                  onChange={(e) => setPesan(e.target.value)}
                  placeholder="Tulis pesan..."
                  style={styles.input}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") kirimPesan();
                  }}
                />

                <button
                  onClick={kirimPesan}
                  disabled={sending}
                  style={{
                    ...styles.primaryButton,
                    opacity: sending ? 0.7 : 1,
                    cursor: sending ? "not-allowed" : "pointer",
                  }}
                >
                  {sending ? "..." : "Kirim"}
                </button>
              </div>
            </>
          ) : (
            <div style={styles.emptyChat}>
              Buat konsultasi baru atau pilih konsultasi yang sudah ada.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: 24,
    background: "#f8fafc",
    fontFamily: "Inter, Arial, sans-serif",
  },

  header: {
    marginBottom: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },

  refreshButton: {
    border: "1px solid #16a34a",
    background: "#ecfdf5",
    color: "#047857",
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },

  layout: {
    display: "grid",
    gridTemplateColumns: "360px 1fr",
    gap: 18,
  },

  leftPanel: {
    background: "#ffffff",
    borderRadius: 14,
    padding: 18,
    boxShadow: "0 10px 28px rgba(15,23,42,.08)",
    border: "1px solid #e5e7eb",
  },

  newBox: {
    display: "grid",
    gap: 10,
    marginBottom: 18,
  },

  textarea: {
    width: "100%",
    minHeight: 150,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: 12,
    resize: "vertical",
    boxSizing: "border-box",
    outline: "none",
    lineHeight: 1.5,
    fontFamily: "Inter, Arial, sans-serif",
  },

  primaryButton: {
    border: "none",
    background: "#047857",
    color: "#ffffff",
    borderRadius: 10,
    padding: "11px 16px",
    fontWeight: 800,
    cursor: "pointer",
  },

  listBox: {
    display: "grid",
    gap: 10,
  },

  chatItem: {
    textAlign: "left",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
    display: "grid",
    gap: 8,
    cursor: "pointer",
  },

  chatItemTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },

  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  lastMessage: {
    color: "#475569",
    lineHeight: 1.4,
  },

  replyNotice: {
    margin: "12px 18px 0",
    padding: "12px 14px",
    borderRadius: 10,
    background: "#ecfdf5",
    border: "1px solid #86efac",
    color: "#047857",
    fontWeight: 700,
  },

  muted: {
    color: "#64748b",
  },

  chatPanel: {
    background: "#ffffff",
    borderRadius: 14,
    minHeight: 620,
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 10px 28px rgba(15,23,42,.08)",
    border: "1px solid #e5e7eb",
  },

  chatHeader: {
    padding: 18,
    borderBottom: "1px solid #e5e7eb",
  },

  messageArea: {
    flex: 1,
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    overflowY: "auto",
  },

  messageBubble: {
    maxWidth: "68%",
    padding: 12,
    borderRadius: 14,
    lineHeight: 1.45,
  },

  chatImage: {
    display: "block",
    marginTop: 10,
    maxWidth: 260,
    maxHeight: 220,
    borderRadius: 10,
    objectFit: "cover",
  },

  fileLink: {
    display: "block",
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    fontWeight: 800,
    textDecoration: "none",
  },

  emptyMessage: {
    height: "100%",
    minHeight: 260,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748b",
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
    background: "#f8fafc",
  },

  filePreview: {
    margin: "0 18px 10px",
    padding: "10px 12px",
    background: "#ecfdf5",
    border: "1px solid #86efac",
    color: "#047857",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    fontWeight: 800,
  },

  inputRow: {
    display: "flex",
    gap: 10,
    padding: 18,
    borderTop: "1px solid #e5e7eb",
  },

  attachButton: {
    width: 44,
    border: "1px solid #d1d5db",
    background: "#ffffff",
    borderRadius: 10,
    cursor: "pointer",
  },

  input: {
    flex: 1,
    border: "1px solid #d1d5db",
    borderRadius: 10,
    padding: "0 12px",
    outline: "none",
  },

  emptyChat: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748b",
  },
};