import type { User } from "firebase/auth";
import {
  joinParticipantRequestSchema,
  participantSessionResponseSchema,
  type JoinParticipantRequest,
  type ParticipantSession,
} from "../../shared/participant";
import { apiErrorResponseSchema } from "../../shared/waiting-room";

const ACTIVE_GAME_STORAGE_KEY = "quizumba.activeGameId";

type ParticipantUser = Pick<User, "getIdToken">;

interface ParticipantSessionDependencies {
  fetch: typeof fetch;
  storage: Pick<Storage, "getItem" | "removeItem" | "setItem"> | null;
}

export class ParticipantSessionRequestError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ParticipantSessionRequestError";
    this.code = code;
  }
}

function getBrowserStorage(): ParticipantSessionDependencies["storage"] {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function getDependencies(
  dependencies: Partial<ParticipantSessionDependencies>,
): ParticipantSessionDependencies {
  return {
    fetch: dependencies.fetch ?? fetch,
    storage:
      dependencies.storage === undefined
        ? getBrowserStorage()
        : dependencies.storage,
  };
}

async function getParticipantToken(user: ParticipantUser): Promise<string> {
  try {
    return await user.getIdToken();
  } catch (error) {
    console.error("Não foi possível obter o token do participante:", error);

    throw new ParticipantSessionRequestError(
      "participant-token-unavailable",
      "Não foi possível validar sua sessão anônima. Atualize a página e tente novamente.",
    );
  }
}

async function fetchParticipant(
  fetchImplementation: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetchImplementation(input, init);
  } catch (error) {
    console.error("Não foi possível acessar a API de participantes:", error);

    throw new ParticipantSessionRequestError(
      "participant-api-unreachable",
      "Não foi possível conectar ao servidor de participantes. Verifique a conexão e tente novamente.",
    );
  }
}

async function readPayload(response: Response): Promise<unknown> {
  const responseText = await response.text();

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    throw new ParticipantSessionRequestError(
      "invalid-response",
      "O servidor retornou uma resposta inválida.",
    );
  }
}

async function readParticipantResponse(
  response: Response,
): Promise<ParticipantSession> {
  const payload = await readPayload(response);

  if (!response.ok) {
    const errorResult = apiErrorResponseSchema.safeParse(payload);

    throw new ParticipantSessionRequestError(
      errorResult.success ? errorResult.data.error.code : "request-failed",
      errorResult.success
        ? errorResult.data.error.message
        : "Não foi possível concluir sua entrada. Tente novamente.",
    );
  }

  const result = participantSessionResponseSchema.safeParse(payload);

  if (!result.success) {
    throw new ParticipantSessionRequestError(
      "invalid-response",
      "O servidor retornou dados inválidos para o participante.",
    );
  }

  return result.data.participant;
}

function saveActiveGame(
  storage: ParticipantSessionDependencies["storage"],
  gameId: string,
) {
  try {
    storage?.setItem(ACTIVE_GAME_STORAGE_KEY, gameId);
  } catch (error) {
    console.error("Não foi possível salvar a sala ativa no navegador:", error);
  }
}

export function clearActiveParticipantSession(
  storage: ParticipantSessionDependencies["storage"] = getBrowserStorage(),
) {
  try {
    storage?.removeItem(ACTIVE_GAME_STORAGE_KEY);
  } catch (error) {
    console.error("Não foi possível limpar a sala ativa do navegador:", error);
  }
}

export async function joinParticipantSession(
  user: ParticipantUser,
  input: JoinParticipantRequest,
  providedDependencies: Partial<ParticipantSessionDependencies> = {},
): Promise<ParticipantSession> {
  const dependencies = getDependencies(providedDependencies);
  const inputResult = joinParticipantRequestSchema.safeParse(input);

  if (!inputResult.success) {
    throw new ParticipantSessionRequestError(
      "invalid-participant-data",
      inputResult.error.issues[0]?.message ?? "Revise os dados informados.",
    );
  }

  const idToken = await getParticipantToken(user);
  const response = await fetchParticipant(
    dependencies.fetch,
    "/api/participants",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${idToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(inputResult.data),
    },
  );
  const participant = await readParticipantResponse(response);

  saveActiveGame(dependencies.storage, participant.gameId);

  return participant;
}

export async function restoreParticipantSession(
  user: ParticipantUser,
  providedDependencies: Partial<ParticipantSessionDependencies> = {},
): Promise<ParticipantSession | null> {
  const dependencies = getDependencies(providedDependencies);
  let gameId: string | null = null;

  try {
    gameId = dependencies.storage?.getItem(ACTIVE_GAME_STORAGE_KEY) ?? null;
  } catch (error) {
    console.error(
      "Não foi possível recuperar a sala ativa do navegador:",
      error,
    );
  }

  if (!gameId) {
    return null;
  }

  const idToken = await getParticipantToken(user);
  const response = await fetchParticipant(
    dependencies.fetch,
    `/api/participants?gameId=${encodeURIComponent(gameId)}`,
    {
      method: "GET",
      headers: { authorization: `Bearer ${idToken}` },
    },
  );

  try {
    return await readParticipantResponse(response);
  } catch (error) {
    if (
      error instanceof ParticipantSessionRequestError &&
      (error.code === "participant-not-found" ||
        error.code === "room-not-found")
    ) {
      clearActiveParticipantSession(dependencies.storage);
      return null;
    }

    throw error;
  }
}
