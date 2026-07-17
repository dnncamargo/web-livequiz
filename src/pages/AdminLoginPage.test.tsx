// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AdminLoginPage } from "./AdminLoginPage";

const authMock = vi.hoisted(() => ({
  value: {
    user: null as null | {
      uid: string;
      email: string | null;
      isAnonymous: boolean;
    },
    loading: false,
    isAdministrator: false,
    administratorAuthorizationStatus: "not-applicable",
    authErrorMessage: null as string | null,
    signInAdministrator: vi.fn(),
    refreshAdministratorAuthorization: vi.fn(),
    logout: vi.fn(),
  },
}));

vi.mock("../contexts/auth-context", () => ({
  useAuth: () => authMock.value,
}));

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<AdminLoginPage />} />
        <Route path="/gerenciar" element={<p>Painel autorizado</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminLoginPage", () => {
  beforeEach(() => {
    authMock.value.user = null;
    authMock.value.loading = false;
    authMock.value.isAdministrator = false;
    authMock.value.administratorAuthorizationStatus = "not-applicable";
    authMock.value.authErrorMessage = null;
    authMock.value.signInAdministrator.mockReset().mockResolvedValue(undefined);
    authMock.value.refreshAdministratorAuthorization
      .mockReset()
      .mockResolvedValue(undefined);
    authMock.value.logout.mockReset().mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it("inicia o login com Google", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole("button", { name: "Entrar com Google" }));

    expect(authMock.value.signInAdministrator).toHaveBeenCalledOnce();
  });

  it("traduz erros do popup sem expor a mensagem interna", async () => {
    const user = userEvent.setup();
    authMock.value.signInAdministrator.mockRejectedValue({
      code: "auth/popup-blocked",
      message: "internal firebase details",
    });
    renderLogin();

    await user.click(screen.getByRole("button", { name: "Entrar com Google" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O navegador bloqueou a janela de login",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent(
      "internal firebase details",
    );
  });

  it("mostra a negativa e permite consultar novamente", async () => {
    const user = userEvent.setup();
    authMock.value.user = {
      uid: "conta-google-1",
      email: "comum@example.com",
      isAnonymous: false,
    };
    authMock.value.administratorAuthorizationStatus = "unauthorized";
    renderLogin();

    expect(screen.getByText("Acesso não autorizado")).toBeInTheDocument();
    expect(screen.getByText(/comum@example.com/)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Verificar autorização novamente",
      }),
    );

    expect(
      authMock.value.refreshAdministratorAuthorization,
    ).toHaveBeenCalledOnce();
  });

  it("permite repetir a consulta após uma falha temporária", async () => {
    const user = userEvent.setup();
    authMock.value.user = {
      uid: "administrador-1",
      email: "admin@example.com",
      isAnonymous: false,
    };
    authMock.value.administratorAuthorizationStatus = "error";
    authMock.value.authErrorMessage = "Serviço indisponível.";
    renderLogin();

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(
      authMock.value.refreshAdministratorAuthorization,
    ).toHaveBeenCalledOnce();
  });

  it("redireciona somente depois da autorização", () => {
    authMock.value.user = {
      uid: "administrador-1",
      email: "admin@example.com",
      isAnonymous: false,
    };
    authMock.value.isAdministrator = true;
    authMock.value.administratorAuthorizationStatus = "authorized";
    renderLogin();

    expect(screen.getByText("Painel autorizado")).toBeInTheDocument();
  });
});
