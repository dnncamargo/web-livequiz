import { authorizeAdministratorRequest } from "./_lib/administrator-authorization.js";
import { getFirebaseAdminServices } from "./_lib/firebase-admin.js";
import {
  createWaitingRoom,
  getManagedWaitingRoom,
} from "./_lib/waiting-room-service.js";

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
    const gameId = new URL(request.url).searchParams.get("gameId") ?? undefined;
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

function handleError(error: unknown, operation: "consultar" | "criar") {
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
