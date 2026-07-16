import { Link } from "react-router-dom";

export function HomePage() {
  return (
    <main className="page">
      <section className="card hero">
        <span className="eyebrow">Quizumba</span>

        <h1>Prepare-se para jogar!</h1>

        <p>
          Quando uma partida estiver aberta, você poderá escolher seu nickname
          e seu avatar nesta página.
        </p>

        <nav className="navigation">
          <Link to="/firebase-test">Testar Firebase</Link>
          <Link to="/apresentacao">Abrir apresentação</Link>
          <Link to="/gerenciar">Abrir gerenciamento</Link>
        </nav>
      </section>
    </main>
  );
}