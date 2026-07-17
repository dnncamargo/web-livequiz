// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { FirebaseTestPage } from "./FirebaseTestPage";

const pageMocks = vi.hoisted(() => ({
  runConnectionDiagnostics: vi.fn(),
  user: {
    uid: "administrador-1",
    email: "admin@example.com",
  },
}));

vi.mock("../contexts/auth-context", () => ({
  useAuth: () => ({ user: pageMocks.user }),
}));

vi.mock("../features/diagnostics/connection-diagnostics", () => ({
  runConnectionDiagnostics: pageMocks.runConnectionDiagnostics,
}));

describe("FirebaseTestPage", () => {
  beforeEach(() => {
    pageMocks.runConnectionDiagnostics.mockReset().mockResolvedValue({
      checkedAt: 1_000,
      checks: [
        {
          id: "vercel-function",
          label: "Função da Vercel",
          status: "success",
          message: "A rota está publicada.",
        },
        {
          id: "firebase-admin",
          label: "Firebase Admin",
          status: "error",
          message: "A chave privada possui formato inválido.",
          recommendation: "Revise FIREBASE_ADMIN_PRIVATE_KEY.",
        },
      ],
    });
  });

  afterEach(cleanup);

  it("exibe resultados por camada e a ação recomendada", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <FirebaseTestPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Nenhum documento, participante ou sala será criado."),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Executar diagnóstico completo" }),
    );

    expect(await screen.findByText("Função da Vercel")).toBeInTheDocument();
    expect(screen.getByText("Firebase Admin")).toBeInTheDocument();
    expect(
      screen.getByText("Revise FIREBASE_ADMIN_PRIVATE_KEY."),
    ).toBeInTheDocument();
    expect(pageMocks.runConnectionDiagnostics).toHaveBeenCalledWith(
      pageMocks.user,
    );
  });
});
