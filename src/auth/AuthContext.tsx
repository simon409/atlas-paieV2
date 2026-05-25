import { createContext, useContext } from "react";
import type { AuthSession } from "./auth.ts";

export const AuthContext = createContext<AuthSession | null>(null);

export function useAuth(): AuthSession {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useCanWrite(): boolean {
  const { user } = useAuth();
  return user.role === "ADMIN" || user.role === "MANAGER";
}

export function useIsAdmin(): boolean {
  const { user } = useAuth();
  return user.role === "ADMIN";
}
