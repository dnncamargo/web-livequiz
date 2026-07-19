// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ArchivedRoomsPage } from "./ArchivedRoomsPage";

const archivedMocks = vi.hoisted(() => ({
  changeQuizDraftStatus: vi.fn(),
  deleteArchivedWaitingRoom: vi.fn(),
  restoreWaitingRoom: vi.fn(),
  user: { uid: "administrador-1" },
  library: {
    rooms: [
      {
        id: "ABC234",
        name: "Quiz de Ciências",
        createdAt: 1_000,
        archivedAt: 2_000,
        participantCount: 3,
      },
    ],
    loading: false,
    error: null as string | null,
  },
  quizLibrary: {
    quizzes: [] as Array<{
      id: string;
      ownerId: string;
      title: string;
      description: string;
      status: "archived";
      questionCount: number;
      createdAt: number;
      updatedAt: number;
    }>,
    loading: false,
    error: null as string | null,
  },
}));

vi.mock("../contexts/auth-context", () => ({
  useAuth: () => ({ user: archivedMocks.user }),
}));

vi.mock("../features/live-game/use-archived-waiting-rooms", () => ({
  useArchivedWaitingRooms: () => archivedMocks.library,
}));

vi.mock("../features/live-game/waiting-room", () => ({
  deleteArchivedWaitingRoom: archivedMocks.deleteArchivedWaitingRoom,
  restoreWaitingRoom: archivedMocks.restoreWaitingRoom,
  WaitingRoomRequestError: class WaitingRoomRequestError extends Error {},
}));

vi.mock("../features/quizzes/use-quiz-library", () => ({
  useQuizLibrary: () => archivedMocks.quizLibrary,
}));

vi.mock("../features/quizzes/quiz-library", () => ({
  changeQuizDraftStatus: archivedMocks.changeQuizDraftStatus,
  QuizLibraryRequestError: class QuizLibraryRequestError extends Error {},
}));

function renderArchivedRooms() {
  return render(
    <MemoryRouter initialEntries={["/admin/archive"]}>
      <Routes>
        <Route path="/admin/archive" element={<ArchivedRoomsPage />} />
        <Route path="/admin" element={<p>Biblioteca de salas</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ArchivedRoomsPage", () => {
  beforeEach(() => {
    archivedMocks.restoreWaitingRoom.mockReset().mockResolvedValue({});
    archivedMocks.changeQuizDraftStatus.mockReset().mockResolvedValue({});
    archivedMocks.deleteArchivedWaitingRoom
      .mockReset()
      .mockResolvedValue("ABC234");
    archivedMocks.library.rooms = [
      {
        id: "ABC234",
        name: "Quiz de Ciências",
        createdAt: 1_000,
        archivedAt: 2_000,
        participantCount: 3,
      },
    ];
    archivedMocks.library.loading = false;
    archivedMocks.library.error = null;
    archivedMocks.quizLibrary.quizzes = [];
    archivedMocks.quizLibrary.loading = false;
    archivedMocks.quizLibrary.error = null;
  });

  afterEach(cleanup);

  it("lista nome, código e dados da sala arquivada", () => {
    renderArchivedRooms();

    expect(screen.getByText("Quiz de Ciências")).toBeInTheDocument();
    expect(screen.getByText("ABC234")).toBeInTheDocument();
    expect(screen.getByText(/3 participante/i)).toBeInTheDocument();
  });

  it("exige confirmação antes de restaurar", async () => {
    const browserUser = userEvent.setup();
    renderArchivedRooms();

    await browserUser.click(screen.getByRole("button", { name: "Restaurar" }));
    expect(archivedMocks.restoreWaitingRoom).not.toHaveBeenCalled();
    await browserUser.click(
      screen.getByRole("button", { name: "Confirmar restauração" }),
    );

    expect(archivedMocks.restoreWaitingRoom).toHaveBeenCalledWith(
      archivedMocks.user,
      { gameId: "ABC234", action: "restore-room" },
    );
    expect(await screen.findByText("Biblioteca de salas")).toBeInTheDocument();
  });

  it("exige confirmação antes de excluir definitivamente", async () => {
    const browserUser = userEvent.setup();
    renderArchivedRooms();

    await browserUser.click(screen.getByRole("button", { name: "Excluir" }));
    expect(archivedMocks.deleteArchivedWaitingRoom).not.toHaveBeenCalled();
    await browserUser.click(
      screen.getByRole("button", { name: "Confirmar exclusão" }),
    );

    expect(archivedMocks.deleteArchivedWaitingRoom).toHaveBeenCalledWith(
      archivedMocks.user,
      { gameId: "ABC234", action: "delete-room" },
    );
    expect(screen.queryByText("Quiz de Ciências")).not.toBeInTheDocument();
  });

  it("lista e restaura quizzes arquivados", async () => {
    const browserUser = userEvent.setup();
    archivedMocks.quizLibrary.quizzes = [
      {
        id: "quiz-1",
        ownerId: "administrador-1",
        title: "Ciências — 8º ano",
        description: "",
        status: "archived",
        questionCount: 4,
        createdAt: 1_000,
        updatedAt: 2_000,
      },
    ];
    renderArchivedRooms();

    expect(screen.getByText("Ciências — 8º ano")).toBeInTheDocument();
    const restoreButtons = screen.getAllByRole("button", {
      name: "Restaurar",
    });
    await browserUser.click(restoreButtons[1] as HTMLButtonElement);
    await browserUser.click(
      screen.getByRole("button", { name: "Confirmar restauração?" }),
    );

    expect(archivedMocks.changeQuizDraftStatus).toHaveBeenCalledWith(
      archivedMocks.user,
      { quizId: "quiz-1", action: "restore-quiz" },
    );
    expect(screen.queryByText("Ciências — 8º ano")).not.toBeInTheDocument();
  });
});
