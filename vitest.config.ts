import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Minimal Vitest config. The `@/*` alias mirrors tsconfig paths so tests import
 * the same way the app does. Pure logic only — no DOM environment needed.
 */
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: { "@": resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.{ts,tsx}"],
  },
});
