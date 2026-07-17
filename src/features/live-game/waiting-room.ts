import type { User } from "firebase/auth";
import { onValue, ref, type Unsubscribe } from "firebase/database";
import { realtimeDatabase } from "../../lib/firebase";
import {
  apiErrorResponseSchema,
  createWaitingRoomResponseSchema,
  publicWaitingRoomSchema,
  waitingRoomCodeSchema,
  type PublicWaitingRoom,
} from "../../shared/waiting-room";

export class WaitingRoomRequestError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "WaitingRoomRequestError";
    this.code = code;
  }
}

async function readApiPayload(response: Response): Promise<unknown> {
  const responseText = await response.text();

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    const contentType = response.headers.get("content-type")?.toLowerCase();
    const looksLikeHtml =
      contentType?.includes("text/html") ||
      /^\s*<!doctype html/i.test(responseText);

    throw new WaitingRoomRequestError(
      looksLikeHtml ? "api-unavailable" : "invalid-response",
      looksLikeHtml
        ? "A API de criação de salas não está disponível neste ambiente. Publique a versão atual na Vercel e tente novamente."
        : "O servidor retornou uma resposta inválida.",
    );
  }
}

export async function createWaitingRoom(
  user: Pick<User, "getIdToken">,
): Promise<PublicWaitingRoom> {
  const idToken = await user.getIdToken();
  const response = await fetch("/api/games", {
    method: "POST",
    headers: {
      authorization: `Bearer ${idToken}`,
    },
  });
  const payload = await readApiPayload(response);

  if (!response.ok) {
    const errorResult = apiErrorResponseSchema.safeParse(payload);

    throw new WaitingRoomRequestError(
      errorResult.success ? errorResult.data.error.code : "request-failed",
      errorResult.success
        ? errorResult.data.error.message
        : "Não foi possível criar a sala. Tente novamente.",
    );
  }

  const result = createWaitingRoomResponseSchema.safeParse(payload);

  if (!result.success) {
    throw new WaitingRoomRequestError(
      "invalid-response",
      "O servidor retornou dados inválidos para a sala.",
    );
  }

  return result.data.room;
}

export function subscribeToPublicWaitingRoom(
  gameId: string,
  onRoomChange: (room: PublicWaitingRoom | null) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  const parsedGameId = waitingRoomCodeSchema.parse(gameId);
  const roomReference = ref(realtimeDatabase, `publicGames/${parsedGameId}`);

  return onValue(
    roomReference,
    (snapshot) => {
      if (!snapshot.exists()) {
        onRoomChange(null);
        return;
      }

      const result = publicWaitingRoomSchema.safeParse(snapshot.val());

      if (!result.success) {
        onError(new Error("A sala pública contém dados inválidos."));
        return;
      }

      onRoomChange(result.data);
    },
    onError,
  );
}
