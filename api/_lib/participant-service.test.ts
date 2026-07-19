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
    createQuiz: vi.fn(),
    findQuizzes: vi.fn(),
    getQuiz: vi.fn(),
    updateQuizStatus: vi.fn(),
    updateQuizContent: vi.fn(),
    detachQuizFromWaitingRooms: vi.fn(),
    syncQuizTitleWithWaitingRooms: vi.fn(),
    claimWaitingRoom: vi.fn(),
    publishWaitingRoom: vi.fn(),
    removeWaitingRoom: vi.fn(),
    getWaitingRoom: vi.fn(),
    findActiveWaitingRoom: vi.fn(),
    findWaitingRooms: vi.fn(),
    setWaitingRoomPresentationStatus: vi.fn(),
    setWaitingRoomQuiz: vi.fn(),
    setWaitingRoomGameState: vi.fn(),
    saveArchivedWaitingRoom: vi.fn(),
    getArchivedWaitingRooms: vi.fn(),
    getArchivedWaitingRoom: vi.fn(),
    deleteArchivedWaitingRoom: vi.fn(),
    registerParticipant: vi.fn(),
    getParticipant: vi.fn(),
    publishParticipantSummary: vi.fn(),
    removeParticipant: vi.fn(),
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
        avatar: "🦊",
        moderationStatus: "waiting-approval",
        joinedAt: 1_000,
      },
      participantCount: 3,
    });

    await expect(
      joinWaitingRoom(
        "participante-1",
        { gameId: "ABC234", nickname: "Estrela Azul", avatar: "🦊" },
        services,
        () => 1_000,
      ),
    ).resolves.toMatchObject({
      gameId: "ABC234",
      participantId: "participante-1",
      nickname: "Estrela Azul",
      moderationStatus: "waiting-approval",
    });
    expect(services.publishParticipantSummary).toHaveBeenCalledWith(
      "ABC234",
      3,
      [],
    );
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
        { gameId: "ABC234", nickname: "Estrela Azul", avatar: "🦊" },
        services,
      ),
    ).rejects.toMatchObject({ status: 409, code: "nickname-taken" });
    expect(services.publishParticipantSummary).not.toHaveBeenCalled();
  });

  it("mantém a entrada quando somente a contagem pública falha", async () => {
    vi.mocked(services.registerParticipant).mockResolvedValue({
      outcome: "joined",
      participant: {
        nickname: "Cometa",
        avatar: "🦊",
        moderationStatus: "waiting-approval",
        joinedAt: 1_000,
      },
      participantCount: 1,
    });
    vi.mocked(services.publishParticipantSummary).mockRejectedValue(
      new Error("falha simulada na projeção pública"),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(
      joinWaitingRoom(
        "participante-1",
        { gameId: "ABC234", nickname: "Cometa", avatar: "🦊" },
        services,
        () => 1_000,
      ),
    ).resolves.toMatchObject({ nickname: "Cometa" });
    expect(consoleError).toHaveBeenCalledWith(
      "Participante registrado, mas a contagem pública não foi atualizada:",
      expect.any(Error),
    );

    consoleError.mockRestore();
  });

  it("retorna erro específico quando o RTDB não registra o participante", async () => {
    vi.mocked(services.registerParticipant).mockRejectedValue(
      new Error("falha simulada no RTDB"),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await expect(
      joinWaitingRoom(
        "participante-1",
        { gameId: "ABC234", nickname: "Cometa", avatar: "🦊" },
        services,
      ),
    ).rejects.toMatchObject({
      status: 503,
      code: "participant-registration-unavailable",
    });

    consoleError.mockRestore();
  });

  it("restaura somente o registro pertencente ao UID autenticado", async () => {
    vi.mocked(services.getParticipant).mockResolvedValue({
      nickname: "Cometa",
      avatar: "🦊",
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
