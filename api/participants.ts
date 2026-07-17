import { ZodError } from "zod";
import {
  joinParticipantRequestSchema,
  participantGameCodeSchema,
} from "../src/shared/participant.js";
import { getFirebaseAdminServices } from "./_lib/firebase-admin.js";
import { HttpError } from "./_lib/http-error.js";
import { authorizeParticipantRequest } from "./_lib/participant-authorization.js";
import {
  getParticipantSession,
  joinWaitingRoom,
} from "./_lib/participant-service.js";

function jsonResponse(body: unknown, status: number, headers?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return jsonResponse(
      { error: { code: error.code, message: error.message } },
      error.status,
    );
  }

  if (error instanceof ZodError) {
    return jsonResponse(
      {
        error: {
          code: "invalid-participant-data",
          message: error.issues[0]?.message ?? "Revise os dados informados.",
        },
      },
      400,
    );
  }

  console.error("Erro interno no fluxo do participante:", error);

  return jsonResponse(
    {
      error: {
        code: "internal-error",
        message: "Não foi possível concluir sua entrada. Tente novamente.",
      },
    },
    500,
  );
}

export async function GET(request: Request): Promise<Response> {
  try {
    const services = getFirebaseAdminServices();
    const participant = await authorizeParticipantRequest(request, services);
    const gameId = participantGameCodeSchema.parse(
      new URL(request.url).searchParams.get("gameId") ?? "",
    );
    const session = await getParticipantSession(
      gameId,
      participant.uid,
      services,
    );

    return jsonResponse({ participant: session }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const services = getFirebaseAdminServices();
    const participant = await authorizeParticipantRequest(request, services);
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

    const input = joinParticipantRequestSchema.parse(payload);
    const session = await joinWaitingRoom(participant.uid, input, services);

    return jsonResponse({ participant: session }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
