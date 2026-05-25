import { useCallback, useEffect, useState } from "react";
import type { Company } from "../db/models.ts";
import {
  getActiveCompany,
  listCompanies,
  setActiveCompanyId,
} from "../db/companyStore.ts";

export interface UseActiveCompanyResult {
  /** All companies stored in the database */
  companies: Company[];
  /** The currently active company (null while loading) */
  activeCompany: Company | null;
  /** Convenience shortcut – the active company's ID string */
  activeCompanyId: string | null;
  loading: boolean;
  error: string;
  /**
   * Switch the active company.
   * Persists the choice to localStorage and updates local state immediately.
   */
  setActiveCompany: (companyId: string) => void;
  /** Re-fetch companies and active company from the database */
  refresh: () => Promise<void>;
}

/**
 * useActiveCompany
 *
 * Fetches the list of companies from SQLite and resolves the currently active
 * one (stored in localStorage via companyStore). Any page or component that
 * needs to know "which company am I working in?" should use this hook.
 *
 * Example:
 *   const { activeCompany, activeCompanyId, loading } = useActiveCompany();
 */
export function useActiveCompany(): UseActiveCompanyResult {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompanyState] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [allCompanies, current] = await Promise.all([
        listCompanies(),
        getActiveCompany(),
      ]);
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

  return {
    companies,
    activeCompany,
    activeCompanyId: activeCompany?.id ?? null,
    loading,
    error,
    setActiveCompany,
    refresh,
  };
}
