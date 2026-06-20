import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { generateToken, UserRole } from "../middleware/auth.js";
import { db } from "../db/drizzle.js";
import { users } from "../db/schema.js";

// Which roles are allowed to self-register vs. must be created by an admin
const SELF_REGISTER_ROLES: UserRole[] = [
  "accountant",
  "agent_commercial",
  "distributor",
  "technique",
];

export const authService = {
  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    signature: string,
    role: UserRole = "accountant", // default role
    requestingUserRole?: UserRole, // role of whoever is creating this account
  ) {
    // Only admins can create admin or distributor accounts
    const privilegedRoles: UserRole[] = ["admin", "distributor", "technique"];
    if (privilegedRoles.includes(role) && requestingUserRole !== "admin") {
      throw new Error(`Only admins can create accounts with role "${role}"`);
    }

    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (existingUser.length > 0) {
      throw new Error("User already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db
      .insert(users)
      .values({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        signature,
        role,
      })
      .returning();

    const user = result[0];
    const token = generateToken(String(user.id), user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role as UserRole,
        signature: user.signature,
      },
      token,
    };
  },

  async login(email: string, password: string) {
    const userList = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (userList.length === 0) throw new Error("Invalid credentials");

    const user = userList[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) throw new Error("Invalid credentials");

    const token = generateToken(String(user.id), user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role as UserRole,
        signature: user.signature,
      },
      token,
    };
  },

  async getUserById(userId: string) {
    const userList = await db.select().from(users).where(eq(users.id, userId));
    if (userList.length === 0) throw new Error("User not found");

    const user = userList[0];
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      company: user.company,
      phone: user.phone,
      signature: user.signature,
      role: user.role as UserRole,
    };
  },

  /** Admin-only: list all users */
  async listUsers() {
    return db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users);
  },

  /** Admin-only: change any user's role */
  async changeUserRole(targetUserId: string, newRole: UserRole) {
    const result = await db
      .update(users)
      .set({ role: newRole, updatedAt: new Date() })
      .where(eq(users.id, targetUserId))
      .returning();

    if (result.length === 0) throw new Error("User not found");

    return {
      id: result[0].id,
      email: result[0].email,
      firstName: result[0].firstName,
      lastName: result[0].lastName,
      role: result[0].role as UserRole,
    };
  },
};
