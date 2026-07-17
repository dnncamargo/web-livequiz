import { describe, expect, it, vi } from "vitest";
import type { FirebaseAdminServices } from "./firebase-admin.js";
import {
  createWaitingRoom,
  generateWaitingRoomCode,
} from "./waiting-room-service.js";

function createServices(): FirebaseAdminServices {
  return {
    verifyIdToken: vi.fn(),
    getAdministratorProfile: vi.fn(),
    checkRealtimeDatabaseConnection: vi.fn(),
    claimWaitingRoom: vi.fn().mockResolvedValue(true),
    publishWaitingRoom: vi.fn().mockResolvedValue(undefined),
    removeWaitingRoom: vi.fn().mockResolvedValue(undefined),
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
});
