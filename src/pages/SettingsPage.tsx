import { FormEvent, useEffect, useState } from "react";
import { Building2, Database, Save, Shield } from "lucide-react";
import {
  createCompany,
  getActiveCompany,
  listCompanies,
  setActiveCompanyId,
  updateCompany,
} from "../db/companyStore.ts";
import { getActiveCompanyId } from "../db/companyStore.ts";
import { getDatabaseStatus, initializeAppDatabase } from "../db/store.ts";
import { listUsers, createUser } from "../db/authStore.ts";
import type { AppUser, Company, CompanyDraft, DatabaseStatus } from "../db/models.ts";
import { useIsAdmin } from "../auth/AuthContext.tsx";

const emptyCompanyDraft: CompanyDraft = {
  name: "",
  ice: "",
  cnssAffiliation: "",
};

export function SettingsPage() {
  const isAdmin = useIsAdmin();
  const [status, setStatus] = useState<DatabaseStatus>(() => getDatabaseStatus());
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyIdState, setActiveCompanyIdState] = useState("");
  const [draft, setDraft] = useState<CompanyDraft>(emptyCompanyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [users, setUsers] = useState<AppUser[]>([]);
  const [showUserForm, setShowUserForm] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", password: "", fullName: "", role: "MANAGER" });

  useEffect(() => {
    void loadCompanies();
  }, []);

  async function setup() {
    setBusy(true);
    setError("");
    try {
      const nextStatus = await initializeAppDatabase();
      setStatus(nextStatus);
      await loadCompanies();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'initialiser la base de données");
    } finally {
      setBusy(false);
    }
  }

  async function loadCompanies() {
    setBusy(true);
    setError("");
    try {
      const companyId = await getActiveCompanyId();
      const [nextCompanies, activeCompany, nextUsers] = await Promise.all([
        listCompanies(), getActiveCompany(), listUsers(companyId),
      ]);
      setCompanies(nextCompanies);
      setActiveCompanyIdState(activeCompany.id);
      setUsers(nextUsers);
      if (!editingId) {
        setEditingId(activeCompany.id);
        setDraft(toDraft(activeCompany));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les sociétés");
    } finally {
      setBusy(false);
    }
  }

  async function submitCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !isAdmin) return;
    setBusy(true);
    setError("");

    try {
      const company = editingId ? await updateCompany(editingId, draft) : await createCompany(draft);
      const nextCompanies = await listCompanies();
      setCompanies(nextCompanies);
      setDraft(toDraft(company));
      setEditingId(company.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer la société");
    } finally {
      setBusy(false);
    }
  }

  async function selectCompany(companyId: string) {
    const company = companies.find((entry) => entry.id === companyId);
    if (!company) return;
    setActiveCompanyId(company.id);
    setActiveCompanyIdState(company.id);
    setEditingId(company.id);
    setDraft(toDraft(company));
    window.location.reload();
  }

  function startNewCompany() {
    if (!isAdmin) return;
    setEditingId(null);
    setDraft(emptyCompanyDraft);
  }

  async function submitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !isAdmin) return;
    setBusy(true);
    setError("");

    try {
      const companyId = await getActiveCompanyId();
      await createUser({ ...newUser, companyId });
      const nextUsers = await listUsers(companyId);
      setUsers(nextUsers);
      setNewUser({ email: "", password: "", fullName: "", role: "MANAGER" });
      setShowUserForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de créer l'utilisateur");
    } finally {
      setBusy(false);
    }
  }

  const activeCompany = companies.find((company) => company.id === activeCompanyIdState) ?? null;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950">Paramètres</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">
          Gestion des sociétés, des utilisateurs et de la base de données.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          {error}
        </div>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-950">Base de données</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{status.message}</p>
            </div>
          </div>
          <span
            className={`w-fit rounded px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] ${
              status.ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
            }`}
          >
            {status.provider}
          </span>
        </div>

        {isAdmin && (
          <button
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            type="button"
            disabled={busy}
            onClick={setup}
          >
            <Database className="h-4 w-4" />
            {busy ? "Initialisation..." : "Initialiser la base"}
          </button>
        )}
      </section>

      {isAdmin && (
        <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Sociétés</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {companies.map((company) => {
                const isActive = company.id === activeCompanyIdState;
                return (
                  <button
                    key={company.id}
                    className={`block w-full px-4 py-3 text-left transition-colors ${
                      isActive ? "bg-emerald-50/60" : "hover:bg-slate-50"
                    }`}
                    type="button"
                    onClick={() => void selectCompany(company.id)}
                  >
                    <span className="block text-sm font-bold text-slate-950">{company.name}</span>
                    <span className="mt-1 block text-xs font-semibold text-slate-400">
                      {isActive ? "Société active" : company.ice || "Pas d'ICE"}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-slate-100 p-3">
              <button
                className="h-9 w-full rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50"
                type="button"
                onClick={startNewCompany}
                disabled={busy}
              >
                Nouvelle société
              </button>
            </div>
          </div>

          <form className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" onSubmit={submitCompany}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-950">
                    {editingId ? "Profil société" : "Créer une société"}
                  </h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    {activeCompany ? `Espace actuel : ${activeCompany.name}` : "Configurez un espace de paie."}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                label="Nom de la société"
                value={draft.name}
                placeholder="ex. Atlas Paie SARL"
                onChange={(value) => setDraft({ ...draft, name: value })}
                disabled={busy}
              />
              <TextField
                label="ICE"
                value={draft.ice}
                placeholder="Identifiant commun entreprise"
                onChange={(value) => setDraft({ ...draft, ice: value })}
                disabled={busy}
                required={false}
              />
              <TextField
                label="Affiliation CNSS"
                value={draft.cnssAffiliation}
                placeholder="Affiliation CNSS"
                onChange={(value) => setDraft({ ...draft, cnssAffiliation: value })}
                disabled={busy}
                required={false}
              />
            </div>

            <button
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              type="submit"
              disabled={busy}
            >
              <Save className="h-4 w-4" />
              {editingId ? "Enregistrer" : "Créer la société"}
            </button>
          </form>
        </section>
      )}

      {isAdmin && (
        <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Utilisateurs</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {users.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-slate-400">Aucun utilisateur</p>
              )}
              {users.map((user) => (
                <div key={user.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-[10px] font-bold text-emerald-700 border border-emerald-200/50 uppercase">
                    {user.fullName.substring(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-950">{user.fullName}</p>
                    <p className="truncate text-xs text-slate-400">{user.email}</p>
                  </div>
                  <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    user.role === "ADMIN" ? "bg-purple-50 text-purple-700" : "bg-slate-50 text-slate-600"
                  }`}>
                    {user.role === "ADMIN" ? "ADMIN" : user.role === "MANAGER" ? "GESTIONNAIRE" : "LECTEUR"}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 p-3">
              <button
                className="h-9 w-full rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50"
                type="button"
                onClick={() => setShowUserForm(!showUserForm)}
              >
                {showUserForm ? "Annuler" : "Ajouter un utilisateur"}
              </button>
            </div>
          </div>

          {showUserForm && (
            <form className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" onSubmit={submitUser}>
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-950">Nouvel utilisateur</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      Ajoutez un utilisateur à l'espace de travail actif.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <TextField
                  label="Nom complet"
                  value={newUser.fullName}
                  placeholder="ex. Jean Dupont"
                  onChange={(value) => setNewUser({ ...newUser, fullName: value })}
                  disabled={busy}
                />
                <TextField
                  label="Email"
                  value={newUser.email}
                  placeholder="nom@atlas.local"
                  onChange={(value) => setNewUser({ ...newUser, email: value })}
                  disabled={busy}
                />
                <TextField
                  label="Mot de passe"
                  type="password"
                  value={newUser.password}
                  placeholder="********"
                  onChange={(value) => setNewUser({ ...newUser, password: value })}
                  disabled={busy}
                />
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Rôle</span>
                  <select
                    className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-100 disabled:bg-slate-50 disabled:text-slate-400"
                    value={newUser.role}
                    disabled={busy}
                    onChange={(event) => setNewUser({ ...newUser, role: event.target.value })}
                  >
                    <option value="ADMIN">Administrateur</option>
                    <option value="MANAGER">Gestionnaire</option>
                    <option value="VIEWER">Lecteur</option>
                  </select>
                </label>
              </div>

              <button
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-purple-600 px-4 text-sm font-bold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                type="submit"
                disabled={busy}
              >
                <Shield className="h-4 w-4" />
                Créer l'utilisateur
              </button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}

function toDraft(company: Company): CompanyDraft {
  return {
    name: company.name,
    ice: company.ice,
    cnssAffiliation: company.cnssAffiliation,
  };
}

function TextField({
  label,
  type,
  value,
  onChange,
  disabled = false,
  placeholder,
  required = true,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <input
        type={type ?? "text"}
        className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-100 disabled:bg-slate-50 disabled:text-slate-400"
        required={required}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
