import { Link, useSearchParams } from "react-router-dom";
import { useRemainingPhaseSeconds } from "../features/live-game/phase-timing";
import { usePublicWaitingRoom } from "../features/live-game/use-public-waiting-room";
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
          <span className="question-timer" aria-label="Tempo restante">
            {remainingSeconds ?? 0}s
          </span>
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
        <p>As respostas e a pontuação serão adicionadas no próximo marco.</p>
      </section>
    );
  }

  return (
    <section className="presentation-game-state" aria-live="polite">
      <h2>Próxima fase em preparação</h2>
      <p>O painel de controle indicará quando continuar.</p>
    </section>
  );
}

export function PresentationPage() {
  const [searchParams] = useSearchParams();
  const gameIdResult = waitingRoomCodeSchema.safeParse(
    searchParams.get("room") ?? searchParams.get("sala") ?? "",
  );
  const gameId = gameIdResult.success ? gameIdResult.data : "";
  const roomState = usePublicWaitingRoom(gameId);

  return (
    <main className="page presentation-page">
      <section className="card presentation-card">
        <span className="eyebrow">Apresentação</span>

        {!gameId && (
          <>
            <h1>Nenhuma sala selecionada</h1>
            <p>Escolha “Apresentar” na biblioteca administrativa.</p>
          </>
        )}

        {gameId && roomState.loading && (
          <div role="status">
            <h1>Preparando a apresentação...</h1>
            <p>Carregando a sala {gameId}.</p>
          </div>
        )}

        {gameId && !roomState.loading && !roomState.room && (
          <>
            <h1>Sala indisponível</h1>
            <p>Esta sala foi arquivada, excluída ou não existe mais.</p>
          </>
        )}

        {roomState.room && (
          <>
            <header className="presentation-room-header">
              <div>
                <h1>{roomState.room.name ?? `Sala ${roomState.room.id}`}</h1>
                {roomState.room.quizTitle && (
                  <span>{roomState.room.quizTitle}</span>
                )}
              </div>
              <div className="presentation-room-code">
                <span>Código</span>
                <strong>{roomState.room.id}</strong>
              </div>
            </header>

            {(roomState.room.presentationStatus ?? "inactive") === "active" ? (
              <PresentationPhase room={roomState.room} />
            ) : (
              <div className="test-result test-result-error" role="status">
                <strong>Apresentação inativa</strong>
                <p>Use “Apresentar” no gerenciamento para ativá-la.</p>
              </div>
            )}
          </>
        )}

        <nav className="navigation">
          <Link to="/admin">Voltar às salas</Link>
          <Link to="/">Página inicial</Link>
        </nav>
      </section>
    </main>
  );
}
