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
  claimWaitingRoom: (
    gameId: string,
    privateRoom: Record<string, unknown>,
  ) => Promise<boolean>;
  publishWaitingRoom: (
    gameId: string,
    publicRoom: Record<string, unknown>,
  ) => Promise<void>;
  removeWaitingRoom: (gameId: string) => Promise<void>;
}

let cachedServices: FirebaseAdminServices | null = null;

function getAdministratorEnvironment() {
  const result = administratorEnvironmentSchema.safeParse(process.env);

  if (!result.success) {
    throw new Error(
      "A integração administrativa do Firebase não está configurada no servidor.",
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
  );
  const existingApp = getApps().find(({ name }) => name === ADMIN_APP_NAME);
  const app =
    existingApp ??
    initializeApp(
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
  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const database = getDatabase(app);

  cachedServices = {
    verifyIdToken: (idToken) => auth.verifyIdToken(idToken, true),
    getAdministratorProfile: async (uid) => {
      const snapshot = await firestore.doc(`administrators/${uid}`).get();

      return snapshot.exists ? snapshot.data() : null;
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
  };

  return cachedServices;
}
