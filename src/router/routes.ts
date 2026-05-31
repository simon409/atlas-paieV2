export type AppRoute = "/login" | "/dashboard" | "/dashboard/payroll" | "/dashboard/employees" | "/dashboard/movements" | "/dashboard/runs" | "/dashboard/payslips" | "/dashboard/journal" | "/dashboard/settings" | "/dashboard/declarations";

export const defaultPrivateRoute: AppRoute = "/dashboard";

export function getCurrentRoute(): AppRoute {
  const path = window.location.pathname as AppRoute;

  if (isKnownRoute(path)) return path;
  return defaultPrivateRoute;
}

export function navigate(route: AppRoute): void {
  window.history.pushState({}, "", route);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function isPrivateRoute(route: AppRoute): boolean {
  return route !== "/login";
}

function isKnownRoute(route: string): route is AppRoute {
  return [
    "/login",
    "/dashboard",
    "/dashboard/movements",
    "/dashboard/payroll",
    "/dashboard/employees",
    "/dashboard/runs",
    "/dashboard/payslips",
    "/dashboard/journal",
    "/dashboard/settings",
    "/dashboard/declarations",
  ].includes(route);
}
