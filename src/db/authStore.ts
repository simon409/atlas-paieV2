import { eq } from "drizzle-orm";
import { getDrizzleDb, setupDatabase } from "./client.ts";
import type { AuthUser } from "../auth/auth.ts";
import type { AppUser } from "./models.ts";
import { appUsers, authSessions } from "./schema.ts";
import { ensureDefaultCompany } from "./companyStore.ts";

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return `${btoa(String.fromCharCode(...salt))}:${btoa(String.fromCharCode(...new Uint8Array(hash)))}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltB64, hashB64] = stored.split(":");
  const salt = new Uint8Array(atob(saltB64).split("").map((c) => c.charCodeAt(0)));
  const expected = new Uint8Array(atob(hashB64).split("").map((c) => c.charCodeAt(0)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hash = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
      key,
      256,
    ),
  );
  return hash.length === expected.length && hash.every((v, i) => v === expected[i]);
}

async function sha256Hex(data: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type AppUserRow = typeof appUsers.$inferSelect;

function fromUserRow(row: AppUserRow): AppUser {
  return {
    id: row.id,
    companyId: row.companyId,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt,
    lastLoginAt: row.lastLoginAt ?? null,
  };
}

export async function seedDefaultAdmin(): Promise<void> {
  await setupDatabase();
  const existing = await getDrizzleDb().select().from(appUsers).limit(1).get();
  if (existing) return;

  const company = await ensureDefaultCompany();
  const hash = await hashPassword("admin");

  await getDrizzleDb()
    .insert(appUsers)
    .values({
      id: crypto.randomUUID(),
      companyId: company.id,
      email: "admin@atlas.local",
      passwordHash: hash,
      fullName: "Atlas Admin",
      role: "ADMIN",
      status: "ACTIVE",
      createdAt: new Date(),
      lastLoginAt: null,
    })
    .run();
}

export async function authenticateUser(
  email: string,
  password: string,
): Promise<{ user: AuthUser; token: string }> {
  await seedDefaultAdmin();

  const row = await getDrizzleDb()
    .select()
    .from(appUsers)
    .where(eq(appUsers.email, email.trim().toLowerCase()))
    .get();
  if (!row) throw new Error("Email ou mot de passe incorrect");
  if (row.status !== "ACTIVE") throw new Error("Compte désactivé");

  const valid = await verifyPassword(password, row.passwordHash);
  if (!valid) throw new Error("Email ou mot de passe incorrect");

  const token = crypto.randomUUID();
  const tokenHash = await sha256Hex(token);
  const now = new Date();

  await getDrizzleDb()
    .insert(authSessions)
    .values({
      id: crypto.randomUUID(),
      userId: row.id,
      tokenHash,
      expiresAt: new Date(now.getTime() + SESSION_DURATION_MS),
      createdAt: now,
      revokedAt: null,
    })
    .run();

  await getDrizzleDb()
    .update(appUsers)
    .set({ lastLoginAt: now })
    .where(eq(appUsers.id, row.id))
    .run();

  return {
    user: {
      id: row.id,
      email: row.email,
      fullName: row.fullName,
      role: row.role as "ADMIN" | "MANAGER" | "VIEWER",
      companyId: row.companyId,
    },
    token,
  };
}

export async function validateSessionToken(
  token: string,
): Promise<{ user: AuthUser; expiresAt: Date } | null> {
  if (!token) return null;
  const tokenHash = await sha256Hex(token);

  const session = await getDrizzleDb()
    .select()
    .from(authSessions)
    .where(eq(authSessions.tokenHash, tokenHash))
    .get();
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;

  const user = await getDrizzleDb()
    .select()
    .from(appUsers)
    .where(eq(appUsers.id, session.userId))
    .get();
  if (!user || user.status !== "ACTIVE") return null;

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role as "ADMIN" | "MANAGER" | "VIEWER",
      companyId: user.companyId,
    },
    expiresAt: session.expiresAt,
  };
}

export async function revokeSession(token: string): Promise<void> {
  if (!token) return;
  const tokenHash = await sha256Hex(token);
  await getDrizzleDb()
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(eq(authSessions.tokenHash, tokenHash))
    .run();
}

export async function listUsers(companyId: string): Promise<AppUser[]> {
  await setupDatabase();
  const rows = await getDrizzleDb()
    .select()
    .from(appUsers)
    .where(eq(appUsers.companyId, companyId))
    .all();
  return rows.map(fromUserRow);
}

export async function createUser(draft: {
  companyId: string;
  email: string;
  password: string;
  fullName: string;
  role: string;
}): Promise<AppUser> {
  await setupDatabase();
  const hash = await hashPassword(draft.password);

  const user: AppUser = {
    id: crypto.randomUUID(),
    companyId: draft.companyId,
    email: draft.email.trim().toLowerCase(),
    fullName: draft.fullName.trim(),
    role: draft.role,
    status: "ACTIVE",
    createdAt: new Date(),
    lastLoginAt: null,
  };

  await getDrizzleDb()
    .insert(appUsers)
    .values({
      id: user.id,
      companyId: user.companyId,
      email: user.email,
      passwordHash: hash,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      lastLoginAt: null,
    })
    .run();

  return user;
}
