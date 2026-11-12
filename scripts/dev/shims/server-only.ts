// GCC - no-op `server-only` shim for local dev scripts.
//
// The real package throws unless it is bundled by a React Server Component
// build. The seeder runs in plain Node and reuses server modules directly, so
// the script-only tsconfig maps `server-only` here. This mapping is deliberately
// scoped to scripts/dev; the application tsconfig keeps the real guard.
export {};
