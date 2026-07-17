import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  joinParticipantSession,
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
        { gameId: "abc234", nickname: "  Estrela   Azul " },
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
});
