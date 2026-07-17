import {
  GoogleAuthProvider,
  signInWithPopup,
  type User,
  type UserInfo,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { z } from "zod";
import { auth, db } from "../../lib/firebase";
import { ensureAuthLocalPersistence } from "./participant-auth";

const administratorProfileSchema = z.object({
  active: z.boolean(),
  email: z.string().email().optional(),
});

interface AdministratorIdentity {
  uid: string;
  email: string | null;
  isAnonymous: boolean;
  providerData: ReadonlyArray<Pick<UserInfo, "providerId">>;
}

export type AdministratorAuthorizationReason =
  | "not-google-user"
  | "profile-not-found"
  | "invalid-profile"
  | "inactive-profile"
  | "email-mismatch";

export type AdministratorAuthorizationResult =
  | { authorized: true }
  | {
      authorized: false;
      reason: AdministratorAuthorizationReason;
    };

function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase("pt-BR");
}

function isGoogleIdentity(identity: AdministratorIdentity): boolean {
  return (
    !identity.isAnonymous &&
    identity.providerData.some(
      ({ providerId }) => providerId === GoogleAuthProvider.PROVIDER_ID,
    )
  );
}

export async function signInAdministratorWithGoogle(): Promise<User> {
  await ensureAuthLocalPersistence();

  const provider = new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt: "select_account",
  });

  const credential = await signInWithPopup(auth, provider);

  return credential.user;
}

export async function checkAdministratorAuthorization(
  identity: AdministratorIdentity,
): Promise<AdministratorAuthorizationResult> {
  if (!isGoogleIdentity(identity)) {
    return { authorized: false, reason: "not-google-user" };
  }

  const profileSnapshot = await getDoc(doc(db, "administrators", identity.uid));

  if (!profileSnapshot.exists()) {
    return { authorized: false, reason: "profile-not-found" };
  }

  const parsedProfile = administratorProfileSchema.safeParse(
    profileSnapshot.data(),
  );

  if (!parsedProfile.success) {
    return { authorized: false, reason: "invalid-profile" };
  }

  if (!parsedProfile.data.active) {
    return { authorized: false, reason: "inactive-profile" };
  }

  if (
    parsedProfile.data.email &&
    (!identity.email ||
      normalizeEmail(parsedProfile.data.email) !==
        normalizeEmail(identity.email))
  ) {
    return { authorized: false, reason: "email-mismatch" };
  }

  return { authorized: true };
}
