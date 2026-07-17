import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface RequireAdministratorProps {
  children: React.ReactNode;
}

export function RequireAdministrator({
  children,
}: RequireAdministratorProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="page">
        <section className="card">
          <span className="eyebrow">Quizumba</span>
          <h1>Carregando...</h1>
          <p>Verificando sua sessão.</p>
        </section>
      </main>
    );
  }

  if (!user || user.isAnonymous) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return children;
}