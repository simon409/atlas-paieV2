import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Company } from "../db/models.ts";
import {
  listCompanies,
  setActiveCompanyId,
} from "../db/companyStore.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CompanyContextValue {
  /** All companies in the database */
  companies: Company[];
  /** The currently active company, null only while loading */
  activeCompany: Company | null;
  /** Shortcut for activeCompany?.id */
  activeCompanyId: string | null;
  loading: boolean;
  error: string;
  /**
   * Switch the active company. Persists the selection to localStorage and
   * updates the context immediately — no page reload needed.
   */
  setActiveCompany: (companyId: string) => void;
  /** Force a re-fetch from SQLite (e.g. after creating a new company) */
  refresh: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const CompanyContext = createContext<CompanyContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompanyState] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const allCompanies = await listCompanies();
      const raw = localStorage.getItem("atlas-paie.active-company-id");
      const storedId = raw && raw !== "undefined" ? raw : allCompanies[0]?.id || "";
      const current = allCompanies.find((c) => c.id === storedId) ?? allCompanies[0] ?? null;
      if (storedId && storedId !== raw) {
        setActiveCompanyId(storedId);
      }
      setCompanies(allCompanies);
      setActiveCompanyState(current);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load company data."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setActiveCompany = useCallback(
    (companyId: string) => {
      setActiveCompanyId(companyId);
      const found = companies.find((c) => c.id === companyId) ?? null;
      setActiveCompanyState(found);
    },
    [companies]
  );

  return (
    <CompanyContext.Provider
      value={{
        companies,
        activeCompany,
        activeCompanyId: activeCompany?.id ?? null,
        loading,
        error,
        setActiveCompany,
        refresh,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * useCompany
 *
 * Returns the global active-company state. Must be used inside a
 * <CompanyProvider> (already wrapped at the app root).
 *
 * Example:
 *   const { activeCompany, activeCompanyId, setActiveCompany } = useCompany();
 */
export function useCompany(): CompanyContextValue {
  const ctx = useContext(CompanyContext);
  if (!ctx) {
    throw new Error("useCompany must be used inside <CompanyProvider>.");
  }
  return ctx;
}
