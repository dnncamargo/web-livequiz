import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/auth-context";

export function AdminLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar" aria-label="Navegação administrativa">
        <div>
          <span className="eyebrow">Quizumba</span>
          <strong>Painel de Controle</strong>
        </div>

        <nav>
          <NavLink end to="/admin">
            Partidas
          </NavLink>
          <NavLink to="/admin/quizzes">Quizzes</NavLink>
          <NavLink to="/admin/archive">Arquivo</NavLink>
          <NavLink to="/admin/firebase-test">Diagnóstico</NavLink>
        </nav>

        <div className="admin-sidebar-account">
          <span>{user?.displayName ?? user?.email ?? "Administrador"}</span>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void logout()}
          >
            Sair da conta
          </button>
        </div>
      </aside>

      <div className="admin-content">
        <Outlet />
      </div>
    </div>
  );
}
