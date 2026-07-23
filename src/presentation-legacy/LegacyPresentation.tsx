import { useEffect, useState } from "react";
import { useRemainingPhaseSeconds } from "../features/live-game/phase-timing";
import type {
  PublicRankingEntry,
  PublicWaitingRoom,
} from "../shared/waiting-room";
import {
  getLegacyPresentationGameId,
  subscribeToLegacyPublicGame,
} from "./legacy-public-game";

interface LegacyPublicGameState {
  room: PublicWaitingRoom | null;
  loading: boolean;
  error: string | null;
}

function LegacyQuestionProgress({ room }: { room: PublicWaitingRoom }) {
  if (!room.questionNumber || !room.totalQuestions) {
    return null;
  }

  return (
    <span className="legacy-question-progress">
      Pergunta {room.questionNumber} de {room.totalQuestions}
    </span>
  );
}

function LegacyRanking({ entries }: { entries: PublicRankingEntry[] }) {
  if (entries.length === 0) {
    return <p>Nenhum participante pontuou.</p>;
  }

  return (
    <ol className="legacy-ranking">
      {entries.map((entry, index) => (
        <li key={`${entry.nickname}-${index}`}>
          <strong>{entry.position}º</strong>
          <span className="legacy-ranking-avatar" aria-hidden="true">
            {entry.avatar}
          </span>
          <span>{entry.nickname}</span>
          <strong>{entry.score} pontos</strong>
        </li>
      ))}
    </ol>
  );
}

export function LegacyPresentationPhase({ room }: { room: PublicWaitingRoom }) {
  const remainingSeconds = useRemainingPhaseSeconds(room.phaseTiming);

  if (room.phase === "waiting") {
    return (
      <section className="legacy-phase" aria-live="polite">
        <h2>Aguardando participantes</h2>
        <p>{room.participantCount} participante(s) na sala</p>
        {(room.participants?.length ?? 0) > 0 && (
          <ul className="legacy-participants">
            {room.participants?.map((participant, index) => (
              <li key={`${participant.nickname}-${index}`}>
                <span aria-hidden="true">{participant.avatar}</span>
                <strong>{participant.nickname}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  if (room.phase === "countdown") {
    return (
      <section className="legacy-phase legacy-countdown" aria-live="polite">
        <LegacyQuestionProgress room={room} />
        <strong aria-label="Contagem regressiva">
          {remainingSeconds ?? 0}
        </strong>
        <h2>Prepare-se!</h2>
      </section>
    );
  }

  if (room.phase === "question" && room.currentQuestion) {
    return (
      <section className="legacy-phase" aria-live="polite">
        <header className="legacy-question-header">
          <LegacyQuestionProgress room={room} />
          <strong aria-label="Tempo restante">{remainingSeconds ?? 0}s</strong>
        </header>
        <h2>{room.currentQuestion.prompt}</h2>
        <p>Escolha a alternativa no seu dispositivo.</p>
      </section>
    );
  }

  if (room.phase === "revealing" && room.currentQuestion) {
    const correctAnswers = room.currentQuestion.options
      .filter(({ id }) => room.revealedCorrectOptionIds?.includes(id))
      .map(({ label }) => label);

    return (
      <section className="legacy-phase" aria-live="polite">
        <LegacyQuestionProgress room={room} />
        <h2>{room.currentQuestion.prompt}</h2>
        <div className="legacy-correct-answer">
          <span>Resposta correta</span>
          <strong>
            {correctAnswers.join(", ") || "Resposta indisponível"}
          </strong>
        </div>
      </section>
    );
  }

  if (room.phase === "ranking") {
    return (
      <section className="legacy-phase" aria-live="polite">
        <LegacyQuestionProgress room={room} />
        <h2>Ranking</h2>
        <LegacyRanking entries={room.ranking ?? []} />
      </section>
    );
  }

  if (room.phase === "podium") {
    return (
      <section className="legacy-phase" aria-live="polite">
        <span className="legacy-eyebrow">Resultado final</span>
        <h2>Pódio</h2>
        <LegacyRanking entries={room.podium ?? []} />
      </section>
    );
  }

  return (
    <section className="legacy-phase" aria-live="polite">
      <span className="legacy-eyebrow">Fim da apresentação</span>
      <h2>Quiz concluído!</h2>
      <p>A partida foi finalizada.</p>
    </section>
  );
}

export function LegacyPresentationView({ room }: { room: PublicWaitingRoom }) {
  return (
    <main className="legacy-page">
      <section className="legacy-card">
        <header className="legacy-room-header">
          <div>
            <span className="legacy-eyebrow">Apresentação compatível</span>
            <h1>{room.name ?? `Sala ${room.id}`}</h1>
            {room.quizTitle && <p>{room.quizTitle}</p>}
          </div>
          <div className="legacy-room-code">
            <span>Código</span>
            <strong>{room.id}</strong>
          </div>
        </header>
        <LegacyPresentationPhase room={room} />
      </section>
    </main>
  );
}

export function LegacyPresentation() {
  const gameId = getLegacyPresentationGameId(globalThis.location.search);
  const [state, setState] = useState<LegacyPublicGameState>({
    room: null,
    loading: Boolean(gameId),
    error: null,
  });

  useEffect(() => {
    if (!gameId) {
      return;
    }

    return subscribeToLegacyPublicGame(
      gameId,
      (room) => setState({ room, loading: false, error: null }),
      () =>
        setState({
          room: null,
          loading: false,
          error: "Não foi possível acompanhar a apresentação.",
        }),
    );
  }, [gameId]);

  if (!gameId) {
    return (
      <main className="legacy-page">
        <section className="legacy-message" role="alert">
          <h1>Informe uma sala</h1>
          <p>Abra esta página usando ?room=CÓDIGO.</p>
        </section>
      </main>
    );
  }

  if (state.loading) {
    return (
      <main className="legacy-page">
        <section className="legacy-message" role="status">
          <h1>Preparando a apresentação...</h1>
          <p>Carregando a sala {gameId}.</p>
        </section>
      </main>
    );
  }

  if (state.error || !state.room) {
    return (
      <main className="legacy-page">
        <section className="legacy-message" role="alert">
          <h1>Sala indisponível</h1>
          <p>{state.error ?? "Esta sala não existe mais."}</p>
        </section>
      </main>
    );
  }

  return <LegacyPresentationView room={state.room} />;
}
