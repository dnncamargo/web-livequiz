import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/auth-context";
import { getAdministratorAuthErrorMessage } from "../features/auth/auth-errors";

interface LoginLocationState {
  from?: string;
}

export function AdminLoginPage() {
  const {
    user,
    loading,
    isAdministrator,
    administratorAuthorizationStatus,
    authErrorMessage,
    signInAdministrator,
    refreshAdministratorAuthorization,
    logout,
  } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const location = useLocation();
  const state = location.state as LoginLocationState | null;
  const destination = state?.from ?? "/admin";

  async function handleGoogleLogin() {
    setSubmitting(true);
    setErrorMessage("");

    try {
      await signInAdministrator();
    } catch (error) {
      console.error("Erro no login administrativo:", error);
      setErrorMessage(getAdministratorAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRetryAuthorization() {
    setSubmitting(true);
    setErrorMessage("");

    try {
      await refreshAdministratorAuthorization();
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
      setErrorMessage("Não foi possível encerrar a sessão. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || administratorAuthorizationStatus === "checking") {
    return (
      <main className="page" aria-busy="true">
        <section className="card" role="status" aria-live="polite">
          <span className="eyebrow">Administração</span>
          <h1>Verificando acesso...</h1>
          <p>Confirmando se esta conta está autorizada.</p>
        </section>
      </main>
    );
  }

  if (user && !user.isAnonymous && isAdministrator) {
    return <Navigate to={destination} replace />;
  }

  if (
    user &&
    !user.isAnonymous &&
    administratorAuthorizationStatus === "error"
  ) {
    return (
      <main className="page">
        <section className="card">
          <span className="eyebrow">Administração</span>
          <h1>Não foi possível verificar</h1>
          <div className="test-result test-result-error" role="alert">
            <strong>Falha na autorização</strong>
            <p>
              {authErrorMessage ??
                "Não foi possível confirmar sua autorização administrativa."}
            </p>
          </div>

          <button
            type="button"
            className="primary-button"
            disabled={submitting}
            onClick={handleRetryAuthorization}
          >
            {submitting ? "Verificando..." : "Tentar novamente"}
          </button>

          <button
            type="button"
            className="secondary-button"
            disabled={submitting}
            onClick={handleLogout}
          >
            Usar outra conta
          </button>
        </section>
      </main>
    );
  }

  if (user && !user.isAnonymous) {
    return (
      <main className="page">
        <section className="card">
          <span className="eyebrow">Administração</span>
          <h1>Acesso não autorizado</h1>
          <p>
            A conta <strong>{user.email ?? "selecionada"}</strong> não possui
            autorização administrativa ativa no Quizumba.
          </p>

          <button
            type="button"
            className="primary-button"
            disabled={submitting}
            onClick={handleRetryAuthorization}
          >
            {submitting ? "Verificando..." : "Verificar autorização novamente"}
          </button>

          <button
            type="button"
            className="secondary-button"
            disabled={submitting}
            onClick={handleLogout}
          >
            {submitting ? "Saindo..." : "Usar outra conta"}
          </button>

          {errorMessage && (
            <div className="test-result test-result-error" role="alert">
              <strong>Não foi possível sair</strong>
              <p>{errorMessage}</p>
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="card">
        <span className="eyebrow">Administração</span>
        <h1>Entrar no Quizumba</h1>
        <p>
          Use uma conta Google autorizada para gerenciar quizzes e controlar
          partidas.
        </p>

        <button
          type="button"
          className="primary-button"
          disabled={submitting}
          onClick={handleGoogleLogin}
        >
          {submitting ? "Entrando..." : "Entrar com Google"}
        </button>

        {errorMessage && (
          <div className="test-result test-result-error" role="alert">
            <strong>Não foi possível entrar</strong>
            <p>{errorMessage}</p>
          </div>
        )}
      </section>
    </main>
  );
}
