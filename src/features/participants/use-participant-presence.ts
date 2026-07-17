import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/auth-context";
import {
  startParticipantPresence,
  type ParticipantConnectionStatus,
} from "./participant-presence";

export interface ParticipantPresenceState {
  status: ParticipantConnectionStatus | "idle";
  error: string | null;
}

interface ScopedParticipantPresenceState extends ParticipantPresenceState {
  gameId: string | null;
}

const IDLE_PRESENCE_STATE: ParticipantPresenceState = {
  status: "idle",
  error: null,
};

export function useParticipantPresence(
  gameId: string | null,
): ParticipantPresenceState {
  const { user, isAnonymous } = useAuth();
  const participantId = user?.uid ?? null;
  const [state, setState] = useState<ScopedParticipantPresenceState>({
    gameId: null,
    status: "idle",
    error: null,
  });

  useEffect(() => {
    if (!gameId || !participantId || !isAnonymous) {
      return;
    }

    let active = true;

    try {
      const session = startParticipantPresence(
        { gameId, participantId },
        {
          onStatusChange: (status) => {
            if (active) {
              setState({ gameId, status, error: null });
            }
          },
          onError: () => {
            if (active) {
              setState({
                gameId,
                status: "error",
                error:
                  "Não foi possível manter sua presença na partida. Verifique sua conexão.",
              });
            }
          },
        },
      );

      return () => {
        active = false;
        void session.stop().catch((error: unknown) => {
          console.error("Erro ao encerrar presença do participante:", error);
        });
      };
    } catch (error) {
      console.error("Erro ao iniciar presença do participante:", error);
      queueMicrotask(() => {
        if (active) {
          setState({
            gameId,
            status: "error",
            error: "Não foi possível iniciar sua presença nesta partida.",
          });
        }
      });

      return () => {
        active = false;
      };
    }
  }, [gameId, isAnonymous, participantId]);

  if (!gameId || !participantId || !isAnonymous) {
    return IDLE_PRESENCE_STATE;
  }

  if (state.gameId !== gameId) {
    return { status: "connecting", error: null };
  }

  return state;
}
