import type { User } from "firebase/auth";
import { useEffect, useState } from "react";
import type { ArchivedWaitingRoom } from "../../shared/waiting-room";
import {
  getArchivedWaitingRooms,
  WaitingRoomRequestError,
} from "./waiting-room";

interface ArchivedWaitingRoomState {
  rooms: ArchivedWaitingRoom[];
  loading: boolean;
  error: string | null;
}

interface ScopedArchivedWaitingRoomState extends ArchivedWaitingRoomState {
  ownerId: string;
}

type AdministratorUser = Pick<User, "uid" | "getIdToken">;

export function useArchivedWaitingRooms(
  user: AdministratorUser | null,
  refreshRevision = 0,
): ArchivedWaitingRoomState {
  const ownerId = user?.uid ?? "signed-out";
  const [state, setState] = useState<ScopedArchivedWaitingRoomState>({
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

    void getArchivedWaitingRooms(user)
      .then((rooms) => {
        if (active) {
          setState({ ownerId, rooms, loading: false, error: null });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            ownerId,
            rooms: [],
            loading: false,
            error:
              error instanceof WaitingRoomRequestError
                ? error.message
                : "Não foi possível consultar as salas arquivadas.",
          });
        }
      });

    return () => {
      active = false;
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
