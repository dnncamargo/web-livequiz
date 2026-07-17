import type { User } from "firebase/auth";
import { useEffect, useState } from "react";
import type { ManagedWaitingRoom } from "../../shared/participant";
import { getManagedWaitingRoom, WaitingRoomRequestError } from "./waiting-room";

const REFRESH_INTERVAL_MS = 3_000;

interface ManagedWaitingRoomState {
  waitingRoom: ManagedWaitingRoom | null;
  loading: boolean;
  error: string | null;
}

interface ScopedManagedWaitingRoomState extends ManagedWaitingRoomState {
  scope: string;
}

type AdministratorUser = Pick<User, "uid" | "getIdToken">;

export function useManagedWaitingRoom(
  user: AdministratorUser | null,
  gameId?: string,
): ManagedWaitingRoomState {
  const scope = user ? `${user.uid}:${gameId ?? "active"}` : "signed-out";
  const [state, setState] = useState<ScopedManagedWaitingRoomState>({
    scope: "",
    waitingRoom: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!user) {
      return;
    }

    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    const refresh = async () => {
      try {
        const waitingRoom = await getManagedWaitingRoom(user, gameId);

        if (active) {
          setState({ scope, waitingRoom, loading: false, error: null });
        }
      } catch (error) {
        if (!active) {
          return;
        }

        const roomNotFound =
          error instanceof WaitingRoomRequestError &&
          (error.code === "active-room-not-found" ||
            error.code === "room-not-found");

        setState({
          scope,
          waitingRoom: null,
          loading: false,
          error: roomNotFound
            ? null
            : error instanceof WaitingRoomRequestError
              ? error.message
              : "Não foi possível consultar a sala de espera.",
        });
      } finally {
        if (active) {
          refreshTimer = setTimeout(() => void refresh(), REFRESH_INTERVAL_MS);
        }
      }
    };

    void refresh();

    return () => {
      active = false;
      clearTimeout(refreshTimer);
    };
  }, [gameId, scope, user]);

  if (!user) {
    return { waitingRoom: null, loading: false, error: null };
  }

  if (state.scope !== scope) {
    return { waitingRoom: null, loading: true, error: null };
  }

  return state;
}
