import { useEffect, useState } from "react";
import {
  deleteDeclaration,
  generateCnssDeclaration,
  generateIrDeclaration,
  getDeclarationLines,
  listDeclarations,
  markDeclarationExported,
} from "../db/declarationStore.ts";
import { listPayrollRuns } from "../db/payrollRunStore.ts";
import type { Declaration, DeclarationLine, PayrollRun } from "../db/models.ts";
import { useCanWrite } from "../auth/AuthContext.tsx";
import { exportCnssDeclaration, type ExportFormat } from "../declarations/cnss/cnssExportService.ts";
import { validateCnssLines, type ValidationError } from "../declarations/cnss/cnssValidation.ts";
import { generateCsv } from "../declarations/exports/csvExport.ts";

function formatMoney(value: number): string {
  return new Intl.NumberFormat("fr-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function DeclarationsPage() {
  const canWrite = useCanWrite();
  const [declarations, setDeclarations] = useState<Declaration[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [selectedDeclId, setSelectedDeclId] = useState<string | null>(null);
  const [lines, setLines] = useState<DeclarationLine[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"cnss" | "ir">("cnss");

  const selectedDecl = declarations.find((d) => d.id === selectedDeclId) ?? null;

  useEffect(() => {
    void loadData();
  }, [activeTab]);

  async function loadData() {
    setError("");
    try {
      const [nextDecls, nextRuns] = await Promise.all([
        listDeclarations(activeTab === "cnss" ? "CNSS" : "IR"),
        listPayrollRuns(),
      ]);
      setDeclarations(nextDecls);
      setRuns(nextRuns.filter((r) => r.status === "LOCKED"));
    } catch (err) {
      setError("Échec du chargement des déclarations.");
    }
  }

  async function handleSelectDecl(id: string) {
    setSelectedDeclId(id);
    setValidationErrors([]);
    try {
      const nextLines = await getDeclarationLines(id);
      setLines(nextLines);
    } catch {
      setLines([]);
    }
  }

  async function handleGenerate() {
    setBusy(true);
    setError("");
    setValidationErrors([]);
    try {
      const lockedRuns = runs;
      if (lockedRuns.length === 0) throw new Error("Aucun traitement verrouillé trouvé");
      const latestRun = lockedRuns[0];

      let decl: Declaration;
      if (activeTab === "cnss") {
        decl = await generateCnssDeclaration(latestRun.id);
      } else {
        decl = await generateIrDeclaration(latestRun.id);
      }

      setDeclarations((prev) => [decl, ...prev]);
      setSelectedDeclId(decl.id);
      const nextLines = await getDeclarationLines(decl.id);
      setLines(nextLines);

      if (activeTab === "cnss") {
        const errors = validateCnssLines(nextLines);
        setValidationErrors(errors);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de générer la déclaration");
    } finally {
      setBusy(false);
    }
  }

  async function handleExport(format: ExportFormat) {
    if (!selectedDecl) return;
    setError("");
    try {
      const companyName = localStorage.getItem("atlas-paie.company-name") ?? "Société";
      const { content, filename, mimeType } = await exportCnssDeclaration(
        selectedDecl.id,
        format,
        companyName,
      );
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      await markDeclarationExported(selectedDecl.id);
      setDeclarations((prev) =>
        prev.map((d) => (d.id === selectedDecl.id ? { ...d, exported: true } : d)),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'export");
    }
  }

  async function handleExportIrCsv() {
    if (!selectedDecl) return;
    setError("");
    try {
      const content = generateCsv(lines);
      const blob = new Blob([content], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      await markDeclarationExported(selectedDecl.id);
      setDeclarations((prev) =>
        prev.map((d) => (d.id === selectedDecl.id ? { ...d, exported: true } : d)),
      );

      const a = document.createElement("a");
      a.href = url;
      a.download = `ir_${selectedDecl.period}.csv`;
      a.click();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'export");
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    setError("");
    try {
      await deleteDeclaration(id);
      setDeclarations((prev) => prev.filter((d) => d.id !== id));
      if (selectedDeclId === id) {
        setSelectedDeclId(null);
        setLines([]);
      }
    } catch (err) {
      setError("Impossible de supprimer la déclaration");
    } finally {
      setBusy(false);
    }
  }

  const lockedRunCount = runs.length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 bg-slate-50/50 min-h-screen">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Déclarations</h1>
          <p className="mt-2 text-sm text-slate-500 max-w-xl">
            Gérez les déclarations CNSS, IR et exports.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canWrite && (
            <button
              className="h-10 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:bg-slate-300"
              type="button"
              disabled={busy || lockedRunCount === 0}
              onClick={handleGenerate}
            >
              {busy ? "Génération..." : `Générer déclaration ${activeTab === "cnss" ? "CNSS" : "IR"}`}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-100 bg-red-50/70 p-4 text-sm font-medium text-red-800">
          <div>{error}</div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        <button
          className={`h-9 rounded-lg px-4 text-sm font-bold transition-all ${
            activeTab === "cnss"
              ? "bg-emerald-600 text-white"
              : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
          }`}
          type="button"
          onClick={() => { setActiveTab("cnss"); setSelectedDeclId(null); setLines([]); }}
        >
          CNSS
        </button>
        <button
          className={`h-9 rounded-lg px-4 text-sm font-bold transition-all ${
            activeTab === "ir"
              ? "bg-emerald-600 text-white"
              : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
          }`}
          type="button"
          onClick={() => { setActiveTab("ir"); setSelectedDeclId(null); setLines([]); }}
        >
          IR
        </button>
      </div>

      <section className="grid gap-8 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Sidebar */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm h-fit overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              {activeTab === "cnss" ? "Déclarations CNSS" : "Déclarations IR"}
            </h2>
          </div>
          <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
            {declarations.length === 0 && (
              <div className="px-5 py-12 text-center text-sm font-medium text-slate-400">
                Aucune déclaration.
              </div>
            )}
            {declarations.map((decl) => {
              const isSelected = selectedDeclId === decl.id;
              return (
                <button
                  key={decl.id}
                  className={`relative block w-full px-5 py-4 text-left transition-all hover:bg-slate-50/80 ${
                    isSelected ? "bg-emerald-50/40" : "bg-white"
                  }`}
                  type="button"
                  onClick={() => handleSelectDecl(decl.id)}
                >
                  {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-600 rounded-r-md" />
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-slate-900">{decl.period}</span>
                    <div className="flex items-center gap-1.5">
                      {decl.exported && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Exporté" />
                      )}
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ring-1 ring-inset ${
                          decl.status === "GENERATED"
                            ? "bg-blue-50 text-blue-700 ring-blue-600/10"
                            : "bg-amber-50 text-amber-700 ring-amber-600/10"
                        }`}
                      >
                        {decl.status === "GENERATED" ? "Générée" : "Brouillon"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    {decl.totals.employeeCount} employé{decl.totals.employeeCount > 1 ? "s" : ""}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main content */}
        <div className="space-y-6">
          {selectedDecl && (
            <>
              {/* Summary */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-4">
                  {activeTab === "cnss" ? "Déclaration CNSS" : "Déclaration IR"} — {selectedDecl.period}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCard label="Effectifs" value={selectedDecl.totals.employeeCount.toString()} />
                  <MetricCard label="Total brut" value={formatMoney(selectedDecl.totals.totalGross)} />
                  {activeTab === "cnss" && (
                    <>
                      <MetricCard label="Base CNSS" value={formatMoney(selectedDecl.totals.totalCnssBase)} />
                      <MetricCard label="CNSS employeur" value={formatMoney(selectedDecl.totals.totalEmployerCnss)} />
                    </>
                  )}
                  {activeTab === "ir" && (
                    <MetricCard label="Total IR" value={formatMoney(selectedDecl.totals.totalIr)} />
                  )}
                  <MetricCard label="Total net" value={formatMoney(selectedDecl.totals.totalNet)} />
                </div>
              </div>

              {/* Validation errors */}
              {validationErrors.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <h4 className="text-sm font-bold text-amber-800 mb-2">Erreurs de validation</h4>
                  <ul className="space-y-1">
                    {validationErrors.map((err, i) => (
                      <li key={i} className="text-xs text-amber-700">
                        {err.employeeName}: {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Export actions */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h4 className="text-sm font-bold text-slate-900 mb-3">Export</h4>
                <div className="flex flex-wrap gap-2">
                  {activeTab === "cnss" && (
                    <>
                      <ExportButton label="Export TXT (Damancom)" onClick={() => handleExport("txt")} busy={busy} />
                      <ExportButton label="Export CSV" onClick={() => handleExport("csv")} busy={busy} />
                      <ExportButton label="Export XML" onClick={() => handleExport("xml")} busy={busy} />
                    </>
                  )}
                  {activeTab === "ir" && (
                    <ExportButton label="Export CSV" onClick={handleExportIrCsv} busy={busy} />
                  )}
                  {canWrite && (
                    <button
                      className="h-9 rounded-lg border border-rose-200 bg-white px-3.5 text-xs font-semibold text-rose-600 transition-all hover:bg-rose-50 disabled:opacity-50"
                      type="button"
                      disabled={busy}
                      onClick={() => handleDelete(selectedDecl.id)}
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              </div>

              {/* Lines table */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-100 bg-slate-50/30 px-6 py-4">
                  <h4 className="text-sm font-bold text-slate-900">Lignes de déclaration</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="px-4 py-2.5 text-left">Matricule</th>
                        <th className="px-4 py-2.5 text-left">Nom</th>
                        {activeTab === "cnss" && (
                          <>
                            <th className="px-4 py-2.5 text-left">N° CNSS</th>
                            <th className="px-4 py-2.5 text-right">Base CNSS</th>
                            <th className="px-4 py-2.5 text-right">CNSS emp.</th>
                            <th className="px-4 py-2.5 text-right">CNSS empl.</th>
                          </>
                        )}
                        <th className="px-4 py-2.5 text-right">Brut</th>
                        {activeTab === "ir" && <th className="px-4 py-2.5 text-right">IR</th>}
                        <th className="px-4 py-2.5 text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lines.map((line) => (
                        <tr key={line.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-mono text-xs text-slate-500">{line.matricule}</td>
                          <td className="px-4 py-3 font-medium text-slate-900">{line.fullName}</td>
                          {activeTab === "cnss" && (
                            <>
                              <td className="px-4 py-3 font-mono text-xs text-slate-500">{line.cnssNumber ?? "—"}</td>
                              <td className="px-4 py-3 text-right font-medium text-slate-600">
                                {line.cnssBase !== null ? formatMoney(line.cnssBase) : "—"}
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-slate-600">
                                {line.employeeCnss !== null ? formatMoney(line.employeeCnss) : "—"}
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-slate-600">
                                {line.employerCnss !== null ? formatMoney(line.employerCnss) : "—"}
                              </td>
                            </>
                          )}
                          <td className="px-4 py-3 text-right font-medium text-slate-600">
                            {formatMoney(line.grossSalary)}
                          </td>
                          {activeTab === "ir" && (
                            <td className="px-4 py-3 text-right font-medium text-rose-600">
                              {line.ir !== null ? formatMoney(line.ir) : "—"}
                            </td>
                          )}
                          <td className="px-4 py-3 text-right font-bold text-slate-900">
                            {line.netSalary !== null ? formatMoney(line.netSalary) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {!selectedDecl && (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
              <p className="text-sm font-medium text-slate-400">
                Sélectionnez une déclaration ou générez-en une nouvelle.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
    </div>
  );
}

function ExportButton({ label, onClick, busy }: { label: string; onClick: () => void; busy: boolean }) {
  return (
    <button
      className="h-9 rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
      type="button"
      disabled={busy}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
