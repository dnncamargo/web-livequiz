// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WaitingRoomPage } from "./WaitingRoomPage";

const roomHookMock = vi.hoisted(() => ({
  state: {
    room: {
      id: "ABC234",
      phase: "waiting",
      createdAt: 1_000,
      participantCount: 0,
    } as null | {
      id: string;
      phase: "waiting";
      createdAt: number;
      participantCount: number;
    },
    loading: false,
    error: null as string | null,
  },
  gameId: "",
}));

const managedRoomHookMock = vi.hoisted(() => ({
  state: {
    waitingRoom: null as null | {
      room: {
        id: string;
        phase: "waiting";
        createdAt: number;
        participantCount: number;
      };
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
  useManagedWaitingRoom: (_user: unknown, gameId: string) => {
    managedRoomHookMock.gameId = gameId;
    return managedRoomHookMock.state;
  },
}));

describe("WaitingRoomPage", () => {
  beforeEach(() => {
    roomHookMock.state.room = {
      id: "ABC234",
      phase: "waiting",
      createdAt: 1_000,
      participantCount: 0,
    };
    roomHookMock.state.loading = false;
    roomHookMock.state.error = null;
    roomHookMock.gameId = "";
    managedRoomHookMock.state.waitingRoom = null;
    managedRoomHookMock.state.loading = false;
    managedRoomHookMock.state.error = null;
    managedRoomHookMock.gameId = "";
  });

  afterEach(cleanup);

  it("restaura a sala pelo código presente na URL", () => {
    render(
      <MemoryRouter initialEntries={["/gerenciar/sala/ABC234"]}>
        <Routes>
          <Route path="/gerenciar/sala/:id" element={<WaitingRoomPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(roomHookMock.gameId).toBe("ABC234");
    expect(screen.getByText("ABC234")).toBeInTheDocument();
    expect(screen.getByText("Aguardando")).toBeInTheDocument();
    expect(screen.getByLabelText("Resumo da sala")).toHaveTextContent("0");
    expect(managedRoomHookMock.gameId).toBe("ABC234");
    expect(
      screen.getByRole("link", { name: "Abrir página do participante" }),
    ).toHaveAttribute("href", "/?sala=ABC234");
  });

  it("informa quando a sala não existe", () => {
    roomHookMock.state.room = null;

    render(
      <MemoryRouter initialEntries={["/gerenciar/sala/ABC234"]}>
        <Routes>
          <Route path="/gerenciar/sala/:id" element={<WaitingRoomPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "A sala não existe ou já foi encerrada.",
    );
  });

  it("apresenta os participantes recuperados pela consulta administrativa", () => {
    managedRoomHookMock.state.waitingRoom = {
      room: {
        id: "ABC234",
        phase: "waiting",
        createdAt: 1_000,
        participantCount: 1,
      },
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

    render(
      <MemoryRouter initialEntries={["/gerenciar/sala/ABC234"]}>
        <Routes>
          <Route path="/gerenciar/sala/:id" element={<WaitingRoomPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Estrela Azul")).toBeInTheDocument();
    expect(screen.getByText("Aguardando aprovação")).toBeInTheDocument();
    expect(screen.getByText("Conectado")).toBeInTheDocument();
  });
});
