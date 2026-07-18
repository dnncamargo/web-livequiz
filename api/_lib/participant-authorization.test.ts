import { describe, expect, it, vi } from "vitest";
import type { FirebaseAdminServices } from "./firebase-admin.js";
import { authorizeParticipantRequest } from "./participant-authorization.js";

function createServices(decodedToken: unknown): FirebaseAdminServices {
  return {
    verifyIdToken: vi.fn().mockResolvedValue(decodedToken),
    getAdministratorProfile: vi.fn(),
    checkRealtimeDatabaseConnection: vi.fn(),
    claimWaitingRoom: vi.fn(),
    publishWaitingRoom: vi.fn(),
    removeWaitingRoom: vi.fn(),
    getWaitingRoom: vi.fn(),
    findActiveWaitingRoom: vi.fn(),
    findWaitingRooms: vi.fn(),
    setWaitingRoomPhase: vi.fn(),
    saveArchivedWaitingRoom: vi.fn(),
    getArchivedWaitingRooms: vi.fn(),
    getArchivedWaitingRoom: vi.fn(),
    deleteArchivedWaitingRoom: vi.fn(),
    registerParticipant: vi.fn(),
    getParticipant: vi.fn(),
    publishParticipantCount: vi.fn(),
    removeParticipant: vi.fn(),
  };
}

function createRequest() {
  return new Request("https://quizumba.example/api/participants", {
    method: "POST",
    headers: { authorization: "Bearer token-participante" },
  });
}

describe("authorizeParticipantRequest", () => {
  it("autoriza somente uma identidade anônima", async () => {
    const services = createServices({
      uid: "participante-1",
      firebase: { sign_in_provider: "anonymous" },
    });

    await expect(
      authorizeParticipantRequest(createRequest(), services),
    ).resolves.toEqual({ uid: "participante-1" });
  });

  it("rejeita uma conta Google", async () => {
    const services = createServices({
      uid: "administrador-1",
      firebase: { sign_in_provider: "google.com" },
    });

    await expect(
      authorizeParticipantRequest(createRequest(), services),
    ).rejects.toMatchObject({
      status: 403,
      code: "anonymous-participant-required",
    });
  });
});
