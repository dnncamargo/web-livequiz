import { z } from "zod";

export const WAITING_ROOM_CODE_LENGTH = 6;
export const WAITING_ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const waitingRoomCodeSchema = z
  .string()
  .regex(
    /^[A-HJ-NP-Z2-9]{6}$/,
    "O código da sala deve ter seis caracteres válidos.",
  );

export const publicWaitingRoomSchema = z
  .object({
    id: waitingRoomCodeSchema,
    phase: z.literal("waiting"),
    createdAt: z.number().int().nonnegative(),
    participantCount: z.number().int().nonnegative(),
  })
  .strict();

export const createWaitingRoomResponseSchema = z
  .object({
    room: publicWaitingRoomSchema,
  })
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
