import { z } from "zod";
import type { FirebaseAdminServices } from "./firebase-admin";
import { HttpError } from "./http-error";

const administratorTokenSchema = z.object({
  uid: z.string().min(1),
  email: z.string().email(),
  email_verified: z.literal(true),
  firebase: z.object({
    sign_in_provider: z.literal("google.com"),
  }),
});

const administratorProfileSchema = z.object({
  active: z.literal(true),
  email: z.string().email().optional(),
});

export interface AuthorizedAdministrator {
  uid: string;
  email: string;
}

function getBearerToken(request: Request): string {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  if (!match?.[1]) {
    throw new HttpError(
      401,
      "authentication-required",
      "Entre novamente com uma conta administrativa.",
    );
  }

  return match[1];
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function authorizeAdministratorRequest(
  request: Request,
  services: FirebaseAdminServices,
): Promise<AuthorizedAdministrator> {
  let decodedToken: unknown;

  try {
    decodedToken = await services.verifyIdToken(getBearerToken(request));
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(
      401,
      "invalid-token",
      "Sua sessão administrativa expirou. Entre novamente.",
    );
  }

  const tokenResult = administratorTokenSchema.safeParse(decodedToken);

  if (!tokenResult.success) {
    throw new HttpError(
      403,
      "administrator-required",
      "Esta conta não possui uma identidade administrativa válida.",
    );
  }

  const profile = await services.getAdministratorProfile(tokenResult.data.uid);
  const profileResult = administratorProfileSchema.safeParse(profile);

  if (!profileResult.success) {
    throw new HttpError(
      403,
      "administrator-not-authorized",
      "Esta conta não está autorizada a criar salas.",
    );
  }

  if (
    profileResult.data.email &&
    normalizeEmail(profileResult.data.email) !==
      normalizeEmail(tokenResult.data.email)
  ) {
    throw new HttpError(
      403,
      "administrator-email-mismatch",
      "O e-mail da conta não corresponde ao perfil administrativo.",
    );
  }

  return {
    uid: tokenResult.data.uid,
    email: tokenResult.data.email,
  };
}
