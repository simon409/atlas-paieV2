import { useEffect, useState } from "react";
import { deletePayrollRun, generatePayrollRun, listPayrollItemLines, listPayrollItems, listPayrollRuns, recalculatePayrollItem, updatePayrollRunStatus } from "../db/payrollRunStore.ts";
import type { PayrollItem, PayrollItemLine, PayrollRun } from "../db/models.ts";
import { useCanWrite } from "../auth/AuthContext.tsx";

// --- PURE UTILITIES ---
const currentPeriod = (): string => new Date().toISOString().slice(0, 7);

const formatMoney = (value: number): string =>
  new Intl.NumberFormat("fr-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

// --- MAIN WRAPPER COMPONENT ---
export function PayrollRunsPage() {
  const canWrite = useCanWrite();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [period, setPeriod] = useState(currentPeriod());
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [lines, setLines] = useState<PayrollItemLine[]>([]);

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingLines, setLoadingLines] = useState(false);
  const [error, setError] = useState("");

  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? null;
  const selectedItem = items.find((i) => i.id === selectedItemId) ?? null;



  // Initial Sync
  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedRunId && !runs.some((r) => r.id === selectedRunId)) {
      setSelectedRunId(null);
      setItems([]);
      setSelectedItemId(null);
      setLines([]);
    } else if (selectedRunId) {
      const run = runs.find((r) => r.id === selectedRunId);
      if (run) {
        setPeriod(run.period);
      }
    }
  }, [runs]);

  async function loadInitialData() {
    setError("");
    try {
      const nextRuns = await listPayrollRuns();
      setRuns(nextRuns);
      if (nextRuns.length > 0) {
        await handleRunSelect(nextRuns[0].id);
      }
    } catch (err) {
      setError("Échec de synchronisation des traitements.");
    }
  }

  // --- EXPLICIT INTERACTION HANDLERS ---
  async function handleRunSelect(runId: string) {
    setSelectedRunId(runId);
    setLoadingItems(true);
    setItems([]);
    setSelectedItemId(null);
    setLines([]);
    setPeriod(runs.find((r) => r.id === runId)?.period ?? currentPeriod());

    try {
      const nextItems = await listPayrollItems(runId);
      setItems(nextItems);
      if (nextItems.length > 0) {
        await handleItemSelect(nextItems[0].id);
      }
    } catch (err) {
      setError("Échec de récupération des bulletins.");
    } finally {
      setLoadingItems(false);
    }
  }

  async function handleItemSelect(itemId: string) {
    setSelectedItemId(itemId);
    setLoadingLines(true);
    setLines([]);

    try {
      const nextLines = await listPayrollItemLines(itemId);
      setLines(nextLines);
    } catch (err) {
      setError("Échec de récupération des paramètres de calcul.");
    } finally {
      setLoadingLines(false);
    }
  }

  async function handleGenerate() {
    setBusy(true);
    setError("");
    try {
      const generated = await generatePayrollRun(period);
      setRuns((prev) => [generated.run, ...prev.filter((r) => r.period !== period)]);
      setSelectedRunId(generated.run.id);
      setItems(generated.items);

      if (generated.items.length > 0) {
        setSelectedItemId(generated.items[0].id);
        const nextLines = await listPayrollItemLines(generated.items[0].id);
        setLines(nextLines);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de générer le traitement");
    } finally {
      setBusy(false);
    }
  }

  async function handleRecalculateItem(itemId: string) {
    if (!selectedRun) return;
    setBusy(true);
    setError("");
    try {
      const updatedItem = await recalculatePayrollItem(selectedRun.id, itemId);
      setItems((prev) => prev.map((item) => (item.id === itemId ? updatedItem : item)));
      if (selectedItemId === itemId) {
        const nextLines = await listPayrollItemLines(itemId);
        setLines(nextLines);
      }
      const updatedRuns = await listPayrollRuns();
      setRuns(updatedRuns);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de recalculer le bulletin");
    } finally {
      setBusy(false);
    }
  }

  async function handleValidateRun() {
    if (!selectedRun) return;
    setBusy(true);
    setError("");
    try {
      const updated = await updatePayrollRunStatus(selectedRun.id, "LOCKED");
      setRuns((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de valider le traitement");
    } finally {
      setBusy(false);
    }
  }

  async function handleDropRun(id: string) {
    setBusy(true);
    setError("");
    try {
      await deletePayrollRun(id);
      const remainingRuns = runs.filter((run) => run.id !== id);
      setRuns(remainingRuns);

      if (remainingRuns.length > 0) {
        await handleRunSelect(remainingRuns[0].id);
      } else {
        setSelectedRunId(null);
        setItems([]);
        setSelectedItemId(null);
        setLines([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de supprimer le traitement");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 bg-slate-50/50 min-h-screen">
      {/* Top Header Action Area */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Traitements de paie</h1>
          <p className="mt-2 text-sm text-slate-500 max-w-xl">
            Génération des bulletins de paie mensuels, consultation des distributions et analyse structurelle.
          </p>
        </div>

        <div className="flex flex-row items-center gap-3 bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-sm self-start md:self-auto">
          <input
            className="h-10 w-40 rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-2 text-sm font-semibold text-slate-800 outline-none transition-all hover:bg-slate-100/70 focus:border-emerald-500 focus:bg-white"
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
          {canWrite && selectedRun?.status !== "LOCKED" && (
            <button
              className="h-10 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:bg-slate-300"
              type="button"
              disabled={busy}
              onClick={handleGenerate}
            >
              {busy ? "Traitement..." : "Générer"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50/70 p-4 text-sm font-medium text-red-800">
          <div className="text-red-500 mt-0.5">⚠️</div>
          <div>{error}</div>
        </div>
      )}

      <section className="grid gap-8 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Sidebar Panel */}
        <RunsSidebar
          runs={runs}
          selectedId={selectedRunId}
          onSelect={handleRunSelect}
        />

        {/* Dynamic Details Workspace */}
        <div className="grid gap-8">
          {selectedRun && (
            <section className="grid gap-4 sm:grid-cols-3">
              <MetricCard label="Masse salariale brute" value={selectedRun.totalGross} />
              <MetricCard label="Net à payer" value={selectedRun.totalNet} variant="emerald" />
              <MetricCard label="Coût employeur total" value={selectedRun.totalEmployerCost} />
            </section>
          )}

          <IndividualSlipsPanel
            items={items}
            selectedItemId={selectedItemId}
            isLoading={loadingItems}
            isProcessing={busy}
            canWrite={canWrite}
            isLocked={selectedRun?.status === "LOCKED"}
            onSelectItem={handleItemSelect}
            onDropRun={selectedRun ? () => handleDropRun(selectedRun.id) : undefined}
            onRecalculateItem={selectedRun ? handleRecalculateItem : undefined}
            onValidate={selectedRun && canWrite && selectedRun.status === "DRAFT" ? handleValidateRun : undefined}
          />

          <CalculationDetailsPanel
            lines={lines}
            isLoading={loadingLines}
            title={selectedItem ? selectedItem.employeeName : "Détail du calcul"}
          />
        </div>
      </section>
    </div>
  );
}

// --- ISOLATED CHILD COMPONENTS (PREVENTS GLOBAL RE-RENDERS) ---

interface SidebarProps {
  runs: PayrollRun[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function RunsSidebar({ runs, selectedId, onSelect }: SidebarProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm h-fit overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Lots de calcul</h2>
      </div>
      <div className="divide-y divide-slate-100 max-h-[640px] overflow-y-auto">
        {runs.map((run) => {
          const isSelected = selectedId === run.id;
          return (
            <button
              key={run.id}
              className={`relative block w-full px-5 py-4 text-left transition-all hover:bg-slate-50/80 ${isSelected ? "bg-emerald-50/40" : "bg-white"
                }`}
              type="button"
              onClick={() => onSelect(run.id)}
            >
              {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-600 rounded-r-md" />}
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-slate-900 tracking-tight">{run.period}</span>
                <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ring-1 ring-inset ${run.status !== "DRAFT" ? "bg-blue-50 text-blue-700 ring-blue-600/10" : "bg-amber-50 text-amber-700 ring-amber-600/10"
                  }`}>
                  {run.status === "LOCKED" ? "Verrouillé" : "Brouillon"}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100/70 pt-3 text-xs">
                <div>
                  <p className="font-medium text-slate-400 uppercase tracking-tight scale-[0.95] origin-left">Net total</p>
                  <p className="mt-0.5 font-bold text-slate-700">{formatMoney(run.totalNet)}</p>
                </div>
                <div>
                  <p className="font-medium text-slate-400 uppercase tracking-tight scale-[0.95] origin-left">Coût employeur</p>
                  <p className="mt-0.5 font-bold text-slate-700">{formatMoney(run.totalEmployerCost)}</p>
                </div>
              </div>
            </button>
          );
        })}
        {runs.length === 0 && (
          <div className="px-5 py-12 text-center text-sm font-medium text-slate-400">Aucun enregistrement.</div>
        )}
      </div>
    </div>
  );
}

interface SlipsPanelProps {
  items: PayrollItem[];
  selectedItemId: string | null;
  isLoading: boolean;
  isProcessing: boolean;
  canWrite: boolean;
  isLocked: boolean;
  onSelectItem: (id: string) => void;
  onDropRun?: () => void;
  onRecalculateItem?: (itemId: string) => void;
  onValidate?: () => void;
}

function IndividualSlipsPanel({ items, selectedItemId, isLoading, isProcessing, canWrite, isLocked, onSelectItem, onDropRun, onRecalculateItem, onValidate }: SlipsPanelProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/30 px-6 py-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Bulletins individuels</h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Résultats par employé</p>
        </div>
        <div className="flex items-center gap-2">
          {onValidate && (
            <button
              className="h-9 rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
              type="button"
              disabled={isProcessing}
              onClick={onValidate}
            >
              Valider
            </button>
          )}
          {!isLocked && canWrite && selectedItemId && onRecalculateItem && (
            <button
              className="h-9 rounded-lg border border-amber-200 bg-white px-3.5 text-xs font-semibold text-amber-700 transition-all hover:bg-amber-50 disabled:opacity-50"
              type="button"
              disabled={isProcessing}
              onClick={() => onRecalculateItem(selectedItemId)}
            >
              Recalculer
            </button>
          )}
          {!isLocked && canWrite && onDropRun && (
            <button
              className="h-9 rounded-lg border border-rose-200 bg-white px-3.5 text-xs font-semibold text-rose-600 transition-all hover:bg-rose-50 disabled:opacity-50"
              type="button"
              disabled={isProcessing}
              onClick={onDropRun}
            >
              Supprimer
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(180px,1.2fr)_110px_110px_110px_110px] gap-4 border-b border-slate-100 bg-slate-50/50 px-6 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        <span>Employé</span>
        <span className="text-right">Brut</span>
        <span className="text-right">IR</span>
        <span className="text-right">Net</span>
        <span className="text-right">Coût brut</span>
      </div>

      <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
        {isLoading ? (
          <div className="p-6 space-y-3 animate-pulse">
            <div className="h-4 bg-slate-100 rounded w-3/4"></div>
            <div className="h-4 bg-slate-100 rounded w-1/2"></div>
          </div>
        ) : (
          items.map((item) => {
            const isSelected = selectedItemId === item.id;
            const totalItemCost = item.grossSalary + (item.cnssEmployer ?? 0) + (item.amo ?? 0);
            return (
              <button
                key={item.id}
                className={`grid w-full grid-cols-[minmax(180px,1.2fr)_110px_110px_110px_110px] items-center gap-4 px-6 py-3.5 text-left text-sm transition-colors ${isSelected ? "bg-emerald-50/40" : "bg-white hover:bg-slate-50/50"
                  }`}
                type="button"
                onClick={() => onSelectItem(item.id)}
              >
                <div className="pr-2">
                  <span className="block font-bold text-slate-900 tracking-tight">{item.employeeName || item.employeeId}</span>
                  <span className="mt-1 block max-w-[220px] truncate font-mono text-[10px] text-slate-400">
                    {item.calculationHash}
                  </span>
                </div>
                <span className="text-right font-medium text-slate-600">{formatMoney(item.grossSalary)}</span>
                <span className="text-right font-medium text-slate-600">{formatMoney(item.ir)}</span>
                <span className="text-right font-bold text-emerald-700">{formatMoney(item.netSalary)}</span>
                <span className="text-right font-bold text-slate-800">{formatMoney(totalItemCost)}</span>
              </button>
            );
          })
        )}
        {!isLoading && items.length === 0 && (
          <div className="px-6 py-12 text-center text-sm font-medium text-slate-400">Sélectionnez ou exécutez un lot ci-dessus.</div>
        )}
      </div>
    </div>
  );
}

interface DetailsPanelProps {
  lines: PayrollItemLine[];
  isLoading: boolean;
  title: string;
}

function CalculationDetailsPanel({ lines, isLoading, title }: DetailsPanelProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50/30 px-6 py-4">
        <h2 className="text-base font-bold text-slate-900">
          {title}
          <span className="font-normal text-slate-400 text-xs block mt-0.5">Détail des composants</span>
        </h2>
      </div>
      <div className="grid grid-cols-[100px_minmax(180px,1fr)_110px_90px_120px] gap-4 border-b border-slate-100 bg-slate-50/50 px-6 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
        <span>Catégorie</span>
        <span>Libellé</span>
        <span className="text-right">Base</span>
        <span className="text-right">Taux</span>
        <span className="text-right">Montant</span>
      </div>
      <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
        {isLoading ? (
          <div className="p-6 space-y-3 animate-pulse">
            <div className="h-4 bg-slate-100 rounded w-full"></div>
            <div className="h-4 bg-slate-100 rounded w-5/6"></div>
          </div>
        ) : (
          lines.map((line) => (
            <div key={line.id} className="grid grid-cols-[100px_minmax(180px,1fr)_110px_90px_120px] items-center gap-4 px-6 py-3 text-sm">
              <span className={`inline-flex w-fit items-center justify-center rounded-md px-2 py-0.5 text-[10px] font-extrabold tracking-wide ${line.type === "DEDUCTION" ? "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/10" : line.type === "EMPLOYER" ? "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/10" : "bg-slate-100 text-slate-700"
                }`}>
                {line.type === "DEDUCTION" ? "RETENUE" : line.type === "EMPLOYER" ? "EMPLOYEUR" : "INFO"}
              </span>
              <div>
                <span className="block font-bold text-slate-900 tracking-tight">{line.label}</span>
                <span className="mt-0.5 block font-mono text-[10px] text-slate-400">{line.code}</span>
              </div>
              <span className="text-right font-medium text-slate-500">{line.baseAmount === null ? "—" : formatMoney(line.baseAmount)}</span>
              <span className="text-right font-medium text-slate-500">{line.rate === null ? "—" : `${(line.rate * 100).toFixed(2)}%`}</span>
              <span className={`text-right font-bold ${line.amount < 0 ? "text-rose-600" : "text-slate-900"}`}>
                {formatMoney(line.amount)}
              </span>
            </div>
          ))
        )}
        {!isLoading && lines.length === 0 && (
          <div className="px-6 py-12 text-center text-sm font-medium text-slate-400">Sélectionnez une ligne pour voir le détail.</div>
        )}
      </div>
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: number;
  variant?: "slate" | "emerald";
}

function MetricCard({ label, value, variant = "slate" }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm relative overflow-hidden">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-3 text-2xl font-black tracking-tight ${variant === "emerald" ? "text-emerald-700" : "text-slate-900"}`}>{formatMoney(value)}</p>
    </div>
  );
}
