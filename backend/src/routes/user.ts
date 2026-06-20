import { Router, Request, Response } from "express";
// adjust path to your schema
import { eq, ilike, or } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { users } from "../db/schema";
import { db } from "../db/drizzle";

const router: Router = Router();

const SALT_ROUNDS = 10;
function buildSignature(
  role: string | undefined,
  firstName: string,
  lastName: string,
): string {
  return role === "technique"
    ? "SERVICE TECHNIQUE " + firstName + " " + lastName
    : `PHARMACIENNE COMMERCIAL Dr ${firstName} ${lastName}`;
}
// ─────────────────────────────────────────────
// GET /users — Get all users (with optional search)
// ─────────────────────────────────────────────
router.get("/", async (req: Request, res: Response) => {
  try {
    const { search, role } = req.query;

    let query = db.select().from(users);

    if (search) {
      query = query.where(
        or(
          ilike(users.firstName, `%${search}%`),
          ilike(users.lastName, `%${search}%`),
          ilike(users.email, `%${search}%`),
          ilike(users.company, `%${search}%`),
        ),
      ) as typeof query;
    }

    if (role) {
      query = query.where(eq(users.role, role as string)) as typeof query;
    }

    const allUsers = await query;

    // Never return passwords
    const sanitized = allUsers.map(({ password, ...rest }) => rest);

    return res.status(200).json({ data: sanitized, total: sanitized.length });
  } catch (error) {
    console.error("[GET /users]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /users/staff — Get users where role is 'accountant' OR 'technique'
router.get("/staff", async (req: Request, res: Response) => {
  try {
    const staffUsers = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(or(eq(users.role, "agent_commercial")));

    const mapped = staffUsers.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      name: `${u.firstName} ${u.lastName}`,
    }));

    return res.status(200).json({ data: mapped, total: mapped.length });
  } catch (error) {
    console.error("[GET /users/staff]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});
// ─────────────────────────────────────────────
// GET /users/:id — Get one user by ID
// ─────────────────────────────────────────────
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [user] = await db.select().from(users).where(eq(users.id, id));

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { password, ...sanitized } = user;

    return res.status(200).json({ data: sanitized });
  } catch (error) {
    console.error("[GET /users/:id]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// POST /users — Create a new user
// ─────────────────────────────────────────────
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      company,
      role,

      phone,
    } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        message: "email, password, firstName and lastName are required",
      });
    }

    // Check for duplicate email
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (existing) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const resolvedRole = role ?? "accountant";

    const [newUser] = await db
      .insert(users)
      .values({
        id: uuidv4(),
        email,
        password: hashedPassword,
        firstName,
        lastName,
        company: company ?? null,
        role: resolvedRole,
        signature: buildSignature(resolvedRole, firstName, lastName),
        phone: phone ?? null,
      })
      .returning();

    const { password: _pw, ...sanitized } = newUser;

    return res.status(201).json({ data: sanitized });
  } catch (error) {
    console.error("[POST /users]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// PUT /users/:id — Full update of a user
// ─────────────────────────────────────────────
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      email,
      password,
      firstName,
      lastName,
      company,
      role,
      signature,
      phone,
    } = req.body;

    if (!email || !firstName || !lastName) {
      return res.status(400).json({
        message: "email, firstName and lastName are required",
      });
    }

    const [existing] = await db.select().from(users).where(eq(users.id, id));
    if (!existing) {
      return res.status(404).json({ message: "User not found" });
    }

    // If email changed, verify it's not taken by another user
    if (email !== existing.email) {
      const [emailConflict] = await db
        .select()
        .from(users)
        .where(eq(users.email, email));
      if (emailConflict) {
        return res.status(409).json({ message: "Email already in use" });
      }
    }
    const resolvedRole = role ?? existing.role;

    const updateData: Partial<typeof users.$inferInsert> = {
      email,
      firstName,
      lastName,
      company: company ?? null,
      role: resolvedRole,
      signature: signature ?? buildSignature(resolvedRole, firstName, lastName),
      phone: phone ?? null,
      updatedAt: new Date(),
    };

    if (password) {
      updateData.password = await bcrypt.hash(password, SALT_ROUNDS);
    }

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();

    const { password: _pw, ...sanitized } = updated;

    return res.status(200).json({ data: sanitized });
  } catch (error) {
    console.error("[PUT /users/:id]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// PATCH /users/:id — Partial update of a user
// ─────────────────────────────────────────────
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const fields = req.body;

    const [existing] = await db.select().from(users).where(eq(users.id, id));
    if (!existing) {
      return res.status(404).json({ message: "User not found" });
    }

    // If email is being changed, check for conflicts
    if (fields.email && fields.email !== existing.email) {
      const [emailConflict] = await db
        .select()
        .from(users)
        .where(eq(users.email, fields.email));
      if (emailConflict) {
        return res.status(409).json({ message: "Email already in use" });
      }
    }

    const allowedFields = [
      "email",
      "firstName",
      "lastName",
      "company",
      "role",
      "signature",
      "phone",
    ];

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    for (const key of allowedFields) {
      if (key in fields) {
        updateData[key] = fields[key];
      }
    }

    if (fields.password) {
      updateData.password = await bcrypt.hash(fields.password, SALT_ROUNDS);
    }

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();

    const { password: _pw, ...sanitized } = updated;

    return res.status(200).json({ data: sanitized });
  } catch (error) {
    console.error("[PATCH /users/:id]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// DELETE /users/:id — Delete a user
// ─────────────────────────────────────────────
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [existing] = await db.select().from(users).where(eq(users.id, id));
    if (!existing) {
      return res.status(404).json({ message: "User not found" });
    }

    await db.delete(users).where(eq(users.id, id));

    return res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("[DELETE /users/:id]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// POST /users/:id/change-password — Change password separately
// ─────────────────────────────────────────────
router.post("/:id/change-password", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "currentPassword and newPassword are required" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await db
      .update(users)
      .set({ password: hashed, updatedAt: new Date() })
      .where(eq(users.id, id));

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("[POST /users/:id/change-password]", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
