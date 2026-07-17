import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/auth-context";
import { getAuthErrorMessage } from "../features/auth/auth-errors";

export function ManagementPage() {
  const { user, logout } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogout() {
    setSubmitting(true);
    setErrorMessage("");

    try {
      await logout();
    } catch (error) {
      console.error("Erro ao encerrar sessão administrativa:", error);
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

  return (
    <main className="page">
      <section className="card">
        <span className="eyebrow">Gerenciamento</span>

        <h1>Painel do Quizumba</h1>

        <p>Sessão administrativa autenticada.</p>

        <div className="auth-diagnostic">
          <span>Administrador</span>

          <strong>{user?.displayName ?? user?.email ?? user?.uid}</strong>
        </div>

        <nav className="navigation">
          <Link to="/firebase-test">Testar Firebase</Link>

          <Link to="/">Página inicial</Link>
        </nav>

        <button
          type="button"
          className="secondary-button"
          disabled={submitting}
          onClick={handleLogout}
        >
          {submitting ? "Saindo..." : "Encerrar sessão"}
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
