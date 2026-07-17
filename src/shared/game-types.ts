export const LIVE_GAME_PHASES = [
  "waiting",
  "countdown",
  "question",
  "revealing",
  "ranking",
  "podium",
  "finished",
] as const;

export type LiveGamePhase = (typeof LIVE_GAME_PHASES)[number];

export const PARTICIPANT_PRESENCE_STATUSES = [
  "waiting-approval",
  "approved",
  "connected",
  "reconnecting",
  "temporarily-disconnected",
  "absent",
  "removed",
] as const;

export type ParticipantPresenceStatus =
  (typeof PARTICIPANT_PRESENCE_STATUSES)[number];

export interface QuestionTiming {
  startedAt: number;
  durationMs: number;
}

export interface ParticipantConnection {
  connectedAt: number;
  lastSeenAt: number;
}

export type ParticipantConnections = Record<string, ParticipantConnection>;
