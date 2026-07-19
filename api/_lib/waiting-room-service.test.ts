import { describe, expect, it, vi } from "vitest";
import type { FirebaseAdminServices } from "./firebase-admin.js";
import {
  archiveWaitingRoom,
  associateWaitingRoomQuiz,
  createWaitingRoom,
  deleteArchivedWaitingRoom,
  endWaitingRoom,
  generateWaitingRoomCode,
  getManagedWaitingRoom,
  listArchivedWaitingRooms,
  listManagedWaitingRooms,
  presentWaitingRoom,
  removeWaitingRoomParticipant,
  restoreWaitingRoom,
} from "./waiting-room-service.js";

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
    claimWaitingRoom: vi.fn().mockResolvedValue(true),
    publishWaitingRoom: vi.fn().mockResolvedValue(undefined),
    removeWaitingRoom: vi.fn().mockResolvedValue(undefined),
    getWaitingRoom: vi.fn(),
    findActiveWaitingRoom: vi.fn(),
    findWaitingRooms: vi.fn(),
    setWaitingRoomPresentationStatus: vi.fn(),
    setWaitingRoomQuiz: vi.fn(),
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

describe("serviço de sala de espera", () => {
  it("gera código sem caracteres ambíguos", () => {
    expect(generateWaitingRoomCode(() => 0)).toBe("AAAAAA");
  });

  it("cria estado privado e projeção pública separados", async () => {
    const services = createServices();

    const room = await createWaitingRoom(
      "administrador-1",
      { name: "Quiz de Ciências" },
      services,
      () => "ABC234",
    );

    expect(room).toMatchObject({
      id: "ABC234",
      name: "Quiz de Ciências",
      phase: "waiting",
      presentationStatus: "inactive",
      participantCount: 0,
    });
    expect(services.claimWaitingRoom).toHaveBeenCalledWith(
      "ABC234",
      expect.objectContaining({
        ownerId: "administrador-1",
        name: "Quiz de Ciências",
        phase: "waiting",
      }),
    );
    expect(services.publishWaitingRoom).toHaveBeenCalledWith(
      "ABC234",
      expect.not.objectContaining({ ownerId: expect.anything() }),
    );
  });

  it("associa somente um quiz publicado pertencente ao administrador", async () => {
    const services = createServices();
    vi.mocked(services.getQuiz).mockResolvedValue({
      ownerId: "administrador-1",
      title: "Ciências",
      description: "",
      status: "published",
      questionCount: 0,
      createdAt: 1_000,
      updatedAt: 2_000,
    });

    const room = await createWaitingRoom(
      "administrador-1",
      { name: "Turma 8A", quizId: "quiz-1" },
      services,
      () => "ABC234",
    );

    expect(room).toMatchObject({
      quizId: "quiz-1",
      quizTitle: "Ciências",
    });
    expect(services.claimWaitingRoom).toHaveBeenCalledWith(
      "ABC234",
      expect.objectContaining({ quizId: "quiz-1", quizTitle: "Ciências" }),
    );
  });

  it("troca o quiz de uma sala existente", async () => {
    const services = createServices();
    vi.mocked(services.getWaitingRoom).mockResolvedValue({
      ownerId: "administrador-1",
      name: "Turma 8A",
      phase: "waiting",
      presentationStatus: "inactive",
      createdAt: 1_000,
      quizId: "quiz-antigo",
      quizTitle: "Quiz antigo",
    });
    vi.mocked(services.getQuiz).mockResolvedValue({
      ownerId: "administrador-1",
      title: "Ciências",
      description: "",
      status: "published",
      questionCount: 0,
      createdAt: 1_000,
      updatedAt: 2_000,
    });

    await expect(
      associateWaitingRoomQuiz(
        "administrador-1",
        {
          gameId: "ABC234",
          action: "associate-quiz",
          quizId: "quiz-1",
        },
        services,
        () => 3_000,
      ),
    ).resolves.toMatchObject({
      id: "ABC234",
      quizId: "quiz-1",
      quizTitle: "Ciências",
    });
    expect(services.setWaitingRoomQuiz).toHaveBeenCalledWith(
      "ABC234",
      { id: "quiz-1", title: "Ciências" },
      3_000,
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
      { name: "Quiz de Ciências" },
      services,
      generateCode,
    );

    expect(room.id).toBe("DEF567");
    expect(services.claimWaitingRoom).toHaveBeenCalledTimes(2);
  });

  it("não reutiliza o código de uma sala arquivada", async () => {
    const services = createServices();
    vi.mocked(services.getArchivedWaitingRoom)
      .mockResolvedValueOnce({ status: "archived" })
      .mockResolvedValueOnce(null);
    const generateCode = vi
      .fn<() => string>()
      .mockReturnValueOnce("ABC234")
      .mockReturnValueOnce("DEF567");

    const room = await createWaitingRoom(
      "administrador-1",
      { name: "Quiz de Ciências" },
      services,
      generateCode,
    );

    expect(room.id).toBe("DEF567");
    expect(services.claimWaitingRoom).toHaveBeenCalledOnce();
  });

  it("remove o estado privado se a projeção pública falhar", async () => {
    const services = createServices();
    vi.mocked(services.publishWaitingRoom).mockRejectedValue(
      new Error("falha simulada"),
    );

    await expect(
      createWaitingRoom(
        "administrador-1",
        { name: "Quiz de Ciências" },
        services,
        () => "ABC234",
      ),
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
        name: "Sala ABC234",
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

  it("lista as salas do administrador da mais recente para a mais antiga", async () => {
    const services = createServices();
    vi.mocked(services.findWaitingRooms).mockResolvedValue([
      {
        gameId: "ABC234",
        room: {
          ownerId: "administrador-1",
          phase: "waiting",
          createdAt: 1_000,
        },
      },
      {
        gameId: "DEF567",
        room: {
          ownerId: "administrador-1",
          phase: "waiting",
          createdAt: 2_000,
          participants: {
            "participante-1": {
              nickname: "Cometa",
              moderationStatus: "approved",
              joinedAt: 2_100,
            },
          },
        },
      },
    ]);

    await expect(
      listManagedWaitingRooms("administrador-1", services),
    ).resolves.toEqual([
      expect.objectContaining({ id: "DEF567", participantCount: 1 }),
      expect.objectContaining({ id: "ABC234", participantCount: 0 }),
    ]);
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

  it("remove um participante somente depois de validar o proprietário", async () => {
    const services = createServices();
    const activeParticipant = {
      nickname: "Estrela Azul",
      moderationStatus: "waiting-approval" as const,
      joinedAt: 2_000,
    };
    const removedParticipant = {
      ...activeParticipant,
      moderationStatus: "removed" as const,
    };

    vi.mocked(services.getWaitingRoom)
      .mockResolvedValueOnce({
        ownerId: "administrador-1",
        phase: "waiting",
        createdAt: 1_000,
        participants: { "participante-1": activeParticipant },
      })
      .mockResolvedValueOnce({
        ownerId: "administrador-1",
        phase: "waiting",
        createdAt: 1_000,
        participants: { "participante-1": removedParticipant },
      });
    vi.mocked(services.removeParticipant).mockResolvedValue({
      removed: true,
      participantCount: 0,
    });

    const waitingRoom = await removeWaitingRoomParticipant(
      "administrador-1",
      {
        gameId: "ABC234",
        participantId: "participante-1",
        action: "remove",
      },
      services,
      () => 3_000,
    );

    expect(services.removeParticipant).toHaveBeenCalledWith(
      "ABC234",
      "participante-1",
      3_000,
    );
    expect(services.publishParticipantSummary).toHaveBeenCalledWith(
      "ABC234",
      0,
      [],
    );
    expect(waitingRoom.participants[0]?.moderationStatus).toBe("removed");
  });

  it("não remove participante de uma sala pertencente a outro administrador", async () => {
    const services = createServices();
    vi.mocked(services.getWaitingRoom).mockResolvedValue({
      ownerId: "outro-administrador",
      phase: "waiting",
      createdAt: 1_000,
      participants: {
        "participante-1": {
          nickname: "Estrela Azul",
          moderationStatus: "waiting-approval",
          joinedAt: 2_000,
        },
      },
    });

    await expect(
      removeWaitingRoomParticipant(
        "administrador-1",
        {
          gameId: "ABC234",
          participantId: "participante-1",
          action: "remove",
        },
        services,
      ),
    ).rejects.toMatchObject({
      status: 403,
      code: "waiting-room-owner-required",
    });
    expect(services.removeParticipant).not.toHaveBeenCalled();
  });

  it("encerra somente a sala pertencente ao administrador", async () => {
    const services = createServices();
    vi.mocked(services.getWaitingRoom).mockResolvedValue({
      ownerId: "administrador-1",
      phase: "waiting",
      createdAt: 1_000,
    });

    await expect(
      endWaitingRoom(
        "administrador-1",
        { gameId: "ABC234", action: "end-room" },
        services,
        () => 3_000,
      ),
    ).resolves.toMatchObject({
      id: "ABC234",
      phase: "waiting",
      presentationStatus: "inactive",
    });
    expect(services.setWaitingRoomPresentationStatus).toHaveBeenCalledWith(
      "ABC234",
      "inactive",
      3_000,
    );
  });

  it("não encerra uma sala pertencente a outro administrador", async () => {
    const services = createServices();
    vi.mocked(services.getWaitingRoom).mockResolvedValue({
      ownerId: "outro-administrador",
      phase: "waiting",
      createdAt: 1_000,
    });

    await expect(
      endWaitingRoom(
        "administrador-1",
        { gameId: "ABC234", action: "end-room" },
        services,
      ),
    ).rejects.toMatchObject({
      status: 403,
      code: "waiting-room-owner-required",
    });
    expect(services.setWaitingRoomPresentationStatus).not.toHaveBeenCalled();
  });

  it("ativa a apresentação sem alterar a fase de espera", async () => {
    const services = createServices();
    vi.mocked(services.getWaitingRoom).mockResolvedValue({
      ownerId: "administrador-1",
      name: "Quiz de Ciências",
      phase: "waiting",
      createdAt: 1_000,
    });

    await expect(
      presentWaitingRoom(
        "administrador-1",
        { gameId: "ABC234", action: "present-room" },
        services,
        () => 4_000,
      ),
    ).resolves.toMatchObject({
      phase: "waiting",
      presentationStatus: "active",
    });
    expect(services.setWaitingRoomPresentationStatus).toHaveBeenCalledWith(
      "ABC234",
      "active",
      4_000,
    );
  });

  it("arquiva a sala no Firestore antes de remover o estado transitório", async () => {
    const services = createServices();
    vi.mocked(services.getWaitingRoom).mockResolvedValue({
      ownerId: "administrador-1",
      name: "Quiz de Ciências",
      phase: "waiting",
      createdAt: 1_000,
    });

    await expect(
      archiveWaitingRoom(
        "administrador-1",
        { gameId: "ABC234", action: "archive-room" },
        services,
        () => 5_000,
      ),
    ).resolves.toMatchObject({
      id: "ABC234",
      name: "Quiz de Ciências",
      archivedAt: 5_000,
    });
    expect(services.saveArchivedWaitingRoom).toHaveBeenCalledWith(
      "ABC234",
      expect.objectContaining({
        ownerId: "administrador-1",
        status: "archived",
      }),
    );
    expect(services.removeWaitingRoom).toHaveBeenCalledWith("ABC234");
  });

  it("lista e exclui somente salas arquivadas do proprietário", async () => {
    const services = createServices();
    const archivedRoom = {
      ownerId: "administrador-1",
      name: "Quiz de Ciências",
      status: "archived" as const,
      createdAt: 1_000,
      archivedAt: 5_000,
      participantCount: 3,
    };
    vi.mocked(services.getArchivedWaitingRooms).mockResolvedValue([
      { gameId: "ABC234", room: archivedRoom },
    ]);
    vi.mocked(services.getArchivedWaitingRoom).mockResolvedValue(archivedRoom);

    await expect(
      listArchivedWaitingRooms("administrador-1", services),
    ).resolves.toEqual([
      expect.objectContaining({ id: "ABC234", participantCount: 3 }),
    ]);
    await expect(
      deleteArchivedWaitingRoom(
        "administrador-1",
        { gameId: "ABC234", action: "delete-room" },
        services,
      ),
    ).resolves.toBe("ABC234");
    expect(services.deleteArchivedWaitingRoom).toHaveBeenCalledWith("ABC234");
  });

  it("restaura uma sala arquivada sem reativar participantes anteriores", async () => {
    const services = createServices();
    vi.mocked(services.getArchivedWaitingRoom).mockResolvedValue({
      ownerId: "administrador-1",
      name: "Quiz de Ciências",
      status: "archived",
      createdAt: 1_000,
      archivedAt: 5_000,
      participantCount: 3,
    });
    vi.mocked(services.claimWaitingRoom).mockResolvedValue(true);

    await expect(
      restoreWaitingRoom(
        "administrador-1",
        { gameId: "ABC234", action: "restore-room" },
        services,
        () => 6_000,
      ),
    ).resolves.toMatchObject({
      id: "ABC234",
      name: "Quiz de Ciências",
      phase: "waiting",
      presentationStatus: "inactive",
      participantCount: 0,
    });
    expect(services.claimWaitingRoom).toHaveBeenCalledWith(
      "ABC234",
      expect.not.objectContaining({ participants: expect.anything() }),
    );
    expect(services.deleteArchivedWaitingRoom).toHaveBeenCalledWith("ABC234");
  });

  it("não restaura a associação com um quiz arquivado", async () => {
    const services = createServices();
    vi.mocked(services.getArchivedWaitingRoom).mockResolvedValue({
      ownerId: "administrador-1",
      name: "Quiz de Ciências",
      quizId: "quiz-1",
      quizTitle: "Ciências",
      status: "archived",
      createdAt: 1_000,
      archivedAt: 5_000,
      participantCount: 0,
    });
    vi.mocked(services.getQuiz).mockResolvedValue({
      ownerId: "administrador-1",
      title: "Ciências",
      description: "",
      status: "archived",
      questionCount: 0,
      createdAt: 1_000,
      updatedAt: 5_000,
    });

    const restoredRoom = await restoreWaitingRoom(
      "administrador-1",
      { gameId: "ABC234", action: "restore-room" },
      services,
      () => 6_000,
    );

    expect(restoredRoom).not.toHaveProperty("quizId");
    expect(services.claimWaitingRoom).toHaveBeenCalledWith(
      "ABC234",
      expect.not.objectContaining({ quizId: expect.anything() }),
    );
  });
});
