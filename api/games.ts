function jsonResponse(body: unknown, status: number, headers?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      ...headers,
    },
  });
}

interface HttpErrorLike extends Error {
  status: number;
  code: string;
}

function isHttpError(error: unknown): error is HttpErrorLike {
  return (
    error instanceof Error &&
    "status" in error &&
    typeof error.status === "number" &&
    "code" in error &&
    typeof error.code === "string"
  );
}

export function GET(): Response {
  return jsonResponse(
    {
      error: {
        code: "method-not-allowed",
        message: "Utilize POST para criar uma sala.",
      },
    },
    405,
    { allow: "POST" },
  );
}

export async function POST(request: Request): Promise<Response> {
  try {
    const [authorizationModule, firebaseModule, waitingRoomModule] =
      await Promise.all([
        import("./_lib/administrator-authorization"),
        import("./_lib/firebase-admin"),
        import("./_lib/waiting-room-service"),
      ]);
    const services = firebaseModule.getFirebaseAdminServices();
    const administrator =
      await authorizationModule.authorizeAdministratorRequest(
        request,
        services,
      );
    const room = await waitingRoomModule.createWaitingRoom(
      administrator.uid,
      services,
    );

    return jsonResponse({ room }, 201);
  } catch (error) {
    if (isHttpError(error)) {
      return jsonResponse(
        { error: { code: error.code, message: error.message } },
        error.status,
      );
    }

    console.error("Erro interno ao criar sala de espera:", error);

    return jsonResponse(
      {
        error: {
          code: "internal-error",
          message: "Não foi possível criar a sala. Tente novamente.",
        },
      },
      500,
    );
  }
}
