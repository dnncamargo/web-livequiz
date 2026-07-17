import { describe, expect, it, vi } from "vitest";
import type { FirebaseAdminServices } from "./firebase-admin";
import { authorizeAdministratorRequest } from "./administrator-authorization";

const validToken = {
  uid: "administrador-1",
  email: "admin@example.com",
  email_verified: true,
  firebase: { sign_in_provider: "google.com" },
};

function createServices(): FirebaseAdminServices {
  return {
    verifyIdToken: vi.fn().mockResolvedValue(validToken),
    getAdministratorProfile: vi.fn().mockResolvedValue({
      active: true,
      email: "admin@example.com",
    }),
    claimWaitingRoom: vi.fn(),
    publishWaitingRoom: vi.fn(),
    removeWaitingRoom: vi.fn(),
  };
}

function createRequest(token = "token-valido") {
  return new Request("https://quizumba.example/api/games", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("authorizeAdministratorRequest", () => {
  it("autoriza somente token Google com perfil ativo", async () => {
    const services = createServices();

    await expect(
      authorizeAdministratorRequest(createRequest(), services),
    ).resolves.toEqual({
      uid: "administrador-1",
      email: "admin@example.com",
    });
    expect(services.verifyIdToken).toHaveBeenCalledWith("token-valido");
    expect(services.getAdministratorProfile).toHaveBeenCalledWith(
      "administrador-1",
    );
  });

  it("rejeita requisição sem token", async () => {
    const services = createServices();
    const request = new Request("https://quizumba.example/api/games", {
      method: "POST",
    });

    await expect(
      authorizeAdministratorRequest(request, services),
    ).rejects.toMatchObject({
      status: 401,
      code: "authentication-required",
    });
  });

  it("rejeita conta que não entrou pelo Google", async () => {
    const services = createServices();
    vi.mocked(services.verifyIdToken).mockResolvedValue({
      ...validToken,
      firebase: { sign_in_provider: "anonymous" },
    });

    await expect(
      authorizeAdministratorRequest(createRequest(), services),
    ).rejects.toMatchObject({
      status: 403,
      code: "administrator-required",
    });
  });

  it("rejeita perfil inativo ou com e-mail divergente", async () => {
    const inactiveServices = createServices();
    vi.mocked(inactiveServices.getAdministratorProfile).mockResolvedValue({
      active: false,
    });

    await expect(
      authorizeAdministratorRequest(createRequest(), inactiveServices),
    ).rejects.toMatchObject({
      status: 403,
      code: "administrator-not-authorized",
    });

    const mismatchedServices = createServices();
    vi.mocked(mismatchedServices.getAdministratorProfile).mockResolvedValue({
      active: true,
      email: "outro@example.com",
    });

    await expect(
      authorizeAdministratorRequest(createRequest(), mismatchedServices),
    ).rejects.toMatchObject({
      status: 403,
      code: "administrator-email-mismatch",
    });
  });
});
