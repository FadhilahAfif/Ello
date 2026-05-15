interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        className="sr-only"
        aria-label={label}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className="block w-10 h-[22px] rounded-[var(--radius-full)] transition-colors"
        style={{ background: checked ? "var(--accent)" : "var(--border)" }}
      >
        <span
          className="block w-4 h-4 bg-white rounded-full absolute top-[3px] transition-transform"
          style={{ left: "3px", transform: checked ? "translateX(18px)" : "translateX(0)" }}
        />
      </span>
    </label>
  );
}
