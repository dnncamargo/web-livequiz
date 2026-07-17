import { describe, expect, it } from "vitest";
import { deriveParticipantPresenceStatus } from "./presence-status";

const now = 1_000_000;
const absenceGraceMs = 30_000;

describe("deriveParticipantPresenceStatus", () => {
  it("mantém conectado enquanto ao menos uma aba permanece ativa", () => {
    expect(
      deriveParticipantPresenceStatus({
        moderationStatus: "approved",
        connections: {
          "aba-2": {
            connectedAt: now - 10_000,
            lastSeenAt: now,
          },
        },
        lastDisconnectedAt: now,
        now,
        absenceGraceMs,
      }),
    ).toBe("connected");
  });

  it("trata a desconexão recente como temporária", () => {
    expect(
      deriveParticipantPresenceStatus({
        moderationStatus: "approved",
        connections: null,
        lastDisconnectedAt: now - 5_000,
        now,
        absenceGraceMs,
      }),
    ).toBe("temporarily-disconnected");
  });

  it("marca ausência somente depois da tolerância", () => {
    expect(
      deriveParticipantPresenceStatus({
        moderationStatus: "approved",
        connections: {},
        lastDisconnectedAt: now - absenceGraceMs,
        now,
        absenceGraceMs,
      }),
    ).toBe("absent");
  });

  it("prioriza os estados de moderação", () => {
    expect(
      deriveParticipantPresenceStatus({
        moderationStatus: "waiting-approval",
        connections: null,
        lastDisconnectedAt: null,
        now,
        absenceGraceMs,
      }),
    ).toBe("waiting-approval");

    expect(
      deriveParticipantPresenceStatus({
        moderationStatus: "removed",
        connections: {
          aba: { connectedAt: now, lastSeenAt: now },
        },
        lastDisconnectedAt: null,
        now,
        absenceGraceMs,
      }),
    ).toBe("removed");
  });
});
