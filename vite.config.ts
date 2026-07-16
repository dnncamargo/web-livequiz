import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";

export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: [
        "Chrome >= 81",
        "Firefox >= 78",
        "Android >= 8",
        "iOS >= 13",
      ],
      modernPolyfills: true,
    }),
  ],

  build: {
    target: "es2018",
  },
});