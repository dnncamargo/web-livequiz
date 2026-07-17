import type {
  ConnectionDiagnosticCheck,
  ConnectionDiagnosticResponse,
} from "../src/shared/connection-diagnostics";

const FIREBASE_ADMIN_ERROR_CODES = new Set([
  "firebase-admin-environment-invalid",
  "firebase-admin-private-key-invalid",
  "firebase-admin-initialization-failed",
]);

function jsonResponse(body: ConnectionDiagnosticResponse, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function skippedCheck(
  id: ConnectionDiagnosticCheck["id"],
  label: string,
  message: string,
): ConnectionDiagnosticCheck {
  return { id, label, status: "skipped", message };
}

function getErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }

  return typeof error.code === "string" ? error.code : null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function hasBearerToken(request: Request): boolean {
  return /^Bearer\s+\S+$/i.test(request.headers.get("authorization") ?? "");
}

export function GET(): Response {
  return Response.json(
    {
      error: {
        code: "method-not-allowed",
        message: "Utilize POST autenticado para executar o diagnóstico.",
      },
    },
    {
      status: 405,
      headers: { allow: "POST", "cache-control": "no-store" },
    },
  );
}

export async function POST(request: Request): Promise<Response> {
  const checkedAt = Date.now();

  if (!hasBearerToken(request)) {
    return jsonResponse(
      {
        checkedAt,
        checks: [
          skippedCheck(
            "firebase-admin",
            "Firebase Admin",
            "Não testado sem uma sessão administrativa.",
          ),
          {
            id: "server-authorization",
            label: "Autorização no servidor",
            status: "error",
            message: "O token administrativo não foi enviado.",
            recommendation: "Entre novamente no painel administrativo.",
          },
          skippedCheck(
            "realtime-database-server",
            "RTDB pelo servidor",
            "Não testado porque a autenticação não foi iniciada.",
          ),
        ],
      },
      401,
    );
  }

  let authorizationModule: typeof import("./_lib/administrator-authorization");
  let firebaseModule: typeof import("./_lib/firebase-admin");

  try {
    [authorizationModule, firebaseModule] = await Promise.all([
      import("./_lib/administrator-authorization"),
      import("./_lib/firebase-admin"),
    ]);
  } catch (error) {
    console.error("Falha ao carregar módulos do diagnóstico:", error);

    return jsonResponse(
      {
        checkedAt,
        checks: [
          {
            id: "firebase-admin",
            label: "Firebase Admin",
            status: "error",
            message:
              "A função não conseguiu carregar os módulos administrativos.",
            recommendation: "Consulte os logs da função na Vercel.",
          },
          skippedCheck(
            "server-authorization",
            "Autorização no servidor",
            "Não testado porque os módulos não foram carregados.",
          ),
          skippedCheck(
            "realtime-database-server",
            "RTDB pelo servidor",
            "Não testado porque os módulos não foram carregados.",
          ),
        ],
      },
      500,
    );
  }

  let services: ReturnType<typeof firebaseModule.getFirebaseAdminServices>;

  try {
    services = firebaseModule.getFirebaseAdminServices();
  } catch (error) {
    console.error("Falha na configuração do Firebase Admin:", error);
    const errorCode = getErrorCode(error);
    const isKnownConfigurationError =
      errorCode !== null && FIREBASE_ADMIN_ERROR_CODES.has(errorCode);

    return jsonResponse(
      {
        checkedAt,
        checks: [
          {
            id: "firebase-admin",
            label: "Firebase Admin",
            status: "error",
            message: isKnownConfigurationError
              ? getErrorMessage(
                  error,
                  "A configuração administrativa do Firebase é inválida.",
                )
              : "O Firebase Admin não pôde ser inicializado.",
            recommendation:
              errorCode === "firebase-admin-private-key-invalid"
                ? "Revise FIREBASE_ADMIN_PRIVATE_KEY na Vercel e faça um novo deploy."
                : "Revise as quatro variáveis FIREBASE_ADMIN_* na Vercel e faça um novo deploy.",
          },
          skippedCheck(
            "server-authorization",
            "Autorização no servidor",
            "Não testado porque o Firebase Admin não iniciou.",
          ),
          skippedCheck(
            "realtime-database-server",
            "RTDB pelo servidor",
            "Não testado porque o Firebase Admin não iniciou.",
          ),
        ],
      },
      503,
    );
  }

  const checks: ConnectionDiagnosticCheck[] = [
    {
      id: "firebase-admin",
      label: "Firebase Admin",
      status: "success",
      message: "SDK administrativo inicializado com a conta de serviço.",
    },
  ];

  try {
    await authorizationModule.authorizeAdministratorRequest(request, services);
    checks.push({
      id: "server-authorization",
      label: "Autorização no servidor",
      status: "success",
      message: "Token Google e perfil administrativo validados no servidor.",
    });
  } catch (error) {
    console.error("Falha na autorização do diagnóstico:", error);
    const errorCode = getErrorCode(error);

    checks.push({
      id: "server-authorization",
      label: "Autorização no servidor",
      status: "error",
      message:
        errorCode === "invalid-token" || errorCode === "authentication-required"
          ? "O servidor não aceitou o token da sessão."
          : errorCode?.startsWith("administrator-")
            ? getErrorMessage(
                error,
                "O perfil administrativo foi recusado no servidor.",
              )
            : "O servidor não conseguiu consultar o token ou o perfil no Firestore.",
      recommendation:
        errorCode === "invalid-token"
          ? "Saia, entre novamente com o Google e repita o teste."
          : "Confira a conta de serviço, o projeto e administrators/{uid}.",
    });
    checks.push(
      skippedCheck(
        "realtime-database-server",
        "RTDB pelo servidor",
        "Não testado porque a autorização no servidor falhou.",
      ),
    );

    return jsonResponse({ checkedAt, checks }, 403);
  }

  try {
    await services.checkRealtimeDatabaseConnection();
    checks.push({
      id: "realtime-database-server",
      label: "RTDB pelo servidor",
      status: "success",
      message: "A conta de serviço conseguiu consultar o Realtime Database.",
    });

    return jsonResponse({ checkedAt, checks });
  } catch (error) {
    console.error("Falha do Firebase Admin ao consultar o RTDB:", error);
    checks.push({
      id: "realtime-database-server",
      label: "RTDB pelo servidor",
      status: "error",
      message:
        "A conta de serviço não conseguiu consultar o Realtime Database.",
      recommendation:
        "Confira FIREBASE_ADMIN_DATABASE_URL, o projeto e as permissões da conta de serviço.",
    });

    return jsonResponse({ checkedAt, checks }, 503);
  }
}
