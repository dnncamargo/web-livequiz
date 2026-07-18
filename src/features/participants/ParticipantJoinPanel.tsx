import { zodResolver } from "@hookform/resolvers/zod";
import type { User } from "firebase/auth";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  joinParticipantRequestSchema,
  PARTICIPANT_NICKNAME_MAX_LENGTH,
  type JoinParticipantRequest,
  type ParticipantSession,
} from "../../shared/participant";
import {
  DEFAULT_PARTICIPANT_AVATAR,
  PARTICIPANT_AVATARS,
} from "../../shared/avatar";
import { usePublicWaitingRoom } from "../live-game/use-public-waiting-room";
import {
  clearActiveParticipantSession,
  joinParticipantSession,
  ParticipantSessionRequestError,
  restoreParticipantSession,
} from "./participant-session";
import { useParticipantModerationStatus } from "./use-participant-moderation-status";
import { useParticipantPresence } from "./use-participant-presence";

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

const PRESENCE_STATUS_LABELS = {
  idle: "Presença inativa",
  connecting: "Conectando...",
  connected: "Conectado",
  reconnecting: "Reconectando...",
  "temporarily-disconnected": "Conexão temporariamente interrompida",
  error: "Falha na presença",
} as const;

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
  const sessionRoom = usePublicWaitingRoom(participant?.gameId ?? "");
  const roomEnded = Boolean(
    participant &&
    (sessionRoom.room?.phase === "finished" ||
      (!sessionRoom.loading && !sessionRoom.room && !sessionRoom.error)),
  );
  const moderation = useParticipantModerationStatus(
    participant?.gameId ?? null,
    user.uid,
  );
  const effectiveModerationStatus =
    moderation.status ?? participant?.moderationStatus;
  const activePresenceGameId =
    effectiveModerationStatus === "removed" || roomEnded
      ? null
      : participant?.gameId;
  const presence = useParticipantPresence(activePresenceGameId ?? null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<JoinParticipantRequest>({
    resolver: zodResolver(joinParticipantRequestSchema),
    defaultValues: {
      gameId: initialGameId,
      nickname: "",
      avatar: DEFAULT_PARTICIPANT_AVATAR,
    },
  });

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
    clearActiveParticipantSession();
    setParticipant(null);
    setRequestFailure(null);
  }

  if (restoring) {
    return (
      <div className="participant-loading" role="status" aria-live="polite">
        <strong>Recuperando sua participação...</strong>
        <span>Verificando se este dispositivo já entrou em uma sala.</span>
      </div>
    );
  }

  if (participant) {
    return (
      <div className="participant-session" aria-live="polite">
        <span className="eyebrow">Você está na sala</span>
        <span className="participant-avatar" aria-hidden="true">
          {participant.avatar}
        </span>
        <strong className="participant-nickname">{participant.nickname}</strong>

        {sessionRoom.room?.name && <p>{sessionRoom.room.name}</p>}

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
          <div>
            <span>Conexão</span>
            <strong>{PRESENCE_STATUS_LABELS[presence.status]}</strong>
          </div>
        </div>

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

        {!roomEnded && effectiveModerationStatus === "removed" && (
          <div className="test-result test-result-error" role="alert">
            <strong>Você foi removido desta sala</strong>
            <p>
              Sua conexão com esta partida foi encerrada pelo administrador.
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

        {!roomEnded && effectiveModerationStatus !== "removed" && (
          <>
            <p>
              Seu nickname foi salvo. A escolha de avatar será liberada no
              próximo marco.
            </p>
            <button
              type="button"
              className="secondary-button"
              onClick={leaveCurrentRoom}
            >
              Sair da sala
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="participant-join-panel">
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
