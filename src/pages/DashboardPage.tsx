import { useEffect, useMemo, useState } from "react";
import { LayoutDashboard, TrendingDown, TrendingUp, Building2, ArrowRight, Plus, Wrench, FileText } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { listPayrollItems, listPayrollRuns } from "../db/payrollRunStore.ts";
import type { PayrollItem, PayrollRun } from "../db/models.ts";
import { listEmployees } from "../db/store.ts";
import type { Employee } from "../db/models.ts";
import { useCompany } from "../app/CompanyContext.tsx";
import { navigate } from "../router/routes.ts";

const formatMoney = (value: number): string =>
  new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const formatPeriod = (period: string): string => {
  const date = new Date(period + "-01");
  if (isNaN(date.getTime())) return period;
  return new Intl.DateTimeFormat("fr-MA", { month: "long", year: "numeric" }).format(date);
};

const formatPeriodShort = (period: string): string => {
  const date = new Date(period + "-01");
  if (isNaN(date.getTime())) return period;
  return new Intl.DateTimeFormat("fr-MA", { month: "short", year: "2-digit" }).format(date).replace(".", "");
};

const currentPeriod = (): string => new Date().toISOString().slice(0, 7);

type RunTotals = {
  grossSalary: number;
  cnssEmployee: number;
  ir: number;
  amo: number;
  netSalary: number;
  cnssEmployer: number;
  employerCost: number;
  employeeCount: number;
};

function computeTotals(items: PayrollItem[]): RunTotals {
  return items.reduce(
    (acc, i) => ({
      grossSalary: acc.grossSalary + i.grossSalary,
      cnssEmployee: acc.cnssEmployee + i.cnssEmployee,
      ir: acc.ir + i.ir,
      amo: acc.amo + i.amo,
      netSalary: acc.netSalary + i.netSalary,
      cnssEmployer: acc.cnssEmployer + i.cnssEmployer,
      employerCost: acc.employerCost + i.grossSalary + i.cnssEmployer + i.amo,
      employeeCount: acc.employeeCount + 1,
    }),
    { grossSalary: 0, cnssEmployee: 0, ir: 0, amo: 0, netSalary: 0, cnssEmployer: 0, employerCost: 0, employeeCount: 0 },
  );
}

export function DashboardPage() {
  const { activeCompany } = useCompany();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [itemsByRun, setItemsByRun] = useState<Map<string, PayrollItem[]>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [allEmployees, allRuns] = await Promise.all([listEmployees(), listPayrollRuns()]);
      setEmployees(allEmployees);
      setRuns(allRuns);

      const itemsMap = new Map<string, PayrollItem[]>();
      for (const run of allRuns) {
        const items = await listPayrollItems(run.id);
        itemsMap.set(run.id, items);
      }
      setItemsByRun(itemsMap);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  const activeEmployees = useMemo(() => employees.filter(e => e.status === "ACTIVE"), [employees]);

  const sortedLockedRuns = useMemo(() => {
    return runs.filter(r => r.status === "LOCKED").sort((a, b) => b.period.localeCompare(a.period));
  }, [runs]);

  const latestRun = sortedLockedRuns[0] ?? null;
  const previousRun = sortedLockedRuns[1] ?? null;

  const latestItems = latestRun ? itemsByRun.get(latestRun.id) ?? [] : [];
  const previousItems = previousRun ? itemsByRun.get(previousRun.id) ?? [] : [];

  const latestTotals = useMemo(() => computeTotals(latestItems), [latestItems]);
  const previousTotals = useMemo(() => computeTotals(previousItems), [previousItems]);

  const currentRun = useMemo(() => runs.find(r => r.period === currentPeriod()) ?? null, [runs]);

  const currentStatus = useMemo<"LOCKED" | "DRAFT" | "NONE">(() => {
    if (!currentRun) return "NONE";
    return currentRun.status;
  }, [currentRun]);

  const currentRunItems = currentRun ? itemsByRun.get(currentRun.id) ?? [] : [];
  const currentTotals = useMemo(() => computeTotals(currentRunItems), [currentRunItems]);

  const recentRuns = useMemo(() => sortedLockedRuns.slice(0, 6), [sortedLockedRuns]);

  const chartData = useMemo(() => {
    return [...sortedLockedRuns].reverse().slice(-6).map(run => {
      const items = itemsByRun.get(run.id) ?? [];
      const totals = computeTotals(items);
      return {
        periode: formatPeriodShort(run.period),
        "Salaire brut": Math.round(totals.grossSalary / 100) * 100,
        "Coût employeur": Math.round(totals.employerCost / 100) * 100,
      };
    });
  }, [sortedLockedRuns, itemsByRun]);

  function trend(current: number, previous: number): { pct: string; up: boolean } | null {
    if (!previous || previous === 0) return null;
    const diff = ((current - previous) / previous) * 100;
    return { pct: Math.abs(diff).toFixed(1), up: diff >= 0 };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
      </div>
    );
  }

  const irTrend = trend(latestTotals.ir, previousTotals.ir);
  const payrollTrend = trend(latestTotals.grossSalary, previousTotals.grossSalary);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 bg-emerald-50/60 text-emerald-800 px-2.5 py-1 rounded-md text-[11px] font-semibold ring-1 ring-emerald-600/10">
            <LayoutDashboard className="w-3.5 h-3.5" /> Vue d'ensemble
          </div>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
            {activeCompany?.name || "AtlasPaie"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Période de paie : <span className="font-semibold text-slate-700">{formatPeriod(currentPeriod())}</span>
          </p>
        </div>
        <div className="flex items-center gap-3 border border-slate-200 rounded-2xl p-2 bg-white shadow-sm">
          <span className="text-xs font-semibold text-slate-500 ml-1">Statut :</span>
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold ${
            currentStatus === "LOCKED"
              ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/20"
              : currentStatus === "DRAFT"
              ? "bg-amber-50 text-amber-800 ring-1 ring-amber-600/20"
              : "bg-slate-100 text-slate-500 ring-1 ring-slate-200/50"
          }`}>
            <span className={`h-2 w-2 rounded-full ${
              currentStatus === "LOCKED" ? "bg-emerald-600 animate-pulse" : currentStatus === "DRAFT" ? "bg-amber-500" : "bg-slate-400"
            }`} />
            {currentStatus === "LOCKED" ? "Verrouillé" : currentStatus === "DRAFT" ? "Brouillon" : "Non généré"}
          </div>
          <button
            onClick={() => navigate("/dashboard/runs")}
            className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-slate-950 text-white text-[11px] font-bold hover:bg-slate-800 transition-all shadow-sm active:scale-95"
            type="button"
          >
            <Wrench className="w-3.5 h-3.5" />
            Gérer
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Effectif actif"
          value={activeEmployees.length.toString()}
          icon={<Building2 className="w-5 h-5" />}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-100"
          gradient="from-indigo-100/50 to-blue-50/20"
        />
        <KpiCard
          label="Masse salariale brute"
          value={formatMoney(latestTotals.grossSalary)}
          subtitle={latestRun ? formatPeriod(latestRun.period) : null}
          icon={<TrendingUp className="w-5 h-5" />}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-100"
          trend={payrollTrend}
          gradient="from-emerald-100/50 to-teal-50/20"
        />
        <KpiCard
          label="Coût employeur total"
          value={formatMoney(latestTotals.employerCost)}
          subtitle={latestRun ? formatPeriod(latestRun.period) : null}
          icon={<TrendingUp className="w-5 h-5" />}
          iconColor="text-violet-600"
          iconBg="bg-violet-100"
          trend={trend(latestTotals.employerCost, previousTotals.employerCost)}
          gradient="from-violet-100/50 to-purple-50/20"
        />
        <KpiCard
          label="Impôt sur le Revenu"
          value={formatMoney(latestTotals.ir)}
          subtitle={latestRun ? formatPeriod(latestRun.period) : null}
          icon={<TrendingDown className="w-5 h-5" />}
          iconColor="text-rose-600"
          iconBg="bg-rose-100"
          trend={irTrend}
          gradient="from-rose-100/50 to-pink-50/20"
        />
      </div>

      {/* Chart + Breakdown row */}
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        {/* Chart: Monthly trend */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-md shadow-slate-100/60 overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50/30 px-5 py-3.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Évolution masse salariale</h2>
          </div>
          <div className="p-5">
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="periode" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", fontSize: 12 }}
                    formatter={(val: unknown) => formatMoney(Number(val))}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Line type="monotone" dataKey="Salaire brut" stroke="#0f172a" strokeWidth={2.5} dot={{ r: 4, fill: "#0f172a" }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="Coût employeur" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 4, fill: "#7c3aed" }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-sm text-slate-400">
                {chartData.length === 1 ? "Un seul mois de données — ajoutez plus de paies verrouillées." : "Aucune donnée disponible."}
              </div>
            )}
          </div>
        </div>

        {/* Breakdown */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-md shadow-slate-100/60 overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50/30 px-5 py-3.5 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {currentRun ? `Détail : ${formatPeriod(currentRun.period)}` : `Aucune paie pour ${formatPeriod(currentPeriod())}`}
            </h2>
            {currentRun && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                currentRun.status === "LOCKED" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${currentRun.status === "LOCKED" ? "bg-emerald-600" : "bg-amber-500"}`} />
                {currentRun.status === "LOCKED" ? "Verrouillé" : "Brouillon"}
              </span>
            )}
          </div>
          {currentRun ? (
            <div className="p-5 space-y-3.5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">Salaire & retenues</p>
                <BreakdownRow label="Salaire brut" value={currentTotals.grossSalary} bold />
                <BreakdownRow label="CNSS salariale" value={currentTotals.cnssEmployee} color="text-rose-600" />
                <BreakdownRow label="IR" value={currentTotals.ir} color="text-rose-600" />
                <BreakdownRow label="AMO" value={currentTotals.amo} color="text-rose-600" />
                <div className="border-t border-dashed border-slate-200 pt-2.5 mt-2.5">
                  <BreakdownRow label="Net à payer" value={currentTotals.netSalary} bold color="text-emerald-700" />
                </div>
              </div>
              <div className="border-t border-slate-100 pt-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">Charges patronales</p>
                <BreakdownRow label="CNSS patronale" value={currentTotals.cnssEmployer} color="text-rose-600" />
                <div className="border-t border-dashed border-slate-200 pt-2.5 mt-2.5">
                  <BreakdownRow label="Coût employeur total" value={currentTotals.employerCost} bold />
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-100">
                <span>{currentTotals.employeeCount} salarié{currentTotals.employeeCount > 1 ? "s" : ""}</span>
                <button
                  onClick={() => navigate("/dashboard/runs")}
                  className="flex items-center gap-1 text-slate-600 hover:text-slate-900 font-semibold"
                  type="button"
                >
                  Détail <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            <div className="p-10 text-center">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Générez la paie du mois pour voir le détail.</p>
              <button
                onClick={() => navigate("/dashboard/runs")}
                className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm"
                type="button"
              >
                <Wrench className="w-3.5 h-3.5" />
                Générer
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Recent periods + Quick actions */}
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        {/* Recent periods */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-md shadow-slate-100/60 overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50/30 px-5 py-3.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Dernières périodes verrouillées</h2>
          </div>
          {recentRuns.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {recentRuns.map(run => {
                const runItems = itemsByRun.get(run.id) ?? [];
                const totals = computeTotals(runItems);
                return (
                  <div
                    key={run.id}
                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors cursor-pointer text-sm"
                    onClick={() => navigate("/dashboard/runs")}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-900">{formatPeriod(run.period)}</span>
                      <span className="text-xs text-slate-400">{totals.employeeCount} sal.</span>
                    </div>
                    <div className="text-right font-mono text-sm font-bold text-slate-900">
                      {formatMoney(totals.grossSalary)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-10 text-center text-sm text-slate-400">
              Aucune période verrouillée.
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-md shadow-slate-100/60 p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Actions rapides</h2>
          <div className="flex flex-col gap-3">
            <ActionButton
              icon={<Plus className="w-4 h-4" />}
              label="Nouvel employé"
              onClick={() => navigate("/dashboard/employees")}
              color="bg-slate-950 hover:bg-slate-800"
            />
            <ActionButton
              icon={<Wrench className="w-4 h-4" />}
              label="Générer la paie"
              onClick={() => navigate("/dashboard/runs")}
              color="bg-emerald-600 hover:bg-emerald-700"
            />
            <ActionButton
              icon={<FileText className="w-4 h-4" />}
              label="Journal de paie"
              onClick={() => navigate("/dashboard/journal")}
              color="bg-violet-600 hover:bg-violet-700"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function KpiCard({
  label, value, subtitle, icon, iconColor, iconBg, trend: trendData, gradient,
}: {
  label: string; value: string; subtitle?: string | null; icon: React.ReactNode; iconColor: string; iconBg: string; trend?: { pct: string; up: boolean } | null; gradient?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100/50 relative overflow-hidden group hover:shadow-md hover:shadow-emerald-100/30 transition-all duration-300">
      {gradient && (
        <div className={`absolute -inset-10 bg-gradient-to-br ${gradient} opacity-40 blur-3xl pointer-events-none`} />
      )}
      <div className="relative z-10 flex flex-col h-full justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-1.5 text-xl font-black text-slate-950 tracking-tight truncate">{value}</p>
            {subtitle && <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{subtitle}</p>}
          </div>
          <div className={`p-2.5 rounded-xl border ${iconBg} ${iconColor} shrink-0`}>
            {icon}
          </div>
        </div>
        {trendData && (
          <div className={`mt-auto inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full ring-1 w-fit ${
            trendData.up ? "text-rose-700 bg-rose-50 ring-rose-200" : "text-emerald-700 bg-emerald-50 ring-emerald-200"
          }`}>
            {trendData.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trendData.pct}%
          </div>
        )}
      </div>
    </div>
  );
}

function BreakdownRow({ label, value, bold, color }: { label: string; value: number; bold?: boolean; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`font-mono ${bold ? "font-bold" : "font-semibold"} ${color || "text-slate-900"}`}>
        {formatMoney(value)}
      </span>
    </div>
  );
}

function ActionButton({ icon, label, onClick, color }: { icon: React.ReactNode; label: string; onClick: () => void; color: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 h-10 px-4 rounded-xl text-sm font-semibold text-white transition-all shadow-sm active:scale-[0.98] ${color}`}
      type="button"
    >
      {icon}
      {label}
      <ArrowRight className="w-3.5 h-3.5 ml-auto" />
    </button>
  );
}