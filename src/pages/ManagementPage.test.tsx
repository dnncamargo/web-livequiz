// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ManagementPage } from "./ManagementPage";
import type { LiveGamePhase } from "../shared/game-types";

const managementMocks = vi.hoisted(() => ({
  archiveWaitingRoom: vi.fn(),
  user: {
    uid: "administrador-1",
    displayName: "Professora Ana",
    email: "ana@example.com",
  },
  roomLibraryState: {
    rooms: [] as Array<{
      id: string;
      name?: string;
      quizTitle?: string;
      phase: LiveGamePhase;
      createdAt: number;
      participantCount: number;
    }>,
    loading: false,
    error: null as string | null,
  },
}));

vi.mock("../contexts/auth-context", () => ({
  useAuth: () => ({ user: managementMocks.user }),
}));

vi.mock("../features/live-game/waiting-room", () => ({
  archiveWaitingRoom: managementMocks.archiveWaitingRoom,
  WaitingRoomRequestError: class WaitingRoomRequestError extends Error {},
}));

vi.mock("../features/live-game/use-managed-waiting-rooms", () => ({
  useManagedWaitingRooms: () => managementMocks.roomLibraryState,
}));

describe("ManagementPage", () => {
  beforeEach(() => {
    managementMocks.archiveWaitingRoom.mockReset().mockResolvedValue({});
    managementMocks.roomLibraryState.rooms = [];
    managementMocks.roomLibraryState.loading = false;
    managementMocks.roomLibraryState.error = null;
  });

  afterEach(cleanup);

  function renderManagement() {
    return render(
      <MemoryRouter initialEntries={["/admin"]}>
        <ManagementPage />
      </MemoryRouter>,
    );
  }

  it("direciona a criação da partida para a biblioteca de quizzes", () => {
    renderManagement();

    expect(screen.getByRole("link", { name: "Escolher quiz" })).toHaveAttribute(
      "href",
      "/admin/quizzes",
    );
    expect(
      screen.queryByRole("button", { name: "Criar sala" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Organizar ao vivo/i)).toBeInTheDocument();
  });

  it("apresenta gerenciamento e apresentação como destinos distintos", () => {
    managementMocks.roomLibraryState.rooms = [
      {
        id: "ABC234",
        name: "Quiz de Ciências",
        quizTitle: "Ciências",
        phase: "waiting",
        createdAt: 1_000,
        participantCount: 2,
      },
    ];
    renderManagement();

    expect(screen.getByText("Quiz de Ciências")).toBeInTheDocument();
    expect(screen.getByText("ABC234")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Gerenciar ao vivo" }),
    ).toHaveAttribute("href", "/admin/room/ABC234");
    expect(
      screen.getByRole("link", { name: "Abrir apresentação" }),
    ).toHaveAttribute("href", "/?room=ABC234");
  });

  it("arquiva uma sala sem confirmação", async () => {
    const browserUser = userEvent.setup();
    managementMocks.roomLibraryState.rooms = [
      {
        id: "ABC234",
        name: "Quiz de Ciências",
        phase: "waiting",
        createdAt: 1_000,
        participantCount: 0,
      },
    ];
    renderManagement();

    await browserUser.click(screen.getByRole("button", { name: "Arquivar" }));

    expect(managementMocks.archiveWaitingRoom).toHaveBeenCalledWith(
      managementMocks.user,
      { gameId: "ABC234", action: "archive-room" },
    );
  });
});
