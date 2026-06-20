import { Router, Request, Response } from "express";
import { authService } from "../services/authService.js";
import {
  authMiddleware,
  AuthRequest,
  requireRole,
} from "../middleware/auth.js";
import { z, ZodError } from "zod";

const router: Router = Router();

// ─── Validation Schemas ──────────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  signature: z.string().min(1),
  // Role is optional on public registration; admins can pass any role
  role: z
    .enum([
      "admin",
      "accountant",
      "agent_commercial",
      "distributor",
      "technique",
    ])
    .optional()
    .default("accountant"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const changeRoleSchema = z.object({
  role: z.enum([
    "admin",
    "accountant",
    "agent_commercial",
    "distributor",
    "technique",
  ]),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function handleZodError(error: ZodError, res: Response) {
  res.status(422).json({
    error: "Validation failed",
    details: error.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    })),
  });
}

// ─── Public Routes ────────────────────────────────────────────────────────────

/**
 * POST /auth/register
 * Public: creates accountant or agent_commercial accounts.
 * Privileged roles (admin, distributor) require a valid admin token.
 */
router.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const data = registerSchema.parse(req.body);

    // Peek at the auth header — if provided and valid, pass the requester's role
    let requestingUserRole: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const { verifyToken } = await import("../middleware/auth.js");
        const payload = verifyToken(authHeader.split(" ")[1]);
        requestingUserRole = payload?.role;
      } catch {
        // ignore — treated as unauthenticated
      }
    }

    const result = await authService.register(
      data.email,
      data.password,
      data.firstName,
      data.lastName,
      data.signature,
      data.role,
      requestingUserRole as any,
    );

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      handleZodError(error, res);
      return;
    }
    res.status(400).json({
      error: error instanceof Error ? error.message : "Registration failed",
    });
  }
});

/**
 * POST /auth/login
 */
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await authService.login(data.email, data.password);
    res.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      handleZodError(error, res);
      return;
    }
    res
      .status(401)
      .json({ error: error instanceof Error ? error.message : "Login failed" });
  }
});

// ─── Authenticated Routes ─────────────────────────────────────────────────────

/**
 * GET /auth/me
 */
router.get(
  "/me",
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = await authService.getUserById(req.userId!);
      res.json(user);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  },
);

// ─── Admin-only Routes ────────────────────────────────────────────────────────

/**
 * GET /auth/admin/users
 * List all users (admin only).
 */
router.get(
  "/admin/users",
  authMiddleware,
  requireRole("admin"),
  async (_req: AuthRequest, res: Response): Promise<void> => {
    const userList = await authService.listUsers();
    res.json(userList);
  },
);

/**
 * PATCH /auth/admin/users/:userId/role
 * Change a user's role (admin only).
 *
 * Body: { role: "admin" | "accountant" | "agent_commercial" | "distributor" }
 */
router.patch(
  "/admin/users/:userId/role",
  authMiddleware,
  requireRole("admin"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const { role } = changeRoleSchema.parse(req.body);

      // Prevent self-demotion
      if (userId === req.userId) {
        res.status(400).json({ error: "Admins cannot change their own role" });
        return;
      }

      const updated = await authService.changeUserRole(userId, role);
      res.json(updated);
    } catch (error) {
      if (error instanceof ZodError) {
        handleZodError(error, res);
        return;
      }
      res.status(400).json({
        error: error instanceof Error ? error.message : "Role update failed",
      });
    }
  },
);

/**
 * GET /auth/admin/dashboard  (kept from your original)
 */
router.get(
  "/admin/dashboard",
  authMiddleware,
  requireRole("admin"),
  (_req: AuthRequest, res: Response): void => {
    res.json({ message: "Welcome admin" });
  },
);

export default router;
