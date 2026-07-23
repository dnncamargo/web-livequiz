import { onValue, ref, type Unsubscribe } from "firebase/database";
import {
  publicWaitingRoomSchema,
  waitingRoomCodeSchema,
  type PublicWaitingRoom,
} from "../shared/waiting-room";
import { legacyRealtimeDatabase } from "./legacy-firebase";

export function getLegacyPresentationGameId(search: string): string {
  const searchParams = new URLSearchParams(search);
  const candidate = (searchParams.get("room") ?? searchParams.get("sala") ?? "")
    .trim()
    .toUpperCase();
  const result = waitingRoomCodeSchema.safeParse(candidate);

  return result.success ? result.data : "";
}

export function subscribeToLegacyPublicGame(
  gameId: string,
  onGameChange: (game: PublicWaitingRoom | null) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  const parsedGameId = waitingRoomCodeSchema.parse(gameId);
  const gameReference = ref(
    legacyRealtimeDatabase,
    `publicGames/${parsedGameId}`,
  );

  return onValue(
    gameReference,
    (snapshot) => {
      if (!snapshot.exists()) {
        onGameChange(null);
        return;
      }

      const result = publicWaitingRoomSchema.safeParse(snapshot.val());

      if (!result.success) {
        onError(new Error("O estado público da partida é inválido."));
        return;
      }

      onGameChange(result.data);
    },
    onError,
  );
}
