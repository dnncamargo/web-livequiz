import { beforeEach, describe, expect, it, vi } from "vitest";

const firebaseMocks = vi.hoisted(() => ({
  auth: {
    currentUser: null as null | {
      uid: string;
      isAnonymous: boolean;
    },
  },
  browserLocalPersistence: { type: "LOCAL" },
  setPersistence: vi.fn(),
  signInAnonymously: vi.fn(),
}));

vi.mock("../../lib/firebase", () => ({
  auth: firebaseMocks.auth,
}));

vi.mock("firebase/auth", () => ({
  browserLocalPersistence: firebaseMocks.browserLocalPersistence,
  setPersistence: firebaseMocks.setPersistence,
  signInAnonymously: firebaseMocks.signInAnonymously,
}));

describe("autenticação anônima do participante", () => {
  beforeEach(() => {
    vi.resetModules();
    firebaseMocks.auth.currentUser = null;
    firebaseMocks.setPersistence.mockReset().mockResolvedValue(undefined);
    firebaseMocks.signInAnonymously.mockReset();
  });

  it("configura persistência local antes de criar a conta anônima", async () => {
    const participant = { uid: "participante-1", isAnonymous: true };
    firebaseMocks.signInAnonymously.mockResolvedValue({ user: participant });
    const { signInParticipantAnonymously } = await import("./participant-auth");

    await expect(signInParticipantAnonymously()).resolves.toBe(participant);

    expect(firebaseMocks.setPersistence).toHaveBeenCalledWith(
      firebaseMocks.auth,
      firebaseMocks.browserLocalPersistence,
    );
    expect(
      firebaseMocks.setPersistence.mock.invocationCallOrder[0],
    ).toBeLessThan(firebaseMocks.signInAnonymously.mock.invocationCallOrder[0]);
  });

  it("reutiliza a sessão anônima restaurada", async () => {
    const participant = { uid: "participante-2", isAnonymous: true };
    firebaseMocks.auth.currentUser = participant;
    const { signInParticipantAnonymously } = await import("./participant-auth");

    await expect(signInParticipantAnonymously()).resolves.toBe(participant);
    expect(firebaseMocks.signInAnonymously).not.toHaveBeenCalled();
  });

  it("não substitui silenciosamente uma sessão administrativa", async () => {
    firebaseMocks.auth.currentUser = {
      uid: "administrador-1",
      isAnonymous: false,
    };
    const { signInParticipantAnonymously } = await import("./participant-auth");

    await expect(signInParticipantAnonymously()).rejects.toMatchObject({
      code: "participant/session-conflict",
    });
    expect(firebaseMocks.signInAnonymously).not.toHaveBeenCalled();
  });
});
