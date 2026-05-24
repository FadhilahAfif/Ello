import { useEffect, type ComponentType } from "react";
import { Sidebar } from "../components/Sidebar";
import { TitleBar } from "../components/TitleBar";
import { ToastContainer } from "../components/ui/Toast";
import { useRoute } from "./router";
import { useSettingsStore } from "../store/settings";
import { getSettings, getDevices } from "../lib/invoke";
import {
  onRecordingStarted, onRecordingStopped, onTranscriptionStarted,
  onTranscriptionDone, onAppError,
} from "../lib/events";
import { Dashboard } from "../pages/Dashboard";
import { History } from "../pages/History";
import { Stats } from "../pages/Stats";
import { Vocabulary } from "../pages/Vocabulary";
import { Models } from "../pages/Models";
import { Settings } from "../pages/Settings";
import { About } from "../pages/About";
import { Onboarding } from "../pages/Onboarding";

import type { Route } from "./router";

const PAGES: Record<Route, ComponentType> = {
  "/dashboard": Dashboard,
  "/history": History,
  "/stats": Stats,
  "/vocabulary": Vocabulary,
  "/models": Models,
  "/settings": Settings,
  "/about": About,
  "/onboarding": Onboarding,
};

const CONTAINER_WIDTH: Record<Route, string> = {
  "/dashboard": "max-w-[880px]",
  "/history": "max-w-[880px]",
  "/stats": "max-w-[880px]",
  "/vocabulary": "max-w-[880px]",
  "/models": "max-w-[720px]",
  "/settings": "max-w-[1080px]",
  "/about": "max-w-[640px]",
  "/onboarding": "max-w-[640px]",
};

export function AppLayout() {
  const route = useRoute();

  useEffect(() => {
    const { setSettings, setDevices, setError } = useSettingsStore.getState();

    getSettings().then(setSettings).catch((e) => setError(String(e)));
    getDevices().then((d) => { if (d.length > 0) setDevices(d); }).catch(console.error);
  }, []);

  useEffect(() => {
    const { setStatus, setLastTranscript, setError } = useSettingsStore.getState();
    let mounted = true;
    const unlisteners: Array<() => void> = [];

    Promise.all([
      onRecordingStarted(() => { setStatus("recording"); setLastTranscript(null); setError(null); }),
      onRecordingStopped(() => setStatus("transcribing")),
      onTranscriptionStarted(() => setStatus("transcribing")),
      onTranscriptionDone((text) => { setStatus("idle"); setLastTranscript(text); }),
      onAppError((msg) => { setStatus("idle"); setError(msg); }),
    ]).then((us) => {
      if (!mounted) us.forEach((u) => u());
      else unlisteners.push(...us);
    }).catch((e) => setError(String(e)));

    return () => {
      mounted = false;
      unlisteners.forEach((u) => u());
    };
  }, []);

  const { settings } = useSettingsStore();
  const onboarding = !settings.onboardingComplete;
  const effectiveRoute = onboarding ? "/onboarding" : route;

  const Page = PAGES[effectiveRoute] ?? Dashboard;
  const widthClass = CONTAINER_WIDTH[effectiveRoute] ?? "max-w-[880px]";

  if (onboarding) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-[var(--bg-base)]">
        <TitleBar />
        <main className="flex-1 overflow-y-auto">
          <div
            className={`mx-auto px-[var(--space-6)] sm:px-[var(--space-10)] py-[var(--space-10)] ${widthClass}`}
            key="onboarding"
            style={{ animation: "fade-up 240ms var(--ease-out-quart)" }}
          >
            <Page />
          </div>
        </main>
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--bg-base)]">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div
            className={`mx-auto px-[var(--space-6)] sm:px-[var(--space-10)] py-[var(--space-10)] ${widthClass}`}
            key={route}
            style={{ animation: "fade-up 240ms var(--ease-out-quart)" }}
          >
            <Page />
          </div>
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
