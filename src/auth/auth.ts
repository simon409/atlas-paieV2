export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: "ADMIN" | "MANAGER" | "VIEWER";
  companyId: string;
};

export type AuthSession = {
  user: AuthUser;
  expiresAt: number;
};

const TOKEN_KEY = "atlas-paie.session-token";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export async function login(email: string, password: string): Promise<AuthSession> {
  const { authenticateUser } = await import("../db/authStore.ts");
  const { user, token } = await authenticateUser(email, password);
  localStorage.setItem(TOKEN_KEY, token);
  return { user, expiresAt: Date.now() + 8 * 60 * 60 * 1000 };
}

export async function restoreSession(): Promise<AuthSession | null> {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const { validateSessionToken } = await import("../db/authStore.ts");
    const result = await validateSessionToken(token);
    if (!result) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return { user: result.user, expiresAt: result.expiresAt.getTime() };
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
}

export async function logout(): Promise<void> {
  const token = getStoredToken();
  if (token) {
    try {
      const { revokeSession } = await import("../db/authStore.ts");
      await revokeSession(token);
    } catch {
      // ignore
    }
  }
  localStorage.removeItem(TOKEN_KEY);
}

export function formatSessionExpiry(session: AuthSession): string {
  return new Intl.DateTimeFormat("fr-MA", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(session.expiresAt));
}
