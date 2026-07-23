import { fileURLToPath } from "node:url";
import legacy from "@vitejs/plugin-legacy";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const legacyEntry = fileURLToPath(
  new URL("./legacy-presentation.html", import.meta.url),
);

export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ["Chrome >= 81"],
      modernPolyfills: false,
    }),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: {
      input: legacyEntry,
    },
  },
});
