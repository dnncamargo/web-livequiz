import { useEffect, useState } from "react";
import type { PublicWaitingRoom } from "../../shared/waiting-room";
import { subscribeToPublicWaitingRoom } from "./waiting-room";

export interface PublicWaitingRoomState {
  room: PublicWaitingRoom | null;
  loading: boolean;
  error: string | null;
}

interface ScopedPublicWaitingRoomState extends PublicWaitingRoomState {
  gameId: string;
}

export function usePublicWaitingRoom(gameId: string): PublicWaitingRoomState {
  const [state, setState] = useState<ScopedPublicWaitingRoomState>({
    gameId: "",
    room: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!gameId) {
      return;
    }

    let active = true;

    try {
      const unsubscribe = subscribeToPublicWaitingRoom(
        gameId,
        (room) => {
          if (active) {
            setState({ gameId, room, loading: false, error: null });
          }
        },
        () => {
          if (active) {
            setState({
              gameId,
              room: null,
              loading: false,
              error: "Não foi possível acompanhar o estado da sala.",
            });
          }
        },
      );

      return () => {
        active = false;
        unsubscribe();
      };
    } catch (error) {
      console.error("Erro ao acompanhar sala de espera:", error);
      queueMicrotask(() => {
        if (active) {
          setState({
            gameId,
            room: null,
            loading: false,
            error: "O código da sala é inválido.",
          });
        }
      });

      return () => {
        active = false;
      };
    }
  }, [gameId]);

  if (!gameId) {
    return { room: null, loading: false, error: null };
  }

  if (state.gameId !== gameId) {
    return { room: null, loading: true, error: null };
  }

  return state;
}
