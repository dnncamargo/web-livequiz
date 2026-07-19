import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { TemporaryConfirmButton } from "../components/TemporaryConfirmButton";
import { useAuth } from "../contexts/auth-context";
import { useManagedWaitingRoom } from "../features/live-game/use-managed-waiting-room";
import { usePublicWaitingRoom } from "../features/live-game/use-public-waiting-room";
import {
  advanceWaitingRoomGame,
  associateWaitingRoomQuiz,
  archiveWaitingRoom,
  endWaitingRoom,
  presentWaitingRoom,
  removeWaitingRoomParticipant,
  WaitingRoomRequestError,
} from "../features/live-game/waiting-room";
import { useQuizLibrary } from "../features/quizzes/use-quiz-library";
import type { LiveGamePhase } from "../shared/game-types";
import type { PublicWaitingRoom } from "../shared/waiting-room";

const MODERATION_LABELS = {
  "waiting-approval": "Pronto",
  approved: "Aprovado",
  removed: "Removido",
} as const;

const GAME_PHASE_LABELS: Record<LiveGamePhase, string> = {
  waiting: "Aguardando participantes",
  countdown: "Contagem regressiva",
  question: "Pergunta em andamento",
  revealing: "Resposta revelada",
  ranking: "Ranking",
  podium: "Pódio",
  finished: "Finalizada",
};

function getAdvanceGameLabel(room: PublicWaitingRoom): string {
  switch (room.phase) {
    case "waiting":
      return "Iniciar quiz";
    case "countdown":
      return "Exibir pergunta";
    case "question":
      return "Revelar resposta";
    case "revealing":
      return room.questionNumber === room.totalQuestions
        ? "Finalizar quiz"
        : "Próxima pergunta";
    case "finished":
      return "Quiz finalizado";
    default:
      return "Avançar quiz";
  }
}

export function WaitingRoomPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [removingParticipantId, setRemovingParticipantId] = useState<
    string | null
  >(null);
  const [participantActionError, setParticipantActionError] = useState("");
  const [roomActionError, setRoomActionError] = useState("");
  const [confirmingRoomClosure, setConfirmingRoomClosure] = useState(false);
  const [endingRoom, setEndingRoom] = useState(false);
  const [processingRoom, setProcessingRoom] = useState(false);
  const [presentationStatusOverride, setPresentationStatusOverride] = useState<
    "inactive" | "active" | null
  >(null);
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [quizSelection, setQuizSelection] = useState<string | null>(null);
  const [quizAssociationOverride, setQuizAssociationOverride] = useState<{
    quizId?: string;
    quizTitle?: string;
  } | null>(null);
  const [associatingQuiz, setAssociatingQuiz] = useState(false);
  const [advancingGame, setAdvancingGame] = useState(false);
  const [gameStateOverride, setGameStateOverride] =
    useState<PublicWaitingRoom | null>(null);
  const publicRoomState = usePublicWaitingRoom(id);
  const managedRoomState = useManagedWaitingRoom(
    user,
    id,
    `${publicRoomState.room?.phase ?? "missing"}:${publicRoomState.room?.participantCount ?? 0}:${refreshRevision}`,
  );
  const synchronizedRoom =
    publicRoomState.room ?? managedRoomState.waitingRoom?.room;
  const room =
    gameStateOverride && synchronizedRoom?.phase !== gameStateOverride.phase
      ? gameStateOverride
      : synchronizedRoom;
  const quizLibrary = useQuizLibrary(user);
  const publishedQuizzes = quizLibrary.quizzes.filter(
    ({ status }) => status === "published",
  );
  const participants = useMemo(
    () =>
      [...(managedRoomState.waitingRoom?.participants ?? [])].sort(
        (left, right) => {
          const presenceDifference =
            Number(left.presenceStatus !== "connected") -
            Number(right.presenceStatus !== "connected");

          return (
            presenceDifference ||
            left.nickname.localeCompare(right.nickname, "pt-BR", {
              sensitivity: "base",
            })
          );
        },
      ),
    [managedRoomState.waitingRoom?.participants],
  );
  const loading = publicRoomState.loading && managedRoomState.loading;
  const error = publicRoomState.error ?? managedRoomState.error;
  const presentationStatus =
    presentationStatusOverride ?? room?.presentationStatus ?? "inactive";
  const associatedQuizId = quizAssociationOverride
    ? (quizAssociationOverride.quizId ?? "")
    : (room?.quizId ?? "");
  const associatedQuizTitle = quizAssociationOverride
    ? quizAssociationOverride.quizTitle
    : room?.quizTitle;
  const selectedQuizId = quizSelection ?? associatedQuizId;
  const canAdvanceGame = Boolean(
    room &&
    ["waiting", "countdown", "question", "revealing"].includes(room.phase),
  );

  async function confirmParticipantRemoval(participantId: string) {
    if (!user) {
      return;
    }

    setRemovingParticipantId(participantId);
    setParticipantActionError("");

    try {
      await removeWaitingRoomParticipant(user, {
        gameId: id,
        participantId,
        action: "remove",
      });
      setRefreshRevision((revision) => revision + 1);
    } catch (error) {
      console.error("Erro ao remover participante:", error);
      setParticipantActionError(
        error instanceof WaitingRoomRequestError
          ? error.message
          : "Não foi possível remover o participante. Tente novamente.",
      );
    } finally {
      setRemovingParticipantId(null);
    }
  }

  async function confirmRoomClosure() {
    if (!user) {
      return;
    }

    setEndingRoom(true);
    setRoomActionError("");

    try {
      await endWaitingRoom(user, { gameId: id, action: "end-room" });
      setPresentationStatusOverride("inactive");
      setConfirmingRoomClosure(false);
      setRefreshRevision((revision) => revision + 1);
    } catch (error) {
      console.error("Erro ao encerrar apresentação:", error);
      setRoomActionError(
        error instanceof WaitingRoomRequestError
          ? error.message
          : "Não foi possível encerrar a apresentação. Tente novamente.",
      );
    } finally {
      setEndingRoom(false);
    }
  }

  async function handlePresentRoom() {
    if (!user) {
      return;
    }

    setProcessingRoom(true);
    setRoomActionError("");

    try {
      await presentWaitingRoom(user, { gameId: id, action: "present-room" });
      setPresentationStatusOverride("active");
      navigate(`/?room=${id}`);
    } catch (error) {
      console.error("Erro ao apresentar sala:", error);
      setRoomActionError(
        error instanceof WaitingRoomRequestError
          ? error.message
          : "Não foi possível iniciar a apresentação.",
      );
      setProcessingRoom(false);
    }
  }

  async function handleArchiveRoom() {
    if (!user) {
      return;
    }

    setProcessingRoom(true);
    setRoomActionError("");

    try {
      await archiveWaitingRoom(user, { gameId: id, action: "archive-room" });
      navigate("/admin");
    } catch (error) {
      console.error("Erro ao arquivar sala:", error);
      setRoomActionError(
        error instanceof WaitingRoomRequestError
          ? error.message
          : "Não foi possível arquivar a sala.",
      );
      setProcessingRoom(false);
    }
  }

  async function handleQuizAssociation() {
    if (!user) {
      return;
    }

    setAssociatingQuiz(true);
    setRoomActionError("");

    try {
      const updatedRoom = await associateWaitingRoomQuiz(user, {
        gameId: id,
        action: "associate-quiz",
        quizId: selectedQuizId || null,
      });
      const nextQuizId = updatedRoom.quizId ?? "";

      setQuizAssociationOverride({
        ...(updatedRoom.quizId ? { quizId: updatedRoom.quizId } : {}),
        ...(updatedRoom.quizTitle ? { quizTitle: updatedRoom.quizTitle } : {}),
      });
      setQuizSelection(nextQuizId);
      setRefreshRevision((revision) => revision + 1);
    } catch (error) {
      console.error("Erro ao associar quiz à sala:", error);
      setRoomActionError(
        error instanceof WaitingRoomRequestError
          ? error.message
          : "Não foi possível associar o quiz à sala.",
      );
    } finally {
      setAssociatingQuiz(false);
    }
  }

  async function handleAdvanceGame() {
    if (!user || !room) {
      return;
    }

    setAdvancingGame(true);
    setRoomActionError("");

    try {
      const updatedRoom = await advanceWaitingRoomGame(user, {
        gameId: id,
        action: "advance-game",
      });

      setGameStateOverride(updatedRoom);
      setPresentationStatusOverride(updatedRoom.presentationStatus ?? null);
      setRefreshRevision((revision) => revision + 1);
    } catch (error) {
      console.error("Erro ao avançar quiz:", error);
      setRoomActionError(
        error instanceof WaitingRoomRequestError
          ? error.message
          : "Não foi possível avançar o quiz. Tente novamente.",
      );
    } finally {
      setAdvancingGame(false);
    }
  }

  if (loading) {
    return (
      <main className="page" aria-busy="true">
        <section className="card" role="status" aria-live="polite">
          <span className="eyebrow">Sala de espera</span>
          <h1>Carregando...</h1>
          <p>Recuperando a sala e seus participantes.</p>
        </section>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="page">
        <section className="card">
          <span className="eyebrow">Sala de espera</span>
          <h1>Sala indisponível</h1>
          <div className="test-result test-result-error" role="alert">
            <strong>Não foi possível abrir esta sala</strong>
            <p>{error ?? "A sala não existe ou já foi encerrada."}</p>
          </div>
          <Link to="/admin">Voltar ao gerenciamento</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page waiting-room-page">
      <div className="room-control-layout">
        <section className="card waiting-room-card room-control-main">
          <span className="eyebrow">Gerenciamento da sala</span>
          <h1>{room.name ?? `Sala ${room.id}`}</h1>
          {associatedQuizTitle && <p>Quiz associado: {associatedQuizTitle}</p>}

          <div className="room-code-panel">
            <span>Código da sala</span>
            <strong className="room-code" aria-label={`Código ${room.id}`}>
              {room.id}
            </strong>
          </div>

          <div className="room-summary" aria-label="Resumo da sala">
            <div>
              <span>Fase</span>
              <strong>{GAME_PHASE_LABELS[room.phase]}</strong>
            </div>
            <div>
              <span>Apresentação</span>
              <strong>
                {presentationStatus === "active" ? "Ativa" : "Inativa"}
              </strong>
            </div>
            <div>
              <span>Participantes</span>
              <strong>
                {managedRoomState.waitingRoom?.room.participantCount ??
                  room.participantCount}
              </strong>
            </div>
          </div>

          {room.questionNumber && room.totalQuestions && (
            <div className="room-question-status" aria-live="polite">
              <span>
                Pergunta {room.questionNumber} de {room.totalQuestions}
              </span>
              {room.currentQuestion && (
                <strong>{room.currentQuestion.prompt}</strong>
              )}
            </div>
          )}
        </section>

        <section
          className="waiting-participants"
          aria-labelledby="participants-title"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">Entrada em tempo real</span>
              <h2 id="participants-title">Participantes</h2>
            </div>
            {managedRoomState.loading && (
              <span role="status">Atualizando...</span>
            )}
          </div>

          {managedRoomState.error && (
            <div className="test-result test-result-error" role="alert">
              <strong>Não foi possível atualizar os participantes</strong>
              <p>{managedRoomState.error}</p>
            </div>
          )}

          {participantActionError && (
            <div className="test-result test-result-error" role="alert">
              <strong>Não foi possível concluir a ação</strong>
              <p>{participantActionError}</p>
            </div>
          )}

          {!managedRoomState.loading &&
            !managedRoomState.error &&
            participants.length === 0 && (
              <p>Nenhum participante entrou nesta sala ainda.</p>
            )}

          {participants.length > 0 && (
            <ul className="participant-list">
              {participants.map((participant) => (
                <li
                  key={participant.participantId}
                  className={`participant-${participant.presenceStatus}`}
                >
                  <div>
                    <strong>{participant.nickname}</strong>
                    <span>
                      {MODERATION_LABELS[participant.moderationStatus]}
                    </span>
                  </div>
                  <div className="participant-list-actions">
                    {room?.phase === "waiting" &&
                      participant.moderationStatus !== "removed" &&
                      (removingParticipantId === participant.participantId ? (
                        <button
                          type="button"
                          className="danger-button compact-button"
                          disabled
                        >
                          Removendo...
                        </button>
                      ) : (
                        <TemporaryConfirmButton
                          className="danger-button compact-button"
                          idleLabel="Remover"
                          onConfirm={() =>
                            confirmParticipantRemoval(participant.participantId)
                          }
                        />
                      ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card room-lifecycle-card">
          <section
            className="room-danger-zone"
            aria-labelledby="room-actions-title"
          >
            <div className="room-actions-heading">
              <strong id="room-actions-title">Ações da sala</strong>
            </div>

            <div className="room-quiz-association">
              <label htmlFor="room-quiz">Quiz associado</label>
              <select
                id="room-quiz"
                value={selectedQuizId}
                disabled={
                  quizLibrary.loading ||
                  associatingQuiz ||
                  room.phase !== "waiting"
                }
                onChange={(event) => setQuizSelection(event.target.value)}
              >
                <option value="">Sem quiz associado</option>
                {associatedQuizId &&
                  !publishedQuizzes.some(
                    ({ id: quizId }) => quizId === associatedQuizId,
                  ) && (
                    <option value={associatedQuizId} disabled>
                      {associatedQuizTitle ?? "Quiz indisponível"}
                    </option>
                  )}
                {publishedQuizzes.map((quiz) => (
                  <option key={quiz.id} value={quiz.id}>
                    {quiz.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="secondary-button compact-button"
                disabled={
                  quizLibrary.loading ||
                  associatingQuiz ||
                  room.phase !== "waiting" ||
                  selectedQuizId === associatedQuizId
                }
                onClick={() => void handleQuizAssociation()}
              >
                {associatingQuiz ? "Salvando..." : "Salvar associação"}
              </button>
            </div>

            {quizLibrary.error && (
              <span className="room-action-message" role="alert">
                {quizLibrary.error}
              </span>
            )}

            {roomActionError && (
              <span className="room-action-message" role="alert">
                {roomActionError}
              </span>
            )}

            <div className="room-lifecycle-actions">
              <button
                type="button"
                className="primary-button compact-button"
                disabled={
                  advancingGame ||
                  !canAdvanceGame ||
                  (room.phase === "waiting" && !associatedQuizId)
                }
                onClick={() => void handleAdvanceGame()}
              >
                {advancingGame ? "Avançando..." : getAdvanceGameLabel(room)}
              </button>

              <button
                type="button"
                className="secondary-button compact-button"
                disabled={processingRoom}
                onClick={() => void handlePresentRoom()}
              >
                {processingRoom ? "Processando..." : "Apresentar"}
              </button>

              {presentationStatus === "active" && !confirmingRoomClosure && (
                <button
                  type="button"
                  className="danger-button compact-button"
                  onClick={() => setConfirmingRoomClosure(true)}
                >
                  Encerrar
                </button>
              )}

              <button
                type="button"
                className="secondary-button compact-button"
                disabled={processingRoom}
                onClick={() => void handleArchiveRoom()}
              >
                Arquivar
              </button>
            </div>

            {confirmingRoomClosure && (
              <div className="room-closure-confirmation">
                <span>
                  A apresentação será finalizada; a sala continuará aguardando
                  participantes.
                </span>
                <div>
                  <button
                    type="button"
                    className="danger-button compact-button"
                    disabled={endingRoom}
                    onClick={() => void confirmRoomClosure()}
                  >
                    {endingRoom ? "Encerrando..." : "Confirmar encerramento"}
                  </button>
                  <button
                    type="button"
                    className="secondary-button compact-button"
                    disabled={endingRoom}
                    onClick={() => setConfirmingRoomClosure(false)}
                  >
                    Manter apresentação
                  </button>
                </div>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
