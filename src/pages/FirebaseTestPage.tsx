import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/firebase";

type TestStatus = "idle" | "loading" | "success" | "error";

interface FirebaseTestRecord {
  id: string;
  message: string;
}

export function FirebaseTestPage() {
  const [status, setStatus] = useState<TestStatus>("idle");
  const [records, setRecords] = useState<FirebaseTestRecord[]>([]);
  const [feedback, setFeedback] = useState("O teste ainda não foi executado.");

  async function testFirebaseConnection() {
    if (status === "loading") {
      return;
    }

    setStatus("loading");
    setRecords([]);
    setFeedback("Gravando documento no Firestore...");

    try {
      const testCollection = collection(db, "connectionTests");

      const createdDocument = await addDoc(testCollection, {
        message: "Quizumba conectado ao Firebase",
        source: "web",
        createdAt: serverTimestamp(),
      });

      setFeedback(
        `Documento ${createdDocument.id} gravado. Fazendo leitura...`,
      );

      const testQuery = query(
        testCollection,
        orderBy("createdAt", "desc"),
        limit(5),
      );

      const snapshot = await getDocs(testQuery);

      const loadedRecords: FirebaseTestRecord[] = snapshot.docs.map(
        (document) => {
          const data = document.data();

          return {
            id: document.id,
            message:
              typeof data.message === "string"
                ? data.message
                : "Mensagem não encontrada",
          };
        },
      );

      setRecords(loadedRecords);
      setStatus("success");
      setFeedback(
        "Leitura e escrita concluídas. O Quizumba está conectado ao Firestore.",
      );
    } catch (error) {
      console.error("Erro no teste do Firebase:", error);

      setStatus("error");
      setFeedback(
        "Não foi possível concluir o diagnóstico do Firebase. Tente novamente.",
      );
    }
  }

  return (
    <main className="page">
      <section className="card">
        <span className="eyebrow">Diagnóstico</span>

        <h1>Firebase</h1>

        <p>{feedback}</p>

        <button
          type="button"
          className="primary-button"
          disabled={status === "loading"}
          onClick={testFirebaseConnection}
        >
          {status === "loading" ? "Testando..." : "Testar leitura e escrita"}
        </button>

        {status === "success" && (
          <div className="test-result test-result-success">
            <strong>Conexão aprovada</strong>

            {records.length > 0 ? (
              <ul>
                {records.map((record) => (
                  <li key={record.id}>{record.message}</li>
                ))}
              </ul>
            ) : (
              <p>Nenhum documento foi encontrado na leitura.</p>
            )}
          </div>
        )}

        {status === "error" && (
          <div className="test-result test-result-error" role="alert">
            <strong>Falha na conexão</strong>
            <p>Consulte também o console do navegador.</p>
          </div>
        )}

        <Link to="/">Voltar à página inicial</Link>
      </section>
    </main>
  );
}
