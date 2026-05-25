import { FormEvent, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus,
  UserCheck,
  Users,
  Search,
  SlidersHorizontal,
  Trash2,
  Edit3,
  X,
  DollarSign,
  IdCard,
  Calendar,
  Briefcase,
  Building2
} from "lucide-react";
import { createEmployee, deleteEmployee, initializeAppDatabase, listEmployees, updateEmployee } from "../db/store.ts";
import type { ContractType, Employee, EmployeeDraft, EmployeeStatus } from "../db/models.ts";
import { getActiveCompanyId } from "../db/companyStore.ts";
import { useCompany } from "../app/CompanyContext.tsx";
import { useCanWrite } from "../auth/AuthContext.tsx";

const emptyDraft: EmployeeDraft = {
  matricule: "",
  cin: "",
  cnssNumber: "",
  fullName: "",
  hireDate: new Date().toISOString().slice(0, 10),
  seniorityDate: new Date().toISOString().slice(0, 10),
  birthDate: "",
  familyStatus: "",
  childrenCount: 0,
  deductionCount: 0,
  functionTitle: "",
  department: "",
  contractType: "CDI",
  salaryBase: 0,
  status: "ACTIVE",
  companyId: ""
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("fr-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [draft, setDraft] = useState<EmployeeDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { activeCompany } = useCompany();
  const canWrite = useCanWrite();

  // Advanced UX states: Searching and Tab filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [isFormOpen, setIsFormOpen] = useState(false);

  const counts = useMemo(() => {
    return {
      total: employees.length,
      active: employees.filter(e => e.status === "ACTIVE").length,
      inactive: employees.filter(e => e.status === "INACTIVE").length,
    };
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter(employee => {
      const matchesTab = activeTab === "ALL" || employee.status === activeTab;
      const matchesSearch =
        employee.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.cin.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (employee.cnssNumber && employee.cnssNumber.includes(searchQuery)) ||
        employee.functionTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.department.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [employees, activeTab, searchQuery]);

  useEffect(() => {
    void refreshEmployees();
  }, []);

  async function refreshEmployees() {
    setLoading(true);
    setError("");
    try {
      const status = await initializeAppDatabase();
      if (!status.ready || status.provider !== "sqlite") {
        setError(status.message || "Échec de synchronisation de la base de données.");
        setEmployees([]);
        return;
      }
      const data = await listEmployees();
      setEmployees(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de chargement des profils.");
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");

    try {
      if (editingId) {
        await updateEmployee(editingId, draft);
      } else {
        const activeCompanyId = await getActiveCompanyId();
        if (!activeCompanyId) throw new Error("Aucune société active. Veuillez configurer une société d'abord.");
        await createEmployee({ ...draft, companyId: activeCompanyId });
      }

      setDraft(emptyDraft);
      setEditingId(null);
      setIsFormOpen(false);
      await refreshEmployees();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer le collaborateur");
    } finally {
      setSaving(false);
    }
  }

  function edit(employee: Employee) {
    setEditingId(employee.id);
    setIsFormOpen(true);
    setDraft({
      matricule: employee.matricule,
      cin: employee.cin,
      cnssNumber: employee.cnssNumber,
      fullName: employee.fullName,
      hireDate: employee.hireDate,
      seniorityDate: employee.seniorityDate,
      birthDate: employee.birthDate,
      familyStatus: employee.familyStatus,
      childrenCount: employee.childrenCount,
      deductionCount: employee.deductionCount,
      functionTitle: employee.functionTitle,
      department: employee.department,
      contractType: employee.contractType,
      salaryBase: employee.salaryBase,
      status: employee.status,
    });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setDraft(emptyDraft);
    setIsFormOpen(false);
  }

  async function remove(id: string) {
    if (deletingId) return;
    setDeletingId(id);
    setError("");

    try {
      await deleteEmployee(id);
      if (editingId === id) {
        setEditingId(null);
        setDraft(emptyDraft);
        setIsFormOpen(false);
      }
      await refreshEmployees();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de supprimer le collaborateur");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 p-1 sm:p-4 text-slate-600 selection:bg-emerald-50 selection:text-emerald-800">

      {/* Top Header Workspace Section */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 bg-emerald-50/60 text-emerald-800 px-2.5 py-1 rounded-md text-xs font-semibold mb-2 ring-1 ring-emerald-600/10">
            <Briefcase className="w-3.5 h-3.5" /> Gestion des collaborateurs
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Ressources humaines</h1>
          <p className="mt-1.5 text-sm text-slate-500 font-medium">Gérez les profils des collaborateurs et les paramètres de paie.</p>
          {activeCompany && (
            <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>{activeCompany.name}</span>
            </div>
          )}
        </div>

        {/* Dynamic Metric Grid */}
        <div className="grid grid-cols-2 gap-4 sm:w-[380px] lg:w-[420px]">
          <SummaryBox
            label="Effectif total"
            value={counts.total.toString()}
            icon={<Users className="w-5 h-5 text-indigo-500" />}
            gradient="from-indigo-500/10 to-blue-500/5"
          />
          <SummaryBox
            label="Comptes actifs"
            value={counts.active.toString()}
            icon={<UserCheck className="w-5 h-5 text-emerald-500" />}
            gradient="from-emerald-500/10 to-teal-500/5"
          />
        </div>
      </div>

      {/* Error Frame Notification */}
      <AnimatePresence mode="popLayout">
        {error ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-xl border border-amber-200 bg-amber-50/70 backdrop-blur-sm px-4 py-3.5 text-sm font-medium text-amber-900 flex items-center gap-3 shadow-sm shadow-amber-100/50"
          >
            <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            <div className="flex-1">{error}</div>
            <button onClick={() => setError("")} className="text-amber-500 hover:text-amber-800 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Main full-width layout */}
      <section className="relative">

        {/* Slide-over form sheet */}
        <AnimatePresence>
          {isFormOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
                onClick={handleCancelEdit}
              />
              <motion.div
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-2xl z-50 overflow-y-auto"
              >
                <form
                  className="relative min-h-full flex flex-col"
                  onSubmit={submit}
                >
                  <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-lg ${editingId ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {editingId ? <Edit3 className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                      </div>
                      <h2 className="text-lg font-bold text-slate-950 tracking-tight">
                        {editingId ? "Modifier le collaborateur" : "Nouveau collaborateur"}
                      </h2>
                    </div>
                    <button
                      className="p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={saving}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex-1 px-6 py-6 space-y-4">
                    <TextField
                      label="Nom complet"
                      value={draft.fullName}
                      icon={<Users className="w-4 h-4" />}
                      placeholder="ex. Anis Mansouri"
                      onChange={(value) => setDraft({ ...draft, fullName: value })}
                      disabled={!canWrite || saving}
                    />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField
                        label="N° CIN"
                        value={draft.cin}
                        icon={<IdCard className="w-4 h-4" />}
                        placeholder="ex. K123456"
                        onChange={(value) => setDraft({ ...draft, cin: value })}
                        disabled={!canWrite || saving}
                      />
                      <TextField
                        label="N° CNSS"
                        value={draft.cnssNumber}
                        icon={<IdCard className="w-4 h-4" />}
                        placeholder="ex. 987654321"
                        onChange={(value) => setDraft({ ...draft, cnssNumber: value })}
                        disabled={!canWrite || saving}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField
                        label="Date d'embauche"
                        type="date"
                        value={draft.hireDate}
                        icon={<Calendar className="w-4 h-4" />}
                        onChange={(value) => setDraft({ ...draft, hireDate: value })}
                        disabled={!canWrite || saving}
                      />
                      <TextField
                        label="Matricule"
                        value={draft.matricule}
                        icon={<IdCard className="w-4 h-4" />}
                        placeholder="ex. MAT001"
                        onChange={(value) => setDraft({ ...draft, matricule: value })}
                        disabled={!canWrite || saving}
                      />
                    </div>

                    <label className="block">
                      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Type de contrat</span>
                      <select
                        className="h-10.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-100 disabled:bg-slate-50 disabled:cursor-not-allowed"
                        value={draft.contractType}
                        disabled={!canWrite || saving}
                        onChange={(event) => setDraft({ ...draft, contractType: event.target.value as ContractType })}
                      >
                        <option value="CDI">CDI (Contrat à durée indéterminée)</option>
                        <option value="CDD">CDD (Contrat à durée déterminée)</option>
                        <option value="ANAPEC">ANAPEC</option>
                        <option value="STAGE">Stage</option>
                        <option value="OTHER">Autre</option>
                      </select>
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField
                        label="Salaire de base"
                        type="number"
                        value={String(draft.salaryBase)}
                        icon={<DollarSign className="w-4 h-4" />}
                        placeholder="6500"
                        onChange={(value) => setDraft({ ...draft, salaryBase: Number(value) || 0 })}
                        disabled={!canWrite || saving}
                      />
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Statut</span>
                        <select
                          className="h-10.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-100 disabled:bg-slate-50 disabled:cursor-not-allowed"
                          value={draft.status}
                          disabled={!canWrite || saving}
                          onChange={(event) => setDraft({ ...draft, status: event.target.value as EmployeeStatus })}
                        >
                          <option value="ACTIVE">Actif</option>
                          <option value="INACTIVE">Inactif</option>
                        </select>
                      </label>
                    </div>

                    <details className="group rounded-xl border border-slate-200 bg-slate-50/40">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-900">
                        Informations complémentaires
                        <span className="text-slate-400 transition-transform group-open:rotate-180">⌄</span>
                      </summary>
                      <div className="space-y-4 border-t border-slate-200 bg-white p-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <TextField
                            label="Fonction"
                            value={draft.functionTitle}
                            icon={<Briefcase className="w-4 h-4" />}
                            placeholder="ex. Développeur Front-End"
                            onChange={(value) => setDraft({ ...draft, functionTitle: value })}
                            disabled={!canWrite || saving}
                            required={false}
                          />
                          <TextField
                            label="Département"
                            value={draft.department}
                            icon={<Building2 className="w-4 h-4" />}
                            placeholder="ex. IT"
                            onChange={(value) => setDraft({ ...draft, department: value })}
                            disabled={!canWrite || saving}
                            required={false}
                          />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <TextField
                            label="Date d'ancienneté"
                            type="date"
                            value={draft.seniorityDate}
                            icon={<Calendar className="w-4 h-4" />}
                            onChange={(value) => setDraft({ ...draft, seniorityDate: value })}
                            disabled={!canWrite || saving}
                            required={false}
                          />
                          <TextField
                            label="Date de naissance"
                            type="date"
                            value={draft.birthDate}
                            icon={<Calendar className="w-4 h-4" />}
                            onChange={(value) => setDraft({ ...draft, birthDate: value })}
                            disabled={!canWrite || saving}
                            required={false}
                          />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <TextField
                            label="Situation familiale"
                            value={draft.familyStatus}
                            placeholder="ex. C, Marié(e)"
                            onChange={(value) => setDraft({ ...draft, familyStatus: value })}
                            disabled={!canWrite || saving}
                            required={false}
                          />
                          <TextField
                            label="Nombre d'enfants"
                            type="number"
                            value={String(draft.childrenCount)}
                            placeholder="0"
                            onChange={(value) => setDraft({ ...draft, childrenCount: Number(value) || 0 })}
                            disabled={!canWrite || saving}
                            required={false}
                          />
                        </div>
                        <TextField
                          label="Nombre de parts fiscales"
                          type="number"
                          value={String(draft.deductionCount)}
                          placeholder="0"
                          onChange={(value) => setDraft({ ...draft, deductionCount: Number(value) || 0 })}
                          disabled={!canWrite || saving}
                          required={false}
                        />
                      </div>
                    </details>
                  </div>

                  <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4">
                    {canWrite && (
                      <button
                        className={`h-11 w-full rounded-xl text-sm font-bold text-white transition-all shadow-sm flex items-center justify-center gap-2 ${editingId
                          ? "bg-amber-600 hover:bg-amber-700 shadow-amber-100"
                          : "bg-slate-950 hover:bg-slate-800 shadow-slate-200"
                          } disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none`}
                        type="submit"
                        disabled={saving}
                      >
                        {saving ? (
                          <span className="flex items-center gap-2">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            Enregistrement...
                          </span>
                        ) : editingId ? (
                          "Enregistrer les modifications"
                        ) : (
                          "Créer le collaborateur"
                        )}
                      </button>
                    )}
                  </div>
                </form>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Dynamic Personnel Subsystem Grid / Listing */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-md shadow-slate-100/60 overflow-hidden flex flex-col">

          {/* Controls Bar: Advanced Navigation Tabs & Live Structural Search */}
          <div className="p-5 border-b border-slate-100 bg-slate-50/30 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            {/* Filter segments tab group */}
            <div className="flex items-center gap-3">
              <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                {(["ALL", "ACTIVE", "INACTIVE"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all ${activeTab === tab
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-950"
                      }`}
                  >
                    {tab === "ALL" ? "Tous" : tab === "ACTIVE" ? "Actifs" : "Inactifs"}
                  </button>
                ))}
              </div>
              {canWrite && (
                <button
                  onClick={() => { setEditingId(null); setDraft(emptyDraft); setIsFormOpen(true); }}
                  className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-slate-950 text-white text-xs font-bold hover:bg-slate-800 transition-all shadow-sm"
                  type="button"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Nouveau
                </button>
              )}
            </div>

            {/* Interactive live full-text filter search input */}
            <div className="relative sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher par nom, CIN, CNSS..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9.5 pl-9.5 pr-4 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-slate-900 focus:ring-4 focus:ring-slate-100"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Clean Data Layout Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/40">
                  <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 w-[30%]">Collaborateur</th>
                  <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 w-[12%]">CIN</th>
                  <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 w-[15%]">CNSS</th>
                  <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 w-[12%]">Contrat</th>
                  <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 w-[10%]">Statut</th>
                  <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 text-right w-[16%]">Salaire</th>
                  <th className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 w-[8%]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-sm font-semibold text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
                        Chargement des données...
                      </div>
                    </td>
                  </tr>
                ) : null}

                <AnimatePresence initial={false}>
                  {!loading && filteredEmployees.map((employee, index) => (
                    <motion.tr
                      key={employee.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.2, delay: index * 0.02 }}
                      className={`transition-colors hover:bg-slate-50/60 ${editingId === employee.id ? "bg-amber-50/30 hover:bg-amber-50/40" : "bg-white"
                        }`}
                    >
                      {/* Name */}
                      <td className="px-6 py-4">
                        {canWrite ? (
                          <button
                            className="flex items-center gap-3 group focus:outline-none text-left"
                            type="button"
                            onClick={() => edit(employee)}
                            disabled={saving || !!deletingId}
                          >
                            <div className={`p-2 rounded-xl transition-colors shrink-0 ${employee.status === "ACTIVE"
                              ? "bg-slate-100 text-slate-700 group-hover:bg-emerald-50 group-hover:text-emerald-700"
                              : "bg-slate-100/60 text-slate-400"
                              }`}>
                              <Users className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <span className="block font-bold text-slate-900 group-hover:text-emerald-800 transition-colors tracking-tight truncate">
                                {employee.fullName}
                              </span>
                              <span className="mt-0.5 block text-[10px] font-mono text-slate-400 truncate">
                                {employee.matricule || "—"}
                              </span>
                            </div>
                          </button>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl shrink-0 ${employee.status === "ACTIVE"
                              ? "bg-slate-100 text-slate-700"
                              : "bg-slate-100/60 text-slate-400"
                              }`}>
                              <Users className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <span className="block font-bold text-slate-900 tracking-tight truncate">
                                {employee.fullName}
                              </span>
                              <span className="mt-0.5 block text-[10px] font-mono text-slate-400 truncate">
                                {employee.matricule || "—"}
                              </span>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* CIN */}
                      <td className="px-6 py-4 font-mono font-bold text-xs text-slate-600">{employee.cin || "—"}</td>

                      {/* CNSS */}
                      <td className="px-6 py-4 font-mono text-xs text-slate-500">{employee.cnssNumber || "—"}</td>

                      {/* Contract */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800 ring-1 ring-slate-200/40">
                          {employee.contractType}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide ${employee.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10"
                          : "bg-slate-100 text-slate-400 ring-1 ring-slate-200/50"
                          }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${employee.status === "ACTIVE" ? "bg-emerald-600" : "bg-slate-400"}`} />
                          {employee.status === "ACTIVE" ? "Actif" : "Inactif"}
                        </span>
                      </td>

                      {/* Salary + Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3 group/actions">
                          <span className="font-mono font-extrabold text-slate-950">
                            {formatMoney(employee.salaryBase)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {canWrite && (
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover/actions:opacity-100 transition-opacity">
                            <button
                              onClick={() => edit(employee)}
                              className="p-1 rounded-lg text-slate-400 hover:text-slate-900 transition-colors"
                              type="button"
                              disabled={saving || !!deletingId}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => remove(employee.id)}
                              className="p-1 rounded-lg text-red-400 hover:text-red-700 transition-colors"
                              type="button"
                              disabled={saving || deletingId === employee.id}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>

                {!loading && filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-sm font-semibold text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <SlidersHorizontal className="w-8 h-8 text-slate-300 mb-1" />
                        <span>Aucun collaborateur ne correspond à votre recherche.</span>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
  icon?: React.ReactNode;
  required?: boolean;
}

function TextField({ label, value, onChange, type = "text", disabled = false, placeholder, icon, required = true }: TextFieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <div className="relative">
        {icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors pointer-events-none group-focus-within:text-slate-900">
            {icon}
          </div>
        )}
        <input
          className={`h-10.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 ${icon ? "pl-10.5" : "px-3.5"
            } pr-3.5 text-sm font-semibold text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-100 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed`}
          required={required}
          type={type}
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </label>
  );
}

interface SummaryBoxProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  gradient: string;
}

function SummaryBox({ label, value, icon, gradient }: SummaryBoxProps) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4.5 shadow-sm shadow-slate-100/40 relative overflow-hidden flex items-center justify-between gap-4">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-40 pointer-events-none`} />
      <div className="relative z-10">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-1 text-3xl font-black text-slate-900 tracking-tight">{value}</p>
      </div>
      <div className="p-3 rounded-xl bg-white shadow-sm border border-slate-100 relative z-10">
        {icon}
      </div>
    </div>
  );
}
