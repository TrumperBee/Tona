// GCC - `server-only` stub for Node-based integration tests.
//
// The real `server-only` package throws outside a React Server Component
// bundle. Integration tests exercise server modules directly, so Vitest aliases
// the import to this empty module.
export {};
