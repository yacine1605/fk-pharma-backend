import { Request, Response, NextFunction } from "express";
export type UserRole = "admin" | "accountant" | "agent_commercial" | "distributor" | "technique";
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
export declare const generateToken: (userId: string, email: string, role: string) => string;
/** Verifies a raw JWT string and returns its payload, or null if invalid. */
export declare const verifyToken: (token: string) => JwtPayload | null;
export declare const authMiddleware: (req: AuthRequest, res: Response, next: NextFunction) => void;
/**
 * Accepts one or more roles. Pass a single role or an array.
 * Usage:
 *   requireRole("admin")
 *   requireRole(["admin", "accountant"])
 */
export declare const requireRole: (allowed: UserRole | UserRole[]) => (req: AuthRequest, res: Response, next: NextFunction) => void;
export {};
//# sourceMappingURL=auth.d.ts.map