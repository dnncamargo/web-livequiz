import {
  get,
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
  type DatabaseReference,
  type Unsubscribe,
} from "firebase/database";
import {
  getParticipantConnectionsPath,
  getParticipantPresencePath,
  type ParticipantPresencePathInput,
} from "../live-game/live-game-paths";
import { realtimeDatabase } from "../../lib/firebase";

const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;

export type ParticipantConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "temporarily-disconnected"
  | "error";

export interface ParticipantPresenceCallbacks {
  onStatusChange?: (status: ParticipantConnectionStatus) => void;
  onError?: (error: unknown) => void;
  heartbeatIntervalMs?: number;
}

export interface ParticipantPresenceSession {
  connectionId: string;
  getStatus: () => ParticipantConnectionStatus;
  stop: () => Promise<void>;
}

function requireConnectionId(connectionReference: DatabaseReference): string {
  if (!connectionReference.key) {
    throw new Error("Não foi possível criar o identificador da conexão.");
  }

  return connectionReference.key;
}

export function startParticipantPresence(
  input: ParticipantPresencePathInput,
  callbacks: ParticipantPresenceCallbacks = {},
): ParticipantPresenceSession {
  const presenceReference = ref(
    realtimeDatabase,
    getParticipantPresencePath(input),
  );
  const connectionsReference = ref(
    realtimeDatabase,
    getParticipantConnectionsPath(input),
  );
  const connectionReference = push(connectionsReference);
  const connectionId = requireConnectionId(connectionReference);
  const connectedInfoReference = ref(realtimeDatabase, ".info/connected");
  const heartbeatIntervalMs =
    callbacks.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;

  let currentStatus: ParticipantConnectionStatus = "connecting";
  let stopped = false;
  let hasConnected = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let connectionLifecycle = Promise.resolve();

  function emitStatus(status: ParticipantConnectionStatus) {
    currentStatus = status;
    callbacks.onStatusChange?.(status);
  }

  function stopHeartbeat() {
    if (heartbeat !== null) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
  }

  function reportError(error: unknown) {
    if (stopped) {
      return;
    }

    stopHeartbeat();
    emitStatus("error");
    callbacks.onError?.(error);
  }

  async function refreshLastSeenAt() {
    await update(connectionReference, {
      lastSeenAt: serverTimestamp(),
    });
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeat = setInterval(() => {
      void refreshLastSeenAt().catch(reportError);
    }, heartbeatIntervalMs);
  }

  async function publishConnection() {
    const disconnectOperation = onDisconnect(presenceReference);

    await disconnectOperation.update({
      [`connections/${connectionId}`]: null,
      lastDisconnectedAt: serverTimestamp(),
    });

    if (stopped) {
      await disconnectOperation.cancel();
      return;
    }

    const existingConnection = await get(connectionReference);

    if (existingConnection.exists()) {
      await refreshLastSeenAt();
    } else {
      await set(connectionReference, {
        connectedAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
      });
    }

    if (stopped) {
      await remove(connectionReference);
      return;
    }

    hasConnected = true;
    emitStatus("connected");
    startHeartbeat();
  }

  const unsubscribe: Unsubscribe = onValue(
    connectedInfoReference,
    (snapshot) => {
      if (stopped) {
        return;
      }

      if (snapshot.val() !== true) {
        stopHeartbeat();
        emitStatus(hasConnected ? "temporarily-disconnected" : "connecting");
        return;
      }

      emitStatus(hasConnected ? "reconnecting" : "connecting");
      connectionLifecycle = connectionLifecycle
        .then(publishConnection)
        .catch(reportError);
    },
    reportError,
  );

  return {
    connectionId,
    getStatus: () => currentStatus,
    stop: async () => {
      if (stopped) {
        return;
      }

      stopped = true;
      unsubscribe();
      stopHeartbeat();
      await connectionLifecycle.catch(() => undefined);

      const disconnectOperation = onDisconnect(presenceReference);
      await disconnectOperation.cancel();

      if (hasConnected) {
        await update(presenceReference, {
          [`connections/${connectionId}`]: null,
          lastDisconnectedAt: serverTimestamp(),
        });
      } else {
        await remove(connectionReference);
      }
    },
  };
}
