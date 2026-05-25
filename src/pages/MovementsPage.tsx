import { useEffect, useMemo, useState } from "react";
import {
  createMovement,
  deleteMovement,
  listMovements,
  updateMovement,
} from "../db/movementStore.ts";
import { listEmployees } from "../db/store.ts";
import { useCanWrite } from "../auth/AuthContext.tsx";
import type {
  Employee,
  MovementType,
  PayrollMovement,
  PayrollMovementDraft,
} from "../db/models.ts";

const MOVEMENT_LABELS: Record<MovementType, string> = {
  BONUS: "Prime",
  TAXABLE_ALLOWANCE: "Indemnité imposable",
  NON_TAXABLE_ALLOWANCE: "Indemnité non imposable",
  DEDUCTION: "Retenue",
};

type EditableMovement = {
  id: string;
  employeeId: string;
  dateDebut: string;
  dateFin: string;
  type: MovementType;
  label: string;
  amount: number;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("fr-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatFrenchDate = (isoDate: string | null | undefined): string => {
  if (!isoDate) return "-";
  const d = new Date(isoDate + "T00:00:00");
  if (isNaN(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat("fr-MA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
};

function getMonthDateRange(date?: Date): { dateDebut: string; dateFin: string } {
  const d = date ?? new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
  return {
    dateDebut: `${y}-${m}-01`,
    dateFin: `${y}-${m}-${String(lastDay).padStart(2, "0")}`,
  };
}

export default function MovementsPage() {
  const canWrite = useCanWrite();
  const [dateDebut, setDateDebut] = useState(getMonthDateRange().dateDebut);
  const [dateFin, setDateFin] = useState(getMonthDateRange().dateFin);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [movements, setMovements] = useState<PayrollMovement[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  
  const [draft, setDraft] = useState<EditableMovement>({
    id: "",
    employeeId: "",
    dateDebut: "",
    dateFin: "",
    type: "BONUS",
    label: "",
    amount: 0,
  });

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setBusy(true);
      setError("");
      try {
        const [dbEmployees, dbMovements] = await Promise.all([
          listEmployees(),
          listMovements(dateDebut, dateFin),
        ]);
        if (!isMounted) return;

        setEmployees(dbEmployees);
        setMovements(dbMovements);

        if (dbEmployees.length > 0 && !selectedEmployee) {
          setSelectedEmployee(dbEmployees[0]);
        }
      } catch (err) {
        if (isMounted) setError("Impossible de charger les données.");
      } finally {
        if (isMounted) setBusy(false);
      }
    }

    void loadData();
    return () => { isMounted = false; };
  }, [dateDebut, dateFin]);

  const filteredEmployees = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return employees;
    return employees.filter(
      (emp) =>
        emp.fullName?.toLowerCase().includes(q) ||
        emp.matricule?.toLowerCase().includes(q)
    );
  }, [employees, search]);

  const employeeMovements = useMemo(() => {
    if (!selectedEmployee) return [];
    return movements.filter((m) => m.employeeId === selectedEmployee.id);
  }, [movements, selectedEmployee]);

  const total = useMemo(() => {
    return employeeMovements.reduce((sum, m) => {
      return m.type === "DEDUCTION" ? sum - m.amount : sum + m.amount;
    }, 0);
  }, [employeeMovements]);

  function openCreateModal(type: MovementType) {
    if (!selectedEmployee) return;
    setDraft({ id: "", employeeId: selectedEmployee.id, dateDebut, dateFin, type, label: "", amount: 0 });
    setShowModal(true);
  }

  function openEditModal(movement: PayrollMovement) {
    setDraft({
      id: movement.id,
      employeeId: movement.employeeId || "",
      dateDebut: movement.dateDebut,
      dateFin: movement.dateFin,
      type: movement.type,
      label: movement.label,
      amount: movement.amount,
    });
    setShowModal(true);
  }

  async function saveMovement() {
    if (!selectedEmployee) return;
    if (!draft.label.trim()) {
      setError("Le libellé est obligatoire.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const payload: PayrollMovementDraft = {
        employeeId: selectedEmployee.id,
        dateDebut: draft.dateDebut || dateDebut,
        dateFin: draft.dateFin || dateFin,
        scope: "employee",
        type: draft.type,
        label: draft.label.trim(),
        amount: draft.amount,
      };

      if (draft.id) {
        const updated = await updateMovement(draft.id, payload);
        setMovements((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      } else {
        const created = await createMovement(payload);
        setMovements((prev) => [...prev, created]);
      }
      setShowModal(false);
    } catch (err) {
      setError("Impossible d'enregistrer le mouvement.");
    } finally {
      setBusy(false);
    }
  }

  async function removeMovement(id: string) {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce mouvement ?")) return;
    setBusy(true);
    try {
      await deleteMovement(id);
      setMovements((prev) => prev.filter((m) => m.id !== id));
    } catch {
      setError("Impossible de supprimer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 bg-slate-50/50 min-h-screen">
      {/* Top Header Action Area */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Variables de paie</h1>
          <p className="mt-2 text-sm text-slate-500 max-w-xl">
            Mouvements et rubriques par collaborateur
          </p>
        </div>

        <div className="flex flex-row items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-sm self-start md:self-auto">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Du</label>
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              className="h-10 w-40 rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-2 text-sm font-semibold text-slate-800 outline-none transition-all hover:bg-slate-100/70 focus:border-emerald-500 focus:bg-white"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Au</label>
            <input
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              className="h-10 w-40 rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-2 text-sm font-semibold text-slate-800 outline-none transition-all hover:bg-slate-100/70 focus:border-emerald-500 focus:bg-white"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50/70 p-4 text-sm font-medium text-red-800">
          <div className="text-red-500 mt-0.5">⚠️</div>
          <div>{error}</div>
        </div>
      )}

      {busy && (
        <div className="fixed top-4 right-4 z-20 flex items-center gap-2 bg-white/80 backdrop-blur px-3 py-1.5 rounded-full border border-slate-200 text-xs font-medium text-slate-600 shadow-sm">
          <svg className="animate-spin h-3.5 w-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Mise à jour...
        </div>
      )}

      <section className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Employee Sidebar */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm h-fit overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white pl-3 pr-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>
          <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-100">
            {filteredEmployees.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm font-medium text-slate-400">Aucun collaborateur</div>
            ) : (
              filteredEmployees.map((employee) => {
                const active = selectedEmployee?.id === employee.id;
                return (
                  <button
                    key={employee.id}
                    onClick={() => setSelectedEmployee(employee)}
                    className={`relative block w-full px-5 py-3.5 text-left transition-all hover:bg-slate-50/80 ${
                      active ? "bg-emerald-50/40" : "bg-white"
                    }`}
                    type="button"
                  >
                    {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-600 rounded-r-md" />}
                    <div className={`text-sm font-bold tracking-tight ${active ? "text-emerald-900" : "text-slate-900"}`}>
                      {employee.fullName}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400 font-mono">{employee.matricule}</div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="grid gap-8">
          {!selectedEmployee ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-2">
              <span className="text-sm">Sélectionnez un employé pour gérer ses variables de paie</span>
            </div>
          ) : (
            <>
              {/* EMPLOYEE CARD HEADER */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 mb-2 font-mono">
                    Matricule: {selectedEmployee.matricule}
                  </span>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{selectedEmployee.fullName}</h2>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Département:</span> {selectedEmployee.department || "—"}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Fonction:</span> {selectedEmployee.functionTitle || "—"}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 shrink-0 text-right min-w-[150px]">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Fenêtre</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-800 font-mono">{formatFrenchDate(dateDebut)}</div>
                  <div className="text-xs text-slate-400 font-mono">→ {formatFrenchDate(dateFin)}</div>
                </div>
              </div>

              {/* QUICK ACTIONS ROW */}
              {canWrite && (
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Ajouter un élément</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <button
                      onClick={() => openCreateModal("BONUS")}
                      className="h-10 rounded-lg border border-emerald-200 bg-emerald-50/30 px-4 text-sm font-semibold text-emerald-700 transition-all hover:bg-emerald-50 active:scale-[0.98]"
                    >
                      + Prime
                    </button>
                    <button
                      onClick={() => openCreateModal("TAXABLE_ALLOWANCE")}
                      className="h-10 rounded-lg border border-amber-200 bg-amber-50/30 px-4 text-sm font-semibold text-amber-700 transition-all hover:bg-amber-50 active:scale-[0.98]"
                    >
                      + Ind. Imposable
                    </button>
                    <button
                      onClick={() => openCreateModal("NON_TAXABLE_ALLOWANCE")}
                      className="h-10 rounded-lg border border-sky-200 bg-sky-50/30 px-4 text-sm font-semibold text-sky-700 transition-all hover:bg-sky-50 active:scale-[0.98]"
                    >
                      + Ind. Non Imposable
                    </button>
                    <button
                      onClick={() => openCreateModal("DEDUCTION")}
                      className="h-10 rounded-lg border border-rose-200 bg-rose-50/30 px-4 text-sm font-semibold text-rose-700 transition-all hover:bg-rose-50 active:scale-[0.98]"
                    >
                      + Retenue
                    </button>
                  </div>
                </section>
              )}

              {/* MOVEMENTS LIST */}
              <section className="space-y-4">
                <div className="flex items-end justify-between px-1">
                  <h3 className="text-lg font-bold text-slate-900">Mouvements enregistrés</h3>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block font-medium uppercase tracking-wider">Impact Net Estimé</span>
                    <span className={`text-xl font-black font-mono ${total >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {total >= 0 ? "+" : ""}
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>

                {employeeMovements.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400 shadow-sm">
                    Aucun mouvement enregistré pour cette période.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {employeeMovements.map((movement) => (
                      <MovementCard
                        key={movement.id}
                        movement={movement}
                        onEdit={openEditModal}
                        onDelete={removeMovement}
                        canWrite={canWrite}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </section>

      {/* MODAL WINDOW */}
      {showModal && (
        <MovementModal
          draft={draft}
          setDraft={setDraft}
          busy={busy}
          onClose={() => setShowModal(false)}
          onSave={saveMovement}
        />
      )}
    </div>
  );
}

// Sub-component: Individual Movement Rendering Line Item
interface MovementCardProps {
  movement: PayrollMovement;
  onEdit: (m: PayrollMovement) => void;
  onDelete: (id: string) => void;
  canWrite: boolean;
}
function MovementCard({ movement, onEdit, onDelete, canWrite }: MovementCardProps) {
  const isDeduction = movement.type === "DEDUCTION";
  
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between gap-4 hover:border-slate-300 transition">
      <div className="space-y-1">
        <h4 className="font-semibold text-slate-900 text-sm">{movement.label}</h4>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-extrabold tracking-wide ${
            isDeduction
              ? "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/10"
              : movement.type === "BONUS"
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/10"
              : movement.type === "TAXABLE_ALLOWANCE"
              ? "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/10"
              : "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/10"
          }`}>
            {MOVEMENT_LABELS[movement.type]}
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {formatFrenchDate(movement.dateDebut)} → {formatFrenchDate(movement.dateFin)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <span className={`text-base font-bold font-mono ${isDeduction ? "text-rose-600" : "text-emerald-600"}`}>
          {isDeduction ? "-" : "+"}
          {formatCurrency(movement.amount)}
        </span>

        {canWrite && (
          <div className="flex items-center gap-2 border-l pl-4 border-slate-100">
            <button
              onClick={() => onEdit(movement)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-50"
            >
              Modifier
            </button>
            <button
              onClick={() => onDelete(movement.id)}
              className="h-8 rounded-lg border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-600 transition-all hover:bg-rose-50"
            >
              Supprimer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Sub-component: Creation/Modification Modal
interface MovementModalProps {
  draft: EditableMovement;
  setDraft: React.Dispatch<React.SetStateAction<EditableMovement>>;
  busy: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
}
function MovementModal({ draft, setDraft, busy, onClose, onSave }: MovementModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl border border-slate-200">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">
          {draft.id ? "Modifier le mouvement" : "Ajouter un mouvement"}
        </h2>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Type</label>
            <select
              value={draft.type}
              onChange={(e) => setDraft((prev) => ({ ...prev, type: e.target.value as MovementType }))}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition-all focus:border-emerald-500 focus:bg-white"
            >
              {Object.entries(MOVEMENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Libellé</label>
            <input
              type="text"
              value={draft.label}
              onChange={(e) => setDraft((prev) => ({ ...prev, label: e.target.value }))}
              placeholder="Ex: Prime de rendement exceptionnel"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition-all focus:border-emerald-500 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Date début</label>
              <input
                type="date"
                value={draft.dateDebut}
                onChange={(e) => setDraft((prev) => ({ ...prev, dateDebut: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition-all focus:border-emerald-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Date fin</label>
              <input
                type="date"
                value={draft.dateFin}
                onChange={(e) => setDraft((prev) => ({ ...prev, dateFin: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition-all focus:border-emerald-500 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Montant (MAD)</label>
            <input
              type="number"
              min={0}
              value={draft.amount || ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, amount: Number(e.target.value) || 0 }))}
              placeholder="0.00"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono outline-none transition-all focus:border-emerald-500 focus:bg-white"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            onClick={() => void onSave()}
            disabled={busy}
            className="h-10 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white transition-all hover:bg-emerald-700 disabled:bg-slate-300"
          >
            {busy ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}