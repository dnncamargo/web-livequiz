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
  archiveWaitingRoomRequestSchema,
  archivedWaitingRoomLibraryResponseSchema,
  archivedWaitingRoomMutationResponseSchema,
  createWaitingRoomRequestSchema,
  createWaitingRoomResponseSchema,
  deleteArchivedWaitingRoomRequestSchema,
  deleteArchivedWaitingRoomResponseSchema,
  endWaitingRoomRequestSchema,
  presentWaitingRoomRequestSchema,
  publicWaitingRoomSchema,
  restoreWaitingRoomRequestSchema,
  waitingRoomLibraryResponseSchema,
  waitingRoomMutationResponseSchema,
  waitingRoomCodeSchema,
  type ArchiveWaitingRoomRequest,
  type ArchivedWaitingRoom,
  type CreateWaitingRoomRequest,
  type DeleteArchivedWaitingRoomRequest,
  type EndWaitingRoomRequest,
  type PresentWaitingRoomRequest,
  type PublicWaitingRoom,
  type RestoreWaitingRoomRequest,
} from "../../shared/waiting-room";

type AdministratorUser = Pick<User, "getIdToken">;

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

async function requestApi(
  user: AdministratorUser,
  input: RequestInfo | URL,
  init: RequestInit,
  fallbackMessage: string,
): Promise<unknown> {
  const idToken = await user.getIdToken();
  const response = await fetch(input, {
    ...init,
    headers: {
      authorization: `Bearer ${idToken}`,
      ...init.headers,
    },
  });
  const payload = await readApiPayload(response);

  if (!response.ok) {
    const errorResult = apiErrorResponseSchema.safeParse(payload);

    throw new WaitingRoomRequestError(
      errorResult.success ? errorResult.data.error.code : "request-failed",
      errorResult.success ? errorResult.data.error.message : fallbackMessage,
    );
  }

  return payload;
}

async function mutateWaitingRoom(
  user: AdministratorUser,
  input: object,
  fallbackMessage: string,
): Promise<unknown> {
  return requestApi(
    user,
    "/api/games",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
    fallbackMessage,
  );
}

export async function createWaitingRoom(
  user: AdministratorUser,
  input: CreateWaitingRoomRequest,
): Promise<PublicWaitingRoom> {
  const parsedInput = createWaitingRoomRequestSchema.parse(input);
  const payload = await requestApi(
    user,
    "/api/games",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsedInput),
    },
    "Não foi possível criar a sala. Tente novamente.",
  );
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
  user: AdministratorUser,
  gameId?: string,
): Promise<ManagedWaitingRoom> {
  const query = gameId ? `?gameId=${encodeURIComponent(gameId)}` : "";
  const payload = await requestApi(
    user,
    `/api/games${query}`,
    { method: "GET" },
    "Não foi possível consultar a sala. Tente novamente.",
  );
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
  user: AdministratorUser,
): Promise<PublicWaitingRoom[]> {
  const payload = await requestApi(
    user,
    "/api/games?scope=library",
    { method: "GET" },
    "Não foi possível consultar a biblioteca de salas.",
  );
  const result = waitingRoomLibraryResponseSchema.safeParse(payload);

  if (!result.success) {
    throw new WaitingRoomRequestError(
      "invalid-response",
      "O servidor retornou dados inválidos para a biblioteca de salas.",
    );
  }

  return result.data.rooms;
}

export async function getArchivedWaitingRooms(
  user: AdministratorUser,
): Promise<ArchivedWaitingRoom[]> {
  const payload = await requestApi(
    user,
    "/api/games?scope=archived",
    { method: "GET" },
    "Não foi possível consultar as salas arquivadas.",
  );
  const result = archivedWaitingRoomLibraryResponseSchema.safeParse(payload);

  if (!result.success) {
    throw new WaitingRoomRequestError(
      "invalid-response",
      "O servidor retornou dados inválidos para as salas arquivadas.",
    );
  }

  return result.data.rooms;
}

async function changeWaitingRoomPhase(
  user: AdministratorUser,
  input: EndWaitingRoomRequest | PresentWaitingRoomRequest,
  fallbackMessage: string,
): Promise<PublicWaitingRoom> {
  const payload = await mutateWaitingRoom(user, input, fallbackMessage);
  const result = waitingRoomMutationResponseSchema.safeParse(payload);

  if (!result.success) {
    throw new WaitingRoomRequestError(
      "invalid-response",
      "O servidor retornou dados inválidos ao alterar a apresentação.",
    );
  }

  return result.data.room;
}

export function endWaitingRoom(
  user: AdministratorUser,
  input: EndWaitingRoomRequest,
): Promise<PublicWaitingRoom> {
  return changeWaitingRoomPhase(
    user,
    endWaitingRoomRequestSchema.parse(input),
    "Não foi possível encerrar a apresentação. Tente novamente.",
  );
}

export function presentWaitingRoom(
  user: AdministratorUser,
  input: PresentWaitingRoomRequest,
): Promise<PublicWaitingRoom> {
  return changeWaitingRoomPhase(
    user,
    presentWaitingRoomRequestSchema.parse(input),
    "Não foi possível iniciar a apresentação. Tente novamente.",
  );
}

export async function archiveWaitingRoom(
  user: AdministratorUser,
  input: ArchiveWaitingRoomRequest,
): Promise<ArchivedWaitingRoom> {
  const parsedInput = archiveWaitingRoomRequestSchema.parse(input);
  const payload = await mutateWaitingRoom(
    user,
    parsedInput,
    "Não foi possível arquivar a sala. Tente novamente.",
  );
  const result = archivedWaitingRoomMutationResponseSchema.safeParse(payload);

  if (!result.success) {
    throw new WaitingRoomRequestError(
      "invalid-response",
      "O servidor retornou dados inválidos ao arquivar a sala.",
    );
  }

  return result.data.archivedRoom;
}

export async function restoreWaitingRoom(
  user: AdministratorUser,
  input: RestoreWaitingRoomRequest,
): Promise<PublicWaitingRoom> {
  const parsedInput = restoreWaitingRoomRequestSchema.parse(input);
  const payload = await mutateWaitingRoom(
    user,
    parsedInput,
    "Não foi possível restaurar a sala. Tente novamente.",
  );
  const result = waitingRoomMutationResponseSchema.safeParse(payload);

  if (!result.success) {
    throw new WaitingRoomRequestError(
      "invalid-response",
      "O servidor retornou dados inválidos ao restaurar a sala.",
    );
  }

  return result.data.room;
}

export async function deleteArchivedWaitingRoom(
  user: AdministratorUser,
  input: DeleteArchivedWaitingRoomRequest,
): Promise<string> {
  const parsedInput = deleteArchivedWaitingRoomRequestSchema.parse(input);
  const payload = await mutateWaitingRoom(
    user,
    parsedInput,
    "Não foi possível excluir a sala. Tente novamente.",
  );
  const result = deleteArchivedWaitingRoomResponseSchema.safeParse(payload);

  if (!result.success) {
    throw new WaitingRoomRequestError(
      "invalid-response",
      "O servidor retornou dados inválidos ao excluir a sala.",
    );
  }

  return result.data.deletedGameId;
}

export async function removeWaitingRoomParticipant(
  user: AdministratorUser,
  input: RemoveWaitingRoomParticipantRequest,
): Promise<ManagedWaitingRoom> {
  const parsedInput = removeWaitingRoomParticipantRequestSchema.parse(input);
  const payload = await mutateWaitingRoom(
    user,
    parsedInput,
    "Não foi possível remover o participante. Tente novamente.",
  );
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
