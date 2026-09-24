/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_X_API_KEY?: string;
  /** Seteada solo en playwright.config.ts (webServer.env): desactiva la
   * sesión única por cuenta, que pelea contra sí misma cuando Playwright
   * reusa un mismo storageState en muchos contextos de navegador. */
  readonly VITE_E2E?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
