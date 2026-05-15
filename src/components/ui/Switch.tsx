interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, disabled = false }: SwitchProps) {
  return (
    <label
      className={`relative inline-flex items-center select-none ${
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        className="sr-only peer"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className="block w-8 h-[18px] rounded-[var(--radius-full)] transition-colors duration-150 border peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--bg-base)]"
        style={{
          background: checked ? "var(--accent)" : "var(--bg-raised)",
          borderColor: checked ? "var(--accent)" : "var(--border)",
        }}
      >
        <span
          className="block w-3 h-3 rounded-full absolute top-[2px] transition-transform duration-150"
          style={{
            background: checked ? "var(--bg-base)" : "var(--text-primary)",
            left: "2px",
            transform: checked ? "translateX(14px)" : "translateX(0)",
          }}
        />
      </span>
    </label>
  );
}
