import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/rules/**/*.test.ts"],
    hookTimeout: 30_000,
    testTimeout: 15_000,
  },
});
