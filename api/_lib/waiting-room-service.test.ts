import { describe, expect, it, vi } from "vitest";
import type { FirebaseAdminServices } from "./firebase-admin.js";
import {
  createWaitingRoom,
  generateWaitingRoomCode,
  getManagedWaitingRoom,
} from "./waiting-room-service.js";

function createServices(): FirebaseAdminServices {
  return {
    verifyIdToken: vi.fn(),
    getAdministratorProfile: vi.fn(),
    checkRealtimeDatabaseConnection: vi.fn(),
    claimWaitingRoom: vi.fn().mockResolvedValue(true),
    publishWaitingRoom: vi.fn().mockResolvedValue(undefined),
    removeWaitingRoom: vi.fn().mockResolvedValue(undefined),
    getWaitingRoom: vi.fn(),
    findActiveWaitingRoom: vi.fn(),
    registerParticipant: vi.fn(),
    getParticipant: vi.fn(),
    publishParticipantCount: vi.fn(),
  };
}

describe("serviço de sala de espera", () => {
  it("gera código sem caracteres ambíguos", () => {
    expect(generateWaitingRoomCode(() => 0)).toBe("AAAAAA");
  });

  it("cria estado privado e projeção pública separados", async () => {
    const services = createServices();

    const room = await createWaitingRoom(
      "administrador-1",
      services,
      () => "ABC234",
    );

    expect(room).toMatchObject({
      id: "ABC234",
      phase: "waiting",
      participantCount: 0,
    });
    expect(services.claimWaitingRoom).toHaveBeenCalledWith(
      "ABC234",
      expect.objectContaining({
        ownerId: "administrador-1",
        phase: "waiting",
      }),
    );
    expect(services.publishWaitingRoom).toHaveBeenCalledWith(
      "ABC234",
      expect.not.objectContaining({ ownerId: expect.anything() }),
    );
  });

  it("gera outro código quando encontra uma colisão", async () => {
    const services = createServices();
    vi.mocked(services.claimWaitingRoom)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const generateCode = vi
      .fn<() => string>()
      .mockReturnValueOnce("ABC234")
      .mockReturnValueOnce("DEF567");

    const room = await createWaitingRoom(
      "administrador-1",
      services,
      generateCode,
    );

    expect(room.id).toBe("DEF567");
    expect(services.claimWaitingRoom).toHaveBeenCalledTimes(2);
  });

  it("remove o estado privado se a projeção pública falhar", async () => {
    const services = createServices();
    vi.mocked(services.publishWaitingRoom).mockRejectedValue(
      new Error("falha simulada"),
    );

    await expect(
      createWaitingRoom("administrador-1", services, () => "ABC234"),
    ).rejects.toThrow("falha simulada");
    expect(services.removeWaitingRoom).toHaveBeenCalledWith("ABC234");
  });

  it("recupera a sala e apresenta seus participantes ao proprietário", async () => {
    const services = createServices();
    vi.mocked(services.getWaitingRoom).mockResolvedValue({
      ownerId: "administrador-1",
      phase: "waiting",
      createdAt: 1_000,
      participants: {
        "participante-1": {
          nickname: "Estrela Azul",
          moderationStatus: "waiting-approval",
          joinedAt: 2_000,
          presence: { connections: { "conexao-1": { lastSeenAt: 2_100 } } },
        },
      },
    });

    await expect(
      getManagedWaitingRoom("administrador-1", services, "ABC234"),
    ).resolves.toEqual({
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
    });
  });

  it("localiza a sala ativa do administrador quando não há código", async () => {
    const services = createServices();
    vi.mocked(services.findActiveWaitingRoom).mockResolvedValue({
      gameId: "ABC234",
      room: {
        ownerId: "administrador-1",
        phase: "waiting",
        createdAt: 1_000,
      },
    });

    const waitingRoom = await getManagedWaitingRoom(
      "administrador-1",
      services,
    );

    expect(waitingRoom.room.id).toBe("ABC234");
    expect(services.findActiveWaitingRoom).toHaveBeenCalledWith(
      "administrador-1",
    );
  });

  it("impede que outro administrador consulte a sala", async () => {
    const services = createServices();
    vi.mocked(services.getWaitingRoom).mockResolvedValue({
      ownerId: "outro-administrador",
      phase: "waiting",
      createdAt: 1_000,
    });

    await expect(
      getManagedWaitingRoom("administrador-1", services, "ABC234"),
    ).rejects.toMatchObject({
      status: 403,
      code: "waiting-room-owner-required",
    });
  });
});
