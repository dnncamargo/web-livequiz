import { Link, useSearchParams } from "react-router-dom";
import { usePublicWaitingRoom } from "../features/live-game/use-public-waiting-room";
import { waitingRoomCodeSchema } from "../shared/waiting-room";

export function PresentationPage() {
  const [searchParams] = useSearchParams();
  const gameIdResult = waitingRoomCodeSchema.safeParse(
    searchParams.get("sala") ?? "",
  );
  const gameId = gameIdResult.success ? gameIdResult.data : "";
  const roomState = usePublicWaitingRoom(gameId);

  return (
    <main className="page">
      <section className="card presentation-card">
        <span className="eyebrow">Apresentação</span>

        {!gameId && (
          <>
            <h1>Nenhuma sala selecionada</h1>
            <p>Escolha “Apresentar” na biblioteca administrativa.</p>
          </>
        )}

        {gameId && roomState.loading && (
          <div role="status">
            <h1>Preparando a apresentação...</h1>
            <p>Carregando a sala {gameId}.</p>
          </div>
        )}

        {gameId && !roomState.loading && !roomState.room && (
          <>
            <h1>Sala indisponível</h1>
            <p>Esta sala foi arquivada, excluída ou não existe mais.</p>
          </>
        )}

        {roomState.room && (
          <>
            <h1>{roomState.room.name ?? `Sala ${roomState.room.id}`}</h1>
            <div className="room-code-panel">
              <span>Código da sala</span>
              <strong className="room-code">{roomState.room.id}</strong>
            </div>

            {roomState.room.phase === "waiting" ? (
              <div className="session-status" role="status">
                <strong>Apresentação ativa</strong>
                <span>
                  Aguardando · {roomState.room.participantCount} participante(s)
                </span>
              </div>
            ) : (
              <div className="test-result test-result-error" role="status">
                <strong>Apresentação encerrada</strong>
                <p>A sala permanece disponível para uma nova apresentação.</p>
              </div>
            )}
          </>
        )}

        <nav className="navigation">
          <Link to="/gerenciar">Voltar às salas</Link>
          <Link to="/">Página inicial</Link>
        </nav>
      </section>
    </main>
  );
}
