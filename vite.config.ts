import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    // Honor the port assigned by tooling (e.g. preview harness); fall back to Vite's default.
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
  },
});
