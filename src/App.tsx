import { useCallback, useEffect, useState } from "react";
import { login, logout, restoreSession, type AuthSession } from "./auth/auth.ts";
import { AuthContext } from "./auth/AuthContext.tsx";
import { useRoute } from "./hooks/useRoute.ts";
import { DashboardLayout } from "./layouts/DashboardLayout.tsx";
import { EmployeesPage } from "./pages/EmployeesPage.tsx";
import { LoginPage } from "./pages/LoginPage.tsx";
import { PayrollCalculatorPage } from "./pages/PayrollCalculatorPage.tsx";
import { PayrollRunsPage } from "./pages/PayrollRunsPage.tsx";
import { SettingsPage } from "./pages/SettingsPage.tsx";
import { defaultPrivateRoute, isPrivateRoute, navigate } from "./router/routes.ts";
import { PayslipsPage } from "./pages/PayslipsPage.tsx";
import { PayrollJournalPage } from "./pages/PayrollJournalPage.tsx";
import { DashboardPage } from "./pages/DashboardPage.tsx";
import MovementsPage from "./pages/MovementsPage.tsx";
import { CompanyProvider } from "./app/CompanyContext.tsx";

function App() {
  const route = useRoute();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    restoreSession()
      .then((s) => {
        setSession(s);
        setAuthReady(true);
      })
      .catch(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    if (!authReady) return;

    if (isPrivateRoute(route) && !session) {
      navigate("/login");
      return;
    }
    if (route === "/login" && session) {
      navigate(defaultPrivateRoute);
    }
  }, [route, session, authReady]);

  const handleLogin = useCallback(async (email: string, password: string) => {
    const s = await login(email, password);
    setSession(s);
    navigate(defaultPrivateRoute);
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    setSession(null);
    navigate("/login");
  }, []);

  if (!authReady) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-emerald-600" />
      </main>
    );
  }

  if (route === "/login" || !session) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <CompanyProvider>
      <AuthContext.Provider value={session}>
        <DashboardLayout
          route={route}
          session={session}
          onLogout={handleLogout}
        >
          {renderPrivateRoute(route)}
        </DashboardLayout>
      </AuthContext.Provider>
    </CompanyProvider>
  );
}

function renderPrivateRoute(route: string) {
  switch (route) {
    case "/dashboard":
      return <DashboardPage />;
    case "/dashboard/payroll":
      return <PayrollCalculatorPage />;
    case "/dashboard/movements":
      return <MovementsPage />;
    case "/dashboard/employees":
      return <EmployeesPage />;
    case "/dashboard/runs":
      return <PayrollRunsPage />;
    case "/dashboard/payslips":
      return <PayslipsPage />;
    case "/dashboard/journal":
      return <PayrollJournalPage />;
    case "/dashboard/settings":
      return <SettingsPage />;
    default:
      return <EmployeesPage />;
  }
}

export default App;
