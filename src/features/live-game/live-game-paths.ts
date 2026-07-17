import { z } from "zod";

const firebaseKeySegmentSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .refine((value) => {
    const hasForbiddenCharacter = [".", "#", "$", "[", "]", "/"].some(
      (character) => value.includes(character),
    );
    const hasControlCharacter = Array.from(value).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;

      return codePoint <= 31 || codePoint === 127;
    });

    return !hasForbiddenCharacter && !hasControlCharacter;
  }, "O identificador contém caracteres inválidos para o Firebase.");

export const gameIdSchema = firebaseKeySegmentSchema.brand<"GameId">();
export const participantIdSchema =
  firebaseKeySegmentSchema.brand<"ParticipantId">();

export interface ParticipantPresencePathInput {
  gameId: string;
  participantId: string;
}

export function getParticipantPresencePath(
  input: ParticipantPresencePathInput,
): string {
  const gameId = gameIdSchema.parse(input.gameId);
  const participantId = participantIdSchema.parse(input.participantId);

  return `liveGames/${gameId}/participants/${participantId}/presence`;
}

export function getParticipantConnectionsPath(
  input: ParticipantPresencePathInput,
): string {
  return `${getParticipantPresencePath(input)}/connections`;
}
