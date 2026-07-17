import { spawn } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";

const firebaseCli = resolve("node_modules/firebase-tools/lib/bin/firebase.js");
const vitestCli = resolve("node_modules/vitest/vitest.mjs");
const testCommand = `"${process.execPath}" "${vitestCli}" run --config vitest.rules.config.ts`;

const child = spawn(
  process.execPath,
  [
    firebaseCli,
    "emulators:exec",
    "--project",
    "demo-quizumba",
    "--only",
    "database",
    testCommand,
  ],
  {
    env: {
      ...process.env,
      FIREBASE_CLI_DISABLE_UPDATE_CHECK: "true",
    },
    stdio: "inherit",
  },
);

child.once("error", (error) => {
  console.error("Não foi possível iniciar os testes de regras:", error);
  process.exitCode = 1;
});

child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
