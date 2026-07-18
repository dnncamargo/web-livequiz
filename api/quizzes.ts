import { ZodError } from "zod";
import { createQuizRequestSchema } from "../src/shared/quiz.js";
import { authorizeAdministratorRequest } from "./_lib/administrator-authorization.js";
import { getFirebaseAdminServices } from "./_lib/firebase-admin.js";
import { HttpError } from "./_lib/http-error.js";
import { createQuiz, listQuizzes } from "./_lib/quiz-service.js";

function jsonResponse(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
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
          code: "invalid-quiz-data",
          message: error.issues[0]?.message ?? "Revise os dados do quiz.",
        },
      },
      400,
    );
  }

  console.error("Erro interno no fluxo de quizzes:", error);
  return jsonResponse(
    {
      error: {
        code: "internal-error",
        message: "Não foi possível concluir a operação com o quiz.",
      },
    },
    500,
  );
}

export async function GET(request: Request): Promise<Response> {
  try {
    const services = getFirebaseAdminServices();
    const administrator = await authorizeAdministratorRequest(
      request,
      services,
    );
    const quizzes = await listQuizzes(administrator.uid, services);

    return jsonResponse({ quizzes }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const services = getFirebaseAdminServices();
    const administrator = await authorizeAdministratorRequest(
      request,
      services,
    );
    const input = createQuizRequestSchema.parse(await readJsonBody(request));
    const quiz = await createQuiz(administrator.uid, input, services);

    return jsonResponse({ quiz }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
