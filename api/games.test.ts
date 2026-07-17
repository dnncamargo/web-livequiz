import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "./_lib/http-error";
import { GET, POST } from "./games";

const apiMocks = vi.hoisted(() => ({
  services: { name: "firebase-admin-services" },
  authorizeAdministratorRequest: vi.fn(),
  createWaitingRoom: vi.fn(),
}));

vi.mock("./_lib/firebase-admin", () => ({
  getFirebaseAdminServices: () => apiMocks.services,
}));

vi.mock("./_lib/administrator-authorization", () => ({
  authorizeAdministratorRequest: apiMocks.authorizeAdministratorRequest,
}));

vi.mock("./_lib/waiting-room-service", () => ({
  createWaitingRoom: apiMocks.createWaitingRoom,
}));

describe("POST /api/games", () => {
  beforeEach(() => {
    apiMocks.authorizeAdministratorRequest
      .mockReset()
      .mockResolvedValue({ uid: "administrador-1" });
    apiMocks.createWaitingRoom.mockReset().mockResolvedValue({
      id: "ABC234",
      phase: "waiting",
      createdAt: 1_000,
      participantCount: 0,
    });
  });

  it("cria uma sala para o administrador validado", async () => {
    const request = new Request("https://quizumba.example/api/games", {
      method: "POST",
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      room: {
        id: "ABC234",
        phase: "waiting",
        createdAt: 1_000,
        participantCount: 0,
      },
    });
    expect(apiMocks.createWaitingRoom).toHaveBeenCalledWith(
      "administrador-1",
      apiMocks.services,
    );
  });

  it("rejeita outros métodos", async () => {
    const response = GET();

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  it("não cria sala quando a autorização falha", async () => {
    apiMocks.authorizeAdministratorRequest.mockRejectedValue(
      new HttpError(
        403,
        "administrator-not-authorized",
        "Esta conta não está autorizada a criar salas.",
      ),
    );

    const response = await POST(
      new Request("https://quizumba.example/api/games", { method: "POST" }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "administrator-not-authorized" },
    });
    expect(apiMocks.createWaitingRoom).not.toHaveBeenCalled();
  });
});
