import { authorizeAdministratorRequest } from "./_lib/administrator-authorization.js";
import { getFirebaseAdminServices } from "./_lib/firebase-admin.js";
import {
  createWaitingRoom,
  endWaitingRoom,
  getManagedWaitingRoom,
  listManagedWaitingRooms,
  removeWaitingRoomParticipant,
} from "./_lib/waiting-room-service.js";
import { removeWaitingRoomParticipantRequestSchema } from "../src/shared/participant.js";
import { endWaitingRoomRequestSchema } from "../src/shared/waiting-room.js";
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
    const room = await createWaitingRoom(administrator.uid, services);

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
    let payload: unknown;

    try {
      payload = await request.json();
    } catch {
      throw new HttpError(
        400,
        "invalid-json",
        "O corpo da requisição não contém um JSON válido.",
      );
    }

    const endRoomResult = endWaitingRoomRequestSchema.safeParse(payload);

    if (endRoomResult.success) {
      const endedGameId = await endWaitingRoom(
        administrator.uid,
        endRoomResult.data,
        services,
      );

      return jsonResponse({ endedGameId }, 200);
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
