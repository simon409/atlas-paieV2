import { useEffect, useState } from "react";
import { getCurrentRoute } from "../router/routes.ts";

export function useRoute() {
  const [route, setRoute] = useState(getCurrentRoute);

  useEffect(() => {
    function syncRoute() {
      setRoute(getCurrentRoute());
    }

    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);

  return route;
}
