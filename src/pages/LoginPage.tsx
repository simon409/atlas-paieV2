import { FormEvent, useState } from "react";
import LOGO from "../assets/LOGO.png";

export function LoginPage({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Identifiants ou mot de passe incorrect");
      setIsLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-zinc-50 text-zinc-900 antialiased lg:grid-cols-[1fr_540px]">
      {/* Left Side: Premium Enterprise Branding Panel */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-zinc-50 p-16 lg:flex">
        {/* Subtle, premium tech elements instead of plain white */}
        <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] bg-size-[24px_24px] opacity-60" />
        <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute -right-20 bottom-10 h-96 w-96 rounded-full bg-emerald-600/15 blur-[140px]" />
        
        {/* Logo block */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-gray-100 to-gray-50 shadow-md shadow-emerald-900/30">
              <img src={LOGO} alt="AtlasPaie Logo" className="h-5 w-5" />
            </div>
            <span className="text-base font-bold tracking-wider uppercase text-zinc-900">AtlasPaie</span>
          </div>
        </div>

        {/* Floating Glassmorphism Hero Card */}
        <div className="relative z-10 max-w-lg space-y-5 rounded-2xl border border-zinc-800/50 bg-zinc-100/40 p-10 shadow-2xl backdrop-blur-md">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-800 border border-emerald-500/20">
            Espace Sécurisé
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-black leading-[1.2]">
            Gestion simplifiée de la <span className="text-transparent bg-clip-text bg-linear-to-r from-emerald-400 to-emerald-900 font-extrabold">paie entreprise.</span>
          </h1>
          <p className="text-sm leading-relaxed text-zinc-400 font-normal">
            Accédez aux simulations de paie, dossiers du personnel, traitements mensuels, règles de calcul et historiques de validation depuis un tableau de bord unifié et hautement protégé.
          </p>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-xs text-zinc-500 font-medium">
          &copy; {new Date().getFullYear()} AtlasPaie. Système d'Information National de la Gestion Administrative.
        </div>
      </section>

      {/* Right Side: Clean Workspace Form */}
      <section className="flex flex-col justify-center bg-white p-8 sm:p-16 md:p-24 lg:p-20">
        
        {/* Mobile Header Block */}
        <div className="flex items-center gap-3 lg:hidden mb-12">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 shadow-sm shadow-emerald-600/20">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-sm font-bold tracking-wider uppercase text-zinc-800">AtlasPaie</span>
        </div>

        <div className="mx-auto w-full max-w-sm">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900">Connexion</h2>
            <p className="text-sm font-normal text-zinc-500">
              Renseignez vos identifiants professionnels pour continuer.
            </p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={submit}>
            {/* Input Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-semibold text-zinc-700 tracking-wide">
                Identifiant / Email professionnel
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  required
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 text-sm font-medium text-zinc-900 shadow-sm outline-none transition-all duration-200 placeholder:text-zinc-400 focus:border-emerald-600 focus:bg-white focus:ring-[3px] focus:ring-emerald-600/10"
                  placeholder="nom@entreprise.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </div>

            {/* Input Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-semibold text-zinc-700 tracking-wide">
                  Mot de passe
                </label>
                <a href="#forgot" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
                  Mot de passe oublié ?
                </a>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50/50 pl-3.5 pr-10 text-sm font-medium text-zinc-900 shadow-sm outline-none transition-all duration-200 placeholder:text-zinc-400 focus:border-emerald-600 focus:bg-white focus:ring-[3px] focus:ring-emerald-600/10"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            </div>

            {/* Remember Me Toggle */}
            <div className="flex items-center">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-600/20"
              />
              <label htmlFor="remember-me" className="ml-2 text-xs font-medium text-zinc-600 select-none cursor-pointer">
                Se souvenir de moi sur cet appareil
              </label>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="flex gap-2.5 rounded-xl border border-red-200 bg-red-50/50 p-3 text-xs font-semibold text-red-700 animate-in fade-in slide-in-from-top-2 duration-200">
                <svg className="h-4 w-4 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Action Submit Button */}
            <button
              className="relative flex h-11 w-full items-center justify-center rounded-xl bg-zinc-900 text-sm font-bold text-white transition-all duration-150 hover:bg-zinc-800 focus:outline-none focus:ring-4 focus:ring-zinc-900/20 disabled:pointer-events-none disabled:opacity-50 shadow-md shadow-zinc-900/10 active:scale-[0.99]"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                "Se connecter"
              )}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}