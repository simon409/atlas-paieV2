import { useEffect, useState, type ReactNode } from "react";
import { formatSessionExpiry, type AuthSession } from "../auth/auth.ts";
import { navigate, type AppRoute } from "../router/routes.ts";
import { BadgeDollarSign, File, LayoutDashboard, Move, RefreshCcw, ScrollText, Settings, UsersIcon } from "lucide-react";
import { listCompanies, setActiveCompanyId } from "../db/companyStore.ts";
import type { Company } from "../db/models.ts";
import LOGO from "../assets/LOGO.png";

const navItems: Array<{ label: string; route: AppRoute; icon: ReactNode }> = [
  {
    label: "Accueil",
    route: "/dashboard",
    icon: <LayoutDashboard className="h-4 w-4" />
  },
  {
    label: "Fonctionnaires",
    route: "/dashboard/employees",
    icon: <UsersIcon className="h-4 w-4" />
  },
  {
    label: "Mouvements de Paie",
    route: "/dashboard/movements",
    icon: <Move className="h-4 w-4" />
  },
  {
    label: "Traitements / Runs",
    route: "/dashboard/runs",
    icon: <RefreshCcw className="h-4 w-4" />
  },
  {
    label: "Bulletins de Paie",
    route: "/dashboard/payslips",
    icon: <File className="h-4 w-4" />
  },
  {
    label: "Journal de Paie",
    route: "/dashboard/journal",
    icon: <ScrollText className="h-4 w-4" />
  },
  {
    label: "Calcul de Paie",
    route: "/dashboard/payroll",
    icon: <BadgeDollarSign className="h-4 w-4" />
  },
  {
    label: "Configuration",
    route: "/dashboard/settings",
    icon: <Settings className="h-4 w-4" />
  },
];

export function DashboardLayout({ children, route, session, onLogout }: { children: ReactNode; route: AppRoute; session: AuthSession; onLogout: () => Promise<void> }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyIdState] = useState<string>("");

  useEffect(() => {
    void loadCompanies();
  }, []);

  async function handleLogout() {
    await onLogout();
  }

  async function loadCompanies() {
    const nextCompanies = await listCompanies();
    const raw = localStorage.getItem("atlas-paie.active-company-id");
    const storedCompanyId = raw && raw !== "undefined" ? raw : nextCompanies[0]?.id || "";
    if (storedCompanyId && storedCompanyId !== raw) {
      setActiveCompanyId(storedCompanyId);
    }
    setCompanies(nextCompanies);
    setActiveCompanyIdState(storedCompanyId);
  }

  function changeCompany(companyId: string) {
    setActiveCompanyId(companyId);
    setActiveCompanyIdState(companyId);
    window.location.reload();
  }

  const currentActiveItem = navItems.find(item => route === item.route) || navItems[0];

  return (
    <main className="h-screen w-screen overflow-hidden bg-zinc-50/50 text-zinc-900 antialiased">
      <div className="grid h-full lg:grid-cols-[250px_minmax(0,1fr)]">

        {/* Sidebar Workspace Panel - Height fixed to container */}
        <aside className="relative hidden h-full flex-col justify-between border-r border-zinc-200 bg-white lg:flex">
          <div>
            {/* Header Identity Block */}
            <div className="flex h-14 items-center gap-2 px-5 border-b border-zinc-100">
              <img src={LOGO} alt="AtlasPaie Logo" className="h-6 w-auto rounded-sm object-cover" />
              <span className="text-xs font-bold tracking-wider uppercase text-zinc-800">AtlasPaie</span>
            </div>

            <hr className="my-2 border-zinc-100" />

            <div className="relative px-3">
              <select
                className="h-9 w-full appearance-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 pr-8 text-xs font-semibold text-zinc-700 outline-none transition-all hover:border-zinc-300 hover:bg-zinc-100 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/10 cursor-pointer"
                value={activeCompanyId}
                onChange={(event) => changeCompany(event.target.value)}
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
                <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <hr className="my-2 border-zinc-100" />

            {/* Nav Links Stack */}
            <nav className="space-y-0.5 p-3">
              {navItems.map((item) => {
                const isActive = route === item.route;

                return (
                  <button
                    key={item.route}
                    className={`relative flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-all duration-150 group outline-none ${isActive
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                      }`}
                    type="button"
                    onClick={() => navigate(item.route)}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-2 h-5 w-1 rounded-r bg-emerald-600" />
                    )}
                    <span className={`transition-colors duration-150 ${isActive ? "text-emerald-600" : "text-zinc-400 group-hover:text-zinc-600"}`}>
                      {item.icon}
                    </span>
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Secure Administrative Session Block */}
          <div className="border-t border-zinc-100 bg-zinc-50/50 p-4 space-y-3">
            <div className="flex items-center gap-2.5 px-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-[10px] font-bold text-emerald-700 border border-emerald-200/50 uppercase">
                {session.user.fullName.substring(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-zinc-700">{session.user.fullName}</p>
                <p className="truncate text-[10px] font-medium text-zinc-400">
                  Session expire à {formatSessionExpiry(session).split(' ')[0]}
                </p>
              </div>
            </div>

            <button
              className="flex h-8.5 w-full items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white text-xs font-bold text-zinc-600 shadow-sm transition-all duration-150 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
              type="button"
              onClick={() => void handleLogout()}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Déconnexion
            </button>
          </div>
        </aside>

        {/* Content Viewframe Display - Split into Header and Scrollable Body */}
        <section className="flex h-full min-w-0 flex-col overflow-hidden">
          {/* Main Top Header Navbar - Stays perfectly fixed on top */}
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6 sm:px-8">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="text-zinc-400 uppercase tracking-wider">Application</span>
              <span className="text-zinc-300">/</span>
              <span className="text-zinc-800 font-bold">{currentActiveItem.label}</span>
            </div>

            {/* Status Monitoring Badge */}
            <div className="flex items-center gap-3">

              <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200/40">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Base Connectée
              </div>
            </div>
          </header>

          {/* Primary View Inject Area - This and ONLY this handles scrolling now */}
          <div className="flex-1 overflow-y-auto bg-zinc-50/30 px-6 py-8 sm:px-8">
            <div className="mx-auto w-full max-w-7xl animate-in fade-in slide-in-from-bottom-2 duration-200">
              {children}
            </div>
          </div>
        </section>

      </div>
    </main>
  );
}
