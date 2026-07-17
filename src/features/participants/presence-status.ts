import type {
  ParticipantConnections,
  ParticipantPresenceStatus,
} from "../../shared/game-types";

export type ParticipantModerationStatus =
  "waiting-approval" | "approved" | "removed";

export interface DeriveParticipantPresenceStatusInput {
  moderationStatus: ParticipantModerationStatus;
  connections: ParticipantConnections | null | undefined;
  lastDisconnectedAt: number | null;
  now: number;
  absenceGraceMs: number;
}

export function deriveParticipantPresenceStatus({
  moderationStatus,
  connections,
  lastDisconnectedAt,
  now,
  absenceGraceMs,
}: DeriveParticipantPresenceStatusInput): ParticipantPresenceStatus {
  if (moderationStatus === "removed") {
    return "removed";
  }

  if (moderationStatus === "waiting-approval") {
    return "waiting-approval";
  }

  if (connections && Object.keys(connections).length > 0) {
    return "connected";
  }

  if (lastDisconnectedAt === null) {
    return "approved";
  }

  if (Math.max(0, now - lastDisconnectedAt) < absenceGraceMs) {
    return "temporarily-disconnected";
  }

  return "absent";
}
