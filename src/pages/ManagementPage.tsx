import { Link } from "react-router-dom";

export function ManagementPage() {
  return (
    <main className="page">
      <section className="card">
        <span className="eyebrow">Gerenciamento</span>
        <h1>Painel do Quizumba</h1>

        <p>
          Aqui serão criados os quizzes, moderados os participantes e
          controladas as partidas.
        </p>

        <Link to="/">Voltar</Link>
      </section>
    </main>
  );
}