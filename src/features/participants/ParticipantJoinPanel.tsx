import { zodResolver } from "@hookform/resolvers/zod";
import type { User } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  joinParticipantRequestSchema,
  PARTICIPANT_NICKNAME_MAX_LENGTH,
  type JoinParticipantRequest,
  type ParticipantSession,
} from "../../shared/participant";
import type { PublicWaitingRoom } from "../../shared/waiting-room";
import {
  DEFAULT_PARTICIPANT_AVATAR,
  PARTICIPANT_AVATARS,
} from "../../shared/avatar";
import { useRemainingPhaseSeconds } from "../live-game/phase-timing";
import { usePublicWaitingRoom } from "../live-game/use-public-waiting-room";
import {
  clearActiveParticipantSession,
  joinParticipantSession,
  ParticipantSessionRequestError,
  restoreParticipantSession,
} from "./participant-session";
import { useParticipantModerationStatus } from "./use-participant-moderation-status";
import { useParticipantPresence } from "./use-participant-presence";
import { ParticipantAnswerPanel } from "./ParticipantAnswerPanel";

interface ParticipantJoinPanelProps {
  user: User;
  initialGameId?: string;
}

interface ParticipantRequestFailure {
  code: string;
  message: string;
}

function getParticipantRequestFailure(
  error: unknown,
  fallbackMessage: string,
): ParticipantRequestFailure {
  return error instanceof ParticipantSessionRequestError
    ? { code: error.code, message: error.message }
    : { code: "unexpected-client-error", message: fallbackMessage };
}

const MODERATION_STATUS_LABELS = {
  "waiting-approval": "Pronto",
  approved: "Entrada aprovada",
  removed: "Entrada removida",
} as const;

function ParticipantGameState({
  room,
  user,
}: {
  room: PublicWaitingRoom;
  user: User;
}) {
  const remainingSeconds = useRemainingPhaseSeconds(room.phaseTiming);
  const questionProgress =
    room.questionNumber && room.totalQuestions
      ? `Pergunta ${room.questionNumber} de ${room.totalQuestions}`
      : null;

  if (room.phase === "waiting") {
    return (
      <section className="participant-game-state" aria-live="polite">
        <strong>Aguarde o início do quiz</strong>
        <span>A apresentação ainda está recebendo participantes.</span>
      </section>
    );
  }

  if (room.phase === "countdown") {
    return (
      <section className="participant-game-state" aria-live="polite">
        {questionProgress && <span>{questionProgress}</span>}
        <strong className="participant-countdown">
          {remainingSeconds ?? 0}
        </strong>
        <span>Prepare-se para responder!</span>
      </section>
    );
  }

  if (
    (room.phase === "question" || room.phase === "revealing") &&
    room.currentQuestion
  ) {
    const revealing = room.phase === "revealing";

    return (
      <section className="participant-game-state" aria-live="polite">
        <header className="participant-question-heading">
          <span>{questionProgress}</span>
          {!revealing && (
            <strong aria-label="Tempo restante">
              {remainingSeconds ?? 0}s
            </strong>
          )}
        </header>
        <h2>{room.currentQuestion.prompt}</h2>
        <p>
          {revealing
            ? "Confira a resposta correta."
            : "Escolha uma alternativa."}
        </p>
        <ParticipantAnswerPanel
          user={user}
          room={room}
          question={room.currentQuestion}
          acceptingAnswers={!revealing && (remainingSeconds ?? 0) > 0}
        />
      </section>
    );
  }

  if (room.phase === "ranking") {
    return (
      <section className="participant-game-state" aria-live="polite">
        {questionProgress && <span>{questionProgress}</span>}
        <strong>Ranking atualizado</strong>
        <span>Acompanhe a classificação na apresentação.</span>
      </section>
    );
  }

  if (room.phase === "podium") {
    return (
      <section className="participant-game-state" aria-live="polite">
        <strong>Resultado final</strong>
        <span>Confira o pódio na apresentação.</span>
      </section>
    );
  }

  return null;
}

export function ParticipantJoinPanel({
  user,
  initialGameId = "",
}: ParticipantJoinPanelProps) {
  const [participant, setParticipant] = useState<ParticipantSession | null>(
    null,
  );
  const [restoring, setRestoring] = useState(true);
  const [requestFailure, setRequestFailure] =
    useState<ParticipantRequestFailure | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<JoinParticipantRequest>({
    resolver: zodResolver(joinParticipantRequestSchema),
    defaultValues: {
      gameId: initialGameId,
      nickname: "",
      avatar: DEFAULT_PARTICIPANT_AVATAR,
    },
  });
  const returnToParticipantEntry = useCallback(() => {
    clearActiveParticipantSession();
    setParticipant(null);
    setRequestFailure(null);
    reset({
      gameId: "",
      nickname: "",
      avatar: DEFAULT_PARTICIPANT_AVATAR,
    });

    try {
      globalThis.history?.replaceState(globalThis.history.state, "", "/");
    } catch (error) {
      console.error("Não foi possível limpar o endereço da sala:", error);
    }
  }, [reset]);
  const sessionRoom = usePublicWaitingRoom(participant?.gameId ?? "");
  const roomEnded = Boolean(
    participant &&
    (sessionRoom.room?.phase === "finished" ||
      (!sessionRoom.loading && !sessionRoom.room && !sessionRoom.error)),
  );
  const moderation = useParticipantModerationStatus(
    participant?.gameId ?? null,
    user.uid,
    returnToParticipantEntry,
  );
  const effectiveModerationStatus =
    moderation.status ?? participant?.moderationStatus;
  const activePresenceGameId =
    effectiveModerationStatus === "removed" || roomEnded
      ? null
      : participant?.gameId;
  const presence = useParticipantPresence(activePresenceGameId ?? null);

  useEffect(() => {
    let active = true;

    void restoreParticipantSession(user)
      .then((restoredParticipant) => {
        if (active) {
          setParticipant(restoredParticipant);
        }
      })
      .catch((error: unknown) => {
        console.error("Erro ao restaurar participação:", error);

        if (active) {
          setRequestFailure(
            getParticipantRequestFailure(
              error,
              "Não foi possível recuperar sua participação.",
            ),
          );
        }
      })
      .finally(() => {
        if (active) {
          setRestoring(false);
        }
      });

    return () => {
      active = false;
    };
  }, [user]);

  const submitParticipant = handleSubmit(async (input) => {
    setRequestFailure(null);

    try {
      const joinedParticipant = await joinParticipantSession(user, input);
      setParticipant(joinedParticipant);
    } catch (error) {
      console.error("Erro ao entrar na sala:", error);
      setRequestFailure(
        getParticipantRequestFailure(
          error,
          "Não foi possível concluir sua entrada. Tente novamente.",
        ),
      );
    }
  });

  function leaveCurrentRoom() {
    returnToParticipantEntry();
  }

  if (restoring) {
    return (
      <div className="participant-loading" role="status" aria-live="polite">
        <strong>Recuperando sua participação...</strong>
        <span>Verificando se este dispositivo já entrou em uma sala.</span>
      </div>
    );
  }

  if (participant && effectiveModerationStatus === "removed") {
    return null;
  }

  if (participant) {
    return (
      <div className="participant-session" aria-live="polite">
        {sessionRoom.room && !roomEnded && (
          <ParticipantGameState room={sessionRoom.room} user={user} />
        )}

        {presence.error && !roomEnded && (
          <div className="test-result test-result-error" role="alert">
            <strong>Falha na conexão com a sala</strong>
            <p>{presence.error}</p>
          </div>
        )}

        {moderation.error && !roomEnded && (
          <div className="test-result test-result-error" role="alert">
            <strong>Falha ao acompanhar sua entrada</strong>
            <p>{moderation.error}</p>
          </div>
        )}

        {roomEnded && (
          <div className="test-result test-result-error" role="alert">
            <strong>Esta apresentação foi encerrada</strong>
            <p>
              A sala continua salva, mas não está recebendo participantes agora.
            </p>
            <button
              type="button"
              className="secondary-button"
              onClick={leaveCurrentRoom}
            >
              Procurar outra sala
            </button>
          </div>
        )}

        <div className="participant-session-identity">
          <span className="participant-avatar" aria-hidden="true">
            {participant.avatar}
          </span>
          <div>
            <strong>{participant.nickname}</strong>
            {sessionRoom.room?.name && <span>{sessionRoom.room.name}</span>}
          </div>
        </div>

        <div className="participant-session-summary">
          <div>
            <span>Código</span>
            <strong>{participant.gameId}</strong>
          </div>
          <div>
            <span>Situação</span>
            <strong>
              {roomEnded
                ? "Apresentação encerrada"
                : MODERATION_STATUS_LABELS[
                    effectiveModerationStatus ?? participant.moderationStatus
                  ]}
            </strong>
          </div>
        </div>

        {!roomEnded && effectiveModerationStatus !== "removed" && (
          <button
            type="button"
            className="secondary-button participant-leave-button"
            onClick={leaveCurrentRoom}
          >
            Sair da sala
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="participant-join-panel">
      <h1>Entrar em uma sala</h1>
      <p>Digite o código da sala e escolha como você quer aparecer no jogo.</p>

      <form className="participant-join-form" onSubmit={submitParticipant}>
        <div className="form-field">
          <label htmlFor="participant-game-code">Código da sala</label>
          <input
            id="participant-game-code"
            autoComplete="off"
            inputMode="text"
            maxLength={6}
            placeholder="ABC234"
            aria-invalid={Boolean(errors.gameId)}
            aria-describedby={errors.gameId ? "game-code-error" : undefined}
            {...register("gameId")}
          />
          {errors.gameId && (
            <span id="game-code-error" className="field-error">
              {errors.gameId.message}
            </span>
          )}
        </div>

        <fieldset className="avatar-picker">
          <legend>Escolha seu avatar</legend>
          <div>
            {PARTICIPANT_AVATARS.map((avatar) => (
              <label key={avatar}>
                <input type="radio" value={avatar} {...register("avatar")} />
                <span aria-hidden="true">{avatar}</span>
                <span className="sr-only">Avatar {avatar}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="form-field">
          <label htmlFor="participant-nickname">Seu nickname</label>
          <input
            id="participant-nickname"
            autoComplete="nickname"
            maxLength={PARTICIPANT_NICKNAME_MAX_LENGTH}
            placeholder="Ex.: Estrela Azul"
            aria-invalid={Boolean(errors.nickname)}
            aria-describedby={errors.nickname ? "nickname-error" : undefined}
            {...register("nickname")}
          />
          {errors.nickname && (
            <span id="nickname-error" className="field-error">
              {errors.nickname.message}
            </span>
          )}
        </div>

        <button
          type="submit"
          className="primary-button"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Entrando na sala..." : "Entrar na sala"}
        </button>
      </form>

      {requestFailure && (
        <div className="test-result test-result-error" role="alert">
          <strong>Não foi possível entrar</strong>
          <p>{requestFailure.message}</p>
          <small>Referência: {requestFailure.code}</small>
        </div>
      )}
    </div>
  );
}
