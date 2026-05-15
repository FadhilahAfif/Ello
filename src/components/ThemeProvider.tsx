import { useLayoutEffect, type ReactNode } from "react";

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
  }, []);

  return <>{children}</>;
}
