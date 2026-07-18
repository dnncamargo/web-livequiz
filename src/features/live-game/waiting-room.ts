import type { User } from "firebase/auth";
import { onValue, ref, type Unsubscribe } from "firebase/database";
import { realtimeDatabase } from "../../lib/firebase";
import {
  managedWaitingRoomResponseSchema,
  removeWaitingRoomParticipantRequestSchema,
  type ManagedWaitingRoom,
  type RemoveWaitingRoomParticipantRequest,
} from "../../shared/participant";
import {
  apiErrorResponseSchema,
  createWaitingRoomResponseSchema,
  endWaitingRoomRequestSchema,
  endWaitingRoomResponseSchema,
  publicWaitingRoomSchema,
  waitingRoomLibraryResponseSchema,
  waitingRoomCodeSchema,
  type EndWaitingRoomRequest,
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
        ? "A API de salas não está disponível neste ambiente. Publique a versão atual na Vercel e tente novamente."
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

export async function getManagedWaitingRoom(
  user: Pick<User, "getIdToken">,
  gameId?: string,
): Promise<ManagedWaitingRoom> {
  const idToken = await user.getIdToken();
  const query = gameId ? `?gameId=${encodeURIComponent(gameId)}` : "";
  const response = await fetch(`/api/games${query}`, {
    method: "GET",
    headers: { authorization: `Bearer ${idToken}` },
  });
  const payload = await readApiPayload(response);

  if (!response.ok) {
    const errorResult = apiErrorResponseSchema.safeParse(payload);

    throw new WaitingRoomRequestError(
      errorResult.success ? errorResult.data.error.code : "request-failed",
      errorResult.success
        ? errorResult.data.error.message
        : "Não foi possível consultar a sala. Tente novamente.",
    );
  }

  const result = managedWaitingRoomResponseSchema.safeParse(payload);

  if (!result.success) {
    throw new WaitingRoomRequestError(
      "invalid-response",
      "O servidor retornou dados inválidos para a sala.",
    );
  }

  return result.data;
}

export async function getManagedWaitingRooms(
  user: Pick<User, "getIdToken">,
): Promise<PublicWaitingRoom[]> {
  const idToken = await user.getIdToken();
  const response = await fetch("/api/games?scope=library", {
    method: "GET",
    headers: { authorization: `Bearer ${idToken}` },
  });
  const payload = await readApiPayload(response);

  if (!response.ok) {
    const errorResult = apiErrorResponseSchema.safeParse(payload);

    throw new WaitingRoomRequestError(
      errorResult.success ? errorResult.data.error.code : "request-failed",
      errorResult.success
        ? errorResult.data.error.message
        : "Não foi possível consultar a biblioteca de salas.",
    );
  }

  const result = waitingRoomLibraryResponseSchema.safeParse(payload);

  if (!result.success) {
    throw new WaitingRoomRequestError(
      "invalid-response",
      "O servidor retornou dados inválidos para a biblioteca de salas.",
    );
  }

  return result.data.rooms;
}

export async function endWaitingRoom(
  user: Pick<User, "getIdToken">,
  input: EndWaitingRoomRequest,
): Promise<string> {
  const parsedInput = endWaitingRoomRequestSchema.parse(input);
  const idToken = await user.getIdToken();
  const response = await fetch("/api/games", {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${idToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(parsedInput),
  });
  const payload = await readApiPayload(response);

  if (!response.ok) {
    const errorResult = apiErrorResponseSchema.safeParse(payload);

    throw new WaitingRoomRequestError(
      errorResult.success ? errorResult.data.error.code : "request-failed",
      errorResult.success
        ? errorResult.data.error.message
        : "Não foi possível encerrar a sala. Tente novamente.",
    );
  }

  const result = endWaitingRoomResponseSchema.safeParse(payload);

  if (!result.success) {
    throw new WaitingRoomRequestError(
      "invalid-response",
      "O servidor retornou dados inválidos ao encerrar a sala.",
    );
  }

  return result.data.endedGameId;
}

export async function removeWaitingRoomParticipant(
  user: Pick<User, "getIdToken">,
  input: RemoveWaitingRoomParticipantRequest,
): Promise<ManagedWaitingRoom> {
  const parsedInput = removeWaitingRoomParticipantRequestSchema.parse(input);
  const idToken = await user.getIdToken();
  const response = await fetch("/api/games", {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${idToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(parsedInput),
  });
  const payload = await readApiPayload(response);

  if (!response.ok) {
    const errorResult = apiErrorResponseSchema.safeParse(payload);

    throw new WaitingRoomRequestError(
      errorResult.success ? errorResult.data.error.code : "request-failed",
      errorResult.success
        ? errorResult.data.error.message
        : "Não foi possível remover o participante. Tente novamente.",
    );
  }

  const result = managedWaitingRoomResponseSchema.safeParse(payload);

  if (!result.success) {
    throw new WaitingRoomRequestError(
      "invalid-response",
      "O servidor retornou dados inválidos após remover o participante.",
    );
  }

  return result.data;
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
