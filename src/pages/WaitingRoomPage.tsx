import { Link, useParams } from "react-router-dom";
import { usePublicWaitingRoom } from "../features/live-game/use-public-waiting-room";

export function WaitingRoomPage() {
  const { id = "" } = useParams();
  const { room, loading, error } = usePublicWaitingRoom(id);

  if (loading) {
    return (
      <main className="page" aria-busy="true">
        <section className="card" role="status" aria-live="polite">
          <span className="eyebrow">Sala de espera</span>
          <h1>Carregando...</h1>
          <p>Consultando o estado público da sala.</p>
        </section>
      </main>
    );
  }

  if (error || !room) {
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
            <strong>{room.participantCount}</strong>
          </div>
        </div>

        <p>
          A sala está publicada. A entrada de participantes será habilitada no
          próximo marco, junto com a escolha de nickname.
        </p>

        <nav className="navigation">
          <Link to="/gerenciar">Voltar ao gerenciamento</Link>
          <Link to="/">Abrir página do participante</Link>
        </nav>
      </section>
    </main>
  );
}
