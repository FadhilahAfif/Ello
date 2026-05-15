import { useEffect } from "react";
import { Sidebar } from "../components/Sidebar";
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
import { Vocabulary } from "../pages/Vocabulary";
import { Models } from "../pages/Models";
import { Settings } from "../pages/Settings";
import { About } from "../pages/About";
import { Onboarding } from "../pages/Onboarding";

const PAGES = {
  "/dashboard": Dashboard,
  "/history": History,
  "/vocabulary": Vocabulary,
  "/models": Models,
  "/settings": Settings,
  "/about": About,
  "/onboarding": Onboarding,
};

export function AppLayout() {
  const route = useRoute();
  const { setSettings, setDevices, setStatus, setLastTranscript, setError } = useSettingsStore();

  useEffect(() => {
    getSettings().then(setSettings).catch((e) => setError(String(e)));
    getDevices().then((d) => { if (d.length > 0) setDevices(d); }).catch(console.error);
  }, []);

  useEffect(() => {
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

  const Page = PAGES[route] ?? Dashboard;

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-base)]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Page />
      </main>
      <ToastContainer />
    </div>
  );
}
