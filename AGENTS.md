# PROJECT KNOWLEDGE BASE

**Generated:** 2026-04-27
**Branch:** main

## OVERVIEW
Standard Tauri v2 desktop application using React 19 + TypeScript on the frontend and Rust on the backend, built with Vite 7. Communication bridges between the UI and Native system via Tauri `invoke`.

## STRUCTURE
```
./
├── src/          # React frontend source
├── src-tauri/    # Rust backend source
└── vite.config.ts# Build config
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Frontend Entry | `src/main.tsx` | Mounts the React application into the DOM |
| Main UI Logic | `src/App.tsx` | Primary React component |
| Backend Binary | `src-tauri/src/main.rs` | Tauri application execution |
| Tauri Commands | `src-tauri/src/lib.rs` | Core Rust logic and command definitions |
| Tauri Config | `src-tauri/tauri.conf.json` | Tauri configurations & build hooks |

## CONVENTIONS
- Frontend is built via `npm run build` which runs `tsc && vite build`.
- Backend uses Cargo to manage Rust dependencies.
- Currently, no CI/CD or makefiles exist. 
- Testing is currently not configured for either frontend or backend.

## ANTI-PATTERNS (THIS PROJECT)
- **Release Console Prevention**: `// Prevents additional console window on Windows in release, DO NOT REMOVE!!` inside `src-tauri/src/main.rs` must be kept intact.

## COMMANDS
```bash
npm run dev     # Start development server
npm run build   # Build frontend
```
