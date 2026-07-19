import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "./_lib/http-error.js";
import { GET, PATCH, POST } from "./games.js";

const apiMocks = vi.hoisted(() => ({
  services: { name: "firebase-admin-services" },
  advanceWaitingRoomGame: vi.fn(),
  associateWaitingRoomQuiz: vi.fn(),
  archiveWaitingRoom: vi.fn(),
  authorizeAdministratorRequest: vi.fn(),
  createWaitingRoom: vi.fn(),
  deleteArchivedWaitingRoom: vi.fn(),
  endWaitingRoom: vi.fn(),
  getManagedWaitingRoom: vi.fn(),
  listArchivedWaitingRooms: vi.fn(),
  listManagedWaitingRooms: vi.fn(),
  presentWaitingRoom: vi.fn(),
  removeWaitingRoomParticipant: vi.fn(),
  restoreWaitingRoom: vi.fn(),
}));

vi.mock("./_lib/firebase-admin.js", () => ({
  getFirebaseAdminServices: () => apiMocks.services,
}));

vi.mock("./_lib/administrator-authorization.js", () => ({
  authorizeAdministratorRequest: apiMocks.authorizeAdministratorRequest,
}));

vi.mock("./_lib/waiting-room-service.js", () => ({
  advanceWaitingRoomGame: apiMocks.advanceWaitingRoomGame,
  associateWaitingRoomQuiz: apiMocks.associateWaitingRoomQuiz,
  archiveWaitingRoom: apiMocks.archiveWaitingRoom,
  createWaitingRoom: apiMocks.createWaitingRoom,
  deleteArchivedWaitingRoom: apiMocks.deleteArchivedWaitingRoom,
  endWaitingRoom: apiMocks.endWaitingRoom,
  getManagedWaitingRoom: apiMocks.getManagedWaitingRoom,
  listArchivedWaitingRooms: apiMocks.listArchivedWaitingRooms,
  listManagedWaitingRooms: apiMocks.listManagedWaitingRooms,
  presentWaitingRoom: apiMocks.presentWaitingRoom,
  removeWaitingRoomParticipant: apiMocks.removeWaitingRoomParticipant,
  restoreWaitingRoom: apiMocks.restoreWaitingRoom,
}));

const room = {
  id: "ABC234",
  name: "Quiz de Ciências",
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
    apiMocks.advanceWaitingRoomGame.mockReset().mockResolvedValue({
      ...room,
      phase: "countdown",
      questionNumber: 1,
      totalQuestions: 1,
    });
    apiMocks.associateWaitingRoomQuiz.mockReset().mockResolvedValue({
      ...room,
      quizId: "quiz-1",
      quizTitle: "Ciências",
    });
    apiMocks.endWaitingRoom.mockReset().mockResolvedValue({
      ...room,
      phase: "finished",
    });
    apiMocks.presentWaitingRoom.mockReset().mockResolvedValue(room);
    apiMocks.getManagedWaitingRoom.mockReset().mockResolvedValue({
      room,
      participants: [],
    });
    apiMocks.removeWaitingRoomParticipant.mockReset().mockResolvedValue({
      room,
      participants: [],
    });
    apiMocks.listManagedWaitingRooms.mockReset().mockResolvedValue([room]);
    apiMocks.listArchivedWaitingRooms.mockReset().mockResolvedValue([]);
    apiMocks.archiveWaitingRoom.mockReset().mockResolvedValue({
      id: "ABC234",
      name: "Quiz de Ciências",
      createdAt: 1_000,
      archivedAt: 2_000,
      participantCount: 0,
    });
    apiMocks.restoreWaitingRoom.mockReset().mockResolvedValue({
      ...room,
      phase: "finished",
    });
    apiMocks.deleteArchivedWaitingRoom.mockReset().mockResolvedValue("ABC234");
  });

  it("cria uma sala para o administrador validado", async () => {
    const request = new Request("https://quizumba.example/api/games", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Quiz de Ciências" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ room });
    expect(apiMocks.createWaitingRoom).toHaveBeenCalledWith(
      "administrador-1",
      { name: "Quiz de Ciências" },
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

  it("lista a biblioteca de salas do administrador", async () => {
    const response = await GET(
      new Request("https://quizumba.example/api/games?scope=library"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ rooms: [room] });
    expect(apiMocks.listManagedWaitingRooms).toHaveBeenCalledWith(
      "administrador-1",
      apiMocks.services,
    );
  });

  it("lista as salas arquivadas do administrador", async () => {
    const response = await GET(
      new Request("https://quizumba.example/api/games?scope=archived"),
    );

    expect(response.status).toBe(200);
    expect(apiMocks.listArchivedWaitingRooms).toHaveBeenCalledWith(
      "administrador-1",
      apiMocks.services,
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
      new Request("https://quizumba.example/api/games", {
        method: "POST",
        body: JSON.stringify({ name: "Quiz de Ciências" }),
      }),
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

  it("troca o quiz associado à sala administrada", async () => {
    const response = await PATCH(
      new Request("https://quizumba.example/api/games", {
        method: "PATCH",
        body: JSON.stringify({
          gameId: "ABC234",
          action: "associate-quiz",
          quizId: "quiz-1",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(apiMocks.associateWaitingRoomQuiz).toHaveBeenCalledWith(
      "administrador-1",
      {
        gameId: "ABC234",
        action: "associate-quiz",
        quizId: "quiz-1",
      },
      apiMocks.services,
    );
  });

  it("avança a fase da partida administrada", async () => {
    const response = await PATCH(
      new Request("https://quizumba.example/api/games", {
        method: "PATCH",
        body: JSON.stringify({
          gameId: "ABC234",
          action: "advance-game",
          expectedPhase: "waiting",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(apiMocks.advanceWaitingRoomGame).toHaveBeenCalledWith(
      "administrador-1",
      {
        gameId: "ABC234",
        action: "advance-game",
        expectedPhase: "waiting",
      },
      apiMocks.services,
    );
  });

  it("encerra uma sala administrada", async () => {
    const request = new Request("https://quizumba.example/api/games", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gameId: "ABC234", action: "end-room" }),
    });

    const response = await PATCH(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      room: { ...room, phase: "finished" },
    });
    expect(apiMocks.endWaitingRoom).toHaveBeenCalledWith(
      "administrador-1",
      { gameId: "ABC234", action: "end-room" },
      apiMocks.services,
    );
    expect(apiMocks.removeWaitingRoomParticipant).not.toHaveBeenCalled();
  });

  it.each([
    ["present-room", "presentWaitingRoom"],
    ["archive-room", "archiveWaitingRoom"],
    ["restore-room", "restoreWaitingRoom"],
    ["delete-room", "deleteArchivedWaitingRoom"],
  ] as const)(
    "encaminha a ação %s para o serviço correto",
    async (action, mockName) => {
      const response = await PATCH(
        new Request("https://quizumba.example/api/games", {
          method: "PATCH",
          body: JSON.stringify({ gameId: "ABC234", action }),
        }),
      );

      expect(response.status).toBe(200);
      expect(apiMocks[mockName]).toHaveBeenCalledWith(
        "administrador-1",
        { gameId: "ABC234", action },
        apiMocks.services,
      );
    },
  );
});
