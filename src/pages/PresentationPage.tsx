import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/auth-context";
import { useRemainingPhaseSeconds } from "../features/live-game/phase-timing";
import { usePublicWaitingRoom } from "../features/live-game/use-public-waiting-room";
import {
  advanceWaitingRoomGame,
  presentWaitingRoom,
  WaitingRoomRequestError,
} from "../features/live-game/waiting-room";
import type { PublicWaitingRoom } from "../shared/waiting-room";
import { waitingRoomCodeSchema } from "../shared/waiting-room";

function QuestionProgress({ room }: { room: PublicWaitingRoom }) {
  if (!room.questionNumber || !room.totalQuestions) {
    return null;
  }

  return (
    <span className="question-progress">
      Pergunta {room.questionNumber} de {room.totalQuestions}
    </span>
  );
}

function getGameControlLabel(room: PublicWaitingRoom): string | null {
  switch (room.phase) {
    case "waiting":
      return "Iniciar quiz";
    case "question":
      return "Revelar resposta";
    case "revealing":
      return room.questionNumber === room.totalQuestions
        ? "Finalizar quiz"
        : "Próxima pergunta";
    default:
      return null;
  }
}

function PresentationPhase({ room }: { room: PublicWaitingRoom }) {
  const remainingSeconds = useRemainingPhaseSeconds(room.phaseTiming);

  if (room.phase === "waiting") {
    return (
      <>
        <div className="session-status" role="status">
          <strong>Aguardando participantes</strong>
          <span>{room.participantCount} participante(s) na sala</span>
        </div>

        <section
          className="presentation-participants"
          aria-labelledby="presentation-participants-title"
        >
          <h2 id="presentation-participants-title">Participantes</h2>
          {(room.participants?.length ?? 0) === 0 ? (
            <p>Aguardando a entrada dos participantes.</p>
          ) : (
            <ul>
              {room.participants?.map((participant, index) => (
                <li key={`${participant.nickname}-${index}`}>
                  <span className="presentation-avatar" aria-hidden="true">
                    {participant.avatar}
                  </span>
                  <strong>{participant.nickname}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </>
    );
  }

  if (room.phase === "countdown") {
    return (
      <section className="presentation-game-state" aria-live="polite">
        <QuestionProgress room={room} />
        <span
          className="presentation-countdown"
          aria-label="Contagem regressiva"
        >
          {remainingSeconds ?? 0}
        </span>
        <h2>Prepare-se!</h2>
      </section>
    );
  }

  if (room.phase === "question" && room.currentQuestion) {
    return (
      <section className="presentation-game-state" aria-live="polite">
        <div className="presentation-question-heading">
          <QuestionProgress room={room} />
          <div className="presentation-question-metrics">
            <span className="question-points">
              {room.currentQuestion.points} pontos
            </span>
            <span className="question-timer" aria-label="Tempo restante">
              {remainingSeconds ?? 0}s
            </span>
          </div>
        </div>
        <h2 className="presentation-question-prompt">
          {room.currentQuestion.prompt}
        </h2>
        <p>Escolha a alternativa no seu dispositivo.</p>
      </section>
    );
  }

  if (room.phase === "revealing" && room.currentQuestion) {
    const correctOptions = room.currentQuestion.options.filter(({ id }) =>
      room.revealedCorrectOptionIds?.includes(id),
    );

    return (
      <section className="presentation-game-state" aria-live="polite">
        <QuestionProgress room={room} />
        <h2 className="presentation-question-prompt">
          {room.currentQuestion.prompt}
        </h2>
        <div className="presentation-correct-answer">
          <span>Resposta correta</span>
          <strong>
            {correctOptions.map(({ label }) => label).join(", ") ||
              "Resposta indisponível"}
          </strong>
        </div>
      </section>
    );
  }

  if (room.phase === "finished") {
    return (
      <section className="presentation-game-state" aria-live="polite">
        <span className="eyebrow">Fim da apresentação</span>
        <h2>Quiz concluído!</h2>
        <p>A partida foi finalizada.</p>
      </section>
    );
  }

  return (
    <section className="presentation-game-state" aria-live="polite">
      <h2>Próxima fase em preparação</h2>
      <p>O controle ao vivo indicará quando continuar.</p>
    </section>
  );
}

export function PresentationPage() {
  const [searchParams] = useSearchParams();
  const { user, isAdministrator } = useAuth();
  const [advancingGame, setAdvancingGame] = useState(false);
  const [resumingPresentation, setResumingPresentation] = useState(false);
  const [controlError, setControlError] = useState("");
  const [roomOverride, setRoomOverride] = useState<PublicWaitingRoom | null>(
    null,
  );
  const [presentationStatusOverride, setPresentationStatusOverride] = useState<
    "inactive" | "active" | null
  >(null);
  const gameIdResult = waitingRoomCodeSchema.safeParse(
    searchParams.get("room") ?? searchParams.get("sala") ?? "",
  );
  const gameId = gameIdResult.success ? gameIdResult.data : "";
  const roomState = usePublicWaitingRoom(gameId);
  const synchronizedRoom = roomState.room;
  const room =
    roomOverride && synchronizedRoom?.phase !== roomOverride.phase
      ? roomOverride
      : synchronizedRoom;
  const presentationStatus =
    presentationStatusOverride ?? room?.presentationStatus ?? "inactive";
  const canControlGame = Boolean(user && isAdministrator);

  const handleAdvanceGame = useCallback(async () => {
    if (!user || !isAdministrator || !gameId) {
      return;
    }

    setAdvancingGame(true);
    setControlError("");

    try {
      const updatedRoom = await advanceWaitingRoomGame(user, {
        gameId,
        action: "advance-game",
      });
      setRoomOverride(updatedRoom);
      setPresentationStatusOverride(updatedRoom.presentationStatus ?? null);
    } catch (error) {
      console.error("Erro ao controlar quiz pela apresentação:", error);
      setControlError(
        error instanceof WaitingRoomRequestError
          ? error.message
          : "Não foi possível avançar o quiz.",
      );
    } finally {
      setAdvancingGame(false);
    }
  }, [gameId, isAdministrator, user]);

  useEffect(() => {
    if (!canControlGame || !room?.phaseTiming || room.phase !== "countdown") {
      return;
    }

    const phaseEndsAt =
      room.phaseTiming.startedAt + room.phaseTiming.durationMs;
    const timeoutId = globalThis.setTimeout(
      () => {
        void handleAdvanceGame();
      },
      Math.max(0, phaseEndsAt - Date.now()),
    );

    return () => globalThis.clearTimeout(timeoutId);
  }, [canControlGame, handleAdvanceGame, room]);

  async function handleResumePresentation() {
    if (!user || !isAdministrator || !gameId) {
      return;
    }

    setResumingPresentation(true);
    setControlError("");

    try {
      const updatedRoom = await presentWaitingRoom(user, {
        gameId,
        action: "present-room",
      });
      setRoomOverride(updatedRoom);
      setPresentationStatusOverride("active");
    } catch (error) {
      console.error("Erro ao retomar apresentação:", error);
      setControlError(
        error instanceof WaitingRoomRequestError
          ? error.message
          : "Não foi possível retomar a apresentação.",
      );
    } finally {
      setResumingPresentation(false);
    }
  }

  const controlLabel = room ? getGameControlLabel(room) : null;
  const paused = Boolean(
    room && room.phase !== "waiting" && presentationStatus === "inactive",
  );

  return (
    <main className="page presentation-page">
      <section className="card presentation-card">
        <span className="eyebrow">Apresentação</span>

        {!gameId && (
          <>
            <h1>Nenhuma sala selecionada</h1>
            <p>Abra uma apresentação pelo Painel de Controle.</p>
          </>
        )}

        {gameId && roomState.loading && (
          <div role="status">
            <h1>Preparando a apresentação...</h1>
            <p>Carregando a sala {gameId}.</p>
          </div>
        )}

        {gameId && !roomState.loading && !room && (
          <>
            <h1>Sala indisponível</h1>
            <p>Esta sala foi arquivada, excluída ou não existe mais.</p>
          </>
        )}

        {room && (
          <>
            <header className="presentation-room-header">
              <div>
                <h1>{room.name ?? `Sala ${room.id}`}</h1>
                {room.quizTitle && <span>{room.quizTitle}</span>}
              </div>
              <div className="presentation-room-code">
                <span>Código</span>
                <strong>{room.id}</strong>
              </div>
            </header>

            {!paused && canControlGame && controlLabel && (
              <section
                className="presentation-live-control"
                aria-label="Controle da partida"
              >
                <span>Controle ao vivo</span>
                <button
                  type="button"
                  className="primary-button"
                  disabled={
                    advancingGame || (room.phase === "waiting" && !room.quizId)
                  }
                  onClick={() => void handleAdvanceGame()}
                >
                  {advancingGame ? "Avançando..." : controlLabel}
                </button>
              </section>
            )}

            {!paused && canControlGame && room.phase === "countdown" && (
              <div className="presentation-auto-control" role="status">
                A primeira pergunta será exibida automaticamente.
              </div>
            )}

            {paused ? (
              <div className="presentation-paused" role="status">
                <strong>Apresentação encerrada</strong>
                <span>A partida permanece salva na fase atual.</span>
                {canControlGame && (
                  <button
                    type="button"
                    className="primary-button"
                    disabled={resumingPresentation}
                    onClick={() => void handleResumePresentation()}
                  >
                    {resumingPresentation
                      ? "Retomando..."
                      : "Retomar apresentação"}
                  </button>
                )}
              </div>
            ) : (
              <PresentationPhase room={room} />
            )}
          </>
        )}

        {controlError && (
          <div className="test-result test-result-error" role="alert">
            <strong>Falha no controle ao vivo</strong>
            <p>{controlError}</p>
            {room?.phase === "countdown" && (
              <button
                type="button"
                className="secondary-button"
                disabled={advancingGame}
                onClick={() => void handleAdvanceGame()}
              >
                Exibir pergunta agora
              </button>
            )}
          </div>
        )}

        <nav className="navigation">
          {canControlGame && gameId && (
            <Link to={`/admin/room/${gameId}`}>Voltar ao gerenciamento</Link>
          )}
          <Link to="/">Sair da apresentação</Link>
        </nav>
      </section>
    </main>
  );
}
