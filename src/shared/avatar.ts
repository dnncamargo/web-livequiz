import { z } from "zod";

export const PARTICIPANT_AVATARS = [
  "🦊",
  "🐼",
  "🐸",
  "🦁",
  "🐙",
  "🦄",
  "🚀",
  "🌟",
] as const;

export const DEFAULT_PARTICIPANT_AVATAR = PARTICIPANT_AVATARS[0];

export const participantAvatarSchema = z.enum(PARTICIPANT_AVATARS);

export type ParticipantAvatar = z.infer<typeof participantAvatarSchema>;
