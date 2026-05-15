# Ello — Design System

## Identity

**Concept:** The cursor is the logo. Ello turns your voice into a cursor; the amber block after the wordmark is the whole idea made visible.

**Tone:** Cold. Precise. No ornamentation. Developer-native. Feels like a tool someone built because they wanted it to exist, not a product optimized for a landing page.

---

## Logo

### Wordmark
- Typeface: Geist Mono, weight 500
- Text: `ello` (lowercase, always)
- Color: `--text-primary` on dark surfaces
- Cursor block: amber `--accent`, border-radius 2px, height matches cap height, width ~55% of one character width
- Letter-spacing: -0.03em
- Component: `src/components/ui/Wordmark.tsx`

### Tray icon
- The letter `e` in Geist Mono 500 + amber cursor block
- Used at 16×16 and 32×32 in the Windows tray
- Never use the full wordmark at tray scale

### Cursor block primitive
- Component: `src/components/ui/CursorBlock.tsx`
- Sizes: `sm` 5×11, `md` 7×16, `lg` 10×22, `xl` 14×30
- Animations: `none` (default), `pulse` (2.4s ease-in-out, idle), `blink` (1s step-start, active)
- Used everywhere the brand needs a beat: wordmark, hero, empty states, transcript end-of-line

### Rules
- Always render on dark surfaces (`--bg-base` or darker)
- Never add drop shadows, glows, or gradients to the logo
- Never use a colored or white background behind the wordmark
- Never stretch, rotate, or recolor the cursor block
- Never use the purple placeholder (`#7c5cff`); it's gone

---

## Color Tokens

| Token | Value | Usage |
|---|---|---|
| `--bg-base` | `#111110` | App background |
| `--bg-sunken` | `#0d0d0c` | Sidebar, status hero, transcript area, stat blocks |
| `--bg-raised` | `#1a1a18` | Inputs, hotkey chips, mode pills, hover states |
| `--bg-elevated` | `#201f1c` | Sticky save bar, popovers, active key chips |
| `--border` | `#222220` | Primary borders on inputs and pills |
| `--border-subtle` | `#1e1e1c` | Section surface borders, status hero, stat blocks |
| `--border-hairline` | `#181816` | Inner dividers, row separators, section underlines |
| `--accent` | `#e8a020` | Cursor block, recording dot, active rail, link text |
| `--accent-dim` | `#b87a10` | Hover on solid amber surfaces |
| `--accent-glow` | `rgba(232,160,32,0.12)` | Outline-button hover fill |
| `--text-primary` | `#f0efeb` | Headings, hero, switch thumb, key chips on `--bg-elevated` |
| `--text-secondary` | `#8a8a84` | Body, descriptions, settings labels |
| `--text-tertiary` | `#4a4a47` | Eyebrows, hotkey label keys, metadata |
| `--text-ghost` | `#2e2e2c` | Idle dots, sub-meta, decorative `+` separators |
| `--color-error` | `#f87171` | Error text |
| `--color-error-border` | `#7f1d1d` | Error container borders |

### Rules
- Dark only for v1. Tokens are structured for a future light mode; never hardcode hex values in components.
- Color strategy: **Restrained**. Tinted neutrals + one accent. Amber surface coverage stays under 5% on any view.
- Never use amber as a large background fill. Allowed amber surfaces: cursor block (any size), 6px status dot, 1.5–2px active rails, key chip text, link/button text, focus ring.
- One amber element per view ideally; two is the practical maximum (e.g., hero cursor + sidebar active rail).

---

## Typography

### Fonts
- **Sans (UI):** Geist; var: `--font-sans` resolves to `'Geist', system-ui, sans-serif`
- **Mono (data):** Geist Mono; var: `--font-mono` resolves to `'Geist Mono', ui-monospace, monospace`

Both ship locally as variable woff2 in `src/assets/fonts/` and are declared via `@font-face` in `src/index.css`. Do not load Google Fonts at runtime.

### Scale

| Role | Font | Size | Weight | Tracking | Line height | Color token |
|---|---|---|---|---|---|---|
| Hero headline | Geist | 56px | 500 | -0.025em | 1.0 | `--text-primary` |
| Page title | Geist | 24px | 500 | -0.01em | 1.2 | `--text-primary` |
| Section title | Geist | 20px | 500 | normal | 1.2 | `--text-primary` |
| Config-item value | Geist | 14px | 400 | normal | 1.2 | `--text-primary` |
| Body / form label | Geist | 13px | 400 | normal | 1.6 | `--text-secondary` |
| Stat value | Geist Mono | 18px | 500 | normal | 1.2 | `--text-primary` |
| Transcript output | Geist Mono | 13px | 400 | normal | 1.7 | `--text-primary` |
| Description | Geist | 12px | 400 | normal | 1.5 | `--text-secondary` |
| Hint / meta | Geist | 11px | 400 | normal | 1.5 | `--text-tertiary` |
| Key chip text | Geist Mono | 11px (md) / 10px (sm) | 400 | normal | 1 | `--text-primary` / `--text-secondary` |
| Eyebrow | Geist Mono | 10px | 400 | 0.16em | 1 | `--text-tertiary` |
| Mode/status pill | Geist Mono | 10px | 400 | 0.14em | 1 | `--accent` / `--text-tertiary` |
| Sidebar status pill | Geist Mono | 9px | 400 | 0.14em | 1 | `--accent` / `--text-tertiary` |

### Rules
- Sentence case for sans. UPPERCASE allowed only for mono eyebrows and mode pills.
- Two weights only: 400 and 500.
- Hierarchy comes from scale + weight contrast. Avoid 13/14/15px stacking; keep ≥1.25 ratio between sibling steps.
- Body line length capped at 65–75ch.
- 9px is the floor and only for sidebar mode pills; everything else is ≥10px.
- No em dashes anywhere. Use commas, semicolons, periods, or parentheses.

---

## Spacing

Base unit: 4px.

| Token | Value | Usage |
|---|---|---|
| `--space-1` | 4px | Icon gaps, tight internal padding |
| `--space-2` | 8px | Badge padding, small gaps |
| `--space-3` | 12px | Component internal padding, section header padding-bottom |
| `--space-4` | 16px | Settings rows, group internal gaps, section header bottom margin |
| `--space-5` | 20px | Hero internal vertical padding, content padding-x on cards |
| `--space-6` | 24px | Page header bottom margin, hero internal x padding, page padding-x on small viewports |
| `--space-8` | 32px | Page-level vertical breathing, dashboard inter-block gap |
| `--space-10` | 40px | Page padding-x on desktop, settings inter-section gap, two-column gap |
| `--space-12` | 48px | Reserved for very-large hero or marketing surfaces |

### Rules
- Page padding: `--space-10` (40px) horizontal on `≥sm`, `--space-6` (24px) on smaller. Vertical: `--space-10` top and bottom.
- Page header to first section: `--space-6` bottom margin on the header.
- Inter-section gap inside a page: `--space-10` for distinct workspaces (Settings), `--space-8` for content surfaces (Dashboard).
- Section header → body: `--space-4` margin-bottom on the section header.
- Vary padding for rhythm. Same padding everywhere reads as monotony.

---

## Border Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | 2px | Cursor block, small badges, small rails |
| `--radius-md` | 4px | Buttons, inputs, key chips, mode pills |
| `--radius-lg` | 6px | Hero, transcript area, stat blocks, settings panes |
| `--radius-xl` | 8px | Reserved for elevated surfaces |
| `--radius-full` | 9999px | Status dots, switch tracks, progress rails |

---

## Component Patterns

### Status hero (Dashboard)
- File: `src/components/StatusHero.tsx`
- Surface: `--bg-sunken`, border `--border-subtle` (idle/transcribing) or `--accent` (recording)
- Eyebrow row at top: `STATUS` (mono 10px tertiary, left) + status dot + mode label (mono 10px, right). Dot/label go amber when not idle.
- Headline: 56px Geist 500, letter-spacing -0.025em, ends with `xl` cursor block. `pulse` when idle, `blink` when recording.
- Subline: hotkey chips inlined into a "Press X to dictate." sentence (idle) or progress hairline (transcribing).
- Mic meter rail revealed only during recording: 40 bars, rAF-driven, `--accent` color, max-height transition (40ms ease-out).
- Border color is the only visual that turns amber during recording; the surface itself stays sunken.

### Config strip (Dashboard)
- 4-up grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`) showing live config rather than placeholder stats.
- Each item: 11px lucide icon + mono eyebrow (10px tertiary), 14px Geist value, optional 10px mono sub.
- Items are buttons that link to the relevant settings anchor. Long values (mic name, model id) truncate with title.
- Replaces the legacy "stat block" pattern when there is no real data yet (pre-Phase 9).

### Stat block (reserved for Phase 9+)
- Background: `--bg-sunken`. Border: `--border-subtle`. Radius: `--radius-lg`.
- Eyebrow: mono 10px tertiary, 0.16em tracking. Value: mono 18px 500 primary. Sub: mono 10px ghost.
- Use only when displaying real measured numbers. Never render `0` as a placeholder; render an empty/neutral state instead.

### Hotkey chip set (HotkeyChips)
- File: `src/components/HotkeyChips.tsx`
- Each key is its own `<kbd>`: mono 10/11px, `--bg-raised` (muted) or `--bg-elevated` (active), bordered, radius `--radius-md`, min-width 18/22px, centered.
- `+` separator: mono in `--text-ghost`, between chips.
- Tones: `muted` (sidebar, descriptions) and `active` (hero subline, primary surfaces).

### Section (page-level)
- File: `src/components/Section.tsx`
- Header: eyebrow (mono 10px, 0.16em, tertiary, line-height 1) + title (20px Geist 500, line-height 1.2) + optional right-aligned meta.
- `flush={false}` (default): pb `--space-3` + `border-b border-[var(--border-hairline)]` + mb `--space-4`.
- `flush={true}`: no underline, mb `--space-4`.
- Use eyebrows as words (`Mode`, `Audio`, `Hotkey`), not numerals (`01`, `02`).

### Settings two-column workspace
- Grid `lg:grid-cols-[180px_1fr]` with `gap: --space-10`.
- Left rail: in-page anchor nav. Sticky `top: --space-4`. Active item gets a 2px amber rail flush left + `--bg-raised` background.
- Right column: sections with hairlines. No `<Card>` per setting; settings render directly on the page background.
- Below `lg`: collapses to a horizontal scrollable tab strip at top.
- Sticky save bar fixed bottom, `left: 56px` (sidebar offset), max-width matches Settings container, slides in from below when `dirty` (`save-bar-in 220ms ease-out-quart`). Outline button (`variant="default"`), never solid amber.

### Mode pill (segmented selector)
- 2-up grid of buttons. Each button: text-left, `border-[var(--border-hairline)]`, hover `--border` + `--bg-raised`, active `--bg-raised` + `--border`.
- Inside each button: 6px dot (`--text-ghost` inactive, `--accent` active) + label (12px Geist 500) + 11px tertiary description.
- Replaces the legacy filled-amber segmented control. No amber background fill.

### Sidebar
- Width: 56px (icon rail).
- Background: `--bg-sunken`. Border-right: `--border-subtle`.
- Wordmark at top, click → `/dashboard`.
- Nav buttons: 36×36, lucide 16px stroke 1.6, radius `--radius-md`. Active gets `--bg-raised` + a 2px amber rail flush to the inner right edge of the sidebar (the cursor metaphor as nav affordance, not a 1px decorative side-stripe).
- Bottom: 6px status dot stacked over a 9px mono mode pill (`cld` / `lcl`), then About icon button.
- Never replace lucide icons with unicode dingbats; metrics are inconsistent across font stacks.

### Outline button (default)
- File: `src/components/ui/Button.tsx`
- `variant="default"`: transparent background, `--accent` border + text, hover `--accent-glow` fill.
- `variant="solid"`: filled amber. Reserved for save bar primary or single-call-to-action pages. Avoid on multi-action surfaces.
- `variant="ghost"`: text-only, `--bg-raised` hover. Used for cancel and secondary actions.
- `variant="danger"`: `--color-error` text, `--bg-raised` hover.
- Focus ring: `focus-visible:ring-2 ring-[--accent] ring-offset-1 ring-offset-[--bg-base]`.

### Switch
- File: `src/components/ui/Switch.tsx`
- 32×18 track. Off: `--bg-raised` background, `--border` border. On: `--accent` background and border.
- Thumb: 12×12, `--text-primary` (off) or `--bg-base` (on). Never `#fff`.
- Disabled state lowers opacity to 40%.

### Input / Select
- Files: `src/components/ui/Input.tsx`, `Select.tsx`
- `--bg-raised` background, `--border` border, radius `--radius-md`, `focus-visible` border `--accent` + 1px ring.
- Select gets a custom `▾` chevron in mono 10px tertiary, positioned right via absolute span. `appearance: none`.

### Empty state (stub pages)
- Surface: `--bg-sunken` + `--border-hairline`, radius `--radius-lg`, padding `--space-6` x `--space-10`.
- Mono 10px tertiary eyebrow with the phase number.
- Mono 13px secondary headline ending in a pulsing cursor block.
- Geist 11px tertiary one-paragraph description (≤60ch).
- One amber link to the relevant settings anchor.

---

## Motion

| Token | Value |
|---|---|
| `--ease-out-quart` | `cubic-bezier(0.25, 1, 0.5, 1)` |
| `--ease-out-expo`  | `cubic-bezier(0.16, 1, 0.3, 1)` |

### Rules
- Ease out only. No bounce, no elastic, no overshoot.
- Don't animate layout properties (width/height/margin) unless using `max-height` for collapse with overflow hidden.
- Recording state transition: 150–300ms on color and surface.
- Page change: 240ms `fade-up` (translateY 6px → 0) on the route container.
- Save bar: 220ms `save-bar-in` (translateY 100% → 0).
- Cursor blink: 1s step-start infinite, only when active.
- Cursor pulse: 2.4s ease-in-out infinite, idle accent breathing.
- Hairline progress (transcribing): 1.4s ease-out-quart infinite, 20% width band traveling.

---

## Tailwind v4 usage

- Spacing utilities (`px-[var(--space-N)]`, `gap-[var(--space-N)]`, etc.) are the standard. Do not use the legacy numeric scale (`px-6`); the project relies on the named tokens above.
- **Never write a global `*` reset in `index.css`.** Tailwind preflight already resets margin/padding/box-sizing, and a custom unlayered `*` rule beats every layered utility, silently dropping spacing across the app.
- If you genuinely need to extend the reset, use `@layer base { ... }` so utilities still win.
- Custom CSS for animations and font-face declarations does not need a layer; only resets and component-style overrides do.
- Arbitrary values like `font-[var(--font-mono)]`, `text-[14px]`, `border-[var(--accent)]` are first-class Tailwind v4 syntax. Don't migrate them to inline `style` unless they need to be runtime-driven.

---

## Lucide icons

- Use `lucide-react` for all glyphs. Pinned exact in `package.json`.
- Default size 16px stroke 1.6 inside 36×36 nav targets; 11–13px for inline label glyphs.
- Never use unicode dingbats (`⬡ ≡ ✦ ⬇ ⚙ ℹ`). They render with inconsistent metrics across Windows font stacks.

---

## Accessibility

- Every interactive element gets `focus-visible:ring-2 ring-[var(--accent)]`. Do not use plain `focus:` (it triggers on mouse click).
- Status changes announce via `aria-live="polite"` regions on the transcript output.
- The mic meter is `aria-hidden="true"`; status text already announces state.
- Icon-only buttons get `aria-label` and `title`.
- Color is never the only signal. State changes also alter shape, position, or text.

---

## What Ello is not

- Not friendly or warm; the amber is not a smile, it's a cursor.
- Not an AI product brand; no gradients, no purple, no "powered by" badges.
- Not enterprise; no blues, no rounded-everything, no illustration.
- Not retro for retro's sake; the amber earns its presence through the cursor metaphor.
- Not a card playground; cards are the lazy answer. Use surfaces, hairlines, and sections instead.
