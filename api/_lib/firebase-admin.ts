import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import {
  DEFAULT_PARTICIPANT_AVATAR,
  participantAvatarSchema,
} from "../../src/shared/avatar.js";
import {
  storedParticipantAnswerSchema,
  type StoredParticipantAnswer,
} from "../../src/shared/answer.js";
import { calculateAnswerPoints } from "../../src/shared/scoring.js";
import {
  phaseTimingSchema,
  type PublicWaitingRoomParticipant,
} from "../../src/shared/waiting-room.js";
import {
  quizQuestionSchema,
  type CreateQuizRequest,
  type QuizQuestion,
} from "../../src/shared/quiz.js";

const ADMIN_APP_NAME = "quizumba-server";

const administratorEnvironmentSchema = z.object({
  FIREBASE_ADMIN_PROJECT_ID: z.string().min(1),
  FIREBASE_ADMIN_CLIENT_EMAIL: z.string().email(),
  FIREBASE_ADMIN_PRIVATE_KEY: z.string().min(1),
  FIREBASE_ADMIN_DATABASE_URL: z.string().url(),
});

export interface FirebaseAdminServices {
  verifyIdToken: (idToken: string) => Promise<unknown>;
  getAdministratorProfile: (uid: string) => Promise<unknown | null>;
  checkRealtimeDatabaseConnection: () => Promise<void>;
  createQuiz: (
    ownerId: string,
    input: CreateQuizRequest,
    createdAt: number,
  ) => Promise<{ quizId: string; quiz: unknown }>;
  findQuizzes: (
    ownerId: string,
  ) => Promise<Array<{ quizId: string; quiz: unknown }>>;
  getQuiz: (quizId: string) => Promise<unknown | null>;
  updateQuizStatus: (
    quizId: string,
    status: "draft" | "published" | "archived",
    updatedAt: number,
  ) => Promise<unknown | null>;
  updateQuizContent: (
    quizId: string,
    content: {
      title: string;
      description: string;
      questions: QuizQuestion[];
    },
    updatedAt: number,
  ) => Promise<unknown | null>;
  detachQuizFromWaitingRooms: (
    ownerId: string,
    quizId: string,
  ) => Promise<void>;
  syncQuizTitleWithWaitingRooms: (
    ownerId: string,
    quizId: string,
    title: string,
  ) => Promise<void>;
  claimWaitingRoom: (
    gameId: string,
    privateRoom: Record<string, unknown>,
  ) => Promise<boolean>;
  publishWaitingRoom: (
    gameId: string,
    publicRoom: Record<string, unknown>,
  ) => Promise<void>;
  removeWaitingRoom: (gameId: string) => Promise<void>;
  getWaitingRoom: (gameId: string) => Promise<unknown | null>;
  findActiveWaitingRoom: (
    ownerId: string,
  ) => Promise<{ gameId: string; room: unknown } | null>;
  findWaitingRooms: (
    ownerId: string,
  ) => Promise<Array<{ gameId: string; room: unknown }>>;
  setWaitingRoomPresentationStatus: (
    gameId: string,
    presentationStatus: "inactive" | "active",
    changedAt: number,
  ) => Promise<void>;
  setWaitingRoomGameState: (
    gameId: string,
    privateFields: Record<string, unknown>,
    publicFields: Record<string, unknown>,
    changedAt: number,
  ) => Promise<void>;
  setWaitingRoomQuiz: (
    gameId: string,
    quiz: { id: string; title: string } | null,
    changedAt: number,
  ) => Promise<void>;
  saveArchivedWaitingRoom: (
    gameId: string,
    room: Record<string, unknown>,
  ) => Promise<void>;
  getArchivedWaitingRooms: (
    ownerId: string,
  ) => Promise<Array<{ gameId: string; room: unknown }>>;
  getArchivedWaitingRoom: (gameId: string) => Promise<unknown | null>;
  deleteArchivedWaitingRoom: (gameId: string) => Promise<void>;
  registerParticipant: (
    gameId: string,
    participantId: string,
    nickname: string,
    avatar: string,
    joinedAt: number,
  ) => Promise<ParticipantRegistrationResult>;
  getParticipant: (
    gameId: string,
    participantId: string,
  ) => Promise<unknown | null>;
  publishParticipantSummary: (
    gameId: string,
    participantCount: number,
    participants: PublicWaitingRoomParticipant[],
  ) => Promise<void>;
  removeParticipant: (
    gameId: string,
    participantId: string,
    removedAt: number,
  ) => Promise<ParticipantRemovalResult>;
  submitParticipantAnswer: (
    gameId: string,
    participantId: string,
    questionId: string,
    selectedOptionIds: string[],
    answeredAt: number,
  ) => Promise<ParticipantAnswerPersistenceResult>;
}

export type ParticipantRegistrationOutcome =
  | "joined"
  | "restored"
  | "room-not-found"
  | "room-not-waiting"
  | "nickname-taken";

export interface ParticipantRegistrationResult {
  outcome: ParticipantRegistrationOutcome;
  participant: unknown | null;
  participantCount: number;
  participants?: PublicWaitingRoomParticipant[];
}

export interface ParticipantRemovalResult {
  removed: boolean;
  participantCount: number;
  participants?: PublicWaitingRoomParticipant[];
}

export type ParticipantAnswerPersistenceOutcome =
  | "accepted"
  | "already-submitted"
  | "room-not-found"
  | "participant-not-found"
  | "participant-not-eligible"
  | "question-not-active"
  | "question-mismatch"
  | "answer-too-late"
  | "invalid-option"
  | "game-state-invalid";

export interface ParticipantAnswerPersistenceResult {
  outcome: ParticipantAnswerPersistenceOutcome;
  answer: StoredParticipantAnswer | null;
  totalScore: number;
}

interface ParticipantAnswerTransactionInput {
  participantId: string;
  questionId: string;
  selectedOptionIds: string[];
  answeredAt: number;
}

export interface ParticipantAnswerTransactionDecision extends ParticipantAnswerPersistenceResult {
  game: Record<string, unknown> | null;
}

export type FirebaseAdminConfigurationErrorCode =
  | "firebase-admin-environment-invalid"
  | "firebase-admin-private-key-invalid"
  | "firebase-admin-initialization-failed";

export class FirebaseAdminConfigurationError extends Error {
  readonly code: FirebaseAdminConfigurationErrorCode;

  constructor(code: FirebaseAdminConfigurationErrorCode, message: string) {
    super(message);
    this.name = "FirebaseAdminConfigurationError";
    this.code = code;
  }
}

let cachedServices: FirebaseAdminServices | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function participantAnswerDecision(
  outcome: ParticipantAnswerPersistenceOutcome,
  answer: StoredParticipantAnswer | null = null,
  totalScore = 0,
  game: Record<string, unknown> | null = null,
): ParticipantAnswerTransactionDecision {
  return { outcome, answer, totalScore, game };
}

export function resolveParticipantAnswerTransaction(
  value: unknown,
  input: ParticipantAnswerTransactionInput,
): ParticipantAnswerTransactionDecision {
  if (!isRecord(value)) {
    return participantAnswerDecision("room-not-found");
  }

  const participants = isRecord(value.participants) ? value.participants : {};
  const participant = participants[input.participantId];

  if (!isRecord(participant)) {
    return participantAnswerDecision("participant-not-found");
  }

  if (
    participant.moderationStatus !== "waiting-approval" &&
    participant.moderationStatus !== "approved"
  ) {
    return participantAnswerDecision("participant-not-eligible");
  }

  const questionResult = quizQuestionSchema.safeParse(value.currentQuestion);

  if (!questionResult.success) {
    return participantAnswerDecision("game-state-invalid");
  }

  const question = questionResult.data;

  if (question.id !== input.questionId) {
    return participantAnswerDecision("question-mismatch");
  }

  const answers = isRecord(value.answers) ? value.answers : {};
  const questionAnswersValue = answers[input.questionId];
  const questionAnswers: Record<string, unknown> = isRecord(
    questionAnswersValue,
  )
    ? questionAnswersValue
    : {};
  const existingAnswerResult = storedParticipantAnswerSchema.safeParse(
    questionAnswers[input.participantId],
  );
  const participantScores = isRecord(value.participantScores)
    ? value.participantScores
    : {};
  const currentScoreValue = participantScores[input.participantId];
  const currentScore =
    typeof currentScoreValue === "number" &&
    Number.isInteger(currentScoreValue) &&
    currentScoreValue >= 0
      ? currentScoreValue
      : 0;

  if (existingAnswerResult.success) {
    return participantAnswerDecision(
      "already-submitted",
      existingAnswerResult.data,
      currentScore,
      value,
    );
  }

  if (value.phase !== "question") {
    return participantAnswerDecision("question-not-active");
  }

  const timingResult = phaseTimingSchema.safeParse(value.phaseTiming);

  if (!timingResult.success) {
    return participantAnswerDecision("game-state-invalid");
  }

  if (
    input.answeredAt >
    timingResult.data.startedAt + timingResult.data.durationMs
  ) {
    return participantAnswerDecision("answer-too-late");
  }

  const validOptionIds = new Set(question.options.map(({ id }) => id));

  if (
    input.selectedOptionIds.length !== 1 ||
    !validOptionIds.has(input.selectedOptionIds[0] ?? "")
  ) {
    return participantAnswerDecision("invalid-option");
  }

  const isCorrect = input.selectedOptionIds[0] === question.correctOptionIds[0];
  const pointsAwarded = calculateAnswerPoints({
    questionPoints: question.points,
    startedAt: timingResult.data.startedAt,
    durationMs: timingResult.data.durationMs,
    answeredAt: input.answeredAt,
    isCorrect,
  });
  const answer = storedParticipantAnswerSchema.parse({
    questionId: input.questionId,
    selectedOptionIds: input.selectedOptionIds,
    answeredAt: input.answeredAt,
    isCorrect,
    pointsAwarded,
  });
  const totalScore = currentScore + pointsAwarded;
  const updatedQuestionAnswers = {
    ...questionAnswers,
    [input.participantId]: answer,
  };
  const activeParticipantIds = Object.entries(participants)
    .filter(([, candidate]) => {
      if (
        !isRecord(candidate) ||
        (candidate.moderationStatus !== "waiting-approval" &&
          candidate.moderationStatus !== "approved")
      ) {
        return false;
      }

      return true;
    })
    .map(([participantId]) => participantId);
  const allActiveParticipantsAnswered =
    activeParticipantIds.length > 0 &&
    activeParticipantIds.every(
      (participantId) =>
        storedParticipantAnswerSchema.safeParse(
          updatedQuestionAnswers[participantId],
        ).success,
    );

  return participantAnswerDecision("accepted", answer, totalScore, {
    ...value,
    answers: {
      ...answers,
      [input.questionId]: updatedQuestionAnswers,
    },
    participantScores: {
      ...participantScores,
      [input.participantId]: totalScore,
    },
    ...(allActiveParticipantsAnswered
      ? {
          phase: "revealing",
          phaseTiming: null,
          revealedCorrectOptionIds: question.correctOptionIds,
        }
      : {}),
    updatedAt: input.answeredAt,
  });
}

export function isRestorableParticipant(
  value: unknown,
): value is Record<string, unknown> {
  return isRecord(value) && value.moderationStatus !== "removed";
}

export function isSameRestorableParticipant(
  value: unknown,
  nickname: string,
  avatar: string,
): boolean {
  return (
    isRestorableParticipant(value) &&
    value.nickname === nickname &&
    value.avatar === avatar
  );
}

export function resolveParticipantTransactionGame(
  currentValue: unknown,
  previouslyLoadedGame: Record<string, unknown>,
): Record<string, unknown> | null {
  if (isRecord(currentValue)) {
    return currentValue;
  }

  // A transação pode começar com null antes de o cache interno receber o
  // estado que acabou de ser consultado. O servidor fará uma nova tentativa
  // com o valor atual caso o hash não corresponda.
  return currentValue === null ? previouslyLoadedGame : null;
}

export function resolveAutomaticRevealPublicGame(
  currentValue: unknown,
  previouslyLoadedGame: Record<string, unknown>,
  questionId: string,
  correctOptionIds: string[],
): Record<string, unknown> | undefined {
  const publicGame = resolveParticipantTransactionGame(
    currentValue,
    previouslyLoadedGame,
  );

  if (
    !publicGame ||
    publicGame.phase !== "question" ||
    !isRecord(publicGame.currentQuestion) ||
    publicGame.currentQuestion.id !== questionId
  ) {
    return isRecord(currentValue) ? currentValue : undefined;
  }

  return {
    ...publicGame,
    phase: "revealing",
    phaseTiming: null,
    revealedCorrectOptionIds: correctOptionIds,
  };
}

function normalizeNicknameForComparison(nickname: string): string {
  return nickname.normalize("NFKC").toLocaleLowerCase("pt-BR");
}

function countRegisteredParticipants(value: unknown): number {
  if (!isRecord(value)) {
    return 0;
  }

  return Object.values(value).filter(
    (participant) =>
      isRecord(participant) &&
      (participant.moderationStatus === "waiting-approval" ||
        participant.moderationStatus === "approved"),
  ).length;
}

function getPublicParticipants(value: unknown): PublicWaitingRoomParticipant[] {
  if (!isRecord(value)) {
    return [];
  }

  return Object.values(value)
    .filter(isRecord)
    .filter(
      (participant) =>
        (participant.moderationStatus === "waiting-approval" ||
          participant.moderationStatus === "approved") &&
        typeof participant.nickname === "string",
    )
    .map((participant) => ({
      nickname: participant.nickname as string,
      avatar: participantAvatarSchema
        .catch(DEFAULT_PARTICIPANT_AVATAR)
        .parse(participant.avatar),
    }));
}

function getAdministratorEnvironment() {
  const result = administratorEnvironmentSchema.safeParse(process.env);

  if (!result.success) {
    throw new FirebaseAdminConfigurationError(
      "firebase-admin-environment-invalid",
      "Uma ou mais variáveis administrativas do Firebase estão ausentes ou inválidas.",
    );
  }

  return result.data;
}

export function getFirebaseAdminServices(): FirebaseAdminServices {
  if (cachedServices) {
    return cachedServices;
  }

  const environment = getAdministratorEnvironment();
  const privateKey = environment.FIREBASE_ADMIN_PRIVATE_KEY.replace(
    /\\n/g,
    "\n",
  ).trim();

  if (
    !privateKey.startsWith("-----BEGIN PRIVATE KEY-----") ||
    !privateKey.endsWith("-----END PRIVATE KEY-----")
  ) {
    throw new FirebaseAdminConfigurationError(
      "firebase-admin-private-key-invalid",
      "A chave privada da conta de serviço não possui o formato PEM esperado.",
    );
  }

  const existingApp = getApps().find(({ name }) => name === ADMIN_APP_NAME);
  let app = existingApp;

  if (!app) {
    try {
      app = initializeApp(
        {
          credential: cert({
            projectId: environment.FIREBASE_ADMIN_PROJECT_ID,
            clientEmail: environment.FIREBASE_ADMIN_CLIENT_EMAIL,
            privateKey,
          }),
          databaseURL: environment.FIREBASE_ADMIN_DATABASE_URL,
          projectId: environment.FIREBASE_ADMIN_PROJECT_ID,
        },
        ADMIN_APP_NAME,
      );
    } catch (error) {
      console.error("Falha ao inicializar Firebase Admin:", error);

      throw new FirebaseAdminConfigurationError(
        "firebase-admin-initialization-failed",
        "A conta de serviço do Firebase não pôde ser inicializada.",
      );
    }
  }

  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const database = getDatabase(app);

  cachedServices = {
    verifyIdToken: (idToken) => auth.verifyIdToken(idToken, true),
    getAdministratorProfile: async (uid) => {
      const snapshot = await firestore.doc(`administrators/${uid}`).get();

      return snapshot.exists ? snapshot.data() : null;
    },
    checkRealtimeDatabaseConnection: async () => {
      await database.ref("publicGames").limitToFirst(1).get();
    },
    createQuiz: async (ownerId, input, createdAt) => {
      const quizReference = firestore.collection("quizzes").doc();
      const quiz = {
        ownerId,
        title: input.title,
        description: input.description,
        status: "draft",
        questionCount: 0,
        createdAt,
        updatedAt: createdAt,
      };

      await quizReference.set(quiz);

      return { quizId: quizReference.id, quiz };
    },
    findQuizzes: async (ownerId) => {
      const snapshot = await firestore
        .collection("quizzes")
        .where("ownerId", "==", ownerId)
        .get();

      return snapshot.docs.map((document) => ({
        quizId: document.id,
        quiz: document.data(),
      }));
    },
    getQuiz: async (quizId) => {
      const snapshot = await firestore.doc(`quizzes/${quizId}`).get();

      return snapshot.exists ? snapshot.data() : null;
    },
    updateQuizStatus: async (quizId, status, updatedAt) => {
      const quizReference = firestore.doc(`quizzes/${quizId}`);
      await quizReference.update({ status, updatedAt });
      const snapshot = await quizReference.get();

      return snapshot.exists ? snapshot.data() : null;
    },
    updateQuizContent: async (quizId, content, updatedAt) => {
      const quizReference = firestore.doc(`quizzes/${quizId}`);
      await quizReference.update({
        title: content.title,
        description: content.description,
        questions: content.questions,
        questionCount: content.questions.length,
        updatedAt,
      });
      const snapshot = await quizReference.get();

      return snapshot.exists ? snapshot.data() : null;
    },
    detachQuizFromWaitingRooms: async (ownerId, quizId) => {
      const snapshot = await database
        .ref("liveGames")
        .orderByChild("ownerId")
        .equalTo(ownerId)
        .get();
      const rooms: unknown = snapshot.val();

      if (!isRecord(rooms)) return;

      const updates: Record<string, null> = {};

      for (const [gameId, room] of Object.entries(rooms)) {
        if (isRecord(room) && room.quizId === quizId) {
          updates[`liveGames/${gameId}/quizId`] = null;
          updates[`liveGames/${gameId}/quizTitle`] = null;
          updates[`publicGames/${gameId}/quizId`] = null;
          updates[`publicGames/${gameId}/quizTitle`] = null;
        }
      }

      if (Object.keys(updates).length > 0) {
        await database.ref().update(updates);
      }
    },
    syncQuizTitleWithWaitingRooms: async (ownerId, quizId, title) => {
      const snapshot = await database
        .ref("liveGames")
        .orderByChild("ownerId")
        .equalTo(ownerId)
        .get();
      const rooms: unknown = snapshot.val();

      if (!isRecord(rooms)) return;

      const updates: Record<string, string> = {};

      for (const [gameId, room] of Object.entries(rooms)) {
        if (isRecord(room) && room.quizId === quizId) {
          updates[`liveGames/${gameId}/quizTitle`] = title;
          updates[`publicGames/${gameId}/quizTitle`] = title;
        }
      }

      if (Object.keys(updates).length > 0) {
        await database.ref().update(updates);
      }
    },
    claimWaitingRoom: async (gameId, privateRoom) => {
      const result = await database
        .ref(`liveGames/${gameId}`)
        .transaction(
          (currentValue: unknown) =>
            currentValue === null ? privateRoom : undefined,
          undefined,
          false,
        );

      return result.committed;
    },
    publishWaitingRoom: async (gameId, publicRoom) => {
      await database.ref(`publicGames/${gameId}`).set(publicRoom);
    },
    removeWaitingRoom: async (gameId) => {
      await database.ref().update({
        [`liveGames/${gameId}`]: null,
        [`publicGames/${gameId}`]: null,
      });
    },
    getWaitingRoom: async (gameId) => {
      const snapshot = await database.ref(`liveGames/${gameId}`).get();

      return snapshot.exists() ? snapshot.val() : null;
    },
    findActiveWaitingRoom: async (ownerId) => {
      const snapshot = await database.ref("liveGames").get();
      const rooms: unknown = snapshot.val();

      if (!isRecord(rooms)) {
        return null;
      }

      const activeRoom = Object.entries(rooms)
        .filter(
          ([, room]) =>
            isRecord(room) &&
            room.ownerId === ownerId &&
            room.phase === "waiting",
        )
        .sort(([, firstRoom], [, secondRoom]) => {
          const firstCreatedAt =
            isRecord(firstRoom) && typeof firstRoom.createdAt === "number"
              ? firstRoom.createdAt
              : 0;
          const secondCreatedAt =
            isRecord(secondRoom) && typeof secondRoom.createdAt === "number"
              ? secondRoom.createdAt
              : 0;

          return secondCreatedAt - firstCreatedAt;
        })[0];

      return activeRoom ? { gameId: activeRoom[0], room: activeRoom[1] } : null;
    },
    findWaitingRooms: async (ownerId) => {
      const snapshot = await database
        .ref("liveGames")
        .orderByChild("ownerId")
        .equalTo(ownerId)
        .get();
      const rooms: unknown = snapshot.val();

      if (!isRecord(rooms)) {
        return [];
      }

      return Object.entries(rooms).map(([gameId, room]) => ({
        gameId,
        room,
      }));
    },
    setWaitingRoomPresentationStatus: async (
      gameId,
      presentationStatus,
      changedAt,
    ) => {
      const updates: Record<string, unknown> = {
        [`liveGames/${gameId}/presentationStatus`]: presentationStatus,
        [`liveGames/${gameId}/updatedAt`]: changedAt,
        [`liveGames/${gameId}/presentationEndedAt`]:
          presentationStatus === "inactive" ? changedAt : null,
        [`publicGames/${gameId}/presentationStatus`]: presentationStatus,
      };

      await database.ref().update(updates);
    },
    setWaitingRoomGameState: async (
      gameId,
      privateFields,
      publicFields,
      changedAt,
    ) => {
      const updates: Record<string, unknown> = {
        [`liveGames/${gameId}/updatedAt`]: changedAt,
      };

      for (const [field, value] of Object.entries(privateFields)) {
        updates[`liveGames/${gameId}/${field}`] = value;
      }

      for (const [field, value] of Object.entries(publicFields)) {
        updates[`publicGames/${gameId}/${field}`] = value;
      }

      await database.ref().update(updates);
    },
    setWaitingRoomQuiz: async (gameId, quiz, changedAt) => {
      const updates: Record<string, unknown> = {
        [`liveGames/${gameId}/quizId`]: quiz?.id ?? null,
        [`liveGames/${gameId}/quizTitle`]: quiz?.title ?? null,
        [`liveGames/${gameId}/updatedAt`]: changedAt,
        [`publicGames/${gameId}/quizId`]: quiz?.id ?? null,
        [`publicGames/${gameId}/quizTitle`]: quiz?.title ?? null,
      };

      await database.ref().update(updates);
    },
    saveArchivedWaitingRoom: async (gameId, room) => {
      await firestore.doc(`archivedWaitingRooms/${gameId}`).create(room);
    },
    getArchivedWaitingRooms: async (ownerId) => {
      const snapshot = await firestore
        .collection("archivedWaitingRooms")
        .where("ownerId", "==", ownerId)
        .get();

      return snapshot.docs.map((document) => ({
        gameId: document.id,
        room: document.data(),
      }));
    },
    getArchivedWaitingRoom: async (gameId) => {
      const snapshot = await firestore
        .doc(`archivedWaitingRooms/${gameId}`)
        .get();

      return snapshot.exists ? snapshot.data() : null;
    },
    deleteArchivedWaitingRoom: async (gameId) => {
      await firestore.doc(`archivedWaitingRooms/${gameId}`).delete();
    },
    registerParticipant: async (
      gameId,
      participantId,
      nickname,
      avatar,
      joinedAt,
    ) => {
      let outcome: ParticipantRegistrationOutcome = "room-not-found";
      const gameReference = database.ref(`liveGames/${gameId}`);
      const initialSnapshot = await gameReference.get();
      const initialGame: unknown = initialSnapshot.val();

      if (!isRecord(initialGame)) {
        return {
          outcome: "room-not-found",
          participant: null,
          participantCount: 0,
          participants: [],
        };
      }

      if (initialGame.phase !== "waiting") {
        return {
          outcome: "room-not-waiting",
          participant: null,
          participantCount: 0,
          participants: [],
        };
      }

      const result = await gameReference.transaction(
        (currentValue: unknown) => {
          const transactionGame = resolveParticipantTransactionGame(
            currentValue,
            initialGame,
          );

          if (!transactionGame) {
            outcome = "room-not-found";
            return undefined;
          }

          if (transactionGame.phase !== "waiting") {
            outcome = "room-not-waiting";
            return undefined;
          }

          const participants = isRecord(transactionGame.participants)
            ? transactionGame.participants
            : {};
          const existingParticipant = participants[participantId];

          if (
            isSameRestorableParticipant(existingParticipant, nickname, avatar)
          ) {
            outcome = "restored";
            return transactionGame;
          }

          const normalizedNickname = normalizeNicknameForComparison(nickname);
          const duplicateNickname = Object.entries(participants).some(
            ([candidateId, candidate]) =>
              candidateId !== participantId &&
              isRecord(candidate) &&
              candidate.moderationStatus !== "removed" &&
              typeof candidate.nickname === "string" &&
              normalizeNicknameForComparison(candidate.nickname) ===
                normalizedNickname,
          );

          if (duplicateNickname) {
            outcome = "nickname-taken";
            return undefined;
          }

          outcome = "joined";

          return {
            ...transactionGame,
            participants: {
              ...participants,
              [participantId]: {
                nickname,
                avatar,
                moderationStatus: "waiting-approval",
                joinedAt,
              },
            },
            updatedAt: joinedAt,
          };
        },
        undefined,
        false,
      );

      if (!result.committed) {
        return {
          outcome,
          participant: null,
          participantCount: 0,
          participants: [],
        };
      }

      const gameValue: unknown = result.snapshot.val();
      const participants = isRecord(gameValue)
        ? gameValue.participants
        : undefined;

      return {
        outcome,
        participant: isRecord(participants)
          ? (participants[participantId] ?? null)
          : null,
        participantCount: countRegisteredParticipants(participants),
        participants: getPublicParticipants(participants),
      };
    },
    getParticipant: async (gameId, participantId) => {
      const snapshot = await database
        .ref(`liveGames/${gameId}/participants/${participantId}`)
        .get();

      return snapshot.exists() ? snapshot.val() : null;
    },
    publishParticipantSummary: async (
      gameId,
      participantCount,
      participants,
    ) => {
      await database.ref(`publicGames/${gameId}`).update({
        participantCount,
        participants,
      });
    },
    removeParticipant: async (gameId, participantId, removedAt) => {
      const gameReference = database.ref(`liveGames/${gameId}`);
      const initialSnapshot = await gameReference.get();
      const initialGame: unknown = initialSnapshot.val();

      if (!isRecord(initialGame)) {
        return { removed: false, participantCount: 0, participants: [] };
      }

      let participantFound = false;
      const result = await gameReference.transaction(
        (currentValue: unknown) => {
          const transactionGame = resolveParticipantTransactionGame(
            currentValue,
            initialGame,
          );

          if (!transactionGame) {
            return undefined;
          }

          const participants = isRecord(transactionGame.participants)
            ? transactionGame.participants
            : {};
          const participant = participants[participantId];

          if (!isRecord(participant)) {
            return undefined;
          }

          participantFound = true;

          if (participant.moderationStatus === "removed") {
            return transactionGame;
          }

          const presence = isRecord(participant.presence)
            ? participant.presence
            : {};

          return {
            ...transactionGame,
            participants: {
              ...participants,
              [participantId]: {
                ...participant,
                moderationStatus: "removed",
                removedAt,
                presence: {
                  ...presence,
                  connections: null,
                  lastDisconnectedAt: removedAt,
                },
              },
            },
            updatedAt: removedAt,
          };
        },
        undefined,
        false,
      );

      if (!result.committed || !participantFound) {
        return { removed: false, participantCount: 0, participants: [] };
      }

      const gameValue: unknown = result.snapshot.val();
      const participants = isRecord(gameValue)
        ? gameValue.participants
        : undefined;

      return {
        removed: true,
        participantCount: countRegisteredParticipants(participants),
        participants: getPublicParticipants(participants),
      };
    },
    submitParticipantAnswer: async (
      gameId,
      participantId,
      questionId,
      selectedOptionIds,
      answeredAt,
    ) => {
      const gameReference = database.ref(`liveGames/${gameId}`);
      const initialSnapshot = await gameReference.get();
      const initialGame: unknown = initialSnapshot.val();
      const input = {
        participantId,
        questionId,
        selectedOptionIds,
        answeredAt,
      };
      let decision = resolveParticipantAnswerTransaction(initialGame, input);
      const publishAutomaticReveal = async () => {
        if (decision.game?.phase !== "revealing") {
          return;
        }

        const correctOptionIdsResult = z
          .array(z.string().min(1).max(128))
          .length(1)
          .safeParse(decision.game.revealedCorrectOptionIds);

        if (!correctOptionIdsResult.success) {
          return;
        }

        const publicGameReference = database.ref(`publicGames/${gameId}`);
        const initialPublicGameSnapshot = await publicGameReference.get();
        const initialPublicGame: unknown = initialPublicGameSnapshot.val();

        if (!isRecord(initialPublicGame)) {
          return;
        }

        await publicGameReference.transaction(
          (currentValue: unknown) =>
            resolveAutomaticRevealPublicGame(
              currentValue,
              initialPublicGame,
              questionId,
              correctOptionIdsResult.data,
            ),
          undefined,
          false,
        );
      };

      if (decision.outcome !== "accepted") {
        if (decision.outcome === "already-submitted") {
          await publishAutomaticReveal();
        }

        const { outcome, answer, totalScore } = decision;
        return { outcome, answer, totalScore };
      }

      const result = await gameReference.transaction(
        (currentValue: unknown) => {
          const transactionGame = isRecord(initialGame)
            ? resolveParticipantTransactionGame(currentValue, initialGame)
            : null;
          decision = resolveParticipantAnswerTransaction(
            transactionGame,
            input,
          );

          if (decision.outcome === "accepted") {
            return decision.game ?? undefined;
          }

          if (decision.outcome === "already-submitted") {
            return transactionGame;
          }

          return undefined;
        },
        undefined,
        false,
      );

      if (!result.committed) {
        const { outcome, answer, totalScore } = decision;
        return { outcome, answer, totalScore };
      }

      await publishAutomaticReveal();
      const { outcome, answer, totalScore } = decision;
      return { outcome, answer, totalScore };
    },
  };

  return cachedServices;
}
