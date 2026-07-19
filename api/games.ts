import { authorizeAdministratorRequest } from "./_lib/administrator-authorization.js";
import { getFirebaseAdminServices } from "./_lib/firebase-admin.js";
import {
  advanceWaitingRoomGame,
  associateWaitingRoomQuiz,
  archiveWaitingRoom,
  createWaitingRoom,
  deleteArchivedWaitingRoom,
  endWaitingRoom,
  getManagedWaitingRoom,
  listArchivedWaitingRooms,
  listManagedWaitingRooms,
  presentWaitingRoom,
  removeWaitingRoomParticipant,
  restoreWaitingRoom,
} from "./_lib/waiting-room-service.js";
import { removeWaitingRoomParticipantRequestSchema } from "../src/shared/participant.js";
import {
  advanceWaitingRoomGameRequestSchema,
  associateWaitingRoomQuizRequestSchema,
  archiveWaitingRoomRequestSchema,
  createWaitingRoomRequestSchema,
  deleteArchivedWaitingRoomRequestSchema,
  endWaitingRoomRequestSchema,
  presentWaitingRoomRequestSchema,
  restoreWaitingRoomRequestSchema,
} from "../src/shared/waiting-room.js";
import { HttpError } from "./_lib/http-error.js";

function jsonResponse(body: unknown, status: number, headers?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      ...headers,
    },
  });
}

interface HttpErrorLike extends Error {
  status: number;
  code: string;
}

function isHttpError(error: unknown): error is HttpErrorLike {
  return (
    error instanceof Error &&
    "status" in error &&
    typeof error.status === "number" &&
    "code" in error &&
    typeof error.code === "string"
  );
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(
      400,
      "invalid-json",
      "O corpo da requisição não contém um JSON válido.",
    );
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const services = getFirebaseAdminServices();
    const administrator = await authorizeAdministratorRequest(
      request,
      services,
    );
    const searchParams = new URL(request.url).searchParams;
    const gameId = searchParams.get("gameId") ?? undefined;
    const scope = searchParams.get("scope");

    if (scope === "library" && !gameId) {
      const rooms = await listManagedWaitingRooms(administrator.uid, services);

      return jsonResponse({ rooms }, 200);
    }

    if (scope === "archived" && !gameId) {
      const rooms = await listArchivedWaitingRooms(administrator.uid, services);

      return jsonResponse({ rooms }, 200);
    }

    if (scope) {
      throw new HttpError(
        400,
        "invalid-room-query",
        "A consulta de salas informada é inválida.",
      );
    }

    const waitingRoom = await getManagedWaitingRoom(
      administrator.uid,
      services,
      gameId,
    );

    return jsonResponse(waitingRoom, 200);
  } catch (error) {
    return handleError(error, "consultar");
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const services = getFirebaseAdminServices();
    const administrator = await authorizeAdministratorRequest(
      request,
      services,
    );
    const inputResult = createWaitingRoomRequestSchema.safeParse(
      await readJsonBody(request),
    );

    if (!inputResult.success) {
      throw new HttpError(
        400,
        "invalid-room-data",
        inputResult.error.issues[0]?.message ?? "Revise os dados da sala.",
      );
    }

    const room = await createWaitingRoom(
      administrator.uid,
      inputResult.data,
      services,
    );

    return jsonResponse({ room }, 201);
  } catch (error) {
    return handleError(error, "criar");
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const services = getFirebaseAdminServices();
    const administrator = await authorizeAdministratorRequest(
      request,
      services,
    );
    const payload = await readJsonBody(request);

    const advanceGameResult =
      advanceWaitingRoomGameRequestSchema.safeParse(payload);

    if (advanceGameResult.success) {
      const room = await advanceWaitingRoomGame(
        administrator.uid,
        advanceGameResult.data,
        services,
      );

      return jsonResponse({ room }, 200);
    }

    const associateQuizResult =
      associateWaitingRoomQuizRequestSchema.safeParse(payload);

    if (associateQuizResult.success) {
      const room = await associateWaitingRoomQuiz(
        administrator.uid,
        associateQuizResult.data,
        services,
      );

      return jsonResponse({ room }, 200);
    }

    const endRoomResult = endWaitingRoomRequestSchema.safeParse(payload);

    if (endRoomResult.success) {
      const room = await endWaitingRoom(
        administrator.uid,
        endRoomResult.data,
        services,
      );

      return jsonResponse({ room }, 200);
    }

    const presentRoomResult =
      presentWaitingRoomRequestSchema.safeParse(payload);

    if (presentRoomResult.success) {
      const room = await presentWaitingRoom(
        administrator.uid,
        presentRoomResult.data,
        services,
      );

      return jsonResponse({ room }, 200);
    }

    const archiveRoomResult =
      archiveWaitingRoomRequestSchema.safeParse(payload);

    if (archiveRoomResult.success) {
      const archivedRoom = await archiveWaitingRoom(
        administrator.uid,
        archiveRoomResult.data,
        services,
      );

      return jsonResponse({ archivedRoom }, 200);
    }

    const restoreRoomResult =
      restoreWaitingRoomRequestSchema.safeParse(payload);

    if (restoreRoomResult.success) {
      const room = await restoreWaitingRoom(
        administrator.uid,
        restoreRoomResult.data,
        services,
      );

      return jsonResponse({ room }, 200);
    }

    const deleteRoomResult =
      deleteArchivedWaitingRoomRequestSchema.safeParse(payload);

    if (deleteRoomResult.success) {
      const deletedGameId = await deleteArchivedWaitingRoom(
        administrator.uid,
        deleteRoomResult.data,
        services,
      );

      return jsonResponse({ deletedGameId }, 200);
    }

    const removeParticipantResult =
      removeWaitingRoomParticipantRequestSchema.safeParse(payload);

    if (!removeParticipantResult.success) {
      throw new HttpError(
        400,
        "invalid-room-action",
        "Revise a ação solicitada para a sala.",
      );
    }

    const waitingRoom = await removeWaitingRoomParticipant(
      administrator.uid,
      removeParticipantResult.data,
      services,
    );

    return jsonResponse(waitingRoom, 200);
  } catch (error) {
    return handleError(error, "atualizar");
  }
}

function handleError(
  error: unknown,
  operation: "consultar" | "criar" | "atualizar",
) {
  if (isHttpError(error)) {
    return jsonResponse(
      { error: { code: error.code, message: error.message } },
      error.status,
    );
  }

  console.error(`Erro interno ao ${operation} sala de espera:`, error);

  return jsonResponse(
    {
      error: {
        code: "internal-error",
        message: `Não foi possível ${operation} a sala. Tente novamente.`,
      },
    },
    500,
  );
}
