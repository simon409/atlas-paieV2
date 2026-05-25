import { useEffect, useMemo, useState } from "react";
import { listPayrollItems, listPayrollRuns } from "../db/payrollRunStore.ts";
import type { PayrollItem, PayrollRun } from "../db/models.ts";
import { Printer } from "lucide-react";

const formatMoney = (value: number): string =>
  new Intl.NumberFormat("fr-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const monthsList = [
  { value: "ALL", label: "Tous les mois" },
  { value: "01", label: "Janvier" }, { value: "02", label: "Février" },
  { value: "03", label: "Mars" }, { value: "04", label: "Avril" },
  { value: "05", label: "Mai" }, { value: "06", label: "Juin" },
  { value: "07", label: "Juillet" }, { value: "08", label: "Août" },
  { value: "09", label: "Septembre" }, { value: "10", label: "Octobre" },
  { value: "11", label: "Novembre" }, { value: "12", label: "Décembre" }
];

const currentYear = new Date().getFullYear().toString();

const formatPeriod = (period: string): string => {
  const date = new Date(period + "-01");
  if (isNaN(date.getTime())) return period;
  return new Intl.DateTimeFormat("fr-MA", {
    month: "long",
    year: "numeric",
  }).format(date);
};

type JournalRow = {
  employeeName: string;
  employeeMatricule: string;
  grossSalary: number;
  cnssEmployee: number;
  ir: number;
  amo: number;
  netSalary: number;
  cnssEmployer: number;
  employerCost: number;
};

export function PayrollJournalPage() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [allItems, setAllItems] = useState<(PayrollItem & { _period: string })[]>([]);
  const [filterYear, setFilterYear] = useState(currentYear);
  const [filterMonth, setFilterMonth] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const allRuns = await listPayrollRuns();
      const lockedRuns = allRuns.filter(r => r.status === "LOCKED");
      setRuns(lockedRuns);

      const collected: (PayrollItem & { _period: string })[] = [];
      for (const run of lockedRuns) {
        const runItems = await listPayrollItems(run.id);
        for (const item of runItems) {
          collected.push({ ...item, _period: run.period });
        }
      }
      setAllItems(collected);

      if (lockedRuns.length > 0) {
        const sorted = [...lockedRuns].sort((a, b) => b.period.localeCompare(a.period));
        const [y, m] = sorted[0].period.split("-");
        setFilterYear(y);
        setFilterMonth(m);
      }
    } catch (err) {
      setError("Erreur lors du chargement du journal.");
    } finally {
      setLoading(false);
    }
  }

  const periods = useMemo(() => {
    const set = new Set(runs.map(r => r.period));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [runs]);

  const uniqueYears = useMemo(() => {
    const years = periods.map(p => p.split("-")[0]);
    return Array.from(new Set([currentYear, ...years])).sort((a, b) => b.localeCompare(a));
  }, [periods]);

  const filteredRuns = useMemo(() => {
    return periods.filter(p => {
      const [y, m] = p.split("-");
      const matchesMonth = filterMonth === "ALL" || m === filterMonth;
      const matchesYear = y === filterYear;
      return matchesMonth && matchesYear;
    });
  }, [periods, filterYear, filterMonth]);

  const rows = useMemo(() => {
    const result: JournalRow[] = [];
    const periodSet = new Set(filteredRuns);
    for (const item of allItems) {
      if (!periodSet.has(item._period)) continue;
      result.push({
        employeeName: item.employeeName,
        employeeMatricule: item.employeeMatricule,
        grossSalary: item.grossSalary,
        cnssEmployee: item.cnssEmployee,
        ir: item.ir,
        amo: item.amo,
        netSalary: item.netSalary,
        cnssEmployer: item.cnssEmployer,
        employerCost: item.grossSalary + item.cnssEmployer + item.amo,
      });
    }
    return result;
  }, [allItems, filteredRuns]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        grossSalary: acc.grossSalary + r.grossSalary,
        cnssEmployee: acc.cnssEmployee + r.cnssEmployee,
        ir: acc.ir + r.ir,
        amo: acc.amo + r.amo,
        netSalary: acc.netSalary + r.netSalary,
        cnssEmployer: acc.cnssEmployer + r.cnssEmployer,
        employerCost: acc.employerCost + r.employerCost,
      }),
      { grossSalary: 0, cnssEmployee: 0, ir: 0, amo: 0, netSalary: 0, cnssEmployer: 0, employerCost: 0 }
    );
  }, [rows]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 bg-slate-50/50 min-h-screen print:bg-white print:p-0">

      <style>{`
        @page {
          size: landscape;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          .print-workspace, .print-workspace * {
            visibility: visible;
          }
          .print-workspace {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
            box-shadow: none !important;
            border: none !important;
            background: white;
          }
          .no-print {
            display: none !important;
          }
          .forced-bg-dark {
            background-color: #1e293b !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .forced-bg-white {
            background-color: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .forced-bg-grey {
            background-color: #f8fafc !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Controls (Hidden on Print) */}
      <div className="no-print">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Journal de Paie</h1>
            <p className="mt-2 text-sm text-slate-500">Registre récapitulatif des éléments de paie par période.</p>
          </div>
          <button
            onClick={() => window.print()}
            disabled={rows.length === 0}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 h-11 text-sm font-semibold text-white transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:bg-slate-300"
          >
            <Printer className="h-4 w-4" />
            Imprimer le Journal
          </button>
        </div>

        {error && <div className="mb-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-800">⚠️ {error}</div>}

        {/* Filter Selection Panel */}
        <div className="mb-8 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-400 uppercase tracking-wider">Mois</label>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 transition-all focus:border-emerald-500 focus:bg-white focus:outline-none"
            >
              {monthsList.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-400 uppercase tracking-wider">Année d'Exercice</label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 transition-all focus:border-emerald-500 focus:bg-white focus:outline-none"
            >
              <option value="ALL">Toutes les années</option>
              {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Print Workspace */}
      <div className="print-workspace">
        {loading ? (
          <div className="p-12 text-center text-sm font-semibold text-slate-400 animate-pulse">Chargement...</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm font-medium text-slate-400">Aucune donnée pour la période sélectionnée.</div>
        ) : (
          <>
            {/* Period Title */}
            <div className="mb-4 text-center">
              <h2 className="text-lg font-bold text-slate-900">Journal de Paie</h2>
              <p className="text-sm text-slate-500">
                {filterMonth === "ALL" ? `Exercice ${filterYear}` : formatPeriod(`${filterYear}-${filterMonth}`)}
              </p>
            </div>

            <table className="w-full text-[11px] border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-800 text-white uppercase tracking-wider forced-bg-dark">
                  <th className="px-3 py-2 text-left border border-slate-300">Matricule</th>
                  <th className="px-3 py-2 text-left border border-slate-300">Nom & Prénom</th>
                  <th className="px-3 py-2 text-right border border-slate-300">Salaire Brut</th>
                  <th className="px-3 py-2 text-right border border-slate-300">CNSS Sal.</th>
                  <th className="px-3 py-2 text-right border border-slate-300">IR</th>
                  <th className="px-3 py-2 text-right border border-slate-300">AMO</th>
                  <th className="px-3 py-2 text-right border border-slate-300">Net à Payer</th>
                  <th className="px-3 py-2 text-right border border-slate-300">CNSS Pat.</th>
                  <th className="px-3 py-2 text-right border border-slate-300">Coût Employeur</th>
                </tr>
              </thead>
              <tbody className="font-mono text-slate-700">
                {rows.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white forced-bg-white" : "bg-slate-50/80 forced-bg-grey"}>
                    <td className="px-3 py-2 border border-slate-300 text-slate-600">{row.employeeMatricule}</td>
                    <td className="px-3 py-2 border border-slate-300 font-semibold text-slate-900 font-sans">{row.employeeName}</td>
                    <td className="px-3 py-2 text-right border border-slate-300 font-bold text-slate-900">{formatMoney(row.grossSalary)}</td>
                    <td className="px-3 py-2 text-right border border-slate-300 text-rose-600">{formatMoney(row.cnssEmployee)}</td>
                    <td className="px-3 py-2 text-right border border-slate-300 text-rose-600">{formatMoney(row.ir)}</td>
                    <td className="px-3 py-2 text-right border border-slate-300 text-rose-600">{formatMoney(row.amo)}</td>
                    <td className="px-3 py-2 text-right border border-slate-300 font-bold text-emerald-700">{formatMoney(row.netSalary)}</td>
                    <td className="px-3 py-2 text-right border border-slate-300 text-rose-600">{formatMoney(row.cnssEmployer)}</td>
                    <td className="px-3 py-2 text-right border border-slate-300 font-bold text-slate-900">{formatMoney(row.employerCost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold forced-bg-grey">
                  <td colSpan={2} className="px-3 py-3 text-xs uppercase tracking-wider text-slate-700 border border-slate-300">Totaux</td>
                  <td className="px-3 py-3 text-right border border-slate-300 text-slate-900">{formatMoney(totals.grossSalary)}</td>
                  <td className="px-3 py-3 text-right border border-slate-300 text-rose-700">{formatMoney(totals.cnssEmployee)}</td>
                  <td className="px-3 py-3 text-right border border-slate-300 text-rose-700">{formatMoney(totals.ir)}</td>
                  <td className="px-3 py-3 text-right border border-slate-300 text-rose-700">{formatMoney(totals.amo)}</td>
                  <td className="px-3 py-3 text-right border border-slate-300 text-emerald-800">{formatMoney(totals.netSalary)}</td>
                  <td className="px-3 py-3 text-right border border-slate-300 text-rose-700">{formatMoney(totals.cnssEmployer)}</td>
                  <td className="px-3 py-3 text-right border border-slate-300 text-slate-900">{formatMoney(totals.employerCost)}</td>
                </tr>
              </tfoot>
            </table>

            <p className="mt-2 text-[9px] text-slate-400 italic text-right">
              Document généré le {new Intl.DateTimeFormat("fr-MA", { dateStyle: "long", timeStyle: "short" }).format(new Date())}
            </p>
          </>
        )}
      </div>
    </div>
  );
}