import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/auth-context";
import { useManagedWaitingRooms } from "../features/live-game/use-managed-waiting-rooms";
import {
  archiveWaitingRoom,
  WaitingRoomRequestError,
} from "../features/live-game/waiting-room";
import type { LiveGamePhase } from "../shared/game-types";

const ROOM_PHASE_LABELS: Record<LiveGamePhase, string> = {
  waiting: "Sala de espera",
  countdown: "Contagem regressiva",
  question: "Pergunta em andamento",
  revealing: "Resposta revelada",
  ranking: "Ranking",
  podium: "Pódio",
  finished: "Quiz finalizado",
};

export function ManagementPage() {
  const { user } = useAuth();
  const [processingRoomId, setProcessingRoomId] = useState<string | null>(null);
  const [archivedRoomIds, setArchivedRoomIds] = useState<string[]>([]);
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [roomActionError, setRoomActionError] = useState("");
  const roomLibrary = useManagedWaitingRooms(user, refreshRevision);
  const activeRooms = roomLibrary.rooms.filter(
    ({ id }) => !archivedRoomIds.includes(id),
  );

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

  return (
    <main className="page management-page">
      <section className="card management-library-card">
        <header className="management-header">
          <div>
            <span className="eyebrow">Painel de Controle</span>
            <h1>Partidas ao vivo</h1>
            <p>
              Escolha um quiz publicado para preparar automaticamente uma nova
              sala.
            </p>
          </div>
          <Link className="primary-button" to="/admin/quizzes">
            Escolher quiz
          </Link>
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
                <p>
                  Abra a biblioteca de quizzes e escolha “Organizar ao vivo”.
                </p>
              </div>
            )}

          {activeRooms.length > 0 && (
            <ul className="room-library-list">
              {activeRooms.map((room) => (
                <li key={room.id}>
                  <div className="room-library-summary">
                    <span className="room-status">
                      {ROOM_PHASE_LABELS[room.phase]}
                    </span>
                    <strong className="room-library-name">
                      {room.name ?? `Sala ${room.id}`}
                    </strong>
                    <code>{room.id}</code>
                    {room.quizTitle && <span>Quiz: {room.quizTitle}</span>}
                    <small>{room.participantCount} participante(s)</small>
                  </div>

                  <div className="room-library-actions">
                    <Link
                      className="primary-button compact-button"
                      to={`/admin/room/${room.id}`}
                    >
                      Gerenciar ao vivo
                    </Link>
                    <Link
                      className="secondary-button compact-button"
                      to={`/?room=${room.id}`}
                    >
                      Abrir apresentação
                    </Link>
                    <button
                      type="button"
                      className="secondary-button compact-button"
                      disabled={processingRoomId === room.id}
                      onClick={() => void handleArchiveWaitingRoom(room.id)}
                    >
                      {processingRoomId === room.id
                        ? "Arquivando..."
                        : "Arquivar"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </main>
  );
}
