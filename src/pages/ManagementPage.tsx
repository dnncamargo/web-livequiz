import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function ManagementPage() {
  const { user, logout } = useAuth();

  return (
    <main className="page">
      <section className="card">
        <span className="eyebrow">Gerenciamento</span>

        <h1>Painel do Quizumba</h1>

        <p>
          Sessão administrativa autenticada.
        </p>

        <div className="auth-diagnostic">
          <span>Administrador</span>

          <strong>
            {user?.displayName ??
              user?.email ??
              user?.uid}
          </strong>
        </div>

        <nav className="navigation">
          <Link to="/firebase-test">
            Testar Firebase
          </Link>

          <Link to="/">
            Página inicial
          </Link>
        </nav>

        <button
          type="button"
          className="secondary-button"
          onClick={() => void logout()}
        >
          Encerrar sessão
        </button>
      </section>
    </main>
  );
}