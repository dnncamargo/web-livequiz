import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/auth-context";
import { runConnectionDiagnostics } from "../features/diagnostics/connection-diagnostics";
import type {
  ConnectionDiagnosticResponse,
  ConnectionDiagnosticStatus,
} from "../shared/connection-diagnostics";

type PageStatus = "idle" | "running" | "complete" | "error";

const STATUS_LABELS: Readonly<Record<ConnectionDiagnosticStatus, string>> = {
  success: "Funcionando",
  warning: "Atenção",
  error: "Falha",
  skipped: "Não testado",
};

export function FirebaseTestPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<PageStatus>("idle");
  const [report, setReport] = useState<ConnectionDiagnosticResponse | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState("");

  const summary = useMemo(() => {
    if (!report) {
      return null;
    }

    return report.checks.reduce(
      (counts, check) => {
        counts[check.status] += 1;
        return counts;
      },
      { success: 0, warning: 0, error: 0, skipped: 0 },
    );
  }, [report]);

  async function handleRunDiagnostics() {
    if (status === "running") {
      return;
    }

    setStatus("running");
    setReport(null);
    setErrorMessage("");

    try {
      const nextReport = await runConnectionDiagnostics(user);
      setReport(nextReport);
      setStatus("complete");
    } catch (error) {
      console.error("Falha inesperada no diagnóstico de conexão:", error);
      setErrorMessage(
        "O diagnóstico foi interrompido antes de concluir todas as etapas.",
      );
      setStatus("error");
    }
  }

  return (
    <main className="page">
      <section className="card diagnostic-card">
        <span className="eyebrow">Diagnóstico seguro</span>

        <h1>Conexões do Quizumba</h1>

        <p>
          Verifica cada camada separadamente para localizar falhas de rede,
          autenticação, Firestore, Realtime Database e Firebase Admin.
        </p>

        <div className="diagnostic-notice">
          <strong>Teste somente leitura</strong>
          <span>Nenhum documento, participante ou sala será criado.</span>
        </div>

        <button
          type="button"
          className="primary-button"
          disabled={status === "running"}
          onClick={handleRunDiagnostics}
        >
          {status === "running"
            ? "Verificando conexões..."
            : "Executar diagnóstico completo"}
        </button>

        <div aria-live="polite">
          {status === "running" && (
            <p className="diagnostic-progress">
              Consultando os serviços em sequência. Aguarde alguns segundos.
            </p>
          )}

          {summary && report && (
            <>
              <div className="diagnostic-summary">
                <div>
                  <strong>{summary.success}</strong>
                  <span>Funcionando</span>
                </div>
                <div>
                  <strong>{summary.warning}</strong>
                  <span>Atenção</span>
                </div>
                <div>
                  <strong>{summary.error}</strong>
                  <span>Falhas</span>
                </div>
                <div>
                  <strong>{summary.skipped}</strong>
                  <span>Não testados</span>
                </div>
              </div>

              <p className="diagnostic-timestamp">
                Executado às{" "}
                {new Date(report.checkedAt).toLocaleTimeString("pt-BR")}.
              </p>

              <ol className="diagnostic-checks">
                {report.checks.map((check) => (
                  <li
                    className={`diagnostic-check diagnostic-check-${check.status}`}
                    key={check.id}
                  >
                    <div className="diagnostic-check-heading">
                      <h2>{check.label}</h2>
                      <span>{STATUS_LABELS[check.status]}</span>
                    </div>
                    <p>{check.message}</p>
                    {check.recommendation && (
                      <div className="diagnostic-recommendation">
                        <strong>Ação recomendada</strong>
                        <span>{check.recommendation}</span>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}

          {status === "error" && (
            <div className="test-result test-result-error" role="alert">
              <strong>Diagnóstico interrompido</strong>
              <p>{errorMessage}</p>
            </div>
          )}
        </div>

        <nav className="navigation">
          <Link to="/admin">Voltar ao gerenciamento</Link>
          <Link to="/">Página inicial</Link>
        </nav>
      </section>
    </main>
  );
}
