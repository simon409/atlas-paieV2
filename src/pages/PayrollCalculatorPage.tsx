import { useMemo, useState } from "react";
import { calculatePayroll } from "../payroll/engine/grossToNet.ts";
import { explainPayroll } from "../payroll/debug/explain.ts";
import rules2026 from "../payroll/rules/2026.json";
import type { IRCalculationMode, PayrollRules } from "../payroll/rules/types.ts";
import type { CumulativeIRContext, PayrollInput } from "../types/payroll.types.ts";

type LineType = "allowance" | "bonus" | "deduction";
type NumericField = "baseSalary" | "dependentsCount";
type CumulativeField = keyof CumulativeIRContext;

type PayrollLine = {
  id: string;
  label: string;
  type: LineType;
  amount: number;
};

const rules = rules2026 as PayrollRules;

const presets = [
  { label: "SMIG", salary: 4000 },
  { label: "Moyen", salary: 6500 },
  { label: "Cadre", salary: 20000 },
];

const linePresets: Array<{ label: string; type: LineType }> = [
  { label: "Heures supp", type: "bonus" },
  { label: "Prime", type: "bonus" },
  { label: "Indemnité transport", type: "allowance" },
  { label: "Avance sur salaire", type: "deduction" },
];

function formatMoney(value: number): string {
  return new Intl.NumberFormat("fr-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function createLine(type: LineType = "bonus", label = ""): PayrollLine {
  return {
    id: crypto.randomUUID(),
    label,
    type,
    amount: 0,
  };
}

export function PayrollCalculatorPage() {
  const [baseSalary, setBaseSalary] = useState(6500);
  const [dependentsCount, setDependentsCount] = useState(0);
  const [irMode, setIRMode] = useState<IRCalculationMode>("simplified");
  const [cumulativeIR, setCumulativeIR] = useState<CumulativeIRContext>({
    month: 1,
    previousTaxableIncome: 0,
    previousIRWithheld: 0,
  });
  const [lines, setLines] = useState<PayrollLine[]>([
    { id: crypto.randomUUID(), label: "Heures supp", type: "bonus", amount: 0 },
    { id: crypto.randomUUID(), label: "Avance sur salaire", type: "deduction", amount: 0 },
  ]);

  const totals = useMemo(
    () => ({
      allowances: sumLines(lines, "allowance"),
      bonuses: sumLines(lines, "bonus"),
      deductions: sumLines(lines, "deduction"),
    }),
    [lines],
  );

  const input: PayrollInput = useMemo(
    () => ({
      baseSalary,
      allowances: totals.allowances,
      bonuses: totals.bonuses,
      deductions: totals.deductions,
      dependentsCount,
      irMode,
      cumulativeIR: irMode === "legal_simulation" ? cumulativeIR : undefined,
    }),
    [baseSalary, cumulativeIR, dependentsCount, irMode, totals],
  );

  const result = useMemo(() => calculatePayroll(input, rules), [input]);
  const explanation = useMemo(() => explainPayroll(result), [result]);

  function updateNumber(field: NumericField, value: string) {
    const nextValue = Number(value) || 0;
    if (field === "baseSalary") setBaseSalary(nextValue);
    if (field === "dependentsCount") setDependentsCount(nextValue);
  }

  function updateLine(id: string, patch: Partial<Omit<PayrollLine, "id">>) {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  function updateCumulativeIR(field: CumulativeField, value: string) {
    setCumulativeIR((current) => ({
      ...current,
      [field]: Number(value) || 0,
    }));
  }

  function removeLine(id: string) {
    setLines((current) => current.filter((line) => line.id !== id));
  }

  function addLine(type: LineType = "bonus", label = "") {
    setLines((current) => [...current, createLine(type, label)]);
  }

  function loadPreset(salary: number) {
    setBaseSalary(salary);
    setDependentsCount(0);
    setCumulativeIR({
      month: 1,
      previousTaxableIncome: 0,
      previousIRWithheld: 0,
    });
    setLines([]);
  }

  return (
    <div className="space-y-6">
      {/* Header Viewport Block */}
      <div className="flex flex-col gap-4 border-b border-zinc-200/60 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900">Simulateur de calcul</h1>
          <p className="text-xs font-medium text-zinc-400 mt-0.5">Calcul de salaire brut en net et régularisations IR.</p>
        </div>
        
        {/* Presets Action Stack */}
        <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-100/60 p-1">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider px-2">Gabarits :</span>
          {presets.map((preset) => (
            <button
              key={preset.label}
              className="h-7.5 rounded-md bg-white px-3 text-xs font-bold text-zinc-700 shadow-xs border border-zinc-200/80 hover:bg-zinc-50 active:scale-98 transition-all"
              type="button"
              onClick={() => loadPreset(preset.salary)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Two-Column App Layout */}
      <section className="grid items-start gap-6 xl:grid-cols-[400px_1fr]">
        
        {/* Left Column Controls */}
        <form className="space-y-5 rounded-xl border border-zinc-200 bg-white p-5 shadow-xs" onSubmit={(e) => e.preventDefault()}>
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <h2 className="text-sm font-bold text-zinc-800 uppercase tracking-wide">Variables d'entrée</h2>
            <span className="inline-flex items-center rounded-md bg-zinc-50 border border-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-500">Barème {rules.year || "2026"}</span>
          </div>

          <div className="space-y-4">
            <PayrollNumberInput label="Salaire de base" suffix="MAD" value={baseSalary} onChange={(value) => updateNumber("baseSalary", value)} />
            <PayrollNumberInput
              label="Nombre de charges (Enfants)"
              value={dependentsCount}
              min={0}
              max={rules.ir.maxDependents}
              onChange={(value) => updateNumber("dependentsCount", value)}
            />
          </div>

          {/* IR Segment Toggle Switch */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold tracking-wide uppercase text-zinc-400">Mode de calcul IR</label>
            <div className="grid grid-cols-2 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
              {(["simplified", "legal_simulation"] as IRCalculationMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`h-8 rounded-md text-xs font-bold transition-all ${
                    irMode === mode 
                      ? "bg-white text-zinc-900 shadow-xs border border-zinc-200/60" 
                      : "text-zinc-500 hover:text-zinc-900"
                  }`}
                  onClick={() => setIRMode(mode)}
                >
                  {mode === "simplified" ? "Mensuel Normal" : "Cumulé Annuel"}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Context Area for Cumulative Mode */}
          {irMode === "legal_simulation" && (
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/20 p-4 space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center gap-1.5 border-b border-emerald-100 pb-2">
                <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">Historique des mois précédents</h3>
              </div>
              <div className="space-y-3">
                <PayrollNumberInput label="Mois de paie en cours" min={1} max={12} value={cumulativeIR.month} onChange={(value) => updateCumulativeIR("month", value)} />
                <PayrollNumberInput label="SBI cumulé antérieur" suffix="MAD" value={cumulativeIR.previousTaxableIncome} onChange={(value) => updateCumulativeIR("previousTaxableIncome", value)} />
                <PayrollNumberInput label="IR prélevé antérieur" suffix="MAD" value={cumulativeIR.previousIRWithheld} onChange={(value) => updateCumulativeIR("previousIRWithheld", value)} />
              </div>
            </div>
          )}

          {/* Dynamic Lines Area */}
          <div className="border-t border-zinc-100 pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold tracking-wide uppercase text-zinc-400">Éléments variables</h3>
              <button 
                className="inline-flex h-7 items-center gap-1 rounded-md bg-zinc-900 px-2.5 text-xs font-bold text-white shadow-xs hover:bg-zinc-800 transition-colors" 
                type="button" 
                onClick={() => addLine()}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Ajouter
              </button>
            </div>

            {/* Micro Quick Presets Container */}
            <div className="flex flex-wrap gap-1.5">
              {linePresets.map((preset) => (
                <button
                  key={preset.label}
                  className="inline-flex h-6.5 items-center rounded-md border border-zinc-200 bg-white px-2 text-[11px] font-semibold text-zinc-600 shadow-2xs hover:border-emerald-600 hover:text-emerald-700 transition-colors"
                  type="button"
                  onClick={() => addLine(preset.type, preset.label)}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* List Engine Frame */}
            <div className="space-y-2">
              {lines.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-6 text-center text-xs font-medium text-zinc-400">
                  Aucun élément variable configuré sur ce traitement.
                </div>
              ) : (
                lines.map((line) => (
                  <PayrollLineEditor key={line.id} line={line} onChange={(patch) => updateLine(line.id, patch)} onRemove={() => removeLine(line.id)} />
                ))
              )}
            </div>

            {/* Small Totals Box Overlay */}
            <div className="grid grid-cols-3 gap-1.5 border-t border-zinc-100 pt-3">
              <MiniTotal label="Indemnités" value={totals.allowances} />
              <MiniTotal label="Primes" value={totals.bonuses} />
              <MiniTotal label="Retenues" value={totals.deductions} />
            </div>
          </div>
        </form>

        {/* Right Column Layout Frame: Performance & Visual Outputs */}
        <div className="space-y-6">
          
          {/* Executive Dashboard Scorecards */}
          <section className="grid gap-4 sm:grid-cols-3">
            <Metric label="Salaire Brut Global" value={result.grossSalary} tone="neutral" />
            <Metric label="Net à Payer (Salaire Net)" value={result.netSalary} tone="positive" />
            <Metric label="Coût Total Employeur" value={result.employerCost} tone="warning" />
          </section>

          {/* Structured Output Breakdowns & Core Traces */}
          <section className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
            
            {/* Left Breakdown Sheet */}
            <div className="rounded-xl border border-zinc-200 bg-white shadow-xs overflow-hidden">
              <div className="border-b border-zinc-100 px-4.5 py-3.5 bg-zinc-50/50">
                <h2 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Bulletin Synthétique des Calculs</h2>
              </div>
              <div className="divide-y divide-zinc-100">
                <BreakdownRow label="Salaire de base configuré" value={baseSalary} />
                <BreakdownRow label="Total des primes et gratifications" value={totals.bonuses} />
                <BreakdownRow label="Total des indemnités exonérées" value={totals.allowances} />
                <BreakdownRow label="Total des retenues sur salaire" value={totals.deductions} />
                <BreakdownRow label="Cotisation CNSS (Part Salariale)" value={result.cnssEmployee} />
                <BreakdownRow label="Cotisation AMO (Part Salariale)" value={result.amoEmployee} />
                <BreakdownRow label="Déduction pour Frais Professionnels" value={result.fraisProfessionnels} />
                <BreakdownRow label="Net Imposable (Assiette fiscale)" value={result.netTaxable} strong />
                <BreakdownRow label="Impôt sur le Revenu Net (IR)" value={result.irNet} strokeHighlight />
                
                {result.annualization && (
                  <div className="bg-emerald-50/10 border-y border-emerald-100/50 divide-y divide-zinc-100">
                    <BreakdownRow label="Cumul Net Imposable Actuel" value={result.annualization.cumulativeTaxableIncome} subtext />
                    <BreakdownRow label="Projection Annuelle Estimée" value={result.annualization.annualizedTaxableIncome} subtext />
                    <BreakdownRow label="Cumul Total IR Théorique" value={result.annualization.cumulativeIRDue} subtext />
                    <BreakdownRow label="Régularisation / IR du Mois" value={result.irNet} strong subtext />
                  </div>
                )}
                
                <BreakdownRow label="Cotisation CNSS (Part Patronale)" value={result.cnssEmployer} />
                <BreakdownRow label="Cotisation AMO (Part Patronale)" value={result.amoEmployer} />
              </div>
            </div>

            {/* Right Execution Flow History Logs */}
            <div className="rounded-xl border border-zinc-200 bg-white shadow-xs overflow-hidden">
              <div className="border-b border-zinc-100 px-4.5 py-3.5 bg-zinc-50/50">
                <h2 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Trace de Calcul Légale</h2>
              </div>
              <ol className="divide-y divide-zinc-100 max-h-[460px] overflow-y-auto">
                {result.trace.map((step, index) => (
                  <li key={step} className="flex gap-3 p-4 bg-white hover:bg-zinc-50/50 transition-colors">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-[10px] font-bold text-zinc-600 border border-zinc-200/50">
                      {index + 1}
                    </span>
                    <span className="min-w-0 text-xs font-semibold leading-relaxed text-zinc-600">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* Legal Explanations Framework Box */}
          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-xs space-y-3">
            <h2 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Notes Explicatives d'Audit</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {explanation.map((line, idx) => (
                <div key={idx} className="rounded-lg border border-zinc-200/60 bg-zinc-50/40 p-3.5 text-xs font-medium leading-relaxed text-zinc-500">
                  {line}
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function sumLines(lines: PayrollLine[], type: LineType): number {
  return lines.filter((line) => line.type === type).reduce((total, line) => total + line.amount, 0);
}

/* Custom Styled Components with Inputs Optimized for Quick-Tabbing */
function PayrollNumberInput({ label, value, min = 0, max, suffix, onChange }: { label: string; value: number; min?: number; max?: number; suffix?: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-zinc-700">{label}</label>
      <div className="relative flex items-center">
        <input
          className="h-9 w-full rounded-lg border border-zinc-300 bg-zinc-50/30 pl-3 pr-12 text-right text-sm font-bold text-zinc-900 shadow-inner outline-none transition-all focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-600/10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          type="number"
          min={min}
          max={max}
          value={value === 0 ? "" : value} // Prevent awkward placeholder overlap zero locks
          placeholder="0"
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix && (
          <span className="absolute right-3 text-[10px] font-bold tracking-wider text-zinc-400 select-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function PayrollLineEditor({ line, onChange, onRemove }: { line: PayrollLine; onChange: (patch: Partial<Omit<PayrollLine, "id">>) => void; onRemove: () => void }) {
  return (
    <div className="group rounded-lg border border-zinc-200 bg-zinc-50/50 p-2.5 space-y-2 hover:bg-zinc-50 transition-colors">
      <div className="grid gap-2 grid-cols-[1fr_110px]">
        <input
          aria-label="Désignation"
          className="h-8 rounded-md border border-zinc-300 bg-white px-2.5 text-xs font-semibold text-zinc-800 shadow-2xs outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
          value={line.label}
          placeholder="Libellé"
          onChange={(event) => onChange({ label: event.target.value })}
        />
        <select
          aria-label="Nature de ligne"
          className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs font-bold text-zinc-600 shadow-2xs outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
          value={line.type}
          onChange={(event) => onChange({ type: event.target.value as LineType })}
        >
          <option value="allowance">Indemnité</option>
          <option value="bonus">Prime</option>
          <option value="deduction">Retenue</option>
        </select>
      </div>
      <div className="grid gap-2 grid-cols-[1fr_32px]">
        <div className="relative flex items-center">
          <input
            aria-label="Montant de la ligne"
            className="h-8 w-full rounded-md border border-zinc-300 bg-white pl-2.5 pr-10 text-right text-xs font-bold text-zinc-900 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10"
            min={0}
            type="number"
            value={line.amount === 0 ? "" : line.amount}
            placeholder="0.00"
            onChange={(event) => onChange({ amount: Number(event.target.value) || 0 })}
          />
          <span className="absolute right-2.5 text-[9px] font-bold text-zinc-400">MAD</span>
        </div>
        <button 
          className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600" 
          type="button" 
          onClick={onRemove}
          title="Supprimer la ligne"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function MiniTotal({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-2 text-center shadow-2xs">
      <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">{label}</p>
      <p className="mt-0.5 text-xs font-extrabold text-zinc-800 truncate">{formatMoney(value).split(',')[0]} <span className="text-[9px] font-bold">DH</span></p>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "neutral" | "positive" | "warning" }) {
  const toneClass = {
    neutral: "border-zinc-200 bg-white text-zinc-900 shadow-2xs",
    positive: "border-emerald-200/80 bg-emerald-50/30 text-emerald-950 shadow-2xs",
    warning: "border-zinc-300/80 bg-zinc-900 text-white shadow-xs", // Accent contrast step shift
  }[tone];

  return (
    <div className={`rounded-xl border p-4.5 transition-all ${toneClass}`}>
      <p className={`text-xs font-bold tracking-wide uppercase ${tone === "warning" ? "text-zinc-400" : "text-zinc-400"}`}>{label}</p>
      <p className="mt-2 text-xl font-black tracking-tight leading-none">{formatMoney(value)}</p>
    </div>
  );
}

function BreakdownRow({ label, value, strong = false, strokeHighlight = false, subtext = false }: { label: string; value: number; strong?: boolean; strokeHighlight?: boolean; subtext?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 px-4.5 py-3 transition-colors ${strokeHighlight ? "bg-emerald-50/20 border-l-2 border-emerald-600" : "bg-white"} ${subtext ? "pl-8 py-2.5" : ""}`}>
      <span className={`text-xs ${strong ? "font-bold text-zinc-900" : "font-semibold text-zinc-500"}`}>{label}</span>
      <span className={`text-right text-xs ${strong ? "font-extrabold text-zinc-900" : "font-bold text-zinc-800"}`}>{formatMoney(value)}</span>
    </div>
  );
}
