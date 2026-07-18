import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  joinParticipantSession,
  ParticipantSessionRequestError,
  restoreParticipantSession,
} from "./participant-session";

function createStorage() {
  const values = new Map<string, string>();

  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    removeItem: vi.fn((key: string) => values.delete(key)),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  };
}

const user = { getIdToken: vi.fn() };
const participant = {
  gameId: "ABC234",
  participantId: "participante-1",
  nickname: "Estrela Azul",
  avatar: "🦊",
  moderationStatus: "waiting-approval",
  joinedAt: 1_000,
};

describe("sessão do participante", () => {
  beforeEach(() => {
    user.getIdToken.mockReset().mockResolvedValue("token-participante");
  });

  it("envia nickname normalizado e salva somente o código da sala", async () => {
    const storage = createStorage();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ participant }), { status: 201 }),
      );

    await expect(
      joinParticipantSession(
        user,
        { gameId: "abc234", nickname: "  Estrela   Azul ", avatar: "🦊" },
        { fetch: fetchMock, storage },
      ),
    ).resolves.toEqual(participant);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/participants",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          gameId: "ABC234",
          nickname: "Estrela Azul",
          avatar: "🦊",
        }),
      }),
    );
    expect(storage.setItem).toHaveBeenCalledWith(
      "quizumba.activeGameId",
      "ABC234",
    );
  });

  it("restaura os dados autoritativos do servidor após atualização", async () => {
    const storage = createStorage();
    storage.setItem("quizumba.activeGameId", "ABC234");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ participant }), { status: 200 }),
      );

    await expect(
      restoreParticipantSession(user, { fetch: fetchMock, storage }),
    ).resolves.toEqual(participant);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/participants?gameId=ABC234",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("limpa a referência local quando o registro não existe mais", async () => {
    const storage = createStorage();
    storage.setItem("quizumba.activeGameId", "ABC234");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "participant-not-found",
            message: "Participação não encontrada.",
          },
        }),
        { status: 404 },
      ),
    );

    await expect(
      restoreParticipantSession(user, { fetch: fetchMock, storage }),
    ).resolves.toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith("quizumba.activeGameId");
  });

  it("não restaura uma participação removida", async () => {
    const storage = createStorage();
    storage.setItem("quizumba.activeGameId", "ABC234");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          participant: { ...participant, moderationStatus: "removed" },
        }),
        { status: 200 },
      ),
    );

    await expect(
      restoreParticipantSession(user, { fetch: fetchMock, storage }),
    ).resolves.toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith("quizumba.activeGameId");
  });

  it("distingue falha ao obter o token anônimo", async () => {
    user.getIdToken.mockRejectedValue(new Error("token indisponível"));

    await expect(
      joinParticipantSession(
        user,
        { gameId: "ABC234", nickname: "Cometa", avatar: "🦊" },
        { fetch: vi.fn(), storage: createStorage() },
      ),
    ).rejects.toEqual(
      new ParticipantSessionRequestError(
        "participant-token-unavailable",
        "Não foi possível validar sua sessão anônima. Atualize a página e tente novamente.",
      ),
    );
  });

  it("distingue falha de conexão com a API de participantes", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("falha de rede"));

    await expect(
      joinParticipantSession(
        user,
        { gameId: "ABC234", nickname: "Cometa", avatar: "🦊" },
        { fetch: fetchMock, storage: createStorage() },
      ),
    ).rejects.toEqual(
      new ParticipantSessionRequestError(
        "participant-api-unreachable",
        "Não foi possível conectar ao servidor de participantes. Verifique a conexão e tente novamente.",
      ),
    );
  });
});
