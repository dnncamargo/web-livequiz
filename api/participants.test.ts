import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./participants.js";

const participantApiMocks = vi.hoisted(() => ({
  authorizeParticipantRequest: vi.fn(),
  getFirebaseAdminServices: vi.fn(),
  getParticipantSession: vi.fn(),
  joinWaitingRoom: vi.fn(),
  services: { name: "firebase-admin-services" },
}));

vi.mock("./_lib/firebase-admin.js", () => ({
  getFirebaseAdminServices: participantApiMocks.getFirebaseAdminServices,
}));

vi.mock("./_lib/participant-authorization.js", () => ({
  authorizeParticipantRequest: participantApiMocks.authorizeParticipantRequest,
}));

vi.mock("./_lib/participant-service.js", () => ({
  getParticipantSession: participantApiMocks.getParticipantSession,
  joinWaitingRoom: participantApiMocks.joinWaitingRoom,
}));

const participantSession = {
  gameId: "ABC234",
  participantId: "participante-1",
  nickname: "Estrela Azul",
  avatar: "🦊",
  moderationStatus: "waiting-approval",
  joinedAt: 1_000,
};

describe("/api/participants", () => {
  beforeEach(() => {
    participantApiMocks.getFirebaseAdminServices
      .mockReset()
      .mockReturnValue(participantApiMocks.services);
    participantApiMocks.authorizeParticipantRequest
      .mockReset()
      .mockResolvedValue({ uid: "participante-1" });
    participantApiMocks.joinWaitingRoom
      .mockReset()
      .mockResolvedValue(participantSession);
    participantApiMocks.getParticipantSession
      .mockReset()
      .mockResolvedValue(participantSession);
  });

  it("registra nickname para o UID anônimo validado", async () => {
    const response = await POST(
      new Request("https://quizumba.example/api/participants", {
        method: "POST",
        headers: {
          authorization: "Bearer token-participante",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          gameId: " abc234 ",
          nickname: " Estrela   Azul ",
          avatar: "🦊",
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      participant: participantSession,
    });
    expect(participantApiMocks.joinWaitingRoom).toHaveBeenCalledWith(
      "participante-1",
      { gameId: "ABC234", nickname: "Estrela Azul", avatar: "🦊" },
      participantApiMocks.services,
    );
  });

  it("restaura a participação usando o UID do token", async () => {
    const response = await GET(
      new Request("https://quizumba.example/api/participants?gameId=ABC234", {
        headers: { authorization: "Bearer token-participante" },
      }),
    );

    expect(response.status).toBe(200);
    expect(participantApiMocks.getParticipantSession).toHaveBeenCalledWith(
      "ABC234",
      "participante-1",
      participantApiMocks.services,
    );
  });

  it("rejeita corpo malformado antes de criar participante", async () => {
    const response = await POST(
      new Request("https://quizumba.example/api/participants", {
        method: "POST",
        headers: { authorization: "Bearer token-participante" },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "invalid-json" },
    });
    expect(participantApiMocks.joinWaitingRoom).not.toHaveBeenCalled();
  });
});
