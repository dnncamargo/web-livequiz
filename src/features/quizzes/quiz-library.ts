import type { User } from "firebase/auth";
import {
  createQuizRequestSchema,
  changeQuizStatusRequestSchema,
  quizDetailResponseSchema,
  quizIdSchema,
  quizListResponseSchema,
  quizResponseSchema,
  updateQuizContentRequestSchema,
  type CreateQuizRequest,
  type ChangeQuizStatusRequest,
  type Quiz,
  type QuizDetail,
  type UpdateQuizContentRequest,
} from "../../shared/quiz";
import { apiErrorResponseSchema } from "../../shared/waiting-room";

export class QuizLibraryRequestError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "QuizLibraryRequestError";
    this.code = code;
  }
}

const QUIZ_REQUEST_TIMEOUT_MS = 15_000;

async function requestQuizzes(
  user: User,
  init?: RequestInit,
  endpoint = "/api/quizzes",
): Promise<unknown> {
  const idToken = await user.getIdToken();
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    QUIZ_REQUEST_TIMEOUT_MS,
  );
  let response: Response;

  try {
    response = await fetch(endpoint, {
      ...init,
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${idToken}`,
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch (error) {
    console.error("Falha ao acessar a API de quizzes:", error);
    throw new QuizLibraryRequestError(
      controller.signal.aborted
        ? "quiz-request-timeout"
        : "quiz-api-unreachable",
      controller.signal.aborted
        ? "O servidor de quizzes demorou demais para responder. Tente novamente."
        : "Não foi possível conectar ao servidor de quizzes.",
    );
  } finally {
    globalThis.clearTimeout(timeout);
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const errorResult = apiErrorResponseSchema.safeParse(payload);
    throw new QuizLibraryRequestError(
      errorResult.success ? errorResult.data.error.code : "quiz-request-failed",
      errorResult.success
        ? errorResult.data.error.message
        : "Não foi possível concluir a operação com o quiz.",
    );
  }

  return payload;
}

export async function listQuizLibrary(user: User): Promise<Quiz[]> {
  const result = quizListResponseSchema.safeParse(await requestQuizzes(user));

  if (!result.success) {
    throw new QuizLibraryRequestError(
      "invalid-quiz-response",
      "O servidor retornou uma biblioteca de quizzes inválida.",
    );
  }

  return result.data.quizzes;
}

export async function createQuizDraft(
  user: User,
  input: CreateQuizRequest,
): Promise<Quiz> {
  const parsedInput = createQuizRequestSchema.parse(input);
  const result = quizResponseSchema.safeParse(
    await requestQuizzes(user, {
      method: "POST",
      body: JSON.stringify(parsedInput),
    }),
  );

  if (!result.success) {
    throw new QuizLibraryRequestError(
      "invalid-quiz-response",
      "O servidor retornou um quiz inválido.",
    );
  }

  return result.data.quiz;
}

export async function changeQuizDraftStatus(
  user: User,
  input: ChangeQuizStatusRequest,
): Promise<Quiz> {
  const parsedInput = changeQuizStatusRequestSchema.parse(input);
  const result = quizResponseSchema.safeParse(
    await requestQuizzes(user, {
      method: "PATCH",
      body: JSON.stringify(parsedInput),
    }),
  );

  if (!result.success) {
    throw new QuizLibraryRequestError(
      "invalid-quiz-response",
      "O servidor retornou um quiz inválido.",
    );
  }

  return result.data.quiz;
}

export async function getQuizDetail(
  user: User,
  quizId: string,
): Promise<QuizDetail> {
  const parsedQuizId = quizIdSchema.parse(quizId);
  const result = quizDetailResponseSchema.safeParse(
    await requestQuizzes(
      user,
      { method: "GET" },
      `/api/quizzes?quizId=${encodeURIComponent(parsedQuizId)}`,
    ),
  );

  if (!result.success) {
    throw new QuizLibraryRequestError(
      "invalid-quiz-response",
      "O servidor retornou um quiz inválido para edição.",
    );
  }

  return result.data.quiz;
}

export async function saveQuizContent(
  user: User,
  input: UpdateQuizContentRequest,
): Promise<QuizDetail> {
  const parsedInput = updateQuizContentRequestSchema.parse(input);
  const result = quizDetailResponseSchema.safeParse(
    await requestQuizzes(user, {
      method: "PUT",
      body: JSON.stringify(parsedInput),
    }),
  );

  if (!result.success) {
    throw new QuizLibraryRequestError(
      "invalid-quiz-response",
      "O servidor retornou dados inválidos após salvar o quiz.",
    );
  }

  return result.data.quiz;
}
