import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export type UserRole =
  | "admin"
  | "accountant"
  | "agent_commercial"
  | "distributor"
  | "technique";

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  userRole?: UserRole;
}

interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export const generateToken = (
  userId: string,
  email: string,
  role: string,
): string => {
  return jwt.sign({ userId, email, role }, JWT_SECRET, { expiresIn: "7d" });
};

/** Verifies a raw JWT string and returns its payload, or null if invalid. */
export const verifyToken = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
};

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "No token provided" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.userRole = decoded.role;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

/**
 * Accepts one or more roles. Pass a single role or an array.
 * Usage:
 *   requireRole("admin")
 *   requireRole(["admin", "accountant"])
 */
export const requireRole = (allowed: UserRole | UserRole[]) => {
  const allowedRoles = Array.isArray(allowed) ? allowed : [allowed];

  return (req: AuthRequest, res: Response, next: NextFunction): void => {
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
