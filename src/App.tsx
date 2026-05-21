import { useState } from "react";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-8">
      <main className="max-w-4xl w-full bg-white rounded-2xl shadow-xl p-10 text-center">
        <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight mb-4">
          AtlasPaie
        </h1>
        <p className="text-lg text-slate-600 mb-8">
          Moroccan Payroll Engine
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="bg-slate-100 p-6 rounded-xl border border-slate-200">
            <h2 className="font-semibold text-slate-800 mb-2">Deterministic Engine</h2>
            <p className="text-sm text-slate-600">Pure functions ensuring the exact same output for any given input state.</p>
          </div>
          <div className="bg-slate-100 p-6 rounded-xl border border-slate-200">
            <h2 className="font-semibold text-slate-800 mb-2">Law Versioning</h2>
            <p className="text-sm text-slate-600">Dynamic loading of year-based rules for accurate CNSS and IR compliance.</p>
          </div>
          <div className="bg-slate-100 p-6 rounded-xl border border-slate-200">
            <h2 className="font-semibold text-slate-800 mb-2">Immutable Logs</h2>
            <p className="text-sm text-slate-600">Complete audit trail preventing silent changes to finalized payroll runs.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
