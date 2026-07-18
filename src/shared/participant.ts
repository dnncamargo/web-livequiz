import { z } from "zod";
import {
  publicWaitingRoomSchema,
  waitingRoomCodeSchema,
} from "./waiting-room.js";
import {
  DEFAULT_PARTICIPANT_AVATAR,
  participantAvatarSchema,
} from "./avatar.js";

export const PARTICIPANT_NICKNAME_MIN_LENGTH = 2;
export const PARTICIPANT_NICKNAME_MAX_LENGTH = 20;

const normalizedNicknameSchema = z
  .string()
  .min(
    PARTICIPANT_NICKNAME_MIN_LENGTH,
    "Escolha um nickname com pelo menos dois caracteres.",
  )
  .max(
    PARTICIPANT_NICKNAME_MAX_LENGTH,
    "O nickname pode ter no máximo 20 caracteres.",
  )
  .regex(
    /^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u,
    "Use letras, números, espaços, ponto, hífen ou sublinhado.",
  );

export const participantNicknameSchema = z
  .string()
  .transform((nickname) => nickname.trim().replace(/\s+/g, " "))
  .pipe(normalizedNicknameSchema);

export const participantGameCodeSchema = z
  .string()
  .transform((gameId) => gameId.trim().toUpperCase())
  .pipe(waitingRoomCodeSchema);

export const participantModerationStatusSchema = z.enum([
  "waiting-approval",
  "approved",
  "removed",
]);

export const joinParticipantRequestSchema = z
  .object({
    gameId: participantGameCodeSchema,
    nickname: participantNicknameSchema,
    avatar: participantAvatarSchema,
  })
  .strict();

export const participantSessionSchema = z
  .object({
    gameId: waitingRoomCodeSchema,
    participantId: z.string().min(1),
    nickname: normalizedNicknameSchema,
    avatar: participantAvatarSchema.default(DEFAULT_PARTICIPANT_AVATAR),
    moderationStatus: participantModerationStatusSchema,
    joinedAt: z.number().int().nonnegative(),
  })
  .strict();

export const participantSessionResponseSchema = z
  .object({ participant: participantSessionSchema })
  .strict();

export const removeWaitingRoomParticipantRequestSchema = z
  .object({
    gameId: participantGameCodeSchema,
    participantId: z.string().min(1),
    action: z.literal("remove"),
  })
  .strict();

export const managedWaitingRoomParticipantSchema = z
  .object({
    participantId: z.string().min(1),
    nickname: normalizedNicknameSchema,
    moderationStatus: participantModerationStatusSchema,
    joinedAt: z.number().int().nonnegative(),
    presenceStatus: z.enum(["connected", "disconnected"]),
  })
  .strict();

export const managedWaitingRoomResponseSchema = z
  .object({
    room: publicWaitingRoomSchema,
    participants: z.array(managedWaitingRoomParticipantSchema),
  })
  .strict();

export type JoinParticipantRequest = z.infer<
  typeof joinParticipantRequestSchema
>;
export type ParticipantModerationStatus = z.infer<
  typeof participantModerationStatusSchema
>;
export type ParticipantSession = z.infer<typeof participantSessionSchema>;
export type RemoveWaitingRoomParticipantRequest = z.infer<
  typeof removeWaitingRoomParticipantRequestSchema
>;
export type ManagedWaitingRoom = z.infer<
  typeof managedWaitingRoomResponseSchema
>;
export type ManagedWaitingRoomParticipant = z.infer<
  typeof managedWaitingRoomParticipantSchema
>;
