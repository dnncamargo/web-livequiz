import { onValue, ref, type Unsubscribe } from "firebase/database";
import { getParticipantModerationStatusPath } from "../live-game/live-game-paths";
import { realtimeDatabase } from "../../lib/firebase";
import {
  participantModerationStatusSchema,
  type ParticipantModerationStatus,
} from "../../shared/participant";

export function subscribeToParticipantModerationStatus(
  gameId: string,
  participantId: string,
  onStatusChange: (status: ParticipantModerationStatus) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  const statusReference = ref(
    realtimeDatabase,
    getParticipantModerationStatusPath({ gameId, participantId }),
  );

  return onValue(
    statusReference,
    (snapshot) => {
      const result = participantModerationStatusSchema.safeParse(
        snapshot.val(),
      );

      if (!result.success) {
        onError(new Error("O status de entrada do participante é inválido."));
        return;
      }

      onStatusChange(result.data);
    },
    onError,
  );
}
