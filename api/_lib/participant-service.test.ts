import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FirebaseAdminServices } from "./firebase-admin.js";
import {
  getParticipantSession,
  joinWaitingRoom,
} from "./participant-service.js";

function createServices(): FirebaseAdminServices {
  return {
    verifyIdToken: vi.fn(),
    getAdministratorProfile: vi.fn(),
    checkRealtimeDatabaseConnection: vi.fn(),
    claimWaitingRoom: vi.fn(),
    publishWaitingRoom: vi.fn(),
    removeWaitingRoom: vi.fn(),
    getWaitingRoom: vi.fn(),
    findActiveWaitingRoom: vi.fn(),
    registerParticipant: vi.fn(),
    getParticipant: vi.fn(),
    publishParticipantCount: vi.fn(),
  };
}

describe("serviço de participante", () => {
  let services: FirebaseAdminServices;

  beforeEach(() => {
    services = createServices();
  });

  it("registra nickname e publica a contagem calculada no servidor", async () => {
    vi.mocked(services.registerParticipant).mockResolvedValue({
      outcome: "joined",
      participant: {
        nickname: "Estrela Azul",
        moderationStatus: "waiting-approval",
        joinedAt: 1_000,
      },
      participantCount: 3,
    });

    await expect(
      joinWaitingRoom(
        "participante-1",
        { gameId: "ABC234", nickname: "Estrela Azul" },
        services,
        () => 1_000,
      ),
    ).resolves.toMatchObject({
      gameId: "ABC234",
      participantId: "participante-1",
      nickname: "Estrela Azul",
      moderationStatus: "waiting-approval",
    });
    expect(services.publishParticipantCount).toHaveBeenCalledWith("ABC234", 3);
  });

  it("rejeita nickname já utilizado sem publicar contagem", async () => {
    vi.mocked(services.registerParticipant).mockResolvedValue({
      outcome: "nickname-taken",
      participant: null,
      participantCount: 0,
    });

    await expect(
      joinWaitingRoom(
        "participante-1",
        { gameId: "ABC234", nickname: "Estrela Azul" },
        services,
      ),
    ).rejects.toMatchObject({ status: 409, code: "nickname-taken" });
    expect(services.publishParticipantCount).not.toHaveBeenCalled();
  });

  it("restaura somente o registro pertencente ao UID autenticado", async () => {
    vi.mocked(services.getParticipant).mockResolvedValue({
      nickname: "Cometa",
      moderationStatus: "approved",
      joinedAt: 1_000,
    });

    await expect(
      getParticipantSession("ABC234", "participante-1", services),
    ).resolves.toMatchObject({
      gameId: "ABC234",
      participantId: "participante-1",
      nickname: "Cometa",
    });
    expect(services.getParticipant).toHaveBeenCalledWith(
      "ABC234",
      "participante-1",
    );
  });
});
