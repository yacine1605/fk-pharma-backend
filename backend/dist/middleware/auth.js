import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error("FATAL: JWT_SECRET environment variable is not defined");
}
export const generateToken = (userId, email, role) => {
    return jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: "7d" });
};
/** Verifies a raw JWT string and returns its payload, or null if invalid. */
export const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    }
    catch {
        return null;
    }
};
export const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "No token provided" });
        return;
    }
    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        req.userEmail = decoded.email;
        req.userRole = decoded.role;
        next();
    }
    catch {
        res.status(401).json({ error: "Invalid or expired token" });
    }
};
/**
 * Accepts one or more roles. Pass a single role or an array.
 * Usage:
 *   requireRole("admin")
 *   requireRole(["admin", "accountant"])
 */
export const requireRole = (allowed) => {
    const allowedRoles = Array.isArray(allowed) ? allowed : [allowed];
    return (req, res, next) => {
        if (!req.userRole) {
            res.status(401).json({ error: "Not authenticated" });
            return;
        }
        if (!allowedRoles.includes(req.userRole)) {
            res.status(403).json({
                error: "Insufficient permissions",
                required: allowedRoles,
                current: req.userRole,
            });
            return;
        }
        next();
    };
};
//# sourceMappingURL=auth.js.map