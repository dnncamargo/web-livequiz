import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function HomePage() {
  const {
    user,
    loading,
    isAnonymous,
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

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar sua participação.",
      );
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
        error instanceof Error
          ? error.message
          : "Não foi possível encerrar a sessão.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="page">
        <section className="card hero">
          <span className="eyebrow">Quizumba</span>
          <h1>Carregando...</h1>
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
            <p>
              Entre como participante para aguardar uma partida.
            </p>

            <button
              type="button"
              className="primary-button"
              disabled={submitting}
              onClick={handleParticipantLogin}
            >
              {submitting
                ? "Entrando..."
                : "Entrar como participante"}
            </button>
          </>
        )}

        {user && isAnonymous && (
          <>
            <p>
              Participante conectado. Na próxima etapa você poderá
              escolher um nickname e um avatar.
            </p>

            <div className="auth-diagnostic">
              <span>Identificador temporário</span>
              <code>{user.uid}</code>
            </div>

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

        {user && !isAnonymous && (
          <>
            <p>
              Você está conectado como administrador.
            </p>

            <div className="auth-diagnostic">
              <span>Conta</span>
              <strong>
                {user.displayName ??
                  user.email ??
                  "Administrador"}
              </strong>
            </div>

            <nav className="navigation">
              <Link to="/gerenciar">
                Abrir gerenciamento
              </Link>
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

        {errorMessage && (
          <div className="test-result test-result-error">
            <strong>Falha na autenticação</strong>
            <p>{errorMessage}</p>
          </div>
        )}

        <nav className="navigation">
          <Link to="/apresentacao">
            Abrir apresentação
          </Link>

          <Link to="/login">
            Administração
          </Link>
        </nav>
      </section>
    </main>
  );
}