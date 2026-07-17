import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";

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
  registerParticipant: (
    gameId: string,
    participantId: string,
    nickname: string,
    joinedAt: number,
  ) => Promise<ParticipantRegistrationResult>;
  getParticipant: (
    gameId: string,
    participantId: string,
  ) => Promise<unknown | null>;
  publishParticipantCount: (
    gameId: string,
    participantCount: number,
  ) => Promise<void>;
  removeParticipant: (
    gameId: string,
    participantId: string,
    removedAt: number,
  ) => Promise<ParticipantRemovalResult>;
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
}

export interface ParticipantRemovalResult {
  removed: boolean;
  participantCount: number;
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
    registerParticipant: async (gameId, participantId, nickname, joinedAt) => {
      let outcome: ParticipantRegistrationOutcome = "room-not-found";
      const gameReference = database.ref(`liveGames/${gameId}`);
      const initialSnapshot = await gameReference.get();
      const initialGame: unknown = initialSnapshot.val();

      if (!isRecord(initialGame)) {
        return {
          outcome: "room-not-found",
          participant: null,
          participantCount: 0,
        };
      }

      if (initialGame.phase !== "waiting") {
        return {
          outcome: "room-not-waiting",
          participant: null,
          participantCount: 0,
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

          if (isRecord(existingParticipant)) {
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
        return { outcome, participant: null, participantCount: 0 };
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
      };
    },
    getParticipant: async (gameId, participantId) => {
      const snapshot = await database
        .ref(`liveGames/${gameId}/participants/${participantId}`)
        .get();

      return snapshot.exists() ? snapshot.val() : null;
    },
    publishParticipantCount: async (gameId, participantCount) => {
      await database
        .ref(`publicGames/${gameId}/participantCount`)
        .set(participantCount);
    },
    removeParticipant: async (gameId, participantId, removedAt) => {
      const gameReference = database.ref(`liveGames/${gameId}`);
      const initialSnapshot = await gameReference.get();
      const initialGame: unknown = initialSnapshot.val();

      if (!isRecord(initialGame)) {
        return { removed: false, participantCount: 0 };
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
        return { removed: false, participantCount: 0 };
      }

      const gameValue: unknown = result.snapshot.val();
      const participants = isRecord(gameValue)
        ? gameValue.participants
        : undefined;

      return {
        removed: true,
        participantCount: countRegisteredParticipants(participants),
      };
    },
  };

  return cachedServices;
}
