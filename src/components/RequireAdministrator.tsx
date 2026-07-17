import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/auth-context";

interface RequireAdministratorProps {
  children: React.ReactNode;
}

export function RequireAdministrator({ children }: RequireAdministratorProps) {
  const { user, loading, isAdministrator, administratorAuthorizationStatus } =
    useAuth();
  const location = useLocation();

  if (loading || administratorAuthorizationStatus === "checking") {
    return (
      <main className="page">
        <section className="card">
          <span className="eyebrow">Quizumba</span>
          <h1>Carregando...</h1>
          <p>Verificando sua sessão e autorização.</p>
        </section>
      </main>
    );
  }

  if (!user || user.isAnonymous || !isAdministrator) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return children;
}
