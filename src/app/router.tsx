import { useState, useEffect } from "react";

export type Route =
  | "/dashboard"
  | "/history"
  | "/vocabulary"
  | "/models"
  | "/settings"
  | "/about"
  | "/onboarding";

function getRoute(): Route {
  const hash = window.location.hash.replace("#", "") as Route;
  const valid: Route[] = [
    "/dashboard", "/history", "/vocabulary",
    "/models", "/settings", "/about", "/onboarding",
  ];
  return valid.includes(hash) ? hash : "/dashboard";
}

export function navigate(route: Route) {
  window.location.hash = route;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(getRoute);

  useEffect(() => {
    const handler = () => setRoute(getRoute());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  return route;
}
