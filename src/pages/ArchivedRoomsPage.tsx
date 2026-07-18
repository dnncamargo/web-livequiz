import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/auth-context";
import { useArchivedWaitingRooms } from "../features/live-game/use-archived-waiting-rooms";
import {
  deleteArchivedWaitingRoom,
  restoreWaitingRoom,
  WaitingRoomRequestError,
} from "../features/live-game/waiting-room";

type PendingAction = {
  gameId: string;
  action: "restore" | "delete";
} | null;

function formatArchivedAt(timestamp: number): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(timestamp);
}

export function ArchivedRoomsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [processingRoomId, setProcessingRoomId] = useState<string | null>(null);
  const [deletedRoomIds, setDeletedRoomIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const library = useArchivedWaitingRooms(user, refreshRevision);
  const rooms = library.rooms.filter(({ id }) => !deletedRoomIds.includes(id));

  async function confirmRestore(gameId: string) {
    if (!user) {
      return;
    }

    setProcessingRoomId(gameId);
    setErrorMessage("");

    try {
      await restoreWaitingRoom(user, { gameId, action: "restore-room" });
      navigate("/gerenciar");
    } catch (error) {
      console.error("Erro ao restaurar sala:", error);
      setErrorMessage(
        error instanceof WaitingRoomRequestError
          ? error.message
          : "Não foi possível restaurar a sala.",
      );
      setProcessingRoomId(null);
    }
  }

  async function confirmDelete(gameId: string) {
    if (!user) {
      return;
    }

    setProcessingRoomId(gameId);
    setErrorMessage("");

    try {
      await deleteArchivedWaitingRoom(user, {
        gameId,
        action: "delete-room",
      });
      setDeletedRoomIds((roomIds) => [...roomIds, gameId]);
      setPendingAction(null);
      setRefreshRevision((revision) => revision + 1);
    } catch (error) {
      console.error("Erro ao excluir sala arquivada:", error);
      setErrorMessage(
        error instanceof WaitingRoomRequestError
          ? error.message
          : "Não foi possível excluir a sala.",
      );
    } finally {
      setProcessingRoomId(null);
    }
  }

  return (
    <main className="page management-page">
      <section className="card management-library-card">
        <header className="management-header">
          <div>
            <span className="eyebrow">Arquivo</span>
            <h1>Salas arquivadas</h1>
            <p>Restaure uma sala ou exclua definitivamente seus dados.</p>
          </div>
          <Link to="/gerenciar">Voltar às salas</Link>
        </header>

        {errorMessage && (
          <div className="test-result test-result-error" role="alert">
            <strong>Não foi possível concluir a ação</strong>
            <p>{errorMessage}</p>
          </div>
        )}

        {library.loading && <p role="status">Carregando salas arquivadas...</p>}

        {library.error && (
          <div className="test-result test-result-error" role="alert">
            <strong>Não foi possível carregar o arquivo</strong>
            <p>{library.error}</p>
          </div>
        )}

        {!library.loading && !library.error && rooms.length === 0 && (
          <div className="empty-library">
            <strong>Nenhuma sala arquivada</strong>
            <p>As salas arquivadas aparecerão nesta página.</p>
          </div>
        )}

        {rooms.length > 0 && (
          <ul className="room-library-list archived-room-list">
            {rooms.map((room) => (
              <li key={room.id}>
                <div className="room-library-summary">
                  <span className="room-status room-status-archived">
                    Arquivada
                  </span>
                  <strong className="room-library-name">{room.name}</strong>
                  <code>{room.id}</code>
                  <small>
                    Arquivada em {formatArchivedAt(room.archivedAt)} ·{" "}
                    {room.participantCount} participante(s)
                  </small>
                </div>

                <div className="room-library-actions">
                  <button
                    type="button"
                    className="primary-button compact-button"
                    onClick={() =>
                      setPendingAction({ gameId: room.id, action: "restore" })
                    }
                  >
                    Restaurar
                  </button>
                  <button
                    type="button"
                    className="danger-button compact-button"
                    onClick={() =>
                      setPendingAction({ gameId: room.id, action: "delete" })
                    }
                  >
                    Excluir
                  </button>

                  {pendingAction?.gameId === room.id && (
                    <div className="room-closure-confirmation">
                      <span>
                        {pendingAction.action === "restore"
                          ? "Restaurar devolve a sala à biblioteca sem participantes conectados."
                          : "Excluir remove definitivamente esta sala do banco de dados."}
                      </span>
                      <div>
                        <button
                          type="button"
                          className={
                            pendingAction.action === "delete"
                              ? "danger-button compact-button"
                              : "primary-button compact-button"
                          }
                          disabled={processingRoomId === room.id}
                          onClick={() =>
                            pendingAction.action === "restore"
                              ? void confirmRestore(room.id)
                              : void confirmDelete(room.id)
                          }
                        >
                          {processingRoomId === room.id
                            ? "Processando..."
                            : pendingAction.action === "restore"
                              ? "Confirmar restauração"
                              : "Confirmar exclusão"}
                        </button>
                        <button
                          type="button"
                          className="secondary-button compact-button"
                          disabled={processingRoomId === room.id}
                          onClick={() => setPendingAction(null)}
                        >
                          Cancelar
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
    </main>
  );
}
