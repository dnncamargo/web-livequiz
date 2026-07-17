import { useState } from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface LoginLocationState {
  from?: string;
}

export function AdminLoginPage() {
  const {
    user,
    loading,
    signInAdministrator,
  } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const navigate = useNavigate();
  const location = useLocation();

  const state = location.state as LoginLocationState | null;
  const destination = state?.from ?? "/gerenciar";

  async function handleGoogleLogin() {
    setSubmitting(true);
    setErrorMessage("");

    try {
      await signInAdministrator();
      navigate(destination, { replace: true });
    } catch (error) {
      console.error("Erro no login administrativo:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível fazer login com o Google.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="page">
        <section className="card">
          <h1>Carregando...</h1>
        </section>
      </main>
    );
  }

  if (user && !user.isAnonymous) {
    return <Navigate to={destination} replace />;
  }

  return (
    <main className="page">
      <section className="card">
        <span className="eyebrow">Administração</span>

        <h1>Entrar no Quizumba</h1>

        <p>
          Use uma conta Google autorizada para gerenciar quizzes e
          controlar partidas.
        </p>

        <button
          type="button"
          className="primary-button"
          disabled={submitting}
          onClick={handleGoogleLogin}
        >
          {submitting
            ? "Entrando..."
            : "Entrar com Google"}
        </button>

        {errorMessage && (
          <div className="test-result test-result-error">
            <strong>Não foi possível entrar</strong>
            <p>{errorMessage}</p>
          </div>
        )}
      </section>
    </main>
  );
}