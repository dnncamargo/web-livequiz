import { randomInt } from "node:crypto";
import { z } from "zod";
import {
  WAITING_ROOM_CODE_ALPHABET,
  WAITING_ROOM_CODE_LENGTH,
  publicWaitingRoomSchema,
  waitingRoomCodeSchema,
  type PublicWaitingRoom,
} from "../../src/shared/waiting-room.js";
import {
  managedWaitingRoomResponseSchema,
  participantModerationStatusSchema,
  participantNicknameSchema,
  type ManagedWaitingRoom,
} from "../../src/shared/participant.js";
import type { FirebaseAdminServices } from "./firebase-admin.js";
import { HttpError } from "./http-error.js";

const MAX_CODE_GENERATION_ATTEMPTS = 8;

const privateParticipantSchema = z
  .object({
    nickname: participantNicknameSchema,
    moderationStatus: participantModerationStatusSchema,
    joinedAt: z.number().int().nonnegative(),
    presence: z
      .object({
        connections: z.record(z.string(), z.unknown()).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const privateWaitingRoomSchema = z
  .object({
    ownerId: z.string().min(1),
    phase: z.literal("waiting"),
    createdAt: z.number().int().nonnegative(),
    participants: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export type RandomIndexGenerator = (maximum: number) => number;

export function generateWaitingRoomCode(
  generateRandomIndex: RandomIndexGenerator = randomInt,
): string {
  return Array.from({ length: WAITING_ROOM_CODE_LENGTH }, () => {
    const index = generateRandomIndex(WAITING_ROOM_CODE_ALPHABET.length);
    const character = WAITING_ROOM_CODE_ALPHABET[index];

    if (!character) {
      throw new RangeError("O gerador retornou um índice inválido.");
    }

    return character;
  }).join("");
}

export async function createWaitingRoom(
  ownerId: string,
  services: FirebaseAdminServices,
  generateCode: () => string = generateWaitingRoomCode,
): Promise<PublicWaitingRoom> {
  for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt += 1) {
    const gameId = generateCode();
    const createdAt = Date.now();
    const privateRoom = {
      ownerId,
      phase: "waiting",
      createdAt,
      updatedAt: createdAt,
    };
    const publicRoom = publicWaitingRoomSchema.parse({
      id: gameId,
      phase: "waiting",
      createdAt,
      participantCount: 0,
    });
    const claimed = await services.claimWaitingRoom(gameId, privateRoom);

    if (!claimed) {
      continue;
    }

    try {
      await services.publishWaitingRoom(gameId, publicRoom);
      return publicRoom;
    } catch (error) {
      await services
        .removeWaitingRoom(gameId)
        .catch((rollbackError: unknown) => {
          console.error("Falha ao desfazer a criação da sala:", rollbackError);
        });

      throw error;
    }
  }

  throw new HttpError(
    503,
    "room-code-unavailable",
    "Não foi possível gerar um código de sala. Tente novamente.",
  );
}

export async function getManagedWaitingRoom(
  ownerId: string,
  services: FirebaseAdminServices,
  requestedGameId?: string,
): Promise<ManagedWaitingRoom> {
  const gameIdResult = requestedGameId
    ? waitingRoomCodeSchema.safeParse(requestedGameId)
    : null;

  if (gameIdResult && !gameIdResult.success) {
    throw new HttpError(
      400,
      "invalid-room-code",
      "O código da sala informado é inválido.",
    );
  }

  const parsedGameId = gameIdResult?.data;
  const locatedRoom = parsedGameId
    ? {
        gameId: parsedGameId,
        room: await services.getWaitingRoom(parsedGameId),
      }
    : await services.findActiveWaitingRoom(ownerId);

  if (!locatedRoom?.room) {
    throw new HttpError(
      404,
      requestedGameId ? "room-not-found" : "active-room-not-found",
      requestedGameId
        ? "A sala solicitada não existe ou já foi encerrada."
        : "Nenhuma sala de espera ativa foi encontrada.",
    );
  }

  const roomResult = privateWaitingRoomSchema.safeParse(locatedRoom.room);

  if (!roomResult.success) {
    throw new HttpError(
      500,
      "waiting-room-state-invalid",
      "A sala de espera contém dados inválidos.",
    );
  }

  if (roomResult.data.ownerId !== ownerId) {
    throw new HttpError(
      403,
      "waiting-room-owner-required",
      "Esta sala pertence a outro administrador.",
    );
  }

  const participants = Object.entries(roomResult.data.participants ?? {})
    .map(([participantId, value]) => {
      const participantResult = privateParticipantSchema.safeParse(value);

      if (!participantResult.success) {
        return null;
      }

      const connections = participantResult.data.presence?.connections;

      return {
        participantId,
        nickname: participantResult.data.nickname,
        moderationStatus: participantResult.data.moderationStatus,
        joinedAt: participantResult.data.joinedAt,
        presenceStatus:
          connections && Object.keys(connections).length > 0
            ? ("connected" as const)
            : ("disconnected" as const),
      };
    })
    .filter((participant) => participant !== null)
    .sort((first, second) => first.joinedAt - second.joinedAt);

  return managedWaitingRoomResponseSchema.parse({
    room: {
      id: locatedRoom.gameId,
      phase: roomResult.data.phase,
      createdAt: roomResult.data.createdAt,
      participantCount: participants.filter(
        ({ moderationStatus }) => moderationStatus !== "removed",
      ).length,
    },
    participants,
  });
}
