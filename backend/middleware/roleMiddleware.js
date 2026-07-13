const roleMiddleware = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Unauthorized - user tidak ditemukan"
      });
    }

    if (!req.user.role) {
      return res.status(403).json({
        message: "Role tidak ada di token"
      });
    }

    if (!Array.isArray(roles)) {
      roles = [roles];
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Akses ditolak untuk role: ${req.user.role}`
      });
    }

    next();
  };
};

module.exports = roleMiddleware;