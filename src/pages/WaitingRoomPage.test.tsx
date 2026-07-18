// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WaitingRoomPage } from "./WaitingRoomPage";

type Room = {
  id: string;
  name?: string;
  phase: "waiting" | "finished";
  presentationStatus?: "inactive" | "active";
  createdAt: number;
  participantCount: number;
};

const roomHookMock = vi.hoisted(() => ({
  state: {
    room: {
      id: "ABC234",
      name: "Quiz de Ciências",
      phase: "waiting",
      presentationStatus: "active",
      createdAt: 1_000,
      participantCount: 0,
    } as Room | null,
    loading: false,
    error: null as string | null,
  },
  gameId: "",
}));

const managedRoomHookMock = vi.hoisted(() => ({
  state: {
    waitingRoom: null as null | {
      room: Room;
      participants: Array<{
        participantId: string;
        nickname: string;
        moderationStatus: "waiting-approval" | "approved" | "removed";
        joinedAt: number;
        presenceStatus: "connected" | "disconnected";
      }>;
    },
    loading: false,
    error: null as string | null,
  },
  gameId: "",
  refreshRevision: "" as string | number,
  archiveWaitingRoom: vi.fn(),
  endWaitingRoom: vi.fn(),
  presentWaitingRoom: vi.fn(),
  removeWaitingRoomParticipant: vi.fn(),
}));

vi.mock("../contexts/auth-context", () => ({
  useAuth: () => ({ user: { uid: "administrador-1" } }),
}));

vi.mock("../features/live-game/use-public-waiting-room", () => ({
  usePublicWaitingRoom: (gameId: string) => {
    roomHookMock.gameId = gameId;
    return roomHookMock.state;
  },
}));

vi.mock("../features/live-game/use-managed-waiting-room", () => ({
  useManagedWaitingRoom: (
    _user: unknown,
    gameId: string,
    refreshRevision: string | number,
  ) => {
    managedRoomHookMock.gameId = gameId;
    managedRoomHookMock.refreshRevision = refreshRevision;
    return managedRoomHookMock.state;
  },
}));

vi.mock("../features/live-game/waiting-room", () => ({
  WaitingRoomRequestError: class WaitingRoomRequestError extends Error {},
  archiveWaitingRoom: managedRoomHookMock.archiveWaitingRoom,
  endWaitingRoom: managedRoomHookMock.endWaitingRoom,
  presentWaitingRoom: managedRoomHookMock.presentWaitingRoom,
  removeWaitingRoomParticipant:
    managedRoomHookMock.removeWaitingRoomParticipant,
}));

function buildRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: "ABC234",
    name: "Quiz de Ciências",
    phase: "waiting",
    presentationStatus: "active",
    createdAt: 1_000,
    participantCount: 0,
    ...overrides,
  };
}

function renderWaitingRoom() {
  return render(
    <MemoryRouter initialEntries={["/admin/room/ABC234"]}>
      <Routes>
        <Route path="/admin/room/:id" element={<WaitingRoomPage />} />
        <Route path="/admin" element={<p>Biblioteca de salas</p>} />
        <Route path="/" element={<p>Apresentação aberta</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("WaitingRoomPage", () => {
  beforeEach(() => {
    roomHookMock.state.room = buildRoom();
    roomHookMock.state.loading = false;
    roomHookMock.state.error = null;
    roomHookMock.gameId = "";
    managedRoomHookMock.state.waitingRoom = null;
    managedRoomHookMock.state.loading = false;
    managedRoomHookMock.state.error = null;
    managedRoomHookMock.gameId = "";
    managedRoomHookMock.refreshRevision = "";
    managedRoomHookMock.archiveWaitingRoom.mockReset().mockResolvedValue({});
    managedRoomHookMock.endWaitingRoom
      .mockReset()
      .mockResolvedValue(buildRoom({ phase: "finished" }));
    managedRoomHookMock.presentWaitingRoom
      .mockReset()
      .mockResolvedValue(buildRoom({ phase: "waiting" }));
    managedRoomHookMock.removeWaitingRoomParticipant
      .mockReset()
      .mockResolvedValue(null);
  });

  afterEach(cleanup);

  it("restaura a sala pelo código presente na URL", () => {
    renderWaitingRoom();

    expect(roomHookMock.gameId).toBe("ABC234");
    expect(screen.getByText("Quiz de Ciências")).toBeInTheDocument();
    expect(screen.getByText("ABC234")).toBeInTheDocument();
    expect(screen.getByText("Aguardando participantes")).toBeInTheDocument();
    expect(screen.getByText("Ativa")).toBeInTheDocument();
    expect(screen.getByLabelText("Resumo da sala")).toHaveTextContent("0");
    expect(managedRoomHookMock.gameId).toBe("ABC234");
    expect(managedRoomHookMock.refreshRevision).toBe("waiting:0:0");
    expect(
      screen.queryByRole("link", { name: /Abrir página do participante/i }),
    ).not.toBeInTheDocument();
  });

  it("informa quando a sala não existe", () => {
    roomHookMock.state.room = null;
    renderWaitingRoom();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "A sala não existe ou já foi encerrada.",
    );
  });

  it("solicita atualização administrativa quando a contagem pública muda", () => {
    const view = renderWaitingRoom();

    expect(managedRoomHookMock.refreshRevision).toBe("waiting:0:0");
    roomHookMock.state.room = buildRoom({ participantCount: 1 });
    view.rerender(
      <MemoryRouter initialEntries={["/admin/room/ABC234"]}>
        <Routes>
          <Route path="/admin/room/:id" element={<WaitingRoomPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(managedRoomHookMock.refreshRevision).toBe("waiting:1:0");
  });

  it("apresenta os participantes recuperados pela consulta administrativa", () => {
    managedRoomHookMock.state.waitingRoom = {
      room: buildRoom({ participantCount: 1 }),
      participants: [
        {
          participantId: "participante-1",
          nickname: "Estrela Azul",
          moderationStatus: "waiting-approval",
          joinedAt: 2_000,
          presenceStatus: "connected",
        },
      ],
    };

    renderWaitingRoom();

    expect(screen.getByText("Estrela Azul")).toBeInTheDocument();
    expect(screen.getByText("Pronto")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remover" })).toBeInTheDocument();
  });

  it("confirma a remoção antes de solicitar a ação administrativa", async () => {
    const browserUser = userEvent.setup();
    managedRoomHookMock.state.waitingRoom = {
      room: buildRoom({ participantCount: 1 }),
      participants: [
        {
          participantId: "participante-1",
          nickname: "Estrela Azul",
          moderationStatus: "waiting-approval",
          joinedAt: 2_000,
          presenceStatus: "connected",
        },
      ],
    };
    renderWaitingRoom();

    await browserUser.click(screen.getByRole("button", { name: "Remover" }));
    await browserUser.click(screen.getByRole("button", { name: "Confirmar?" }));

    expect(
      managedRoomHookMock.removeWaitingRoomParticipant,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ uid: "administrador-1" }),
      {
        gameId: "ABC234",
        participantId: "participante-1",
        action: "remove",
      },
    );
  });

  it("confirma o encerramento e mantém a sala finalizada", async () => {
    const browserUser = userEvent.setup();
    renderWaitingRoom();

    await browserUser.click(screen.getByRole("button", { name: "Encerrar" }));
    expect(managedRoomHookMock.endWaitingRoom).not.toHaveBeenCalled();
    await browserUser.click(
      screen.getByRole("button", { name: "Confirmar encerramento" }),
    );

    expect(managedRoomHookMock.endWaitingRoom).toHaveBeenCalledWith(
      expect.objectContaining({ uid: "administrador-1" }),
      { gameId: "ABC234", action: "end-room" },
    );
    expect(await screen.findByText("Inativa")).toBeInTheDocument();
    expect(screen.getByText("Quiz de Ciências")).toBeInTheDocument();
  });

  it("apresenta sem confirmação", async () => {
    const browserUser = userEvent.setup();
    roomHookMock.state.room = buildRoom({ presentationStatus: "inactive" });
    renderWaitingRoom();

    await browserUser.click(screen.getByRole("button", { name: "Apresentar" }));

    expect(managedRoomHookMock.presentWaitingRoom).toHaveBeenCalledWith(
      expect.objectContaining({ uid: "administrador-1" }),
      { gameId: "ABC234", action: "present-room" },
    );
    expect(await screen.findByText("Apresentação aberta")).toBeInTheDocument();
  });

  it("arquiva sem confirmação", async () => {
    const browserUser = userEvent.setup();
    renderWaitingRoom();

    await browserUser.click(screen.getByRole("button", { name: "Arquivar" }));

    expect(managedRoomHookMock.archiveWaitingRoom).toHaveBeenCalledWith(
      expect.objectContaining({ uid: "administrador-1" }),
      { gameId: "ABC234", action: "archive-room" },
    );
    expect(await screen.findByText("Biblioteca de salas")).toBeInTheDocument();
  });
});
