/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** `backend` calls the evidence/cognitive routes; anything else uses the contract-based mock. */
  readonly VITE_EXTENSION_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
