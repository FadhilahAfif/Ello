import { type Route, navigate, useRoute } from "../app/router";
import { useSettingsStore } from "../store/settings";

interface NavItem {
  route: Route;
  label: string;
  icon: string;
}

const TOP_ITEMS: NavItem[] = [
  { route: "/dashboard", label: "Dashboard", icon: "⬡" },
  { route: "/history", label: "History", icon: "≡" },
  { route: "/vocabulary", label: "Vocabulary", icon: "✦" },
  { route: "/models", label: "Models", icon: "⬇" },
  { route: "/settings", label: "Settings", icon: "⚙" },
];

const BOTTOM_ITEMS: NavItem[] = [
  { route: "/about", label: "About", icon: "ℹ" },
];

export function Sidebar() {
  const route = useRoute();
  const status = useSettingsStore((s) => s.status);

  return (
    <nav
      aria-label="Main navigation"
      className="flex flex-col items-center w-[52px] shrink-0 bg-[var(--bg-sunken)] border-r border-[var(--border-subtle)] h-screen py-[var(--space-3)]"
    >
      <div className="flex flex-col items-center gap-[var(--space-1)] flex-1">
        {TOP_ITEMS.map((item) => (
          <NavButton key={item.route} item={item} active={route === item.route} />
        ))}
      </div>

      <div className="flex flex-col items-center gap-[var(--space-1)]">
        <span
          className="w-1.5 h-1.5 rounded-full mb-[var(--space-2)]"
          style={{
            background: status === "idle" ? "var(--text-ghost)" : "var(--accent)",
          }}
          aria-label={`Status: ${status}`}
        />
        {BOTTOM_ITEMS.map((item) => (
          <NavButton key={item.route} item={item} active={route === item.route} />
        ))}
        <button
          onClick={() => navigate("/dashboard")}
          aria-label="Go to dashboard"
          className="mt-[var(--space-2)] w-9 h-9 flex items-center justify-center rounded-[var(--radius-xl)] hover:bg-[var(--bg-raised)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: "#2a2a28" }}>
            e
          </span>
          <span
            style={{
              display: "inline-block",
              width: 5,
              height: 11,
              background: "#3a3020",
              borderRadius: 2,
              marginLeft: 1,
            }}
          />
        </button>
      </div>
    </nav>
  );
}

function NavButton({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <button
      onClick={() => navigate(item.route)}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      className={`w-9 h-9 flex items-center justify-center rounded-[var(--radius-xl)] transition-colors text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
        active
          ? "bg-[var(--bg-raised)] text-[var(--text-primary)]"
          : "text-[var(--text-tertiary)] hover:bg-[var(--bg-raised)] hover:text-[var(--text-secondary)]"
      }`}
    >
      {item.icon}
    </button>
  );
}
