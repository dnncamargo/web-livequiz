import { getApps, initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const LEGACY_FIREBASE_APP_NAME = "quizumba-legacy";
const legacyFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
};
const missingLegacyVariables = Object.entries(legacyFirebaseConfig)
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missingLegacyVariables.length > 0) {
  throw new Error(
    `Variáveis Firebase ausentes na apresentação legacy: ${missingLegacyVariables.join(", ")}`,
  );
}

const legacyFirebaseApp =
  getApps().find(({ name }) => name === LEGACY_FIREBASE_APP_NAME) ??
  initializeApp(legacyFirebaseConfig, LEGACY_FIREBASE_APP_NAME);

export const legacyRealtimeDatabase = getDatabase(legacyFirebaseApp);
