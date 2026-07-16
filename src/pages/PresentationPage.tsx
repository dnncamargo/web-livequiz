import { Link } from "react-router-dom";

export function PresentationPage() {
  return (
    <main className="page">
      <section className="card">
        <span className="eyebrow">Apresentação</span>
        <h1>Nenhum quiz em andamento</h1>

        <p>Esta será a tela projetada para a turma durante as partidas.</p>

        <Link to="/">Voltar</Link>
      </section>
    </main>
  );
}
