/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DAEMON_API_URL?: string;
  readonly VITE_DAEMON_API_KEY?: string;
  readonly VITE_DAEMON_TENANT?: string;
  readonly VITE_DAEMON_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
