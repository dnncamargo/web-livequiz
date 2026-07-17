import type { User } from "firebase/auth";
import { onValue, ref, type Unsubscribe } from "firebase/database";
import { checkAdministratorAuthorization } from "../auth/administrator-auth";
import { realtimeDatabase } from "../../lib/firebase";
import {
  connectionDiagnosticResponseSchema,
  type ConnectionDiagnosticCheck,
  type ConnectionDiagnosticResponse,
} from "../../shared/connection-diagnostics";
import { apiErrorResponseSchema } from "../../shared/waiting-room";

type DiagnosticUser = Pick<
  User,
  "email" | "getIdToken" | "isAnonymous" | "providerData" | "uid"
>;

interface ConnectionDiagnosticDependencies {
  fetch: typeof fetch;
  isOnline: boolean;
}

const AUTHORIZATION_REASON_MESSAGES = {
  "not-google-user": "A sessão atual não foi criada pelo provedor Google.",
  "profile-not-found": "O documento administrators/{uid} não foi encontrado.",
  "invalid-profile": "O perfil administrativo possui campos inválidos.",
  "inactive-profile": "O perfil administrativo está inativo.",
  "email-mismatch": "O e-mail do perfil não corresponde à conta Google.",
} as const;

const REALTIME_DATABASE_CONNECTION_TIMEOUT_MS = 10_000;

async function waitForRealtimeDatabaseConnection(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let unsubscribe: Unsubscribe | null = null;
    let completed = false;

    const complete = (callback: () => void) => {
      if (completed) {
        return;
      }

      completed = true;
      globalThis.clearTimeout(timeout);
      unsubscribe?.();
      callback();
    };

    const timeout = globalThis.setTimeout(() => {
      complete(() => {
        reject(new Error("Tempo esgotado ao conectar ao Realtime Database."));
      });
    }, REALTIME_DATABASE_CONNECTION_TIMEOUT_MS);

    unsubscribe = onValue(
      ref(realtimeDatabase, ".info/connected"),
      (snapshot) => {
        if (snapshot.val() === true) {
          complete(resolve);
        }
      },
      (error) => {
        complete(() => {
          reject(error);
        });
      },
    );

    if (completed) {
      unsubscribe();
    }
  });
}

function skippedServerChecks(message: string): ConnectionDiagnosticCheck[] {
  return [
    {
      id: "firebase-admin",
      label: "Firebase Admin",
      status: "skipped",
      message,
    },
    {
      id: "server-authorization",
      label: "Autorização no servidor",
      status: "skipped",
      message,
    },
    {
      id: "realtime-database-server",
      label: "RTDB pelo servidor",
      status: "skipped",
      message,
    },
  ];
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const responseText = await response.text();

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return null;
  }
}

export async function runConnectionDiagnostics(
  user: DiagnosticUser | null,
  dependencies: Partial<ConnectionDiagnosticDependencies> = {},
): Promise<ConnectionDiagnosticResponse> {
  const fetchRequest = dependencies.fetch ?? fetch;
  const isOnline = dependencies.isOnline ?? navigator.onLine;
  const checks: ConnectionDiagnosticCheck[] = [
    {
      id: "browser-network",
      label: "Conexão do navegador",
      status: isOnline ? "success" : "error",
      message: isOnline
        ? "O navegador informa que há conectividade de rede."
        : "O navegador está em modo offline.",
      ...(!isOnline && {
        recommendation: "Reconecte o dispositivo à internet e repita o teste.",
      }),
    },
  ];

  if (!user || user.isAnonymous) {
    checks.push({
      id: "firebase-auth",
      label: "Sessão administrativa",
      status: "error",
      message: "Não há uma sessão Google administrativa ativa.",
      recommendation: "Entre novamente pela rota /login.",
    });
    checks.push({
      id: "firebase-token",
      label: "Token Firebase",
      status: "skipped",
      message: "Não testado porque não há administrador autenticado.",
    });
    checks.push({
      id: "firestore-client",
      label: "Firestore pelo navegador",
      status: "skipped",
      message: "Não testado porque não há administrador autenticado.",
    });
  } else {
    checks.push({
      id: "firebase-auth",
      label: "Sessão administrativa",
      status: "success",
      message: `Sessão ativa para ${user.email ?? user.uid}.`,
    });
  }

  let idToken: string | null = null;

  if (user && !user.isAnonymous) {
    try {
      idToken = await user.getIdToken(true);
      checks.push({
        id: "firebase-token",
        label: "Token Firebase",
        status: "success",
        message:
          "O token administrativo foi renovado pelo Firebase Authentication.",
      });
    } catch (error) {
      console.error("Falha ao renovar token no diagnóstico:", error);
      checks.push({
        id: "firebase-token",
        label: "Token Firebase",
        status: "error",
        message: "O Firebase Authentication não conseguiu renovar o token.",
        recommendation: "Saia, entre novamente com o Google e repita o teste.",
      });
    }

    try {
      const authorization = await checkAdministratorAuthorization(user);

      checks.push(
        authorization.authorized
          ? {
              id: "firestore-client",
              label: "Firestore pelo navegador",
              status: "success",
              message:
                "O perfil administrators/{uid} foi lido e está autorizado.",
            }
          : {
              id: "firestore-client",
              label: "Firestore pelo navegador",
              status: "error",
              message: AUTHORIZATION_REASON_MESSAGES[authorization.reason],
              recommendation:
                "Revise o documento do administrador e as regras do Firestore.",
            },
      );
    } catch (error) {
      console.error("Falha do Firestore no diagnóstico:", error);
      checks.push({
        id: "firestore-client",
        label: "Firestore pelo navegador",
        status: "error",
        message: "O navegador não conseguiu consultar o perfil administrativo.",
        recommendation:
          "Confira o projeto Firebase, as regras do Firestore e a conexão de rede.",
      });
    }
  }

  try {
    await waitForRealtimeDatabaseConnection();

    checks.push({
      id: "realtime-database-client",
      label: "RTDB pelo navegador",
      status: "success",
      message: "O navegador estabeleceu conexão com o Realtime Database.",
    });
  } catch (error) {
    console.error("Falha do RTDB no diagnóstico do navegador:", error);
    checks.push({
      id: "realtime-database-client",
      label: "RTDB pelo navegador",
      status: "error",
      message: "O navegador não conseguiu consultar o Realtime Database.",
      recommendation:
        "Confira VITE_FIREBASE_DATABASE_URL e bloqueios de rede, proxy ou extensões do navegador.",
    });
  }

  try {
    const response = await fetchRequest("/api/games", { method: "GET" });
    const payload = await parseJsonResponse(response);
    const errorResult = apiErrorResponseSchema.safeParse(payload);
    const functionIsAvailable =
      response.status === 405 &&
      errorResult.success &&
      errorResult.data.error.code === "method-not-allowed";

    checks.push({
      id: "vercel-function",
      label: "Função da Vercel",
      status: functionIsAvailable ? "success" : "error",
      message: functionIsAvailable
        ? "A rota /api/games está publicada e respondeu corretamente."
        : "A rota /api/games não retornou o contrato esperado.",
      ...(!functionIsAvailable && {
        recommendation:
          "Confirme o deploy da pasta api/ e consulte os logs da Vercel.",
      }),
    });
  } catch (error) {
    console.error("Falha ao acessar função da Vercel:", error);
    checks.push({
      id: "vercel-function",
      label: "Função da Vercel",
      status: "error",
      message: "O navegador não conseguiu acessar /api/games.",
      recommendation:
        "Teste na versão publicada e confira a implantação na Vercel.",
    });
  }

  if (!idToken) {
    checks.push(
      ...skippedServerChecks(
        "Não testado porque não foi possível obter um token administrativo.",
      ),
    );
  } else {
    try {
      const response = await fetchRequest("/api/diagnostics", {
        method: "POST",
        headers: { authorization: `Bearer ${idToken}` },
      });
      const payload = await parseJsonResponse(response);
      const result = connectionDiagnosticResponseSchema.safeParse(payload);

      if (result.success) {
        checks.push(...result.data.checks);
      } else {
        checks.push(
          ...skippedServerChecks(
            "A função de diagnóstico retornou uma resposta inválida.",
          ).map((check, index) =>
            index === 0
              ? {
                  ...check,
                  status: "error" as const,
                  recommendation:
                    "Consulte os logs de /api/diagnostics na Vercel.",
                }
              : check,
          ),
        );
      }
    } catch (error) {
      console.error("Falha no diagnóstico administrativo do servidor:", error);
      checks.push(
        ...skippedServerChecks(
          "A função de diagnóstico não pôde ser acessada.",
        ).map((check, index) =>
          index === 0
            ? {
                ...check,
                status: "error" as const,
                recommendation:
                  "Confirme o deploy de /api/diagnostics na Vercel.",
              }
            : check,
        ),
      );
    }
  }

  return { checkedAt: Date.now(), checks };
}
