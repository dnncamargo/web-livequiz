import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/auth-context";
import { getAuthErrorMessage } from "../features/auth/auth-errors";
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
    logout,
  } = useAuth();
  const [automaticEntryError, setAutomaticEntryError] = useState("");
  const entryAttemptedRef = useRef(false);
  const requestedGameId = searchParams.get("join") ?? "";
  const gameIdResult = participantGameCodeSchema.safeParse(requestedGameId);
  const initialGameId = gameIdResult.success ? gameIdResult.data : "";

  const enterAsParticipant = useCallback(async () => {
    if (entryAttemptedRef.current) {
      return;
    }

    entryAttemptedRef.current = true;

    try {
      if (user && !user.isAnonymous) {
        await logout();
      }

      await signInParticipant();
    } catch (error) {
      console.error("Erro ao iniciar a sessão do participante:", error);
      setAutomaticEntryError(getAuthErrorMessage(error));
    }
  }, [logout, signInParticipant, user]);

  useEffect(() => {
    if (!loading && !isAnonymous && !isAdministrator) {
      const timeoutId = globalThis.setTimeout(() => {
        void enterAsParticipant();
      }, 0);

      return () => globalThis.clearTimeout(timeoutId);
    }
  }, [enterAsParticipant, isAdministrator, isAnonymous, loading]);

  if (!loading && user && !isAnonymous && isAdministrator) {
    return <Navigate to="/admin" replace />;
  }

  if (loading || !user || !isAnonymous) {
    return (
      <main className="page" aria-busy={!automaticEntryError}>
        <section className="card hero" role="status" aria-live="polite">
          <span className="eyebrow">Quizumba</span>
          <h1>Preparando sua entrada...</h1>
          <p>Criando uma sessão segura para este dispositivo.</p>

          {(automaticEntryError || authErrorMessage) && (
            <div className="test-result test-result-error" role="alert">
              <strong>Não foi possível preparar sua entrada</strong>
              <p>{automaticEntryError || authErrorMessage}</p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  entryAttemptedRef.current = false;
                  setAutomaticEntryError("");
                  void enterAsParticipant();
                }}
              >
                Tentar novamente
              </button>
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="card hero participant-entry-card">
        <span className="eyebrow">Quizumba</span>

        {requestedGameId && !gameIdResult.success && (
          <div className="test-result test-result-error" role="alert">
            <strong>Link de sala inválido</strong>
            <p>Confira o endereço recebido e tente novamente.</p>
          </div>
        )}

        <ParticipantJoinPanel
          key={user.uid}
          user={user}
          initialGameId={initialGameId}
        />
      </section>
    </main>
  );
}
