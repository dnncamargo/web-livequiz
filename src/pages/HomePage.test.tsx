// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { HomePage } from "./HomePage";

const authMock = vi.hoisted(() => ({
  value: {
    user: null as null | {
      uid: string;
      isAnonymous: boolean;
      displayName: string | null;
      email: string | null;
    },
    loading: false,
    isAnonymous: false,
    isAdministrator: false,
    administratorAuthorizationStatus: "not-applicable",
    authErrorMessage: null as string | null,
    signInParticipant: vi.fn(),
    signInAdministrator: vi.fn(),
    refreshAdministratorAuthorization: vi.fn(),
    logout: vi.fn(),
  },
}));

vi.mock("../contexts/auth-context", () => ({
  useAuth: () => authMock.value,
}));

describe("HomePage", () => {
  beforeEach(() => {
    authMock.value.user = null;
    authMock.value.loading = false;
    authMock.value.isAnonymous = false;
    authMock.value.isAdministrator = false;
    authMock.value.administratorAuthorizationStatus = "not-applicable";
    authMock.value.authErrorMessage = null;
    authMock.value.signInParticipant.mockReset().mockResolvedValue(undefined);
    authMock.value.logout.mockReset().mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it("inicia a autenticação anônima pela ação principal", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: "Entrar como participante" }),
    );

    expect(authMock.value.signInParticipant).toHaveBeenCalledOnce();
  });

  it("informa quando a sessão anônima foi restaurada", () => {
    authMock.value.user = {
      uid: "participante-1",
      isAnonymous: true,
      displayName: null,
      email: null,
    };
    authMock.value.isAnonymous = true;

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Sessão recuperável")).toBeInTheDocument();
    expect(
      screen.getByText("Você continuará conectado ao atualizar a página."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Entrar como participante" }),
    ).not.toBeInTheDocument();
  });

  it("exibe uma mensagem útil quando a autenticação falha", async () => {
    const user = userEvent.setup();
    authMock.value.signInParticipant.mockRejectedValue({
      code: "auth/network-request-failed",
    });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", { name: "Entrar como participante" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sem conexão com o serviço de autenticação",
    );
  });

  it("não apresenta uma conta Google comum como administradora", () => {
    authMock.value.user = {
      uid: "conta-google-1",
      isAnonymous: false,
      displayName: "Conta comum",
      email: "conta@example.com",
    };

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(/ainda não está autorizada para administrar/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Abrir gerenciamento" }),
    ).not.toBeInTheDocument();
  });
});
