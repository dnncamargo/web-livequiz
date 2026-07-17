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
  joinParticipantSession,
  ParticipantSessionRequestError,
  restoreParticipantSession,
} from "./participant-session";
import { useParticipantPresence } from "./use-participant-presence";

interface ParticipantJoinPanelProps {
  user: User;
}

const MODERATION_STATUS_LABELS = {
  "waiting-approval": "Aguardando aprovação",
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

export function ParticipantJoinPanel({ user }: ParticipantJoinPanelProps) {
  const [participant, setParticipant] = useState<ParticipantSession | null>(
    null,
  );
  const [restoring, setRestoring] = useState(true);
  const [requestError, setRequestError] = useState("");
  const activePresenceGameId =
    participant?.moderationStatus === "removed" ? null : participant?.gameId;
  const presence = useParticipantPresence(activePresenceGameId ?? null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<JoinParticipantRequest>({
    resolver: zodResolver(joinParticipantRequestSchema),
    defaultValues: { gameId: "", nickname: "" },
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
          setRequestError(
            error instanceof ParticipantSessionRequestError
              ? error.message
              : "Não foi possível recuperar sua participação.",
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
    setRequestError("");

    try {
      const joinedParticipant = await joinParticipantSession(user, input);
      setParticipant(joinedParticipant);
    } catch (error) {
      console.error("Erro ao entrar na sala:", error);
      setRequestError(
        error instanceof ParticipantSessionRequestError
          ? error.message
          : "Não foi possível concluir sua entrada. Tente novamente.",
      );
    }
  });

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
        <strong className="participant-nickname">{participant.nickname}</strong>

        <div className="participant-session-summary">
          <div>
            <span>Código</span>
            <strong>{participant.gameId}</strong>
          </div>
          <div>
            <span>Situação</span>
            <strong>
              {MODERATION_STATUS_LABELS[participant.moderationStatus]}
            </strong>
          </div>
          <div>
            <span>Conexão</span>
            <strong>{PRESENCE_STATUS_LABELS[presence.status]}</strong>
          </div>
        </div>

        {presence.error && (
          <div className="test-result test-result-error" role="alert">
            <strong>Falha na conexão com a sala</strong>
            <p>{presence.error}</p>
          </div>
        )}

        <p>
          Seu nickname foi salvo. A escolha de avatar será liberada no próximo
          marco.
        </p>
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

      {requestError && (
        <div className="test-result test-result-error" role="alert">
          <strong>Não foi possível entrar</strong>
          <p>{requestError}</p>
        </div>
      )}
    </div>
  );
}
