import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useAuth } from "../contexts/auth-context";
import {
  createQuizDraft,
  QuizLibraryRequestError,
} from "../features/quizzes/quiz-library";
import { useQuizLibrary } from "../features/quizzes/use-quiz-library";
import {
  createQuizRequestSchema,
  QUIZ_DESCRIPTION_MAX_LENGTH,
  QUIZ_TITLE_MAX_LENGTH,
  type CreateQuizRequest,
} from "../shared/quiz";

const QUIZ_STATUS_LABELS = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
} as const;

export function QuizLibraryPage() {
  const { user } = useAuth();
  const [refreshRevision, setRefreshRevision] = useState(0);
  const library = useQuizLibrary(user, refreshRevision);
  const [actionError, setActionError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateQuizRequest>({
    resolver: zodResolver(createQuizRequestSchema),
    defaultValues: { title: "", description: "" },
  });

  const submitQuiz = handleSubmit(async (input) => {
    if (!user) return;

    setActionError("");

    try {
      await createQuizDraft(user, input);
      reset();
      setRefreshRevision((revision) => revision + 1);
    } catch (error) {
      console.error("Erro ao criar quiz:", error);
      setActionError(
        error instanceof QuizLibraryRequestError
          ? error.message
          : "Não foi possível criar o quiz.",
      );
    }
  });

  return (
    <main className="page management-page">
      <section className="card management-library-card">
        <header className="management-header">
          <div>
            <span className="eyebrow">Conteúdo</span>
            <h1>Quizzes</h1>
            <p>
              Organize o conteúdo permanente antes de vinculá-lo a uma sala.
            </p>
          </div>
        </header>

        <form className="quiz-creation-form" onSubmit={submitQuiz}>
          <div className="form-field">
            <label htmlFor="quiz-title">Título do quiz</label>
            <input
              id="quiz-title"
              maxLength={QUIZ_TITLE_MAX_LENGTH}
              placeholder="Ex.: Ciências — 8º ano"
              aria-invalid={Boolean(errors.title)}
              {...register("title")}
            />
            {errors.title && (
              <span className="field-error">{errors.title.message}</span>
            )}
          </div>
          <div className="form-field">
            <label htmlFor="quiz-description">Descrição</label>
            <textarea
              id="quiz-description"
              maxLength={QUIZ_DESCRIPTION_MAX_LENGTH}
              placeholder="Objetivo, turma ou observações sobre o conteúdo"
              aria-invalid={Boolean(errors.description)}
              {...register("description")}
            />
            {errors.description && (
              <span className="field-error">{errors.description.message}</span>
            )}
          </div>
          <button
            type="submit"
            className="primary-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Criando quiz..." : "Criar quiz"}
          </button>
        </form>

        {actionError && (
          <div className="test-result test-result-error" role="alert">
            <strong>Não foi possível criar o quiz</strong>
            <p>{actionError}</p>
          </div>
        )}

        <section className="room-library" aria-labelledby="quiz-library-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Biblioteca</span>
              <h2 id="quiz-library-title">Seus quizzes</h2>
            </div>
            <span>{library.quizzes.length} quiz(zes)</span>
          </div>

          {library.loading && <p role="status">Carregando quizzes...</p>}
          {library.error && (
            <div className="test-result test-result-error" role="alert">
              <strong>Não foi possível carregar os quizzes</strong>
              <p>{library.error}</p>
            </div>
          )}
          {!library.loading &&
            !library.error &&
            library.quizzes.length === 0 && (
              <div className="empty-library">
                <strong>Nenhum quiz criado</strong>
                <p>Crie o primeiro rascunho usando o formulário acima.</p>
              </div>
            )}
          {library.quizzes.length > 0 && (
            <ul className="room-library-list quiz-library-list">
              {library.quizzes.map((quiz) => (
                <li key={quiz.id}>
                  <div className="room-library-summary">
                    <span className="room-status">
                      {QUIZ_STATUS_LABELS[quiz.status]}
                    </span>
                    <strong className="room-library-name">{quiz.title}</strong>
                    {quiz.description && <p>{quiz.description}</p>}
                    <small>{quiz.questionCount} pergunta(s)</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </main>
  );
}
