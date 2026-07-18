// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuizLibraryPage } from "./QuizLibraryPage";

const pageMocks = vi.hoisted(() => ({
  user: { uid: "administrador-1", getIdToken: vi.fn() },
  createQuizDraft: vi.fn(),
  changeQuizDraftStatus: vi.fn(),
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

describe("QuizLibraryPage", () => {
  beforeEach(() => {
    pageMocks.library.quizzes = [];
    pageMocks.library.loading = false;
    pageMocks.library.error = null;
    pageMocks.createQuizDraft.mockReset().mockResolvedValue({});
    pageMocks.changeQuizDraftStatus.mockReset().mockResolvedValue({});
  });

  afterEach(cleanup);

  it("cria um rascunho com título e descrição", async () => {
    const user = userEvent.setup();
    render(<QuizLibraryPage />);

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

    render(<QuizLibraryPage />);

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
        questionCount: 0,
        createdAt: 1_000,
        updatedAt: 1_000,
      },
    ];
    render(<QuizLibraryPage />);

    await user.click(screen.getByRole("button", { name: "Publicar" }));

    expect(pageMocks.changeQuizDraftStatus).toHaveBeenCalledWith(
      pageMocks.user,
      { quizId: "quiz-1", action: "publish-quiz" },
    );
  });
});
