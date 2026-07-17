import { beforeEach, describe, expect, it, vi } from "vitest";
import { runConnectionDiagnostics } from "./connection-diagnostics";

const diagnosticClientMocks = vi.hoisted(() => ({
  checkAdministratorAuthorization: vi.fn(),
  onValue: vi.fn(),
  ref: vi.fn(),
  realtimeDatabase: { name: "realtime-database" },
}));

vi.mock("../auth/administrator-auth", () => ({
  checkAdministratorAuthorization:
    diagnosticClientMocks.checkAdministratorAuthorization,
}));

vi.mock("firebase/database", () => ({
  onValue: diagnosticClientMocks.onValue,
  ref: diagnosticClientMocks.ref,
}));

vi.mock("../../lib/firebase", () => ({
  realtimeDatabase: diagnosticClientMocks.realtimeDatabase,
}));

const diagnosticUser = {
  uid: "administrador-1",
  email: "admin@example.com",
  isAnonymous: false,
  providerData: [
    {
      displayName: "Administrador",
      email: "admin@example.com",
      phoneNumber: null,
      photoURL: null,
      providerId: "google.com",
      uid: "administrador-1",
    },
  ],
  getIdToken: vi.fn(),
};

describe("diagnóstico de conexão", () => {
  beforeEach(() => {
    diagnosticUser.getIdToken.mockReset().mockResolvedValue("token");
    diagnosticClientMocks.checkAdministratorAuthorization
      .mockReset()
      .mockResolvedValue({ authorized: true });
    diagnosticClientMocks.ref.mockReset().mockReturnValue({
      path: ".info/connected",
    });
    diagnosticClientMocks.onValue
      .mockReset()
      .mockImplementation(
        (
          _reference: unknown,
          onData: (snapshot: { val: () => boolean }) => void,
        ) => {
          queueMicrotask(() => onData({ val: () => true }));
          return vi.fn();
        },
      );
  });

  it("combina testes do navegador e do servidor sem criar uma sala", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: "method-not-allowed",
              message: "Utilize POST para criar uma sala.",
            },
          }),
          { status: 405 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            checkedAt: 1_000,
            checks: [
              {
                id: "firebase-admin",
                label: "Firebase Admin",
                status: "error",
                message: "A chave privada possui formato inválido.",
                recommendation: "Revise FIREBASE_ADMIN_PRIVATE_KEY.",
              },
            ],
          }),
          { status: 503 },
        ),
      );

    const report = await runConnectionDiagnostics(diagnosticUser, {
      fetch: fetchMock,
      isOnline: true,
    });

    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "browser-network", status: "success" }),
        expect.objectContaining({ id: "firebase-token", status: "success" }),
        expect.objectContaining({ id: "firestore-client", status: "success" }),
        expect.objectContaining({ id: "vercel-function", status: "success" }),
        expect.objectContaining({ id: "firebase-admin", status: "error" }),
      ]),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/diagnostics", {
      method: "POST",
      headers: { authorization: "Bearer token" },
    });
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/games",
      expect.objectContaining({ method: "POST" }),
    );
    expect(diagnosticClientMocks.ref).toHaveBeenCalledWith(
      diagnosticClientMocks.realtimeDatabase,
      ".info/connected",
    );
  });
});
