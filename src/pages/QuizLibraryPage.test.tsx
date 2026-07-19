// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QuizLibraryPage } from "./QuizLibraryPage";

const pageMocks = vi.hoisted(() => ({
  user: { uid: "administrador-1", getIdToken: vi.fn() },
  createQuizDraft: vi.fn(),
  changeQuizDraftStatus: vi.fn(),
  createWaitingRoom: vi.fn(),
  library: {
    quizzes: [] as Array<{
      id: string;
      ownerId: string;
      title: string;
      description: string;
      status: "draft" | "published" | "archived";
      questionCount: number;
      createdAt: number;
      updatedAt: number;
    }>,
    loading: false,
    error: null as string | null,
  },
}));

vi.mock("../contexts/auth-context", () => ({
  useAuth: () => ({ user: pageMocks.user }),
}));

vi.mock("../features/quizzes/quiz-library", () => ({
  QuizLibraryRequestError: class QuizLibraryRequestError extends Error {},
  changeQuizDraftStatus: pageMocks.changeQuizDraftStatus,
  createQuizDraft: pageMocks.createQuizDraft,
}));

vi.mock("../features/quizzes/use-quiz-library", () => ({
  useQuizLibrary: () => pageMocks.library,
}));

vi.mock("../features/live-game/waiting-room", () => ({
  WaitingRoomRequestError: class WaitingRoomRequestError extends Error {},
  createWaitingRoom: pageMocks.createWaitingRoom,
}));

function renderQuizLibrary() {
  return render(
    <MemoryRouter initialEntries={["/admin/quizzes"]}>
      <Routes>
        <Route path="/admin/quizzes" element={<QuizLibraryPage />} />
        <Route path="/admin/room/:id" element={<p>Sala ao vivo aberta</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("QuizLibraryPage", () => {
  beforeEach(() => {
    pageMocks.library.quizzes = [];
    pageMocks.library.loading = false;
    pageMocks.library.error = null;
    pageMocks.createQuizDraft.mockReset().mockResolvedValue({});
    pageMocks.changeQuizDraftStatus.mockReset().mockResolvedValue({});
    pageMocks.createWaitingRoom.mockReset().mockResolvedValue({ id: "ABC234" });
  });

  afterEach(cleanup);

  it("cria um rascunho com título e descrição", async () => {
    const user = userEvent.setup();
    renderQuizLibrary();

    await user.type(screen.getByLabelText("Título do quiz"), "Ciências");
    await user.type(screen.getByLabelText("Descrição"), "Oitavo ano");
    await user.click(screen.getByRole("button", { name: "Criar quiz" }));

    expect(pageMocks.createQuizDraft).toHaveBeenCalledWith(pageMocks.user, {
      title: "Ciências",
      description: "Oitavo ano",
    });
  });

  it("exibe os metadados permanentes da biblioteca", () => {
    pageMocks.library.quizzes = [
      {
        id: "quiz-1",
        ownerId: "administrador-1",
        title: "Geografia",
        description: "Capitais do Brasil",
        status: "draft",
        questionCount: 0,
        createdAt: 1_000,
        updatedAt: 1_000,
      },
    ];

    renderQuizLibrary();

    expect(screen.getByText("Geografia")).toBeInTheDocument();
    expect(screen.getByText("Rascunho")).toBeInTheDocument();
    expect(screen.getByText("0 pergunta(s)")).toBeInTheDocument();
  });

  it("publica um quiz em rascunho", async () => {
    const user = userEvent.setup();
    pageMocks.library.quizzes = [
      {
        id: "quiz-1",
        ownerId: "administrador-1",
        title: "Geografia",
        description: "",
        status: "draft",
        questionCount: 1,
        createdAt: 1_000,
        updatedAt: 1_000,
      },
    ];
    renderQuizLibrary();

    await user.click(screen.getByRole("button", { name: "Publicar" }));

    expect(pageMocks.changeQuizDraftStatus).toHaveBeenCalledWith(
      pageMocks.user,
      { quizId: "quiz-1", action: "publish-quiz" },
    );
  });

  it("organiza um quiz publicado em uma nova sala ao vivo", async () => {
    const browserUser = userEvent.setup();
    pageMocks.library.quizzes = [
      {
        id: "quiz-1",
        ownerId: "administrador-1",
        title: "Geografia",
        description: "",
        status: "published",
        questionCount: 3,
        createdAt: 1_000,
        updatedAt: 1_000,
      },
    ];
    renderQuizLibrary();

    await browserUser.click(
      screen.getByRole("button", { name: "Organizar ao vivo" }),
    );

    expect(pageMocks.createWaitingRoom).toHaveBeenCalledWith(pageMocks.user, {
      name: "Geografia",
      quizId: "quiz-1",
    });
    expect(await screen.findByText("Sala ao vivo aberta")).toBeInTheDocument();
  });
});
