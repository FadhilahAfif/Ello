import {
  LayoutDashboard,
  History as HistoryIcon,
  BarChart2,
  BookOpen,
  Sparkles,
  Download,
  Settings as SettingsIcon,
  Info,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { type Route, navigate, useRoute } from "../app/router";
import { useSettingsStore } from "../store/settings";

interface NavItem {
  route: Route;
  label: string;
  Icon: LucideIcon;
}

const TOP_ITEMS: NavItem[] = [
  { route: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { route: "/history", label: "History", Icon: HistoryIcon },
  { route: "/stats", label: "Stats", Icon: BarChart2 },
  { route: "/vocabulary", label: "Vocabulary", Icon: BookOpen },
  { route: "/ai-polish", label: "AI Polish", Icon: Sparkles },
  { route: "/models", label: "Models", Icon: Download },
  { route: "/settings", label: "Settings", Icon: SettingsIcon },
];

const BOTTOM_ITEMS: NavItem[] = [
  { route: "/about", label: "About", Icon: Info },
];

export function Sidebar() {
  const route = useRoute();
  const status = useSettingsStore((s) => s.status);
  const mode = useSettingsStore((s) => s.settings.transcriptionMode);

  return (
    <nav
      aria-label="Main navigation"
      className="flex flex-col items-stretch w-[56px] shrink-0 bg-[var(--bg-sunken)] border-r border-[var(--border-subtle)] h-screen py-[var(--space-3)]"
    >
      <div className="flex flex-col items-center gap-[2px] flex-1">
        {TOP_ITEMS.map((item) => (
          <NavButton key={item.route} item={item} active={route === item.route} />
        ))}
      </div>

      <div className="flex flex-col items-center gap-[var(--space-3)] pb-[var(--space-8)]">
        <div
          className="flex flex-col items-center gap-[6px]"
          aria-label={`Status: ${status}, mode: ${mode}`}
        >
          <span
            className="block w-[6px] h-[6px] rounded-full transition-colors duration-200"
            style={{
              background: status === "idle" ? "var(--text-ghost)" : "var(--accent)",
            }}
          />
          <span
            className="font-[var(--font-mono)] text-[9px] uppercase tracking-[0.14em]"
            style={{
              color: status === "idle" ? "var(--text-tertiary)" : "var(--accent)",
              lineHeight: 1,
            }}
          >
            {mode === "cloud" ? "cld" : "lcl"}
          </span>
        </div>
        {BOTTOM_ITEMS.map((item) => (
          <NavButton key={item.route} item={item} active={route === item.route} />
        ))}
      </div>
    </nav>
  );
}

function NavButton({ item, active }: { item: NavItem; active: boolean }) {
  const { Icon, label, route } = item;
  return (
    <button
      onClick={() => navigate(route)}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      title={label}
      className={`relative w-9 h-9 flex items-center justify-center rounded-[var(--radius-md)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-sunken)] ${
        active
          ? "bg-[var(--bg-raised)] text-[var(--text-primary)]"
          : "text-[var(--text-tertiary)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-secondary)]"
      }`}
    >

      <Icon size={16} strokeWidth={1.6} aria-hidden="true" />
    </button>
  );
}
