import { ZodError } from "zod";
import {
  participantAnswerQuerySchema,
  submitParticipantAnswerRequestSchema,
} from "../src/shared/answer.js";
import {
  getParticipantAnswerStatus,
  submitParticipantAnswer,
} from "./_lib/answer-service.js";
import { getFirebaseAdminServices } from "./_lib/firebase-admin.js";
import { HttpError } from "./_lib/http-error.js";
import { authorizeParticipantRequest } from "./_lib/participant-authorization.js";

function jsonResponse(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
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
          code: "invalid-answer-data",
          message: error.issues[0]?.message ?? "Revise a resposta enviada.",
        },
      },
      400,
    );
  }

  console.error("Erro interno no fluxo de respostas:", error);

  return jsonResponse(
    {
      error: {
        code: "internal-error",
        message: "Não foi possível processar sua resposta. Tente novamente.",
      },
    },
    500,
  );
}

export async function GET(request: Request): Promise<Response> {
  try {
    const services = getFirebaseAdminServices();
    const participant = await authorizeParticipantRequest(request, services);
    const searchParams = new URL(request.url).searchParams;
    const input = participantAnswerQuerySchema.parse({
      gameId: searchParams.get("gameId") ?? "",
      questionId: searchParams.get("questionId") ?? "",
    });
    const answer = await getParticipantAnswerStatus(
      participant.uid,
      input,
      services,
    );

    return jsonResponse({ answer }, 200);
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

    const input = submitParticipantAnswerRequestSchema.parse(payload);
    const result = await submitParticipantAnswer(
      participant.uid,
      input,
      services,
    );

    return jsonResponse({ answer: result.answer }, result.created ? 201 : 200);
  } catch (error) {
    return errorResponse(error);
  }
}
