import { authorizeAdministratorRequest } from "./_lib/administrator-authorization";
import { getFirebaseAdminServices } from "./_lib/firebase-admin";
import { HttpError } from "./_lib/http-error";
import { createWaitingRoom } from "./_lib/waiting-room-service";

function jsonResponse(body: unknown, status: number, headers?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      ...headers,
    },
  });
}

const handler = {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
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

    try {
      const services = getFirebaseAdminServices();
      const administrator = await authorizeAdministratorRequest(
        request,
        services,
      );
      const room = await createWaitingRoom(administrator.uid, services);

      return jsonResponse({ room }, 201);
    } catch (error) {
      if (error instanceof HttpError) {
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
  },
};

export default handler;
