import { useState, useEffect } from "react";

export const ROUTES = [
  "/dashboard",
  "/history",
  "/vocabulary",
  "/models",
  "/settings",
  "/about",
  "/onboarding",
] as const;

export type Route = typeof ROUTES[number];

function getRoute(): Route {
  const hash = window.location.hash.replace("#", "");
  return (ROUTES as readonly string[]).includes(hash) ? (hash as Route) : "/dashboard";
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
