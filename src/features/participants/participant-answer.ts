import type { User } from "firebase/auth";
import {
  participantAnswerQuerySchema,
  participantAnswerResponseSchema,
  submitParticipantAnswerRequestSchema,
  type ParticipantAnswerQuery,
  type ParticipantAnswerStatus,
  type SubmitParticipantAnswerRequest,
} from "../../shared/answer";
import { apiErrorResponseSchema } from "../../shared/waiting-room";

type ParticipantUser = Pick<User, "getIdToken">;

interface ParticipantAnswerDependencies {
  fetch: typeof fetch;
}

export class ParticipantAnswerRequestError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ParticipantAnswerRequestError";
    this.code = code;
  }
}

async function getParticipantToken(user: ParticipantUser): Promise<string> {
  try {
    return await user.getIdToken();
  } catch (error) {
    console.error("Não foi possível obter o token para responder:", error);
    throw new ParticipantAnswerRequestError(
      "participant-token-unavailable",
      "Não foi possível validar sua sessão. Atualize a página e tente novamente.",
    );
  }
}

async function requestAnswer(
  fetchImplementation: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetchImplementation(input, init);
  } catch (error) {
    console.error("Não foi possível acessar a API de respostas:", error);
    throw new ParticipantAnswerRequestError(
      "answer-api-unreachable",
      "Não foi possível enviar sua resposta. Verifique a conexão e tente novamente.",
    );
  }
}

async function readAnswerResponse(
  response: Response,
): Promise<ParticipantAnswerStatus> {
  let payload: unknown;

  try {
    payload = (await response.json()) as unknown;
  } catch {
    throw new ParticipantAnswerRequestError(
      "invalid-response",
      "O servidor retornou uma resposta inválida.",
    );
  }

  if (!response.ok) {
    const errorResult = apiErrorResponseSchema.safeParse(payload);
    throw new ParticipantAnswerRequestError(
      errorResult.success ? errorResult.data.error.code : "request-failed",
      errorResult.success
        ? errorResult.data.error.message
        : "Não foi possível processar sua resposta.",
    );
  }

  const result = participantAnswerResponseSchema.safeParse(payload);

  if (!result.success) {
    throw new ParticipantAnswerRequestError(
      "invalid-response",
      "O servidor retornou dados inválidos para a resposta.",
    );
  }

  return result.data.answer;
}

export async function submitAnswer(
  user: ParticipantUser,
  input: SubmitParticipantAnswerRequest,
  dependencies: Partial<ParticipantAnswerDependencies> = {},
): Promise<ParticipantAnswerStatus> {
  const parsedInput = submitParticipantAnswerRequestSchema.parse(input);
  const token = await getParticipantToken(user);
  const response = await requestAnswer(
    dependencies.fetch ?? fetch,
    "/api/answers",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(parsedInput),
    },
  );

  return readAnswerResponse(response);
}

export async function getAnswerStatus(
  user: ParticipantUser,
  input: ParticipantAnswerQuery,
  dependencies: Partial<ParticipantAnswerDependencies> = {},
): Promise<ParticipantAnswerStatus | null> {
  const parsedInput = participantAnswerQuerySchema.parse(input);
  const token = await getParticipantToken(user);
  const response = await requestAnswer(
    dependencies.fetch ?? fetch,
    `/api/answers?gameId=${encodeURIComponent(parsedInput.gameId)}&questionId=${encodeURIComponent(parsedInput.questionId)}`,
    {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    },
  );

  if (response.status === 404) {
    let payload: unknown;

    try {
      payload = (await response.clone().json()) as unknown;
    } catch {
      payload = null;
    }

    const errorResult = apiErrorResponseSchema.safeParse(payload);

    if (
      errorResult.success &&
      errorResult.data.error.code === "answer-not-found"
    ) {
      return null;
    }
  }

  return readAnswerResponse(response);
}
