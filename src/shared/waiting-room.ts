import { z } from "zod";
import { participantAvatarSchema } from "./avatar.js";
import { quizIdSchema } from "./quiz.js";

export const WAITING_ROOM_CODE_LENGTH = 6;
export const WAITING_ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const WAITING_ROOM_NAME_MIN_LENGTH = 2;
export const WAITING_ROOM_NAME_MAX_LENGTH = 60;

export const waitingRoomCodeSchema = z
  .string()
  .regex(
    /^[A-HJ-NP-Z2-9]{6}$/,
    "O código da sala deve ter seis caracteres válidos.",
  );

const normalizedWaitingRoomNameSchema = z
  .string()
  .min(
    WAITING_ROOM_NAME_MIN_LENGTH,
    "Informe um nome com pelo menos dois caracteres.",
  )
  .max(
    WAITING_ROOM_NAME_MAX_LENGTH,
    "O nome da sala pode ter no máximo 60 caracteres.",
  );

export const waitingRoomNameSchema = z
  .string()
  .transform((name) => name.trim().replace(/\s+/g, " "))
  .pipe(normalizedWaitingRoomNameSchema);

export const waitingRoomPhaseSchema = z.enum(["waiting", "finished"]);
export const presentationStatusSchema = z.enum(["inactive", "active"]);

export const publicWaitingRoomParticipantSchema = z
  .object({
    nickname: z.string().min(2).max(20),
    avatar: participantAvatarSchema,
  })
  .strict();

export const publicWaitingRoomSchema = z
  .object({
    id: waitingRoomCodeSchema,
    name: normalizedWaitingRoomNameSchema.optional(),
    quizId: quizIdSchema.optional(),
    quizTitle: z.string().min(3).max(100).optional(),
    phase: waitingRoomPhaseSchema,
    presentationStatus: presentationStatusSchema.optional(),
    createdAt: z.number().int().nonnegative(),
    participantCount: z.number().int().nonnegative(),
    participants: z.array(publicWaitingRoomParticipantSchema).optional(),
  })
  .strict();

export const createWaitingRoomRequestSchema = z
  .object({ name: waitingRoomNameSchema, quizId: quizIdSchema.optional() })
  .strict();

export const createWaitingRoomResponseSchema = z
  .object({ room: publicWaitingRoomSchema })
  .strict();

export const waitingRoomLibraryResponseSchema = z
  .object({ rooms: z.array(publicWaitingRoomSchema) })
  .strict();

export const archivedWaitingRoomSchema = z
  .object({
    id: waitingRoomCodeSchema,
    name: normalizedWaitingRoomNameSchema,
    quizId: quizIdSchema.optional(),
    quizTitle: z.string().min(3).max(100).optional(),
    createdAt: z.number().int().nonnegative(),
    archivedAt: z.number().int().nonnegative(),
    participantCount: z.number().int().nonnegative(),
  })
  .strict();

export const archivedWaitingRoomLibraryResponseSchema = z
  .object({ rooms: z.array(archivedWaitingRoomSchema) })
  .strict();

export const endWaitingRoomRequestSchema = z
  .object({
    gameId: waitingRoomCodeSchema,
    action: z.literal("end-room"),
  })
  .strict();

export const presentWaitingRoomRequestSchema = z
  .object({
    gameId: waitingRoomCodeSchema,
    action: z.literal("present-room"),
  })
  .strict();

export const archiveWaitingRoomRequestSchema = z
  .object({
    gameId: waitingRoomCodeSchema,
    action: z.literal("archive-room"),
  })
  .strict();

export const restoreWaitingRoomRequestSchema = z
  .object({
    gameId: waitingRoomCodeSchema,
    action: z.literal("restore-room"),
  })
  .strict();

export const deleteArchivedWaitingRoomRequestSchema = z
  .object({
    gameId: waitingRoomCodeSchema,
    action: z.literal("delete-room"),
  })
  .strict();

export const waitingRoomMutationResponseSchema = z
  .object({ room: publicWaitingRoomSchema })
  .strict();

export const archivedWaitingRoomMutationResponseSchema = z
  .object({ archivedRoom: archivedWaitingRoomSchema })
  .strict();

export const deleteArchivedWaitingRoomResponseSchema = z
  .object({ deletedGameId: waitingRoomCodeSchema })
  .strict();

export const apiErrorResponseSchema = z
  .object({
    error: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export type PublicWaitingRoom = z.infer<typeof publicWaitingRoomSchema>;
export type PublicWaitingRoomParticipant = z.infer<
  typeof publicWaitingRoomParticipantSchema
>;
export type CreateWaitingRoomRequest = z.infer<
  typeof createWaitingRoomRequestSchema
>;
export type ArchivedWaitingRoom = z.infer<typeof archivedWaitingRoomSchema>;
export type EndWaitingRoomRequest = z.infer<typeof endWaitingRoomRequestSchema>;
export type PresentWaitingRoomRequest = z.infer<
  typeof presentWaitingRoomRequestSchema
>;
export type ArchiveWaitingRoomRequest = z.infer<
  typeof archiveWaitingRoomRequestSchema
>;
export type RestoreWaitingRoomRequest = z.infer<
  typeof restoreWaitingRoomRequestSchema
>;
export type DeleteArchivedWaitingRoomRequest = z.infer<
  typeof deleteArchivedWaitingRoomRequestSchema
>;
