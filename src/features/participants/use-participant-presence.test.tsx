// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useParticipantPresence } from "./use-participant-presence";

const presenceMocks = vi.hoisted(() => ({
  auth: {
    user: {
      uid: "participante-1",
      isAnonymous: true,
    } as null | { uid: string; isAnonymous: boolean },
    isAnonymous: true,
  },
  startParticipantPresence: vi.fn(),
  stop: vi.fn(),
  callbacks: null as null | {
    onStatusChange?: (status: "connected") => void;
    onError?: (error: unknown) => void;
  },
}));

vi.mock("../../contexts/auth-context", () => ({
  useAuth: () => presenceMocks.auth,
}));

vi.mock("./participant-presence", () => ({
  startParticipantPresence: presenceMocks.startParticipantPresence,
}));

describe("useParticipantPresence", () => {
  beforeEach(() => {
    presenceMocks.auth.user = {
      uid: "participante-1",
      isAnonymous: true,
    };
    presenceMocks.auth.isAnonymous = true;
    presenceMocks.stop.mockReset().mockResolvedValue(undefined);
    presenceMocks.callbacks = null;
    presenceMocks.startParticipantPresence
      .mockReset()
      .mockImplementation((_, callbacks) => {
        presenceMocks.callbacks = callbacks;
        return {
          connectionId: "conexao-1",
          getStatus: () => "connecting",
          stop: presenceMocks.stop,
        };
      });
  });

  afterEach(cleanup);

  it("ativa e encerra a presença para uma partida", () => {
    const { result, unmount } = renderHook(() =>
      useParticipantPresence("sala-1"),
    );

    expect(presenceMocks.startParticipantPresence).toHaveBeenCalledWith(
      { gameId: "sala-1", participantId: "participante-1" },
      expect.any(Object),
    );

    act(() => presenceMocks.callbacks?.onStatusChange?.("connected"));
    expect(result.current.status).toBe("connected");

    unmount();
    expect(presenceMocks.stop).toHaveBeenCalledOnce();
  });

  it("não cria presença antes de existir uma partida", () => {
    const { result } = renderHook(() => useParticipantPresence(null));

    expect(result.current.status).toBe("idle");
    expect(presenceMocks.startParticipantPresence).not.toHaveBeenCalled();
  });
});
