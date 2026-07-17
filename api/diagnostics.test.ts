import { beforeEach, describe, expect, it, vi } from "vitest";
import { FirebaseAdminConfigurationError } from "./_lib/firebase-admin.js";
import { POST } from "./diagnostics.js";

const diagnosticMocks = vi.hoisted(() => ({
  authorizeAdministratorRequest: vi.fn(),
  getFirebaseAdminServices: vi.fn(),
  services: {
    verifyIdToken: vi.fn(),
    getAdministratorProfile: vi.fn(),
    checkRealtimeDatabaseConnection: vi.fn(),
    claimWaitingRoom: vi.fn(),
    publishWaitingRoom: vi.fn(),
    removeWaitingRoom: vi.fn(),
    getWaitingRoom: vi.fn(),
    findActiveWaitingRoom: vi.fn(),
    registerParticipant: vi.fn(),
    getParticipant: vi.fn(),
    publishParticipantCount: vi.fn(),
    removeParticipant: vi.fn(),
  },
}));

vi.mock("./_lib/administrator-authorization.js", () => ({
  authorizeAdministratorRequest: diagnosticMocks.authorizeAdministratorRequest,
}));

vi.mock("./_lib/firebase-admin.js", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("./_lib/firebase-admin.js")>();

  return {
    ...original,
    getFirebaseAdminServices: diagnosticMocks.getFirebaseAdminServices,
  };
});

function createRequest(token = "token-administrativo") {
  return new Request("https://quizumba.example/api/diagnostics", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("POST /api/diagnostics", () => {
  beforeEach(() => {
    diagnosticMocks.authorizeAdministratorRequest
      .mockReset()
      .mockResolvedValue({ uid: "administrador-1" });
    diagnosticMocks.services.checkRealtimeDatabaseConnection
      .mockReset()
      .mockResolvedValue(undefined);
    diagnosticMocks.getFirebaseAdminServices
      .mockReset()
      .mockReturnValue(diagnosticMocks.services);
  });

  it("valida Firebase Admin, administrador e RTDB sem gravar dados", async () => {
    const response = await POST(createRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.checks).toEqual([
      expect.objectContaining({ id: "firebase-admin", status: "success" }),
      expect.objectContaining({
        id: "server-authorization",
        status: "success",
      }),
      expect.objectContaining({
        id: "realtime-database-server",
        status: "success",
      }),
    ]);
    expect(
      diagnosticMocks.services.checkRealtimeDatabaseConnection,
    ).toHaveBeenCalledOnce();
    expect(diagnosticMocks.services.claimWaitingRoom).not.toHaveBeenCalled();
    expect(diagnosticMocks.services.publishWaitingRoom).not.toHaveBeenCalled();
    expect(diagnosticMocks.services.removeWaitingRoom).not.toHaveBeenCalled();
  });

  it("identifica uma chave privada inválida sem expor seu valor", async () => {
    diagnosticMocks.getFirebaseAdminServices.mockImplementation(() => {
      throw new FirebaseAdminConfigurationError(
        "firebase-admin-private-key-invalid",
        "A chave privada da conta de serviço não possui o formato PEM esperado.",
      );
    });

    const response = await POST(createRequest());
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.checks[0]).toMatchObject({
      id: "firebase-admin",
      status: "error",
      recommendation: expect.stringContaining("FIREBASE_ADMIN_PRIVATE_KEY"),
    });
    expect(JSON.stringify(payload)).not.toContain("BEGIN PRIVATE KEY");
  });

  it("não inicializa serviços administrativos sem bearer token", async () => {
    const response = await POST(
      new Request("https://quizumba.example/api/diagnostics", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
    expect(diagnosticMocks.getFirebaseAdminServices).not.toHaveBeenCalled();
  });
});
