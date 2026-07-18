import { z } from "zod";
import {
  DEFAULT_PARTICIPANT_AVATAR,
  participantAvatarSchema,
} from "../../src/shared/avatar.js";
import {
  joinParticipantRequestSchema,
  participantModerationStatusSchema,
  participantNicknameSchema,
  participantSessionSchema,
  type JoinParticipantRequest,
  type ParticipantSession,
} from "../../src/shared/participant.js";
import { waitingRoomCodeSchema } from "../../src/shared/waiting-room.js";
import type { FirebaseAdminServices } from "./firebase-admin.js";
import { HttpError } from "./http-error.js";

const participantRecordSchema = z.object({
  nickname: participantNicknameSchema,
  avatar: participantAvatarSchema.default(DEFAULT_PARTICIPANT_AVATAR),
  moderationStatus: participantModerationStatusSchema,
  joinedAt: z.number().int().nonnegative(),
});

function parseParticipantSession(
  gameId: string,
  participantId: string,
  value: unknown,
): ParticipantSession {
  const recordResult = participantRecordSchema.safeParse(value);

  if (!recordResult.success) {
    throw new HttpError(
      500,
      "participant-state-invalid",
      "O registro do participante contém dados inválidos.",
    );
  }

  return participantSessionSchema.parse({
    gameId,
    participantId,
    ...recordResult.data,
  });
}

export async function joinWaitingRoom(
  participantId: string,
  input: JoinParticipantRequest,
  services: FirebaseAdminServices,
  now: () => number = Date.now,
): Promise<ParticipantSession> {
  const parsedInput = joinParticipantRequestSchema.parse(input);
  let registration: Awaited<
    ReturnType<FirebaseAdminServices["registerParticipant"]>
  >;

  try {
    registration = await services.registerParticipant(
      parsedInput.gameId,
      participantId,
      parsedInput.nickname,
      parsedInput.avatar,
      now(),
    );
  } catch (error) {
    console.error(
      "Falha ao registrar participante no Realtime Database:",
      error,
    );

    throw new HttpError(
      503,
      "participant-registration-unavailable",
      "A sala foi localizada, mas não foi possível salvar sua participação. Tente novamente.",
    );
  }

  if (registration.outcome === "room-not-found") {
    throw new HttpError(
      404,
      "room-not-found",
      "Não encontramos uma sala com esse código.",
    );
  }

  if (registration.outcome === "room-not-waiting") {
    throw new HttpError(
      409,
      "room-not-waiting",
      "Esta partida não está mais recebendo participantes.",
    );
  }

  if (registration.outcome === "nickname-taken") {
    throw new HttpError(
      409,
      "nickname-taken",
      "Esse nickname já está sendo usado nesta sala.",
    );
  }

  const participant = parseParticipantSession(
    parsedInput.gameId,
    participantId,
    registration.participant,
  );

  try {
    await services.publishParticipantSummary(
      parsedInput.gameId,
      registration.participantCount,
      registration.participants ?? [],
    );
  } catch (error) {
    console.error(
      "Participante registrado, mas a contagem pública não foi atualizada:",
      error,
    );
  }

  return participant;
}

export async function getParticipantSession(
  gameId: string,
  participantId: string,
  services: FirebaseAdminServices,
): Promise<ParticipantSession> {
  const parsedGameId = waitingRoomCodeSchema.parse(gameId);
  const participant = await services.getParticipant(
    parsedGameId,
    participantId,
  );

  if (participant === null) {
    throw new HttpError(
      404,
      "participant-not-found",
      "Não encontramos sua participação nesta sala.",
    );
  }

  return parseParticipantSession(parsedGameId, participantId, participant);
}
