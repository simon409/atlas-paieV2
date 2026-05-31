import { useEffect, useState, useMemo } from "react";
import {
  listPayrollItemLines,
  listPayrollItems,
  listPayrollRuns
} from "../db/payrollRunStore.ts";
import type { PayrollItem, PayrollItemLine, PayrollRun } from "../db/models.ts";
import { useCompany } from "../app/CompanyContext.tsx";
import { Printer } from "lucide-react";

const formatMoney = (value: number): string =>
  new Intl.NumberFormat("fr-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

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

type InfoCell = { label: string; value: string; color: string };

function collectInfoCells(infoRows: PayrollItemLine[], item: PayrollItem): InfoCell[] {
  const cells: InfoCell[] = [];

  infoRows.forEach(line => {
    cells.push({
      label: line.label,
      value: formatMoney(line.amount),
      color: line.amount >= 0 ? "text-emerald-600" : "text-rose-600",
    });
  });

  if (item.cumulativeTaxableIncome != null) {
    cells.push({ label: "Revenu imposable cumulé (annuel)", value: formatMoney(item.cumulativeTaxableIncome), color: "text-slate-800" });
  }
  if (item.previousIrWithheld != null) {
    cells.push({ label: "IR déjà retenu (cumul annuel)", value: formatMoney(item.previousIrWithheld), color: "text-rose-600" });
  }
  if (item.cumulativeIrDue != null) {
    cells.push({ label: "IR dû cumulé (annuel)", value: formatMoney(item.cumulativeIrDue), color: "text-rose-600" });
  }
  if (item.roundingCarryForward > 0) {
    cells.push({ label: "Report d'arrondi cumulé", value: formatMoney(item.roundingCarryForward), color: "text-amber-600" });
  }

  return cells;
}

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

export function PayslipsPage() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [allItems, setAllItems] = useState<PayrollItem[]>([]);
  const [selectedLines, setSelectedLines] = useState<PayrollItemLine[]>([]);

  const [filterMonth, setFilterMonth] = useState<string>("ALL");
  const [filterYear, setFilterYear] = useState<string>(currentYear);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [selectedItem, setSelectedItem] = useState<PayrollItem | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [loadingLines, setLoadingLines] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const { activeCompany } = useCompany();


  useEffect(() => {
    void loadWorkspaceData();
  }, []);

  async function loadWorkspaceData() {
    setLoading(true);
    setError("");
    try {
      const [allRuns] = await Promise.all([listPayrollRuns()]);

      const lockedRuns = allRuns.filter(r => r.status === "LOCKED");
      setRuns(lockedRuns);

      const collectedItems: PayrollItem[] = [];
      for (const run of lockedRuns) {
        const runItems = await listPayrollItems(run.id);
        const augmentedItems = runItems.map(item => ({
          ...item,
          _period: run.period
        }));
        collectedItems.push(...augmentedItems);
      }

      setAllItems(collectedItems);

      // Default to last locked period
      if (lockedRuns.length > 0) {
        const sorted = [...lockedRuns].sort((a, b) => b.period.localeCompare(a.period));
        const lastPeriod = sorted[0].period;
        const [lastYear, lastMonth] = lastPeriod.split("-");
        setFilterYear(lastYear);
        setFilterMonth(lastMonth);

        // Wait for state to settle, then select first slip from that period
        requestAnimationFrame(() => {
          const lastPeriodItems = collectedItems.filter(
            (item: any) => item._period === lastPeriod
          );
          if (lastPeriodItems.length > 0) {
            void handleSelectSlip(lastPeriodItems[0]);
          } else if (collectedItems.length > 0) {
            void handleSelectSlip(collectedItems[0]);
          }
        });
      } else if (collectedItems.length > 0) {
        await handleSelectSlip(collectedItems[0]);
      }
    } catch (err) {
      setError("Erreur lors de la synchronisation avec le stockage local.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectSlip(item: PayrollItem) {
    setSelectedItem(item);
    setLoadingLines(true);
    setSelectedLines([]);
    try {
      const lines = await listPayrollItemLines(item.id);
      setSelectedLines(lines);
    } catch (err) {
      setError("Impossible de charger les lignes de calcul de ce bulletin.");
    } finally {
      setLoadingLines(false);
    }
  }

  const filteredSlips = useMemo(() => {
    return allItems.filter((item: any) => {
      const [year, month] = (item._period || "").split("-");
      const matchesMonth = filterMonth === "ALL" || month === filterMonth;
      const matchesYear = filterYear === "ALL" || year === filterYear;

      const normalSearch = searchQuery.toLowerCase();
      const matchesEmployee =
        item.employeeName?.toLowerCase().includes(normalSearch) ||
        item.employeeId?.toLowerCase().includes(normalSearch);

      return matchesMonth && matchesYear && matchesEmployee;
    });
  }, [allItems, filterMonth, filterYear, searchQuery]);

  const uniqueYears = useMemo(() => {
    const years = runs.map(r => r.period.split("-")[0]);
    return Array.from(new Set([currentYear, ...years])).sort((a, b) => b.localeCompare(a));
  }, [runs]);

  const structuredRows = useMemo(() => {
    const rowsMap: Record<string, { label: string; base: number | null; salarialRate: number | null; salarialAmount: number | null; patronalRate: number | null; patronalAmount: number | null; isEarning: boolean }> = {};

    selectedLines.forEach(line => {
      const key = line.code || line.label;

      if (line.type === "EARNING") {
        rowsMap[line.id] = {
          label: line.label,
          base: line.baseAmount,
          salarialRate: line.rate,
          salarialAmount: line.amount,
          patronalRate: null,
          patronalAmount: null,
          isEarning: true
        };
      } else if (line.type === "DEDUCTION") {
        if (!rowsMap[key]) {
          rowsMap[key] = { label: line.label, base: line.baseAmount, salarialRate: line.rate, salarialAmount: line.amount, patronalRate: null, patronalAmount: null, isEarning: false };
        } else {
          rowsMap[key].salarialRate = line.rate;
          rowsMap[key].salarialAmount = line.amount;
        }
      } else if (line.type === "EMPLOYER") {
        if (!rowsMap[key]) {
          rowsMap[key] = { label: line.label, base: line.baseAmount, salarialRate: null, salarialAmount: null, patronalRate: line.rate, patronalAmount: line.amount, isEarning: false };
        } else {
          rowsMap[key].patronalRate = line.rate;
          rowsMap[key].patronalAmount = line.amount;
        }
      }
    });

    return Object.values(rowsMap);
  }, [selectedLines]);

  const infoRows = useMemo(() => {
    return selectedLines.filter(line => line.type === "INFO");
  }, [selectedLines]);

  const formatPeriod = (periodString: string | undefined) => {
    if (!periodString) return "N/A";

    // Appends a day (01) so the Date constructor parses it reliably
    const date = new Date(`${periodString}-01`);

    // Checks if the date is valid
    if (isNaN(date.getTime())) return periodString;

    // Formats to French: "avril 2025"
    const formatted = new Intl.DateTimeFormat("fr-MA", {
      month: 'long',
      year: 'numeric'
    }).format(date);

    // Capitalizes the first letter to get "Avril 2025"
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  const selectedEmployee = useMemo(() => {
    if (!selectedItem) return undefined;
    try {
      return JSON.parse(selectedItem.employeeSnapshot) as Record<string, any>;
    } catch {
      return undefined;
    }
  }, [selectedItem]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 bg-slate-50/50 min-h-screen print:bg-white print:p-0">

      <style>{`
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
          /* Forces backgrounds to display/print in Chrome, Safari, and Edge previews */
          .forced-bg-dark {
            background-color: #1e293b !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .forced-bg-light {
            background-color: #334155 !important;
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

      {/* Control Navigation (Hidden on Print) */}
      <div className="no-print">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Bulletins de Paie</h1>
            <p className="mt-2 text-sm text-slate-500">Consulter, filtrer par période et imprimer les fiches de paie réglementaires.</p>
          </div>
          <button
            onClick={() => window.print()}
            disabled={!selectedItem || loadingLines}
            className="cursor-pointer flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 h-11 text-sm font-semibold text-white transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:bg-slate-300"
          >
            <Printer className="h-5 w-5" />
            Imprimer ce Bulletin
          </button>
        </div>

        {error && <div className="mb-6 rounded-xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-800">⚠️ {error}</div>}

        {/* Filter Selection Panel */}
        <div className="mb-8 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-400 uppercase tracking-wider">Recherche Collaborateur</label>
            <input
              type="text"
              placeholder="Nom, prénom ou matricule..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium transition-all focus:border-emerald-500 focus:bg-white focus:outline-none"
            />
          </div>

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

      <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)] print:block">

        {/* Left Interactive List (Hidden on Print) */}
        <div className="no-print">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Bulletins Générés ({filteredSlips.length})</h2>
            </div>
            <div className="divide-y divide-slate-100 max-h-[580px] overflow-y-auto">
              {loading ? (
                <div className="p-6 text-center text-sm font-medium text-slate-400 animate-pulse">Chargement...</div>
              ) : filteredSlips.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm font-medium text-slate-400">Aucun enregistrement.</div>
              ) : (
                filteredSlips.map((item) => {
                  const isSelected = selectedItem?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => void handleSelectSlip(item)}
                      className={`relative block w-full px-5 py-4 text-left transition-all hover:bg-slate-50/80 ${isSelected ? "bg-emerald-50/40" : "bg-white"}`}
                      type="button"
                    >
                      {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-600 rounded-r-md" />}
                      <span className="block font-bold text-slate-900 tracking-tight">{item.employeeName}</span>
                      <div className="mt-2 flex justify-between text-xs text-slate-400 font-mono">
                        <span>{item.employeeId}</span>
                        <span className="font-sans font-bold text-slate-700">{formatMoney(item.netSalary)}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Core Document Printing Space */}
        <div className="print-workspace">
          {selectedItem ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:p-0 print:border-none print:shadow-none">

              {/* Institutional Header Block */}
              <div className="grid grid-cols-2 gap-4 border-b-2 border-slate-300 pb-3 mb-3">
                <div>
                  <h1 className="text-sm font-black text-slate-900 tracking-wide uppercase">{activeCompany?.name || "N/A"}</h1>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">ICE: {activeCompany?.ice || "N/A"}</p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">N° CNSS: {activeCompany?.cnssAffiliation || "N/A"}</p>
                  <div className="mt-3 space-y-0.5 text-[11px] text-slate-600">
                    <div><span className="font-semibold text-slate-400">Période :</span> {formatPeriod(selectedItem._period) || "N/A"}</div>
                  </div>
                </div>
                <div className="text-right flex flex-col justify-between items-end">
                  <h2 className="text-xs font-black text-slate-800 tracking-wider uppercase bg-slate-100 px-2.5 py-1 rounded-md">
                    Bulletin de Paie
                  </h2>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Calcul ID : <span className="font-bold text-slate-600">{selectedItem.calculationHash.substring(0, 12)}</span>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 mb-3 overflow-hidden print:bg-white">
                <div className="grid grid-cols-4 divide-x divide-slate-200 border-b border-slate-200 text-[11px]">
                  <div className="p-2">
                    <span className="block text-slate-400 uppercase tracking-wide text-[9px] font-bold">Nom & Prénom</span>
                    <span className="font-bold text-slate-800">{selectedEmployee?.fullName || "-"}</span>
                  </div>
                  <div className="p-2">
                    <span className="block text-slate-400 uppercase tracking-wide text-[9px] font-bold">Matricule</span>
                    <span className="font-mono text-slate-800">{selectedEmployee?.matricule || "-"}</span>
                  </div>
                  <div className="p-2">
                    <span className="block text-slate-400 uppercase tracking-wide text-[9px] font-bold">Fonction</span>
                    <span className="text-slate-800">{selectedEmployee?.functionTitle || selectedEmployee?.contractType || "-"}</span>
                  </div>
                </div>
                <div className="grid grid-cols-4 divide-x divide-slate-200 border-b border-slate-200 text-[11px]">
                  <div className="p-2">
                    <span className="block text-slate-400 uppercase tracking-wide text-[9px] font-bold">Département</span>
                    <span className="text-slate-800">{selectedEmployee?.department || "-"}</span>
                  </div>
                  <div className="p-2">
                    <span className="block text-slate-400 uppercase tracking-wide text-[9px] font-bold">N° C.I.N</span>
                    <span className="font-mono text-slate-800">{selectedEmployee?.cin || "-"}</span>
                  </div>
                  <div className="p-2">
                    <span className="block text-slate-400 uppercase tracking-wide text-[9px] font-bold">CNSS N°</span>
                    <span className="font-mono text-slate-800">{selectedEmployee?.cnssNumber || "-"}</span>
                  </div>
                  <div className="p-2">
                    <span className="block text-slate-400 uppercase tracking-wide text-[9px] font-bold">Date Entrée</span>
                    <span className="text-slate-800">{formatFrenchDate(selectedEmployee?.hireDate)}</span>
                  </div>

                </div>
                <div className="grid grid-cols-5 divide-x divide-slate-200 text-[11px]">
                  <div className="p-2">
                    <span className="block text-slate-400 uppercase tracking-wide text-[9px] font-bold">Date Ancienneté</span>
                    <span className="text-slate-800">{formatFrenchDate(selectedEmployee?.seniorityDate)}</span>
                  </div>
                  <div className="p-2">
                    <span className="block text-slate-400 uppercase tracking-wide text-[9px] font-bold">Date Naissance</span>
                    <span className="text-slate-800">{formatFrenchDate(selectedEmployee?.birthDate)}</span>
                  </div>
                  <div className="p-2">
                    <span className="block text-slate-400 uppercase tracking-wide text-[9px] font-bold">Sit. Familiale</span>
                    <span className="text-slate-800">{selectedEmployee?.familyStatus || "-"}</span>
                  </div>
                  <div className="p-2">
                    <span className="block text-slate-400 uppercase tracking-wide text-[9px] font-bold">Nbr. d'Enf.</span>
                    <span className="text-slate-800">{selectedEmployee ? String(selectedEmployee.childrenCount) : "-"}</span>
                  </div>
                  <div className="p-2">
                    <span className="block text-slate-400 uppercase tracking-wide text-[9px] font-bold">Nbr. Déd.</span>
                    <span className="text-slate-800">{selectedEmployee ? String(selectedEmployee.deductionCount) : "-"}</span>
                  </div>
                </div>
              </div>

              {/* Rubrics breakdown table containing explicit nested grids */}
              <table className="w-full text-left text-[11px] border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-800 text-white uppercase text-[9px] tracking-wider divide-x divide-slate-600 forced-bg-dark">
                    <th className="p-2 w-1/3 border border-slate-300" rowSpan={2}>Désignation des Rubriques</th>
                    <th className="p-2 text-center w-20 border border-slate-300" rowSpan={2}>Assiette / Base</th>
                    <th className="p-1 text-center border border-slate-300" colSpan={2}>Part Salariale</th>
                    <th className="p-1 text-center border border-slate-300" colSpan={2}>Part Patronale</th>
                  </tr>
                  <tr className="bg-slate-700 text-white uppercase text-[8px] tracking-tight divide-x divide-slate-600 forced-bg-light">
                    <th className="p-1 text-center w-14 border border-slate-300">Taux</th>
                    <th className="p-1 text-right w-24 border border-slate-300">Montant (DH)</th>
                    <th className="p-1 text-center w-14 border border-slate-300">Taux</th>
                    <th className="p-1 text-right w-24 border border-slate-300">Montant (DH)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 font-mono text-slate-700">
                  {loadingLines ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-slate-400 font-sans border border-slate-300">Chargement des paramètres...</td>
                    </tr>
                  ) : (
                    structuredRows.map((row, index) => (
                      <tr key={index} className={row.isEarning ? "bg-white forced-bg-white" : "bg-slate-50/80 forced-bg-grey"}>
                        <td className="p-2 font-sans font-medium text-slate-800 border border-slate-300">{row.label}</td>
                        <td className="p-2 text-center text-slate-500 border border-slate-300">
                          {row.base ? new Intl.NumberFormat("fr-MA").format(row.base) : "—"}
                        </td>
                        {/* Part Salariale */}
                        <td className="p-1 text-center text-slate-400 border border-slate-300">
                          {row.salarialRate ? `${(row.salarialRate * 100).toFixed(2)}%` : "—"}
                        </td>
                        <td className={`p-1 text-right border border-slate-300 ${row.isEarning ? "font-bold text-slate-900" : "text-rose-600"}`}>
                          {row.salarialAmount ? new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2 }).format(row.salarialAmount) : "—"}
                        </td>
                        {/* Part Patronale */}
                        <td className="p-1 text-center text-slate-400 border border-slate-300">
                          {row.patronalRate ? `${(row.patronalRate * 100).toFixed(2)}%` : "—"}
                        </td>
                        <td className="p-1 text-right text-slate-600 border border-slate-300">
                          {row.patronalAmount ? new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2 }).format(row.patronalAmount) : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Totals Summary Matrix Row */}
              <div className="grid grid-cols-3 border-x border-b border-slate-300 text-[11px] font-mono bg-slate-50 p-2 divide-x divide-slate-300 text-center print:bg-slate-50">
                <div>
                  <span className="block text-[9px] uppercase font-sans text-slate-400 font-bold">Salaire Brut Global</span>
                  <span className="font-bold text-slate-800">{formatMoney(selectedItem.grossSalary)}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-sans text-slate-400 font-bold">Impôt Global (IR)</span>
                  <span className="font-bold text-rose-600">{formatMoney(selectedItem.ir)}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-sans text-slate-400 font-bold">Net Imposable</span>
                  <span className="font-bold text-slate-800">{formatMoney(selectedItem.taxableIncome)}</span>
                </div>
              </div>

              {/* Informational Sub-Table */}
              {(() => {
                const cells = collectInfoCells(infoRows, selectedItem);
                if (cells.length === 0) return null;
                return (
                  <div className="mt-4 mb-2">
                    <table className="w-full text-left text-[11px] border-collapse border border-slate-300">
                      <thead>
                        <tr className="bg-slate-800 text-white uppercase text-[9px] tracking-wider forced-bg-dark">
                          <th className="px-2 py-1 border border-slate-300" colSpan={cells.length}>Informations complémentaires</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="divide-x divide-slate-300 font-mono">
                          {cells.map((cell, i) => (
                            <td key={i} className={`px-2 py-1 text-center border border-slate-300 font-bold ${cell.color}`}>
                              <span className="block text-[8px] uppercase tracking-tight text-slate-400 font-sans">{cell.label}</span>
                              <span className="block text-[11px]">{cell.value}</span>
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              {/* Net Payout Information Block */}
              <div className="mt-4 flex justify-between items-end">
                <div className="text-[9px] text-slate-400 italic max-w-xs leading-relaxed">
                  Ce bulletin constitue une pièce justificative comptable nominative. Édité via le registre local de paie.
                </div>

                <div className="border border-slate-300 rounded-xl overflow-hidden w-56 shadow-2xs bg-white">
                  <div className="bg-slate-800 text-white text-[9px] tracking-wider uppercase font-bold text-center py-1 forced-bg-dark">
                    Net À Payer Effectif
                  </div>
                  <div className="text-center font-mono font-black text-base text-emerald-700 py-2">
                    {formatMoney(selectedItem.netSalary)}
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="mt-12 grid grid-cols-2 gap-4 border-t border-dashed border-slate-300 pt-6 text-center text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                <div>Signature de l'agent</div>
                <div>Cachet de l'établissement</div>
              </div>

            </div>
          ) : (
            <div className="px-6 py-12 text-center text-sm font-medium text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white">
              Sélectionnez un agent à gauche pour charger son relevé complet.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
