"use strict";

const db = require("../config/db");
const util = require("util");

const query = util.promisify(db.query).bind(db);

// =====================================================
// UTILITAS
// =====================================================
const normalizeText = (value) => String(value || "").trim().toLowerCase();

const resolveUserId = (req) =>
  req.user?.id ||
  req.user?.user_id ||
  req.user?.petani_id ||
  req.body?.user_id ||
  req.body?.petani_id ||
  req.query?.user_id ||
  req.query?.petani_id ||
  null;

const resolveRole = (req) =>
  normalizeText(
    req.user?.role || req.body?.role || req.query?.role || "petani"
  ) || "petani";

const parsePositiveInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
};

const sendError = (res, statusCode, message, error = null) => {
  if (error) {
    console.error(message, error);
  }

  return res.status(statusCode).json({
    status: false,
    message,
    error: error?.sqlMessage || error?.message || undefined,
  });
};

const serializeNotification = (row) => {
  const jenis = normalizeText(row?.jenis) || "informasi";
  const tingkat = ["tinggi", "sedang", "rendah"].includes(
    normalizeText(row?.tingkat)
  )
    ? normalizeText(row.tingkat)
    : "rendah";

  return {
    ...row,
    kalender_id: parsePositiveInteger(row?.kalender_id),
    monitoring_id: parsePositiveInteger(row?.monitoring_id),
    lahan_id: parsePositiveInteger(row?.lahan_id),
    jenis,
    tingkat,
    target_url: row?.target_url || row?.link || null,
    is_read: Number(row?.is_read) === 1 ? 1 : 0,
    unread: Number(row?.is_read) !== 1,
  };
};

// =====================================================
// GET NOTIFIKASI USER
// GET /api/notifikasi?user_id=...&role=petani
// =====================================================
exports.getNotifikasi = async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const role = resolveRole(req);
    const requestedLimit = Number(req.query?.limit || 50);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(100, Math.max(1, Math.floor(requestedLimit)))
      : 50;

    if (!userId) {
      return sendError(res, 400, "user_id atau petani_id wajib diisi");
    }

    const rows = await query(
      `
        SELECT
          id,
          user_id,
          kalender_id,
          monitoring_id,
          lahan_id,
          role,
          judul,
          pesan,
          jenis,
          tingkat,
          link,
          target_url,
          is_read,
          read_at,
          created_at
        FROM notifikasi
        WHERE user_id = ?
          AND role = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `,
      [userId, role, limit]
    );

    const data = (Array.isArray(rows) ? rows : []).map(
      serializeNotification
    );

    return res.json({
      status: true,
      message: "success",
      data,
      total: data.length,
      unread: data.filter((item) => item.unread).length,
      warnings: data.filter(
        (item) =>
          item.jenis === "peringatan" || item.tingkat === "tinggi"
      ).length,
    });
  } catch (error) {
    return sendError(res, 500, "Gagal mengambil notifikasi", error);
  }
};

// =====================================================
// GET JUMLAH BELUM DIBACA
// GET /api/notifikasi/unread-count?user_id=...&role=petani
// =====================================================
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const role = resolveRole(req);

    if (!userId) {
      return sendError(res, 400, "user_id atau petani_id wajib diisi");
    }

    const rows = await query(
      `
        SELECT COUNT(*) AS total
        FROM notifikasi
        WHERE user_id = ?
          AND role = ?
          AND is_read = 0
      `,
      [userId, role]
    );

    return res.json({
      status: true,
      message: "success",
      total: Number(rows?.[0]?.total || 0),
    });
  } catch (error) {
    return sendError(res, 500, "Gagal menghitung notifikasi", error);
  }
};

// =====================================================
// TANDAI SATU NOTIFIKASI DIBACA
// PUT/PATCH /api/notifikasi/:id/read
// =====================================================
exports.readNotifikasi = async (req, res) => {
  try {
    const notificationId = parsePositiveInteger(req.params?.id);
    const userId = resolveUserId(req);
    const role = resolveRole(req);

    if (!notificationId) {
      return sendError(res, 400, "ID notifikasi tidak valid");
    }

    if (!userId) {
      return sendError(res, 400, "user_id atau petani_id wajib diisi");
    }

    const result = await query(
      `
        UPDATE notifikasi
        SET
          is_read = 1,
          read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
        WHERE id = ?
          AND user_id = ?
          AND role = ?
      `,
      [notificationId, userId, role]
    );

    if (Number(result.affectedRows || 0) === 0) {
      return sendError(
        res,
        404,
        "Notifikasi tidak ditemukan atau bukan milik pengguna"
      );
    }

    return res.json({
      status: true,
      message: "Notifikasi dibaca",
      id: notificationId,
    });
  } catch (error) {
    return sendError(res, 500, "Gagal memperbarui notifikasi", error);
  }
};

// =====================================================
// TANDAI SEMUA NOTIFIKASI DIBACA
// PUT/PATCH /api/notifikasi/read-all
// =====================================================
exports.readAllNotifikasi = async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const role = resolveRole(req);

    if (!userId) {
      return sendError(res, 400, "user_id atau petani_id wajib diisi");
    }

    const result = await query(
      `
        UPDATE notifikasi
        SET
          is_read = 1,
          read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
        WHERE user_id = ?
          AND role = ?
          AND is_read = 0
      `,
      [userId, role]
    );

    return res.json({
      status: true,
      message: "Semua notifikasi dibaca",
      updated: Number(result.affectedRows || 0),
    });
  } catch (error) {
    return sendError(res, 500, "Gagal memperbarui semua notifikasi", error);
  }
};
