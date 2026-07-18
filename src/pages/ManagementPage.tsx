import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/auth-context";
import { getAuthErrorMessage } from "../features/auth/auth-errors";
import { useManagedWaitingRooms } from "../features/live-game/use-managed-waiting-rooms";
import {
  createWaitingRoom,
  endWaitingRoom,
  WaitingRoomRequestError,
} from "../features/live-game/waiting-room";

export function ManagementPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [roomPendingClosure, setRoomPendingClosure] = useState<string | null>(
    null,
  );
  const [endingRoomId, setEndingRoomId] = useState<string | null>(null);
  const [endedRoomIds, setEndedRoomIds] = useState<string[]>([]);
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [roomActionError, setRoomActionError] = useState("");
  const [accountError, setAccountError] = useState("");
  const roomLibrary = useManagedWaitingRooms(user, refreshRevision);
  const activeRooms = roomLibrary.rooms.filter(
    ({ id }) => !endedRoomIds.includes(id),
  );

  async function handleCreateWaitingRoom() {
    if (!user) {
      return;
    }

    setCreatingRoom(true);
    setRoomActionError("");

    try {
      const room = await createWaitingRoom(user);
      navigate(`/gerenciar/sala/${room.id}`);
    } catch (error) {
      console.error("Erro ao criar sala de espera:", error);
      setRoomActionError(
        error instanceof WaitingRoomRequestError
          ? error.message
          : "Não foi possível criar a sala. Tente novamente.",
      );
      setCreatingRoom(false);
    }
  }

  async function handleEndWaitingRoom(gameId: string) {
    if (!user) {
      return;
    }

    setEndingRoomId(gameId);
    setRoomActionError("");

    try {
      await endWaitingRoom(user, { gameId, action: "end-room" });
      setEndedRoomIds((roomIds) => [...roomIds, gameId]);
      setRoomPendingClosure(null);
      setRefreshRevision((revision) => revision + 1);
    } catch (error) {
      console.error("Erro ao encerrar sala de espera:", error);
      setRoomActionError(
        error instanceof WaitingRoomRequestError
          ? error.message
          : "Não foi possível encerrar a sala. Tente novamente.",
      );
    } finally {
      setEndingRoomId(null);
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
            <p>Crie, acompanhe e encerre suas salas de quiz.</p>
          </div>

          <button
            type="button"
            className="primary-button"
            disabled={creatingRoom}
            onClick={handleCreateWaitingRoom}
          >
            {creatingRoom ? "Criando nova sala..." : "Criar nova sala"}
          </button>
        </header>

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
              <h2 id="room-library-title">Salas ativas</h2>
            </div>
            <span>{activeRooms.length} sala(s)</span>
          </div>

          {roomLibrary.loading && (
            <p role="status">Carregando sua biblioteca de salas...</p>
          )}

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
                <strong>Nenhuma sala ativa</strong>
                <p>
                  Crie uma sala para receber os participantes do próximo quiz.
                </p>
              </div>
            )}

          {activeRooms.length > 0 && (
            <ul className="room-library-list">
              {activeRooms.map((room) => (
                <li key={room.id}>
                  <div className="room-library-summary">
                    <span className="room-status">
                      Aguardando participantes
                    </span>
                    <strong>{room.id}</strong>
                    <small>{room.participantCount} participante(s)</small>
                  </div>

                  <div className="room-library-actions">
                    <Link
                      className="primary-button compact-button"
                      to={`/gerenciar/sala/${room.id}`}
                    >
                      Abrir sala
                    </Link>

                    {roomPendingClosure !== room.id && (
                      <button
                        type="button"
                        className="danger-button compact-button"
                        onClick={() => setRoomPendingClosure(room.id)}
                      >
                        Encerrar sala
                      </button>
                    )}

                    {roomPendingClosure === room.id && (
                      <div className="room-closure-confirmation">
                        <span>Isso desconectará todos os participantes.</span>
                        <div>
                          <button
                            type="button"
                            className="danger-button compact-button"
                            disabled={endingRoomId === room.id}
                            onClick={() => void handleEndWaitingRoom(room.id)}
                          >
                            {endingRoomId === room.id
                              ? "Encerrando..."
                              : "Confirmar encerramento"}
                          </button>
                          <button
                            type="button"
                            className="secondary-button compact-button"
                            disabled={endingRoomId === room.id}
                            onClick={() => setRoomPendingClosure(null)}
                          >
                            Manter sala aberta
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
            <small>Sair da conta não encerra suas salas ativas.</small>
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
