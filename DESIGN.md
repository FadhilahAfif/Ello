# Ello — Design System

## Identity

**Concept:** The cursor is the logo. Ello turns your voice into a cursor — the amber block after the wordmark is the whole idea made visible.

**Tone:** Cold. Precise. No ornamentation. Developer-native. Feels like a tool someone built because they wanted it to exist, not a product optimized for a landing page.

---

## Logo

### Wordmark
- Typeface: Geist Mono, weight 500
- Text: `ello` (lowercase, always)
- Color: `#f0efeb` on dark surfaces
- Cursor block: amber `#e8a020`, border-radius 2px, height matches cap height, width ~55% of one character width
- Letter-spacing: -0.03em

### Tray icon
- The letter `e` in Geist Mono 500 + amber cursor block
- Used at 16×16 and 32×32 in the Windows tray
- Never use the full wordmark at tray scale

### Rules
- Always render on dark surfaces (`#111110` or darker)
- Never add drop shadows, glows, or gradients to the logo
- Never use a colored or white background behind the wordmark
- Never stretch, rotate, or recolor the cursor block
- Never use the purple placeholder (`#7c5cff`) — it's gone

---

## Color Tokens

| Token | Value | Usage |
|---|---|---|
| `--bg-base` | `#111110` | App background |
| `--bg-sunken` | `#0d0d0c` | Transcript area, sidebar, titlebar |
| `--bg-raised` | `#1a1a18` | Cards, hotkey display, inputs |
| `--border` | `#222220` | All borders and dividers |
| `--border-subtle` | `#1e1e1c` | Inner borders, separators |
| `--accent` | `#e8a020` | Cursor block, recording dot, active states, links |
| `--accent-dim` | `#b87a10` | Accent on light surfaces, hover states |
| `--text-primary` | `#f0efeb` | Headings, active transcript |
| `--text-secondary` | `#8a8a84` | Body, recent transcripts |
| `--text-tertiary` | `#4a4a47` | Meta, hotkey labels, timestamps |
| `--text-ghost` | `#2e2e2c` | Placeholder, decorative |

### Rules
- Dark only for v1. Light mode is post-v1 but tokens are structured for it — never hardcode hex values in components, always use tokens.
- The accent is used sparingly. One accent element per view. Not for decorative purposes.
- Never use amber as a background fill — only as a small mark, dot, or cursor.

---

## Typography

### Fonts
- **UI:** Geist — all labels, navigation, body copy, onboarding, settings
- **Data/Mono:** Geist Mono — wordmark, transcripts, hotkeys, model names, file paths, code

Both fonts are free and available via [Vercel's font CDN](https://vercel.com/font) or as npm packages (`geist`).

In Tauri/Vite, import via CSS:
```css
@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500&family=Geist+Mono:wght@400;500&display=swap');
```
Or bundle locally via the `geist` npm package for offline reliability.

### Scale

| Role | Font | Size | Weight | Color token |
|---|---|---|---|---|
| Page title | Geist | 20px | 500 | `--text-primary` |
| Section label | Geist Mono | 10px | 400 | `--text-tertiary` |
| Body / label | Geist | 13px | 400 | `--text-secondary` |
| Transcript output | Geist Mono | 11px | 400 | `--text-secondary` |
| Hotkey / meta | Geist Mono | 10px | 400 | `--text-tertiary` |
| Stat value | Geist Mono | 16px | 500 | `--text-primary` |
| Stat label | Geist | 10px | 400 | `--text-ghost` |

### Rules
- Sentence case everywhere. Never title case, never all-caps except section labels (10px, 0.14em tracking, `--text-tertiary`)
- No font size below 10px
- Two weights only: 400 and 500. Never 600 or 700.
- Line height 1.6 for body, 1 for single-line UI labels

---

## Spacing

Base unit: 4px.

| Token | Value | Usage |
|---|---|---|
| `--space-1` | 4px | Icon gaps, tight internal padding |
| `--space-2` | 8px | Badge padding, small gaps |
| `--space-3` | 12px | Component internal padding |
| `--space-4` | 16px | Section gaps, sidebar padding |
| `--space-6` | 24px | Content padding |
| `--space-8` | 32px | Page-level padding |

---

## Border Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | 2px | Cursor block, small badges |
| `--radius-md` | 4px | Hotkey chips, small inputs |
| `--radius-lg` | 6px | Cards, transcript area, stat blocks |
| `--radius-xl` | 8px | Modals, sidebar nav items |
| `--radius-full` | 9999px | Status dots, toggles |

---

## Component Patterns

### Status badge
```
● idle · local · whisper-large-v3-turbo
```
- Dot: 6px circle, `--text-ghost` when idle, `--accent` when recording
- Text: Geist Mono 11px, `--text-tertiary` when idle, `--accent` when recording
- No background, no border — sits inline above the transcript area

### Hotkey display
- Background: `--bg-raised`
- Border: `--border`
- Radius: `--radius-md`
- Font: Geist Mono 10px, `--text-tertiary`
- Keys separated by `+` in `--text-ghost`

### Transcript area
- Background: `--bg-sunken`
- Border: `--border-subtle`
- Radius: `--radius-lg`
- Font: Geist Mono 11px
- Lines: ghost → secondary → primary (oldest to newest)
- Active line ends with amber cursor block (6×12px, `--accent`)

### Stat block
- Background: `--bg-sunken`
- Border: `--border-subtle`
- Radius: `--radius-lg`
- Value: Geist Mono 16px 500, `--text-primary`
- Label: Geist 10px, `--text-ghost`

### Sidebar
- Width: 52px (icon-only)
- Background: `--bg-sunken`
- Border-right: `--border-subtle`
- Active nav item: `--bg-raised`, radius `--radius-xl`
- Logo mark at bottom: `e` + cursor in ghost colors (`#2a2a28` text, `#3a3020` cursor)

---

## Motion

Minimal. Purposeful. Never decorative.

- Recording state transition: 150ms ease-out on dot color and text color
- Transcript line appear: fade-in 100ms, no slide
- Cursor blink: optional, 1s step-start infinite — only on the active line, only during transcription
- Page transitions: none for v1

---

## What Ello is not

- Not friendly or warm — the amber is not a smile, it's a cursor
- Not an AI product brand — no gradients, no purple, no "powered by" badges in the UI chrome
- Not enterprise — no blues, no rounded-everything, no illustration
- Not retro for retro's sake — the amber earns its presence through the cursor metaphor, not nostalgia
