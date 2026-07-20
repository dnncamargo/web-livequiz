import { randomInt } from "node:crypto";
import { z } from "zod";
import {
  WAITING_ROOM_CODE_ALPHABET,
  WAITING_ROOM_CODE_LENGTH,
  advanceWaitingRoomGameRequestSchema,
  associateWaitingRoomQuizRequestSchema,
  archiveWaitingRoomRequestSchema,
  archivedWaitingRoomSchema,
  createWaitingRoomRequestSchema,
  deleteArchivedWaitingRoomRequestSchema,
  endWaitingRoomRequestSchema,
  presentWaitingRoomRequestSchema,
  publicWaitingRoomSchema,
  presentationStatusSchema,
  restoreWaitingRoomRequestSchema,
  waitingRoomCodeSchema,
  waitingRoomNameSchema,
  waitingRoomPhaseSchema,
  type ArchiveWaitingRoomRequest,
  type AdvanceWaitingRoomGameRequest,
  type AssociateWaitingRoomQuizRequest,
  type ArchivedWaitingRoom,
  type CreateWaitingRoomRequest,
  type DeleteArchivedWaitingRoomRequest,
  type EndWaitingRoomRequest,
  type PresentWaitingRoomRequest,
  type PublicWaitingRoom,
  type PublicQuizQuestion,
  type RestoreWaitingRoomRequest,
} from "../../src/shared/waiting-room.js";
import {
  managedWaitingRoomResponseSchema,
  participantModerationStatusSchema,
  participantNicknameSchema,
  removeWaitingRoomParticipantRequestSchema,
  type ManagedWaitingRoom,
  type RemoveWaitingRoomParticipantRequest,
} from "../../src/shared/participant.js";
import {
  quizQuestionSchema,
  quizQuestionsSchema,
  type QuizQuestion,
} from "../../src/shared/quiz.js";
import {
  DEFAULT_PARTICIPANT_AVATAR,
  participantAvatarSchema,
} from "../../src/shared/avatar.js";
import { buildPublicRanking } from "../../src/shared/ranking-utils.js";
import type { FirebaseAdminServices } from "./firebase-admin.js";
import { HttpError } from "./http-error.js";
import { getOwnedQuiz, getQuizDetail } from "./quiz-service.js";

const MAX_CODE_GENERATION_ATTEMPTS = 8;
const QUESTION_COUNTDOWN_DURATION_MS = 5_000;

const privateParticipantSchema = z
  .object({
    nickname: participantNicknameSchema,
    avatar: participantAvatarSchema.optional(),
    moderationStatus: participantModerationStatusSchema,
    joinedAt: z.number().int().nonnegative(),
    presence: z
      .object({
        connections: z.record(z.string(), z.unknown()).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const privateWaitingRoomSchema = z
  .object({
    ownerId: z.string().min(1),
    name: waitingRoomNameSchema.optional(),
    quizId: z.string().min(1).max(128).optional(),
    quizTitle: z.string().min(3).max(100).optional(),
    phase: waitingRoomPhaseSchema,
    presentationStatus: presentationStatusSchema.optional(),
    createdAt: z.number().int().nonnegative(),
    participants: z.record(z.string(), z.unknown()).optional(),
    quizQuestions: quizQuestionsSchema.optional(),
    currentQuestionIndex: z.number().int().nonnegative().optional(),
    currentQuestion: quizQuestionSchema.optional(),
    revealedCorrectOptionIds: z
      .array(z.string().min(1).max(128))
      .length(1)
      .optional(),
    totalQuestions: z.number().int().positive().optional(),
    participantScores: z
      .record(z.string(), z.number().int().nonnegative())
      .optional(),
    phaseTiming: z
      .object({
        startedAt: z.number().int().nonnegative(),
        durationMs: z.number().int().positive(),
      })
      .strict()
      .optional(),
  })
  .passthrough();

const privateArchivedWaitingRoomSchema = z
  .object({
    ownerId: z.string().min(1),
    name: waitingRoomNameSchema,
    quizId: z.string().min(1).max(128).optional(),
    quizTitle: z.string().min(3).max(100).optional(),
    status: z.literal("archived"),
    createdAt: z.number().int().nonnegative(),
    archivedAt: z.number().int().nonnegative(),
    participantCount: z.number().int().nonnegative(),
  })
  .strict();

export type RandomIndexGenerator = (maximum: number) => number;

export function generateWaitingRoomCode(
  generateRandomIndex: RandomIndexGenerator = randomInt,
): string {
  return Array.from({ length: WAITING_ROOM_CODE_LENGTH }, () => {
    const index = generateRandomIndex(WAITING_ROOM_CODE_ALPHABET.length);
    const character = WAITING_ROOM_CODE_ALPHABET[index];

    if (!character) {
      throw new RangeError("O gerador retornou um índice inválido.");
    }

    return character;
  }).join("");
}

function getRoomName(gameId: string, name?: string): string {
  return name ?? `Sala ${gameId}`;
}

function getRoomRanking(room: z.infer<typeof privateWaitingRoomSchema>) {
  const participantScores = room.participantScores ?? {};

  return buildPublicRanking(
    Object.entries(room.participants ?? {}).flatMap(
      ([participantId, value]) => {
        const participantResult = privateParticipantSchema.safeParse(value);

        if (
          !participantResult.success ||
          participantResult.data.moderationStatus === "removed"
        ) {
          return [];
        }

        return [
          {
            participantId,
            nickname: participantResult.data.nickname,
            avatar: participantResult.data.avatar ?? DEFAULT_PARTICIPANT_AVATAR,
            score: participantScores[participantId] ?? 0,
            joinedAt: participantResult.data.joinedAt,
          },
        ];
      },
    ),
  );
}

function toPublicQuizQuestion(question: QuizQuestion): PublicQuizQuestion {
  return {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    position: question.position,
    durationMs: question.durationMs,
    points: question.points,
    options: question.options,
  };
}

function buildManagedWaitingRoom(
  ownerId: string,
  gameId: string,
  room: unknown,
): ManagedWaitingRoom {
  const roomResult = privateWaitingRoomSchema.safeParse(room);

  if (!roomResult.success) {
    throw new HttpError(
      500,
      "waiting-room-state-invalid",
      "A sala contém dados inválidos.",
    );
  }

  if (roomResult.data.ownerId !== ownerId) {
    throw new HttpError(
      403,
      "waiting-room-owner-required",
      "Esta sala pertence a outro administrador.",
    );
  }

  const participants = Object.entries(roomResult.data.participants ?? {})
    .map(([participantId, value]) => {
      const participantResult = privateParticipantSchema.safeParse(value);

      if (!participantResult.success) {
        return null;
      }

      const connections = participantResult.data.presence?.connections;

      return {
        participantId,
        nickname: participantResult.data.nickname,
        moderationStatus: participantResult.data.moderationStatus,
        joinedAt: participantResult.data.joinedAt,
        presenceStatus:
          connections && Object.keys(connections).length > 0
            ? ("connected" as const)
            : ("disconnected" as const),
      };
    })
    .filter((participant) => participant !== null)
    .sort((first, second) => first.joinedAt - second.joinedAt);
  const roomRanking = getRoomRanking(roomResult.data);

  return managedWaitingRoomResponseSchema.parse({
    room: {
      id: gameId,
      name: getRoomName(gameId, roomResult.data.name),
      quizId: roomResult.data.quizId,
      quizTitle: roomResult.data.quizTitle,
      phase: roomResult.data.phase,
      presentationStatus: roomResult.data.presentationStatus,
      createdAt: roomResult.data.createdAt,
      participantCount: participants.filter(
        ({ moderationStatus }) => moderationStatus !== "removed",
      ).length,
      currentQuestion: roomResult.data.currentQuestion
        ? toPublicQuizQuestion(roomResult.data.currentQuestion)
        : undefined,
      revealedCorrectOptionIds: roomResult.data.revealedCorrectOptionIds,
      questionNumber:
        roomResult.data.currentQuestionIndex === undefined
          ? undefined
          : roomResult.data.currentQuestionIndex + 1,
      totalQuestions: roomResult.data.totalQuestions,
      phaseTiming: roomResult.data.phaseTiming,
      ranking: roomResult.data.phase === "ranking" ? roomRanking : undefined,
      podium:
        roomResult.data.phase === "podium"
          ? roomRanking.slice(0, 3)
          : undefined,
    },
    participants,
  });
}

function parseArchivedWaitingRoom(
  ownerId: string,
  gameId: string,
  room: unknown,
): ArchivedWaitingRoom {
  const roomResult = privateArchivedWaitingRoomSchema.safeParse(room);

  if (!roomResult.success) {
    throw new HttpError(
      500,
      "archived-room-state-invalid",
      "A sala arquivada contém dados inválidos.",
    );
  }

  if (roomResult.data.ownerId !== ownerId) {
    throw new HttpError(
      403,
      "waiting-room-owner-required",
      "Esta sala pertence a outro administrador.",
    );
  }

  return archivedWaitingRoomSchema.parse({
    id: gameId,
    name: roomResult.data.name,
    quizId: roomResult.data.quizId,
    quizTitle: roomResult.data.quizTitle,
    createdAt: roomResult.data.createdAt,
    archivedAt: roomResult.data.archivedAt,
    participantCount: roomResult.data.participantCount,
  });
}

export async function createWaitingRoom(
  ownerId: string,
  input: CreateWaitingRoomRequest,
  services: FirebaseAdminServices,
  generateCode: () => string = generateWaitingRoomCode,
): Promise<PublicWaitingRoom> {
  const parsedInput = createWaitingRoomRequestSchema.parse(input);
  const associatedQuiz = parsedInput.quizId
    ? await getOwnedQuiz(ownerId, parsedInput.quizId, services)
    : null;

  if (associatedQuiz && associatedQuiz.status !== "published") {
    throw new HttpError(
      409,
      "quiz-not-published",
      "Publique o quiz antes de associá-lo a uma sala.",
    );
  }

  for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt += 1) {
    const gameId = generateCode();

    if (await services.getArchivedWaitingRoom(gameId)) {
      continue;
    }

    const createdAt = Date.now();
    const privateRoom = {
      ownerId,
      name: parsedInput.name,
      ...(associatedQuiz
        ? { quizId: associatedQuiz.id, quizTitle: associatedQuiz.title }
        : {}),
      phase: "waiting",
      presentationStatus: "inactive",
      createdAt,
      updatedAt: createdAt,
    };
    const publicRoom = publicWaitingRoomSchema.parse({
      id: gameId,
      name: parsedInput.name,
      ...(associatedQuiz
        ? { quizId: associatedQuiz.id, quizTitle: associatedQuiz.title }
        : {}),
      phase: "waiting",
      presentationStatus: "inactive",
      createdAt,
      participantCount: 0,
    });
    const claimed = await services.claimWaitingRoom(gameId, privateRoom);

    if (!claimed) {
      continue;
    }

    try {
      await services.publishWaitingRoom(gameId, publicRoom);
      return publicRoom;
    } catch (error) {
      await services
        .removeWaitingRoom(gameId)
        .catch((rollbackError: unknown) => {
          console.error("Falha ao desfazer a criação da sala:", rollbackError);
        });

      throw error;
    }
  }

  throw new HttpError(
    503,
    "room-code-unavailable",
    "Não foi possível gerar um código de sala. Tente novamente.",
  );
}

export async function associateWaitingRoomQuiz(
  ownerId: string,
  input: AssociateWaitingRoomQuizRequest,
  services: FirebaseAdminServices,
  now: () => number = Date.now,
): Promise<PublicWaitingRoom> {
  const parsedInput = associateWaitingRoomQuizRequestSchema.parse(input);
  const waitingRoom = await getManagedWaitingRoom(
    ownerId,
    services,
    parsedInput.gameId,
  );
  const quiz = parsedInput.quizId
    ? await getOwnedQuiz(ownerId, parsedInput.quizId, services)
    : null;

  if (waitingRoom.room.phase !== "waiting") {
    throw new HttpError(
      409,
      "quiz-association-locked",
      "A associação do quiz só pode ser alterada antes do início da partida.",
    );
  }

  if (quiz && quiz.status !== "published") {
    throw new HttpError(
      409,
      "quiz-not-published",
      "Publique o quiz antes de associá-lo a uma sala.",
    );
  }

  await services.setWaitingRoomQuiz(
    parsedInput.gameId,
    quiz ? { id: quiz.id, title: quiz.title } : null,
    now(),
  );

  return publicWaitingRoomSchema.parse({
    id: waitingRoom.room.id,
    name: waitingRoom.room.name,
    phase: waitingRoom.room.phase,
    presentationStatus: waitingRoom.room.presentationStatus,
    createdAt: waitingRoom.room.createdAt,
    participantCount: waitingRoom.room.participantCount,
    participants: waitingRoom.room.participants,
    ...(quiz ? { quizId: quiz.id, quizTitle: quiz.title } : {}),
  });
}

export async function advanceWaitingRoomGame(
  ownerId: string,
  input: AdvanceWaitingRoomGameRequest,
  services: FirebaseAdminServices,
  now: () => number = Date.now,
): Promise<PublicWaitingRoom> {
  const parsedInput = advanceWaitingRoomGameRequestSchema.parse(input);
  await getManagedWaitingRoom(ownerId, services, parsedInput.gameId);
  const roomValue = await services.getWaitingRoom(parsedInput.gameId);
  const roomResult = privateWaitingRoomSchema.safeParse(roomValue);

  if (!roomResult.success) {
    throw new HttpError(
      500,
      "waiting-room-state-invalid",
      "A sala contém dados inválidos para controlar a partida.",
    );
  }

  if (roomResult.data.ownerId !== ownerId) {
    throw new HttpError(
      403,
      "waiting-room-owner-required",
      "Esta sala pertence a outro administrador.",
    );
  }

  const phase = roomResult.data.phase;

  if (phase !== parsedInput.expectedPhase) {
    return buildManagedWaitingRoom(ownerId, parsedInput.gameId, roomResult.data)
      .room;
  }

  const changedAt = now();
  let privateFields: Record<string, unknown>;
  let publicFields: Record<string, unknown>;

  if (phase === "waiting") {
    if (!roomResult.data.quizId) {
      throw new HttpError(
        409,
        "room-quiz-required",
        "Associe um quiz publicado antes de iniciar a partida.",
      );
    }

    const quiz = await getQuizDetail(ownerId, roomResult.data.quizId, services);

    if (quiz.status !== "published") {
      throw new HttpError(
        409,
        "quiz-not-published",
        "Publique o quiz associado antes de iniciar a partida.",
      );
    }

    if (quiz.questions.length === 0) {
      throw new HttpError(
        409,
        "quiz-has-no-questions",
        "Adicione pelo menos uma pergunta antes de iniciar a partida.",
      );
    }

    const phaseTiming = {
      startedAt: changedAt,
      durationMs: QUESTION_COUNTDOWN_DURATION_MS,
    };
    privateFields = {
      phase: "countdown",
      presentationStatus: "active",
      quizQuestions: quiz.questions,
      currentQuestionIndex: 0,
      currentQuestion: null,
      revealedCorrectOptionIds: null,
      answers: null,
      participantScores: null,
      totalQuestions: quiz.questions.length,
      phaseTiming,
      ranking: null,
      podium: null,
    };
    publicFields = {
      phase: "countdown",
      presentationStatus: "active",
      currentQuestion: null,
      revealedCorrectOptionIds: null,
      questionNumber: 1,
      totalQuestions: quiz.questions.length,
      phaseTiming,
      ranking: null,
      podium: null,
    };
  } else if (phase === "countdown") {
    const questionIndex = roomResult.data.currentQuestionIndex ?? 0;
    const question = roomResult.data.quizQuestions?.[questionIndex];

    if (!question) {
      throw new HttpError(
        409,
        "question-snapshot-missing",
        "A pergunta atual não está disponível. Reinicie a sala.",
      );
    }

    const phaseTiming = {
      startedAt: changedAt,
      durationMs: question.durationMs,
    };
    privateFields = {
      phase: "question",
      currentQuestion: question,
      revealedCorrectOptionIds: null,
      phaseTiming,
    };
    publicFields = {
      phase: "question",
      currentQuestion: toPublicQuizQuestion(question),
      revealedCorrectOptionIds: null,
      questionNumber: questionIndex + 1,
      totalQuestions: roomResult.data.quizQuestions?.length,
      phaseTiming,
      ranking: null,
      podium: null,
    };
  } else if (phase === "question") {
    const question = roomResult.data.currentQuestion;

    if (!question) {
      throw new HttpError(
        409,
        "current-question-missing",
        "A pergunta atual não está disponível para revelar a resposta.",
      );
    }

    privateFields = {
      phase: "revealing",
      revealedCorrectOptionIds: question.correctOptionIds,
      phaseTiming: null,
    };
    publicFields = {
      phase: "revealing",
      revealedCorrectOptionIds: question.correctOptionIds,
      phaseTiming: null,
    };
  } else if (phase === "revealing") {
    const ranking = getRoomRanking(roomResult.data);

    privateFields = {
      phase: "ranking",
      currentQuestion: null,
      revealedCorrectOptionIds: null,
      phaseTiming: null,
    };
    publicFields = {
      phase: "ranking",
      currentQuestion: null,
      revealedCorrectOptionIds: null,
      phaseTiming: null,
      ranking,
      podium: null,
    };
  } else if (phase === "ranking") {
    const questions = roomResult.data.quizQuestions ?? [];
    const nextQuestionIndex = (roomResult.data.currentQuestionIndex ?? 0) + 1;
    const hasNextQuestion = Boolean(questions[nextQuestionIndex]);

    if (hasNextQuestion) {
      const phaseTiming = {
        startedAt: changedAt,
        durationMs: QUESTION_COUNTDOWN_DURATION_MS,
      };
      privateFields = {
        phase: "countdown",
        currentQuestionIndex: nextQuestionIndex,
        currentQuestion: null,
        revealedCorrectOptionIds: null,
        phaseTiming,
      };
      publicFields = {
        phase: "countdown",
        currentQuestion: null,
        revealedCorrectOptionIds: null,
        questionNumber: nextQuestionIndex + 1,
        totalQuestions: questions.length,
        phaseTiming,
        ranking: null,
        podium: null,
      };
    } else {
      const podium = getRoomRanking(roomResult.data).slice(0, 3);

      privateFields = {
        phase: "podium",
        currentQuestion: null,
        revealedCorrectOptionIds: null,
        phaseTiming: null,
      };
      publicFields = {
        phase: "podium",
        currentQuestion: null,
        revealedCorrectOptionIds: null,
        phaseTiming: null,
        ranking: null,
        podium,
      };
    }
  } else if (phase === "podium") {
    privateFields = {
      phase: "finished",
      currentQuestion: null,
      revealedCorrectOptionIds: null,
      phaseTiming: null,
    };
    publicFields = {
      phase: "finished",
      currentQuestion: null,
      revealedCorrectOptionIds: null,
      phaseTiming: null,
      ranking: null,
      podium: null,
    };
  } else {
    throw new HttpError(
      409,
      "game-phase-cannot-advance",
      "Esta fase ainda não possui uma transição disponível.",
    );
  }

  await services.setWaitingRoomGameState(
    parsedInput.gameId,
    privateFields,
    publicFields,
    changedAt,
  );
  const updatedRoom = await getManagedWaitingRoom(
    ownerId,
    services,
    parsedInput.gameId,
  );

  return updatedRoom.room;
}

export async function getManagedWaitingRoom(
  ownerId: string,
  services: FirebaseAdminServices,
  requestedGameId?: string,
): Promise<ManagedWaitingRoom> {
  const gameIdResult = requestedGameId
    ? waitingRoomCodeSchema.safeParse(requestedGameId)
    : null;

  if (gameIdResult && !gameIdResult.success) {
    throw new HttpError(
      400,
      "invalid-room-code",
      "O código da sala informado é inválido.",
    );
  }

  const parsedGameId = gameIdResult?.data;
  const locatedRoom = parsedGameId
    ? {
        gameId: parsedGameId,
        room: await services.getWaitingRoom(parsedGameId),
      }
    : await services.findActiveWaitingRoom(ownerId);

  if (!locatedRoom?.room) {
    throw new HttpError(
      404,
      requestedGameId ? "room-not-found" : "active-room-not-found",
      requestedGameId
        ? "A sala solicitada não existe ou foi arquivada."
        : "Nenhuma sala ativa foi encontrada.",
    );
  }

  return buildManagedWaitingRoom(ownerId, locatedRoom.gameId, locatedRoom.room);
}

export async function listManagedWaitingRooms(
  ownerId: string,
  services: FirebaseAdminServices,
): Promise<PublicWaitingRoom[]> {
  const locatedRooms = await services.findWaitingRooms(ownerId);

  return locatedRooms
    .map(({ gameId, room }) => buildManagedWaitingRoom(ownerId, gameId, room))
    .map(({ room }) => room)
    .sort((first, second) => second.createdAt - first.createdAt);
}

async function setWaitingRoomPresentationStatus(
  ownerId: string,
  gameId: string,
  presentationStatus: "inactive" | "active",
  services: FirebaseAdminServices,
  now: () => number,
): Promise<PublicWaitingRoom> {
  const waitingRoom = await getManagedWaitingRoom(ownerId, services, gameId);

  await services.setWaitingRoomPresentationStatus(
    gameId,
    presentationStatus,
    now(),
  );

  return publicWaitingRoomSchema.parse({
    ...waitingRoom.room,
    presentationStatus,
  });
}

export async function endWaitingRoom(
  ownerId: string,
  input: EndWaitingRoomRequest,
  services: FirebaseAdminServices,
  now: () => number = Date.now,
): Promise<PublicWaitingRoom> {
  const parsedInput = endWaitingRoomRequestSchema.parse(input);

  return setWaitingRoomPresentationStatus(
    ownerId,
    parsedInput.gameId,
    "inactive",
    services,
    now,
  );
}

export async function presentWaitingRoom(
  ownerId: string,
  input: PresentWaitingRoomRequest,
  services: FirebaseAdminServices,
  now: () => number = Date.now,
): Promise<PublicWaitingRoom> {
  const parsedInput = presentWaitingRoomRequestSchema.parse(input);

  return setWaitingRoomPresentationStatus(
    ownerId,
    parsedInput.gameId,
    "active",
    services,
    now,
  );
}

export async function archiveWaitingRoom(
  ownerId: string,
  input: ArchiveWaitingRoomRequest,
  services: FirebaseAdminServices,
  now: () => number = Date.now,
): Promise<ArchivedWaitingRoom> {
  const parsedInput = archiveWaitingRoomRequestSchema.parse(input);
  const waitingRoom = await getManagedWaitingRoom(
    ownerId,
    services,
    parsedInput.gameId,
  );
  const archivedRoom = archivedWaitingRoomSchema.parse({
    id: waitingRoom.room.id,
    name: getRoomName(waitingRoom.room.id, waitingRoom.room.name),
    quizId: waitingRoom.room.quizId,
    quizTitle: waitingRoom.room.quizTitle,
    createdAt: waitingRoom.room.createdAt,
    archivedAt: now(),
    participantCount: waitingRoom.room.participantCount,
  });

  await services.saveArchivedWaitingRoom(archivedRoom.id, {
    ownerId,
    name: archivedRoom.name,
    ...(archivedRoom.quizId && archivedRoom.quizTitle
      ? { quizId: archivedRoom.quizId, quizTitle: archivedRoom.quizTitle }
      : {}),
    status: "archived",
    createdAt: archivedRoom.createdAt,
    archivedAt: archivedRoom.archivedAt,
    participantCount: archivedRoom.participantCount,
  });

  try {
    await services.removeWaitingRoom(archivedRoom.id);
  } catch (error) {
    await services
      .deleteArchivedWaitingRoom(archivedRoom.id)
      .catch((rollbackError: unknown) => {
        console.error("Falha ao desfazer o arquivamento:", rollbackError);
      });
    throw error;
  }

  return archivedRoom;
}

export async function listArchivedWaitingRooms(
  ownerId: string,
  services: FirebaseAdminServices,
): Promise<ArchivedWaitingRoom[]> {
  const locatedRooms = await services.getArchivedWaitingRooms(ownerId);

  return locatedRooms
    .map(({ gameId, room }) => parseArchivedWaitingRoom(ownerId, gameId, room))
    .sort((first, second) => second.archivedAt - first.archivedAt);
}

async function getOwnedArchivedWaitingRoom(
  ownerId: string,
  gameId: string,
  services: FirebaseAdminServices,
): Promise<ArchivedWaitingRoom> {
  const archivedRoom = await services.getArchivedWaitingRoom(gameId);

  if (!archivedRoom) {
    throw new HttpError(
      404,
      "archived-room-not-found",
      "A sala arquivada não foi encontrada.",
    );
  }

  return parseArchivedWaitingRoom(ownerId, gameId, archivedRoom);
}

export async function restoreWaitingRoom(
  ownerId: string,
  input: RestoreWaitingRoomRequest,
  services: FirebaseAdminServices,
  now: () => number = Date.now,
): Promise<PublicWaitingRoom> {
  const parsedInput = restoreWaitingRoomRequestSchema.parse(input);
  const archivedRoom = await getOwnedArchivedWaitingRoom(
    ownerId,
    parsedInput.gameId,
    services,
  );
  const archivedRoomQuiz = archivedRoom.quizId
    ? await getOwnedQuiz(ownerId, archivedRoom.quizId, services)
    : null;
  const associatedQuiz =
    archivedRoomQuiz?.status === "published" ? archivedRoomQuiz : null;
  const restoredAt = now();
  const privateRoom = {
    ownerId,
    name: archivedRoom.name,
    ...(associatedQuiz
      ? { quizId: associatedQuiz.id, quizTitle: associatedQuiz.title }
      : {}),
    phase: "waiting",
    presentationStatus: "inactive",
    createdAt: archivedRoom.createdAt,
    updatedAt: restoredAt,
    restoredAt,
  };
  const publicRoom = publicWaitingRoomSchema.parse({
    id: archivedRoom.id,
    name: archivedRoom.name,
    ...(associatedQuiz
      ? { quizId: associatedQuiz.id, quizTitle: associatedQuiz.title }
      : {}),
    phase: "waiting",
    presentationStatus: "inactive",
    createdAt: archivedRoom.createdAt,
    participantCount: 0,
  });
  const claimed = await services.claimWaitingRoom(archivedRoom.id, privateRoom);

  if (!claimed) {
    throw new HttpError(
      409,
      "room-code-in-use",
      "Já existe uma sala ativa usando este código.",
    );
  }

  try {
    await services.publishWaitingRoom(archivedRoom.id, publicRoom);
    await services.deleteArchivedWaitingRoom(archivedRoom.id);
  } catch (error) {
    await services
      .removeWaitingRoom(archivedRoom.id)
      .catch((rollbackError: unknown) => {
        console.error("Falha ao desfazer a restauração:", rollbackError);
      });
    throw error;
  }

  return publicRoom;
}

export async function deleteArchivedWaitingRoom(
  ownerId: string,
  input: DeleteArchivedWaitingRoomRequest,
  services: FirebaseAdminServices,
): Promise<string> {
  const parsedInput = deleteArchivedWaitingRoomRequestSchema.parse(input);
  const archivedRoom = await getOwnedArchivedWaitingRoom(
    ownerId,
    parsedInput.gameId,
    services,
  );

  await services.deleteArchivedWaitingRoom(archivedRoom.id);

  return archivedRoom.id;
}

export async function removeWaitingRoomParticipant(
  ownerId: string,
  input: RemoveWaitingRoomParticipantRequest,
  services: FirebaseAdminServices,
  now: () => number = Date.now,
): Promise<ManagedWaitingRoom> {
  const parsedInput = removeWaitingRoomParticipantRequestSchema.parse(input);
  const waitingRoom = await getManagedWaitingRoom(
    ownerId,
    services,
    parsedInput.gameId,
  );

  if (waitingRoom.room.phase !== "waiting") {
    throw new HttpError(
      409,
      "room-not-presenting",
      "Apresente a sala antes de moderar participantes.",
    );
  }

  const removal = await services.removeParticipant(
    parsedInput.gameId,
    parsedInput.participantId,
    now(),
  );

  if (!removal.removed) {
    throw new HttpError(
      404,
      "participant-not-found",
      "O participante não está mais nesta sala.",
    );
  }

  try {
    await services.publishParticipantSummary(
      parsedInput.gameId,
      removal.participantCount,
      removal.participants ?? [],
    );
  } catch (error) {
    console.error(
      "Participante removido, mas a contagem pública não foi atualizada:",
      error,
    );
  }

  return getManagedWaitingRoom(ownerId, services, parsedInput.gameId);
}
