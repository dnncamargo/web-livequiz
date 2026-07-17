import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/auth-context";
import { getAuthErrorMessage } from "../features/auth/auth-errors";
import { ParticipantJoinPanel } from "../features/participants/ParticipantJoinPanel";

export function HomePage() {
  const {
    user,
    loading,
    isAnonymous,
    isAdministrator,
    authErrorMessage,
    signInParticipant,
    logout,
  } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleParticipantLogin() {
    setSubmitting(true);
    setErrorMessage("");

    try {
      await signInParticipant();
    } catch (error) {
      console.error("Erro na autenticação anônima:", error);

      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    setSubmitting(true);
    setErrorMessage("");

    try {
      await logout();
    } catch (error) {
      console.error("Erro ao encerrar sessão:", error);

      setErrorMessage(
        getAuthErrorMessage(
          error,
          "Não foi possível encerrar a sessão. Tente novamente.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="page" aria-busy="true">
        <section className="card hero" role="status" aria-live="polite">
          <span className="eyebrow">Quizumba</span>
          <h1>Carregando...</h1>
          <p>Restaurando sua sessão neste dispositivo.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="card hero">
        <span className="eyebrow">Quizumba</span>

        <h1>Prepare-se para jogar!</h1>

        {!user && (
          <>
            <p>Entre como participante para aguardar uma partida.</p>

            <button
              type="button"
              className="primary-button"
              disabled={submitting}
              onClick={handleParticipantLogin}
            >
              {submitting ? "Entrando..." : "Entrar como participante"}
            </button>
          </>
        )}

        {user && isAnonymous && (
          <>
            <ParticipantJoinPanel key={user.uid} user={user} />

            <button
              type="button"
              className="secondary-button"
              disabled={submitting}
              onClick={handleLogout}
            >
              Sair
            </button>
          </>
        )}

        {user && !isAnonymous && isAdministrator && (
          <>
            <p>Você está conectado como administrador.</p>

            <div className="auth-diagnostic">
              <span>Conta</span>
              <strong>
                {user.displayName ?? user.email ?? "Administrador"}
              </strong>
            </div>

            <nav className="navigation">
              <Link to="/gerenciar">Abrir gerenciamento</Link>
            </nav>

            <button
              type="button"
              className="secondary-button"
              disabled={submitting}
              onClick={handleLogout}
            >
              Sair
            </button>
          </>
        )}

        {user && !isAnonymous && !isAdministrator && (
          <>
            <p>
              Sua conta Google está conectada, mas ainda não está autorizada
              para administrar o Quizumba.
            </p>

            <button
              type="button"
              className="secondary-button"
              disabled={submitting}
              onClick={handleLogout}
            >
              Sair
            </button>
          </>
        )}

        {(errorMessage || authErrorMessage) && (
          <div className="test-result test-result-error" role="alert">
            <strong>Falha na autenticação</strong>
            <p>{errorMessage || authErrorMessage}</p>
          </div>
        )}

        <nav className="navigation">
          <Link to="/apresentacao">Abrir apresentação</Link>

          <Link to="/login">Administração</Link>
        </nav>
      </section>
    </main>
  );
}
