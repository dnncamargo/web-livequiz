import { z } from "zod";
import type { FirebaseAdminServices } from "./firebase-admin.js";
import { HttpError } from "./http-error.js";

const participantTokenSchema = z.object({
  uid: z.string().min(1),
  firebase: z.object({
    sign_in_provider: z.literal("anonymous"),
  }),
});

export interface AuthorizedParticipant {
  uid: string;
}

function getBearerToken(request: Request): string {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  if (!match?.[1]) {
    throw new HttpError(
      401,
      "authentication-required",
      "Entre novamente como participante.",
    );
  }

  return match[1];
}

export async function authorizeParticipantRequest(
  request: Request,
  services: FirebaseAdminServices,
): Promise<AuthorizedParticipant> {
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
      "Sua sessão de participante expirou. Entre novamente.",
    );
  }

  const tokenResult = participantTokenSchema.safeParse(decodedToken);

  if (!tokenResult.success) {
    throw new HttpError(
      403,
      "anonymous-participant-required",
      "Esta ação exige uma sessão anônima de participante.",
    );
  }

  return { uid: tokenResult.data.uid };
}
