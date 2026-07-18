// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ManagementPage } from "./ManagementPage";

const managementMocks = vi.hoisted(() => ({
  archiveWaitingRoom: vi.fn(),
  createWaitingRoom: vi.fn(),
  endWaitingRoom: vi.fn(),
  presentWaitingRoom: vi.fn(),
  logout: vi.fn(),
  user: {
    uid: "administrador-1",
    displayName: "Professora Ana",
    email: "ana@example.com",
  },
  roomLibraryState: {
    rooms: [] as Array<{
      id: string;
      name?: string;
      phase: "waiting" | "finished";
      presentationStatus?: "inactive" | "active";
      createdAt: number;
      participantCount: number;
    }>,
    loading: false,
    error: null as string | null,
  },
  quizLibraryState: {
    quizzes: [] as Array<{
      id: string;
      title: string;
      status: "draft" | "published" | "archived";
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
  archiveWaitingRoom: managementMocks.archiveWaitingRoom,
  createWaitingRoom: managementMocks.createWaitingRoom,
  endWaitingRoom: managementMocks.endWaitingRoom,
  presentWaitingRoom: managementMocks.presentWaitingRoom,
  WaitingRoomRequestError: class WaitingRoomRequestError extends Error {},
}));

vi.mock("../features/live-game/use-managed-waiting-rooms", () => ({
  useManagedWaitingRooms: () => managementMocks.roomLibraryState,
}));

vi.mock("../features/quizzes/use-quiz-library", () => ({
  useQuizLibrary: () => managementMocks.quizLibraryState,
}));

describe("ManagementPage", () => {
  beforeEach(() => {
    const room = {
      id: "ABC234",
      name: "Quiz de Ciências",
      phase: "finished" as const,
      createdAt: 1_000,
      participantCount: 0,
    };
    managementMocks.logout.mockReset().mockResolvedValue(undefined);
    managementMocks.createWaitingRoom.mockReset().mockResolvedValue(room);
    managementMocks.endWaitingRoom
      .mockReset()
      .mockResolvedValue({ ...room, phase: "finished" });
    managementMocks.presentWaitingRoom
      .mockReset()
      .mockResolvedValue({ ...room, phase: "waiting" });
    managementMocks.archiveWaitingRoom.mockReset().mockResolvedValue({
      id: room.id,
      name: room.name,
      createdAt: room.createdAt,
      archivedAt: 2_000,
      participantCount: 0,
    });
    managementMocks.roomLibraryState.rooms = [];
    managementMocks.roomLibraryState.loading = false;
    managementMocks.roomLibraryState.error = null;
    managementMocks.quizLibraryState.quizzes = [];
  });

  afterEach(cleanup);

  function renderManagement() {
    return render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<ManagementPage />} />
          <Route path="/admin/room/:id" element={<p>Sala ABC234 aberta</p>} />
          <Route path="/" element={<p>Apresentação aberta</p>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("cria uma sala identificada por nome sem confirmação", async () => {
    const browserUser = userEvent.setup();
    renderManagement();

    await browserUser.type(
      screen.getByLabelText("Nome da nova sala"),
      "Quiz de Ciências",
    );
    await browserUser.click(screen.getByRole("button", { name: "Criar sala" }));

    expect(await screen.findByText("Sala ABC234 aberta")).toBeInTheDocument();
    expect(managementMocks.createWaitingRoom).toHaveBeenCalledWith(
      managementMocks.user,
      { name: "Quiz de Ciências" },
    );
  });

  it("associa um quiz publicado ao criar a sala", async () => {
    const browserUser = userEvent.setup();
    managementMocks.quizLibraryState.quizzes = [
      { id: "quiz-1", title: "Ciências", status: "published" },
      { id: "quiz-2", title: "Rascunho", status: "draft" },
    ];
    renderManagement();

    await browserUser.type(
      screen.getByLabelText("Nome da nova sala"),
      "Turma 8A",
    );
    await browserUser.selectOptions(
      screen.getByLabelText("Quiz associado"),
      "quiz-1",
    );
    await browserUser.click(screen.getByRole("button", { name: "Criar sala" }));

    expect(managementMocks.createWaitingRoom).toHaveBeenCalledWith(
      managementMocks.user,
      { name: "Turma 8A", quizId: "quiz-1" },
    );
    expect(
      screen.queryByRole("option", { name: "Rascunho" }),
    ).not.toBeInTheDocument();
  });

  it("apresenta nome, código e ações semanticamente separadas", () => {
    managementMocks.roomLibraryState.rooms = [
      {
        id: "ABC234",
        name: "Quiz de Ciências",
        phase: "finished",
        createdAt: 1_000,
        participantCount: 2,
      },
    ];
    renderManagement();

    expect(screen.getByText("Quiz de Ciências")).toBeInTheDocument();
    expect(screen.getByText("ABC234")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Gerenciar" })).toHaveAttribute(
      "href",
      "/admin/room/ABC234",
    );
    expect(
      screen.getByRole("button", { name: "Apresentar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Arquivar" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Encerrar" }),
    ).not.toBeInTheDocument();
  });

  it("apresenta sem solicitar confirmação", async () => {
    const browserUser = userEvent.setup();
    managementMocks.roomLibraryState.rooms = [
      {
        id: "ABC234",
        name: "Quiz de Ciências",
        phase: "finished",
        createdAt: 1_000,
        participantCount: 0,
      },
    ];
    renderManagement();

    await browserUser.click(screen.getByRole("button", { name: "Apresentar" }));
    expect(managementMocks.presentWaitingRoom).toHaveBeenCalledWith(
      managementMocks.user,
      { gameId: "ABC234", action: "present-room" },
    );
  });

  it("arquiva sem solicitar confirmação", async () => {
    const browserUser = userEvent.setup();
    managementMocks.roomLibraryState.rooms = [
      {
        id: "ABC234",
        name: "Quiz de Ciências",
        phase: "finished",
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

  it("exige confirmação somente para encerrar a apresentação", async () => {
    const browserUser = userEvent.setup();
    managementMocks.roomLibraryState.rooms = [
      {
        id: "ABC234",
        name: "Quiz de Ciências",
        phase: "waiting",
        presentationStatus: "active",
        createdAt: 1_000,
        participantCount: 2,
      },
    ];
    renderManagement();

    await browserUser.click(screen.getByRole("button", { name: "Encerrar" }));
    expect(managementMocks.endWaitingRoom).not.toHaveBeenCalled();
    await browserUser.click(
      screen.getByRole("button", { name: "Confirmar encerramento" }),
    );

    expect(managementMocks.endWaitingRoom).toHaveBeenCalledWith(
      managementMocks.user,
      { gameId: "ABC234", action: "end-room" },
    );
    expect(managementMocks.logout).not.toHaveBeenCalled();
  });
});
