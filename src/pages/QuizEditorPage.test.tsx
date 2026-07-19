// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QuizEditorPage } from "./QuizEditorPage";

const editorMocks = vi.hoisted(() => ({
  user: { uid: "administrador-1" },
  saveQuizContent: vi.fn(),
  detail: {
    quiz: {
      id: "quiz-1",
      ownerId: "administrador-1",
      title: "Ciências",
      description: "Oitavo ano",
      status: "draft" as const,
      questionCount: 0,
      createdAt: 1_000,
      updatedAt: 1_000,
      questions: [],
    },
    loading: false,
    error: null as string | null,
  },
}));

vi.mock("../contexts/auth-context", () => ({
  useAuth: () => ({ user: editorMocks.user }),
}));

vi.mock("../features/quizzes/use-quiz-detail", () => ({
  useQuizDetail: () => editorMocks.detail,
}));

vi.mock("../features/quizzes/quiz-library", () => ({
  QuizLibraryRequestError: class QuizLibraryRequestError extends Error {},
  saveQuizContent: editorMocks.saveQuizContent,
}));

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={["/admin/quiz/quiz-1"]}>
      <Routes>
        <Route path="/admin/quiz/:id" element={<QuizEditorPage />} />
        <Route path="/admin/quizzes" element={<p>Biblioteca</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("QuizEditorPage", () => {
  beforeEach(() => {
    editorMocks.detail.loading = false;
    editorMocks.detail.error = null;
    editorMocks.detail.quiz = {
      id: "quiz-1",
      ownerId: "administrador-1",
      title: "Ciências",
      description: "Oitavo ano",
      status: "draft",
      questionCount: 0,
      createdAt: 1_000,
      updatedAt: 1_000,
      questions: [],
    };
    editorMocks.saveQuizContent
      .mockReset()
      .mockImplementation((_user: unknown, input: { questions: unknown[] }) =>
        Promise.resolve({
          ...editorMocks.detail.quiz,
          questionCount: input.questions.length,
          questions: input.questions,
        }),
      );
  });

  afterEach(cleanup);

  it("carrega os metadados do quiz", () => {
    renderEditor();

    expect(screen.getByDisplayValue("Ciências")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Oitavo ano")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma pergunta")).toBeInTheDocument();
  });

  it("adiciona e salva uma pergunta de verdadeiro ou falso", async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(
      screen.getByRole("button", {
        name: "Adicionar verdadeiro ou falso",
      }),
    );
    await user.type(
      screen.getByLabelText("Enunciado"),
      "A água congela a zero grau?",
    );
    await user.click(screen.getByRole("button", { name: "Salvar quiz" }));

    await waitFor(() => {
      expect(editorMocks.saveQuizContent).toHaveBeenCalledWith(
        editorMocks.user,
        expect.objectContaining({
          quizId: "quiz-1",
          questions: [
            expect.objectContaining({
              type: "true-false",
              prompt: "A água congela a zero grau?",
              options: [
                expect.objectContaining({ label: "Verdadeiro" }),
                expect.objectContaining({ label: "Falso" }),
              ],
            }),
          ],
        }),
      );
    });
    expect(await screen.findByText("Alterações salvas.")).toBeInTheDocument();
  });
});
