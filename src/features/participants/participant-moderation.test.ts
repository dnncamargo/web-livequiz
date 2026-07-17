import { beforeEach, describe, expect, it, vi } from "vitest";
import { subscribeToParticipantModerationStatus } from "./participant-moderation";

const databaseMocks = vi.hoisted(() => ({
  database: { name: "realtime-database" },
  reference: { path: "moderation-status" },
  ref: vi.fn(),
  onValue: vi.fn(),
  unsubscribe: vi.fn(),
  valueCallback: null as null | ((snapshot: { val: () => unknown }) => void),
  errorCallback: null as null | ((error: unknown) => void),
}));

vi.mock("../../lib/firebase", () => ({
  realtimeDatabase: databaseMocks.database,
}));

vi.mock("firebase/database", () => ({
  ref: databaseMocks.ref,
  onValue: databaseMocks.onValue,
}));

describe("acompanhamento da moderação do participante", () => {
  beforeEach(() => {
    databaseMocks.ref.mockReset().mockReturnValue(databaseMocks.reference);
    databaseMocks.unsubscribe.mockReset();
    databaseMocks.valueCallback = null;
    databaseMocks.errorCallback = null;
    databaseMocks.onValue.mockReset().mockImplementation((_, next, error) => {
      databaseMocks.valueCallback = next;
      databaseMocks.errorCallback = error;
      return databaseMocks.unsubscribe;
    });
  });

  it("acompanha apenas o status privado do próprio participante", () => {
    const onStatusChange = vi.fn();
    const onError = vi.fn();

    const unsubscribe = subscribeToParticipantModerationStatus(
      "ABC234",
      "participante-1",
      onStatusChange,
      onError,
    );

    expect(databaseMocks.ref).toHaveBeenCalledWith(
      databaseMocks.database,
      "liveGames/ABC234/participants/participante-1/moderationStatus",
    );
    databaseMocks.valueCallback?.({ val: () => "removed" });
    expect(onStatusChange).toHaveBeenCalledWith("removed");
    expect(onError).not.toHaveBeenCalled();
    expect(unsubscribe).toBe(databaseMocks.unsubscribe);
  });

  it("rejeita um status externo inválido", () => {
    const onStatusChange = vi.fn();
    const onError = vi.fn();

    subscribeToParticipantModerationStatus(
      "ABC234",
      "participante-1",
      onStatusChange,
      onError,
    );
    databaseMocks.valueCallback?.({ val: () => "administrador" });

    expect(onStatusChange).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});
