import {
  browserLocalPersistence,
  setPersistence,
  signInAnonymously,
  type User,
} from "firebase/auth";
import { auth } from "../../lib/firebase";

let localPersistencePromise: Promise<void> | null = null;
let participantSignInPromise: Promise<User> | null = null;

export class ParticipantSessionConflictError extends Error {
  readonly code = "participant/session-conflict";

  constructor() {
    super("Uma conta administrativa já está ativa neste dispositivo.");
    this.name = "ParticipantSessionConflictError";
  }
}

export function ensureAuthLocalPersistence(): Promise<void> {
  if (!localPersistencePromise) {
    localPersistencePromise = setPersistence(
      auth,
      browserLocalPersistence,
    ).catch((error: unknown) => {
      localPersistencePromise = null;
      throw error;
    });
  }

  return localPersistencePromise;
}

export async function signInParticipantAnonymously(): Promise<User> {
  await ensureAuthLocalPersistence();

  const currentUser = auth.currentUser;

  if (currentUser) {
    if (!currentUser.isAnonymous) {
      throw new ParticipantSessionConflictError();
    }

    return currentUser;
  }

  if (!participantSignInPromise) {
    participantSignInPromise = signInAnonymously(auth).then(
      (credential) => credential.user,
    );
  }

  try {
    return await participantSignInPromise;
  } finally {
    participantSignInPromise = null;
  }
}
