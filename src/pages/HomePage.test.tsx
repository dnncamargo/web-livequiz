// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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

function setAnonymousParticipant() {
  authMock.value.user = {
    uid: "participante-1",
    isAnonymous: true,
    displayName: null,
    email: null,
  };
  authMock.value.isAnonymous = true;
}

describe("HomePage", () => {
  beforeEach(() => {
    localStorage.clear();
    authMock.value.user = null;
    authMock.value.loading = false;
    authMock.value.isAnonymous = false;
    authMock.value.isAdministrator = false;
    authMock.value.administratorAuthorizationStatus = "not-applicable";
    authMock.value.authErrorMessage = null;
    authMock.value.signInParticipant.mockReset().mockResolvedValue(undefined);
    authMock.value.signInAdministrator.mockReset().mockResolvedValue(undefined);
    authMock.value.logout.mockReset().mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it("inicia automaticamente a autenticação anônima", async () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(authMock.value.signInParticipant).toHaveBeenCalledOnce();
    });
    expect(
      screen.queryByRole("button", { name: "Entrar como participante" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Painel de Controle" }),
    ).not.toBeInTheDocument();
  });

  it("abre diretamente o formulário quando a sessão anônima está pronta", async () => {
    setAnonymousParticipant();

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "Entrar em uma sala" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Entrar na sala" }),
    ).toBeInTheDocument();
  });

  it("preenche o código recebido pelo link do participante", async () => {
    setAnonymousParticipant();

    render(
      <MemoryRouter initialEntries={["/?join=abc234"]}>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText("Código da sala")).toHaveValue(
      "ABC234",
    );
  });

  it("permite tentar novamente quando a autenticação automática falha", async () => {
    const browserUser = userEvent.setup();
    authMock.value.signInParticipant
      .mockRejectedValueOnce({ code: "auth/network-request-failed" })
      .mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sem conexão com o serviço de autenticação",
    );
    await browserUser.click(
      screen.getByRole("button", { name: "Tentar novamente" }),
    );

    await waitFor(() => {
      expect(authMock.value.signInParticipant).toHaveBeenCalledTimes(2);
    });
  });

  it("troca uma conta Google comum por uma sessão de participante", async () => {
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

    await waitFor(() => {
      expect(authMock.value.logout).toHaveBeenCalledOnce();
      expect(authMock.value.signInParticipant).toHaveBeenCalledOnce();
    });
  });

  it("mantém o administrador no Painel de Controle", async () => {
    authMock.value.user = {
      uid: "administrador-1",
      isAnonymous: false,
      displayName: "Professora Ana",
      email: "ana@example.com",
    };
    authMock.value.isAdministrator = true;

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/admin" element={<p>Painel aberto</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Painel aberto")).toBeInTheDocument();
    expect(authMock.value.signInParticipant).not.toHaveBeenCalled();
  });
});
