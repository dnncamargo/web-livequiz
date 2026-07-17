import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "./_lib/http-error.js";
import { GET, PATCH, POST } from "./games.js";

const apiMocks = vi.hoisted(() => ({
  services: { name: "firebase-admin-services" },
  authorizeAdministratorRequest: vi.fn(),
  createWaitingRoom: vi.fn(),
  getManagedWaitingRoom: vi.fn(),
  removeWaitingRoomParticipant: vi.fn(),
}));

vi.mock("./_lib/firebase-admin.js", () => ({
  getFirebaseAdminServices: () => apiMocks.services,
}));

vi.mock("./_lib/administrator-authorization.js", () => ({
  authorizeAdministratorRequest: apiMocks.authorizeAdministratorRequest,
}));

vi.mock("./_lib/waiting-room-service.js", () => ({
  createWaitingRoom: apiMocks.createWaitingRoom,
  getManagedWaitingRoom: apiMocks.getManagedWaitingRoom,
  removeWaitingRoomParticipant: apiMocks.removeWaitingRoomParticipant,
}));

const room = {
  id: "ABC234",
  phase: "waiting",
  createdAt: 1_000,
  participantCount: 0,
} as const;

describe("/api/games", () => {
  beforeEach(() => {
    apiMocks.authorizeAdministratorRequest
      .mockReset()
      .mockResolvedValue({ uid: "administrador-1" });
    apiMocks.createWaitingRoom.mockReset().mockResolvedValue(room);
    apiMocks.getManagedWaitingRoom.mockReset().mockResolvedValue({
      room,
      participants: [],
    });
    apiMocks.removeWaitingRoomParticipant.mockReset().mockResolvedValue({
      room,
      participants: [],
    });
  });

  it("cria uma sala para o administrador validado", async () => {
    const request = new Request("https://quizumba.example/api/games", {
      method: "POST",
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ room });
    expect(apiMocks.createWaitingRoom).toHaveBeenCalledWith(
      "administrador-1",
      apiMocks.services,
    );
  });

  it("recupera uma sala específica e seus participantes", async () => {
    const response = await GET(
      new Request("https://quizumba.example/api/games?gameId=ABC234"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      room,
      participants: [],
    });
    expect(apiMocks.getManagedWaitingRoom).toHaveBeenCalledWith(
      "administrador-1",
      apiMocks.services,
      "ABC234",
    );
  });

  it("procura a sala ativa do administrador quando não há código", async () => {
    await GET(new Request("https://quizumba.example/api/games"));

    expect(apiMocks.getManagedWaitingRoom).toHaveBeenCalledWith(
      "administrador-1",
      apiMocks.services,
      undefined,
    );
  });

  it("não cria sala quando a autorização falha", async () => {
    apiMocks.authorizeAdministratorRequest.mockRejectedValue(
      new HttpError(
        403,
        "administrator-not-authorized",
        "Esta conta não está autorizada a criar salas.",
      ),
    );

    const response = await POST(
      new Request("https://quizumba.example/api/games", { method: "POST" }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "administrator-not-authorized" },
    });
    expect(apiMocks.createWaitingRoom).not.toHaveBeenCalled();
  });

  it("remove um participante da sala administrada", async () => {
    const request = new Request("https://quizumba.example/api/games", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        gameId: "ABC234",
        participantId: "participante-1",
        action: "remove",
      }),
    });

    const response = await PATCH(request);

    expect(response.status).toBe(200);
    expect(apiMocks.removeWaitingRoomParticipant).toHaveBeenCalledWith(
      "administrador-1",
      {
        gameId: "ABC234",
        participantId: "participante-1",
        action: "remove",
      },
      apiMocks.services,
    );
  });
});
