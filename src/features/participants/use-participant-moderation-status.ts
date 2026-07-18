import { useEffect, useState } from "react";
import type { ParticipantModerationStatus } from "../../shared/participant";
import { subscribeToParticipantModerationStatus } from "./participant-moderation";

interface ParticipantModerationState {
  status: ParticipantModerationStatus | null;
  error: string | null;
}

interface ScopedParticipantModerationState extends ParticipantModerationState {
  scope: string;
}

export function useParticipantModerationStatus(
  gameId: string | null,
  participantId: string,
  onRemoved?: () => void,
): ParticipantModerationState {
  const scope = gameId ? `${gameId}:${participantId}` : "inactive";
  const [state, setState] = useState<ScopedParticipantModerationState>({
    scope: "",
    status: null,
    error: null,
  });

  useEffect(() => {
    if (!gameId) {
      return;
    }

    let active = true;
    const unsubscribe = subscribeToParticipantModerationStatus(
      gameId,
      participantId,
      (status) => {
        if (active) {
          setState({ scope, status, error: null });

          if (status === "removed") {
            onRemoved?.();
          }
        }
      },
      () => {
        if (active) {
          setState({
            scope,
            status: null,
            error: "Não foi possível acompanhar sua situação na sala.",
          });
        }
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [gameId, onRemoved, participantId, scope]);

  if (!gameId || state.scope !== scope) {
    return { status: null, error: null };
  }

  return state;
}
