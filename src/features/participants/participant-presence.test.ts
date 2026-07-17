import { beforeEach, describe, expect, it, vi } from "vitest";
import { startParticipantPresence } from "./participant-presence";

const databaseMocks = vi.hoisted(() => ({
  database: { name: "realtime-database" },
  presenceReference: { key: "presence", path: "presence" },
  connectionsReference: { key: "connections", path: "connections" },
  connectedInfoReference: { key: "connected", path: ".info/connected" },
  connectionReferences: [
    { key: "conexao-aba-1", path: "connections/conexao-aba-1" },
    { key: "conexao-aba-2", path: "connections/conexao-aba-2" },
  ],
  ref: vi.fn(),
  push: vi.fn(),
  onValue: vi.fn(),
  unsubscribe: vi.fn(),
  connectedCallback: null as
    null | ((snapshot: { val: () => unknown }) => void),
  connectionErrorCallback: null as null | ((error: unknown) => void),
  onDisconnect: vi.fn(),
  disconnectUpdate: vi.fn(),
  disconnectCancel: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  serverTimestamp: vi.fn(() => ({ ".sv": "timestamp" })),
}));

vi.mock("../../lib/firebase", () => ({
  realtimeDatabase: databaseMocks.database,
}));

vi.mock("firebase/database", () => ({
  ref: databaseMocks.ref,
  push: databaseMocks.push,
  onValue: databaseMocks.onValue,
  onDisconnect: databaseMocks.onDisconnect,
  set: databaseMocks.set,
  update: databaseMocks.update,
  remove: databaseMocks.remove,
  serverTimestamp: databaseMocks.serverTimestamp,
}));

function emitConnectionState(connected: boolean) {
  databaseMocks.connectedCallback?.({ val: () => connected });
}

describe("presença do participante", () => {
  beforeEach(() => {
    databaseMocks.ref.mockReset().mockImplementation((_, path: string) => {
      if (path === ".info/connected") {
        return databaseMocks.connectedInfoReference;
      }

      if (path.endsWith("/connections")) {
        return databaseMocks.connectionsReference;
      }

      return databaseMocks.presenceReference;
    });
    databaseMocks.push
      .mockReset()
      .mockReturnValue(databaseMocks.connectionReferences[0]);
    databaseMocks.unsubscribe.mockReset();
    databaseMocks.connectedCallback = null;
    databaseMocks.connectionErrorCallback = null;
    databaseMocks.onValue.mockReset().mockImplementation((_, next, error) => {
      databaseMocks.connectedCallback = next;
      databaseMocks.connectionErrorCallback = error;
      return databaseMocks.unsubscribe;
    });
    databaseMocks.disconnectUpdate.mockReset().mockResolvedValue(undefined);
    databaseMocks.disconnectCancel.mockReset().mockResolvedValue(undefined);
    databaseMocks.onDisconnect.mockReset().mockReturnValue({
      update: databaseMocks.disconnectUpdate,
      cancel: databaseMocks.disconnectCancel,
    });
    databaseMocks.set.mockReset().mockResolvedValue(undefined);
    databaseMocks.update.mockReset().mockResolvedValue(undefined);
    databaseMocks.remove.mockReset().mockResolvedValue(undefined);
    databaseMocks.serverTimestamp.mockClear();
  });

  it("agenda a limpeza antes de publicar uma conexão", async () => {
    const statuses: string[] = [];
    const session = startParticipantPresence(
      { gameId: "sala-1", participantId: "participante-1" },
      {
        heartbeatIntervalMs: 60_000,
        onStatusChange: (status) => statuses.push(status),
      },
    );

    emitConnectionState(true);

    await vi.waitFor(() => {
      expect(databaseMocks.set).toHaveBeenCalledOnce();
    });

    expect(databaseMocks.disconnectUpdate).toHaveBeenCalledWith({
      "connections/conexao-aba-1": null,
      lastDisconnectedAt: { ".sv": "timestamp" },
    });
    expect(
      databaseMocks.disconnectUpdate.mock.invocationCallOrder[0],
    ).toBeLessThan(databaseMocks.set.mock.invocationCallOrder[0]);
    expect(session.getStatus()).toBe("connected");
    expect(statuses).toContain("connected");

    await session.stop();
    expect(databaseMocks.unsubscribe).toHaveBeenCalledOnce();
    expect(databaseMocks.disconnectCancel).toHaveBeenCalled();
  });

  it("distingue desconexão temporária e reconexão", async () => {
    const statuses: string[] = [];
    const session = startParticipantPresence(
      { gameId: "sala-1", participantId: "participante-1" },
      {
        heartbeatIntervalMs: 60_000,
        onStatusChange: (status) => statuses.push(status),
      },
    );

    emitConnectionState(true);
    await vi.waitFor(() => expect(session.getStatus()).toBe("connected"));

    emitConnectionState(false);
    expect(session.getStatus()).toBe("temporarily-disconnected");

    emitConnectionState(true);
    expect(session.getStatus()).toBe("reconnecting");
    await vi.waitFor(() => expect(session.getStatus()).toBe("connected"));
    expect(statuses).toContain("reconnecting");

    await session.stop();
  });

  it("gera uma conexão independente para cada aba", async () => {
    databaseMocks.push
      .mockReturnValueOnce(databaseMocks.connectionReferences[0])
      .mockReturnValueOnce(databaseMocks.connectionReferences[1]);

    const firstTab = startParticipantPresence({
      gameId: "sala-1",
      participantId: "participante-1",
    });
    const secondTab = startParticipantPresence({
      gameId: "sala-1",
      participantId: "participante-1",
    });

    expect(firstTab.connectionId).toBe("conexao-aba-1");
    expect(secondTab.connectionId).toBe("conexao-aba-2");

    await firstTab.stop();
    await secondTab.stop();
  });

  it("rejeita identificadores que escapariam do caminho esperado", () => {
    expect(() =>
      startParticipantPresence({
        gameId: "sala-1/participants/outro",
        participantId: "participante-1",
      }),
    ).toThrow();
    expect(databaseMocks.ref).not.toHaveBeenCalled();
  });
});
