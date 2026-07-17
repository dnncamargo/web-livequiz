import { Link, useParams } from "react-router-dom";
import { useAuth } from "../contexts/auth-context";
import { useManagedWaitingRoom } from "../features/live-game/use-managed-waiting-room";
import { usePublicWaitingRoom } from "../features/live-game/use-public-waiting-room";

const MODERATION_LABELS = {
  "waiting-approval": "Aguardando aprovação",
  approved: "Aprovado",
  removed: "Removido",
} as const;

export function WaitingRoomPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const publicRoomState = usePublicWaitingRoom(id);
  const managedRoomState = useManagedWaitingRoom(user, id);
  const room = publicRoomState.room ?? managedRoomState.waitingRoom?.room;
  const participants = managedRoomState.waitingRoom?.participants ?? [];
  const loading = publicRoomState.loading && managedRoomState.loading;
  const error = publicRoomState.error ?? managedRoomState.error;

  if (loading) {
    return (
      <main className="page" aria-busy="true">
        <section className="card" role="status" aria-live="polite">
          <span className="eyebrow">Sala de espera</span>
          <h1>Carregando...</h1>
          <p>Recuperando a sala e seus participantes.</p>
        </section>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="page">
        <section className="card">
          <span className="eyebrow">Sala de espera</span>
          <h1>Sala indisponível</h1>
          <div className="test-result test-result-error" role="alert">
            <strong>Não foi possível abrir esta sala</strong>
            <p>{error ?? "A sala não existe ou já foi encerrada."}</p>
          </div>
          <Link to="/gerenciar">Voltar ao gerenciamento</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="card waiting-room-card">
        <span className="eyebrow">Sala de espera ativa</span>
        <h1>Compartilhe o código</h1>

        <div className="room-code-panel">
          <span>Código da sala</span>
          <strong className="room-code" aria-label={`Código ${room.id}`}>
            {room.id}
          </strong>
        </div>

        <div className="room-summary" aria-label="Resumo da sala">
          <div>
            <span>Fase</span>
            <strong>Aguardando</strong>
          </div>
          <div>
            <span>Participantes</span>
            <strong>
              {managedRoomState.waitingRoom?.room.participantCount ??
                room.participantCount}
            </strong>
          </div>
        </div>

        <section
          className="waiting-participants"
          aria-labelledby="participants-title"
        >
          <div className="section-heading">
            <div>
              <span className="eyebrow">Entrada em tempo real</span>
              <h2 id="participants-title">Participantes</h2>
            </div>
            {managedRoomState.loading && (
              <span role="status">Atualizando...</span>
            )}
          </div>

          {managedRoomState.error && (
            <div className="test-result test-result-error" role="alert">
              <strong>Não foi possível atualizar os participantes</strong>
              <p>{managedRoomState.error}</p>
            </div>
          )}

          {!managedRoomState.loading &&
            !managedRoomState.error &&
            participants.length === 0 && (
              <p>Nenhum participante entrou nesta sala ainda.</p>
            )}

          {participants.length > 0 && (
            <ul className="participant-list">
              {participants.map((participant) => (
                <li key={participant.participantId}>
                  <div>
                    <strong>{participant.nickname}</strong>
                    <span>
                      {MODERATION_LABELS[participant.moderationStatus]}
                    </span>
                  </div>
                  <span
                    className={`presence-badge presence-badge-${participant.presenceStatus}`}
                  >
                    {participant.presenceStatus === "connected"
                      ? "Conectado"
                      : "Desconectado"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p>
          A sala permanece ativa ao atualizar esta página. Envie o link abaixo
          para que o código seja identificado automaticamente no dispositivo do
          participante. Para testar, abra o link em uma janela anônima ou em
          outro dispositivo, mantendo esta sessão administrativa aberta.
        </p>

        <nav className="navigation">
          <Link to="/gerenciar">Voltar ao gerenciamento</Link>
          <Link to={`/?sala=${room.id}`}>Abrir página do participante</Link>
        </nav>
      </section>
    </main>
  );
}
