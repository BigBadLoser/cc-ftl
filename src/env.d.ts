/// <reference types="svelte" />
/// <reference types="vite/client" />

/** The short git commit of the build (see vite.config.ts), or "dev". */
declare const __COMMIT__: string;

/** The one Node API vite.config.ts uses (the project has no Node typings). */
declare module 'node:child_process' {
  export function execSync(command: string, options?: { stdio?: string[] }): { toString(): string };
}
