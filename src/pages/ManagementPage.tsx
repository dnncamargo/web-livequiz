import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/auth-context";
import { getAuthErrorMessage } from "../features/auth/auth-errors";
import {
  createWaitingRoom,
  WaitingRoomRequestError,
} from "../features/live-game/waiting-room";

export function ManagementPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleCreateWaitingRoom() {
    if (!user) {
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const room = await createWaitingRoom(user);
      navigate(`/gerenciar/sala/${room.id}`);
    } catch (error) {
      console.error("Erro ao criar sala de espera:", error);
      setErrorMessage(
        error instanceof WaitingRoomRequestError
          ? error.message
          : "Não foi possível criar a sala. Tente novamente.",
      );
      setSubmitting(false);
    }
  }

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

        <div className="management-actions">
          <button
            type="button"
            className="primary-button"
            disabled={submitting}
            onClick={handleCreateWaitingRoom}
          >
            {submitting ? "Criando sala..." : "Criar sala de espera"}
          </button>
          <span>Gera um código seguro para a próxima partida.</span>
        </div>

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
            <strong>Não foi possível concluir a ação</strong>
            <p>{errorMessage}</p>
          </div>
        )}
      </section>
    </main>
  );
}
