import type { User } from "firebase/auth";
import {
  createQuizRequestSchema,
  quizListResponseSchema,
  quizResponseSchema,
  type CreateQuizRequest,
  type Quiz,
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

async function requestQuizzes(
  user: User,
  init?: RequestInit,
): Promise<unknown> {
  const idToken = await user.getIdToken();
  let response: Response;

  try {
    response = await fetch("/api/quizzes", {
      ...init,
      headers: {
        authorization: `Bearer ${idToken}`,
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch (error) {
    console.error("Falha ao acessar a API de quizzes:", error);
    throw new QuizLibraryRequestError(
      "quiz-api-unreachable",
      "Não foi possível conectar ao servidor de quizzes.",
    );
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
