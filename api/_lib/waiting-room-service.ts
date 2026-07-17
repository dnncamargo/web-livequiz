import { randomInt } from "node:crypto";
import {
  WAITING_ROOM_CODE_ALPHABET,
  WAITING_ROOM_CODE_LENGTH,
  publicWaitingRoomSchema,
  type PublicWaitingRoom,
} from "../../src/shared/waiting-room";
import type { FirebaseAdminServices } from "./firebase-admin";
import { HttpError } from "./http-error";

const MAX_CODE_GENERATION_ATTEMPTS = 8;

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
