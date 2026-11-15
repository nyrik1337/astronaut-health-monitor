/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** `backend` calls the evidence/cognitive routes; anything else uses the contract-based mock. */
  readonly VITE_EXTENSION_API?: string;
  /** `backend` enables the AI Companion HTTP adapter (draft contract assistant-1); otherwise not connected. */
  readonly VITE_ASSISTANT_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
