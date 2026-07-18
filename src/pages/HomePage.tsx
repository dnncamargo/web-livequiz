import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/auth-context";
import { getAuthErrorMessage } from "../features/auth/auth-errors";
import { usePublicWaitingRoom } from "../features/live-game/use-public-waiting-room";
import { ParticipantJoinPanel } from "../features/participants/ParticipantJoinPanel";
import { participantGameCodeSchema } from "../shared/participant";

export function HomePage() {
  const [searchParams] = useSearchParams();
  const {
    user,
    loading,
    isAnonymous,
    isAdministrator,
    authErrorMessage,
    signInParticipant,
    signInAdministrator,
    logout,
  } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [showAdministratorLogin, setShowAdministratorLogin] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const requestedGameId =
    searchParams.get("join") ?? searchParams.get("sala") ?? "";
  const gameIdResult = participantGameCodeSchema.safeParse(requestedGameId);
  const linkedGameId = gameIdResult.success ? gameIdResult.data : "";
  const linkedRoomState = usePublicWaitingRoom(linkedGameId);

  async function runAuthentication(action: () => Promise<unknown>) {
    setSubmitting(true);
    setErrorMessage("");
    try {
      await action();
    } catch (error) {
      console.error("Erro de autenticação:", error);
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading)
    return (
      <main className="page" aria-busy="true">
        <section className="card hero" role="status" aria-live="polite">
          <span className="eyebrow">Quizumba</span>
          <h1>Carregando...</h1>
          <p>Restaurando sua sessão neste dispositivo.</p>
        </section>
      </main>
    );
  if (user && !isAnonymous && isAdministrator)
    return <Navigate to="/admin" replace />;

  return (
    <main className="page">
      <section className="card hero">
        <span className="eyebrow">Quizumba</span>
        <h1>Prepare-se para jogar!</h1>
        {linkedGameId && linkedRoomState.loading && (
          <div className="linked-room-notice" role="status">
            <span>Localizando sala</span>
            <strong>{linkedGameId}</strong>
          </div>
        )}
        {linkedRoomState.room?.phase === "waiting" && (
          <div
            className="linked-room-notice"
            aria-label="Sala ativa identificada"
          >
            <span>Sala de espera ativa</span>
            {linkedRoomState.room.name && (
              <strong>{linkedRoomState.room.name}</strong>
            )}
            <strong>{linkedRoomState.room.id}</strong>
            <small>
              Aguardando · {linkedRoomState.room.participantCount}{" "}
              participante(s)
            </small>
          </div>
        )}
        {linkedRoomState.room?.phase === "finished" && (
          <div className="test-result test-result-error" role="status">
            <strong>Apresentação finalizada</strong>
            <p>Esta sala permanece salva, mas não está recebendo entradas.</p>
          </div>
        )}
        {requestedGameId && !gameIdResult.success && (
          <div className="test-result test-result-error" role="alert">
            <strong>Link de sala inválido</strong>
            <p>Confira o endereço recebido e tente novamente.</p>
          </div>
        )}
        {linkedGameId && linkedRoomState.error && (
          <div className="test-result test-result-error" role="alert">
            <strong>Sala indisponível</strong>
            <p>{linkedRoomState.error}</p>
          </div>
        )}
        {!user && (
          <>
            <p>Entre como participante para aguardar uma partida.</p>
            <div className="home-entry-actions">
              <button
                type="button"
                className="primary-button"
                disabled={submitting}
                onClick={() => void runAuthentication(signInParticipant)}
              >
                {submitting ? "Entrando..." : "Entrar como participante"}
              </button>
              {!showAdministratorLogin && (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={submitting}
                  onClick={() => setShowAdministratorLogin(true)}
                >
                  Painel de Controle
                </button>
              )}
            </div>
            {showAdministratorLogin && (
              <section className="administrator-login-panel" aria-live="polite">
                <h2>Painel de Controle</h2>
                <p>Use uma conta Google autorizada para administrar salas.</p>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={submitting}
                  onClick={() => void runAuthentication(signInAdministrator)}
                >
                  {submitting ? "Entrando..." : "Entrar com Google"}
                </button>
              </section>
            )}
          </>
        )}
        {user && isAnonymous && (
          <ParticipantJoinPanel
            key={user.uid}
            user={user}
            initialGameId={linkedGameId}
          />
        )}
        {user && !isAnonymous && !isAdministrator && (
          <>
            <h2>Acesso não autorizado</h2>
            <p>
              Sua conta Google está conectada, mas ainda não está autorizada
              para administrar o Quizumba.
            </p>
            <div className="home-entry-actions">
              <button
                type="button"
                className="primary-button"
                disabled={submitting}
                onClick={() => void runAuthentication(signInParticipant)}
              >
                {submitting ? "Entrando..." : "Entrar como participante"}
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={submitting}
                onClick={() => void runAuthentication(logout)}
              >
                Sair
              </button>
            </div>
          </>
        )}
        {(errorMessage || authErrorMessage) && (
          <div className="test-result test-result-error" role="alert">
            <strong>Falha na autenticação</strong>
            <p>{errorMessage || authErrorMessage}</p>
          </div>
        )}
      </section>
    </main>
  );
}
