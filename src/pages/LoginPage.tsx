import { FormEvent, useState } from "react";

export function LoginPage({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
      setIsLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-zinc-50 text-zinc-900 antialiased lg:grid-cols-[1fr_480px]">
      {/* Left Side: Professional Administrative Branding Panel */}
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-zinc-200/80 bg-white p-12 lg:flex">
        {/* Crisp subtle dot grid structure */}
        <div className="absolute inset-0 bg-[radial-gradient(#e4e4e7_1px,transparent_1px)] [background-size:24px_24px] opacity-70" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded-md bg-emerald-600 shadow-sm shadow-emerald-600/20" />
            <span className="text-sm font-bold tracking-wider uppercase text-zinc-800">AtlasPaie</span>
          </div>
        </div>

        <div className="relative z-10 max-w-lg space-y-4 rounded-xl border border-zinc-200/60 bg-white/80 p-8 shadow-sm backdrop-blur-md">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 leading-[1.2]">
            Espace sécurisé de <br />
            <span className="text-emerald-600 font-extrabold">gestion de paie.</span>
          </h1>
          <p className="text-sm leading-relaxed text-zinc-500 font-medium">
            Accédez aux simulations de paie, dossiers du personnel, traitements mensuels, règles de calcul et historiques de validation depuis un tableau de bord unifié.
          </p>
        </div>

        <div className="relative z-10 text-xs text-zinc-400 font-medium">
          &copy; {new Date().getFullYear()} AtlasPaie. Système d'Information National.
        </div>
      </section>

      {/* Right Side: Clean Form Workspace */}
      <section className="flex flex-col justify-center bg-white p-6 sm:p-12 md:p-20 lg:p-16">
        {/* Mobile Header Block */}
        <div className="flex items-center gap-2 lg:hidden mb-12">
          <div className="h-5 w-5 rounded bg-emerald-600" />
          <span className="text-xs font-bold tracking-widest uppercase text-zinc-800">AtlasPaie</span>
        </div>

        <div className="mx-auto w-full max-w-sm">
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Connexion</h2>
            <p className="text-xs font-medium text-zinc-400">
              Utilisez vos identifiants de connexion personnels.
            </p>
          </div>

          <form className="mt-8 space-y-4" onSubmit={submit}>
            <div className="space-y-1">
              <label htmlFor="email" className="text-xs font-bold text-zinc-600 tracking-wide uppercase">
                Identifiant / Email
              </label>
              <input
                id="email"
                type="email"
                required
                className="h-10 w-full rounded-lg border border-zinc-300 bg-zinc-50/50 px-3 text-sm font-medium text-zinc-900 shadow-inner outline-none transition-all duration-150 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-600/10"
                placeholder="nom@atlas.local"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="text-xs font-bold text-zinc-600 tracking-wide uppercase">
                Mot de passe
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                required
                className="h-10 w-full rounded-lg border border-zinc-300 bg-zinc-50/50 px-3 text-sm font-medium text-zinc-900 shadow-inner outline-none transition-all duration-150 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-600/10"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            {error && (
              <div className="flex gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700 animate-in fade-in slide-in-from-top-2 duration-150">
                <svg className="h-4 w-4 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button
              className="relative flex h-10 w-full items-center justify-center rounded-lg bg-zinc-900 text-sm font-bold text-white transition-all duration-150 hover:bg-zinc-800 focus:outline-none focus:ring-4 focus:ring-zinc-900/20 disabled:pointer-events-none disabled:opacity-50 shadow-sm"
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
