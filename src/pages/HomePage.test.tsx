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

const publicRoomMock = vi.hoisted(() => ({
  gameId: "",
  state: {
    room: null as null | {
      id: string;
      phase: "waiting" | "finished";
      createdAt: number;
      participantCount: number;
    },
    loading: false,
    error: null as string | null,
  },
}));

vi.mock("../contexts/auth-context", () => ({
  useAuth: () => authMock.value,
}));

vi.mock("../features/live-game/use-public-waiting-room", () => ({
  usePublicWaitingRoom: (gameId: string) => {
    publicRoomMock.gameId = gameId;
    return publicRoomMock.state;
  },
}));

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
    authMock.value.logout.mockReset().mockResolvedValue(undefined);
    publicRoomMock.gameId = "";
    publicRoomMock.state.room = null;
    publicRoomMock.state.loading = false;
    publicRoomMock.state.error = null;
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

  it("exibe a entrada da sala quando a sessão anônima foi restaurada", async () => {
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

    expect(
      await screen.findByRole("button", { name: "Entrar na sala" }),
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

  it("identifica a sala recebida pelo link do participante", () => {
    publicRoomMock.state.room = {
      id: "ABC234",
      phase: "waiting",
      createdAt: 1_000,
      participantCount: 3,
    };

    render(
      <MemoryRouter initialEntries={["/?join=abc234"]}>
        <HomePage />
      </MemoryRouter>,
    );

    expect(publicRoomMock.gameId).toBe("ABC234");
    expect(screen.getByLabelText("Sala ativa identificada")).toHaveTextContent(
      "ABC234",
    );
    expect(screen.getByText(/3 participante/i)).toBeInTheDocument();
  });

  it("avisa quando o link aponta para uma apresentação finalizada", () => {
    publicRoomMock.state.room = {
      id: "ABC234",
      phase: "finished",
      createdAt: 1_000,
      participantCount: 0,
    };

    render(
      <MemoryRouter initialEntries={["/?join=ABC234"]}>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Apresentação finalizada")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Sala ativa identificada"),
    ).not.toBeInTheDocument();
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
