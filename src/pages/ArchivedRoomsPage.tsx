import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TemporaryConfirmButton } from "../components/TemporaryConfirmButton";
import { useAuth } from "../contexts/auth-context";
import { useArchivedWaitingRooms } from "../features/live-game/use-archived-waiting-rooms";
import {
  deleteArchivedWaitingRoom,
  restoreWaitingRoom,
  WaitingRoomRequestError,
} from "../features/live-game/waiting-room";
import {
  changeQuizDraftStatus,
  QuizLibraryRequestError,
} from "../features/quizzes/quiz-library";
import { useQuizLibrary } from "../features/quizzes/use-quiz-library";

type PendingAction = {
  gameId: string;
  action: "restore" | "delete";
} | null;

function formatArchivedAt(timestamp: number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(timestamp);
}

export function ArchivedRoomsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [quizRefreshRevision, setQuizRefreshRevision] = useState(0);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [processingRoomId, setProcessingRoomId] = useState<string | null>(null);
  const [processingQuizId, setProcessingQuizId] = useState<string | null>(null);
  const [deletedRoomIds, setDeletedRoomIds] = useState<string[]>([]);
  const [restoredQuizIds, setRestoredQuizIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const roomLibrary = useArchivedWaitingRooms(user, refreshRevision);
  const quizLibrary = useQuizLibrary(user, quizRefreshRevision);
  const rooms = roomLibrary.rooms.filter(
    ({ id }) => !deletedRoomIds.includes(id),
  );
  const quizzes = quizLibrary.quizzes.filter(
    ({ id, status }) => status === "archived" && !restoredQuizIds.includes(id),
  );

  async function confirmRestore(gameId: string) {
    if (!user) {
      return;
    }

    setProcessingRoomId(gameId);
    setErrorMessage("");

    try {
      await restoreWaitingRoom(user, { gameId, action: "restore-room" });
      navigate("/admin");
    } catch (error) {
      console.error("Erro ao restaurar sala:", error);
      setErrorMessage(
        error instanceof WaitingRoomRequestError
          ? error.message
          : "Não foi possível restaurar a sala.",
      );
      setProcessingRoomId(null);
    }
  }

  async function confirmDelete(gameId: string) {
    if (!user) {
      return;
    }

    setProcessingRoomId(gameId);
    setErrorMessage("");

    try {
      await deleteArchivedWaitingRoom(user, {
        gameId,
        action: "delete-room",
      });
      setDeletedRoomIds((roomIds) => [...roomIds, gameId]);
      setPendingAction(null);
      setRefreshRevision((revision) => revision + 1);
    } catch (error) {
      console.error("Erro ao excluir sala arquivada:", error);
      setErrorMessage(
        error instanceof WaitingRoomRequestError
          ? error.message
          : "Não foi possível excluir a sala.",
      );
    } finally {
      setProcessingRoomId(null);
    }
  }

  async function confirmQuizRestore(quizId: string) {
    if (!user) {
      return;
    }

    setProcessingQuizId(quizId);
    setErrorMessage("");

    try {
      await changeQuizDraftStatus(user, {
        quizId,
        action: "restore-quiz",
      });
      setRestoredQuizIds((quizIds) => [...quizIds, quizId]);
      setQuizRefreshRevision((revision) => revision + 1);
    } catch (error) {
      console.error("Erro ao restaurar quiz:", error);
      setErrorMessage(
        error instanceof QuizLibraryRequestError
          ? error.message
          : "Não foi possível restaurar o quiz.",
      );
    } finally {
      setProcessingQuizId(null);
    }
  }

  return (
    <main className="page management-page">
      <section className="card management-library-card">
        <header className="management-header">
          <div>
            <span className="eyebrow">Arquivo</span>
            <h1>Salas e quizzes arquivados</h1>
            <p>Recupere conteúdos e salas para utilizá-los novamente.</p>
          </div>
        </header>

        {errorMessage && (
          <div className="test-result test-result-error" role="alert">
            <strong>Não foi possível concluir a ação</strong>
            <p>{errorMessage}</p>
          </div>
        )}

        <section
          className="room-library"
          aria-labelledby="archived-rooms-title"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">Salas</span>
              <h2 id="archived-rooms-title">Salas arquivadas</h2>
            </div>
            <span>{rooms.length} sala(s)</span>
          </div>

          {roomLibrary.loading && (
            <p role="status">Carregando salas arquivadas...</p>
          )}

          {roomLibrary.error && (
            <div className="test-result test-result-error" role="alert">
              <strong>Não foi possível carregar as salas</strong>
              <p>{roomLibrary.error}</p>
            </div>
          )}

          {!roomLibrary.loading && !roomLibrary.error && rooms.length === 0 && (
            <div className="empty-library">
              <strong>Nenhuma sala arquivada</strong>
              <p>As salas arquivadas aparecerão nesta página.</p>
            </div>
          )}

          {rooms.length > 0 && (
            <ul className="room-library-list">
              {rooms.map((room) => (
                <li key={room.id}>
                  <div className="room-library-summary">
                    <span className="room-status room-status-archived">
                      Arquivada
                    </span>
                    <strong className="room-library-name">{room.name}</strong>
                    <code>{room.id}</code>
                    <small>
                      Arquivada em {formatArchivedAt(room.archivedAt)} ·{" "}
                      {room.participantCount} participante(s)
                    </small>
                  </div>

                  <div className="room-library-actions">
                    <button
                      type="button"
                      className="primary-button compact-button"
                      onClick={() =>
                        setPendingAction({ gameId: room.id, action: "restore" })
                      }
                    >
                      Restaurar
                    </button>
                    <button
                      type="button"
                      className="danger-button compact-button"
                      onClick={() =>
                        setPendingAction({ gameId: room.id, action: "delete" })
                      }
                    >
                      Excluir
                    </button>

                    {pendingAction?.gameId === room.id && (
                      <div className="room-closure-confirmation">
                        <span>
                          {pendingAction.action === "restore"
                            ? "Restaurar devolve a sala à biblioteca sem participantes conectados."
                            : "Excluir remove definitivamente esta sala do banco de dados."}
                        </span>
                        <div>
                          <button
                            type="button"
                            className={
                              pendingAction.action === "delete"
                                ? "danger-button compact-button"
                                : "primary-button compact-button"
                            }
                            disabled={processingRoomId === room.id}
                            onClick={() =>
                              pendingAction.action === "restore"
                                ? void confirmRestore(room.id)
                                : void confirmDelete(room.id)
                            }
                          >
                            {processingRoomId === room.id
                              ? "Processando..."
                              : pendingAction.action === "restore"
                                ? "Confirmar restauração"
                                : "Confirmar exclusão"}
                          </button>
                          <button
                            type="button"
                            className="secondary-button compact-button"
                            disabled={processingRoomId === room.id}
                            onClick={() => setPendingAction(null)}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          className="room-library"
          aria-labelledby="archived-quizzes-title"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">Conteúdo</span>
              <h2 id="archived-quizzes-title">Quizzes arquivados</h2>
            </div>
            <span>{quizzes.length} quiz(zes)</span>
          </div>

          {quizLibrary.loading && (
            <p role="status">Carregando quizzes arquivados...</p>
          )}

          {quizLibrary.error && (
            <div className="test-result test-result-error" role="alert">
              <strong>Não foi possível carregar os quizzes</strong>
              <p>{quizLibrary.error}</p>
            </div>
          )}

          {!quizLibrary.loading &&
            !quizLibrary.error &&
            quizzes.length === 0 && (
              <div className="empty-library">
                <strong>Nenhum quiz arquivado</strong>
                <p>Os quizzes arquivados aparecerão nesta página.</p>
              </div>
            )}

          {quizzes.length > 0 && (
            <ul className="room-library-list quiz-library-list">
              {quizzes.map((quiz) => (
                <li key={quiz.id}>
                  <div className="room-library-summary">
                    <span className="room-status room-status-archived">
                      Arquivado
                    </span>
                    <strong className="room-library-name">{quiz.title}</strong>
                    {quiz.description && <p>{quiz.description}</p>}
                    <small>
                      Arquivado em {formatArchivedAt(quiz.updatedAt)} ·{" "}
                      {quiz.questionCount} pergunta(s)
                    </small>
                  </div>
                  <div className="room-library-actions">
                    <TemporaryConfirmButton
                      className="primary-button compact-button"
                      idleLabel="Restaurar"
                      confirmLabel="Confirmar restauração?"
                      disabled={processingQuizId === quiz.id}
                      onConfirm={() => confirmQuizRestore(quiz.id)}
                    />
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
