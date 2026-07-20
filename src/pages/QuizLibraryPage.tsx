import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/auth-context";
import {
  createWaitingRoom,
  WaitingRoomRequestError,
} from "../features/live-game/waiting-room";
import {
  createQuizDraft,
  changeQuizDraftStatus,
  QuizLibraryRequestError,
} from "../features/quizzes/quiz-library";
import { useQuizLibrary } from "../features/quizzes/use-quiz-library";
import {
  createQuizRequestSchema,
  QUIZ_DESCRIPTION_MAX_LENGTH,
  QUIZ_TITLE_MAX_LENGTH,
  type CreateQuizRequest,
  type ChangeQuizStatusRequest,
  type Quiz,
} from "../shared/quiz";

const QUIZ_STATUS_LABELS = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
} as const;

export function QuizLibraryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [refreshRevision, setRefreshRevision] = useState(0);
  const library = useQuizLibrary(user, refreshRevision);
  const [actionError, setActionError] = useState("");
  const [creatingQuiz, setCreatingQuiz] = useState(false);
  const [processingQuizId, setProcessingQuizId] = useState<string | null>(null);
  const activeQuizzes = library.quizzes.filter(
    ({ status }) => status !== "archived",
  );
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
      setCreatingQuiz(false);
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

  async function handleStatusChange(input: ChangeQuizStatusRequest) {
    if (!user) return;

    setProcessingQuizId(input.quizId);
    setActionError("");

    try {
      await changeQuizDraftStatus(user, input);
      setRefreshRevision((revision) => revision + 1);
    } catch (error) {
      console.error("Erro ao alterar estado do quiz:", error);
      setActionError(
        error instanceof QuizLibraryRequestError
          ? error.message
          : "Não foi possível alterar o estado do quiz.",
      );
    } finally {
      setProcessingQuizId(null);
    }
  }

  async function handleOrganizeLive(quiz: Quiz) {
    if (!user) return;

    setProcessingQuizId(quiz.id);
    setActionError("");

    try {
      const room = await createWaitingRoom(user, {
        name: quiz.title,
        quizId: quiz.id,
      });
      navigate(`/admin/room/${room.id}`);
    } catch (error) {
      console.error("Erro ao organizar quiz ao vivo:", error);
      setActionError(
        error instanceof WaitingRoomRequestError
          ? error.message
          : "Não foi possível preparar a sala ao vivo.",
      );
      setProcessingQuizId(null);
    }
  }

  return (
    <main className="page management-page">
      <section className="card management-library-card">
        <header className="management-header">
          <div>
            <span className="eyebrow">Conteúdo</span>
            <h1>Quizzes</h1>
            <p>
              Crie o conteúdo e organize uma partida ao vivo quando estiver
              pronto.
            </p>
          </div>
          <button
            type="button"
            className="primary-button"
            aria-expanded={creatingQuiz}
            aria-controls="quiz-creation-form"
            disabled={creatingQuiz}
            onClick={() => setCreatingQuiz(true)}
          >
            Criar quiz
          </button>
        </header>

        {creatingQuiz && (
          <form
            id="quiz-creation-form"
            className="quiz-creation-form"
            onSubmit={submitQuiz}
          >
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
                <span className="field-error">
                  {errors.description.message}
                </span>
              )}
            </div>
            <div className="quiz-creation-actions">
              <button
                type="submit"
                className="primary-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Criando quiz..." : "Criar rascunho"}
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={isSubmitting}
                onClick={() => {
                  reset();
                  setCreatingQuiz(false);
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {actionError && (
          <div className="test-result test-result-error" role="alert">
            <strong>Não foi possível concluir a ação</strong>
            <p>{actionError}</p>
          </div>
        )}

        <section className="room-library" aria-labelledby="quiz-library-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Biblioteca</span>
              <h2 id="quiz-library-title">Seus quizzes</h2>
            </div>
            <span>{activeQuizzes.length} quiz(zes)</span>
          </div>

          {library.loading && <p role="status">Carregando quizzes...</p>}
          {library.error && (
            <div className="test-result test-result-error" role="alert">
              <strong>Não foi possível carregar os quizzes</strong>
              <p>{library.error}</p>
            </div>
          )}
          {!library.loading && !library.error && activeQuizzes.length === 0 && (
            <div className="empty-library">
              <strong>Nenhum quiz criado</strong>
              <p>Use “Criar quiz” para adicionar o primeiro rascunho.</p>
            </div>
          )}
          {activeQuizzes.length > 0 && (
            <ul className="room-library-list quiz-library-list">
              {activeQuizzes.map((quiz) => (
                <li key={quiz.id}>
                  <div className="room-library-summary">
                    <span className="room-status">
                      {QUIZ_STATUS_LABELS[quiz.status]}
                    </span>
                    <strong className="room-library-name">{quiz.title}</strong>
                    {quiz.description && <p>{quiz.description}</p>}
                    <small>{quiz.questionCount} pergunta(s)</small>
                  </div>
                  <div className="room-library-actions">
                    <Link
                      className="secondary-button compact-button"
                      to={`/admin/quiz/${quiz.id}`}
                    >
                      Editar
                    </Link>
                    {quiz.status === "draft" && (
                      <button
                        type="button"
                        className="primary-button compact-button"
                        disabled={
                          processingQuizId === quiz.id ||
                          quiz.questionCount === 0
                        }
                        title={
                          quiz.questionCount === 0
                            ? "Adicione uma pergunta antes de publicar"
                            : undefined
                        }
                        onClick={() =>
                          void handleStatusChange({
                            quizId: quiz.id,
                            action: "publish-quiz",
                          })
                        }
                      >
                        Publicar
                      </button>
                    )}
                    {quiz.status === "published" && (
                      <button
                        type="button"
                        className="primary-button compact-button"
                        disabled={processingQuizId === quiz.id}
                        onClick={() => void handleOrganizeLive(quiz)}
                      >
                        {processingQuizId === quiz.id
                          ? "Preparando sala..."
                          : "Organizar ao vivo"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="secondary-button compact-button"
                      disabled={processingQuizId === quiz.id}
                      onClick={() =>
                        void handleStatusChange({
                          quizId: quiz.id,
                          action: "archive-quiz",
                        })
                      }
                    >
                      Arquivar
                    </button>
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
