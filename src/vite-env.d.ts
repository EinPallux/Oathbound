// Minimal ambient typing for Vite's `import.meta.env` (the tsconfig uses `types: []`,
// so we don't pull in vite/client). Only the flags we actually read are declared; they
// merge with the built-in `ImportMeta`. Vite substitutes literal booleans at build time.
interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  readonly BASE_URL: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
