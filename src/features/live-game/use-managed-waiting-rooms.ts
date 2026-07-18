import type { User } from "firebase/auth";
import { useEffect, useState } from "react";
import type { PublicWaitingRoom } from "../../shared/waiting-room";
import {
  getManagedWaitingRooms,
  WaitingRoomRequestError,
} from "./waiting-room";

const REFRESH_INTERVAL_MS = 10_000;

interface ManagedWaitingRoomLibraryState {
  rooms: PublicWaitingRoom[];
  loading: boolean;
  error: string | null;
}

interface ScopedManagedWaitingRoomLibraryState extends ManagedWaitingRoomLibraryState {
  ownerId: string;
}

type AdministratorUser = Pick<User, "uid" | "getIdToken">;

export function useManagedWaitingRooms(
  user: AdministratorUser | null,
  refreshRevision = 0,
): ManagedWaitingRoomLibraryState {
  const ownerId = user?.uid ?? "signed-out";
  const [state, setState] = useState<ScopedManagedWaitingRoomLibraryState>({
    ownerId: "",
    rooms: [],
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
        const rooms = await getManagedWaitingRooms(user);

        if (active) {
          setState({ ownerId, rooms, loading: false, error: null });
        }
      } catch (error) {
        if (active) {
          setState({
            ownerId,
            rooms: [],
            loading: false,
            error:
              error instanceof WaitingRoomRequestError
                ? error.message
                : "Não foi possível consultar a biblioteca de salas.",
          });
        }
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
  }, [ownerId, refreshRevision, user]);

  if (!user) {
    return { rooms: [], loading: false, error: null };
  }

  if (state.ownerId !== ownerId) {
    return { rooms: [], loading: true, error: null };
  }

  return state;
}
