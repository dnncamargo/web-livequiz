import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/auth-context";
import { useManagedWaitingRoom } from "../features/live-game/use-managed-waiting-room";
import { usePublicWaitingRoom } from "../features/live-game/use-public-waiting-room";
import {
  archiveWaitingRoom,
  endWaitingRoom,
  presentWaitingRoom,
  removeWaitingRoomParticipant,
  WaitingRoomRequestError,
} from "../features/live-game/waiting-room";

const MODERATION_LABELS = {
  "waiting-approval": "Aguardando aprovação",
  approved: "Aprovado",
  removed: "Removido",
} as const;

export function WaitingRoomPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [participantPendingRemoval, setParticipantPendingRemoval] = useState<
    string | null
  >(null);
  const [removingParticipantId, setRemovingParticipantId] = useState<
    string | null
  >(null);
  const [participantActionError, setParticipantActionError] = useState("");
  const [confirmingRoomClosure, setConfirmingRoomClosure] = useState(false);
  const [endingRoom, setEndingRoom] = useState(false);
  const [processingRoom, setProcessingRoom] = useState(false);
  const [phaseOverride, setPhaseOverride] = useState<
    "waiting" | "finished" | null
  >(null);
  const [refreshRevision, setRefreshRevision] = useState(0);
  const publicRoomState = usePublicWaitingRoom(id);
  const managedRoomState = useManagedWaitingRoom(
    user,
    id,
    `${publicRoomState.room?.phase ?? "missing"}:${publicRoomState.room?.participantCount ?? 0}:${refreshRevision}`,
  );
  const room = publicRoomState.room ?? managedRoomState.waitingRoom?.room;
  const participants = managedRoomState.waitingRoom?.participants ?? [];
  const loading = publicRoomState.loading && managedRoomState.loading;
  const error = publicRoomState.error ?? managedRoomState.error;
  const roomPhase = phaseOverride ?? room?.phase;

  async function confirmParticipantRemoval(participantId: string) {
    if (!user) {
      return;
    }

    setRemovingParticipantId(participantId);
    setParticipantActionError("");

    try {
      await removeWaitingRoomParticipant(user, {
        gameId: id,
        participantId,
        action: "remove",
      });
      setParticipantPendingRemoval(null);
      setRefreshRevision((revision) => revision + 1);
    } catch (error) {
      console.error("Erro ao remover participante:", error);
      setParticipantActionError(
        error instanceof WaitingRoomRequestError
          ? error.message
          : "Não foi possível remover o participante. Tente novamente.",
      );
    } finally {
      setRemovingParticipantId(null);
    }
  }

  async function confirmRoomClosure() {
    if (!user) {
      return;
    }

    setEndingRoom(true);
    setParticipantActionError("");

    try {
      await endWaitingRoom(user, { gameId: id, action: "end-room" });
      setPhaseOverride("finished");
      setConfirmingRoomClosure(false);
      setRefreshRevision((revision) => revision + 1);
    } catch (error) {
      console.error("Erro ao encerrar apresentação:", error);
      setParticipantActionError(
        error instanceof WaitingRoomRequestError
          ? error.message
          : "Não foi possível encerrar a apresentação. Tente novamente.",
      );
    } finally {
      setEndingRoom(false);
    }
  }

  async function handlePresentRoom() {
    if (!user) {
      return;
    }

    setProcessingRoom(true);
    setParticipantActionError("");

    try {
      await presentWaitingRoom(user, { gameId: id, action: "present-room" });
      setPhaseOverride("waiting");
      navigate(`/apresentacao?sala=${id}`);
    } catch (error) {
      console.error("Erro ao apresentar sala:", error);
      setParticipantActionError(
        error instanceof WaitingRoomRequestError
          ? error.message
          : "Não foi possível iniciar a apresentação.",
      );
      setProcessingRoom(false);
    }
  }

  async function handleArchiveRoom() {
    if (!user) {
      return;
    }

    setProcessingRoom(true);
    setParticipantActionError("");

    try {
      await archiveWaitingRoom(user, { gameId: id, action: "archive-room" });
      navigate("/gerenciar");
    } catch (error) {
      console.error("Erro ao arquivar sala:", error);
      setParticipantActionError(
        error instanceof WaitingRoomRequestError
          ? error.message
          : "Não foi possível arquivar a sala.",
      );
      setProcessingRoom(false);
    }
  }

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
        <span className="eyebrow">Gerenciamento da sala</span>
        <h1>{room.name ?? `Sala ${room.id}`}</h1>

        <div className="room-code-panel">
          <span>Código da sala</span>
          <strong className="room-code" aria-label={`Código ${room.id}`}>
            {room.id}
          </strong>
        </div>

        <div className="room-summary" aria-label="Resumo da sala">
          <div>
            <span>Fase</span>
            <strong>
              {roomPhase === "waiting" ? "Em apresentação" : "Finalizada"}
            </strong>
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

          {participantActionError && (
            <div className="test-result test-result-error" role="alert">
              <strong>Não foi possível concluir a ação</strong>
              <p>{participantActionError}</p>
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
                  <div className="participant-list-actions">
                    <span
                      className={`presence-badge presence-badge-${participant.presenceStatus}`}
                    >
                      {participant.presenceStatus === "connected"
                        ? "Conectado"
                        : "Desconectado"}
                    </span>

                    {roomPhase === "waiting" &&
                      participant.moderationStatus !== "removed" &&
                      participantPendingRemoval !==
                        participant.participantId && (
                        <button
                          type="button"
                          className="danger-button compact-button"
                          onClick={() =>
                            setParticipantPendingRemoval(
                              participant.participantId,
                            )
                          }
                        >
                          Remover {participant.nickname}
                        </button>
                      )}

                    {participantPendingRemoval ===
                      participant.participantId && (
                      <div className="removal-confirmation">
                        <button
                          type="button"
                          className="danger-button compact-button"
                          disabled={
                            removingParticipantId === participant.participantId
                          }
                          onClick={() =>
                            void confirmParticipantRemoval(
                              participant.participantId,
                            )
                          }
                        >
                          {removingParticipantId === participant.participantId
                            ? "Removendo..."
                            : "Confirmar remoção"}
                        </button>
                        <button
                          type="button"
                          className="secondary-button compact-button"
                          disabled={
                            removingParticipantId === participant.participantId
                          }
                          onClick={() => setParticipantPendingRemoval(null)}
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p>
          Apresentar permite novas entradas. Encerrar finaliza somente a
          apresentação; a sala continua disponível para uso futuro.
        </p>

        <section
          className="room-danger-zone"
          aria-labelledby="close-room-title"
        >
          <div>
            <strong id="close-room-title">Ciclo da sala</strong>
            <span>Apresente, encerre a apresentação ou arquive esta sala.</span>
          </div>

          <button
            type="button"
            className="primary-button compact-button"
            disabled={processingRoom}
            onClick={() => void handlePresentRoom()}
          >
            {processingRoom ? "Processando..." : "Apresentar"}
          </button>

          {roomPhase === "waiting" && !confirmingRoomClosure && (
            <button
              type="button"
              className="danger-button"
              onClick={() => setConfirmingRoomClosure(true)}
            >
              Encerrar
            </button>
          )}

          {confirmingRoomClosure && (
            <div className="room-closure-confirmation">
              <span>
                A apresentação será finalizada e os participantes serão
                desconectados.
              </span>
              <div>
                <button
                  type="button"
                  className="danger-button compact-button"
                  disabled={endingRoom}
                  onClick={() => void confirmRoomClosure()}
                >
                  {endingRoom ? "Encerrando..." : "Confirmar encerramento"}
                </button>
                <button
                  type="button"
                  className="secondary-button compact-button"
                  disabled={endingRoom}
                  onClick={() => setConfirmingRoomClosure(false)}
                >
                  Manter apresentação
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            className="secondary-button compact-button"
            disabled={processingRoom}
            onClick={() => void handleArchiveRoom()}
          >
            Arquivar
          </button>
        </section>

        <nav className="navigation">
          <Link to="/gerenciar">Voltar à biblioteca de salas</Link>
          <Link to={`/?sala=${room.id}`}>Abrir página do participante</Link>
        </nav>
      </section>
    </main>
  );
}
