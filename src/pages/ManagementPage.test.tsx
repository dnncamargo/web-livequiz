// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ManagementPage } from "./ManagementPage";

const managementMocks = vi.hoisted(() => ({
  createWaitingRoom: vi.fn(),
  endWaitingRoom: vi.fn(),
  logout: vi.fn(),
  user: {
    uid: "administrador-1",
    displayName: "Professora Ana",
    email: "ana@example.com",
  },
  roomLibraryState: {
    rooms: [] as Array<{
      id: string;
      phase: "waiting";
      createdAt: number;
      participantCount: number;
    }>,
    loading: false,
    error: null as string | null,
  },
}));

vi.mock("../contexts/auth-context", () => ({
  useAuth: () => ({
    user: managementMocks.user,
    logout: managementMocks.logout,
  }),
}));

vi.mock("../features/live-game/waiting-room", () => ({
  createWaitingRoom: managementMocks.createWaitingRoom,
  endWaitingRoom: managementMocks.endWaitingRoom,
  WaitingRoomRequestError: class WaitingRoomRequestError extends Error {},
}));

vi.mock("../features/live-game/use-managed-waiting-rooms", () => ({
  useManagedWaitingRooms: () => managementMocks.roomLibraryState,
}));

describe("ManagementPage", () => {
  beforeEach(() => {
    managementMocks.logout.mockReset().mockResolvedValue(undefined);
    managementMocks.createWaitingRoom.mockReset().mockResolvedValue({
      id: "ABC234",
      phase: "waiting",
      createdAt: 1_000,
      participantCount: 0,
    });
    managementMocks.endWaitingRoom.mockReset().mockResolvedValue("ABC234");
    managementMocks.roomLibraryState.rooms = [];
    managementMocks.roomLibraryState.loading = false;
    managementMocks.roomLibraryState.error = null;
  });

  afterEach(cleanup);

  it("cria uma nova sala e abre sua rota administrativa", async () => {
    const browserUser = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/gerenciar"]}>
        <Routes>
          <Route path="/gerenciar" element={<ManagementPage />} />
          <Route
            path="/gerenciar/sala/:id"
            element={<p>Sala ABC234 aberta</p>}
          />
        </Routes>
      </MemoryRouter>,
    );

    await browserUser.click(
      screen.getByRole("button", { name: "Criar nova sala" }),
    );

    expect(await screen.findByText("Sala ABC234 aberta")).toBeInTheDocument();
    expect(managementMocks.createWaitingRoom).toHaveBeenCalledWith(
      managementMocks.user,
    );
  });

  it("apresenta a biblioteca e mantém a criação disponível", () => {
    managementMocks.roomLibraryState.rooms = [
      {
        id: "ABC234",
        phase: "waiting",
        createdAt: 1_000,
        participantCount: 2,
      },
    ];

    render(
      <MemoryRouter>
        <ManagementPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("ABC234")).toBeInTheDocument();
    expect(screen.getByText("2 participante(s)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir sala" })).toHaveAttribute(
      "href",
      "/gerenciar/sala/ABC234",
    );
    expect(
      screen.getByRole("button", { name: "Criar nova sala" }),
    ).toBeInTheDocument();
  });

  it("confirma o encerramento sem confundi-lo com a saída da conta", async () => {
    const browserUser = userEvent.setup();
    managementMocks.roomLibraryState.rooms = [
      {
        id: "ABC234",
        phase: "waiting",
        createdAt: 1_000,
        participantCount: 2,
      },
    ];

    render(
      <MemoryRouter>
        <ManagementPage />
      </MemoryRouter>,
    );

    await browserUser.click(
      screen.getByRole("button", { name: "Encerrar sala" }),
    );
    await browserUser.click(
      screen.getByRole("button", { name: "Confirmar encerramento" }),
    );

    expect(managementMocks.endWaitingRoom).toHaveBeenCalledWith(
      managementMocks.user,
      { gameId: "ABC234", action: "end-room" },
    );
    expect(managementMocks.logout).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Sair da conta" }),
    ).toBeInTheDocument();
  });
});
