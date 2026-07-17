import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createWaitingRoom,
  getManagedWaitingRoom,
  subscribeToPublicWaitingRoom,
  WaitingRoomRequestError,
} from "./waiting-room";

const databaseMocks = vi.hoisted(() => ({
  database: { name: "realtime-database" },
  reference: { path: "publicGames/ABC234" },
  ref: vi.fn(),
  onValue: vi.fn(),
  unsubscribe: vi.fn(),
  valueCallback: null as null | ((snapshot: unknown) => void),
  errorCallback: null as null | ((error: unknown) => void),
}));

vi.mock("../../lib/firebase", () => ({
  realtimeDatabase: databaseMocks.database,
}));

vi.mock("firebase/database", () => ({
  ref: databaseMocks.ref,
  onValue: databaseMocks.onValue,
}));

describe("cliente da sala de espera", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    databaseMocks.ref.mockReset().mockReturnValue(databaseMocks.reference);
    databaseMocks.unsubscribe.mockReset();
    databaseMocks.valueCallback = null;
    databaseMocks.errorCallback = null;
    databaseMocks.onValue.mockReset().mockImplementation((_, next, error) => {
      databaseMocks.valueCallback = next;
      databaseMocks.errorCallback = error;
      return databaseMocks.unsubscribe;
    });
  });

  it("envia o token e valida a sala criada", async () => {
    const getIdToken = vi.fn().mockResolvedValue("token-administrativo");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          room: {
            id: "ABC234",
            phase: "waiting",
            createdAt: 1_000,
            participantCount: 0,
          },
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(createWaitingRoom({ getIdToken })).resolves.toMatchObject({
      id: "ABC234",
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/games", {
      method: "POST",
      headers: { authorization: "Bearer token-administrativo" },
    });
  });

  it("preserva a mensagem de erro segura retornada pela API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "administrator-not-authorized",
              message: "Esta conta não está autorizada a criar salas.",
            },
          }),
          { status: 403, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    await expect(
      createWaitingRoom({ getIdToken: vi.fn().mockResolvedValue("token") }),
    ).rejects.toEqual(
      new WaitingRoomRequestError(
        "administrator-not-authorized",
        "Esta conta não está autorizada a criar salas.",
      ),
    );
  });

  it("recupera a sala administrativa e seus participantes", async () => {
    const getIdToken = vi.fn().mockResolvedValue("token-administrativo");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          room: {
            id: "ABC234",
            phase: "waiting",
            createdAt: 1_000,
            participantCount: 1,
          },
          participants: [
            {
              participantId: "participante-1",
              nickname: "Estrela Azul",
              moderationStatus: "waiting-approval",
              joinedAt: 2_000,
              presenceStatus: "connected",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getManagedWaitingRoom({ getIdToken }, "ABC234"),
    ).resolves.toMatchObject({
      room: { id: "ABC234" },
      participants: [{ nickname: "Estrela Azul" }],
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/games?gameId=ABC234", {
      method: "GET",
      headers: { authorization: "Bearer token-administrativo" },
    });
  });

  it("explica quando o Vite devolve a aplicação no lugar da API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<!doctype html><html></html>", {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      ),
    );

    await expect(
      createWaitingRoom({ getIdToken: vi.fn().mockResolvedValue("token") }),
    ).rejects.toEqual(
      new WaitingRoomRequestError(
        "api-unavailable",
        "A API de criação de salas não está disponível neste ambiente. Publique a versão atual na Vercel e tente novamente.",
      ),
    );
  });

  it("acompanha e valida a projeção pública", () => {
    const onRoomChange = vi.fn();
    const onError = vi.fn();

    const unsubscribe = subscribeToPublicWaitingRoom(
      "ABC234",
      onRoomChange,
      onError,
    );

    expect(databaseMocks.ref).toHaveBeenCalledWith(
      databaseMocks.database,
      "publicGames/ABC234",
    );
    databaseMocks.valueCallback?.({
      exists: () => true,
      val: () => ({
        id: "ABC234",
        phase: "waiting",
        createdAt: 1_000,
        participantCount: 0,
      }),
    });
    expect(onRoomChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: "ABC234" }),
    );
    expect(onError).not.toHaveBeenCalled();
    expect(unsubscribe).toBe(databaseMocks.unsubscribe);
  });

  it("rejeita código inválido antes de acessar o banco", () => {
    expect(() =>
      subscribeToPublicWaitingRoom("../../segredo", vi.fn(), vi.fn()),
    ).toThrow();
    expect(databaseMocks.ref).not.toHaveBeenCalled();
  });
});
