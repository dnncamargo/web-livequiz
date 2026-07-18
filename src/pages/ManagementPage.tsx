import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/auth-context";
import { getAuthErrorMessage } from "../features/auth/auth-errors";
import { useManagedWaitingRooms } from "../features/live-game/use-managed-waiting-rooms";
import {
  archiveWaitingRoom,
  createWaitingRoom,
  endWaitingRoom,
  presentWaitingRoom,
  WaitingRoomRequestError,
} from "../features/live-game/waiting-room";
import {
  WAITING_ROOM_NAME_MAX_LENGTH,
  WAITING_ROOM_NAME_MIN_LENGTH,
  type PublicWaitingRoom,
} from "../shared/waiting-room";

export function ManagementPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [newRoomName, setNewRoomName] = useState("");
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [roomPendingClosure, setRoomPendingClosure] = useState<string | null>(
    null,
  );
  const [processingRoomId, setProcessingRoomId] = useState<string | null>(null);
  const [archivedRoomIds, setArchivedRoomIds] = useState<string[]>([]);
  const [phaseOverrides, setPhaseOverrides] = useState<
    Record<string, PublicWaitingRoom["phase"]>
  >({});
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [roomActionError, setRoomActionError] = useState("");
  const [accountError, setAccountError] = useState("");
  const roomLibrary = useManagedWaitingRooms(user, refreshRevision);
  const activeRooms = roomLibrary.rooms
    .filter(({ id }) => !archivedRoomIds.includes(id))
    .map((room) => ({
      ...room,
      phase: phaseOverrides[room.id] ?? room.phase,
    }));

  async function handleCreateWaitingRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      return;
    }

    setCreatingRoom(true);
    setRoomActionError("");

    try {
      const room = await createWaitingRoom(user, { name: newRoomName });
      navigate(`/gerenciar/sala/${room.id}`);
    } catch (error) {
      console.error("Erro ao criar sala:", error);
      setRoomActionError(
        error instanceof WaitingRoomRequestError
          ? error.message
          : "Não foi possível criar a sala. Tente novamente.",
      );
      setCreatingRoom(false);
    }
  }

  async function handlePresentWaitingRoom(gameId: string) {
    if (!user) {
      return;
    }

    setProcessingRoomId(gameId);
    setRoomActionError("");

    try {
      await presentWaitingRoom(user, { gameId, action: "present-room" });
      setPhaseOverrides((phases) => ({ ...phases, [gameId]: "waiting" }));
      navigate(`/apresentacao?sala=${gameId}`);
    } catch (error) {
      console.error("Erro ao apresentar sala:", error);
      setRoomActionError(
        error instanceof WaitingRoomRequestError
          ? error.message
          : "Não foi possível iniciar a apresentação.",
      );
      setProcessingRoomId(null);
    }
  }

  async function handleEndWaitingRoom(gameId: string) {
    if (!user) {
      return;
    }

    setProcessingRoomId(gameId);
    setRoomActionError("");

    try {
      await endWaitingRoom(user, { gameId, action: "end-room" });
      setPhaseOverrides((phases) => ({ ...phases, [gameId]: "finished" }));
      setRoomPendingClosure(null);
      setRefreshRevision((revision) => revision + 1);
    } catch (error) {
      console.error("Erro ao encerrar apresentação:", error);
      setRoomActionError(
        error instanceof WaitingRoomRequestError
          ? error.message
          : "Não foi possível encerrar a apresentação.",
      );
    } finally {
      setProcessingRoomId(null);
    }
  }

  async function handleArchiveWaitingRoom(gameId: string) {
    if (!user) {
      return;
    }

    setProcessingRoomId(gameId);
    setRoomActionError("");

    try {
      await archiveWaitingRoom(user, { gameId, action: "archive-room" });
      setArchivedRoomIds((roomIds) => [...roomIds, gameId]);
      setRefreshRevision((revision) => revision + 1);
    } catch (error) {
      console.error("Erro ao arquivar sala:", error);
      setRoomActionError(
        error instanceof WaitingRoomRequestError
          ? error.message
          : "Não foi possível arquivar a sala.",
      );
    } finally {
      setProcessingRoomId(null);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    setAccountError("");

    try {
      await logout();
    } catch (error) {
      console.error("Erro ao sair da conta administrativa:", error);
      setAccountError(
        getAuthErrorMessage(
          error,
          "Não foi possível sair da conta. Tente novamente.",
        ),
      );
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <main className="page management-page">
      <section className="card management-library-card">
        <header className="management-header">
          <div>
            <span className="eyebrow">Gerenciamento</span>
            <h1>Salas do Quizumba</h1>
            <p>Crie, apresente, finalize ou arquive suas salas de quiz.</p>
          </div>

          <Link to="/gerenciar/salas-arquivadas">Salas arquivadas</Link>
        </header>

        <form className="room-creation-form" onSubmit={handleCreateWaitingRoom}>
          <div className="form-field">
            <label htmlFor="new-room-name">Nome da nova sala</label>
            <input
              id="new-room-name"
              value={newRoomName}
              minLength={WAITING_ROOM_NAME_MIN_LENGTH}
              maxLength={WAITING_ROOM_NAME_MAX_LENGTH}
              placeholder="Ex.: Quiz de Ciências — 8º ano"
              required
              onChange={(event) => setNewRoomName(event.target.value)}
            />
          </div>
          <button
            type="submit"
            className="primary-button"
            disabled={creatingRoom}
          >
            {creatingRoom ? "Criando sala..." : "Criar sala"}
          </button>
        </form>

        {roomActionError && (
          <div className="test-result test-result-error" role="alert">
            <strong>Não foi possível concluir a ação na sala</strong>
            <p>{roomActionError}</p>
          </div>
        )}

        <section className="room-library" aria-labelledby="room-library-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Biblioteca</span>
              <h2 id="room-library-title">Salas disponíveis</h2>
            </div>
            <span>{activeRooms.length} sala(s)</span>
          </div>

          {roomLibrary.loading && <p role="status">Carregando suas salas...</p>}

          {roomLibrary.error && (
            <div className="test-result test-result-error" role="alert">
              <strong>Não foi possível carregar as salas</strong>
              <p>{roomLibrary.error}</p>
            </div>
          )}

          {!roomLibrary.loading &&
            !roomLibrary.error &&
            activeRooms.length === 0 && (
              <div className="empty-library">
                <strong>Nenhuma sala disponível</strong>
                <p>Informe um nome acima para criar a primeira sala.</p>
              </div>
            )}

          {activeRooms.length > 0 && (
            <ul className="room-library-list">
              {activeRooms.map((room) => (
                <li key={room.id}>
                  <div className="room-library-summary">
                    <span className={`room-status room-status-${room.phase}`}>
                      {room.phase === "waiting"
                        ? "Em apresentação"
                        : "Apresentação finalizada"}
                    </span>
                    <strong className="room-library-name">
                      {room.name ?? `Sala ${room.id}`}
                    </strong>
                    <code>{room.id}</code>
                    <small>{room.participantCount} participante(s)</small>
                  </div>

                  <div className="room-library-actions">
                    <Link
                      className="secondary-button compact-button"
                      to={`/gerenciar/sala/${room.id}`}
                    >
                      Gerenciar
                    </Link>
                    <button
                      type="button"
                      className="primary-button compact-button"
                      disabled={processingRoomId === room.id}
                      onClick={() => void handlePresentWaitingRoom(room.id)}
                    >
                      Apresentar
                    </button>
                    {room.phase === "waiting" &&
                      roomPendingClosure !== room.id && (
                        <button
                          type="button"
                          className="danger-button compact-button"
                          onClick={() => setRoomPendingClosure(room.id)}
                        >
                          Encerrar
                        </button>
                      )}
                    <button
                      type="button"
                      className="secondary-button compact-button"
                      disabled={processingRoomId === room.id}
                      onClick={() => void handleArchiveWaitingRoom(room.id)}
                    >
                      Arquivar
                    </button>

                    {roomPendingClosure === room.id && (
                      <div className="room-closure-confirmation">
                        <span>
                          Confirme para finalizar somente esta apresentação.
                        </span>
                        <div>
                          <button
                            type="button"
                            className="danger-button compact-button"
                            disabled={processingRoomId === room.id}
                            onClick={() => void handleEndWaitingRoom(room.id)}
                          >
                            {processingRoomId === room.id
                              ? "Encerrando..."
                              : "Confirmar encerramento"}
                          </button>
                          <button
                            type="button"
                            className="secondary-button compact-button"
                            disabled={processingRoomId === room.id}
                            onClick={() => setRoomPendingClosure(null)}
                          >
                            Manter apresentação
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside
          className="administrator-account"
          aria-label="Conta administrativa"
        >
          <div>
            <span>Conta administrativa</span>
            <strong>{user?.displayName ?? user?.email ?? user?.uid}</strong>
            <small>Sair da conta não altera suas salas.</small>
          </div>

          <button
            type="button"
            className="secondary-button compact-button"
            disabled={loggingOut}
            onClick={handleLogout}
          >
            {loggingOut ? "Saindo da conta..." : "Sair da conta"}
          </button>
        </aside>

        {accountError && (
          <div className="test-result test-result-error" role="alert">
            <strong>Não foi possível sair da conta</strong>
            <p>{accountError}</p>
          </div>
        )}

        <nav className="navigation">
          <Link to="/firebase-test">Testar Firebase</Link>
          <Link to="/">Página inicial</Link>
        </nav>
      </section>
    </main>
  );
}
