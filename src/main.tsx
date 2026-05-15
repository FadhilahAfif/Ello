import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "./components/ThemeProvider";
import { AppLayout } from "./app/layout";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <AppLayout />
    </ThemeProvider>
  </React.StrictMode>,
);
